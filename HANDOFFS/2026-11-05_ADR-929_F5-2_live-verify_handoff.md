# HANDOFF — ADR-929 Φ5: ζωντανός έλεγχος της Φ5.1 → Φ5.2 (κλίμακα + μόνιμη βαθμονόμηση)

- **Ημερομηνία:** 2026-11-05
- **Worktree:** `C:\Nestor_Worktrees\raster-plan-recognition` (η νέα συνεδρία συνεχίζει ΕΔΩ)
- **Κλαδί:** `agent/raster-plan-recognition` (fast-forward στο `origin/main` = `ae17567b`)
- **ADR:** `docs/centralized-systems/reference/adrs/ADR-929-*.md` (§6.6 Φ5.1, §6.1 #1, status, changelog)
- **Εγκεκριμένο σχέδιο Φ5 (Plan Mode):** `C:\Users\user\.claude\plans\abundant-squishing-beacon.md`

## 0. Κατάσταση
- **Φ5.1 (εικόνα → τοίχοι, ΧΩΡΙΣ AI) = ΕΝΤΑΓΜΕΝΗ στο main (`2f135d9a`) ΚΑΙ ΑΝΕΠΤΥΓΜΕΝΗ** (deploy `ae17567`, run 42035220505). Επαληθεύτηκε: `2f135d9a` πρόγονος του `origin/main`.
- ⚠️ Ο τίτλος του squash commit βγήκε λάθος («docs(handoff): …» αντί «feat(plan-recognition): Φ5.1…»)· έχει γίνει push ⇒ ΔΕΝ διορθώνεται. Η αλήθεια είναι στο changelog του ADR-929.
- Jest: `systems/plan-recognition/__tests__/{plan-recognition-flow,plan-confidence}.test.ts` + `ModelFromDrawingPanel.test.tsx` πράσινα. CHECK 3.41 πράσινο (οικογένεια `plan-confidence`).

## 1. ΠΡΩΤΟ ΒΗΜΑ: ζωντανός έλεγχος Φ5.1 (στο nestorconstruct.gr — όχι dev server, η μνήμη δεν αρκεί)
Καμία αποστολή εικόνας σε AI (η Φ5.1 δεν έχει AI). Βήματα:
1. DXF Viewer → όροφος → ανέβασμα κάτοψης-εικόνας (PNG/JPG ή PDF) ως υπόβαθρο.
2. Πάνελ «Μοντέλο από σχέδιο» → κουμπί `mfd-image-recognize` «Από την εικόνα του υποβάθρου».
3. Αναμένεται: επικάλυψη τμημάτων σε 3 επίπεδα (μπλε συμπαγές ≥0,8 · κίτρινο διακεκομμένο ≥0,6 · κόκκινο στικτό), υπόμνημα με πλήθη, προεπισκόπηση τοίχων/ομάδες πάχους του ADR-911.
4. Χωρίς βαθμονόμηση: έγκριση ΚΛΕΙΔΩΜΕΝΗ + μήνυμα `mfd-image-uncalibrated`.
5. Βαθμονόμηση δύο σημείων (υπάρχον `CalibrationDialog`) → έγκριση → τοίχοι στη σκηνή σε ΕΝΑ βήμα undo → Ctrl+Z.
6. 🔴 **Αναμενόμενο ελάττωμα (γνωστό, = Φ5.2):** μετά από **ανανέωση σελίδας** η βαθμονόμηση χάνεται ⇒ η έγκριση ξανακλειδώνει. Δεν είναι bug της Φ5.1 — είναι το εύρημα του §2.
7. Καταγραφή: τι είδε ο Giorgio, ποια επίπεδα, πόσοι τοίχοι σωστοί/λάθος, χρόνος αναγνώρισης. Αν βρεθεί bug → διόρθωση στο κλαδί πριν τη Φ5.2.

## 2. ΚΡΙΣΙΜΟ ΕΥΡΗΜΑ (θεμέλιο της Φ5.2)
- Η βαθμονόμηση του viewer **δεν είναι μόνιμη**: το `applyCalibration` του `floorplanBackgroundStore` αλλάζει το `transform` (μόνιμο), αλλά το πεδίο `calibration` ζει μόνο στη μνήμη· το `patchCalibration` **δεν έχει καλούντα**.
- Το `POST /calibrate` γράφει **μόνο** μεταδεδομένα `scale`, δεν μετακινεί την εικόνα.
- Γι' αυτό η Φ5.1 κλειδώνει την εγγραφή τοίχων σε `calibration !== null` (`systems/model-from-drawing/proposal-line-source.ts` → `isRasterPlacementCalibrated`).
- **§6.1 #1:** `floorplan-background/hooks/useCalibration.ts:90-93` υποθέτει σκηνή σε mm· `geometry/raster-pixel-scale.ts:34` `METRES_PER_CALIBRATED_SCENE_UNIT = 0.001`. Διόρθωση: `mmToSceneUnits(resolveSceneUnits(scene))` + καταγραφή μονάδων στο `CalibrationData`, tests για σκηνή m/cm/mm.

## 3. Φ5.2 — Κλίμακα (μετά τον ζωντανό έλεγχο, Plan Mode αν >5 αρχεία)
1. SSoT audit (grep) πρώτα: `applyCalibration`, `patchCalibration`, `/calibrate` route + schema, `BackgroundScale` (`src/types/floorplan-overlays.ts`), `resolveRasterPixelScale`, `fusePlan` έξοδος κλίμακας.
2. Μόνιμη βαθμονόμηση: ΜΙΑ πράξη που γράφει **και** μεταδεδομένα (`/calibrate`) **και** θέση (`applyCalibration` διορθωμένο) + επιμονή του `calibration` (ο καλών του `patchCalibration`). Idempotent, await, όχι fire-and-forget.
3. Κάρτα πρότασης κλίμακας από τη σύντηξη: «1 px = x mm, πηγή: συναίνεση N διαστάσεων, ±σ» — αποδοχή ⇒ η ίδια πράξη. Προέλευση: προαιρετικό `source: 'user' | 'plan-recognition'` στο `BackgroundScale`.
4. Μετά από επιμονή: το κλείδωμα έγκρισης μένει, αλλά επιβιώνει την ανανέωση.
5. ADR-929 (§6.6 Φ5.2 + changelog) + ADR-340 changelog. i18n el+en στο `dxf-viewer-shell` + `npm run generate:i18n-types`.

Μετά: Φ5.3 (έλεγχος προβολής αποστολής + client `plan-reading`), Φ5.4 (ερωτήσεις με απάντηση ενός κλικ → `answers` στη σύντηξη). Λεπτομέρειες στο σχέδιο.

## 4. ΜΗΝ
- ❌ Αποστολή εικόνας σε OpenAI/AI από τον πράκτορα — την τρέχει ο Giorgio. Καμία μέτρηση χωρίς εντολή.
- ❌ Commit στο `main` · `wt:land` / push χωρίς ρητή εντολή · `--no-verify` · `tsc` (N.17).
- ❌ Δεύτερη μηχανή τοίχων ή δεύτερη αντιστοίχιση px↔σκηνή (μόνο `rasterPixelToScene`/`sceneToRasterPixel`).
- ❌ Ανοιχτά θέματα #1/#2/#3, πολιτική απορρήτου v2, απόφαση cache: περιμένουν εντολή Giorgio.
- ⚠️ Βαριά jest: σεβάσου το `C:\Users\user\.claude\heavy-task.lock` (4 πυρήνες, κοινή μηχανή).
