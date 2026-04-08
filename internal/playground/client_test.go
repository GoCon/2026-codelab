package playground

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestClientFormatAndShare(t *testing.T) {
	t.Parallel()

	const (
		input     = "package main\nfunc main(){}"
		formatted = "package main\n\nfunc main() {}\n"
	)

	var sharedBody string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/_/fmt":
			if err := r.ParseForm(); err != nil {
				t.Fatalf("ParseForm: %v", err)
			}
			if got := r.Form.Get("body"); got != input {
				t.Fatalf("format body = %q, want %q", got, input)
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"Body":"package main\n\nfunc main() {}\n","Error":""}`)
		case "/_/share":
			body, err := io.ReadAll(r.Body)
			if err != nil {
				t.Fatalf("ReadAll: %v", err)
			}
			sharedBody = string(body)
			_, _ = io.WriteString(w, "snippet123")
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client := &Client{
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	}

	gotFormatted, gotURL, err := client.FormatAndShare(context.Background(), input)
	if err != nil {
		t.Fatalf("FormatAndShare: %v", err)
	}
	if gotFormatted != formatted {
		t.Fatalf("formatted code = %q, want %q", gotFormatted, formatted)
	}
	if sharedBody != formatted {
		t.Fatalf("shared body = %q, want %q", sharedBody, formatted)
	}
	wantURL := server.URL + "/play/p/snippet123"
	if gotURL != wantURL {
		t.Fatalf("share URL = %q, want %q", gotURL, wantURL)
	}
}

func TestClientFormatReturnsAPIError(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/_/fmt") {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"Body":"","Error":"bad snippet"}`)
	}))
	defer server.Close()

	client := &Client{
		BaseURL:    server.URL,
		HTTPClient: server.Client(),
	}

	if _, err := client.Format(context.Background(), "package main"); err == nil || !strings.Contains(err.Error(), "bad snippet") {
		t.Fatalf("Format error = %v, want API error", err)
	}
}
