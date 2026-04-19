package quizhandler

import "net/http"

// SetPublicAPIHeaders enables the public quiz API to be called from the GitHub Pages frontend.
func SetPublicAPIHeaders(w http.ResponseWriter) {
	headers := w.Header()
	headers.Set("Access-Control-Allow-Origin", "*")
	headers.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	headers.Set("Access-Control-Allow-Headers", "Content-Type")
}

// HandlePublicAPIPreflight responds to CORS preflight requests for the public quiz API.
func HandlePublicAPIPreflight(w http.ResponseWriter, r *http.Request) bool {
	if r.Method != http.MethodOptions {
		return false
	}
	SetPublicAPIHeaders(w)
	w.WriteHeader(http.StatusNoContent)
	return true
}
