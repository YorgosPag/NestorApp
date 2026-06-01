# 🤝 HANDOFF — ADR-403 Phase 2: OSNAP σε 3Δ Column Placement

**Date:** 2026-06-01
**Agent (next):** TBD — ξεκινά σε **Plan Mode**
**Status:** 🟡 **ΝΕΑ ΦΑΣΗ — ΔΕΝ ΕΧΕΙ ΞΕΚΙΝΗΣΕΙ ΚΩΔΙΚΑΣ.** Plan-only handoff.
**Model:** Opus 4.8 (cross-cutting 3Δ + snap engine + units → Opus)

---

## ⚠️⚠️ MULTI-AGENT — ΔΙΑΒΑΣΕ ΠΡΩΤΑ (κρίσιμο)

**ΑΥΤΗ ΤΗ ΣΤΙΓΜΗ ΑΛΛΟΣ ΠΡΑΚΤΟΡΑΣ ΑΣΧΟΛΕΙΤΑΙ ΜΕ ΤΟ ADR-402.**

❌ **ΜΗΝ ΑΓΓΙΞΕΙΣ** κανένα από αυτά (ADR-402 territory, ζωντανός άλλος agent):
```
src/subapps/dxf-viewer/bim-3d/gizmo/**                 (ΟΛΟΣ ο φάκελος — gizmo, bim3d-snap-bridge, drag/resize bridges)
src/subapps/dxf-viewer/bim-3d/animation/bim3d-edit-interaction-handlers.ts
src/subapps/dxf-viewer/bim-3d/animation/use-bim3d-edit-interaction.ts
src/subapps/dxf-viewer/bim-3d/animation/bim3d-edit-live-preview.ts
src/subapps/dxf-viewer/bim-3d/animation/bim3d-preview-rebuild.ts
```
- ✅ Επιτρέπεται **READ-ONLY** για να δεις το pattern (το `bim3d-snap-bridge.ts` είναι ΕΞΑΙΡΕΤΙΚΟ reference — δες παρακάτω).
- ❌ **ΚΑΘΟΛΟΥ edit / import-and-modify** σε αυτά. Αν χρειαστείς τη λογική, **αντίγραψε το pattern** σε νέο δικό σου αρχείο στο `bim-3d/placement/`.
- ❌ **ΠΟΤΕ** `git add -A`. ❌ **ΠΟΤΕ** `git checkout`/`restore` σε αρχείο άλλου agent (μόνο `git reset HEAD` αν χρειαστεί).
- ⚠️ `EventBus.ts`, `useColumnTool.ts`, `BimViewport3D.tsx` τα αγγίζουν πολλοί — διάβασε `git diff` ΠΡΙΝ γράψεις, stage μόνο specific files.

**Ο δικός σου χώρος (ADR-403) είναι ΜΟΝΟ:** `src/subapps/dxf-viewer/bim-3d/placement/**`
Εκεί μένεις. Καμία σύγκρουση με τον ADR-402 agent.

---

## 📍 TL;DR — Τι ζητάει το Phase 2

Στο Phase 1 (✅ DONE, browser-verified, **pending commit ο Giorgio**) η κολώνα τοποθετείται στον 3Δ καμβά πάνω στο **floor plane** — αλλά **χωρίς OSNAP**. Το ghost ακολουθεί το raw σημείο raycast, δεν κουμπώνει σε γωνίες/άκρα/midpoints υπαρχόντων στοιχείων.

**Phase 2 = OSNAP στο 3Δ placement.** Όταν είναι ON το OSNAP, το ghost (και το committed σημείο) πρέπει να **κουμπώνει** στο πλησιέστερο χαρακτηριστικό σημείο (corner/endpoint/midpoint/intersection) — ίδια εμπειρία με το 2Δ (ADR-398 column corner snap).

**Deferred (ΟΧΙ τώρα):** τοίχος/δοκάρι/πλάκα σε 3Δ (διαφορετικά FSM).

---

## 🧩 Τι ΥΠΑΡΧΕΙ ΗΔΗ (όλα reusable — μηδέν διπλασιασμός)

### Α) Phase-1 placement pipeline (δικός σου χώρος — εδώ θα κουμπώσεις το snap)
| Αρχείο | Ρόλος | Πού μπαίνει το snap |
|--------|-------|---------------------|
| `bim-3d/placement/use-bim3d-column-placement.ts` | Hook (gate `activeTool==='column' && selectIs3D`, AbortController listeners, orbit-drag guard >5px) | `onMove` → snap πριν δείξεις ghost· `onClick` → snap πριν το `emit('bim:place-column-3d')` |
| `bim-3d/placement/raycast-floor-point.ts` | SSoT: raycast δαπέδου → **world** point + `resolveActiveFloorElevationMm` | δίνει το raw world σημείο |
| `bim-3d/placement/world-to-scene-point.ts` | SSoT: `worldToDxfPlan(world)` → **mm** → `× mmToSceneUnits` → scene units | ⭐ ΕΔΩ είναι ο φυσικός κόμβος: το **mm** ενδιάμεσο είναι ΑΚΡΙΒΩΣ ο χώρος του snap engine |
| `bim-3d/placement/ColumnPlacementGhost.ts` | Ημιδιαφανές ghost mesh (WYSIWYG) | δείξε το στο **snapped** σημείο |

### Β) Snap engine SSoT (κοινό, read-only reuse — ΟΧΙ ADR-402)
- **`src/subapps/dxf-viewer/snapping/global-snap-engine.ts`** → `getGlobalSnapEngine()` επιστρέφει το ΕΝΑ `ProSnapEngineV2`.
  - `engine.findSnapPoint(cursorMm, excludeEntityId?)` → `{ found, snapPoint: { point } | null }` — **δουλεύει σε DXF plan mm**.
  - `engine.getSettings().enabled` → OSNAP on/off gate.
  - ✅ Αυτό το module είναι **κοινό SSoT** (το διαβάζουν 2Δ + ADR-402). Reuse ελεύθερα — **δεν** ανήκει στον ADR-402 agent.

### Γ) Reference pattern (READ-ONLY — μην το αγγίξεις, μόνο αντίγραψε τη λογική)
- `bim-3d/gizmo/bim3d-snap-bridge.ts` (ADR-402) δείχνει ΑΚΡΙΒΩΣ πώς να τυλίξεις το `findSnapPoint`:
  - `makeResizeSnapFn(engine)` = «το σημείο κουμπώνει στο πλησιέστερο feature» → **αυτό ακριβώς θες για placement** (single point snap).
  - Δομικά: `if (!engine.getSettings().enabled) return null; const r = engine.findSnapPoint(mm); return r.found ? r.snapPoint.point : null`.
  - ⚠️ Είναι ADR-402. **ΜΗΝ το import-άρεις** (θα μπλέξεις τα territories). Γράψε δικό σου `placement-snap.ts` με την ίδια ~6γραμμη λογική, καλώντας απευθείας `getGlobalSnapEngine()`.

---

## 🏗️ Προτεινόμενη αρχιτεκτονική Phase 2 (επιβεβαίωσε σε Plan Mode)

**Νέο αρχείο:** `bim-3d/placement/placement-snap.ts` (δικός σου χώρος)
```
resolvePlacementSnap(planMm: Point2D): { snappedMm: Point2D; markerMm: Point2D } | null
  - engine = getGlobalSnapEngine()
  - if (!engine.getSettings().enabled) return null            // OSNAP off → free placement
  - r = engine.findSnapPoint(planMm)                          // ΧΩΡΙΣ excludeId (νέα κολώνα, δεν υπάρχει ακόμα)
  - return r.found && r.snapPoint ? { snappedMm: r.snapPoint.point, markerMm: r.snapPoint.point } : null
```

**Wiring στο `use-bim3d-column-placement.ts` (το μόνο MOD):**
1. Στο `onMove`: raycast → world → `worldToDxfPlan` → **mm**. Κάλεσε `resolvePlacementSnap(mm)`.
   - Αν snap → χρησιμοποίησε το `snappedMm` για το ghost (`× mmToSceneUnits`) + δείξε **3Δ snap marker** στο `markerMm`.
   - Αν `null` → raw point (σημερινή συμπεριφορά).
2. Στο `onClick`: **ίδιο** snap στο σημείο πριν το `emit('bim:place-column-3d', scenePoint)` → **WYSIWYG** (ghost == commit). Κρίσιμο: μην κάνεις snap μόνο στο ghost και raw στο commit.

**Units (ΠΡΟΣΟΧΗ — το κλασικό 1000× bug):** ο snap engine δουλεύει σε **mm**. Το `findSnapPoint` παίρνει & επιστρέφει **mm**. Μετατροπή σε scene units γίνεται ΜΟΝΟ στο τέλος μέσω `mmToSceneUnits` (όπως ήδη κάνει το `world-to-scene-point.ts`). Μη μπερδέψεις τα spaces.

**3Δ snap marker (προαιρετικό αλλά Google-level):** μικρό glyph/sphere στο `markerMm` (world) όσο κρατάει το snap — mirror του 2Δ snap indicator. Αν το βάλεις, νέο αρχείο στο `placement/` (π.χ. `PlacementSnapMarker.ts`), reuse `markSceneDirty`.

---

## ❓ Ανοιχτά για τον Giorgio (ρώτα σε Plan Mode, απλά ελληνικά + παραδείγματα, ΕΝΑ-ΕΝΑ)
1. **Snap marker σε 3Δ;** Θες να φαίνεται ένδειξη (π.χ. κίτρινο τετραγωνάκι) πάνω στη γωνία που κουμπώνει, όπως στο 2Δ; (Πρόταση: ναι, Google-level.)
2. **Ποια OSNAP modes;** Όλα όσα είναι ήδη ON στο 2Δ (endpoint/midpoint/corner/intersection), ή subset για placement;
3. **Snap σε στοιχεία ΑΛΛΟΥ ορόφου** (στο multi-floor «Όλοι»); Πρόταση: μόνο ενεργού ορόφου (συνέπεια με Phase 1 elevation).

---

## 🧪 Verification plan (Phase 2)
- Νέα tests στο `bim-3d/placement/__tests__/`: `placement-snap.test.ts` (OSNAP off→null, snap-hit→snappedMm, no-hit→null) + update στο `use-bim3d-column-placement` test (snap path).
- `npx tsc --noEmit` (background).
- 🔴 Browser `/dxf/viewer`: 3Δ → Κολώνα → πλησίασε γωνία υπάρχουσας κολώνας/τοίχου → ghost **κουμπώνει** → marker εμφανίζεται → κλικ → τοποθετείται ΑΚΡΙΒΩΣ στη γωνία (σύγκριση με 2Δ) → OSNAP off → free placement.

---

## 🚧 ΕΚΚΡΕΜΕΙ ΑΠΟ PHASE 1 (μην το ξεχάσεις)
Το **Phase 1 column placement είναι ΑΚΟΜΑ pending commit** (browser-verified, ο Giorgio κάνει commit, ΟΧΙ ο agent — N.(-1)). Στο working tree συνυπάρχουν ADR-401 + ADR-402 αρχεία άλλων agents. **Stage ΜΟΝΟ specific ADR-403 files** όταν/αν στο πει ο Giorgio:
```
src/subapps/dxf-viewer/bim-3d/placement/
src/subapps/dxf-viewer/bim-3d/systems/raycaster/BimEntityRaycaster.ts
src/subapps/dxf-viewer/systems/events/EventBus.ts          # ⚠️ έλεγξε git diff — μπορεί να έχει & ADR-402 αλλαγές
src/subapps/dxf-viewer/hooks/drawing/useColumnTool.ts       # ⚠️ ίδιο
src/subapps/dxf-viewer/bim-3d/viewport/BimViewport3D.tsx    # ⚠️ ίδιο
docs/centralized-systems/reference/adrs/ADR-403-3d-bim-element-placement.md
docs/centralized-systems/reference/adr-index.md
local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt
```

---

## 📋 N.15 — Μετά την υλοποίηση Phase 2 (ΟΛΑ στο ίδιο commit)
- ADR-403: ενημέρωσε **Deferred** (OSNAP → DONE), **Files**, **Changelog**, Status header.
- `adr-index.md` (αν αλλάξει status).
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (ΟΜΑΔΑ 3ΔΤ).
- Memory `project_adr403_3d_column_placement.md` + `MEMORY.md` index line.

---

## 🚦 Next Session — Start Here
1. **Plan Mode.** Διάβασε ADR-403 (§Deferred + §Αρχιτεκτονική) + αυτό το handoff.
2. Read-only: `bim3d-snap-bridge.ts` (pattern) + `world-to-scene-point.ts` + `use-bim3d-column-placement.ts`.
3. Ρώτα Giorgio τα 3 ανοιχτά (ΕΝΑ-ΕΝΑ, απλά ελληνικά).
4. Υλοποίησε `placement-snap.ts` + wiring + (προαιρετικά) marker. **ΜΟΝΟ στο `bim-3d/placement/`.**
5. ❌ ΜΗΝ αγγίξεις ADR-402 (gizmo/animation). ❌ ΜΗΝ commit χωρίς ρητή εντολή.

**Ref:** ADR-403 §Deferred. Memory: `project_adr403_3d_column_placement.md`. Σχετικά: ADR-398 (2Δ column corner snap), ADR-402 (3Δ gizmo snap — reference pattern), ADR-366 (3Δ viewport), ADR-009 (3Δ units).
