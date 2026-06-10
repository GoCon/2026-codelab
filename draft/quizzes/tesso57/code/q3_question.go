//go:build ignore

package main

import "fmt"

func main() {
	var m map[string]int
	fmt.Println(m["hello"])
	m["hello"] = 1
}
