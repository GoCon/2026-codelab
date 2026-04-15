package main

import (
	"flag"
	"log"
	"os"
	"path/filepath"

	"github.com/GoCon/2026-codelab/quiz-app/internal/quizdata"
)

func main() {
	basePath := flag.String("base", "functions/api", "quiz data base directory")
	outPath := flag.String("out", "", "output path")
	flag.Parse()

	if *outPath == "" {
		log.Fatal("-out is required")
	}

	quizzes, codeFiles, err := quizdata.LoadFromBase(*basePath)
	if err != nil {
		log.Fatal(err)
	}
	staticQuizzes := quizdata.BuildStaticQuizzes(quizzes, codeFiles)
	js, err := quizdata.MarshalJavaScript(staticQuizzes)
	if err != nil {
		log.Fatal(err)
	}

	if err := os.MkdirAll(filepath.Dir(*outPath), 0o755); err != nil {
		log.Fatal(err)
	}
	if err := os.WriteFile(*outPath, js, 0o644); err != nil {
		log.Fatal(err)
	}
}
