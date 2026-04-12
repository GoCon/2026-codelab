//go:build ignore

package main

import (
	"testing"
)

func TestFatalInGoroutine(t *testing.T) {
	done := make(chan struct{})

	go func() {
		t.Fatal("goroutine からエラー!")
		close(done) // ← このテストはどうなる？
	}()

	<-done
}
