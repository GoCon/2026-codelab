//go:build ignore

package main

import "errors"

type MyErr struct{ error }

func f1() error  { return nil }
func f2() *MyErr { return nil }

var err1 = errors.Join()
var err2 = errors.Join(f1(), f1())
var err3 = errors.Join(f1(), f2())
