#!/bin/bash
# =============================================================================
# CHECK 3.10: Firestore queries must include companyId filter
# =============================================================================
# Detects Firestore query() calls with where() but without companyId filter.
# This ensures tenant isolation — without companyId, Firestore rules deny access.
#
# RATCHET MODE:
#   - New files with violations → BLOCK
#   - Existing files: violations can only decrease vs baseline
#   - Baseline: .firestore-companyid-baseline.json
#
# Usage: bash scripts/check-firestore-companyid.sh [file1 file2 ...]
#   If no files given, scans all src/**/*.{ts,tsx}
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BASELINE_FILE=".firestore-companyid-baseline.json"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Files to check: either passed as args or all ts/tsx in src/
if [[ $# -gt 0 ]]; then
  INPUT_FILES="$@"
else
  INPUT_FILES=$(find "$PROJECT_ROOT/src" -type f \( -name "*.ts" -o -name "*.tsx" \) \
    ! -path "*/__tests__/*" \
    ! -path "*/node_modules/*" \
    ! -name "*.test.*" \
    ! -name "*.spec.*" \
    ! -name "*.d.ts" \
    ! -path "*/i18n/locales/*")
fi

# Count violations per file
declare -A FILE_VIOLATIONS
TOTAL_VIOLATIONS=0

for file in $INPUT_FILES; do
  # Skip files that don't use Firestore queries
  if ! grep -q "query(" "$file" 2>/dev/null; then
    continue
  fi
  if ! grep -q "where(" "$file" 2>/dev/null; then
    continue
  fi

  # Find query() calls and check if they have companyId in the next 12 lines
  count=0
  while IFS= read -r match; do
    lineno=$(echo "$match" | cut -d: -f1)
    # Get 12-line block from query( start
    block=$(sed -n "${lineno},$((lineno+11))p" "$file" 2>/dev/null)
    if echo "$block" | grep -q "where(" && ! echo "$block" | grep -q "companyId"; then
      count=$((count + 1))
    fi
  done < <(grep -n "query(" "$file" 2>/dev/null)

  if [[ $count -gt 0 ]]; then
    # Normalize: keep only src/... path
    normalized=$(echo "$file" | sed 's|\\|/|g' | sed 's|.*/\(src/\)|\1|')
    FILE_VIOLATIONS["$normalized"]=$count
    TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + count))
  fi
done

# If no violations found, exit clean
if [[ $TOTAL_VIOLATIONS -eq 0 ]]; then
  exit 0
fi

# Load baseline
BASELINE_PATH="$PROJECT_ROOT/$BASELINE_FILE"
if [[ ! -f "$BASELINE_PATH" ]]; then
  # No baseline = all violations are new = BLOCK
  echo -e "${RED}🚫 Firestore companyId Check: No baseline file found${NC}"
  echo -e "${RED}   Run: npm run firestore:audit to generate baseline${NC}"
  exit 1
fi

# Check ratchet: compare each file against baseline
BLOCKED=0
BLOCK_MESSAGES=""

for normalized in "${!FILE_VIOLATIONS[@]}"; do
  current=${FILE_VIOLATIONS[$normalized]}

  # Get baseline count: parse JSON with grep
  # Escape slashes for grep
  escaped=$(echo "$normalized" | sed 's|/|\\/|g')
  baseline_count=$(grep "\"${normalized}\"" "$BASELINE_PATH" 2>/dev/null | grep -o '[0-9]*' | tail -1)
  if [[ -z "$baseline_count" ]]; then
    baseline_count=0
  fi

  if [[ $baseline_count -eq 0 && $current -gt 0 ]]; then
    # New file with violations → BLOCK
    BLOCK_MESSAGES="${BLOCK_MESSAGES}  ❌ NEW: ${normalized} has ${current} query(ies) without companyId\n"
    BLOCKED=1
  elif [[ $current -gt $baseline_count ]]; then
    # Existing file with MORE violations → BLOCK
    BLOCK_MESSAGES="${BLOCK_MESSAGES}  ❌ REGRESSION: ${normalized}: ${baseline_count} → ${current} (+$((current - baseline_count)))\n"
    BLOCKED=1
  fi
done

if [[ $BLOCKED -eq 1 ]]; then
  echo -e "${RED}🚫 Firestore companyId Check FAILED${NC}"
  echo -e "${RED}   Queries without companyId filter cause permission-denied errors!${NC}"
  echo ""
  echo -e "$BLOCK_MESSAGES"
  echo ""
  echo -e "${YELLOW}Fix: Add where('companyId', '==', companyId) to every Firestore query()${NC}"
  echo -e "${YELLOW}Baseline: $BASELINE_FILE${NC}"
  exit 1
fi

exit 0
