//go:build ignore

package main

import "fmt"

func updateA(s string) {
	s = "Changed"
}

func updateB(s *string) {
	newValue := "Changed"
	s = &newValue
}

func updateC(s *string) {
	*s = "Changed"
}

func updateD(s **string) {
	newValue := "Changed"
	*s = &newValue
}

func main() {
	msg := "Original"

	updateA(msg)
	fmt.Printf("A: %s\n", msg)

	msg = "Original"
	updateB(&msg)
	fmt.Printf("B: %s\n", msg)

	msg = "Original"
	updateC(&msg)
	fmt.Printf("C: %s\n", msg)

	msg = "Original"
	ptr := &msg
	updateD(&ptr)
	fmt.Printf("D: %s\n", msg)
}
