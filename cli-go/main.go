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

const version = "0.1.0-prototype"

func main() {
	schema := flag.String("schema", "schema/journey.schema.json", "path to journey JSON Schema")
	flag.Usage = usage
	flag.Parse()

	args := flag.Args()
	if len(args) == 0 {
		usage()
		os.Exit(2)
	}
	cmd, files := args[0], args[1:]

	switch cmd {
	case "version", "--version", "-v":
		fmt.Println("journey-atlas", version)
	case "validate":
		os.Exit(runValidate(*schema, files))
	case "doctor":
		os.Exit(runDoctor(files))
	case "help", "--help", "-h":
		usage()
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n\n", cmd)
		usage()
		os.Exit(2)
	}
}

func usage() {
	fmt.Fprint(os.Stderr, `journey-atlas `+version+`

usage:
  journey-atlas validate <trip...>   schema-validate each trip (YAML or JSON)
  journey-atlas doctor   <trip...>   plausibility lint (ranges, canvas, ferries…)
  journey-atlas version              print version

flags:
  --schema <path>   JSON Schema to validate against (default schema/journey.schema.json)
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
