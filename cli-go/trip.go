package main

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// Point is a [lat, lon] pair in decimal degrees.
type Point [2]float64

func (p Point) Lat() float64 { return p[0] }
func (p Point) Lon() float64 { return p[1] }

// Trip is the subset of the journey schema the CLI reasons about. JSON is valid
// YAML, so one yaml.Unmarshal handles both .yaml and .json trips.
type Trip struct {
	Title      string  `yaml:"title"`
	TotalMiles float64 `yaml:"totalMiles"`
	Drives     []struct {
		Label string `yaml:"label"`
		Segs  []struct {
			Cls  string  `yaml:"cls"`
			Line []Point `yaml:"line"`
		} `yaml:"segs"`
	} `yaml:"drives"`
	Ferries []struct {
		Num   int    `yaml:"num"`
		Short string `yaml:"short"`
		A     Point  `yaml:"a"`
		B     Point  `yaml:"b"`
	} `yaml:"ferries"`
	Stays []struct {
		Area string  `yaml:"area"`
		Lat  float64 `yaml:"lat"`
		Lon  float64 `yaml:"lon"`
	} `yaml:"stays"`
	Pois []struct {
		Name string  `yaml:"name"`
		Lat  float64 `yaml:"lat"`
		Lon  float64 `yaml:"lon"`
	} `yaml:"pois"`
	RoadStats []struct {
		Cls   string  `yaml:"cls"`
		Label string  `yaml:"label"`
		Mi    float64 `yaml:"mi"`
	} `yaml:"roadStats"`
	Insets []struct {
		Title  string  `yaml:"title"`
		Center Point   `yaml:"center"`
		Zoom   float64 `yaml:"zoom"`
		Cx     float64 `yaml:"cx"`
		Cy     float64 `yaml:"cy"`
		R      float64 `yaml:"r"`
	} `yaml:"insets"`
}

// loadTrip reads and parses a YAML or JSON trip file into a Trip struct.
func loadTrip(path string) (*Trip, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var t Trip
	if err := yaml.Unmarshal(raw, &t); err != nil {
		return nil, err
	}
	return &t, nil
}

// labelledPoint pairs a coordinate with a human label for reporting.
type labelledPoint struct {
	label string
	pt    Point
}

// allPoints collects every coordinate in the trip with a descriptive label.
func (t *Trip) allPoints() []labelledPoint {
	var pts []labelledPoint
	for i, s := range t.Stays {
		pts = append(pts, labelledPoint{fmt.Sprintf("stays[%d] %s", i, s.Area), Point{s.Lat, s.Lon}})
	}
	for i, p := range t.Pois {
		pts = append(pts, labelledPoint{fmt.Sprintf("pois[%d] %s", i, p.Name), Point{p.Lat, p.Lon}})
	}
	for i, f := range t.Ferries {
		pts = append(pts, labelledPoint{fmt.Sprintf("ferries[%d].a", i), f.A})
		pts = append(pts, labelledPoint{fmt.Sprintf("ferries[%d].b", i), f.B})
	}
	for i, d := range t.Drives {
		for j, s := range d.Segs {
			for k, pt := range s.Line {
				pts = append(pts, labelledPoint{fmt.Sprintf("drives[%d].segs[%d].line[%d]", i, j, k), pt})
			}
		}
	}
	for i, n := range t.Insets {
		pts = append(pts, labelledPoint{fmt.Sprintf("insets[%d] %s", i, n.Title), n.Center})
	}
	return pts
}
