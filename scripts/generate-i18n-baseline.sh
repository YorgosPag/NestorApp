#!/bin/bash
# =============================================================================
# ENTERPRISE: Regenerate i18n Violations Baseline (Ratchet Pattern)
# =============================================================================
# Scans the entire repo and regenerates .i18n-violations-baseline.json
#
# Run AFTER successful commits that reduce violation counts:
#   npm run i18n:baseline
#
# This ensures the ratchet "clicks down" permanently.
# The hook will then enforce the new (lower) numbers as the ceiling.
# =============================================================================

set -e

BASELINE_FILE=".i18n-violations-baseline.json"
TMP_RAW="/tmp/i18n-violations-raw.txt"

echo "🔍 Scanning repo for defaultValue violations..."

# Find all matching .ts/.tsx files, count per file, matching hook's exact logic
grep -rnE "defaultValue:\s*['\"][^'\"]+['\"]" src \
    --include="*.ts" --include="*.tsx" \
    --exclude-dir="__tests__" --exclude-dir="locales" 2>/dev/null \
    | grep -vE "defaultValue:\s*['\"]{2}" \
    | grep -vE "\.test\.|\.spec\.|\.config\.|\.stories\." \
    | awk -F: '{print $1}' \
    | sort | uniq -c | sort -rn > "$TMP_RAW"

TOTAL_FILES=$(wc -l < "$TMP_RAW" | tr -d ' ')
TOTAL_VIOLATIONS=$(awk '{sum+=$1} END {print sum}' "$TMP_RAW")

echo "  Files with violations: $TOTAL_FILES"
echo "  Total violations:      $TOTAL_VIOLATIONS"

# Generate JSON
{
    echo "{"
    echo "  \"_meta\": {"
    echo "    \"description\": \"i18n hardcoded defaultValue baseline (ADR-i18n-ratchet)\","
    echo "    \"generated\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
    echo "    \"totalViolations\": ${TOTAL_VIOLATIONS},"
    echo "    \"totalFiles\": ${TOTAL_FILES},"
    echo "    \"rule\": \"Counts can only decrease. New files = zero tolerance.\""
    echo "  },"
    echo "  \"files\": {"
    first=1
    while read count file; do
        if [ $first -eq 1 ]; then first=0; else echo ","; fi
        # Normalize to forward slashes
        file="${file//\\//}"
        printf "    \"%s\": %s" "$file" "$count"
    done < "$TMP_RAW"
    echo ""
    echo "  }"
    echo "}"
} > "$BASELINE_FILE"

rm -f "$TMP_RAW"

echo "✅ Baseline written: $BASELINE_FILE"
