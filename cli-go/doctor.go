package main

import (
	"fmt"
	"math"
)

const (
	canvasW = 1600.0
	canvasH = 1200.0
)

// report holds the hard errors and soft warnings found for one trip.
type report struct {
	errors []string
	warns  []string
}

func (r *report) errf(f string, a ...any)  { r.errors = append(r.errors, fmt.Sprintf(f, a...)) }
func (r *report) warnf(f string, a ...any) { r.warns = append(r.warns, fmt.Sprintf(f, a...)) }

// doctorTrip runs the plausibility checks — mirrors scripts/trip-doctor.mjs.
func doctorTrip(t *Trip) report {
	var r report
	pts := t.allPoints()

	// 1) coordinate ranges
	for _, lp := range pts {
		if lp.pt.Lat() < -90 || lp.pt.Lat() > 90 {
			r.errf("%s: latitude %g out of [-90,90]", lp.label, lp.pt.Lat())
		}
		if lp.pt.Lon() < -180 || lp.pt.Lon() > 180 {
			r.errf("%s: longitude %g out of [-180,180]", lp.label, lp.pt.Lon())
		}
	}

	// 2) points far from the trip's own centre — likely swapped lat/lon or a typo
	if len(pts) >= 3 {
		lats := make([]float64, len(pts))
		lons := make([]float64, len(pts))
		for i, lp := range pts {
			lats[i], lons[i] = lp.pt.Lat(), lp.pt.Lon()
		}
		centre := Point{median(lats), median(lons)}
		for _, lp := range pts {
			if d := haversineKm(centre, lp.pt); d > 3000 {
				r.warnf("%s: %.0f km from the trip centre — swapped lat/lon or a typo?", lp.label, d)
			}
		}
	}

	// 3) totalMiles vs summed roadStats
	var summed float64
	for _, rs := range t.RoadStats {
		summed += rs.Mi
	}
	if summed > 0 && t.TotalMiles > 0 {
		off := math.Abs(summed-t.TotalMiles) / t.TotalMiles
		if off > 0.15 {
			r.warnf("totalMiles %g vs summed roadStats %g (%.0f%% apart)", t.TotalMiles, summed, off*100)
		}
	}

	// 4) drive road-classes must appear in the legend, and vice versa
	driveCls := map[string]bool{}
	for _, d := range t.Drives {
		for _, s := range d.Segs {
			driveCls[s.Cls] = true
		}
	}
	legendCls := map[string]bool{}
	for _, rs := range t.RoadStats {
		legendCls[rs.Cls] = true
	}
	for c := range driveCls {
		if !legendCls[c] {
			r.warnf("road class %q is driven but missing from roadStats legend", c)
		}
	}
	for c := range legendCls {
		if !driveCls[c] {
			r.warnf("road class %q is in the legend but never driven", c)
		}
	}

	// 5) ferries: endpoints must differ and be a believable crossing
	for i, f := range t.Ferries {
		d := haversineKm(f.A, f.B)
		if d == 0 {
			r.errf("ferries[%d] %s: start and end are identical", i, f.Short)
		} else if d > 500 {
			r.warnf("ferries[%d] %s: %.0f km crossing — unusually long, check a/b", i, f.Short, d)
		}
	}

	// 6) insets: the pixel circle must sit on the 1600x1200 canvas
	for i, n := range t.Insets {
		tag := fmt.Sprintf("insets[%d] %s", i, n.Title)
		if n.Cx-n.R < 0 || n.Cx+n.R > canvasW || n.Cy-n.R < 0 || n.Cy+n.R > canvasH {
			r.warnf("%s: circle (cx %g, cy %g, r %g) spills off the %.0fx%.0f canvas", tag, n.Cx, n.Cy, n.R, canvasW, canvasH)
		}
		if n.Zoom != 0 && (n.Zoom < 1 || n.Zoom > 20) {
			r.warnf("%s: zoom %g looks off (expect ~5-16)", tag, n.Zoom)
		}
	}

	return r
}
