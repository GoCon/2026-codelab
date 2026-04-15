//go:build ignore

package main

import "fmt"

const (
	a = iota * 2 // iota=0 → 0*2 = 0
	b            // iota=1, 式 iota*2 を引き継ぐ → 1*2 = 2
	c = iota     // iota=2 → 2 (リセットされない)
	d            // iota=3, 式 iota を引き継ぐ → 3
)

func main() {
	fmt.Println(a, b, c, d) // 0 2 2 3
}
