# HANDOFF — Ευθεία (line): grip-drag → κεντρικοποιημένα ίχνη ευθυγράμμισης + βελάκια φοράς (όπως τοίχος/BIM)

**Ημερομηνία:** 2026-07-04
**Working tree:** ΚΟΙΝΟ με άλλον agent → `git add <specific files>` μόνο, ΠΟΤΕ `-A`. **Commit/push μόνο ο Giorgio.**
**Κανόνες:** big-player (Revit/AutoCAD/Figma) · FULL ENTERPRISE + FULL SSOT · **SSoT audit (grep) ΠΡΙΝ κώδικα** · ΜΗΝ δημιουργήσεις διπλότυπα · αν βρεις προϋπάρχοντα duplicates → κεντρικοποίησέ τα (διαταγή) · ΜΗΝ τρέξεις `tsc`/typecheck (N.17· jest OK) · ADR-driven (update ADR ίδιο commit).

---

## 🎯 ΝΕΟ TASK (ζητούμενο Giorgio)

Όταν έχω **επιλεγμένη ευθεία** και εμφανίζονται οι λαβές (grips), και **πιάνω μια λαβή** για να μετακινήσω:
- το **άκρο** (endpoint) της ευθείας, ή
- το **κέντρο/μέση** (move ολόκληρης), ή
- να την **περιστρέψω** (rotation grip),

θέλω να εμφανίζεται το **ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ σύστημα ίχνων ευθυγράμμισης** (AutoAlign/POLAR traces) **και τα κόκκινα/πράσινα βελάκια φοράς**, **ΑΚΡΙΒΩΣ όπως όταν περιστρέφω έναν τοίχο**.

**Τι φταίει τώρα:** κατά την περιστροφή/μετακίνηση ευθείας εμφανίζονται κάποια **ad-hoc labels/πινακίδες** (γωνία + μήκος) που **ΔΕΝ** είναι το κεντρικοποιημένο σύστημα. Ο Giorgio θέλει το ΙΔΙΟ σύστημα με τοίχο/BIM entities — πλήρη πληροφορία για σωστή περιστροφή.

---

## 🧭 SSoT POINTERS (βρέθηκαν αυτή τη συνεδρία — ξεκίνα audit από εδώ)

### Το κεντρικοποιημένο σύστημα που ΠΡΕΠΕΙ να χρησιμοποιηθεί
- **`hooks/tools/rotation-tracking-overlay.ts`** → `resolveRotationTracking(pivot, cursor, scale, sceneEntities)` (ADR-397). Αυτό είναι το SSoT της περιστροφής τοίχου/κολόνας. Αλυσιδώνει:
  - `resolveOrthoPolarStep` (POLAR/ORTHO angle-lock γύρω από pivot),
  - **`systems/tracking/resolve-alignment-tracking.ts`** `resolveAlignmentTracking` (acquired ⊕ ambient — ΤΟ κεντρικό «Object Snap Tracking»),
  - paints: `canvas-v2/preview-canvas/polar-tracking-line-paint` (`paintPolarTrackingLine`), `.../tracking-paint` (`paintAlignmentPaths`/`paintIntersections`/`paintTooltip`), `.../tracking-colors` (`getCurrentTrackingPalette`), `.../overlay-projector` (`fromTransform`).
- **`systems/tracking/ambient-tracking-compose.ts`** → `composeTrackingSnap` (merge + quantize). **ΜΗΝ φτιάξεις νέο resolver.**

### Το πρότυπο για grip-drag alignment (ΗΔΗ υπάρχει για DIMENSIONS — αντέγραψε το μοτίβο, ΟΧΙ νέα μηχανή)
- **`systems/cursor/mouse-handler-move.ts:295-317`** — στο `isGripDragging`, για dim grips: `resolveActionAlignmentTracking(moveWorldPos, anchors, scale, sceneEntities)` → `setDimAlignmentTracking(...)` → override `moveWorldPos` → ghost paint. **Το ίδιο μοτίβο πρέπει να μπει για line-entity grips.**
- `hooks/dimensions/dim-alignment-tracking.ts` (`resolveActionAlignmentTracking`), `systems/cursor/DimAlignmentTrackingStore.ts`, `hooks/dimensions/useDimensionGrips.ts` (`getDimGripAlignmentAnchors`) — το «πώς δίνω anchors + πού δημοσιεύω το result για paint».

### Πού ζει το line grip-drag (εδώ θα γίνει το hook)
- `hooks/useGripMovement.ts`, `hooks/grips/grip-mouse-handlers.ts`, `hooks/grips/useUnifiedGripInteraction.ts`, `hooks/tools/useGripGhostPreview.ts` (από εδώ μάλλον βγαίνουν τα ad-hoc labels — επιβεβαίωσε), `hooks/grips/grip-primitive-rotate-commits.ts`, `hooks/grip-computation.ts`.
- Line grips (endpoint/mid): grep `line` σε `grip-registry.ts` / `grip-kinds-primitives.ts`.

### 🔴 DISCOVERY ITEM (δεν εντοπίστηκε ακριβώς — audit στη νέα συνεδρία)
- **Τα «κόκκινα/πράσινα βελάκια φοράς» κατά την περιστροφή τοίχου**: βρες πού ζωγραφίζονται (ξεκίνα από `wall-hot-grip-fsm.ts`, `rotation-tracking-overlay.ts`, `systems/cursor/rotation-pivot`/RotationSnapEngine, `canvas-v2/preview-canvas/*` paints· memory: `reference_rotation_pivot_marker_ssot`, `reference_rotation_handle_policy_ssot`). Χρησιμοποίησε ΤΟ ΙΔΙΟ paint για την ευθεία.

### Σχετικά ADRs
- ADR-397 (rotation hot-grip), ADR-357 Phase 4 (Object Snap Tracking), ADR-508 (linear members + place/rotate), ADR-040 (canvas perf — event-time reads, ΜΗΝ subscribe high-freq stores σε orchestrators).

---

## ✅ ΤΙ ΕΓΙΝΕ ΑΥΤΗ ΤΗ ΣΥΝΕΔΡΙΑ (ΟΛΑ uncommitted — commit ο Giorgio)

Πρόβλημα «γραμμή κλείδωνε 444,86 αντί 450» → βρέθηκαν & διορθώθηκαν **2 ρίζες** + πλήρης SSoT:

1. **Σταυρόνημα hotspot (dpr<1):** `systems/cursor/crosshair-cursor-image.ts` — ο hotspot έβγαινε από `cssSize/2` αντί από το πραγματικό εμφανιζόμενο μέγεθος → σε 80% zoom (dpr 0.8) ο pointer ήταν 3px κάτω-δεξιά του σταυρού. Fix: `emittedCssSize = dpr>1 ? cssSize : devicePx; hot = round(emittedCssSize/2)`. + test `__tests__/crosshair-cursor-image.test.ts` (dpr 0.8→13). ADR-549 changelog.
2. **«Πραγματική κορυφή νικάει το flush»:** `hooks/drawing/useDrawingHandlers.ts` — στο 1ο κλικ γραμμής το `resolveLineCommitPoint` (flush-to-face, ADR-508 §line-cyan) παρέκαμπτε το ρητό OSNAP endpoint → η αρχή γλιστρούσε στην παρειά. Fix: παρακάμπτεται το flush όταν υπάρχει locked ορατό OSNAP.
3. **SSoT `isVisibleSnapMode` (κεντρικοποίηση):** `snapping/extended-types.ts` — νέο primitive «ορατή/σκληρή έλξη» (grid & guide σιωπηλά). Κατανάλωση από 4 σημεία (fux indicator `isSnapMarkerVisible`, column `isVisibleIndicatorSnap`, line flush-gate, OTRACK acquire `drawing-hover-handler.ts:229`). Αφαιρέθηκαν 2 inline duplicates. Test `snapping/__tests__/visible-snap-mode.test.ts`. ⚠️ Behavior change: snap σε **οδηγό** δεν κλειδώνει πλέον OTRACK anchor (AutoCAD-σωστό, δεν έβγαζε marker).

**Uncommitted αρχεία (9):**
- `src/subapps/dxf-viewer/systems/cursor/crosshair-cursor-image.ts`
- `src/subapps/dxf-viewer/systems/cursor/__tests__/crosshair-cursor-image.test.ts`
- `src/subapps/dxf-viewer/hooks/drawing/useDrawingHandlers.ts` (499 γρ.)
- `src/subapps/dxf-viewer/snapping/extended-types.ts`
- `src/subapps/dxf-viewer/snapping/__tests__/visible-snap-mode.test.ts`
- `src/subapps/dxf-viewer/bim/columns/column-placement-snap-context.ts`
- `src/subapps/dxf-viewer/hooks/drawing/drawing-hover-handler.ts`
- `docs/centralized-systems/reference/adrs/ADR-549-3d-cursor-swim-render-loop.md`
- `docs/centralized-systems/reference/adrs/ADR-508-unified-linear-member-framing.md`

**Tests:** crosshair 7/7 ✅, visible-snap-mode 4/4 ✅.
**Browser-verified (Giorgio):** κενό σημείο → αρχή ακριβώς στον κέρσορα ✅ · γωνία → η αρχή κολλάει στη γωνία ✅. (Το ολόκληρο ορθογώνιο-450 ΔΕΝ ξαναδοκιμάστηκε end-to-end — προαιρετικό re-verify.)

---

## 🚫 ΜΗΝ ΚΑΝΕΙΣ
- ΜΗΝ commit/push (μόνο Giorgio). ΜΗΝ `git add -A`. ΜΗΝ `git restore`/`reset --hard`. ΜΗΝ αγγίξεις αρχεία άλλου agent.
- ΜΗΝ φτιάξεις νέο tracking/alignment engine — **reuse** `resolveRotationTracking`/`resolveAlignmentTracking` + τα υπάρχοντα paints.
- ΜΗΝ τρέξεις `tsc`/typecheck.
