SHELL := /bin/sh

PNPM ?= pnpm
NODE ?= node
VERSION ?=
GITHUB_REPO ?= k2safe/desktop-foundation
PROXY ?= http://127.0.0.1:10900
SMOKE_REPORT ?= artifacts/external-ai-demo-smoke.json
NO_BUILD ?=
NO_PACK ?=
NO_CHECK ?=
PREPARE_FLAGS := $(if $(filter 1 true yes,$(NO_BUILD)),--no-build,)
PREPARE_FLAGS += $(if $(filter 1 true yes,$(NO_PACK)),--no-pack,)
PREPARE_FLAGS += $(if $(filter 1 true yes,$(NO_CHECK)),--no-check,)

.PHONY: help release-prepare release-github release-verify release-local-check smoke-external-release

help: ## 显示可用命令
	@awk 'BEGIN {FS = ":.*## "; print "可用命令:"} /^[a-zA-Z0-9_-]+:.*## / {printf "  make %-16s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

release-prepare: ## 准备 release；升版本、打包、生成 manifest；用法 make release-prepare VERSION=0.1.36
	@set -e; \
	if [ -z "$(VERSION)" ]; then echo "VERSION is required, e.g. make release-prepare VERSION=0.1.36"; exit 2; fi; \
	$(PNPM) release:prepare -- --version "$(VERSION)" --repo "$(GITHUB_REPO)" $(PREPARE_FLAGS)

release-github: ## 创建/更新 GitHub Release；用法 make release-github VERSION=0.1.35
	@set -e; \
	if [ -z "$(VERSION)" ]; then echo "VERSION is required, e.g. make release-github VERSION=0.1.35"; exit 2; fi; \
	if [ -z "$$GH_TOKEN" ]; then \
		printf "GH_TOKEN: "; stty -echo; read GH_TOKEN; stty echo; printf "\n"; export GH_TOKEN; \
	fi; \
	VERSION="$(VERSION)" GITHUB_REPO="$(GITHUB_REPO)" PROXY="$(PROXY)" GH_TOKEN="$$GH_TOKEN" bash scripts/release-github.sh

release-verify: ## 验证 GitHub Release 资产和 manifest；用法 make release-verify VERSION=0.1.35
	@set -e; \
	if [ -z "$(VERSION)" ]; then echo "VERSION is required, e.g. make release-verify VERSION=0.1.35"; exit 2; fi; \
	$(PNPM) release:verify -- --version "$(VERSION)" --repo "$(GITHUB_REPO)" --proxy "$(PROXY)"

release-local-check: ## 执行本地 release gate
	$(PNPM) release:local-check

smoke-external-release: ## 用 GitHub Release manifest 跑外部接入烟测；用法 make smoke-external-release VERSION=0.1.35
	@set -e; \
	if [ -z "$(VERSION)" ]; then echo "VERSION is required, e.g. make smoke-external-release VERSION=0.1.35"; exit 2; fi; \
	$(PNPM) smoke:external-release -- \
		--manifest "https://github.com/$(GITHUB_REPO)/releases/download/v$(VERSION)/foundation-packages.json" \
		--proxy "$(PROXY)" \
		--report "$(SMOKE_REPORT)"
