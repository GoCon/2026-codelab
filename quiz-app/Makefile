.PHONY: build build-pages clean local test-browser

# TinyGo 0.40.1 は Go 1.25 までをサポート。システムの Go が 1.26 以上の場合は
# GO 変数で Go 1.25 系のバイナリを指定する:
#   make build GO=/path/to/go1.25.x/bin/go
GO := go

QUIZ_WASM   = dist/functions/api/quiz.wasm
CODE_FILES  := $(wildcard functions/api/code/*.go)
PAGES_DIST  = gh-pages-dist

build: $(QUIZ_WASM)
	cp -r public/* dist/
	$(GO) run ./cmd/generatequizdata -out dist/quiz-data.js

build-pages:
	rm -rf $(PAGES_DIST)
	mkdir -p $(PAGES_DIST)
	cp -r public/* $(PAGES_DIST)/
	$(GO) run ./cmd/generatequizdata -out $(PAGES_DIST)/quiz-data.js

$(QUIZ_WASM): functions/api/quiz.go functions/api/quizes.yaml $(CODE_FILES)
	mkdir -p dist/functions/api
	GOROOT=$$($(GO) env GOROOT) PATH=$$($(GO) env GOROOT)/bin:$$PATH \
	  GOARCH=wasm GOOS=js tinygo build -o $@ ./functions/api/

clean:
	rm -rf dist/ $(PAGES_DIST)

local:
	go run ./cmd/local/

test-browser:
	node --test test/browser-ui.test.js
