# HANDOFF — ΕΦΚΑ: το Βιβλίο Ε-Ε ως ΜΙΑ πηγή εκπιπτόμενων εισφορών (2026-11-07)

**Worktree:** `C:\Nestor_Worktrees\accounting-competitive-parity` (η νέα συνεδρία συνεχίζει στο ΙΔΙΟ worktree)
**Κλαδί:** `agent/accounting-competitive-parity`
**Κανόνες:** commit ΜΟΝΟ στο κλαδί `agent/*` με ρητή λίστα αρχείων · ΟΧΙ commit στο `main` · `wt:land` και `push` ΜΟΝΟ με εντολή Giorgio · κανένα test/jscpd χωρίς έγκριση · όχι tsc · όχι `git stash` · όχι `git add -A`.
**Εγκρίθηκε από Giorgio:** το «Ακριβές σχέδιο του 1» (§4). Πριν από κώδικα: πραγματικό SSoT audit (grep). Ποιότητα μεγάλων παικτών, full enterprise + full SSoT. Αμφιβολία ⇒ έρευνα στο διαδίκτυο.
**Προηγούμενο handoff (ιστορικό):** `HANDOFFS/2026-11-07_accounting-competitive-parity_handoff.md`.

## 1. Το πρόβλημα (επαληθευμένο με grep, 2026-11-07)

Οι εισφορές ΕΦΚΑ φτάνουν στον φόρο από **ΔΥΟ ανεξάρτητους δρόμους**:

| Δρόμος | Πού | Κατάσταση |
|---|---|---|
| **α. Βιβλίο Ε-Ε** | έξοδο κατηγορίας `efka` (`config/account-categories.ts:322`, Ε3 `585_005`, myDATA `category2_12`) → μετράει ΗΔΗ στο `ledger.totalExpenseNet` | ✅ ζωντανός |
| **β. Εγγραφές πληρωμών** `accounting_efka_payments` | `sumPaidEfka` / `deductibleEfka` → αφαιρείται **ΕΠΙΠΛΕΟΝ** από το κέρδος | ⚠️ **κανείς δεν τις δημιουργεί**: `generateEfkaPaymentId` (`src/services/enterprise-id-convenience.ts:127`) χωρίς καλούντα· `updateEFKAPayment` χωρίς καλούντα |

⇒ **Κρυφή διπλομέτρηση**: μόλις υπάρξει πληρωμή `status:'paid'`, dashboard / αναφορές / φόρος ΟΕ-ΕΠΕ-ΑΕ θα αφαιρέσουν την εισφορά ΔΥΟ φορές.
⇒ Το `totalEfkaContributions: 0` στο `services/engines/tax-engine.ts:137` (`estimateTax`) είναι **σωστό** (η ΕΦΚΑ είναι ήδη στα έξοδα)· το σχόλιο «Will be filled from EFKA data later» είναι **παραπλανητικό**. ❌ ΜΗΝ προσθέσεις εκεί αφαίρεση ΕΦΚΑ.

Καταναλωτές του δρόμου β (όλοι, grep 2026-11-07):
- `services/tax/entity-tax-profile.ts` — `sumPaidEfka`, `deductibleEfka`, `incomeTaxOf` (γρ. ~226-240, `efkaScale`), `entityTaxInputOf` (πεδίο `deductibleEfka`), loaders `loadPartnershipProfile` / `loadEpeProfile` / `loadAeProfile` (φορτώνουν πληρωμές ΕΦΚΑ).
- `services/reports/report-tax-basis.ts` — `deductibleEfka(profile, segment)` → `efkaPaid`, και `incomeTaxOf(... efkaScale: factor)`.
- `services/reports/profit-and-loss.ts:69-77` — `netBeforeTax = grossProfit - efka`.
- `services/reports/tax-summary.ts:68-73` — `taxableIncome = income - deductibleExpenses - efka`.
- `src/app/api/accounting/tax/dashboard/route.ts:72-105` — δική του φόρτωση `getEFKAPayments` + `sumPaidEfka` (επίσης ΛΑΘΟΣ πηγή για ΟΕ/ΕΠΕ/ΑΕ).
- `services/accounting-service.ts` — `loadYearTotals` (γρ. ~270) · `calculateFullTax` (νεκρό, εκτός εντολής).
- `services/engines/helpers/entity-tax.ts:59,67` — `input.deductibleEfka` (taxable + εμφάνιση `efkaContributions`).
- `services/accounting-efka-operations.ts:52` — `taxDeductibleAmount = totalPaid` (σελίδα ΕΦΚΑ, εμφάνιση — όχι φόρος).

## 2. Νόμος (έρευνα 2026-11-07 — δευτερογενείς πηγές, ◐)

- **Ατομική**: εκπίπτουν οι εισφορές που **καταβλήθηκαν** μέσα στο έτος (άρθρο 23 ν.4172/2013 κατά έγγραφο Διοίκησης). Η εισφορά Δεκεμβρίου (λήξη Ιανουάριο) → ❌ ρητή πηγή δεν βρέθηκε.
- **ΟΕ/ΕΕ**: εκπίπτουν οι εισφορές **όλων** των εταίρων από τα έσοδα της ΟΕ· εταίρος σε πολλές ⇒ από αυτήν με το μεγαλύτερο εισόδημα (ΠΟΛ.1113/2015, ΠΟΛ.1139/2015). Ο εταίρος συχνά πληρώνει **προσωπικά** ⇒ δεν είναι στο βιβλίο της εταιρείας.
- **ΕΠΕ/ΙΚΕ απλός εταίρος**: ❌ δεν εκπίπτουν από την εταιρεία (ΠΟΛ.1113/2015).
- **ΕΠΕ/ΙΚΕ διαχειριστής**: ✅ ως έξοδο μισθοδοσίας όταν η αμοιβή είναι μισθωτή (ΔΕΔ 2628/2025, ΙΚΕ, άρθρο 22 περ. β΄-γ΄).
- Πηγές: forin.gr/articles/article/14648/pol-1113-2015 · forin.gr/articles/article/14917/pol-1139-2015 · forin.gr/articles/article/14721 · taxheaven.gr/circulars/52069/ded-2628-2025 · taxheaven.gr/law/4172/2013/arthro/22 · taxheaven.gr/circulars/30914/ded-a-1126-2019.

## 3. Απόφαση αρχιτεκτονικής (μεγάλοι παίκτες: SAP / Xero — γενικό καθολικό + βοηθητικά βιβλία που ΚΑΤΑΧΩΡΟΥΝ)

- **Το Βιβλίο Ε-Ε είναι η ΜΟΝΗ πηγή** των εκπιπτόμενων εισφορών. Ο φόρος διαβάζει ΜΟΝΟ το καθολικό.
- Οι εγγραφές πληρωμών ΕΦΚΑ = **βοηθητικό βιβλίο** (πρόγραμμα, υπενθυμίσεις, αντιστοίχιση) — **ποτέ** ποσό φόρου. Η πληρωμή καταχωρεί ΜΙΑ φορά στο βιβλίο (ADR-ACC-006 §7 — ο σχεδιασμός υπάρχει, ο κώδικας ΟΧΙ).

## 4. Ακριβές σχέδιο του 1 (ΕΓΚΡΙΘΗΚΕ)

1. **SSoT** στο `services/journal/journal-ledger.ts`: `ledgerTaxTotals(ledger)` → `{ totalIncome, totalExpenses (ΧΩΡΙΣ efka), efkaContributions (κατηγορία 'efka') }`. Η μηχανή κρατά την υπογραφή της· φορολογητέο = έσοδα − ΟΛΑ τα έξοδα (ίδιο αποτέλεσμα)· η γραμμή «Εισφορές ΕΦΚΑ» μένει ορατή, αλλά **από το βιβλίο**. ⚠️ Πρώτα grep: υπάρχει ήδη split ανά κατηγορία; (`sumNetAmount`, `aggregateByCategory` στο `profit-and-loss.ts`) — επαναχρησιμοποίηση, όχι δεύτερο.
2. Όλοι οι καταναλωτές της §1 → `ledgerTaxTotals`· **αφαιρείται** ο δρόμος β από τον φόρο: `entity-tax-profile.ts` (`incomeTaxOf`, `entityTaxInputOf`, `deductibleEfka`, `efkaScale`· οι loaders δεν χρειάζονται πια πληρωμές για φόρο), `report-tax-basis.ts`, `tax-engine.ts` `estimateTax` (+ διόρθωση σχολίου), `accounting-service.ts` `loadYearTotals`, `tax/dashboard/route.ts` (φεύγει η δική του φόρτωση), `profit-and-loss.ts` + `tax-summary.ts` (ΕΦΚΑ = «εκ των οποίων», όχι δεύτερη αφαίρεση).
3. **ADR (Phase 3)**: ADR-ACC-006 (βιβλίο = πηγή, πληρωμές = βοηθητικό που καταχωρεί), ADR-ACC-009 + ADR-ACC-010 changelog.
4. **Tests**: ενημέρωση (`tax-engine.test.ts`, `report-tax-basis.test.ts`, entity-tax-profile, profit-and-loss / tax-summary αν υπάρχουν) — γράφονται· **τρέχουν ΜΟΝΟ με έγκριση Giorgio**.
5. Αναμενόμενο: **κανένας αριθμός παραγωγής δεν αλλάζει σήμερα** (ο δρόμος β είναι άδειος)· κλείνει η διπλομέτρηση.
6. N.7.1: αρχεία ≤500 γραμμές, συναρτήσεις ≤40. `accounting-service.ts` = 284, `tax-engine.ts` = 254.

## 5. Ανοιχτά — ΕΚΤΟΣ σχεδίου (μόνο πρόταση σε μία γραμμή, ΜΗΝ τα κάνεις)

- Καταχώριση πληρωμών ΕΦΚΑ στο βιβλίο (ADR-ACC-006 §7) — λείπει· χωρίς αυτήν ο εταίρος ΟΕ που πληρώνει προσωπικά δεν δηλώνεται.
- Απλός εταίρος ΕΠΕ: εισφορά του ως έξοδο `efka` θα εκπέσει ενώ ο νόμος λέει όχι ⇒ ένδειξη «μη εκπιπτόμενο» (συνδέεται με απόκλιση #4 ADR-ACC-022).
- Έξυπνη πρόβλεψη ΕΦΚΑ (καταχωρημένες έως σήμερα + υπόλοιπο από `calculateMonthlyBreakdown`, `services/config/efka-config.ts:170`) αντί γραμμικής αναγωγής — πάνω στο νέο SSoT.
- `TaxEstimateCard` ξανακαλεί το endpoint που ήδη καλεί το `useTaxEstimate` (διπλό fetch).
- `calculateFullTax` νεκρό · ADR-ACC-022 #4/#5 (◐) · έρευνα #5 ΑΕ μέλος ΔΣ <3%.

## 6. ΜΗΝ

- ΜΗΝ αφαιρείς ΕΦΚΑ από τις εγγραφές πληρωμών σε ΚΑΝΕΝΑΝ υπολογισμό φόρου.
- ΜΗΝ προσθέσεις αφαίρεση ΕΦΚΑ στο `estimateTax`.
- ΜΗΝ αγγίξεις δουλειά ADR-923 ή αρχεία άλλων συνεδριών στο `C:\Nestor_Pagonis`.
- ΜΗΝ `signDisplay:'negative'`.
- Συγκρούσεις `src/types/i18n.ts` στο `wt:land` → `git checkout --ours` + `npm run generate:i18n-types` + `git add` + `GIT_EDITOR=true git rebase --continue`.
