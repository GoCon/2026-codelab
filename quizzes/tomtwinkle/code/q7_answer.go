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
		fmt.Printf("index=%d rune=%d (%c)\n", i, v, v)
	}
	// index=0 rune=26085 (日)
	// index=3 rune=26412 (本)
	// index=6 rune=35486 (語)
}
