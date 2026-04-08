package quizcode

import "strings"

const buildIgnoreDirective = "//go:build ignore"

func StripLeadingBuildIgnore(code string) string {
	if !strings.HasPrefix(code, buildIgnoreDirective) {
		return code
	}

	rest := strings.TrimPrefix(code, buildIgnoreDirective)

	switch {
	case strings.HasPrefix(rest, "\r\n\r\n"):
		return rest[len("\r\n\r\n"):]
	case strings.HasPrefix(rest, "\n\n"):
		return rest[len("\n\n"):]
	case strings.HasPrefix(rest, "\r\n"):
		return rest[len("\r\n"):]
	case strings.HasPrefix(rest, "\n"):
		return rest[len("\n"):]
	default:
		return rest
	}
}
