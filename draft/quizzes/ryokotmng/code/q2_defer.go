
package main

import "fmt"

func f() int {
    x := 0
    defer fmt.Println("defer:", x)
    x = 42
    return x
}

func main() {
    fmt.Println("return:", f())
}
