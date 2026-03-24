#!/bin/bash
# =============================================================================
# 🏢 ENTERPRISE PROJECT RULES VALIDATOR
# =============================================================================
#
# Custom checks that ESLint cannot catch. Runs on staged files during pre-commit.
#
# Rules enforced:
# 1. No hardcoded storage paths (must use LEGACY_STORAGE_PATHS or buildStoragePath)
# 2. No inline crypto.randomUUID() for IDs (must use enterprise-id.service)
# 3. Purge routes must include Storage deletion
# 4. No addDoc() (must use setDoc with enterprise IDs)
# 5. No @ts-ignore (CLAUDE.md rule)
#
# Usage: bash scripts/validate-project-rules.sh [file1.ts file2.tsx ...]
# Exit: 0 = pass, 1 = violations found
# =============================================================================

RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

VIOLATIONS=0
FILES="$@"

# If no files specified, check all staged .ts/.tsx files
if [[ -z "$FILES" ]]; then
  FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$' | grep -v node_modules | grep -v '.d.ts')
fi

if [[ -z "$FILES" ]]; then
  exit 0
fi

# =============================================================================
# RULE 1: No hardcoded storage path strings
# Allowed: LEGACY_STORAGE_PATHS.*, buildStoragePath(), STORAGE_PATH_SEGMENTS.*
# Banned: Direct strings like 'floor-plans/', 'dxf-scenes/', 'contacts/photos'
# =============================================================================
check_hardcoded_storage_paths() {
  local file="$1"

  # Skip config files that DEFINE the paths (they're the SSoT)
  if echo "$file" | grep -qE "(domain-constants|storage-path|path-sanitizer|firestore-collections)"; then
    return
  fi

  # Skip test files, migration scripts, ADRs
  if echo "$file" | grep -qE "(\.test\.|\.spec\.|migrate-|adrs/|\.md$)"; then
    return
  fi

  # Check for hardcoded legacy storage paths (outside of imports/comments)
  local patterns=(
    "'floor-plans/"
    "'contacts/photos"
    "'companies/logos"
    "'dxf-scenes/"
    "'attendance/"
    "\"floor-plans/"
    "\"contacts/photos"
    "\"companies/logos"
    "\"dxf-scenes/"
  )

  for pattern in "${patterns[@]}"; do
    local matches
    # Filter out: // comments, * block comments, lines mentioning LEGACY_STORAGE_PATHS, JSDoc examples
    matches=$(grep -n "$pattern" "$file" 2>/dev/null | grep -vE "^\s*[0-9]+:\s*(//|\*|/\*)" | grep -v "LEGACY_STORAGE_PATHS")
    if [[ -n "$matches" ]]; then
      echo -e "${RED}  ❌ RULE 1: Hardcoded storage path in $file${NC}"
      echo "     Use LEGACY_STORAGE_PATHS.* or buildStoragePath() instead"
      echo "$matches" | head -3 | sed 's/^/     /'
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  done
}

# =============================================================================
# RULE 2: No inline crypto.randomUUID() for document IDs
# Must use enterprise-id.service.ts generators
# =============================================================================
check_inline_uuid() {
  local file="$1"

  # Skip the enterprise-id.service itself
  if echo "$file" | grep -qE "enterprise-id\.service"; then
    return
  fi

  # Skip test files
  if echo "$file" | grep -qE "(\.test\.|\.spec\.)"; then
    return
  fi

  local matches
  matches=$(grep -n "crypto\.randomUUID\(\)" "$file" 2>/dev/null | grep -v "^\s*//" | grep -v "^\s*\*")
  if [[ -n "$matches" ]]; then
    echo -e "${RED}  ❌ RULE 2: Inline crypto.randomUUID() in $file${NC}"
    echo "     Use generators from @/services/enterprise-id.service instead (CLAUDE.md N.6)"
    echo "$matches" | head -3 | sed 's/^/     /'
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
}

# =============================================================================
# RULE 3: No addDoc() — must use setDoc() with enterprise IDs
# =============================================================================
check_add_doc() {
  local file="$1"

  # Skip test files and migration scripts
  if echo "$file" | grep -qE "(\.test\.|\.spec\.|migrate-)"; then
    return
  fi

  local matches
  matches=$(grep -n "addDoc(" "$file" 2>/dev/null | grep -v "^\s*//" | grep -v "^\s*\*" | grep -v "// LEGACY")
  if [[ -n "$matches" ]]; then
    echo -e "${RED}  ❌ RULE 3: addDoc() found in $file${NC}"
    echo "     Use setDoc() with enterprise ID generator instead (CLAUDE.md N.6)"
    echo "$matches" | head -3 | sed 's/^/     /'
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
}

# =============================================================================
# RULE 4: No @ts-ignore
# =============================================================================
check_ts_ignore() {
  local file="$1"

  local matches
  # Match actual @ts-ignore directives (// @ts-ignore), not mentions in doc comments
  matches=$(grep -nE "^\s*//\s*@ts-ignore" "$file" 2>/dev/null | head -3)
  if [[ -n "$matches" ]]; then
    echo -e "${RED}  ❌ RULE 4: @ts-ignore found in $file${NC}"
    echo "     Fix the TypeScript error properly instead of suppressing it"
    echo "$matches" | sed 's/^/     /'
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
}

# =============================================================================
# RULE 5: Purge/delete routes must include Storage deletion
# Only checks files that contain 'lifecycleState.*purged'
# =============================================================================
check_purge_has_storage_delete() {
  local file="$1"

  # Only check files that do purging
  if ! grep -q "lifecycleState.*purged\|lifecycleState.*'purged'" "$file" 2>/dev/null; then
    return
  fi

  # Must also contain storage deletion
  if ! grep -qE "\.delete\(\)|deleteObject|bucket\.file" "$file" 2>/dev/null; then
    echo -e "${RED}  ❌ RULE 5: Purge without Storage deletion in $file${NC}"
    echo "     When marking files as purged, also delete from Firebase Storage"
    echo "     Use: bucket.file(storagePath).delete()"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
}

# =============================================================================
# RUN ALL CHECKS
# =============================================================================

for file in $FILES; do
  if [[ -f "$file" ]]; then
    check_hardcoded_storage_paths "$file"
    check_inline_uuid "$file"
    check_add_doc "$file"
    check_ts_ignore "$file"
    check_purge_has_storage_delete "$file"
  fi
done

if [[ $VIOLATIONS -gt 0 ]]; then
  echo ""
  echo -e "${YELLOW}Found $VIOLATIONS project rule violation(s). Fix before committing.${NC}"
  exit 1
fi

exit 0
