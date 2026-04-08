//go:build ignore

package main

import "fmt"

// 名前付き戻り値 + defer の実行順序:
//  1. return 1  → 戻り値変数 n に 1 が代入される
//  2. defer 実行 → n++ が呼ばれて n = 2 になる
//  3. n の値 (2) が返される

func f() (n int) {
	defer func() {
		fmt.Printf("defer: n before++ = %d\n", n)
		n++
		fmt.Printf("defer: n after++  = %d\n", n)
	}()
	return 1 // n = 1 を設定してから defer へ
}

func main() {
	result := f()
	fmt.Println("result:", result) // 2
}
