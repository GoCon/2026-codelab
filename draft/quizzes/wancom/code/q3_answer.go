//go:build ignore

// 参考: https://pkg.go.dev/net/http/pprof@go1.26.2

package main

import (
	"log"
	"net/http"
	"time"

	// 下記をimportするだけで諸々の設定を行なってくれる
	_ "net/http/pprof"
)

func main() {
	// プロファイリングデータを返すためのHTTPサーバーを開始する
	go func() {
		log.Println("Starting pprof server...")
		log.Println(http.ListenAndServe("localhost:6060", nil))
	}()

	// ここに色々処理を追加
	go func() {
		// 別goroutineで起動する
		log.Println("Sub goroutine started.")
		for {
			time.Sleep(time.Second)
		}
	}()

	log.Println("Now main goroutine will enter the loop.")
	for {
		time.Sleep(time.Second)
	}
}

// http://localhost:6060/debug/pprof/ にアクセスするとさまざまな情報が取得できる。
