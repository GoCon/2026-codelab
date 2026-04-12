//go:build ignore

package main

import (
	"fmt"
	"runtime"
)

// Go 1.25 以降はランタイムが cgroup の CPU quota を自動検知するため
// uber/automaxprocs や手動設定は不要になりました。
//
// 以前の定石 (Go 1.24 以前):
//
// import _ "go.uber.org/automaxprocs"
//
// Go 1.25+ では何もしなくてよい
func main() {
	fmt.Printf("GOMAXPROCS: %d\n", runtime.GOMAXPROCS(0))
	fmt.Printf("NumCPU:     %d\n", runtime.NumCPU())
	fmt.Println("Go 1.25+ ではコンテナの CPU 制限を自動検知します")
}
