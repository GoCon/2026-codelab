package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadQuizStripsBuildIgnoreFromDisplayedCode(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	if err := os.Mkdir(filepath.Join(dir, "code"), 0o755); err != nil {
		t.Fatalf("Mkdir: %v", err)
	}

	quizPath := filepath.Join(dir, "quiz.yaml")
	if err := os.WriteFile(quizPath, []byte(`title: "Quiz"
author: test
questions:
  - text: "Q1"
    question_code_ref: "code/q1_question.go"
    choices: ["a", "b", "c", "d"]
    answer: 0
    explanation: "ok"
    answer_code_ref: "code/q1_answer.go"
`), 0o644); err != nil {
		t.Fatalf("WriteFile quiz: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "code", "q1_question.go"), []byte("//go:build ignore\n\npackage main\n"), 0o644); err != nil {
		t.Fatalf("WriteFile question: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "code", "q1_answer.go"), []byte("//go:build ignore\n\npackage main\n"), 0o644); err != nil {
		t.Fatalf("WriteFile answer: %v", err)
	}

	quiz, err := loadQuiz(quizPath)
	if err != nil {
		t.Fatalf("loadQuiz: %v", err)
	}

	if strings.Contains(quiz.Questions[0].QuestionCode, "//go:build ignore") {
		t.Fatalf("QuestionCode still contains build ignore: %q", quiz.Questions[0].QuestionCode)
	}
	if strings.Contains(quiz.Questions[0].AnswerCode, "//go:build ignore") {
		t.Fatalf("AnswerCode still contains build ignore: %q", quiz.Questions[0].AnswerCode)
	}
}

func TestRenderExplanationHTMLLinkifiesURLsAndEscapesText(t *testing.T) {
	t.Parallel()

	got := string(renderExplanationHTML("See https://example.com?a=1&b=2\n<script>alert(1)</script>"))

	if !strings.Contains(got, `<a href="https://example.com?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">https://example.com?a=1&amp;b=2</a>`) {
		t.Fatalf("rendered explanation did not contain clickable link: %s", got)
	}
	if strings.Contains(got, "<script>") {
		t.Fatalf("rendered explanation should escape raw HTML: %s", got)
	}
	if !strings.Contains(got, "&lt;script&gt;alert(1)&lt;/script&gt;") {
		t.Fatalf("rendered explanation should preserve escaped text: %s", got)
	}
}
