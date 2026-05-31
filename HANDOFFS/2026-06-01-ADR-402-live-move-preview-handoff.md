# HANDOFF — ADR-402: 3Δ BIM editing — Live move preview (ζωντανή προεπισκόπηση κατά το drag)

**Ημερομηνία:** 2026-06-01
**Συντάκτης:** Developer A (Opus 4.8, SOLO) — νέα φάση, ΔΕΝ ξεκίνησε ακόμα (ο υπολογιστής κράσαρε)
**Θέμα:** ADR-402 — 3D Viewport BIM Element Editing
**Κατάσταση:** ΟΛΑ uncommitted (κανένα commit/push — N.(-1)). Ο Giorgio κάνει ΜΟΝΟΣ του commit, ΟΧΙ ο agent.

---

## 0. ΠΡΩΤΟ ΒΗΜΑ (κάνε ΑΥΤΑ με τη σειρά)
1. **`git status`** — το working tree έχει uncommitted δουλειά ΠΟΛΛΩΝ ADR (401/402/403/396). **ΠΟΤΕ `git add -A`.** Δες §3 για το τι ανήκει στο ADR-402.
2. **Διάβασε memory:** `project_adr402_genarc_gizmo_port.md` + `project_adr402_3d_bim_editing.md`.
3. **🟢 Η ΝΕΑ ΕΝΤΟΛΗ ΤΟΥ GIORGIO (§1).** Ξεκίνα από εκεί. Είναι ΚΑΘΑΡΗ νέα φάση — δεν εξαρτάται από browser verify του προηγούμενου.
4. **N.14 model:** Opus (3Δ gizmo cross-cutting, real-time render path). **N.8:** πιθανώς >3 αρχεία → Plan Mode, ζήτα έγκριση ΠΡΙΝ γράψεις κώδικα.

---

## 1. 🟢 Η ΝΕΑ ΕΝΤΟΛΗ — ζωντανή προεπισκόπηση μετακίνησης

### Τι ζήτησε ο Giorgio (verbatim)
> «ΘΕΛΩ ΚΑΤΑ ΤΗΝ ΜΕΤΑΚΙΝΗΣΗ ΜΙΑΣ ΟΝΤΟΤΗΤΑΣ ΝΑ ΒΛΕΠΩ ΣΕ ΠΡΑΓΜΑΤΙΚΟ ΧΡΟΝΟ ΤΗΝ ΠΡΟΕΠΙΣΚΟΠΗΣΗ ΜΕΤΑΚΙΝΗΣΗΣ»

Δηλαδή: όταν σέρνω βελάκι του gizmo (move/rotate/resize/vertical), η ίδια η **οντότητα** (ή ghost της) πρέπει να ακολουθεί τον κέρσορα **ζωντανά**, ΟΧΙ να «κολλάει» στην αρχική θέση και να πηδά στη νέα μόνο όταν αφήσω το ποντίκι.

### Root cause / τρέχουσα συμπεριφορά (ΕΝΤΟΠΙΣΜΕΝΗ)
**Αρχείο:** `src/subapps/dxf-viewer/bim-3d/animation/bim3d-edit-interaction-handlers.ts`, `onEditPointerMove` (γρ. 170-185).

Σήμερα, κατά το drag, κινείται **ΜΟΝΟ το gizmo overlay** (`ctx.controller.updateDrag(...)` → μετακινεί το gizmo gizmo, όχι το mesh). Το **mesh της οντότητας μένει στην αρχική του θέση**. Μόνο στο `onEditPointerUp` (γρ. 187-196) τρέχει `dispatchOutcome` → command → scene re-sync → η οντότητα «πηδά» στη νέα θέση. Το σχόλιο στο header του αρχείου (γρ. 11-18, «single-commit-on-release … gizmo follows the cursor») περιγράφει ΑΚΡΙΒΩΣ αυτό: by-design single-commit-on-release, χωρίς live preview.

→ Η φάση είναι να προστεθεί **live optimistic preview** κατά το drag, χωρίς να σπάσει το single-commit-on-release (το command πρέπει να μένει ΕΝΑ undo step στο release).

### Αρχιτεκτονική κατεύθυνση (πρόταση — επικύρωσε στο Plan Mode)
Δύο industry-standard δρόμοι· **προτείνω B** (Revit/Forge κάνουν preview-transform του ίδιου του mesh, ΟΧΙ ghost clone):

- **A — Ghost overlay:** φτιάξε ένα ημιδιάφανο clone των edited meshes στο pointerdown, μετακίνησέ το στο pointermove, σβήσ' το στο pointerup (το command κάνει το πραγματικό). Πιο ασφαλές (δεν αγγίζει την πηγή), αλλά clone-άρει geometry/materials → κόστος + drift από το πραγματικό αποτέλεσμα (π.χ. wall miter / hosted openings ΔΕΝ θα φαίνονται live).
- **B — Live mesh transform (προτεινόμενο):** στο pointermove, εφάρμοσε προσωρινό `position`/`rotation`/scale-equivalent στα ΥΠΑΡΧΟΝΤΑ group meshes των edited ids (διάβασε τα ids από `useBim3DEditStore.getState().editEntityIds`, βρες τα meshes με `userData['bimId']` — δες `findBimEntityWorldBox` γρ. 408-419 για το pattern traversal). Στο pointerup, το command + scene re-sync κάνει το οριστικό (το proxy transform μηδενίζεται φυσικά στο rebuild). Στο pointercancel/Esc, reset το transform.
  - **Move:** `mesh.position.add(deltaWorld)` — απλό.
  - **Vertical move:** `mesh.position.y += deltaUpWorld`.
  - **Rotate:** rotate group γύρω από pivot.
  - **Resize:** ⚠️ ΔΥΣΚΟΛΟ — το resize αλλάζει geometry (params), όχι transform. Live preview resize ίσως απαιτεί rebuild-on-drag (throttled) ή να μείνει εκτός φάσης 1 (commit-on-release όπως τώρα). **Ρώτα τον Giorgio αν το preview αφορά ΜΟΝΟ move/rotate ή ΚΑΙ resize.**

**Πηγή delta:** ο controller ήδη ξέρει το τρέχον drag delta. Δες `BimGizmoController.updateDrag` + `bim-gizmo-drag-bridge.ts` (`BridgeOutcome`: move `deltaDxf`/`deltaUpMm`, rotate `angleDeg`/`pivotDxf`, resize). Πιθανώς θες έναν τρόπο να διαβάζεις το **τρέχον** outcome κατά το drag (όχι μόνο στο endDrag) — τσέκαρε αν ο controller εκθέτει peek/current outcome· αν όχι, πρόσθεσέ τον (μικρό, SSoT-safe).

### 2Δ reference (μην εφεύρεις — υπάρχει SSoT preview pipeline στο 2Δ)
Το 2Δ DXF viewer ΕΧΕΙ ολόκληρο ghost/preview pipeline που αξίζει mirror (memory `project_adr397_grip_glyph_behavior_ssot.md` §12e):
`apply-entity-preview` / `EntityPreviewTransform` / `buildRotateReferencePreview` / `useGripGhostPreview` / `draw-ghost-entity`. Ψάξε με Grep αυτά τα ονόματα — δες αν υπάρχει view-agnostic SSoT (transform απλό math) που να ξαναχρησιμοποιηθεί στο 3Δ αντί για διπλό κώδικα. **Μάθημα (ADR-397 §12e): commit path ≠ preview path· η οντότητα πρέπει να μπει σε ΟΛΑ τα pipelines ώστε ghost===commit.**

### 🚨 UNITS warning (επαναλαμβανόμενη παγίδα ADR-402)
- wall/column/beam/slab params = **raw mm**· **σκάλα = drawing units** (`mmToEntityUnitFactor` στο `bim3d-edit-math.ts`).
- Αλλά για **live mesh transform** δουλεύεις σε **world units (three.js meters)** — όχι params. Το delta του drag είναι ήδη world (ο controller πιάνει cursor σε world). Άρα για το preview-transform του mesh, ΜΕΙΝΕ σε world και ΜΗΝ περάσεις από mm/drawing-unit μετατροπές (αυτές αφορούν ΜΟΝΟ το command στο release). Πρόσεξε να μην διπλο-μετατρέψεις.

### Performance (ADR-040 / ADR-366 rAF)
Το pointermove ήδη καλεί `ctx.manager.markSceneDirty()` (γρ. 176) → το rAF SSoT (`UnifiedFrameScheduler`, ADR-040 Phase XXIII) κάνει render. Άρα το live transform θα φανεί ΧΩΡΙΣ νέο render loop — απλά mutate το mesh + `markSceneDirty()`. ΜΗΝ φτιάξεις δικό σου requestAnimationFrame.

### Verify (browser, ζήτα από Giorgio)
1. Επίλεξε τοίχο 3Δ → σύρε οριζόντιο βελάκι → ο τοίχος ακολουθεί ζωντανά τον κέρσορα· άσε → μένει· reload → σωσμένο.
2. Vertical (πράσινο) βελάκι → ανεβαίνει ζωντανά.
3. Rotate → περιστρέφεται ζωντανά γύρω από το pivot.
4. Esc στη μέση → επιστρέφει στην αρχική (κανένα command).
5. Multi-select → όλα κινούνται ζωντανά μαζί.
6. (αν μπει resize) resize → ζωντανή αλλαγή διαστάσεων.

---

## 2. ⏳ ΠΡΟΗΓΟΥΜΕΝΗ ΦΑΣΗ (ΟΛΟΚΛΗΡΩΜΕΝΗ, pending commit + 🔴 browser verify)
**Κάθετο βελάκι ΜΕΤΑΚΙΝΗΣΗΣ (axis-Y move) σε ΟΛΑ τα 3Δ στοιχεία.** Αυτό ΔΟΥΛΕΥΕΙ (tsc 0, 103/103 PASS) αλλά ο Giorgio δεν το επιβεβαίωσε ακόμα στον browser (κράσαρε ο υπολογιστής). Αρχεία:
- `bim-gizmo-overlay.ts` — `axis-y` στα `BASE_HANDLES` (πράσινο κάθετο βέλος).
- `bim-gizmo-drag-bridge.ts` — `move` outcome += `deltaUpMm` + snap-exclusion για κάθετη κίνηση.
- **ΝΕΟ** `bim3d-vertical-move.ts` — per-type elevation patch: wall/column `baseOffset`, beam `topElevation`, slab `levelElevation`, stair `basePoint.z` (×`mmToEntityUnitFactor`).
- `bim3d-edit-interaction-handlers.ts` — routing κάθετης κίνησης (single→`Update*ParamsCommand`, multi→`CompoundCommand`). `EditCommand` union += `CompoundCommand` + `UpdateStairParamsCommand`.
- `BimToThreeConverter.ts` — **flat** path τοίχου/κολώνας τώρα διαβάζει `baseOffset` στο `mesh.position.y` (αλλιώς η κάθετη κίνηση δεν φαινόταν· profiled path άθικτο = αποφυγή διπλομέτρησης).
- ADR-402 changelog ενημερωμένο.
- **NEW tests:** `bim3d-vertical-move.test.ts` (12) + `wall-column-base-offset-y.test.ts` (5)· **MOD tests:** `bim-gizmo-overlay`, `bim-gizmo-drag-bridge`.

⚠️ **Σχέση με τη νέα φάση:** το live preview (§1) θα δουλέψει ΚΑΙ για το κάθετο βελάκι — αν κάνεις το preview generic (move outcome με `deltaUpMm`), καλύπτεις και τα δύο μαζί.

---

## 3. ΤΑ ΑΡΧΕΙΑ ΤΟΥ ADR-402 ΣΤΟ WORKING TREE (uncommitted) — ΜΗΝ μπλέξεις άλλα ADR
Το tree έχει ΚΑΙ ADR-401 (column attach F.1/F.2: `column-piece-geometry.ts`, `column-geometry.ts`, `ColumnRenderer.ts`, `column-boq-feed.ts`, `useColumnPersistence.ts`, ADR-401 doc) ΚΑΙ ADR-403 (3Δ column placement: `bim-3d/placement/*`, `ADR-403-*.md`, `useColumnTool.ts`, `EventBus.ts`, `BimViewport3D.tsx`, `BimEntityRaycaster.ts`, `BimSceneLayer.ts`). **ΜΗΝ τα αγγίξεις.**

**ADR-402 (δικά μας) — MODIFIED:**
- `src/subapps/dxf-viewer/bim-3d/animation/bim3d-edit-interaction-handlers.ts`
- `src/subapps/dxf-viewer/bim-3d/gizmo/bim-gizmo-overlay.ts`
- `src/subapps/dxf-viewer/bim-3d/gizmo/bim-gizmo-drag-bridge.ts`
- `src/subapps/dxf-viewer/bim-3d/gizmo/__tests__/bim-gizmo-overlay.test.ts`
- `src/subapps/dxf-viewer/bim-3d/gizmo/__tests__/bim-gizmo-drag-bridge.test.ts`
- `docs/centralized-systems/reference/adrs/ADR-402-3d-bim-element-editing.md`
- (το `BimToThreeConverter.ts` αγγίζεται ΚΑΙ από ADR-401 column work — πρόσεξε στο staging· το δικό μας diff = το `baseOffset` flat-path patch)

**ADR-402 (δικά μας) — NEW:**
- `src/subapps/dxf-viewer/bim-3d/gizmo/bim3d-vertical-move.ts`
- `src/subapps/dxf-viewer/bim-3d/gizmo/__tests__/bim3d-vertical-move.test.ts`
- `src/subapps/dxf-viewer/bim-3d/converters/__tests__/wall-column-base-offset-y.test.ts`

---

## 4. ΟΡΙΑ / ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΑ)
- **ΜΗΝ κάνεις commit/push. Ο Giorgio κάνει ΜΟΝΟΣ του commit** (ρητή εντολή 2026-06-01). ΠΟΤΕ `git add -A` — μόνο specific files.
- ΜΗΝ αγγίξεις δουλειά ADR-401/403/396 στο tree (§3).
- **N.15 bookkeeping** (ΕΚΚΡΕΜΟΤΗΤΕΣ.txt + adr-index + memory) γίνεται ΜΑΖΙ με τον κώδικα — αλλά αφού ο Giorgio κάνει commit, εσύ ετοίμασε τα αρχεία· μην κλειδώσεις τίποτα ως «committed» πριν το κάνει.
- **N.8:** η νέα φάση πιθανώς >3 αρχεία (handlers + controller + ίσως νέο preview SSoT + tests) → Plan Mode + έγκριση.
- **N.10:** αν αγγίξεις `src/services/ai-pipeline/` → τρέξε tests (δεν ισχύει εδώ, αλλά μην ξεχνάς).
- **Ελληνικά πάντα** στις απαντήσεις προς Giorgio.
- **ADR-040 / ADR-366:** ΜΗΝ φτιάξεις δικό rAF· χρησιμοποίησε `markSceneDirty()` + UnifiedFrameScheduler.

---

## 5. ΓΡΗΓΟΡΟ ΞΕΚΙΝΗΜΑ
1. `git status` → επιβεβαίωσε τα §3 αρχεία.
2. Plan Mode: διάβασε `bim-gizmo-controller.ts` + `bim-gizmo-drag-bridge.ts` → βρες αν ο controller εκθέτει **τρέχον** outcome κατά το drag (peek), όχι μόνο `endDrag()`.
3. Grep το 2Δ preview SSoT (`apply-entity-preview`, `EntityPreviewTransform`) → δες τι ξαναχρησιμοποιείται.
4. Ρώτα Giorgio (ΕΝΑ-ΕΝΑ, απλά ελληνικά): (Q1) preview ΜΟΝΟ move/rotate ή ΚΑΙ resize; (Q2) ghost ημιδιάφανο ή το ίδιο το mesh να κινείται; (Q3) χρώμα/opacity preview;
5. Παρουσίασε πλάνο → πάρε έγκριση → υλοποίησε → tests → tsc → ADR-402 changelog → ΣΤΑΜΑΤΑ (ο Giorgio κάνει commit).
