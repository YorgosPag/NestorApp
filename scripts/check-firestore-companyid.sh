#!/bin/bash
# =============================================================================
# CHECK 3.10: Firestore queries must include companyId filter
# =============================================================================
# Detects Firestore query() calls with where() but without companyId filter.
# This ensures tenant isolation — without companyId, Firestore rules deny access.
#
# RATCHET MODE:
#   - New files with violations → BLOCK
#   - Existing files: violations can only decrease vs baseline
#   - Baseline: .firestore-companyid-baseline.json
#
# Usage: bash scripts/check-firestore-companyid.sh [file1 file2 ...]
#   If no files given, scans all src/**/*.{ts,tsx}
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BASELINE_FILE=".firestore-companyid-baseline.json"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Files to check: either passed as args or all ts/tsx in src/
if [[ $# -gt 0 ]]; then
  INPUT_FILES="$@"
else
  INPUT_FILES=$(find "$PROJECT_ROOT/src" -type f \( -name "*.ts" -o -name "*.tsx" \) \
    ! -path "*/__tests__/*" \
    ! -path "*/node_modules/*" \
    ! -name "*.test.*" \
    ! -name "*.spec.*" \
    ! -name "*.d.ts" \
    ! -path "*/i18n/locales/*")
fi

# =============================================================================
# Ο ΑΞΟΝΑΣ ΑΠΟΜΟΝΩΣΗΣ ΔΕΝ ΕΙΝΑΙ ΠΑΝΤΑ Η ΕΤΑΙΡΕΙΑ — ΡΩΤΑ ΤΗΝ ΑΥΘΕΝΤΙΑ
# =============================================================================
# Ο έλεγχος παραπάνω ρωτά «υπάρχει η λέξη companyId;». Για τις συλλογές που το
# `tenant-config.ts` δηλώνει `mode: 'userId'` (NOTIFICATIONS · PROPERTY_DEMANDS)
# η σωστή απάντηση ΔΕΝ περιέχει companyId: μια ζήτηση ανήκει σε ΑΝΘΡΩΠΟ, και δύο
# άξονες απομόνωσης για ένα έγγραφο σημαίνει δύο απαντήσεις στο «ποιος το βλέπει;».
#
# ⚠️ ΔΕΝ ΧΑΛΑΡΩΝΕΙ ΤΙΠΟΤΑ. Το εναλλακτικό πεδίο γίνεται δεκτό ΜΟΝΟ όταν το ίδιο
# μπλοκ ονομάζει τη ΣΥΓΚΕΚΡΙΜΕΝΗ συλλογή που το SSoT δηλώνει userId-scoped, και
# ΜΟΝΟ με το fieldName που δηλώνει εκείνο. Ένα `where('userId')` πάνω στα contacts
# παραμένει παραβίαση. Η αυθεντία είναι το `tenant-config.ts` — η ίδια που διαβάζει
# η CHECK 3.35 (ADR-747) — ποτέ χειρόγραφη λίστα εδώ.
#
# 🔑 Δεκτό και το ψευδώνυμο `FIELDS.<CONST>`: το SSoT των ονομάτων πεδίων είναι
# υποχρεωτικό (ADR-747), οπότε ο ΣΩΣΤΟΣ κώδικας γράφει σταθερά και όχι literal —
# κριτήριο μόνο σε literal θα μπλόκαρε ακριβώς όσους κάνουν το σωστό.
# =============================================================================
TENANT_CONFIG="$PROJECT_ROOT/src/services/firestore/tenant-config.ts"
FIELD_CONSTANTS="$PROJECT_ROOT/src/config/firestore-field-constants.ts"

declare -A USER_SCOPED_FIELD

if [[ -f "$TENANT_CONFIG" ]]; then
  while IFS= read -r line; do
    key=$(echo "$line" | sed -n "s/^[[:space:]]*\([A-Z0-9_]*\):.*/\1/p")
    field=$(echo "$line" | sed -n "s/.*fieldName:[[:space:]]*'\([^']*\)'.*/\1/p")
    [[ -z "$key" || -z "$field" ]] && continue
    alias_const=""
    if [[ -f "$FIELD_CONSTANTS" ]]; then
      alias_const=$(grep -oE "^[[:space:]]*[A-Z0-9_]+:[[:space:]]*'${field}'" "$FIELD_CONSTANTS" 2>/dev/null \
        | head -1 | sed -n "s/^[[:space:]]*\([A-Z0-9_]*\):.*/\1/p")
    fi
    USER_SCOPED_FIELD["$key"]="${field}${alias_const:+|FIELDS\.$alias_const}"
  done < <(grep -E "mode:[[:space:]]*'userId'" "$TENANT_CONFIG")
fi

# Count violations per file
declare -A FILE_VIOLATIONS
TOTAL_VIOLATIONS=0

for file in $INPUT_FILES; do
  # Skip files that don't use Firestore queries
  if ! grep -q "query(" "$file" 2>/dev/null; then
    continue
  fi
  if ! grep -q "where(" "$file" 2>/dev/null; then
    continue
  fi

  # Find query() calls and check if they have companyId in the next 12 lines
  count=0
  while IFS= read -r match; do
    lineno=$(echo "$match" | cut -d: -f1)
    # Get 12-line block from query( start
    block=$(sed -n "${lineno},$((lineno+11))p" "$file" 2>/dev/null)
    if echo "$block" | grep -q "where(" && ! echo "$block" | grep -q "companyId"; then
      # Δεύτερη ερώτηση: μήπως η συλλογή είναι απομονωμένη ανά ΑΝΘΡΩΠΟ; Το μπλοκ
      # πρέπει να ονομάζει ΚΑΙ τη συλλογή ΚΑΙ το πεδίο που δηλώνει το SSoT — αν
      # ονομάζει τη συλλογή χωρίς το πεδίο, είναι παραβίαση (αφιλτράριστη λίστα).
      scoped_ok=0
      for scoped_key in "${!USER_SCOPED_FIELD[@]}"; do
        if echo "$block" | grep -q "COLLECTIONS\.${scoped_key}\b"; then
          if echo "$block" | grep -qE "${USER_SCOPED_FIELD[$scoped_key]}"; then
            scoped_ok=1
          fi
          break
        fi
      done
      if [[ $scoped_ok -eq 0 ]]; then
        count=$((count + 1))
      fi
    fi
  done < <(grep -n "query(" "$file" 2>/dev/null)

  if [[ $count -gt 0 ]]; then
    # Normalize: keep only src/... path
    normalized=$(echo "$file" | sed 's|\\|/|g' | sed 's|.*/\(src/\)|\1|')
    FILE_VIOLATIONS["$normalized"]=$count
    TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + count))
  fi
done

# If no violations found, exit clean
if [[ $TOTAL_VIOLATIONS -eq 0 ]]; then
  exit 0
fi

# Load baseline
BASELINE_PATH="$PROJECT_ROOT/$BASELINE_FILE"
if [[ ! -f "$BASELINE_PATH" ]]; then
  # No baseline = all violations are new = BLOCK
  echo -e "${RED}🚫 Firestore companyId Check: No baseline file found${NC}"
  echo -e "${RED}   Run: npm run firestore:audit to generate baseline${NC}"
  exit 1
fi

# Check ratchet: compare each file against baseline
BLOCKED=0
BLOCK_MESSAGES=""

for normalized in "${!FILE_VIOLATIONS[@]}"; do
  current=${FILE_VIOLATIONS[$normalized]}

  # Get baseline count: parse JSON with grep
  # Escape slashes for grep
  escaped=$(echo "$normalized" | sed 's|/|\\/|g')
  baseline_count=$(grep "\"${normalized}\"" "$BASELINE_PATH" 2>/dev/null | grep -o '[0-9]*' | tail -1)
  if [[ -z "$baseline_count" ]]; then
    baseline_count=0
  fi

  if [[ $baseline_count -eq 0 && $current -gt 0 ]]; then
    # New file with violations → BLOCK
    BLOCK_MESSAGES="${BLOCK_MESSAGES}  ❌ NEW: ${normalized} has ${current} query(ies) without companyId\n"
    BLOCKED=1
  elif [[ $current -gt $baseline_count ]]; then
    # Existing file with MORE violations → BLOCK
    BLOCK_MESSAGES="${BLOCK_MESSAGES}  ❌ REGRESSION: ${normalized}: ${baseline_count} → ${current} (+$((current - baseline_count)))\n"
    BLOCKED=1
  fi
done

if [[ $BLOCKED -eq 1 ]]; then
  echo -e "${RED}🚫 Firestore companyId Check FAILED${NC}"
  echo -e "${RED}   Queries without companyId filter cause permission-denied errors!${NC}"
  echo ""
  echo -e "$BLOCK_MESSAGES"
  echo ""
  echo -e "${YELLOW}Fix: Add where('companyId', '==', companyId) to every Firestore query()${NC}"
  echo -e "${YELLOW}Baseline: $BASELINE_FILE${NC}"
  exit 1
fi

exit 0
