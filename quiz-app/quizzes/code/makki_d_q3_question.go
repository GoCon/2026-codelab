//go:build ignore

package main

type MyType1 map[int]string
type MyType2 = MyType1
type MyType3 MyType1
type MyType4 struct{ MyType1 }

func (MyType1) m1()

type MyIface interface{ m1() }

func MyFunc[T MyIface](v []T) {}
