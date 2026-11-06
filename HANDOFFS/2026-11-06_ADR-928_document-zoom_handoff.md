# Handoff — ADR-928: ζουμ σελίδας εγγράφου (εγκεκριμένο) + εκκρεμές commit του #1

**Ημερομηνία**: 2026-11-06 · **Worktree**: `C:\Nestor_Worktrees\adr-928-live-verify-2` · **Κλαδί**: `agent/adr-928-live-verify-2`
Η νέα συνεδρία συνεχίζει **σε αυτό** το worktree (EnterWorktree path).
Προηγούμενο: `HANDOFFS/2026-11-06_ADR-928_minor-findings-proposal_handoff.md`.

## Κατάσταση
- ✅ **Ζωντανή επαλήθευση `d46fa31` (#8/#9) στην παραγωγή — ΠΕΡΑΣΕ**, χωρίς εγγραφή δεδομένων:
  - #9: «Έργο» στη «Νέα εντολή εργασίας» — εστιασμένο+κλειστό στο άνοιγμα (το παλιό σενάριο) → κλικ ανοίγει (10 επιλογές) ·
    βέλος κλείνει/ξανανοίγει · εστίαση μένει στο πεδίο.
  - #8: radiogroup «Εμβέλεια» με όνομα (`aria-labelledby` → legend) · radio με `id` + 1 label.
- 📏 **#3 (λεπτομέρεια 15–20 s) μετρήθηκε: ΔΕΝ αναπαράγεται** — LCP ~2,5 s, δίκτυο τέλος 2,3 s, long tasks 0,6 s (JS cache ζεστή,
  4 πυρήνες). Υπάρχει σειριακό waterfall (το `AgreementDetailBody` κατεβαίνει μόνο μετά την ανάγνωση της σύμβασης,
  `SubcontractAgreementDetail.tsx`) αλλά κοστίζει <1 s. Πρόταση: καμία αλλαγή (απόφαση Giorgio εκκρεμεί).
- 🧩 **#2 (toast «Έκδοση εντολής»)**: πιθανό ψευδώς θετικό — `NewWorkOrderDialog.tsx:149` καλεί ήδη `success(...)`, κλειδί σε el/en,
  test `work-order-form.test.tsx:107`, toast 4 s vs αργό εργαλείο. Ζωντανή επαλήθευση θέλει **αμετάκλητη** δοκιμαστική
  εντολή εργασίας ⇒ **χρειάζεται ρητό «ναι»** (δεν δόθηκε).
- 🛑 **#1 (επιβεβαίωση «Έκδοση»/«Αποδοχή») — κώδικας γραμμένος, ΣΤΑΔΙΟΠΟΙΗΜΕΝΟΣ, ΟΧΙ committed.** 9 αρχεία:
  `subcontract-row-actions.ts` (`CONFIRMED_TRANSITIONS` + `RowAction.confirm`) · `useAgreementTransition.ts` (`confirmKeyOf`,
  `acceptOffer` όταν `spawnsAgreementOnAccept`, κόκκινο μόνο το destructive) · `el/en procurement.json`
  (`confirm.issue/accept/acceptOffer` — επαληθεύτηκε: καμία ειδοποίηση δεν στέλνεται) · `__tests__/subcontract-list.test.ts` ·
  παραγόμενα `src/types/i18n.ts` + 2 route slices + `shell-slice.manifest.json`.
  Ο hook **μπλόκαρε μόνο** στο **CHECK 3.115** με ευρήματα **ξένα** (ADR-929, commit `82272ea8`, ήδη στο `main`):
  `dxf-viewer-shell.json:458 modelFromDrawing.leftOut` και `:478 modelFromDrawing.image.lowExcluded` (el+en) — `{count}` χωρίς
  ICU plural. Το 3.33 διορθώθηκε (`npm run generate:i18n-types`, diff μόνο τα 3 κλειδιά).
  **Απόφαση Giorgio εκκρεμεί**: (α) `SKIP_I18N_PLURAL=1` με αιτιολογία · (β) χωριστή διόρθωση των 2 μηνυμάτων πρώτα · (γ) αναμονή.
  Το test **δεν** έτρεξε χωριστά (N.(-2)).

## ΕΠΟΜΕΝΟ (εγκεκριμένο: «ΟΚ ΠΡΟΧΩΡΑ, όπως οι μεγάλοι»): ζουμ σελίδας εγγράφου
Αφορμή: στη σελίδα της αποδεκτής ΠΡΟΣ-2026-002 το έγγραφο μένει στενή στήλη στη μέση (στιγμιότυπο Giorgio
`c:\Nestor_Pagonis\Στιγμιότυπο οθόνης 2026-11-06 214829.jpg`).

**Τι ΥΠΑΡΧΕΙ ήδη (SSoT — μην το διπλασιάσεις):**
- `src/components/procurement/subcontracts/document/paper-fit.ts` — `usePaperFit` / `paperFitOf`: Α4 (794 px) + CSS `zoom`
  «προσαρμογή στο πλάτος», ταβάνι ×2 (`PAPER_MAX_ZOOM`), ποτέ σμίκρυνση, προστακτική εγγραφή (ADR-928 §5.23).
- Χρησιμοποιείται **μόνο** στο `editor/AgreementLivePreview.tsx:42` (`fit="width"`). Η σελίδα λεπτομέρειας
  `editor/AgreementDetailBody.tsx:72` περνά την προεπιλογή `fit='page'` (`max-w-[210mm]`) ⇒ το στιγμιότυπο.
- `AgreementDocumentPreview.tsx:212` (`fit`), `AgreementDocumentColumns.tsx:75` (στήλες ανά γλώσσα).
- `src/components/file-manager/PdfCanvasViewer.tsx` — δικά του inline ZoomIn/ZoomOut/fit-width, wheel zoom, πλήκτρα +/−
  (γρ. ~236–431)· **όχι** κοινό component.

**Εγκεκριμένη κατεύθυνση (ζουμ, ΟΧΙ reflow — Word/Google Docs/Acrobat/DocuSign/PandaDoc):**
1. `paper-fit` → δύο τρόποι: **αυτόματο** «Προσαρμογή στο πλάτος» (προεπιλογή) + **χειροκίνητο** 50–200 %.
2. Μπάρα − / % / + / «Προσαρμογή» · Ctrl+ροδέλα **μόνο μέσα στο πλαίσιο** (όχι πάνω στο ζουμ του browser — Google Docs).
3. Η λεπτομέρεια χρησιμοποιεί τη ίδια προσαρμογή.
4. Πάνω από τους μεγάλους: ζουμ που κρατά στη θέση της **την παράγραφο ανάγνωσης** · **ένα** ζουμ για όλες τις γλωσσικές
   στήλες · προτίμηση **ανά χρήστη** · τύπωμα/PDF ανεπηρέαστα.

**Πρώτα (υποχρεωτικό):** πραγματικό SSoT audit με grep — (α) υπάρχει κοινό zoom/zoom-bar αλλού (`src/components/ui`,
`file-manager`, `dxf-viewer` toolbars); (β) **υπάρχει SSoT προτιμήσεων χρήστη** (ΔΕΝ ελέγχθηκε ακόμα) — μην χρησιμοποιήσεις
`localStorage` αν υπάρχει. Έρευνα στο διαδίκτυο όπου υπάρχει αμφιβολία (π.χ. anchor-preserving zoom, CSS `zoom` vs `transform`).
**Ανοιχτή απόφαση Giorgio**: εξαγωγή κοινής μπάρας από `PdfCanvasViewer` (αγγίζει file-manager) ή νέα μόνο για την υπεργολαβία;
Υποψήφια αρχεία: `paper-fit.ts` · νέο `DocumentZoomBar.tsx` (ή κοινό) · `AgreementDocumentColumns.tsx` · `AgreementDetailBody.tsx` ·
el/en locales · tests (τρέχουν μόνο με έγκριση). ⚠️ Τα αρχεία locale ⇒ ξανά `generate:i18n-types` + `generate:i18n-shell-slice`.

## Άλλες εκκρεμείς αποφάσεις Giorgio
- ADR-928: καταγραφή #1 + αποτελεσμάτων επαλήθευσης (§5.24.5 + changelog) — **μόνο με «ναι»**.

## Παγίδες (μετρημένες)
- **N.(-2)**: κανένα test/scan χωρίς έγκριση, καμία πρωτοβουλία, καμία ενημέρωση ADR/pending/MEMORY χωρίς «ναι».
- Ο φύλακας του worktree αρνείται `cd … && git …` ⇒ σκέτες εντολές git από τη ρίζα του worktree.
- Bash + `node -e` με backticks/`${}` ⇒ σπάει (το bash τα αναλύει) ⇒ αλλαγές κώδικα **μόνο με Edit**.
- `Grep` σε όλο το `src/components` ⇒ timeout· στόχευσε φακέλους.
- Hook: `CHECK_WORKER_TIMEOUT_MS=360000 git commit -F <msg>` στο παρασκήνιο (~6 λεπτά).
- Browser: συνδεδεμένος μόνο αφού συνδεθεί ο Giorgio· χώρος `o/comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757`·
  ΠΡΟΣ-2026-002 = `procurement/subcontracts/sca_8ca30024-8b27-46b8-b26b-ddc73e7fe3d4`. Ποτέ κωδικοί.

## Κανόνες (Giorgio)
- Commit **μόνο** στο `agent/adr-928-live-verify-2`, ρητή λίστα αρχείων. **Ποτέ** στο `main`. `wt:land`/push **μόνο** με εντολή.
- Όχι `tsc` · όχι `--no-verify` · όχι `git add -A` · όχι σκέτο `git stash`.
- Γνωστή κόκκινη εκτός εύρους: `src/lib/auth/__tests__/personal-scope-consumers.test.ts`.
