#!/bin/bash
# =============================================================================
# ENTERPRISE: Regenerate SSoT Violations Baseline (Ratchet Pattern)
# =============================================================================
# Scans the entire src/ and regenerates .ssot-violations-baseline.json
#
# Run AFTER successful commits that reduce violation counts:
#   npm run ssot:baseline
#
# This ensures the ratchet "clicks down" permanently.
# The pre-commit hook will then enforce the new (lower) numbers as the ceiling.
#
# Also generates .ssot-registry-flat.txt (intermediary for bash parsing).
# =============================================================================

set -e

REGISTRY_FILE=".ssot-registry.json"
BASELINE_FILE=".ssot-violations-baseline.json"
FLAT_FILE=".ssot-registry-flat.txt"
TMP_COUNTS="/tmp/ssot-violations-counts.txt"

if [[ ! -f "$REGISTRY_FILE" ]]; then
    echo "❌ Registry not found: $REGISTRY_FILE"
    exit 1
fi

echo "🔧 Parsing SSoT registry..."

# Step 1: Parse .ssot-registry.json → .ssot-registry-flat.txt using Node.js
node -e "
const r = require('./.ssot-registry.json');
console.log('EXEMPT:' + r.exemptPatterns);
for (const [name, m] of Object.entries(r.modules)) {
    console.log('MODULE:' + name);
    console.log('SSOT:' + m.ssotFile);
    (m.forbiddenPatterns || []).forEach(p => console.log('PATTERN:' + p));
    (m.allowlist || []).forEach(a => console.log('ALLOW:' + a));
}
" > "$FLAT_FILE"

echo "  ✅ Flat registry: $FLAT_FILE"
echo ""
echo "🔍 Scanning src/ for SSoT violations..."

# Step 2: Read flat file and scan
> "$TMP_COUNTS"

EXEMPT_REGEX=""
CURRENT_MODULE=""
CURRENT_SSOT=""
PATTERNS=()
ALLOWLIST=()

process_module() {
    if [[ -z "$CURRENT_MODULE" || ${#PATTERNS[@]} -eq 0 ]]; then
        return
    fi

    for pattern in "${PATTERNS[@]}"; do
        # Scan entire src/ for this pattern
        grep -rnE "$pattern" src \
            --include="*.ts" --include="*.tsx" 2>/dev/null \
            | while IFS=: read -r filepath rest; do
                # Normalize path
                filepath="${filepath//\\//}"

                # Skip exempt patterns
                if [[ -n "$EXEMPT_REGEX" ]] && echo "$filepath" | grep -qE "$EXEMPT_REGEX"; then
                    continue
                fi

                # Skip allowlisted files/dirs
                local skip=0
                for allowed in "${ALLOWLIST[@]}"; do
                    if [[ "$filepath" == "$allowed" || "$filepath" == "$allowed"* ]]; then
                        skip=1
                        break
                    fi
                done
                [[ $skip -eq 1 ]] && continue

                # Skip comment lines
                if echo "$rest" | grep -qE "^\s*(//|\*|#)"; then
                    continue
                fi

                echo "$filepath"
            done
    done
}

# Parse flat file line by line
while IFS= read -r line; do
    case "$line" in
        EXEMPT:*)
            EXEMPT_REGEX="${line#EXEMPT:}"
            ;;
        MODULE:*)
            # Process previous module before starting new one
            process_module >> "$TMP_COUNTS"
            CURRENT_MODULE="${line#MODULE:}"
            CURRENT_SSOT=""
            PATTERNS=()
            ALLOWLIST=()
            ;;
        SSOT:*)
            CURRENT_SSOT="${line#SSOT:}"
            ;;
        PATTERN:*)
            PATTERNS+=("${line#PATTERN:}")
            ;;
        ALLOW:*)
            ALLOWLIST+=("${line#ALLOW:}")
            ;;
    esac
done < "$FLAT_FILE"

# Process last module
process_module >> "$TMP_COUNTS"

# Step 3: Aggregate counts per file
sort "$TMP_COUNTS" | uniq -c | sort -rn > "${TMP_COUNTS}.agg"

TOTAL_FILES=$(wc -l < "${TMP_COUNTS}.agg" | tr -d ' ')
TOTAL_VIOLATIONS=$(awk '{sum+=$1} END {print sum+0}' "${TMP_COUNTS}.agg")

echo "  Files with violations: $TOTAL_FILES"
echo "  Total violations:      $TOTAL_VIOLATIONS"

# Step 4: Generate JSON baseline
{
    echo "{"
    echo "  \"_meta\": {"
    echo "    \"description\": \"SSoT centralized-module violations baseline (ratchet pattern)\","
    echo "    \"generated\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
    echo "    \"totalViolations\": ${TOTAL_VIOLATIONS},"
    echo "    \"totalFiles\": ${TOTAL_FILES},"
    echo "    \"rule\": \"Counts can only decrease. New files = zero tolerance.\","
    echo "    \"registry\": \".ssot-registry.json\""
    echo "  },"
    echo "  \"files\": {"
    first=1
    while read count file; do
        [[ -z "$file" ]] && continue
        if [ $first -eq 1 ]; then first=0; else echo ","; fi
        # Normalize to forward slashes
        file="${file//\\//}"
        printf "    \"%s\": %s" "$file" "$count"
    done < "${TMP_COUNTS}.agg"
    echo ""
    echo "  }"
    echo "}"
} > "$BASELINE_FILE"

rm -f "$TMP_COUNTS" "${TMP_COUNTS}.agg"

echo ""
echo "✅ Baseline written: $BASELINE_FILE"
echo "   Run: npm run ssot:audit (to see full report)"
