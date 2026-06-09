# 🧠 KICKOFF — ADR-435 Slice 1b: 3Δ Clash Markers + DOM Report Panel

> **Σύνταξη:** Opus 4.8, 2026-06-10 (αμέσως μετά το Slice 0 engine + Slice 1 2Δ overlay/ribbon).
> **Στόχος νέας συνεδρίας:** ολοκλήρωση της Coordination Phase 1 — **3Δ scene markers** στις συγκρούσεις + **rich DOM report panel** (λίστα clashes, click→zoom/highlight), όπως Revit/Navisworks **Clash Detective**. **FULL ENTERPRISE + FULL SSOT.**
> **Commit:** ΜΟΝΟ ο Giorgio. **Shared working tree με άλλον agent** → `git add` ΜΟΝΟ δικά σου αρχεία, ΠΟΤΕ `-A`. **ΜΗΝ adr-index** (shared tree codex).

---

## ⚠️ ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ — ΔΙΑΒΑΣΕ ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ
1. **Μνήμη:** `~/.claude/projects/C--Nestor-Pagonis/memory/project_adr435_clash.md` (πλήρης κατάσταση Slice 0+1) + `MEMORY.md` index.
2. **ADR (Code=SoT):** `docs/centralized-systems/reference/adrs/ADR-435-clash-detection.md` §5 (UI) + §7 (Slice 1b deferred). ADR-423 §10 (Coordination committed stage).
3. **ADR-040** (preview-canvas performance) — υποχρεωτικό· κάθε νέο leaf = low-freq subscriber, STAGE ADR-040 αν αγγίξεις shared canvas/scene αρχεία (CHECK 6B/6D).

---

## ✅ ΤΙ ΚΛΗΡΟΝΟΜΕΙΣ (DONE — ΜΗΝ το ξαναγράψεις)

**Slice 0 — engine (`src/subapps/dxf-viewer/systems/coordination/`):** pure/deterministic/THREE-free. 17 jest PASS (`__tests__/clash-detection.test.ts`). Αρχεία: `clash-types` · `entity-world-aabb` (SSoT normaliser) · `aabb` · `broad-phase` · `clash-narrow-phase` · `clash-pair-filter` · `clash-rules` · `detect-clashes` · `index`.

**Slice 1 — UI 2Δ (DONE):** `clash-report-store` (low-freq) + `hooks/tools/useClashOverlayPreview.ts` (2Δ markers + count badge) + `components/dxf-layout/canvas-layer-stack-clash-overlay.tsx` (mounted στο `PreviewCanvasMounts`) + ribbon `ui/ribbon/hooks/useRibbonClashDetectionBridge.ts` «Έλεγχος Συγκρούσεων» Detect/Clear + `bridge/clash-detection-command-keys.ts` + button `draw.bim.clashDetection` (home-tab-draw) + wiring (useDxfBimBridges/useDxfViewerRibbon/useRibbonCommands(+types)) + i18n el+en.

### 🔑 ΤΑ CONTRACTS ΠΟΥ ΘΑ ΚΑΤΑΝΑΛΩΣΕΙΣ (μην τα αλλάξεις — απλώς διάβασέ τα)
- **Store:** `clashReportStore` (`systems/coordination/clash-report-store.ts`):
  - React: `useClashReport(): ClashReportReview | null`
  - imperative: `clashReportStore.get()` / `.set(review)` / `.reset()`
  - `ClashReportReview = { report: ClashReport; sceneUnits: SceneUnits }`
- **`ClashReport`** = `{ clashes: Clash[]; scannedEntities; candidatePairs; testedPairs }`
- **`Clash`** = `{ id; aId; bId; aKind; bKind; type: 'hard'|'clearance'; severity: 'high'|'medium'|'low'; point: Vec3; separationMm; ruleId }`
- **`Vec3` (clash-types.ts) = `{ x, y, z }` σε ΜΕΤΡΑ, plan-space:** `x = planX_m`, `y = planY_m` (north), `z = elevation_m`. **ΑΥΤΟ ΕΙΝΑΙ ΚΡΙΣΙΜΟ ΓΙΑ ΤΑ 3Δ MARKERS** (βλ. παρακάτω).
- Severity palette (κράτα το ΙΔΙΟ με το 2Δ, SSoT — εξάγαγέ το σε κοινό αρχείο αν χρειαστεί): high `#dc2626` · medium `#f59e0b` · low `#eab308` (σήμερα ζει στο `useClashOverlayPreview.ts` `SEVERITY_COLOR` — **Boy-Scout: μετακίνησέ το σε `systems/coordination/clash-severity-color.ts` SSoT** ώστε 2Δ + 3Δ + panel να το μοιράζονται, αντί 3 αντίγραφα).

---

## 🎯 SLICE 1B — ΤΙ ΝΑ ΦΤΙΑΞΕΙΣ

### A) 3Δ Scene Markers (Three.js)
Δείκτης στη θέση κάθε σύγκρουσης μέσα στο 3Δ μοντέλο (όπως τα κόκκινα σημεία της Navisworks).

**🔴 ΚΡΙΣΙΜΟ — coordinate mapping (μην το λάθος):** το `clash.point` είναι plan-space metres `(planX, planY=north, elevation)`. Το Three.js world (Y-up) που χρησιμοποιεί όλο το `bim-3d/` είναι: `worldX = planX`, `worldY = elevation`, `worldZ = -planY`. Δηλαδή:
```
threePos = new THREE.Vector3(point.x, point.z, -point.y)
```
(Αυτό είναι ΑΚΡΙΒΩΣ ό,τι κάνει το SSoT `segmentAxisEndpointsWorld` στο `bim-3d/converters/mep-segment-to-mesh.ts:49` — planX→x, elev→y, planY→−z. **Reuse τη λογική, μην εφεύρεις άλλη.**)

**Pattern να μιμηθείς (FULL SSOT):** οι πρόσφατοι temp 3Δ overlays είναι **scene-leaves**: μια class που παίρνει `manager.scene` (THREE.Scene) στον constructor, προσθέτει/αφαιρεί objects, οδηγείται από hook:
- `bim-3d/placement/TempOpeningDimOverlay.ts` / `TempWallMoveDimOverlay.ts` / `TempAlignmentLineOverlay.ts` — δες πώς δομούνται (`new XxxOverlay(manager.scene)`) + dispose.
- Driver hook: `bim-3d/viewport/use-bim3d-opening-move.ts` → `const dimOverlay = new TempOpeningDimOverlay(manager.scene)`.
- Marker glyph factory: `bim-3d/gizmo/bim-gizmo-overlay-markers.ts` (`createSnapMarker` = wireframe BoxGeometry· `createBasePointMarker` = camera-facing ring). **Reuse/mirror** ένα marker (π.χ. σφαίρα ή octahedron) με `depthTest:false` + `renderOrder` ώστε να φαίνεται μέσα από geometry, screen-constant scale (δες `BimGizmoOverlay.showSnapMarker` για το sizing `s = dist·tan(fov/2)·scale`).

**Νέα αρχεία (πρόταση):**
- `bim-3d/coordination/ClashMarkerOverlay.ts` — class(scene): `setClashes(report, sceneUnits)` → καθάρισε + πρόσθεσε ένα marker ανά clash (χρώμα = severity), `clear()`, `dispose()`. **THREE-free engine μένει· εδώ ζει το THREE.**
- Driver: hook `bim-3d/viewport/use-bim3d-clash-markers.ts` (subscribe `useClashReport()` → `overlay.setClashes(...)` σε change· clear σε null). Mount όπου ζουν τα άλλα `use-bim3d-*` (στο `BimViewport3D.tsx` host ή στο aggregator hook — recon: βρες πού instantiate-άρονται τα use-bim3d-opening-move κ.λπ.).
- **ADR-040 STAGE** αν αγγίξεις shared scene-host αρχεία.

### B) DOM Report Panel (λίστα συγκρούσεων)
Floating panel (πάνω δεξιά, Navisworks Clash Detective results) που εμφανίζεται όταν `useClashReport() !== null`:
- Header: σύνολο + breakdown ανά severity (π.χ. «3 υψηλές · 1 μέτρια»).
- Λίστα: ανά clash → `aKind ↔ bKind`, type (σκληρή/απόσταση), severity chip, `separationMm`. **Click → zoom/highlight** στο σημείο (2Δ pan-to-point μέσω transform· 3Δ camera focus — recon: βρες υπάρχον "focus entity"/POI API· δες `ThreeJsSceneManager` `poi` + `FocusOutlineRenderer`).
- Κουμπί Clear (καλεί `clashReportStore.reset()` ή reuse το ribbon action).

**Pattern να μιμηθείς:** `components/dxf-layout/CanvasSectionOverlays.tsx` (host του `QuickPropertiesMini`) — εκεί μπαίνουν DOM overlays πάνω από τον καμβά. Χρησιμοποίησε **`PANEL_LAYOUT` constants** (SSoT positions/z-index/pointer-events — δες `CanvasLayerStack.tsx`), **ΟΧΙ inline styles (N.3)**, semantic HTML (`<aside>`/`<ul>`/`<li>`, N.4), `pointer-events-auto`.
- Νέο: `components/dxf-layout/ClashReportPanel.tsx` (subscribe `useClashReport`) + mount στο `CanvasSectionOverlays`.

---

## 📦 ΚΡΙΣΙΜΑ ΣΗΜΕΙΑ (μην τα πατήσεις)
1. **Coordinate mapping (A):** plan-metres → Three.js Y-up = `(x, z, -y)`. Λάθος εδώ = markers σε λάθος θέση/ύψος. Reuse `segmentAxisEndpointsWorld` λογική.
2. **Severity color SSoT:** εξάγαγέ το ΤΩΡΑ σε `clash-severity-color.ts` (Boy-Scout N.0.2) → 2Δ overlay + 3Δ markers + panel διαβάζουν ΕΝΑ. Ενημέρωσε το `useClashOverlayPreview.ts` να το import-άρει.
3. **ADR-040:** markers/panel = low-freq (set on Detect, clear on Clear· καμία per-frame εγγραφή). 3Δ overlay = scene-leaf class, ΟΧΙ React 60fps. STAGE ADR-040 αν αγγίξεις shared canvas/scene host.
4. **i18n el+en** κάθε string (panel labels: σύνολο/severity/type/«Καθαρισμός»). ΜΗΔΕΝ hardcoded (N.11). Namespace `dxf-viewer-shell`, keys π.χ. `clashReport.*`.
5. **No `any`** (N.2)· αρχεία ≤500 / functions ≤40 (N.7.1)· semantic HTML (N.4)· no inline styles (N.3).
6. **N.17:** ΕΝΑ tsc τη φορά — έλεγξε ΟΤΙ δεν τρέχει codex tsc πριν (`wmic process where "name='node.exe'" get commandline | rg -i tsc`), μετά background.
7. **Shared tree:** `git add` ΜΟΝΟ δικά σου· **ΠΟΤΕ commit/push** (N.(-1)) — ο Giorgio κάνει commit.
8. **Dispose:** το 3Δ overlay πρέπει να καθαρίζει geometries/materials (μνήμη) — δες `disposeBasePointMarker`.

---

## 🧩 SLICING + DoD
- **Slice 1b-A:** ClashMarkerOverlay + use-bim3d-clash-markers hook + severity-color SSoT. Verify: Detect → 3Δ markers στα σωστά σημεία (κάτοψη + ύψος).
- **Slice 1b-B:** ClashReportPanel (λίστα + click-to-zoom) + i18n.
- **DoD:** tsc 0 στα δικά σου· (αν προσθέσεις tests, π.χ. coord-mapping pure helper → jest πράσινο)· browser smoke (2 σωλήνες που τέμνονται/σωλήνας μέσα από δοκό → Detect → 2Δ markers [ήδη] + 3Δ markers + panel με τη σύγκρουση· click→zoom· Clear→όλα καθαρίζουν).
- **N.15 docs (ίδιο commit):** ADR-435 §5/§7 changelog (Slice 1b DONE) + ADR-423 changelog (Coordination Phase 1 πλήρης) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (ADR-435 entry → +Slice 1b) + MEMORY.md/`project_adr435_clash.md`. **ΜΗΝ adr-index.**

## 🧭 ΞΕΚΙΝΑ
Plan Mode: recon (1) πού mount-άρονται τα `use-bim3d-*` hooks ώστε να κρεμάσεις το clash-markers hook· (2) το camera-focus/POI API για click-to-zoom· (3) `CanvasSectionOverlays` props → επιβεβαίωσε broad/panel placement → slice plan → έγκριση → υλοποίηση.
