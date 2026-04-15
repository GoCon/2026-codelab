//go:build ignore

package main

import "fmt"

type User struct {
	Name string
	Age  int
}

func main() {
	u := User{"Gopher", 10}
	fmt.Printf("????\n", u) // 出力: main.User{Name:"Gopher", Age:10}
	// ???? に入る verb はどれ？
}
