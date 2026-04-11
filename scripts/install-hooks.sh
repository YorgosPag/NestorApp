#!/usr/bin/env bash
# =============================================================================
# Git Hooks Installer — Layer 1 of Defense in Depth (ADR-279)
# =============================================================================
# Points git at the repo-tracked hooks directory so every clone / fresh checkout
# picks up the canonical pre-commit pipeline (Windows reserved names, SSoT
# ratchet, i18n governance CHECK 3.x, audit value catalogs, etc.) without
# manual steps.
#
# This runs from package.json `prepare` (pnpm lifecycle) so that:
#   - `pnpm install` on fresh clone activates the hooks automatically
#   - CI environments that skip `prepare` (or run in shallow clones) are not
#     affected — CI has its own mirrored checks in .github/workflows/
#
# Why core.hooksPath and not copy-into-.git/hooks:
#   - Single source of truth (the tracked file IS the hook)
#   - No divergence between committed version and installed version
#   - Native git feature used by Google / Chromium / LLVM
# =============================================================================
set -e

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$REPO_ROOT" ]; then
  echo "⚠️  install-hooks.sh: not inside a git work tree, skipping"
  exit 0
fi

HOOKS_DIR="scripts/git-hooks"

if [ ! -d "$REPO_ROOT/$HOOKS_DIR" ]; then
  echo "⚠️  install-hooks.sh: $HOOKS_DIR not found, skipping"
  exit 0
fi

git -C "$REPO_ROOT" config core.hooksPath "$HOOKS_DIR"

# Ensure executable bit on every hook (needed on Unix; no-op on Windows)
chmod +x "$REPO_ROOT/$HOOKS_DIR"/* 2>/dev/null || true

echo "✅ Git hooks activated via core.hooksPath=$HOOKS_DIR"
