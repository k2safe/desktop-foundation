SHELL := /bin/sh

VERSION ?=
GITHUB_REPO ?= k2safe/desktop-foundation
PROXY ?= http://127.0.0.1:10900

.PHONY: help release-github

help: ## 显示可用命令
	@awk 'BEGIN {FS = ":.*## "; print "可用命令:"} /^[a-zA-Z0-9_-]+:.*## / {printf "  make %-16s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

release-github: ## 创建/更新 GitHub Release；用法 make release-github VERSION=0.1.35
	@set -e; \
	if [ -z "$(VERSION)" ]; then echo "VERSION is required, e.g. make release-github VERSION=0.1.35"; exit 2; fi; \
	if [ -z "$$GH_TOKEN" ]; then \
		printf "GH_TOKEN: "; stty -echo; read GH_TOKEN; stty echo; printf "\n"; export GH_TOKEN; \
	fi; \
	VERSION="$(VERSION)" GITHUB_REPO="$(GITHUB_REPO)" PROXY="$(PROXY)" GH_TOKEN="$$GH_TOKEN" bash scripts/release-github.sh
