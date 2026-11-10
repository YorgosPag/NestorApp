# HANDOFF — 2026-11-10 — Λογιστική: αιτία εξαίρεσης ΦΠΑ → βήμα 6 (μετά το 5)

**Worktree**: `C:\Nestor_Worktrees\accounting-next` · **Κλαδί**: `agent/accounting-next`
**Η νέα συνεδρία συνεχίζει ΣΤΟ ΙΔΙΟ worktree.** Στο `main` κανένα commit. `wt:land` και push **ΜΟΝΟ** με ρητή
εντολή Giorgio. Κανένα test / scan / `jscpd` χωρίς έγκρισή του (N.(-2)). Κανένα `tsc` (N.17). Commit στο κλαδί από
τον πράκτορα με ρητή λίστα αρχείων (ADR-925) — ο hook τρέχει σουίτες, άρα **ζήτα έγκριση πριν το commit**.
Προηγούμενο handoff: `docs/handoffs/2026-11-09-accounting-vat-exemption-step-5.md`.

## 1. Τι υπάρχει στο κλαδί (όλα χωρίς land/push)
- Βήματα 1–4: `1ae70073` · `7ded8024` · `e42e29c8` · `c9c61d8a` (§22.2–§22.5).
- **Βήμα 5 — §22.6 «Αιτία εξαίρεσης → EN 16931»** (το commit αυτού του handoff). Πλήρης περιγραφή, πηγές και πίνακας:
  ADR-ACC-003 §22.6 (`src/subapps/accounting/docs/adrs/ADR-ACC-003-mydata-aade-integration.md`).
  - `services/config/en16931-vat-codes.ts` — ρίζα: κατηγορίες UNCL5305 · VATEX **v9** (62 `eu`) · δεσμός P0104–P0111
    **ως τύπος** (`VatexCodeFor<C>`) · κανόνες BR ανά κατηγορία ως δεδομένα (`EN16931_CATEGORY_RULES`).
  - `services/config/vat-exemption-reasons.ts` — πεδίο `en16931` σε κάθε αιτία (`fixed` / `byCustomerScenario` /
    `unmapped`, με `fidelity` exact/article) · `en16931MappingOf`.
  - `services/tax/en16931-vat-treatment.ts` — ο ΕΝΑΣ επιλυτής `resolveEn16931VatTreatment(facts, profile)`· προφίλ
    `en16931` / `gr-b2g-peppol` (εφεδρεία ΓΓΠΣ O + VATEX-EU-O **σημαδεμένη**).
  - Tests: `config/__tests__/en16931-vat-codes.test.ts` · `config/__tests__/vat-exemption-reasons-en16931.test.ts`
    (πίνακας παγωμένος) · `tax/__tests__/en16931-vat-treatment.test.ts` — **ΕΤΡΕΞΑΝ με έγκριση: 70/70 πράσινα**
    (μαζί με `customer-vat-treatment.test.ts`). `jscpd:diff` καθαρό. `tsc` δεν έτρεξε (N.17).
- Κανένας καταναλωτής παραγωγής ακόμη (έδαφος για σειριοποιητή UBL / preflight) — **ΜΗΝ** τα σβήσεις ως «νεκρά».

## 2. Επόμενο: βήμα 6 — κωδικοί δήλωσης ΦΠΑ (Φ2) ανά αιτία (ΜΟΝΟ μετά από έρευνα, Plan Mode)
Στόχος: κάθε αιτία §8.3 → χαρακτηρισμός ΦΠΑ myDATA (`vatClassification`, π.χ. 361–367) / κωδικός Φ2, ως **επέκταση**
του `VAT_EXEMPTION_REASONS` (όπως το `en16931`), ποτέ δεύτερος κατάλογος.
- Γνωστό σημείο εκκίνησης: myDATA v2.0.2 σφάλμα **317** — αιτία 16 ⇒ χαρακτηρισμός ΦΠΑ **366**. Και τα 325–329/334
  (συνδυασμοί κατηγορίας ΦΠΑ × αιτίας στον χαρακτηρισμό εξόδων).
- Πηγές: ΑΑΔΕ myDATA v2.0.2 (ERP) πίνακες χαρακτηρισμών ΦΠΑ · `syndiasmoi_xaraktirismwn_v2.0.2_0.xlsx`
  (https://www.aade.gr/sites/default/files/2026-09/syndiasmoi_xaraktirismwn_v2.0.2_0.xlsx) · έντυπο Φ2 / οδηγίες ΑΑΔΕ.
- Grep πρώτα: `mydata-codes.ts` (υπάρχει SSoT κωδικών §8.x) — μην ξαναδηλώσεις κωδικούς.

## 3. Ανοιχτές προτάσεις (ΜΗΝ τις υλοποιήσεις χωρίς «ναι» του Giorgio)
- Ένδειξη «Αντίστροφη επιβάρυνση» στο PDF (Οδηγία 226 §11α) — ο επιλυτής δίνει ήδη `AE`.
- Εξειδίκευση υποπαραγράφου VATEX ανά γραμμή/υπηρεσία (132-1x, 135-1, 148-x, I/J, 309) — `fidelity: 'article'`.
- Preflight EN 16931 που χρησιμοποιεί `EN16931_CATEGORY_RULES` (BR-O-02/11, BR-AE-02, BR-IC-11/12).
- Από το βήμα 4: δοκιμή στην οθόνη · VIES · τύποι 1.2/1.3 · ADR-ACC-004 §9.1 ανακριβές · `resolveCustomer` γράφει `GR`.

## 4. ΜΗΝ
- ΜΗΝ αλλάξεις τον πίνακα αντιστοίχισης χωρίς νέα πηγή **και** ενημέρωση ADR §22.6 (το test τον παγώνει).
- ΜΗΝ εκπέμψεις `VATEX-EU-306` (ο οδηγός EC τον προτείνει, αλλά **δεν** υπάρχει στο VATEX v9 ⇒ BR-CL-22).
- ΜΗΝ βάλεις «O» ως εφεδρεία στα δεδομένα (BR-O-02 / BR-O-11 με πωλητή που έχει ΑΦΜ).
- ΜΗ χρησιμοποιήσεις πίνακες τρίτων (invoicemaker/SingularLogic/Billit) — μόνο ΑΑΔΕ / ΓΓΠΣ / EC / CEN / OpenPeppol.
- Μεγάλο περιεχόμενο ⇒ `Write`, όχι heredoc (N.19, όριο 6.000 χαρακτήρων).
