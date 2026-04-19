// local はローカル開発用の HTTP サーバー。
// quiz-data.js を起動時に生成して public/ と一緒に配信する。
// 使用方法: make local (quiz-app/ ディレクトリから実行)
package main

import (
	"log/slog"
	"net/http"
	"os"

	"github.com/GoCon/2026-codelab/quiz-app/internal/quizdata"
)

func fail(logger *slog.Logger, msg string, err error) {
	logger.Error(msg, "error", err)
	os.Exit(1)
}

func main() {
	const quizDataBase = "quizzes"
	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))

	quizzes, codeFiles, err := quizdata.LoadFromBase(quizDataBase)
	if err != nil {
		fail(logger, "failed to load quiz data", err)
	}
	staticQuizzes := quizdata.BuildStaticQuizzes(quizzes, codeFiles)
	quizDataJS, err := quizdata.MarshalJavaScript(staticQuizzes)
	if err != nil {
		fail(logger, "failed to marshal quiz data", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /quiz-data.js", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
		w.Write(quizDataJS)
	})
	mux.Handle("/", http.FileServer(http.Dir("public")))

	addr := ":8788"
	if p := os.Getenv("PORT"); p != "" {
		addr = ":" + p
	}
	logger.Info("starting local server", "url", "http://localhost"+addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		fail(logger, "local server exited with error", err)
	}
}
