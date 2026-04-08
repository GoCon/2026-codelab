//go:build ignore

package main

import (
	"testing"
)

// t.Fatal は runtime.Goexit() を呼ぶため goroutine だけが終了する
// close(done) に到達しないため <-done がブロックし続け、タイムアウトまで止まらない、もしくはdeadlockする。
func TestBadPattern(t *testing.T) {
	done := make(chan struct{})

	go func() {
		t.Fatal("goroutine からエラー!")
		close(done) // runtime.Goexit() により到達しない
	}()

	<-done // タイムアウトまでブロックし続ける、もしくはdeadlockする
}

// goroutine 内では t.Errorf を使い、defer で完了を通知する
func TestGoodPattern(t *testing.T) {
	done := make(chan struct{})

	go func() {
		defer close(done) // defer はGoexit後も実行されるため確実に完了通知できる
		t.Errorf("goroutine からエラー!")
	}()

	<-done // 確実にハンドラの完了を待てる
}
