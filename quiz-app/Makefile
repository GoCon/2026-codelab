.PHONY: build build-pages clean local

# TinyGo 0.40.1 は Go 1.25 までをサポート。システムの Go が 1.26 以上の場合は
# GO 変数で Go 1.25 系のバイナリを指定する:
#   make build GO=/path/to/go1.25.x/bin/go
GO := go

QUIZ_WASM   = dist/functions/api/quiz.wasm
STATS_WASM  = dist/functions/api/admin/stats.wasm
CODE_FILES  := $(wildcard functions/api/code/*.go)
PAGES_DIST  = gh-pages-dist

build: $(QUIZ_WASM) $(STATS_WASM)
	cp -r public/* dist/

build-pages:
	rm -rf $(PAGES_DIST)
	mkdir -p $(PAGES_DIST)
	cp public/index.html public/quiz-config.js $(PAGES_DIST)/

$(QUIZ_WASM): functions/api/quiz.go functions/api/quizes.yaml $(CODE_FILES)
	mkdir -p dist/functions/api
	GOROOT=$$($(GO) env GOROOT) PATH=$$($(GO) env GOROOT)/bin:$$PATH \
	  GOARCH=wasm GOOS=js tinygo build -o $@ ./functions/api/

$(STATS_WASM): functions/api/admin/stats.go
	mkdir -p dist/functions/api/admin
	GOROOT=$$($(GO) env GOROOT) PATH=$$($(GO) env GOROOT)/bin:$$PATH \
	  GOARCH=wasm GOOS=js tinygo build -o $@ ./functions/api/admin/

clean:
	rm -rf dist/ $(PAGES_DIST)

local:
	go run ./cmd/local/
