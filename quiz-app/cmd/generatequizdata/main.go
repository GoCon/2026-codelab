package main

import (
	"flag"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/GoCon/2026-codelab/quiz-app/internal/quizdata"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))
	basePath := flag.String("base", "quizzes", "quiz data base directory")
	outPath := flag.String("out", "", "output path")
	flag.Parse()

	if *outPath == "" {
		logger.Error("-out is required")
		os.Exit(1)
	}

	quizzes, codeFiles, err := quizdata.LoadFromBase(*basePath)
	if err != nil {
		logger.Error("failed to load quiz data", "error", err)
		os.Exit(1)
	}
	staticQuizzes := quizdata.BuildStaticQuizzes(quizzes, codeFiles)
	js, err := quizdata.MarshalJavaScript(staticQuizzes)
	if err != nil {
		logger.Error("failed to marshal quiz data", "error", err)
		os.Exit(1)
	}

	if err := os.MkdirAll(filepath.Dir(*outPath), 0o755); err != nil {
		logger.Error("failed to create output directory", "error", err, "path", filepath.Dir(*outPath))
		os.Exit(1)
	}
	if err := os.WriteFile(*outPath, js, 0o644); err != nil {
		logger.Error("failed to write quiz data", "error", err, "path", *outPath)
		os.Exit(1)
	}
}
