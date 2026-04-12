//go:build js && wasm

package main

import (
	"context"
	"database/sql"
	"net/http"
	"os"

	"github.com/syumai/workers"
	_ "github.com/syumai/workers/cloudflare/d1"
	"github.com/GoCon/2026-codelab/quiz-app/internal/quizhandler"
)

// d1StatsStore は Cloudflare D1 を使った StatsStore 実装。
type d1StatsStore struct{}

func (s *d1StatsStore) QueryStats(ctx context.Context) ([]quizhandler.QuestionStat, error) {
	db, err := sql.Open("d1", os.Getenv("DB"))
	if err != nil {
		return nil, err
	}
	defer db.Close()
	rows, err := db.QueryContext(ctx, `
		SELECT
			question_id,
			COUNT(*) AS total,
			SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) AS correct
		FROM logs
		GROUP BY question_id
		ORDER BY question_id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []quizhandler.QuestionStat
	for rows.Next() {
		var s quizhandler.QuestionStat
		if err := rows.Scan(&s.QuestionID, &s.Total, &s.Correct); err != nil {
			return nil, err
		}
		stats = append(stats, s)
	}
	return stats, nil
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /admin/api/stats", func(w http.ResponseWriter, r *http.Request) {
		h := &quizhandler.StatsHandler{DB: &d1StatsStore{}}
		h.GetStats(w, r)
	})
	workers.Serve(mux)
}
