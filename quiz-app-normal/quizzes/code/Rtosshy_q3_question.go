//go:build ignore

package main

import "fmt"

func main() {
	slice := make([]int, 10)
	for n := range 10 {
		slice = append(slice, n)
	}

	fmt.Println(slice)
}
