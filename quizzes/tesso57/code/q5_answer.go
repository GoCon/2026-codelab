//go:build ignore

package main

import "fmt"

type User struct {
	Age int
}

func main() {
	m := map[string]User{
		"gopher": {Age: 10},
	}

	u := m["gopher"]
	u.Age = 11
	m["gopher"] = u

	fmt.Println(m["gopher"].Age) // 11
}
