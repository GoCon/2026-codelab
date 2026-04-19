//go:build ignore

package main

import "fmt"

func main() {
	a := []int{1, 2, 3}
	b := a[:2]
	b = append(b, 99)
	fmt.Println(a)
}
