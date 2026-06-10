//go:build ignore

// See: https://gopherbadge.com/

package main

import (
	"image/color"
	"machine"
	"tinygo.org/x/drivers/st7789"
)

var colors = make([]color.RGBA, 2)

func main() {
	// configure the display
	machine.SPI0.Configure(machine.SPIConfig{
		Mode:      3,
		SCK:       machine.SPI0_SCK_PIN,
		SDO:       machine.SPI0_SDO_PIN,
		SDI:       machine.SPI0_SDI_PIN,
		Frequency: 62_500_000, // 62.5MHz
	})
	display := st7789.New(machine.SPI0,
		machine.TFT_RST,       // TFT_RESET
		machine.TFT_WRX,       // TFT_DC
		machine.TFT_CS,        // TFT_CS
		machine.TFT_BACKLIGHT) // TFT_LITE
	display.Configure(st7789.Config{
		Rotation: st7789.ROTATION_270,
		Height:   320,
	})

    display.FillScreen(color.RGBA{0, 0, 0, 255})
}
