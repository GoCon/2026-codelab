//go:build ignore

// See: https://gopherbadge.com/

package main

import (
	"image/color"
	"machine"
	"time"

	"tinygo.org/x/drivers/ws2812"
)

var colors = make([]color.RGBA, 2)

func main() {
	for {
		blinkEyes()
	}
}

func blinkEyes() {
	machine.NEOPIXELS.Configure(machine.PinConfig{Mode: machine.PinOutput})
	ws := ws2812.New(machine.xxxxxxxx)
	for {
		colors[0] = color.RGBA{R: 255}
		colors[1] = color.RGBA{B: 255}
		ws.WriteColors(colors)
		time.Sleep(time.Second / 2)

		colors[0] = color.RGBA{B: 255}
		colors[1] = color.RGBA{R: 255}
		ws.WriteColors(colors)
		time.Sleep(time.Second / 2)
	}
}
