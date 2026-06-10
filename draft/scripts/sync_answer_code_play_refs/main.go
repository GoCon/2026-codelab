package main

import (
	"bytes"
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/GoCon/2026-codelab/internal/playground"
	"github.com/GoCon/2026-codelab/internal/quizcode"
	"gopkg.in/yaml.v3"
)

type publisher interface {
	FormatAndShare(ctx context.Context, code string) (string, string, error)
}

type syncResult struct {
	Published int
	Updated   int
}

func main() {
	log.SetFlags(0)
	flag.Usage = func() {
		fmt.Fprintf(flag.CommandLine.Output(), "Usage: go run ./scripts/sync_answer_code_play_refs [quiz directory or quiz.yaml ...]\n")
	}
	flag.Parse()

	quizPaths, err := resolveQuizPaths(flag.Args())
	if err != nil {
		log.Fatal(err)
	}

	client := playground.NewClient()
	ctx := context.Background()

	totalPublished := 0
	totalUpdated := 0
	for _, quizPath := range quizPaths {
		result, err := syncQuiz(ctx, quizPath, client)
		if err != nil {
			log.Fatalf("%s: %v", quizPath, err)
		}
		totalPublished += result.Published
		totalUpdated += result.Updated
		fmt.Printf("%s: published %d answer snippet(s), updated %d field(s)\n", quizPath, result.Published, result.Updated)
	}

	fmt.Printf("done: published %d answer snippet(s), updated %d field(s) across %d quiz file(s)\n", totalPublished, totalUpdated, len(quizPaths))
}

func resolveQuizPaths(args []string) ([]string, error) {
	if len(args) == 0 {
		matches, err := filepath.Glob(filepath.Join("quizzes", "*", "quiz.yaml"))
		if err != nil {
			return nil, fmt.Errorf("glob quiz files: %w", err)
		}

		paths := make([]string, 0, len(matches))
		for _, match := range matches {
			if strings.HasPrefix(filepath.Base(filepath.Dir(match)), "_") {
				continue
			}
			paths = append(paths, match)
		}
		sort.Strings(paths)
		if len(paths) == 0 {
			return nil, fmt.Errorf("no quiz.yaml files found under quizzes/*")
		}
		return paths, nil
	}

	paths := make([]string, 0, len(args))
	for _, arg := range args {
		path := filepath.Clean(arg)
		info, err := os.Stat(path)
		if err != nil {
			return nil, fmt.Errorf("stat %s: %w", path, err)
		}
		if info.IsDir() {
			path = filepath.Join(path, "quiz.yaml")
		}
		paths = append(paths, path)
	}

	sort.Strings(paths)
	return paths, nil
}

func syncQuiz(ctx context.Context, quizPath string, publish publisher) (syncResult, error) {
	data, err := os.ReadFile(quizPath)
	if err != nil {
		return syncResult{}, fmt.Errorf("read quiz file: %w", err)
	}

	var root yaml.Node
	if err := yaml.Unmarshal(data, &root); err != nil {
		return syncResult{}, fmt.Errorf("parse quiz yaml: %w", err)
	}
	if len(root.Content) == 0 {
		return syncResult{}, fmt.Errorf("quiz yaml is empty")
	}

	questionsNode := lookupMapValue(root.Content[0], "questions")
	if questionsNode == nil || questionsNode.Kind != yaml.SequenceNode {
		return syncResult{}, fmt.Errorf("questions must be a sequence")
	}

	quizDir := filepath.Dir(quizPath)
	result := syncResult{}
	dirty := false

	for i, questionNode := range questionsNode.Content {
		if questionNode.Kind != yaml.MappingNode {
			return syncResult{}, fmt.Errorf("question %d must be a mapping", i+1)
		}

		answerCodeRefNode := lookupMapValue(questionNode, "answer_code_ref")
		if answerCodeRefNode == nil || strings.TrimSpace(answerCodeRefNode.Value) == "" {
			if removeMapEntry(questionNode, "answer_code_play_ref") {
				dirty = true
				result.Updated++
			}
			continue
		}

		answerCodePath := filepath.Join(quizDir, answerCodeRefNode.Value)
		answerCode, err := os.ReadFile(answerCodePath)
		if err != nil {
			return syncResult{}, fmt.Errorf("Q%d read %s: %w", i+1, answerCodePath, err)
		}

		normalizedCode := quizcode.StripLeadingBuildIgnore(string(answerCode))
		_, playURL, err := publish.FormatAndShare(ctx, normalizedCode)
		if err != nil {
			return syncResult{}, fmt.Errorf("Q%d publish %s: %w", i+1, answerCodeRefNode.Value, err)
		}
		result.Published++

		if upsertMapStringAfter(questionNode, "answer_code_play_ref", playURL, "answer_code_ref", answerCodeRefNode.Style) {
			dirty = true
			result.Updated++
		}
	}

	if !dirty {
		return result, nil
	}

	var buf bytes.Buffer
	enc := yaml.NewEncoder(&buf)
	enc.SetIndent(2)
	if err := enc.Encode(&root); err != nil {
		return syncResult{}, fmt.Errorf("encode quiz yaml: %w", err)
	}
	if err := enc.Close(); err != nil {
		return syncResult{}, fmt.Errorf("close yaml encoder: %w", err)
	}

	if err := os.WriteFile(quizPath, buf.Bytes(), 0o644); err != nil {
		return syncResult{}, fmt.Errorf("write quiz yaml: %w", err)
	}

	return result, nil
}

func lookupMapValue(mapNode *yaml.Node, key string) *yaml.Node {
	for i := 0; i+1 < len(mapNode.Content); i += 2 {
		if mapNode.Content[i].Value == key {
			return mapNode.Content[i+1]
		}
	}
	return nil
}

func mapKeyIndex(mapNode *yaml.Node, key string) int {
	for i := 0; i+1 < len(mapNode.Content); i += 2 {
		if mapNode.Content[i].Value == key {
			return i
		}
	}
	return -1
}

func removeMapEntry(mapNode *yaml.Node, key string) bool {
	index := mapKeyIndex(mapNode, key)
	if index < 0 {
		return false
	}

	mapNode.Content = append(mapNode.Content[:index], mapNode.Content[index+2:]...)
	return true
}

func upsertMapStringAfter(mapNode *yaml.Node, key, value, afterKey string, style yaml.Style) bool {
	if existing := lookupMapValue(mapNode, key); existing != nil {
		if existing.Value == value {
			return false
		}
		existing.Kind = yaml.ScalarNode
		existing.Tag = "!!str"
		existing.Value = value
		existing.Style = style
		return true
	}

	insertAt := len(mapNode.Content)
	if index := mapKeyIndex(mapNode, afterKey); index >= 0 {
		insertAt = index + 2
	}

	keyNode := &yaml.Node{
		Kind:  yaml.ScalarNode,
		Tag:   "!!str",
		Value: key,
	}
	valueNode := &yaml.Node{
		Kind:  yaml.ScalarNode,
		Tag:   "!!str",
		Value: value,
		Style: style,
	}

	mapNode.Content = append(mapNode.Content, nil, nil)
	copy(mapNode.Content[insertAt+2:], mapNode.Content[insertAt:])
	mapNode.Content[insertAt] = keyNode
	mapNode.Content[insertAt+1] = valueNode
	return true
}
