package quizhandler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"math/rand"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/GoCon/2026-codelab/quiz-app/internal/quizhandler"
)

// ---- Test doubles -------------------------------------------------------
//
// MemStore は LogStore の代替実装。
// モックではなく、ログエントリを実際に保持する本物の代替実装。

type logEntry struct {
	questionID string
	isCorrect  bool
}

type MemStore struct {
	mu        sync.Mutex
	entries   []logEntry
	InsertErr error // non-nil で InsertLog がこのエラーを返す
}

func (m *MemStore) InsertLog(_ context.Context, questionID string, isCorrect bool) error {
	if m.InsertErr != nil {
		return m.InsertErr
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.entries = append(m.entries, logEntry{questionID, isCorrect})
	return nil
}

// Entries は蓄積されたログエントリのスナップショットを返す（状態検証用）。
func (m *MemStore) Entries() []logEntry {
	m.mu.Lock()
	defer m.mu.Unlock()
	cp := make([]logEntry, len(m.entries))
	copy(cp, m.entries)
	return cp
}

// ---- テスト用クイズデータ ------------------------------------------------

var (
	quizWithCode = quizhandler.Quiz{
		ID:              "q1",
		Title:           "スライスの長さ",
		Text:            "len() の使い方は？",
		Choices:         []string{"size()", "count()", "len()", "length()"},
		Answer:          2,
		Explanation:     "len() は組み込み関数です",
		QuestionCodeRef: "code/q1.go",
	}
	quizNoCode = quizhandler.Quiz{
		ID:          "q2",
		Title:       "defer のスコープ",
		Text:        "defer のスコープは？",
		Choices:     []string{"ブロック", "ループ", "関数", "プログラム"},
		Answer:      2,
		Explanation: "defer は関数スコープです",
	}
	quizAnswerAtZero = quizhandler.Quiz{
		ID:      "q3",
		Title:   "ゼロインデックス正解",
		Text:    "最初の選択肢が正解",
		Choices: []string{"正解", "不正解A", "不正解B", "不正解C"},
		Answer:  0,
	}
	quizAnswerAtLast = quizhandler.Quiz{
		ID:      "q4",
		Title:   "最後のインデックスが正解",
		Text:    "最後の選択肢が正解",
		Choices: []string{"不正解A", "不正解B", "不正解C", "正解"},
		Answer:  3,
	}
)

func fixedRand(seed int64) *rand.Rand {
	return rand.New(rand.NewSource(seed)) //nolint:gosec // テスト用固定シード
}

func newQuizHandler(quizzes []quizhandler.Quiz, db quizhandler.LogStore, r *rand.Rand) *quizhandler.QuizHandler {
	return &quizhandler.QuizHandler{
		Quizzes:   quizzes,
		CodeFiles: map[string]string{"code/q1.go": "package main\n// q1 code"},
		DB:        db,
		Rand:      r,
	}
}

func postJSON(t *testing.T, h http.HandlerFunc, body any) *httptest.ResponseRecorder {
	t.Helper()
	b, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/quiz/answer", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h(w, req)
	return w
}

func decodeJSON[T any](t *testing.T, w *httptest.ResponseRecorder) T {
	t.Helper()
	var v T
	if err := json.NewDecoder(w.Body).Decode(&v); err != nil {
		t.Fatalf("decode JSON: %v\nbody: %s", err, w.Body.String())
	}
	return v
}

func TestParseQuizzes_DefaultModeIsBoth(t *testing.T) {
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
}

func TestParseQuizzes_InvalidModeReturnsError(t *testing.T) {
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

func TestSetPublicAPIHeaders(t *testing.T) {
	w := httptest.NewRecorder()

	quizhandler.SetPublicAPIHeaders(w)

	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Fatalf("Access-Control-Allow-Origin: got %q, want *", got)
	}
	if got := w.Header().Get("Access-Control-Allow-Methods"); got != "GET, POST, OPTIONS" {
		t.Fatalf("Access-Control-Allow-Methods: got %q", got)
	}
	if got := w.Header().Get("Access-Control-Allow-Headers"); got != "Content-Type" {
		t.Fatalf("Access-Control-Allow-Headers: got %q", got)
	}
}

func TestHandlePublicAPIPreflight_OPTIONSReturns204(t *testing.T) {
	req := httptest.NewRequest(http.MethodOptions, "/api/quiz/answer", nil)
	w := httptest.NewRecorder()

	handled := quizhandler.HandlePublicAPIPreflight(w, req)

	if !handled {
		t.Fatal("expected preflight request to be handled")
	}
	if w.Code != http.StatusNoContent {
		t.Fatalf("got %d, want %d", w.Code, http.StatusNoContent)
	}
	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Fatalf("Access-Control-Allow-Origin: got %q, want *", got)
	}
}

// =========================================================================
// GetQuiz
// =========================================================================

func TestGetQuiz_EmptyQuizList_Returns500(t *testing.T) {
	h := newQuizHandler(nil, &MemStore{}, fixedRand(0))
	req := httptest.NewRequest(http.MethodGet, "/api/quiz", nil)
	w := httptest.NewRecorder()
	h.GetQuiz(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("got %d, want 500", w.Code)
	}
}

func TestGetQuiz_NormalResponse(t *testing.T) {
	h := newQuizHandler([]quizhandler.Quiz{quizNoCode}, &MemStore{}, fixedRand(0))
	req := httptest.NewRequest(http.MethodGet, "/api/quiz", nil)
	w := httptest.NewRecorder()
	h.GetQuiz(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("got %d, want 200", w.Code)
	}
	resp := decodeJSON[quizhandler.QuizResponse](t, w)
	if resp.ID != quizNoCode.ID {
		t.Errorf("ID: got %q, want %q", resp.ID, quizNoCode.ID)
	}
	if resp.Title != quizNoCode.Title {
		t.Errorf("Title: got %q, want %q", resp.Title, quizNoCode.Title)
	}
	if resp.Text != quizNoCode.Text {
		t.Errorf("Text: got %q, want %q", resp.Text, quizNoCode.Text)
	}
	if len(resp.Choices) != len(quizNoCode.Choices) {
		t.Errorf("Choices len: got %d, want %d", len(resp.Choices), len(quizNoCode.Choices))
	}
}

// Answer フィールドがレスポンス JSON に含まれていないことを生バイトで検証する。
// struct タグの変更でうっかり漏れることへの防御。
func TestGetQuiz_AnswerNotLeakedInJSON(t *testing.T) {
	h := newQuizHandler([]quizhandler.Quiz{quizWithCode}, &MemStore{}, fixedRand(0))
	req := httptest.NewRequest(http.MethodGet, "/api/quiz", nil)
	w := httptest.NewRecorder()
	h.GetQuiz(w, req)

	body := w.Body.String()
	var raw map[string]any
	if err := json.Unmarshal([]byte(body), &raw); err != nil {
		t.Fatal(err)
	}
	if _, ok := raw["answer"]; ok {
		t.Errorf("response must not contain 'answer' key, got: %s", body)
	}
}

func TestGetQuiz_ExplanationNotLeakedInJSON(t *testing.T) {
	h := newQuizHandler([]quizhandler.Quiz{quizWithCode}, &MemStore{}, fixedRand(0))
	req := httptest.NewRequest(http.MethodGet, "/api/quiz", nil)
	w := httptest.NewRecorder()
	h.GetQuiz(w, req)

	var raw map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &raw); err != nil {
		t.Fatal(err)
	}
	if _, ok := raw["explanation"]; ok {
		t.Errorf("response must not contain 'explanation' key")
	}
}

func TestGetQuiz_WithCodeRef_CodePresent(t *testing.T) {
	h := newQuizHandler([]quizhandler.Quiz{quizWithCode}, &MemStore{}, fixedRand(0))
	req := httptest.NewRequest(http.MethodGet, "/api/quiz", nil)
	w := httptest.NewRecorder()
	h.GetQuiz(w, req)

	resp := decodeJSON[quizhandler.QuizResponse](t, w)
	if resp.Code == "" {
		t.Error("code field should be present when question_code_ref is set")
	}
}

func TestGetQuiz_WithoutCodeRef_CodeAbsent(t *testing.T) {
	h := newQuizHandler([]quizhandler.Quiz{quizNoCode}, &MemStore{}, fixedRand(0))
	req := httptest.NewRequest(http.MethodGet, "/api/quiz", nil)
	w := httptest.NewRecorder()
	h.GetQuiz(w, req)

	var raw map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &raw); err != nil {
		t.Fatal(err)
	}
	if _, ok := raw["code"]; ok {
		t.Error("code field must be absent (omitempty) when code_ref is empty")
	}
}

// code_ref が指定されているがファイルマップに存在しない場合、code は空文字→omitempty で省略される。
func TestGetQuiz_MissingCodeFile_CodeAbsent(t *testing.T) {
	q := quizhandler.Quiz{
		ID: "qx", Choices: []string{"a"}, QuestionCodeRef: "code/missing.go",
	}
	h := &quizhandler.QuizHandler{
		Quizzes:   []quizhandler.Quiz{q},
		CodeFiles: map[string]string{}, // ファイルなし
		DB:        &MemStore{},
		Rand:      fixedRand(0),
	}
	req := httptest.NewRequest(http.MethodGet, "/api/quiz", nil)
	w := httptest.NewRecorder()
	h.GetQuiz(w, req)

	var raw map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &raw); err != nil {
		t.Fatal(err)
	}
	if v, ok := raw["code"]; ok && v != "" {
		t.Errorf("code should be absent when file not found, got: %v", v)
	}
}

func TestGetQuiz_ContentTypeIsJSON(t *testing.T) {
	h := newQuizHandler([]quizhandler.Quiz{quizNoCode}, &MemStore{}, fixedRand(0))
	req := httptest.NewRequest(http.MethodGet, "/api/quiz", nil)
	w := httptest.NewRecorder()
	h.GetQuiz(w, req)

	ct := w.Header().Get("Content-Type")
	if !strings.HasPrefix(ct, "application/json") {
		t.Errorf("Content-Type: got %q, want application/json", ct)
	}
}

// ランダム選択の結果が必ず Quizzes の中に含まれることを確認する。
func TestGetQuiz_ReturnedQuizIsAlwaysInList(t *testing.T) {
	quizzes := []quizhandler.Quiz{quizWithCode, quizNoCode, quizAnswerAtZero}
	ids := map[string]bool{"q1": true, "q2": true, "q3": true}

	for seed := int64(0); seed < 50; seed++ {
		h := newQuizHandler(quizzes, &MemStore{}, fixedRand(seed))
		req := httptest.NewRequest(http.MethodGet, "/api/quiz", nil)
		w := httptest.NewRecorder()
		h.GetQuiz(w, req)

		resp := decodeJSON[quizhandler.QuizResponse](t, w)
		if !ids[resp.ID] {
			t.Errorf("seed %d: returned unknown quiz ID %q", seed, resp.ID)
		}
	}
}

// 同一シードでは毎回同じ問題が返ること（冪等性）。
func TestGetQuiz_SameSeedReturnsSameQuiz(t *testing.T) {
	quizzes := []quizhandler.Quiz{quizWithCode, quizNoCode, quizAnswerAtZero}

	getID := func(seed int64) string {
		h := newQuizHandler(quizzes, &MemStore{}, fixedRand(seed))
		req := httptest.NewRequest(http.MethodGet, "/api/quiz", nil)
		w := httptest.NewRecorder()
		h.GetQuiz(w, req)
		return decodeJSON[quizhandler.QuizResponse](t, w).ID
	}

	for seed := int64(1); seed <= 10; seed++ {
		if getID(seed) != getID(seed) {
			t.Errorf("seed %d produced different quiz IDs across runs", seed)
		}
	}
}

// =========================================================================
// PostAnswer
// =========================================================================

func TestPostAnswer_CorrectAnswer(t *testing.T) {
	store := &MemStore{}
	h := newQuizHandler([]quizhandler.Quiz{quizWithCode}, store, fixedRand(0))
	w := postJSON(t, h.PostAnswer, quizhandler.AnswerRequest{QuestionID: "q1", Answer: 2})

	if w.Code != http.StatusOK {
		t.Fatalf("got %d, want 200", w.Code)
	}
	resp := decodeJSON[quizhandler.AnswerResponse](t, w)
	if !resp.Correct {
		t.Error("correct answer should return correct=true")
	}
	if resp.Explanation != quizWithCode.Explanation {
		t.Errorf("explanation: got %q, want %q", resp.Explanation, quizWithCode.Explanation)
	}
}

func TestPostAnswer_WrongAnswer(t *testing.T) {
	store := &MemStore{}
	h := newQuizHandler([]quizhandler.Quiz{quizWithCode}, store, fixedRand(0))
	w := postJSON(t, h.PostAnswer, quizhandler.AnswerRequest{QuestionID: "q1", Answer: 0})

	if w.Code != http.StatusOK {
		t.Fatalf("got %d, want 200", w.Code)
	}
	resp := decodeJSON[quizhandler.AnswerResponse](t, w)
	if resp.Correct {
		t.Error("wrong answer should return correct=false")
	}
	if resp.Explanation != quizWithCode.Explanation {
		t.Errorf("explanation: got %q, want %q", resp.Explanation, quizWithCode.Explanation)
	}
}

// 境界値: 選択肢インデックス 0 が正解のケース
func TestPostAnswer_BoundaryAnswerIndex0_Correct(t *testing.T) {
	store := &MemStore{}
	h := newQuizHandler([]quizhandler.Quiz{quizAnswerAtZero}, store, fixedRand(0))
	w := postJSON(t, h.PostAnswer, quizhandler.AnswerRequest{QuestionID: "q3", Answer: 0})

	resp := decodeJSON[quizhandler.AnswerResponse](t, w)
	if !resp.Correct {
		t.Error("index 0 should be correct for quizAnswerAtZero")
	}
}

// 境界値: 正解インデックス 0 のクイズで index 1 を選んだ場合
func TestPostAnswer_BoundaryAnswerIndex0_Wrong(t *testing.T) {
	store := &MemStore{}
	h := newQuizHandler([]quizhandler.Quiz{quizAnswerAtZero}, store, fixedRand(0))
	w := postJSON(t, h.PostAnswer, quizhandler.AnswerRequest{QuestionID: "q3", Answer: 1})

	resp := decodeJSON[quizhandler.AnswerResponse](t, w)
	if resp.Correct {
		t.Error("index 1 should be wrong for quizAnswerAtZero (answer=0)")
	}
}

// 境界値: 最後のインデックス（len-1）が正解
func TestPostAnswer_BoundaryLastIndex_Correct(t *testing.T) {
	store := &MemStore{}
	h := newQuizHandler([]quizhandler.Quiz{quizAnswerAtLast}, store, fixedRand(0))
	w := postJSON(t, h.PostAnswer, quizhandler.AnswerRequest{QuestionID: "q4", Answer: 3})

	resp := decodeJSON[quizhandler.AnswerResponse](t, w)
	if !resp.Correct {
		t.Error("last index should be correct for quizAnswerAtLast")
	}
}

// 異常値: 負のインデックスは不正解になること（パニックしないこと）
func TestPostAnswer_NegativeAnswer_Wrong(t *testing.T) {
	store := &MemStore{}
	h := newQuizHandler([]quizhandler.Quiz{quizAnswerAtZero}, store, fixedRand(0))
	w := postJSON(t, h.PostAnswer, quizhandler.AnswerRequest{QuestionID: "q3", Answer: -1})

	if w.Code != http.StatusOK {
		t.Fatalf("got %d, want 200 (negative answer is valid wrong answer)", w.Code)
	}
	resp := decodeJSON[quizhandler.AnswerResponse](t, w)
	if resp.Correct {
		t.Error("negative answer index should be wrong")
	}
}

// 異常値: 選択肢の範囲外インデックスは不正解になること
func TestPostAnswer_OutOfRangeAnswer_Wrong(t *testing.T) {
	store := &MemStore{}
	h := newQuizHandler([]quizhandler.Quiz{quizWithCode}, store, fixedRand(0))
	w := postJSON(t, h.PostAnswer, quizhandler.AnswerRequest{QuestionID: "q1", Answer: 9999})

	if w.Code != http.StatusOK {
		t.Fatalf("got %d, want 200", w.Code)
	}
	resp := decodeJSON[quizhandler.AnswerResponse](t, w)
	if resp.Correct {
		t.Error("out-of-range answer should be wrong")
	}
}

// 偽陰性防止: 存在しない question_id で 404 を返すこと
func TestPostAnswer_UnknownQuestionID_Returns404(t *testing.T) {
	h := newQuizHandler([]quizhandler.Quiz{quizWithCode}, &MemStore{}, fixedRand(0))
	w := postJSON(t, h.PostAnswer, quizhandler.AnswerRequest{QuestionID: "unknown", Answer: 0})

	if w.Code != http.StatusNotFound {
		t.Errorf("got %d, want 404", w.Code)
	}
}

// 境界値: 空文字 question_id は存在しないため 404
func TestPostAnswer_EmptyQuestionID_Returns404(t *testing.T) {
	h := newQuizHandler([]quizhandler.Quiz{quizWithCode}, &MemStore{}, fixedRand(0))
	w := postJSON(t, h.PostAnswer, quizhandler.AnswerRequest{QuestionID: "", Answer: 0})

	if w.Code != http.StatusNotFound {
		t.Errorf("got %d, want 404", w.Code)
	}
}

func TestPostAnswer_MalformedJSON_Returns400(t *testing.T) {
	h := newQuizHandler([]quizhandler.Quiz{quizWithCode}, &MemStore{}, fixedRand(0))
	req := httptest.NewRequest(http.MethodPost, "/api/quiz/answer", strings.NewReader("{invalid"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.PostAnswer(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("got %d, want 400", w.Code)
	}
}

func TestPostAnswer_EmptyBody_Returns400(t *testing.T) {
	h := newQuizHandler([]quizhandler.Quiz{quizWithCode}, &MemStore{}, fixedRand(0))
	req := httptest.NewRequest(http.MethodPost, "/api/quiz/answer", strings.NewReader(""))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.PostAnswer(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("got %d, want 400", w.Code)
	}
}

func TestPostAnswer_NonJSONBody_Returns400(t *testing.T) {
	h := newQuizHandler([]quizhandler.Quiz{quizWithCode}, &MemStore{}, fixedRand(0))
	req := httptest.NewRequest(http.MethodPost, "/api/quiz/answer", strings.NewReader("not json at all"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.PostAnswer(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("got %d, want 400", w.Code)
	}
}

func TestPostAnswer_DBError_Returns500(t *testing.T) {
	store := &MemStore{InsertErr: errors.New("db unavailable")}
	h := newQuizHandler([]quizhandler.Quiz{quizWithCode}, store, fixedRand(0))
	w := postJSON(t, h.PostAnswer, quizhandler.AnswerRequest{QuestionID: "q1", Answer: 2})

	if w.Code != http.StatusInternalServerError {
		t.Errorf("got %d, want 500", w.Code)
	}
}

func TestPostAnswer_ContentTypeIsJSON(t *testing.T) {
	h := newQuizHandler([]quizhandler.Quiz{quizWithCode}, &MemStore{}, fixedRand(0))
	w := postJSON(t, h.PostAnswer, quizhandler.AnswerRequest{QuestionID: "q1", Answer: 2})

	ct := w.Header().Get("Content-Type")
	if !strings.HasPrefix(ct, "application/json") {
		t.Errorf("Content-Type: got %q, want application/json", ct)
	}
}

func TestPostAnswer_WithAnswerCodeRef_AnswerCodePresent(t *testing.T) {
	quizWithAnswerCode := quizhandler.Quiz{
		ID:            "qa",
		Title:         "回答コード付き",
		Text:          "答えは？",
		Choices:       []string{"A", "B"},
		Answer:        0,
		Explanation:   "解説",
		AnswerCodeRef: "code/qa_answer.go",
	}
	h := &quizhandler.QuizHandler{
		Quizzes:   []quizhandler.Quiz{quizWithAnswerCode},
		CodeFiles: map[string]string{"code/qa_answer.go": "package main // answer"},
		DB:        &MemStore{},
		Rand:      fixedRand(0),
	}
	w := postJSON(t, h.PostAnswer, quizhandler.AnswerRequest{QuestionID: "qa", Answer: 0})

	resp := decodeJSON[quizhandler.AnswerResponse](t, w)
	if resp.AnswerCode == "" {
		t.Error("answer_code should be present when answer_code_ref is set")
	}
}

func TestPostAnswer_WithAnswerCodePlayRef_PlayRefPresent(t *testing.T) {
	quizWithPlayRef := quizhandler.Quiz{
		ID:                "qb",
		Title:             "Playground付き",
		Text:              "答えは？",
		Choices:           []string{"A", "B"},
		Answer:            1,
		Explanation:       "解説",
		AnswerCodePlayRef: "https://go.dev/play/p/example",
	}
	h := &quizhandler.QuizHandler{
		Quizzes:   []quizhandler.Quiz{quizWithPlayRef},
		CodeFiles: map[string]string{},
		DB:        &MemStore{},
		Rand:      fixedRand(0),
	}
	w := postJSON(t, h.PostAnswer, quizhandler.AnswerRequest{QuestionID: "qb", Answer: 1})

	resp := decodeJSON[quizhandler.AnswerResponse](t, w)
	if resp.AnswerCodePlayRef != "https://go.dev/play/p/example" {
		t.Errorf("answer_code_play_ref: got %q, want playground URL", resp.AnswerCodePlayRef)
	}
}

func TestPostAnswer_WithoutAnswerCodeRef_AnswerCodeAbsent(t *testing.T) {
	h := newQuizHandler([]quizhandler.Quiz{quizWithCode}, &MemStore{}, fixedRand(0))
	w := postJSON(t, h.PostAnswer, quizhandler.AnswerRequest{QuestionID: "q1", Answer: 0})

	var raw map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &raw); err != nil {
		t.Fatal(err)
	}
	if _, ok := raw["answer_code"]; ok {
		t.Error("answer_code must be absent (omitempty) when answer_code_ref is not set")
	}
}

// 状態遷移: 正解→不正解の順に回答した場合、MemStore に正しい順序で記録されること。
// DB が呼ばれたかどうかではなく、格納された状態の正しさを検証する。
func TestPostAnswer_LogPersistedCorrectly(t *testing.T) {
	store := &MemStore{}
	h := newQuizHandler([]quizhandler.Quiz{quizWithCode, quizNoCode}, store, fixedRand(0))

	// 1回目: 正解
	postJSON(t, h.PostAnswer, quizhandler.AnswerRequest{QuestionID: "q1", Answer: 2})
	// 2回目: 不正解
	postJSON(t, h.PostAnswer, quizhandler.AnswerRequest{QuestionID: "q1", Answer: 0})
	// 3回目: 別問題、正解
	postJSON(t, h.PostAnswer, quizhandler.AnswerRequest{QuestionID: "q2", Answer: 2})

	entries := store.Entries()
	if len(entries) != 3 {
		t.Fatalf("expected 3 log entries, got %d", len(entries))
	}
	tests := []struct {
		questionID string
		isCorrect  bool
	}{
		{"q1", true},
		{"q1", false},
		{"q2", true},
	}
	for i, tt := range tests {
		if entries[i].questionID != tt.questionID || entries[i].isCorrect != tt.isCorrect {
			t.Errorf("entry[%d]: got {%s, %v}, want {%s, %v}",
				i, entries[i].questionID, entries[i].isCorrect,
				tt.questionID, tt.isCorrect)
		}
	}
}

// =========================================================================
// quizes.yaml 構造検証
// 実際のファイルを読み込んで、クイズデータの整合性を保証する。
// =========================================================================

func loadRealQuizzes(t *testing.T) []quizhandler.Quiz {
	t.Helper()
	data, err := os.ReadFile("../../functions/api/quizes.yaml")
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

func TestQuizesYAML_AnswerIndexInRange(t *testing.T) {
	for _, q := range loadRealQuizzes(t) {
		if q.Answer < 0 || q.Answer >= len(q.Choices) {
			t.Errorf("quiz %q: answer=%d は choices の範囲外 (len=%d)",
				q.ID, q.Answer, len(q.Choices))
		}
	}
}

// 選択肢が 2 つ以上あること（1つでは問題として成立しない）
func TestQuizesYAML_SufficientChoices(t *testing.T) {
	for _, q := range loadRealQuizzes(t) {
		if len(q.Choices) < 2 {
			t.Errorf("quiz %q: choices が %d 個しかありません（最低 2 個必要）",
				q.ID, len(q.Choices))
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
			if _, err := os.Stat(filepath.Join("../../functions/api", ref.path)); err != nil {
				t.Errorf("quiz %q: %s=%q の参照先が存在しません: %v", q.ID, ref.name, ref.path, err)
			}
		}
	}
}

// ---- GetSession テスト ---------------------------------------------------

func TestGetSession_ReturnsDefaultFiveQuizzes(t *testing.T) {
	quizzes := []quizhandler.Quiz{
		quizWithCode, quizNoCode, quizAnswerAtZero, quizAnswerAtLast,
		{ID: "q5", Title: "Q5", Text: "T5", Choices: []string{"A", "B"}, Answer: 0},
		{ID: "q6", Title: "Q6", Text: "T6", Choices: []string{"A", "B"}, Answer: 0},
	}
	h := newQuizHandler(quizzes, &MemStore{}, fixedRand(42))
	req := httptest.NewRequest(http.MethodGet, "/api/quiz/session", nil)
	w := httptest.NewRecorder()
	h.GetSession(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	var resp struct {
		Quizzes []struct {
			ID string `json:"id"`
		} `json:"quizzes"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Quizzes) != 5 {
		t.Errorf("len(quizzes) = %d, want 5", len(resp.Quizzes))
	}
}

func TestGetSession_UniqueQuizzes(t *testing.T) {
	quizzes := []quizhandler.Quiz{
		quizWithCode, quizNoCode, quizAnswerAtZero, quizAnswerAtLast,
		{ID: "q5", Title: "Q5", Text: "T5", Choices: []string{"A", "B"}, Answer: 0},
		{ID: "q6", Title: "Q6", Text: "T6", Choices: []string{"A", "B"}, Answer: 0},
	}
	h := newQuizHandler(quizzes, &MemStore{}, fixedRand(99))
	req := httptest.NewRequest(http.MethodGet, "/api/quiz/session", nil)
	w := httptest.NewRecorder()
	h.GetSession(w, req)

	var resp struct {
		Quizzes []struct {
			ID string `json:"id"`
		} `json:"quizzes"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}
	seen := make(map[string]bool)
	for _, q := range resp.Quizzes {
		if seen[q.ID] {
			t.Errorf("重複した問題 ID: %s", q.ID)
		}
		seen[q.ID] = true
	}
}

func TestGetSession_CappedWhenFewQuizzes(t *testing.T) {
	quizzes := []quizhandler.Quiz{quizWithCode, quizNoCode}
	h := newQuizHandler(quizzes, &MemStore{}, fixedRand(1))
	req := httptest.NewRequest(http.MethodGet, "/api/quiz/session", nil)
	w := httptest.NewRecorder()
	h.GetSession(w, req)

	var resp struct {
		Quizzes []struct {
			ID string `json:"id"`
		} `json:"quizzes"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Quizzes) != 2 {
		t.Errorf("len(quizzes) = %d, want 2 (capped)", len(resp.Quizzes))
	}
}

func TestGetSession_IncludesCodeWhenPresent(t *testing.T) {
	quizzes := []quizhandler.Quiz{quizWithCode}
	h := newQuizHandler(quizzes, &MemStore{}, fixedRand(1))
	req := httptest.NewRequest(http.MethodGet, "/api/quiz/session", nil)
	w := httptest.NewRecorder()
	h.GetSession(w, req)

	var resp struct {
		Quizzes []struct {
			ID   string `json:"id"`
			Code string `json:"code"`
		} `json:"quizzes"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Quizzes) == 0 {
		t.Fatal("quizzes は空であってはいけません")
	}
	if resp.Quizzes[0].Code == "" {
		t.Error("question_code_ref を持つ問題の code フィールドが空です")
	}
}

func TestGetSession_ExcludesSpecifiedIDs(t *testing.T) {
	quizzes := []quizhandler.Quiz{
		quizWithCode, quizNoCode, quizAnswerAtZero, quizAnswerAtLast,
		{ID: "q5", Title: "Q5", Text: "T5", Choices: []string{"A", "B"}, Answer: 0},
		{ID: "q6", Title: "Q6", Text: "T6", Choices: []string{"A", "B"}, Answer: 0},
	}
	h := newQuizHandler(quizzes, &MemStore{}, fixedRand(7))
	req := httptest.NewRequest(http.MethodGet, "/api/quiz/session?exclude=q1,q2,q3", nil)
	w := httptest.NewRecorder()
	h.GetSession(w, req)

	var resp struct {
		Quizzes []struct {
			ID string `json:"id"`
		} `json:"quizzes"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}
	excluded := map[string]bool{"q1": true, "q2": true, "q3": true}
	for _, q := range resp.Quizzes {
		if excluded[q.ID] {
			t.Errorf("除外指定した問題 %q が返されました", q.ID)
		}
	}
}

func TestGetSession_FallsBackToAllWhenAllExcluded(t *testing.T) {
	quizzes := []quizhandler.Quiz{quizWithCode, quizNoCode}
	h := newQuizHandler(quizzes, &MemStore{}, fixedRand(1))
	req := httptest.NewRequest(http.MethodGet, "/api/quiz/session?exclude=q1,q2", nil)
	w := httptest.NewRecorder()
	h.GetSession(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	var resp struct {
		Quizzes []struct {
			ID string `json:"id"`
		} `json:"quizzes"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Quizzes) == 0 {
		t.Error("全除外時は全問題にフォールバックするため quizzes は空であってはいけません")
	}
}
