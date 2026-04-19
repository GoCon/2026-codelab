//go:build ignore

package main

import "fmt"

func main() {
	// clear のスライスに対する動作 (Go 1.21+)
	s := []int{1, 2, 3}
	fmt.Printf("before: len=%d cap=%d val=%v\n", len(s), cap(s), s)

	clear(s) // 全要素をゼロ値に。len と cap は変わらない。

	fmt.Printf("after:  len=%d cap=%d val=%v\n", len(s), cap(s), s)
	// after:  len=3 cap=3 val=[0 0 0]

	// マップの場合は要素が削除されて len=0 になる
	m := map[string]int{"a": 1, "b": 2}
	fmt.Printf("map before: len=%d\n", len(m))
	clear(m)
	fmt.Printf("map after:  len=%d\n", len(m))
}
