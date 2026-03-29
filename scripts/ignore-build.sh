#!/bin/bash

# =============================================================================
# Vercel Ignored Build Step
# =============================================================================
# Exit code 1 = proceed with build
# Exit code 0 = skip build (save build minutes!)
#
# Skips build if ONLY non-app files changed (docs, configs, markdown, etc.)
# This saves ~4 min build time per push = saves $$$ on Vercel Pro plan.
# =============================================================================

echo "🔍 Checking if build is needed..."

# Get changed files between this commit and the previous deployment
CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD 2>/dev/null)

if [ -z "$CHANGED_FILES" ]; then
  echo "⚠️ Cannot determine changed files — proceeding with build"
  exit 1
fi

echo "Changed files:"
echo "$CHANGED_FILES"

# Filter out non-code files BEFORE checking for app changes:
# - *.md files (documentation, even inside src/)
# - docs/ folders anywhere (src/subapps/*/docs/, src/md_files/)
# - ADR files, README files
CODE_CHANGES=$(echo "$CHANGED_FILES" | grep -v -E "\.(md|mdx)$" | grep -v -E "(^docs/|/docs/|/adrs/)" || true)

# Check if ANY remaining file is app-relevant
APP_CHANGES=$(echo "$CODE_CHANGES" | grep -E "^(src/|public/|packages/|next\.config|package\.json|package-lock|tsconfig|vercel\.json|\.env)" || true)

if [ -z "$APP_CHANGES" ]; then
  echo ""
  echo "⏭️ SKIP BUILD — only non-app files changed (docs, md, scripts, etc.)"
  echo "   Saving ~4 minutes of build time = saving money! 💰"
  exit 0
fi

echo ""
echo "✅ App files changed — proceeding with build"
exit 1
