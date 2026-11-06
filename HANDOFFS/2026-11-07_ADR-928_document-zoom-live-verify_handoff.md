# Handoff — ADR-928: ζωντανή επαλήθευση ζουμ σελίδας εγγράφου (§5.25) + #1

**Ημερομηνία**: 2026-11-07 · **Worktree**: `C:\Nestor_Worktrees\adr-928-live-verify-2` · **Κλαδί**: `agent/adr-928-live-verify-2`
Η νέα συνεδρία συνεχίζει **σε αυτό** το worktree (EnterWorktree path).
Προηγούμενο: `HANDOFFS/2026-11-06_ADR-928_document-zoom_handoff.md`.

## Κατάσταση (όλα στην παραγωγή — `live b47f2bc`)
- ✅ `9929f40a` — **#1**: επιβεβαίωση πριν «Έκδοση»/«Αποδοχή» (`subcontract-row-actions.ts` `CONFIRMED_TRANSITIONS`,
  `useAgreementTransition.ts`, `confirm.issue/accept/acceptOffer` el/en). Καμία ειδοποίηση δεν στέλνεται.
- ✅ `2181cb90` — **ζουμ σελίδας εγγράφου** (ADR-928 §5.25, γραμμένο + changelog).
- Το δικό μου commit πληθυντικού (`dxf-viewer-shell` leftOut/lowExcluded) **παραλείφθηκε** στο rebase: το `main` είχε
  ήδη την ίδια διόρθωση από ADR-929 (`2fc2f397`). Το CHECK 3.115 δεν μπλοκάρει πια.
- Land + push έγιναν με εντολή Giorgio (`2fc2f397..b47f2bc7`). Tests του ζουμ: **ούτε γράφτηκαν ούτε έτρεξαν**.

## Τι υλοποιήθηκε (χάρτης — μην ξαναγράψεις)
- `src/components/procurement/subcontracts/document/`:
  - `paper-fit.ts` — καθαρό: `paperFitOf` · `commonPaperFitOf` (στενότερη στήλη) · `paperLayoutOf(mode, widths)` ·
    `applyPaperLayout` · `PAPER_ZOOM_LIMITS` 0,5–2 · `PaperZoomMode` (`fit` | `manual`). Το `usePaperFit` και το `fit` prop **διαγράφηκαν**.
  - `document-zoom-engine.ts` — μία μηχανή ανά έγγραφο, στήλες `registerColumn`, ResizeObserver, Ctrl/⌘+ροδέλα μόνο πάνω
    στη σελίδα, `step` (σκάλα) / `zoomTo` / `fit`, `{zoom, fitted}` μέσω `useSyncExternalStore`, debounce 300 ms, `flush`.
  - `document-zoom-anchor.ts` — άγκυρα σε κλάσματα σελίδας: ροδέλα = σημείο δείκτη, κουμπιά = παράγραφος ανάγνωσης.
  - `document-zoom-preference.ts` — `STORAGE_KEYS.DOCUMENT_ZOOM_PREFIX` + uid, αποθηκεύει τον **τρόπο**.
  - `DocumentZoomContext.tsx` (`DocumentZoomProvider`, `useDocumentZoomColumn`, `useAuthOptional`) · `DocumentZoomBar.tsx`.
- `src/components/shared/media/viewer/DocumentZoomControl.tsx` — **κοινή** μπάρα (− · μενού % με radio · + · ↔ `aria-pressed`,
  `role="status"` μόνο μετά από ενέργεια) · `ViewerToolbarButton` + `pressed`.
- `src/lib/geometry/zoom-pan-math.ts` — `ZOOM_LADDER` (Chrome) · `ZOOM_MENU_PRESETS` · `ladderZoom` · `zoomPresetsWithin`.
- `PdfCanvasViewer.tsx` — χρησιμοποιεί την κοινή μπάρα (σκάλα στα κουμπιά, τροχός αμετάβλητος, `fitted` state).
- Θέση μπάρας: λεπτομέρεια (`AgreementDetailBody` ReadOnlyBody, κολλημένη κεφαλίδα) · επεξεργαστές (`AgreementEditor`,
  `TemplateEditor` → `EditorSplitLayout.previewTools`, και στο κινητό). Παράθυρο προεπισκόπησης: **χωρίς** πάροχο ⇒ Α4 στο κέντρο.
- i18n: `common.documentZoom.{label,zoomIn,zoomOut,fitWidth,level}` el/en.

## ΕΠΟΜΕΝΟ: ζωντανή επαλήθευση στην παραγωγή (χωρίς εγγραφή δεδομένων)
Browser: συνδεδεμένος **μόνο αφού συνδεθεί ο Giorgio** · ποτέ κωδικοί · χώρος `o/comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757` ·
ΠΡΟΣ-2026-002 = `procurement/subcontracts/sca_8ca30024-8b27-46b8-b26b-ddc73e7fe3d4`.
1. Λεπτομέρεια ΠΡΟΣ-2026-002: «Προσαρμογή» γεμίζει το πλάτος (όχι στενή στήλη) · −/+ (σκαλιά 90/100/110…) · μενού % ·
   ↔ πατημένο όταν ισχύει η προσαρμογή · όρια 50 % / 200 %.
2. Ctrl+ροδέλα **πάνω** στη σελίδα ⇒ ζουμ γύρω από τον δείκτη· **έξω** ⇒ ζουμ browser. Κουμπιά ⇒ η πρώτη ορατή παράγραφος
   μένει στη θέση της (μέτρα `getBoundingClientRect` πριν/μετά). Μεγάλο ζουμ ⇒ οριζόντια κύλιση στη στήλη.
3. F5 ⇒ το ζουμ μένει (localStorage `nestor:document-zoom:v1:<uid>`, τιμή `{mode,zoom}`). «Προσαρμογή» ⇒ μένει προσαρμογή.
4. Δίγλωσσο έγγραφο (αν υπάρχει) ⇒ **ένα** ζουμ σε όλες τις στήλες · en locale · κινητό 390 px (καμία οριζόντια κύλιση σελίδας).
5. Επεξεργαστής (πρόχειρο ή πρότυπο): μπάρα στην κεφαλίδα δίπλα στο «Μόνο έγγραφο» · σύρσιμο διαχωριστικού σε «Προσαρμογή».
6. Προβολέας PDF σε ένα αρχείο: −/% μενού/+/↔ · τροχός · πλήκτρα +/−/0.
7. #1: «Έκδοση» / «Αποδοχή» ανοίγουν διάλογο επιβεβαίωσης ⇒ **Ακύρωση** (καμία μετάβαση).
8. Console: κανένα σφάλμα/ωμό κλειδί.
Ευρήματα ⇒ αναφορά στον Giorgio· διόρθωση μόνο με έγκριση· καταγραφή στο ADR-928 §5.25 μόνο με «ναι».

## Ανοιχτές αποφάσεις Giorgio
- Tests ζουμ (σκάλα · μηχανή 1/2 στηλών · τρόποι · προτίμηση · μπάρα) + το υπάρχον `editor-layout.test.tsx` — μόνο με έγκριση.
- Τα κλειδιά `files.preview.zoomIn/zoomOut/fitToWidth` δεν διαβάζονται πια — διαγραφή;
- Οι άλλες 3 μπάρες ζουμ (`ImageViewControls`, `FloorplanGalleryZoomControls`, `TourPlanZoomBar`) — πρόταση ενοποίησης αργότερα;
- #2 (toast «Έκδοση εντολής») θέλει αμετάκλητη δοκιμαστική εντολή ⇒ μόνο με «ναι». #3 δεν αναπαράγεται.
- `wt:remove` του worktree — μόνο με εντολή.

## Παγίδες (μετρημένες)
- **N.(-2)**: κανένα test/scan χωρίς έγκριση, καμία πρωτοβουλία, καμία ενημέρωση ADR/pending/MEMORY χωρίς «ναι».
- Ο φύλακας του worktree αρνείται σύνθετες εντολές git (`$(...)`, `&&` με git, heredoc) ⇒ σκέτες εντολές git, μία-μία.
- Το `src/types/i18n.ts` έχει αποτύπωμα sha256 **όλων** των locales ⇒ για commit μόνο μέρους: `node scripts/generate-i18n-types.js --index`.
- Σύγκρουση σε παραγόμενα (i18n.ts, shell-slice manifest) στο rebase ⇒ `checkout --theirs` + ξαναπαραγωγή, ποτέ χειρόγραφη ένωση.
- Hook: `CHECK_WORKER_TIMEOUT_MS=360000 git commit -F <msg>` στο παρασκήνιο (~6′)· `wt:land` κάνει rebase+πλήρες hook.
- `Grep` σε όλο το `src/components` ⇒ timeout· στόχευσε φακέλους ή `git grep`.
- Γνωστή κόκκινη εκτός εύρους: `src/lib/auth/__tests__/personal-scope-consumers.test.ts`.

## Κανόνες (Giorgio)
- Commit **μόνο** στο `agent/adr-928-live-verify-2`, ρητή λίστα αρχείων. **Ποτέ** στο `main`. `wt:land`/push **μόνο** με εντολή.
- Όχι `tsc` · όχι `--no-verify` · όχι `git add -A` · όχι σκέτο `git stash`.
- Ποιότητα μεγάλων παικτών, full SSoT, grep πριν από κάθε αρχείο, έρευνα στο διαδίκτυο όπου υπάρχει αμφιβολία.
