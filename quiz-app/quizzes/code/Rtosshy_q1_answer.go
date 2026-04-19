//go:build ignore

package main

import (
	"fmt"
	"reflect"
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

	fmt.Println("errの型情報:", reflect.TypeOf(err))
	fmt.Println("errの値はnil:", reflect.ValueOf(err).IsNil())
}
