package main

import (
	"fmt"
	"math"
	"os"
	"strconv"
)

// runVerifyGPS mirrors scripts/verify-gps.mjs: check every stay + POI in the
// compiled src/lib/journey.json against the nearest point of a GPS CSV track.
func runVerifyGPS(args []string) int {
	if len(args) < 1 {
		fmt.Fprintln(os.Stderr, "usage: journey-atlas verify-gps <track.csv> [okKm]")
		return 1
	}
	csvFile := args[0]
	okKm := 3.0
	if len(args) > 1 {
		if v, err := strconv.ParseFloat(args[1], 64); err == nil {
			okKm = v
		} else {
			okKm = math.NaN()
		}
	}

	t, err := loadTrip("src/lib/journey.json")
	if err != nil {
		fatal(err.Error())
	}
	raw, err := os.ReadFile(csvFile)
	if err != nil {
		fatal(err.Error())
	}
	track := parseCSV(string(raw))

	nearest := func(p Point) float64 {
		m := math.Inf(1)
		for _, g := range track {
			if d := haversineKm(p, g); d < m {
				m = d
			}
		}
		return m
	}
	check := func(label, name string, lat, lon float64) {
		d := nearest(Point{lat, lon})
		fmt.Println(padEndJS(label, 6) + " " + padEndJS(name, 24) + " " +
			padStartJS(jsFixed(d, 2), 7) + " km   " + verdict(d, okKm))
	}

	fmt.Printf("Track: %s (%d points)   OK threshold: %s km\n\n", csvFile, len(track), jsNum(okKm))
	fmt.Println("=== STAYS ===")
	for _, s := range t.Stays {
		check("stay", s.Area, s.Lat, s.Lon)
	}
	fmt.Println("\n=== POIS ===")
	for _, p := range t.Pois {
		check("poi", p.Name, p.Lat, p.Lon)
	}
	return 0
}
