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
	Text              string   `yaml:"text"`
	Mode              string   `yaml:"mode"`
	Choices           []string `yaml:"choices"`
	Answer            int      `yaml:"answer"`
	Explanation       string   `yaml:"explanation"`
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
	}
	return quizzes, nil
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
