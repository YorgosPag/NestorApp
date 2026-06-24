# HANDOFF — Ενοποίηση φαντάσματος ΠΕΔΙΛΟΥ με ΚΟΛΟΝΑ (placement → rotation → CL ενδείξεις), FULL SSoT

**Ημ/νία:** 2026-06-24
**Τύπος:** Feature / SSoT unification (DXF/BIM Viewer — placement ghost). Revit-grade, **FULL ENTERPRISE + FULL SSoT**.
**Γλώσσα απαντήσεων στον Giorgio: ΕΛΛΗΝΙΚΑ πάντα** (CLAUDE.md language rule).

---

## 🚨 ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ (απαράβατοι)
- **COMMIT/PUSH κάνει ΜΟΝΟ ο Giorgio.** ΠΟΤΕ εσύ. (N.(-1))
- **Shared working tree με ΑΛΛΟΝ agent (ADR-514 «εγκέφαλος έλξης») → ΠΟΤΕ `git add -A`,** stage ΜΟΝΟ τα δικά σου specific αρχεία. Ο άλλος agent αγγίζει ΕΝΕΡΓΑ τα `bim/placement/bim-cursor-snap.ts`, `column-*`, `foundation-*`, `mouse-handler-up.ts`, ADR-514. **Re-grep/re-read στην αρχή** — paths/ονόματα μπορεί να μετακινήθηκαν.
- **ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΓΡΑΜΜΗ ΚΩΔΙΚΑ → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep)** για REUSE· ΜΗΔΕΝ διπλότυπα. Ο Giorgio κάνει σκληρό audit («κεντρικοποιημένο; υπάρχει ήδη; διπλότυπο; θα το έκανε έτσι η Revit;»).
- **FULL ENTERPRISE + FULL SSoT, όπως η Revit.** ΕΝΑ σημείο αλήθειας· preview ≡ commit by construction. Όχι `any`/`as any`· functions ≤40 γρ.· files ≤500 γρ. (N.7.1)· i18n (N.11).
- **N.14:** δήλωσε μοντέλο (**Opus** — cross-subsystem placement/preview/FSM) & περίμενε «ok» πριν την υλοποίηση.
- **N.8:** 5+ αρχεία / 2+ domains → πιθανό Orchestrator/Plan Mode· ενημέρωσε τον Giorgio.
- **N.17:** ΕΝΑ tsc τη φορά (έλεγξε με `Get-CimInstance Win32_Process … node.exe … tsc` ΠΡΙΝ). Verify με **jest**.
- **ADR-driven (N.0.1):** code = source of truth· ενημέρωσε ADR + changelog στο τέλος.
- **100% ειλικρίνεια.**

---

## 1. ΤΟ ΖΗΤΟΥΜΕΝΟ (λόγια Giorgio)

> «Μελέτησε **πολύ καλά** τη συμπεριφορά του φαντάσματος της **κολόνας** — από τη στιγμή που πατάμε «Κολόνα», όλη τη διαδικασία, **μέχρι και την περιστροφή**. Πώς εμφανίζεται το φάντασμα, πώς εμφανίζονται & πώς λειτουργούν οι **CL ενδείξεις** (centerline listening dimensions, σιελ). Αυτόν τον κώδικα εφάρμοσέ τον **στα πέδιλα (foundation pad)**. Θέλω **ίδιο κώδικα από ΜΙΑ ΚΑΙ ΜΟΝΑΔΙΚΗ πηγή αλήθειας — πλήρες σύστημα SSoT**, Revit-grade.»

**Στόχος:** ΕΝΑΣ κοινός κώδικας «placement ghost + rotation + CL ενδείξεις» που τον μοιράζονται **κολόνα ΚΑΙ πέδιλο** — μηδέν παράλληλες υλοποιήσεις.

---

## 2. 🔬 ΒΑΘΥ AUDIT — Η ΑΛΗΘΕΙΑ ΤΟΥ ΚΩΔΙΚΑ (2026-06-24· **re-grep για επιβεβαίωση**)

### Τι ΗΔΗ μοιράζονται (καλά νέα)
- **Ο face-snap RESOLVER είναι ΗΔΗ κοινός:** το πέδιλο περνά από τον ΙΔΙΟ εγκέφαλο `resolveBimCursorSnap({ toolKind: 'foundation-pad' })` (ADR-514 Φ6c) → delegate στον **`resolveColumnFaceSnapFromTargets`** (ΙΔΙΟΣ με την κολόνα: 9-λαβές face + center-on-axis + polar/rect magnet + `faceFrame`).
  - Κολόνα: `bim/placement/bim-cursor-snap.ts` → `toolKind:'column'`.
  - Πέδιλο: ίδιο αρχείο → `toolKind:'foundation-pad'` (ίδιο branch με column).
- Το πέδιλο έχει ήδη **live ghost** (`generateFoundationPadPreview`, Φ6c) + `anchor` στο state.

### ⛳ ΤΟ ΚΕΝΟ: το πέδιλο παίρνει ΜΟΝΟ το `snap.point` — η κολόνα παίρνει ΟΛΟΚΛΗΡΟ το placement + ενδείξεις + rotation

| Συμπεριφορά | Κολόνα (`generateColumnPreview`) | Πέδιλο (`generateFoundationPadPreview`) |
|---|---|---|
| Θέση (face-snap) | ✅ `faceSnap.position` | ✅ `snap.point` |
| **Λαβή (anchor)** auto από face×zone | ✅ `faceSnap.anchor` | ❌ (αγνοείται· χρησιμοποιεί μόνο point) |
| **Rotation flush** σε λοξή ακμή | ✅ `faceSnap.rotation` | ❌ |
| **Status 🟢/🔴** | ✅ | ❌ |
| **CL listening dimensions** (σιελ, centerline) | ✅ `resolveGhostFaceDimensionsMeta(faceFrame…)` | ❌ |
| **Cartesian dx/dy dims** μέσα σε ορθογώνιο | ✅ `resolveRectCartesianDims` | ❌ |
| **Polar/Rect grid overlay** | ✅ `buildPlacementGridMeta` | ❌ |
| **Place+Rotate FSM** (1ο κλικ θέση → awaitingRotation → 2ο κλικ γωνία) | ✅ `ColumnRotationStore` + rotation ghost + πορτοκαλί γραμμή | ❌ (single-click commit, καμία περιστροφή) |
| TopLean (κεκλιμένη — slanted) | ✅ `ColumnTopLeanStore` | ➖ **column-specific** (πέδιλο δεν γέρνει — εκτός scope) |

**Συμπερασματικά:** ο RESOLVER είναι SSoT· η **PREVIEW ASSEMBLY** (πώς συναρμολογείται το ghost + ενδείξεις + rotation) είναι **column-only**, και το πέδιλο έχει ένα **φτωχό αντίγραφο** που πετά τα πάντα πλην του point. Αυτό είναι το anti-SSoT που πρέπει να εξαλειφθεί.

### Exact anchors (re-grep — μπορεί να μετακινήθηκαν)
- **Column preview assembly (η «πηγή αλήθειας» προς εξαγωγή):** `hooks/drawing/column-preview-helpers.ts` → `generateColumnPreview` (~182 γρ.):
  - awaitingRotation branch: `getColumnRotationLock()` → `resolveColumnRotationDeg` + κρατά grid.
  - awaitingTopLean branch: `getColumnTopLeanLock()` (**column-only**).
  - awaitingPosition: `resolveBimCursorSnap({toolKind:'column'})` → position+anchor+status+rotation· `resolveGhostFaceDimensionsMeta`/`resolveRectCartesianDims` (CL/cartesian dims)· `buildPlacementGridMeta` (grid).
- **CL dims SSoT:** `resolveGhostFaceDimensionsMeta` (`wysiwyg-preview-shared.ts`) + `resolveRectCartesianDims` (`bim/columns/rect-cartesian-snap.ts`). Render: `drawing-hover-handler.ts:294-332` (διαβάζει `faceDimensions`/`polarDiskGrid`/`rectGrid` ΓΕΝΙΚΑ από το preview entity — **ΟΧΙ tool-gated** → μόλις το πέδιλο τα attach-άρει, ζωγραφίζονται αυτόματα).
- **Grid SSoT (ΗΔΗ κοινό):** `bim/placement/placement-grid-meta.ts` → `buildPlacementGridMeta` (το χρησιμοποιεί ΗΔΗ column + beam· έτοιμο για reuse στο πέδιλο).
- **Rotation FSM store (προς γενίκευση):** `systems/cursor/ColumnRotationStore.ts` (`setColumnRotationLock`/`getColumnRotationLock`/`clearColumnRotationLock`). Writer: `useColumnTool.ts` (1ο κλικ γρ.~308/381 `setColumnRotationLock(point, anchor)`· ESC/commit clear). Reader: `generateColumnPreview` (rotation ghost).
- **Rotation γραμμή (πορτοκαλί + γωνία):** `drawing-hover-handler.ts` (μετά το grid block) → `drawPolarTrackingLine` (SSoT· ίδιο με beam/column rotation). Γωνία: `resolveColumnRotationDeg` (`bim/columns/column-rotation.ts`).
- **Πέδιλο preview (φτωχό αντίγραφο):** `hooks/drawing/foundation-preview-helpers.ts` → `generateFoundationPadPreview` (γρ.73-85).
- **Πέδιλο FSM:** `hooks/drawing/useFoundationTool.ts` — pad = `awaitingPosition` single-click (γρ.~63, `activePhaseFor`). `onCanvasClick` pad branch (~γρ.335-341) καλεί brain + commit ΑΜΕΣΩΣ. **Δεν** υπάρχει awaitingRotation. Έχει `anchor: FoundationAnchor` στο state ήδη.
- **Status store (κολόνα):** `systems/cursor/ColumnPlacementGhostStatusStore.ts` (anchor/rotation/status setters). Δες αν χρειάζεται γενίκευση ή αν το πέδιλο διαβάζει απευθείας από το snap (το column-preview πλέον παίρνει anchor/status **απευθείας από το `faceSnap`**, ΟΧΙ από store — προτίμησέ το ίδιο).

---

## 3. 🎯 ΠΡΟΤΕΙΝΟΜΕΝΟ ΣΧΕΔΙΟ (FULL SSoT — επιβεβαίωσε με grep ΠΡΩΤΑ)

**Κεντρική ιδέα:** η preview assembly της κολόνας είναι entity-agnostic εκτός από τον **builder** (ColumnEntity vs FoundationEntity). Εξάγαγέ την σε ΕΝΑ κοινό SSoT, παραμετρικό ως προς τον builder.

1. **NEW `bim/placement/placement-ghost-assembly.ts`** (pure, entity-agnostic) — δέχεται: `snap` (BimCursorSnap result column-placement), injected `buildEntity(position, anchor, rotation) → ExtendedSceneEntity|null`, `targets`, `sceneUnits`, `magnetOpts`, και επιστρέφει `{ entity, faceDimensions, grid }` (ghost + CL dims + polar/rect grid + cartesian dims). Reuse `resolveGhostFaceDimensionsMeta` + `resolveRectCartesianDims` + `buildPlacementGridMeta` (όλα ήδη SSoT). **Καμία νέα γεωμετρία.**
   - `generateColumnPreview` awaitingPosition → καλεί την assembly με column builder.
   - `generateFoundationPadPreview` → καλεί την ΙΔΙΑ assembly με foundation-pad builder (περνά anchor+rotation από το faceSnap, που σήμερα αγνοεί).
2. **Γενίκευσε `ColumnRotationStore` → κοινό `PlacementRotationStore`** (ή re-export alias, mirror του member-endpoint pattern) ώστε ΚΑΙ το πέδιλο να μπει σε **awaitingRotation** μετά το 1ο κλικ. Κράτα backward-compat aliases για column consumers (byte-for-byte).
3. **Wire `useFoundationTool` pad FSM → place+rotate** (mirror `useColumnTool`): pad `awaitingPosition` → 1ο κλικ κλειδώνει θέση+anchor (`setPlacementRotationLock`) → **awaitingRotation** → 2ο κλικ commit με τη γωνία (`resolveColumnRotationDeg`). ESC/deactivate → clear. Continuous chain.
4. **Rotation ghost + πορτοκαλί γραμμή:** η assembly + `drawing-hover-handler` τα ζωγραφίζουν ΗΔΗ γενικά → μόλις το πέδιλο γράψει το rotation lock, εμφανίζονται αυτόματα (μηδέν νέο render).
5. **TopLean (slanted):** **εκτός scope** για πέδιλο (το πέδιλο δεν γέρνει). Άσε το `ColumnTopLeanStore` column-only.

---

## 4. ❓ ΑΝΟΙΧΤΑ ΣΗΜΕΙΑ (ρώτα τον Giorgio με συγκεκριμένο παράδειγμα/νούμερα ΠΡΙΝ προχωρήσεις)
- **Place+Rotate (2-click) ή single-click;** Σήμερα το πέδιλο είναι **1-κλικ**. Η κολόνα είναι **place→rotate (2-κλικ)**. «Μέχρι και την περιστροφή» = θες το πέδιλο να γίνει **2-κλικ** (1ο=θέση, 2ο=γωνία) ΟΠΩΣ η κολόνα; (Πιθανότατα ΝΑΙ, αλλά είναι αλλαγή ροής — επιβεβαίωσε.)
- **Target set πέδιλου:** η κολόνα «βλέπει» κολόνες+τοίχους+δοκάρια+πλάκες+γραμμές+κύκλους/ορθογώνια. Το πέδιλο να βλέπει τα ΙΔΙΑ (μέσω του `foundation-pad` branch — ήδη ίδιο με column);
- **CL ενδείξεις στο πέδιλο:** ίδια ακριβώς centerline (σιελ) με την κολόνα — επιβεβαίωσε ότι «CL» = τα centerline listening dims (ghostHalfWidth 0).

---

## 5. ⚠️ ΣΥΓΚΡΟΥΣΗ — ΑΛΛΟΣ AGENT ΣΤΑ ΙΔΙΑ ΑΡΧΕΙΑ
Ο ADR-514 agent δουλεύει ΕΝΕΡΓΑ σε `bim-cursor-snap.ts`, `column-preview-helpers.ts`, `foundation-preview-helpers.ts`, `useFoundationTool.ts`, `mouse-handler-up.ts`, ADR-514. **Re-grep/re-read στην αρχή· stage ΜΟΝΟ τα δικά σου· μη δημιουργήσεις παράλληλο SSoT — ευθυγραμμίσου** με τον εγκέφαλο/grid SSoT που ήδη υπάρχουν.

---

## 6. ΕΠΑΛΗΘΕΥΣΗ
- **jest:** νέο `placement-ghost-assembly` suite + foundation pad preview/FSM tests (mirror column). Pure assembly = deterministic.
- **Browser (Giorgio):** εργαλείο **Πέδιλο (pad)** → φάντασμα κουμπώνει flush σε παρειά/άξονα κολόνας/μέλους + **σιελ CL ενδείξεις** + polar/rect πλέγμα μέσα σε κύκλο/ορθογώνιο· 1ο κλικ κλειδώνει θέση → **περιστροφή** προς κέρσορα + πορτοκαλί γραμμή/γωνία → 2ο κλικ commit. **Ίδια αίσθηση με την κολόνα, ούτε μία διαφορά.**
- ⚠️ CHECK 6B/6D (drawing/preview canvas + mouse-handler) → stage **ADR-040 + ADR-514 (+ ADR-398)** μαζί.

## 7. ΣΧΕΤΙΚΑ ADR
- **ADR-514** (Unified BIM Cursor Snap — ο εγκέφαλος· εδώ ζει η ενοποίηση).
- **ADR-398** (Column placement snap — 9-handle, polar/rect magnet, CL dims).
- **ADR-040** (preview canvas perf — architecture-critical).
