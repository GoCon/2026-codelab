//go:build ignore

package main

import "fmt"

// untyped int の最大値を超える定数
const max = 999999999999999999999

func main() {
	fmt.Printf("max / 1000000000 = %v\n", max/1000000000)
}
