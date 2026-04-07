//go:build ignore

package main

import (
	"testing"
	"testing/synctest"
)

// synctest.Run の外側の goroutine と内側の goroutine が
// channel で同期しようとするとどうなる？ (Go 1.24+)
func TestSynctestIsolation(t *testing.T) {
	ch := make(chan int)

	// synctest の外側から channel に送信
	go func() {
		ch <- 42 // 外側の goroutine (リアルタイムで動く)
	}()

	synctest.Run(func() {
		// 内側で外側の channel を受信しようとすると...
		v := <-ch // ?
		t.Log("received:", v)
	})
}
