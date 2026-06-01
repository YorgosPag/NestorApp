# HANDOFF — «Δοκάρι από τοίχο»: 2Δ ΟΛΟΚΛΗΡΩΘΗΚΕ → επόμενο 3Δ

**Ημερομηνία:** 2026-06-02
**Μοντέλο:** Opus 4.8
**Γλώσσα απαντήσεων:** Ελληνικά ΠΑΝΤΑ (CLAUDE.md LANGUAGE RULE).

---

## 🎯 ΕΠΟΜΕΝΟ TASK (αυτό θα κάνεις στη νέα συνεδρία)

Η εντολή **«Δοκάρι από τοίχο»** δουλεύει ήδη στην **2Δ** προβολή καμβά. Ο Giorgio θέλει
**να εκτελείται ΜΕ ΤΟΝ ΙΔΙΟ ΤΡΟΠΟ και όταν ο χρήστης είναι σε προβολή καμβά 3Δ:**
- Ο χρήστης ενεργοποιεί το tool `beam-from-wall` από το ribbon.
- Σε **3Δ** προβολή κάνει **1 κλικ πάνω σε έναν 3Δ τοίχο (mesh)**.
- Δημιουργείται δοκάρι στον άξονα του τοίχου (πλάτος = πάχος τοίχου, top 3m / depth 50cm
  → κάτω μέρος 2.5m) — **ίδια συμπεριφορά με 2Δ**.
- Ο τοίχος κονταίνει αυτόματα στα 2.5m (auto-attach — δουλεύει ΗΔΗ, βλ. παρακάτω).

---

## 🚨 ΚΡΙΣΙΜΟ — SHARED WORKING TREE

- **Το working tree μοιράζεται με ΑΛΛΟΝ agent.**
- ❌ ΠΟΤΕ `git add -A`. ΜΟΝΟ stage συγκεκριμένων αρχείων δικών σου.
- ❌ ΠΟΤΕ `git checkout` / `git restore` σε αρχεία άλλου agent (μόνο `git reset HEAD` αν χρειαστεί).
- ❌ **COMMIT/PUSH ΤΑ ΚΑΝΕΙ Ο GIORGIO, ΟΧΙ ΕΣΥ** (CLAUDE.md N.(-1)).
- Πριν οτιδήποτε: `git status` + `git diff --cached` για να ξέρεις τι είναι δικό σου.

---

## ✅ ΤΙ ΟΛΟΚΛΗΡΩΘΗΚΕ ΣΕ ΑΥΤΗ ΤΗ ΣΥΝΕΔΡΙΑ (όλα PENDING COMMIT, tsc=0)

### A. «Επιλογή όμοιων κατά χρώμα» (2Δ right-click) — AutoCAD Select Similar
Κλικ σε οντότητα → δεξί-κλικ → μενού «Επιλογή όμοιων (ίδιο χρώμα)» → επιλέγει ΟΛΕΣ τις
οντότητες με ίδιο **resolved** χρώμα (κάθε είδους). SSoT = `resolveEntityStyle`.
- NEW `systems/selection/select-similar-by-color.ts` (+ test, 6/6)
- `ui/icons/MenuIcons.tsx` (SelectSimilarColorIcon)
- `ui/components/EntityContextMenu.tsx` (νέο menu item + props canSelectSimilar/onSelectSimilar)
- `components/dxf-layout/CanvasSection.tsx` (wire onSelectSimilar στο entityMenu ~γρ.451)
- i18n `el`+`en` `dxf-viewer.json`: `contextMenu.entity.selectSimilarColor`

### B. «Δοκάρι από τοίχο» (2Δ) — ΤΟ FEATURE ΠΟΥ ΕΠΕΚΤΕΙΝΕΙΣ ΣΕ 3Δ
Ribbon → «Δομικά Στοιχεία» ▸ «Δοκάρι από τοίχο» → 1 κλικ σε τοίχο → δοκάρι στον άξονά του.
Ο τοίχος κονταίνει αυτόματα στα 2.5m μέσω `useStructuralAutoAttach` (ADR-401 D) — **δωρεάν**,
επειδή το `appendAndBroadcast(...,'beam')` εκπέμπει `drawing:entity-created`.
- **NEW `bim/beams/beam-from-wall.ts`** — SSoT: `pickWallEntityAt(point, entities, tol)` +
  `buildBeamFromWall(wall, overrides, levelId, sceneUnits)`. **ΑΥΤΟ ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΕΙΤΑΙ
  ΑΥΤΟΥΣΙΟ ΣΤΟ 3Δ** (μην ξαναγράψεις beam geometry). (+ test, 7/7)
- `systems/tools/tool-definitions.ts` + `ui/toolbar/types.ts` — ToolType `'beam-from-wall'`
  (category 'drawing' → ESC αυτόματο).
- `hooks/drawing/useBeamTool.ts` — νέο option `getSceneEntities` + `placementMode`
  ('freehand' | 'from-wall') + `setPlacementMode` + κλάδος `commitFromWall` στο onCanvasClick.
- `hooks/tools/useSpecialTools.ts` — wire getSceneEntities + lifecycle (`isBeamTool` =
  'beam' || 'beam-from-wall') + useEffect setPlacementMode.
- `hooks/canvas/useCanvasClickHandler.ts` — routing `beam-from-wall` (RAW worldPoint, PRIORITY 4.91).
- `ui/ribbon/data/home-tab-draw.ts` — variant entry (commandKey 'beam-from-wall', μετά το beam).
- `app/ribbon-contextual-config.ts` — beam contextual tab μοιράζεται με beam-from-wall.
- `components/dxf-layout/CanvasSection.tsx` — `entityPickingActive` += 'beam-from-wall' (hover highlight).
- i18n `el`+`en` `dxf-viewer-shell.json`: `tools.beam.statusPickWall`, `tools.beam.errorNoWall`,
  `ribbon.commands.bim.beamFromWall.{label,tooltip}`.

### C. Fix console error «polygon union failed» (ADR-396 ETICS)
Το ETICS envelope ένωνε 50 footprints· η `polygon-clipping` σπάει σε N-way union. Πρόσθεσα
recovery **μόνο στο error-path** (snap σε ακέραιο grid + iterative pairwise fold) στο
`bim/geometry/shared/safe-polygon-boolean.ts` (+ test 50-way, 8/8). Μηδέν αλλαγή happy-path.

---

## 🧭 ΠΩΣ ΝΑ ΥΛΟΠΟΙΗΣΕΙΣ ΤΟ 3Δ (recognition pointers — ΔΙΑΒΑΣΕ ΠΡΩΤΑ)

**Πρότυπο 1 (το πιο κοντινό):** `bim-3d/viewport/use-bim3d-attach-pick.ts` (ADR-401) —
ένα `useEffect` + AbortController DOM listeners στον renderer canvas· armed όταν active tool ∈
σύνολο ΚΑΙ `selectIs3D` (ViewMode3DStore)· στο click κάνει `manager.raycastBimEntities(clientX, clientY)`
→ `{ bimId }` → εκπέμπει EventBus event. ORBIT_DRAG_PX=5 (αγνοεί orbit drag).

**Πρότυπο 2:** `bim-3d/placement/use-bim3d-column-placement.ts` (ADR-403) — 3Δ placement bridge
(raycast → ghost → EventBus `bim:place-column-3d` → 2Δ tool χτίζει). Phase 2 OSNAP =
`bim-3d/placement/placement-snap.ts`.

**Raycaster SSoT:** `bim-3d/systems/raycaster/BimEntityRaycaster.ts` + `manager.raycastBimEntities(...)`
(στο `ThreeJsSceneManager`). Επιστρέφει `{ bimId, ... }`.

**Mount point:** `bim-3d/viewport/BimViewport3D.tsx` (εκεί mount-άρονται use-bim3d-attach-pick &
column-placement). Θα mount-άρεις εκεί το νέο hook.

### Προτεινόμενο σχέδιο (mirror attach-pick + reuse 2Δ SSoT)
1. **NEW `bim-3d/viewport/use-bim3d-beam-from-wall-pick.ts`**: armed όταν `activeTool === 'beam-from-wall'`
   ΚΑΙ `selectIs3D`· στο click → `manager.raycastBimEntities(x,y)` → αν το hit είναι WallEntity →
   εκπέμπει `bim:beam-from-wall-picked-3d` { wallId } (πρόσθεσε το event στο `systems/events/EventBus.ts`).
   preventDefault/stopPropagation ώστε να μην πέσει στο 3Δ selection handler.
2. **Bridge (σε `useSpecialTools.ts` ή νέο hook):** listener στο `bim:beam-from-wall-picked-3d` →
   βρες τον wall στο scene → `buildBeamFromWall(wall, overrides, levelId, units)` (ΥΠΑΡΧΟΝ SSoT) →
   `appendAndBroadcast(levelManager, beam, 'beam')` (ΙΔΙΟ με 2Δ). Το auto-attach (τοίχος→2.5m)
   δουλεύει αυτόματα μέσω `drawing:entity-created`.
3. Mount το νέο hook στο `BimViewport3D.tsx`.
4. Tests: mirror `use-bim3d-column-placement.test.ts` + `placement-snap.test.ts`.

⚠️ **Ζήτησε διευκρίνιση** αν θέλει 3Δ ghost preview (όπως column-placement) ή απλό pick-on-click
(όπως attach-pick). Το attach-pick (χωρίς ghost) είναι το απλούστερο και πιθανότατα αρκετό.

---

## 🚫 ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗΝ ξαναγράψεις beam geometry — reuse `buildBeamFromWall` (SSoT).
- ΜΗΝ commit/push — ο Giorgio τα κάνει.
- ΜΗΝ `git add -A` / checkout άλλου agent.
- ΜΗΝ απαντήσεις σε άλλη γλώσσα εκτός Ελληνικών.

---

## 📌 ΕΚΚΡΕΜΟΤΗΤΕΣ DOCS (από αυτή τη συνεδρία — ΔΕΝ έγιναν ακόμη)
Πριν το commit (που θα κάνει ο Giorgio) πρέπει να ενημερωθούν στο ίδιο commit (N.0.1/N.15):
- **ADR-363** (changelog: beam-from-wall 2Δ + 3Δ)
- **ADR-396** (changelog: polygon-union recovery)
- **ADR-401** (αναφορά ότι το beam-from-wall αξιοποιεί το auto-attach D)
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + `adr-index.md`
Ρώτησε τον Giorgio αν θες να τα κάνεις εσύ ή αργότερα.

## 🔴 BROWSER VERIFY (εκκρεμεί για ΟΛΑ)
`localhost:3000/dxf/viewer`: (α) 2Δ select-similar· (β) 2Δ beam-from-wall (τοίχος→2.5m)·
(γ) envelope χωρίς error· (δ) **3Δ beam-from-wall (το νέο)**.
