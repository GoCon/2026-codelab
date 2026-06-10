package quizhandler

import (
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

const (
	QuizModeBoth   = "both"
	QuizModeNormal = "normal"
	QuizModeExtra  = "extra"
)

// Quiz represents a quiz question loaded from quizes.yaml.
type Quiz struct {
	ID                string   `yaml:"id"`
	Title             string   `yaml:"title"`
	TitleEn           string   `yaml:"title_en"`
	Text              string   `yaml:"text"`
	TextEn            string   `yaml:"text_en"`
	Mode              string   `yaml:"mode"`
	Choices           []string `yaml:"choices"`
	ChoicesEn         []string `yaml:"choices_en"`
	Answer            int      `yaml:"answer"`
	Explanation       string   `yaml:"explanation"`
	ExplanationEn     string   `yaml:"explanation_en"`
	QuestionCodeRef   string   `yaml:"question_code_ref"`
	AnswerCodeRef     string   `yaml:"answer_code_ref"`
	AnswerCodePlayRef string   `yaml:"answer_code_play_ref"`
}

// ParseQuizzes unmarshals YAML quiz data.
func ParseQuizzes(data []byte) ([]Quiz, error) {
	var quizzes []Quiz
	if err := yaml.Unmarshal(data, &quizzes); err != nil {
		return nil, err
	}
	for i := range quizzes {
		mode, err := NormalizeQuizMode(quizzes[i].Mode)
		if err != nil {
			label := quizzes[i].ID
			if label == "" {
				label = fmt.Sprintf("#%d", i+1)
			}
			return nil, fmt.Errorf("quiz %s: %w", label, err)
		}
		quizzes[i].Mode = mode
		if err := normalizeLocalizedFields(&quizzes[i]); err != nil {
			label := quizzes[i].ID
			if label == "" {
				label = fmt.Sprintf("#%d", i+1)
			}
			return nil, fmt.Errorf("quiz %s: %w", label, err)
		}
	}
	return quizzes, nil
}

func normalizeLocalizedFields(quiz *Quiz) error {
	quiz.TitleEn = defaultLocalizedText(quiz.TitleEn, quiz.Title)
	quiz.TextEn = defaultLocalizedText(quiz.TextEn, quiz.Text)
	quiz.ExplanationEn = defaultLocalizedText(quiz.ExplanationEn, quiz.Explanation)

	switch {
	case len(quiz.ChoicesEn) == 0:
		quiz.ChoicesEn = append([]string(nil), quiz.Choices...)
	case len(quiz.ChoicesEn) != len(quiz.Choices):
		return fmt.Errorf("choices_en count %d does not match choices count %d", len(quiz.ChoicesEn), len(quiz.Choices))
	default:
		normalizedChoicesEn := append([]string(nil), quiz.ChoicesEn...)
		for i := range normalizedChoicesEn {
			if strings.TrimSpace(normalizedChoicesEn[i]) == "" {
				normalizedChoicesEn[i] = quiz.Choices[i]
			}
		}
		quiz.ChoicesEn = normalizedChoicesEn
	}

	return nil
}

func defaultLocalizedText(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

// NormalizeQuizMode normalizes quiz pool metadata from YAML/static data.
// Empty values default to "both" so legacy quiz definitions stay available in
// both normal and extra sessions until authors opt into pool-specific behavior.
func NormalizeQuizMode(mode string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case "", QuizModeBoth:
		return QuizModeBoth, nil
	case QuizModeNormal:
		return QuizModeNormal, nil
	case QuizModeExtra:
		return QuizModeExtra, nil
	default:
		return "", fmt.Errorf("unsupported mode %q", mode)
	}
}
