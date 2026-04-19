package quizdata_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/GoCon/2026-codelab/quiz-app/internal/quizdata"
	"github.com/GoCon/2026-codelab/quiz-app/internal/quizhandler"
)

func TestStripBuildIgnore(t *testing.T) {
	got := quizdata.StripBuildIgnore("//go:build ignore\n\npackage main\n")
	if got != "package main\n" {
		t.Fatalf("got %q", got)
	}
}

func TestBuildStaticQuizzes(t *testing.T) {
	quizzes := []quizhandler.Quiz{{
		ID:                "q1",
		Title:             "title",
		Text:              "text",
		Mode:              quizhandler.QuizModeExtra,
		Choices:           []string{"a", "b"},
		Answer:            1,
		Explanation:       "exp",
		QuestionCodeRef:   "code/q1_question.go",
		AnswerCodeRef:     "code/q1_answer.go",
		AnswerCodePlayRef: "https://go.dev/play/p/example",
	}}
	codeFiles := map[string]string{
		"code/q1_question.go": "package main\n// question",
		"code/q1_answer.go":   "package main\n// answer",
	}

	got := quizdata.BuildStaticQuizzes(quizzes, codeFiles)
	if len(got) != 1 {
		t.Fatalf("len = %d, want 1", len(got))
	}
	if got[0].QuestionCode != codeFiles["code/q1_question.go"] {
		t.Fatalf("question code mismatch")
	}
	if got[0].AnswerCode != codeFiles["code/q1_answer.go"] {
		t.Fatalf("answer code mismatch")
	}
	if got[0].Mode != quizhandler.QuizModeExtra {
		t.Fatalf("mode = %q, want %q", got[0].Mode, quizhandler.QuizModeExtra)
	}
	if got[0].AnswerCodePlayRef == "" {
		t.Fatalf("answer code play ref should be preserved")
	}
}

func TestLoadFromBase(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "quizes.yaml"), []byte(`
- id: "q1"
  title: "Q1"
  text: "text"
  question_code_ref: "code/q1_question.go"
  choices: ["A", "B"]
  answer: 1
  explanation: "exp"
  answer_code_ref: "code/q1_answer.go"
`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(dir, "code"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "code", "q1_question.go"), []byte("//go:build ignore\n\npackage main\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "code", "q1_answer.go"), []byte("package main\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	quizzes, codeFiles, err := quizdata.LoadFromBase(dir)
	if err != nil {
		t.Fatalf("LoadFromBase: %v", err)
	}
	if len(quizzes) != 1 {
		t.Fatalf("quizzes len = %d, want 1", len(quizzes))
	}
	if quizzes[0].Mode != quizhandler.QuizModeBoth {
		t.Fatalf("mode = %q, want %q", quizzes[0].Mode, quizhandler.QuizModeBoth)
	}
	if got := codeFiles["code/q1_question.go"]; strings.HasPrefix(got, "//go:build ignore") {
		t.Fatalf("question code should strip build tag")
	}
}
