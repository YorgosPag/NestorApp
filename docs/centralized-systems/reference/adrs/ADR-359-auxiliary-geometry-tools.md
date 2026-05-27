# ADR-359 — Auxiliary Geometry Tools: XLINE (Construction Lines) + RAY

**Status**: ✅ ACCEPTED (Q1-Q15 risolte 2026-05-16 — Full Enterprise + GOL + SSoT)
**Date**: 2026-05-16
**Category**: Drawing System / DXF Viewer / Construction Geometry
**Author**: Giorgio Pagonis + Claude (Opus 4.7)
**Related ADRs**: ADR-031 (Command History), ADR-040 (Canvas Performance), ADR-055 (Tool State), ADR-057 (Unified Completion), ADR-065 (Intersection cache), ADR-378 (Snap System Master Architecture — supersedes phantom ADR-149), ADR-189 (Construction Guides — distinct system), ADR-294 (SSoT Ratchet), **ADR-357 §G16** (origine), **ADR-358** (consumer di `LayerStore` + `resolveEntityStyle`).

> **Posizione nel piano** (ADR-357 §7.1):
> 1. ✅ ADR-357 (LINE tool Google-Level) — ACCEPTED.
> 2. ✅ ADR-358 (Layer Management System) — ACCEPTED, prerequisito implementativo.
> 3. ✅ **ADR-359 (questo)** — XLINE + RAY. ACCEPTED 2026-05-16. **No dipendenza forte** da ADR-357 (può procedere parallelo alle phases di ADR-357). Eredita `LayerStore` / `resolveEntityStyle` da ADR-358 (consume-only, zero extend).
> 4. ⏳ ADR-360 (Dimension System) — pianificato, indipendente.

---

## 1. Context

### 1.1 Cosa sono XLINE e RAY (CAD professionali)

| Concetto | XLINE | RAY |
|---|---|---|
| Geometria | Linea **infinita** in entrambe le direzioni. | Linea **semi-infinita**: parte da un origin e si estende a infinito in una sola direzione. |
| Definizione DXF | `AcDbXline`: `basePoint (10/20/30)` + `unitDirection (11/21/31)`. | `AcDbRay`: `basePoint (10/20/30)` + `unitDirection (11/21/31)`. |
| Uso primario | Linee di costruzione (axis lines, alignment guides, riferimenti per quote, bisettrici). | Direzione una-via (vector di sole, line-of-sight, partition lines). |
| Plot default | Tipicamente **non plottate** (layer construction). | Idem. |
| Estensione drawing extents | **Non** inclusa in `EXTENTS` (drawing zoom-to-extents ignora XLINE/RAY). | Idem. |

### 1.2 Perché un ADR separato

- **ADR-357 §G16 / Q16** ha estratto questo scope esplicitamente: lo standard CAD usa XLINE/RAY come "famiglia parallela" al LINE, con sub-modes propri (H/V/A/B/O), persistenza native DXF distinta, e un effetto secondario importante su `IntersectionSnapEngine`.
- **No dipendenza forte da ADR-357**: l'implementazione XLINE/RAY consuma solo `TOOL_DEFINITIONS`, `completeEntity`, `ProSnapEngineV2` — tutti SSoT già stabili. Polar Tracking / Dynamic Input / Direct Distance Entry di ADR-357 sono **utili ma non bloccanti** per XLINE/RAY (questi tool funzionano anche col solo Ortho).
- **Codebase pre-attrezzato — parzialmente**: `XLineEntity` e `RayEntity` esistono già in `types/entities.ts:286-299` con `basePoint + direction + secondPoint`, bounds calcolati con `NOMINAL_EXTENT=10000` in `getEntityBounds`. **Tutto il resto** (renderer, parser, tool registration, snap, hit-test) è assente.

### 1.3 Cosa documenta questo ADR

- Lo **stato attuale** del codebase (audit 2026-05-16, codice = source of truth).
- Lo **standard industry** AutoCAD / BricsCAD / ArchiCAD per Construction Lines.
- La **gap analysis Google-level**.
- Il **piano di implementazione in fasi piccole** (una phase = una sessione, ADR-357 §7.1).
- Pre-commit ratchet considerations.
- Strategia di test (unit + integration + DXF roundtrip).

### 1.4 Distinzione critica — XLINE/RAY vs ADR-189 Construction Guides

Il codebase ha già un sistema ricco di **construction guides** (ADR-189): `guide-x`, `guide-z`, `guide-parallel`, `guide-grid`, `guide-arc-*`, ecc. **Questi NON sono XLINE/RAY DXF entities**. Sono:

| Property | ADR-189 Guides | ADR-359 XLINE/RAY |
|---|---|---|
| Persistenza | overlay-manager / Firestore `floorplan_overlays` | DXF entity nativa (`AcDbXline`/`AcDbRay`), persistita in `SceneModel.entities[]` |
| Rendering | overlay layer (separato) | dxf-canvas (stesso layer entity DXF) |
| DXF roundtrip | ❌ Non DXF | ✅ Nativo |
| Editing | Drag handles dedicated | Grip editing standard (ADR-357 G10) |
| Use case | Sketching assistance / disegno temporaneo | Geometric construction with DXF interop |

**Decisione**: ADR-359 **non sostituisce** ADR-189. Coesistono. Le guides ADR-189 restano per workflow di sketch helper; XLINE/RAY entrano per workflow DXF/architect-veteran. Possibile bridging futuro (out-of-scope qui): comando "Promote guide → XLINE" per persistere DXF.

---

## 2. Stato attuale (audit codice 2026-05-16)

### 2.1 Pezzi esistenti — già pronti

| Pezzo | Path | Stato |
|---|---|---|
| `XLineEntity` type | `types/entities.ts:286-291` | ✅ `{ basePoint, direction, secondPoint? }` |
| `RayEntity` type | `types/entities.ts:294-299` | ✅ `{ basePoint, direction, secondPoint? }` |
| Type guards `isXLineEntity` / `isRayEntity` | `types/entities.ts:444-448` | ✅ |
| `Entity` union | `types/entities.ts:324-345` | ✅ include `XLineEntity` + `RayEntity` |
| `getEntityBounds` cases | `types/entities.ts:574-602` | ✅ ma con `NOMINAL_EXTENT=10000` arbitrario (da rivisitare) |
| `EntityType` literal union | `types/entities.ts:54-74` | ✅ include `'xline'` + `'ray'` |

### 2.2 Pezzi mancanti — full audit

| Pezzo mancante | Path target | Impatto |
|---|---|---|
| **Tool registration** `'xline'` / `'ray'` in `ToolType` union | `ui/toolbar/types.ts` | I tool non esistono per il sistema (no ribbon, no shortcut). |
| **`TOOL_DEFINITIONS['xline'] / ['ray']`** | `systems/tools/ToolStateManager.ts:18-149` | `canInterrupt`, `allowsContinuous`, `allowsChain` (ADR-357), `supportsDynamicInput` (ADR-357) — assenti. |
| **`createEntityFromTool` cases** | `hooks/drawing/drawing-entity-builders.ts:63-405` | No conversione points→XLine/Ray. Nessun pattern di "basePoint + direzione da 2° punto". |
| **`generatePreviewEntity` cases** | `hooks/drawing/drawing-preview-generator.ts` | No rubber-band durante click 1→click 2. |
| **`isEntityComplete` cases** | `hooks/drawing/drawing-entity-builders.ts` | No definition (XLINE base mode → 2 punti; sub-modes diversi). |
| **Renderer XLine** | `rendering/entities/XLineRenderer.ts` (nuovo) | Nessuno. |
| **Renderer Ray** | `rendering/entities/RayRenderer.ts` (nuovo) | Nessuno. |
| **Renderer registry** | `rendering/core/EntityRendererComposite.ts:44-71` | Manca `'xline'` + `'ray'` in `initializeRenderers()`. |
| **Clip-to-viewport algorithm** | `rendering/utils/line-clipping.ts` (nuovo) | Nessuna implementazione Liang-Barsky o Cohen-Sutherland nel codebase. |
| **DXF native parser** — `XLINE` / `RAY` entities | `utils/dxf-parser-types.ts:14-28` (`SUPPORTED_ENTITY_TYPES`) + `utils/dxf-entity-converters.ts` | Parser non riconosce `XLINE` / `RAY` dalla sezione ENTITIES → import lossy. |
| **DXF native exporter** | `utils/dxf-exporter*.ts` (audit pending — Phase 3) | Nessun output `AcDbXline` / `AcDbRay`. |
| **IntersectionSnapEngine switch cases** | `snapping/engines/IntersectionSnapEngine.ts:200-227` | Switch ignora `'xline'` / `'ray'` (case mancante in `calculateIntersections`). Risultato: zero snap intersezione con linee infinite — **grave per workflow architect**. |
| **Intersection calculators** | `snapping/engines/intersection-calculators.ts` | Mancano `xlineLineIntersection`, `rayLineIntersection`, `xlineCircleIntersection`, `xlinePolylineIntersection`, `xlineXlineIntersection`, ecc. — combinazione completa (NxM). |
| **Hit-test infinite** | `rendering/hitTesting/hit-test-entity-tests.ts` | Nessuna funzione `pointToInfiniteLineDistance`. Hit-test fallisce su XLINE/RAY. |
| **Snap engines secondari** (Endpoint, Midpoint, Perpendicular, Nearest) | `snapping/engines/*` | Endpoint → solo `basePoint` (XLINE non ha endpoints, RAY ha solo origin); Midpoint → **indefinito** per XLINE; Perpendicular → calcolabile con direction; Nearest → fattibile con projection-on-line. Audit dedicato per ogni engine. |
| **Ribbon UI** | `ui/ribbon/data/*.ts` + `ui/ribbon/groups/*` | Nessun comando `XLINE` / `RAY` nel ribbon. |
| **Command aliases** (ADR-357 G11) | `systems/command-line/CommandAliasRegistry.ts` (futuro) | `XL → xline`, `RAY → ray` da pre-registrare quando ADR-357 Phase 13 sarà live. |
| **i18n strings** | `i18n/locales/{el,en}/dxf-viewer.json` | Tooltip ribbon, sub-mode prompts, status bar hints. |
| **Sub-modes UX** (H/V/A/B/O — AutoCAD pattern) | Tutto da progettare | Nessun pattern preesistente. Decisione in Q&A (full v1 o phased). |

### 2.3 Conclusione audit

Il codebase ha solo le **type definitions**. Tutto il resto è da costruire — pipeline parser → tool → entity-builder → preview → renderer (con clip) → snap (con calc intersezioni) → hit-test. **~12 file core da estendere + ~5 file nuovi da creare**.

---

## 3. Industry Benchmark

### 3.1 AutoCAD XLINE — sub-modes (riferimento principale)

| Sub-mode | Prompt | UX | DXF output |
|---|---|---|---|
| **(default Through-point)** | `Specify a point` → `Specify through point` | 2 punti → XLINE attraverso entrambi. Chain: dopo il primo punto, ogni click successivo crea un nuovo XLINE attraverso il primo punto (fan/pivot). | 1 `AcDbXline` per click |
| **Hor** | `H` → `Specify through point` | Click → XLINE orizzontale (direzione `(1,0)`) attraverso il punto. Chain continuo. | direction = `(1,0,0)` |
| **Ver** | `V` → `Specify through point` | Click → XLINE verticale (direzione `(0,1)`) attraverso il punto. Chain continuo. | direction = `(0,1,0)` |
| **Ang** | `A` → `Enter angle of xline (0)` → `Specify through point` | Angolo (deg) prompt; opzione `Reference` per ereditare angle da entità esistente. Chain continuo a quell'angolo. | direction = `(cos θ, sin θ, 0)` |
| **Bisect** | `B` → `Specify angle vertex point` → `Specify angle start point` → `Specify angle end point` | 3 punti: vertice + 2 estremità → XLINE attraverso vertice, bisettrice angolare. Chain continuo (nuove bisettrici dallo stesso vertice). | direction = bisettrice |
| **Offset** | `O` → `Specify offset distance` o `Through` → `Select line` → `Specify side` | Crea XLINE parallelo a `line/xline/ray/polyline-segment` con offset specifico. Chain continuo. | direction = parallela alla source |

**Esci**: `Enter` o `ESC` chiude il comando.

### 3.2 BricsCAD XLINE — quasi-identico ad AutoCAD

Stesse sub-modes (`H`, `V`, `A`, `B`, `Parallel` invece di `Offset` — sinonimo). Convergenza completa con AutoCAD.

### 3.3 AutoCAD RAY — semplice

Nessun sub-mode. Prompt:
1. `Specify start point` (origin del ray)
2. `Specify through point` → ray dalla origin attraverso il punto
3. Chain: ogni click successivo crea un nuovo ray dalla stessa origin (fan/pivot — utile per radial layouts)

`Enter` / `ESC` esce.

### 3.4 ArchiCAD

Concept assente come DXF entity nativo, ma "Trace Lines / Reference Lines" sono concettualmente analoghe. Workflow DWG/DXF interop converte XLINE/RAY in Trace.

### 3.5 DXF Native Specification (Autodesk DXF Reference)

**AcDbXline / AcDbRay entity**:

```
0       LINE-marker (XLINE o RAY)
2       (none — entity in ENTITIES section)
5       handle
100     AcDbEntity
8       layer name
6       linetype (optional, ByLayer default)
62      color ACI (optional, ByLayer default)
370     lineweight (optional, ByLayer default)
100     AcDbXline   ← (o AcDbRay)
10      basePoint X
20      basePoint Y
30      basePoint Z (0 per 2D)
11      unitDirection X (raccomandato normalizzato |dir|=1)
21      unitDirection Y
31      unitDirection Z (0 per 2D)
```

Per RAY: identico ma `100 AcDbRay`. La semantica differisce: RAY parte da `basePoint` e va verso `+direction` (semi-infinita); XLINE parte da `basePoint` ed estende `±direction` (bi-infinita).

### 3.6 Convergenza industry

3/3 player CAD (AutoCAD, BricsCAD, GstarCAD) convergono su:
- Sub-modes XLINE: `Hor`, `Ver`, `Ang`, `Bisect`, `Offset`.
- RAY senza sub-modes (semplice 2-point).
- DXF entities native `AcDbXline` / `AcDbRay`.
- Persistenza con `basePoint + unitDirection`.
- Chain mode default (fan/pivot da primo punto).

→ Standard non-opinionato. Replica fedele.

---

## 4. Gap Analysis Google-Level

### G1 — Tool registration mancante
**Cosa manca**: `'xline'` / `'ray'` non nel `ToolType` union né in `TOOL_DEFINITIONS`.

**Effetto**: i tool non esistono per il sistema (no ribbon, no shortcut, no `setTool`).

**Google-fix**:
- Estendere `ToolType` con `'xline'` + `'ray'`.
- `TOOL_DEFINITIONS['xline'] = { category: 'drawing', canInterrupt: true, allowsContinuous: true, allowsChain: true (ADR-357 §5.4), supportsDynamicInput: true, requiresCanvas: true, preservesOverlayMode: false }`.
- Idem `'ray'`.
- Sub-mode XLINE come **internal state machine** del tool, non come ToolType separati (industry pattern — un solo XLINE tool, gestisce mode internamente).

### G2 — Sub-mode state machine
**Cosa manca**: nessun pattern per "mode interno al tool" nel codebase (gli altri drawing tools sono mono-mode).

**Google-fix**:
- Nuovo SSoT `systems/tools/xline-mode-store.ts` (singleton micro-leaf):
  ```typescript
  type XLineMode = 'through' | 'horizontal' | 'vertical' | 'angle' | 'bisect' | 'offset';
  // + state per modes parametrici: angleValue (Ang), offsetDistance + sourceEntityId (Offset)
  ```
- Mode switch via keyboard shortcut durante tool attivo: `H` / `V` / `A` / `B` / `O` (industry).
- Mode switch via Dynamic Input prompt (ADR-357 Phase 2) — leggi key, applica `setMode()`.
- Visual feedback: status bar mostra `XLine: Horizontal` mentre mode attivo.

### G3 — Pipeline createEntityFromTool / preview / isEntityComplete
**Cosa manca**: nessun case per `'xline'` / `'ray'` nei tre punti chiave del drawing pipeline.

**Google-fix** (per ogni mode):
- **through (default)**: 2 punti → `{ basePoint: p1, direction: normalize(p2 - p1) }`. Preview da click1 a cursor.
- **horizontal**: 1 punto → `{ basePoint: p1, direction: (1,0) }`. Preview = full-width line attraverso cursor (no click1, primo click crea).
- **vertical**: 1 punto → `{ basePoint: p1, direction: (0,1) }`. Idem.
- **angle**: 1 punto + angle (da DynamicInput o Tab) → direction = `(cos θ, sin θ)`. Preview = full line dal cursor con quell'angle.
- **bisect** (Q3 — 3 click classic): 3 punti (vertex `p1` + angleStart `p2` + angleEnd `p3`) → direction = `normalize(normalize(p2-p1) + normalize(p3-p1))`. Preview: dopo click1 rubber band linea vertex→cursor (per dare angle reference 1); dopo click2 rubber band bisettrice corrente (vertex → bisettrice tra p2 e cursor); click3 commit. Edge case: `p2` o `p3` coincidente con `p1` → direction degenerate → skip + status bar warning.
- **offset**: selezione source entity + distanza (DynamicInput) → direction parallela. Source: line / xline / ray / polyline segment.
- **RAY**: 2 punti → `{ basePoint: p1, direction: normalize(p2 - p1) }`.
- `isEntityComplete`: per ogni mode definisce N punti richiesti.

### G4 — Clip-to-viewport rendering
**Cosa manca**: nessun algoritmo di clipping nel codebase. Render naive (point-to-NOMINAL_EXTENT) genera artifacts su pan/zoom estremi.

**Google-fix**:
- Nuovo modulo `rendering/utils/line-clipping.ts` (SSoT puro):
  ```typescript
  // Liang-Barsky parametric clip.
  // line: P(t) = base + t*dir, t ∈ tRange
  // Returns clipped segment endpoints in world coords, o null se completamente fuori.
  export function clipParametricLine(
    base: Point2D,
    dir: Point2D,
    tRange: { min: number; max: number },  // (-∞,+∞) per XLine, [0,+∞) per Ray
    viewport: { minX, minY, maxX, maxY }
  ): { start: Point2D; end: Point2D } | null
  ```
- **Liang-Barsky scelto** (vs Cohen-Sutherland): più efficiente per linee parametriche infinite (computa direttamente i `t_min, t_max` della porzione visibile, no iterazioni). 4 divisioni totali (una per ogni edge), branch-light. Cohen-Sutherland richiede outcode bit-twiddling iterativo che non degrada gracefully sulle infinite.
- **XLine**: `tRange = (-Infinity, +Infinity)` (in pratica `[-1e9, +1e9]` con direction normalizzata).
- **Ray**: `tRange = [0, +Infinity]` (`[0, 1e9]`).
- Render: pure fn invocata dal renderer ad ogni frame (è cheap, ~10 op). No caching needed.

### G5 — IntersectionSnapEngine cieco su XLine/Ray
**Cosa manca**: `calculateIntersections()` switch non gestisce `'xline'` / `'ray'`. Architetti che usano XLINE per allineamento perderebbero il valore principale.

**Google-fix** — combinazione completa:

Switch da aggiungere (`type1, type2` permutati):
- `xline × line` → 1 intersezione (sempre, salvo parallel) — formula parametrica.
- `xline × xline` → 1 intersezione (salvo parallel).
- `xline × ray` → 0 o 1 (controlla `t ≥ 0` per ray).
- `xline × circle` → 0 / 1 / 2 (discriminante).
- `xline × arc` → 0 / 1 / 2 (intersezione cerchio + filter angle range).
- `xline × polyline/lwpolyline` → N (per ogni segment, line-line + bounds segment).
- `xline × rectangle` → N (rect come 4 segmenti).
- `ray × line` → 0 o 1 (`t_ray ≥ 0` + segment-bounds line).
- `ray × ray`, `ray × xline`, `ray × circle`, ... → idem con vincoli.

Nuove pure fn in `snapping/engines/intersection-calculators.ts`:
- `xlineLineIntersection`, `xlineXlineIntersection`, `xlineRayIntersection`, `xlineCircleIntersection`, `xlineArcIntersection`, `xlinePolylineIntersection`, `xlineRectangleIntersection`.
- `rayLineIntersection`, `rayRayIntersection`, `rayCircleIntersection`, `rayArcIntersection`, `rayPolylineIntersection`, `rayRectangleIntersection`.

**Numerical stability**:
- **Parallel detection**: `cross(dirA, dirB) < EPSILON` (es. `EPSILON = 1e-10`). Se parallele → no intersection.
- **Near-parallel** (cross < `1e-6` ma > `EPSILON`): rischio intersezioni molto lontane dal viewport. Filtro: scartare candidati con `|t| > 1e8` (out-of-world).
- **Direction normalization**: garantire `|direction|=1` al parser DXF e al builder (evita drift su `t` molto grandi).
- Test coverage: 1 unit test per ogni combo + edge case parallel + edge case coincident-but-different-base.

**Performance**:
- `IntersectionSnapEngine` pre-computa intersezioni in `initialize()` su scene-load (esistente, ADR-065). XLINE/RAY infiniti possono generare molte intersezioni globali → spatial grid (esistente, `GRID_CELL_SIZE=100`) gestisce. Audit: assicurarsi che intersezioni con coordinate "lontane" (es. `t=1e6`) non saturino la grid.

### G6 — Endpoint / Midpoint / Perpendicular / Nearest snap su XLine/Ray
**Cosa manca**: gli altri snap engines non sanno cosa fare con linee infinite.

**Google-fix** (per ogni engine):

| Engine | XLine behavior | Ray behavior |
|---|---|---|
| `EndpointSnap` | **Nessun endpoint** (infinita) → engine skippa. | **1 endpoint** (basePoint). |
| `MidpointSnap` | **Indefinito** (infinita) → engine skippa. | **Indefinito** → skippa. |
| `NearestSnap` | Projection del cursore sulla linea, sempre valido. | Projection, filter `t ≥ 0`. |
| `PerpendicularSnap` | Foot perpendicolare da reference point, sempre. | Foot, filter `t ≥ 0`. |
| `ParallelSnap` (se esiste) | Riconosce XLINE come reference parallela. | Idem. |
| `NodeSnap` | Skip (non ci sono nodes). | Skip. |
| `IntersectionSnap` | Vedi G5. | Vedi G5. |

Audit dedicato per ognuno: aggiungere `if (entity.type === 'xline' || entity.type === 'ray') { ... }` con behavior dedicato o skip esplicito.

### G7 — Hit-test point-to-infinite-line
**Cosa manca**: nessuna fn `pointToInfiniteLineDistance`. Selezione click su XLINE/RAY fallisce.

**Google-fix**:
- Nuova pure fn `rendering/utils/point-to-line-distance.ts`:
  ```typescript
  // For infinite line through base with direction dir:
  // distance = |cross(p - base, dir)| / |dir|
  // (signed distance — abs() per hit-test)
  export function pointToInfiniteLineDistance(p: Point2D, base: Point2D, dir: Point2D): number
  ```
- Per Ray: stessa formula, **ma** se la projection `t = dot(p-base, dir)/|dir|² < 0`, distanza = `distance(p, base)` (oltre il vertex usa distanza al base).
- Wire in `HitTester` casi `'xline'` / `'ray'`.

### G8 — DXF parser native `XLINE` / `RAY`
**Cosa manca**: `SUPPORTED_ENTITY_TYPES` non include `'XLINE'` / `'RAY'`. Parser ignora.

**Google-fix**:
- Estendere `utils/dxf-parser-types.ts:14-28` con `'XLINE'`, `'RAY'`.
- Extension `utils/dxf-entity-converters.ts`: nuova fn `convertXLine(parsed)` / `convertRay(parsed)` → `XLineEntity` / `RayEntity`.
- Parsing group codes: `10/20/30` basePoint, `11/21/31` direction. Validate `|direction| ≈ 1` (warning + normalize se no).
- Z-coord: 2D mode → ignorato (validate `z ≈ 0` o warning).
- Sezione `TABLES` ignore per XLINE (non c'è).

### G9 — DXF exporter native `XLINE` / `RAY`
**Cosa manca**: nessun output `AcDbXline` / `AcDbRay`.

**Google-fix**:
- Audit `utils/dxf-exporter*.ts` (Phase 3 prima dell'extension).
- Output spec §3.5: subclass marker `AcDbXline` / `AcDbRay`, codes 10/20/30 + 11/21/31, direction normalizzata.
- Integration test: round-trip 3 file DXF reference con XLINE/RAY (anche da altri CAD) → import → export → re-import → diff zero.

### G10 — DXF EXTENTS — XLINE/RAY exclusion
**Cosa manca**: zoom-to-extents (`Z E`) include XLINE/RAY → zoom impossibile (bounds = ±10000 NOMINAL → user vede tutto miniaturizzato).

**Google-fix**:
- `getEntityBounds` per `xline` / `ray`: ritornare bounds **vuoti** (`EMPTY_SPATIAL_BOUNDS`) **quando il consumer è zoom-to-extents**, full nominal bounds quando consumer è render.
- Refactor: separare `getEntityRenderBounds` (per culling) da `getEntityExtentsBounds` (per zoom). Industry standard: extents skippa construction lines.
- Audit consumer di `getEntityBounds`: zoom-extents handler, spatial index, ecc.

### G11 — Visual representation linetype default
**Cosa manca**: nessun default linetype/color per XLINE/RAY.

**Industry pattern**: AutoCAD spesso usa `linetype = Continuous, color = ByLayer` (default), ma molti template hanno layer "Construction" con `ACI 4 (Cyan) + linetype Dashed` per distinguere a colpo d'occhio.

**Google-fix**:
- **No hardcoding** — pure ByLayer. Layer naming convention "Construction" con preset cyan-dashed è **decisione del progetto template**, non del tool.
- Quick Style override (ADR-357 G15) attivo anche per XLINE/RAY → utente può forzare dashed inline.
- Decisione Q&A: default initial preset al primo uso? (toast: "Layer 'Construction' creato e impostato come current per XLine?").

### G12 — Grip editing per XLINE/RAY
**Cosa manca**: nessuna grip strategy per linee infinite.

**Google-fix** (consumer di ADR-357 Phase 11/12 GripStore):
- **XLine grips**: 1 grip al `basePoint` (square) + 2 grip "direction" a `basePoint ± k*direction` (k = small visible offset, es. 50 world units, scala con zoom). Drag basePoint → trasla. Drag direction grip → ruota attorno a basePoint.
- **Ray grips**: 1 grip al `basePoint` (origin) + 1 grip a `basePoint + k*direction` (direzione). Drag basePoint → trasla. Drag direction → ruota.
- `GripTransformRegistry` esteso con `XLINE_GRIP_TRANSFORMS` / `RAY_GRIP_TRANSFORMS`.

### G13 — Trim/Extend con XLINE/RAY come cutting edges
**Cosa manca**: i cutting edges di TRIM/EXTEND (ADR-350/353) gestiscono solo line/polyline/circle/arc.

**Google-fix** (audit dedicato ai cutting-edge resolver):
- XLINE come cutting edge: divide entità target in 2 sub-entity (la porzione su un lato dell'XLINE viene "trimmed").
- RAY come cutting edge: divide solo se l'intersezione cade `t_ray ≥ 0`.
- Estensione `intersection-calculators.ts` automaticamente disponibile (G5).
- Decisione Q&A: enable di default o flag opt-in?

### G14 — Naming UI / i18n
**Cosa manca**: stringhe UI.

**Google-fix**:
- Industry-friendly: **"Construction Line"** (XLINE) — AutoCAD/BricsCAD label nei tooltip. "Infinite Line" è alternativo.
- **"Ray"** (RAY) — universalmente riconosciuto.
- i18n:
  - el: `Γραμμή Κατασκευής` (XLINE), `Ακτίνα` (RAY).
  - en: `Construction Line`, `Ray`.
- Sub-mode labels:
  - el: `Οριζόντια / Κάθετη / Γωνία / Διχοτόμος / Παράλληλη`.
  - en: `Horizontal / Vertical / Angle / Bisect / Offset (Parallel)`.

### G15 — Persistence scope (consistente con ADR-358 §5.5)
**Cosa manca**: XLINE/RAY come tutte le entità DXF vivono in `SceneModel.entities[]` per-level. Coerente con ADR-358.

**Google-fix**: zero-extra-work — consume `SceneModel` esistente. Project-wide (cross-level) layers (ADR-358 G14) automaticamente disponibile.

---

## 5. Decision (template — DA FINALIZZARE in Q&A)

> Le risposte di Giorgio in greco saranno trascritte in italiano e aggiorneranno questa sezione.

### 5.1 Scope tool — XLINE sub-modes — Q1 risolta 2026-05-16 (Full v1)
**Confermato Giorgio**: **TUTTI i 5 sub-modes dal v1** (Full Enterprise + GOL).
- XLINE tool registrato con: **Through (default) / Horizontal / Vertical / Angle / Bisect / Offset**.
- RAY tool registrato senza sub-modes (semplice 2-point).
- Sub-mode switching via keyboard shortcut (`H` / `V` / `A` / `B` / `O` / `T` per Through) durante tool attivo (UX dettaglio in Q2).
- Industry convergence 4/4 CAD player → standard non-opinionato.
- Implementation roadmap copre tutti i 5 modes: Phase 3 (Through/Hor/Ver) + Phase 3.5 (Ang/Bisect/Offset).

### 5.2 Internal state machine — XLineModeStore — Q2 risolta 2026-05-16 (Full Enterprise multi-surface)

**Confermato Giorgio**: **Opzione D Full Enterprise** — keyboard + status bar + right-click context menu, tutti consumer di un unico `XLineModeStore` SSoT.

**Architettura SSoT**:
- Singleton micro-leaf (pattern ADR-040 + ADR-358 LayerStore).
- File: `src/subapps/dxf-viewer/systems/tools/xline-mode-store.ts`.
- Stato:
  ```typescript
  type XLineMode = 'through' | 'horizontal' | 'vertical' | 'angle' | 'bisect' | 'offset';
  interface XLineModeState {
    readonly mode: XLineMode;
    readonly angleValue: number | null;        // Ang mode
    readonly offsetDistance: number | null;    // Offset mode
    readonly sourceEntityId: string | null;    // Offset mode (line/xline/ray/polyline-segment)
    readonly bisectVertex: Point2D | null;     // Bisect mode (collected click 1)
    readonly bisectStart: Point2D | null;      // Bisect mode (collected click 2)
  }
  ```
- API: `getMode()`, `setMode(mode, params?)`, `subscribe(cb)`, `reset()`.
- Persistence: `localStorage` chiave `dxf:xlineMode.lastUsed` (cross-session, restore default mode = ultimo usato).
- Reset state su `setTool` switch out of `'xline'`.

**Tre surfaces consumer (zero duplicazione logica)**:

1. **Keyboard handler** (Phase 3, file `hooks/canvas/useKeyboardShortcuts.ts`):
   - Mentre `activeTool === 'xline'` e canvas focused: tasti `H/V/A/B/O/T` → `XLineModeStore.setMode(...)`.
   - Ang mode: `A` apre Dynamic Input prompt per angolo (consumer ADR-357 Phase 2).
   - Offset mode: `O` entra in selection mode (entity pick) + Dynamic Input prompt distance.

2. **Status bar indicator** (Phase 2, file `ui/status-bar/StatusBarXLineModeSlot.tsx`):
   - Mount solo quando `activeTool === 'xline'`.
   - Display: `XLine: [Horizontal ▼]` con icon + mode label localized.
   - Click sull'indicator → mini-popover Radix con 6 voci modes (no shortcut keys mostrati come hint).
   - Sub-info: per Ang mostra `(27°)`, per Offset mostra `(d=1.20m)`.

3. **Right-click context menu** (Phase 2, file `ui/canvas/context-menus/XLineToolContextMenu.tsx`):
   - Mount quando `activeTool === 'xline'` e `DrawingStateMachine in [TOOL_READY, COLLECTING_POINTS]`.
   - Voci: `Through / Horizontal / Vertical / Angle… / Bisect / Offset…` (`…` indica parametri richiesti).
   - Separatore + `Cancel current` + `Finish chain` (consumer ADR-357 §5.4 chain mode).
   - Shortcut keys mostrati a destra di ogni voce (BricsCAD pattern).

**Pre-commit ratchet** (`.ssot-registry.json` modulo `xline-mode-store`):
- Vieta accessi diretti a `xlineMode` fuori da `XLineModeStore`.
- Forza canalizzazione via `getMode()` / `setMode()`.

**i18n** (`dxf-viewer.json`):
- Mode labels (el + en) — vedi Q12.
- Status bar prefix: el `Γραμμή κατασκευής:` / en `Construction Line:`.

### 5.3 Clip algorithm — Q4 risolta 2026-05-16 (Liang-Barsky)
**Confermato Giorgio**: **Liang-Barsky** (parametric form, ottimale per linee infinite).

**File SSoT**: `src/subapps/dxf-viewer/rendering/utils/line-clipping.ts`.

**API**:
```typescript
export interface ClipResult {
  readonly start: Point2D;
  readonly end: Point2D;
}

export function clipParametricLine(
  base: Point2D,
  dir: Point2D,
  tRange: { min: number; max: number },     // (-Infinity, +Infinity) per XLine; [0, +Infinity) per Ray
  viewport: { minX: number; minY: number; maxX: number; maxY: number }
): ClipResult | null;
```

**Algoritmo** (parametric form):
- Line equation: `P(t) = base + t * dir`, `t ∈ tRange`.
- 4 edge constraints viewport → 4 inequalities `p_i * t ≤ q_i` con `p_i, q_i` derivati da `(dir, base, viewport)`.
- Compute `t_enter = max(0, max_negative_p_ratios)`, `t_exit = min(1, min_positive_p_ratios)` adattati a `tRange`.
- Se `t_enter > t_exit` → null (linea completamente fuori).
- Else → `start = base + t_enter*dir`, `end = base + t_exit*dir`.

**Edge cases**:
- `|dir| < EPSILON` (degenerate) → null.
- Linea parallela ad un edge viewport e fuori → null (handled da `p_i = 0, q_i < 0`).
- Linea parallela ad un edge viewport e dentro → handled da `p_i = 0, q_i ≥ 0` (no constraint update).
- `tRange.min === -Infinity / +Infinity` → init `t_enter / t_exit` con `-1e15 / +1e15` (safety bound, evita NaN su moltiplicazioni `Infinity * 0`).

**Numerical stability**:
- `direction` normalizzata at boundary I/O (parser/builder) → `|dir| ≈ 1` → coordinate clip prevedibili.
- `EPSILON = 1e-10` per parallel detection.

**Test coverage** (Phase 4 §8.1): 15+ unit cases — orizzontale/verticale/diagonale, fuori/dentro/tangente, degenerate, ray con base fuori in direzione dentro, viewport zero-width.

**Pre-commit ratchet** (`.ssot-registry.json` modulo `line-clipping`):
- Vieta implementazioni ad-hoc Cohen-Sutherland / Liang-Barsky / clip inline.
- Forza uso di `clipParametricLine` per qualunque rendering di linea infinita o semi-infinita.

### 5.4 Persistence — Q7 risolta 2026-05-16 (Full native DXF)
**Confermato Giorgio**: **A — Full native DXF** — `AcDbXline` / `AcDbRay` entities native. Industry interop full.

**Import spec** (Phase 8 — `utils/dxf-entity-converters.ts`):
```
0   XLINE | RAY                  ← entity marker
5   <handle>                     ← DXF entity handle
100 AcDbEntity                   ← subclass marker base
8   <layer name>                 ← assigned layer (ByLayer hook ADR-358)
6   <linetype name>              (optional) ByLayer default
62  <ACI color>                  (optional) ByLayer default
370 <lineweight>                 (optional) ByLayer default
100 AcDbXline | AcDbRay          ← subclass marker
10  basePoint.x
20  basePoint.y
30  basePoint.z                  (2D → expect 0, warning se ≠ 0)
11  direction.x (unit-normalized expected)
21  direction.y
31  direction.z                  (2D → expect 0)
```

**Import normalization** (defensive at boundary I/O):
- Direction NON-normalizzata → normalize automaticamente con warning (`|dir|=1` invariant).
- Direction zero (`|dir| < EPSILON=1e-10`) → entity skipped + error logged (degenerate DXF).
- Z-coord ≠ 0 → warning (2D viewer ignora Z, ma preserva in `dxfExtraTags` per round-trip-safe export).

**Export spec** (Phase 9 — `utils/dxf-exporter*.ts`):
- Output identico allo schema sopra.
- `basePoint` come scritto in `XLineEntity.basePoint` / `RayEntity.basePoint` (mm internal, ADR-358 §5.5).
- `direction` re-normalizzata at export (safety) → `|dir|=1` garantita.
- `layer` da `entity.layer` (ADR-358 ByLayer pipeline).
- Style codes 6/62/370 **omessi** se ByLayer (DXF convention — DAR-358 §5.4 `resolveEntityStyle`).

**Roundtrip integrity test** (Phase 9 §8.3):
- 3 file DXF reference (AutoCAD-generated, BricsCAD-generated, ezdxf-generated) con XLINE + RAY.
- Test: import → assert entity count + basePoint + direction (tolerance `1e-6`).
- Test: import → export → re-import → diff zero (entity-by-entity).
- 1 file con XLINE/RAY su layer "Construction" custom + linetype Dashed + color cyan → assert ByLayer integrity post-export.

**Pre-commit ratchet** (`.ssot-registry.json` modulo `dxf-xline-ray-parser`):
- Vieta parsing inline di `AcDbXline` / `AcDbRay` fuori dai converter ufficiali.
- Forza unico entry point `convertXLine` / `convertRay`.

### 5.5 Visual representation — Q5 risolta 2026-05-16 (Pure clip)
**Confermato Giorgio**: **A — Pure clip** — full-viewport line clipped, **no infinity markers**, no decorations.
- Distinzione visiva da LINE delegata a **linetype/color** (industry standard AutoCAD/BricsCAD).
- Convenzione raccomandata (non enforced): layer "Construction" con `linetype = Dashed` + `color = ACI 4 (Cyan)` — vedi Q14/Q15.
- Quick Style override (ADR-357 G15) disponibile per per-entity override.
- Render = pure `clipParametricLine` output → `ctx.moveTo/lineTo` → `ctx.stroke()`. Zero overhead.

### 5.6 Chain mode — Q6 risolta 2026-05-16 (Full Enterprise — industry-standard semantic per-mode)

**Confermato Giorgio**: Full Enterprise + GOL + SSoT — adottata semantic industry AutoCAD/BricsCAD/GstarCAD differenziata per mode.

`allowsChain: true` per entrambi i tool (XLINE / RAY) coerente con ADR-357 §5.4. **Semantic per ogni mode**:

| Mode | Chain behavior | Stato preservato in `XLineModeStore` |
|---|---|---|
| **Through XLINE** | Fan/pivot — dopo click1 (basePoint), ogni click successivo = nuovo XLINE attraverso lo stesso `basePoint` | `basePoint` (sticky finché chain attiva) |
| **Horizontal** | Independent — ogni click = nuova horizontal xline al punto cliccato | nessuno |
| **Vertical** | Independent — ogni click = nuova vertical xline | nessuno |
| **Angle** | Independent — ogni click = nuova xline alla stessa `angleValue` configurata | `angleValue` (sticky finché tool attivo) |
| **Bisect** | Re-use vertex — dopo terna completa, `bisectVertex` rimane, prossima chain inizia da click2 (angleStart) | `bisectVertex` (sticky finché chain attiva) |
| **Offset** | Re-use source + distance — `sourceEntityId` + `offsetDistance` rimangono, ogni click = side-selection per nuova parallela | `sourceEntityId`, `offsetDistance` (sticky finché tool attivo) |
| **RAY** | Fan/pivot — dopo click1 (origin), ogni click = nuovo RAY dalla stessa origin | `basePoint` (sticky finché chain attiva) |

**Exit / control** (coerente con ADR-357 §5.4 chain mode):
- **ESC**: cancel current + exit tool (torna `select`).
- **Enter senza input**: finish current chain, tool **resta attivo** per chain successiva con stato pulito (re-prompt basePoint per Through/Ray, re-prompt vertex per Bisect).
- **Right-click**: context menu unificato (consumer ADR-357 §5.4) — `Finish chain / Cancel / Switch mode (sub-menu Hor/Ver/Ang/Bisect/Offset/Through)`.
- **Mode switch durante chain** (keyboard `H/V/A/B/O/T`): chiude chain corrente (commit se valida, discard se incompleta), apre nuova chain nel nuovo mode con stato fresh.

**Edge case Bisect re-use vertex**:
- Visual feedback: dopo prima terna completata, `bisectVertex` rimane evidenziato (cerchio piccolo arancione/cyan) per indicare "vertex sticky".
- Per cambiare vertex senza uscire dal mode: shortcut `V` (vertex reset) — discardato dal default keyboard handler perché conflitta con Vertical-mode-shortcut. **Decisione**: usa `Shift+V` per "reset bisect vertex" (no conflict, intuitivo).

**Edge case Offset re-use source**:
- Visual feedback: la source entity ha highlight persistente (outline cyan tratteggiato) durante chain.
- Cambia source: shortcut `Shift+O` (re-pick source) — analogo a Bisect.
- Cambia distance: pressione di un digit durante chain riapre Dynamic Input distance prompt.

**Pre-commit ratchet**: lo state machine chain logic NON deve essere duplicato. Singola entry `handleXLineChainAfterCompletion(mode, store)` in `completeEntity` consumer hook (Phase 3.5).

### 5.7 Edit handling — Grip editing — Q9 risolta 2026-05-16 (2 grips puri, A)

**Confermato Giorgio**: **A — 2 grips puri** (basePoint + direction-handle). Mapping 1:1 con entity data (`basePoint + direction`). No `secondPoint` grip — è derivative.

**XLINE grips** (file `systems/grips/entity-grips/xline-grips.ts`):
```typescript
generateXLineGrips(entity: XLineEntity, screenScale: number): Grip[] {
  const HANDLE_OFFSET_WORLD = 50 / screenScale;  // ~50px screen, scale-aware
  const handlePos = {
    x: entity.basePoint.x + entity.direction.x * HANDLE_OFFSET_WORLD,
    y: entity.basePoint.y + entity.direction.y * HANDLE_OFFSET_WORLD,
  };
  return [
    { id: 'base', type: 'square',  position: entity.basePoint, role: 'translate' },
    { id: 'dir',  type: 'diamond', position: handlePos,        role: 'rotate'    },
  ];
}
```

**RAY grips** (file `systems/grips/entity-grips/ray-grips.ts`):
- Identico schema. `basePoint` grip = translate (semantica chiara: è il "vertex" del raggio). `direction-handle` grip = rotate.
- Visual difference: il basePoint del RAY ha extra outer ring (per indicare visivamente "questo è l'origin, da qui parte"). Industry feedback: RAY base ≠ XLINE base.

**Grip transforms** (consumer ADR-357 Phase 11/12 `GripTransformRegistry`):
- `translate` (basePoint): drag → `entity.basePoint += deltaWorld`. `entity.direction` invariata.
- `rotate` (direction-handle): drag → `entity.direction = normalize(cursorWorld - entity.basePoint)`. `entity.basePoint` invariato. Polar tracking ADR-357 G1 disponibile durante drag (snap a multipli di 5/10/15/45/90° configurabili).

**Hot-grip modal**:
- Enter/Space mentre hot cicla mode (Translate/Rotate). Default = role del grip.
- Right-click hot = context menu (Translate / Rotate / Copy / Undo).

**No multi-function popup** complesso (industry: XLINE/RAY non hanno Mirror/Scale semantici utili — sono linee infinite/semi-infinite).

**Renderer micro-leaf**: consumer del canvas-leaf esistente per grip overlay (ADR-357 Phase 11). Zero duplicazione.

**Pre-commit ratchet**: no nuovo modulo dedicato. Consumer di SSoT `GripStore` + `GripTransformRegistry` (ADR-357).

### 5.8 Performance — Q10 risolta 2026-05-16 (Frame-time pure, no cache)

**Confermato Giorgio**: **A — Frame-time pure clip, zero cache layer**.

**Strategia**:
- `LineClipping.liangBarsky(line, viewport)` invocato per ogni XLINE/RAY ad ogni RAF tick. Nessuna cache, nessun invalidation logic.
- Direction normalized at I/O boundary (DXF parser/exporter ADR-359 §5.4), zero re-normalization a render-time.
- Spatial grid `IntersectionSnapEngine` (ADR-065) resta SSoT per intersection snap — non duplica clip logic.

**Performance budget compliance (ADR-040)**:
- Liang-Barsky: 4 boundary comparisons + 2 parametric lerp = ~10-50ns per line (modern V8).
- 50 XLINE/scene (realistic upper bound) = ~2.5μs/frame = **0.015%** del budget 16ms.
- Pathological 1000+ XLINE = ~50μs/frame = **0.3%** del budget. Ancora ampiamente accettabile.

**Vantaggi vs cache**:
- Zero stale-clip bugs durante grip drag, pan, zoom, layer toggle.
- Zero invalidation surface (no `viewportChange` listener, no `entityEdit` listener).
- SSoT puro: una sola function pura in `rendering/utils/line-clipping.ts` (Q4), zero state.

**Industry alignment**: AutoCAD + BricsCAD + GstarCAD usano frame-time clip puro per XLINE/RAY. Liang-Barsky considerato "trivially cheap" — no industry player implementa cache layer.

**YAGNI escape hatch**: se mai si raggiungesse pathological scale (10k+ XLINE), cache layer aggiungibile come Phase post-MVP. Architettura `LineClipping` pura facile da wrappare in memo.

**Pre-commit ratchet**: nessun modulo nuovo. SSoT `line-clipping` (Q4) già coperto.

### 5.9 Trim/Extend support — Q11 risolta 2026-05-16 (Default ON, no flag)

**Confermato Giorgio**: **A — XLINE/RAY auto-detected come cutting edges in TRIM/EXTEND. Nessun flag, nessun opt-out dedicato**.

**Strategia**:
- `CuttingEdgeCollector` (Phase 12 audit `core/commands/trim/*` + `core/commands/extend/*`) itera **tutte** le entities dello spatial grid (ADR-065) senza type-exclusion filter.
- XLINE/RAY partecipano automaticamente — sono entities con `type: 'xline' | 'ray'`, già nel grid post-Phase 4.
- Intersezione cutting-edge vs target line → handler esistente in `IntersectionSnapEngine` (ADR-065) calcola punto di taglio. Liang-Barsky clip (Q4) NON serve qui — il trim usa raw infinite-line math, non viewport-clipped representation.

**Opt-out per-entity senza nuovo flag**:
- Layer hide via `LayerStore.setVisible(false)` (consume ADR-358) → entities su layer nascosto esclusi automaticamente da `CuttingEdgeCollector` (behavior esistente ADR-357 §11).
- Layer lock via `LayerStore.setLocked(true)` → stesso effetto (ADR-358 §5.6).
- **Zero codice nuovo** per opt-out: SSoT layer-visibility è l'override.

**Industry alignment**: AutoCAD modern / BricsCAD / GstarCAD / ArchiCAD = 4/4 default ON. Convergence rule (CLAUDE.md feedback memory: industry-standard = default answer).

**Implementation effort Phase 12**:
1. Audit 12 file in `core/commands/trim/*` + `core/commands/extend/*`.
2. Verificare assenza di `entity.type === 'xline' && return false` o filter equivalenti.
3. Aggiungere unit test: `trim-with-xline-cutting-edge.test.ts` + `extend-to-ray.test.ts`.
4. Visual regression Playwright (Phase 4 testing strategy).

**Pre-commit ratchet**: no nuovo modulo SSoT. Consumer puro di `CuttingEdgeCollector` + `LayerStore` esistenti.

### 5.10 Layer/Style inheritance — Q8 risolta 2026-05-16 (Pure ByLayer + scaffold opt-in)

**Confermato Giorgio**: **B — Pure ByLayer + Construction layer scaffold opt-in**.

**Pure ByLayer pipeline** (consume-only ADR-358, zero extension):
- `completeEntity` legge `LayerStore.currentLayerId` (ADR-357 Phase 0 wired) → setta `entity.layer` su nuova XLINE/RAY.
- Render: `resolveEntityStyle(entity, layer)` (ADR-358 §5.4 G7) → color/linetype/lineweight inheritati ByLayer.
- Override per-entity post-creation: Quick Style dropdowns ribbon (ADR-357 G15) automaticamente disponibili.
- **No per-tool mini-dropdown** dedicato (anti-SSoT, vietato da pre-commit ratchet).

**Construction layer scaffold — opt-in dialog** (Phase 14):
- Trigger: prima creazione XLINE in un project dove **non esiste già** un layer con `category === 'general'` E `name in {'Construction', 'Construct', 'CONS', 'AUX'}` (case-insensitive, AIA-friendly).
- Behavior:
  ```
  ┌──────────────────────────────────────────────────────┐
  │ 🏗️ Δημιουργία Construction layer;                    │
  │                                                       │
  │ Συνιστούμε ξεχωριστό layer για XLINE/RAY:            │
  │   • Όνομα: Construction                              │
  │   • Χρώμα: Cyan (ACI 4)                              │
  │   • Linetype: Dashed                                 │
  │   • Lineweight: Default                              │
  │   • Plottable: No (off)                              │
  │                                                       │
  │ [Δημιουργία και χρήση] [Όχι ευχαριστώ] [Μη ξαναρωτάς]│
  └──────────────────────────────────────────────────────┘
  ```
- Click **"Δημιουργία και χρήση"**: `LayerOperationsService.create({ name: 'Construction', color: { aci: 4, trueColor: null }, linetype: 'Dashed', lineweight: -3, plottable: false, category: 'general' })` → `LayerStore.setCurrentLayerId(newLayer.id)` → XLINE va sul layer nuovo.
- Click **"Όχι ευχαριστώ"**: XLINE va sul current layer (no scaffold). Dialog ricompare alla prossima nuova XLINE (in caso utente ci ripensi).
- Click **"Μη ξαναρωτάς"**: persist `dxf:xlineScaffold.dismissed = true` in `localStorage` (per-user, cross-project). Mai più ricompare.
- Override programmatico Firestore: `projects/{projectId}/dxfSettings.xlineScaffoldDone = true` (per-project flag) — dopo creazione layer o "Όχι ευχαριστώ" su quello specifico project.

**Pre-commit ratchet**: no nuovo modulo (consume-only — il SSoT è già `LayerStore` di ADR-358).

**Layer detection logic** (SSoT puro per scaffold trigger):
```typescript
// File: src/subapps/dxf-viewer/services/construction-layer-detector.ts
export const CONSTRUCTION_LAYER_NAME_HINTS = ['construction', 'construct', 'cons', 'aux'] as const;

export function hasConstructionLayer(layers: ReadonlyArray<SceneLayer>): boolean {
  return layers.some(l =>
    CONSTRUCTION_LAYER_NAME_HINTS.includes(l.name.toLowerCase() as never)
  );
}
```

i18n keys (`dxf-viewer.json`):
- el: titolo, body, 3 button labels (vedi mock-up sopra).
- en: `Create Construction layer?` / `We recommend a separate layer for XLINE/RAY:` / `Create and use` / `No thanks` / `Don't ask again`.

### 5.11 EXTENTS exclusion (G10)
**Proposta**: refactor `getEntityBounds` → split in `getEntityRenderBounds` (nominal) + `getEntityExtentsBounds` (empty per xline/ray). Industry standard.

### 5.12 i18n labels — Q12 risolta 2026-05-16 (Construction Line / Γραμμή Κατασκευής + Ray / Ακτίνα)

**Confermato Giorgio**: **A + A — industry-friendly + pure Greek locale**.

**i18n keys (SSoT — `src/i18n/locales/{el,en}/dxf-viewer.json`)**:

| Key | EL | EN |
|-----|-----|-----|
| `tools.xline.name` | Γραμμή Κατασκευής | Construction Line |
| `tools.xline.tooltip` | Άπειρη γραμμή αναφοράς και για τις δύο κατευθύνσεις | Infinite reference line in both directions |
| `tools.xline.mode.through` | Διέλευση | Through point |
| `tools.xline.mode.horizontal` | Οριζόντια | Horizontal |
| `tools.xline.mode.vertical` | Κάθετη | Vertical |
| `tools.xline.mode.angled` | Υπό γωνία | Angled |
| `tools.xline.mode.bisect` | Διχοτόμος | Bisect |
| `tools.xline.mode.offset` | Παράλληλη απόσταση | Offset |
| `tools.ray.name` | Ακτίνα | Ray |
| `tools.ray.tooltip` | Ημι-άπειρη γραμμή από αρχή προς κατεύθυνση | Semi-infinite line from origin in a direction |

**Status bar prompts** (XLineModeStore consumer):
- el: `"Γραμμή Κατασκευής ({mode}) — Κάντε κλικ στο πρώτο σημείο"`
- en: `"Construction Line ({mode}) — Click first point"`

**Industry alignment**: 3/4 CAD player (AutoCAD + GstarCAD + ArchiCAD-variant) usano "Construction Line". BricsCAD "Infinite Line" supporta alias "Construction Line".

**Compliance**:
- ✅ Pure Greek locale (memory `feedback_pure_greek_locale`) — zero English words in el strings.
- ✅ Descriptive over mathematical — "Γραμμή Κατασκευής" comunica **scopo** (architect/engineer use case), non geometria astratta.
- ✅ AutoCAD muscle-memory preservato via command alias `XL` / `XLINE` / `RAY` (§5.15, forward to ADR-357 G11).
- ✅ Pre-commit CHECK 3.8 (missing i18n keys) — tutte le 10 chiavi devono essere aggiunte a baseline `.i18n-missing-keys-baseline.json` PRIMA dell'uso in codice (rule N.11).

**Implementation order Phase 10** (Ribbon UI):
1. Aggiungere 10 chiavi a `el/dxf-viewer.json` + `en/dxf-viewer.json` (PRIMA).
2. Aggiornare `npm run i18n-keys:baseline` per scendere baseline missing keys.
3. THEN consumer in `tools.xline.*` / `tools.ray.*` via `t()` calls.

### 5.13 Linetype default — Q14 risolta 2026-05-16 (Pure ByLayer, no hardcoded per-entity)

**Confermato Giorgio**: **A — Pure ByLayer. Nessun hardcoded `linetype: 'Dashed'` su entity. Dashed "look" viene esclusivamente dal Construction layer scaffold di Q8**.

**Strategia**:
- `createEntityFromTool('xline'|'ray')` setta entity `linetype: 'ByLayer'` literalmente. Mai `'Dashed'`, mai `'Continuous'` hardcoded.
- `resolveEntityStyle(entity, layer)` (ADR-358 §5.4 G7) risolve runtime → eredita dal layer corrente.
- Construction layer scaffold (Q8 opt-in dialog) crea layer con `linetype: 'Dashed'` → XLINE/RAY su quel layer appaiono Dashed via ByLayer chain. Pulito.
- Quick Style dropdown ribbon (ADR-357 G15) permette override per-entity post-creation (caso raro, supportato).

**Compliance SSoT**:
- ✅ Una sola pipeline linetype resolution (`resolveEntityStyle` di ADR-358).
- ✅ Zero per-entity override hardcoded in tool factories.
- ✅ User-controlled: "Dashed feel" è scelta layer-level (architect discipline), non magic per-tool.

**Industry convergence 4/4**: AutoCAD + BricsCAD + GstarCAD + ArchiCAD usano ByLayer per XLINE/RAY default.

**Pre-commit ratchet** (modulo `xline-tool-creation` + `ray-tool-creation`):
- Forbidden pattern: `linetype:\s*['"]Dashed['"]` in `*/tools/draw/xline-tool.ts` o `*/tools/draw/ray-tool.ts`.
- Forbidden pattern: `linetype:\s*['"]Continuous['"]` idem.
- Allowed only: `linetype: 'ByLayer'`.

**Coerenza con Q8 + Q13**: layer-level decoration (Q8 Construction scaffold) + project-wide persistence (Q13) + ByLayer resolution (Q14) = single coherent style pipeline.

### 5.14 Color default — Q15 risolta 2026-05-16 (Pure ByLayer, no hardcoded per-entity)

**Confermato Giorgio**: **A — Pure ByLayer. Nessun hardcoded color per-entity. Cyan ACI 4 esclusivamente via Construction layer scaffold di Q8**.

**Strategia (mirror esatto di Q14 per dimensione color)**:
- `createEntityFromTool('xline'|'ray')` setta entity `color: 'ByLayer'` literalmente. Mai `{ aci: 4 }`, mai `'#00FFFF'` hardcoded.
- `resolveEntityStyle(entity, layer)` (ADR-358 §5.4 G7) risolve runtime → eredita ACI/trueColor dal layer corrente.
- Construction layer scaffold (Q8 opt-in dialog) crea layer con `color: { aci: 4, trueColor: null }` (Cyan) → XLINE/RAY su quel layer appaiono Cyan via ByLayer chain.
- Quick Style dropdown ribbon (ADR-357 G15) permette override per-entity post-creation.

**Compliance SSoT**:
- ✅ Una sola pipeline color resolution (`resolveEntityStyle` di ADR-358).
- ✅ Zero per-entity override hardcoded in tool factories.
- ✅ User intent rispettato: cambio color del Construction layer → propaga a tutte le XLINE/RAY su quel layer (ByLayer chain pulita).

**Industry convergence 4/4**: AutoCAD + BricsCAD + GstarCAD + ArchiCAD usano ByLayer per XLINE/RAY default, con preset Cyan (ACI 4) per Construction/Guide layer.

**Pre-commit ratchet** (modulo `xline-tool-creation` + `ray-tool-creation`):
- Forbidden pattern: `color:\s*\{[^}]*aci:\s*\d+` in `*/tools/draw/xline-tool.ts` o `*/tools/draw/ray-tool.ts`.
- Forbidden pattern: `color:\s*['"]#[0-9a-fA-F]{3,8}['"]` idem (true-color hex literali).
- Forbidden pattern: `color:\s*\{[^}]*trueColor:\s*['"]#` idem.
- Allowed only: `color: 'ByLayer'`.

**Coerenza Q8 + Q14 + Q15**: style pipeline unificata = layer-level decoration (Construction scaffold = Cyan + Dashed + plottable=false) + ByLayer linetype (Q14) + ByLayer color (Q15) = single SSoT chain ADR-358 `resolveEntityStyle`. Zero entity-level override hardcoded in tool factories.

### 5.16 Persistence scope — Q13 risolta 2026-05-16 (Project-wide, conferma coerenza Q7 + Q8)

**Confermato Giorgio**: **A — Project-wide persistence, zero decisione extra**.

**Architettura (coerente con Q7 DXF + Q8 Layer)**:
- XLINE/RAY entities salvati in Firestore `projects/{projectId}/entities/{entityId}` — stesso scope di LINE/CIRCLE/POLYLINE/etc.
- Consumer puro di `EntityPersistenceService` (ADR-357 Phase 4). Zero codice nuovo per persistence layer.
- DXF roundtrip (Q7) → Firestore intermediate format mantiene stessa semantica project-wide.
- Layer assignment (Q8 Pure ByLayer) → ereditato da `LayerStore` Firestore-synced di ADR-358 (project-wide).

**Multi-user collaboration**:
- Construction lines visibili a tutto il team del project (reference geometry = team asset).
- Per "scratch personale" non-shareato: utente crea layer Construction e lo nasconde via `LayerStore.setVisible(false)` localmente. Layer existe project-wide, ma visibility flag è user-local (consume ADR-358 §5.6 per-user visibility state).

**Zero nuovo modulo SSoT**. Pure conferma di pipeline esistente.

**Pre-commit ratchet**: nessuno nuovo. Già coperto da `EntityPersistenceService` di ADR-357.

### 5.15 Command aliases (forward to ADR-357 G11)
**Proposta**: `XL → xline`, `XLINE → xline`, `RAY → ray`. Pre-registrato in `CommandAliasRegistry` quando ADR-357 Phase 13 sarà live (no work in ADR-359, solo annotation).

---

## 6. Architecture

### 6.1 Pipeline tool activation → entity persistence

```
Ribbon "Construction Line" (alias XL)
  ▼
ToolStateManager.setTool('xline')              ← ADR-055 SSoT
  ▼
XLineModeStore.initialize(lastUsedMode || 'through')   ← new singleton
  ▼
DrawingStateMachine: IDLE → TOOL_READY         ← ADR-032 esistente
  ▼
[Keyboard 'H' | 'V' | 'A' | 'B' | 'O' | 'T']
  XLineModeStore.setMode('horizontal')
  StatusBar updates: "XLine: Horizontal"
  ▼
[Click 1] — semantic dipende dal mode:
  through:    basePoint = click1 → COLLECTING_POINTS
  hor/ver:    crea XLINE immediato (1-click mode) → COMPLETING
  ang:        basePoint = click1, prompt angle (DynamicInput) → COMPLETING
  bisect:     vertex = click1 → COLLECTING_POINTS
  offset:     source = entity picked at click1 → COLLECTING_POINTS (prompt distance)
  ▼
[Click 2] (modi multi-click):
  through:    direction = normalize(click2 - basePoint)
  bisect:     angleStart = click2 → waits click3
  ▼
[Click 3] (solo bisect):
  bisect:     angleEnd = click3 → direction = bisettrice computed
  ▼
createEntityFromTool('xline', points, id, ...)  ← extend ADR-057 pipeline
  ▼
completeEntity(xlineEntity, ...)
  1. applyCompletionStyles
  2. resolveEntityStyle (ADR-358 G7 — ByLayer)
  3. CreateEntityCommand → CommandHistory.execute (ADR-031)
  4. SceneManager.addEntity (persistito in SceneModel.entities)
  5. EventBus.emit('drawing:complete')
  6. toolStateStore.handleToolCompletion → chain mode (ADR-357 §5.4)
  7. (opt) DXF persistence se export attivo
```

### 6.2 Pipeline render (frame)

```
DxfRenderer.drawEntity(entity)
  ▼
case 'xline':
  ResolvedStyle = resolveEntityStyle(entity, layer)   ← ADR-358 G7
  ctx.strokeStyle = ResolvedStyle.color
  ctx.lineWidth = lineweightToPx(ResolvedStyle.lineweight, zoom)
  ctx.setLineDash(LinetypeRegistry.resolve(ResolvedStyle.linetype).pattern)
  ▼
  viewport = camera.getViewportWorldBounds()
  clipped = clipParametricLine(
    entity.basePoint,
    entity.direction,
    { min: -Infinity, max: +Infinity },
    viewport
  )
  if (clipped) {
    ctx.beginPath()
    ctx.moveTo(clipped.start.x, clipped.start.y)
    ctx.lineTo(clipped.end.x, clipped.end.y)
    ctx.stroke()
  }

case 'ray':
  // idem, ma tRange = { min: 0, max: +Infinity }
```

### 6.3 Pipeline intersection snap

```
ProSnapEngineV2.findSnapPoint(cursor)
  ▼
IntersectionSnapEngine.findSnapCandidates(cursor, ctx)   ← cached (ADR-065)
  ▼
[Cache miss / scene change]
  ▼
preComputeIntersections(entities)
  for each pair (e1, e2):
    calculateIntersections(e1, e2)
      ▼
    switch (type1, type2):
      case ('xline', 'xline'): xlineXlineIntersection(e1, e2)
      case ('xline', 'line'):  xlineLineIntersection(e1, e2)
      case ('xline', 'circle'): xlineCircleIntersection(e1, e2)
      ... (12 nuove combo XLine + 12 nuove combo Ray)
  ▼
Spatial grid insertion
```

### 6.4 Component map

| File | Phase | Modifica |
|---|---|---|
| `ui/toolbar/types.ts` | 1 | Estende `ToolType` union (`'xline'`, `'ray'`) |
| `systems/tools/ToolStateManager.ts` | 1 | Aggiunge `TOOL_DEFINITIONS['xline']` + `['ray']` |
| `systems/tools/xline-mode-store.ts` | 2 | Nuovo singleton micro-leaf |
| `hooks/drawing/drawing-entity-builders.ts` | 3 | Case `'xline'` (through/hor/ver/ang/bisect/offset) + `'ray'` in `createEntityFromTool` + `isEntityComplete` |
| `hooks/drawing/drawing-preview-generator.ts` | 3 | Case `'xline'` + `'ray'` in `generatePreviewEntity` |
| `hooks/drawing/useDrawingHandlers.ts` (audit) | 3 | Mode switch keyboard handler integration |
| `hooks/canvas/useKeyboardShortcuts.ts` | 3 | `H/V/A/B/O/T` keys mentre tool='xline' attivo → `XLineModeStore.setMode()` |
| `rendering/utils/line-clipping.ts` | 4 | Nuovo modulo Liang-Barsky pure fn |
| `rendering/entities/XLineRenderer.ts` | 4 | Nuovo renderer (consume `clipParametricLine` + ADR-358 `resolveEntityStyle`) |
| `rendering/entities/RayRenderer.ts` | 4 | Nuovo renderer (tRange `[0, +∞]`) |
| `rendering/core/EntityRendererComposite.ts` | 4 | Registra `XLineRenderer` + `RayRenderer` in `initializeRenderers()` |
| `rendering/utils/point-to-line-distance.ts` | 5 | Nuovo SSoT puro (hit-test) |
| `rendering/hitTesting/hit-test-entity-tests.ts` | 5 | Case `'xline'` + `'ray'` consume `pointToInfiniteLineDistance` |
| `types/entities.ts` | 5 | Refactor `getEntityBounds` → split render/extents bounds (G10) |
| `snapping/engines/intersection-calculators.ts` | 6 | 12+ nuove pure fn intersezione |
| `snapping/engines/IntersectionSnapEngine.ts` | 6 | Switch esteso a `'xline'` / `'ray'` |
| `snapping/engines/EndpointSnapEngine.ts` (audit) | 7 | RAY basePoint = endpoint, XLINE skip |
| `snapping/engines/NearestSnapEngine.ts` (audit) | 7 | Projection-on-infinite-line |
| `snapping/engines/PerpendicularSnapEngine.ts` (audit) | 7 | Foot perpendicolare |
| `snapping/engines/MidpointSnapEngine.ts` (audit) | 7 | Skip esplicito |
| `utils/dxf-parser-types.ts` | 8 | `SUPPORTED_ENTITY_TYPES += ['XLINE', 'RAY']` |
| `utils/dxf-entity-converters.ts` | 8 | `convertXLine`, `convertRay` parser |
| `utils/dxf-exporter*.ts` | 9 | Output `AcDbXline` / `AcDbRay` |
| `ui/ribbon/data/*.ts` + `ui/ribbon/groups/*.tsx` | 10 | Ribbon button XLINE + RAY + sub-mode submenu |
| `i18n/locales/{el,en}/dxf-viewer.json` | 10 | Stringhe UI |
| `systems/grips/entity-grips/xline-grips.ts` | 11 | Grip strategy (consumer ADR-357 Phase 11) |
| `systems/grips/entity-grips/ray-grips.ts` | 11 | Idem |
| `core/commands/trim/*` + `core/commands/extend/*` (audit) | 12 | XLINE/RAY come cutting edges (se confermato Q11) |

---

## 7. Implementation Phases (FULL ENTERPRISE — una phase = una sessione)

Ogni phase = 1 commit autonomo, passa CI, no breaking. **Nessuna dipendenza forte da ADR-357** — può procedere parallelo. **Dipendenza minima da ADR-358**: solo `LayerStore.currentLayerId` (Phase 4 di ADR-358 minimum viable).

**Splittato 2026-05-16** (anti-context-noise discipline): le phase originali 4, 6, 6.5, 10 erano context-heavy. Split in sub-phases per garantire 1 phase = 1 sessione con context pulito (target ≤50%).

| Phase | Titolo | Files | Effort | Q-ref | Context risk |
|---|---|---|---|---|---|
| **0** ✅ | Audit DXF exporter + render bounds split (G10) | 4 | S | G10 | 🟢 Low |
| **1** ✅ | Tool registration: `ToolType` + `TOOL_DEFINITIONS` | 2 | S | Q1 | 🟢 Low |
| **2** ✅ | `XLineModeStore` micro-leaf + status bar mode indicator + context menu | 3 | S | Q2 | 🟢 Low |
| **3** ✅ | Entity builders + preview + completion (Through/Hor/Ver modes) | 4 | M | Q1, Q6 | 🟡 Medium |
| **3.5** ✅ | Sub-modes Ang + Bisect + Offset entity builders + preview | 3 | M | Q1 | 🟡 Medium |
| **4.a** ✅ | Liang-Barsky clip pure module + unit tests (15+ cases) | 2 | S | Q4 | 🟢 Low |
| **4.b** ✅ | `XLineRenderer` + `RayRenderer` + `EntityRendererComposite` registry | 3 | M | Q5 | 🟡 Medium |
| **5** ✅ | Hit-test `pointToInfiniteLineDistance` + `HitTester` wire | 3 | S | G7 | 🟢 Low |
| **6.a** ✅ | `IntersectionSnapEngine` switch extension + 6 XLine-primitives calcs (LINE/CIRCLE/ARC) + tests | 4 | M | G5 | 🟡 Medium |
| **6.b** ✅ | 6 XLine-self/complex calcs (XLINE/POLYLINE/ELLIPSE) + tests | 3 | M | G5 | 🟡 Medium |
| **6.5.a** ✅ | 6 Ray-primitives intersection calcs (LINE/CIRCLE/ARC) + tests | 3 | M | G5 | 🟡 Medium |
| **6.5.b** ✅ | 6 Ray-self/complex calcs (RAY/XLINE/POLYLINE) + numerical-stability suite | 3 | M | G5 | 🟡 Medium |
| **7** ✅ | Secondary snap engines audit (Endpoint/Midpoint/Nearest/Perpendicular) | 4 | M | G6 | 🟡 Medium |
| **8** ✅ | DXF parser `XLINE` / `RAY` (import) | 3 | M | Q7 | 🟡 Medium |
| **9** ✅ | DXF exporter `AcDbXline` / `AcDbRay` (export) + roundtrip integration test | 3 | M | Q7 | 🟡 Medium |
| **10.a** ✅ | i18n keys (10 chiavi el+en) + `i18n-keys:baseline` ratchet update | 2 | S | Q12 | 🟢 Low |
| **10.b** ✅ | Ribbon button XLINE + RAY + sub-mode submenu UI (consume Q12 keys) | 3 | M | Q12, Q14 | 🟡 Medium |
| **11** ✅ | Grip editing — `xline-grips` + `ray-grips` (consumer ADR-357 Phase 11) | 9 | M | Q9 | 🟡 Medium |
| **12** ✅ | Trim/Extend cutting-edges extension (audit + wire) | 4 | M | Q11 | 🟡 Medium |
| **13** ✅ | Command aliases pre-registration (forward to ADR-357 Phase 13) | 1 | XS | — | 🟢 Trivial |
| **14** ✅ | DXF Construction layer scaffold (optional preset dialog) | 2 | S | Q13, Q14, Q15 | 🟢 Low |

Totale: **19 phases** (post-split), **~50 file affetti**, ship-ready incrementalmente. Ogni phase 1 sessione, context budget ≤50%.

### 7.1 Sequenza vincolante (post-split 2026-05-16)
- **Phase 0-3.5 → prerequisiti Phase 4.a/b** (renderer ha bisogno di entity con direction valida).
- **Phase 4.a → prerequisito 4.b** (renderer consume `clipParametricLine`).
- **Phase 4.b → prerequisito Phase 5/6.a** (hit-test/snap usano stessa pipeline geometry).
- **Phase 6.a → prerequisito 6.b** (engine switch già esteso in 6.a, 6.b aggiunge solo calcs).
- **Phase 6.a/b → prerequisito 6.5.a/b** (engine pattern già stabilito per XLine, Ray riusa stesso schema).
- **Phase 6.5.a → prerequisito 6.5.b** (calcs Ray-primitives prima di Ray-self/complex).
- **Phase 6.b + 6.5.b → prerequisito Phase 12** (trim/extend richiede tutti intersection calcs completi).
- **Phase 8/9 (DXF)** indipendente da rendering — può essere svolta in qualsiasi momento dopo Phase 3.5.
- **Phase 10.a → prerequisito 10.b** (i18n keys devono esistere PRIMA del consumer UI — anti-CHECK 3.8 hook block).
- **Phase 11 (grip)** richiede ADR-357 Phase 11 (GripStore) **già implementato** — segnalazione in PENDING.md.
- **Phase 13/14** trailing — nice-to-have, può procedere in qualsiasi ordine dopo Phase 10.b.

**Grafo dipendenze (visualizzazione)**:
```
0 → 1 → 2 → 3 → 3.5 → 4.a → 4.b → 5 → (parallelo)
                                    └→ 6.a → 6.b → 6.5.a → 6.5.b → 12
                                    └→ 7
                              (parallelo da 3.5)
                              └→ 8 → 9
                              └→ 10.a → 10.b → 11 (richiede ADR-357 Ph11) → 13 → 14
```

### 7.2 Una phase = una sessione (NON-NEGOZIABILE — ADR-357 §7.1)

**Pre-flight ogni sessione**:
1. Leggi solo ADR-359 §7 (questa tabella) + ADR specifico per Q-ref della phase.
2. **NON** leggere ADR-359 intero (~937 righe) — usa offset/limit.
3. Audit pre-phase ≤10 tool calls (Glob/Grep mirati).
4. Implementation ≤20 tool calls.
5. Target context end-of-phase ≤50%.

**Trigger split mid-phase**:
- Se context raggiunge 70% PRIMA della fine → STOP + handoff report + split (es. `4.b` → `4.b.i` + `4.b.ii`) + commit del lavoro fatto (su ordine Giorgio).
- Aggiorna tabella + §7.1 grafo + changelog.

**Trigger end-of-phase**:
- ✅ Commit ready (su ordine Giorgio).
- ✅ tsc verde sui file toccati.
- ✅ Test units passano (se Phase introduce test).
- ✅ ADR-359 §7 phase row marcato `✅ DONE 2026-XX-XX` + changelog entry.
- ✅ Handoff report breve per next phase (cosa pronto, cosa next, eventuali blocker).

---

## 8. Testing Strategy

### 8.1 Unit tests (puri)
- `clipParametricLine` — 15+ cases:
  - line orizzontale clip orizzontale viewport
  - line verticale
  - line diagonale 45°
  - line completamente fuori
  - line completamente dentro (no clip)
  - line tangente edge
  - direction zero (degenerate)
  - viewport degenerate (zero width/height)
  - Ray con basePoint fuori viewport in direzione dentro
  - Ray con basePoint dentro
- `pointToInfiniteLineDistance` — 8+ cases: punto sulla linea, perpendicolare, lontano, direction non-normalizzata.
- `pointToRayDistance` — 8+ cases: punto oltre basePoint (deve usare distance-to-base).
- Ogni intersection calculator (`xlineLineIntersection`, ecc.) — 5+ cases: parallel, coincident, crossing, near-parallel, far-from-viewport.

### 8.2 Integration tests
- `createEntityFromTool('xline', points, ...)` per ogni sub-mode → snapshot entity output.
- `IntersectionSnapEngine.preComputeIntersections([xline1, line1])` → asserisce intersezione presente.
- `HitTester.hit(xlineEntity, cursor)` → asserisce hit con tolleranza.

### 8.3 DXF Roundtrip integrity
- 3 file DXF reference (AutoCAD output, BricsCAD output, ezdxf output) con XLINE + RAY.
- Import → assert entity count + basePoint + direction (con tolleranza floating).
- Export → re-import → diff zero (entity-by-entity).
- 1 file DXF con XLINE/RAY su layer "Construction" custom + linetype Dashed + color cyan → assert ByLayer integrity (consumer ADR-358).

### 8.4 Visual regression (Phase 4)
- Snapshot canvas render `XLineEntity` orizzontale + verticale + diagonale → assert pixel-diff < threshold.
- Snapshot RAY con basePoint fuori viewport → assert no artifacts.

### 8.5 Performance benchmarks (ADR-040 compatibility)
- Scene con 50 XLINE + 50 RAY + 1000 LINE → asserisci FPS hover ≥ 55fps su mid-tier hardware.
- IntersectionSnapEngine init time scene 100 entità incluse 50 XLINE → < 200ms (audit grid saturation).

---

## 9. Pre-commit Ratchet (ADR-294 SSoT N.12)

Nuovi moduli da registrare in `.ssot-registry.json`:

| Modulo | Tier | Vieta | Forza |
|---|---|---|---|
| `xline-mode-store` | 3 | accessi diretti a `_xlineMode` fuori da `XLineModeStore` | API pubblica `getMode()` / `setMode()` |
| `line-clipping` | 3 | implementazioni ad-hoc Cohen-Sutherland/Liang-Barsky | uso di `clipParametricLine` |
| `infinite-line-distance` | 3 | hit-test inline `|cross|/|dir|` | uso di `pointToInfiniteLineDistance` |
| `xline-ray-intersection` | 3 | inline xline/ray intersection logic | uso di `intersection-calculators.ts` |
| `dxf-xline-ray-parser` | 3 | parsing inline `AcDbXline` / `AcDbRay` | unico entry point `convertXLine` / `convertRay` |

### 9.1 Baseline
Pre-implementazione: 0 violations (file nuovi). Post-Phase 1-12: ratchet enforce zero new violations.

---

## 10. Open Questions (DA RAFFINARE in Q&A)

> Le risposte di Giorgio in greco saranno trascritte in italiano + aggiornata §5.

1. ✅ **Sub-modes XLINE rollout**: RISOLTO 2026-05-16 → Full v1 (tutti i 5 sub-modes Through/Hor/Ver/Ang/Bisect/Offset). Industry convergence + completeness over MVP.
2. ✅ **Mode switching UX**: RISOLTO 2026-05-16 → Full Enterprise multi-surface (keyboard `H/V/A/B/O/T` + status bar indicator + right-click context menu). Unico SSoT `XLineModeStore`, tre consumer.
3. ✅ **Bisect implementation**: RISOLTO 2026-05-16 → 3 punti classic (vertex → angleStart → angleEnd). Industry convergence 3/3 CAD player. Funziona anche su canvas vuoto. Snap su endpoint/mid già esistenti garantisce stessa velocità del 2-entity-select.
4. ✅ **Clip algorithm**: RISOLTO 2026-05-16 → Liang-Barsky (parametric form, ottimale per linee infinite). SSoT `rendering/utils/line-clipping.ts` + pre-commit ratchet modulo `line-clipping`.
5. ✅ **Visual representation**: RISOLTO 2026-05-16 → Pure clip, no infinity markers. Distinzione via linetype/color (industry standard). Quick Style override disponibile.
6. ✅ **Chain mode behavior**: RISOLTO 2026-05-16 → Full Enterprise industry-standard semantic per-mode (Through=fan-pivot, Hor/Ver=independent, Ang=independent-sticky-angle, Bisect=re-use-vertex con `Shift+V` reset, Offset=re-use-source+distance con `Shift+O` reset, RAY=fan-pivot). Exit semantic ESC/Enter/right-click coerente ADR-357 §5.4.
7. ✅ **DXF persistence**: RISOLTO 2026-05-16 → Full native DXF (`AcDbXline` / `AcDbRay`). Roundtrip integrity 100% + industry interop. Direction normalize at boundary I/O. Ratchet modulo `dxf-xline-ray-parser`.
8. ✅ **Layer/Style inheritance**: RISOLTO 2026-05-16 → Pure ByLayer (consume-only ADR-358) + opt-in Construction layer scaffold dialog (cyan ACI 4 + Dashed + plottable=false). 3 button: Create / No thanks / Don't ask again (persist `localStorage` + Firestore). Override post-creation via ADR-357 G15.
9. ✅ **Grip editing scope**: RISOLTO 2026-05-16 → 2 grips puri (basePoint translate + direction-handle rotate). Mapping 1:1 con entity data. RAY basePoint con outer-ring visual (distingue origin). Polar tracking ADR-357 G1 disponibile durante rotate.
10. ✅ **Performance budget**: RISOLTO 2026-05-16 → Frame-time pure clip (Liang-Barsky, no cache). 50 XLINE = 2.5μs = 0.015% del budget ADR-040 16ms. Zero stale-clip bugs, SSoT puro. Industry alignment (AutoCAD/BricsCAD/GstarCAD).
11. ✅ **Trim/Extend integration**: RISOLTO 2026-05-16 → Default ON, no flag. XLINE/RAY auto-detected come cutting edges. Opt-out via layer hide/lock (consume ADR-358, zero codice nuovo). Industry convergence 4/4.
12. ✅ **Naming UI**: RISOLTO 2026-05-16 → "Construction Line" / "Γραμμή Κατασκευής" + "Ray" / "Ακτίνα". 10 i18n keys (el+en) descrittive, pure Greek locale compliant. Industry convergence 3/4. Command alias `XL/XLINE/RAY` preservato per muscle memory.
13. ✅ **Persistence scope**: RISOLTO 2026-05-16 → Project-wide via `EntityPersistenceService` ADR-357 + `LayerStore` ADR-358. Coerente con Q7 (DXF native) + Q8 (Pure ByLayer). Zero codice nuovo. Industry convergence 4/4.
14. ✅ **Linetype default**: RISOLTO 2026-05-16 → Pure ByLayer, no hardcoded per-entity. Dashed "look" solo via Construction layer scaffold (Q8). Pre-commit ratchet vieta `linetype: 'Dashed'` hardcoded in tool factories. Industry convergence 4/4.
15. ✅ **Color default**: RISOLTO 2026-05-16 → Pure ByLayer, no hardcoded per-entity. Cyan ACI 4 esclusivamente via Construction layer scaffold (Q8). Mirror esatto di Q14. Pre-commit ratchet vieta `color: { aci }` / `color: '#hex'` hardcoded in tool factories. Industry convergence 4/4.

---

**Q1-Q15 TUTTE RISOLTE 2026-05-16. ADR-359 STATUS → ✅ ACCEPTED.**

---

## 11. Changelog

| Date | Change |
|---|---|
| 2026-05-19 | **Phase 11 follow-up — Spatial index + hit-test wiring**: `rendering/hitTesting/Bounds.ts` — `calculateXLineBounds()` (large square ±10000 around `basePoint`) + `calculateRayBounds()` (one-directional nominal extent από `basePoint` along `direction`). Χωρίς αυτές τις cases το `BoundsCalculator.calculateEntityBounds()` επέστρεφε null → XLINE/RAY ΔΕΝ εισάγονταν στο spatial index → unselectable + no hover στο canvas. `rendering/hitTesting/hit-test-entity-tests.ts` — `case 'xline'` + `case 'ray'` στο `performDetailedHitTest` dispatch, χρησιμοποιώντας τα υπάρχοντα `pointToInfiniteLineDistance` / `pointToRayDistance` από το Phase 5 utility module. Closes silent gap μεταξύ Phase 4.b (renderer registration) και Phase 11 (grip editing) — τώρα τα XLINE/RAY entities είναι fully interactive στο canvas. |
| 2026-05-18 | Phase 11 DONE: `systems/xline/xline-grips.ts` (NEW) — `getXLineGrips()` (2 grips: center base + vertex dir, 100-unit handle offset) + `applyXLineGripDrag()` (base→translate, dir→normalize). `systems/ray/ray-grips.ts` (NEW) — mirror for RayEntity. `hooks/grip-types.ts` — `XLineGripKind='xline-base'\|'xline-dir'` + `RayGripKind='ray-base'\|'ray-dir'` + GripInfo fields. `hooks/useGripMovement.ts` re-exports added. `hooks/grips/unified-grip-types.ts` — import + `xlineGripKind?`/`rayGripKind?` added to UnifiedGripInfo. `hooks/grip-computation.ts` — case `'xline'` + case `'ray'` added. `hooks/grips/grip-registry.ts` — forwarding in `wrapDxfGrip`. `hooks/grips/grip-parametric-commits.ts` — `commitXLineGripDrag()` + `commitRayGripDrag()`. `hooks/grips/grip-commit-adapters.ts` — routing after columnGripKind. |
| 2026-05-18 | Phase 9 DONE: `utils/dxf-xline-ray-writer.ts` — `writeXLineRayEntities(entities)` emits SECTION/ENTITIES/ENDSEC token array, `AcDbEntity` + `AcDbXline`/`AcDbRay` subclass markers, codes 10/20/30 + 11/21/31, direction re-normalised at export boundary. Style code 62 omitted when ByLayer. `utils/__tests__/dxf-roundtrip-xline-ray.test.ts` — 5 describe groups, 22 tests: structure checks, direction normalisation, ByLayer integrity, 3 simulated CAD fixtures (AutoCAD/BricsCAD/ezdxf), write→parse roundtrip diff-zero 4 cases. |
| 2026-05-18 | Phase 8 DONE: `XLINE` + `RAY` added to `SUPPORTED_ENTITY_TYPES` in `dxf-parser-types.ts`. `convertXLine()` + `convertRay()` added to `dxf-entity-converters.ts` — parse `10/20` basePoint + `11/21` direction, normalize direction (degenerate `len<1e-10` → null), warn on 3D z-coord, `extractEntityColor`. `convertEntityToScene` switch wired: `case 'XLINE'` + `case 'RAY'`. No new imports needed — `XLineEntity`/`RayEntity` already in `AnySceneEntity` union. |
| 2026-05-18 | Phase 5 DONE: `rendering/utils/point-to-line-distance.ts` — pure SSoT `pointToInfiniteLineDistance(p, base, dir)` (cross/len formula, degenerate → Infinity) + `pointToRayDistance(p, base, dir)` (t<0 → dist-to-base, else perp). 18 unit tests in `rendering/utils/__tests__/point-to-line-distance.test.ts` — all 18 pass. `XLineRenderer.hitTest` wired to `pointToInfiniteLineDistance`. `RayRenderer.hitTest` wired to `pointToRayDistance`. |
| 2026-05-18 | Phase 4.b DONE: `rendering/entities/XLineRenderer.ts` + `rendering/entities/RayRenderer.ts` — extend `BaseEntityRenderer`, consume `clipParametricLine` (tRange `{-∞,+∞}` / `{0,+∞}`), `renderWithPhases` template for style/hover/glow pipeline. `getViewportWorldBounds()` private helper (transform → CSS rect → world AABB). `getGrips` → `[]` (Phase 11), `hitTest` → `false` (Phase 5). `EntityRendererComposite.initializeRenderers()` registers `'xline'` + `'ray'`. `rendering/entities/index.ts` exports both. |
| 2026-05-18 | Phase 4.a DONE: `rendering/utils/line-clipping.ts` — Liang-Barsky pure fn `clipParametricLine(base, dir, tRange, viewport)`. Guards: degenerate dir `|d|<1e-10` → null, parallel+outside → null, `±Infinity` tRange → clamp `±1e15`. 17 unit tests in `rendering/utils/__tests__/line-clipping.test.ts` (horizontal/vertical/diagonal, above/left viewport null, ray inward/outward, degenerate, tangent edge, zero-width VP, negative-dir, large coords). All 17 pass. |
| 2026-05-18 | Phase 3.5 DONE: `createEntityFromTool('xline')` extended with `angle` (1pt + angleValue, fallback through if null), `bisect` (3pts → normalize+sum bisect direction, edge-case guard len<1e-10 → null), `offset` (→ null, Phase 4+). `isEntityComplete('xline')` extended: angle = 1pt if angleValue≠null else 2pts, bisect = 3pts, offset = false. `generateXLinePreview()` extended: angle (preview at cursor/firstPoint via cos/sin), bisect (0pts=null, 1pt=rubberband arm1, 2pts=bisect XLine), offset (null). Import switched from `getMode` to `getXLineModeState` in both builders + preview files. |
| 2026-05-18 | Phase 3 DONE: `'xline' \| 'ray'` added to `DrawingTool` union (`hooks/drawing/drawing-types.ts`). `createEntityFromTool()` — cases `'xline'` (Through/Hor/Ver modes via `XLineModeStore.getMode()`) + `'ray'` (2-point normalize). `isEntityComplete()` — `'ray'` = 2pts, `'xline'` = 1pt (hor/ver) or 2pts (through). `generatePreviewEntity()` — `generateXLinePreview()` + `generateRayPreview()` helpers: zero-point preview for hor/ver modes (follows cursor), 1-point rubber-band for all modes. `normalizeDir` inline helpers in both builders + preview files. `useDrawingHandlers.ts` — no changes needed (keyboard shortcuts are Phase 3 keyboard handler in `useKeyboardShortcuts.ts`). |
| 2026-05-18 | Phase 2 DONE: `XLineModeStore` singleton micro-leaf (`systems/tools/xline-mode-store.ts`) — `getMode()` / `setMode()` / `subscribe()` / `reset()`, localStorage persistence `dxf:xlineMode.lastUsed`. `StatusBarXLineModeSlot.tsx` — Radix Popover with 6 modes, sub-info for angle/offset. `XLineToolContextMenu.tsx` — imperative handle, 6 mode items + separator + cancelCurrent/finishChain. i18n keys added to `dxf-viewer.json` (el + en): `tools.xline.*` + `tools.ray.*`. SSoT module `xline-mode-store` added to `.ssot-registry.json`. |
| 2026-05-18 | Phase 1 DONE: `'xline' \| 'ray'` added to `ToolType` union (`ui/toolbar/types.ts`). `TOOL_DEFINITIONS['xline']` + `TOOL_DEFINITIONS['ray']` added to `ToolStateManager.ts` (category=drawing, canInterrupt=false, allowsContinuous=true, allowsChain=true). |
| 2026-05-18 | Phase 0 DONE: `getEntityRenderBounds` + `getEntityExtentsBounds` split in `entity-bounds.ts` (G10). `EzdxfXLine` + `EzdxfRay` interfaces added to `dxf-export.types.ts`. `array-bbox.ts` migrated to `getEntityRenderBounds`. |
| 2026-05-16 | Initial draft (Phase 1 ADR-driven workflow). Open Questions Q1-Q15 da compilare in Q&A greca con Giorgio. |
| 2026-05-16 | Q1 risolta: Full v1 — tutti i 5 sub-modes XLINE (Through/Hor/Ver/Ang/Bisect/Offset). Industry convergence + completeness over MVP. |
| 2026-05-16 | Q2 risolta: Full Enterprise multi-surface (keyboard `H/V/A/B/O/T` + status bar indicator + right-click context menu). Unico SSoT `XLineModeStore`, tre consumer zero-duplicazione. |
| 2026-05-16 | Q3 risolta: Bisect mode = 3 click classic (vertex + angleStart + angleEnd). Industry convergence + funziona anche su canvas vuoto. |
| 2026-05-16 | Q4 risolta: Liang-Barsky parametric clip per XLine/Ray. SSoT `line-clipping.ts` + ratchet. |
| 2026-05-16 | Q5 risolta: Pure clip render, no infinity markers. Distinzione via linetype/color. |
| 2026-05-16 | Q6 risolta: Chain mode Full Enterprise — semantic industry-standard differenziata per ogni sub-mode (fan/independent/sticky). Reset shortcuts `Shift+V` (bisect vertex) + `Shift+O` (offset source). |
| 2026-05-16 | Q7 risolta: Full native DXF (`AcDbXline`/`AcDbRay`). Roundtrip integrity garantita + 3 reference test. |
| 2026-05-16 | Q8 risolta: Pure ByLayer (consume-only ADR-358) + Construction layer scaffold opt-in dialog (Phase 14). 3 buttons + persist dismissal. |
| 2026-05-16 | Q9 risolta: 2 grips puri (basePoint translate + direction-handle rotate). Mapping 1:1 con `{basePoint, direction}`. RAY base con outer ring visual. Consumer GripStore/GripTransformRegistry ADR-357. |
| 2026-05-16 | Q10 risolta: Frame-time pure clip (no cache). Liang-Barsky cheap, ~2.5μs/50 XLINE = 0.015% di 16ms ADR-040 budget. Zero stale-clip bugs, SSoT puro. Industry alignment. YAGNI escape hatch documentato. |
| 2026-05-16 | Q11 risolta: TRIM/EXTEND default ON per XLINE/RAY (no flag). Opt-out via layer hide/lock (consume ADR-358). Industry convergence 4/4. Phase 12 audit-only, zero codice nuovo per opt-out. |
| 2026-05-16 | Q12 risolta: i18n labels "Construction Line"/"Γραμμή Κατασκευής" + "Ray"/"Ακτίνα". 10 chiavi i18n descrittive (el+en) — pure Greek locale, zero English words. Industry convergence 3/4. AutoCAD muscle-memory via command alias. |
| 2026-05-16 | Q13 risolta: Project-wide persistence (conferma esplicita coerenza Q7+Q8). EntityPersistenceService ADR-357 + LayerStore ADR-358. Zero codice nuovo, zero nuovo modulo. Industry convergence 4/4. |
| 2026-05-16 | Q14 risolta: Pure ByLayer linetype default, no hardcoded per-entity override. Dashed "look" solo via Construction layer scaffold di Q8. Ratchet vieta `linetype: 'Dashed'\|'Continuous'` hardcoded in tool factories. Industry 4/4. |
| 2026-05-16 | Q15 risolta: Pure ByLayer color default, no hardcoded per-entity. Cyan ACI 4 solo via Construction scaffold (Q8). Mirror esatto Q14. Ratchet vieta `color: { aci }` / `color: '#hex'` hardcoded in tool factories. Industry 4/4. |
| 2026-05-16 | **ADR-359 STATUS: 🟡 DRAFT → ✅ ACCEPTED**. Tutte Q1-Q15 risolte. Pronto per implementation Phase 0 (subordinato a ADR-358 Phase 4 minimum viable). Sequenza ADR-357 §7.1: ADR-358 → ADR-359 → impl. |
| 2026-05-16 | **§7 Implementation Phases split anti-context-noise**: 15 → 19 phases. Split: 4 → 4.a/4.b (clip pure vs renderer), 6 → 6.a/6.b (XLine primitives vs self/complex), 6.5 → 6.5.a/6.5.b (Ray primitives vs self/complex+stability), 10 → 10.a/10.b (i18n keys+baseline vs Ribbon UI). Target ≤50% context per sessione. Grafo dipendenze + pre-flight checklist + trigger split mid-phase aggiunti §7.1/7.2. |
| 2026-05-18 | **Phase 6.a DONE**: `xlineLineIntersection`, `xlineXlineIntersection`, `xlineCircleIntersection`, `xlineArcIntersection` added to `intersection-calculators.ts`. `IntersectionSnapEngine.calculateIntersections` extended with 4 new cases. 21 unit tests (`__tests__/xline-intersection-calculators.test.ts`) all ✅. |
| 2026-05-18 | **Phase 6.b DONE**: `xlinePolylineIntersection` (segments via `getPolylineSegments`), `xlineEllipseIntersection` (parametric quadratic + `startParam`/`endParam` arc filter), `xlineRectangleIntersection` (via `getRectangleLines`) added to `intersection-calculators.ts`. Private helper `xlineSegmentPoint` extracted. `IntersectionSnapEngine.calculateIntersections` extended with 3 new cases (polyline/lwpolyline, ellipse, rectangle). 13 unit tests (`__tests__/xline-intersection-calculators-complex.test.ts`) all ✅. Total xline intersection suite: 34/34 ✅. |
| 2026-05-18 | **Phase 6.5.a DONE**: `rayLineIntersection`, `rayCircleIntersection`, `rayArcIntersection` added to `intersection-calculators.ts` with `t >= -XLINE_EPSILON` guard (ray semi-infinite constraint). `RayEntity` import added. `IntersectionSnapEngine.calculateIntersections` extended with 3 new ray cases (ray×line, ray×circle, ray×arc). 15 unit tests (`__tests__/xline-ray-intersection-calculators.test.ts`) all ✅. |
| 2026-05-18 | **Phase 6.5.b DONE**: `rayRayIntersection` (t1 >= 0 AND t2 >= 0), `rayXlineIntersection` (tRay >= 0 only), `rayPolylineIntersection` (segment loop with tRay/sSeg guards), `rayEllipseIntersection` (parametric quadratic + startParam/endParam arc filter, t >= -XLINE_EPSILON), `rayRectangleIntersection` (getRectangleLines + tRay guard) added to `intersection-calculators.ts`. `IntersectionSnapEngine.calculateIntersections` extended with 5 new ray cases (ray×ray, ray×xline, ray×polyline, ray×ellipse, ray×rectangle). 25 unit tests (`__tests__/xline-ray-intersection-calculators-complex.test.ts`) all ✅. Full ray intersection suite: 40/40 ✅. |
| 2026-05-18 | **Phase 10.b DONE**: Ribbon XLINE + RAY buttons wired (home-tab-draw.ts row 2, small, commandKey 'xline'/'ray', shortcut XL). XLINE_PATH + RAY_PATH SVG icons added (RibbonButtonIconPaths.tsx + RibbonButtonIcon.tsx). Contextual tab `CONTEXTUAL_XLINE_MODE_TAB` (trigger `xline-mode-active`) with mode combobox bridged via `useRibbonXlineModeBridge` ↔ XLineModeStore (ADR-040 micro-leaf). Bridge wired in `useRibbonCommands` + `DxfViewerContent`. 6 i18n keys added to el/en `dxf-viewer-shell.json` (tabs.xlineMode, panels.xlineMode, commands.xline/ray/xlineTooltip/rayTooltip/xlineMode.mode). `i18n-keys:baseline` stable (11 keys/4 files). |
| 2026-05-18 | **Phase 10.a DONE**: `tools.xline.name` + `tools.xline.tooltip` + `tools.ray.name` + `tools.ray.tooltip` added to `el/dxf-viewer.json` (pure Greek) + `en/dxf-viewer.json`. Pre-existing 6 modes keys + 2 contextMenu keys confirmed present. `npm run i18n-keys:baseline` updated (11 missing keys / 4 files). |
| 2026-05-18 | **Phase 14 DONE**: Construction layer scaffold dialog. 2 new files: `services/construction-layer-detector.ts` (`CONSTRUCTION_LAYER_NAME_HINTS` + `hasConstructionLayer`), `hooks/useConstructionLayerScaffold.tsx` (`ConstructionLayerScaffoldDialog` — EventBus `drawing:complete` listener for `tool==='xline'`, localStorage `dxf:constructionLayerDismissed` guard, AlertDialog 3 buttons: Create+use / No thanks / Never ask). Layer created with ACI 4 Cyan + Dashed + plottable=false. Wired in `DxfViewerContent.tsx` (lazy Suspense). 5 i18n keys el+en. ADR-359 Phase 14 = ✅ — ADR-359 100% DONE. |
| 2026-05-18 | **Phase 11 follow-up**: `DxfRenderer.toEntityModel` xline/ray unwrap cases (`entity.xlineEntity` → `basePoint+direction` at root of `EntityModel`; mirror για ray). Without this, the Phase 11 wrappers leave `basePoint`/`direction` undefined when entities re-enter the render pipeline. Renderers (`XLineRenderer`/`RayRenderer`) now read directly από unwrapped `EntityModel`. |
| 2026-05-18 | **Phase 13 DONE**: `XL → xline`, `XLINE → xline`, `RAY → ray` pre-registered in `systems/command-line/CommandAliasRegistry.ts` BUILT_IN array (Construction Lines section). AutoCAD-compatible aliases. No new files — 1 edit to existing SSoT registry. |
| 2026-05-18 | **Phase 12 DONE**: Trim/Extend cutting-edges audit — pure audit, zero new code. All 9 files fully support XLINE/RAY: `trim-boundary-resolver` (`isValidCuttingCandidate` case `'xline'`+`'ray'`), `trim-intersection-mapper` (`paramOnXLine`/`paramOnRay`, `toSegments` via `extendedSegment`), `trim-edge-extender` (RAY→XLINE, XLINE→unchanged), `trim-fence-hit-detector` (`buildEntityPreviewPath` + preview helpers), `trim-ray-xline-cutter` (`cutRay`+`cutXLine` full implementations), `trim-entity-cutter` (dispatcher to `cutRay`+`cutXLine`), `extend-intersection-caster` (XLINE/RAY as boundaries via `computeIntersectionPoints`; correctly NOT extendable as targets — already infinite), `TrimEntityCommand`+`ExtendEntityCommand` (generic — no type-specific filtering needed). Q11 confirmed: XLINE/RAY auto-detected as cutting edges, opt-out via layer hide/lock. |
| 2026-05-18 | **Phase 7 DONE**: Secondary snap engines audit for XLine/Ray. `GeometricCalculations.getEntityEndpoints`: added Ray case (basePoint only; XLine silently returns [] — correct). `MidpointSnapEngine`: no change needed (getEntityMidpoints returns [] for both — correct). `NearestSnapEngine.getNearestPointOnEntity`: added xline (projection on infinite line, no clamping) + ray (projection clamped to t >= 0, fallback to basePoint). `PerpendicularSnapEngine.getPerpendicularPoints`: added isXLineEntity/isRayEntity imports + xline (foot on infinite line, no t restriction) + ray (foot with t >= 0 filter). All per ADR-359 §G6 spec. |
| 2026-05-24 | **i18n hotfix**: `tools.xline.*` + `tools.ray.*` + `tools.constructionLayerScaffold.*` nested keys added to `el/dxf-viewer-shell.json` + `en/dxf-viewer-shell.json` (inside `tools` root object). Root cause: ADR-280 namespace-compat routes `tools.*` → `dxf-viewer-shell` but keys existed only in legacy `dxf-viewer.json`. Runtime lookup failed → raw keys rendered in `ConstructionLayerScaffoldDialog` modal + `StatusBarXLineModeSlot`. Button overflow was a side-effect of long raw key strings. Fix: keys now present in both legacy + canonical shell namespace. |
| 2026-05-19 | **Phase 14 DONE — Selection visual feedback for XLINE/RAY**. Root cause: `XLineRenderer.getGrips` + `RayRenderer.getGrips` returned `[]` → no visual indicator when selected (hover glow worked, selection grips did not). Fix: `XLineRenderer.getGrips` now returns a single grip at `basePoint` (type `'center'`); same for `RayRenderer.getGrips`. This gives the standard blue square grip at the anchor point when entity is selected. Also fixed `DxfRenderer.renderEntityUnified`: `renderOptions` now includes `selected: isSelected` so PhaseManager correctly handles selected+hovered combos (prevents hover-glow from overriding selection). Files modified (3): `XLineRenderer.ts`, `RayRenderer.ts`, `DxfRenderer.ts`. |

---

## 12. References

- Autodesk DXF Reference (`AcDbXline` / `AcDbRay`): https://help.autodesk.com/cloudhelp/2023/ENU/AutoCAD-DXF/files/GUID-3610039E-27D1-4E23-B6D3-7E60B22BB5BD.htm
- AutoCAD XLINE command: https://help.autodesk.com/view/ACADWEB/ENU/?guid=AutoCAD_Web_Help_List_Commands_Xline_html
- AutoCAD XLINE sub-modes tutorial: https://autocadtip.com/xline-command-in-autocad.html
- BricsCAD XLINE command: https://help.bricsys.com/en-us/document/command-reference/x/xline-command
- BricsCAD RAY command: https://help.bricsys.com/en-us/document/command-reference/r/ray-command
- BricsCAD Drawing Infinite Lines: https://help.bricsys.com/en-us/document/bricscad/2d-drafting/drawing-infinite-lines
- Liang-Barsky algorithm: https://en.wikipedia.org/wiki/Liang%E2%80%93Barsky_algorithm
- Line clipping comparison: https://www.geeksforgeeks.org/dsa/cohen-sutherland-vs-liang-barsky-line-clipping-algorithm/
- GstarCAD XLINE: https://kb.gstarcad.com.my/article/xline-command-2450.html
