#!/bin/bash
# =============================================================================
# ENTERPRISE: SSoT Discovery Scanner
# =============================================================================
# Scans the codebase to find:
#   1. DUPLICATES — re-declared functions that exist in centralized files
#   2. REGISTRY GAPS — centralized files without enforcement
#   3. SCATTERED PATTERNS — code patterns that appear in 3+ files
#
# Run: npm run ssot:discover
#
# This is a READ-ONLY diagnostic tool — it does not modify any files.
# Use the output to decide what to add to .ssot-registry.json.
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

REGISTRY_FILE=".ssot-registry.json"
TMP_DIR="/tmp/ssot-discover"
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

# Exempt patterns (same as ratchet)
EXEMPT_REGEX="(__tests__/|\.test\.|\.spec\.|\.d\.ts$|\.config\.|\.stories\.|/docs/|/adrs/|/scripts/|/i18n/locales/|node_modules/|\.old\.)"

echo ""
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  🔍 SSoT Discovery Scanner${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# ─────────────────────────────────────────────────────────────────
# PHASE 1: Extract exports from centralized files
# ─────────────────────────────────────────────────────────────────

echo -e "${BOLD}Phase 1: Extracting exports from centralized files...${NC}"

# Centralized source directories/files
CENTRALIZED_DIRS=(
    "src/config"
    "src/utils"
    "src/lib"
)
CENTRALIZED_FILES=(
    "src/services/enterprise-id.service.ts"
    "src/services/enterprise-id-convenience.ts"
    "src/services/enterprise-id-prefixes.ts"
    "src/components/admin/shared/intent-badge-utils.ts"
)

# Extract: "export_name|source_file"
> "$TMP_DIR/exports.txt"

extract_exports() {
    local file="$1"
    # Match: export const NAME, export function NAME, export class NAME, export enum NAME
    grep -oE "export\s+(const|function|class|enum)\s+[A-Za-z_][A-Za-z0-9_]*" "$file" 2>/dev/null \
        | sed 's/export\s\+\(const\|function\|class\|enum\)\s\+//' \
        | while read -r name; do
            # Skip very short/generic names (likely false positives)
            if [[ ${#name} -ge 4 ]]; then
                echo "${name}|${file}"
            fi
        done
}

# Scan directories
for dir in "${CENTRALIZED_DIRS[@]}"; do
    if [[ -d "$dir" ]]; then
        find "$dir" -maxdepth 1 -name "*.ts" -type f 2>/dev/null | while read -r file; do
            extract_exports "$file" >> "$TMP_DIR/exports.txt"
        done
    fi
done

# Scan individual files
for file in "${CENTRALIZED_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        extract_exports "$file" >> "$TMP_DIR/exports.txt"
    fi
done

# Note: src/lib is already scanned above via CENTRALIZED_DIRS loop (maxdepth 1)

TOTAL_EXPORTS=$(wc -l < "$TMP_DIR/exports.txt" | tr -d ' ')
TOTAL_SSoT_FILES=$(awk -F'|' '{print $2}' "$TMP_DIR/exports.txt" | sort -u | wc -l | tr -d ' ')
echo -e "  Found ${BOLD}${TOTAL_EXPORTS}${NC} exports in ${BOLD}${TOTAL_SSoT_FILES}${NC} centralized files"
echo ""

# ─────────────────────────────────────────────────────────────────
# PHASE 2: Search for duplicate implementations (BATCH approach)
# ─────────────────────────────────────────────────────────────────

echo -e "${BOLD}Phase 2: Scanning for duplicate implementations...${NC}"

DUPLICATE_COUNT=0
> "$TMP_DIR/duplicates.txt"

# Step 2a: ONE grep to find ALL declarations in src/ (fast)
echo -e "  ${DIM}Building declaration index...${NC}"
grep -rnE "^export\s+(const|function|class|enum)\s+[A-Za-z_][A-Za-z0-9_]*" src \
    --include="*.ts" --include="*.tsx" 2>/dev/null \
    | grep -vE "$EXEMPT_REGEX" \
    | grep -vE "\.d\.ts:" \
    > "$TMP_DIR/all-declarations.txt" || true

# Step 2b: For each centralized export, check if it appears in other files
echo -e "  ${DIM}Cross-referencing...${NC}"
while IFS='|' read -r name source_file; do
    [[ -z "$name" ]] && continue

    # Search in the pre-built index for this name (fast string match)
    REDECLARATIONS=$(grep -E "(const|function|class|enum)\s+${name}\b" "$TMP_DIR/all-declarations.txt" 2>/dev/null \
        | grep -v "${source_file}" \
        || true)

    if [[ -n "$REDECLARATIONS" ]]; then
        FILE_COUNT=$(echo "$REDECLARATIONS" | awk -F: '{print $1}' | sort -u | wc -l | tr -d ' ')
        if [[ "$FILE_COUNT" -gt 0 ]]; then
            DUPLICATE_COUNT=$((DUPLICATE_COUNT + 1))
            {
                echo "DUPLICATE:${name}"
                echo "SSOT:${source_file}"
                echo "COUNT:${FILE_COUNT}"
                echo "$REDECLARATIONS" | head -5 | while IFS= read -r line; do
                    echo "  ${line}"
                done
                echo "---"
            } >> "$TMP_DIR/duplicates.txt"
        fi
    fi
done < "$TMP_DIR/exports.txt"

echo -e "  Found ${BOLD}${DUPLICATE_COUNT}${NC} duplicated exports"
echo ""

# ─────────────────────────────────────────────────────────────────
# PHASE 3: Find scattered anti-patterns
# ─────────────────────────────────────────────────────────────────

echo -e "${BOLD}Phase 3: Scanning for scattered anti-patterns...${NC}"

> "$TMP_DIR/patterns.txt"

check_pattern() {
    local name="$1"
    local pattern="$2"
    local ssot_hint="$3"
    local min_threshold="${4:-3}"
    local allowlist_files="${5:-}"  # pipe-separated file paths to exclude (SSoT files themselves)
    local exclude_regex="${6:-}"    # additional grep -vE filter for false positives

    local results
    results=$(grep -rnE "$pattern" src \
        --include="*.ts" --include="*.tsx" 2>/dev/null \
        | grep -vE "$EXEMPT_REGEX" \
        | grep -vE ":[0-9]+:[[:space:]]*(//|\*)" \
        || true)

    # Exclude allowlisted SSoT files from violation counting
    if [[ -n "$allowlist_files" ]]; then
        results=$(echo "$results" | grep -vF "$allowlist_files" || true)
    fi

    # Exclude false-positive patterns (e.g. TypeScript union types)
    if [[ -n "$exclude_regex" ]]; then
        results=$(echo "$results" | grep -vE "$exclude_regex" || true)
    fi

    local exclude_file_pattern="${7:-}"  # exclude entire files whose content matches this pattern
    if [[ -n "$exclude_file_pattern" ]]; then
        local filtered_results=""
        while IFS= read -r line; do
            [[ -z "$line" ]] && continue
            local file
            file=$(echo "$line" | cut -d: -f1)
            if ! grep -qE "$exclude_file_pattern" "$file" 2>/dev/null; then
                filtered_results+="${line}"$'\n'
            fi
        done <<< "$results"
        results="${filtered_results%$'\n'}"
    fi

    if [[ -n "$results" ]]; then
        local file_count
        file_count=$(echo "$results" | awk -F: '{print $1}' | sort -u | wc -l | tr -d ' ')
        if [[ "$file_count" -ge "$min_threshold" ]]; then
            {
                echo "PATTERN:${name}"
                echo "FILES:${file_count}"
                echo "SSOT_HINT:${ssot_hint}"
                echo "$results" | awk -F: '{print $1}' | sort | uniq -c | sort -rn | head -5 | while read -r cnt f; do
                    echo "  ${cnt}x  ${f}"
                done
                echo "---"
            } >> "$TMP_DIR/patterns.txt"
        fi
    fi
}

# Anti-patterns to detect
check_pattern "hardcoded collection()" \
    "\.(collection|doc)\(['\"][a-z_]+['\"]" \
    "src/config/firestore-collections.ts" 2

check_pattern "crypto.randomUUID()" \
    "crypto\.randomUUID\(\)" \
    "src/services/enterprise-id.service.ts" 1 \
    "src/services/enterprise-id.service.ts"

check_pattern "addDoc() usage" \
    "addDoc\(" \
    "Use setDoc() + enterprise ID" 1

check_pattern "new Date().toISOString()" \
    "new Date\(\)\.toISOString\(\)" \
    "src/lib/date-local.ts" 3 \
    "src/lib/date-local.ts"

check_pattern "Timestamp.now() scattered" \
    "Timestamp\.now\(\)" \
    "src/lib/firestore-now.ts → nowTimestamp()" 2 \
    "src/lib/firestore-now.ts" \
    "NOT Timestamp" \
    "firestoreHelpers|firebase-admin"

check_pattern "inline color-by-status" \
    "(status|state)\s*===?\s*['\"].*\?\s*['\"]#[0-9a-fA-F]" \
    "src/lib/design-system.ts → getStatusColor()" 2

check_pattern "hardcoded entityType literals" \
    "entityType\s*[:=]\s*['\"](?:lead|contact|company|project|property|building)['\"]" \
    "src/config/domain-constants.ts → ENTITY_TYPES" 3 \
    "" \
    "['\"][[:space:]]*[|&]"

check_pattern "hardcoded senderType literals" \
    "senderType\s*[:=]\s*['\"](?:customer|agent|bot|system)['\"]" \
    "src/config/domain-constants.ts → SENDER_TYPES" 2

check_pattern "manual formatCurrency" \
    "\.toLocaleString\(['\"].*currency" \
    "src/lib/intl-formatting.ts → formatCurrency()" 2

check_pattern "manual sort by locale" \
    "\.sort\s*\(.*\.localeCompare\(|\.localeCompare\(.*\)[^;]*[<>].*0" \
    "src/lib/intl-formatting.ts → compareByLocale() or sortByLocale()" 3 \
    "src/lib/intl-formatting.ts"

PATTERN_COUNT=$(grep -c "^PATTERN:" "$TMP_DIR/patterns.txt" 2>/dev/null || echo "0")
echo -e "  Found ${BOLD}${PATTERN_COUNT}${NC} scattered anti-patterns"
echo ""

# ─────────────────────────────────────────────────────────────────
# PHASE 4: Registry gap analysis
# ─────────────────────────────────────────────────────────────────

echo -e "${BOLD}Phase 4: Registry gap analysis...${NC}"

> "$TMP_DIR/gaps.txt"
> "$TMP_DIR/protected.txt"

# Get registered SSoT files from registry
REGISTERED_FILES=""
if [[ -f "$REGISTRY_FILE" ]]; then
    REGISTERED_FILES=$(node -e "
        const r = require('./.ssot-registry.json');
        for (const m of Object.values(r.modules)) {
            console.log(m.ssotFile);
        }
    " 2>/dev/null || true)
fi

# Check each centralized file
awk -F'|' '{print $2}' "$TMP_DIR/exports.txt" | sort -u | while read -r file; do
    [[ -z "$file" ]] && continue
    export_count=$(grep -c "|${file}$" "$TMP_DIR/exports.txt" || echo "0")

    if echo "$REGISTERED_FILES" | grep -qF "$file"; then
        echo "${export_count}|${file}|PROTECTED" >> "$TMP_DIR/protected.txt"
    else
        echo "${export_count}|${file}|GAP" >> "$TMP_DIR/gaps.txt"
    fi
done

GAP_COUNT=$(wc -l < "$TMP_DIR/gaps.txt" | tr -d ' ')
PROTECTED_COUNT=$(wc -l < "$TMP_DIR/protected.txt" | tr -d ' ')
echo -e "  Registry: ${GREEN}${PROTECTED_COUNT} protected${NC}, ${YELLOW}${GAP_COUNT} unprotected${NC}"
echo ""

# ─────────────────────────────────────────────────────────────────
# OUTPUT: Full Report
# ─────────────────────────────────────────────────────────────────

echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  📊 SSoT Discovery Report${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Section 1: Duplicates
if [[ "$DUPLICATE_COUNT" -gt 0 ]]; then
    echo -e "${RED}${BOLD}🔴 DUPLICATED EXPORTS ($DUPLICATE_COUNT found)${NC}"
    echo -e "${DIM}   Functions/constants that exist in SSoT AND are re-declared elsewhere${NC}"
    echo ""

    current_name=""
    while IFS= read -r line; do
        case "$line" in
            DUPLICATE:*)
                current_name="${line#DUPLICATE:}"
                ;;
            SSOT:*)
                echo -e "  ${RED}${BOLD}${current_name}${NC}"
                echo -e "    SSoT: ${CYAN}${line#SSOT:}${NC}"
                ;;
            COUNT:*)
                echo -e "    Re-declared in ${line#COUNT:} file(s):"
                ;;
            "---") echo "" ;;
            *)
                echo -e "    ${DIM}${line}${NC}"
                ;;
        esac
    done < "$TMP_DIR/duplicates.txt"
else
    echo -e "${GREEN}${BOLD}🟢 NO DUPLICATED EXPORTS${NC}"
    echo ""
fi

# Section 2: Scattered patterns
if [[ "$PATTERN_COUNT" -gt 0 ]]; then
    echo -e "${YELLOW}${BOLD}🟡 SCATTERED ANTI-PATTERNS ($PATTERN_COUNT found)${NC}"
    echo -e "${DIM}   Code patterns that should use centralized modules${NC}"
    echo ""

    while IFS= read -r line; do
        case "$line" in
            PATTERN:*)
                echo -e "  ${YELLOW}${BOLD}${line#PATTERN:}${NC}"
                ;;
            FILES:*)
                echo -e "    In ${line#FILES:} files"
                ;;
            SSOT_HINT:*)
                echo -e "    Use: ${CYAN}${line#SSOT_HINT:}${NC}"
                ;;
            "---") echo "" ;;
            *)
                echo -e "    ${DIM}${line}${NC}"
                ;;
        esac
    done < "$TMP_DIR/patterns.txt"
else
    echo -e "${GREEN}${BOLD}🟢 NO SCATTERED ANTI-PATTERNS${NC}"
    echo ""
fi

# Section 3: Registry gaps
echo -e "${YELLOW}${BOLD}🟡 REGISTRY GAPS — Centralized files WITHOUT enforcement ($GAP_COUNT)${NC}"
echo -e "${DIM}   These files are SSoT but not in .ssot-registry.json${NC}"
echo ""

sort -t'|' -k1 -rn "$TMP_DIR/gaps.txt" | head -20 | while IFS='|' read -r count file status; do
    printf "  %3d exports  %s\n" "$count" "$file"
done
if [[ "$GAP_COUNT" -gt 20 ]]; then
    echo -e "  ${DIM}... and $((GAP_COUNT - 20)) more${NC}"
fi
echo ""

# Section 4: Protected
echo -e "${GREEN}${BOLD}🟢 PROTECTED — In registry with enforcement ($PROTECTED_COUNT)${NC}"
echo ""
while IFS='|' read -r count file status; do
    printf "  ✅ %s (%d exports)\n" "$file" "$count"
done < "$TMP_DIR/protected.txt"
echo ""

# Summary
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "  ${BOLD}Summary:${NC}"
echo -e "    Centralized files:  $((GAP_COUNT + PROTECTED_COUNT))"
echo -e "    Protected:          ${GREEN}${PROTECTED_COUNT}${NC}"
echo -e "    Unprotected:        ${YELLOW}${GAP_COUNT}${NC}"
echo -e "    Duplicate exports:  ${RED}${DUPLICATE_COUNT}${NC}"
echo -e "    Anti-patterns:      ${YELLOW}${PATTERN_COUNT}${NC}"
echo ""
echo -e "  ${CYAN}Next: Add high-value modules to .ssot-registry.json${NC}"
echo -e "  ${CYAN}Then: npm run ssot:baseline${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Cleanup
rm -rf "$TMP_DIR"
