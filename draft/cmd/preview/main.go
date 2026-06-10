package main

import (
	"embed"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/GoCon/2026-codelab/internal/quizcode"
	"gopkg.in/yaml.v3"
)

//go:embed templates
var templateFS embed.FS

var explanationURLPattern = regexp.MustCompile(`https?://[^\s<>"']+`)

type Quiz struct {
	Title     string     `yaml:"title"`
	Author    string     `yaml:"author"`
	Questions []Question `yaml:"questions"`
}

type Question struct {
	Text              string        `yaml:"text"`
	QuestionCodeRef   string        `yaml:"question_code_ref"`
	QuestionCode      string        `yaml:"-"`
	Choices           []string      `yaml:"choices"`
	Answer            int           `yaml:"answer"`
	Explanation       string        `yaml:"explanation"`
	ExplanationHTML   template.HTML `yaml:"-"`
	AnswerCodeRef     string        `yaml:"answer_code_ref"`
	AnswerCodePlayRef string        `yaml:"answer_code_play_ref"`
	AnswerCode        string        `yaml:"-"`
}

func loadQuiz(path string) (*Quiz, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read quiz file: %w", err)
	}

	var quiz Quiz
	if err := yaml.Unmarshal(data, &quiz); err != nil {
		return nil, fmt.Errorf("failed to parse quiz file: %w", err)
	}

	dir := filepath.Dir(path)
	for i, q := range quiz.Questions {
		quiz.Questions[i].ExplanationHTML = renderExplanationHTML(q.Explanation)
		if q.QuestionCodeRef != "" {
			codePath := filepath.Join(dir, q.QuestionCodeRef)
			code, err := os.ReadFile(codePath)
			if err != nil {
				return nil, fmt.Errorf("failed to read code file %s: %w", codePath, err)
			}
			quiz.Questions[i].QuestionCode = quizcode.StripLeadingBuildIgnore(string(code))
		}
		if q.AnswerCodeRef != "" {
			codePath := filepath.Join(dir, q.AnswerCodeRef)
			code, err := os.ReadFile(codePath)
			if err != nil {
				return nil, fmt.Errorf("failed to read code file %s: %w", codePath, err)
			}
			quiz.Questions[i].AnswerCode = quizcode.StripLeadingBuildIgnore(string(code))
		}
	}

	return &quiz, nil
}

func renderExplanationHTML(explanation string) template.HTML {
	matches := explanationURLPattern.FindAllStringIndex(explanation, -1)
	if len(matches) == 0 {
		return template.HTML(template.HTMLEscapeString(explanation))
	}

	var builder strings.Builder
	last := 0
	for _, match := range matches {
		start, end := match[0], match[1]
		builder.WriteString(template.HTMLEscapeString(explanation[last:start]))

		rawURL := explanation[start:end]
		escapedURL := template.HTMLEscapeString(rawURL)
		builder.WriteString(`<a href="`)
		builder.WriteString(escapedURL)
		builder.WriteString(`" target="_blank" rel="noopener noreferrer">`)
		builder.WriteString(escapedURL)
		builder.WriteString(`</a>`)
		last = end
	}

	builder.WriteString(template.HTMLEscapeString(explanation[last:]))
	return template.HTML(builder.String())
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintf(os.Stderr, "Usage: go run ./cmd/preview <quiz.yaml>\n")
		os.Exit(1)
	}

	quizPath := os.Args[1]
	// Validate quiz file on startup
	if _, err := loadQuiz(quizPath); err != nil {
		log.Fatal(err)
	}

	funcMap := template.FuncMap{
		"inc": func(i int) int { return i + 1 },
	}

	tmpl, err := template.New("index.html").Funcs(funcMap).ParseFS(templateFS, "templates/index.html")
	if err != nil {
		log.Fatal(err)
	}

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Reload quiz on each request for live editing
		q, err := loadQuiz(quizPath)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if err := tmpl.Execute(w, q); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	})

	addr := ":8080"
	fmt.Printf("Preview server running at http://localhost%s\n", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}
