---
name: Commit workflow rules
description: Background commits + file size handling strategy
type: feedback
---

## Κανόνας 1: Commit στο background
Το `git commit` τρέχει ΠΑΝΤΑ στο background (`run_in_background: true`).
Συνεχίζω με την επόμενη εργασία χωρίς να περιμένω.
Μόνο αν αποτύχει, ασχολούμαι με τα προβλήματα ΑΦΟΥ τελειώσω την τρέχουσα εργασία.

**Why:** Τα pre-commit hooks παίρνουν 10-60 δευτερόλεπτα. Ο Γιώργος δεν θέλει dead time.

**How to apply:** Κάθε `git commit` → `run_in_background: true`. Αν αποτύχει → fix μετά την τρέχουσα εργασία.

## Κανόνας 2: File size block — σειρά ενεργειών
Όταν το commit μπλοκάρεται λόγω μεγέθους αρχείου (>500 LOC):

1. **Πρώτα**: Αφαίρεσε ΜΟΝΟ κενές γραμμές (blank lines)
2. **ΠΟΤΕ**: Μην αφαιρέσεις σχόλια
3. **Αν πάλι δεν περνάει**: Τότε κάνε split σε νέο module (Google SRP)

**Why:** Τα σχόλια έχουν αξία — εξηγούν το γιατί. Οι κενές γραμμές είναι cosmetic.

**How to apply:** Πριν κάνεις split, δοκίμασε `grep -c '^$' file` → αν >20 κενές, αφαίρεσέ τες πρώτα.
