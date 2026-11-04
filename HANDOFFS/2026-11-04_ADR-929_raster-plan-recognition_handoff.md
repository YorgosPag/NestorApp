# Handoff — ADR-929 Αναγνώριση κάτοψης από εικόνα (2026-11-04)

## Πού βρισκόμαστε
- **Worktree:** `C:\Nestor_Worktrees\raster-plan-recognition`
- **Κλαδί:** `agent/raster-plan-recognition` (βάση `main` `d38fcb41`)
- **ADR:** `docs/centralized-systems/reference/adrs/ADR-929-raster-plan-recognition.md` (PROPOSED)
- Έγινε: έρευνα αγοράς (Plans2BIM, WiseBIM, AutoCAD 2026, Planner 5D, CubiCasa) + βιβλιογραφίας (AECV-Bench, Blueprint-Bench) + SSoT audit + απόφαση αρχιτεκτονικής Δ1–Δ13 + φάσεις Φ0–Φ9. **Καμία γραμμή κώδικα.**
- Δεν έγινε `wt:land`, δεν έγινε push (μόνο με εντολή Giorgio).

## Η απόφαση σε μία παράγραφο
Υβριδική ροή: **όραση υπολογιστή** (Web Worker) για το **πού** (ευθυγράμμιση, γραμμές, πάχος) · **VLM** για το **τι** (διαστάσεις, κλίμακα, χώροι, ανοίγματα, βεβαιότητα), που αναφέρεται σε **IDs γραμμών** και όχι σε συντεταγμένες · **λύτης διαστάσεων** (σταθμισμένα ελάχιστα τετράγωνα) με υπόλοιπα → ερωτήσεις. Όλα καταλήγουν ως **προτάσεις** στον υπάρχοντα πυρήνα του ADR-911 (`computeWallProposal`, `addWallsToScene`), με έλεγχο από άνθρωπο. Πηγή είναι **μόνο** το `FloorplanBackground` (ADR-340).

## Φ0: ΕΓΙΝΕ (2026-11-04) — λεπτομέρειες στο ADR-929 §6.1
- SSoT `floorplan-background/geometry/raster-scene-mapping.ts` (px ↔ σκηνή) + `raster-pixel-scale.ts` (μέτρα/pixel με πηγή). Ο ζωγράφος και το `calibration-remap.service` περνούν από εκεί.
- Αφινικός πυρήνας: `src/lib/geometry/affine-2x3.ts` · `rendering/core/world-to-screen-affine.ts`.
- Τύποι + κλειδί: `bim/plan-recognition/plan-recognition-types.ts` · `plan-reading-key.ts`. Πρόθεμα `plrd` (`generateDeterministicPlanReadingId`).
- Χρυσό σύνολο: σχήμα + φορτωτής + συνθετικά δείγματα στο `bim/plan-recognition/testing/`. **Το μανιφέστο ζει ΕΚΤΟΣ repo**, στο `F:\Shared\_Nestor_Plan_Golden\` (`NESTOR_PLAN_GOLDEN_DIR`, μεταβλητή χρήστη). 2 περιπτώσεις βαθμίδας Α, επαληθευμένες. Κανένα αντίγραφο σαρώσεων. Νέες περιπτώσεις μπαίνουν με sha256 (README εκεί).

## Επόμενο βήμα: Φ1 (ADR-929 §6)
1. **Ξεκίνα από τον υπάρχοντα κώδικα** (§3 συμπλήρωμα): `lib/geometry/raster/*`, `css-homography.ts`, `lib/spatial-tour/space-detect/*` (Worker + `PlanRaster`). Η σύγκριση με το opencv.js γίνεται **μόνο** για LSD/Hough, προσαρμοστική δυαδοποίηση και προοπτική από 4 σημεία (§9.3).
2. Τα όρια της εικόνας παίρνονται από την **αποκωδικοποιημένη** εικόνα, όχι από το `naturalBounds` του εγγράφου (τα παλιά PDF έχουν δεκαδικά, §6.1 #2).
3. Μετακόμιση του `PlanRaster` στο `lib/geometry/raster/` όταν μπει σε κώδικα παραγωγής (§6.1 #5).
4. Πριν τη Φ4: διόρθωση της υπόθεσης «σκηνή = mm» στο `useCalibration` (§6.1 #1).

## Απαντήσεις Giorgio (2026-11-04, γραμμένες στο ADR)
- Είσοδοι: και τα 4 είδη, σειρά σάρωση → PDF πολλών σελίδων → αγγελία → σκίτσο (Δ14). Η Φ7 μπαίνει στην πρώτη παράδοση.
- Αποστολή σε AI: διακόπτης ανά εταιρεία, αποκοπή πινακίδας πριν την αποστολή (Δ15).
- Κόστος: μέτρηση + όριο ασφαλείας, τιμολόγηση αργότερα (Δ16).
- Χώροι: κανονικό Δωμάτιο με **δικό του ADR πριν τη Φ6** (Δ17).
- Έλεγχος: ένα εργαλείο, Γρήγορος/Λεπτομερής (Δ18).
- Χρυσό σύνολο: `F:\Shared\6. erga\Smyrnis_Mikro` + `F:\Shared\05. Σκαναρισμένα Αρχεία\_Πρωτότυπα Σχέδια Αδειών`, **ΕΚΤΟΣ repo** (προσωπικά δεδομένα) (Δ13.1).
- Σελίδες → όροφοι: πίνακας αντιστοίχισης, τυπικός όροφος, γέννηση μόνο μέσω ADR-910 (Δ19).
- Πάροχος: **μόνο OpenAI** (§9.1).
- Ανοιχτό: μόνο opencv.js ή δικός κώδικας (§9.3), με μέτρηση στη Φ1.

## Κρίσιμο πλαίσιο (από το audit)
- Κλήση vision: `src/services/ai/openai-responses/` + `src/services/ai/structured-document-request.ts` (`requestStructuredDocument`). Προηγούμενο: `src/server/catalog/import-page-analyzer.server.ts` (ξεχωριστό κλειδί, `gpt-4o`).
- Σημείο επέκτασης: `bim/model-from-drawing/wall-detection-strategy.ts` (μόνο `closedRectangleStrategy`· η `parallelPairStrategy` είναι η Φ2).
- `PdfPageProvider` αποδίδει **μόνο σελίδα 1** (Φ7).
- Πακέτα που υπάρχουν: `pdfjs-dist`, `sharp`, `onnxruntime-web`, `utif`. Δεν υπάρχουν opencv/tesseract.

## ΜΗΝ
- Μην εμπιστευτείς συντεταγμένες από VLM ως γεωμετρία.
- Μη γράψεις στη σκηνή εκτός `addWallsToScene` / `addOpeningsToScene`.
- Μη χρησιμοποιήσεις `ImageEntity` ως πηγή.
- Μην εγκαταστήσεις YOLO (AGPL) ή μοντέλα CubiCasa5K (CC BY-NC).
- Μη βάλεις βρόχο αυτο-διόρθωσης VLM.
- Μην κάνεις commit στο `main`, `wt:land` ή push χωρίς εντολή.
