#!/bin/bash
# =============================================================================
# ENTERPRISE: Hardcoded i18n Strings — RATCHET Pattern (CLAUDE.md SOS. N.11)
# =============================================================================
# Google-style ratchet enforcement for `defaultValue: 'literal text'` anti-pattern.
#
# RULES:
#   1. Per-file violation count can only DECREASE (ratchet down)
#   2. New files (not in baseline) = ZERO tolerance
#   3. Existing legacy violations allowed until touched
#   4. Baseline auto-updates when counts decrease
#
# BASELINE FILE: .i18n-violations-baseline.json
#
# BLOCKS commit if:
#   - A staged file has MORE violations than baseline
#   - A new (non-baseline) file has ANY violations
#
# ALLOWED:
#   t('key')
#   t('key', { defaultValue: '' })
#   t('key', { defaultValue: `${var}` })
#
# BLOCKED (when new):
#   t('key', { defaultValue: 'Προσθήκη Νέου Έργου' })
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

FILES="$@"
BASELINE_FILE=".i18n-violations-baseline.json"
VIOLATIONS=""
RATCHET_UPDATES=""
HAS_BLOCK=0

# Count violations in a file (matches hook's SSoT logic)
count_violations() {
    local file="$1"
    grep -nE "defaultValue:\s*['\"][^'\"]+['\"]" "$file" 2>/dev/null \
        | grep -vE "defaultValue:\s*['\"]{2}" \
        | grep -vcE "^\s*(//|\*|#)"
}

# Get baseline count for a file (0 if not in baseline)
get_baseline_count() {
    local file="$1"
    if [[ ! -f "$BASELINE_FILE" ]]; then
        echo "0"
        return
    fi
    # Normalize path separators (git may use forward slashes on Windows)
    local normalized="${file//\\//}"
    grep -oE "\"$normalized\":\s*[0-9]+" "$BASELINE_FILE" 2>/dev/null \
        | grep -oE "[0-9]+$" \
        | head -1 \
        || echo "0"
}

# Check if file is in baseline
is_in_baseline() {
    local file="$1"
    local normalized="${file//\\//}"
    grep -qE "\"$normalized\":" "$BASELINE_FILE" 2>/dev/null
}

for file in $FILES; do
    # Skip non-existent (deleted) files
    [[ ! -f "$file" ]] && continue

    # EXEMPT patterns
    if echo "$file" | grep -qE '(/i18n/locales/|/__tests__/|\.test\.|\.spec\.|\.d\.ts$|\.config\.|\.stories\.|^docs/|/docs/|^adrs/|/adrs/|^scripts/)'; then
        continue
    fi

    # Only .ts / .tsx
    echo "$file" | grep -qE '\.(ts|tsx)$' || continue

    CURRENT=$(count_violations "$file")
    BASELINE=$(get_baseline_count "$file")
    # Ensure numeric
    CURRENT=${CURRENT:-0}
    BASELINE=${BASELINE:-0}

    # Case 1: Zero violations, not in baseline → clean, skip
    if [[ "$CURRENT" -eq 0 && "$BASELINE" -eq 0 ]]; then
        continue
    fi

    # Case 2: Ratcheted DOWN → show update notice
    if [[ "$CURRENT" -lt "$BASELINE" ]]; then
        DIFF=$((BASELINE - CURRENT))
        RATCHET_UPDATES="${RATCHET_UPDATES}\n  ✅ ${file}: ${BASELINE} → ${CURRENT} (-${DIFF})"
        continue
    fi

    # Case 3: Same count, legacy file → allow
    if [[ "$CURRENT" -eq "$BASELINE" ]]; then
        continue
    fi

    # Case 4: INCREASED violations → BLOCK
    HAS_BLOCK=1
    DIFF=$((CURRENT - BASELINE))

    if is_in_baseline "$file"; then
        VIOLATIONS="${VIOLATIONS}\n  ❌ ${file}"
        VIOLATIONS="${VIOLATIONS}\n     Baseline: ${BASELINE} → Current: ${CURRENT} (+${DIFF} new violation(s))"
    else
        VIOLATIONS="${VIOLATIONS}\n  ❌ ${file} (NEW FILE — zero tolerance)"
        VIOLATIONS="${VIOLATIONS}\n     Found ${CURRENT} hardcoded defaultValue string(s)"
    fi

    # Show the actual violations
    MATCHES=$(grep -nE "defaultValue:\s*['\"][^'\"]+['\"]" "$file" 2>/dev/null \
        | grep -vE "defaultValue:\s*['\"]{2}" \
        | grep -vE "^\s*(//|\*|#)" || true)
    while IFS= read -r line; do
        [[ -n "$line" ]] && VIOLATIONS="${VIOLATIONS}\n        ${line}"
    done <<< "$MATCHES"
done

# Show ratchet-down progress (positive feedback)
if [[ -n "$RATCHET_UPDATES" ]]; then
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  🎯 RATCHET DOWN — Progress on i18n cleanup${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "$RATCHET_UPDATES"
    echo ""
    echo -e "${CYAN}  Run after commit: npm run i18n:baseline${NC}"
    echo -e "${CYAN}  (to persist the new lower counts into baseline file)${NC}"
    echo ""
fi

# BLOCK if new violations found
if [[ "$HAS_BLOCK" -eq 1 ]]; then
    echo ""
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  🚫 COMMIT BLOCKED — i18n Ratchet Violation${NC}"
    echo -e "${RED}  CLAUDE.md SOS. N.11 (no new hardcoded defaultValue)${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "$VIOLATIONS"
    echo ""
    echo -e "${YELLOW}  Fix options:${NC}"
    echo -e "    1) Add key to src/i18n/locales/{el,en}/*.json, then drop defaultValue"
    echo -e "    2) Use empty string: defaultValue: ''"
    echo -e "    3) Use template literal: defaultValue: \`\${var}\`"
    echo ""
    echo -e "${YELLOW}  Audit: npm run i18n:audit${NC}"
    echo ""
    exit 1
fi

exit 0
