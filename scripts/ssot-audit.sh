#!/bin/bash
# =============================================================================
# ENTERPRISE: SSoT Violations Audit Report
# =============================================================================
# Shows current status vs. baseline + top offenders + module breakdown.
# Run: npm run ssot:audit
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

REGISTRY_FILE=".ssot-registry.json"
BASELINE_FILE=".ssot-violations-baseline.json"
FLAT_FILE=".ssot-registry-flat.txt"
TMP_COUNTS="/tmp/ssot-audit-counts.txt"
TMP_MODULE="/tmp/ssot-audit-module.txt"

if [[ ! -f "$BASELINE_FILE" ]]; then
    echo -e "${RED}❌ Baseline not found: $BASELINE_FILE${NC}"
    echo -e "${YELLOW}   Run: npm run ssot:baseline${NC}"
    exit 1
fi

if [[ ! -f "$FLAT_FILE" ]]; then
    echo -e "${YELLOW}⚠️  Flat registry not found. Regenerating...${NC}"
    bash scripts/generate-ssot-baseline.sh
    exit 0
fi

# ── Parse flat file ──
EXEMPT_REGEX=""
declare -a MODULE_NAMES=()
declare -a MODULE_PATTERNS=()
declare -a MODULE_ALLOWLISTS=()

_current_module=""
_current_patterns=""
_current_allowlist=""

flush_module() {
    if [[ -n "$_current_module" && -n "$_current_patterns" ]]; then
        MODULE_NAMES+=("$_current_module")
        MODULE_PATTERNS+=("$_current_patterns")
        MODULE_ALLOWLISTS+=("$_current_allowlist")
    fi
}

while IFS= read -r line; do
    case "$line" in
        EXEMPT:*) EXEMPT_REGEX="${line#EXEMPT:}" ;;
        MODULE:*)
            flush_module
            _current_module="${line#MODULE:}"
            _current_patterns=""
            _current_allowlist=""
            ;;
        PATTERN:*)
            if [[ -n "$_current_patterns" ]]; then
                _current_patterns="${_current_patterns}|${line#PATTERN:}"
            else
                _current_patterns="${line#PATTERN:}"
            fi
            ;;
        ALLOW:*)
            if [[ -n "$_current_allowlist" ]]; then
                _current_allowlist="${_current_allowlist}|${line#ALLOW:}"
            else
                _current_allowlist="${line#ALLOW:}"
            fi
            ;;
    esac
done < "$FLAT_FILE"
flush_module

# ── Live scan per module ──
> "$TMP_COUNTS"
> "$TMP_MODULE"

for i in "${!MODULE_NAMES[@]}"; do
    module="${MODULE_NAMES[$i]}"
    patterns="${MODULE_PATTERNS[$i]}"
    allowlist="${MODULE_ALLOWLISTS[$i]}"
    module_count=0

    while IFS=: read -r filepath rest; do
        filepath="${filepath//\\//}"

        # Skip exempt
        if [[ -n "$EXEMPT_REGEX" ]] && echo "$filepath" | grep -qE "$EXEMPT_REGEX"; then
            continue
        fi

        # Skip allowlisted
        if [[ -n "$allowlist" ]]; then
            skip=0
            IFS='|' read -ra ALLOW_ENTRIES <<< "$allowlist"
            for allowed in "${ALLOW_ENTRIES[@]}"; do
                if [[ "$filepath" == "$allowed" || "$filepath" == "$allowed"* ]]; then
                    skip=1
                    break
                fi
            done
            [[ $skip -eq 1 ]] && continue
        fi

        # Skip comments
        if echo "$rest" | grep -qE "^\s*(//|\*|#)"; then
            continue
        fi

        echo "$filepath" >> "$TMP_COUNTS"
        module_count=$((module_count + 1))
    done < <(grep -rnE "$patterns" src --include="*.ts" --include="*.tsx" 2>/dev/null || true)

    echo "$module_count $module" >> "$TMP_MODULE"
done

# ── Aggregate ──
sort "$TMP_COUNTS" | uniq -c | sort -rn > "${TMP_COUNTS}.agg"

CURRENT_FILES=$(wc -l < "${TMP_COUNTS}.agg" | tr -d ' ')
CURRENT_VIOLATIONS=$(awk '{sum+=$1} END {print sum+0}' "${TMP_COUNTS}.agg")

BASELINE_VIOLATIONS=$(grep -oE '"totalViolations":\s*[0-9]+' "$BASELINE_FILE" | grep -oE '[0-9]+' | head -1)
BASELINE_FILES_COUNT=$(grep -oE '"totalFiles":\s*[0-9]+' "$BASELINE_FILE" | grep -oE '[0-9]+' | head -1)
BASELINE_DATE=$(grep -oE '"generated":\s*"[^"]+"' "$BASELINE_FILE" | sed 's/.*"\([^"]*\)"$/\1/')

DIFF=$((BASELINE_VIOLATIONS - CURRENT_VIOLATIONS))
FILES_DIFF=$((BASELINE_FILES_COUNT - CURRENT_FILES))

# ── Report ──
echo ""
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  📊 SSoT Centralization — Audit Report${NC}"
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
    echo -e "  ${CYAN}   Run: npm run ssot:baseline (to update baseline)${NC}"
elif [[ $DIFF -lt 0 ]]; then
    echo -e "  ${RED}${BOLD}⚠️  Regression: +$((0 - DIFF)) violations (baseline exceeded!)${NC}"
else
    echo -e "  ${YELLOW}${BOLD}═ No change since baseline${NC}"
fi

echo ""
echo -e "${BOLD}Module breakdown (current violations):${NC}"
echo ""
sort -rn "$TMP_MODULE" | while read count module; do
    printf "  %4d  %s\n" "$count" "$module"
done

echo ""
echo -e "${BOLD}Top 10 offenders (current):${NC}"
echo ""
head -10 "${TMP_COUNTS}.agg" | while read count file; do
    printf "  %4d  %s\n" "$count" "$file"
done
echo ""

# Percentage to zero
if [[ $BASELINE_VIOLATIONS -gt 0 ]]; then
    PERCENT=$(( (DIFF * 100) / BASELINE_VIOLATIONS ))
    echo -e "${CYAN}Progress to zero: ${PERCENT}% (${DIFF}/${BASELINE_VIOLATIONS})${NC}"
    echo ""
fi

rm -f "$TMP_COUNTS" "${TMP_COUNTS}.agg" "$TMP_MODULE"
