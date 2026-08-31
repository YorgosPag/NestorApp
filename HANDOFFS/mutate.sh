#!/bin/sh
# ΜΕΤΑΛΛΑΚΤΗΣ ΑΓΚΥΡΩΝ — μία θέση, όχι αντιγραφή ανά ομάδα (N.18).
# Χρήση: mutate.sh <πηγή> <suite> <όνομα> <από> <σε>
# ⚠️ ΟΥΡΛΙΑΖΕΙ αν η μετάλλαξη δεν άλλαξε τίποτα: «κόκκινο» πάνω σε μη-αλλαγή
#    αποδεικνύει σπασμένο test, όχι ζωντανό φρουρό.
SRC="$1"; SUITE="$2"; NAME="$3"; FROM="$4"; TO="$5"
BAK=$(mktemp); cp "$SRC" "$BAK"
node -e '
  const fs=require("fs");const [f,a,b]=process.argv.slice(1);
  const s=fs.readFileSync(f,"utf8");
  if(!s.includes(a)){console.error("ΔΕΝ ΒΡΗΚΕ ΣΤΟΧΟ");process.exit(9);}
  const o=s.split(a).join(b);
  if(o===s){console.error("Η ΜΕΤΑΛΛΑΞΗ ΔΕΝ ΑΛΛΑΞΕ ΤΙΠΟΤΑ");process.exit(9);}
  fs.writeFileSync(f,o);' "$SRC" "$FROM" "$TO"
if [ $? -ne 0 ]; then echo "[$NAME] ⚠️ ΑΚΥΡΗ ΜΕΤΑΛΛΑΞΗ"; cp "$BAK" "$SRC"; rm "$BAK"; exit 1; fi
RES=$(npx jest "$SUITE" 2>&1 | grep -E "^Tests:|^Test Suites:" | tr "
" " ")
cp "$BAK" "$SRC"; rm "$BAK"
# 🔴 ΔΙΟΡΘΩΘΗΚΕ 2026-08-31 (ADR-833 §5.7.6) — ΤΟ ΟΡΓΑΝΟ ΕΛΕΓΕ ΨΕΜΑΤΑ.
# Εδώ έγραφε:  case "$RES" in *failed*|*"0 total"*) ... ✅ ΚΟΚΚΙΝΟ
# Το glob *"0 total"* ήθελε να πιάσει «η σουίτα δεν έτρεξε καθόλου» — αλλά ταιριάζει και στο
# «1**0 total**», «2**0 total**», «3**0 total**»… Δηλαδή **κάθε** μετάλλαξη σε σουίτα με
# πλήθος tests πολλαπλάσιο του 10 αναφερόταν ✅ ΚΟΚΚΙΝΟ **ενώ έμενε πράσινη**.
# Πιάστηκε από δύο μεταλλάξεις της Φάσης 6 που ήταν **όντως** αδύναμες άγκυρες (M14/M15,
# αυτοαναφορικές: το test συνέκρινε τη σταθερά με τον εαυτό της) και το εργαλείο τις
# επιβράβευσε. ⚠️ Οι μετρήσεις μεταλλάξεων προηγούμενων φάσεων μπορεί να περιέχουν το ίδιο
# ψευδώς θετικό — δες ADR-833 §5.7.6.
TESTS_LINE=$(printf '%s' "$RES" | grep -o 'Tests:[^T]*')
case "$RES" in
  *failed*)  echo "[$NAME] ✅ ΚΟΚΚΙΝΟ — $RES" ;;
  *)
    case "$TESTS_LINE" in
      *' 0 total'*) echo "[$NAME] ✅ ΚΟΚΚΙΝΟ (η σουίτα ΔΕΝ ΕΤΡΕΞΕ) — $RES" ;;
      '')           echo "[$NAME] ✅ ΚΟΚΚΙΝΟ (καμία γραμμή αποτελεσμάτων) — $RES" ;;
      *)            echo "[$NAME] 🔴🔴 ΕΜΕΙΝΕ ΠΡΑΣΙΝΟ — $RES" ;;
    esac ;;
esac
