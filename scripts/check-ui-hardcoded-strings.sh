#!/bin/bash
# =============================================================================
# ENTERPRISE: Hardcoded UI Strings — RATCHET Pattern (CLAUDE.md SOS. N.11 ext.)
# =============================================================================
# Detects hardcoded Greek strings in user-facing code:
#   1. JSX text content:     <span>Αποθήκευση</span>
#   2. Attributes:           placeholder="Αναζήτηση..." | title="..." | aria-label="..."
#   3. Error/alert/confirm:  throw new Error('Λάθος') | alert('...') | confirm('...')
#   4. Toasts:               toast.success('Επιτυχία!')
#
# RATCHET RULES (same as check-hardcoded-strings.sh):
#   1. Per-file violation count can only DECREASE
#   2. New files = ZERO tolerance
#   3. Baseline: .i18n-ui-strings-baseline.json
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

FILES="$@"
BASELINE_FILE=".i18n-ui-strings-baseline.json"
VIOLATIONS=""
RATCHET_UPDATES=""
HAS_BLOCK=0

# Count hardcoded UI violations in a file (4 patterns, de-duplicated by line)
count_ui_violations() {
    local file="$1"
    {
        # Pattern 1: JSX text with Greek
        grep -nP ">[^<>{}]*\p{Greek}[^<>{}]*<" "$file" 2>/dev/null
        # Pattern 2: Attributes with Greek
        grep -nP "(placeholder|title|aria-label|alt|label)=\"[^\"]*\p{Greek}[^\"]*\"" "$file" 2>/dev/null
        # Pattern 3: throw/alert/confirm/prompt with Greek
        grep -nP "(throw new Error|alert|confirm|prompt)\(\s*[\"'\`][^\"'\`]*\p{Greek}" "$file" 2>/dev/null
        # Pattern 4: toast calls with Greek
        grep -nP "toast\.[a-z]+\(\s*[\"'\`][^\"'\`]*\p{Greek}" "$file" 2>/dev/null
    } | grep -vE "^\s*[0-9]+:\s*(//|\*|#)" | awk -F: '{print $1}' | sort -u | wc -l | tr -d ' '
}

# Get baseline count for a file (0 if not in baseline)
get_baseline_count() {
    local file="$1"
    if [[ ! -f "$BASELINE_FILE" ]]; then
        echo "0"
        return
    fi
    local normalized="${file//\\//}"
    grep -oE "\"$normalized\":\s*[0-9]+" "$BASELINE_FILE" 2>/dev/null \
        | grep -oE "[0-9]+$" \
        | head -1 \
        || echo "0"
}

is_in_baseline() {
    local file="$1"
    local normalized="${file//\\//}"
    grep -qE "\"$normalized\":" "$BASELINE_FILE" 2>/dev/null
}

show_violations() {
    local file="$1"
    {
        grep -nP ">[^<>{}]*\p{Greek}[^<>{}]*<" "$file" 2>/dev/null
        grep -nP "(placeholder|title|aria-label|alt|label)=\"[^\"]*\p{Greek}[^\"]*\"" "$file" 2>/dev/null
        grep -nP "(throw new Error|alert|confirm|prompt)\(\s*[\"'\`][^\"'\`]*\p{Greek}" "$file" 2>/dev/null
        grep -nP "toast\.[a-z]+\(\s*[\"'\`][^\"'\`]*\p{Greek}" "$file" 2>/dev/null
    } | grep -vE "^\s*[0-9]+:\s*(//|\*|#)" | sort -u -t: -k1,1n | head -5
}

for file in $FILES; do
    [[ ! -f "$file" ]] && continue

    # EXEMPT patterns (same as defaultValue hook + extras)
    if echo "$file" | grep -qE '(/i18n/locales/|/__tests__/|\.test\.|\.spec\.|\.d\.ts$|\.config\.|\.stories\.|\.qa\.|^docs/|/docs/|^adrs/|/adrs/|^scripts/|/scripts/|/data/|/constants/|-definitions\.|-schema\.|\.mock\.)'; then
        continue
    fi

    # Only .ts / .tsx
    echo "$file" | grep -qE '\.(ts|tsx)$' || continue

    CURRENT=$(count_ui_violations "$file")
    BASELINE=$(get_baseline_count "$file")
    CURRENT=${CURRENT:-0}
    BASELINE=${BASELINE:-0}

    if [[ "$CURRENT" -eq 0 && "$BASELINE" -eq 0 ]]; then
        continue
    fi

    if [[ "$CURRENT" -lt "$BASELINE" ]]; then
        DIFF=$((BASELINE - CURRENT))
        RATCHET_UPDATES="${RATCHET_UPDATES}\n  ✅ ${file}: ${BASELINE} → ${CURRENT} (-${DIFF})"
        continue
    fi

    if [[ "$CURRENT" -eq "$BASELINE" ]]; then
        continue
    fi

    # INCREASED violations → BLOCK
    HAS_BLOCK=1
    DIFF=$((CURRENT - BASELINE))

    if is_in_baseline "$file"; then
        VIOLATIONS="${VIOLATIONS}\n  ❌ ${file}"
        VIOLATIONS="${VIOLATIONS}\n     Baseline: ${BASELINE} → Current: ${CURRENT} (+${DIFF} new violation(s))"
    else
        VIOLATIONS="${VIOLATIONS}\n  ❌ ${file} (NEW FILE — zero tolerance)"
        VIOLATIONS="${VIOLATIONS}\n     Found ${CURRENT} hardcoded UI string(s) on lines:"
    fi

    MATCHES=$(show_violations "$file")
    while IFS= read -r line; do
        [[ -n "$line" ]] && VIOLATIONS="${VIOLATIONS}\n        ${line}"
    done <<< "$MATCHES"
done

if [[ -n "$RATCHET_UPDATES" ]]; then
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  🎯 RATCHET DOWN — UI hardcoded strings cleanup${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "$RATCHET_UPDATES"
    echo ""
    echo -e "${CYAN}  Run after commit: npm run ui-strings:baseline${NC}"
    echo ""
fi

if [[ "$HAS_BLOCK" -eq 1 ]]; then
    echo ""
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  🚫 COMMIT BLOCKED — UI Hardcoded Strings Ratchet Violation${NC}"
    echo -e "${RED}  CLAUDE.md SOS. N.11 (no new hardcoded Greek in JSX/attrs/errors)${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "$VIOLATIONS"
    echo ""
    echo -e "${YELLOW}  Detected patterns:${NC}"
    echo -e "    1) JSX text:       <span>Αποθήκευση</span>     → use {t('key')}"
    echo -e "    2) Attribute:      placeholder=\"Αναζήτηση\"    → use t('key')"
    echo -e "    3) Error/alert:    throw new Error('Λάθος')   → use t('errors.key')"
    echo -e "    4) Toast:          toast.success('Επιτυχία')  → use t('key')"
    echo ""
    echo -e "${YELLOW}  Audit: npm run ui-strings:audit${NC}"
    echo ""
    exit 1
fi

exit 0
