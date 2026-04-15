//go:build ignore

package main

import (
	"errors"
	"fmt"
	"io"
)

func main() {
	err := fmt.Errorf("wrap: %w", io.EOF)
	fmt.Println(errors.Is(err, io.EOF)) // true

	msg := fmt.Sprintf("wrap: %w", io.EOF)
	fmt.Println(msg) // wrapping にはならない
}
