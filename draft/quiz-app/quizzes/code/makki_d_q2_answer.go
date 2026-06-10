//go:build ignore

package main

import (
	"errors"
	"fmt"
)

type MyErr struct{ error }

func f1() error  { return nil }
func f2() *MyErr { return nil }

var err1 = errors.Join()
var err2 = errors.Join(f1(), f1())
var err3 = errors.Join(f1(), f2())

func main() {
	if err1 != nil {
		fmt.Println("err1 != nil")
	}
	if err2 != nil {
		fmt.Println("err2 != nil")
	}
	if err3 != nil {
		fmt.Println("err3 != nil") // 表示される
	}
}
