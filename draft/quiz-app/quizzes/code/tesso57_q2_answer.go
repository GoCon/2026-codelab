//go:build ignore

package main

import "fmt"

type User struct {
	Name string
	Age  int
}

func main() {
	u := User{"Gopher", 10}
	fmt.Printf("%v\n", u)  // {Gopher 10}
	fmt.Printf("%+v\n", u) // {Name:Gopher Age:10}
	fmt.Printf("%#v\n", u) // main.User{Name:"Gopher", Age:10}
}
