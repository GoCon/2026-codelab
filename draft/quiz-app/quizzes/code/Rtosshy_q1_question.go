//go:build ignore

package main

import (
	"fmt"
)

type MyError struct{}

func (e *MyError) Error() string {
	return "error occur"
}

func DoSomething() error {
	var err *MyError
	return err
}

func main() {
	err := DoSomething()

	isErrNil := err == nil
	fmt.Println(isErrNil)
}
