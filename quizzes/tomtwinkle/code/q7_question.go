//go:build ignore

package main

import "fmt"

func main() {
	for i, v := range "日本語" {
		fmt.Printf("%d, %d\n", i, v) // ?
	}
}
