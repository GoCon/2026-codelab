package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type fakePublisher struct {
	calls []string
}

func (f *fakePublisher) FormatAndShare(_ context.Context, code string) (string, string, error) {
	f.calls = append(f.calls, code)
	return code, "https://go.dev/play/p/fake-snippet", nil
}

func TestSyncQuizAddsPlayRef(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	if err := os.Mkdir(filepath.Join(dir, "code"), 0o755); err != nil {
		t.Fatalf("Mkdir: %v", err)
	}

	quizPath := filepath.Join(dir, "quiz.yaml")
	if err := os.WriteFile(quizPath, []byte(`title: "Quiz"
questions:
  - text: "Q1"
    # keep this comment
    answer_code_ref: "code/q1_answer.go"
`), 0o644); err != nil {
		t.Fatalf("WriteFile quiz: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "code", "q1_answer.go"), []byte("//go:build ignore\n\npackage main\n"), 0o644); err != nil {
		t.Fatalf("WriteFile answer: %v", err)
	}

	publisher := &fakePublisher{}
	result, err := syncQuiz(context.Background(), quizPath, publisher)
	if err != nil {
		t.Fatalf("syncQuiz: %v", err)
	}
	if result.Published != 1 || result.Updated != 1 {
		t.Fatalf("result = %+v, want Published=1 Updated=1", result)
	}
	if len(publisher.calls) != 1 || publisher.calls[0] != "package main\n" {
		t.Fatalf("publisher calls = %#v", publisher.calls)
	}

	got, err := os.ReadFile(quizPath)
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	text := string(got)
	if !strings.Contains(text, "# keep this comment") {
		t.Fatalf("expected comment to survive rewrite:\n%s", text)
	}
	if !strings.Contains(text, "answer_code_play_ref: \"https://go.dev/play/p/fake-snippet\"") {
		t.Fatalf("expected answer_code_play_ref in rewritten yaml:\n%s", text)
	}
}

func TestSyncQuizRemovesStalePlayRef(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	quizPath := filepath.Join(dir, "quiz.yaml")
	if err := os.WriteFile(quizPath, []byte(`title: "Quiz"
questions:
  - text: "Q1"
    answer_code_play_ref: "https://go.dev/play/p/stale"
`), 0o644); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}

	result, err := syncQuiz(context.Background(), quizPath, &fakePublisher{})
	if err != nil {
		t.Fatalf("syncQuiz: %v", err)
	}
	if result.Published != 0 || result.Updated != 1 {
		t.Fatalf("result = %+v, want Published=0 Updated=1", result)
	}

	got, err := os.ReadFile(quizPath)
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	if strings.Contains(string(got), "answer_code_play_ref") {
		t.Fatalf("stale answer_code_play_ref should be removed:\n%s", string(got))
	}
}
