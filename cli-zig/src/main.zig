// journey-atlas (Zig) — a native `verify-gps`, the browser-free sanity check that
// every stay + POI in src/lib/journey.json sits near a real GPS point (e.g. one
// extracted from geotagged trip photos). A Zig companion to the Deno script
// scripts/verify-gps.mjs, byte-for-byte identical on the same inputs.
//
//   journey-atlas-verify data/example-gps.csv
//   journey-atlas-verify my-track.csv 3      # custom "OK" threshold (km)
//
// The CSV needs `latitude` and `longitude` columns (a header row). Run from the
// repo root so the fixed src/lib/journey.json path resolves. Exit 1 on usage /
// I/O error, 0 otherwise — mirrors the Deno script so either can drop into CI.

const std = @import("std");

const journey_path = "src/lib/journey.json";

pub fn main(init: std.process.Init) !void {
    // The process arena lives until exit and is freed in one shot, so a
    // short-lived CLI never needs to track individual allocations.
    const gpa = init.arena.allocator();
    const io = init.io;
    const out = std.Io.File.stdout();
    const err = std.Io.File.stderr();

    // --- args: <track.csv> [okKm] ------------------------------------------
    var args = std.process.Args.Iterator.init(init.minimal.args);
    _ = args.next(); // argv0
    const csv_path = args.next() orelse {
        try err.writeStreamingAll(io, "usage: journey-atlas-verify <track.csv> [okKm]\n");
        std.process.exit(1);
    };
    const ok_km: f64 = if (args.next()) |s|
        (std.fmt.parseFloat(f64, std.mem.trim(u8, s, " \t")) catch 3)
    else
        3;

    // --- load journey.json + the GPS track ---------------------------------
    const journey_raw = std.Io.Dir.cwd().readFileAlloc(io, journey_path, gpa, .unlimited) catch {
        try err.writeStreamingAll(io, "cannot read " ++ journey_path ++ " (run from the repo root)\n");
        std.process.exit(1);
    };
    const csv_raw = std.Io.Dir.cwd().readFileAlloc(io, csv_path, gpa, .unlimited) catch {
        var buf: [512]u8 = undefined;
        try err.writeStreamingAll(io, std.fmt.bufPrint(&buf, "cannot read {s}\n", .{csv_path}) catch "cannot read track\n");
        std.process.exit(1);
    };

    const journey = std.json.parseFromSliceLeaky(std.json.Value, gpa, journey_raw, .{}) catch {
        try err.writeStreamingAll(io, "cannot parse " ++ journey_path ++ "\n");
        std.process.exit(1);
    };

    const track = try parseCsv(gpa, csv_raw);

    // --- build the report into a buffer, then emit it in one write ----------
    var buf: std.ArrayList(u8) = .empty;
    defer buf.deinit(gpa);

    try buf.print(gpa, "Track: {s} ({d} points)   OK threshold: {f} km\n\n", .{
        csv_path, track.len, Num{ .v = ok_km },
    });

    try buf.appendSlice(gpa, "=== STAYS ===\n");
    if (journey.object.get("stays")) |stays| {
        for (stays.array.items) |s| {
            try line(&buf, gpa, "stay", str(s, "area"), asF64(s.object.get("lat")), asF64(s.object.get("lon")), track, ok_km);
        }
    }

    try buf.appendSlice(gpa, "\n=== POIS ===\n");
    if (journey.object.get("pois")) |pois| {
        for (pois.array.items) |p| {
            try line(&buf, gpa, "poi", str(p, "name"), asF64(p.object.get("lat")), asF64(p.object.get("lon")), track, ok_km);
        }
    }

    try out.writeStreamingAll(io, buf.items);
}

// One report row, matching the Deno template exactly:
//   `${label.padEnd(6)} ${name.padEnd(24)} ${d.toFixed(2).padStart(7)} km   ${verdict}`
fn line(buf: *std.ArrayList(u8), gpa: std.mem.Allocator, label: []const u8, name: []const u8, lat: f64, lon: f64, track: []const [2]f64, ok_km: f64) !void {
    const d = nearest(lat, lon, track);
    try padEnd(buf, gpa, label, 6);
    try buf.append(gpa, ' ');
    try padEnd(buf, gpa, name, 24);
    try buf.append(gpa, ' ');

    var num: [32]u8 = undefined;
    const dstr = try std.fmt.bufPrint(&num, "{f}", .{Fixed2{ .v = d }});
    try padStart(buf, gpa, dstr, 7);

    try buf.appendSlice(gpa, " km   ");
    try buf.appendSlice(gpa, verdict(d, ok_km));
    try buf.append(gpa, '\n');
}

fn verdict(d: f64, ok_km: f64) []const u8 {
    if (d <= ok_km) return "OK";
    if (d <= ok_km * 2.5) return "~near";
    return "NO-GPS";
}

// Great-circle distance in km (haversine, R=6371) — same constants as the JS.
fn km(lat1: f64, lon1: f64, lat2: f64, lon2: f64) f64 {
    const R = 6371.0;
    const rad = std.math.pi / 180.0;
    const d_lat = (lat2 - lat1) * rad;
    const d_lon = (lon2 - lon1) * rad;
    const la1 = lat1 * rad;
    const la2 = lat2 * rad;
    const h = std.math.pow(f64, @sin(d_lat / 2), 2) +
        @cos(la1) * @cos(la2) * std.math.pow(f64, @sin(d_lon / 2), 2);
    return 2 * R * std.math.asin(@sqrt(h));
}

fn nearest(lat: f64, lon: f64, track: []const [2]f64) f64 {
    var m: f64 = std.math.inf(f64);
    for (track) |g| m = @min(m, km(lat, lon, g[0], g[1]));
    return m;
}

// CSV → [lat, lon] pairs. Header row locates the `latitude`/`longitude` columns
// (case-insensitive); rows with unparseable coords are skipped, like the JS.
fn parseCsv(gpa: std.mem.Allocator, txt: []const u8) ![]const [2]f64 {
    var pts: std.ArrayList([2]f64) = .empty;
    var lines = std.mem.splitAny(u8, std.mem.trim(u8, txt, " \t\r\n"), "\n");

    const header = lines.next() orelse return pts.toOwnedSlice(gpa);
    var la: ?usize = null;
    var lo: ?usize = null;
    var hcols = std.mem.splitScalar(u8, header, ',');
    var i: usize = 0;
    while (hcols.next()) |c| : (i += 1) {
        const h = std.mem.trim(u8, c, " \t\r");
        if (std.ascii.eqlIgnoreCase(h, "latitude")) la = i;
        if (std.ascii.eqlIgnoreCase(h, "longitude")) lo = i;
    }
    const li = la orelse return error.NoLatLon;
    const oi = lo orelse return error.NoLatLon;

    while (lines.next()) |ln| {
        const row = std.mem.trim(u8, ln, " \t\r");
        if (row.len == 0) continue;
        var cols = std.mem.splitScalar(u8, row, ',');
        var idx: usize = 0;
        var lat: ?f64 = null;
        var lon: ?f64 = null;
        while (cols.next()) |c| : (idx += 1) {
            if (idx == li) lat = std.fmt.parseFloat(f64, std.mem.trim(u8, c, " \t\r")) catch null;
            if (idx == oi) lon = std.fmt.parseFloat(f64, std.mem.trim(u8, c, " \t\r")) catch null;
        }
        if (lat) |a| if (lon) |b| try pts.append(gpa, .{ a, b });
    }
    return pts.toOwnedSlice(gpa);
}

// --- small JSON + string helpers ------------------------------------------

fn str(v: std.json.Value, key: []const u8) []const u8 {
    return switch (v.object.get(key) orelse return "") {
        .string => |s| s,
        else => "",
    };
}

fn asF64(v: ?std.json.Value) f64 {
    const val = v orelse return 0;
    return switch (val) {
        .float => |f| f,
        .integer => |n| @floatFromInt(n),
        .number_string => |s| std.fmt.parseFloat(f64, s) catch 0,
        else => 0,
    };
}

// Pad to `width` on the right, counting Unicode code points (JS String#padEnd
// counts UTF-16 units; for the BMP names in these trips that equals code points).
fn padEnd(buf: *std.ArrayList(u8), gpa: std.mem.Allocator, s: []const u8, width: usize) !void {
    try buf.appendSlice(gpa, s);
    const n = std.unicode.utf8CountCodepoints(s) catch s.len;
    var i = n;
    while (i < width) : (i += 1) try buf.append(gpa, ' ');
}

fn padStart(buf: *std.ArrayList(u8), gpa: std.mem.Allocator, s: []const u8, width: usize) !void {
    const n = std.unicode.utf8CountCodepoints(s) catch s.len;
    var i = n;
    while (i < width) : (i += 1) try buf.append(gpa, ' ');
    try buf.appendSlice(gpa, s);
}

// Formats a float like JS Number#toFixed(2): always two decimals.
const Fixed2 = struct {
    v: f64,
    pub fn format(self: Fixed2, w: *std.Io.Writer) std.Io.Writer.Error!void {
        try w.print("{d:.2}", .{self.v});
    }
};

// Formats the OK threshold like a bare JS number: integers without a decimal
// point (3 → "3"), otherwise the shortest round-tripping form (2.5 → "2.5").
const Num = struct {
    v: f64,
    pub fn format(self: Num, w: *std.Io.Writer) std.Io.Writer.Error!void {
        if (self.v == @floor(self.v) and std.math.isFinite(self.v)) {
            try w.print("{d}", .{@as(i64, @intFromFloat(self.v))});
        } else {
            try w.print("{d}", .{self.v});
        }
    }
};
