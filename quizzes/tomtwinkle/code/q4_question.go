//go:build ignore

package main

import (
	"fmt"
	"os"
)

func processFiles(names []string) error {
	for _, name := range names {
		file, err := os.CreateTemp("", name)
		if err != nil {
			return err
		}
		defer file.Close() // ← この defer に問題がある？
		fmt.Println("opened:", file.Name())
	}
	return nil // ← ここに来るまで Close は呼ばれない
}

func main() {
	names := []string{"a", "b", "c", "d", "e"}
	processFiles(names)
}
