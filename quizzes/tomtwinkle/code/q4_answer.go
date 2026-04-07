//go:build ignore

package main

import (
	"fmt"
	"os"
)

// 悪い例: defer が関数終了まで溜まり続ける
func badPattern(names []string) error {
	for _, name := range names {
		f, err := os.CreateTemp("", name)
		if err != nil {
			return err
		}
		defer f.Close() // ループが終わっても Close されない!
		fmt.Println("opened:", f.Name())
	}
	return nil // ← ここで初めて全 defer が実行される
}

// 良い例: ループ本体を関数に切り出す
func goodPattern(names []string) error {
	for _, name := range names {
		if err := openAndProcess(name); err != nil {
			return err
		}
	}
	return nil
}

func openAndProcess(name string) error {
	f, err := os.CreateTemp("", name)
	if err != nil {
		return err
	}
	defer f.Close() // この関数が終わると即 Close される
	fmt.Println("opened and closed:", f.Name())
	return nil
}

func main() {
	names := []string{"a", "b", "c"}
	fmt.Println("=== bad pattern ===")
	badPattern(names)
	fmt.Println("=== good pattern ===")
	goodPattern(names)
}
