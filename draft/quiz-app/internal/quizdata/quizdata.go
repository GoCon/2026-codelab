package quizdata

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/GoCon/2026-codelab/quiz-app/internal/quizhandler"
)

// StaticQuiz is the full quiz payload embedded into the static GitHub Pages build.
type StaticQuiz struct {
	ID                string   `json:"id"`
	Title             string   `json:"title"`
	TitleEn           string   `json:"title_en,omitempty"`
	Text              string   `json:"text"`
	TextEn            string   `json:"text_en,omitempty"`
	Mode              string   `json:"mode,omitempty"`
	Choices           []string `json:"choices"`
	ChoicesEn         []string `json:"choices_en,omitempty"`
	Answer            int      `json:"answer"`
	Explanation       string   `json:"explanation"`
	ExplanationEn     string   `json:"explanation_en,omitempty"`
	QuestionCode      string   `json:"question_code,omitempty"`
	AnswerCode        string   `json:"answer_code,omitempty"`
	AnswerCodePlayRef string   `json:"answer_code_play_ref,omitempty"`
}

// LoadFromBase reads quizzes and any referenced code files from the given base directory.
func LoadFromBase(basePath string) ([]quizhandler.Quiz, map[string]string, error) {
	quizesYAML, err := os.ReadFile(filepath.Join(basePath, "quizes.yaml"))
	if err != nil {
		return nil, nil, fmt.Errorf("quizes.yaml の読み込みに失敗しました: %w", err)
	}
	quizzes, err := quizhandler.ParseQuizzes(quizesYAML)
	if err != nil {
		return nil, nil, fmt.Errorf("quizes.yaml のパースに失敗しました: %w", err)
	}
	codeFiles, err := LoadCodeFiles(quizzes, basePath)
	if err != nil {
		return nil, nil, err
	}
	return quizzes, codeFiles, nil
}

// LoadCodeFiles loads every referenced question/answer code file from the base directory.
func LoadCodeFiles(quizzes []quizhandler.Quiz, basePath string) (map[string]string, error) {
	files := make(map[string]string)
	for _, q := range quizzes {
		for _, ref := range []string{q.QuestionCodeRef, q.AnswerCodeRef} {
			if ref == "" || files[ref] != "" {
				continue
			}
			data, err := os.ReadFile(filepath.Join(basePath, ref))
			if err != nil {
				return nil, fmt.Errorf("コードファイルの読み込みに失敗しました %s: %w", ref, err)
			}
			files[ref] = StripBuildIgnore(string(data))
		}
	}
	return files, nil
}

// BuildStaticQuizzes expands quiz metadata and referenced code into a static payload.
func BuildStaticQuizzes(quizzes []quizhandler.Quiz, codeFiles map[string]string) []StaticQuiz {
	staticQuizzes := make([]StaticQuiz, 0, len(quizzes))
	for _, q := range quizzes {
		mode := q.Mode
		if mode == quizhandler.QuizModeBoth {
			mode = ""
		}
		staticQuiz := StaticQuiz{
			ID:                q.ID,
			Title:             q.Title,
			TitleEn:           q.TitleEn,
			Text:              q.Text,
			TextEn:            q.TextEn,
			Mode:              mode,
			Choices:           append([]string(nil), q.Choices...),
			ChoicesEn:         append([]string(nil), q.ChoicesEn...),
			Answer:            q.Answer,
			Explanation:       q.Explanation,
			ExplanationEn:     q.ExplanationEn,
			AnswerCodePlayRef: q.AnswerCodePlayRef,
		}
		if q.QuestionCodeRef != "" {
			staticQuiz.QuestionCode = codeFiles[q.QuestionCodeRef]
		}
		if q.AnswerCodeRef != "" {
			staticQuiz.AnswerCode = codeFiles[q.AnswerCodeRef]
		}
		staticQuizzes = append(staticQuizzes, staticQuiz)
	}
	return staticQuizzes
}

// MarshalJavaScript serializes quiz data as a browser-ready JavaScript asset.
func MarshalJavaScript(quizzes []StaticQuiz) ([]byte, error) {
	data, err := json.Marshal(quizzes)
	if err != nil {
		return nil, fmt.Errorf("クイズデータのシリアライズに失敗しました: %w", err)
	}
	return []byte("window.__QUIZ_DATA__ = " + string(data) + ";\n"), nil
}

// StripBuildIgnore removes the leading //go:build ignore directive from code snippets.
func StripBuildIgnore(s string) string {
	const directive = "//go:build ignore"
	if !strings.HasPrefix(s, directive) {
		return s
	}
	return strings.TrimLeft(strings.TrimPrefix(s, directive), "\r\n")
}
