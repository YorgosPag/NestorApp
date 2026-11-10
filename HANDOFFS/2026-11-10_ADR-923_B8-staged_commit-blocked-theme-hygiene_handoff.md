# Handoff — ADR-923 §5.5.2 Β8 (χάρτης κατάστασης PDF + αμφίδρομη επιλογή) · ΣΤΑΔΙΟΠΟΙΗΜΕΝΟ, commit ΜΠΛΟΚΑΡΙΣΜΕΝΟ από ξένο κόκκινο test

**Ημερομηνία:** 2026-11-10 · **Worktree:** `C:\Nestor_Worktrees\catalog-editions` · **Κλαδί:** `agent/catalog-editions`
**Προηγούμενο:** `HANDOFFS/2026-11-09_ADR-923_revert-fixed-live_next-PDF-status-overlay_handoff.md`
**Εντολή Giorgio:** «όπως οι μεγάλοι» (Revit · ArchiCAD · Cinema 4D · Figma · Zillow · Idealista), FULL ENTERPRISE + FULL SSOT, χωρίς εκπτώσεις· έρευνα web όπου δεν είσαι σίγουρος· **πραγματικό SSoT audit (grep) ΠΡΙΝ από κάθε κώδικα**.

## 1. Κατάσταση (ΔΙΑΒΑΣΕ ΠΡΩΤΑ)
- HEAD = `51340899` (καμία νέα δέσμευση). **Όλη η δουλειά του Β8 είναι ΣΤΑΔΙΟΠΟΙΗΜΕΝΗ (`git add`) αλλά ΧΩΡΙΣ commit** — `git status` τη δείχνει. Το handoff αυτό επίσης σταδιοποιημένο (`git add -f`).
- **Γιατί δεν έγινε commit:** το pre-commit hook, επειδή είναι σταδιοποιημένα `src/app/globals.css` + `tailwind.config.ts`, τρέχει την περιοχή «Theme Token Hygiene (ADR-770)» (`scripts/git-hooks/pre-commit:735`). **394/395 πράσινα**· κόκκινο **ένα**: `scripts/__tests__/theme-token-hygiene.test.js:290` (`ternaryRatchetViolations`, ADR-770 §19) — σάρωση ΟΛΟΥ του repo που βρίσκει **8 σημεία σε αρχεία που ΔΕΝ άγγιξε το Β8**. **Δεν υπάρχει** `SKIP_` γι' αυτή την περιοχή. Ποτέ `--no-verify`.
- **Απόφαση Giorgio (2026-11-10): «1 = ΝΑΙ»** ⇒ διόρθωσε τα 8 σημεία (ToggleButton / SegmentedControl), μετά commit **όλων** μαζί.

## 2. ΕΠΟΜΕΝΟ ΒΗΜΑ — τα 8 σημεία (ADR-770 §19: «κατάσταση πατημένου» με τριαδικό `variant` ⇒ ToggleButton / SegmentedControl)
1. `src/components/catalog/pricing/ValidFromField.tsx:73` — `variant={value === choice.value ? 'secondary' : 'outline'}`
2. `src/components/catalog/pricing/ValidFromField.tsx:81` — `variant={value === null ? 'secondary' : 'outline'}`
3. `src/components/crm/notifications/NotificationInboxFilters.tsx:50` — `variant={pressed ? 'default' : 'outline'}`
4. `src/components/procurement/subcontracts/editor/AgreementLifecycleActions.tsx:42` — `variant={action.destructive ? 'outline' : 'default'}` ⚠️ **ίσως ΔΕΝ είναι κατάσταση πατημένου** (καταστροφική ενέργεια ≠ toggle) — έλεγξε το `pressed-variant-ternary.js`/ADR-770 §19 πριν το «διορθώσεις»· αν είναι ψευδώς θετικό, ΡΩΤΑ.
5. `src/components/procurement/subcontracts/library/authoring/ClauseBodyToolbar.tsx:65` — `state.bullet ? 'secondary' : 'ghost'`
6. `src/components/procurement/subcontracts/library/authoring/ClauseBodyToolbar.tsx:68` — `state.ordered ? 'secondary' : 'ghost'`
7. `src/components/procurement/subcontracts/library/VersionActionBar.tsx:53` — `action === 'reject' ? 'outline' : action === 'approve' ? 'default' : 'secondary'` ⚠️ ίδια αμφιβολία με το 4
8. `src/subapps/dxf-viewer/ui/panels/model-from-drawing/PlanReadingSections.tsx:176` — `adding ? 'default' : 'outline'`
- **Πρώτα SSoT audit**: `src/components/ui/toggle-button.tsx`, `src/components/ui/segmented-control.tsx`, `scripts/lib/contrast/pressed-variant-ternary.js` (ο ανιχνευτής), ADR-770 §19 — πώς τα χρησιμοποιούν ήδη άλλα αρχεία. Μην τρέξεις test χωρίς «ναι»· το commit θα το ξανατρέξει.
- Σημείωση: πιθανότατα το test είναι κόκκινο **και στο main** (τα αρχεία είναι ξένων συνεδριών) — **δεν επαληθεύτηκε**.
- `dxf-viewer` αρχείο ⇒ ίσως CHECK 6D/ADR-040 δεν αφορά (panel, όχι canvas) — έλεγξε.

## 3. Τι είναι το Β8 (σταδιοποιημένο) — πλήρως στο ADR-923 §5.5.2 Β8 + changelog 2026-11-10
- **Ένας κάτοχος επιλογής** `src/components/catalog/imports/use-review-selection.ts` (κλειδί `ReviewTarget`, όχι αντικείμενο· προέλευση `list`/`pdf`/`cycle`· `useActiveReviewItem`).
- **Μοντέλο** `review-overlay-model.ts` (τόνοι, συγχώνευση ίδιας περιοχής, χειρότερος τόνος, σειρά περιέκτες→περιεχόμενο→ανάγνωση).
- **Σημάδια SSoT** `src/subapps/catalog/import/review-marks.ts` (`IMPORT_REVIEW_MARKS`) · ζωγράφος `ImportReviewOverlay.tsx` · υπόμνημα `ReviewOverlayLegend.tsx` · όψη `ImportSourcePane.tsx` · hover `review-hover-store.ts` (πάνω στο `createExternalStore`) · `use-review-line-item.ts` · `line-state.ts` · `import-target-label.ts`.
- **Tokens** `--paper-mark-*` στο `globals.css` (μόνο `:root`) + Tailwind `paper-mark.*`.
- **CHECK 3.41** νέα οικογένεια `import-review-overlay` (`scripts/lib/contrast/state-marks.js`, σκανδάλες στο `run-checks-parallel.js`, `docs/gates/3.41.md`, CLAUDE.md ξαναπαράχθηκε με `gate-index:generate`).
- **Viewer**: `highlights` → `pageOverlay`· `PdfHighlights.tsx` **διαγράφηκε**· `useControlledPdfPage` → `usePdfCurrentPage.ts`.
- Παράχθηκαν: `src/types/i18n.ts`, route slice imports + manifest.
- Το hook ήδη διόρθωσε μέσα στη συνεδρία: CHECK 3.28 (δίδυμα → `use-review-line-item.ts`), 3.7 (store → `createExternalStore`), 3.66 (CLAUDE.md).
- **Άγκυρες γραμμένες**: `review-overlay-model.test.ts`, `proposal-review.render.test.tsx` (νέο API), `check-state-channel-distinctness.test.js` (Μ0δ, Μ14–Μ17). Στο τελευταίο hook **έτρεξαν** οι σουίτες θέματος/3.41 και πέρασαν (17/18 σουίτες). Οι σουίτες καταλόγου **δεν** έχουν τρέξει ρητά.

## 4. Μήνυμα commit (το scratchpad δεν επιβιώνει — αντίγραψέ το σε αρχείο και `git commit -F`)
```
feat(catalog-import): PDF status overlay + two-way selection list <-> PDF; ADR-923 §5.5.2 B8

- One selection owner (useReviewSelection) keyed by stable ReviewTarget, not object identity.
- Boxes around everything recognised: pending / accepted / problem / dismissed, line pattern +
  corner glyph (not colour alone); selected = modifier. Legend + "Boxes" switch.
- Click box -> list scrolls + focuses; merged cell -> "1 of 4 · Next"; field hidden by view
  filter -> shown with a note, filter untouched. Hover both ways via createExternalStore.
- Paper tokens --paper-mark-* (same in every theme; worst-CVD dE >= 8.5, >= 4.25:1 on white).
- CHECK 3.41: new family import-review-overlay (token resolved from globals.css, fail-closed).
- PdfCanvasViewer neutral: highlights -> pageOverlay; PdfHighlights removed.
- SSoT: useTargetLabeler, useReviewLineItem, PROPOSAL_VIEW_KEYS, REVIEW_TONE_KEYS, bucketOf,
  lineStateOf, ImportSourcePane. i18n types + route slice regenerated; CLAUDE.md gate index.
- ADR-923 §5.5.2 B8 + changelog, ADR-771 changelog, docs/gates/3.41.md.
- Fix ADR-770 §19 pressed-variant ternaries (8 sites) that blocked the theme hygiene suite.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
(Αν τα 8 σημεία μπουν σε ξεχωριστό commit πρώτα, βγάλε την τελευταία γραμμή «Fix ADR-770…».)

## 5. Μετά το commit (μόνο με «ναι» Giorgio)
- Ζωντανός έλεγχος **μόνο ανάγνωσης** μετά από land+push (εντολή Giorgio): παρτίδα `cibat_2ba98f62-b4b4-4f77-8c04-0077e331db92`, σελ. 87 — πλαίσια σε όλα, κλικ στο ενωμένο κελί `MB-SA11A1` → «1 από 4», πεδίο κρυμμένο από «Θέλουν απόφαση» → σημείωση, Tab μέσα στο PDF, hover αμφίδρομα, σκοτεινό θέμα (χαρτί λευκό).
- Προτάσεις μιας γραμμής (ΜΗΝ τις κάνεις χωρίς «ναι»): (α) ο ελεγχόμενος `page` του viewer δεν επιστρέφει αν ο άνθρωπος άλλαξε σελίδα με το χέρι και επιλέξει στόχο στην ίδια σελίδα με τον προηγούμενο· (β) ο πίνακας οικογενειών στην κεφαλίδα του `check-state-channel-distinctness.js` δεν έχει γραμμή `plan-segment` (#3).

## 6. ⚖️ Ανοιχτές αποφάσεις Giorgio (υπενθύμισε, μην τις αγγίξεις)
1. Κασέτα ως ξεχωριστή οικογένεια «Fan coil κασέτα» (`prefixOf`).
2. «Η μακρύτερη αρχή κερδίζει» στο `selectOptionCandidates`.
3. Νέα εισαγωγή xChange με μέσα για επαλήθευση M-b4 (εγγραφή).
4. Γραμμή ADR-923 για τη ζωντανή επαλήθευση της Επαναφοράς.

## 7. ΜΗΝ
- Κανένα test / πύλη / tsc χωρίς έγκριση (το commit τρέχει πύλες — εγκρίθηκε το commit). Καμία πληρωμένη ανάγνωση AI, καμία εγγραφή παραγωγής χωρίς «ναι».
- Commit μόνο στο `agent/catalog-editions` με ρητή λίστα· **ποτέ** στο main· `wt:land` / push ΜΟΝΟ με εντολή. `HANDOFFS/*.md` ⇒ `git add -f`. **Ποτέ `--no-verify`**.
- Python στα Windows γράφει CRLF: άνοιξε με `newline=''` ή τρέξε `sed -i 's/\r$//'` μετά. Εντολές Bash > 6.000 χαρακτήρες μπλοκάρονται ⇒ script σε αρχείο.
