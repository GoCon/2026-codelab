//go:build ignore

package main

import "fmt"

type Name string

// %v ではなく string(n) にキャストすることで無限再帰を回避
func (n Name) String() string {
	return fmt.Sprintf("Name: %s", string(n))
}

func main() {
	fmt.Println(Name("Go")) // Name: Go
}
