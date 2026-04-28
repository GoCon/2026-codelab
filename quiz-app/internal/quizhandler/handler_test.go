package quizhandler_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/GoCon/2026-codelab/quiz-app/internal/quizhandler"
)

func TestNormalizeQuizMode(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{name: "empty defaults to both", input: "", want: quizhandler.QuizModeBoth},
		{name: "both is preserved", input: "both", want: quizhandler.QuizModeBoth},
		{name: "normal is preserved", input: "normal", want: quizhandler.QuizModeNormal},
		{name: "extra is preserved", input: "extra", want: quizhandler.QuizModeExtra},
		{name: "whitespace is trimmed", input: "  EXTRA  ", want: quizhandler.QuizModeExtra},
		{name: "unknown value errors", input: "surprise", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := quizhandler.NormalizeQuizMode(tt.input)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("NormalizeQuizMode: %v", err)
			}
			if got != tt.want {
				t.Fatalf("got %q, want %q", got, tt.want)
			}
		})
	}
}

func TestParseQuizzes_DefaultModeIsBoth(t *testing.T) {
	t.Parallel()

	quizzes, err := quizhandler.ParseQuizzes([]byte(`
- id: "q1"
  title: "Q1"
  text: "text"
  choices: ["A", "B"]
  answer: 0
  explanation: "exp"
`))
	if err != nil {
		t.Fatalf("ParseQuizzes: %v", err)
	}
	if len(quizzes) != 1 {
		t.Fatalf("len = %d, want 1", len(quizzes))
	}
	if quizzes[0].Mode != quizhandler.QuizModeBoth {
		t.Fatalf("mode = %q, want %q", quizzes[0].Mode, quizhandler.QuizModeBoth)
	}
	if quizzes[0].TitleEn != quizzes[0].Title {
		t.Fatalf("title_en = %q, want fallback %q", quizzes[0].TitleEn, quizzes[0].Title)
	}
	if quizzes[0].TextEn != quizzes[0].Text {
		t.Fatalf("text_en = %q, want fallback %q", quizzes[0].TextEn, quizzes[0].Text)
	}
	if quizzes[0].ExplanationEn != quizzes[0].Explanation {
		t.Fatalf("explanation_en = %q, want fallback %q", quizzes[0].ExplanationEn, quizzes[0].Explanation)
	}
	if strings.Join(quizzes[0].ChoicesEn, ",") != strings.Join(quizzes[0].Choices, ",") {
		t.Fatalf("choices_en = %#v, want fallback %#v", quizzes[0].ChoicesEn, quizzes[0].Choices)
	}
}

func TestParseQuizzes_InvalidModeReturnsError(t *testing.T) {
	t.Parallel()

	_, err := quizhandler.ParseQuizzes([]byte(`
- id: "q1"
  title: "Q1"
  text: "text"
  mode: "surprise"
  choices: ["A", "B"]
  answer: 0
  explanation: "exp"
`))
	if err == nil {
		t.Fatal("expected invalid mode error")
	}
}

func TestParseQuizzes_ChoiceLocalizationLengthMustMatch(t *testing.T) {
	t.Parallel()

	_, err := quizhandler.ParseQuizzes([]byte(`
- id: "q1"
  title: "Q1"
  text: "text"
  choices: ["A", "B"]
  choices_en: ["A only"]
  answer: 0
  explanation: "exp"
`))
	if err == nil {
		t.Fatal("expected choices_en length error")
	}
}

func TestParseQuizzes_EnglishFallbacksAndPartialChoices(t *testing.T) {
	t.Parallel()

	quizzes, err := quizhandler.ParseQuizzes([]byte(`
- id: "q1"
  title: "Q1"
  title_en: "Question 1"
  text: "text"
  choices: ["A", "B"]
  choices_en: ["A en", ""]
  answer: 0
  explanation: "exp"
`))
	if err != nil {
		t.Fatalf("ParseQuizzes: %v", err)
	}
	if len(quizzes) != 1 {
		t.Fatalf("len = %d, want 1", len(quizzes))
	}
	if quizzes[0].TitleEn != "Question 1" {
		t.Fatalf("title_en = %q, want Question 1", quizzes[0].TitleEn)
	}
	if quizzes[0].TextEn != "text" {
		t.Fatalf("text_en = %q, want fallback text", quizzes[0].TextEn)
	}
	if quizzes[0].ExplanationEn != "exp" {
		t.Fatalf("explanation_en = %q, want fallback exp", quizzes[0].ExplanationEn)
	}
	if strings.Join(quizzes[0].ChoicesEn, ",") != "A en,B" {
		t.Fatalf("choices_en = %#v, want fallback on empty values", quizzes[0].ChoicesEn)
	}
}

func loadRealQuizzes(t *testing.T) []quizhandler.Quiz {
	t.Helper()

	data, err := os.ReadFile("../../quizzes/quizes.yaml")
	if err != nil {
		t.Fatalf("quizes.yaml を読み込めません: %v", err)
	}
	quizzes, err := quizhandler.ParseQuizzes(data)
	if err != nil {
		t.Fatalf("quizes.yaml のパースに失敗しました: %v", err)
	}
	return quizzes
}

func TestQuizesYAML_UniqueIDs(t *testing.T) {
	quizzes := loadRealQuizzes(t)
	seen := make(map[string]int)
	for _, q := range quizzes {
		seen[q.ID]++
	}
	for id, count := range seen {
		if count > 1 {
			t.Errorf("ID %q が %d 回重複しています", id, count)
		}
	}
}

func TestQuizesYAML_NoEmptyIDs(t *testing.T) {
	for _, q := range loadRealQuizzes(t) {
		if q.ID == "" {
			t.Errorf("空の ID を持つクイズがあります: %+v", q)
		}
	}
}

func TestQuizesYAML_IDsMatchEnglishTitles(t *testing.T) {
	for _, q := range loadRealQuizzes(t) {
		if q.ID != q.TitleEn {
			t.Errorf("quiz title_en=%q: id=%q, want %q", q.TitleEn, q.ID, q.TitleEn)
		}
	}
}

func TestQuizesYAML_AnswerIndexInRange(t *testing.T) {
	for _, q := range loadRealQuizzes(t) {
		if q.Answer < 0 || q.Answer >= len(q.Choices) {
			t.Errorf("quiz %q: answer=%d は choices の範囲外 (len=%d)", q.ID, q.Answer, len(q.Choices))
		}
	}
}

func TestQuizesYAML_SufficientChoices(t *testing.T) {
	for _, q := range loadRealQuizzes(t) {
		if len(q.Choices) < 2 {
			t.Errorf("quiz %q: choices が %d 個しかありません（最低 2 個必要）", q.ID, len(q.Choices))
		}
	}
}

func TestQuizesYAML_EnglishChoicesMatchJapaneseCount(t *testing.T) {
	for _, q := range loadRealQuizzes(t) {
		if len(q.ChoicesEn) != len(q.Choices) {
			t.Errorf("quiz %q: choices_en が %d 個で choices の %d 個と一致しません", q.ID, len(q.ChoicesEn), len(q.Choices))
		}
	}
}

func TestQuizesYAML_NoEmptyExplanations(t *testing.T) {
	for _, q := range loadRealQuizzes(t) {
		if strings.TrimSpace(q.Explanation) == "" {
			t.Errorf("quiz %q: explanation が空です", q.ID)
		}
	}
}

func TestQuizesYAML_CodeRefsExist(t *testing.T) {
	for _, q := range loadRealQuizzes(t) {
		for _, ref := range []struct {
			name string
			path string
		}{
			{name: "question_code_ref", path: q.QuestionCodeRef},
			{name: "answer_code_ref", path: q.AnswerCodeRef},
		} {
			if ref.path == "" {
				continue
			}
			if _, err := os.Stat(filepath.Join("../../quizzes", ref.path)); err != nil {
				t.Errorf("quiz %q: %s=%q の参照先が存在しません: %v", q.ID, ref.name, ref.path, err)
			}
		}
	}
}
