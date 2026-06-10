//go:build ignore

package main

import "fmt"

type Name string

func (n Name) String() string {
	return fmt.Sprintf("Name: %v", n)
}

func main() {
	fmt.Println(Name("Go"))
}
