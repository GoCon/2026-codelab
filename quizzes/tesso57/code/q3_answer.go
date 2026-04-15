//go:build ignore

package main

import "fmt"

func main() {
	// nil map は読み取りはゼロ値を返すが、書き込みは panic する
	var m map[string]int
	fmt.Println(m["hello"]) // 0（ゼロ値）

	// 書き込みには make で初期化が必要
	m = make(map[string]int)
	m["hello"] = 1
	fmt.Println(m["hello"]) // 1
}
