//go:build ignore

package main

import (
	"fmt"
	"testing"
)

// go test のキャッシュを無効化するには -count=1 を使います。
//
// キャッシュあり (2回目以降は "(cached)" と表示):
//
//	go test ./...
//
// キャッシュ無効 (毎回強制再実行):
//
//	go test -count=1 ./...
//
// テストキャッシュ全消去:
//
//	go clean -testcache
func ExampleTestCaching() {
	fmt.Println("go test -count=1 でキャッシュを無視できます")
	// Output:
	// go test -count=1 でキャッシュを無視できます
}

var _ = testing.Verbose
