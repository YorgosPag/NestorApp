# Handoff — ADR-928 §5.25.2: προβολέας PDF (κύλιση/ζουμ/προσαρμογή) ΓΡΑΜΜΕΝΟΣ, commit ΜΠΛΟΚΑΡΙΣΜΕΝΟ από CHECK 3.115

**Ημερομηνία**: 2026-11-07 · **Worktree**: `C:\Nestor_Worktrees\adr-928-live-verify-2` · **Κλαδί**: `agent/adr-928-live-verify-2`
Η νέα συνεδρία συνεχίζει **σε αυτό** το worktree. Προηγούμενα: `HANDOFFS/2026-11-07_ADR-928_zoom-verified_next-bilingual-adr-fixes_handoff.md`.

## Κατάσταση
- Παραγωγή: `live b324537` (αμετάβλητη). Κλαδί: τελευταίο commit `b7697b4e`.
- **ΟΛΗ η δουλειά αυτής της συνεδρίας είναι ΣΤΑΔΙΟΠΟΙΗΜΕΝΗ, ΟΧΙ δεσμευμένη** (`git status` — 15 αρχεία + αυτό το handoff).
  Το commit απέτυχε στο **CHECK 3.115** (ADR-932) σε αρχεία που **δεν** αγγίξαμε:
  `src/i18n/locales/{el,en}/catalog-import.json` γρ. 51–57 — `xchange.onRequest · amountMissing · entryIncomplete ·
  allowanceSurcharges`: `{count}` χωρίς ICU `plural` (8 μηνύματα, ήρθαν από ADR-923 `d6e3a3db`/`64f81162` στο `main`).
  Όλες οι άλλες πύλες ΠΕΡΑΣΑΝ (3.28 · 3.33 · 3.34 · μεγέθη · i18n keys).

## ΕΠΟΜΕΝΟ (εντολή Giorgio: επιλογή «α»)
1. **Διόρθωση 8 μηνυμάτων πληθυντικού** στο `catalog-import.json` el+en → ICU `{count, plural, one {…} other {…}}`
   (el: `one`/`other` · en: `one`/`other`). Πρώτα: δες πώς τα καλεί ο κώδικας (`git grep "xchange.onRequest"` κ.λπ.) ώστε
   το `count` να είναι αριθμός· δες σχήμα σε ήδη διορθωμένα (`procurement.json`, ADR-932). Χωρίς αλλαγή κώδικα, εκτός αν
   ο καλών δεν στέλνει αριθμό. Ξαναπαραγωγή: `node scripts/generate-i18n-types.js` (+ shell slice αν αλλάξει).
2. **Commit 1** (ξεχωριστό): μόνο τα 2 locale + παραγόμενα, μήνυμα `fix(i18n): ICU plural … ADR-932`.
3. **Commit 2**: η σταδιοποιημένη δουλειά + αυτό το handoff, **ρητή λίστα** (δες κάτω). Μήνυμα έτοιμο:
   `C:\Users\user\AppData\Local\Temp\claude\181382094956c0a1\a5b386c1-d761-4f4f-a212-15ff69a330cb\scratchpad\commit-msg.txt`
   (αν λείπει, ξαναγράψ' το από την §5.25.2 του ADR-928).
4. Αναφορά στον Giorgio → **με εντολή του** `wt:land` + push → ζωντανή επαλήθευση του προβολέα PDF (λίστα κάτω).

### Ρητή λίστα αρχείων του commit 2
```
docs/centralized-systems/reference/adrs/ADR-928-subcontract-offer-agreement.md
src/components/file-manager/PdfCanvasViewer.tsx
src/components/file-manager/pdf-canvas-config.ts
src/components/file-manager/pdf-viewport-fit.ts            (νέο)
src/components/file-manager/pdf-viewport-gestures.ts       (νέο)
src/components/file-manager/usePdfViewport.ts              (νέο)
src/components/procurement/subcontracts/document/document-zoom-engine.ts
src/components/procurement/subcontracts/document/document-zoom-anchor.ts → src/components/shared/media/viewer/zoom-anchor.ts (git mv)
src/components/shared/media/viewer/DocumentZoomControl.tsx
src/i18n/generated/shell-slice.el.json
src/i18n/generated/shell-slice.manifest.json
src/i18n/locales/el/common.json        (common.documentZoom.fitPage)
src/i18n/locales/en/common.json
src/lib/geometry/zoom-pan-math.ts
src/types/i18n.ts
HANDOFFS/2026-11-07_ADR-928_pdf-viewer-scroll_plural-fix-then-commit_handoff.md
```
⚠️ Αν το commit 1 ξαναπαράγει τα `src/types/i18n.ts` / shell slice, το commit 2 πρέπει να τα ξαναπαράγει πάνω στο νέο
δέντρο (όχι χειρόγραφη ένωση).

## Τι έγινε σε αυτή τη συνεδρία (καταγεγραμμένο στο ADR-928 §5.25.1 · §5.25.2 · changelog)
- **§5.25.1** ζωντανός έλεγχος ζουμ εγγράφου 1–9 ✅, μαζί με **δίγλωσσο** (ΠΡΟΣ-2026-001 `sca_dd291abb-…`, «Αγγλικά»
  **χωρίς αποθήκευση**, επαναφέρθηκε· ένα ζουμ σε δύο στήλες: 150 % / «Προσαρμογή» ρευστή / «+» 110 %). Ανέλεγκτα: en · Firefox.
- **Μετρήσεις**: PDF στην «Προσαρμογή» έκρυβε 476 px πάνω + 476 px κάτω (overflow-hidden + items-center)· η σκέτη ροδέλα
  έκανε ζουμ ×1,1 ⇒ «220 → 182 %» εξηγήθηκε. «Skipping invalid FileRecord» **δεν αναπαράγεται** («Διαχείριση Αρχείων»,
  loglevel WARN)· υπόθεση `cad-files/dual-write-to-files.ts` (γέννηση χωρίς `storagePath`) ανεπιβεβαίωτη, χωρίς κώδικα.
- **§5.25.2 κώδικας** (Chrome PDF · pdf.js · Acrobat · Figma): πλαίσιο κύλισης + `m-auto` + `scrollbar-gutter: stable` ·
  σκέτη ροδέλα = κύλιση, Ctrl/⌘+ροδέλα/pinch/δύο δάχτυλα = ζουμ γύρω από τον δείκτη (rAF) · σύρσιμο = κύλιση · ζουμ
  παράγεται από τρόπο `width|page` (ResizeObserver, στροφή, κάθε σελίδα) · μέγεθος σε `useLayoutEffect` + άγκυρα, bitmap
  μετά από 120 ms · «Προσαρμογή στη σελίδα» στην κοινή μπάρα + Ctrl/⌘+`\` · σκέτα `=`/`-`/`0` μόνο χωρίς Ctrl/⌘.
  SSoT: `wheelDeltaPx`/`WHEEL_ZOOM_SENSITIVITY` → `zoom-pan-math` · άγκυρα → `shared/media/viewer/zoom-anchor` (+`verticalScroller`).

## Ζωντανή επαλήθευση μετά το push (προβολέας PDF, «Διαχείριση Αρχείων» → PDF)
Σελίδα από την κορυφή στην «Προσαρμογή» · ροδέλα κυλά (ζουμ αμετάβλητο) · Ctrl+ροδέλα ζουμ γύρω από τον δείκτη ·
−/+ σκάλα · μενού: «Προσαρμογή στο πλάτος» / «στη σελίδα» · Ctrl+`\` · σύρσιμο · αλλαγή πλάτους πάνελ ⇒ ακολουθεί ·
στροφή · σελίδες ⇒ κορυφή · επισημάνσεις (έλεγχος δίπλα-δίπλα, ADR-923) ακολουθούν · κινητό 390 px: κύλιση ενός δαχτύλου
(pinch δύο δαχτύλων ΔΕΝ δοκιμάζεται από το εργαλείο) · console καθαρό · σελίδα εγγράφου υπεργολαβίας: Ctrl+ροδέλα ίδια.

## Ανοιχτές αποφάσεις Giorgio
- Tests (ζουμ εγγράφου + προβολέας PDF + `editor-layout.test.tsx`) — μόνο με έγκριση.
- Πρόταση: **συνεχής κύλιση όλων των σελίδων** στον προβολέα PDF (προεπιλογή Chrome PDF / pdf.js / Acrobat) — ναι/όχι.
- Κλειδιά `files.preview.zoomIn/zoomOut/fitToWidth` αχρησιμοποίητα — διαγραφή;
- Ενοποίηση `ImageViewControls` / `FloorplanGalleryZoomControls` / `TourPlanZoomBar`· `wt:remove` — μόνο με εντολή.

## Παγίδες (μετρημένες)
- Φύλακας worktree: **σκέτες** εντολές git, μία-μία, χωρίς `cd …;` μπροστά, χωρίς `$(…)`, χωρίς ανακατεύθυνση `>`.
  Commit: `CHECK_WORKER_TIMEOUT_MS=360000 git commit -F <αρχείο>` με `run_in_background` (~6′).
- Hook output: ψάξε `❌` στο αρχείο εξόδου — το τέλος του log δείχνει μόνο πράσινα.
- Browser: συνδεδεμένος ο Giorgio· χώρος `o/comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757`· δοκιμαστικό έργο
  `proj_142e0e06-7ae1-4d92-82f3-41278b937ffa`. Το εργαλείο δεν πατά `+` (χρησιμοποίησε `=`)· μία εγκοπή `scroll` = ένα γεγονός.
- Γνωστή κόκκινη εκτός εύρους: `src/lib/auth/__tests__/personal-scope-consumers.test.ts`.

## Κανόνες (Giorgio)
- N.(-2): κανένα test χωρίς έγκριση, καμία πρωτοβουλία. Commit **μόνο** στο `agent/adr-928-live-verify-2`, ρητή λίστα.
  **Ποτέ** στο `main`. `wt:land`/push **μόνο** με εντολή. Όχι `tsc` · όχι `--no-verify` · όχι `git add -A` · όχι σκέτο `git stash`.
- Ποιότητα μεγάλων παικτών, full SSoT, **πραγματικό grep audit πριν από κάθε κώδικα**, έρευνα στο διαδίκτυο όπου υπάρχει αμφιβολία.
