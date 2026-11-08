# HANDOFF — ADR-923 §5.15 Φάση 9 · Θ.2α-2 ✅ (main + push) → επόμενο Θ.2α-3 (μικρογραφίες + περιεχόμενα)

**Ημερομηνία:** 2026-11-08
**Worktree:** `C:\Nestor_Worktrees\catalog-editions` · **κλαδί:** `agent/catalog-editions` (η νέα συνεδρία συνεχίζει **στο ίδιο** worktree)
**git:** Θ.2α-1 + Θ.2α-2 ενωμένα από το `wt:land` στο **`8c976edd`** στο `main` · **push έγινε** (`5cf4c4a4..8c976edd`, με εντολή Giorgio).
Μετά το land το κλαδί = `main`· πάνω του μόνο το commit αυτού του handoff. Επόμενο `wt:land` / push **μόνο με εντολή Giorgio**. **Ποτέ** commit στο `main`.
**ADR:** `docs/centralized-systems/reference/adrs/ADR-923-supplier-product-catalog-pim.md` — διάβασε **§5.15, §5.15.1, §5.15.2** ολόκληρες (η γραμμή Θ.2α-2 περιγράφει όλο τον σημερινό σχεδιασμό του viewer).
**Προηγούμενα handoffs (ιστορικό, όχι υποχρεωτικά):** `HANDOFFS/2026-11-08_ADR-923_phase9-T2a1-done-T1b-live-verified_next-T2a2-viewer-layers_handoff.md` (μετρήσεις του αληθινού `screen.pdf` §2).

## 1. Κατάσταση
| Τι | Κατάσταση |
|---|---|
| Θ.2α-2 κώδικας + ADR | ✅ στο `main` (`8c976edd`), pre-commit ξανάτρεξε πάνω στο τρέχον `main` και πέρασε |
| Push | ✅ `origin/main = 8c976edd` (επαληθευμένο με `git ls-remote`) |
| Deploy Netcup | ⏳ «T1 🚀 Build & Deploy Docker Image» ήταν `in_progress` στη σύνταξη — **έλεγξε** `gh run list --branch main --limit 40` |
| Άγκυρες `pdf-reader-layers.test.ts` + `pdf-range-transport.test.ts` | Γραμμένες, **ΔΕΝ έτρεξαν** — θέλουν έγκριση Giorgio |
| Ζωντανή επαλήθευση Θ.2 | ❌ αδύνατη ακόμη: **καμία οθόνη** δεν περνά `features` ούτε `license` (έρχεται στο Θ.3) |

## 2. Πώς είναι σήμερα ο ΕΝΑΣ viewer (`src/components/file-manager/`)
- `PdfCanvasViewer.tsx` (262 γρ.) — κατάσταση + σύνθεση· `usePdfPageRender`, `usePdfKeyboard`, `usePdfPageNavigation` (`goToPage` = η μία πόρτα πλοήγησης), `PdfPageStage` (canvas → `PdfTextLayer` → `PdfHighlights` → `PdfLinkLayer`).
- `pdf-canvas-config.ts` — `PdfCanvasViewerProps`, **`PdfViewerFeatures`** (`textSelection` · `links` · `pageInUrl` · `download{fileName}`, opt-in), ελάχιστοι τύποι `PdfDocProxy`/`PdfPageProxy`, `loadPdfJs`, `PDF_RENDER_SETTLE_MS`.
- `usePdfDocument.ts` (ένας κάτοχος φόρτωσης, `sourceIdentityOf`) · `pdf-range-transport.ts` (άδεια 15′, κομμάτια 256KB, `disableAutoFetch`) · `usePdfCurrentPage.ts` (ένα `getPage` ανά σελίδα) · `usePdfViewport.ts` (ζουμ/κύλιση) · `pdf-viewport-gestures.ts` (το «χέρι» εξαιρεί κείμενο/συνδέσμους).
- `PdfTextLayer.tsx` + `pdf-text-layer.module.css` · `PdfLinkLayer.tsx` + `pdf-link-target.ts` · `usePdfPageInUrl.ts` (`#page=N`, `pdfPageFragment`) · `usePdfDownload.ts` · `PdfViewerToolbar.tsx` (μπάρα, `ToolButton`).
- Καλούντες: `FilePreviewRenderer.tsx`, `ImportBatchWorkspace.tsx` — **χωρίς** `features` (αμετάβλητοι).

## 3. Επόμενο: Θ.2α-3 — πλευρικό πάνελ: μικρογραφίες + περιεχόμενα (§5.15.2)
**ΠΡΩΤΑ πραγματικό SSoT audit με grep**, μετά Plan Mode. Σημεία εκκίνησης (ΔΕΝ είναι συμπέρασμα — επαλήθευσε):
- **Μικρογραφίες από το ΙΔΙΟ έγγραφο** (`docRef`) — ποτέ δεύτερο `getDocument` (σε έντυπο με άδεια θα ήταν δεύτερη λήψη). Υπάρχουν 4 client loaders/thumbnailers με δικό τους pdf.js (`shared/files/hooks/usePdfThumbnail.ts`, `shared/files/utils/generate-upload-thumbnail.ts`, `thumbnail-generator`, dxf `PdfRenderer`) — **δες τι ξαναχρησιμοποιείται** (μέγεθος, κλίμακα, cache) χωρίς να τους αγγίξεις χωρίς έγκριση (handoff Θ.2α-1 §5: πρόταση «ένας loader»).
- ⚠️ **Range + μικρογραφίες**: κάθε μικρογραφία = `getPage` + render ⇒ σε έντυπο με άδεια **κατεβάζει κομμάτια**. Μόνο οι **ορατές** (IntersectionObserver + virtualization για 300+ σελίδες), χαμηλή ανάλυση, ακύρωση στο scroll, ουρά με όριο ταυτόχρονων. Έρευνα: πώς το κάνουν pdf.js viewer (`PDFThumbnailViewer`: «ζωγραφίζει από το canvas της σελίδας όταν υπάρχει»), Acrobat, Chrome PDF — και αν γίνεται εξυπνότερα (π.χ. μικρογραφία από το ήδη ζωγραφισμένο bitmap της τρέχουσας σελίδας, μηδέν bytes).
- **Περιεχόμενα** από `doc.getOutline()` (το `screen.pdf` έχει 2 σελιδοδείκτες, ένας ελληνικός): προορισμός → σελίδα μέσω του **υπάρχοντος** `resolvePdfDestinationPage` (`pdf-link-target.ts`) — όχι δεύτερος λύτης· δέντρο με πληκτρολόγιο (ARIA tree), ενεργή ενότητα = η τρέχουσα σελίδα.
- Πάνελ: έλεγξε αν υπάρχει κοινό collapsible side panel / tabs στο design system πριν φτιάξεις· κουμπί εναλλαγής στη `PdfViewerToolbar`· νέο `feature` (π.χ. `sidebar`) opt-in.
- Επέκταση `PdfDocProxy` με `getOutline` (τύπος από `pdfjs-dist`).
- i18n `files.pdf.*` σε el **και** en· μετά `npm run generate:i18n-types` και `npm run generate:i18n-shell-slice:index` (CHECK 3.33/3.34 — τα route slices των 4 διαδρομών του viewer αλλάζουν).
- Όρια: αρχεία < 500 γρ., συναρτήσεις ≤ 40 γρ., όχι inline style σε JSX (μεγέθη προστακτικά όπως `usePdfViewport`), CSS module μόνο με tokens/`transparent`/system colors (CHECK 3.43).
- ADR-923 §5.15.2: γραμμή Θ.2α-3 + changelog **στο ίδιο commit**.

Μετά: **Θ.2β + Θ.2α-4** (ευρετήριο κειμένου στον διακομιστή στη δημοσίευση — αγγίζει τον writer του Θ.1β· αναζήτηση στον browser) → **Θ.3** οθόνες (εκεί πρώτη ζωντανή επαλήθευση όλου του Θ.2).

## 4. Μαθήματα της συνεδρίας
- Το `wt:land` κάνει rebase + **ένωση σε ένα commit**: στη διάρκειά του το worktree δείχνει όλα τα αρχεία του κλαδιού σταδιοποιημένα — **κανονικό**, μην αγγίζεις τίποτα ώσπου να τελειώσει.
- CHECK 3.34 μπλοκάρει όταν νέα κλειδιά `files.pdf.*` μπαίνουν στα route slices των διαδρομών του viewer ⇒ `npm run generate:i18n-shell-slice:index` και σταδιοποίηση **μόνο** των αρχείων που άλλαξαν.
- Ο hook τρέχει μόνος του τη «Type Safety» (12 σουίτες) σε κάθε commit — δεν είναι δική μας εκτέλεση tests.
- `useNotifications` **πετά** έξω από τον πάροχο (ζει μόνο σε `(app)`/`(me)`) ⇒ σε επιφάνειες που θα φτάσουν στη βιτρίνα, σφάλματα μέσα στο component.

## 5. Προτάσεις εκτός εντολής (ΔΕΝ γίνονται χωρίς «ναι» Giorgio)
- Οι επισημάνσεις του `PdfHighlights` δεν ακολουθούν τη στροφή (οι σύνδεσμοι ναι, με `pdfLinkRegionOf`).
- 5 client loaders του pdf.js με σκληρό `'/pdf.worker.min.mjs'` ⇒ ένας loader.
- `ImportBatchWorkspace` περνά `url=""` ⇒ η «Πλήρης οθόνη» ανοίγει κενή καρτέλα.

## 6. ΜΗΝ
- ΜΗΝ commit στο `main` · `wt:land`/push μόνο με εντολή · ΜΗΝ tsc (N.17) · ΜΗΝ tests χωρίς έγκριση
- ΜΗΝ δεύτερος προβολέας PDF · ΜΗΝ δεύτερο `getDocument` για μικρογραφίες · ΜΗΝ δημόσιος μόνιμος σύνδεσμος GCS / `attachment` · ΜΗΝ μέτρηση λήψης στην προβολή
- ΜΗΝ έκδοση με τιμές (Θ4) · ΜΗΝ γράψιμο στην παραγωγή χωρίς ρητή έγκριση ανά βήμα
