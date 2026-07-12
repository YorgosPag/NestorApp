# ADR-645 — 3D Incremental Scene Streaming (μεγάλα DXF στον 3Δ καμβά χωρίς freeze)

> **Status:** 🟢 **Φάση A + B + C IMPLEMENTED + BROWSER-VERIFIED** (streaming build — freeze fix · shared glyph atlas · view-dependent frustum culling + screen-size text LOD) — Giorgio 2026-07-13: «λειτουργεί σωστά, ξεκούραστος ο χειρισμός» (40MB «Όλοι οι όροφοι»). Φ.B+Φ.C uncommitted (commit = Giorgio). §7 MSDF = μελλοντική επιλογή μόνο-αν-χρειαστεί.
> **Date:** 2026-07-12
> **Subapp:** `src/subapps/dxf-viewer`
> **Author:** Giorgio + agent
> **Related:** **ADR-639** (2Δ large-file performance — ο ΑΝΤΙΣΤΟΙΧΟΣ αυτού για τον 2Δ: worker parse + progress + spatial culling + streaming + WebGL), **ADR-366** (3D BIM viewer master — Phase 3 `DxfToThreeConverter`), **ADR-040** (canvas performance / micro-leaf / `UnifiedFrameScheduler` SSoT), **ADR-537** (underlay depth + NaN-guards + text-as-plane), **ADR-557** (ενοποιημένη glyph engine 2D≡3D — `paintTextRun`/vector outlines), **ADR-399** (Phase B multi-floor «Όλοι οι όροφοι» stacked overlays), **ADR-034** (license check για νέες εξαρτήσεις)

---

## 1. Πλαίσιο / Problem Statement

Ο χρήστης φορτώνει στον **2Δ καμβά** ένα **μεγάλο AutoCAD DXF (40 MB)**. Ο 2Δ το χειρίζεται **άψογα**
(worker parse, bitmap cache, viewport culling, WebGL line layer, dirty-scheduler — ADR-040/639).
Όταν πατάει **2Δ → 3Δ**, ο **browser κολλάει** («page unresponsive») σε αδύναμο PC.

### 1.1 Το ζητούμενο, με ένα παράδειγμα

```
ΣΗΜΕΡΑ (2Δ→3Δ)                              ΜΕΤΑ ΤΟ ADR-645
─────────────────────────                   ─────────────────────────
πατάς 3Δ                                     πατάς 3Δ
  └─ browser ΠΑΓΩΝΕΙ 3-10s  ❌                 └─ wireframe + camera-fit ΑΜΕΣΩΣ ✅
     (καμία εικόνα, κανένα input)                └─ labels «γεμίζουν» progressively
  └─ μετά εμφανίζεται όλο μαζί                    └─ browser responsive (pan/zoom/orbit) ΚΑΘ' ΟΛΗ τη διάρκεια
                                                 └─ progress %  (μοντέλο Revit / Forge / C4D)
```

### 1.2 Κρίσιμη απαίτηση κλίμακας (Giorgio 2026-07-12)

Το κτίριο έχει **πολλούς ορόφους**, **κάθε όροφος** έχει **μεγάλο DXF με πολλές οντότητες**, και στον 3Δ
υπάρχει ήδη η λειτουργία «**Όλοι οι όροφοι**» (`syncDxfOverlayMultiFloor`, ADR-399 Φ.B) που δείχνει τις
κατόψεις **όλων** των ορόφων στοιβαγμένες. Άρα το πραγματικό μέγεθος είναι:

```
text_meshes ≈ (text ανά όροφο) × (πλήθος ορόφων)   →   ΧΙΛΙΑΔΕΣ
```

Αυτό κάνει το per-text `CanvasTexture` **μη-βιώσιμο** (χιλιάδες textures = GPU memory blowout + upload stalls).

---

## 2. Έρευνα — τι μελετήθηκε (ΦΑΣΗ 1, N.0.1)

### 2.1 Το πραγματικό αρχείο (Firebase Storage)

`companies/comp_9c7c…/projects/proj_5a49…/entities/floor/flr_3ed6…/domains/construction/categories/floorplans/files/file_1481fa51-…dxf`

| Artifact | Μέγεθος | Τι είναι |
|---|---|---|
| `…dxf` | **40.4 MB** | το raw AutoCAD DXF |
| `…dxf.processed.json` | 121.6 KB (gzip) | ενδιάμεση αναπαράσταση |
| `…scene.json` | 1.3 MB | το χτισμένο `SceneModel` (render payload) |

**Προφίλ scene** (μετά ανάλυση του `scene.json` + block-expand):

| Μέγεθος | Τιμή |
|---|---|
| Top-level entities | 2208 |
| Flattened primitives (blocks expanded) | ~3930 |
| **text** | **468** |
| lines | 959 · polylines 478 · arcs 25/499 · circles 64/451 · **hatch 116** (μικρά, max 66 verts) · blocks 98 · dims 86 |
| Layers | 13 |
| Bounds | **0..74660 × 0..174906 mm** — κανονικοποιημένα στο 0 (⚠️ **ΟΧΙ** float32 precision πρόβλημα· τα geo-referenced 17M coords του processed.json de-referenced στο scene) |

**Συμπέρασμα:** το scene είναι **μέτριο** — το freeze **δεν είναι ο όγκος**, είναι η **αρχιτεκτονική**.

### 2.2 Ρίζα του freeze (επιβεβαιωμένη στον κώδικα)

Ο 3Δ **δεν επαναχρησιμοποιεί κανένα** από τα 2Δ perf primitives (culling / cache / worker / LOD / dirty-scheduler
για το *build*). Το build είναι **σύγχρονο, all-at-once, μέσα σε React commit effect**:

```
BimViewport3D.tsx:127-216  (useEffect [effectiveVisible], ΜΗΔΕΝ yield)
  └─ new ThreeJsSceneManager(container)          // WebGL init + shaders + post-FX
  └─ resyncBimScene(...)                          // εδώ κενό (pure-DXF αρχείο)
  └─ resyncDxfOverlay(manager)
       └─ manager.syncDxfOverlay(scene)
            └─ syncDxfOverlayIntoScene (scene-manager-actions.ts:132)
                 └─ dxfConverter.sync(scene)      // ⬇ ΤΟ HOTSPOT
                 └─ applyDxfOverlayFraming(getBounds())   // camera-fit ΜΕΤΑ το build
```

`DxfToThreeConverter.buildColorGroup` (`DxfToThreeConverter.ts:249-310`):
- lines/arcs/circles/polylines → **φθηνά** (color-bucketed `LineSegments`, μία πάση). ✅
- **text loop `:284-299` → 468× `buildDxfTextMesh` ΣΥΓΧΡΟΝΑ** ⬅ **ΤΟ HOTSPOT**.

`buildDxfTextMesh` (`dxf-text-3d.ts:184`), ανά text entity:
`document.createElement('canvas')` → vector glyph engine (measure+paint ανά glyph, ADR-557) →
`new THREE.CanvasTexture` → `PlaneGeometry` + `MeshBasicMaterial` + `Mesh`.
**468× σε ένα μπλοκ** (× N ορόφους στο multi-floor) = δευτερόλεπτα main-thread block → «page unresponsive».

### 2.3 2Δ perf primitives διαθέσιμα για reuse (SSoT)

| Primitive | Αρχείο : σύμβολο | Χρήση στον 3Δ |
|---|---|---|
| Per-entity world bbox | `canvas-v2/dxf-canvas/dxf-viewport-culling.ts:77 getEntityBBox` | frustum/priority ordering + culling |
| Viewport→world bbox | `dxf-viewport-culling.ts:197 viewportToWorldBBox / 235 isEntityInViewport` | camera-frustum cull predicate |
| Dirty-key cache | `dxf-bitmap-cache.ts:91 isDirty` | μοτίβο: invalidate ΜΟΝΟ σε scene/camera identity, ΠΟΤΕ hover/select |
| Persistent GPU buffer + per-tick LOD | `canvas-v2/webgl-lines/WebglLineLayerManager.ts:212 tick`, `webgl-line-lod.ts:26 computeInstanceCount` | template: build once, touch camera+instanceCount per frame |
| rAF dirty-flag scheduler (SSoT) | `rendering/core/UnifiedFrameScheduler.ts:62 register` | **build ON this** — ΟΧΙ δεύτερο rAF loop |
| Glyph engine (SSoT, 2D≡3D) | `text-engine/fonts paintTextRun/getGlyphRun` (ADR-557) | atlas rasterizer πηγή — reuse, ΟΧΙ νέα font |
| Shared scene model | `utils/dxf-scene-builder.ts buildScene`, `dxf-types.ts DxfScene` | ήδη κοινό· το χάσμα είναι μόνο στην 3Δ *κατανάλωση* |

---

## 3. Απόφαση — Big-player-grade Incremental Streaming (4 φάσεις)

**Αρχή (Forge/APS Viewer · Speckle · three.js editor · Revit · Cinema 4D):** ΠΟΤΕ σύγχρονο mega-build στο
main thread. Χτίζουμε **streaming, off the critical path**, με **frame budget** (~8ms/frame), **cheap-first**
(wireframe+bounds → άμεσο camera-fit), **expensive-deferred** (text/textures σε batches), **view-dependent
priority** (ό,τι φαίνεται & είναι μεγάλο πρώτα), **progress UI**, **clean cancellation**. Πάνω στο υπάρχον
`UnifiedFrameScheduler` SSoT.

> **100% ειλικρίνεια — τι ΔΕΝ κάνουμε & γιατί:** Worker/OffscreenCanvas για text ΔΕΝ το κάνουν οι μεγάλοι
> (χρειάζεται DOM canvas + glyph engine)· ο μοχλός είναι time-slicing + culling + glyph-atlas, όχι worker.
> Δεν προσθέτουμε `troika-three-text` (θα απέκλινε από το ADR-557 font SSoT + νέα εξάρτηση) — φτιάχνουμε
> **custom atlas** που reuse-άρει την υπάρχουσα glyph engine.

### Φάση A — Incremental streaming build (freeze-fix, SSoT)
1. **ΝΕΟ SSoT** `bim-3d/scene/incremental-scene-builder.ts` — generic time-sliced task runner πάνω στο
   `UnifiedFrameScheduler`: frame budget, progress callback, cancel token. Pure + jest.
2. **Refactor `DxfToThreeConverter`** → incremental API:
   - **Frame 0:** όλα τα line color-buckets (φθηνή πάση) → group + bounds → **camera-fit αμέσως**.
   - **Επόμενα frames:** text meshes σε budgeted batches, **view-priority ordered** (`getEntityBBox` + μέγεθος),
     κάθε mesh προστίθεται μόλις χτιστεί, `markSceneDirty()` per batch.
   - **Gate** `INCREMENTAL_3D_MIN_ENTITIES` (`config/dxf-import-thresholds.ts` SSoT): μικρά scenes → σύγχρονο path (κανένα regression/loader flash).
3. **Wire** `syncDxfOverlayIntoScene`· framing φεύγει μετά τις γραμμές (bounds έτοιμα), όχι μετά όλο το text.
4. **Cancellation** σε re-sync/unmount (επέκταση του `lastSyncKey` guard στο async). Ισχύει single **ΚΑΙ** multi-floor.

### Φάση B — Shared glyph atlas text (SSoT· το κρίσιμο για multi-floor scale) — ✅ IMPLEMENTED
Αντί per-text `CanvasTexture`: rasterize **κάθε ΜΟΝΑΔΙΚΟ glyph μία φορά** από την ADR-557 glyph engine
σε **ΕΝΑ atlas texture**· όλο το DXF text → **quads σε μία merged BufferGeometry ανά όροφο, ένα draw
call** που δειγματίζουν το atlas με per-vertex UV + χρώμα.
- 468 text × N ορόφους → **1 atlas + ένα draw call ανά όροφο** αντί για χιλιάδες textures.
- **Reuse font SSoT** (κανένα divergence, καμία νέα εξάρτηση/license).
- Ξεκινά ως **raster atlas** (reuse υπάρχοντος rasterizer, χαμηλό ρίσκο)· **MSDF upgrade** (crisp σε ακραίο
  zoom, από τα ίδια vector outlines) = επόμενη επιλογή αν χρειαστεί (§7).

> **Υλοποίηση (100% ειλικρίνεια):** Επιλέχθηκε **merged BufferGeometry ανά όροφο** (per-vertex baked
> position/UV/color) αντί `InstancedMesh` — ίδιο αποτέλεσμα («μία BufferGeometry, ένα draw call»), αλλά
> χωρίς custom shader: `MeshBasicMaterial({ map: atlas, vertexColors })` δίνει per-glyph χρώμα (white
> coverage στο alpha × vertex tint) με stock three (MIT). Τα glyphs μπαίνουν **upright** στο atlas·
> `widthFactor`/oblique/rotation/tracking εφαρμόζονται στη γεωμετρία του quad (όχι baked) ώστε το atlas
> να μένει μικρό. **Deviation:** χάνεται το cross-glyph **kerning** (per-glyph advance) — sub-unit για CAD
> fonts, το τίμημα ενός shared atlas (§7 MSDF). **Selectable/hoverable ΑΝΕΠΗΡΕΑΣΤΟ:** το 3D DXF-text pick
> (`dxf-wireframe-hit-test`, plan-space proximity στο em-box) + το hover glow (`dxf-entity-outline`,
> em-box outline) είναι **entity-driven** — ΠΟΤΕ δεν raycast-άρουν το text mesh — άρα η σύμπτυξη σε ένα
> merged mesh τα κρατά πλήρως interactive.

### Φάση C — View-dependent culling + LOD (Revit/Navisworks) — ✅ IMPLEMENTED
Frustum-cull ολόκληρων per-floor groups + offscreen entities· **screen-size LOD** για text (κάτω από X px → skip).
Mirror του 2Δ culling SSoT (`getEntityBBox`) + του WebGL line LOD (`computeInstanceCount`).

> **Υλοποίηση (100% ειλικρίνεια):**
> - **Frustum culling = three-native, ΟΧΙ νέος μηχανισμός.** Ο underlay pass (`post-fx-overlay-pass.ts`)
>   κάνει `renderer.render(root, camera)` ανά root → το `WebGLRenderer` **ήδη** frustum-cull-άρει κάθε
>   renderable με `frustumCulled=true` + σωστό `boundingSphere`. Δύο μόνο αλλαγές το ενεργοποιούν
>   ντετερμινιστικά: (α) στα line color-buckets (`buildLineGroup`) καλείται `geo.computeBoundingSphere()`
>   **μία φορά** στο build (static bounds → cull από το frame 0, χωρίς lazy first-render κόστος)·
>   (β) το atlas text mesh (`AtlasTextMeshBuilder`) ξεκινά `frustumCulled=false` (τα bounds γεμίζουν
>   progressively στο streaming) και **`finalize()`** το γυρίζει σε `true` μόλις ο build ολοκληρωθεί
>   (`onComplete`/inline path), οπότε το `this.sphere` (kept in sync στο `flush`) καλύπτει όλα τα glyphs.
>   Off-screen όροφος ⇒ ολόκληρο το wireframe + text του παραλείπεται από το engine, μηδέν CPU.
>   **Δεν** χρειάστηκε custom `THREE.Frustum` test (το `accessibility/focus-order.ts` έχει ένα, αλλά
>   είναι για keyboard-nav ordering, ΟΧΙ render-culling SSoT — καμία επικάλυψη).
> - **Screen-size text LOD = per-fragment shader discard (Figma/Revit-grade), μηδέν CPU/frame, μηδέν
>   rebuild.** Το merged atlas mesh (Φ.B) δεν μπορεί να κρύψει μεμονωμένα glyphs χωρίς rebuild → η
>   απόφαση γίνεται στο GPU: `glyph-atlas-text-lod.ts` (`applyTextLodMaterial`) κάνει inject μέσω
>   `onBeforeCompile` στο stock `MeshBasicMaterial` (καμία νέα εξάρτηση). Κάθε glyph κουβαλά baked
>   `aEmVec` (το local vertical extent του = BL→TL, rotation-aware)· ο vertex shader προβάλλει
>   `vertex` vs `vertex+aEmVec` σε NDC και το pixel-delta **ΕΙΝΑΙ** το on-screen ύψος του glyph· κάτω
>   από `TEXT_LABEL_MIN_PX` (SSoT στο `config/dxf-import-thresholds.ts`, =8px) → `discard`.
>   **Projection-agnostic:** μετρώντας NDC-delta δύο world σημείων μέσα από το ΙΔΙΟ
>   `projectionMatrix*modelViewMatrix` δουλεύει για perspective **ΚΑΙ** orthographic + απορροφά το
>   per-floor non-uniform group scale — κανένα camera-mode branch, καμία distance formula. Το μόνο
>   uniform που αλλάζει (viewport CSS px) το ανανεώνει το `mesh.onBeforeRender` (fires μόνο για
>   non-culled meshes → αμελητέο). Pure JS reference `projectedEmPixelHeight` κρατά το projection-math
>   SSoT που το GLSL καθρεφτίζει (unit-tested). **Deviation:** η LOD απόφαση είναι per-glyph vertical
>   height — δεν κάνει overlap-declutter (labels που επικαλύπτονται αλλά είναι μεγάλα μένουν)· αυτό
>   είναι το ίδιο readability-floor μοντέλο του 2Δ line LOD (`computeInstanceCount`: drop sub-`cutoffPx`).
> - **Ενσωμάτωση με Φ.A/B:** το LOD δεν ακουμπά το streaming/cancellation· το frustum re-enable γίνεται
>   ΜΟΝΟ στο `onComplete`/inline (ποτέ mid-stream), άρα κανένα partial-bounds mis-cull. Selectable/
>   hoverable αμετάβλητο (entity-driven pick, ποτέ raycast του text mesh).

### Φάση D — Docs (N.0.1 Φ3, ίδιο commit ανά φάση)
Update αυτού του ADR + ADR-366 (3D master) + ADR-040 changelog (perf-critical αρχεία → CHECK 6B/6D απαιτούν staged ADR).

---

## 4. Επηρεαζόμενα αρχεία (edit targets)

| Αρχείο | Ρόλος | Φάση |
|---|---|---|
| `bim-3d/scene/incremental-scene-builder.ts` **(νέο)** | time-sliced build driver SSoT | A |
| `bim-3d/converters/DxfToThreeConverter.ts` | incremental build (lines-first, text-streamed) | A |
| `bim-3d/scene/scene-manager-actions.ts:132` | wire incremental + framing-after-lines | A |
| `bim-3d/scene/ThreeJsSceneManager.ts` | wiring (`syncDxfOverlay`/MultiFloor) | A |
| `config/dxf-import-thresholds.ts` | `INCREMENTAL_3D_MIN_ENTITIES` gate | A |
| progress overlay leaf **(νέο)** + i18n el/en | Figma/Forge-style % (ADR-040 micro-leaf· N.11 όχι hardcoded) | A |
| `bim-3d/converters/glyph-atlas-*.ts` **(νέο)** + `dxf-text-3d.ts` | shared glyph atlas + instanced text | B |
| `bim-3d/converters/DxfToThreeConverter.ts` + culling helper | frustum/LOD για overlay + text | C |
| jest tests (builder / priority / cancel / atlas) | Google presubmit | A/B/C |

---

## 5. Google-level checklist (N.7.2)

| # | Απάντηση |
|---|---|
| Proactive/reactive | **Proactive** — build στο σωστό lifecycle moment, streamed |
| Race condition | **Όχι** — cancel token· νέο sync ακυρώνει in-flight |
| Idempotent | **Ναι** — `lastSyncKey`/`lastMultiKey` guard επεκτείνεται async |
| Belt-and-suspenders | **Ναι** — sync path για μικρά scenes + streamed για μεγάλα |
| SSoT | **Ναι** — `UnifiedFrameScheduler` (rAF), `getEntityBBox` (cull), glyph engine (atlas) — κανένα duplicate |
| Await/fire-forget | build = async streamed (non-blocking)· framing await-ει bounds |
| Ownership | `DxfToThreeConverter` owns το overlay build· ο scheduler οδηγεί τα frames |

---

## 6. Consequences

**Θετικά:** browser responsive στο 2Δ→3Δ ακόμη και σε multi-floor· 60fps σταθερά· GPU memory bounded (atlas)·
reuse των 2Δ SSoT primitives (καμία διπλή υλοποίηση)· scales στο πραγματικό μέγεθος του κτιρίου.

**Κόστος/ρίσκο:** αγγίζει perf-critical αρχεία (ADR-040/366/537) → προσεκτικό testing· η Φάση B είναι
ουσιώδης αλλαγή στο text path (mitigation: reuse font SSoT, ξεκίνα raster atlas).

**Deferred (γραμμένο εδώ, όχι τώρα):** BimSceneLayer incremental dirty-tracking (ήδη flagged Phase 3+ στο
`BimSceneLayer.ts:4-6`)· MSDF text (§7)· worker/OffscreenCanvas text.

---

## 7. MSDF upgrade (μελλοντική επιλογή, όχι τώρα)

Αν το raster atlas θολώνει σε ακραίο zoom: παράγουμε **MSDF** ανά glyph από τα **ίδια vector outlines** της
ADR-557 engine (`getGlyphRun`) → crisp σε οποιοδήποτε zoom με μικροσκοπικό atlas. Θέλει MSDF generator
(msdfgen-class). Κρατιέται ως upgrade path επειδή reuse-άρει την ίδια πηγή outlines — καμία font divergence.

---

## 8. Changelog

- **2026-07-12** — ADR δημιουργήθηκε. ΦΑΣΗ 1 (έρευνα) ολοκληρώθηκε: root cause = σύγχρονο all-at-once
  build σε React commit effect, με το 468× `buildDxfTextMesh` ως hotspot· επιβεβαιωμένο profiling του
  πραγματικού 40MB αρχείου (2208 entities, 468 text, normalized coords). Roadmap A→B→C κλειδώθηκε.
  Υλοποίηση εκκρεμεί (έναρξη Φάση A).
- **2026-07-12 — ΦΑΣΗ A ΥΛΟΠΟΙΗΘΗΚΕ (streaming build — freeze fix).**
  - **ΝΕΟ SSoT** `bim-3d/scene/incremental-scene-builder.ts` — generic time-sliced runner πάνω στο
    `UnifiedFrameScheduler` one-shot rAF (ADR-040): frame budget ~8ms, chunked clock-reads, progress
    callback, clean cancel token. Pure + dependency-injected (fake scheduler/clock) → jest-driveable.
    Test: `bim-3d/scene/__tests__/incremental-scene-builder.test.ts` (budget slicing, progress,
    complete-once, cancel-once, total=0, chunkSize).
  - **`DxfToThreeConverter` refactor** → lines-first, text-streamed. `buildColorGroup` έσπασε σε
    `buildLineGroup` (φθηνά line color-buckets + μάζεμα text entities) + streamed text pass. `sync` /
    `syncMultiFloor` προσθέτουν το wireframe στη σκηνή ΑΜΕΣΩΣ (→ `getBounds()` ⇒ camera-fit χωρίς
    αναμονή), μετά `streamText(...)` χτίζει τα text meshes. Gate `INCREMENTAL_3D_MIN_ENTITIES` (=40):
    κάτω απ' αυτό σύγχρονο inline build (κανένα loader flash/regression), πάνω → streamed με
    view-priority (bigger-first, `getEntityBBox` area SSoT — ADR-040 Phase IX). Multi-floor: text ΟΛΩΝ
    των ορόφων aggregated σε ΕΝΑ runner. Constructor δέχεται `onSceneDirty` callback → per-batch
    `markSceneDirty` (κανένα δεύτερο rAF loop).
  - **Cancellation:** `disposeRoot()` ακυρώνει το in-flight build ΠΡΙΝ το teardown (re-sync / floor
    switch / unmount) → κανένα `processItem` δεν αγγίζει group υπό dispose (race-free). `onCancelled`
    καθαρίζει το progress overlay.
  - **Progress SSoT** `bim-3d/stores/Dxf3dStreamProgressStore.ts` (zero React state, micro-leaf) +
    **overlay leaf** `bim-3d/viewport/Dxf3dStreamProgressLeaf.tsx` (Forge/Figma-style «loading %»,
    self-hides idle, i18n el+en `viewport.streaming.*` — ΟΧΙ hardcoded). Mount στο `BimViewport3D`.
  - **Wiring:** `ThreeJsSceneManager` περνά `() => markSceneDirty()` στον converter. Το framing
    (`applyDxfOverlayFraming` στο `scene-manager-actions.ts:132`) ήδη τρέχει μετά το `sync()` που τώρα
    προσθέτει μόνο τις γραμμές → fit πάνω στα line bounds, όχι μετά όλο το text.
  - Gate constant στο `config/dxf-import-thresholds.ts` (SSoT). Docs: αυτό + ADR-366 + ADR-040.
  - **Εκκρεμεί:** Φάση B (shared glyph atlas — κρίσιμο για multi-floor scale· το streamed path
    εξακολουθεί να φτιάχνει per-text `CanvasTexture`, απλώς πλέον χωρίς freeze), Φάση C (frustum/LOD).
- **2026-07-12 — ΦΑΣΗ B ΥΛΟΠΟΙΗΘΗΚΕ (shared glyph atlas — multi-floor scale).**
  - **ΝΕΟ `bim-3d/converters/glyph-atlas.ts`** — shared raster `GlyphAtlas`: ΕΝΑ `CanvasTexture` (2048²,
    flipY=false) + lazily-rasterised cell ανά (face, char) με shelf packing (`packRect`, pure). Τα glyphs
    ζωγραφίζονται **λευκά** (coverage→alpha) μέσω του ADR-557 SSoT (`resolveTextFont`→`paintTextRun`,
    loaded CAD outline ή CSS fallback· `measureText`/`getGlyphRun` για metrics) — **καμία νέα εξάρτηση,
    κανένα δεύτερο font mechanism**. Upright + un-stretched (widthFactor/oblique/rotation στη γεωμετρία).
  - **ΝΕΟ `bim-3d/converters/glyph-atlas-text-layout.ts`** (pure) — `layoutTextGlyphs`: entity → plan-space
    glyph quads. Anchor = το NOMINAL em box (`resolveTextEmBox`, ΙΔΙΟ με το 3D hover halo)· lines split+
    stacked (`text-lines`)· widthFactor X-scale + oblique shear (`obliqueShearFromAngle`, world y-up) +
    `\T` tracking + rotation **per corner** (plan-rotate + y→−z, αλγεβρικά ίδιο με το παλιό `orientTextPlane`).
  - **ΝΕΟ `bim-3d/converters/glyph-atlas-text-mesh.ts`** — `AtlasTextMeshBuilder`: merged BufferGeometry
    ανά όροφο (pre-sized στο glyph upper bound), `MeshBasicMaterial({ map: atlas, vertexColors,
    transparent, depthWrite:false, DoubleSide })`. Streamed: `addEntity`→`flush` (needsUpdate μόνο στο
    written range + `setDrawRange`)· incremental `boundingBox` ΜΟΝΟ πάνω στα γραμμένα glyphs (το
    `setFromObject` αγνοεί drawRange → το preallocated (0,0,0) tail ΔΕΝ μολύνει το camera framing)· NaN-guard.
  - **ΝΕΟ `bim-3d/converters/dxf-text-font-resolution.ts`** (pure) — extract του `resolveTextFont` (font/
    tracking/widthFactor/faceKey) από το πρώην `dxf-text-3d.ts`, ώστε atlas + layout να το κάνουν reuse
    χωρίς THREE (SSoT, αποφυγή jscpd sibling clone).
  - **`DxfToThreeConverter`**: το `streamText` χτίζει **per-floor atlas builders** (`makeFloorBuilders`,
    grouped by floor group) αντί per-text mesh. Ο atlas είναι **converter-owned + persistent** (cells cache
    across syncs)· `disposeRoot` κάνει dispose μόνο geometry+material των builders (ΟΧΙ το shared texture),
    `dispose` κάνει dispose τον atlas. Small scenes (<gate) sync inline· large → streamed (ίδιο runner Φ.A).
  - **ΔΙΑΓΡΑΦΗΚΕ** το `bim-3d/converters/dxf-text-3d.ts` (+ 2 tests): ο per-text `CanvasTexture` μηχανισμός
    αντικαταστάθηκε πλήρως — κανένας consumer πλέον (μία text-mesh οδός, ADR-557 parity).
  - **Tests:** `glyph-atlas-text-layout.test.ts` (glyph count/dims/widthFactor/tracking/oblique/rotation/
    multiline, fake source), `glyph-atlas.test.ts` (packRect + cell geometry με stub font),
    `glyph-atlas-text-mesh.test.ts` (capacity/draw-range/vertex-tint/cap/NaN-guard/bounds). 22 νέα + 51
    converter regression = 73 πράσινα. jscpd:diff καθαρό.
  - **Εκκρεμεί:** Φάση C (frustum-cull per-floor groups + screen-size text LOD)· §7 MSDF (crisp extreme zoom).
- **2026-07-13 — ΦΑΣΗ C ΥΛΟΠΟΙΗΘΗΚΕ (view-dependent frustum culling + screen-size text LOD).**
  - **Frustum culling = three-native (κανένα νέο frustum test).** `DxfToThreeConverter.buildLineGroup`:
    `geo.computeBoundingSphere()` μία φορά ανά line color-bucket → ντετερμινιστικό per-object cull από
    το frame 0 στον underlay pass (`renderer.render(root, camera)`). Off-screen όροφος = μηδέν draw.
  - **ΝΕΟ `bim-3d/converters/glyph-atlas-text-lod.ts`** — screen-size text LOD (declutter). `applyTextLodMaterial`
    κάνει `onBeforeCompile` inject στο stock `MeshBasicMaterial`: baked `aEmVec` per-vertex (glyph
    vertical extent) → ο vertex shader προβάλλει `vertex` vs `vertex+aEmVec` σε NDC, το pixel-delta =
    on-screen glyph height, κάτω από `TEXT_LABEL_MIN_PX` → per-fragment `discard`. Zero CPU/frame, zero
    rebuild, projection-agnostic (perspective+ortho, absorbs group scale). Pure reference
    `projectedEmPixelHeight` (GLSL mirror, unit-tested). Καμία νέα εξάρτηση (stock three, MIT).
  - **`glyph-atlas-text-mesh.ts` (MOD):** νέο `aEmVec` BufferAttribute (baked BL→TL ανά glyph, ίδιο στα 4
    corners)· το material wire-άρεται με το LOD· `mesh.onBeforeRender` τροφοδοτεί το live viewport (CSS px)
    στο shader uniform (fires μόνο για non-culled meshes)· **νέο `finalize()`** γυρίζει `frustumCulled=true`
    μόλις ο build ολοκληρωθεί (bounds τελικά) — μόνο αν υπάρχουν glyphs (empty mesh → degenerate sphere,
    culling μένει off).
  - **`DxfToThreeConverter.streamText` (MOD):** `finalizeAll()` καλείται στο inline (small-scene) path ΚΑΙ
    στο `onComplete` του streamed build (ΠΟΤΕ mid-stream → κανένα partial-bounds mis-cull). Cancellation/
    streaming άθικτα.
  - **`config/dxf-import-thresholds.ts` (MOD):** `TEXT_LABEL_MIN_PX: 8` (SSoT, tunable).
  - **Tests:** `glyph-atlas-text-lod.test.ts` (projected-px math ortho+perspective, shader-inject +
    viewport uniform — 5) + `glyph-atlas-text-mesh.test.ts` (aEmVec baked/same-per-corner, finalize
    frustum toggle — 2). 60 converter suites / 442 tests πράσινα. jscpd:diff καθαρό.
  - **Boy-scout:** διορθώθηκε pre-existing typo «ADR-644 Φάση B» → «ADR-645 Φάση B» στον converter.
  - **Εκκρεμεί:** §7 MSDF (crisp extreme zoom) — μόνο αν ζητηθεί μετά από blurriness σε ακραίο zoom.
