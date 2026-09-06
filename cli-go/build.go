package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"

	"gopkg.in/yaml.v3"
)

// schemaPointer is written as the first key of journey.json so editors wire up
// autocomplete — matches scripts/build-trip.mjs.
const schemaPointer = "../../schema/journey.schema.json"

// buildJourney validates a trip and, if valid, writes it to outPath as
// journey.json: pretty-printed, source key order preserved, with $schema first.
// Returns validation messages (empty when written) — mirrors build-trip.mjs.
func buildJourney(v *Validator, src, outPath string) ([]string, error) {
	msgs, err := v.validateFile(src)
	if err != nil {
		return nil, err
	}
	if len(msgs) > 0 {
		return msgs, nil // don't write an invalid trip
	}

	raw, err := os.ReadFile(src)
	if err != nil {
		return nil, err
	}
	var doc yaml.Node
	if err := yaml.Unmarshal(raw, &doc); err != nil {
		return nil, err
	}
	top := &doc
	if doc.Kind == yaml.DocumentNode && len(doc.Content) > 0 {
		top = doc.Content[0]
	}

	var b strings.Builder
	if err := encodeTop(&b, top); err != nil {
		return nil, err
	}
	b.WriteByte('\n')
	if err := os.WriteFile(outPath, []byte(b.String()), 0o644); err != nil {
		return nil, err
	}
	return nil, nil
}

// encodeTop writes the top-level mapping with $schema first, dropping any
// incoming $schema so we control it (as build-trip.mjs does).
func encodeTop(b *strings.Builder, top *yaml.Node) error {
	if top.Kind != yaml.MappingNode {
		return encodeNode(b, top, 0)
	}
	b.WriteString("{\n")
	writeKey(b, "$schema", 1)
	b.WriteString(quote(schemaPointer))

	for i := 0; i+1 < len(top.Content); i += 2 {
		key := top.Content[i].Value
		if key == "$schema" {
			continue
		}
		b.WriteString(",\n")
		writeKey(b, key, 1)
		if err := encodeNode(b, top.Content[i+1], 1); err != nil {
			return err
		}
	}
	b.WriteString("\n}")
	return nil
}

// encodeNode writes any YAML node as JSON, preserving mapping order, at the
// given indent depth (2 spaces per level).
func encodeNode(b *strings.Builder, n *yaml.Node, depth int) error {
	switch n.Kind {
	case yaml.MappingNode:
		if len(n.Content) == 0 {
			b.WriteString("{}")
			return nil
		}
		b.WriteString("{\n")
		for i := 0; i+1 < len(n.Content); i += 2 {
			if i > 0 {
				b.WriteString(",\n")
			}
			writeKey(b, n.Content[i].Value, depth+1)
			if err := encodeNode(b, n.Content[i+1], depth+1); err != nil {
				return err
			}
		}
		b.WriteByte('\n')
		indent(b, depth)
		b.WriteByte('}')
	case yaml.SequenceNode:
		if len(n.Content) == 0 {
			b.WriteString("[]")
			return nil
		}
		b.WriteString("[\n")
		for i, c := range n.Content {
			if i > 0 {
				b.WriteString(",\n")
			}
			indent(b, depth+1)
			if err := encodeNode(b, c, depth+1); err != nil {
				return err
			}
		}
		b.WriteByte('\n')
		indent(b, depth)
		b.WriteByte(']')
	case yaml.ScalarNode:
		b.WriteString(scalarJSON(n))
	case yaml.AliasNode:
		return encodeNode(b, n.Alias, depth)
	default:
		return fmt.Errorf("unsupported YAML node kind %v", n.Kind)
	}
	return nil
}

// scalarJSON renders a YAML scalar as its JSON literal, honouring the resolved tag.
func scalarJSON(n *yaml.Node) string {
	switch n.Tag {
	case "!!bool":
		if b, err := strconv.ParseBool(n.Value); err == nil {
			return strconv.FormatBool(b)
		}
	case "!!null":
		return "null"
	case "!!int":
		if _, err := strconv.ParseInt(n.Value, 10, 64); err == nil {
			return n.Value
		}
	case "!!float":
		if f, err := strconv.ParseFloat(n.Value, 64); err == nil {
			return strconv.FormatFloat(f, 'g', -1, 64)
		}
	}
	return quote(n.Value)
}

func writeKey(b *strings.Builder, key string, depth int) {
	indent(b, depth)
	b.WriteString(quote(key))
	b.WriteString(": ")
}

func indent(b *strings.Builder, depth int) {
	for i := 0; i < depth; i++ {
		b.WriteString("  ")
	}
}

// quote JSON-encodes a string without Go's default HTML escaping, so &, < and >
// stay literal — matching JavaScript's JSON.stringify (and scripts/build-trip.mjs).
func quote(s string) string {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(s)
	return strings.TrimRight(buf.String(), "\n")
}
