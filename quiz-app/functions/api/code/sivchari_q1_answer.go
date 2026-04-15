//go:build ignore

package main

import "fmt"

func main() {
	// [...]T{index: value, ...} では、最大インデックス + 1 が配列の長さになる
	// インデックス指定がない要素は、直前のインデックス + 1 に配置される
	a := [...]int{
		0, // index 0: 値 0
		3: 3, // index 3: 値 3
		4, // index 4: 値 4 (直前の index 3 + 1)
		1: 1, // index 1: 値 1
		// index 2: 誰も指定していないのでゼロ値 0
	}
	// max index = 4 → len = 5
	fmt.Println(len(a), a) // 5 [0 1 0 3 4]
}
