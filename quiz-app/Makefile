.PHONY: build clean local

# TinyGo 0.40.1 は Go 1.25 までをサポート。システムの Go が 1.26 以上の場合は
# GO 変数で Go 1.25 系のバイナリを指定する:
#   make build GO=/home/tom/sdk/go1.25.9/bin/go
GO := go

QUIZ_WASM   = dist/functions/api/quiz.wasm
STATS_WASM  = dist/functions/api/admin/stats.wasm

build: $(QUIZ_WASM) $(STATS_WASM)
	cp -r public/* dist/

$(QUIZ_WASM): functions/api/quiz.go functions/api/quizes.yaml functions/api/code/q1.go
	mkdir -p dist/functions/api
	GOROOT=$$($(GO) env GOROOT) PATH=$$($(GO) env GOROOT)/bin:$$PATH \
	  GOARCH=wasm GOOS=js tinygo build -o $@ ./functions/api/

$(STATS_WASM): functions/api/admin/stats.go
	mkdir -p dist/functions/api/admin
	GOROOT=$$($(GO) env GOROOT) PATH=$$($(GO) env GOROOT)/bin:$$PATH \
	  GOARCH=wasm GOOS=js tinygo build -o $@ ./functions/api/admin/

clean:
	rm -rf dist/

local:
	go run ./cmd/local/
