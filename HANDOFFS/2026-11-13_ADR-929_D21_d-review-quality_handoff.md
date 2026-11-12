# HANDOFF — ADR-929 Δ21 (δ): η λίστα «Τι διάβασα» σε επίπεδο μεγάλων παικτών — 2026-11-13

- **Worktree:** `C:\Nestor_Worktrees\sketch-recognition` — η νέα συνεδρία συνεχίζει στο **ΙΔΙΟ** worktree.
- **Κλαδί:** `agent/sketch-recognition`
- **ADR:** `docs/centralized-systems/reference/adrs/ADR-929-raster-plan-recognition.md` → **Δ21**, ενότητα «Υλοποίηση (δ1) + (ε) — 2026-11-12», και changelog.
- ⚠️ **Commit μόνο στο κλαδί `agent/*`, ποτέ στο `main`. `wt:land` και push ΜΟΝΟ με ρητή εντολή του Giorgio** (δική του εντολή 2026-11-13, υπερισχύει του «commit ⇒ αμέσως land»).
- ⚠️ Η γραμμή **Status** του ADR-929 ΔΕΝ ενημερώθηκε επίτηδες: την αλλάζει ο άλλος πράκτορας (worktree `raster-plan-recognition`, §6.16, αρχεία `ocr/*`) ⇒ σύγκρουση. Ενημερώνεται την ώρα του land.
- Ποτέ tsc (N.17). Κανένα test έξω από όσα εγκρίθηκαν παρακάτω.

## 1. Τι έγινε (δεσμευμένο στο κλαδί μαζί με αυτό το handoff)

(δ1) + (ε) του Δ21, πλήρως περιγραμμένα στο ADR-929 Δ21 «Υλοποίηση (δ1) + (ε)». Σύντομα:
- `bim/plan-recognition/reading/written-values.ts` — «μ.μ.» / «μ.μ» = μέτρα («μμ» όχι).
- `bim/plan-recognition/ocr/ocr-reading.ts` — σταθερή ταυτότητα κειμένου (θέση στην πλήρη έξοδο του OCR, φίλτρο όψης μετά: `OcrReadingInput.view`).
- `bim/plan-recognition/reading/reading-corrections.ts` (νέο, καθαρό) — `applyReadingCorrections` · `withReadingCorrection` · `NO_READING_CORRECTIONS`· προέλευση `PlanText.correctedFrom`· διορθώσεις ανά ανάγνωση (`model`).
- `systems/plan-recognition/plan-reading-corrections.ts` (νέο) — υπο-ελεγκτής του ενός γραφέα: `planRecognitionSession.corrections.{correct, markNotDimension, revert, hover}`.
- `systems/plan-recognition/plan-recognition-session.ts` — `fuseWith(run, reading, corrections)` + `fuse` (το ΕΝΑ σημείο εφαρμογής)· `adoptReading` σβήνει τις διορθώσεις.
- `systems/plan-recognition/plan-recognition-store.ts` — `readingCorrections` + `readHoverTextId`.
- `systems/plan-recognition/plan-read-values.ts` (νέο, καθαρό) — `planReadValueRows` (πιο ύποπτη πρώτη).
- `ui/panels/model-from-drawing/PlanReadValuesSection.tsx` (νέο) — η λίστα· σύνδεση: `app/usePlanRecognitionWiring.ts` (`useReadValues`, `READ_VALUES_ACTIONS`) → `app/ModelFromDrawingHost.tsx` → `ModelFromDrawingPanel.tsx` · `ImageSourceView.readValues`.
- `components/dxf-layout/PlanReadValueHoverOverlay.tsx` (νέο φύλλο, ADR-040) — mounted στο `canvas-layer-stack-2d-overlays-leaf.tsx`· κοινό `sceneTextRing` στο `plan-overlay-geometry.ts`.
- i18n `modelFromDrawing.image.ocr.values.*` (el + en, `dxf-viewer-shell.json`) + αναπαραγωγή `src/types/i18n.ts`.
- ADR-040 changelog (2026-11-12, νέο φύλλο).
- Tests: `written-values` (+ Δ21 (ε)) · `reading-corrections` · `plan-read-values` · `PlanReadValuesSection` ⇒ **65/65 πράσινα**. Το fixture του `ModelFromDrawingPanel.test.tsx` πήρε το νέο πεδίο (δεν έτρεξε ακόμη).

## 2. Αποφάσεις Giorgio (2026-11-13): «ΝΑΙ ΣΕ ΟΛΑ»

- **Και τα 8 βήματα παρακάτω εγκρίθηκαν**, με τη σειρά **8 → 5 → 3 → 4 → 7 → 2 → 1 → 6**.
- **Tests εγκρίθηκαν** για ό,τι υλοποιηθεί (γράψιμο + εκτέλεση, στοχευμένο jest).
- **Εγκρίθηκε** να τρέξουν οι υπάρχουσες σουίτες που επηρεάζονται: `ocr-reading` · `plan-ocr-controller` · `plan-recognition-flow` · `ModelFromDrawingPanel` · `plan-scale-card` (όλες στο `src/subapps/dxf-viewer/**/__tests__/`). Πρώτη δουλειά της νέας συνεδρίας: τρέξ' τες, γιατί άλλαξαν `ocr-reading.ts` / `plan-ocr-controller.ts` / session / panel.
- Ποιότητα: επίπεδο Revit / ArchiCAD / Cinema 4D / Figma / Zillow / Idealista, full enterprise + full SSoT, χωρίς εκπτώσεις· αν οι μεγάλοι κάνουν αλλιώς, ακολουθούμε αυτούς· όπου δεν είσαι σίγουρος ⇒ έρευνα στο διαδίκτυο.
- **ΠΡΙΝ από κάθε κώδικα: πραγματικό SSoT audit με grep** (υπάρχει ήδη αντίστοιχο; ⇒ χρησιμοποίησέ το, κανένα διπλότυπο). Διάβασε `docs/centralized-systems/README.md` + `.ssot-registry.json`.
- Εκτός: (δ2) «προσθήκη διάστασης που λείπει» και μόνιμη αποθήκευση / μάθηση διορθώσεων (Φ8) — επόμενα βήματα.

## 3. Τα 8 βήματα (εγκεκριμένα)

| # | Βήμα | Σημειώσεις / πού να ψάξεις πρώτα (SSoT) |
|---|---|---|
| **8** | **Μία** μετατροπή «κείμενα → διαστάσεις με τιμή» αντί για τρεις: `dimensionsOf` στο `ocr/ocr-reading.ts` · `dimensionsOf` στο `reading/plan-reading-from-view.ts` · `correctedDimensions` στο `reading/reading-corrections.ts`. Ο κανόνας μονάδων είναι ήδη κοινός (`writtenLengthsMm`)· διαφέρουν στην πηγή της λίστας (όλα τα κείμενα `dimension` · οι διαστάσεις του VLM με `segmentIds` · αρχικές + διορθωμένες). | Ένα καθαρό σημείο στο `reading/`, οι τρεις το καλούν. `jscpd:diff` στα δικά σου αρχεία πριν το «done» (N.18 — εγκεκριμένο ως μέρος των tests). |
| **5** | Ζωντανή ερμηνεία στο πεδίο διόρθωσης: καθώς γράφεις, «= 4120 mm» ή «η μονάδα δεν αποδεικνύεται», πριν το Enter. | Η ερμηνεία από τον ΙΔΙΟ κανόνα (`classifyWrittenText` / `parseDimensionValue` + η μονάδα των ακεραίων **του σχεδίου**, `inferBareIntegerUnit`) — όχι δεύτερη λογική στο UI. |
| **3** | «Σωστό ✓»: επιβεβαίωση χωρίς αλλαγή τιμής ⇒ προέλευση «άνθρωπος», βεβαιότητα 1· πρόοδος «N/M ελέγχθηκαν». | Νέο είδος στο `PlanReadingCorrection` (π.χ. `confirmed`)· `correctedFrom` σημαίνει σήμερα «διορθώθηκε» — αποφάσισε καθαρά πώς φαίνεται η επιβεβαίωση (Δ9), χωρίς να μπερδευτούν. |
| **4** | Ετικέτες προτεραιότητας στη γραμμή («ύποπτη» · «ελέγχθηκε» · «εντάξει»), όχι μόνο σειρά. | Υπάρχοντα `PLAN_CONFIDENCE_MARKS` / `planConfidenceMark` / `planConfidenceTier` (`systems/plan-recognition/plan-confidence.ts`), CHECK 3.41 (διάκριση και με σχήμα, όχι μόνο χρώμα). |
| **7** | **Πάνω από τους μεγάλους:** για τιμή σε σύγκρουση, «Πρόταση: 4,12 — από τις υπόλοιπες διαστάσεις», αποδοχή με ένα κλικ. | Η εκτίμηση υπάρχει ήδη: `FusedDimension.adjustedMm` (συνόρθωση, `fusion/adjustment-network.ts`). Η πρόταση γράφεται ως **κείμενο** με την ακρίβεια γραφής του σχεδίου (`precisionMm`) και περνά από τον ίδιο δρόμο `correct`. Επιβεβαίωσε με ανάγνωση κώδικα ότι το `adjustedMm` μιας απορριφθείσας παρατήρησης είναι η εκτίμηση από τις **υπόλοιπες**. |
| **2** | «Εστίαση στην πηγή»: ξεχωριστό κουμπί ⇒ ζουμ + μετακίνηση καμβά στο κείμενο (Δ9). Το κλικ στο κείμενο μένει «διόρθωση». | Ψάξε τον υπάρχοντα μηχανισμό εστίασης του βοηθού (`focusProposalItem` στο `app/ModelFromDrawingHost.tsx`) και την αντιστοίχιση px → σκηνή (`rasterPixelToScene`). Καμία δεύτερη υλοποίηση zoom-to-rect. |
| **1** | Μικρογραφία του αποσπάσματος της εικόνας μέσα σε κάθε γραμμή (η τιμή δίπλα στο τεκμήριό της — πρακτική Microsoft Content Understanding). | Ψάξε υπάρχουσα περικοπή εικόνας: `reading/plan-reading-view-raster.ts`, `systems/plan-recognition/plan-reading-review.ts` (μικρογραφία πακέτου, `previewUrl` / `objectUrl` με ανάκληση). Χωρίς inline styles (N.3)· ανάκληση URL στο κλείσιμο. |
| **6** | Πλήκτρα όπως στο Figma: ↑/↓ γραμμή · Enter διόρθωση · Space «Σωστό» · N «δεν είναι διάσταση». | Κεντρικό escape / keyboard bus του έργου (δες hub «Keyboard ownership»: bus > Radix)· το Esc του πεδίου ήδη κάνει `stopPropagation`. |

## 4. Έρευνα (2026-11-13) — τι κάνουν οι μεγάλοι

- Revit / ArchiCAD / Bluebeam / magicplan: **καμία** ανάλογη ροή — βαθμονόμηση με δύο σημεία, το μήκος το πληκτρολογεί ο άνθρωπος. Για το Bluebeam δεν βρέθηκε τεκμηρίωση για διόρθωση τιμών του OCR.
- Google Document AI (HITL): βεβαιότητα 0–100 ανά πεδίο, κατώφλι ανά πεδίο, ουρά ελέγχου, **χαμηλή βεβαιότητα πρώτη** — https://docs.cloud.google.com/document-ai/docs/hitl/concepts?hl=en · https://docs.cloud.google.com/document-ai/docs/hitl/whats-new
- Microsoft Content Understanding (Οκτ. 2026): βεβαιότητα = σήμα **ιεράρχησης**, όχι αυτόματη έγκριση· **grounding** (η τιμή μαζί με το τεκμήριο της πηγής)· ετικέτες προτεραιότητας· κάθε ελεγμένο αποτέλεσμα = παράδειγμα για βαθμονόμηση — https://devblogs.microsoft.com/foundry/content-understanding-confidence-grounding-hitl/ · https://learn.microsoft.com/azure/ai-services/document-intelligence/concept-accuracy-confidence
- Togal.AI: το AI είναι αφετηρία που διορθώνει ο εκτιμητής· «η διόρθωση το μαθαίνει» = ισχυρισμός του προμηθευτή — https://help.togal.ai/en/articles/15602901-ai-powered-area-and-wall-detection
- Πρόταση διόρθωσης από τη συνόρθωση (βήμα 7): **δεν βρέθηκε** σε προϊόν — απουσία στοιχείων, όχι απόδειξη.

## 5. Μετά τα 8 βήματα

Ζωντανή μέτρηση DOC014 με τη λίστα (`\\GIORGIO-PC\XeroxScan\DOC014.pdf`, όροφος «2ος Όροφος»: ποιες τιμές διαβάζει πραγματικά το OCR) → (0) είδος `sketch` → (β) → (α) → (γ) → (στ) → (δ2). Κάθε βήμα με έγκριση Giorgio. Οι 8 άγνωστες πολυγραμμές του «2ος Όροφος» ίσως είναι ισοϋψείς ⇒ **δεν τις αγγίζουμε**.

## 6. ΜΗΝ

- Μην κάνεις commit στο `main`· μην τρέξεις `wt:land` / push χωρίς εντολή.
- Μην τρέξεις tsc.
- Μην αλλάξεις τη γραμμή Status του ADR-929.
- Μην αγγίξεις τα `ocr/*` πέρα από το απολύτως αναγκαίο (άλλος πράκτορας).
- Μη γράψεις δεύτερο κανόνα μονάδων ή δεύτερη σύντηξη: όλα περνούν από `written-values.ts` και από τη `fuse` της συνεδρίας.
