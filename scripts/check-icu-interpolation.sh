#!/bin/bash
# =============================================================================
# ENTERPRISE: ICU Interpolation — RATCHET Pattern
# =============================================================================
# Blocks {{variable}} (i18next default) in locale files.
# Project uses i18next-icu plugin → all variables must be {variable} (single braces).
#
# RULES:
#   1. Per-file violation count can only DECREASE (ratchet down)
#   2. New files (not in baseline) = ZERO tolerance
#   3. Existing legacy violations allowed until touched
#
# BASELINE FILE: .icu-violations-baseline.json
#
# BLOCKS commit if:
#   - A staged locale file has MORE {{var}} than baseline
#   - A new (non-baseline) locale file has ANY {{var}}
#
# PATTERN: {{word}} — matches i18next double-brace interpolation
# VALID:   {word}   — ICU single-brace interpolation
# VALID:   {count, plural, =1 {one} other {{count} items}} — ICU plural (nested braces)
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FILES="$@"
BASELINE_FILE=".icu-violations-baseline.json"
HAS_BLOCK=0
RATCHET_UPDATES=""

# Count {{variable}} violations in a JSON locale file
count_violations() {
    local file="$1"
    local result
    result=$(grep -coE '\{\{[a-zA-Z_]+\}\}' "$file" 2>/dev/null || echo "0")
    # Trim whitespace/newlines (Windows compat)
    echo "$result" | tr -d '[:space:]'
}

# Get baseline count for a file
get_baseline_count() {
    local file="$1"
    if [[ ! -f "$BASELINE_FILE" ]]; then
        echo "0"
        return
    fi
    local normalized="${file//\\//}"
    local result
    result=$(grep -oE "\"$normalized\":\s*[0-9]+" "$BASELINE_FILE" 2>/dev/null \
        | grep -oE "[0-9]+$" \
        | head -1 \
        || echo "0")
    echo "$result" | tr -d '[:space:]'
}

for file in $FILES; do
    [[ ! -f "$file" ]] && continue

    # Only locale JSON files
    echo "$file" | grep -qE 'src/i18n/locales/.*\.json$' || continue

    # Skip pseudo locale (generated)
    echo "$file" | grep -qE '/pseudo/' && continue

    CURRENT=$(count_violations "$file")
    BASELINE=$(get_baseline_count "$file")
    CURRENT=${CURRENT:-0}
    BASELINE=${BASELINE:-0}

    # Zero violations → skip
    if [[ "$CURRENT" -eq 0 && "$BASELINE" -eq 0 ]]; then
        continue
    fi

    # Ratcheted DOWN → good
    if [[ "$CURRENT" -lt "$BASELINE" ]]; then
        DIFF=$((BASELINE - CURRENT))
        RATCHET_UPDATES="${RATCHET_UPDATES}\n  ✅ ${file}: ${BASELINE} → ${CURRENT} (-${DIFF})"
        continue
    fi

    # Same count → allow
    if [[ "$CURRENT" -eq "$BASELINE" ]]; then
        continue
    fi

    # INCREASED or NEW → BLOCK
    if [[ "$BASELINE" -eq 0 ]]; then
        echo -e "${RED}  🚫 NEW FILE with {{var}}: $file ($CURRENT violations)${NC}"
    else
        DIFF=$((CURRENT - BASELINE))
        echo -e "${RED}  🚫 INCREASED {{var}}: $file ($BASELINE → $CURRENT, +$DIFF)${NC}"
    fi
    HAS_BLOCK=1
done

if [[ -n "$RATCHET_UPDATES" ]]; then
    echo -e "${GREEN}  📉 ICU ratchet improvements:${RATCHET_UPDATES}${NC}"
fi

if [[ $HAS_BLOCK -eq 1 ]]; then
    echo -e "${RED}  ❌ ICU interpolation check FAILED — use {var} not {{var}} (i18next-icu)${NC}"
    exit 1
fi

echo -e "${GREEN}  ✅ ICU interpolation: no new {{var}} violations${NC}"
exit 0
