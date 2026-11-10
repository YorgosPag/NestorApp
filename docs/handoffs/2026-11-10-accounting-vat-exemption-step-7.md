# HANDOFF — 2026-11-10 — Λογιστική: αιτία εξαίρεσης ΦΠΑ → βήμα 7 (μετά το 6)

**Worktree**: `C:\Nestor_Worktrees\accounting-next` · **Κλαδί**: `agent/accounting-next`
**Η νέα συνεδρία συνεχίζει ΣΤΟ ΙΔΙΟ worktree.** Στο `main` κανένα commit. `wt:land` και push **ΜΟΝΟ** με ρητή
εντολή Giorgio. Κανένα test / scan / `jscpd` χωρίς έγκρισή του (N.(-2)). Κανένα `tsc` (N.17). Commit στο κλαδί από
τον πράκτορα με ρητή λίστα αρχείων (ADR-925) — ο hook τρέχει σουίτες, άρα **ζήτα έγκριση πριν το commit**.
Απαντήσεις **πάντα στα ελληνικά**. Μεγάλο περιεχόμενο ⇒ `Write`, όχι heredoc (N.19).
Προηγούμενο handoff: `docs/handoffs/2026-11-10-accounting-vat-exemption-step-6.md`.

## 1. Κατάσταση (επαληθευμένη 2026-11-10)
- Τα βήματα 1–6 (ADR-ACC-003 §22.2–§22.7) εντάχθηκαν στο `main` με `wt:land` ως **ένα** commit `9214cb1c`
  (τίτλος του βήματος 6 — περιέχει και τα 1–5) και **είναι στο `origin/main`** (έγινε push από τον Giorgio).
- Το worktree έχει HEAD `9214cb1c`· το `main` έχει προχωρήσει από άλλες συνεδρίες (π.χ. `971646f5`, ADR-929). Πριν
  από νέα δουλειά: `git log --oneline -3 main` και, αν χρειάζεται βάση στο τρέχον `main`, ρώτα τον Giorgio
  (μην κάνεις rebase/reset χωρίς έγκριση).
- **Ζωντανή επαλήθευση (nestorconstruct.gr)**: το βήμα 6 **δεν έχει επιφάνεια UI** — είναι δεδομένα + καθαρός
  επιλυτής χωρίς καταναλωτή παραγωγής (όπως το βήμα 5). Ζωντανά επαληθεύσιμα είναι μόνο τα βήματα 3–4 (αιτία
  εξαίρεσης στο ServicePreset / γραμμή τιμολογίου, πρόταση ΦΠΑ από πελάτη §22.5): άνοιξε νέο τιμολόγιο παροχής
  υπηρεσιών με πελάτη ΕΕ με ΑΦΜ ⇒ πρέπει να εμφανιστεί η πρόταση 0% + αιτία 4 + τύπος 2.2. **Μόνο αν το ζητήσει ο
  Giorgio** (browser = εργαλείο, όχι πρωτοβουλία).

## 2. Τι έκανε το βήμα 6 (πλήρες: ADR-ACC-003 §22.7)
Αιτία §8.3 → (α) πεδίο εκροών Φ2 του **εκδότη** (342/345/348/349/310 ή ρητά `not_filed` / `not_reported` /
`unmapped`), (β) χαρακτηρισμός ΦΠΑ myDATA του **λήπτη** (μόνο αιτία 16 ⇒ `VAT_366`, κατηγορία 1/4 — σφάλματα 317/334).
- `services/config/vat-return-form.ts` — ρίζα πεδίων Φ2 2025 (Α.1077/2025) + δικαίωμα έκπτωσης.
- `services/mydata/mydata-codes.ts` — §8.11 `MYDATA_EXPENSE_VAT_CLASSIFICATIONS` + `MYDATA_SELF_ASSESSED_VAT_CATEGORIES`.
- `services/config/vat-exemption-reasons.ts` — πεδίο `vatReturn {output, recipient}` στις 31 αιτίες, `sources` +
  `fidelity` ανά γραμμή · `vatReturnMappingOf`.
- `services/tax/customer-vat-treatment.ts` — `resolveByCustomerScenario` (κοινός για EN 16931 και Φ2, anti-clone).
- `services/tax/vat-return-treatment.ts` — `resolveVatReturnTreatment` · `recipientVatClassificationOf`.
- Tests: 84/84 πράσινα (με έγκριση) · `jscpd:diff` καθαρό · hook: 90 σουίτες Accounting πράσινες.
- 🔑 **Η ΑΑΔΕ δεν δημοσιεύει πίνακα «αιτία → Φ2»**: ο πίνακας βγήκε από ΑΑΔΕ + ν. 5144/2024 (απόφαση Giorgio
  «ΑΑΔΕ + νόμος»). Πίνακες τρίτων (Entersoft, Κορρές/Taxheaven) **απορρίφθηκαν**.

## 3. Επόμενο: βήμα 7 — ΔΕΝ έχει οριστεί. Ρώτα τον Giorgio να διαλέξει (AskUserQuestion)
Υποψήφια (όλα από τα «Εκτός εμβέλειας» των §22.5–§22.7· κανένα δεν υλοποιείται χωρίς «ναι»):
1. **Preflight παραστατικού** πριν την έκδοση: ο επιλυτής Φ2 + EN 16931 δίνει `needs_review`
   (`unmapped` / `scenario_mismatch` / `unknown_country`) ⇒ ορατή προειδοποίηση στη φόρμα τιμολογίου. Πρώτος
   **καταναλωτής παραγωγής** των βημάτων 5–6 (κλείνει τον κίνδυνο «σβήστηκε ως νεκρό»). Χρειάζεται i18n el+en.
2. **Ένδειξη «Αντίστροφη επιβάρυνση»** στο PDF (Οδηγία 226 §11α / ν. 4308/2014) — ο επιλυτής EN 16931 δίνει ήδη `AE`.
3. **Προεπισκόπηση Φ2** (σύνολα ανά πεδίο 342/345/348/349/310 ανά περίοδο) πάνω στη `vat-engine`.
4. **Έλεγχος VIES** για τον ΑΦΜ ΕΕ (σήμερα η πρόταση §22.5 φέρει επιφύλαξη `vatNumberNotVerified`).
5. Εξειδίκευση υποπαραγράφου VATEX ανά υπηρεσία (`fidelity: 'article'` → `exact`).
Πρόταση πράκτορα: **1** (δίνει πραγματική αξία στον χρήστη και καταναλωτή στα 5–6) — αλλά αποφασίζει ο Giorgio.

## 4. Ροή για ό,τι επιλεγεί
Plan Mode · έρευνα σε **επίσημες** πηγές (ΑΑΔΕ / ΓΓΠΣ / EC / CEN / νόμος) όπου αγγίζει φορολογία · **πραγματικό SSoT
audit με grep** πριν από κώδικα (σημεία εκκίνησης: `services/config/vat-exemption-reasons.ts`,
`services/tax/*-treatment.ts`, `services/mydata/mydata-codes.ts`, `components/invoices/forms/`) · πρότυπο ποιότητας
«μεγάλων παικτών», full enterprise + full SSoT · ADR-ACC-003 νέα §22.8 + changelog στο ίδιο commit.

## 5. ΜΗΝ
- ΜΗΝ αλλάξεις τους πίνακες §22.6 / §22.7 χωρίς νέα επίσημη πηγή **και** ενημέρωση ADR (τα tests τους παγώνουν).
- ΜΗ σβήσεις `vat-return-treatment.ts` / `en16931-vat-treatment.ts` / `vat-return-form.ts` ως «νεκρά».
- ΜΗΝ εκπέμψεις `VATEX-EU-306` · ΜΗΝ βάλεις «O» ως εφεδρεία στα δεδομένα (βλ. handoff βήματος 5/6).
- ΜΗ χρησιμοποιήσεις πίνακες τρίτων για φορολογικές αντιστοιχίσεις.
- ΜΗΝ τρέξεις `tsc`, tests ή `jscpd` χωρίς έγκριση· ΜΗΝ κάνεις `wt:land` / push χωρίς εντολή.
