# shellcheck shell=bash
# =============================================================================
# Η ΕΙΣΟΔΟΣ ΤΗΣ ΠΥΛΗΣ — για πύλες bash (ADR-924). Ο αδερφός του `scripts/lib/gate-input.js`.
# =============================================================================
# Χωρίς σημαία: ο δίσκος (σουίτες · `npm run` · χειροκίνητη εκτέλεση).
# Με `--index` (ο εκτελεστής): η ΟΨΗ ΤΟΥ COMMIT — ύπαρξη και κείμενο από το ευρετήριο (`git cat-file` / `git show :`),
# ώστε η ξένη αστάδιοποίητη δουλειά του δίσκου να μην κρίνεται ποτέ.
#
# 🔴 ΓΙΑΤΙ ΕΙΝΑΙ ΕΝΑ ΑΡΧΕΙΟ: το ίδιο ζεύγος `has_source` / `git show ":$f"` χρειάστηκαν οι 3.6 · 3.9 · 3.10 — τρία
#    αντίγραφα θα απέκλιναν στο ΠΟΙΟ αρχείο ανοίγουν (το σχήμα των έξι αντιγράφων `significantLines`, ADR-924 §8.9).
#
# Χρήση (από τη ρίζα του repo — εκεί τρέχει ο εκτελεστής· τα μονοπάτια είναι ΣΧΕΤΙΚΑ με αυτήν):
#   source "$(dirname "${BASH_SOURCE[0]}")/lib/commit-source.sh"
#   commit_source_parse "$@"; set -- "${COMMIT_SOURCE_ARGS[@]}"
#   has_source "$f" && read_source "$f" | grep …
# =============================================================================

COMMIT_SOURCE_INDEX=0
COMMIT_SOURCE_ARGS=()

# Ξεχωρίζει τη σημαία `--index` (οπουδήποτε) από τα υπόλοιπα ορίσματα.
commit_source_parse() {
    COMMIT_SOURCE_INDEX=0
    COMMIT_SOURCE_ARGS=()
    local arg
    for arg in "$@"; do
        if [[ "$arg" == "--index" ]]; then
            COMMIT_SOURCE_INDEX=1
        else
            COMMIT_SOURCE_ARGS+=("$arg")
        fi
    done
}

# Υπάρχει το αρχείο στην πηγή που κρίνεται;
has_source() {
    if [[ "$COMMIT_SOURCE_INDEX" -eq 1 ]]; then
        git cat-file -e ":$1" 2>/dev/null
    else
        [[ -f "$1" ]]
    fi
}

# Το κείμενο του αρχείου από την πηγή που κρίνεται (στο stdout)· λείπει ⇒ κενό + κωδικός ≠ 0.
read_source() {
    if [[ "$COMMIT_SOURCE_INDEX" -eq 1 ]]; then
        git show ":$1" 2>/dev/null
    else
        cat "$1" 2>/dev/null
    fi
}
