//go:build js && wasm

package main

import (
	"context"
	"database/sql"
	"embed"
	"net/http"
	"os"

	"github.com/GoCon/2026-codelab/quiz-app/internal/quizdata"
	"github.com/GoCon/2026-codelab/quiz-app/internal/quizhandler"
	"github.com/syumai/workers"
	_ "github.com/syumai/workers/cloudflare/d1"
)

//go:embed quizes.yaml
var quizesYAML []byte

//go:embed code
var codeFS embed.FS

func buildCodeFiles() map[string]string {
	files := make(map[string]string)
	entries, _ := codeFS.ReadDir("code")
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		data, _ := codeFS.ReadFile("code/" + e.Name())
		files["code/"+e.Name()] = quizdata.StripBuildIgnore(string(data))
	}
	return files
}

// d1LogStore は Cloudflare D1 を使った LogStore 実装。
// workers ランタイムへの依存をこのファイルに封じ込める。
type d1LogStore struct{}

func (s *d1LogStore) InsertLog(ctx context.Context, questionID string, isCorrect bool) error {
	db, err := sql.Open("d1", os.Getenv("DB"))
	if err != nil {
		return err
	}
	defer db.Close()
	_, err = db.ExecContext(ctx, "INSERT INTO logs (question_id, is_correct) VALUES (?, ?)", questionID, isCorrect)
	return err
}

func main() {
	quizzes, err := quizhandler.ParseQuizzes(quizesYAML)
	if err != nil {
		panic("failed to parse quizes.yaml: " + err.Error())
	}
	codeFiles := buildCodeFiles()
	newQuizHandler := func() *quizhandler.QuizHandler {
		return &quizhandler.QuizHandler{
			Quizzes:   quizzes,
			CodeFiles: codeFiles,
			DB:        &d1LogStore{},
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
	workers.Serve(mux)
}
