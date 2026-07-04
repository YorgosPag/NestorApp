# HANDOFF — 3D empty canvas (NaN bounds) ΛΥΘΗΚΕ + Full consolidation plan (Option 2)

> **Ημερομηνία:** 2026-07-05
> **Subapp:** `src/subapps/dxf-viewer` (bim-3d)
> **Κατάσταση:** Κύριο bug ΛΥΘΗΚΕ + browser-verified. Απομένει: Full consolidation (Option 2) σε plan mode.
> **ADR:** ADR-537 (changelog ενημερωμένο)

---

## 0. TL;DR

Ο 3D καμβάς εμφανιζόταν **άδειος (ΟΥΤΕ DXF ΟΥΤΕ BIM)**. **Root cause:** μία οντότητα με NaN συντεταγμένη →
NaN geometry → `Box3().setFromObject()` = **NaN box**· το `Box3.isEmpty()` είναι **NaN-ΤΥΦΛΟ** (`max<min`=false
όταν NaN) → το NaN box περνούσε στο `viewport.frameBounds()` → **NaN κάμερα** → όλη η σκηνή (κοινή κάμερα)
εξαφανιζόταν. **Διορθώθηκε** με 3-layer defense + SSoT + auto-fit fallback. **Browser-verified από Giorgio:**
«ΒΛΕΠΩ ΣΤΟ 3Δ ΟΛΕΣ ΤΙΣ ΟΝΤΟΤΗΤΕΣ». Το NaN ήταν **παροδικό (load-race)** — δεν αναπαράγεται πλέον.

Πλήρες background: μνήμη `reference_box3_isempty_nan_blind_blanks_3d`.

---

## 1. ΤΙ ΕΓΙΝΕ (DONE, uncommitted — commit το κάνει ο Giorgio)

**3-layer defense-in-depth (SSoT):**
1. **Πηγή (DXF):** `DxfToThreeConverter.pushSeg` απορρίπτει NaN segment (chokepoint line/circle/arc/polyline)·
   text loop απορρίπτει (+dispose) NaN mesh.
2. **SSoT NaN-safe bounds:** NEW `bim-3d/scene/finite-bounds.ts` → `finiteBox3FromObject()` + `isFiniteBox3()`
   (setFromObject + finite-check → null σε empty/non-finite) + **dev locator** `locateNonFiniteGeometry()`.
   Δρομολογήθηκαν: `DxfToThreeConverter.getBounds`, `unionSceneBounds`, `computeSceneFramingBounds`,
   `computeBimSelectionBounds`.
3. **Sink (κάμερα):** finite-guard στο `viewport-camera.ts frameBounds` (ΠΟΤΕ κάμερα σε non-finite target).

**Follow-up A (auto-fit fallback):** NEW `ThreeJsSceneManager.ensureInitialCameraFit()` (από `syncBimEntities`
+ `syncBimEntitiesMultiFloor`): ΜΟΝΟ όταν `dxfConverter.getBounds()`=null εστιάζει στα combined BIM∪DXF bounds
(`getSceneFramingBounds`), ίδιο `initialCameraFitDone` latch. Κρατά DXF path **primary**, ViewCube synced.
→ Ποτέ ξανά χειροκίνητο `F` στην πρώτη είσοδο (BIM-only / degenerate DXF).

**Dev locator χρήση:** console `localStorage.setItem('dxf-nan-locate','1')` + **hard refresh** (cold load —
το race εμφανίζεται στο mount, ΟΧΙ σε toggle) → τυπώνει `bimType`/`bimId`. `removeItem` για off.

### Staging list (SHARED TREE — `git add` ΜΟΝΟ αυτά, verify `git diff --cached`):
```
src/subapps/dxf-viewer/bim-3d/converters/DxfToThreeConverter.ts
src/subapps/dxf-viewer/bim-3d/scene/finite-bounds.ts                                   (NEW)
src/subapps/dxf-viewer/bim-3d/scene/section-scene-bounds.ts
src/subapps/dxf-viewer/bim-3d/scene/scene-framing-bounds.ts
src/subapps/dxf-viewer/bim-3d/scene/ThreeJsSceneManager.ts
src/subapps/dxf-viewer/bim-3d/viewport/viewport-camera.ts
src/subapps/dxf-viewer/bim-3d/converters/__tests__/dxf-to-three-nan-guard.test.ts     (NEW)
docs/centralized-systems/reference/adrs/ADR-537-3d-raw-dxf-grip-editing.md
```
**Tests:** `npx jest src/subapps/dxf-viewer/bim-3d/converters/__tests__/dxf-to-three-nan-guard.test.ts` → 8/8 ✅
(+ `scene-framing-bounds-selection.test.ts` regression ✅). **ΜΗΝ** τρέξεις tsc (N.17).

---

## 2. ΑΠΟΜΕΝΕΙ — Option 2: Full consolidation + ratchet (Giorgio ενέκρινε, plan mode)

**Στόχος:** μηδέν raw NaN-τυφλό `setFromObject`+`isEmpty` site + pre-commit ratchet ώστε να ΜΗΝ ξαναμπεί.

### Audit (13 εναπομείναντα raw sites — 2026-07-05):
| Site | Ρίσκο |
|---|---|
| `bim-3d/systems/section/section-cap-geometry.ts:28` | 🔴 |
| `bim/structural/detail-sheet/render/{slab,footing,column,beam}-detail-3d-capture.ts` (4) | 🟠 |
| `bim-3d/converters/mesh-to-object3d.ts:95` | 🟠 |
| `bim-3d/animation/bim3d-edit-interaction-helpers.ts:103` | 🟠 |
| `bim-3d/library/bim-mesh-library/mesh-footprint-recentre.ts:31` | 🟡 |
| `bim-3d/accessibility/FocusOutlineRenderer.ts:81`, `focus-order.ts:99/157` (3) | 🟡 |
| `bim-3d/scene/DxfFloorPlanOverlay.ts:152` | ⚪ πιθανόν DEAD (superseded από DxfToThreeConverter) |

### Φάσεις:
1. **Route τα 13** → `finiteBox3FromObject` (κάθε site: χειρισμός `null` κατά την τοπική σημασιολογία — ΜΗΝ
   αλλάξει το fallback του καθενός). `DxfFloorPlanOverlay.ts` → πρώτα έλεγχος αν dead (χειροκίνητο transitive
   grep — knip ΑΓΝΟΕΙ dxf-viewer, mem `knip_ignores_dxf_viewer`)· αν dead → dead-code sweep, αλλιώς route.
2. **Ratchet:** module στο `.ssot-registry.json` που μπλοκάρει `new THREE.Box3().setFromObject(` σε νέο κώδικα,
   **allowlist** το `finite-bounds.ts` (η ΜΟΝΗ νόμιμη χρήση). ERE **ΧΩΡΙΣ** `(?:)` (mem
   `grep_no_noncapturing_groups`). Μετά: `npm run ssot:baseline` + `npm run test:registry-golden`.
3. **Tests + ADR:** επέκταση NaN-guard test + καταχώρηση ratchet module (N.12) + ADR-537 changelog.

**Ρίσκα:** `null` return → προσεκτικά branches· detail-capture = δικό τους offscreen camera (ασφαλές)· το
ratchet grep να μην πιάνει το allowlisted `finite-bounds.ts`.

**Εύρος:** ~15 αρχεία / 2 domains + ratchet infra → phased plan mode (ΟΧΙ orchestrator — Giorgio διάλεξε plan).

---

## 3. ΑΝΟΙΚΤΟ (ξεχωριστό, μη-θανατηφόρο) — πηγή BIM NaN
Το `THREE … computeBoundingBox NaN` warning προερχόταν και από **BIM οντότητα** με NaN geometry (όχι μόνο DXF).
Το defense το κάνει **μη-θανατηφόρο** (σκηνή δεν μαυρίζει), αλλά το warning θα εμφανίζεται όποτε ξαναπροκύψει.
**Παροδικό (load-race)** — δεν αναπαρήχθη στα τελευταία cold loads. Αν ξαναεμφανιστεί: τρέξε τον **locator**
(§1) σε hard refresh → στείλε `bimType`/`bimId` → fix στον σωστό converter στην πηγή. Ύποπτοι: πρόσφατα
ADR-568/569 (wall-gap / beam-between-members).

---

## 4. ΚΑΝΟΝΕΣ (απαράβατοι)
- 💾 **Commit/push ΜΟΝΟ ο Giorgio.** SHARED TREE: `git add <specific>`, verify `git diff --cached`, ΠΟΤΕ
  `git add -A` / `restore .` / `reset --hard` / checkout αρχείων άλλου agent.
- 🚫 **ΟΧΙ tsc** (N.17)· jest επιτρέπεται (στοχευμένα).
- 🎨 **ΜΗΝ αγγίξεις** το uncommitted color-SSoT (ADR-573) + grip work στο working tree.
- 📄 ADR-537 = staged μαζί με κώδικα (CHECK 6D — canvas/entity-renderer files).
- 🏢 Big-player-grade + full SSoT· πραγματικό grep-audit ΠΡΙΝ νέο κώδικα.

---

## 5. PASTE-PROMPT για νέα session (μετά /clear)

```
Διάβασε ΠΡΩΤΑ: C:\Nestor_Pagonis\HANDOFFS\2026-07-05_3d-empty-nan-bounds_FIXED+consolidation-plan.md

Το 3D-empty NaN bug ΛΥΘΗΚΕ (browser-verified) — δες §1. ΜΗΝ το ξαναπειράξεις.
Ζητούμενο: υλοποίησε το Option 2 (Full NaN-safe bounds consolidation + ratchet), §2, σε phased plan mode.
Ξεκίνα με Opus. Route τα 13 raw setFromObject sites → finiteBox3FromObject (bim-3d/scene/finite-bounds.ts,
ήδη υπάρχει), + pre-commit ratchet στο .ssot-registry.json (allowlist finite-bounds.ts).
Πρώτα SSoT/grep audit + έλεγχος αν DxfFloorPlanOverlay.ts είναι dead. Πες μου το plan ΠΡΙΝ κώδικα.
Commit το κάνει ο Giorgio. Shared tree — git add μόνο specific. ΟΧΙ tsc. ΜΗΝ αγγίξεις color/grip uncommitted.
```
