# Handoff — ADR-929 · μεταλλάξεις 9/9 ✅ (Π-12 διορθώθηκε, `ac237914`) · Φάση 0 «τοπικό OCR» εγκρίθηκε · επόμενο: νέο venv για ONNX

**Ημερομηνία:** 2026-11-10 (17η συνεδρία) · **Worktree:** `C:\Nestor_Worktrees\raster-plan-recognition` · **Κλαδί:** `agent/raster-plan-recognition`
**Προηγούμενο:** `HANDOFFS/2026-11-10_ADR-929_live-verified_158-tests-green_next-mutations-then-dimension-layers-decision_handoff.md`
**Εγκεκριμένο σχέδιο:** `C:\Users\user\.claude\plans\scalable-gathering-crab.md` (διάβασέ το ΟΛΟ πρώτα).

## Κανόνες (Giorgio) — αμετάβλητοι
Κάθε βήμα μόνο με «ναι» · κανένα test χωρίς έγκριση · όχι tsc · SSoT audit με grep πριν από κώδικα · έρευνα διαδικτύου όπου
δεν είσαι σίγουρος · ποιότητα Revit/ArchiCAD/Cinema 4D/Figma/Zillow/Idealista+ · commit μόνο στο `agent/*` με ρητή λίστα ·
ποτέ στο main · `wt:land`/push μόνο με εντολή · ερωτήσεις σε απλά λόγια με παράδειγμα · ελληνικά.
⚠️ Ο φύλακας του worktree αρνείται: σύνθετα bash, και **`wsl`** εντελώς. Docker **δεν** υπάρχει. Python εκτός repo: τρέχει
με `cd /c/Nestor_Worktrees/raster-plan-recognition && <venv>/Scripts/python.exe -I <script>` (σενάρια στο scratchpad).
⚠️ Κανένα όνομα/διαδρομή της εικόνας δοκιμής στην οθόνη της εφαρμογής.

## 1. Μεταλλάξεις (Βήμα 1) — ΕΚΛΕΙΣΑΝ
Script `mutate.js` (scratchpad 17ης συνεδρίας· επαναφορά στο `finally`). 6 σουίτες, βάση 83/83 → μετά τη διόρθωση 85/85.
Μα · Μγ · Μ1 · Μ2 · Μ3 · Μ4 · Μ5 · Μ6: **όλες πιάστηκαν** όπου αναμενόταν (Μα: 11 κόκκινα, και Π-11· Μ5: και 1 της συνεδρίας κουφωμάτων).
**Μδ (χωρίς φίλτρο 7β):** το Π-12/250 έμενε πράσινο. Διάγνωση (μετρημένη): στο 250 τα ζεύγη παρειών και καπακιών ισοβαθμούν
(απόσταση 250)· με τις παρειές πρώτες το κενό δεν γεμίζει ούτως ή άλλως· με τα καπάκια πρώτα (όπως στην πραγματική σάρωση) γεμίζει.
**Διόρθωση `ac237914`** (μόνο test): το Π-12 τρέχει και τις δύο σειρές γραμμών· Μδ ⇒ κοκκινίζει και το 250/caps-first. Pre-commit ✅.
⚠️ Το ADR-929 **δεν** ενημερώθηκε για τις μεταλλάξεις/διόρθωση (θέλει «ναι» — μπαίνει στο βήμα 0.7 μαζί με τη ζωντανή επαλήθευση της 16ης).

## 2. Βήμα 2 — audit + έρευνα + απόφαση Giorgio
**Υπάρχουν ήδη (grep):** ρόλοι τμήματος (`classify/segment-role-classifier.ts`, §6.7) · ανοίγματα διαστάσεων/αλυσίδες
(`fusion/dimension-spans.ts`, §6.8) · **λύτης Baarda (`fusion/adjustment-network.ts`) ελέγχει ήδη άθροισμα αλυσίδας ↔ ολική
μέσα από κοινούς αγνώστους** (Δ8) και ονομάζει ποια διάσταση φταίει · πινακίδα (`alignment/sheet-layout.ts`, ISO 7200) ·
`DimensionEntity` (`types/dimension.ts`) + κατασκευαστές (`hooks/dimensions/dimension-create-entity-builder.ts`, `systems/dimensions/auto/`) ·
τοίχοι αναγνώρισης στο layer του ορόφου (`layerId: levelId`).
🔴 **Φραγμός:** στη ζωντανή ροή **καμία τιμή** διάστασης — η ανάγνωση AI κλειστή από νομική πύλη ⇒ λύτης αδρανής.
**Έρευνα:** Revit — διαστάσεις από CAD μένουν γραμμές+κείμενο, χάνονται στο reload (Autodesk Ideas, AUGI) · AutoCAD PDFIMPORT
κρατά layers, Raster Design OCR → Text/MText, όχι διαστάσεις · Plans2BIM: τίποτα για διαστάσεις · έλεγχος αλυσίδας↔ολικής και
«κείμενα χωρίς διαστάσεις = πινακίδα»: **δεν βρέθηκαν** πουθενά (πινακίδα = πλαίσιο/γωνία/πίνακας ή ανιχνευτής).
**Απόφαση Giorgio:** (Α1) **τοπικό OCR** στην εφαρμογή · (Β) layers γράφονται **μαζί με την έγκριση, ένα βήμα undo** · Plan Mode.

## 3. Φάση 0 — ευρήματα εξερεύνησης (για τον κώδικα)
- Σημείο σύνδεσης: παράγεις `PlanReadingOutcome {status:'read', reading}` (`plan-recognition-types.ts:228`) και καλείς
  `adoptReading` (`systems/plan-recognition/plan-recognition-session.ts:155`). Η `fuse` διαβάζει `texts/dimensions/writtenScale/rooms`.
- `PlanText.rect` = `RasterRectPx` σε **αρχικά** px, axis-aligned, **σφιχτό** (η δέση κρίνει διεύθυνση με λόγο 1,25).
  `PlanDimension {textId, valueMm, segmentIds: [], confidence}`. `raw` αυτούσιο (το `writtenPrecisionMm` το ξαναδιαβάζει).
- Δεν υπάρχει parser τιμής: ο κανόνας μονάδων ζει μόνο στο prompt `reading/plan-reading-prompt.ts:22` ⇒ νέο SSoT `parseDimensionValue`.
- Worker: κοινό RPC `src/lib/workers/worker-rpc-*` (`createWorkerRpcClient`)· πρότυπο `alignment/plan-align-worker-spawn.ts` +
  `plan-align-client.ts`. Pixels = `PlanRaster` (transfer)· `run.alignment.image` + `alignedToOriginal`. Γλυφά: `glyphCandidates`
  (`src/lib/geometry/raster/text-graphics.ts`) — δεν αποθηκεύονται στο run.
- `onnxruntime-web` **1.30.0 ήδη εξάρτηση** (MIT)· χρήση: `src/server/spatial-tour/face-detection/yunet-*` (`numThreads = 1`,
  τερματισμός σε αδράνεια). Χωρίς COOP/COEP ⇒ ένα νήμα WASM.
- Άδειες: CHECK 3.84 είναι ανά πακέτο npm ⇒ τυφλό σε `.onnx` (κενό όπως οι γραμματοσειρές πριν το `.font-assets.json`).
- `ocr_ppocr.py` (`C:\Nestor_Worktrees\_adr929-measure\`): ½ ανάλυση, πλακίδια 1280 (βήμα 1080), DB 0,3/0,6/unclip 1,5,
  δύο περάσματα (όρθιο + 90° CCW), rec ύψος 48, CTC greedy (λεξικό στο `rec/config.json` → `PostProcess.character_dict`).

## 4. ΕΠΟΜΕΝΟ — Βήμα 0.1 (ο Giorgio είπε «ΝΑΙ» στο νέο venv)
**Διάγνωση (μετρημένη):** το `paddle2onnx 2.1.0` (τελευταίο· το 1.x δεν διαβάζει μορφή PIR `inference.json`) στο venv της
μέτρησης (paddle 3.3.1) ⇒ `ImportError DLL load failed` = **WinError 127** (λείπει συνάρτηση, όχι αρχείο). Όλες οι DLL
υπάρχουν (`pe_imports.py`). Ανεπίσημη πηγή (CSDN): στα Windows ταιριάζει μόνο με paddle **`3.0.0.dev20250426`** (nightly).
**Εγκεκριμένο:** ΝΕΟ venv `C:\Nestor_Worktrees\_adr929-ocr\venv-p2o` (Python 3.11): πρώτα η nightly paddle από το index του
Paddle, **χωριστά** το `paddle2onnx==2.1.0` (το `-i` αντικαθιστά το PyPI αν μπουν μαζί). Το venv της μέτρησης **μένει ανέγγιχτο**.
Μετά: μετατροπή det/rec (`models/det`, `models/rec`) → `_adr929-ocr/onnx/` · απόδειξη ισοδυναμίας: ONNX (onnxruntime) vs
Paddle Inference στην ίδια σάρωση ⇒ ≥ 99 % ίδια `text`, κουτιά ≤ 1 px. Αποτυχία ⇒ **στάση**, πρόταση (β): έτοιμα ONNX του
RapidOCR (Apache-2.0, έλεγχος άδειας + ίδια απόδειξη ισοδυναμίας).
Εικόνα δοκιμής: στο scratchpad της 17ης (11112×9354, 400 DPI, 1 κανάλι)· σε νέα συνεδρία **ζήτα την ξανά** στο δικό της scratchpad.
Μετά το 0.1: βήματα 0.2–0.7 του σχεδίου, το καθένα με «ναι».

## 5. ΑΝΟΙΧΤΑ
1. ✅ `wt:land` με εντολή Giorgio ⇒ main **`a9a74a3f`** (Π-12 + 2 handoffs) · **push έκανε ο Giorgio** (2026-11-10).
   Ο κώδικας εφαρμογής ΔΕΝ άλλαξε (μόνο test + έγγραφα) ⇒ ζωντανά επαληθεύεται μόνο ότι το `/api/build-info` δείχνει `a9a74a3f`.
2. Νέα πύλη «μητρώο μοντέλων» (όπως `.font-assets.json`) — πρόταση μίας γραμμής, όχι μέρος της Φ0.
3. Από πριν: 7β υπόλοιπο · `closedRectangleStrategy` στο Π-10 · απάντηση «κολόνα» · `'#003fff'` σε 6 tests ·
   `publishRecomputed(null)` · `ModelFromDrawingHost.test.tsx` κόκκινο (`NotificationProvider`) · `DECISION_ANCHOR_MIN_IOU` ·
   DXF Tekton: 2 τοίχοι στους δεκάδες (16η) · §6.13 ζωντανά.
