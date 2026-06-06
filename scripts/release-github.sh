#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

version="${VERSION:-${1:-}}"
if [[ -z "$version" ]]; then
  echo "VERSION is required, e.g. VERSION=0.1.35 make release-github" >&2
  exit 2
fi

tag="${TAG:-v${version}}"
github_repo="${GITHUB_REPO:-k2safe/desktop-foundation}"
proxy="${PROXY-http://127.0.0.1:10900}"

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "GH_TOKEN is required. Export it first or run through Makefile prompt." >&2
  exit 2
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh is required. Install GitHub CLI first." >&2
  exit 2
fi

if [[ -n "$proxy" ]]; then
  export HTTPS_PROXY="$proxy"
  export HTTP_PROXY="$proxy"
fi
export GH_TOKEN

release_manifest="$repo_root/artifacts/npm/foundation-packages.release.json"
(cd "$repo_root" && pnpm release:package-manifest -- --tag "$tag" --repo "$github_repo")

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
cp "$release_manifest" "$tmp_dir/foundation-packages.json"

assets=(
  "$tmp_dir/foundation-packages.json"
  "$repo_root/artifacts/npm/foundation-capabilities.json"
  "$repo_root/artifacts/npm/desktop-foundation-bridge-${version}.tgz"
  "$repo_root/artifacts/npm/desktop-foundation-ui-react-${version}.tgz"
  "$repo_root/artifacts/npm/desktop-foundation-app-shell-${version}.tgz"
  "$repo_root/artifacts/npm/desktop-foundation-theme-presets-${version}.tgz"
  "$repo_root/artifacts/npm/desktop-foundation-create-desktop-app-${version}.tgz"
)

for asset in "${assets[@]}"; do
  if [[ ! -f "$asset" ]]; then
    echo "Missing release asset: $asset" >&2
    exit 2
  fi
done

title="${RELEASE_TITLE:-Release desktop foundation ${version}}"
notes="${RELEASE_NOTES:-Adds the product demo desktop shell, Rust-owned desktop HTTP cache, refreshed bridge/UI packages, and updated foundation manifests.}"

if gh release view "$tag" --repo "$github_repo" >/dev/null 2>&1; then
  gh release edit "$tag" --repo "$github_repo" --title "$title" --notes "$notes"
  gh release upload "$tag" --repo "$github_repo" --clobber "${assets[@]}"
else
  gh release create "$tag" \
    --repo "$github_repo" \
    --title "$title" \
    --notes "$notes" \
    "${assets[@]}"
fi

(cd "$repo_root" && pnpm release:verify -- --version "$version" --repo "$github_repo" --proxy "$proxy")
