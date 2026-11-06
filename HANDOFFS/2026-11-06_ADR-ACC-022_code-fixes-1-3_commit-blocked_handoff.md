# HANDOFF — Λογιστική: αποκλίσεις #1-3 ΥΛΟΠΟΙΗΜΕΝΕΣ, commit μπλοκαρισμένο από CHECK 3.28

**Ημερομηνία:** 2026-11-06 · **Κλαδί:** `agent/accounting-competitive-parity` · **Worktree:** `C:\Nestor_Worktrees\accounting-competitive-parity`
**Αντικαθιστά** το `2026-11-06_ADR-ACC-022_code-fixes_handoff.md` (εκείνο ζητούσε Plan Mode — έγινε, εγκρίθηκε, υλοποιήθηκε).
Εγκεκριμένο σχέδιο: `C:\Users\user\.claude\plans\reactive-munching-dream.md`.

## 0. Κατάσταση — ΔΙΑΒΑΣΕ ΠΡΩΤΑ
- Ο κώδικας των #1-3 είναι **γραμμένος και ΣΤΑΔΙΟΠΟΙΗΜΕΝΟΣ (`git add`) στο worktree, ΟΧΙ committed** — 52 αρχεία (`git diff --cached --name-only`).
- Tests (με έγκριση Giorgio): 10 στοχευμένες σουίτες 200/200 ✅ · όλη η λογιστική `npx jest src/subapps/accounting src/app/api/accounting` = **63 σουίτες / 1014 tests ✅**.
- Το commit **απέτυχε** στο pre-commit hook, **CHECK 3.28** (jscpd, κλώνος που εισήγαγε η αλλαγή):
  ```
  ❌ CHECK 3.28 (diff) FAIL — 1 clone(s) introduced by this change:
     • 10 lines / 52 tokens
         src/subapps/accounting/services/engines/tax-engine.ts:226-235
         src/subapps/accounting/services/engines/tax-engine.ts:251-260
  ```
  Τα 8 «pre-existing clones» που αναφέρει (MemberRow/ShareholderRow/PartnerRow, TaxDashboard/TaxEstimateCard) **ΔΕΝ μπλοκάρουν** — μην τα αγγίξεις.
- Ο Giorgio **ενέκρινε τη διόρθωση** του κλώνου («ΟΚ ΣΥΝΕΧΙΣΕ») — να γίνει σε αυτή τη νέα συνεδρία.

## 1. Επόμενο βήμα (με τη σειρά)
1. **SSoT audit (grep) πριν από τον κώδικα**: `services/engines/helpers/entity-tax.ts` (`computeEntityTax`, `HolderDistribution`) και `services/engines/tax-engine.ts` γραμμές ~190-265 (`calculatePartnershipTax` / `calculateCorporateTax` / `calculateAETax`).
2. **Διόρθωση κλώνου**: οι `calculateCorporateTax` (ΕΠΕ) και `calculateAETax` (ΑΕ) αντιγράφουν (α) το «κέλυφος» του αποτελέσματος (`corporateTax`, `profitAfterTax`, `distributedDividends`, `retainedEarnings`, `totalDividendTax`) και (β) τα πεδία μερίσματος (`dividendSharePercent`, `grossDividend`, `dividendTaxRate`, `dividendTaxAmount`, `netDividend`). Πρόταση: ΕΝΑΣ βοηθός στο `helpers/entity-tax.ts` (π.χ. `dividendFieldsOf(d: HolderDistribution)` + κοινό κέλυφος) και οι δύο μέθοδοι προσθέτουν μόνο id/όνομα (`memberId/memberName` vs `shareholderId/shareholderName`). Η ΟΕ (`partnerDistributions`, άλλα ονόματα πεδίων) μένει ως έχει εκτός αν το jscpd τη βρει.
3. Έλεγχος κλώνων **στα δικά σου αρχεία** πριν πεις «done» (N.18): `npm run jscpd:diff src/subapps/accounting/services/engines/tax-engine.ts src/subapps/accounting/services/engines/helpers/entity-tax.ts` — ⚠️ είναι εργαλείο ελέγχου ⇒ **ζήτα έγκριση** (N.(-2)).
4. Tests μόνο με έγκριση: `npx jest src/subapps/accounting/services/engines/__tests__/tax-engine.test.ts` και μετά όλη η λογιστική.
5. `git add` τα 2 αρχεία + **commit στο κλαδί του worktree** με `git commit -F <αρχείο μηνύματος>` (N.19). Έτοιμο μήνυμα: βλ. §4. Αν ο hook αποτύχει ξανά → **αναφορά στον Giorgio και αναμονή** (N.(-1.1)) — ποτέ `--no-verify`, ποτέ `SKIP_JSCPD_DIFF=1` χωρίς ρητή έγκριση.
6. ADR: αν αλλάξει η δομή, μία γραμμή στο ADR-ACC-009 «Ενημέρωση 2026-11-06» (`computeEntityTax` + κοινός βοηθός μερίσματος).

## 2. Τι υλοποιήθηκε (σύνοψη — λεπτομέρειες στο ADR-ACC-009 «Ενημέρωση 2026-11-06», ADR-ACC-024 §6.1.1-§6.1.2)
- **#1** Μειωμένη προκαταβολή **υπολογίζεται** από `CompanyProfileBase.businessStart` `{date, origin: 'new'|'continuation'} | null` — φυσικό πρόσωπο μισή μόνο το έτος έναρξης (άρθρο 69 §1), νομικό 3 πρώτα έτη, όχι από μετατροπή/συγχώνευση (άρθρο 71 §3), χωρίς έναρξη ⇒ πλήρης. SSoT `services/tax/prepayment-policy.ts` (`resolvePrepayment`)· κάθε αποτέλεσμα φέρει `prepaymentBasis`, η οθόνη το εξηγεί (`components/tax/PrepaymentBasisNote.tsx`). Αφαιρέθηκε το `isFirstFiveYears` (τύποι, UI, i18n)· η ανάγνωση (`companyProfileOf`, `accounting-repo-company-setup.ts`) το αποβάλλει από παλιά έγγραφα. Πεδίο UI: `components/setup/BusinessStartFields.tsx`. Κριτής εισόδου: `services/setup/business-start.ts` (PUT ⇒ 400 σε άκυρο).
- **#2** ΟΕ ως **οντότητα 22%** μέσω του κοινού `computeEntityTax` (ΟΕ/ΕΠΕ/ΑΕ)· διανομή με παρακράτηση 0% (απλογραφικά — ΠΟΛ.1042/2015) / 5% (διπλογραφικά) — `getDistributionWithholdingRate`. Διαγράφηκε το `PartnerTaxBreakdown.tsx`· η ΟΕ δείχνεται στο `CorporateTaxBreakdown.tsx`.
- **#3** ΟΕ προκαταβολή **80%** (`PREPAYMENT_RATE_BY_ENTITY`).
- `ITaxEngine`: είσοδος `EntityTaxInput` + `EntityHolder[]`· αφαιρέθηκαν `TaxScaleConfig.prepaymentRate`, `getDividendTaxRate`, `PartnerTaxInput`, `PartnerTaxResult`.
- ADR ενημερωμένα: ACC-009, 012, 014, 016, 022, 023, 024. i18n el+en + `src/types/i18n.ts` από τον γεννήτορα.

## 3. Ανοιχτά — ΜΟΝΟ πρόταση, καμία ενέργεια χωρίς «ναι» του Giorgio
- Εισφορές ΕΦΚΑ διαχειριστών **ΕΠΕ**: δευτερογενής πηγή (ΠΟΛ.1113/2015 μέσω dnews.gr) λέει ότι **δεν** εκπίπτουν από τα έσοδα της εταιρείας — ο κώδικας τις αφαιρεί (`entity-tax-profile.ts` `loadEpeProfile`). Θέλει έρευνα (σχετίζεται με ACC-027 §1).
- `AccountingService.calculateFullTax` δεν καλείται από πουθενά — υποψήφιο για διαγραφή.
- `TaxEngine.estimateTax` υπολογίζει πάντα με την κλίμακα φυσικών, για κάθε μορφή (προϋπάρχον).
- Οι #4, #5 (ΕΦΚΑ όλων των εταίρων ΕΠΕ · μέλος ΔΣ ΑΕ) παραμένουν ◐ — ΜΗΝ διορθώσεις.
- Το handoff μέτραγε «65 σουίτες»· με τις δύο διαδρομές παραπάνω βγαίνουν 63 — άγνωστο από πού οι άλλες 2.

## 4. Έτοιμο μήνυμα commit (γράψ' το με `Write` και `git commit -F`)
```
fix(accounting): prepayment from business start, OE taxed as entity (22%, 80%); ADR-ACC-022 deviations #1-3

- #1 Reduced prepayment computed from the business start date (businessStart {date, origin}),
  not a per-person isFirstFiveYears checkbox: natural person half only in the start year
  (L.4172/2013 art. 69 §1), legal entities half in the first 3 years, not after
  conversion/merger (art. 71 §3). No start date => full. SSoT services/tax/prepayment-policy.ts;
  every result carries prepaymentBasis, explained on screen (PrepaymentBasisNote).
- #2 OE taxed as an entity at 22% via the shared computeEntityTax (OE/EPE/AE); distribution
  withheld 0% (single-entry, POL.1042/2015) or 5% (double-entry). PartnerTaxBreakdown removed.
- #3 OE prepayment 80% (was 55%).
- ITaxEngine entity methods take EntityTaxInput + EntityHolder[]; removed
  TaxScaleConfig.prepaymentRate, getDividendTaxRate, PartnerTaxInput.
- Setup: business start fields; PUT rejects an invalid businessStart (400).
- ADRs: ACC-009, 012, 014, 016, 022, 023, 024.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## 5. ΜΗΝ
- ΜΗΝ τρέξεις tests / jscpd / πύλες / `tsc` χωρίς έγκριση (N.(-2), N.17).
- ΜΗΝ κάνεις commit στο `main`, `wt:land` ή push χωρίς εντολή Giorgio. ΠΟΤΕ `--no-verify`.
- ΜΗΝ κάνεις `git stash` (κοινή στοίβα με άλλα worktrees) — η δουλειά είναι ήδη σταδιοποιημένη.
- ΜΗΝ αγγίξεις τα αδέσμευτα αρχεία λογιστικής στο `C:\Nestor_Pagonis`.
- Τα `HANDOFFS/*.md` είναι στο `.git/info/exclude` ⇒ `git add -f`.
