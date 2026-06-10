//go:build ignore

package main

import "fmt"

const (
	a = iota * 2
	b
	c = iota
	d
)

func main() {
	fmt.Println(a, b, c, d)
}
