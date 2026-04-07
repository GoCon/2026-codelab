//go:build ignore

package main

import "fmt"

// 型無し定数: コンパイル時に少なくとも 256 ビット精度を持つ
const max = 999999999999999999999

func main() {
	fmt.Println("定数の定義に成功")
	fmt.Printf("max / 1000000000 = %v\n", max/1000000000)

	// 以下をアンコメントするとコンパイルエラー:
	// var x int = max // constant 999999999999999999999 overflows int
}
