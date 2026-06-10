//go:build ignore

package main

import "fmt"

func main() {
	s := []int{1, 2, 3}
	clear(s)
	fmt.Println(len(s)) // ?
}
