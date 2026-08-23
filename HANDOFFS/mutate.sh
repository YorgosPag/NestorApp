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
case "$RES" in *failed*|*"0 total"*) echo "[$NAME] ✅ ΚΟΚΚΙΝΟ — $RES";; *) echo "[$NAME] 🔴🔴 ΕΜΕΙΝΕ ΠΡΑΣΙΝΟ — $RES";; esac
