# HANDOFF — Foundation cross-level: ADR-484 DONE (Slice 1+2) + aggregator cross-floor guard gap (επόμενο slice)

**Ημ/νία:** 2026-06-18 · **Γλώσσα: ΠΑΝΤΑ Ελληνικά.** · **Status: ADR-484 UNCOMMITTED (tsc+commit = Giorgio).**
> ⚠️ **Shared working tree** με άλλον agent (ADR-483 canvas diagrams). **git add ΜΟΝΟ δικά σου, ΠΟΤΕ `-A`.** commit/tsc = Giorgio (N.17/N.-1). jest = κανονικά.

---

## 0. TL;DR
1. **ADR-484 Slice 1+2 = DONE (UNCOMMITTED).** Cross-level foundation Properties (κοινός resolver) + Revit-canonical level assignment (foundation placement → ΠΑΝΤΑ foundation level). 9 jest GREEN +253 regression.
2. **Baseline βάσης:** `HANDOFFS/BASELINE_2026-06-18_FOUNDATION-data-state.md` — ΡΙΖΑ του «πράσινα πέδιλα στο Ισόγειο» = **Ισόγειο & Θεμελίωση μοιράζονται sceneFileId `file_80efad96`** (cross-linked, legacy data). `floorplan_foundations` model = 0.
3. **Επόμενο slice (εγκεκριμένο):** **belt-and-suspenders** — εφάρμοσε file-level `isCrossFloorSceneLink` guard στους 3 aggregators (διαρρέουν cross-floor όταν shared sceneFileId + untagged entities).

---

## 1. ✅ ADR-484 — ΤΙ ΕΓΙΝΕ (UNCOMMITTED, δικά μου αρχεία)
ADR: `docs/centralized-systems/reference/adrs/ADR-484-cross-level-foundation-properties.md` (πλήρες· Slice 1+2 + changelog).
- **Slice 1 (cross-level Properties):** NEW `systems/selection/resolve-selected-entity.ts` (+test) + `hooks/selection/useResolvedSelectedEntity.ts`. ΕΝΑΣ resolver (active scene → fallback `useFoundationLevelStore` low-freq). Reused: `BimPropertiesShell`, `BimPropertiesRouter`, `FoundationPropertiesTab`, `app/ribbon-contextual-config.ts` (`useActiveContextualTrigger`). Cross-level-aware write: `useFoundationParamsDispatcher.ts`.
- **Slice 2 (level assignment «όπως η Revit»):** SSoT routing στο `bim/foundations/add-foundation-to-scene.ts` (+test) — foundation placement → ΠΑΝΤΑ foundation level μέσω `foundation-cross-level-writer` (reuse). `hooks/tools/useSpecialTools.ts` (auth scope). `hooks/drawing/useFoundationTool.ts` (αφαίρεση misleading warning + unused imports).
- **git add ΜΟΝΟ:** τα 11 παραπάνω + ADR-484 + adr-index (κοινό· μόνο γραμμές ADR-484). **ΟΧΙ** τα ADR-483 αρχεία του άλλου agent.
- 🔴 tsc(Giorgio full) + browser-verify + commit.

## 2. 📊 BASELINE βάσης («Κτήριο Α1») — δες `BASELINE_2026-06-18_FOUNDATION-data-state.md`
- bldg `bldg_58f47bf1-4d41-4276-9929-bed8f1aa1a9d` · project `proj_12788b6a-ea19-41cd-90a0-a340e6bacaab` · company `comp_9c7c1a50-...`
- Floors: Θεμελίωση «F» `flr_c25e29a6` (kind=foundation, elev -1) · Ισόγειο `flr_215e39f3` (ground) · 1ος/2ος/SP.
- DXF levels: **Ισόγειο `lvl_21982f3b` ΚΑΙ F `lvl_4b38b269` → ΙΔΙΟ `sceneFileId=file_80efad96`** ⚠️ (ρίζα).
- `floorplan_foundations` model: **0 docs**. Τα foundations ζουν ΜΟΝΟ στο shared scene blob.
- **Αρχιτεκτονική = σωστή/enterprise** (3-tier: scene→Firebase Storage `.scene.json`, metadata→`files`, levels→`dxf_viewer_levels`, structured BIM→`floorplan_foundations`). Όπως οι μεγάλοι (Autodesk APS/Onshape/Speckle). Το θέμα είναι DATA (shared fileId), ΟΧΙ architecture.

## 3. 🎯 ROOT CAUSE «γιατί το F πήρε το ίδιο sceneFileId» (ADR-399)
`cross-floor-link.ts` το τεκμηριώνει: auto-save `fileRecordId` ήταν **sticky across level switches**. Σχεδίαση στο Ισόγειο (fileId=file_80ef) → μετάβαση στο file-less F → autosave με sticky fileId → `linkSceneToLevel('F', file_80ef)` (`useLevelSceneLoader.ts:313`) → shared.
**Διορθωμένο για ΝΕΑ ροή** (3 guards): `resetDxfAutoSaveTarget()` file-less (`useLevelSceneLoader:112-127`) · `isCrossFloorSceneLink` (`:177-183`) · ADR-469 orphaned-target latch (`useAutoSaveSceneManager:286`). Το shared fileId = legacy (προ-guards).

## 4. 🚨 CODE GAP (επόμενο slice — εγκεκριμένο belt-and-suspenders)
`isCrossFloorSceneLink` (file-level) εφαρμόζεται **ΜΟΝΟ** στο `useLevelSceneLoader` (2D active). Οι aggregators χρησιμοποιούν per-entity `stripForeignFloorBim` (`scene-bim-load-policy.ts:79-88`) που **ΚΡΑΤΑ τα untagged entities** (χωρίς `floorId`) → cross-floor leak όταν shared sceneFileId + untagged.
- `useFloors3DAggregator.ts` (3D) — μόνο `stripForeignFloorBim`.
- `useBuildingFloorScenes.ts` (2D underlay) — μόνο `stripForeignFloorBim`.
- `useFoundationLevelSync.ts` — μόνο `stripFootings` (κανένα floorId φίλτρο στα baseEntities· φορτώνει `target.sceneFileId`=shared).

**TASK επόμενου slice:** εφάρμοσε `isCrossFloorSceneLink(fileRecord, ownFloorId)` ΚΑΙ στους 3 aggregators ΠΡΙΝ το aggregate (skip scene που το fileRecord ανήκει σε άλλο floor). SSoT: reuse `cross-floor-link.ts` (μην διπλασιάσεις). Προστατεύει ανεξάρτητα από entity tagging. + jest. PLAN MODE πρώτα.

## 5. ΑΜΕΣΟ (Giorgio, data) — πριν/για δοκιμές
1. set `sceneFileId=null` στο F level (`lvl_4b38b269`) — λύνει το συγκεκριμένο legacy.
2. Σβήσε τα πρόχειρα foundation entities από το shared `file_80efad96`.
3. Επιβεβαίωσε: foundation level ΔΕΝ μοιράζεται sceneFileId με άλλο όροφο.

## 6. ❌ ΜΗΝ
- ΜΗΝ αλλάξεις τα χρώματα ανά kind (by design ADR-445 — ο Giorgio το επιβεβαίωσε).
- ΜΗΝ αγγίξεις ADR-483 / canvas diagrams (άλλος agent).
- ΜΗΝ κάνεις tsc/commit (Giorgio).
- ΜΗΝ διπλασιάσεις cross-floor logic — reuse `cross-floor-link.ts`.

## 7. ΕΚΚΡΕΜΟΤΗΤΕΣ entry: `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (ADR-484 line) ενημερωμένο. MEMORY: `reference_cross_level_selection_resolver_ssot.md`.
