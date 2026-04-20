#!/bin/bash
# =============================================================================
# ENTERPRISE: Regenerate UI Hardcoded Strings Baseline (Ratchet Pattern)
# =============================================================================
# Scans all .ts/.tsx files in src/ and regenerates .i18n-ui-strings-baseline.json
#
# Run AFTER successful cleanup commits to click the ratchet down:
#   npm run ui-strings:baseline
# =============================================================================

set -e

BASELINE_FILE=".i18n-ui-strings-baseline.json"
TMP_RAW="/tmp/ui-strings-violations-raw.txt"

echo "🔍 Scanning repo for UI hardcoded Greek strings..."
echo "   Patterns: JSX text, attributes, errors/alerts, toasts"

# Combined scan: all 4 patterns, exclude exempt dirs, de-dup per (file,line)
{
    grep -rnP ">[^<>{}]*\p{Greek}[^<>{}]*<" src \
        --include="*.tsx" 2>/dev/null
    grep -rnP "(placeholder|title|aria-label|alt|label)=\"[^\"]*\p{Greek}[^\"]*\"" src \
        --include="*.tsx" 2>/dev/null
    grep -rnP "(throw new Error|alert|confirm|prompt)\(\s*[\"'\`][^\"'\`]*\p{Greek}" src \
        --include="*.ts" --include="*.tsx" 2>/dev/null
    grep -rnP "toast\.[a-z]+\(\s*[\"'\`][^\"'\`]*\p{Greek}" src \
        --include="*.ts" --include="*.tsx" 2>/dev/null
} \
    | grep -vE "/(i18n/locales|__tests__|data|constants)/" \
    | grep -vE "\.test\.|\.spec\.|\.stories\.|\.config\.|\.qa\.|\.d\.ts|\.mock\.|\.original\." \
    | grep -vE -- "-definitions\.|-schema\." \
    | grep -vE "^[^:]+:[0-9]+:\s*(//|\*|#)" \
    | grep -vP ":\d+:\s*\{/\*" \
    | awk -F: '{print $1":"$2}' \
    | sort -u \
    | awk -F: '{print $1}' \
    | sort | uniq -c | sort -rn > "$TMP_RAW"

TOTAL_FILES=$(wc -l < "$TMP_RAW" | tr -d ' ')
TOTAL_VIOLATIONS=$(awk '{sum+=$1} END {print sum+0}' "$TMP_RAW")

echo "  Files with violations: $TOTAL_FILES"
echo "  Total violations:      $TOTAL_VIOLATIONS"

{
    echo "{"
    echo "  \"_meta\": {"
    echo "    \"description\": \"i18n hardcoded UI strings baseline (JSX text, attrs, errors, toasts)\","
    echo "    \"generated\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
    echo "    \"totalViolations\": ${TOTAL_VIOLATIONS},"
    echo "    \"totalFiles\": ${TOTAL_FILES},"
    echo "    \"rule\": \"Counts can only decrease. New files = zero tolerance.\","
    echo "    \"patterns\": [\"JSX text\", \"attributes\", \"throw/alert/confirm\", \"toast calls\"]"
    echo "  },"
    echo "  \"files\": {"
    first=1
    while read count file; do
        if [ $first -eq 1 ]; then first=0; else echo ","; fi
        file="${file//\\//}"
        printf "    \"%s\": %s" "$file" "$count"
    done < "$TMP_RAW"
    echo ""
    echo "  }"
    echo "}"
} > "$BASELINE_FILE"

rm -f "$TMP_RAW"

echo "✅ Baseline written: $BASELINE_FILE"
