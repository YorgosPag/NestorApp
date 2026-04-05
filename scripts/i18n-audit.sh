#!/bin/bash
# =============================================================================
# ENTERPRISE: i18n Violations Audit Report
# =============================================================================
# Shows current status vs. baseline + top offenders.
# Run: npm run i18n:audit
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

BASELINE_FILE=".i18n-violations-baseline.json"
TMP_RAW="/tmp/i18n-audit-raw.txt"

if [[ ! -f "$BASELINE_FILE" ]]; then
    echo -e "${RED}❌ Baseline not found: $BASELINE_FILE${NC}"
    echo -e "${YELLOW}   Run: npm run i18n:baseline${NC}"
    exit 1
fi

# Current scan
grep -rnE "defaultValue:\s*['\"][^'\"]+['\"]" src \
    --include="*.ts" --include="*.tsx" \
    --exclude-dir="__tests__" --exclude-dir="locales" 2>/dev/null \
    | grep -vE "defaultValue:\s*['\"]{2}" \
    | grep -vE "\.test\.|\.spec\.|\.config\.|\.stories\." \
    | awk -F: '{print $1}' \
    | sort | uniq -c | sort -rn > "$TMP_RAW"

CURRENT_FILES=$(wc -l < "$TMP_RAW" | tr -d ' ')
CURRENT_VIOLATIONS=$(awk '{sum+=$1} END {print sum+0}' "$TMP_RAW")

BASELINE_VIOLATIONS=$(grep -oE '"totalViolations":\s*[0-9]+' "$BASELINE_FILE" | grep -oE '[0-9]+' | head -1)
BASELINE_FILES_COUNT=$(grep -oE '"totalFiles":\s*[0-9]+' "$BASELINE_FILE" | grep -oE '[0-9]+' | head -1)
BASELINE_DATE=$(grep -oE '"generated":\s*"[^"]+"' "$BASELINE_FILE" | sed 's/.*"\([^"]*\)"$/\1/')

DIFF=$((BASELINE_VIOLATIONS - CURRENT_VIOLATIONS))
FILES_DIFF=$((BASELINE_FILES_COUNT - CURRENT_FILES))

echo ""
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  📊 i18n Hardcoded defaultValue — Audit Report${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}Baseline${NC} (${BASELINE_DATE}):"
echo -e "    Files:      ${BASELINE_FILES_COUNT}"
echo -e "    Violations: ${BASELINE_VIOLATIONS}"
echo ""
echo -e "  ${BOLD}Current:${NC}"
echo -e "    Files:      ${CURRENT_FILES}"
echo -e "    Violations: ${CURRENT_VIOLATIONS}"
echo ""

if [[ $DIFF -gt 0 ]]; then
    echo -e "  ${GREEN}${BOLD}✅ Progress: -${DIFF} violations, -${FILES_DIFF} files${NC}"
    echo -e "  ${CYAN}   Run: npm run i18n:baseline (to update baseline)${NC}"
elif [[ $DIFF -lt 0 ]]; then
    echo -e "  ${RED}${BOLD}⚠️  Regression: +$((0 - DIFF)) violations (baseline exceeded!)${NC}"
else
    echo -e "  ${YELLOW}${BOLD}= No change since baseline${NC}"
fi

echo ""
echo -e "${BOLD}Top 10 offenders (current):${NC}"
echo ""
head -10 "$TMP_RAW" | while read count file; do
    printf "  %4d  %s\n" "$count" "$file"
done
echo ""

# Percentage to zero
if [[ $BASELINE_VIOLATIONS -gt 0 ]]; then
    PERCENT=$(( (DIFF * 100) / BASELINE_VIOLATIONS ))
    echo -e "${CYAN}Progress to zero: ${PERCENT}% (${DIFF}/${BASELINE_VIOLATIONS})${NC}"
    echo ""
fi

rm -f "$TMP_RAW"
