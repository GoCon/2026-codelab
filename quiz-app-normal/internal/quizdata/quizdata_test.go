package quizdata_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/GoCon/2026-codelab/quiz-app-normal/internal/quizdata"
	"github.com/GoCon/2026-codelab/quiz-app-normal/internal/quizhandler"
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
		TitleEn:           "title en",
		Text:              "text",
		TextEn:            "text en",
		Mode:              quizhandler.QuizModeExtra,
		Choices:           []string{"a", "b"},
		ChoicesEn:         []string{"a en", "b en"},
		Answer:            1,
		Explanation:       "exp",
		ExplanationEn:     "exp en",
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
	if got[0].TitleEn != "title en" || got[0].TextEn != "text en" || got[0].ExplanationEn != "exp en" {
		t.Fatalf("english localized fields should be preserved: %+v", got[0])
	}
	if strings.Join(got[0].ChoicesEn, ",") != "a en,b en" {
		t.Fatalf("english choices mismatch: %#v", got[0].ChoicesEn)
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
  title_en: "Question 1"
  text: "text"
  text_en: "text en"
  question_code_ref: "code/q1_question.go"
  choices: ["A", "B"]
  choices_en: ["A en", "B en"]
  answer: 1
  explanation: "exp"
  explanation_en: "exp en"
  answer_code_ref: "code/q1_answer.go"
- id: "q2"
  title: "Q2"
  text: "text"
  mode: "extra"
  question_code_ref: "code/missing_question.go"
  choices: ["A", "B"]
  answer: 0
  explanation: "exp"
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
		t.Fatalf("quizzes len = %d, want 1 after filtering extra mode", len(quizzes))
	}
	if quizzes[0].Mode != quizhandler.QuizModeBoth {
		t.Fatalf("mode = %q, want %q", quizzes[0].Mode, quizhandler.QuizModeBoth)
	}
	if quizzes[0].TitleEn != "Question 1" || quizzes[0].TextEn != "text en" || quizzes[0].ExplanationEn != "exp en" {
		t.Fatalf("localized english fields should be loaded: %+v", quizzes[0])
	}
	if strings.Join(quizzes[0].ChoicesEn, ",") != "A en,B en" {
		t.Fatalf("english choices mismatch: %#v", quizzes[0].ChoicesEn)
	}
	if got := codeFiles["code/q1_question.go"]; strings.HasPrefix(got, "//go:build ignore") {
		t.Fatalf("question code should strip build tag")
	}
	if _, ok := codeFiles["code/missing_question.go"]; ok {
		t.Fatalf("extra-mode code refs should not be loaded: %#v", codeFiles)
	}
}
