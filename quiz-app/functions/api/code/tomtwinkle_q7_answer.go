//go:build ignore

package main

import (
	"fmt"
	"unicode/utf8"
)

func main() {
	s := "日本語"
	fmt.Printf("バイト数: %d\n", len(s))                     // 9 (各 3 バイト)
	fmt.Printf("文字数:   %d\n", utf8.RuneCountInString(s)) // 3

	fmt.Println("\nrange でのインデックスはバイト位置:")
	for i, v := range s {
		fmt.Printf("i=%d v=%v,", i, v)
	}
	// i=0 v=26085,i=3 v=26412,i=6 v=35486,
}
