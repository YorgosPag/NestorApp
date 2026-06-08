# 🧠 HANDOFF — ADR-426 Ύδρευση Pilot **Slice 2** (Preview + Commit): PLAN MODE

> **Σύνταξη:** Opus 4.8, 2026-06-08. **Στόχος νέας συνεδρίας: PLAN MODE για το Slice 2 του water-supply auto-design** — το preview/commit layer που μετατρέπει το `WaterNetworkProposal` (Slice 1, headless, έτοιμο) σε **πραγματικούς σωλήνες + δίκτυα στον καμβά**, Revit-style «Generate → review → accept». Προηγήθηκαν: Stage 0 Recognition (ADR-425) + Slice 1 engine (ADR-426), και τα δύο DONE + committed.

---

## ⚠️ ΚΑΝΟΝΕΣ (αμετάβλητοι)
- **Ελληνικά** όλες οι απαντήσεις (LANGUAGE RULE CLAUDE.md).
- **FULL ENTERPRISE + FULL SSOT, «όπως οι μεγάλοι παίχτες / η Revit»** — πάγια εντολή Giorgio. Μηδέν `any`/`as any`/`@ts-ignore`, αρχεία ≤500 γρ., functions ≤40 γρ.
- **SHARED working tree** με άλλον agent (codex). Όταν γραφτεί κώδικας: `git add` **ΜΟΝΟ δικά σου** αρχεία, **ΠΟΤΕ** `git add -A`.
- **COMMIT τον κάνει ΜΟΝΟ ο Giorgio** (N.(-1)). Εσύ ΔΕΝ κάνεις commit/push. ΜΗΝ αγγίξεις **adr-index** (shared tree).
- **Plan Mode πρώτα.** Slice 2 αγγίζει **ADR-040** + UI/ribbon → σχεδίασε & ζήτα έγκριση **ΠΡΙΝ** κώδικα.
- **ADR-driven (N.0.1):** code = source of truth. Επιβεβαίωσε κάθε claim του handoff με τον τρέχοντα κώδικα πριν το θεωρήσεις δεδομένο.
- **N.17:** ΕΝΑΣ tsc τη φορά — έλεγξε ότι δεν τρέχει ήδη άλλος πριν ξεκινήσεις.
- **N.11 i18n:** μηδέν hardcoded strings — πρόσθεσε keys σε `src/i18n/locales/el/*.json` **ΚΑΙ** `en/*.json` ΠΡΙΝ τις χρησιμοποιήσεις (CHECK 3.8 ratchet).

---

## 1) ΤΙ ΔΙΑΒΑΖΕΙΣ ΠΡΩΤΑ
1. **`docs/centralized-systems/reference/adrs/ADR-426-water-supply-auto-design.md`** — το pilot ADR (§2 pipeline, §3 slicing, §4 files). **Slice 2 = §3 row 2.**
2. **`docs/.../ADR-423-mep-auto-design-framework.md`** §3 (Stage 3/4/5) + §5 reuse map — το umbrella.
3. **`docs/.../ADR-040-preview-canvas-performance.md`** — **ΥΠΟΧΡΕΩΤΙΚΟ** (το Slice 2 προσθέτει ghost/preview leaf· CHECK 6B/6C/6D BLOCK αν αγγίξεις canvas/micro-leaf αρχεία χωρίς staged ADR).
4. Κώδικας Slice 1 (input σου): `src/subapps/dxf-viewer/systems/mep-design/water/` — κυρίως `design-water-supply.ts` + `water-design-types.ts` (`WaterNetworkProposal`/`ProposedNetwork`/`ProposedSegment`).
5. Μνήμη: `project_adr426_water_supply_auto_design`, `project_adr425_stage0_recognition`, `project_adr423_mep_auto_design`.

## 2) ΤΙ ΕΙΝΑΙ ΤΟ SLICE 2 (το σχέδιο που θα φτιάξεις)
Revit «Generate → review → accept»:
1. **Trigger** — ribbon command στην ομάδα MEP/Plumbing (π.χ. «Αυτόματη Ύδρευση»). Τρέχει: `registerMepRecognition()` + `recognizeSceneFromRegistry({entities, storeyId, sceneUnits})` → `designWaterSupply(model, entities)` → `WaterNetworkProposal`.
   - Entities τρέχοντος ορόφου: `useLevels().getLevelScene(currentLevelId).entities`.
2. **Preview (ADR-040 low-freq store)** — νέο `water-proposal-store.ts` (μοτίβο `bim/slabs/slab-preview-store.ts` / `wall-preview-store.ts`: module-level pub/sub set/reset/get + `useWaterProposal()`). Κρατά το `WaterNetworkProposal`. **Low-frequency** (set μία φορά στο Generate, clear στο accept/reject) — ΟΧΙ high-freq σαν transform/hover.
3. **Ghost render** — micro-leaf mount που ζωγραφίζει ΟΛΑ τα `ProposedSegment`. **Reuse `bim/mep-segments/MepSegmentGhostRenderer.ts`** (start/end pair, teal pipe) ανά segment· dashed «proposed» style· cold=teal / hot=κόκκινο-θερμό· πλάτος ~∝ DN. Μοτίβο mount: `components/dxf-layout/canvas-layer-stack-mep-segment-ghost.tsx` (→ leaf επιστρέφει `null`, subscribe στο store, render σε PreviewCanvas). Καταχώρησέ το στο `CanvasLayerStack` **όπως τα άλλα ghost mounts** (το shell ΔΕΝ subscribe-άρει high-freq· το proposal store είναι low-freq → ασφαλές).
4. **Review/commit UI** — accept/reject (toast ή μικρό panel). **Accept → `CompoundCommand`** που:
   - ανά `ProposedSegment`: `completeMepSegmentFromTwoClicks(start, end, layerId, 'pipe', {classification, diameter}, sceneUnits)` → entity → `addMepSegmentToScene(entity, accessor)` (ή append μέσα στο compound).
   - δημιουργεί τα 2 `MepSystem` (cold/hot): `buildDefaultPipeNetworkParams(name, classification, sourceEntityId, sourceConnectorId, members)` + `CreateMepSystemCommand({id: generateMepSystemId(), params})`. Members = (entityId, connectorId) — segments δίνουν `seg-start`+`seg-end`, fixtures τον matching supply connector (δες `buildAddPipeMembersUpdate`/`fixtureMembersForClassification` στο `mep-pipe-network-from-selection.ts`).
   - **Fittings ΑΥΤΟΜΑΤΑ**: μόλις μπουν τα segments, ο `useMepFittingAutoReconciliation` (500ms) βάζει γωνίες/ταυ/συστολές — **μηδέν δικός σου κώδικας**.
   - **Reject** → `store.reset()` (καμία Firestore εγγραφή).
5. **Connectivity**: τα proposed endpoints είναι ΗΔΗ στα world points των connectors (source outlet + fixture supply) → ο reconciler/`derivePipeNetworks` τα ενώνει φυσικά (tol 25mm).

**Παραδοτέο Plan:** ροή trigger→generate→preview→accept/reject, λίστα NEW/MOD αρχείων, πώς reuse-άρεις ghost/commit χωρίς fork, i18n keys, ADR-040 staging, και πού μπαίνει το ribbon button. Πρότεινε **incremental** αν χρειάζεται (π.χ. 2a preview-only, 2b commit).

## 3) REUSE SURFACE (επιβεβαιωμένο με κώδικα — μην ξανα-ψάχνεις από το μηδέν, αλλά **επαλήθευσε signatures**)
- Segment: `completeMepSegmentFromTwoClicks(...)` `hooks/drawing/mep-segment-completion.ts:187` → `{ok, entity}`.
- Append: `addMepSegmentToScene(entity, accessor)` `bim/mep-segments/add-mep-segment-to-scene.ts:17` · `appendEntityToScene(accessor, entity, tool)` `bim/scene/append-entity-to-scene.ts:41` (accessor = `useLevels()`/`DxfCommitDeps`).
- Batch: `CompoundCommand(name, cmds[])` `core/commands/CompoundCommand.ts:20` (atomic + rollback).
- Network: `buildDefaultPipeNetworkParams(...)` `bim/types/mep-system-types.ts:197` · `CreateMepSystemCommand(entity)` `core/commands/entity-commands/CreateMepSystemCommand.ts:31` · members helper `buildAddPipeMembersUpdate(...)` `bim/mep-systems/mep-pipe-network-from-selection.ts:157`.
- Fittings (αυτόματα): `useMepFittingAutoReconciliation` `hooks/data/useMepFittingAutoReconciliation.ts:130` · pure preview `resolveDesiredFittings(entities)` `bim/mep-fittings/mep-fitting-resolve.ts:163`.
- Preview infra (ADR-040): stores `bim/slabs/slab-preview-store.ts`, `bim/walls/wall-preview-store.ts` · ghost `bim/mep-segments/MepSegmentGhostRenderer.ts` · mount `components/dxf-layout/canvas-layer-stack-mep-segment-ghost.tsx` · `PreviewCanvas` `canvas-v2/preview-canvas/`.
- Input engine: `designWaterSupply(model, entities)` + `WaterNetworkProposal` από `systems/mep-design/water/index.ts` · recognition: `recognizeSceneFromRegistry` + `registerMepRecognition` από `systems/recognition/index.ts`.

## 4) ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗ γράψεις κώδικα πριν την έγκριση του plan.
- ΜΗΝ ξαναγράψεις router/sizing/demand — είναι έτοιμα (Slice 1). Το Slice 2 = **μόνο** preview + commit wiring.
- ΜΗΝ κάνεις commit/push/adr-index (Giorgio). ΜΗΝ `git add -A`.
- ΜΗΝ βάλεις high-freq subscription στο `CanvasLayerStack`/`CanvasSection` (ADR-040 CHECK 6C). Το proposal store = low-freq, leaf-only.
- ΜΗΝ hardcode-άρεις strings (i18n keys πρώτα, el+en).
- ΜΗΝ τρέξεις 2ο tsc αν τρέχει ήδη (N.17).

## 5) ΚΑΤΑΣΤΑΣΗ (committed — shared tree)
- **DONE + committed:** ADR-425 (Stage 0 recognition, `systems/recognition/`), ADR-426 Slice 1 (`systems/mep-design/water/`, 8 tests, tsc 0). HEAD περιέχει `feat(mep): water-supply auto-design` + `docs(mep): ADR-426`.
- 🔴 **Εκκρεμές (Giorgio):** adr-index entries ADR-423/424/425/426.
- Στο working tree υπάρχουν ΚΑΙ ξένα uncommitted (codex: wall/άλλα) — **δεν είναι δικά σου**.

## 6) ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ (νέα session, Opus)
1. Διάβασε §1 (ιδίως ADR-426 + ADR-040).
2. Επιβεβαίωσε με κώδικα: το shape του `WaterNetworkProposal`, τα signatures του §3 (ghost mount pattern + completeMepSegmentFromTwoClicks + CreateMepSystemCommand), και πού ζει η MEP ribbon group.
3. **Μπες Plan Mode** και σχεδίασε trigger→generate→preview→accept/reject (FULL ENTERPRISE + SSOT, reuse μέγιστο). Παρουσίασε plan για έγκριση.
4. Μετά την έγκριση → υλοποίηση + tests + update ADR-426 (Slice 2 → done, changelog) + N.15 (μνήμη). Browser-verify εδώ έχει νόημα (πρώτη φορά που ζωγραφίζεται/commit-άρεται δίκτυο).
