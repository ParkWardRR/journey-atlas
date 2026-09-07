package main

import (
	"math"
	"os"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf16"
)

// NamedPoint is a labelled coordinate (a GPX/KML waypoint, or a trip POI/stay).
type NamedPoint struct {
	Name string
	Lat  float64
	Lon  float64
}

// TaggedPoint is a recorded track point plus the file it came from (correlate).
type TaggedPoint struct {
	Lat  float64
	Lon  float64
	File string
}

const (
	rKM = 6371.0
	rM  = 6_371_000.0
	rad = math.Pi / 180
)

// haversineMeters mirrors scripts/lib/geo.mjs haversineMeters.
func haversineMeters(a, b Point) float64 {
	dLat := (b[0] - a[0]) * rad
	dLon := (b[1] - a[1]) * rad
	la1, la2 := a[0]*rad, b[0]*rad
	h := math.Sin(dLat/2)*math.Sin(dLat/2) + math.Cos(la1)*math.Cos(la2)*math.Sin(dLon/2)*math.Sin(dLon/2)
	return 2 * rM * math.Asin(math.Sqrt(h))
}

// proj/perpDistMeters/simplify mirror scripts/lib/geo.mjs.
func proj(p Point, lat0 float64) (float64, float64) {
	return p[1] * 111320 * math.Cos(lat0*rad), p[0] * 111320
}

func perpDistMeters(p, a, b Point, lat0 float64) float64 {
	px, py := proj(p, lat0)
	ax, ay := proj(a, lat0)
	bx, by := proj(b, lat0)
	dx, dy := bx-ax, by-ay
	len2 := dx*dx + dy*dy
	if len2 == 0 {
		return math.Hypot(px-ax, py-ay)
	}
	t := ((px-ax)*dx + (py-ay)*dy) / len2
	t = math.Max(0, math.Min(1, t))
	return math.Hypot(px-(ax+t*dx), py-(ay+t*dy))
}

// simplify is Douglas–Peucker with a metres tolerance (keeps first + last).
func simplify(points []Point, tolMeters float64) []Point {
	if len(points) < 3 {
		return points
	}
	lat0 := points[0][0]
	keep := make([]bool, len(points))
	keep[0], keep[len(points)-1] = true, true
	stack := [][2]int{{0, len(points) - 1}}
	for len(stack) > 0 {
		seg := stack[len(stack)-1]
		stack = stack[:len(stack)-1]
		lo, hi := seg[0], seg[1]
		maxD, idx := 0.0, -1
		for i := lo + 1; i < hi; i++ {
			d := perpDistMeters(points[i], points[lo], points[hi], lat0)
			if d > maxD {
				maxD, idx = d, i
			}
		}
		if maxD > tolMeters && idx != -1 {
			keep[idx] = true
			stack = append(stack, [2]int{lo, idx}, [2]int{idx, hi})
		}
	}
	out := points[:0:0]
	for i, p := range points {
		if keep[i] {
			out = append(out, p)
		}
	}
	return out
}

// nearestPoint returns the closest tagged point to target and its km distance.
func nearestPoint(target Point, points []TaggedPoint) (float64, int) {
	best, km := -1, math.Inf(1)
	for i, p := range points {
		d := haversineKm(target, Point{p.Lat, p.Lon})
		if d < km {
			km, best = d, i
		}
	}
	return km, best
}

// verdict mirrors scripts/lib/tracks.mjs: OK / ~near / NO-GPS.
func verdict(km, okKm float64) string {
	switch {
	case km <= okKm:
		return "OK"
	case km <= okKm*2.5:
		return "~near"
	default:
		return "NO-GPS"
	}
}

// ---- track readers (mirror scripts/lib/tracks.mjs) --------------------------

var (
	reTrkpt = regexp.MustCompile(`<(?:trkpt|rtept)\b([^>]*)>`)
	reWpt   = regexp.MustCompile(`(?s)<wpt\b([^>]*)>(.*?)</wpt>`)
	reName  = regexp.MustCompile(`(?s)<name>(.*?)</name>`)
	reLine  = regexp.MustCompile(`(?is)<LineString>.*?<coordinates>(.*?)</coordinates>.*?</LineString>`)
	rePlace = regexp.MustCompile(`(?s)<Placemark>(.*?)</Placemark>`)
	rePoint = regexp.MustCompile(`(?s)<Point>.*?<coordinates>(.*?)</coordinates>`)
)

func attrFloat(tag, name string) (float64, bool) {
	re := regexp.MustCompile(name + `\s*=\s*"([^"]+)"`)
	m := re.FindStringSubmatch(tag)
	if m == nil {
		return 0, false
	}
	f, err := strconv.ParseFloat(m[1], 64)
	return f, err == nil
}

func parseCSV(txt string) []Point {
	lines := strings.Split(strings.TrimSpace(txt), "\n")
	head := strings.Split(strings.TrimRight(lines[0], "\r"), ",")
	la, lo := -1, -1
	for i, h := range head {
		switch strings.ToLower(strings.TrimSpace(h)) {
		case "latitude":
			la = i
		case "longitude":
			lo = i
		}
	}
	if la < 0 || lo < 0 {
		fatal("CSV needs `latitude` and `longitude` columns")
	}
	var pts []Point
	for _, ln := range lines[1:] {
		c := strings.Split(strings.TrimRight(ln, "\r"), ",")
		if la >= len(c) || lo >= len(c) {
			continue
		}
		lat, e1 := strconv.ParseFloat(strings.TrimSpace(c[la]), 64)
		lon, e2 := strconv.ParseFloat(strings.TrimSpace(c[lo]), 64)
		if e1 == nil && e2 == nil {
			pts = append(pts, Point{lat, lon})
		}
	}
	return pts
}

func parseGPX(x string) ([]Point, []NamedPoint) {
	var track []Point
	for _, m := range reTrkpt.FindAllStringSubmatch(x, -1) {
		lat, ok1 := attrFloat(m[1], "lat")
		lon, ok2 := attrFloat(m[1], "lon")
		if ok1 && ok2 {
			track = append(track, Point{lat, lon})
		}
	}
	var pois []NamedPoint
	for _, m := range reWpt.FindAllStringSubmatch(x, -1) {
		lat, ok1 := attrFloat(m[1], "lat")
		lon, ok2 := attrFloat(m[1], "lon")
		if !ok1 || !ok2 {
			continue
		}
		name := "Waypoint"
		if nm := reName.FindStringSubmatch(m[2]); nm != nil {
			name = strings.TrimSpace(nm[1])
		}
		pois = append(pois, NamedPoint{name, lat, lon})
	}
	return track, pois
}

func parseKML(x string) ([]Point, []NamedPoint) {
	var track []Point
	if line := reLine.FindStringSubmatch(x); line != nil {
		for _, tok := range strings.Fields(strings.TrimSpace(line[1])) {
			parts := strings.Split(tok, ",") // lon,lat[,alt]
			if len(parts) < 2 {
				continue
			}
			lon, e1 := strconv.ParseFloat(parts[0], 64)
			lat, e2 := strconv.ParseFloat(parts[1], 64)
			if e1 == nil && e2 == nil {
				track = append(track, Point{lat, lon})
			}
		}
	}
	var pois []NamedPoint
	for _, m := range rePlace.FindAllStringSubmatch(x, -1) {
		body := m[1]
		if !strings.Contains(body, "<Point>") {
			continue
		}
		c := rePoint.FindStringSubmatch(body)
		if c == nil {
			continue
		}
		first := strings.Fields(strings.TrimSpace(c[1]))
		if len(first) == 0 {
			continue
		}
		parts := strings.Split(first[0], ",")
		if len(parts) < 2 {
			continue
		}
		lon, e1 := strconv.ParseFloat(parts[0], 64)
		lat, e2 := strconv.ParseFloat(parts[1], 64)
		if e1 != nil || e2 != nil {
			continue
		}
		name := "Waypoint"
		if nm := reName.FindStringSubmatch(body); nm != nil {
			name = strings.TrimSpace(nm[1])
		}
		pois = append(pois, NamedPoint{name, lat, lon})
	}
	return track, pois
}

// readTrack dispatches on extension (and a KML sniff), like scripts/lib/tracks.mjs.
func readTrack(path string) ([]Point, []NamedPoint) {
	raw, err := os.ReadFile(path)
	if err != nil {
		fatal(path + ": " + err.Error())
	}
	s := string(raw)
	lower := strings.ToLower(path)
	if strings.HasSuffix(lower, ".csv") {
		return parseCSV(s), nil
	}
	if strings.HasSuffix(lower, ".kml") || regexp.MustCompile(`<kml[\s>]`).MatchString(s) {
		return parseKML(s)
	}
	return parseGPX(s)
}

// ---- JS-compatible number + string formatting -------------------------------

// jsNum formats a float like JavaScript's String(n): shortest, no exponent for
// the magnitudes we deal with (coordinates, distances), integers without ".0".
func jsNum(f float64) string {
	return strconv.FormatFloat(f, 'f', -1, 64)
}

// jsFixed mirrors Number.prototype.toFixed.
func jsFixed(f float64, d int) string {
	return strconv.FormatFloat(f, 'f', d, 64)
}

func round6(n float64) float64 { return math.Round(n*1e6) / 1e6 }

// jsRound matches JavaScript's Math.round (round half toward +Infinity).
func jsRound(n float64) float64 { return math.Floor(n + 0.5) }

// utf16Len counts UTF-16 code units, matching JavaScript's String.length — so
// padEnd/padStart line up on non-ASCII names (Durrës, Brønnøysund).
func utf16Len(s string) int { return len(utf16.Encode([]rune(s))) }

func padEndJS(s string, w int) string {
	if d := w - utf16Len(s); d > 0 {
		return s + strings.Repeat(" ", d)
	}
	return s
}

func padStartJS(s string, w int) string {
	if d := w - utf16Len(s); d > 0 {
		return strings.Repeat(" ", d) + s
	}
	return s
}

func fatal(msg string) {
	os.Stderr.WriteString(msg + "\n")
	os.Exit(1)
}
