// journey-atlas — a small native CLI for the pure, browser-free parts of the
// pipeline: validate a trip against the JSON Schema, and lint it for plausible-
// but-wrong data. A Go companion to scripts/build-trip.mjs and scripts/trip-doctor.mjs.
//
//	journey-atlas validate trips/*.yaml
//	journey-atlas doctor   trips/*.yaml
//	journey-atlas --schema schema/journey.schema.json validate my-trip.json
//
// Exit code: 0 when every file is clean (warn-only is still 0), 1 on any hard error.
package main

import (
	"flag"
	"fmt"
	"os"
)

// version is overridden at release time via -ldflags "-X main.version=…" (goreleaser).
var version = "dev"

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	cmd, rest := os.Args[1], os.Args[2:]

	switch cmd {
	case "version", "--version", "-v":
		fmt.Println("journey-atlas", version)
	case "help", "--help", "-h":
		usage()
	case "validate":
		fs := flag.NewFlagSet("validate", flag.ExitOnError)
		schema := fs.String("schema", "schema/journey.schema.json", "path to journey JSON Schema")
		fs.Parse(rest)
		os.Exit(runValidate(*schema, fs.Args()))
	case "doctor":
		fs := flag.NewFlagSet("doctor", flag.ExitOnError)
		fs.Parse(rest)
		os.Exit(runDoctor(fs.Args()))
	case "build":
		fs := flag.NewFlagSet("build", flag.ExitOnError)
		schema := fs.String("schema", "schema/journey.schema.json", "path to journey JSON Schema")
		out := fs.String("out", "src/lib/journey.json", "output path for the compiled journey.json")
		fs.Parse(rest)
		os.Exit(runBuild(*schema, *out, fs.Args()))
	case "verify-gps":
		os.Exit(runVerifyGPS(rest))
	case "correlate":
		os.Exit(runCorrelate(rest))
	case "gpx":
		os.Exit(runGPXImport(rest))
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n\n", cmd)
		usage()
		os.Exit(2)
	}
}

func usage() {
	fmt.Fprint(os.Stderr, `journey-atlas `+version+`

usage:
  journey-atlas validate <trip...>          schema-validate each trip (YAML or JSON)
  journey-atlas doctor   <trip...>          plausibility lint (ranges, canvas, ferries…)
  journey-atlas build    <trip>             validate + compile to src/lib/journey.json
  journey-atlas verify-gps <track.csv> [okKm]   check stays/POIs vs a GPS track
  journey-atlas correlate [flags] <track...>    nearest POI across GPX/KML/CSV tracks
  journey-atlas gpx <track.gpx|kml> [flags]     recorded track → drives[] fragment
  journey-atlas version                     print version

flags (before the file, per subcommand):
  validate  --schema <path>         JSON Schema (default schema/journey.schema.json)
  build     --schema <path> --out <path>   default out: src/lib/journey.json
  correlate --trip <file> --km <n> --stays --json
  gpx       --cls <motorway|a|b|minor> --tol <metres> --json
`)
}

func mustFiles(files []string) {
	if len(files) == 0 {
		fmt.Fprintln(os.Stderr, "no trip files given")
		os.Exit(2)
	}
}

func runValidate(schemaPath string, files []string) int {
	mustFiles(files)
	v, err := newValidator(schemaPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, "cannot load schema:", err)
		return 2
	}
	bad := 0
	for _, f := range files {
		msgs, err := v.validateFile(f)
		if err != nil {
			fmt.Printf("✗ %s  — %v\n", f, err)
			bad++
			continue
		}
		if len(msgs) == 0 {
			fmt.Printf("✓ %s  — valid\n", f)
			continue
		}
		fmt.Printf("✗ %s\n", f)
		for _, m := range msgs {
			fmt.Printf("    %s\n", m)
		}
		bad++
	}
	if bad > 0 {
		return 1
	}
	return 0
}

func runDoctor(files []string) int {
	mustFiles(files)
	bad := 0
	for _, f := range files {
		t, err := loadTrip(f)
		if err != nil {
			fmt.Printf("✗ %s  — unreadable: %v\n", f, err)
			bad++
			continue
		}
		r := doctorTrip(t)
		if len(r.errors) == 0 && len(r.warns) == 0 {
			fmt.Printf("✓ %s  — clean\n", f)
			continue
		}
		mark := "⚠"
		if len(r.errors) > 0 {
			mark = "✗"
		}
		fmt.Printf("%s %s\n", mark, f)
		for _, e := range r.errors {
			fmt.Printf("    ERROR  %s\n", e)
		}
		for _, w := range r.warns {
			fmt.Printf("    warn   %s\n", w)
		}
		if len(r.errors) > 0 {
			bad++
		}
	}
	if bad > 0 {
		return 1
	}
	return 0
}

func runBuild(schemaPath, outPath string, files []string) int {
	if len(files) != 1 {
		fmt.Fprintln(os.Stderr, "build takes exactly one trip file")
		return 2
	}
	v, err := newValidator(schemaPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, "cannot load schema:", err)
		return 2
	}
	src := files[0]
	msgs, err := buildJourney(v, src, outPath)
	if err != nil {
		fmt.Printf("✗ %s  — %v\n", src, err)
		return 1
	}
	if len(msgs) > 0 {
		fmt.Printf("✗ %s is not a valid trip:\n", src)
		for _, m := range msgs {
			fmt.Printf("    %s\n", m)
		}
		return 1
	}
	fmt.Printf("✓ %s → %s\n", src, outPath)
	return 0
}
