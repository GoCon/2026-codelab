//go:build ignore

package main

import "fmt"

func main() {
	a := make([]int, 0, 5)
	// a は len=0, cap=5 の空スライス。裏の配列には余裕がある。

	b := append(a, 1) // 裏の配列[0] に 1 を書き込む
	fmt.Printf("b=%v  ptr=%p\n", b, &b[0])

	c := append(a, 2) // a は len=0 のまま。同じ裏の配列[0] に 2 を上書き!
	fmt.Printf("c=%v  ptr=%p\n", c, &c[0])

	// b と c は同じ裏の配列を指しているため b[0] も 2 になる
	fmt.Println("b:", b) // [2]
	fmt.Println("c:", c) // [2]
}
