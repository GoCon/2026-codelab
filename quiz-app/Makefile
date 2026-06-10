.PHONY: clean local test

NPM ?= npm
HOST ?= localhost
PORT ?= 8788

node_modules: package.json package-lock.json
	$(NPM) ci

local: node_modules
	$(NPM) run dev -- --host $(HOST) --port $(PORT)

test: node_modules
	$(NPM) run test
	$(NPM) run test:build

clean:
	rm -rf dist dist-pages dist-pages-check
