package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
)

type gpxSeg struct {
	Cls  string       `json:"cls"`
	Line [][2]float64 `json:"line"`
}
type gpxDrive struct {
	Label string   `json:"label"`
	Segs  []gpxSeg `json:"segs"`
}
type gpxRoadStat struct {
	Cls   string `json:"cls"`
	Label string `json:"label"`
	Mi    int    `json:"mi"`
}
type gpxPoi struct {
	Name string  `json:"name"`
	Lat  float64 `json:"lat"`
	Lon  float64 `json:"lon"`
}
type gpxFragment struct {
	TotalMiles int           `json:"totalMiles"`
	Drives     []gpxDrive    `json:"drives"`
	RoadStats  []gpxRoadStat `json:"roadStats"`
	Pois       []gpxPoi      `json:"pois,omitempty"`
}

var clsOK = map[string]bool{"motorway": true, "a": true, "b": true, "minor": true}

// runGPXImport mirrors scripts/gpx-import.mjs: a recorded GPX/KML track →
// paste-ready drives[] fragment (YAML by default, JSON with --json).
func runGPXImport(args []string) int {
	opt := func(name, def string) string {
		for i, a := range args {
			if a == "--"+name && i+1 < len(args) && !strings.HasPrefix(args[i+1], "--") {
				return args[i+1]
			}
		}
		return def
	}
	var file string
	asJSON := false
	for _, a := range args {
		if a == "--json" {
			asJSON = true
		} else if !strings.HasPrefix(a, "--") && file == "" {
			file = a
		}
	}
	cls := opt("cls", "minor")
	tolM, _ := strconv.ParseFloat(opt("tol", "60"), 64)

	if file == "" {
		fmt.Fprintln(os.Stderr, "usage: journey-atlas gpx <track.gpx|track.kml> [--cls minor] [--tol 60] [--json]")
		return 1
	}
	if !clsOK[cls] {
		fmt.Fprintf(os.Stderr, "--cls must be one of: motorway, a, b, minor (got %q)\n", cls)
		return 1
	}

	track, pois := readTrack(file)
	if len(track) < 2 {
		fmt.Fprintf(os.Stderr, "✗ no usable track found in %s (need at least 2 points; found %d)\n", file, len(track))
		return 1
	}

	totalMetres := 0.0
	for i := 1; i < len(track); i++ {
		totalMetres += haversineMeters(track[i-1], track[i])
	}
	miles := int(jsRound(totalMetres / 1609.344))

	kept := simplify(track, tolM)
	line := make([][2]float64, len(kept))
	for i, p := range kept {
		line[i] = [2]float64{round6(p[0]), round6(p[1])}
	}

	frag := gpxFragment{
		TotalMiles: miles,
		Drives:     []gpxDrive{{Label: "Recorded track", Segs: []gpxSeg{{Cls: cls, Line: line}}}},
		RoadStats:  []gpxRoadStat{{Cls: cls, Label: "Recorded track", Mi: miles}},
	}
	for _, p := range pois {
		frag.Pois = append(frag.Pois, gpxPoi{p.Name, round6(p.Lat), round6(p.Lon)})
	}

	fmt.Fprintf(os.Stderr, "%s: %d track pts → %d kept (tol %s m) · %d mi · %d waypoint(s) → pois\n\n",
		file, len(track), len(kept), jsNum(tolM), miles, len(pois))

	if asJSON {
		var buf bytes.Buffer
		enc := json.NewEncoder(&buf)
		enc.SetEscapeHTML(false)
		enc.SetIndent("", "  ")
		_ = enc.Encode(frag)
		fmt.Print(buf.String())
		return 0
	}
	fmt.Println(gpxYAML(frag))
	return 0
}

// gpxYAML reproduces the exact bytes scripts/gpx-import.mjs emits via the `yaml`
// library: 2-space indent, block maps/seqs, and `[ lat, lon ]` flow coord pairs.
func gpxYAML(f gpxFragment) string {
	var b strings.Builder
	fmt.Fprintf(&b, "totalMiles: %d\n", f.TotalMiles)
	b.WriteString("drives:\n")
	for _, d := range f.Drives {
		fmt.Fprintf(&b, "  - label: %s\n", yamlScalar(d.Label))
		b.WriteString("    segs:\n")
		for _, s := range d.Segs {
			fmt.Fprintf(&b, "      - cls: %s\n", yamlScalar(s.Cls))
			b.WriteString("        line:\n")
			for _, p := range s.Line {
				fmt.Fprintf(&b, "          - [ %s, %s ]\n", jsNum(p[0]), jsNum(p[1]))
			}
		}
	}
	b.WriteString("roadStats:\n")
	for _, r := range f.RoadStats {
		fmt.Fprintf(&b, "  - cls: %s\n", yamlScalar(r.Cls))
		fmt.Fprintf(&b, "    label: %s\n", yamlScalar(r.Label))
		fmt.Fprintf(&b, "    mi: %d\n", r.Mi)
	}
	if len(f.Pois) > 0 {
		b.WriteString("pois:\n")
		for _, p := range f.Pois {
			fmt.Fprintf(&b, "  - name: %s\n", yamlScalar(p.Name))
			fmt.Fprintf(&b, "    lat: %s\n", jsNum(p.Lat))
			fmt.Fprintf(&b, "    lon: %s\n", jsNum(p.Lon))
		}
	}
	return strings.TrimRight(b.String(), "\n")
}

// yamlScalar renders a plain string, double-quoting only when a bare scalar
// would be ambiguous (mirrors the common cases the `yaml` library quotes).
func yamlScalar(s string) string {
	if s == "" {
		return `""`
	}
	if strings.ContainsAny(s, ":#\n\"'") ||
		strings.HasPrefix(s, " ") || strings.HasSuffix(s, " ") ||
		strings.ContainsAny(s[:1], "!&*?|>%@`,[]{}-") {
		b, _ := json.Marshal(s) // JSON string == YAML double-quoted scalar
		return string(b)
	}
	return s
}
