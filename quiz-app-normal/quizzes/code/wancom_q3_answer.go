//go:build ignore

// 参考: https://pkg.go.dev/net/http/pprof@go1.26.2

package main

import (
	"log"
	"net/http"
	"time"

	// import するだけで pprof ハンドラが登録される。
	_ "net/http/pprof"
)

func main() {
	// プロファイリングデータを返すための HTTP サーバーを開始する。
	go func() {
		log.Println("Starting pprof server...")
		log.Println(http.ListenAndServe("localhost:6060", nil))
	}()

	// ここに色々処理を追加する。
	go func() {
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
