//go:build ignore

package main

import "fmt"

func main() {
	byString := map[string]int{"go": 1}
	byInt := map[int]string{1: "one"}
	byArray := map[[2]int]string{{1, 2}: "pair"}

	fmt.Println(byString, byInt, byArray)

	// slice は comparable ではないので map のキーにできない
	// invalid := map[[]int]string{{1, 2}: "slice"}
	// _ = invalid
}
