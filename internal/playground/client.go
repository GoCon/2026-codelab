package playground

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	defaultBaseURL   = "https://go.dev"
	defaultUserAgent = "github.com/GoCon/2026-codelab sync_answer_code_play_refs"
	defaultTimeout   = 30 * time.Second
)

type Client struct {
	BaseURL    string
	HTTPClient *http.Client
	UserAgent  string
}

type formatResponse struct {
	Body  string `json:"Body"`
	Error string `json:"Error"`
}

func NewClient() *Client {
	return &Client{
		BaseURL:    defaultBaseURL,
		HTTPClient: &http.Client{Timeout: defaultTimeout},
		UserAgent:  defaultUserAgent,
	}
}

func (c *Client) Format(ctx context.Context, code string) (string, error) {
	form := url.Values{}
	form.Set("body", code)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL()+"/_/fmt", strings.NewReader(form.Encode()))
	if err != nil {
		return "", fmt.Errorf("create format request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", c.userAgent())

	resp, err := c.httpClient().Do(req)
	if err != nil {
		return "", fmt.Errorf("format request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return "", fmt.Errorf("format request returned %s: %s", resp.Status, strings.TrimSpace(string(body)))
	}

	var payload formatResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return "", fmt.Errorf("decode format response: %w", err)
	}
	if payload.Error != "" {
		return "", fmt.Errorf("go.dev format error: %s", payload.Error)
	}

	return payload.Body, nil
}

func (c *Client) Share(ctx context.Context, code string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL()+"/_/share", strings.NewReader(code))
	if err != nil {
		return "", fmt.Errorf("create share request: %w", err)
	}
	req.Header.Set("Content-Type", "text/plain; charset=utf-8")
	req.Header.Set("User-Agent", c.userAgent())

	resp, err := c.httpClient().Do(req)
	if err != nil {
		return "", fmt.Errorf("share request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if err != nil {
		return "", fmt.Errorf("read share response: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("share request returned %s: %s", resp.Status, strings.TrimSpace(string(body)))
	}

	id := strings.TrimSpace(string(body))
	if id == "" {
		return "", fmt.Errorf("share response was empty")
	}

	return c.baseURL() + "/play/p/" + id, nil
}

func (c *Client) FormatAndShare(ctx context.Context, code string) (string, string, error) {
	formatted, err := c.Format(ctx, code)
	if err != nil {
		return "", "", err
	}

	url, err := c.Share(ctx, formatted)
	if err != nil {
		return "", "", err
	}

	return formatted, url, nil
}

func (c *Client) baseURL() string {
	if c.BaseURL == "" {
		return defaultBaseURL
	}
	return strings.TrimRight(c.BaseURL, "/")
}

func (c *Client) httpClient() *http.Client {
	if c.HTTPClient != nil {
		return c.HTTPClient
	}
	return &http.Client{Timeout: defaultTimeout}
}

func (c *Client) userAgent() string {
	if c.UserAgent == "" {
		return defaultUserAgent
	}
	return c.UserAgent
}
