package main

import (
	"math"
	"sort"
)

// haversineKm returns the great-circle distance between two points in kilometres.
func haversineKm(a, b Point) float64 {
	const R = 6371.0
	dLat := (b[0] - a[0]) * math.Pi / 180
	dLon := (b[1] - a[1]) * math.Pi / 180
	la1 := a[0] * math.Pi / 180
	la2 := b[0] * math.Pi / 180
	h := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(la1)*math.Cos(la2)*math.Sin(dLon/2)*math.Sin(dLon/2)
	return 2 * R * math.Asin(math.Sqrt(h))
}

// median returns the middle value of a slice (does not mutate the input).
func median(nums []float64) float64 {
	if len(nums) == 0 {
		return 0
	}
	s := append([]float64(nil), nums...)
	sort.Float64s(s)
	m := len(s) / 2
	if len(s)%2 == 1 {
		return s[m]
	}
	return (s[m-1] + s[m]) / 2
}
