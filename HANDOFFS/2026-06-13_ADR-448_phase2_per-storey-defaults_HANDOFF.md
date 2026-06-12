# HANDOFF — ADR-448 Phase 2: Per-Storey BIM Creation Defaults + Foundation Gating

**Date:** 2026-06-13 · **Branch:** main · **Μοντέλο: Opus** · **Shared working tree** (ΑΛΛΟΙ agents δουλεύουν ταυτόχρονα — **icon-agent** σε `ui/ribbon/data/*.ts`· **ADR-449 finish-skin agent** σε `bim-3d/converters/bim-three-structural-converters.ts`. **git add ΜΟΝΟ δικά σου hunks, ΠΟΤΕ `git add -A`**).

> 🎯 **ΕΝΤΟΛΗ GIORGIO (διαρκής):** «όπως οι μεγάλοι, όπως η Revit. FULL ENTERPRISE + FULL SSoT.» Απάντα **ΕΛΛΗΝΙΚΑ**.
> ⚠️ **COMMIT/PUSH τα κάνει ΜΟΝΟ ο Giorgio — ΠΟΤΕ ο agent** (CLAUDE.md N.(-1)). Ο agent ετοιμάζει & σταματά.
> ⚠️ **ΚΑΝΟΝΕΣ:** N.14 (δήλωσε μοντέλο). N.17 (ΕΝΑ tsc τη φορά — ή IDE `mcp__ide__getDiagnostics` που ΔΕΝ spawn-άρει tsc). function ≤40γρ, file ≤500γρ, no `any`, i18n ICU single-brace `{var}`. N.0.1 ADR-driven (code=SoT). N.15 (ενημέρωσε ADR-448 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY μετά υλοποίηση).

---

## 0. ΣΤΟΧΟΣ PHASE 2

Τα **BIM tool defaults τη στιγμή δημιουργίας** να κληρονομούν από το **Active Storey Context** (που χτίστηκε στη Phase 1):
- **Κολώνα / Τοίχος** ύψος = `storeyHeightMm` (αντί σταθερό 3000).
- **Οροφή / Δάπεδο «από κάναβο» & free-draw** ceiling FFL = `nextFloorElevationMm` (αντί σταθερό 3000).
- **Εδαφόπλακα / Θεμελίωση** επιτρέπονται **μόνο** στον κατώτατο όροφο (`isLowestOccupiedStorey`) — αλλιώς warning.

**Γιατί τώρα γίνεται ΟΡΑΤΟ:** Στη Phase 1b ο render ακολουθεί δυναμικά το ταβάνι μόνο όταν `floor.height ≠ params.height`. Με current data (όλα 3000) δεν φαίνεται διαφορά. Η Phase 2 **μπακάρει** το `storeyHeight` στο `params.height` **στη δημιουργία** → ένας τοίχος σε όροφο 3.5m γεννιέται με height 3500 **και** ο render (1b) τον δείχνει στα 3500. Μαζί = πλήρης Revit storey-awareness.

---

## 1. PHASE 1 — DONE & UNCOMMITTED (ΜΗΝ revert)

**Phase 1 (Slice 1a datum SSoT + Slice 1b storey-ceiling render «πλήρες Revit») ολοκληρώθηκε, uncommitted, 20 αρχεία.** Ο Giorgio θα κάνει commit. **ΜΗΝ τα revert.** 25 νέα jest + 87 regression PASS + IDE clean.

### Η SSoT που θα καταναλώσει η Phase 2 (ΗΔΗ υπάρχει):
- **`src/subapps/dxf-viewer/systems/levels/active-storey-store.ts`** — dedicated Zustand `{ context: ActiveStoreyContext | null }`. **Reader non-React:** `useActiveStoreyStore.getState().context` (όπως το `bim3d-resync`). **Reader React:** `useActiveStoreyContext()` (από `useActiveStoreySync.ts`).
- **`src/subapps/dxf-viewer/systems/levels/active-storey-context.ts`** — `ActiveStoreyContext` interface + pure `buildActiveStoreyContext(floors, activeFloorId)`:
  ```ts
  interface ActiveStoreyContext {
    floorId: string; storeyKind: FloorKind | null; storeyNumber: number;
    storeyHeightMm: number;            // ← Φ2: κολώνα/τοίχος height
    finishThicknessMm: number;
    floorElevationMm: number;
    nextFloorElevationMm: number | null; // ← Φ2: slab ceiling/roof FFL
    isLowestOccupiedStorey: boolean;     // ← Φ2: εδαφόπλακα/θεμελίωση gate
    buildingHasBasement: boolean;
  }
  ```
- **Writer (μην το αγγίξεις):** `useActiveStoreySync(currentLevelId)` mounted μέσα στο `useLevelId3DSync.ts`.
- **Constant:** `DEFAULT_STOREY_HEIGHT_MM` (= `DEFAULT_FLOOR_HEIGHT_M × 1000` = 3000) στο `active-storey-context.ts`.

### Phase 1 αρχεία (context, ΜΗΝ revert):
NEW: `systems/levels/active-storey-context.ts`, `active-storey-store.ts`, `useActiveStoreySync.ts`, `__tests__/active-storey-context.test.ts`, `bim-3d/converters/__tests__/storey-ceiling-render-height.test.ts`, `docs/.../adrs/ADR-448-storey-aware-dxf-viewer.md`.
MOD: `components/properties/shared/useFloorsByBuilding.ts` (+height/+finishThickness στο FloorOption), `systems/levels`→ `components/dxf-layout/useLevelId3DSync.ts`, `bim-3d/scene/{bim-scene-context,multi-floor-3d-source,BimSceneLayer,scene-manager-actions,ThreeJsSceneManager,bim3d-resync,bim-scene-attach-syncs}.ts`, `bim-3d/converters/{BimToThreeConverter,bim-three-structural-converters}.ts`, `bim-3d/scene/__tests__/BimSceneLayer-multifloor.test.ts`, `hooks/data/useFloors3DAggregator.ts`.

---

## 2. SEAMS PHASE 2 (code=SoT, επαληθευμένα 2026-06-13)

**Pattern παντού:** `overrides.X ?? storey?.Y ?? LEGACY_CONSTANT`. Δηλαδή: explicit override → storey default → σταθερό fallback. Το `storey` διαβάζεται με `useActiveStoreyStore.getState().context` (non-React, ασφαλές στα completion handlers — ίδιο pattern με `bim3d-resync`).

| Entity | Αρχείο:γραμμή | Τρέχον | Φ2 |
|---|---|---|---|
| **Τοίχος** ύψος | `hooks/drawing/wall-completion.ts:92` | `overrides.height ?? DEFAULT_WALL_HEIGHT_MM` | `?? storey?.storeyHeightMm ?? DEFAULT_WALL_HEIGHT_MM` |
| **Κολώνα** ύψος | `hooks/drawing/column-completion.ts:139` | `overrides.height ?? DEFAULT_COLUMN_HEIGHT_MM` | `?? storey?.storeyHeightMm ?? …` |
| **Κολώνα** ghost preview | `bim/columns/column-anchor-ghosts.ts:102` | `overrides.height ?? DEFAULT_COLUMN_HEIGHT_MM` | ίδιο (ώστε ghost = τελικό) |
| **Κολώνα** από κάναβο | `bim/columns/column-from-grid.ts:55` | `overrides.height ?? DEFAULT_COLUMN_HEIGHT_MM` | ίδιο (προσοχή: εδώ baseHeight + baseDrop continuity — ΜΗΝ σπάσεις το GEN-COL→θεμελίωση) |
| **Πλάκα** ceiling/roof FFL | `hooks/drawing/slab-completion.ts:99` | `overrides.levelElevation ?? SLAB_KIND_DEFAULT_LEVEL_ELEVATION_MM[kind]` | για `kind∈{ceiling,roof}`: `?? storey?.nextFloorElevationMm ?? SLAB_KIND_DEFAULT…` (floor/ground/foundation μένουν 0) |
| **Εδαφόπλακα/Θεμελίωση** gating | foundation/slab-ground tools (βλ. `slab-from-grid.ts`, `foundation-*` tools) | — | επίτρεψε μόνο `storey?.isLowestOccupiedStorey !== false`· αλλιώς warning notification |

### ⚠️ Προσοχές:
- **`column-from-grid.ts:55`** — εδώ υπάρχει ΗΔΗ static continuity (κολώνες κατώτατου→θεμελίωση, `baseHeight + baseDrop`). Το `storeyHeightMm` πρέπει να αντικαταστήσει το `DEFAULT_COLUMN_HEIGHT_MM` ΧΩΡΙΣ να σπάσει το `baseOffset:foundationBaseLevelMm` continuity. Πρόσεξε το (ADR-441 GEN-COL).
- **Completion handlers = pure/non-React.** Επιβεβαίωσε ότι το `useActiveStoreyStore.getState()` εισάγεται καθαρά (κανένα React-hook import σε pure module). Το store είναι plain Zustand → `getState()` δουλεύει παντού (ίδιο με `bim3d-resync.ts`).
- **Foundation gating:** βρες τα foundation/εδαφόπλακα tool entry points (grep `isLowestOccupiedStorey` δεν υπάρχει ακόμα· δες `bim/slabs/slab-from-grid.ts` `buildGroundBearingSlabs` + foundation tools). Το gate = soft warning (notification), ΟΧΙ hard block — ο μηχανικός μπορεί να ξέρει κάτι που εμείς όχι (Revit-style: επιτρέπει αλλά προειδοποιεί).

---

## 3. ΣΕΙΡΑ ΕΡΓΑΣΙΑΣ (N.0.1 ADR-driven)

1. **Phase 1 recognition (code=SoT):** διάβασε `active-storey-context.ts` + `active-storey-store.ts` (η SSoT). Επιβεβαίωσε τα 5 seams §2 (γραμμές μπορεί να μετακινήθηκαν — shared tree).
2. **Δήλωσε μοντέλο (N.14)** = Opus.
3. **Mode (N.8):** ~5-6 αρχεία, 1-2 domains → Plan Mode (όχι orchestrator). Δικαιολόγησε & μπες μόνος.
4. **ADR-448 ΠΡΩΤΑ** (update §6 Phase 2 + decisions + changelog).
5. **Υλοποίηση** ανά seam· jest για κάθε (π.χ. `wall-completion` με storey context vs χωρίς).
6. **Verify** (read-only MCP firestore baseline→action→re-query + browser): project `pagonis-87766`, floorplan `file_32a7a4fb…`. Άλλαξε `floor.height` ορόφου σε 3.5m → δημιούργησε τοίχο/κολώνα → height=3500 (DB) + render στα 3500 (1b). Εδαφόπλακα σε άνω όροφο → warning.
7. **N.15:** ADR-448 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (`project_adr448_storey_aware_dxf.md`).
8. **COMMIT ο Giorgio** — shared tree → `git add` ΜΟΝΟ δικά σου hunks. **ΠΡΟΣΟΧΗ:** το `bim-three-structural-converters.ts` έχει **interleaved ADR-449** αλλαγές (άλλος agent) — μην το αγγίξεις αν δεν χρειάζεται· αν το αγγίξεις, ο Giorgio θα ξεχωρίσει τα hunks.

---

## 4. REFERENCE
- **SSoT Phase 1:** `systems/levels/active-storey-context.ts`, `active-storey-store.ts`, `useActiveStoreySync.ts`.
- **Constants:** `bim/types/column-types.ts` (`DEFAULT_COLUMN_HEIGHT_MM`), `wall-types.ts` (`DEFAULT_WALL_HEIGHT_MM`), `slab-types.ts:224` (`SLAB_KIND_DEFAULT_LEVEL_ELEVATION_MM`), `utils/floor-naming.ts` (`DEFAULT_FLOOR_HEIGHT_M`).
- **ADRs:** ADR-448 (αυτό), ADR-369 (z-chain), ADR-441 (GEN-COL/GEN-SLAB continuity — ΜΗΝ σπάσεις), ADR-436 (foundation).
- **MEMORY:** `~/.claude/projects/C--Nestor-Pagonis/memory/project_adr448_storey_aware_dxf.md` (πλήρες ιστορικό Φ1).
