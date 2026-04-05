#!/bin/bash
# =============================================================================
# ENTERPRISE: Hardcoded i18n Strings Detector (CLAUDE.md SOS. N.11)
# =============================================================================
# Scans staged .ts/.tsx files for the `defaultValue: 'literal text'`
# anti-pattern in i18n calls — violates SSoT because the fallback string
# lives in the code instead of the locale JSON files.
#
# BLOCKS commit if violations are found.
#
# ALLOWED:
#   t('key')
#   t('key', { defaultValue: '' })       ← empty string OK
#   t('key', { defaultValue: `${var}` }) ← pure template literal OK
#
# BLOCKED:
#   t('key', { defaultValue: 'Προσθήκη Νέου Έργου' })
#   t('key', { defaultValue: "Add New Project" })
#   t('key', { defaultValue: 'anything non-empty' })
#
# EXEMPT files (not scanned):
#   - src/i18n/locales/**  (locale JSON files)
#   - **/__tests__/**, *.test.*, *.spec.*
#   - *.d.ts, *.config.*, *.stories.*
#   - docs/, scripts/, adrs/
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FILES="$@"
VIOLATIONS=""

for file in $FILES; do
    # Skip non-existent files (e.g. deleted in this commit)
    if [[ ! -f "$file" ]]; then
        continue
    fi

    # EXEMPT patterns — skip scanning
    if echo "$file" | grep -qE '(/i18n/locales/|/__tests__/|\.test\.|\.spec\.|\.d\.ts$|\.config\.|\.stories\.|^docs/|/docs/|^adrs/|/adrs/|^scripts/)'; then
        continue
    fi

    # Only scan .ts / .tsx files
    if ! echo "$file" | grep -qE '\.(ts|tsx)$'; then
        continue
    fi

    # Detect: defaultValue: '<non-empty text>' or defaultValue: "<non-empty text>"
    # Allow empty string '' or "" (explicitly safe fallback)
    # Allow template literals ${...} (dynamic fallback)
    MATCHES=$(grep -nE "defaultValue:\s*['\"][^'\"]+['\"]" "$file" 2>/dev/null \
        | grep -vE "defaultValue:\s*['\"]{2}" \
        | grep -vE "^\s*(//|\*|#)" \
        || true)

    if [[ -n "$MATCHES" ]]; then
        VIOLATIONS="${VIOLATIONS}\n  ❌ ${file}:\n"
        while IFS= read -r line; do
            VIOLATIONS="${VIOLATIONS}       ${line}\n"
        done <<< "$MATCHES"
    fi
done

if [[ -n "$VIOLATIONS" ]]; then
    echo ""
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  🚫 COMMIT BLOCKED — Hardcoded i18n defaultValue strings${NC}"
    echo -e "${RED}  CLAUDE.md SOS. N.11 violation${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "$VIOLATIONS"
    echo -e "${YELLOW}  Fix: Add the key to src/i18n/locales/{el,en}/*.json${NC}"
    echo -e "${YELLOW}        then drop the defaultValue (or use defaultValue: '').${NC}"
    echo ""
    echo -e "${YELLOW}  Example BEFORE (blocked):${NC}"
    echo -e "       t('myKey', { defaultValue: 'Προσθήκη Νέου Έργου' })"
    echo -e "${YELLOW}  Example AFTER (ok):${NC}"
    echo -e "       // 1) add {\"myKey\": \"Προσθήκη Νέου Έργου\"} to el/*.json"
    echo -e "       // 2) add {\"myKey\": \"Add New Project\"} to en/*.json"
    echo -e "       t('myKey')"
    echo ""
    exit 1
fi

exit 0
