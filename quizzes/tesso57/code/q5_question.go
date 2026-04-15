//go:build ignore

package main

type User struct {
	Age int
}

func main() {
	m := map[string]User{
		"gopher": {Age: 10},
	}
	m["gopher"].Age = 11
}
