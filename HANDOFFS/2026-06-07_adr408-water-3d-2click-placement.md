# HANDOFF — ADR-408 Ύδρευση: 3D 2-click placement (συλλέκτη/σωλήνα στο 3D viewport)

**Ημερομηνία:** 2026-06-07
**Μοντέλο:** Opus 4.8 (Plan Mode)
**Απαίτηση Giorgio:** «όπως οι μεγάλοι παίκτες, σαν Revit — FULL ENTERPRISE + FULL SSOT»
**Γλώσσα απαντήσεων:** Ελληνικά (πάντα).

---

## 🎯 ΤΟ ΘΕΜΑ ΤΗΣ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ

Υλοποίηση **τοποθέτησης με 2 κλικ μέσα στο 3D viewport** για τα δύο στοιχεία ύδρευσης:
- **Συλλέκτης ύδρευσης** (`mep-manifold`, kind `floor-manifold`) — point-based (1 κλικ τοποθέτηση + προαιρετικά rotation).
- **Σωλήνας** (`mep-segment`, domain `pipe`) — linear (2 κλικ: αρχή→τέλος).

**Τι υπάρχει ήδη:** το 3D **DISPLAY** δουλεύει (`syncManifolds` / `syncMepSegments` στο `bim-3d/scene/`, materials, `MepManifoldPlacementGhost`). **Τι λείπει:** η **τοποθέτηση με κλικ μέσα στο 3D** (σήμερα τοποθετείς μόνο στην 2D κάτοψη).

**Πρότυπο/SSoT:** **ADR-403 — 3D Viewport BIM Element Placement** (`docs/centralized-systems/reference/adrs/`). Υπάρχει ήδη 3D placement FSM που χειρίζεται κάποια entities (π.χ. point-based fixtures). Το tracker (`local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`, ΟΜΑΔΑ 3ΔΤ) σημειώνει «❌ deferred: τοίχος/δοκάρι/πλάκα placement (διαφορετικό FSM)· snap σε στοιχεία άλλου ορόφου». Δηλαδή ο συλλέκτης (point-based) πιθανότατα ταιριάζει στο υπάρχον FSM· ο σωλήνας (linear, 2-click) ίσως θέλει επέκταση.

---

## 🧭 ΠΩΣ ΝΑ ΞΕΚΙΝΗΣΕΙΣ (ADR-driven, N.0.1)

1. **N.14 MODEL ENFORCEMENT:** δήλωσε μοντέλο (Opus για 3D placement cross-cutting) + περίμενε «ok».
2. **PHASE 1 RECOGNITION (Plan Mode):**
   - Διάβασε **ADR-403** + σύγκρινε με τον τρέχοντα κώδικα (CODE = source of truth).
   - Χαρτογράφησε το 3D placement pipeline: πού ζει το FSM, πώς γίνεται raycast στο ground plane, πώς ένα 3D κλικ → world point → entity creation command. Ψάξε π.χ. `bim-3d/placement/`, `use-bim3d-*-placement*`, `MepManifoldPlacementGhost.ts`.
   - Βρες πώς τοποθετείται ΗΔΗ ένα point-based entity στο 3D (αν υπάρχει) → reuse το FSM/raycast για τον συλλέκτη.
   - Για τον σωλήνα (2-click linear): δες αν το ADR-403 FSM υποστηρίζει 2-click ή χρειάζεται επέκταση (mirror του 2D `useMepSegmentTool`).
3. **FULL SSOT:** μην κάνεις fork του 2D placement logic. Reuse completion builders (`mep-manifold-completion`, `mep-segment-completion`), commands, enterprise-id. Το 3D κομμάτι = μόνο «3D κλικ → world point», μετά ίδιο pipeline με 2D.
4. Plan → ExitPlanMode → υλοποίηση → tests + tsc → docs (ADR-403 + ADR-408 + ΕΚΚΡΕΜΟΤΗΤΕΣ + memory).

---

## ⚠️ ΚΡΙΣΙΜΕΣ ΠΡΟΣΟΧΕΣ

- **SHARED WORKING TREE** με άλλον agent (ADR-421 «BIM Opening Types / double-door»). **git add ΜΟΝΟ τα δικά σου αρχεία, ΠΟΤΕ `git add -A`. ΜΗΝ αγγίξεις το adr-index** (το επεξεργάζεται ο άλλος).
- **Pre-existing tsc errors που ΔΕΝ είναι δικά σου** (μην τα «διορθώσεις», είναι WIP άλλου agent):
  - `bim-3d/converters/mesh-to-object3d.ts:124` (pre-existing ADR-411)
  - `core/commands/entity-commands/DeleteEntityCommand.ts:52` (floor-finish/double-door WIP)
  - `hooks/drawing/drawing-preview-generator.ts:116` (floor-finish WIP)
  - `rendering/ghost/apply-entity-preview.ts:316` (WIP)
  - Φίλτραρε το tsc output ΜΟΝΟ για τα δικά σου paths.
- **ADR-040:** αν αγγίξεις canvas drawing / micro-leaf αρχεία (CHECK 6B/6C/6D) → STAGE το ADR-040. Το 3D viewport placement ζει σε `bim-3d/` — συνήθως ΕΚΤΟΣ ADR-040, αλλά επιβεβαίωσε.
- **ΠΟΤΕ commit/push** χωρίς ρητή εντολή Giorgio (N.(-1)). Ο Giorgio κάνει τα commits.

---

## 📦 UNCOMMITTED STATE (προηγούμενο work — ο Giorgio θα το commit-άρει)

**ADR-408 Φ12 follow-up — Συλλέκτης: grips add/remove outlet (Revit array-control ▲/▼)** — ΟΛΟΚΛΗΡΩΜΕΝΟ, tsc 0 δικά μου, jest 63/63 manifold + 7/7 glyph + 898 grip/mep regression PASS. 🔴 pending browser verify + commit (Giorgio).

14 αρχεία (2 NEW):
- NEW `bim/mep-manifolds/mep-manifold-param-update.ts` (SSoT command-builder)
- NEW `bim/mep-manifolds/__tests__/mep-manifold-param-update.test.ts`
- `ui/ribbon/hooks/useRibbonMepManifoldBridge.ts` (dispatchParams→helper)
- `hooks/grip-kinds.ts` · `bim/mep-manifolds/mep-manifold-grips.ts` · `rendering/grips/types.ts` · `rendering/grips/GripShapeRenderer.ts` · `bim/grips/grip-glyph-registry.ts` · `hooks/grips/grip-parametric-centred-box-commits.ts` · `hooks/grips/grip-parametric-commits.ts` · `hooks/grips/grip-commit-adapters.ts`
- `bim/mep-manifolds/__tests__/mep-manifold-grips.test.ts` · `bim/grips/__tests__/grip-glyph-registry.test.ts`
- `docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md`

Λεπτομέρειες: ADR-408 changelog (entry 2026-06-07) + memory `project_adr408_phi12_plumbing_manifold.md` (section «GRIPS ADD/REMOVE OUTLET»).

**Σημείωση:** αυτό το work δεν εμποδίζει το 3D placement — διαφορετικά αρχεία. Αλλά αν ο Giorgio δεν έχει ακόμη commit-άρει, πρόσεξε να μην ξανα-επεξεργαστείς τα ίδια grip αρχεία χωρίς λόγο.

---

## ✅ DEFINITION OF DONE (νέο task)
- Συλλέκτης + σωλήνας ύδρευσης τοποθετούνται με κλικ **μέσα στο 3D viewport** (Revit-style).
- FULL SSOT: reuse completion/commands/enterprise-id, μηδέν fork του 2D pipeline.
- tests + tsc 0 δικά σου + docs (ADR-403/408 + ΕΚΚΡΕΜΟΤΗΤΕΣ + memory, N.15).
- 🔴 browser verify + commit = Giorgio.
