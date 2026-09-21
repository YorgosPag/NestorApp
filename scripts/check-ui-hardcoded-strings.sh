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

# Blank out block comments, KEEPING line numbering (newlines survive).
#
# 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ, ΚΑΙ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟ (2026-09-06): το φίλτρο σχολίων από κάτω δουλεύει
#    ΑΝΑ ΓΡΑΜΜΗ — πιάνει `//`, `*`, `#` και `{/*` στην ΑΡΧΗ. Ένα πολυγραμμικό JSX σχόλιο
#    που ΔΕΝ βάζει `*` σε κάθε γραμμή (το ιδίωμα αυτού του repo) περνά ολόκληρο από μέσα.
#
#    Το μετρημένο ψευδώς θετικό: `ListingCard.tsx:210`, μέσα σε {/* … */}, η πρόταση
#    «`<button>` μέσα σε `<a>` είναι άκυρο HTML» — τα markdown code spans δίνουν
#    `>` … ελληνικά … `<` και το Pattern 1 ταιριάζει. Δηλαδή η πύλη ΤΙΜΩΡΟΥΣΕ ΤΗΝ
#    ΤΕΚΜΗΡΙΩΣΗ, και το CLAUDE.md N.11 εξαιρεί ΡΗΤΑ τα σχόλια («EXCEPTIONS: … code
#    comments …»). Ένα ψευδώς θετικό σε σωστό κώδικα είναι ο δρόμος προς το SKIP_.
#
# ⚠️ ΜΗΝ το κάνεις με `grep -v` ανά γραμμή: η κατάσταση «είμαι μέσα σε σχόλιο» ΔΕΝ
#    διαβάζεται από μία γραμμή. Γι' αυτό διαβάζεται ολόκληρο το αρχείο.
#
# 🔴 ΚΑΙ ΤΑ ΣΧΟΛΙΑ ΤΕΛΟΥΣ ΓΡΑΜΜΗΣ (2026-09-21): ως τότε εδώ ζούσε ιδιωτικό `perl` που έσβηνε
#    ΜΟΝΟ `/* … */`. Το `code; // … <πεδίο> …` περνούσε — το φίλτρο από κάτω πιάνει `//` μόνο
#    στην ΑΡΧΗ της γραμμής — και 7 αρχεία μπλόκαραν πάνω στο ίδιο σχόλιο
#    («`${idBase}-<πεδίο>`: η <Label> ονομάζει το combobox»). Τώρα ρωτά το ΕΝΑ SSoT
#    `stripComments` (`scripts/lib/i18n-namespace-extract.js`, ήδη σε 5 πύλες): σβήνει `//`
#    ΚΑΙ `/* */`, κρατά offsets + αλλαγές γραμμής, και δεν τρώει το `//` ενός URL σε string.
strip_comments() {
    node -e "process.stdout.write(require('./scripts/lib/i18n-namespace-extract').stripComments(require('fs').readFileSync(process.argv[1], 'utf8')))" "$1" 2>/dev/null
}

# Hardcoded UI violations of a file as `line:text`, one per line, sorted by line.
# ΜΙΑ πηγή για το «πόσες» ΚΑΙ το «ποιες» — ως 2026-09-21 τα 4 patterns ζούσαν δύο φορές
# και η αναφορά έτρεχε πάνω στο ΩΜΟ αρχείο (έδειχνε σχόλια που η μέτρηση είχε σβήσει).
match_ui_violations() {
    local src
    src="$(strip_comments "$1")"
    {
        # Pattern 1: JSX text with Greek
        printf '%s
' "$src" | grep -nP ">[^<>{}]*\p{Greek}[^<>{}]*<" 2>/dev/null
        # Pattern 2: Attributes with Greek
        printf '%s
' "$src" | grep -nP "(placeholder|title|aria-label|alt|label)=\"[^\"]*\p{Greek}[^\"]*\"" 2>/dev/null
        # Pattern 3: throw/alert/confirm/prompt with Greek
        printf '%s
' "$src" | grep -nP "(throw new Error|alert|confirm|prompt)\(\s*[\"'\`][^\"'\`]*\p{Greek}" 2>/dev/null
        # Pattern 4: toast calls with Greek
        printf '%s
' "$src" | grep -nP "toast\.[a-z]+\(\s*[\"'\`][^\"'\`]*\p{Greek}" 2>/dev/null
    } | sort -u -t: -k1,1n
}

# Count hardcoded UI violations in a file (4 patterns, de-duplicated by line)
count_ui_violations() {
    match_ui_violations "$1" | awk -F: '{print $1}' | sort -u | wc -l | tr -d ' '
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
    match_ui_violations "$1" | head -5
}

for file in $FILES; do
    [[ ! -f "$file" ]] && continue

    # EXEMPT patterns (same as defaultValue hook + extras)
    #
    # /test-harness/ — ΠΕΔΙΟ ΕΦΑΡΜΟΓΗΣ, ΟΧΙ ΧΑΛΑΡΩΣΗ (2026-09-09). Ο N.11 λέει «ALL
    # user-facing strings»: ένα harness ΔΕΝ είναι προϊόν — είναι όργανο μέτρησης που
    # ανοίγει ο ίδιος ο προγραμματιστής, δίπλα στα ήδη εξαιρεμένα `/__tests__/`,
    # `.spec.`, `/scripts/`. Το i18n του θα φούσκωνε route slices (CHECK 3.34) για
    # οθόνη που κανένας πελάτης δεν βλέπει, σε γλώσσα που κανένας δεν ζητά.
    # ⚠️ Η ΕΞΑΙΡΕΣΗ ΕΙΝΑΙ ΣΤΕΝΗ ΕΠΙΤΗΔΕΣ: πιάνει ΜΟΝΟ διαδρομές με `/test-harness/`.
    # Οι σελίδες προϊόντος μένουν ακέραια υπό την πύλη.
    if echo "$file" | grep -qE '(/i18n/locales/|/__tests__/|/test-harness/|\.test\.|\.spec\.|\.d\.ts$|\.config\.|\.stories\.|\.qa\.|^docs/|/docs/|^adrs/|/adrs/|^scripts/|/scripts/|/data/|/constants/|-definitions\.|-schema\.|\.mock\.|\.original\.|\.template\.)'; then
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
