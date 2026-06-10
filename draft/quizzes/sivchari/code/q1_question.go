//go:build ignore

package main

import "fmt"

func main() {
	a := [...]int{0, 3: 3, 4, 1: 1}
	fmt.Println(len(a), a)
}
