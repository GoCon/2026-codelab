.PHONY: build-pages clean local test-browser

GO := go

CODE_FILES  := $(wildcard functions/api/code/*.go)
PAGES_DIST  = gh-pages-dist

build-pages:
	rm -rf $(PAGES_DIST)
	mkdir -p $(PAGES_DIST)
	cp -r public/* $(PAGES_DIST)/
	$(GO) run ./cmd/generatequizdata -out $(PAGES_DIST)/quiz-data.js

clean:
	rm -rf $(PAGES_DIST)

local:
	$(GO) run ./cmd/local/

test-browser:
	node --test test/browser-ui.test.js
