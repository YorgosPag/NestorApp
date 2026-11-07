# HANDOFF — accounting-competitive-parity (2026-11-07)

**Worktree:** `C:\Nestor_Worktrees\accounting-competitive-parity`
**Κλαδί:** `agent/accounting-competitive-parity`
**Κανόνες:** commit μόνο στο κλαδί `agent/*` με ρητή λίστα αρχείων · ΟΧΙ commit στο `main` · `wt:land` και `push` ΜΟΝΟ με εντολή Giorgio · κανένα test/jscpd χωρίς έγκριση · όχι tsc · όχι `git stash` · όχι `git add -A`.

## 1. Κατάσταση — ΟΛΑ ΣΤΟ MAIN ΚΑΙ ΖΩΝΤΑΝΑ

| Commit (κλαδί → main) | Τι | Παραγωγή |
|---|---|---|
| `0211ffbb` → `0f497a53` | ADR-ACC-022 αποκλίσεις #1-3 + helper `services/engines/helpers/entity-tax.ts` (CHECK 3.28) | ✅ ζωντανό |
| `849dd0d5` → `64256518` | Φόρος μερισμάτων «δεν υπολογίζεται» χωρίς δικαιούχους (όχι ψεύτικο 0 €) · κανένα «-0 €» | ✅ ζωντανό (deploy `2fc2f39`) |

**Ζωντανή επαλήθευση `2fc2f39` (nestorconstruct.gr, Αναφορές, ΑΕ 2026) — ΠΕΡΑΣΕ:**
- Συνολικά έξοδα / ΕΦΚΑ: «0 €» (όχι «-0 €»).
- Φόρος Μερισμάτων 5%: «—» + sr-only «Δεν υπολογίζεται».
- Σημείωση «Δεν έχουν δηλωθεί μέτοχοι… (ν.4172/2013 άρθρα 48, 64)» + σύνδεσμος «Συμπλήρωση μετόχων».
- Φόρος 31.935,48 · προκαταβολή 25.548,38 · σύνολο 58.483,86 — αμετάβλητα/σωστά.
- Κονσόλα: μόνο 3 «message channel closed» από επέκταση browser.
- ΔΕΝ ελέγχθηκαν ζωντανά (θα απαιτούσαν αλλαγή δεδομένων παραγωγής): μερική κάλυψη (<100%), ΟΕ χωρίς εταίρους — καλύπτονται από `tax-engine.test.ts` → `describe('distributionCoverage')`.

## 2. Αρχιτεκτονική που μπήκε (SSoT)

- `services/engines/helpers/entity-tax.ts`: `dividendFieldsOf`, `dividendResultShellOf`, ιδιωτικό `distributionCoverageOf` → `DistributionCoverage {status:'complete'|'partial'|'none', declaredPercent}`.
- `types/tax.ts`: `distributionCoverage` σε EPE/AE/Partnership αποτελέσματα.
- `utils/share-sum.ts`: `isCompleteShareSum` (ΜΙΑ ανοχή 0.01 — validator + `ShareSumStatus` + μηχανή).
- `src/lib/intl-formatting.ts`: `formatCurrencyIn` → `withoutNegativeZero` (όχι `signDisplay:'negative'` — RangeError σε παλιούς browsers).
- `components/tax/SetupLink.tsx`, `DistributionCoverageNote.tsx`, `CorporateTaxBreakdown.tsx`, `PrepaymentBasisNote.tsx`.
- i18n: `setup.distributionCoverage.*` (el/en `accounting-setup.json`).
- ADR: ADR-ACC-009 (γραμμή «Κάλυψη διανομής»), ADR-216, ADR-929 changelogs.

## 3. Επόμενο βήμα

1. **Καθαρισμός worktree** (αφού γίνει land αυτού του handoff, με εντολή Giorgio): από το `C:\Nestor_Pagonis` → `npm run wt:remove -- accounting-competitive-parity` (από μέσα στο worktree αρνείται).
2. **Ανοιχτές προτάσεις — ΜΟΝΟ με «ναι» του Giorgio:**
   - Εκπίπτουν οι εισφορές ΕΦΚΑ διαχειριστών ΕΠΕ; (έρευνα νομοθεσίας πρώτα)
   - `AccountingService.calculateFullTax` — αχρησιμοποίητο (dead code;).
   - `estimateTax` χρησιμοποιεί πάντα κλίμακα φυσικού προσώπου (λάθος για ΕΠΕ/ΑΕ).
   - ADR-ACC-022 αποκλίσεις #4/#5 παραμένουν ◐.

## 4. ΜΗΝ

- ΜΗΝ ξαναεπαληθεύσεις deploys ADR-923 (QR / κατάλογος, π.χ. `b324537`/`29e1dd1`) — **δεν** είναι δουλειά αυτού του worktree· ανήκουν στον πράκτορα του ADR-923.
- ΜΗΝ αγγίξεις αρχεία άλλων συνεδριών στο `C:\Nestor_Pagonis`.
- ΜΗΝ χρησιμοποιήσεις `signDisplay:'negative'`.
- Συγκρούσεις στο `src/types/i18n.ts` κατά το `wt:land` → `git checkout --ours` + `npm run generate:i18n-types` + `git add` + `GIT_EDITOR=true git rebase --continue`.
