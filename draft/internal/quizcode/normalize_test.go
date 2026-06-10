package quizcode

import "testing"

func TestStripLeadingBuildIgnore(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "removes directive and blank line",
			in:   "//go:build ignore\n\npackage main\n",
			want: "package main\n",
		},
		{
			name: "removes directive without blank line",
			in:   "//go:build ignore\npackage main\n",
			want: "package main\n",
		},
		{
			name: "keeps other code unchanged",
			in:   "package main\n",
			want: "package main\n",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := StripLeadingBuildIgnore(tt.in); got != tt.want {
				t.Fatalf("StripLeadingBuildIgnore() = %q, want %q", got, tt.want)
			}
		})
	}
}
