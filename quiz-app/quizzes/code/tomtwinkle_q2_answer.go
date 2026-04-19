//go:build ignore

package main

import "fmt"

// untyped int の最大値を超える定数
// 型無し定数はコンパイル時に少なくとも 256ビットの精度を持つ
const max = 999999999999999999999

func main() {
	// 計算結果がuntyped intの上限値を超えないのでコンパイルエラーにならない
	fmt.Printf("max / 1000000000 = %v\n", max/1000000000)

	// 以下はコンパイルエラー
	// var x int = max // constant 999999999999999999999 overflows int
}
