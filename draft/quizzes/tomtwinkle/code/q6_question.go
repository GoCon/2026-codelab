//go:build ignore

package main

import "fmt"

func f() (n int) {
	defer func() { n++ }()
	return 1
}

func main() {
	fmt.Println(f()) // ?
}
