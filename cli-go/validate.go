package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/santhosh-tekuri/jsonschema/v6"
	"gopkg.in/yaml.v3"
)

// Validator wraps a compiled copy of schema/journey.schema.json.
type Validator struct{ sch *jsonschema.Schema }

func newValidator(schemaPath string) (*Validator, error) {
	f, err := os.Open(schemaPath)
	if err != nil {
		return nil, fmt.Errorf("open schema %s: %w", schemaPath, err)
	}
	defer f.Close()

	doc, err := jsonschema.UnmarshalJSON(f)
	if err != nil {
		return nil, fmt.Errorf("parse schema: %w", err)
	}
	c := jsonschema.NewCompiler()
	if err := c.AddResource("journey.schema.json", doc); err != nil {
		return nil, err
	}
	sch, err := c.Compile("journey.schema.json")
	if err != nil {
		return nil, err
	}
	return &Validator{sch}, nil
}

// validateFile validates a YAML or JSON trip and returns human-readable messages
// (empty when the file is valid). JSON is valid YAML, so one path handles both.
func (v *Validator) validateFile(path string) ([]string, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var parsed any
	if err := yaml.Unmarshal(raw, &parsed); err != nil {
		return []string{"not parseable: " + err.Error()}, nil
	}
	// round-trip through JSON so numbers/types match what jsonschema expects
	jb, err := json.Marshal(parsed)
	if err != nil {
		return nil, err
	}
	inst, err := jsonschema.UnmarshalJSON(bytes.NewReader(jb))
	if err != nil {
		return nil, err
	}
	if err := v.sch.Validate(inst); err != nil {
		// jsonschema renders a readable multi-line tree; surface it line by line.
		lines := strings.Split(strings.TrimRight(err.Error(), "\n"), "\n")
		return lines, nil
	}
	return nil, nil
}
