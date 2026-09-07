package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type corrRow struct {
	Kind    string  `json:"kind"`
	Name    string  `json:"name"`
	Km      float64 `json:"km"`
	File    string  `json:"file"`
	Verdict string  `json:"verdict"`
}

// runCorrelate mirrors scripts/correlate-poi.mjs: pool every point across a set
// of GPX/KML/CSV tracks and, for each POI (and optionally stay), report the
// nearest recorded point, its source file and a verdict.
func runCorrelate(args []string) int {
	tripFile, okKm, withStays, asJSON := "", 3.0, false, false
	var files []string
	for i := 0; i < len(args); i++ {
		a := args[i]
		switch {
		case a == "--trip" && i+1 < len(args):
			i++
			tripFile = args[i]
		case a == "--km" && i+1 < len(args):
			i++
			if v, err := strconv.ParseFloat(args[i], 64); err == nil {
				okKm = v
			} else {
				okKm = math.NaN()
			}
		case a == "--stays":
			withStays = true
		case a == "--json":
			asJSON = true
		case strings.HasPrefix(a, "--"):
			fmt.Fprintf(os.Stderr, "unknown flag: %s\n", a)
			return 1
		default:
			files = append(files, a)
		}
	}
	if len(files) == 0 {
		fmt.Fprintln(os.Stderr, "usage: journey-atlas correlate [--trip <file>] [--km 3] [--stays] [--json] <track.gpx|kml|csv> …")
		return 1
	}

	src := tripFile
	if src == "" {
		src = "src/lib/journey.json"
	}
	t, err := loadTrip(src)
	if err != nil {
		fatal(err.Error())
	}

	type target struct {
		kind, name string
		lat, lon   float64
	}
	var targets []target
	for _, p := range t.Pois {
		targets = append(targets, target{"poi", p.Name, p.Lat, p.Lon})
	}
	if withStays {
		for _, s := range t.Stays {
			targets = append(targets, target{"stay", s.Area, s.Lat, s.Lon})
		}
	}
	kindLabel := "POIs"
	if withStays {
		kindLabel = "stays/POIs"
	}
	if len(targets) == 0 {
		fmt.Fprintf(os.Stderr, "✗ no %s found in %s\n", kindLabel, src)
		return 1
	}

	type stat struct {
		points, hits int
	}
	var order []string
	stats := map[string]*stat{}
	var points []TaggedPoint
	for _, file := range files {
		tag := filepath.Base(file)
		track, wpts := readTrack(file)
		n := 0
		for _, p := range track {
			points = append(points, TaggedPoint{p[0], p[1], tag})
			n++
		}
		for _, w := range wpts {
			points = append(points, TaggedPoint{w.Lat, w.Lon, tag})
			n++
		}
		if _, seen := stats[tag]; !seen {
			order = append(order, tag)
			stats[tag] = &stat{}
		}
		stats[tag].points += n
	}
	if len(points) == 0 {
		fmt.Fprintf(os.Stderr, "✗ no usable GPS points across %d file(s)\n", len(files))
		return 1
	}

	rows := make([]corrRow, 0, len(targets))
	for _, t := range targets {
		km, idx := nearestPoint(Point{t.lat, t.lon}, points)
		file := points[idx].File
		stats[file].hits++
		rows = append(rows, corrRow{t.kind, t.name, math.Round(km*100) / 100, file, verdict(km, okKm)})
	}

	if asJSON {
		var buf bytes.Buffer
		enc := json.NewEncoder(&buf)
		enc.SetEscapeHTML(false)
		enc.SetIndent("", "  ")
		_ = enc.Encode(rows)
		fmt.Print(buf.String())
		return exitCode(rows)
	}

	fmt.Printf("Correlating %d %s against %d points from %d file(s)   OK threshold: %s km\n\n",
		len(targets), kindLabel, len(points), len(files), jsNum(okKm))
	for _, r := range rows {
		line := padEndJS(r.Kind, 4) + " " + padEndJS(r.Name, 24) + " " +
			padStartJS(jsFixed(r.Km, 2), 8) + " km   " + padEndJS(r.Verdict, 7) + " " + r.File
		fmt.Println(strings.TrimRight(line, " "))
	}
	ok, near, miss := 0, 0, 0
	for _, r := range rows {
		switch r.Verdict {
		case "OK":
			ok++
		case "~near":
			near++
		default:
			miss++
		}
	}
	fmt.Printf("\n%d OK · %d ~near · %d NO-GPS\n", ok, near, miss)
	fmt.Println("\nnearest-source breakdown:")
	for _, tag := range order {
		s := stats[tag]
		fmt.Printf("  %s %s pts   nearest for %d target(s)\n",
			padEndJS(tag, 28), padStartJS(strconv.Itoa(s.points), 6), s.hits)
	}
	return exitCode(rows)
}

func exitCode(rows []corrRow) int {
	for _, r := range rows {
		if r.Verdict == "NO-GPS" {
			return 1
		}
	}
	return 0
}
