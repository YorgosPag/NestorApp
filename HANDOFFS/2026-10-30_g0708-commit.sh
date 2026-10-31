#!/bin/bash
# G07+G08 (υπόλοιπο μετά τα checkpoints e0e0091a/3e9671f8/65bea802): προσωρινό index = HEAD + λίστα από τον δίσκο,
# ολόκληρα αρχεία (το 3.108 είναι πλέον στο HEAD ⇒ τα hunks useTranslation ΑΠΑΙΤΟΥΝΤΑΙ). Commit με hook, χωρίς SKIP.
# CHECK 3.34 (κόκκινο ήδη στο καθαρό HEAD): επιλογή 2′ του Giorgio 2026-10-30 — ερμητική αναγέννηση του slice ΜΟΝΟ
# στο προσωρινό index ($SCRATCH/regen-slice-index-only.js: επίσημος γεννήτορας + SSoT writeIndexBlob).
set -u
REPO=/c/Nestor_Pagonis
S="${SCRATCH:?set SCRATCH to your session scratchpad}"
GIT="/c/Program Files/Git/cmd/git.exe"
LIST="$REPO/HANDOFFS/2026-10-30_G07G08-remaining-files.txt"
TMPIDX="$S/g0708.index"
GEN_OUT="$S/g0708-gen"
GENP="$GEN_OUT/paths.txt"
cd "$REPO"

[ -e C:/Users/user/.claude/heavy-task.lock ] && { echo "ABORT: heavy-task.lock present — wait"; exit 1; }
[ -f "$S/regen-slice-index-only.js" ] || { echo "ABORT: missing $S/regen-slice-index-only.js"; exit 1; }
# Κάποιο αρχείο της λίστας μπήκε στο μεταξύ στο HEAD ή σταδιοποιήθηκε από άλλον ⇒ σταμάτα, ξαναμέτρα.
for p in $(cat "$LIST"); do
  git status --porcelain -- "$p" | grep -q . || { echo "ABORT: no longer modified: $p"; exit 1; }
done
STAGED_OURS=$(git diff --cached --name-only | grep -F -f "$LIST")
[ -n "$STAGED_OURS" ] && { echo "ABORT: staged by other agent: $STAGED_OURS"; exit 1; }
git diff --cached --name-only > "$S/g0708-cached-before.txt"

# 1. Προσωρινό index = HEAD + ομάδα.
rm -f "$TMPIDX"; rm -rf "$GEN_OUT"; mkdir -p "$GEN_OUT"; : > "$GENP"
export GIT_INDEX_FILE="$TMPIDX"
git read-tree HEAD || exit 1
xargs -d '\n' git add -- < "$LIST" || exit 1

# 2. CHECK 3.34: slice από ΑΥΤΟ το index, γραμμένο μόνο σε αυτό (δίσκος + πραγματικό index ανέγγιχτα).
GEN_OUT="$GEN_OUT" node "$S/regen-slice-index-only.js" > "$S/g0708-regen.log" 2>&1 || { tail -30 "$S/g0708-regen.log"; echo "ABORT: regen"; exit 1; }
grep -q 'index ✗' "$S/g0708-regen.log" && { echo "ABORT: regen removed artifacts — handle by hand"; exit 1; }
# Μετριούνται μόνο όσα ΔΙΑΦΕΡΟΥΝ πραγματικά από το HEAD (το snapshot είναι CRLF, ο γεννήτορας LF ⇒ ψευδώς «αλλαγμένα»).
git diff --cached --name-only -- src/i18n/generated/ > "$GENP.real"; mv "$GENP.real" "$GENP"
NGEN=$(grep -c . "$GENP")
N=$(git diff --cached --name-only | wc -l)
EXTRA=$(git diff --cached --name-only | grep -vF -f "$LIST" | grep -vFx -f "$GENP")
echo "staged in temp index: $N (expected 49 + generated $NGEN)"
[ -n "$EXTRA" ] && { echo "ABORT: foreign paths: $EXTRA"; exit 1; }
[ "$N" -eq $((49 + NGEN)) ] || { echo "ABORT: count mismatch"; exit 1; }

# 3. Commit με hook. Εγκρίθηκε από Giorgio ΜΟΝΟ για το G07+G08 (2026-10-30): 3.34 κόκκινο από ΑΔΕΣΜΕΥΤΟ κώδικα
# πύλης στον δίσκο (admission-rule-gate)· ο γεννήτορας του HEAD δίνει artifacts byte-ίδια με το HEAD.
export SKIP_I18N_SHELL_SLICE=1; echo "SKIP_I18N_SHELL_SLICE=1 (approved, G07+G08 only)"
# Ίδια έγκριση για 3.51: η παγίδα ADR-924 πιάνει ωμή ανάγνωση του .i18n-shell-slice.json, που στον δίσκο έχει ξένο WIP
# (μετρημένο ⛔ στο καθαρό HEAD μέσα από τον εκτελεστή του hook· περιεχόμενο ✅ 0/3002).
export SKIP_I18N_SSR_RAW_KEYS=1; echo "SKIP_I18N_SSR_RAW_KEYS=1 (approved, G07+G08 only)"
"$GIT" commit -F "$REPO/HANDOFFS/2026-10-30_G07G08-commit-msg.txt"
RC=$?
unset GIT_INDEX_FILE SKIP_I18N_SHELL_SLICE SKIP_I18N_SSR_RAW_KEYS
rm -f "$TMPIDX"
echo "COMMIT_EXIT=$RC"
[ $RC -eq 0 ] || exit $RC

# 4. Πραγματικό index: τα αρχεία της ομάδας στο νέο HEAD· ξένη σταδιοποίηση ανέγγιχτη.
xargs -d '\n' git reset -q -- < "$LIST"
# Παραγόμενα (πρότυπο g05 βήμα 4): σταδιοποιημένο από άλλον ⇒ ΜΗΝ αγγίξεις· αλλιώς index στο νέο HEAD, και
# δίσκος μόνο αν ήταν ΑΘΙΚΤΟΣ (ίσος με το HEAD~1) — ποτέ πάνω σε ξένη δουλειά.
while read -r g; do
  [ -z "$g" ] && continue
  if [ "$(git rev-parse -q --verify ":$g")" != "$(git rev-parse -q --verify "HEAD~1:$g")" ]; then
    echo "LEFT AS IS (staged by other agent): $g"; continue
  fi
  git reset -q -- "$g"
  if [ "$(git hash-object "$g")" = "$(git rev-parse -q --verify "HEAD~1:$g")" ]; then
    cp "$GEN_OUT/files/$g" "$g"; echo "index+worktree synced: $g"
  else
    echo "index synced, worktree kept (has other work): $g"
  fi
done < "$GENP"
git diff --cached --name-only > "$S/g0708-cached-after.txt"
diff "$S/g0708-cached-before.txt" "$S/g0708-cached-after.txt" && echo "OTHER STAGING UNCHANGED"
echo "=== group + generated paths still differing from HEAD (expected none):"
git -c core.safecrlf=false status --porcelain -- $(cat "$LIST" "$GENP") 2>/dev/null
git log --oneline -2; git show --stat --format= HEAD | tail -1
