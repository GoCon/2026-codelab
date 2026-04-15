// local はローカル開発用の HTTP サーバー。
// TinyGo・wrangler 不要で quiz-app の動作確認ができる。
// ログは起動中のみ保持するオンメモリストアを使用する。
// 使用方法: make local (quiz-app/ ディレクトリから実行)
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"sync"

	"github.com/GoCon/2026-codelab/quiz-app/internal/quizdata"
	"github.com/GoCon/2026-codelab/quiz-app/internal/quizhandler"
)

// inMemoryStore は LogStore と StatsStore をオンメモリで実装する。
type inMemoryStore struct {
	mu   sync.Mutex
	logs []logEntry
}

type logEntry struct {
	questionID string
	isCorrect  bool
}

func (s *inMemoryStore) InsertLog(_ context.Context, questionID string, isCorrect bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.logs = append(s.logs, logEntry{questionID: questionID, isCorrect: isCorrect})
	return nil
}

func (s *inMemoryStore) QueryStats(_ context.Context) ([]quizhandler.QuestionStat, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	index := make(map[string]*quizhandler.QuestionStat)
	for _, l := range s.logs {
		if _, ok := index[l.questionID]; !ok {
			index[l.questionID] = &quizhandler.QuestionStat{QuestionID: l.questionID}
		}
		index[l.questionID].Total++
		if l.isCorrect {
			index[l.questionID].Correct++
		}
	}

	stats := make([]quizhandler.QuestionStat, 0, len(index))
	for _, v := range index {
		stats = append(stats, *v)
	}
	return stats, nil
}

func main() {
	const apiBase = "functions/api"

	quizzes, codeFiles, err := quizdata.LoadFromBase(apiBase)
	if err != nil {
		log.Fatal(err)
	}
	staticQuizzes := quizdata.BuildStaticQuizzes(quizzes, codeFiles)
	quizDataJS, err := quizdata.MarshalJavaScript(staticQuizzes)
	if err != nil {
		log.Fatal(err)
	}

	store := &inMemoryStore{}
	newQuizHandler := func() *quizhandler.QuizHandler {
		return &quizhandler.QuizHandler{
			Quizzes:   quizzes,
			CodeFiles: codeFiles,
			DB:        store,
		}
	}

	mux := http.NewServeMux()
	mux.HandleFunc("OPTIONS /api/quiz/session", func(w http.ResponseWriter, r *http.Request) {
		quizhandler.HandlePublicAPIPreflight(w, r)
	})
	mux.HandleFunc("GET /api/quiz/session", func(w http.ResponseWriter, r *http.Request) {
		quizhandler.SetPublicAPIHeaders(w)
		newQuizHandler().GetSession(w, r)
	})
	mux.HandleFunc("OPTIONS /api/quiz", func(w http.ResponseWriter, r *http.Request) {
		quizhandler.HandlePublicAPIPreflight(w, r)
	})
	mux.HandleFunc("GET /api/quiz", func(w http.ResponseWriter, r *http.Request) {
		quizhandler.SetPublicAPIHeaders(w)
		newQuizHandler().GetQuiz(w, r)
	})
	mux.HandleFunc("OPTIONS /api/quiz/answer", func(w http.ResponseWriter, r *http.Request) {
		quizhandler.HandlePublicAPIPreflight(w, r)
	})
	mux.HandleFunc("POST /api/quiz/answer", func(w http.ResponseWriter, r *http.Request) {
		quizhandler.SetPublicAPIHeaders(w)
		newQuizHandler().PostAnswer(w, r)
	})
	mux.HandleFunc("GET /admin/api/quizzes", func(w http.ResponseWriter, r *http.Request) {
		newQuizHandler().GetAdminQuizzes(w, r)
	})
	mux.HandleFunc("GET /admin/api/stats", func(w http.ResponseWriter, r *http.Request) {
		h := &quizhandler.StatsHandler{DB: store}
		h.GetStats(w, r)
	})
	mux.HandleFunc("GET /quiz-data.js", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
		w.Write(quizDataJS)
	})
	mux.Handle("/", http.FileServer(http.Dir("public")))

	addr := ":8788"
	if p := os.Getenv("PORT"); p != "" {
		addr = ":" + p
	}
	log.Printf("ローカルサーバーを起動しています: http://localhost%s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}
