#!/bin/bash
# =============================================================================
# ENTERPRISE: SSoT Import Violations — RATCHET Pattern
# =============================================================================
# Google-style ratchet enforcement for centralized module bypass.
#
# RULES:
#   1. Per-file violation count can only DECREASE (ratchet down)
#   2. New files (not in baseline) = ZERO tolerance
#   3. Existing legacy violations allowed until touched
#   4. Baseline auto-updates when counts decrease
#
# BASELINE FILE: .ssot-violations-baseline.json
# REGISTRY FILE: .ssot-registry.json → .ssot-registry-flat.txt
#
# BLOCKS commit if:
#   - A staged file has MORE violations than baseline
#   - A new (non-baseline) file has ANY violations
#
# PATTERNS CHECKED (from .ssot-registry.json):
#   - firestore-collections: hardcoded .collection('name') / .doc('name')
#   - enterprise-id: crypto.randomUUID() outside SSoT
#   - domain-constants: hardcoded senderType/entityType literals
#   - intent-badge-utils: re-declared badge functions outside SSoT
#   - addDoc-prohibition: addDoc() usage (must use setDoc + enterprise ID)
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

FILES="$@"
BASELINE_FILE=".ssot-violations-baseline.json"
FLAT_FILE=".ssot-registry-flat.txt"
VIOLATIONS=""
RATCHET_UPDATES=""
HAS_BLOCK=0

# Validate required files exist
if [[ ! -f "$FLAT_FILE" ]]; then
    echo -e "${YELLOW}  ⚠️  SSoT flat registry not found. Run: npm run ssot:baseline${NC}"
    exit 0
fi

if [[ ! -f "$BASELINE_FILE" ]]; then
    echo -e "${YELLOW}  ⚠️  SSoT baseline not found. Run: npm run ssot:baseline${NC}"
    exit 0
fi

# Parse flat file into arrays
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
        EXEMPT:*)
            EXEMPT_REGEX="${line#EXEMPT:}"
            ;;
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

# Count all SSoT violations in a file across all modules
count_violations() {
    local file="$1"
    local total=0

    for i in "${!MODULE_NAMES[@]}"; do
        local patterns="${MODULE_PATTERNS[$i]}"
        local allowlist="${MODULE_ALLOWLISTS[$i]}"

        # Skip if file is in this module's allowlist
        if [[ -n "$allowlist" ]]; then
            local skip=0
            IFS='|' read -ra ALLOW_ENTRIES <<< "$allowlist"
            for allowed in "${ALLOW_ENTRIES[@]}"; do
                if [[ "$file" == "$allowed" || "$file" == "$allowed"* ]]; then
                    skip=1
                    break
                fi
            done
            [[ $skip -eq 1 ]] && continue
        fi

        # Count matches excluding comment lines
        local all_matches
        all_matches=$(grep -E "$patterns" "$file" 2>/dev/null || true)
        if [[ -n "$all_matches" ]]; then
            local total_lines
            total_lines=$(printf '%s\n' "$all_matches" | wc -l)
            total_lines=$((total_lines + 0))
            local non_comment_lines
            non_comment_lines=$(printf '%s\n' "$all_matches" | grep -cvE "^\s*(//|\*|#)" || true)
            non_comment_lines=$((non_comment_lines + 0))
            total=$((total + non_comment_lines))
        fi
    done

    echo "$total"
}

# Get baseline count for a file (0 if not in baseline)
get_baseline_count() {
    local file="$1"
    local normalized="${file//\\//}"
    # Use grep -F (fixed string) to avoid regex issues with [brackets] in paths
    local match
    match=$(grep -F "\"$normalized\":" "$BASELINE_FILE" 2>/dev/null | head -1 || true)
    if [[ -n "$match" ]]; then
        echo "$match" | grep -oE '[0-9]+' | tail -1
    else
        echo "0"
    fi
}

# Check if file is in baseline
is_in_baseline() {
    local file="$1"
    local normalized="${file//\\//}"
    grep -qF "\"$normalized\":" "$BASELINE_FILE" 2>/dev/null
}

# Show violation details for a file
show_violations() {
    local file="$1"

    for i in "${!MODULE_NAMES[@]}"; do
        local module="${MODULE_NAMES[$i]}"
        local patterns="${MODULE_PATTERNS[$i]}"
        local allowlist="${MODULE_ALLOWLISTS[$i]}"

        # Skip allowlisted
        if [[ -n "$allowlist" ]]; then
            local skip=0
            IFS='|' read -ra ALLOW_ENTRIES <<< "$allowlist"
            for allowed in "${ALLOW_ENTRIES[@]}"; do
                if [[ "$file" == "$allowed" || "$file" == "$allowed"* ]]; then
                    skip=1
                    break
                fi
            done
            [[ $skip -eq 1 ]] && continue
        fi

        local matches
        matches=$(grep -nE "$patterns" "$file" 2>/dev/null \
            | grep -vE "^\s*(//|\*|#)" || true)

        if [[ -n "$matches" ]]; then
            while IFS= read -r match; do
                [[ -n "$match" ]] && VIOLATIONS="${VIOLATIONS}\n        [${module}] ${match}"
            done <<< "$matches"
        fi
    done
}

for file in $FILES; do
    # Skip non-existent (deleted) files
    [[ ! -f "$file" ]] && continue

    # Skip exempt patterns
    if echo "$file" | grep -qE "$EXEMPT_REGEX"; then
        continue
    fi

    # Only .ts / .tsx
    echo "$file" | grep -qE '\.(ts|tsx)$' || continue

    CURRENT=$(count_violations "$file")
    BASELINE=$(get_baseline_count "$file")
    CURRENT=${CURRENT:-0}
    BASELINE=${BASELINE:-0}

    # Case 1: Zero violations, not in baseline → clean, skip
    if [[ "$CURRENT" -eq 0 && "$BASELINE" -eq 0 ]]; then
        continue
    fi

    # Case 2: Ratcheted DOWN → show progress
    if [[ "$CURRENT" -lt "$BASELINE" ]]; then
        DIFF=$((BASELINE - CURRENT))
        RATCHET_UPDATES="${RATCHET_UPDATES}\n  ✅ ${file}: ${BASELINE} → ${CURRENT} (-${DIFF})"
        continue
    fi

    # Case 3: Same count, legacy file → allow silently
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
        VIOLATIONS="${VIOLATIONS}\n     Found ${CURRENT} SSoT violation(s)"
    fi

    show_violations "$file"
done

# Show ratchet-down progress (positive feedback)
if [[ -n "$RATCHET_UPDATES" ]]; then
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  🎯 RATCHET DOWN — Progress on SSoT centralization${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "$RATCHET_UPDATES"
    echo ""
    echo -e "${CYAN}  Run after commit: npm run ssot:baseline${NC}"
    echo -e "${CYAN}  (to persist the new lower counts into baseline file)${NC}"
    echo ""
fi

# BLOCK if new violations found
if [[ "$HAS_BLOCK" -eq 1 ]]; then
    echo ""
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  🚫 COMMIT BLOCKED — SSoT Ratchet Violation${NC}"
    echo -e "${RED}  Centralized module bypass detected${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "$VIOLATIONS"
    echo ""
    echo -e "${YELLOW}  Fix: Use the centralized module instead of inline code.${NC}"
    echo -e "${YELLOW}  Registry: .ssot-registry.json (see module descriptions)${NC}"
    echo -e "${YELLOW}  Audit: npm run ssot:audit${NC}"
    echo ""
    exit 1
fi

exit 0
