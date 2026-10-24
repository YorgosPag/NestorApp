---
name: feedback-heavy-lock-guard
description: Ο έλεγχος `if [ -f heavy-task.lock ]` μέσα σε εντολή jest βλέπει ΠΑΝΤΑ κλειδί — το κλειδώνει το δικό μας PreToolUse hook. Έλεγξε κλειδί ΑΛΛΗΣ συνεδρίας.
metadata:
  type: feedback
---

Το `.claude/hooks/heavy-mutex.js` (PreToolUse) γράφει το `~/.claude/heavy-task.lock` **με το δικό μας `sessionId` ΠΡΙΝ τρέξει**
κάθε βαριά εντολή (`jest`, `jscpd`, `npm test`, `tsc`, `next build`). Άρα ένα
`if [ -f ~/.claude/heavy-task.lock ]; then echo LOCKED; else npx jest …; fi` απαντά **πάντα** LOCKED και το jest δεν τρέχει ποτέ.
Μετρημένο 2026-10-24 (ADR-919 «επαλήθευση §12»): τρεις συνεχόμενες «LOCKED», ενώ το αρχείο δεν υπήρχε αμέσως μετά.

**Why:** το hook είναι ήδη το mutex. Αν το κλειδί το κρατά **άλλη** συνεδρία, το hook **αρνείται** την εντολή μόνο του. Ο έλεγχος
μέσα στην εντολή έχει νόημα μόνο αν ξεχωρίζει ποιανού είναι το κλειδί.

**How to apply:** έλεγχος με `if` (ποτέ `;`), που ρωτά αν το κλειδί ανήκει σε **άλλη** συνεδρία:

```bash
L=/c/Users/user/.claude/heavy-task.lock
if [ -f $L ] && ! grep -q <το-δικό-σου-session-id> $L; then echo "LOCKED by other"; cat $L; else npx jest …; fi
```

Το session id φαίνεται στη διαδρομή του scratchpad. Script που τρέχει jest **έμμεσα** (π.χ. `node mutate.js`) πρέπει να έχει τη λέξη
`jest` στη γραμμή εντολής (`node mutate.js a npx jest …`), αλλιώς το hook δεν το αναγνωρίζει ως βαρύ και το mutex παρακάμπτεται.
