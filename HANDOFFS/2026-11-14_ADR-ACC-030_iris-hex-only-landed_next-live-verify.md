# Handoff — ADR-ACC-030 · υπογραφή IRIS μόνο hex (εντάχθηκε + push) → ζωντανή επαλήθευση

**Ημερομηνία:** 2026-11-14 · **Worktree:** `C:\Nestor_Worktrees\accounting-next` · **Κλαδί:** `agent/accounting-next`
**Η νέα συνεδρία συνεχίζει ΣΤΟ ΙΔΙΟ worktree.** Προηγούμενο (μόνο αν χρειαστεί):
`C:\Nestor_Pagonis\HANDOFFS\2026-11-14_ADR-ACC-030_visit-renewal-verified-live_next-everypay-reply-and-3G.md`

## 1. Τι έγινε σε αυτή τη συνεδρία

- **Everypay**: καμία νέα απάντηση (Gmail νήμα `1a1d4b10d6f17741`· τελευταίο = δικό μας 13/11 21:21). Το
  `support@everypay.gr` 13/11 = μόνο αυτόματη επιβεβαίωση αιτήματος `00128422`. §5.8 #7/#8 (+ #4) **ανοιχτά**.
- **Πλήρης IRIS στο Α-16** (sandbox, `inv_af502bbd-0968-4159-a30c-49bed4619262`, 12,40 €, `pchk_38bc3118-287d-4614-86a0-261cd9fdbbd7`,
  01:32): ο Giorgio πάτησε «Επιτυχής Ταυτοποίηση» ⇒ σελίδα πελάτη «Εξοφλήθηκε», εκδότης «Εξοφλημένο».
- **Logs Coolify** (από Giorgio): επιστροφή browser **και** webhook IRIS ⇒ `signatureScheme: iris-hash-hex`
  (`recorded`)· webhook ειδοποίησης ⇒ `webhook-header` (`unchanged`)· **κανένα** `Payment webhook refused`.
  `payment-reconcile`: «refunds checked 1, recorded 0, unmatched 0, failed 0» ✅ (§3Γ #1 κλειστό).
  ⚠️ Ίδια γραμμή: `pending 5, still-open 5` — **μη επαληθευμένο** ότι είναι μόνο οι παλιές ανολοκλήρωτες απόπειρες.
- **Κώδικας (με «ναι» Giorgio)** — `src/server/payments/providers/everypay/everypay-signature.ts`: ο έλεγχος IRIS
  στένεψε σε **μόνο hex** (`matchingIrisScheme` + `base64DigestAsHex` ⇒ `irisSignatureMatches`)·
  `EverypaySignatureScheme` = `'webhook-header' | 'iris-hash-hex'`. base64 ⇒ `signature-invalid`.
  Tests: `everypay-signature.test.ts` (base64 ⇒ απόρριψη) · `webhook-signal-diagnostics.test.ts` — 15/15 ✅.
- ADR-ACC-030 §5.8 #1 **έκλεισε** + changelog 2026-11-14.
- Commit `40ae44ab` → **land** (εντολή Giorgio) ⇒ τοπικό `main` **`5ee9ad1f`** (το land το συνένωσε με το
  `adc5cbf9`). Hook: 78 έλεγχοι + 108/108 σουίτες Accounting. **Push: ο Giorgio** — deploy σε εξέλιξη τη στιγμή
  του handoff.
- Ο δοκιμαστικός σύνδεσμος «Δοκιμή IRIS signatureScheme» του Α-16 (`share_cae65b0e-b2d3-4995-990f-4f48b515380e`)
  μένει **ΕΝΕΡΓΟΣ** — η ανάκληση προτάθηκε, **δεν** εγκρίθηκε ακόμη.

## 2. Επόμενα βήματα (με τη σειρά)

### 2Α. Ζωντανή επαλήθευση `5ee9ad1f` — ΜΟΝΟ όταν ο Giorgio πει ότι το deploy ολοκληρώθηκε
Στόχος: ο στενεμένος έλεγχος (μόνο hex) δέχεται το γνήσιο IRIS στην παραγωγή.
- Το Α-16 είναι **ήδη εξοφλημένο** ⇒ χρειάζεται **νέο** δοκιμαστικό τιμολόγιο (π.χ. Α-17, πελάτης «ΔΟΚΙΜΗ Everypay
  sandbox», μικρό ποσό) — **ρώτα τον Giorgio πριν το δημιουργήσεις**.
- Chrome: σύνδεσμος πληρωμής («Δημιουργία & αντιγραφή» ⇒ `navigator.clipboard.readText()`) → νέα καρτέλα →
  IRIS → «Πληρωμή» ⇒ προσομοιωτής `sandbox-dashboard.everypay.gr/iris-emulator`· **ο Giorgio** πατά
  «Επιτυχής Ταυτοποίηση» (ΟΧΙ QR / τράπεζα / Ακύρωση / Αποτυχία).
- Κριτήρια ✅: σελίδα πελάτη «Εξοφλήθηκε» · εκδότης «Εξοφλημένο» · logs Coolify (από Giorgio):
  `Browser returned …` + `Payment webhook applied` με `iris-hash-hex`, **κανένα** `Payment webhook refused`.
- Μετά: γραμμή «επαληθεύτηκε ζωντανά» στο changelog ADR-ACC-030 **μόνο** με «ναι» Giorgio.
- Στο τέλος: πρόταση ανάκλησης των δοκιμαστικών συνδέσμων (Α-16 + νέου) — μόνο με «ναι».

### 2Β. Απάντηση Everypay (νήμα `1a1d4b10d6f17741`)
Google/Apple Pay δεν εμφανίζονται στη hosted σελίδα (κενό `merchantName`) + επαναλήψεις webhook ⇒ §5.8 #7/#8/#4.

### 2Γ. Σενάρια §2.5 (με τον Giorgio)
Διπλό webhook μόνο με επαναποστολή από dashboard (ποτέ πλαστό) · δοκιμαστική κάρτα αποτυχίας `4853451426120387` ·
μερική πληρωμή (**απόφαση Giorgio πρώτα**) · myDATA dev. Προαιρετικά (μη εγκεκριμένα): fake-timer test
`usePaymentConfirmationWatch` · κωδικός IRIS στο myDATA v1.0.12 · tid/υπογραφή παρόχου e-POS.

## 3. Μαθήματα
- Ο προσομοιωτής IRIS έχει 3 ενότητες· μόνο το κάτω πλαίσιο («Επιτυχής / Αποτυχία Ταυτοποίησης») είναι sandbox.
- Το `wt:land` συνενώνει όλα τα μη ενταγμένα commits του κλαδιού σε **ένα** πάνω στο `main`.
- Ο κανόνας «commit ⇒ αμέσως land» του CLAUDE.md **υποχωρεί** όταν ο Giorgio γράφει «wt:land μόνο με δική μου εντολή».

## 4. Κανόνες (αμετάβλητοι)
Στο `main` κανένα commit · commit μόνο στο `agent/accounting-next` με ρητή λίστα · `wt:land`/push **μόνο** με εντολή
Giorgio · ποτέ `--no-verify` · tests μόνο με έγκριση · ποτέ tsc · πριν από κώδικα πραγματικό SSoT audit (grep) +
επίσημες πηγές/έρευνα όταν δεν είσαι σίγουρος · μόνο sandbox · ποτέ κωδικοί/πραγματικές κάρτες · ελληνικά ·
δείκτης context στο τέλος.
