package quizhandler

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"strings"

	"gopkg.in/yaml.v3"
)

const (
	QuizModeBoth   = "both"
	QuizModeNormal = "normal"
	QuizModeExtra  = "extra"
)

// Quiz represents a quiz question loaded from quizes.yaml.
// Answer and Explanation are excluded from JSON responses via json:"-".
type Quiz struct {
	ID                string   `yaml:"id"                   json:"id"`
	Title             string   `yaml:"title"                json:"title"`
	Text              string   `yaml:"text"                 json:"text"`
	Mode              string   `yaml:"mode"                 json:"mode,omitempty"`
	Choices           []string `yaml:"choices"              json:"choices"`
	Answer            int      `yaml:"answer"               json:"-"`
	Explanation       string   `yaml:"explanation"          json:"-"`
	QuestionCodeRef   string   `yaml:"question_code_ref"    json:"-"`
	AnswerCodeRef     string   `yaml:"answer_code_ref"      json:"-"`
	AnswerCodePlayRef string   `yaml:"answer_code_play_ref" json:"-"`
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

// QuizResponse is the public quiz payload. Answer and Explanation are intentionally absent.
type QuizResponse struct {
	ID      string   `json:"id"`
	Title   string   `json:"title"`
	Text    string   `json:"text"`
	Choices []string `json:"choices"`
	Code    string   `json:"code,omitempty"`
}

// AnswerRequest is the request body for POST /api/quiz/answer.
type AnswerRequest struct {
	QuestionID string `json:"question_id"`
	Answer     int    `json:"answer"`
}

// AnswerResponse is the response body for POST /api/quiz/answer.
type AnswerResponse struct {
	Correct           bool   `json:"correct"`
	Explanation       string `json:"explanation"`
	AnswerCode        string `json:"answer_code,omitempty"`
	AnswerCodePlayRef string `json:"answer_code_play_ref,omitempty"`
}

// LogStore persists answer logs.
type LogStore interface {
	InsertLog(ctx context.Context, questionID string, isCorrect bool) error
}

// QuizHandler serves GET /api/quiz and POST /api/quiz/answer.
// Rand is injectable for deterministic testing; nil uses the global rand.
type QuizHandler struct {
	Quizzes   []Quiz
	CodeFiles map[string]string
	DB        LogStore
	Rand      *rand.Rand
}

// SessionResponse is the response body for GET /api/quiz/session.
type SessionResponse struct {
	Quizzes []QuizResponse `json:"quizzes"`
}

// GetSession returns n unique random quiz questions (n=5, capped at available candidates).
// The optional "exclude" query parameter accepts a comma-separated list of question IDs
// to skip, enabling repeat-free challenge sessions.
func (h *QuizHandler) GetSession(w http.ResponseWriter, r *http.Request) {
	excludeSet := make(map[string]bool)
	if exc := r.URL.Query().Get("exclude"); exc != "" {
		for _, id := range strings.Split(exc, ",") {
			if id = strings.TrimSpace(id); id != "" {
				excludeSet[id] = true
			}
		}
	}

	candidates := make([]Quiz, 0, len(h.Quizzes))
	for _, q := range h.Quizzes {
		if !excludeSet[q.ID] {
			candidates = append(candidates, q)
		}
	}
	if len(candidates) == 0 {
		candidates = h.Quizzes
	}

	n := 5
	if len(candidates) < n {
		n = len(candidates)
	}

	var perm []int
	if h.Rand != nil {
		perm = h.Rand.Perm(len(candidates))
	} else {
		perm = rand.Perm(len(candidates))
	}
	quizzes := make([]QuizResponse, 0, n)
	for _, i := range perm[:n] {
		q := candidates[i]
		resp := QuizResponse{
			ID:      q.ID,
			Title:   q.Title,
			Text:    q.Text,
			Choices: q.Choices,
		}
		if q.QuestionCodeRef != "" {
			resp.Code = h.CodeFiles[q.QuestionCodeRef]
		}
		quizzes = append(quizzes, resp)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(SessionResponse{Quizzes: quizzes})
}

func (h *QuizHandler) GetQuiz(w http.ResponseWriter, r *http.Request) {
	if len(h.Quizzes) == 0 {
		http.Error(w, "no quizzes available", http.StatusInternalServerError)
		return
	}
	var q Quiz
	if h.Rand != nil {
		q = h.Quizzes[h.Rand.Intn(len(h.Quizzes))]
	} else {
		q = h.Quizzes[rand.Intn(len(h.Quizzes))]
	}
	resp := QuizResponse{
		ID:      q.ID,
		Title:   q.Title,
		Text:    q.Text,
		Choices: q.Choices,
	}
	if q.QuestionCodeRef != "" {
		resp.Code = h.CodeFiles[q.QuestionCodeRef]
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *QuizHandler) PostAnswer(w http.ResponseWriter, r *http.Request) {
	var req AnswerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	var target *Quiz
	for i := range h.Quizzes {
		if h.Quizzes[i].ID == req.QuestionID {
			target = &h.Quizzes[i]
			break
		}
	}
	if target == nil {
		http.Error(w, "question not found", http.StatusNotFound)
		return
	}
	isCorrect := req.Answer == target.Answer
	if err := h.DB.InsertLog(r.Context(), req.QuestionID, isCorrect); err != nil {
		http.Error(w, "failed to insert log", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	resp := AnswerResponse{
		Correct:     isCorrect,
		Explanation: target.Explanation,
	}
	if target.AnswerCodeRef != "" {
		resp.AnswerCode = h.CodeFiles[target.AnswerCodeRef]
	}
	if target.AnswerCodePlayRef != "" {
		resp.AnswerCodePlayRef = target.AnswerCodePlayRef
	}
	json.NewEncoder(w).Encode(resp)
}
