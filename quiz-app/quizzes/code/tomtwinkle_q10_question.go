//go:build ignore

package main

import (
	"testing"
	"testing/synctest"
)

func TestSynctestIsolation(t *testing.T) {
	ch := make(chan int)

	// synctest の外側から channel に送信
	go func() {
		ch <- 42
	}()

	synctest.Run(func() {
		// 内側で外側の channel を受信
		v := <-ch // ?
		t.Log("received:", v)
	})
}
