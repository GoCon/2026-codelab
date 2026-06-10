//go:build ignore

package main

import "fmt"

func main() {
	s := "hello"
	fmt.Println(len(s)) // 5

	// 日本語など多バイト文字の場合は文字数と異なる
	s2 := "こんにちは"
	fmt.Println(len(s2))         // 15 (UTF-8 で 1 文字 3 バイト)
	fmt.Println(len([]rune(s2))) // 5 (文字数)
}
