//go:build ignore

package main

import "fmt"

func main() {
	chA := make(chan string, 4)
	chB := make(chan string, 4)
	chC := make(chan string, 4)

	chB <- "msgB-1"
	chA <- "msgA"
	chB <- "msgB-2"
	chC <- "msgC"

	// まずはchAを先に確認する
	select {
	case msg := <-chA:
		fmt.Printf("Message from chA: %s\n", msg)
	default:
		// chAがなければchA、chB、chCのどれかから取得する
		select {
		case msg := <-chA:
			fmt.Printf("Message from chA: %s\n", msg)
		case msg := <-chB:
			fmt.Printf("Message from chB: %s\n", msg)
		case msg := <-chC:
			fmt.Printf("Message from chC: %s\n", msg)
		}
	}

	// この場合は必ず "Message from chA: msgA" が出力される
}
