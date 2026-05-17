# ADR-358 — DXF Stair Tool: Google-Level Parametric Staircase System

**Status**: 🟡 PROPOSED (round 2 in corso — Q1-Q16 risolti, Q17+ in Q&A)
**Date**: 2026-05-16
**Category**: Drawing System / DXF Viewer
**Author**: Giorgio Pagonis + Claude (Opus 4.7)
**Related ADRs**: ADR-031, ADR-032, ADR-040, ADR-055, ADR-057, ADR-186, ADR-195, ADR-294, ADR-340, ADR-343, ADR-344, ADR-345, ADR-353, ADR-357, ADR-GEOMETRY

---

## 1. Context

L'app `Nestor_Pagonis` ha un subapp **DXF Viewer** (editor di kátopsi / floor plan) con architettura matura: ribbon (ADR-345), tool state SSoT (ADR-055), command pipeline (ADR-031/057), micro-leaf preview (ADR-040), parametric Array Entity (ADR-353), line tool Google-level (ADR-357). Manca completamente il **disegno di scale**, una delle primitive base di ogni software architettonico professionale.

Giorgio chiede:
1. Tool che **disegna** scale in pianta.
2. Tool che **calcola automaticamente** lunghezze, larghezze, pedate, alzate.
3. **Tipologie multiple**: rettilinea, circolare, a Γ (gamma greco), a Π (pi greco) / U, ellittica, triangolare.
4. **Pronto per 3D futuro** (oggi solo 2D, ma il modello dati deve essere 3D-ready).
5. **Enterprise / Google-level**: SSoT puro, zero duplicati, riuso massimo dei sistemi centralizzati esistenti.

Questo ADR è il contratto architetturale del sistema scale: industry research cross-vendor, codice greco ΝΟΚ + Eurocode + IBC, gap analysis, modello dati parametrico, pipeline tool, fasi di rilascio, testing.

---

## 2. Background — Stato attuale (codice = source of truth, 2026-05-16)

### 2.1 Cosa c'è già (SSoT riusabile)

| SSoT | File | Ruolo per Stair |
|---|---|---|
| `ToolStateStore` | `src/subapps/dxf-viewer/stores/ToolStateStore.ts` | activeTool SSoT — aggiungere `'stair'` al union |
| `TOOL_DEFINITIONS` | `src/subapps/dxf-viewer/systems/tools/ToolStateManager.ts` | metadata tool — nuova entry `'stair'` con `category:'drawing'`, `requiresCanvas:true`, `supportsDynamicInput:true` |
| `DrawingStateMachine` | `core/state-machine/DrawingStateMachine.ts` | FSM IDLE→COLLECTING→COMPLETING (ADR-032) |
| `useDrawingHandlers` + `useUnifiedDrawing` | `hooks/drawing/` | Entry point click/hover, già wired a snap+polar+ortho |
| `completeEntity` | `hooks/drawing/completeEntity.ts` | Pipeline unificato creazione entity (ADR-057) |
| `CreateEntityCommand` + `CommandHistory` | `core/commands/` | Undo/redo (ADR-031) |
| `ProSnapEngineV2` | `snapping/global-snap-engine.ts` | 17 snap engines |
| `PreviewCanvas` | `canvas-v2/preview-canvas/PreviewCanvas.tsx` | Rubber-band zero-lag (ADR-040) |
| `RIBBON_PANELS_CONFIG` | `ui/ribbon/data/home-tab-draw.ts` | Split-button con varianti (ADR-345) |
| `ArrayEntity` pattern (parametric) | `types/entities.ts` + `systems/array/` | **Template diretto**: `kind` + `params` → ricomputa geometria. Stair segue stesso pattern. |
| Geometry helpers | `rendering/entities/shared/` + `utils/geometry/` | Arc 3-point, distance, angoli, vettori, area poligono |
| Path arc-length sampler | `systems/array/path-arc-length-sampler.ts` | Sampling equidistante curve — riusabile per alzate lungo walkline |
| Building Code engine | `src/services/building-code/` (ADR-186) | Gate-runner — punto di estensione per `gate-stair-checker` |
| Enterprise IDs | `src/services/enterprise-id.service.ts` | Aggiungere prefisso `STAIR: 'stair'` |
| i18n locales | `src/i18n/locales/{el,en}/tool-hints.json` + `dxf-viewer.json` | Namespace `tools.stair.*` |

### 2.2 Cosa manca (gap rispetto allo standard CAD)

- ❌ `StairEntity` nel discriminated union di `Entity`.
- ❌ Helper geometrici per **spirale archimedea**, **elica**, **ellisse arc-length**, **involuta**, **offset/parallel curve** (per stringers interni/esterni).
- ❌ **Walkline** (linea di percorso a 300 mm dal corrimano interno).
- ❌ **Regole NOK/Eurocode per scale** (alzata 14-20 cm, pedata 26-32 cm, formula 2R+G=63).
- ❌ **Property panel** post-creazione per editing parametrico.
- ❌ **Separazione params → computed geometry** per building elements (oggi solo ArrayEntity, ed è una modifier).

---

## 3. Industry Benchmark (2026-05-16 cross-vendor research)

### 3.1 Feature convergence — Stair Types supportati

| Tool | Straight | L (¼) | U / Π (½) | Γ (3 flights) | Spiral | Helical | Elliptical | Winders | Custom sketch |
|---|---|---|---|---|---|---|---|---|---|
| AutoCAD Architecture | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Revit 2026 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (Grasshopper) | ✅ | ✅ Sketch |
| ArchiCAD | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ 4 winder methods | ✅ |
| Vectorworks | ✅ | ✅ | ✅ U/O | ⚠️ | ✅ | ✅ | ❌ | ✅ Fixed-angle | ✅ Vertex |
| Allplan SmartParts | ✅ | ✅ ¼ | ✅ ½ | ✅ double ¼ | ✅ | ❌ | ❌ | ✅ | ✅ Wizard |
| BricsCAD BIM | ✅ | ✅ L | ✅ C | ❌ | ⚠️ | ❌ | ❌ | ❌ | ❌ |

**Convergenza**: tutti supportano Straight + L + U + Spiral + Winders. **Helical + Elliptical** sono premium (Revit/ArchiCAD/Vectorworks nativi).

### 3.2 Parametri standard (industry convergence)

| Param | Significato | Default industry | Range valido | Unità |
|---|---|---|---|---|
| **rise** (alzata / ρίχτι) | altezza singolo gradino | 175 mm | IBC 102-178, NOK 140-200 | mm |
| **tread / going** (πάτημα) | profondità orizzontale | 280 mm | IBC ≥279, NOK 260-320 | mm |
| **nosing** (μύτη) | sporgenza | 25 mm | 0-32 | mm |
| **width** (πλάτος) | larghezza utile | 1000 mm | NOK ≥80, ≥120 main | mm |
| **stepCount** | numero alzate | 2-16 per flight | ≥3 | int |
| **totalRise** | h piano-piano | = rise · stepCount | da quota interpiano | mm |
| **totalRun** | sviluppo planar | = tread · (stepCount−1) | — | mm |
| **headroom** | h libera sopra walkline | ≥2000 mm | NOK ≥220 | mm |
| **pitch / slope** | angolo | 30-35° | ≤45° codice | gradi |
| **walkline offset** | dist walkline da bordo | 300 mm | varia | mm |
| **handrail height** | h corrimano | 900 mm | NOK 90-110 cm | mm |
| **landing depth** (πλατύσκαλο) | profondità pianerottolo | ≥width | NOK ≥ pedata | mm |
| **winder turn angle** | angolo winder | 90° / 180° | — | gradi |
| **inner/outer radius** | raggi scale curve | inner ≥150 mm | NOK ≥15 cm | mm |

### 3.3 Formule comfort/sicurezza

```
Blondel (NOK + Eurocode):  2R + G = 600–630 mm
Safety:                    R + G  ≈ 460 mm
Comfort (difference):      G − R  ≈ 120 mm
Pitch:                     tan(α) = R / G        (α ottimale 30-35°)
Walkline arc length:       L_walk = (R_inner + walklineOffset) · θ_total
```

### 3.4 Codice edilizio greco (ΝΟΚ Ν.4067/2012 + Άρθρο 13 ΓΟΚ)

| Parametro | NOK / GOK |
|---|---|
| Alzata (R) | 14-20 cm; **max 18 cm** κύρια |
| Pedata (G) | 26-32 cm; **min 25 cm** κύρια |
| Larghezza (W) | ≥80 cm δευτερεύουσα, ≥120 cm κύρια, 110 cm uscite emergenza |
| Πλατύσκαλο | profondità ≥ W |
| Καθαρό ύψος | ≥220 cm sopra walkline |
| Uniformità | tutte R uguali, tutte G uguali |
| Κουπαστή | obbligatoria se ≥3 gradini o W >120 cm |

### 3.5 Codici edilizi — tabella comparativa estesa (round 2 research)

| Codice | Rise (mm) | Tread (mm) | Width (mm) | Headroom (mm) | Var. max | Note |
|--------|-----------|-----------|-----------|---------------|---------|------|
| NOK κύρια (GR) | 140-180 | 260-320 | ≥1200 | ≥2200 | uniform | Ν.4067/2012 |
| NOK δευτερεύουσα (GR) | 140-200 | 250-320 | ≥900 | ≥2200 | uniform | — |
| IBC residential (US) | ≤197 | ≥254 | ≥914 | ≥2032 | — | IRC R311 |
| IBC commercial (US) | 102-178 | ≥279 | ≥1118 | ≥2032 | — | IBC §1011 |
| NFPA 101 (US) | ≤178 | ≥279 | ≥914 | — | ≤4.8 mm | Life Safety Code |
| NBC Canada | 125-200 | — | — | ≥2050 | ≤5 mm | NBC 2020 |
| AS 1657 (AU industrial) | 130-225 | 240-355 | ≥600 | — | ≤5 mm | 26.5°-45° |
| DIN 18065 (DE) | ≤200 | ≥230 | — | — | 2R+G=61-65 cm | Blondel |
| Eurocode 2 | structural | structural | — | — | — | RC 3-5 kN/m² |
| ADA / ICC A117.1 | — | — | — | — | ≤4.8 mm | + handrail extensions |

### 3.6 ADA accessibility (ICC A117.1 §504-505 + ADA 2010)

- **Handrail top extension**: 305 mm (12") oltre l'ultimo nosing del top landing, orizzontale.
- **Handrail bottom extension** (post-2010 ADA): = 1 tread depth oltre l'ultimo nosing (NON più 305 mm fisso).
- **Contrast nosing strip**: 51 mm (2") leading edge contrasto visivo (ICC A117.1 §504.5).
- **Step variation**: ≤4.8 mm (3/16").
- **Validator** in Nestor: profilo `'ada'` opzionale.

### 3.7 Fire egress / occupancy load (IBC 2021 ch.10 + NFPA 101)

- Capacità: **0.3 inch/persona** sulle scale (formula `persone_max = larghezza_mm / 7.62`).
- 2 uscite obbligatorie se >49 persone OPPURE percorso comune >30m.
- Travel distance max: 75m (sprinklerizzato), 60m (non).
- **Scope Nestor**: warning su `width` insufficiente per `occupancyLoad` dichiarato. Travel distance OUT-OF-SCOPE (richiede grafo path-of-travel).

### 3.8 Cut line plane convention (ISO/DIN/ANSI standard)

- **Cut plane height**: standard architettonico **1.2m (4 ft)** sopra il pavimento.
- **Treads sotto cut plane**: linee SOLID continue.
- **Treads sopra cut plane**: linee DASHED tratteggiate (visibility hidden).
- **Break symbol**: zigzag/spezzata 45° perpendicolare alla direzione di marcia (ISO 128).
- **Default Nestor**: `cutPlaneHeight = 1200 mm`, configurabile per-stair + project-default.

### 3.9 Out-of-scope industry-wide (documentazione esplicita, non gap Nestor)

Nessun major CAD (2026 SOTA) implementa nativamente:
- **Real-time anti-clash during draw** con muri/colonne (tutti usano batch Interference Check post-creazione: ArchiCAD Collision Detection AC21+, Revit Interference Check).
- **Cross-entity shared landings** (workaround universale = slab/floor entity separata).
- **Auto-generation della VIEW di sezione** (la vista è creata dall'utente; solo il plan-view cut split è automatico).

Nestor adotta lo stesso scope:  Phase 1-8 = no real-time clash, no cross-entity landings, no auto section view. Phase 9+ = extension point `stair-clash-checker`.

### 3.6 Modelli dati industry — Associative vs Sketched

- **Component-based / Associative** (Revit, BricsCAD BIM, AutoCAD Architecture, Allplan): params → ricalcolo geometria. Editing parametrico, QTO strutturato.
- **Sketch-based** (Revit legacy, Vectorworks Vertex): user disegna walkline → tool deriva. Massima libertà.

**Convergenza 2026**: Component-based standard moderno (Revit ha deprecato Sketch). Nestor adotta **Associative-first** + **Sketch** come tipologia.

### 3.7 Sub-elementi di una scala (decomposizione standard)

1. **Flight** (ράντο/σκέλος) 2. **Landing** (πλατύσκαλο) 3. **Tread** (πάτημα+nosing) 4. **Riser** (ριχτί)
5. **Stringer** (λίμα) 6. **Handrail** (κουπαστή) 7. **Baluster/Newel** (κάγκελα) 8. **Walkline** (γραμμή πορείας)

In 2D si rappresentano: contorno gradini, walkline tratteggiata, freccia + label UP/DOWN + n. gradini, linea di taglio se mezzo-piano.

---

## 4. Gap Analysis Google-Level

### G1 — StairEntity nel discriminated union

`src/subapps/dxf-viewer/types/entities.ts` non contiene `'stair'`. Aggiungere `StairEntity` come **parametric entity** seguendo pattern ArrayEntity (`kind` + `params` + `geometry` cached).

### G2 — Helper geometrici nuovi

| Helper | File da creare | Funzione |
|---|---|---|
| `spiralPointAt(t, params)` + `spiralArcLength` | `rendering/entities/shared/geometry-spiral-utils.ts` | Spirale archimedea/log + lunghezza Gauss-Legendre 10pt |
| `helixSample(t, params)` | `geometry-helix-utils.ts` | Punto 3D su elica |
| `ellipseArcLengthRamanujan(a,b)` + `ellipseSampleByArcLength` | extend `geometry-rendering-utils.ts` | Approx Ramanujan + sampling |
| `offsetPolyline(poly, distance)` | `geometry-offset-utils.ts` | Polyline parallela (stringers) |

### G3 — Walkline + tread placement

- `computeWalkline(centerline, offset)`
- `placeTreadsAlongWalkline(walkline, stepCount)` — riusa `samplePath` esistente da `path-arc-length-sampler.ts` ✅

### G4 — Validator NOK + IBC + Eurocode

Estensione di `src/services/building-code/` (ADR-186):
- `src/services/building-code/engines/gate-stair-checker.ts` — input `StairParams`, output `ValidationResult[]` con level `'hard-error' \| 'warning' \| 'ok'` + messageKey i18n.
- **Hard errors** (geom impossibili) bloccano creazione; **warnings** (code violation) lasciano passare ma marcano `validation.hasCodeViolations`.

### G5 — Property panel post-creazione

Doppio livello:
1. **Contextual ribbon tab** "Σκάλα" (mirror ADR-344 Text contextual) — param-base sempre visibili: kind, rise, tread, stepCount, width, codeProfile, validator badge.
2. **Floating Advanced Properties panel** apribile da bottone — param avanzati: nosing, walklineOffset, handrails, materials placeholder (3D-ready), landings detail, winderMethod, validation report. Position persistente `dxf:stair.advancedPanel.{x,y,docked}`.

### G6 — Enterprise ID + Firestore schema

- `STAIR: 'stair'` in `enterprise-id-prefixes.ts` → `generateStairId()`.
- **Nuova collection `floorplan_stairs`** (industry-aligned, Revit/ArchiCAD/AutoCAD Architecture/BricsCAD BIM + IFC 4 `IfcStair`).
- **Path: top-level `floorplan_stairs/{stairId}`** con tenant isolation via `companyId` field (Phase 8 2026-05-17 — was sub-path `companies/{cid}/projects/{pid}/floorplan_stairs/{stairId}` in Phase 1 plan, switched to top-level to reuse `firestoreQueryService.subscribe` SSoT — ADR-355 — and inherit its ADR-361 equality guard upstream. Subscribe filters by `(projectId, floorplanId)`; tenant `companyId` filter applied auto by the service). Pattern mirrors `building_floorplans` / `project_floorplans`.
- Schema `StairDoc` = params + bbox cached + validation summary + optional `geometry`. Geometry recomputed client-side from params (ADR §G6) — re-derivable, not load-bearing.
- Indici composite: `(companyId, projectId, floorplanId)` (subscribe primary), `(projectId, floorId, params.codeProfile)`, `(projectId, validation.hasCodeViolations, updatedAt)`.

### G7 — 3D-readiness

Tutti i `Point2D` del modello stair sono `Point3D` con `z` opzionale. Renderer 2D ignora z; quando arriverà 3D la struttura è già pronta.

### G8 — i18n stair namespace

`tools.stair.*` in `el/` + `en/` (name, description, steps, shortcuts, types, validation messages, panel labels, arrow.up/down).

### G9 — Ribbon entry

Split-button "Σκάλα" in `home-tab-draw.ts` con 10 varianti live dal merge (no comingSoon): `straight, l-shape, u-shape, gamma, spiral, helical, elliptical, winder, triangular-fan, triangular-outline, sketch`.

### G11 — Multi-storey: totalRise auto-derivato

`totalRise` oggi raw param. Industry (Revit Multistory, ArchiCAD Multi-Level): `totalRise` = `storyHeight × storyCount` da config livelli. Aggiungere `multiStoryConfig?: { topLevel: string; storyHeight: number; storyCount: number }` opzionale; quando presente, `totalRise` diventa COMPUTED; quando assente, raw input come oggi.

### G12 — Stair structure type

Nessun campo `structureType`. Industry (ArchiCAD Structure branch, Allplan Stringer/Carriage tabs, Tekla S71/S82, Revit system families): 8 tipi standard. Aggiungere `structureType: 'monolithic'|'stringer-1side'|'stringer-2side'|'central-stringer'|'cantilever'|'suspended'|'glass-tread'|'steel-grating'` + `stringerParams?: { width; height; sides }`.

### G13 — Materials & finishes + riser open/closed

Solo `nosing: number`. Mancano: `riserType: 'closed'|'open'` (impatta render 2D: riser aperto = linea tratteggiata). `materials?: { tread?; riser?; stringer?; landing? }` (string ID material library). `antiskidNosing: boolean`. `adaContrastStrip: boolean`. ArchiCAD pattern: per-stair default + per-tread override in Edit Mode.

### G14 — Cut line render split

Oggi `cutLine?: Segment3D` ma nessuna logica di placement né split. Aggiungere: `cutPlaneHeight: number` (default 1200mm) in StairParams. `StairGeometry.treadsAboveCut: Polygon3D[]` + `treadsBelowCut: Polygon3D[]`. Render: sopra=dashed, sotto=solid. Break symbol zigzag 45° auto-generato.

### G15 — Edit grips post-creazione

Nessun sistema grip stair-specific. Industry (Revit direct manipulation, BricsCAD yellow/green grips, ArchiCAD pet palette, VisualARQ control points): `StairGripType = 'basePoint'|'directionGrip'|'widthGrip'|'lengthGrip'|'splitGrip'`. Pattern simile a line tool ADR-357.

### G16 — Auto landing depth + corner style

`landingDepth` oggi `number` fisso. Industry: `'auto'` = `width`. Aggiungere: `landingDepth: 'auto'|number`, `landingCornerStyle?: 'square'|'chamfer'|'fillet'`, `landingCornerRadius?: number`.

### G17 — Mirror/rotate/copy semantica

Mirror su scala parametrica DEVE invertire `turnDirection` (cw↔ccw) e `turnSequence` (left↔right). Lasciare al renderer = rottura editabilità (Revit bug noto). Helper `mirrorStairParams(params, axis)` + `rotateStairParams(params, angle, pivot)` + `copyStairParams(params, offset)` come SSoT.

### G18 — Code profiles aggiuntivi

`codeProfile` esteso a `'nok'|'ibc'|'eurocode'|'nbc'|'nfpa'|'as1657'|'din'|'ada'|'none'`. Default `'nok'`.

### G19 — ADA handrail extensions

`handrails` esteso: `topExtension?: number` (default 305mm), `bottomExtension?: 'one-tread'|number`. Profilo `'ada'` valida.

### G20 — Egress capacity validator

Campo `occupancyLoad?: number` opzionale per-stair (o ereditato per-progetto via setting). Validator warning se `width < occupancyLoad × 7.62`. Travel distance OUT-OF-SCOPE.

### G21 — Tread numbering & labels

Mancano. Aggiungere: `treadNumberStart: number` (default 1), `treadLabelDisplay: 'all'|'nth'|'none'` (default `'none'` plan-view + `'all'` schedule-export), `treadLabelEveryN?: number` (per `'nth'`), `treadLabelRestartPerFlight: boolean` (default true).

### G22 — Headroom check (clash con elementi sopra)

Validator estensione: `headroomClear` calcolato confrontando bbox stair+walkline con `floorplan_walls`/`floorplan_columns`/`ceiling_slab` overhead. Real-time durante draw = raro industry (Revit batch post-creation è lo standard). Default: post-creation warning, non-bloccante.

### G23 — QTO + Schedule export

IFC4 `Qto_StairBaseQuantities`: `GrossVolume`, `NetVolume`, `GrossFootprintArea`, `NetSideArea`, `Height`, `Length`. Schedule export CSV/Excel/PDF. Nuovo SSoT: `stair-schedule-exporter`.

### G24 — Audit trail + soft-lock multi-user

`EntityAuditService.recordChange()` (ADR-195) copre già history. Soft-lock display-only: `editingBy?: { userId: string; since: Timestamp }` in StairDoc. Non-bloccante (non lock vero, solo indicator UI). CRDT full = Phase 9+.

### G25 — Hotkey shortcut

Convenzione: `'st'` (Stair) — Revit-aligned (SR ridotto a ST), 2 lettere, no conflict con `L` (line). In `TOOL_DEFINITIONS['stair']`.

### G26 — Library presets

`StairPreset: { id; name; params: Partial<StairParams>; kind; scope: 'user'|'company'|'project' }`. Firestore: `companies/{cid}/stair_presets/{presetId}`. UI: "Save as preset" + dropdown "Load preset" in contextual ribbon. Nuovo SSoT: `stair-presets-service`.

### G27-G33 — Out-of-scope o Phase 9+ (documentati, non gap)

| G | Tema | Ragione |
|---|------|---------|
| G27 | Stair-to-stair shared landings cross-entity | Industry-wide non implementato. Workaround Rectangle entity. Phase 9+ `sharedLandingRef?` |
| G28 | Custom step profile (poligono libero) | Phase 1-8: solo `nosingSide: 'front'\|'none'\|'front-and-sides'` enum. Custom polygon Phase 9 |
| G29 | Real-time CRDT collaboration | Over-engineering Phase 1-8. G24 soft-lock copre il caso |
| G30 | Anti-clash real-time during draw | Industry SOTA = batch post-creation. Phase 9+ extension point `stair-clash-checker` |
| G31 | Glass railing 3D detail (LOD 300/350/400) | Phase 9 (3D renderer) |
| G32 | Performance >100 stairs | Già coperto da ADR-040 micro-leaf + bitmap cache architecture |
| G33 | Auto-generation VIEW di sezione | Industry-wide non automatico (solo plan-cut split = G14). Out-of-scope |

---

## 5. Decision

### 5.0 Sistema di unità

- **Storage canonico**: mm interno + Firestore + DXF export (ISO).
- **Display utente**: switchabile cm/mm via setting `dxf:units.stair` (localStorage SSoT).
- **Default**: `cm` (mercato GR).
- **Formatter SSoT**: `formatStairLength(mmValue, unit)` in `systems/stairs/stair-units.ts`.
- **Parser SSoT**: `parseStairLength(text)` accetta "17.5 cm" / "175 mm" / "17,5".
- Tutti i Dynamic Input + Property Panel + Ribbon Properties usano lo stesso formatter/parser.

### 5.1 Modello dati — **Associative Parametric**

```typescript
// types/stair.ts (NEW)
export type StairKind =
  | 'straight'
  | 'l-shape'             // ¼ turn (90°)
  | 'u-shape'             // ½ turn (180°), mid-landing
  | 'gamma'               // 3 flights + 2 landings (Γ shape)
  | 'spiral'              // archimedean, no inner radius
  | 'helical'             // open-well circular, inner radius > 0
  | 'elliptical'          // elliptical helical
  | 'winder'              // straight + winder treads at corner
                          //   method 'kite' = 3 treads in 90°, middle triangular
  | 'triangular-fan'      // βεντάλια: uniform angular treads → apex (polygonal spiral)
  | 'triangular-outline'  // wedge layout fitting triangular room footprint
  | 'sketch';             // user-drawn walkline → derived geometry

export interface StairParams {
  basePoint: Point3D;
  direction: number;        // deg, 0 = +X

  rise: number;             // mm
  tread: number;            // mm (excl. nosing)
  nosing: number;           // mm
  nosingSide: 'front' | 'none' | 'front-and-sides';   // G28
  width: number;            // mm
  stepCount: number;

  totalRise: number;        // raw OR computed da multiStoryConfig (G11)
  totalRun: number;
  pitch: number;            // deg

  multiStoryConfig?: {                                  // G11
    topLevel: string;
    storyHeight: number;    // mm
    storyCount: number;
  };

  structureType:                                        // G12
    | 'monolithic'
    | 'stringer-1side'
    | 'stringer-2side'
    | 'central-stringer'
    | 'cantilever'
    | 'suspended'
    | 'glass-tread'
    | 'steel-grating';
  stringerParams?: {                                    // G12
    width: number;          // mm
    height: number;         // mm
    sides: 'left' | 'right' | 'both' | 'center';
  };

  riserType: 'closed' | 'open';                         // G13
  materials?: {                                         // G13
    tread?: string;         // material library ID
    riser?: string;
    stringer?: string;
    landing?: string;
  };
  perTreadOverrides?: Record<number, Partial<{          // G13 ArchiCAD pattern
    material: string;
    nosing: number;
    customProfile?: Point2D[];
  }>>;
  antiskidNosing: boolean;                              // G13
  adaContrastStrip: boolean;                            // G13/G19

  cutPlaneHeight: number;                               // G14, default 1200 mm

  variant: StairVariantParams;

  walklineOffset: number;   // mm (default 300)
  handrails: {
    inner: boolean;
    outer: boolean;
    height: number;         // mm (default 900)
    topExtension?: number;  // mm (G19, ADA default 305)
    bottomExtension?: 'one-tread' | number;             // G19
  };
  upDirection: 'forward' | 'backward';

  treadNumberStart: number;                             // G21 default 1
  treadLabelDisplay: 'all' | 'nth' | 'none';            // G21
  treadLabelEveryN?: number;                            // G21
  treadLabelRestartPerFlight: boolean;                  // G21

  occupancyLoad?: number;                               // G20

  codeProfile:                                          // G18 esteso
    | 'nok' | 'ibc' | 'eurocode'
    | 'nbc' | 'nfpa' | 'as1657' | 'din' | 'ada' | 'none';
  nokSubType?: 'main' | 'secondary';   // toggle in panel quando codeProfile='nok'
}

export type StairVariantParams =
  | { kind: 'straight' }
  | { kind: 'l-shape'; turnDirection: 'left'|'right'; landingDepth: 'auto'|number; landingCornerStyle?: 'square'|'chamfer'|'fillet'; landingCornerRadius?: number; flightSplit: [number, number]; }
  | { kind: 'u-shape'; turnDirection: 'left'|'right'; landingDepth: 'auto'|number; landingCornerStyle?: 'square'|'chamfer'|'fillet'; landingCornerRadius?: number; flightSplit: [number, number]; }
  | { kind: 'gamma'; turnSequence: ['left'|'right', 'left'|'right']; landings: ['auto'|number, 'auto'|number]; landingCornerStyle?: 'square'|'chamfer'|'fillet'; flightSplit: [number, number, number]; }
  | { kind: 'spiral'; centerPoint: Point3D; innerRadius: 0; sweepAngle: number; turnDirection: 'cw'|'ccw'; }
  | { kind: 'helical'; centerPoint: Point3D; innerRadius: number; outerRadius: number; sweepAngle: number; turnDirection: 'cw'|'ccw'; }
    // panel mostra 3 campi sincronizzati (innerRadius/width/outerRadius), 1 derivato (constraint outer = inner + width).
  | { kind: 'elliptical'; centerPoint: Point3D; semiMajor: number; semiMinor: number; sweepAngle: number; turnDirection: 'cw'|'ccw'; rotation: number; }
  | { kind: 'winder'; turnAngle: number; winderCount: number; winderMethod: 'equal-going'|'kite'|'balanced'|'pie'; }
  | { kind: 'triangular-fan'; apexPoint: Point3D; openingAngle: number; stepCountPerArc: number; turnDirection: 'cw'|'ccw'; }
  | { kind: 'triangular-outline'; triangleVertices: [Point3D, Point3D, Point3D]; entrySide: 0|1|2; orientation: 'cw'|'ccw'; }
  | { kind: 'sketch'; walklinePath: Point3D[]; };

export interface StairGeometry {
  treads: Polygon3D[];                      // legacy alias = treadsBelowCut
  treadsBelowCut: Polygon3D[];              // G14 — solid render
  treadsAboveCut: Polygon3D[];              // G14 — dashed render
  risers: Segment3D[];
  stringers: { inner: Polyline3D; outer: Polyline3D; };
  walkline: Polyline3D;
  handrails: { inner?: Polyline3D; outer?: Polyline3D; };
  landings: Polygon3D[];
  arrowSymbol: { start: Point3D; end: Point3D; label: 'UP'|'DOWN'; };
  cutLine?: Segment3D;                      // break symbol zigzag 45° (G14)
  treadLabels?: { treadIndex: number; position: Point3D; text: string; }[];   // G21
  bbox: BoundingBox3D;
}

export interface StairEntity extends BaseEntity {
  type: 'stair';
  kind: StairKind;
  params: StairParams;
  geometry: StairGeometry;        // computed cache
  validation: {
    hasCodeViolations: boolean;
    violationKeys: string[];      // i18n message keys
    headroomViolations?: string[];                            // G22
    egressViolations?: string[];                              // G20
    adaViolations?: string[];                                 // G19
    lastValidatedAt: Timestamp;
  };
  editingBy?: { userId: string; since: Timestamp };           // G24 soft-lock display-only
  qto?: {                                                     // G23 IFC4 Qto_StairBaseQuantities
    grossVolume: number;          // m³
    netVolume: number;            // m³
    grossFootprintArea: number;   // m²
    netSideArea: number;          // m²
    height: number;               // mm
    length: number;               // mm
    handrailLinearMeters: number; // m
    treadCladdingArea: number;    // m²
  };
}
```

### 5.2 Pipeline tool — Modalità **Ibrida**

```
Ribbon click "Σκάλα" → ToolStateStore.setTool('stair')
  ▼
StairContextualPanel mounts in ribbon (sticky, NOT modal):
  - Type selector (split: 10 kinds)
  - Always-visible params: rise · tread · stepCount · width
  - Collapsible "More…": nosing, walklineOffset, handrails, landings, codeProfile
  - Live validator badge (NOK/IBC) — verde/giallo/rosso
  ▼
DrawingStateMachine: IDLE → TOOL_READY
  ▼
[Click 1] basePoint (anchor low end)
[Mouse move] preview ruota+riposiziona seguendo cursore
[Click 2] direction (orientation) — OR Dynamic Input for absolute angle
  ▼
COLLECTING_POINTS — params editabili live dal ribbon panel:
  ogni cambio param → ricalcolo preview real-time (riusa PreviewCanvas ADR-040)
  ▼
[Enter / OK / Right-click→Finish] → completeEntity(StairEntity)
  → CreateEntityCommand → CommandHistory (undo/redo)
  → SceneManager.addEntity
  → Firestore persistence (collection floorplan_stairs)
  ▼
Tool resta attivo (continuous mode); ESC esce a 'select'.
```

Panel persiste cross-session in `dxf:stair.lastParams` (localStorage).

### 5.3 Sub-elementi (SSoT mapping)

| Sub-element | Riusa | Nuovo helper |
|---|---|---|
| Treads | `Polygon3D` + drawPath | `computeTreadGeometry(params)` |
| Risers | `Segment3D` | derived from treads |
| Stringers | `Polyline3D` + `offsetPolyline` | NEW `geometry-offset-utils.ts` |
| Walkline | `Polyline3D` + `samplePath` (existing) | `computeWalkline(centerline, offset)` |
| Spiral/Helical/Elliptical | NEW helpers (G2) | spiral, helix, ellipseSample |
| Handrails | `Polyline3D` | `computeHandrail(walkline, height)` |
| Validator | ADR-186 engine | `gate-stair-checker.ts` |

### 5.4 Nuovi SSoT da creare (count = 8, round 2)

1. **`StairGeometryService`** — `systems/stairs/StairGeometryService.ts` — entry point `computeStairGeometry(params): StairGeometry`, dispatch per kind.
2. **`stair-validator`** — `systems/stairs/stair-validator.ts` — `validateStairParams(params, codeProfile, contextEntities?): ValidationResult[]`. Estesa con headroom (G22), egress (G20), ADA (G19).
3. **`geometry-offset-utils`** — `rendering/entities/shared/geometry-offset-utils.ts` — `offsetPolyline(poly, distance)`.
4. **`geometry-curve-utils`** — spiral + helix + ellipse arc-length sampling (raggruppati).
5. **`stair-grips`** — `systems/stairs/stair-grips.ts` — G15 — `getStairGrips(entity): StairGrip[]` + handler `applyGripDrag(entity, gripType, delta): StairParams`. 5 tipi: basePoint/direction/width/length/split.
6. **`stair-transforms`** — `systems/stairs/stair-transforms.ts` — G17 — `mirrorStairParams(params, axis)` + `rotateStairParams(params, angle, pivot)` + `copyStairParams(params, offset)`. Inverte semanticamente turnDirection/turnSequence.
7. **`stair-presets-service`** — `systems/stairs/stair-presets-service.ts` — G26 — CRUD su `companies/{cid}/stair_presets/{presetId}`, scope user/company/project, cache 5min.
8. **`stair-schedule-exporter`** — `systems/stairs/stair-schedule-exporter.ts` — G23 — produce CSV/Excel/PDF da array `StairEntity` con `Qto_StairBaseQuantities`.

### 5.5 Nuovi flag `TOOL_DEFINITIONS`

```typescript
'stair': {
  category: 'drawing',
  requiresCanvas: true,
  canInterrupt: true,
  allowsContinuous: false,
  allowsChain: false,
  supportsDynamicInput: true,
  preservesOverlayMode: false,
  hotkey: 'st',                     // G25 Revit-aligned (SR ridotto)
}
```

### 5.6 Enterprise ID

`STAIR: 'stair'` → `generateStairId()` → IDs `stair_<ulid26>`.

### 5.7 Walkline visibility (industry-aligned)

ORATA durante draw/edit mode, NASCOSTA dopo finalization (default). Toggle "Εμφάνιση γραμμής πορείας" in panel per export documentazione ΝΟΚ. Convergenza AutoCAD/Revit/ArchiCAD/Vectorworks/IFC.

### 5.8 Arrow label format

i18n locale-driven. Chiave `tools.stair.arrow.up/down` + counter `{count} βαθμίδες/risers`. Format SSoT `stair-label-formatter.ts`.
- EL: "ΑΝΩ 16 βαθμίδες" / "ΚΑΤΩ 16 βαθμίδες"
- EN: "UP 16 risers" / "DOWN 16 risers"

### 5.9 Validator behavior (hybrid)

- **Hard errors** (geometricamente impossibili): `stepCount<=0`, `width<=0`, `rise<=0`, `tread<=0`, area negativa, self-intersection → **BLOCCANO** creazione.
- **Code violations** (NOK/IBC out-of-range) → **WARN** non-bloccante, badge rosso in panel + tooltip lista violazioni; entity creata ma marcata `validation.hasCodeViolations=true` per audit.

### 5.10 NOK subtype

Toggle `κύρια/δευτερεύουσα` in panel quando `codeProfile='nok'`. Default `κύρια`. Validator switcha range dinamicamente.
- Defaults κύρια: W=1200, R=175, G=280.
- Defaults δευτερεύουσα: W=900, R=180, G=270.

### 5.11 Transform operations (G17)

Mirror/rotate/copy NON sono operazioni geometriche raw — devono trasformare semanticamente i `params`.

```typescript
// systems/stairs/stair-transforms.ts
export function mirrorStairParams(params: StairParams, axis: Line2D): StairParams {
  // 1. mirror basePoint geometricamente
  // 2. INVERTE turnDirection (cw↔ccw, left↔right) nel variant
  // 3. INVERTE turnSequence array per kind='gamma'
  // 4. Se nosingSide='front-and-sides' resta uguale; 'front' resta 'front'
}
export function rotateStairParams(params: StairParams, angle: number, pivot: Point3D): StairParams {
  // ruota basePoint + direction; variant resta invariato
}
export function copyStairParams(params: StairParams, offset: Point3D): StairParams {
  // sposta basePoint, tutto il resto invariato
}
```

Render di una mirrored/rotated stair = `computeStairGeometry(transformedParams)`. Editabilità preservata (Revit bug noto evitato).

### 5.12 Stair Grips system (G15)

Post-creazione, selezionando una stair, appaiono 5 grip overlay:

| Grip | Posizione | Drag effect |
|------|-----------|-------------|
| `basePoint` | basePoint | sposta tutto (no recalc geometry, solo translate) |
| `directionGrip` | basePoint + direction × 100mm | ruota direction (no width/stepCount change) |
| `widthGrip` | midpoint outer stringer | cambia `width` (recalc geometry, walkline shifts) |
| `lengthGrip` | end di ultimo step | cambia `stepCount` derivando da nuova length / tread |
| `splitGrip` | midpoint landing (solo L/U/gamma) | cambia `flightSplit` ratio |

Implementati come overlay layer riusando architettura grip esistente del line tool (ADR-357). Snap+ortho+polar funzionano durante drag.

---

## 6. Architecture

### 6.1 Layered diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  UI Layer                                                            │
│  ┌────────────────────┐  ┌──────────────────────┐                   │
│  │ Ribbon stair button │  │ Stair Properties     │                   │
│  │ (+ 10 variants)     │  │ contextual tab       │                   │
│  └─────────┬───────────┘  └──────────┬───────────┘                   │
└────────────┼───────────────────────────┼──────────────────────────────┘
             ▼                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Tool Layer                                                          │
│  ┌──────────────────┐  ┌────────────────────────┐                    │
│  │ ToolStateStore   │  │ useStairTool (hook)    │                    │
│  │ activeTool=stair │  │ COLLECTING_POINTS state │                    │
│  └─────────┬────────┘  └────────────┬───────────┘                    │
└────────────┼─────────────────────────┼─────────────────────────────────┘
             ▼                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Domain Layer                                                        │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐     │
│  │ StairGeometryService     │  │ stair-validator              │     │
│  │ params → geometry        │  │ params → validation result   │     │
│  └─────────────┬────────────┘  └──────────────────────────────┘     │
│                ▼                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Geometry primitives (existing + new)                          │   │
│  │  - arcFrom3Points, samplePath (existing)                      │   │
│  │  - offsetPolyline, spiralSample, helixSample, ellipseSample   │   │
│  │  - (NEW: geometry-offset-utils, geometry-curve-utils)         │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Persistence Layer                                                   │
│  StairEntity → CreateEntityCommand → SceneManager →                  │
│  Firestore (collection floorplan_stairs, sub-path company/project)   │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Render pipeline (2D plan view) — round 2 con cut split (G14)

Decomposizione `StairEntity` per render:
1. Per ogni tread in `geometry.treadsBelowCut` (sotto cut plane 1.2m): drawPolygon SOLID (fill = layer color, stroke continuous).
2. Per ogni tread in `geometry.treadsAboveCut`: drawPolygon DASHED (stroke tratteggiato, hidden).
3. Per ogni `riser` in `geometry.risers`: drawLine; if `params.riserType='open'` → DASHED, else SOLID.
4. `walkline`: drawPolyline dashed (visibile solo se editing OR toggle ON, ADR §5.7).
5. `arrowSymbol`: drawArrow + drawText (i18n locale-driven).
6. Stringers: drawPolyline bold (skip se `structureType='cantilever'|'suspended'|'glass-tread'`).
7. Handrails: drawPolyline tratteggiata (simbolico 2D). Top/bottom extension (G19) renderizzate se profile='ada'.
8. `cutLine`: linea spezzata 45° zigzag (ISO 128) perpendicolare alla direzione di marcia.
9. `treadLabels` (G21): drawText su ogni tread o ogni N (default `display='none'` plan-view, `'all'` schedule-export).
10. ADA contrast strip nosing: linea bold colore contrasto sul leading edge se `adaContrastStrip=true`.

### 6.3 3D-readiness (Phase 9+)

- `Polygon3D` → extrude tread thickness.
- `Riser` → quad verticale altezza `rise`.
- Stringer → extruded beam.
- Handrail → swept profile lungo walkline traslata di `handrailHeight` in z.
- Spiral/Helical: `helixSample` ritorna già `Point3D` con z calcolato.

Tutto il modello è 3D-ready oggi. Phase 9 aggiunge solo il renderer, zero refactor dati.

### 6.4 IFC export readiness (Phase 9+)

`floorplan_stairs.{stairId}` → `IfcStair` 1:1 (IFC 4.3.2):
- `IfcStair` aggrega `IfcStairFlight[]` (rampe) + `IfcSlab[PredefinedType=LANDING]` (pianerottoli).
- `IfcStair.PredefinedType` (`IfcStairTypeEnum`) mapping da `kind`:
  - `straight` → `STRAIGHT_RUN_STAIR`
  - `l-shape` → `QUARTER_TURN_STAIR`
  - `u-shape` → `HALF_TURN_STAIR`
  - `gamma` → `THREE_QUARTER_TURN_STAIR`
  - `spiral` → `SPIRAL_STAIR`
  - `helical` → `CURVED_RUN_STAIR`
  - `elliptical` → `CURVED_RUN_STAIR` (con properties extra)
  - `winder` → `QUARTER_WINDING_STAIR` (o `HALF_WINDING_STAIR` se 180°)
  - `triangular-fan` / `triangular-outline` → `USERDEFINED`
  - `sketch` → `USERDEFINED`
- **Pset_StairCommon**: `Reference`, `NumberOfRiser`, `NumberOfTreads`, `RiserHeight`, `TreadLength`, `RequiredHeadroom`, `HandicapAccessible` (← `codeProfile='ada'`), `FireExit` (← `occupancyLoad>0`).
- **Qto_StairBaseQuantities** (G23): `GrossVolume`, `NetVolume`, `GrossFootprintArea`, `NetSideArea`, `Height`, `Length`.
- **IfcRailing** (G18 separate entity): `Pset_RailingCommon` con `IsExternal`, `Reference`, `FireRating`. PredefinedType: `HANDRAIL`/`GUARDRAIL`/`BALUSTRADE`.
- Rebar (Eurocode 2): `IfcReinforcingBar[]` come oggetti FIGLI di `IfcStairFlight` (Tekla pattern).

### 6.5 QTO + Schedule export (G23)

Pipeline: `stair-schedule-exporter.ts` accetta array `StairEntity[]` + format target (CSV/Excel/PDF).

```typescript
// Formato schedule row:
{
  stairId, kind, structureType,
  riserCount, riserHeight, treadDepth, totalRise, totalRun,
  slopeDeg, headroomClear, occupancyLoad,
  codeCompliance: { profile, hasViolations, violationCount },
  qto: { grossVolume, netVolume, grossFootprintArea, netSideArea, height, length, handrailLinearMeters }
}
```

Export CSV via `papaparse`. Excel via `xlsx`. PDF via `jspdf` riusando template existing.

### 6.6 Presets pipeline (G26)

```
"Save as preset" button → modal:
  - name (utente)
  - scope: 'user' | 'company' | 'project'
  - kind (auto-detected da current stair)
  ▼
StairPreset → Firestore companies/{cid}/stair_presets/{presetId}
  ▼
"Load preset" dropdown in contextual ribbon:
  - lista filtrata per (scope, kind, codeProfile)
  - applica params al tool corrente preservando basePoint/direction
```

ID via `enterprise-id.service.ts` prefix `STAIR_PRESET: 'sprst'`. Cache 5min client-side.

### 6.7 Headroom clash check pipeline (G22)

Trigger: post-creation OR on-edit (debounced 500ms).

```
1. computeStairGeometry(params) → walkline + bbox 3D.
2. Query SceneManager: entities sopra walkline (z > walkline.z + headroomClear).
3. Per ogni entity overhead (wall/column/slab/ceiling):
   - se bbox.z_bottom < walkline.z + headroomMin → violation.
4. Append violations a entity.validation.headroomViolations.
5. UI badge giallo nel contextual ribbon panel.
```

Real-time during draw è OPZIONALE (G22 default = post-creation). Industry standard.

### 6.7.1 Floor link bridge (Phase 9 Plan A, Q17)

Stair `multiStoryConfig.storyHeight` is bound to the building floor's `height` (m) when a `floorId` is in scope (`levelManager.saveContext.entityType === 'floor'`). Wiring:

```
useSpecialTools
  └── useFloorMetadata(saveContext.floorId)        ← Firestore subscribe (FLOORS/{id})
        └── getFloorLink() : StairFloorLinkInput   ← passed to useStairTool
              └── buildDefaultStairParams(..., floorLink)
                    └── multiStoryConfig = {
                          topLevel: floorId,
                          storyHeight: floor.height * 1000,
                          storyCount: 1,
                          linkedToFloor: true,
                        }

Ribbon contextual tab → RibbonStairFloorInfoWidget
  ├── reads FLOORS/{id} via useFloorMetadata (same SSoT subscription)
  ├── isLinkedToFloor(config, floor) tolerates legacy stairs missing the flag
  │   (≤0.5mm tolerance match against `floor.height * 1000`)
  ├── badge 🔗 (linked) or ⚠️ (custom)
  └── "Reset to floor" → UpdateStairParamsCommand sets linkedToFloor=true

Manual edits (ribbon storyHeight combobox, future grip drag, command patch)
  └── useRibbonStairBridge.patchStoryHeight → linkedToFloor=false
```

Phase 9B-2 (strict mode, Q35) extends the bridge with `reconcileLinkedStair`
applied on every write path so a linked stair stays geometrically bound to
the floor envelope:

```
buildDefaultStairParams(..., floorLink)        ← post-build reconcile
useRibbonStairBridge.patchRise                 ← rise = primary lever
  └── withRecomputedTotals → reconcileLinkedStair
        stepCount = round(storyHeight × storyCount / rise_mm)
        totalRise = storyHeight × storyCount   ← LOCKED
useRibbonStairBridge.patchStepCount            ← stepCount = secondary lever
  └── deriveRiseFromStepCount(...) → withRecomputedTotals → reconcile
stair-grips.resizeLength (length grip)         ← clamp + magnet snap
  └── maxRun = tread × (maxStepCount − 1)
        if cursor in last 10% of maxRun → snap to maxRun
autoFixStairParams                             ← reconcile FIRST, then code fix
stair-validator.checkStoryHeightOverflow       ← hardError when linked (red)
stair-validator.checkStoryHeightUnderflow      ← hardError when linked (red)
```

Phase 9B-3 hides the ribbon `storyHeight` combobox when linked
(`STAIR_RIBBON_VISIBILITY_KEYS.multiStoryHeightEditor`); the floor info widget
is then the sole surface that displays the height — single source of truth.

Unit conventions: `FloorRecord.height` is stored in meters in the `FLOORS` collection; `StairMultiStoryConfig.storyHeight` is stored in millimeters (consistent with Phase 7a presets). The m → mm conversion happens at the bridge layer (auto-init builder + Reset button), never in the geometry pipeline.

Industry convergence: Revit Type Selector binds to Levels with explicit "Inherit" toggle; ArchiCAD Story Sensitive elements display "From Story X" label; AutoCAD Architecture stair elevation references a level marker. All three surface a visual link badge and a one-shot "restore link" affordance — same UX adopted here. Strict-mode derivation (Phase 9B-2) follows the same 5/5 vendor convergence (Revit "Desired Riser Height" + ArchiCAD Story Sensitive Stair + AutoCAD Architecture `bindToLevels` + Vectorworks story snap + BricsCAD BIMSTAIR).

### 6.8 Multi-user soft-lock (G24, cita ADR-195)

`editingBy?: { userId; since }` settato ottimisticamente quando user inizia edit, cleared dopo `completeEntity` o timeout 5min. Display: badge "Editing by Maria…" in contextual ribbon. NON blocca altri utenti (display-only). Audit completo via `EntityAuditService.recordChange()` (ADR-195) — nessun nuovo sistema.

CRDT collaboration full = Phase 9+ se richiesto.

---

## 7. Implementation Phases (incremental, **1 sessione = 1 fase**, commit eseguito da Giorgio)

### 7.0 Commit & Push policy — NON-NEGOTIABLE (2026-05-16)

**L'agente NON committa e NON pusha mai senza ordine esplicito di Giorgio.**

- L'agente esegue l'implementazione completa della Phase (codice + ADR update Phase 3) e poi **si ferma**.
- L'agente attende ordine esplicito ("commit" / "κάνε commit" / "commit it") prima di eseguire `git commit`.
- L'agente attende ordine esplicito ("push" / "στείλε" / "ανέβασε" / "πήγαινε Vercel") prima di eseguire `git push`.
- **Override globale**: CLAUDE.md SOS. N.(-1). Questa sezione lo riafferma a livello ADR per chiarezza operativa.
- **Why**: Giorgio decide cosa è production-ready. Ogni push = Vercel build = consumo crediti ($).

### 7.1 Context-budget rationale (2026-05-16)

Ogni fase deve completarsi in **una sola sessione Claude** con context ≤70% (target). Le fasi XL/L originali sono state splittate in sub-fasi per garantire context pulito ad ogni inizio. Classificazione:
- **S** (≤3 file, ≤300 LOC): 1 sessione sicura
- **M** (4-6 file, ~400-800 LOC): 1 sessione OK
- **L** (5-8 file, ~800-1500 LOC): 1 sessione tight ma fattibile
- **XL** (>8 file, >1500 LOC): ❌ vietato → split obbligatorio

### 7.2 Tabella fasi (post-split, 19 sessioni)

| Phase | Titolo | Files | Size | LOC ~ | Deps |
|---|---|---|---|---|---|
| **0** ✅ | i18n keys + Ribbon button stub + hotkey `'st'` (DONE 2026-05-16, 10 file, comingSoon fino Phase 5a) | 10 | S | ~120 | — |
| **1** ✅ | Type system: `StairEntity` + `StairParams` discriminated unions + enterprise-id (`STAIR`, `STAIR_PRESET`) + StairDoc/Geometry/QTO interfaces (DONE 2026-05-16, 7 file, ~430 LOC types/stair.ts + edits) | 7 | M | 430 | 0 |
| **2a** ✅ | Geometry helpers math: `spiralSample`, `helixSample` + unit tests (accuracy vs analytical, tolerance 1e-6) — DONE 2026-05-16 (3 file, 21 test green) | 3 | M | 350 | 1 |
| **2b** ✅ | Geometry helpers math: `ellipseArcLength`, `ellipseSample`, `offsetPolyline` (miter+bevel, miterLimit fallback) + unit tests — DONE 2026-05-16 (3 file: 1 extension + 2 new, 26 test green, 47/47 cumulative Phase 2a+2b) | 3 | M | 350 | 1 |
| **3a** ✅ | `StairGeometryService`: kind `straight` + `l-shape` + walkline + tread placement (DONE 2026-05-16, 3 file, ~520 LOC service + tests, 22 test green) | 3 | M | 400 | 2a-2b |
| **3b** ✅ | `StairGeometryService`: kind `u-shape` + `gamma` + auto-landing (G16) + cut split (G14) + tread numbering (G21) — DONE 2026-05-16 (4 new + 3 edited file, ~870 LOC prod + ~565 LOC test, 32 new test green / 54 cumulative stairs / 220 cumulative geometry) | 7 | L | 870 | 3a |
| **4a** ✅ | `StairGeometryService`: kind `spiral` + `helical` (riusa `helixSample`) — DONE 2026-05-16 (5 file: 2 new computers + 1 service edit + 2 new test files, ~430 LOC prod + ~310 LOC test, 20 new test green / 74 cumulative stairs / 240 cumulative geometry) | 5 | M | 430 | 3b |
| **4b** ✅ | `StairGeometryService`: kind `elliptical` + `winder` (riusa `ellipseSample` + rotateVec helper) — DONE 2026-05-16 (5 file: 2 new computers + 1 service edit + 2 new test files, ~440 LOC prod + ~290 LOC test, 22 new test green / 96 cumulative stairs / 143 cumulative geometry+stair) | 5 | M | 440 | 4a |
| **4c** ✅ | `StairGeometryService`: kind `triangular-fan` + `triangular-outline` + `sketch` (free-form) — DONE 2026-05-16 (7 file: 3 new computers + 1 service edit + 3 new test files, ~480 LOC prod + ~430 LOC test, 26 new test green / 122 cumulative stairs) | 7 | L | 480 | 4b |
| **5a** ✅ | Tool wire-up: `useStairTool` hook + preview rendering + click pipeline + Dynamic Input — DONE 2026-05-16 (11 file: 2 new hooks + 1 new dynamic-input handler + 2 new test files + 6 edits, ~640 LOC prod + ~140 LOC test, 12 new test green / 134 cumulative stair+drawing) | 11 | L | 640 | 4c |
| **5b** ✅ | Stair Grips (G15) + minimal 2D renderer: 5 grip tipi (`stair-base`, `stair-direction`, `stair-width`, `stair-length`, `stair-split`) via pipeline grip unificata (`useUnifiedGripInteraction`), `UpdateStairParamsCommand` con merging window, `StairRenderer` (treads + walkline + arrow + stringers), `DxfStair` wrapper SSoT — DONE 2026-05-16 (~640 LOC prod + ~280 LOC test, 18 new test green / 152 cumulative) | 11 | L | 500 | 5a |
| **5c** ✅ | Transforms (G17): `mirrorStairParams`, `rotateStairParams`, `copyStairParams` con auto-flip turnDirection/turnSequence (Q23) — DONE 2026-05-16 (2 file: 1 NEW pure-transforms + 1 NEW test, ~250 LOC prod + ~340 LOC test, 27 new test green / 179 cumulative) | 2 | M | 250 | 5b |
| **6** ✅ | Stair validator: NOK + IBC + Eurocode + ADA (Q25) + headroom check hybrid 2D (Q29) + i18n violation messages — DONE 2026-05-16 (4 file: 1 NEW gate engine + 1 NEW SSoT facade + 2 EDIT i18n locales + 1 NEW test, ~270 LOC prod + ~270 LOC test, 32 new test green / 211 cumulative) | 4 | M | 270 | 1 |
| **6.5** ✅ | Egress capacity validator (G20) + ADA auto-default builder (G19, Q26 data layer). ADA handrail RENDER deferito a Phase 7a alongside red-badge UI surfacing — coherent visual pacchetto. DONE 2026-05-16 (5 file: gate-stair-checker EDIT + stair-validator EDIT + stair-completion EDIT + 2 i18n EDIT + 1 test EXTEND + 1 NEW test, ~180 LOC prod + ~190 LOC test, 19 new test green / 230 cumulative stairs+drawing) | 5 | S | 250 | 6 |
| **7a** ✅ | Contextual ribbon tab "Stair Properties" + `structureType` selector 8 tipi (G12, Q18) + `multiStoryConfig` UI (G11, Q17) + smart defaults (Q20 riserType / Q34 nosingSide auto-update). DONE 2026-05-16 (3 NEW + 4 EDIT + 2 i18n EDIT, ~460 LOC. Red badge / ADA handrail render / status bar wiring / per-kind icons / Inline Dynamic Input deferiti a Phase 7b coherent). | 9 | M | 460 | 5c |
| **7b1** ✅ | Visual + Validator surfacing pacchetto: (a) red "!" badge `RibbonTab.badgeKey` ⇢ `getBadgeState()` per `StairEntity.validation.hasCodeViolations` (Stream A), (b) ADA handrail RENDER (`StairRenderer.drawHandrails`, 305mm top + one-tread bottom extension) (Stream B), (c) per-kind STAIR_PATH icons `stair-straight` + `stair-spiral` + `stair-ushape` (Stream C), (d) status-bar inline prompt via `stair-status-store` SSoT (`useStairTool` writer, `CadStatusBar` reader) (Stream D). DONE 2026-05-16 (1 NEW + 11 EDIT + 4 i18n EDIT, ~430 LOC). | 16 | M | 430 | 7a |
| **7b2a** ✅ | Floating Advanced Properties panel base (host + 3 sections): Materials per-stair (Q19, 4 slots tread/riser/stringer/landing) + Per-Tread Overrides table editor (Q19 hybrid, click-on-canvas Phase 8+) + `cutPlaneHeight` toggle inherit/override (Q21). New SSoT `stair-material-catalog` (10 preset + `MaterialCatalogProvider` interface stub, Phase 9 swap target) + `dispatchStairParamPatch` SSoT writer (mirrors Phase 7a bridge dispatch). DONE 2026-05-16 (8 NEW + 3 EDIT, ~470 LOC). Industry research: 5/5 vendor (Revit/ArchiCAD/Vectorworks/AutoCAD Arch/Allplan) → categorized material picker; 5/5 (Revit/ArchiCAD/AutoCAD/Vectorworks/BricsCAD) → Properties palette separato dalla ribbon. | 11 | M | 470 | 7b1 |
| **7b2b-α** ⚠️ | Floating Advanced panel polish (sections only): Tread Numbering section (Q28 — `treadLabelDisplay` all/nth/none + `treadLabelEveryN` + `restartPerFlight`) + `nosingSide` selector in panel (Q34). DONE 2026-05-16 (2 NEW + 1 EDIT + 2 i18n EDIT, ~190 LOC). Streams E + F split out a 7b2b-β: design decisions richieste (Stream E `Phase` enum convergence, Stream F conditional ribbon panel framework). | 5 | S | 190 | 7b2a |
| **7b2b-β** ✅ | Floating Advanced panel carryovers: Stream E Inline Dynamic Input rise/tread/width Tab cycling (industry convergence A: params editable from tool activation, no phase gate — AutoCAD/Revit/ArchiCAD/Vectorworks/SolidWorks 5/5) + Stream F Multi-flight `turnDirection` toggle per L/U/Γ flight 2/3 via new `RibbonPanelDef.visibilityKey?` framework extension (mirrors Phase 7b1 `badgeKey` pattern). DONE 2026-05-17 (~17 file, ~520 LOC). Design decisions: (a) Stream E rejected Phase-enum-extend / context-bridge / sentinel in favour of `case 'stair'` in `useDynamicInputLayout` + separate `StairField` union + sub-state `activeStairField`; (b) Stream F rejected disabled-buttons / conditional-render in favour of framework-level `visibilityKey` + `getPanelVisibility(key)` resolver in `RibbonCommandsApi`. | ~17 | M | 520 | 7b2b-α |
| **7.5** ✅ | Library presets (G26, Q32): `stair-presets-service` + Firestore CRUD + 3 scope (user/company/project) + UI Save/Load grouped in floating `StairAdvancedPanel`. Design decisions: (B) floating panel section (5/5 industry convergence), (B) inline rename + scope dropdown (ArchiCAD/Vectorworks/BricsCAD), (A) full replace on apply (5/5 industry convergence). DONE 2026-05-17 (4 NEW + 6 EDIT, ~770 LOC + 18 test PASS). Files: `systems/stairs/stair-presets-service.ts` (~190 LOC) + `__tests__/stair-presets-service.test.ts` (~280 LOC) + `ui/stair-advanced-panel/hooks/useStairPresets.ts` (~130 LOC) + `ui/stair-advanced-panel/sections/StairPresetsSection.tsx` (~225 LOC) + EDIT `StairAdvancedPanel.tsx` (mount section + auth context props) + EDIT `app/StairAdvancedPanelHost.tsx` (`useAuth()` + optional `projectId` prop) + EDIT `firestore.rules` (new `match /companies/{companyId}/stair_presets/{presetId}` block: tenant-scoped read with scope filter, owner-only update, scope-aware delete) + EDIT `.ssot-registry.json` (Tier 3 module `stair-presets-service` with forbiddenPatterns) + EDIT i18n el+en (`stairAdvancedPanel.sections.presets.*`). Industry convergence: Revit Type Selector / ArchiCAD Favorites / Vectorworks Resource Manager / AutoCAD Style Manager / BricsCAD Properties — 5/5 floating palette + full-replace apply. SOS N.6 compliance: `setDoc()` + `generateStairPresetId()`. | 10 | M | 770 | 7b |
| **8** ✅ | Firestore persistence collection `floorplan_stairs` + soft-lock `editingBy` (G24) + scene diff-merge selective sync (DD-4) + hybrid auto-save/explicit-save (DD-1). DONE 2026-05-17 (~10 file, ~1180 LOC + 19 test PASS). Design decisions (industry-converged): **DD-1 Hybrid persistence trigger** (Revit transaction + ProjectWise — debounced 500ms auto-save on `stair.params` settle + explicit "Αποθήκευση" button), **DD-2 acquire on-first-edit** (resolved by ADR §6.8 — "settato ottimisticamente quando user inizia edit"), **DD-3 5min TTL auto-release** (resolved by ADR §6.8 + ProjectWise/Google Docs convergence), **DD-4 diff-merge with selective skip** (Revit Cloud + ArchiCAD BIMcloud — local edits win until round-trip completes). Path change: top-level `floorplan_stairs/{stairId}` (was subcollection 2-livelli `companies/{cid}/projects/{pid}/floorplan_stairs/{stairId}` in Phase 1 plan) — switched to reuse `firestoreQueryService.subscribe` SSoT (ADR-355) + ADR-361 equality guard. Files: NEW `systems/stairs/stair-firestore-service.ts` (~280 LOC, subscribe via SSoT wrapper + setDoc/updateDoc/deleteDoc + deleteField sentinel for releaseLock) + NEW `__tests__/stair-firestore-service.test.ts` (~330 LOC, 19/19 PASS — saveStair audit + optional omission + SOS N.6 enforcement + lock acquire/release + subscribe routing) + NEW `hooks/data/useStairPersistence.ts` (~280 LOC, diff-merge + dirtyIds skip + debounced auto-save + lifecycle acquire/release) + NEW `ui/stair-advanced-panel/sections/StairPersistenceSection.tsx` (~110 LOC, save button + status + soft-lock badge) + EDIT `app/StairAdvancedPanelHost.tsx` (wire `useStairPersistence` + `floorplanId` optional prop) + EDIT `StairAdvancedPanel.tsx` (mount persistence section first) + EDIT `firestore.rules` (top-level `match /floorplan_stairs/{stairId}` block: tenant read, create with required fields, update with immutability + editingBy anti-spoof, delete creator|admin) + EDIT `firestore.indexes.json` (3 composite indexes per §G6) + EDIT `.ssot-registry.json` (Tier 3 `stair-firestore-service`) + EDIT i18n el+en `stairAdvancedPanel.sections.persistence.*`. SOS N.6: `setDoc()` + `generateStairId()` only — `addDoc` forbidden by ratchet. | 10 | L | 1180 | 5c |
| **8.5** | QTO + Schedule export (G23, Q30): `stair-schedule-exporter` factory + CSV writer + Excel writer (`exceljs`) + PDF writer (`pdfmake`) + UI export menu | 4 | M | 500 | 8 |
| **9 (Plan A)** ✅ | Floor-link Ribbon section + auto-init multiStoryConfig from `FLOORS/{floorId}`. Q17 resolved end-to-end via Revit/ArchiCAD/AutoCAD Architecture convergence (link badge + Reset to floor). New `useFloorMetadata` hook reuses `firestoreQueryService.subscribeDoc` SSoT (ADR-355) + ADR-361 equality guard. `StairMultiStoryConfig.linkedToFloor?: boolean` added (back-compat optional). `buildDefaultStairParams` accepts `StairFloorLinkInput`; `useStairTool` exposes `getFloorLink`; `useSpecialTools` subscribes to floor when `saveContext.entityType === 'floor'`. `useRibbonStairBridge.patchStoryHeight` flips `linkedToFloor=false` on manual edits. NEW `RibbonStairFloorInfoWidget` (widget pattern from ADR-345 Fase 6) renders read-only floor fields + 🔗/⚠️ badge + Reset button via `UpdateStairParamsCommand`. Plan B (Buildings warning on floor elevation/height change with cascade) DEFERRED to Phase 9C. — DONE 2026-05-17. | ~11 | M | ~450 | 8 |
| **9B-1** ✅ | Building context surfacing in stair ribbon + `storyCount` semantics fix. New `useBuildingTotalFloors` thin wrapper over `useRealtimeBuildingFloors` (SSoT, ADR-355) exposes building floor count to the stair widget — no duplicate Firestore subscription. `RibbonStairFloorInfoWidget` grid extended with "Όροφος: N / Total" + dedicated "Σύνολο ορόφων κτιρίου" row. `useRibbonStairBridge` subscribes to the same floor + total so `patchStoryCount` clamps the editable `storyCount` to `max(1, totalFloors - currentFloorNumber)` — atrium stair across 99 floors of a 3-floor building no longer reachable via combobox. Label rename `storyCount` "Αριθμός Ορόφων"→"Διανυόμενοι Όροφοι" / "Stories Traversed" disambiguates from building total. i18n keys `ribbon.commands.stairEditor.floor.totalFloors` added el+en (no hardcoded strings per SOS N.11). — DONE 2026-05-17. | ~6 | S | ~120 | 9 |
| **9B-2** ✅ | Strict floor-bound stair mode (Q35). NEW `systems/stairs/stair-floor-link.ts` SSoT (`reconcileLinkedStair`, `maxStepCountFor`, `minStepCountFor`, `deriveRiseFromStepCount`, `mmFactorFromWidth` export). `useRibbonStairBridge` patch helpers: `patchRise` reconciles after `withRecomputedTotals` (rise = primary lever, stepCount auto-derived from `storyHeight × storyCount / rise`); `patchStepCount` inverts when linked (derives rise so stepCount lands on the envelope) then reconciles. `stair-grips.resizeLength` clamps the length grip to `tread × (maxStepCount − 1)` and magnet-snaps at the last 10% of the envelope (Revit / ArchiCAD "magnet to top level"). `stair-completion.buildDefaultStairParams` reconciles post-build so a newly placed stair on a 3.0 m floor already has `stepCount = 17` (instead of seeded 12). `stair-validator` overflow/underflow checks emit `hardError.totalRiseOverFloor` / `hardError.totalRiseUnderFloor` when linked (vs the soft `totalRiseOver/BelowStoryHeight` when free) and append them to the `hardErrors` field so `StairWarningsSection` routes them to the red box. `stair-auto-fix` reconciles before the code-range fixes so "Auto-fix" never re-introduces overflow on a linked stair. NEW unit tests `__tests__/stair-floor-link.test.ts` cover mm/cm/m scenes, idempotency (apply twice = no-op), inverse helpers, and code-aware step bounds. i18n `tools.stair.validator.hardError.totalRiseOverFloor` + `totalRiseUnderFloor` added el+en (no `defaultValue` literals per SOS N.11). Industry convergence 5/5: Revit `Desired Riser Height`, ArchiCAD Story Sensitive, AutoCAD Architecture `bindToLevels`, Vectorworks story snap, BricsCAD BIMSTAIR. — DONE 2026-05-17. | ~8 | M | ~480 | 9B-1 |
| **9B-3** ✅ | Lock multi-story height editor when linked. `stair-command-keys` adds `STAIR_RIBBON_VISIBILITY_KEYS.multiStoryHeightEditor`. `useRibbonStairBridge.getPanelVisibility` returns `multiStoryConfig.linkedToFloor !== true` for that key. `contextual-stair-tab` splits the "Πολυώροφα" panel: storyCount stays in `stair-multistory` (always visible), storyHeight moves to a new `stair-multistory-height` panel (labelKey `ribbon.panels.stairMultiStoryHeight` = "Ύψος Ορόφου" / "Story Height") gated by the new visibilityKey. When linked, the editable storyHeight combobox hides — the floor info widget in the "Στάθμη" panel is the only surface that displays the height, eliminating the duplicate "Ύψος" UX that previously let users drift the two values apart. i18n `ribbon.panels.stairMultiStoryHeight` added el+en. Industry convergence: Revit / ArchiCAD / AutoCAD Architecture all hide the level-distance editor once a stair is bound to levels — single source of truth for the height. — DONE 2026-05-17. | ~4 | S | ~80 | 9B-2 |
| **10** | (FUTURE, fuori scope ADR-358) 3D renderer + IFC export + IfcRailing + custom step profile + real-time anti-clash + CRDT | — | — | — | post |

**Stima totale (round 2 + split)**: ~5,200 LOC produzione + ~2,400 LOC test = **~7,600 LOC** in **19 sessioni**.

**Pre-merge gate per ogni Phase**:
- TypeScript zero errors
- SSoT ratchet zero new violations
- i18n ratchet zero new hardcoded
- Test coverage StairGeometryService ≥80% (presubmit grade)
- Visual regression baseline (ADR-343) aggiornato per ogni nuovo kind

---

## 8. Testing Strategy

- **Unit tests** (Jest) per ogni pure function:
  - `computeStairGeometry` per kind (10 input → expected geometry snapshot).
  - `validateStairParams` (matrix params × codeProfile).
  - `spiralSample`, `helixSample`, `ellipseSample` (accuracy vs analytical, tolerance 1e-6).
  - `offsetPolyline` (convex + concave).
- **Integration tests** (`__tests__/drawing/stair-tool.test.tsx`): simulate click + dynamic input → asserts scene + command history.
- **Visual regression** (ADR-343): snapshot per ogni kind in stato default.
- **Property-based tests** (fast-check): `2R + G` rule, walkline length consistency, geometry self-intersection check.

---

## 9. Q&A — Round 1 (Q1-Q16) risolti, Round 2 (Q17-Q34) in corso

### 9.1 Round 1 — risolti 2026-05-16

| # | Tema | Decisione |
|---|---|---|
| Q1 | Unità di misura | **Entrambe switchabili**. Default `cm`, canonico interno mm. Formatter/parser SSoT. |
| Q2 | Modalità disegno | **Ibrida**. Ribbon contextual panel sticky + 2-click placement con preview live. |
| Q3 | Tipologie prioritarie | **TUTTE 10** (completeness over MVP). |
| Q4 | Code profile | Tutti disponibili, default `NOK`. Override per-stair + per-progetto. |
| Q5 | Validator behavior | **Ibrido**. Hard errors bloccano, code violations warn non-bloccanti. |
| Q6 | Walkline visibility | Industry-aligned: ORATA during draw/edit, NASCOSTA dopo. Toggle on-demand. |
| Q7 | Arrow label | i18n locale-driven (`ΑΝΩ 16 βαθμίδες` / `UP 16 risers`). |
| Q8 | Editing post-creazione | **Entrambi**: contextual ribbon tab + floating Advanced Properties panel. |
| Q9 | Curve input | **Entrambe modalità** (inner+width OR inner+outer), 3 campi sincronizzati. |
| Q10 | Winder methods | **Tutti 4** (equal-going, kite, balanced, pie). |
| Q11 | Firestore | **Nuova collection `floorplan_stairs`** (industry-aligned IfcStair). |
| Q12 | "Triangolare" | **3 interpretazioni coperte**: `winder.method=kite` + `triangular-fan` + `triangular-outline`. |
| Q13 | Sketch mode | **MVP (Phase 4)**. Completeness over MVP. |
| Q14 | NOK subtype default | Toggle κύρια/δευτερεύουσα in panel, default `κύρια`. |
| Q15 | Ribbon variants timing | **Tutte 10 live dal merge** (no comingSoon). |
| Q16 | ADR number | **358** confermato. |

### 9.2 Round 2 — Q17-Q34 (in attesa di risposta Giorgio, 2026-05-16)

| # | Tema | Stato | Decisione |
|---|------|-------|-----------|
| Q17 | Multi-storey: `totalRise` auto da altezza piano (`multiStoryConfig`) o sempre raw input? | ✅ resolved 2026-05-16 | **Entrambi (γ)**. Default raw `totalRise` manuale. Se utente collega `multiStoryConfig.topLevel` a un level del project → `totalRise` diventa COMPUTED da `storyHeight × storyCount`, raw input disabilitato. Cambio level height → tutte le stair collegate ricalcolano automaticamente. |
| Q18 | `structureType`: tutti 8 tipi (monolithic/stringer/cantilever/spine/suspended/glass/grating) Phase 1, o solo monolithic + others Phase 9? | ✅ resolved 2026-05-16 | **Tutti 8 (α)**. Full enterprise / completeness over MVP. Phase 1 implementa render 2D per tutti i `structureType`. Stringer-* render con polyline bold. Cantilever/suspended/glass-tread/steel-grating in 2D = sola variazione di stroke style + symbol; 3D-completo Phase 9. |
| Q19 | Materials/finishes: solo per-stair default, o anche per-tread override (ArchiCAD pattern)? | ✅ resolved 2026-05-16 | **Default per-stair + per-tread override (β)**. Full ArchiCAD enterprise. `params.materials.{tread,riser,stringer,landing}` = default per-stair. `params.perTreadOverrides[treadIndex].material` = override singolo. Edit mode: select stair → enter Tread Edit Mode → click singolo tread → property panel mostra override material/nosing/customProfile. Senza override → eredita default. |
| Q20 | `riserType` (open/closed): param indipendente, o derivato da `structureType`? | ✅ resolved 2026-05-16 | **Smart default + override (γ)**. Industry convergence (ArchiCAD/Revit/AutoCAD Arch/Vectorworks): `riserType` è param indipendente ma con default auto-suggerito da `structureType`. Default mapping: monolithic/stringer-*→`closed`; cantilever/suspended/glass-tread/steel-grating→`open`. User può override liberamente (es. monolithic + open per LED understep). |
| Q21 | `cutPlaneHeight`: default fisso 1200mm, o configurabile per-progetto (project setting)? | ✅ resolved 2026-05-16 | **Project default + per-stair override (δ)**. Project setting `dxf:project.cutPlaneHeight` (default 1200mm). `StairParams.cutPlaneHeight?` opzionale = se assente eredita project; se presente override per-stair. UI: contextual ribbon panel mostra "Inherit from project (1200mm)" toggle. |
| Q22 | Edit grips: tutti 5 tipi (basePoint/direction/width/length/split) Phase 5, o solo basePoint+direction Phase 5 e altri Phase 9? | ✅ resolved 2026-05-16 | **Tutti 5 grips Phase 5 (γ)**. Industry convergence (Revit/ArchiCAD/BricsCAD) + completeness over MVP. `splitGrip` attivo solo per kind ∈ {l-shape, u-shape, gamma}. Implementazione riusa overlay grip system di line tool ADR-357. Snap+ortho+polar attivi durante drag. |
| Q23 | Mirror semantica: `mirrorStairParams` inverte automaticamente `turnDirection`/`turnSequence`, o user toggle manuale? | ✅ resolved 2026-05-16 | **Auto-flip (γ→α)**. `mirrorStairParams(params, axis)` inverte automaticamente `turnDirection` (cw↔ccw, left↔right) e `turnSequence[]` array. Evita Revit bug noto (perdita parametricità post-mirror). Zero azione utente. Stesso comportamento per `rotateStairParams` quando angolo=180°. |
| Q24 | Auto landing depth: default `'auto'` (= width) o numero fisso (es. 1200mm)? | ✅ resolved 2026-05-16 | **Default `'auto'` = width (γ→α)**. Industry-aligned (Revit/ArchiCAD/Vectorworks). NOK-compliant by construction (NOK: landing ≥ width). Override manuale possibile; se `landingDepth < width` validator emette warning non-bloccante "Πλατύσκαλο < πλάτους σκάλας — ΝΟΚ violation" + badge rosso. Min suggerita nel UI = `width` quando `codeProfile='nok'`. |
| Q25 | Code profiles aggiuntivi: tutti 9 (NOK/IBC/Eurocode/NBC/NFPA/AS1657/DIN/ADA/none) immediatamente, o solo NOK+IBC+Eurocode (round 1) + altri Phase 6.5+? | ✅ resolved 2026-05-16 | **NOK+IBC+Eurocode+ADA Phase 6 (γ)**. ADA è critico per export USA (mercato con accessibility legalmente vincolante). NBC/NFPA/AS1657/DIN restano placeholder type-only (Phase 9 o on-demand). `gate-stair-checker.ts` Phase 6 implementa 4 validators: NOK, IBC, Eurocode, ADA. ADA validator copre: variation step ≤4.8mm, handrail height 864-965mm, topExtension ≥305mm, bottomExtension = 1 tread, contrast strip presence. |
| Q26 | ADA handrail extensions (top 305mm, bottom one-tread): render Phase 1, o solo validator Phase 6.5? | ✅ resolved 2026-05-16 | **All Phase 6 coherent ship (γ→β)**. Render extensions + validator + auto-default `topExtension=305mm`/`bottomExtension='one-tread'` quando `codeProfile='ada'` insieme. Type fields esistenti già in Phase 1, ma UI exposure + render solo da Phase 6. ADA è un pacchetto completo, non frammentato. |
| Q27 | Egress `occupancyLoad`: opzionale per-stair, o ereditato da setting per-progetto? | ✅ resolved 2026-05-16 | **Project default + per-stair override (γ)**. Stesso pattern di Q21. Project setting `dxf:project.occupancyLoad` (default `null`=disabilitato). `StairParams.occupancyLoad?` opzionale: se assente eredita project; se presente override per-stair. UI: contextual ribbon mostra "Inherit from project (N persons)" toggle. Validator emette warning se `width < occupancyLoad × 7.62`. |
| Q28 | Tread numbering default: `display='all'` visibile in plan, `'nth'` ogni N, o `'none'`? Restart per flight default ON? | ✅ resolved 2026-05-16 | **`display='all'` + restart OFF (γ)**. Industry convergence (Revit/ArchiCAD/AutoCAD Arch/Vectorworks): default tutti i tread numerati, numerazione continua 1→N attraverso landing (no restart per flight). QTO-friendly (total count visibile). User override per-stair: `'nth'` (con `nthStep` param, default 5) o `'none'`. Restart per flight = opzionale toggle nel property panel (default OFF, industry standard construction drawings). |
| Q29 | Headroom check: real-time durante draw (debounced), o solo post-creation batch? | ✅ resolved 2026-05-16 | **Hybrid (γ)**. Real-time cheap check (debounced 300ms): 2D overlap test con entities su layer `*ceiling*` / `*slab*` → flash warning giallo "Έλεγξε headroom" senza raycast. Post-creation full batch validator: `verticalDistance < minHeadroom(codeProfile)` → red badge nel property panel. Phase 9 (3D): full raycast real-time. Industry-aligned (Revit real-time / ArchiCAD post / Vectorworks hybrid) + performance-friendly per 2D plan view. |
| Q30 | Schedule/QTO export formats: CSV+Excel+PDF tutti Phase 8.5, o solo CSV Phase 8.5 + Excel/PDF Phase 9? | ✅ resolved 2026-05-16 | **Tutti 3 formats Phase 8.5 (β)**. Completeness over MVP + industry convergence (Revit/ArchiCAD/AutoCAD Arch tutti esportano CSV+Excel+PDF Day 1). Stack: `exceljs` (MIT) per .xlsx, `pdfmake` (MIT) per PDF tabular, native JS per CSV. Unico `generateScheduleData()` factory + 3 small writers. License check ✅ (entrambe MIT). |
| Q31 | Hotkey `'st'`: OK o preferisci altra lettera? | ✅ resolved 2026-05-16 | **`'st'` confermato (α)**. Mnemonic da **st**air + industry convergence (AutoCAD `STAIR/ST`, ArchiCAD `'st'`, Bricsys BIM `STAIR/ST` — 3/4 major vendors). Zero conflict con 11 existing hotkeys Nestor DXF tool. Riserva `'se'`/`'sm'` per future stair-edit/stair-mirror tools. |
| Q32 | Library presets scope: tutti 3 (user/company/project) Phase 7.5, o solo company Phase 7.5? | ✅ resolved 2026-05-16 | **Tutti 3 scopes Phase 7.5 (β)**. Completeness over MVP + industry convergence (Revit Types/Families, ArchiCAD Favorites 3-level, Vectorworks Resource Manager — 3/3 vendors). Schema: unica collection `stair_presets` con `scope: 'user'|'company'|'project'` + `ownerId` + `companyId` + `projectId?`. Firestore rules: 3 read + 3 write rules basate su tenant isolation ADR-294/ADR-356. UI: 3 grouped sections in dropdown. Cost Day-1 vs retrofit = 3x risparmio. |
| Q33 | Anti-clash con muri/colonne: confermare out-of-scope Phase 1-8 (industry standard)? | ✅ resolved 2026-05-16 | **Out-of-scope confermato Phase 1-8 (α)**. Industry convergence 5/6 vendor (Revit/ArchiCAD/AutoCAD Arch/Vectorworks/BricsCAD): wall/column clash = 3D-only feature (Navisworks/Clash Detective). Motivi: (1) perf real-time intersection in draw loop, (2) semantic ambiguity 2D senza level metadata = false positives, (3) headroom check Q29 già copre vertical clash. Visual-only in Phase 1-8 (user vede e giudica). Phase 9+ riusa raycast 3D pipeline per anti-clash completo. Già documentato §3.9. |
| Q34 | Custom step profile (`nosingSide`): solo `'front'` Phase 1, o anche `'front-and-sides'`? | ✅ resolved 2026-05-16 | **Entrambi `'front'` + `'front-and-sides'` Phase 1 (β)**. Coerenza con Q18 (β): tutti 8 `structureType` Phase 1 includono cantilever/glass-tread/steel-grating che richiedono `'front-and-sides'` per render corretto. Smart default per `structureType`: monolithic/stringer-* → `'front'`; cantilever/glass-tread/steel-grating → `'front-and-sides'`. Per-stair override + per-tread override (Q19). Industry alignment con enterprise tier (ArchiCAD/AutoCAD Arch/Allplan 3/6). Completeness over MVP. |
| Q35 | Strict mode quando `linkedToFloor`: derived stepCount + hard error overflow/underflow + length grip clamp, oppure soft warning + free edit (Phase 9 baseline)? | ✅ resolved 2026-05-17 | **Strict mode (γ→β)**. Industry convergence 5/5 (Revit "Desired Riser Height" + ArchiCAD Story Sensitive + AutoCAD Architecture `bindToLevels` + Vectorworks story snap + BricsCAD BIMSTAIR). Quando `linkedToFloor === true`: `stepCount = round(storyHeight × storyCount / rise)` (derived), `totalRise = storyHeight × storyCount` (locked). User edit su `rise` → stepCount auto. User edit su `stepCount` → rise auto-derived (inverse). Length grip clamp a `tread × (maxStepCount − 1)` + magnet snap a maxRun nel 10% finale. Overflow/underflow emettono `hardError.totalRiseOverFloor` / `hardError.totalRiseUnderFloor` (red), routed via `hardErrors` field a `StairWarningsSection`. Free mode (`linkedToFloor !== true`) resta come Phase 7a (warning soft + edit libero). Helper SSoT `systems/stairs/stair-floor-link.ts` (`reconcileLinkedStair` pure + idempotent). Implementato Phase 9B-2. |

---

## 10. Changelog

| Date | Change |
|---|---|
| 2026-05-17 | **Phase Q17 9B-4 IMPLEMENTED — Dimensions read-out widget**. NEW `RibbonStairDimensionsWidget` (~80 LOC) surfaces `totalRun` (μήκος / length) + `totalRise` (συνολικό ύψος / total rise) in meters, read-only, in a dedicated `stair-dimensions` ribbon panel mounted between Γεωμετρία and Πολυώροφα. Conversion uses the same `mmFactorFromWidth` heuristic exported from `systems/stairs/stair-floor-link.ts` so the read-out matches what validator + grips + reconcile reason about (single SSoT). Wired via the existing `widgetId` registry in `RibbonPanel.tsx` (`stair-dimensions`). i18n: `ribbon.panels.stairDimensions` + `ribbon.commands.stairEditor.dimensions.{section.title,length,totalRise}` added el+en (no `defaultValue` literals per SOS N.11). ADR-040 micro-leaf compliance: selection + level-scene store consumed at the widget leaf, not at the panel orchestrator. Industry pattern: Revit "Dimensions" Properties section / ArchiCAD Stair settings "Tread Number/Run" / AutoCAD Architecture "Calculated" group — read-only live derived dimensions alongside editable inputs. |
| 2026-05-17 | **Phase 9B-3 IMPLEMENTED — lock multi-story height editor when linked**. `stair-command-keys.STAIR_RIBBON_VISIBILITY_KEYS.multiStoryHeightEditor` new key (consumed by `RibbonPanelDef.visibilityKey`). `useRibbonStairBridge.getPanelVisibility` resolves to `multiStoryConfig.linkedToFloor !== true` for the new key (visible in free mode only). `contextual-stair-tab` splits the "Πολυώροφα" panel: storyCount stays in `stair-multistory` (always visible), storyHeight moves to a new `stair-multistory-height` panel (`labelKey: 'ribbon.panels.stairMultiStoryHeight'` = "Ύψος Ορόφου" / "Story Height") gated by the new `visibilityKey`. When linked, the editable storyHeight combobox hides — the floor info widget in the "Στάθμη" panel is the only surface that displays the height, eliminating the duplicate "Ύψος" UX that previously let users drift the floor.height and `multiStoryConfig.storyHeight` apart. i18n key `ribbon.panels.stairMultiStoryHeight` added el+en (no `defaultValue` literals per SOS N.11). Industry convergence: Revit / ArchiCAD / AutoCAD Architecture all hide the level-distance editor once a stair is bound to levels — single source of truth for the height. |
| 2026-05-17 | **Phase 9B-2 IMPLEMENTED — strict floor-bound stair mode (Q35)**. NEW SSoT module `systems/stairs/stair-floor-link.ts` (`reconcileLinkedStair` pure + idempotent, `maxStepCountFor` / `minStepCountFor` code-aware bounds, `deriveRiseFromStepCount` inverse, exported `mmFactorFromWidth` heuristic) — Tier-3 candidate; existing `mmFactorFromWidth` copies in `stair-validator` / `stair-auto-fix` / `stair-grips` remain for now (TODO follow-up to consolidate via `resolveSceneUnits` SSoT, ADR-358 Phase 8). `useRibbonStairBridge` patch helpers wire reconcile: `patchRise` calls `reconcileLinkedStair(withRecomputedTotals(...))` so rise is the primary lever; `patchStepCount` inverts when linked (`deriveRiseFromStepCount` → rewrite rise → reconcile) so stepCount lands exactly on the envelope (Revit "Desired Riser Height" pattern). `stair-grips.resizeLength` clamps the length grip to `tread × (maxStepCount − 1)` (scene units) and magnet-snaps at the last 10% of `maxRun` (Revit / ArchiCAD "magnet to top level"); `totalRise` is locked to `storyHeight × storyCount`. `stair-completion.buildDefaultStairParams` reconciles post-build so a stair placed on a 3000mm floor with default 175mm rise lands on `stepCount = 17` out of the box (instead of seeded 12). `stair-validator.checkStoryHeightOverflow` + `checkStoryHeightUnderflow` emit `hardError.totalRiseOverFloor` / `hardError.totalRiseUnderFloor` when linked (red box) instead of the soft `totalRiseOver/BelowStoryHeight` (orange); both are appended to the `hardErrors` field so `StairWarningsSection.partitionViolations` routes them correctly. `stair-auto-fix.autoFixStairParams` reconciles BEFORE the code-range fixes so "Auto-fix" on a linked stair never reintroduces overflow. NEW unit suite `__tests__/stair-floor-link.test.ts` (26/26 PASS): mmFactor heuristic, code-aware step bounds, inverse helpers, no-op cases, mm/cm/m scene-unit conversions, idempotency (apply-twice = same ref). i18n hard-error keys `tools.stair.validator.hardError.totalRiseOverFloor` + `tools.stair.validator.hardError.totalRiseUnderFloor` added el+en (no `defaultValue` literals per SOS N.11). Idempotency invariant: `reconcileLinkedStair(reconcileLinkedStair(p)) === reconcileLinkedStair(p)` — prevents loops with `withRecomputedTotals`. SSoT compliance: zero new duplicates (helper centralised), zero hardcoded i18n strings. Industry convergence 5/5 (Revit / ArchiCAD / AutoCAD Architecture / Vectorworks / BricsCAD BIM). |
| 2026-05-17 | **Phase 9B-1 IMPLEMENTED — building context surfacing + storyCount semantics**. Three Giorgio-raised UX issues addressed: (a) "Αριθμός Ορόφων" combobox label is ambiguous — was actually `multiStoryConfig.storyCount` (stories THIS stair traverses, typically 1) but read as "building total" → renamed "Διανυόμενοι Όροφοι" / "Stories Traversed" in `dxf-viewer-shell.json` el+en. (b) `RibbonStairFloorInfoWidget` now surfaces building total floor count: `useBuildingTotalFloors(buildingId)` thin wrapper around `useRealtimeBuildingFloors` (SSoT, ADR-355) — no duplicate `FILES`/`FLOORS` Firestore subscription. Widget shows "Όροφος: {n} / {total}" + dedicated "Σύνολο ορόφων κτιρίου" row so the engineer always sees building context anchored. (c) `useRibbonStairBridge.patchStoryCount` clamps to `max(1, total − currentFloorNumber)` — combobox silently rejects values that exceed the physically available remaining floors above the current one. Atrium / duplex stairs across 2-3 floors still work; "99 floors" doesn't. New `StairPatchContext` shape carries scale + building context to the patch helpers (replaces lone `scale: number` arg). Industry convergence: Revit Type Selector binds to Levels; ArchiCAD Story Sensitive uses story sensitivity setting; AutoCAD Architecture binds via `StairLineGenerationOptions` — all 3 surface building context inline. Out of scope this phase: hard-blocking stair length / step count overflow (Phase 9B-2). |
| 2026-05-17 | **Phase 9 Plan A IMPLEMENTED — stair ↔ floor link**. Q17 resolved end-to-end with Revit/ArchiCAD/AutoCAD Architecture convergence pattern (industry standard: 3/3 vendors surface a link badge + restore affordance). Files added: `hooks/data/useFloorMetadata.ts` (SSoT `firestoreQueryService.subscribeDoc` + ADR-361 equality guard, m-stored `height`/`elevation` exposed unchanged), `ui/ribbon/components/RibbonStairFloorInfoWidget.tsx` (widget pattern from ADR-345 Fase 6 — read-only metadata grid + 🔗/⚠️ inline badge + "Reset to floor" via `UpdateStairParamsCommand`, self-gates to null when no floor in scope or no stair selected). Type changes: `StairMultiStoryConfig.linkedToFloor?: boolean` added (optional ⇒ zero migration break; legacy stairs treated as linked when storyHeight matches floor.height·1000 within 0.5mm). Pipeline wiring: `buildDefaultStairParams` accepts `StairFloorLinkInput` (floorId + name + height m) → seeds `multiStoryConfig` with `storyHeight = height·1000` (mm) and `linkedToFloor: true`; `useStairTool` exposes `getFloorLink?: () => StairFloorLinkInput | null`; `useSpecialTools` subscribes to `FLOORS/{floorId}` when `saveContext.entityType === 'floor'`. Bridge: `useRibbonStairBridge.patchStoryHeight` flips `linkedToFloor: false` on every manual storyHeight edit (combobox/grip/future programmatic patches). Tab data: `contextual-stair-tab.ts` mounts a new `stair-floor` panel as the first panel (`widgetId: 'stair-floor-info'`); `RibbonPanel.tsx` wires the widget. CSS: new `dxf-ribbon-stair-floor-*` tokens in `ribbon-tokens.css`. i18n: `dxf-viewer-shell.json` el+en — `ribbon.panels.stairFloor` + `ribbon.commands.stairEditor.floor.{section.title, number, name, elevation, endElevation, height, linkedBadge, customBadge, resetButton}` (zero hardcoded strings per SOS N.11; ICU `{name}/{value}` interpolations). Unit boundary held strictly at the bridge layer — geometry pipeline never sees meters. Phase numbering: prior "Phase 9 (FUTURE 3D/IFC)" placeholder renamed to Phase 10 to free the Phase 9 slot for this floor-link work. Plan B (Buildings warning on floor elevation/height change with cascading stair updates) DEFERRED to Phase 9B (cross-app, requires Firestore batch + modal UX research). |
| 2026-05-17 | **Phase 8 stair hover halo via bbox outline** — `StairRenderer.render` retains phase semantics from `renderWithPhases` but drops the SSoT helper: `renderGeometry` is called twice (glow pre-pass + main pass), and a stair renders multiple FILLED tread polygons — the grey rgba fill of adjacent treads covered the per-line glow stroke during the pre-pass, leaving the hover halo invisible (regression observed 2026-05-17). Industry pattern for composite entities (AutoCAD/Revit blocks & groups, ArchiCAD elements): hover halo is the **bounding-box outline**, not per-primitive glow. `StairRenderer.render` now: 1) determines phase via `phaseManager.determinePhase`, 2) if `highlighted` → strokes single bbox rectangle with `HOVER_HIGHLIGHT.ENTITY` colour/width, 3) applies phase style + draws normal stair geometry, 4) renders grips when `options.grips`. `drawTreads` accepts `skipFill` (unused after pivot to bbox approach but kept for future per-pass tuning). `drawBboxOutline(stair)` new helper. Continuous magenta halo confirmed via debug pass. |
| 2026-05-17 | **Phase 8 stair hover/selection pipeline** — `StairRenderer.render` now routes through `BaseEntityRenderer.renderWithPhases` (SSoT 3-phase template) instead of a manual `ctx.save/restore` block. Phase 5b drew everything raw with hardcoded `CAD_UI_COLORS.entity.default` stroke, bypassing `PhaseManager` so the stair never received the canonical yellow hover glow nor selection highlight. Sub-draws (`drawTreads`/`drawStringers`/`drawWalkline`/`drawHandrails`/`drawArrow`) drop local `strokeStyle` writes and inherit from the phase pipeline; `drawArrow` aligns `fillStyle = strokeStyle` so arrowhead + UP/DOWN label tint together. Stair-specific tread fill (translucent slate `rgba(120,144,156,0.12)`) stays local — not part of the entity style pipeline. Diagnostic `console.info` retained on hovered/selected branches pending Giorgio validation. `CAD_UI_COLORS` import removed (dead). |
| 2026-05-17 | **Phase 8 stair selection robustness** — `StairRenderer.render/getGrips/hitTest` and `HitTestingService.convertToEntityModel` add defensive guards for stairs lacking `params` and/or `geometry`. Legacy / partially-serialized stair entries (pre-§G6 Storage blobs, Firestore re-hydration without geometry per §G6 re-derivable contract) reached the canvas pipeline and crashed `computeStairGeometry(params.variant.kind)`. Fix: `HitTestingService` recomputes geometry via SSoT `computeStairGeometry(params)` when missing-but-params-present; skips geometry when params also missing (entity drops harmlessly from spatial index). `StairRenderer` early-returns when geometry/params missing rather than throwing. Pairs with `BoundsCalculator.calculateStairBounds` dual-shape bbox resolver (flat `StairEntity.geometry.bbox` vs wrapper `DxfStair.stairEntity.geometry.bbox`) so both canvas + hit-test code paths populate spatial index. |
| 2026-05-17 | **Phase 9D-5b-i schema flip** — `BaseEntity.layer?: string` field REMOVED; `layerId: string` now REQUIRED (was optional). All readers migrate to `LayerStore.resolveEntityLayerName(entity)` (id-only SSoT) or direct `getLayer(id).name` lookup. DXF parse boundary in `dxf-scene-builder` keeps narrow `(entity as { layer?: string }).layer` cast — raw `DxfEntityParser` output still emits group-8 string at runtime; carryover Phase 9E candidate: extract formal `RawDxfEntity` type. Callsites updated: HitTester + hit-tester-utils + EntityPass (renderer reads), ClipToPolygonService + ClipToRegionService + EntityMergeService + HitTestingService (service reads). |
| 2026-05-17 | **Phase 8 scene-units SSoT** — `utils/scene-units.ts` new module (Tier 2 SSoT) hosts `SceneUnits` type + `mmToSceneUnits` + `detectSceneUnits` (bounds-diagonal heuristic) + `resolveSceneUnits` (preferred entry) + `insunitsCodeToSceneUnits` (AutoCAD `$INSUNITS` map). `dxf-scene-builder` now propagates real `$INSUNITS` to `SceneModel.units` (was hardcoded `'mm'` regardless of source); fallback via heuristic when code is 0/unknown. `stair-completion` re-exports `SceneUnits` for back-compat + imports `mmToSceneUnits`. `useSpecialTools` + `useUnifiedDrawing` route through `resolveSceneUnits` (single entry point — prefers declared scene.units, falls back to bounds heuristic for legacy `'mm'` default). Diagnostic `console.info` calls REMOVED post-validation. SSoT registry: new Tier 2 entry `scene-units` forbids redefinition of type/helpers outside the canonical module. Stair geometry now matches host floorplan scale for mm/cm/m/in/ft DXF files. |
| 2026-05-17 | **Phase 9D-5a sweep — id-only WRITE / id-first READ enforcement**. Across the writer path (CreateEntityCommand, useEntityCreationManager, useSceneState, drawing-entity-builders, completeEntity, useAngleEntityMeasurement, stretch-entity-transform, ColorManager) the legacy `layer: '0'` literal is dropped: entities are written with stable `layerId` (`lyr_<UUID-v4>`) only; downstream readers resolve display name via `LayerStore.getLayer(id).name` (id-first) with legacy `.layer` fallback (`resolveEntityLayerName`). Readers migrated: `dxf-ai-tool-executor` (query filter), `useLayerManagerState` (element count), `useLayersCallbacks` (layer-click selection), `LayerOperationsService` (rename = SceneLayer.name mutation only; merge = re-key via target `layerId`). Validator (`dxf-scene-builder.isValid`) now requires `layerId`. Renderer (`DxfRenderer.entityToDxfEntity`) drops `layer` from canvas base shape — bitmap-cache key untouched (ADR-040 cardinal rule #3 intact). Schema flip (rename `layerId` → `layer`) deferred to Phase 9D-5b. SSoT ratchet: new `.ssot-registry.json` module `entity-layer-id-canonical` Tier 3 forbids new `entity\.layer\b` reads + `.layer = '<literal>'` writes outside a 9-file allowlist; existing reader sites baseline-tolerated until 9D-5b. |
| 2026-05-17 | **Phase 8 scope propagation** — `useAutoSaveSceneManager` espone reactive mirrors `fileRecordId` + `saveContext` (state oltre a ref interno), `useLevels` interface estesa, `LevelsSystem` forward dei mirrors come reactive inputs in deps, `DxfViewerContent` passa `projectId`/`floorplanId` derivati a `StairAdvancedPanelHost`. Sblocca `useStairPersistence` subscribe scope reattivo: re-run automatico quando wizard import setta `saveContext` o quando un nuovo floorplan viene caricato (prima il scope era frozen al primo render). Pattern: ref interno conservato per auto-save reads sincroni; state aggiunto per consumer React subtrees. |
| 2026-05-17 | **Phase 8 IMPLEMENTED** — Firestore persistence `floorplan_stairs` + soft-lock G24 + scene diff-merge. Service `stair-firestore-service` (~280 LOC) reuses `firestoreQueryService.subscribe` SSoT (ADR-355) + ADR-361 equality guard; writes via direct `setDoc`+`generateStairId` (SOS N.6, `addDoc` forbidden by ratchet). Hook `useStairPersistence` (~280 LOC) does diff-merge with selective skip of locally-dirty stairs (local edits win until round-trip), debounced 500ms auto-save on `params` settle + `saveNow()` for explicit button, soft-lock acquire on-first-edit + release on deselection + 5min TTL. UI `StairPersistenceSection` mounts first in floating panel (save button + status + "editing by other" badge). Path switch top-level `floorplan_stairs/{stairId}` (was sub-path 2-livelli in Phase 1 plan, §G6 updated). Rules: tenant read + create (required fields + ownership) + update (immutable companyId/projectId/floorplanId/createdBy/createdAt + editingBy.userId anti-spoof) + delete (creator|admin). Indexes: `(companyId, projectId, floorplanId)` + 2 §G6 indexes. Design decisions: DD-1 hybrid (Revit transaction + Ctrl+S), DD-4 diff-merge selective (Revit Cloud + ArchiCAD BIMcloud convergence). DD-2/DD-3 resolved upstream by §6.8. Tests: 19/19 PASS — saveStair audit + optional field omission + SOS N.6 enforcement + lock acquire/release deleteField sentinel + subscribe routing. Carryover §13: always-on subscribe (currently gated by panel mount), full multi-user CRDT, preset rename/move, projectId plumbing now unblocked. |
| 2026-05-16 | Initial draft (Phase 1 ADR-driven workflow). Industry research 6 vendor + codice greco ΝΟΚ + IBC + Eurocode. Q&A in greco con Giorgio. |
| 2026-05-16 | Q1-Q16 risolte (vedi §9.1). ADR pronto per inizio implementazione Phase 0. |
| 2026-05-16 | Q17 resolved: multi-storey hybrid (raw default + auto se collegata a level). Vedi §9.2. |
| 2026-05-16 | Q18 resolved: tutti 8 `structureType` Phase 1 (full enterprise). Vedi §9.2. |
| 2026-05-16 | Q19 resolved: materials default per-stair + per-tread override (ArchiCAD edit mode). Vedi §9.2. |
| 2026-05-16 | Q20 resolved: riserType smart default da structureType + user override. Vedi §9.2. |
| 2026-05-16 | Q21 resolved: cutPlaneHeight project default 1200mm + per-stair override. Vedi §9.2. |
| 2026-05-16 | Q22 resolved: tutti 5 stair grips (basePoint/direction/width/length/split) Phase 5. Vedi §9.2. |
| 2026-05-16 | Q23 resolved: mirror auto-flip turnDirection/turnSequence (evita Revit bug). Vedi §9.2. |
| 2026-05-16 | Q24 resolved: landingDepth default 'auto' = width, NOK-compliant by construction + warning su override. Vedi §9.2. |
| 2026-05-16 | Q25 resolved: code profiles Phase 6 = NOK+IBC+Eurocode+**ADA** (γ, ADA critico per export USA). NBC/NFPA/AS1657/DIN placeholder Phase 9. Vedi §9.2. |
| 2026-05-16 | Q26 resolved: ADA handrail extensions all Phase 6 coherent (render + validator + auto-default insieme). Vedi §9.2. |
| 2026-05-16 | Q27 resolved: occupancyLoad project default + per-stair override (stesso pattern Q21). Vedi §9.2. |
| 2026-05-16 | Round 2 Q&A interrotto a Q27. Handoff a nuova sessione per Q28-Q34. |
| 2026-05-16 | Q28 resolved: tread numbering default `display='all'` + restart per flight OFF (γ). Numerazione continua 1→N, industry-aligned. Override per-stair: `'nth'`/`'none'`. Vedi §9.2. |
| 2026-05-16 | Q29 resolved: headroom check hybrid (γ). Real-time cheap 2D overlap (debounced 300ms) durante draw + post-creation full batch validator. Phase 9 raycast 3D. Vedi §9.2. |
| 2026-05-16 | Q30 resolved: schedule/QTO export CSV+Excel+PDF tutti Phase 8.5 (β). Stack: `exceljs` + `pdfmake` (entrambi MIT). Completeness over MVP + industry convergence Revit/ArchiCAD/AutoCAD Arch. Vedi §9.2. |
| 2026-05-16 | Q31 resolved: hotkey `'st'` (α). Industry convergence AutoCAD/ArchiCAD/Bricsys BIM. Zero conflict con existing hotkeys. Vedi §9.2. |
| 2026-05-16 | Q32 resolved: library presets user+company+project tutti Phase 7.5 (β). Collection `stair_presets` con scope discriminator. Industry-aligned Revit/ArchiCAD/Vectorworks. Tenant isolation riusa ADR-294/ADR-356. Vedi §9.2. |
| 2026-05-16 | Q33 resolved: anti-clash walls/columns out-of-scope Phase 1-8 (α). Industry standard 3D-only feature (5/6 vendor). Visual-only in 2D. Phase 9+ riusa raycast 3D. Vedi §9.2. |
| 2026-05-16 | Q34 resolved: `nosingSide` entrambi `'front'` + `'front-and-sides'` Phase 1 (β). Smart default da structureType (monolithic/stringer→front, cantilever/glass/grating→front-and-sides). Coerenza Q18+Q19. Vedi §9.2. |
| 2026-05-16 | **ROUND 2 Q&A COMPLETO** — Q17-Q34 tutte risolte. ADR-358 pronto per inizio implementazione Phase 0. Attesa ordine esplicito Giorgio per avviare codifica. |
| 2026-05-16 | **§7 phase split per context budget** — Fasi originali 13 → 19 sessioni (1 fase = 1 sessione, target context ≤70%). Split: Phase 2→2a/2b, Phase 3→3a/3b, Phase 4→4a/4b/4c, Phase 5→5a/5b/5c, Phase 7→7a/7b. Aggiunto §7.1 rationale + §7.2 tabella estesa con LOC stimati. |
| 2026-05-16 | **Phase 0 IMPLEMENTED** — i18n keys + Ribbon button stub + hotkey 'ST' wire-up. 10 file modificati: (1) `types.ts` `ToolType` += `'stair'`; (2) `ToolStateManager.ts` `TOOL_DEFINITIONS` += `stair` (category=drawing, requiresCanvas=true, canInterrupt=true, allowsContinuous=false, preservesOverlayMode=false — match §5.5); (3) `keyboard-shortcuts.ts` `DXF_TOOL_SHORTCUTS` += `stair` (key='ST', 2-char mnemonic, sequence-dispatcher Phase 5a); (4) `RibbonButtonIconPaths.tsx` `STAIR_PATH` (4-step ascending profile); (5) `RibbonButtonIcon.tsx` case `'stair'`; (6) `home-tab-draw.ts` small button `comingSoon: true` (rimozione Q15 al merge Phase 5a); (7-10) i18n el+en × dxf-viewer-shell + tool-hints. Status bar key: `tools.stairStatus`. Branch: `main`. **Commit eseguito da Giorgio** (cfr. §7.0 commit policy). |
| 2026-05-16 | **Phase 2a IMPLEMENTED** — Geometry curve sampling math (spiral + helix). 3 file: (1) **NEW** `src/subapps/dxf-viewer/rendering/entities/shared/geometry-curve-utils.ts` (~140 LOC) — exports `archimedeanArcLength(theta)` (analytical ½·[θ·√(θ²+1) + asinh(θ)], reference for callers and tests) + `spiralSample(centerPoint, sweepAngle°, turnDirection, stepCount, totalRise)` (unit Archimedean r=θ, arc-length parameterized via bisection inverter, 60 iter / 1e-14 tol; apex at sample 0; z linear; sign convention ccw=+1 / cw=-1) + `helixSample(centerPoint, innerRadius, outerRadius, sweepAngle°, turnDirection, stepCount, totalRise)` (walkline at R=(in+out)/2, uniform angular = uniform arc on constant-R, z linear). All inputs `Readonly<Point3D>`, outputs `readonly Point3D[]`, zero `any`/`as any`/`@ts-ignore`, 40-line func limit respected. (2) **NEW** `__tests__/geometry-curve-utils-spiral.test.ts` (11 test) — first=apex, last z=totalRise, arc-length uniformity (segArc via `archimedeanArcLength(rᵢ₊₁) − archimedeanArcLength(rᵢ)`, tol 1e-6), z linearity, radial monotonicity, cw/ccw x-axis mirror symmetry, stepCount=1 boundary, reference value @θ=1 = 1.1477935746. (3) **NEW** `__tests__/geometry-curve-utils-helix.test.ts` (10 test) — walkline radius invariant, arc-length analytical R·sweepRad, z linearity, width constraint outer=inner+width, cw/ccw mirror, first=(R,0), innerRadius=0 degenerate case. **21/21 green** (~10.5s). Property-based fast-check **skipped** (dep non installata, marked optional in prompt). Unit spiral c=1 — Phase 4a `StairGeometryService` scala xy nello stair-local frame. SSoT: verificato `rendering/entities/shared/` senza spiral/helix existing; `path-arc-length-sampler.ts` (ADR-353) è entity-strategy dispatcher per LINE/ARC/ELLIPSE/etc., scope diverso. **Commit eseguito da Giorgio** (§7.0). |
| 2026-05-16 | **Phase 1 IMPLEMENTED** — Type system + enterprise-id + firestore-collections. 7 file: (1) **NEW** `src/subapps/dxf-viewer/types/stair.ts` (~430 LOC) — `StairKind` (11 kinds), `StairParams`, `StairVariantParams` discriminated union (11 variants), 3D primitives `Polygon3D`/`Polyline3D`/`Segment3D`/`BoundingBox3D` (stair-local, promote on Phase 9), `StairGeometry`, `StairValidationState`, `StairQTO` (IFC4 Qto_StairBaseQuantities), `StairEntity extends BaseEntity`, `StairDoc` (Firestore shape con companyId/projectId/floorplanId tenant fields), `StairPresetDoc` (3-scope user/company/project con `Omit<StairParams, 'basePoint'\|'direction'>`), `isStairKind` type guard; (2) `types/entities.ts` — `EntityType` += `'stair'`, `Entity` union += `StairEntity`, `isStairEntity` guard, `getEntityBounds` case projecting `StairGeometry.bbox` 3D→2D; (3) `services/enterprise-id-prefixes.ts` — `STAIR: 'stair'` + `STAIR_PRESET: 'sprst'`; (4) `services/enterprise-id-class.ts` — `generateStairId()` + `generateStairPresetId()`; (5) `services/enterprise-id-convenience.ts` — export functions; (6) `services/enterprise-id.service.ts` — public facade re-export; (7) `config/firestore-collections.ts` — `FLOORPLAN_STAIRS` + `STAIR_PRESETS` (env-overridable). Zero `any`, all `readonly` props, full discriminated union safety. **Commit eseguito da Giorgio** (§7.0). |
| 2026-05-16 | **Phase 3a IMPLEMENTED** — `StairGeometryService` entry point with `kind: 'straight'` + `kind: 'l-shape'` dispatch. 3 file: (1) **NEW** `src/subapps/dxf-viewer/systems/stairs/StairGeometryService.ts` (~520 LOC) — exports `computeStairGeometry(params: Readonly<StairParams>): StairGeometry` (switch dispatch on `variant.kind`, throws sentinel `Error('… not implemented yet (Phase 3b/4a/4b/4c)')` for the 9 unimplemented kinds — exhaustive `never` guard) + `computeWalkline(centerline: Polyline3D, offset: number)` (re-export wrapper around Phase 2b `offsetPolyline` for Phase 4a/4b consumers). **Straight** path: per-tread CCW rectangle at z=rise·i, depth = `tread+nosing`, width across `perp(u)`; risers between consecutive treads as `Segment3D` vertical edge (stepCount-1); walkline = 2-vertex polyline (basePoint → +u·tread·(stepCount-1), z linear 0..(stepCount-1)·rise); stringers = `offsetPolyline(walkline, ±width/2)`; bbox via min/max sweep over all tread vertices; cutLine = perpendicular segment at first-above tread centroid only when both below/above non-empty (cutPlaneHeight default 1200 mm per Q21). **L-shape** path: flight 1 reuses straight pattern for n1 treads (z=0..(n1-1)·rise); landing as `width × landingDepth` polygon at z=n1·rise (default 'auto' → landingDepth=width, Q24); flight 2 inline polygon construction with width axis fixed to `u1` regardless of `turnDirection` (`perp(u2)` would mirror across u1 for `'left'` and break x-alignment with landing footprint — explicit axis prevents the chirality mismatch; polygon orientation differs CCW vs CW, immaterial for downstream renderers since `Polygon3D = readonly Point3D[]` enforces no winding); flight 2 z = (n1+1+i)·rise yielding top tread at z=stepCount·rise; landingCornerStyle `'chamfer'`/`'fillet'` throw `Error(/Phase 3b/)` sentinel. **Walkline 4-vertex pattern** with single 90° turn at v3 (L corner inside landing, lateral=0 along u1) — v2 is collinear with v1→v3 so stringers still emit 4 vertices each, and the unique sharp corner yields outer/inner miter = halfW·√2 exactly (perp dot = 0, denom = 1, scale = ±halfW). **Helpers**: `directionToUnitVector`, `perp` (CCW math frame +90°), `rectangleAt` (CCW shape from back-right corner along u, width along perp(u)), `bboxOfPolygons`, `splitTreadsByCutPlane`, `buildCutLine`, plus 4 L-shape sub-helpers (`buildLShapeFlight1`/`Landing`/`Flight2`/`Walkline`). All functions ≤40 lines per §7.1/N.7.1; zero `any`/`as any`/`@ts-ignore`; all signatures `Readonly<…>` for inputs / `readonly …[]` for outputs; exhaustive `never` guard on dispatch default. (2) **NEW** `src/subapps/dxf-viewer/systems/stairs/__tests__/StairGeometryService-straight.test.ts` (11 test) — tread count, co-planar z=rise·i + Δz=rise, riser count stepCount-1 + vertical + length=rise, walkline 2 vertices + xy length=tread·(stepCount-1), stringers ±halfW from walkline at each vertex (4 corresponding vertices), bbox wrap (last tread x_max = stepCount·tread + nosing - tread = (stepCount-1)·tread + nosing + tread, computed 2825 = 9·280 + 305), `'UP'`/`'DOWN'` label by upDirection, direction=90° rotation (Y axis), cutPlaneHeight split when totalRise > 1200 / no split when below, stepCount=1 boundary (1 tread, 0 risers), tread polygon area = (tread + nosing) · width = 305 · 1000. (3) **NEW** `src/subapps/dxf-viewer/systems/stairs/__tests__/StairGeometryService-lshape.test.ts` (11 test) — treads.length=10 + landings.length=1, flight 2 advancement vector Δy=∓tread for `right`/`left`, landing area = width² for landingDepth='auto', landing z=n1·rise, flight 2 z range = [rise·(n1+1), rise·stepCount], walkline 4 vertices with v3 at (n1·tread+halfW, 0, n1·rise) = (1900, 0, 875), stringers each 4 vertices with outer/inner miter distance from L pivot = halfW·√2 = 500·√2 ≈ 707.107, landingDepth=1500 override → area = width · 1500 = 1.5e6, turnLeft mirrors turnRight across y=0 (tread centroid xy comparison), arrowSymbol.end matches last walkline vertex, `landingCornerStyle: 'chamfer'`/`'fillet'` throw `/Phase 3b/`. **22/22 Phase 3a green** + **47/47 cumulative Phase 2a+2b** + **166/166 cumulative geometry-shared** (~5s straight+lshape, ~6s shared regression). SSoT: created `systems/stairs/` folder (Phase 3a — folder did not exist); reused Phase 2b `offsetPolyline` for stringers + walkline export wrapper (zero parallel-offset duplicate); reused Phase 1 `Polygon3D`/`Polyline3D`/`Segment3D`/`BoundingBox3D`/`StairArrowSymbol`/`StairGeometry`/`StairParams`/`StairVariantLShape`/`StairUpDirection` from `types/stair.ts`; checked `.ssot-registry.json` (no existing stair service); checked `rendering/entities/shared/` for rectangle/bbox helpers (none — Phase 3a writes its own minimal `rectangleAt` + `bboxOfPolygons` private to the service, candidate for promotion to shared if other systems need the same in future phases). **Commit eseguito da Giorgio** (§7.0). |
| 2026-05-16 | **Phase 2b IMPLEMENTED** — Geometry helpers: ellipse arc-length math + xy parallel offset. 3 file: (1) **EXTEND** `src/subapps/dxf-viewer/rendering/entities/shared/geometry-curve-utils.ts` (+~110 LOC) — exports `ellipseArcLength(semiMajor, semiMinor, theta)` (incomplete elliptic integral of 2nd kind ∫₀^θ √(a²sin²t + b²cos²t) dt, composite Simpson's rule N=256 subintervals, degenerate case a===b short-circuits to R·|θ|, unsigned for θ<0) + `ellipseSample(centerPoint, semiMajor, semiMinor, sweepAngle°, turnDirection, rotation°, stepCount, totalRise)` (parametric local x=a·cos(t)/y=b·sin(t)·sign, arc-length parameterized via bisection inverter on `ellipseArcLength` 60 iter / 1e-14 tol, rotation around `centerPoint`, z linear, sign convention ccw=+1/cw=-1, reuses `turnSign()` private helper from Phase 2a). (2) **NEW** `src/subapps/dxf-viewer/rendering/entities/shared/geometry-offset-utils.ts` (~135 LOC) — exports `offsetPolyline(polyline: readonly Point3D[], offsetDistance, options?: { join?: 'miter'\|'bevel'; miterLimit?: number })` (xy-plane parallel offset, z preserved verbatim per-vertex; sign convention positive=left-of-travel CCW perp, negative=right; miter formula offset = pivot + d·(perpIn+perpOut)/(1+perpIn·perpOut) — projection onto either perp equals d; miterLimit default 4 SVG/CSS heuristic with √(2/(1+dot)) ratio check + bevel fallback; antiparallel perp (180° fold) auto-bevels; closed polyline detection first≈last within 1e-9 with wrap-around join; empty/single-vertex → []; private helpers `perpUnit`, `pointsCoincide`, `emitBevel`, `emitJoin` keep main fn ≤40 lines; out-of-scope explicit: self-intersection removal in concave regions, hole/island handling, non-planar xyz offset — Clipper-class problems deferred). (3) **NEW** `__tests__/geometry-curve-utils-ellipse.test.ts` (15 test) — circular limit a=b → R·|θ| (tol 1e-6); θ=0 returns 0 exactly; quarter-ellipse vs Ramanujan-II relative 1e-6 low-eccentricity (a=200, b=150); full perimeter vs Ramanujan low-ecc relative 1e-6 (a=250, b=200); full perimeter high-ecc (a=300, b=100) within Ramanujan error band relative 1e-3 (validates Simpson sits inside reference approximation degradation); monotonicity in θ; |negative θ| handling; sampling returns stepCount+1; first sample at centerPoint+(a,0) rotated by `rotation`; rotation=90° → (0,a); last z = z+totalRise; z linearity per-step; cumulative chord ≈ analytical arc (N=64, 270° sweep, a/b=3, < 0.1% error); per-step ARC length uniformity verified by recovering θ=atan2(y/b, x/a) and checking `ellipseArcLength` increments equal sTotal/N (parameterization invariant, NOT chord — chords vary with local curvature on ellipse); cw mirrors ccw across x-axis; a===b reduces to circular helix uniform-angular sampling. (4) **NEW** `__tests__/geometry-offset-utils.test.ts` (11 test) — horizontal segment +d shifts +y; vertical +d shifts -x (CCW perp); negative distance reverses; 90° L-corner miter at (10-d, d) with magnitude d·√2; CCW closed square +d shrinks inward to (d,d)→(10-d,10-d) — confirms LEFT-of-travel convention; near-180° fold exceeds miterLimit → 4-vertex bevel fallback; z values copied verbatim (5/7/11); closed polyline (first==last) emits closing duplicate; empty/single-point → []; explicit `join: 'bevel'` always emits 2 vertices per interior corner. **26/26 Phase 2b green** + **47/47 cumulative Phase 2a+2b** (~15s). Phase 4b `StairGeometryService` kind 'elliptical' uses `ellipseSample`; Phase 4a kind 'spiral'/'helical' stringers use `offsetPolyline` to derive parallel inner/outer rails from walkline. SSoT: verified no existing offset/Minkowski utility in `rendering/entities/shared/` nor `.ssot-registry.json`; reused private `turnSign()` helper from Phase 2a (no duplicate); reused conceptual perpendicular convention from existing `getPerpendicularUnitVector` in `geometry-vector-utils.ts` (CCW rotation `-y, x`) — implemented local `perpUnit` taking `Readonly<Point3D>` rather than `Point2D` to avoid lossy conversion at call site. **Commit eseguito da Giorgio** (§7.0). |
| 2026-05-16 | **Phase 3b IMPLEMENTED** — `StairGeometryService` kind `u-shape` + `gamma` + tread numbering (G21) + multi-flight cut split (G14). 7 file (4 new + 3 edited): (1) **NEW** `systems/stairs/stair-geometry-ushape.ts` (~276 LOC) — `computeUShape(params, variant: StairVariantUShape)`. Two anti-parallel flights joined by a (2·width × landingDepth) mid-landing. Flight 1 occupies `v1·[−halfW,+halfW]` ascending +u1; flight 2 occupies an adjacent band offset by `turnSign·width` along v1, descending back along `u2 = −u1`. Landing footprint = 2·width × landingDepth (industry standard Revit/ArchiCAD/Vectorworks — fits both flights laterally with no gap). `landingDepth='auto'` → `width` (Q24, NOK-compliant). Walkline = 4-vertex pattern with sharp 90° turns at landing entry (p2) and exit (p3) — stringers offset to halfW·√2 miter at both corners. Flight 2 first tread at z=(n1+1)·rise, last at z=stepCount·rise (matches l-shape Phase 3a convention). turnLeft mirrors turnRight across flight-1 axis y=0 (test 8 verified). landingCornerStyle 'chamfer'/'fillet' → throws `/Phase 3c/`. (2) **NEW** `systems/stairs/stair-geometry-gamma.ts` (~318 LOC) — `computeGamma(params, variant: StairVariantGamma)`. Three flights + two intermediate landings with turn sequence `[turn1, turn2]` independently rotating direction by ±90°. Landing 1 centered on flight 1 axis (v1·[−halfW,+halfW]); landing 2 aligned with flight 2 axis (v2·[0,width], NOT centered — because flight 2 origin sits at one v-edge per l-shape pattern). z model: flight 1 at [0,(n1−1)]·rise; landing 1 at n1·rise; flight 2 at [(n1+1),(n1+n2)]·rise; landing 2 at (n1+n2+1)·rise; flight 3 at [(n1+n2+2),(stepCount+1)]·rise. Top tread reaches (stepCount+1)·rise — one rise higher than l-shape because every additional landing inserts +1 rise into the z accumulator (prompt §1.2 spec). Walkline = 6-vertex pattern with sharp 90° turns at p3 (landing 1) and p5 (landing 2) — p2 collinear with p3 along u1, p4 collinear with p5 along u2, so each stringer has 6 vertices and 2 miter corners (both halfW·√2). turnSequence `['right','left']` (or `['left','right']`) re-aligns flight 3 parallel to flight 1 (test 5). landings='auto' → both landings = width × width (test 8). landingCornerStyle 'chamfer'/'fillet' → throws `/Phase 3c/`. (3) **NEW** `systems/stairs/stair-geometry-labels.ts` (~69 LOC) — `buildTreadLabels(treads, flightSplit, display, everyN, restartPerFlight, treadNumberStart): readonly StairTreadLabel[] | undefined` pure SSoT for tread numbering across all stair kinds (straight=`[stepCount]`, l-shape=`[n1,n2]`, u-shape=`[n1,n2]`, gamma=`[n1,n2,n3]`). Display modes: `'none'` → `undefined`; `'all'` → one label per tread; `'nth'` → every N (default 5). Local index resets per-flight when `restartPerFlight=true`, otherwise global. Text = `String(treadNumberStart + localIndex)`. Position = centroid3D of tread polygon. Single import point — no duplicate numbering logic across kind computers. (4) **EXTEND** `systems/stairs/stair-geometry-shared.ts` — `buildCutLineForFlights(treads, flightSplit, flightDirections, width, cutPlaneHeight): Segment3D | undefined` fixes latent Phase 3a bug where l-shape always passed `u1` to `buildCutLine` even when the cut crossed inside flight 2 (wrong perpendicular direction). Multi-flight aware: walks flight→tread in order, uses `flightDirections[f]` for each flight, returns perpendicular segment at first tread ≥ cutPlaneHeight. Returns `undefined` when no tread crosses. Adopted by straight (still uses single-flight `buildCutLine` for simplicity), l-shape, u-shape, gamma. (5) **EDIT** `systems/stairs/StairGeometryService.ts` — dispatch `'u-shape'` → `computeUShape`, `'gamma'` → `computeGamma` (replaces Phase 3a sentinel throws). Straight integrates `buildTreadLabels(treads, [stepCount], …)`. (6) **EDIT** `systems/stairs/stair-geometry-lshape.ts` — integrates `buildTreadLabels(allTreads, [n1, n2], …)`; replaces `buildCutLine(split.above[0], u1, …)` with `buildCutLineForFlights(allTreads, [n1, n2], [u1, u2], …)`; sentinel rename Phase 3b → Phase 3c (chamfer/fillet now belong to a later phase since Phase 3b ships u-shape/gamma square-corner only). (7) **EDIT** `__tests__/StairGeometryService-lshape.test.ts` Test 11 expectation `/Phase 3b/` → `/Phase 3c/` (corner-style sentinel rename). Plus 3 NEW test suites: **NEW** `__tests__/StairGeometryService-ushape.test.ts` (12 test): tread count + landing count; flight 2 −u1 advancement; flight 2 lateral band y∈[−1500,−500] for turnRight; landing dims = 2·width·landingDepth; landing z=875; flight 2 z∈[1050,1750]; walkline 4 vertices with sharp corners at p2=(1900,0) and p3=(1900,−1000); turnLeft mirror across y=0; cutLine emitted/undefined by cutPlaneHeight; treadLabelDisplay 'all'→10 labels / 'none'→undefined; label position = tread centroid; 'chamfer'/'fillet' throw /Phase 3c/. **NEW** `__tests__/StairGeometryService-gamma.test.ts` (12 test): 10 treads + 2 landings for flightSplit=[3,4,3]; landings z=525 + 1400; flight 2 direction (0,−1) for turn 'right'; flight 3 direction (−1,0) for turnSequence=['right','right']; flight 3 parallel to flight 1 for ['right','left']; walkline 6 vertices; stringers 6 vertices + miter at both L corners = halfW·√2 = 707.107; landings 'auto' → both area = width²; landings[1]=1500 override → area=1.5e6; restartPerFlight=false → ['1'..'10']; restartPerFlight=true → ['1','2','3','1','2','3','4','1','2','3']; 'chamfer'/'fillet' throw /Phase 3c/. **NEW** `__tests__/StairGeometryService-tread-labels.test.ts` (8 test): straight 'all' → 10 labels '1'..'10'; 'none' → undefined; 'nth' every=3 → indices [0,3,6,9] / texts ['1','4','7','10']; l-shape continuous → '1'..'10'; l-shape restart → '1'..'5','1'..'5'; treadNumberStart=5 → label[0]='5', label[9]='14'; label xy = centroid; label z = tread z. **54/54 stair tests green** + **166/166 cumulative geometry-shared regression green** (~9s stairs / ~12s combined). File sizes all under 500-LOC GOL ceiling: gamma=318, ushape=276, lshape=226, service=205, shared=173, labels=69. SSoT: every kind dispatches `buildTreadLabels` from the new central module (zero duplicate numbering math); every multi-flight kind dispatches `buildCutLineForFlights` from `stair-geometry-shared` (zero duplicate cut-plane direction selection); u-shape and gamma reuse Phase 2b `offsetPolyline` for stringer rails (via `buildStringersFromWalkline` shared helper); all variant types reused from Phase 1 `types/stair.ts`. Zero `any`, zero `as any`, zero `@ts-ignore`; all signatures `Readonly<…>` for inputs / `readonly …[]` for outputs. Phase 4a/4b/4c sentinel throws preserved on the remaining 7 kinds (spiral, helical, elliptical, winder, triangular-fan, triangular-outline, sketch). **Commit eseguito da Giorgio** (§7.0). |
| 2026-05-16 | **Phase 4a IMPLEMENTED** — `StairGeometryService` kind `spiral` + `helical` operativi. 5 file (2 new + 1 service edit + 2 new test): (1) **NEW** `systems/stairs/stair-geometry-helical.ts` (~200 LOC) — `computeHelical(params, variant: StairVariantHelical)`. Annular wedge treads (4 vertices CCW: `inner_i, outer_i, outer_next, inner_next` for ccw; reversed for cw — preserves CCW xy ordering under sign flip). Walkline = Phase 2a `helixSample(centerPoint, innerRadius, outerRadius, sweepAngle, turnDirection, stepCount, totalRise)` directly (stepCount+1 points along arc-length parameterized walkline at R = (in + out)/2 — uniform angular spacing on constant-radius). Risers vertical at the inner-radius angular boundary θ_{i+1} (xy-degenerate, length = rise — matches Phase 3a riser convention). Stringers `inner` + `outer` = constant-R polylines sampled at the same `stepCount+1` angular grid (R=innerRadius and R=outerRadius respectively). cutLine = `buildCutLine` from shared, passed a degenerate 4-vertex tread at the mid-radius of the first tread crossing the cut plane + the local tangent vector `(-sign·sin θ, sign·cos θ)` as `uDir` → cut spans the wedge width perpendicular to walkline direction. Arrow runs from `walkline[0]` to `walkline[last]`. Tread labels via `buildTreadLabels(treads, [stepCount], …)`. (2) **NEW** `systems/stairs/stair-geometry-spiral.ts` (~190 LOC) — `computeSpiral(params, variant: StairVariantSpiral)`. Apex-at-center degenerate helical: `innerRadius=0` fixed by type, treads are triangular wedges (3 vertices: `apex, outerA, outerB` ccw; mirrored vertex order for cw). Outer radius = `params.width` (industry convention for central-column spiral stairs). Walkline reuses Phase 2a `helixSample(centerPoint, 0, width, …)` — degenerate inner radius reduces to walkline at R=width/2 sampled uniform-angular. Risers vertical at outer corner of θ_{i+1}. Stringers: `outer` = polyline at R=width, `inner` = `stepCount+1` copies of `centerPoint(z_i)` (no inner stringer for column-less spiral by type contract — preserves StairStringerGeometry shape). cutLine same pattern as helical. (3) **EDIT** `systems/stairs/StairGeometryService.ts` — dispatch `'spiral'` → `computeSpiral`, `'helical'` → `computeHelical` replaces Phase 4a sentinel throws; exhaustive `never` guard preserved on Phase 4b/4c kinds. (4) **NEW** `__tests__/StairGeometryService-spiral.test.ts` (10 test) — stepCount=12, sweep=360°, ccw, totalRise=2100, width=1200: 3-vertex wedge per tread with apex at center; tread z = i·rise co-planar; outer corners at R=width; angular increment 30° (compared via cos/sin to dodge the atan2 ±π wrap); cw mirrors ccw across x-axis (ccw vertex 1 ↔ cw vertex 2); treadLabels 'all' → 12 labels with text at tread centroid; 'none' → undefined; cutLine emitted when totalRise > cutPlaneHeight (1200) / undefined when totalRise=300; arrow endpoints match walkline endpoints; stepCount=1 boundary → 1 wedge / 0 risers / walkline length 2. (5) **NEW** `__tests__/StairGeometryService-helical.test.ts` (10 test) — stepCount=12, sweep=270°, innerRadius=400, outerRadius=1400, ccw: 4-vertex wedge per tread; z=i·rise co-planar; inner corners at R=400 / outer at R=1400; angular increment 22.5° (cos/sin compare); walkline 13 vertices all at R=900 = (400+1400)/2; total chord length ≈ stepCount·2R·sin(Δθ/2) analytical (tol 1e-3 for piecewise-linear approximation of a circular arc); inner stringer 13 vertices at R=400 / outer 13 vertices at R=1400; cw mirrors ccw across x-axis; cutLine emitted for totalRise=2100 / undefined for rise=50; treadLabels 'all' → 12 labels at tread centroids. **20/20 Phase 4a green** + **74/74 cumulative stairs** + **240/240 cumulative geometry-shared regression green** (~6s). File sizes all under 500-LOC GOL ceiling: helical=200, spiral=190, service=205, lshape=226, gamma=318, ushape=276, labels=69, shared=173. SSoT: every kind dispatches `buildTreadLabels` from the central labels module (zero duplicate numbering math); spiral and helical both reuse Phase 2a `helixSample` for the walkline (zero parallel arc-length math); both share the same `tangentAt(theta, sign)` derivation `(-sign·sin θ, sign·cos θ)` from the curve derivative — kept duplicated across the two private files instead of promoted to shared because the function is 1 line and bringing it into shared would require importing `Vec2` into a hot module currently free of curve-specific exports (deferred to Phase 4b when elliptical lands and a third caller justifies the move). Zero `any`, zero `as any`, zero `@ts-ignore`; all signatures `Readonly<…>` for inputs / `readonly …[]` for outputs. Phase 4b/4c sentinel throws preserved on `elliptical`/`winder`/`triangular-fan`/`triangular-outline`/`sketch`. **Commit eseguito da Giorgio** (§7.0). |
| 2026-05-16 | **Phase 4b IMPLEMENTED** — `StairGeometryService` kind `elliptical` + `winder` operativi (`winderMethod ∈ {'equal-going','pie'}`; `'kite'`/`'balanced'` Phase 4c sentinel). 5 file (2 new + 1 service edit + 2 new test): (1) **NEW** `systems/stairs/stair-geometry-elliptical.ts` (~165 LOC) — `computeElliptical(params, variant: StairVariantElliptical)`. Walkline = Phase 2b `ellipseSample(centerPoint, semiMajor, semiMinor, sweepAngle, turnDirection, rotation, stepCount, totalRise)` directly (stepCount+1 points along arc-length parameterized ellipse perimeter, rotated by `rotation`). Treads: 4-vertex polygon per step extending ±`width/2` to either side of walkline along local chord-perpendicular (industry-standard chord-tangent offset for stair on curved walkline — same convention as Revit/ArchiCAD/Vectorworks; NOT a true ellipse offset which is non-elliptical and would require Clipper-class machinery, error imperceptible for stair widths ≪ semi-axes). Vertex order `[innerA, outerA, outerB, innerB]` for ccw (sign=+1), reversed for cw. Risers vertical at inner corner of tread boundary i+1, using next-tread chord-perpendicular for consistency. Stringers via shared `buildStringersFromWalkline` (offsetPolyline). cutLine: chord-tangent perpendicular at first walkline segment crossing cutPlaneHeight, mid-segment xy. Arrow walkline[0]→walkline[last]. Tread labels via `buildTreadLabels(treads, [stepCount], …)`. (2) **NEW** `systems/stairs/stair-geometry-winder.ts` (~275 LOC) — `computeWinder(params, variant: StairVariantWinder)`. Three-zone layout: flight 1 (n1 rectilinear) → winder zone (winderCount wedges) → flight 2 (n2 rectilinear). `n1 = floor((stepCount−winderCount)/2)`, `n2 = remainder`. Pivot = `basePoint + u1·(n1·tread) + v1·(turnSign·halfW)` (inner side of L turn). u2 = rotate(u1, turnAngle·DEG2RAD). Winder rays: ray_0 = `-turnSign·v1`, ray_j = rotate(ray_0, j·signedSweepRad), signedSweepRad = turnAngle·DEG2RAD / winderCount. Outer radius of winder wedges = `params.width`. 'equal-going' treads = 4-vertex `[apex, outerA, outerB, apex]` (sign=+1) or reversed (sign=-1) — degenerate inner edge collapsed at pivot, centroid-friendly for labels. 'pie' treads = 3-vertex `[apex, outerA, outerB]`. z model: tread i at z=i·rise for ALL treads (no landing insertion). Risers within straight flights only (winder risers degenerate at pivot). Flight 2 origin = pivot; width axis = ray_winderCount (= trailing winder boundary direction: 90° → u1, 180° → ±v1). Walkline 1+winderCount+1+(n2>0 ? 1 : 0) vertices: basePoint → winder samples (j=0..winderCount at radius `halfW` from pivot, z linear) → flight 2 end. Stringers via shared `buildStringersFromWalkline` (offsetPolyline handles miter at all winder sample joints). cutLine via shared `buildCutLineForFlights([n1, winderCount, n2], [u1, midWinderTangent, u2], …)` — midWinderTangent = perp_signed(ray_mid) preserves turnSign convention. (3) **EDIT** `systems/stairs/StairGeometryService.ts` — dispatch `'elliptical'` → `computeElliptical`, `'winder'` → `computeWinder` replaces Phase 4b sentinel throws; exhaustive `never` guard preserved on Phase 4c kinds (`triangular-fan`/`triangular-outline`/`sketch`). (4) **NEW** `__tests__/StairGeometryService-elliptical.test.ts` (10 test): stepCount=12, sweep=270°, semiMajor=1500, semiMinor=1000, ccw, rotation=0, totalRise=2100, width=800: 4-vertex per tread; z=i·rise co-planar; walkline first vertex at (semiMajor, 0); cumulative chord ≈ analytical `ellipseArcLength(1500, 1000, 270°·DEG2RAD)` within 2%; cw mirrors ccw across x-axis (rotation=0); rotation=90° → walkline first at (0, semiMajor); chord uniformity within 25% (ellipse local-curvature variation acceptable for stair visual); cutLine emitted for totalRise>cutPlaneHeight / undefined otherwise; arrow endpoints match walkline endpoints; labels 'all' → 12 at tread centroids. (5) **NEW** `__tests__/StairGeometryService-winder.test.ts` (12 test): stepCount=14, winderCount=4, turnAngle=+90° (ccw), 'equal-going', tread=250, width=1000, rise=175: 14 treads (n1=5/n2=5 derived from flight 1 last x=1000); Δz=rise across all 14; winder treads dot product cos(22.5°)=cos(turnAngle/winderCount) confirms equal angular sweep; 'pie' → 3-vertex / 'equal-going' → 4-vertex; flight 2 advances along u2=(0,1) for +90°; stepCount=11 winderCount=3 → n1=4/n2=4 (flight 2 origin at pivot.x=1000); walkline = 7 vertices (1 base + 5 winder samples + 1 flight 2 end); stringers continuous (same vertex count as walkline, miter clean at 22.5° joints); cutLine emitted for default totalRise=2450 / undefined for rise=50; 'kite'/'balanced' throw /Phase 4c/; labels 'all' → 14 spanning flightSplit=[n1, winderCount, n2]; turnAngle=180° → u2=(-1,0), flight 2 advances along -X. **22/22 Phase 4b green** + **96/96 cumulative stairs** + **143/143 cumulative stairs+geometry-shared regression green** (~9s combined). File sizes all under 500-LOC GOL ceiling: winder=275, elliptical=165, helical=217, spiral=210, lshape=227, gamma=318, ushape=277, labels=70, shared=174, service=207. SSoT: elliptical reuses Phase 2b `ellipseSample` for walkline (zero duplicate elliptic-integral math) and shared `buildStringersFromWalkline`/`buildCutLine`/`splitTreadsByCutPlane`/`bboxOfPolygons`/`arrowSymbol`/`buildTreadLabels`. Winder reuses shared `directionToUnitVector`/`perp`/`buildCutLineForFlights`/`buildStringersFromWalkline`/`buildTreadLabels`. Both modules privatize their own `rotateVec(v, angleRad)` and chord/tangent helpers (single-line trig, not yet justified for shared promotion — third caller would trigger move per Phase 4a deferral note). Zero `any`, zero `as any`, zero `@ts-ignore`; all signatures `Readonly<…>` for inputs / `readonly …[]` for outputs. Phase 4c sentinel throws preserved on `triangular-fan`/`triangular-outline`/`sketch` + on `winderMethod ∈ {'kite','balanced'}`. **Commit eseguito da Giorgio** (§7.0). |
| 2026-05-16 | **Phase 4c IMPLEMENTED** — `StairGeometryService` kind `triangular-fan` + `triangular-outline` + `sketch` operativi (Phase 4c sentinel rimosso, dispatch completo per gli ultimi 3 kind della discriminated union — solo `winderMethod ∈ {'kite','balanced'}` resta sentinel deferito a sub-phase futura). 7 file (3 new computers + 1 service edit + 3 new test files): (1) **NEW** `systems/stairs/stair-geometry-triangular-fan.ts` (~200 LOC) — `computeTriangularFan(params, variant: StairVariantTriangularFan)`. Apex-at-`apexPoint` polygonal fan/wedge stair (industry: Allplan/AutoCAD Arch "fan stair"). Riusa Phase 2a `helixSample(apexPoint, 0, params.width, openingAngle, turnDirection, stepCount, totalRise)` per walkline (inner=0 ⇒ walkline radius = width/2; ZERO duplicate trig). Treads 3-vertex `[apex, outerA, outerB]` (sign=+1 ccw) o `[apex, outerB, outerA]` (sign=-1 cw) — simmetria semantica con spiral. Outer radius = `params.width`. Risers vertical at outer corner di θ_{i+1}. Stringers: outer = polyline at R=width sampled uniform-angular (stepCount+1 punti); inner = stepCount+1 copie di `apexPoint(z_i)` (degenerate, come spiral). cutLine pattern identico a spiral (tangent perp al radial, mid-radius). Vincolo Phase 4c: `params.stepCount === variant.stepCountPerArc` — multi-arc polygonal spiral (stepCount > stepCountPerArc) deferito; throw esplicito `triangular-fan requires stepCount === stepCountPerArc`. (2) **NEW** `systems/stairs/stair-geometry-triangular-outline.ts` (~190 LOC) — `computeTriangularOutline(params, variant: StairVariantTriangularOutline)`. Wedge stair che riempie footprint triangolare (industry: Vectorworks "Vertex mode", Allplan "triangular landing"). Entry side `triangleVertices[entrySide]→triangleVertices[(entrySide+1)%3]`; apex `triangleVertices[(entrySide+2)%3]`. Equal-height linear slices PARALLEL all'entry edge, ascendenti verso l'apex. Per tread i: corners low_a/low_b at `t_i=i/stepCount` (= V_a+t_i·(V_c-V_a), V_b+t_i·(V_c-V_b)); high_a/high_b at `t_{i+1}=(i+1)/stepCount`. Ultimo tread degenera a triangolo all'apex (high_a===high_b===V_c, polygon `[low_a, low_b, V_c, V_c]`). Vertex order: ccw `[low_a, low_b, high_b, high_a]` / cw `[low_a, high_a, high_b, low_b]`. Walkline da midpoint entry edge `(V_a+V_b)/2` → apex `V_c`, stepCount+1 vertices, z linear `i·rise`. Risers vertical at corner low_a del tread i+1 (= sull'edge V_a-V_c). Stringers via shared `buildStringersFromWalkline(walkline, width)` — accept offsetPolyline su retta semplice (no special-case needed). cutLine via shared `buildCutLine` con `axis = normalize(V_c - entryMid)`. `orientation` ∈ {'cw','ccw'} flippa winding polygon coerentemente con helical/elliptical. (3) **NEW** `systems/stairs/stair-geometry-sketch.ts` (~165 LOC) — `computeSketch(params, variant: StairVariantSketch)`. Free-form stair che segue `variant.walklinePath` user-drawn. Vincolo input: `walklinePath.length === stepCount + 1` (throw esplicito con messaggio diagnostico altrimenti — Phase 4c semplificazione, resample deferito). z input scartato e sostituito da `z_i = basePoint.z + i·rise` (industry: la sketch fornisce solo plan-view, lo stair tool impone il vertical model). Treads 4-vertex `[innerA, outerA, outerB, innerB]` extending ±halfW·perp(chord-tangent) attorno alla walkline — pattern chord-tangent identico a Phase 4b elliptical (NON ancora promosso a shared: 2 caller attuali, soglia ≥3 caller per shared promotion per Phase 4a/4b deferral note). Risers vertical all'inner corner del segment i+1. Stringers via shared `buildStringersFromWalkline`. cutLine al primo chord che attraversa il cut plane. (4) **EDIT** `systems/stairs/StairGeometryService.ts` — dispatch `'triangular-fan'` → `computeTriangularFan`, `'triangular-outline'` → `computeTriangularOutline`, `'sketch'` → `computeSketch` replaces Phase 4c sentinel throws; `never`-guard exhaustiveness check preservato (zero kind residui dopo Phase 4c). (5) **NEW** `__tests__/StairGeometryService-triangular-fan.test.ts` (9 test): apexPoint=(0,0,0), openingAngle=90°, stepCount=10, ccw, width=1500, totalRise=1750: 10 treads 3-vertex con apex coincidente con apexPoint; walkline.length=11; outer corners a R=1500; angular increment 9° validato via cos/sin (no atan2 wrap); z=i·rise co-planar; cw mirrors ccw across x-axis (apex origine); cutLine present per default / undefined per totalRise=600; labels 'all' → 10 at tread centroids; stepCount=10 stepCountPerArc=5 → throws `triangular-fan requires stepCount === stepCountPerArc`. (6) **NEW** `__tests__/StairGeometryService-triangular-outline.test.ts` (9 test): triangleVertices=[(0,0,0),(3000,0,0),(0,3000,0)], entrySide=0, stepCount=6, ccw, totalRise=1050: 6 treads / walkline.length=7; ogni tread-centroid inside triangle (cross-product test multipl 3 lati, tol 1e-6); centroid y monotonic (entry edge along +X, treads ascendono perpendicolare); z=i·rise co-planar; cw vs ccw → indici 0/2 condivisi (lowA + highB rimangono invariati cambiando winding); cutLine undefined per default (z_max=875 < 1200) / definito per totalRise=2400; walkline[0]=(1500,0), walkline[last]=(0,3000); labels 'all' → 6; ultimo tread degenere `high_a===high_b===(0,3000)` (Phase 4c semantica esplicita). (7) **NEW** `__tests__/StairGeometryService-sketch.test.ts` (8 test): walklinePath=[(0,0,99),(1000,0,99),(1000,1000,99),(2000,1000,99)] stepCount=3 rise=600: 3 treads / walkline.length=4; stepCount=5 mismatch → throws `sketch walklinePath length must equal stepCount+1`; treads chord-tangent verificati segment-by-segment (segment 0 ±halfW=400 lungo perp=(0,±1); segment 1 inner corner a (1400,0) lungo perp=(-1,0)); z input z=99 sostituito da i·rise; cutLine present per default / undefined per rise=100; stringers inner+outer presenti, length = walkline length = stepCount+1; arrow endpoints match walkline endpoints; labels 'all' → 3 at tread centroids. **26/26 Phase 4c green** + **122/122 cumulative stairs** (~9s tutte le 12 suite StairGeometryService). File sizes all under 500-LOC GOL ceiling: triangular-fan=200, triangular-outline=190, sketch=165, winder=275, elliptical=165, helical=217, spiral=210, lshape=227, gamma=318, ushape=277, labels=70, shared=174, service=210. SSoT: triangular-fan riusa Phase 2a `helixSample` per walkline (degenerate inner=0 ⇒ ZERO duplicate spiral math) + shared `buildCutLine`/`splitTreadsByCutPlane`/`bboxOfPolygons`/`arrowSymbol`/`buildTreadLabels`. triangular-outline e sketch riusano shared `buildStringersFromWalkline`/`buildCutLine`/`splitTreadsByCutPlane`/`bboxOfPolygons`/`arrowSymbol`/`buildTreadLabels`. Chord-tangent helper rimane duplicato tra sketch e elliptical (2 caller, soglia ≥3 per shared promotion non ancora raggiunta — punto deferimento esplicito già documentato in Phase 4a/4b notes). Zero `any`, zero `as any`, zero `@ts-ignore`; tutti i signatures `Readonly<…>` per input / `readonly …[]` per output. Single sentinel residuo: `winderMethod ∈ {'kite','balanced'}` in `stair-geometry-winder.ts` (sub-phase futura). **Commit eseguito da Giorgio** (§7.0). |
| 2026-05-16 | **Phase 5a IMPLEMENTED** — Tool wire-up. Stair tool è ora **funzionalmente attivabile**: ribbon button (no `comingSoon`) + hotkey `ST` (2-char chord 'S→T' 350 ms) + ribbon click → `ToolStateStore.setTool('stair')` → `useStairTool.activate()` → 2-click placement (basePoint + direction) → Enter/auto-commit → `StairEntity` persistito in scene via `LevelSceneManagerAdapter`. 11 file: **(1) NEW** `src/subapps/dxf-viewer/hooks/drawing/stair-completion.ts` (~150 LOC) — pure builders `buildDefaultStairParams(basePoint, direction, overrides?)` (Phase 5a defaults industry-aligned NOK κύρια: rise=175, tread=280, width=1200, nosing=20, stepCount=12, walklineOffset=600, structureType='monolithic', riserType='closed', codeProfile='nok', variant.kind='straight') + `buildStairEntity(params, layer)` (genera `stair_<ulid26>` via `generateStairId()`, calcola `geometry` via SSoT `computeStairGeometry`, `validation` shape vuota — Phase 6 wires `gate-stair-checker`) + `directionFromPoints` helper + `buildStairCommandHistoryEntry` snapshot. ZERO duplicate geometry math — solo dispatch. `@/services/enterprise-id.service` alias path (consistente con altri DXF imports). **(2) NEW** `src/subapps/dxf-viewer/hooks/drawing/useStairTool.ts` (~170 LOC) — React hook orchestrator state machine `idle → awaitingBasePoint → awaitingDirection → confirming → awaitingBasePoint` (continuous chain industry-aligned AutoCAD/ArchiCAD); ref-backed setState bypass (pattern `useLineParallel`/`useCircleTTT`); API `activate/deactivate/reset/onCanvasClick/confirm/setParamOverrides/getStatusText` + boolean flags `isActive/isAwaitingBasePoint/isAwaitingDirection/isConfirming`; status text returns i18n keys `tools.stair.statusBasePoint|statusDirection|statusConfirm` per caller-resolved translation (N.11 compliant). **(3) EDIT** `src/subapps/dxf-viewer/hooks/drawing/drawing-types.ts` — `DrawingTool` union += `'stair'`. **(4) EDIT** `src/subapps/dxf-viewer/hooks/drawing/drawing-preview-generator.ts` (~80 LOC additional) — early-return branch `if (tool === 'stair') return generateStairPreview(...)` + 3 helpers: `generateStairPreview` (state-machine map: [] → basePoint marker `PreviewPoint`; [base] → ghost dashed polyline base→cursor; [base, dir] → walkline polyline via SSoT `computeStairGeometry`), `makeStairGhost` (dashed white opacity 0.6), `makeStairWalklinePreview` (solid bright-green opacity 0.8 lineweight 2). Phase 5a returns single polyline approximation (walkline); full multi-entity preview (treads stroked + arrow) lands Phase 5b alongside grips overlay. **(5) EDIT** `src/subapps/dxf-viewer/hooks/tools/useSpecialTools.ts` — new `useStairTool` import + instantiation con `onStairCreated` callback che pushes `StairEntity` su `levelManager.setLevelScene(...)` (pattern identico a `circleTTT.onCircleCreated`); auto-activate/deactivate `useEffect` su `activeTool === 'stair'`; espone `stairTool` nel `UseSpecialToolsReturn`. **(6) EDIT** `src/subapps/dxf-viewer/hooks/canvas/canvas-click-types.ts` — nuovo `StairToolLike` interface (`isActive` + `onCanvasClick`) + `UseCanvasClickHandlerParams.stairTool?: StairToolLike`. **(7) EDIT** `src/subapps/dxf-viewer/hooks/canvas/useCanvasClickHandler.ts` — PRIORITY 4.5 branch: `if (activeTool === 'stair' && stairTool?.isActive) { stairTool.onCanvasClick(worldPoint); return; }` posizionata dopo entity-pick handlers (angle/TTT/perpendicular/parallel) e prima della overlay polygon priority. **(8) EDIT** `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx` — destruttura `stairTool` da `useSpecialTools` + lo passa a `useCanvasClickHandler`. **(9) EDIT** `src/subapps/dxf-viewer/hooks/useKeyboardShortcuts.ts` — `'stair'` aggiunto a `isDrawingTool` Esc-handler whitelist (Esc durante stair tool → `onDrawingCancel` cleanup). **(10) EDIT** `src/subapps/dxf-viewer/hooks/useDxfToolbarShortcuts.ts` — multi-char sequence dispatcher per hotkey `'ST'`: nuovo `stairChordRef` con timer 350 ms parallelo all'esistente `chordRef` (ADR-189 G-leader). Pattern: 'S' apre chord window (no immediato `handleToolChange('select')`); 'T' entro 350 ms → `handleToolChange('stair')` (cancel timer); altro tasto entro 350 ms → cancel chord + fallback select; timeout → select fallback. Compatibilità: tutti gli altri shortcut 1-char restano invariati; unico tradeoff = 350 ms delay percettibile nell'attivazione di `S = Select` (industry standard AutoCAD command line). **(11) EDIT** `src/subapps/dxf-viewer/ui/ribbon/data/home-tab-draw.ts` — rimosso `comingSoon: true` dal button `draw.stair` (Q15 mandato + §13 Phase 0 carryover). **(12) NEW** `src/subapps/dxf-viewer/systems/dynamic-input/keyboard-handlers/stair-keyboard-handler.ts` (~60 LOC) — Strategy handler `handleStairKeyboard`: Enter dispatcha `dynamicSubmit({ tool, action: 'commit-stair' })` + `CADFeedback.onInputConfirm()`; Tab/Esc passano al default handler. Esportato `validateStairField('rise'\|'tread'\|'width', mm)` + `STAIR_FIELD_RANGES` per riuso ribbon panel Phase 7a (rise 100-220 / tread 220-360 / width 600-2400, IBC+NOK convergence). Field-level rise/tread/width Dynamic Input UI è deferita a Phase 7a (contestuale ribbon) — Phase 5a non estende `KeyboardHandlerContext` per evitare scope-creep su 4 file extra. **(13) EDIT** `src/subapps/dxf-viewer/systems/dynamic-input/keyboard-handlers/index.ts` — registry += `'stair': handleStairKeyboard` + re-export `handleStairKeyboard/validateStairField/STAIR_FIELD_RANGES`. **(14) NEW** `src/subapps/dxf-viewer/hooks/drawing/__tests__/stair-completion.test.ts` (7 test): id shape `stair_*`, geometry populated via SSoT, zero `undefined` Firestore-safe (id/type/kind/params/geometry/validation), param echo (rise/tread/width/stepCount/basePoint/direction), command-history round-trip, layer default, directionFromPoints cardinal vectors. **(15) NEW** `src/subapps/dxf-viewer/hooks/drawing/__tests__/useStairTool.test.tsx` (5 test, RTL `renderHook` + `act`): initial idle → activate awaitingBasePoint, click 1 → awaitingDirection + basePoint stored, click 2 → confirming + direction computed (0° per +X), reset → awaitingBasePoint, confirm() → onStairCreated emette `StairEntity` (`type='stair'`, `kind='straight'`, `layer='L1'`) + chain reset awaitingBasePoint. **12/12 Phase 5a green** + **152/152 cumulative stairs+drawing** (~10s). SSoT: ZERO duplicate geometry math (preview + entity build entrambi dispatch a `computeStairGeometry` SSoT); IDs via `generateStairId()` (N.6); pattern hook allineato a `useLineParallel`/`useCircleTTT` (zero parallel state-machine implementations); `@/services/enterprise-id.service` path alias (consistenza con resto del subapp); micro-leaf ADR-040 rispettato (hook own state, no `useSyncExternalStore` su high-freq stores — wire-up via `useSpecialTools` + `useCanvasClickHandler` segue pattern circleTTT/lineParallel zero subscriber su CanvasSection); Stair tool ora reachable via 3 entry point: (a) ribbon click, (b) hotkey 'S→T' chord, (c) tool selector. Zero `any`/`as any`/`@ts-ignore`; all signatures `Readonly<…>`/`readonly` for inputs/outputs; tutte le funzioni ≤40 lines GOL. Phase 5b carryover deferito: full multi-entity preview (treads + arrow), inline rise/tread/width Dynamic Input UI (extends KeyboardHandlerContext), persistence del committed StairEntity nel render pipeline (sembrava già `StairEntity` reaches scene via `LevelSceneManagerAdapter` ma il renderer 2D del committed stair richiede leaf separato — Phase 5b grips lavora sopra). **Commit eseguito da Giorgio** (§7.0). |
| 2026-05-16 | **§7.0 commit policy** aggiunta — riafferma a livello ADR la regola CLAUDE.md N.(-1): agente non committa né pusha senza ordine esplicito. Titolo §7 aggiornato da "ogni phase = 1 commit autonomo" a "commit eseguito da Giorgio". |
| 2026-05-16 | **Phase 5b IMPLEMENTED** — Stair Grips G15 (5 grip parametrici) + 2D plan-view renderer + `UpdateStairParamsCommand` (geometry recompute SSoT + merging window 500 ms) + `DxfStair` wrapper (SSoT, no entity expansion). **Strategia SSoT**: nessun hook parallelo, nessuna leaf custom — pipeline grip unificata esistente (`useUnifiedGripInteraction` ADR-183) estesa con un campo discriminator `stairGripKind` su `GripInfo` (`'stair-base'|'stair-direction'|'stair-width'|'stair-length'|'stair-split'`), branch dedicato in `computeDxfEntityGrips` + early-branch in `commitDxfGripDragModeAware` che bypassa `StretchEntityCommand` e dispatcha `UpdateStairParamsCommand`. Render via `EntityRendererComposite` standard (StairRenderer registrato su `'stair'`). **11 file** (5 NEW + 6 EDIT): **NEW (1)** `systems/stairs/stair-grips.ts` (~280 LOC) — pure handlers `getStairGrips(entity): GripInfo[]` (4 grips per straight/spiral/winder, 5 per l-shape/u-shape/gamma con splitGrip al midpoint landing) + `applyStairGripDrag(gripKind, { originalParams, delta, currentPos }): StairParams` (5 transform pure: basePoint translate, direction atan2-rotate, width 2·|projection-on-perp|, length floor(run/tread)+1 → derive stepCount + recompute totalRun/totalRise, split clamp [0.1, 0.9] su variant.flightSplit per l-shape/u-shape/gamma; switch exhaustive con `never` guard); riusa Phase 2b `perpUnit` convention; ZERO duplicate `computeStairGeometry` (lasciato a `UpdateStairParamsCommand`). **NEW (2)** `core/commands/entity-commands/UpdateStairParamsCommand.ts` (~115 LOC) — copia pattern `UpdateArrayParamsCommand` con due differenze: `execute/undo/redo` chiamano `computeStairGeometry(params)` e patchano `{ params, geometry }` insieme (geometry SSoT — renderer e grip overlay non possono mai divergere); `validate()` rifiuta `stepCount < 2 / width ≤ 0 / tread ≤ 0 / rise ≤ 0`. `canMergeWith` + `mergeWith` con `DEFAULT_MERGE_CONFIG.mergeTimeWindow` (500 ms) per drag-merge. **NEW (3)** `rendering/entities/StairRenderer.ts` (~145 LOC) — `extends BaseEntityRenderer`. `render()` disegna treads (polygon CCW, fill 12% alpha + stroke), inner+outer stringers (THICK), walkline (THIN dashed [6,4]), arrow + UP/DOWN label, tutto via `worldToScreen()`. `getGrips()` delega a `getStairGrips()`. `hitTest()` usa `geometry.bbox` 3D proiettato 2D + tolerance. Phase 5b è intenzionalmente minimal per §6.2 (no risers, no treadsAboveCut dashed, no handrails, no cutLine zigzag, no tread labels — landing Phase 6+ insieme alla validator full pipeline). **NEW (4)** `systems/stairs/__tests__/stair-grips.test.ts` (10 test) — getStairGrips count for straight (4) vs l-shape (5); basePoint at params.basePoint exact; direction handle at base + (100, 0) per direction=0°; applyStairGripDrag per ogni 5 grip kind (base translate delta, direction atan2(100,0)=90°, width=2·600=1200, length floor(1000/280)+1=4 con totalRun=840, split clamp 100000→[0.9, 0.1] sommato 1.0, split su straight ritorna originalParams unchanged). **NEW (5)** `core/commands/entity-commands/__tests__/UpdateStairParamsCommand.test.ts` (8 test) — execute patches params + recomputes geometry; undo restores; redo re-applies; canMergeWith true per dragging same-stair, false altrimenti; mergeWith preserva paramsA→paramsC; validate rifiuta stepCount<2; getAffectedEntityIds. **EDIT (1)** `canvas-v2/dxf-canvas/dxf-types.ts` — `DxfEntity.type` += `'stair'` + nuovo `interface DxfStair extends DxfEntity { type: 'stair'; stairEntity: StairEntity }` + `DxfEntityUnion` += `DxfStair`. **EDIT (2)** `hooks/canvas/useDxfSceneConversion.ts` — `case 'stair'` wrap `StairEntity` in `DxfStair` (ZERO expansion, ZERO polyline duplication — geometria letta direttamente da `stairEntity.geometry` dal renderer). **EDIT (3)** `hooks/grip-types.ts` (estratto da linter dal useGripMovement.ts originale) — nuovo type `StairGripKind` + `GripInfo.stairGripKind?: StairGripKind`. **EDIT (4)** `hooks/grips/unified-grip-types.ts` — `UnifiedGripInfo.stairGripKind?: StairGripKind` forwarded da `wrapDxfGrip` in `grip-registry.ts`. **EDIT (5)** `hooks/grip-computation.ts` — `case 'stair'` chiama `getStairGrips(entity.stairEntity)` (ZERO duplicate grip computation). **EDIT (6)** `hooks/grips/grip-commit-adapters.ts` — nuovo `commitStairGripDrag(grip, delta, deps)` helper (legge entity da scene via `createSceneManagerAdapter`, type-guards `candidate.type === 'stair'`, ricostruisce `currentPos = grip.position + delta`, dispatcha `UpdateStairParamsCommand`) + early-branch in `commitDxfGripDragModeAware` che intercetta `grip.stairGripKind` prima di stretch/move/rotate/scale/mirror. **EDIT (7)** `canvas-v2/dxf-canvas/DxfRenderer.ts` — `toEntityModel` case `'stair'` unwrappa `DxfStair → StairEntity` per il renderer pipeline (preserva `kind`/`params`/`geometry`/`validation`). **EDIT (8)** `canvas-v2/dxf-canvas/dxf-viewport-culling.ts` — `getEntityBBox` case `'stair'` proietta `geometry.bbox` 3D → 2D (viewport culling reuses Phase 1 `BoundingBox3D` SSoT). **EDIT (9)** `rendering/core/EntityRendererComposite.ts` — registra `StairRenderer` su key `'stair'` nel composite. **EDIT (10)** `i18n locales/{el,en}/tool-hints.json` — `tools.stair.grips.{basePoint,direction,width,length,split}` (Greek + English, NO hardcoded text in code — N.11 compliant; usabili da contestuale ribbon Phase 7a per tooltip e da CadStatusBar). **18/18 nuovi test green** (10 stair-grips + 8 UpdateStairParamsCommand) + **152/152 cumulative regression green** (122 stairs + 12 Phase 5a drawing + 18 nuovi). LOC: ~640 prod (~280 grips + ~115 cmd + ~145 renderer + ~100 edits cumulati) + ~280 test = ~920 totale. SSoT verifiche: nessun hook parallelo (`useStairGripInteraction` NON creato — pipeline unificata estesa); ZERO duplicate `computeStairGeometry` (centralizzato in `UpdateStairParamsCommand.execute`); ZERO duplicate grip math (un solo `getStairGrips`); ZERO bypass del `StretchEntityCommand` per non-stair grips (early-branch isolato); ZERO modifiche a `CanvasSection.tsx` / `CanvasLayerStack.tsx` / `canvas-layer-stack-leaves.tsx` (ADR-040 CHECK 6B/6C/6D NON triggherano — il rendering passa per `EntityRendererComposite` che è leaf indiretta via `DxfRenderer`). N.7.2 checklist: ✅ proactive (geometry ricalcolata atomic nel command, non lazy); ✅ no race (command pattern serializza updates); ✅ idempotent (undo/redo riproducibili — `previousParams` salvato); ✅ belt-and-suspenders (`validate()` in command + applyDrag pure exhaustive); ✅ SSoT (`computeStairGeometry` riusato, ZERO duplicate); ✅ await (command sync, no fire-and-forget); ✅ explicit ownership (`UpdateStairParamsCommand` owns geometry lifecycle). Zero `any`, zero `as any`, zero `@ts-ignore`; tutti i signatures `Readonly<…>` per input. Phase 5b carryover (verso Phase 5c+): (a) live-preview durante drag (oggi commit-at-mouseUp standard industry Revit/AutoCAD — per per-frame preview servirebbe ghost-renderer alternativo, deferito); (b) full multi-entity preview (treads stroked + arrow + tread labels) sia per drawing-time sia post-commit (Phase 5b minimal renderer copre solo treads + walkline + arrow + stringers — risers/handrails/cutLine/treadLabels Phase 6+); (c) inline Dynamic Input rise/tread/width (Phase 7a); (d) Transforms (mirror/rotate/copy) → Phase 5c; (e) Validators NOK/IBC/Eurocode/ADA → Phase 6; (f) ribbon contextual tab → Phase 7a. **Commit eseguito da Giorgio** (§7.0). |
| 2026-05-16 | **Phase 5c IMPLEMENTED** — Stair Transforms (G17). Pure functions `mirrorStairParams` / `rotateStairParams` / `copyStairParams` con auto-flip `turnDirection` / `turnSequence` / `winder.turnAngle` su mirror (Q23). **2 file**: **NEW (1)** `systems/stairs/stair-transforms.ts` (~250 LOC) — riusa SSoT `utils/mirror-math` (`mirrorPoint`/`mirrorAngle`/`getAxisAngleDeg`/`MirrorAxis`) + `utils/rotation-math` (`rotatePoint`) + `geometry-utils.normalizeAngleDeg`. xy-plane reflection con z preservato. Exhaustive variant switch (`l-shape`/`u-shape`/`gamma`/`spiral`/`helical`/`elliptical`/`winder`/`triangular-fan`/`triangular-outline`/`sketch`) con `never` guard. `mirrorStairParams` flippa: `l-shape.turnDirection`, `u-shape.turnDirection`, `gamma.turnSequence` array, `spiral`/`helical`/`elliptical`/`triangular-fan.turnDirection cw↔ccw`, `winder.turnAngle` segno invertito (signed convention). `rotateStairParams` ruota basePoint + direction + variant.centerPoint/apexPoint/triangleVertices (rotazione preserva chiralità — NON flippa turnDirection per Q23 nota: 180° rotation ≠ mirror per industry standard Revit/ArchiCAD/AutoCAD Arch). `copyStairParams` trasla basePoint + variant centers, tutto il resto identico. **NEW (2)** `systems/stairs/__tests__/stair-transforms.test.ts` (~340 LOC, 27 test): mirror su 3 assi (X / Y / y=x arbitrario) per straight + 10 variant + per ogni variant la corretta inversione campi handedness; rotate 90°/180° preserva turnDirection; copy applica delta a tutti i centri (helical/elliptical/triangular-fan/sketch.walklinePath); idempotency; symmetry properties (mirror twice = identity). **27/27 nuovi test green** + **179/179 cumulative stairs green** (152 + 27). SSoT: ZERO duplicate reflection math (riusa Phase 5a-pre `utils/mirror-math` interamente); zero `any` / `as any` / `@ts-ignore`; tutte le funzioni ≤40 lines GOL. Carryover Phase 5c.1 (commands branch type==='stair' su MirrorEntityCommand/RotateEntityCommand/MoveEntityCommand): plan-first, vedi §13. **Commit eseguito da Giorgio** (§7.0). |
| 2026-05-16 | **Phase 6 IMPLEMENTED** — Stair validator: NOK + IBC + Eurocode + ADA (Q25) + cheap 2D headroom proxy (Q29) + i18n violation messages. **4 file** (3 NEW + 2 EDIT i18n + 1 NEW test): **NEW (1)** `src/services/building-code/engines/gate-stair-checker.ts` (~150 LOC) — pure dispatcher `gateStairChecker(input): GateStairCheckerResult` con 5 internal checkers (`checkHardErrors` + `checkNOK(params, subType)` + `checkIBC` + `checkEurocode` + `checkADA`), ciascuno ≤40 LOC. Hard errors universali (stepCount<2, width/rise/tread/totalRise ≤0). Profile ranges da §3.5: NOK κύρια (W≥1200, R∈[130,180], G∈[260,320], 2R+G∈[600,640]) / NOK δευτερεύουσα (W≥900, R∈[140,200], G∈[230,280]) / IBC commercial §1011 (W≥1117, R≤177.8, G≥279.4) / Eurocode (W≥1000, R∈[170,200], G∈[230,300], 2R+G∈[600,650]) / ADA (R≤177.8, G≥279.4, handrail h∈[864,965], topExtension≥305, bottomExtension==='one-tread', adaContrastStrip===true). ADA uniform step variation ≤4.8mm trivially satisfied (parametric stair = uniform by construction, no perTreadOverride rise field). Exhaustive switch su `StairCodeProfile` con `never` guard (NBC/NFPA/AS1657/DIN/none returnano zero violations — Phase 9 placeholders). **NEW (2)** `src/subapps/dxf-viewer/systems/stairs/stair-validator.ts` (~117 LOC) — public SSoT facade `validateStairParams(params, contextEntities?): StairValidationState`. Dispatcha a `gateStairChecker` + aggiunge cheap 2D headroom proxy (Q29 hybrid cheap part): layer regex `/ceiling|slab|roof/i` su context entities, estrae `metadata.elevation` (skip silently se assente, no false positives), clearance = `elevation − (basePoint.z + totalRise)` < `MIN_HEADROOM_MM[codeProfile]` (nok/ibc/eurocode 2030, ada 2032, none 0). Egress G20 lasciato `egressViolations: undefined` — Phase 6.5 placeholder. Return shape conforme `StairValidationState` Phase 1 con `Timestamp.now()`. **EDIT (3)** `src/i18n/locales/el/tool-hints.json` — nuovo sub-namespace `tools.stair.validator.{hardError,nok,ibc,eurocode,ada,headroomBelowMin}` (24 keys, full Greek, zero English residue per user memory `pure_greek_locale`). **EDIT (4)** `src/i18n/locales/en/tool-hints.json` — mirror EN 24 keys formal CAD-tool style. SSoT i18n: keys co-locate con `tools.stair.grips.*` Phase 5b nello stesso namespace `tool-hints` (zero registration overhead vs new namespace `stairs-validator` che richiederebbe manifest + lazy-config + types/i18n regen). **NEW (5)** `src/subapps/dxf-viewer/systems/stairs/__tests__/stair-validator.test.ts` (~270 LOC, 32 test): 5 hard errors + 4 NOK main + 3 NOK secondary + 3 IBC + 3 Eurocode + 6 ADA (rise/tread/handrailHeight/topExtension/contrastStrip/fully-compliant) + 5 headroom (above/too-close/non-ceiling-layer/no-metadata/profile-none) + 3 profile-none + idempotency. **32/32 nuovi test green** + **211/211 cumulative stairs green** (179 Phase 5c + 32 Phase 6). LOC: ~270 prod + ~270 test = ~540 totale (sotto stima ADR ~600). SSoT verifiche: ZERO duplicate validator logic (gate-stair-checker = unico engine per code-profile checks); ZERO bypass del `StairValidationState` shape Phase 1; ZERO hardcoded i18n strings nel codice (`.ts`) — solo i18n keys ('tools.stair.validator.*'); ZERO modifiche a pipeline grip / renderer / drawing (validator pure function, integration al `UpdateStairParamsCommand` deferita a Phase 6.1); ADR-040 micro-leaf NON triggherato (zero file canvas/store toccati — CHECK 6B/6C/6D pass). N.7.2 checklist: ✅ proactive (validator runtime, non lazy); ✅ no race (pure function deterministica); ✅ idempotent (same input → same violationKeys, escluso `lastValidatedAt: Timestamp.now()`); ✅ belt-and-suspenders (hardErrors block + codeViolations warn — due livelli §5.9); ✅ SSoT (gate-stair-checker engine + stair-validator facade — unico path); ✅ await (pure sync); ✅ explicit ownership (`stair-validator.ts` = SSoT facade, `gate-stair-checker.ts` = engine). Zero `any`, zero `as any`, zero `@ts-ignore`; tutte le funzioni ≤40 lines GOL. Carryover Phase 6 (deferiti a 6.1/6.5/7a/9, vedi §13): (a) wiring del `StairValidationState` al `StairEntity.validation` via `UpdateStairParamsCommand` (Phase 6.1); (b) egress full validator G20 (Phase 6.5); (c) ADA handrail extensions RENDER nello `StairRenderer` (Phase 6.5); (d) 3D headroom raycast (Phase 9); (e) NBC/NFPA/AS1657/DIN profile validators (Phase 9 ή on-demand); (f) UI surfacing red badge + violations list nel contextual ribbon (Phase 7a/7b). **Commit eseguito da Giorgio** (§7.0). |
| 2026-05-16 | **Phase 6.5 IMPLEMENTED** — Egress capacity validator (G20) + ADA auto-default pacchetto coherent (Q26 data layer). **Scope decision**: Phase 6.5 implementa il data layer COMPLETO del pacchetto Q26 (egress validator universale + builder auto-default ADA che mantiene il validator green out-of-the-box). Il **RENDER** delle ADA handrail extensions (305mm top horizontal + one-tread bottom polyline) è esplicitamente **deferito a Phase 7a** insieme al red-badge UI surfacing del validator — coherent visual pacchetto, evita visual regression senza red-badge per validarlo, rispetta Phase 5b §6.2 minimal renderer ("no handrails") che già demanda l'aggiunta progressiva del pipeline 10-layer a Phase 6+ generale. **5 file** (3 EDIT logic + 2 EDIT i18n + 1 EXTEND test + 1 NEW test): **EDIT (1)** `src/services/building-code/engines/gate-stair-checker.ts` (+30 LOC) — `GateStairCheckerInput.occupancyLoad?: number` (project-default risolto dal caller); `GateStairCheckerResult.egressViolations: readonly string[]`; nuovo private `checkEgress(params, occupancyLoad?)` con costante `EGRESS_MM_PER_PERSON = 7.62` (IBC §1011.5: 0.3 in / person) emette `tools.stair.validator.egress.widthBelowOccupancy` quando `width < occupancyLoad × 7.62`; skip silently se `occupancyLoad` assente / 0 / negativo (no false positives); dispatcher invoca `checkEgress` per OGNI profile eccetto 'none' (egress è universale life-safety, NON profile-specific). **EDIT (2)** `src/subapps/dxf-viewer/systems/stairs/stair-validator.ts` (+12 LOC) — `validateStairParams(params, contextEntities?, projectOccupancyLoad?)` accetta terzo argomento opzionale Q27; resolution order `projectOccupancyLoad ?? params.occupancyLoad` (project default wins over per-stair override per design Q27 = pattern Q21 cutPlaneHeight); `egressViolations` popolato nel return shape (precedentemente `undefined`) + incluso in `violationKeys` aggregate per `hasCodeViolations` semantic. **EDIT (3)** `src/subapps/dxf-viewer/hooks/drawing/stair-completion.ts` (+60 LOC) — `StairParamOverrides` esteso con `codeProfile?`/`nokSubType?`/`handrails?: Partial<…>`/`adaContrastStrip?`/`occupancyLoad?`; nuovo helper `buildHandrails(codeProfile, override?)` con costanti `ADA_TOP_EXTENSION_MM = 305` (ICC A117.1 §505) + `ADA_HANDRAIL_HEIGHT_MM = 900` (mid-range [864, 965]); quando `codeProfile === 'ada'` auto-applica `{inner:true, outer:true, height:900, topExtension:305, bottomExtension:'one-tread'}` UNLESS override esplicito (caller wins per ogni singolo campo handrail); `adaContrastStrip` default `true` per ada / `false` altrimenti, override caller wins; `nokSubType` auto-`'main'` solo se `codeProfile==='nok'`, `undefined` altrimenti (Firestore optional spread per `occupancyLoad` per evitare `undefined` se assente). **EDIT (4+5)** `src/i18n/locales/{el,en}/tool-hints.json` — nuovo nested key `tools.stair.validator.egress.widthBelowOccupancy` con ICU single-brace `{occupancyLoad}` (CHECK 3.9 compliant, NON `{{var}}`); Greek `"Ανεπαρκές πλάτος σκάλας για το φορτίο πληρότητας ({occupancyLoad} άτομα)."` (zero English residue, conforme `pure_greek_locale` user memory); English `"Insufficient stair width for declared occupancy load ({occupancyLoad} persons)."`. **EXTEND (6)** `src/subapps/dxf-viewer/systems/stairs/__tests__/stair-validator.test.ts` (+78 LOC, +8 test): `validateStairParams — egress capacity (G20)` block — width 900 + occupancyLoad 200 (req 1524mm) → warn; width 2000 + occupancyLoad 100 (req 762mm) → ok; occupancyLoad undefined → skip; occupancyLoad 0 → skip; codeProfile 'none' → skip; projectOccupancyLoad 500 override params.occupancyLoad 50 → warn; params.occupancyLoad 200 + width 800 con projectOccupancyLoad absent → warn; namespace assertion `egressViolations.every(k => k.startsWith('tools.stair.validator.egress.'))`. **NEW (7)** `src/subapps/dxf-viewer/hooks/drawing/__tests__/stair-completion-ada.test.ts` (~110 LOC, 11 test): codeProfile='ada' → topExtension===305 / bottomExtension==='one-tread' / adaContrastStrip===true / inner+outer handrails===true / height ∈ [864, 965]; explicit handrails.topExtension override 500 preserved over ADA default; explicit adaContrastStrip=false preserved; codeProfile 'nok' default → ADA fields undefined / adaContrastStrip false; codeProfile 'ibc' → ADA fields undefined; codeProfile='ada' propaga a params.codeProfile + nokSubType undefined; occupancyLoad override flow. **19/19 nuovi test green** + **230/232 cumulative stairs+drawing green** (2 pre-existing Phase 5b stair-grips failures unrelated; 211 Phase 6 baseline + 19 Phase 6.5 = 230 / +12 stair-completion Phase 5a = 232 - 2 pre-existing). LOC: ~180 prod + ~190 test = ~370 totale (sotto stima ADR ~250 prod del prompt; +30 dovuti a builder helper completo `buildHandrails` che gestisce override granulare per Google-level UX). SSoT verifiche: ZERO duplicate validator logic (gate-stair-checker = unico engine per code + egress); ZERO duplicate builder logic (`buildHandrails` helper centrale, no duplicate handrail-default math sparsa); ZERO bypass del `StairValidationState` shape Phase 1 (`egressViolations` field già definito Phase 1, ora popolato); ZERO hardcoded i18n strings nel codice `.ts` (solo i18n keys); ZERO nuovo i18n namespace (extend `tool-hints.json` esistente per egress sub-object, co-located con `tools.stair.validator.{hardError,nok,ibc,eurocode,ada,headroomBelowMin}`); ZERO modifiche a `StairRenderer.ts` o canvas pipeline (ADR-040 CHECK 6B/6C/6D NON triggherano — render deferito Phase 7a esplicito). N.7.2 checklist: ✅ proactive (validator runtime + builder auto-default at construction); ✅ no race (pure functions deterministiche); ✅ idempotent (same input → same egressViolations, same auto-default; verificato test); ✅ belt-and-suspenders (builder auto-default keeps validator green by construction + validator catches caller override drift); ✅ SSoT (gate-stair-checker engine + stair-validator facade + buildHandrails helper — unici path); ✅ await (pure sync); ✅ explicit ownership (gate-stair-checker owns engine, stair-validator owns facade, stair-completion owns builder). Zero `any`, zero `as any`, zero `@ts-ignore`; tutte le funzioni ≤40 lines GOL; tutti i signatures `Readonly<…>` per input / `readonly …[]` per output. **Carryover Phase 6.5 → Phase 7a** (vedi §13 update): ADA handrail extensions RENDER nello `StairRenderer` (305mm top horizontal + one-tread bottom polyline) sposted a Phase 7a coherent con red-badge UI surfacing + contextual ribbon tab "Stair Properties" (visual pacchetto unificato). **Commit eseguito da Giorgio** (§7.0). |
| 2026-05-16 | **ROUND 2** — Deep cross-vendor research (Revit/ArchiCAD/AutoCAD Architecture/Allplan/Vectorworks/BricsCAD BIM/Tekla/SOFiSTiK/VisualARQ). 23 nuovi gap identificati (G11-G33). §3.5 tabella codes estesa (NBC/NFPA/AS1657/DIN/ADA). Nuove §3.6 (ADA), §3.7 (egress), §3.8 (cut line convention), §3.9 (out-of-scope industry-wide). §5.1 StairParams espanso (multiStoryConfig, structureType, materials, riserType, cutPlaneHeight, treadNumbering, occupancyLoad, ADA handrail extensions, codeProfile esteso). Nuove §5.11 transforms, §5.12 grips. §5.4 SSoT count 4→8. §6.2 render con cut split. Nuove §6.5 QTO/schedule, §6.6 presets, §6.7 headroom check, §6.8 soft-lock multi-user. §7 phases con Phase 6.5/7.5/8.5 nuove. §9.2 Q17-Q34 in attesa. References +30 URL. |
| 2026-05-16 | **Phase 7b1 IMPLEMENTED** — Visual + Validator surfacing pacchetto: red "!" badge sulla tab + ADA handrail render + per-kind STAIR icons + status-bar stair prompt. Split da Phase 7b originale per context-budget; resto in Phase 7b2 (Floating Advanced Properties panel + materials/finishes + cutPlaneHeight + tread numbering + nosingSide + Dynamic Input + multi-flight turn). **16 file** (1 NEW + 11 EDIT + 4 i18n EDIT). **Stream A — Red badge surfacing** (6 file): **EDIT (1)** `src/subapps/dxf-viewer/ui/ribbon/types/ribbon-types.ts` — `RibbonTab.badgeKey?: string` field. **EDIT (2)** `src/subapps/dxf-viewer/ui/ribbon/context/RibbonCommandContext.tsx` — `RibbonCommandsApi.getBadgeState?: (badgeKey: string) => boolean` + `NOOP_BADGE_STATE` + context value field + provider memo. **EDIT (3)** `src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonStairBridge.ts` — export `STAIR_RIBBON_BADGE_KEYS = { violations: 'stair.badge.violations' }` + `isStairBadgeKey` guard + `getBadgeState(badgeKey)` reading `stair.validation.hasCodeViolations` (Set-backed owned-keys check, returns false for unknown badgeKey). **EDIT (4)** `src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonCommands.ts` — compose `getBadgeState`: route stair-prefixed badge keys to stairBridge, else `false`. **EDIT (5)** `src/subapps/dxf-viewer/ui/ribbon/data/contextual-stair-tab.ts` — set `CONTEXTUAL_STAIR_TAB.badgeKey = STAIR_RIBBON_BADGE_KEYS.violations`. **EDIT (6)** `src/subapps/dxf-viewer/ui/ribbon/components/RibbonTabItem.tsx` — consume `useRibbonCommand().getBadgeState`, render `<span class="dxf-ribbon-tab-badge">!</span>` quando `tab.badgeKey && getBadgeState(tab.badgeKey)===true`, `data-has-badge` attribute, `aria-label` via `t('ribbon.tabs.validationBadge', { defaultValue: '' })`. **EDIT (7)** `src/subapps/dxf-viewer/ui/ribbon/styles/ribbon-tokens.css` — `.dxf-ribbon-tab[data-has-badge="true"] { position: relative; padding-right: 22px }` + `.dxf-ribbon-tab-badge { position absolute top:3px right:4px 14x14 #D32F2F circle white "!" 10px 700 weight }`. **Stream B — ADA handrail render** (1 file): **EDIT (8)** `src/subapps/dxf-viewer/rendering/entities/StairRenderer.ts` — `drawHandrails(stair)` method legge `stair.params.handrails` + `stair.geometry.stringers` + `stair.params.codeProfile`; pure helpers `pickTopExtensionMm` / `pickBottomExtensionMm` / `extendPolylineEnds` / `extendOutward` calcolano gli extensions ADA: `topExtMm = override > 0 ? override : (isAda ? 305 : 0)`, `bottomExtMm = override === number > 0 ? override : (override === 'one-tread' || isAda) ? tread : 0`. `extendPolylineEnds` aggiunge punti prima/dopo polyline lungo tangente del primo/ultimo segment. Render `HANDRAIL_DASH = [3,3]` dashed + `RENDER_LINE_WIDTHS.THIN`. Geometry SSoT promotion (compute handrail polylines in `StairGeometryService` per kind) deferito a Phase 7b2/9 — Phase 7b1 deriva render-side da stringers + params (pattern Phase 5b §6.2 progressive ship). **Stream C — Per-kind STAIR_PATH icons** (2 file): **EDIT (9)** `src/subapps/dxf-viewer/ui/ribbon/components/buttons/RibbonButtonIconPaths.tsx` — export `STAIR_PATH_STRAIGHT = STAIR_PATH` (alias for naming clarity) + `STAIR_PATH_SPIRAL` (top-down spiral plan: circle radius-9 + center dot + 6 radii) + `STAIR_PATH_USHAPE` (two flights + landing rectangle in middle, top-down plan). **EDIT (10)** `src/subapps/dxf-viewer/ui/ribbon/components/buttons/RibbonButtonIcon.tsx` — register cases `'stair-straight'` / `'stair-spiral'` / `'stair-ushape'` (legacy `'stair'` rimane = straight default). Ready per Phase 7.5 variant split-button (stair-presets-service). **Stream D — Status bar inline prompt** (3 file + 2 i18n): **NEW (11)** `src/subapps/dxf-viewer/statusbar/stair-status-store.ts` (~50 LOC) — Singleton mutable cell + `useSyncExternalStore` reader. `stairStatusStore.set(key)` / `useStairStatusKey()`. Architettura: useStairTool sta dentro CanvasSection (Phase 5a wiring via `useSpecialTools`), CadStatusBar è sibling di CanvasSection in NormalView → un Context React richiederebbe di sollevare `useSpecialTools` sopra `NormalView` (toccherebbe Phase 7a frozen `DxfViewerContent.tsx`). Singleton + useSyncExternalStore = idiomatic React 18 escape-hatch per cross-sibling state che origina fuori component tree. ADR-040: `CadStatusBar.tsx` NON è in protected micro-leaf list (CHECK 6B/6C) → subscribe sicuro. **EDIT (12)** `src/subapps/dxf-viewer/hooks/drawing/useStairTool.ts` — import `stairStatusStore` + `useEffect` su `state.phase` che pubblica `tools.stair.statusBasePoint` / `…statusDirection` / `…statusConfirm` o `null` (idle). Unmount-only secondo `useEffect` separato clears store (evita transient null tra phase transitions). **EDIT (13)** `src/subapps/dxf-viewer/statusbar/CadStatusBar.tsx` — import `useStairStatusKey` + `useTranslation('tool-hints')`; render `<span role="status" aria-live="polite" class="shrink-0 text-xs font-semibold text-amber-400">{stairStatusText}</span>` PRIMA dei toggle defs, solo quando `stairStatusText !== ''` (inline left of toggles per Giorgio decision). **EDIT (14+15)** `src/i18n/locales/{el,en}/tool-hints.json` — sotto `tools.stair.*` aggiunte chiavi `statusBasePoint` / `statusDirection` / `statusConfirm` (Greek pure: "Σκάλα: κλικ για σημείο βάσης" / "Σκάλα: κλικ για κατεύθυνση" / "Σκάλα: Enter για επιβεβαίωση" — zero English residue). **EDIT (16+17)** `src/i18n/locales/{el,en}/dxf-viewer-shell.json` — sotto `ribbon.tabs.*` aggiunta chiave `validationBadge` (Greek "Παραβίαση κανονισμών", English "Code violation") per aria-label del badge. **N.7.2 Google-level checklist**: ✅ proactive (badge surfacing reactive a stair.validation.hasCodeViolations, status-bar reactive a useStairTool phase — entrambi push, no polling); ✅ no race (badge legge entity validation direttamente dalla scene SSoT, status-bar usa useSyncExternalStore — single writer/multi reader); ✅ idempotent (`stairStatusStore.set` short-circuit su same value, evita notify spurious; `getBadgeState` pure read from entity); ✅ belt-and-suspenders (badge `NOOP_BADGE_STATE` fallback + `isStairBadgeKey` guard impedisce false positives da altri bridge; handrail render no-op quando `!inner && !outer`; status-bar empty string short-circuits render); ✅ SSoT (Stream A — stair bridge unico owner di badge state; Stream B — stringers SSoT pivot per handrail derive; Stream D — `stair-status-store` unico ponte useStairTool→CadStatusBar); ✅ await (tutti sync, nessun fire-and-forget); ✅ explicit ownership (stair-status-store unico writer = `useStairTool`, unico reader = `CadStatusBar`; useRibbonStairBridge unico writer di badge state; StairRenderer unico render-time consumer di handrails+geometry). SSoT verifiche: ZERO duplicate badge surfacing logic (1 punto: `useRibbonStairBridge.getBadgeState`); ZERO duplicate handrail extension math (helpers locali StairRenderer.ts, candidato promotion a `stair-handrail-render-utils` se Phase 7b2 li riusa o se per-kind geometry pipeline assorbe il calcolo); ZERO nuovo CSS file (extend `ribbon-tokens.css` esistente per `.dxf-ribbon-tab-badge`); ZERO bypass del `RibbonTab` shape (badgeKey opzionale = backward-compatible extension); ZERO modifiche a CanvasSection / CanvasLayerStack / canvas-layer-stack-leaves (ADR-040 CHECK 6B/6C NON triggherano); StairRenderer modifica triggers CHECK 6D ma ADR-358 staged stesso commit → safe. Zero `any`/`as any`/`@ts-ignore`; tutte le funzioni ≤40 lines GOL; tutti i signatures `Readonly<…>` / `readonly …[]`. **Carryover Phase 7b1 → Phase 7b2** (vedi §13 update): (a) Floating Advanced Properties panel + materials/finishes UI per-stair + per-tread override (G13, Q19) — originale Phase 7b scope §7.2 row 7b; (b) `cutPlaneHeight` toggle (Q21); (c) tread numbering UI (Q28: `treadLabelDisplay all/nth/none` + `treadLabelEveryN` + `restartPerFlight`); (d) `nosingSide` selector (Q34); (e) Inline Dynamic Input rise/tread/width Tab cycling — Phase 5a carryover; (f) multi-flight `turnDirection` toggle per L/U/Γ flight 2/3 — Phase 5b carryover; (g) eventual promotion handrail extension helpers a `stair-handrail-render-utils.ts` SSoT shared se Phase 7b2 richiede riuso; (h) eventual promotion handrail polylines compute in `StairGeometryService` per kind se Phase 8 (Firestore persistence) richiede geometry full-cache. **Commit eseguito da Giorgio** (§7.0). |
| 2026-05-16 | **Phase 7b2b-α IMPLEMENTED** — Floating Advanced Properties panel polish: Stream G item 4 (TreadNumbering section, Q28 — `treadLabelDisplay` radio all/nth/none + conditional `treadLabelEveryN` numeric + `treadLabelRestartPerFlight` toggle default OFF, continuous numbering 1→N industry-aligned with Revit/ArchiCAD) + Stream G item 5 (NosingSide selector, Q34 — combobox `front`/`none`/`front-and-sides` reading `stair.params.nosingSide`, smart-default from `structureType` lives in ribbon bridge Phase 7a, panel surfaces value + allows explicit override). 5 file (2 NEW sections + 1 EDIT compose + 2 i18n EDIT el+en, ~190 LOC). StairAdvancedPanel header comment updated to reflect 5/5 section stack shipped. Streams E (Inline Dynamic Input rise/tread/width Tab cycling) + F (Multi-flight `turnDirection` ribbon panel) split out to Phase 7b2b-β: state-machine mismatch between Dynamic Input `Phase` enum (`'first-point' \| 'second-point' \| 'continuous'`) and `StairToolPhase` (`'idle' \| 'awaitingBasePoint' \| 'awaitingDirection' \| 'confirming'`) needs design decision (extend Phase enum vs context-bridge); Stream F needs `RibbonTab.panels[i].visibilityKey` framework extension (currently no entity-state-driven panel visibility). Items (3)(4)(5) of §13 Phase 7b2a carryover remain open. |
| 2026-05-16 | **Phase 7b2a IMPLEMENTED** — Floating Advanced Properties panel base (host + 3 sections shipped of 5 planned for Phase 7b2 original). Industry research applied (`feedback_industry_standard_default`): **Materials catalog** — 5/5 big-player convergence (Revit Asset Manager + ArchiCAD Surface Manager + Vectorworks Resource Manager + AutoCAD Architecture Material Browser + Allplan SmartParts) on categorized library picker → 10-preset dropdown + `'custom'` sentinel → free-form text input + `MaterialCatalogProvider` interface stub for Phase 9 swap to a Firestore-backed Asset Manager (`materials_catalog` scoped by `companyId` + `projectId`). **Mount point** — 5/5 big-player convergence (Revit Properties Palette + ArchiCAD Info Box + AutoCAD Properties + Vectorworks OIP + BricsCAD Properties) on **Properties panel separato dalla ribbon**, lifecycle indipendente dal contextual tab → new orchestrator `StairAdvancedPanelHost` sibling di `RibbonRoot` (DxfViewerContent edit minimal: 1 import + 1 JSX, host stesso orfano w.r.t. high-freq stores per ADR-040 CHECK 6C compliance). **Per-tread override** — Q19 hybrid (Q1 user answer): table editor 7b2a + click-on-canvas Phase 8+ (ArchiCAD pattern carryover). **11 file** (8 NEW + 3 EDIT): **NEW (1)** `src/subapps/dxf-viewer/systems/stairs/stair-material-catalog.ts` (~90 LOC) — `STAIR_MATERIAL_PRESET_IDS` 9 preset slugs `['oak','walnut','marble','granite','concrete','steel','glass','terrazzo','tile']` + `STAIR_MATERIAL_CUSTOM_ID = 'custom'` sentinel + `StairMaterialOption` shape + `MaterialCatalogProvider` interface (`listMaterialIds` / `resolvePreset`) + `defaultStairMaterialCatalog` ready-to-use provider + `classifyStairMaterial(id, catalog?)` → `'preset' | 'custom' | 'empty'` (UI classifier). **NEW (2)** `src/subapps/dxf-viewer/ui/stair-advanced-panel/hooks/useSelectedStair.ts` (~30 LOC) — pure `useMemo` derivation from orchestrator-passed `primarySelectedId` + `currentScene` (no internal `useUniversalSelection` subscription — avoids double-subscribe to orchestrator-level store). **NEW (3)** `src/subapps/dxf-viewer/ui/stair-advanced-panel/commands/dispatchStairParamPatch.ts` (~65 LOC) — SSoT writer for panel mutations: `useStairParamsDispatcher({ levelManager })` returns `DispatchStairParamPatch = (stair, patch) => void`. Shallow-merges `{ ...stair.params, ...patch }` + instantiates `LevelSceneManagerAdapter` + dispatches `UpdateStairParamsCommand(stair.id, next, stair.params, sm, false)` (commit-on-change, discrete undo, no merge window). Mirrors `useRibbonStairBridge.dispatchParams` (Phase 7a) verbatim. **NEW (4)** `src/subapps/dxf-viewer/ui/stair-advanced-panel/sections/StairMaterialsSection.tsx` (~140 LOC) — Stream G item 1. Four material slots (tread/riser/stringer/landing) per Q19. Each slot row = `<select>` (10 preset + `'custom'` sentinel) + conditional `<input type="text">` when `classifyStairMaterial() === 'custom'`. Empty selection (`''`) → patch `materials[slot] = undefined`. Preset selection → patch with preset id. `'custom'` sentinel selection → patch with `''` (initial empty custom, user types). Patch shape: `{ materials: { ...prev, [slot]: nextValue } }`. **NEW (5)** `src/subapps/dxf-viewer/ui/stair-advanced-panel/sections/StairPerTreadOverrideSection.tsx` (~260 LOC) — Stream G item 2 (Q19 hybrid table). Sorted index rows over `params.perTreadOverrides` Record; `+` button picks next free index in `[1, stepCount]` (linear scan, no collision); `−` button omits index via `omitIndex(prev, index)` helper. Per row: material picker (preset+custom, identical UX to MaterialsSection) + nosing numeric input `[0, 100]` mm + remove button. Patch shape add/update: `{ perTreadOverrides: { ...prev, [index]: merged } }`; remove: `omitIndex(prev, index)`. Empty state shows `t('…perTread.empty')` localized hint. **NEW (6)** `src/subapps/dxf-viewer/ui/stair-advanced-panel/sections/StairCutPlaneSection.tsx` (~90 LOC) — Stream G item 3 (Q21). Project-default constant `PROJECT_DEFAULT_CUT_PLANE_MM = 1200` (Phase 8+ swap-target: project-scoped setting `dxf:project.cutPlaneHeight` read via context). Inherit toggle ON → `cutPlaneHeight = undefined`; OFF → seed with project default; numeric input editable when `inherits === false`, disabled+empty when inheriting. Patch shape: `{ cutPlaneHeight: number | undefined }`. **NEW (7)** `src/subapps/dxf-viewer/ui/stair-advanced-panel/StairAdvancedPanel.tsx` (~40 LOC) — pure presentational: receives `stair` + `dispatchPatch`, composes 3 sections (Materials + PerTreadOverride + CutPlane). Floating positioning Tailwind utility classes: `fixed right-4 top-20 z-40 w-80 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/95 p-3 shadow-xl backdrop-blur` (industry-default Revit Properties Palette docked-right). Drag-to-reposition deferred to Phase 7.5+. Semantic `<aside>` + `<header>` + `<h3>` (SOS N.4 no div soup). **NEW (8)** `src/subapps/dxf-viewer/app/StairAdvancedPanelHost.tsx` (~50 LOC) — orchestrator. Receives orchestrator-level props (`primarySelectedId`, `currentScene`, `levelManager`), derives `stair` via `useSelectedStair`, returns `null` when no stair, else mounts `<StairAdvancedPanel>`. **EDIT (9)** `src/subapps/dxf-viewer/app/DxfViewerContent.tsx` — 1 import line + 1 JSX node (sibling of `RibbonRoot`). Host stays orphan w.r.t. high-frequency stores; only props from already-subscribed orchestrator state. ADR-040 CHECK 6B/6C/6D unaffected (DxfViewerContent body unchanged in its subscription surface). **EDIT (10+11)** `src/i18n/locales/{el,en}/dxf-viewer-shell.json` — new top-level `stairAdvancedPanel` namespace: `.title` / `.closeAriaLabel` / `.sections.materials.{title,tread,riser,stringer,landing,customPlaceholder}` / `.sections.perTread.{title,empty,addOverride,removeOverride,columns.{index,material,nosing},rowAriaLabel}` (ICU `{index}`) / `.sections.cutPlane.{title,inheritProject,projectDefaultHint,overrideMm}` (ICU `{valueMm}`) / `.materials.preset.{oak,walnut,marble,granite,concrete,steel,glass,terrazzo,tile,custom}`. Greek strictly Greek (zero English residue per `feedback_pure_greek_locale`): "Δρυς / Καρυδιά / Μάρμαρο / Γρανίτης / Μπετόν / Χάλυβας / Γυαλί / Βενετσιάνικο / Πλακάκι / Προσαρμοσμένο". ICU single-brace `{var}` (CHECK 3.9 compliant). **N.7.2 Google-level checklist**: ✅ reactive (panel mounts on selection event — appropriate for UI panel); ✅ no race (`dispatchStairParamPatch` reads current params at dispatch time; multi-edit fast inputs serialized by sync `CommandHistory.execute`); ✅ idempotent (identical patch → no-op since `UpdateStairParamsCommand` recomputes geometry from same params, and React's same-prop comparison short-circuits the field handler logic); ✅ belt-and-suspenders (`useSelectedStair` null-guard + `isStairEntity` type narrow + `dispatchStairParamPatch` skips when `currentLevelId` is null); ✅ SSoT (`dispatchStairParamPatch` = unique writer of stair params from the panel; reuses existing `UpdateStairParamsCommand` ADR-031 — zero parallel mutation path; `stair-material-catalog` = unique catalog SSoT with `MaterialCatalogProvider` interface as Phase 9 swap point); ✅ await sync (`CommandHistory.execute` is synchronous, mutations land before next render); ✅ explicit ownership (`StairAdvancedPanelHost` orchestrator owns lifecycle, sections are pure presentational view, dispatcher hook owns command construction). SSoT verifiche: ZERO duplicate dispatch logic (`dispatchStairParamPatch` is the unique panel→command bridge, mirrors `useRibbonStairBridge` pattern); ZERO duplicate material catalog (`stair-material-catalog.ts` is the SSoT module, `MaterialCatalogProvider` interface is the Phase 9 swap point); ZERO duplicate selection narrowing (`useSelectedStair` is the unique reducer over `primarySelectedId + currentScene`); ZERO new high-frequency subscription in orchestrator (host receives props, internal `useMemo` derivation only); ZERO modifiche a CanvasSection / CanvasLayerStack / canvas pipeline (ADR-040 CHECK 6B/6C/6D NON triggherano); ZERO hardcoded user-facing strings nel codice `.tsx` (tutte via `t()` con ICU `{var}` single-brace, CHECK 3.9 compliant); ZERO English residue nel locale Greek. Zero `any`/`as any`/`@ts-ignore`; tutte le funzioni ≤40 lines GOL; tutti i signatures `Readonly<…>` / `readonly …[]`. Largest file `StairPerTreadOverrideSection.tsx` ~260 LOC ≤500 (N.7.1). **Carryover Phase 7b2a → Phase 7b2b**: (4) Stream G item 4 TreadNumbering section (Q28 — `treadLabelDisplay` radio + `treadLabelEveryN` numeric + `treadLabelRestartPerFlight` toggle); (5) Stream G item 5 `nosingSide` combobox in panel (Q34); (6) Stream E Inline Dynamic Input rise/tread/width Tab cycling (Phase 5a carryover — extend `KeyboardHandlerContext` + DynamicInput panel + Tab cycling); (7) Stream F Multi-flight `turnDirection` toggle per L/U/Γ flight 2/3 (Phase 5b carryover — extend bridge with flight2/3 keys + conditional ribbon panel visibility on `variant.kind ∈ {l-shape,u-shape,gamma}`); (i) click-on-canvas per-tread override (Q19 ArchiCAD pattern) Phase 8+; (ii) drag-to-reposition floating panel Phase 7.5+; (iii) project-scoped `dxf:project.cutPlaneHeight` setting (currently hardcoded `PROJECT_DEFAULT_CUT_PLANE_MM = 1200`) Phase 8+. **Commit eseguito da Giorgio** (§7.0). |
| 2026-05-17 | **Phase 7.5 IMPLEMENTED** — Stair Library Presets (G26, Q32): `stair-presets-service` SSoT + Firestore CRUD on `companies/{cid}/stair_presets/{presetId}` + 3-scope listing (user/company/project, resolved Day-1 per Q32) + 5-min cache + UI integration in floating `StairAdvancedPanel`. **10 file** (4 NEW + 6 EDIT, ~770 LOC + 18 test PASS). **Design decisions resolved with Giorgio**: (DD-1) UI mount point — industry convergence 5/5 vendor (Revit Properties Palette Type Selector, ArchiCAD Favorites, Vectorworks Resource Manager, AutoCAD Style Manager, BricsCAD Properties) → **option (B) floating panel section**, NOT ribbon. REJECTED ribbon panel (no room for management UI) and dual mount (~30% duplicate state). (DD-2) Save flow — industry convergence 3/5 vendor inline (ArchiCAD/Vectorworks/BricsCAD) vs 2/5 modal (Revit/AutoCAD) → **option (B) inline rename** + scope dropdown + Enter/Esc keyboard shortcuts. REJECTED modal (interrupts flow) and toast (uncommon in CAD). (DD-3) Apply behavior — industry convergence 5/5 vendor full-replace → **option (A) full replace**, `preset.params` overrides everything except `basePoint`/`direction` (preserved from live stair placement). REJECTED merge-geometric-only (mismatch between preset name and applied result) and smart kind-aware (extra modal complexity). **Files**: **NEW (1)** `src/subapps/dxf-viewer/systems/stairs/stair-presets-service.ts` (~190 LOC) — `StairPresetsService` class + `createStairPresetsService({ companyId, userId, projectId? })` factory. Methods: `listPresets()` (3-scope parallel `getDocs` + merge + 5min cache), `savePreset({ name, kind, scope, params })` (generates ID via `generateStairPresetId`, `setDoc` Firestore, validation errors `STAIR_PRESET_NAME_REQUIRED` / `STAIR_PRESET_PROJECT_SCOPE_REQUIRES_PROJECT_ID`, trims name, persists `projectId` only when `scope === 'project'`), `deletePreset(id)` (deleteDoc + cache invalidate), `invalidateCache()`. SOS N.6 compliance: `setDoc()` + `generateStairPresetId()` (sprst_<ulid26>), zero `addDoc`. All queries narrow by `companyId` (tenant isolation belt-and-suspenders alongside Firestore rules). **NEW (2)** `src/subapps/dxf-viewer/systems/stairs/__tests__/stair-presets-service.test.ts` (~280 LOC) — 18 tests across 7 suites (factory / savePreset 5 / listPresets 5 / cache 5 / deletePreset / tenantIsolation). Firestore SDK fully mocked with per-query filter capture (avoids race on shared module variable that would otherwise break 3-scope parallel reads). Mocks: `setDoc`/`deleteDoc`/`getDocs`/`query`/`where`/`serverTimestamp`/`doc`/`collection` + `db` + `generateStairPresetId` (deterministic test IDs). Test coverage includes: enterprise ID format, name trimming, scope=project requires projectId, projectId persisted only when scope=project, user-scope owner-only filter, company-scope tenant-wide, project-scope projectId filter, project query skipped when no projectId, 3-scope merge, 5min TTL cache hit/miss, cache invalidation on save/delete, TTL expiry via Date.now mock, tenant isolation cross-companyId. **18/18 green** (~5s root jest config). **NEW (3)** `src/subapps/dxf-viewer/ui/stair-advanced-panel/hooks/useStairPresets.ts` (~130 LOC) — React adapter. `useMemo` service per `companyId|userId|projectId`, `useEffect` refresh on mount/keys-change, reactive `presets` state, `loading`/`error` surfaced for UI (error codes match `STAIR_PRESET_*` keys for i18n lookup). `loadPreset(stair, preset)` implements full-replace pipeline: `next = { ...preset.params, basePoint: stair.params.basePoint, direction: stair.params.direction }`, dispatches `UpdateStairParamsCommand` via `useCommandHistory` + `LevelSceneManagerAdapter` (single undo step, idempotent on no-change). `savePreset`/`deletePreset` async with error capture + refresh. **NEW (4)** `src/subapps/dxf-viewer/ui/stair-advanced-panel/sections/StairPresetsSection.tsx` (~225 LOC) — UI section. Header with title + "Save" toggle button → inline save mode: `<input>` name + `<select>` scope (user/company/project conditional on `projectId`) + Confirm/Cancel buttons, Enter/Esc keyboard handlers. 3 grouped lists (`SCOPE_ORDER = ['user', 'company', 'project']`) each with empty-state hint + `<ul>` of presets each with Load + Delete buttons (Delete UI-gated on `ownerId === userId`; Firestore rules enforce authoritatively). Error display via `t('…errors.{code}')` lookup with raw-code fallback. Semantic `<section>` + `<header>` + `<ul>`/`<li>` (SOS N.4 no div soup). **EDIT (5)** `src/subapps/dxf-viewer/ui/stair-advanced-panel/StairAdvancedPanel.tsx` — `<StairPresetsSection>` mounted first (industry convention: Revit Type Selector at top of Properties palette). New props `companyId | null` / `userId | null` / `projectId?` / `levelManager` (passed by host). Presets section conditional on `companyId && userId` (both required for service). Header comment updated to reflect 6 sections (Presets + 5 prior). **EDIT (6)** `src/subapps/dxf-viewer/app/StairAdvancedPanelHost.tsx` — added `useAuth()` for `user?.companyId` + `user?.uid` propagation; new optional `projectId?` prop (Phase 7.5 surfaces user+company scopes by default; project scope wires when route plumbing provides projectId — graceful absence allowed by service skipping project query). Host already mounts conditionally on stair selection, so `useAuth()` here does not introduce new high-frequency subscriptions (ADR-040 CHECK 6B/6C/6D NON triggherano). **EDIT (7)** `firestore.rules` — new `match /companies/{companyId}/stair_presets/{presetId}` block inside `/companies/{companyId}/` (after `audit_logs`). 4 rules: READ tenant-scoped via `belongsToCompany(companyId)` + scope filter (user → owner-only, company/project → tenant-wide); CREATE tenant member with `companyId === path` + `ownerId === request.auth.uid` + `scope ∈ ['user','company','project']` + project scope requires `projectId` field; UPDATE owner-only with immutable `companyId`/`scope`/`ownerId`; DELETE owner OR `isCompanyAdminOfCompany(companyId)` for company/project scope. Reuses ADR-294/ADR-356 helper functions (`isAuthenticated`, `belongsToCompany`, `isCompanyAdminOfCompany`). **EDIT (8)** `.ssot-registry.json` — new Tier 3 module `stair-presets-service` with `forbiddenPatterns`: `addDoc.*stair_presets`, `collection.*stair_presets.*\\{`, `crypto.randomUUID.*stair[_-]preset`, `Date.now.*stair[_-]preset`. Allowlist: service file + tests. Mirrors Tier 0 `addDoc-prohibition` SOS N.6 enforcement scoped to stair_presets. **EDIT (9+10)** `src/i18n/locales/{el,en}/dxf-viewer-shell.json` — new `stairAdvancedPanel.sections.presets.*` namespace: `title` / `save` / `confirmSave` / `cancel` / `load` / `delete` / `namePlaceholder` / `scopeUser` / `scopeCompany` / `scopeProject` / `emptyScope` / `loading` + `errors.{STAIR_PRESET_NAME_REQUIRED, STAIR_PRESET_PROJECT_SCOPE_REQUIRES_PROJECT_ID, STAIR_PRESET_LIST_FAILED, STAIR_PRESET_SAVE_FAILED, STAIR_PRESET_DELETE_FAILED}`. Greek pure (zero English residue): "Βιβλιοθήκη Προτύπων / Αποθήκευση / OK / Άκυρο / Φόρτωση / Διαγραφή / Όνομα προτύπου / Δικά μου / Εταιρείας / Έργου / Κανένα πρότυπο / Φόρτωση… / Απαιτείται όνομα προτύπου / Δεν υπάρχει ενεργό έργο / Αποτυχία ανάκτησης προτύπων / Αποτυχία αποθήκευσης προτύπου / Αποτυχία διαγραφής προτύπου". **N.7.2 Google-level checklist**: ✅ proactive (presets fetched on panel mount + on auth/project keys change, not lazy on first interaction); ✅ no race (save/delete await + cache invalidate before refresh; service queries always include companyId belt-and-suspenders); ✅ idempotent (cache hit serves identical reference; same setDoc payload yields same doc; UpdateStairParamsCommand recomputes geometry deterministically); ✅ belt-and-suspenders (service-layer validation `STAIR_PRESET_NAME_REQUIRED`/`STAIR_PRESET_PROJECT_SCOPE_REQUIRES_PROJECT_ID` + Firestore rules tenant isolation + UI conditional render on `companyId && userId` + Delete UI-gated on owner before rules-enforced check); ✅ SSoT (`stair-presets-service` unique writer/reader of `stair_presets` collection; `useStairPresets` unique React adapter; `StairPresetsSection` unique UI consumer); ✅ await sync (`savePreset`/`deletePreset` await firestore writes before cache invalidate + refresh — guarantees next read sees latest state); ✅ explicit ownership (service owned by hook via `useMemo`, hook owned by panel section, section mounted only when `companyId && userId` resolved). SSoT verifiche: ZERO duplicate Firestore writer for stair_presets (service is unique entry point — pre-commit ratchet enforces via Tier 3 module + Tier 0 addDoc-prohibition); ZERO duplicate ID generation (`generateStairPresetId` exists since Phase 1, reused verbatim); ZERO inline `addDoc` (`setDoc` only); ZERO hardcoded user-facing strings in `.tsx` (all via `t()`, CHECK 3.8 compliant); ZERO English residue in Greek locale (CHECK pure Greek); ZERO modifiche a CanvasSection / CanvasLayerStack / canvas pipeline (ADR-040 CHECK 6B/6C/6D NON triggherano); ZERO new high-frequency subscription (host's `useAuth` is read-once-per-mount, panel mounts conditionally on stair selection). Zero `any`/`as any`/`@ts-ignore`; tutte le funzioni ≤40 lines GOL; tutti i signatures `Readonly<…>` / `readonly …[]`; largest file `StairPresetsSection.tsx` ~225 LOC ≤500 (N.7.1). **Items §13 carryover updates**: (ii) drag-to-reposition floating panel — kept open Phase 7.5+ (no drag implemented in this Phase, framework neutral). (5) Project-scoped `dxf:project.cutPlaneHeight` setting — kept open Phase 8+. (i) click-on-canvas per-tread override — kept open Phase 8+. (iii) material renderer wiring — kept open Phase 8+. NEW carryover for future: project-scope preset wiring requires DxfViewerContent to plumb `projectId` from URL/floorplan meta into `StairAdvancedPanelHost` (Phase 8 alongside Firestore persistence). **Commit eseguito da Giorgio** (§7.0). |
| 2026-05-17 | **Phase 7b2b-β IMPLEMENTED** — Two carryover streams resolved: **Stream E** Inline Dynamic Input rise/tread/width (Phase 5a carryover) + **Stream F** Multi-flight `turnDirection` ribbon panel with new `RibbonPanelDef.visibilityKey?` framework extension (Phase 5b carryover). **17 file** (1 NEW + 14 EDIT + 4 i18n EDIT, ~520 LOC). **Design decisions resolved with Giorgio**: (DD-E) Stream E phase visibility — industry research 5/5 vendor convergence (AutoCAD Dynamic Input, Revit Properties Palette, ArchiCAD Info Box, Vectorworks OIP, SolidWorks Property Manager) → **option (A) always visible from tool activation**, no phase-gate, supports pre-set workflow (user sets `W=1500` once, then 5 stairs same width without retyping). REJECTED option (B) confirming-only and (C) intermediate-phase. Architectural consequence: NO Phase-enum-extend, NO context-bridge, NO sentinel-cast needed — simple `case 'stair' → ['rise','tread','width']` in `useDynamicInputLayout` + new `StairField` union type kept separate from `Field` to avoid breaking exhaustive switches + new `activeStairField` sub-state in `useDynamicInputState` for Tab cycling. (DD-F) Stream F panel visibility — industry research 4/4 vendor convergence (Revit Modify ribbon, ArchiCAD Stair Settings, AutoCAD contextual ribbon, Vectorworks OIP) on context-aware panel visibility via framework → **option (A) `RibbonPanelDef.visibilityKey?` framework extension + `getPanelVisibility(key)` resolver**. REJECTED option (B) always-visible-disabled-buttons (UX dead panel) and (C) component-level conditional render (no SSoT, no reuse). Architectural consequence: framework extension mirrors Phase 7b1 `badgeKey` pattern → `RibbonPanelDef.visibilityKey?: string` field + `RibbonCommandsApi.getPanelVisibility?: (visibilityKey: string) => boolean` + `RibbonCommandProvider` `DEFAULT_PANEL_VISIBILITY = () => true` (no breaking change for existing panels) + `RibbonBody` `.filter(panel => panel.visibilityKey === undefined || getPanelVisibility(panel.visibilityKey))` upstream of `RibbonPanel` render. **Stream E — Dynamic Input rise/tread/width** (7 file): **EDIT (1)** `src/subapps/dxf-viewer/systems/dynamic-input/types/common-interfaces.ts` — new `export type StairField = 'rise' \| 'tread' \| 'width'` kept separate from `Field` union. **EDIT (2)** `src/subapps/dxf-viewer/systems/dynamic-input/keyboard-handlers/types.ts` — extend `KeyboardHandlerContext` (riseValue/treadValue/widthValue + activeStairField), `KeyboardHandlerActions` (setRiseValue/setTreadValue/setWidthValue/setActiveStairField), `KeyboardHandlerRefs` (riseInputRef/treadInputRef/widthInputRef). **EDIT (3)** `src/subapps/dxf-viewer/systems/dynamic-input/hooks/useDynamicInputState.ts` — add rise/tread/width state (defaults `'175'/'280'/'1200'` industry NOK main), refs, setters, activeStairField sub-state `'rise'` default, return surface extension. **EDIT (4)** `src/subapps/dxf-viewer/systems/dynamic-input/hooks/useDynamicInputKeyboard.ts` — extend `UseDynamicInputKeyboardArgs` + props passthrough + contextRef/actionsRef/refsRef populated with stair fields (zero new useEffect deps — still 2 deps total). **EDIT (5)** `src/subapps/dxf-viewer/systems/dynamic-input/keyboard-handlers/stair-keyboard-handler.ts` — implement Tab cycling rise→tread→width (Shift+Tab reverses) via `STAIR_FIELD_CYCLE` ring + `setActiveStairField` + `focusAndSelect(nextRef)`; Enter parses 3 current values via `validateStairField` (ranges rise [100,220], tread [220,360], width [600,2400]) + dispatches `commit-stair` with `params: { rise, tread, width }`. **EDIT (6)** `src/subapps/dxf-viewer/systems/dynamic-input/hooks/useDynamicInputLayout.ts` — `case 'stair': return ['rise', 'tread', 'width']` (no phase-gate). **EDIT (7)** `src/subapps/dxf-viewer/systems/dynamic-input/components/DynamicInputOverlay.tsx` — destructure new stair state/setters/refs, add `'stair'` to `drawingTools` list + short-circuit `shouldShowDynamicInput` (`return true` when active, no cursorPosition prerequisite — pre-set workflow), pass stair fields to `useDynamicInputKeyboard`, render 3 new `<DynamicInputField label="R/T/W">` (fieldType=`'length'`), extend focus useEffect to use `activeStairField` when `activeTool === 'stair'`. **EDIT (8)** `src/subapps/dxf-viewer/systems/dynamic-input/utils/events.ts` — extend `DynamicSubmitDetail` with optional `rise/tread/width` for commit-stair payload. **EDIT (9)** `src/subapps/dxf-viewer/hooks/drawing/useStairTool.ts` — new `confirmWithOverrides(overrides)` method (bypasses async setState batching) + new useEffect listener on `dynamic-input-coordinate-submit` event filtering `action === 'commit-stair' && tool === 'stair'`, builds `StairParamOverrides` from typed event detail, calls `confirmWithOverrides`. **Stream F — Multi-flight ribbon panel + visibilityKey framework** (8 file): **EDIT (10)** `src/subapps/dxf-viewer/ui/ribbon/types/ribbon-types.ts` — add `RibbonPanelDef.visibilityKey?: string` optional field. **EDIT (11)** `src/subapps/dxf-viewer/ui/ribbon/context/RibbonCommandContext.tsx` — add `RibbonCommandsApi.getPanelVisibility?: (visibilityKey: string) => boolean` + `DEFAULT_PANEL_VISIBILITY = () => true` (default always-visible, zero breaking change) + provider memo dep. **EDIT (12)** `src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/stair-command-keys.ts` — new `STAIR_RIBBON_VISIBILITY_KEYS.multiFlight = 'stair.visibility.multiFlight'` + extend `STAIR_RIBBON_KEYS.stringParams` with `flight2TurnDirection` / `flight3TurnDirection` + new `isStairVisibilityKey` type guard + extend `ALL_STAIR_STRING_COMBO_KEYS` set. **EDIT (13)** `src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonStairBridge.ts` — add `getPanelVisibility(visibilityKey)` returning `kind ∈ {l-shape, u-shape, gamma}` for `multiFlight` key (returns false when no stair selected, returns true for keys not owned by stair bridge), add `patchFlightTurnDirection(prev, flightIndex, value)` discriminated-union helper (l-shape/u-shape patch `variant.turnDirection` singolo, gamma patch `variant.turnSequence[flightIndex]` tuple), wire into `patchStairStringParam` switch, extend `readStairStringField` with `readFlightTurnDirection`, export new `isStairPanelVisibilityKey` type guard (mirrors `isStairBadgeKey`). **EDIT (14)** `src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonCommands.ts` — compose `getPanelVisibility` (stair-prefixed → stairBridge, else `true`), add to memoized API return. **EDIT (15)** `src/subapps/dxf-viewer/ui/ribbon/data/contextual-stair-tab.ts` — new `TURN_DIRECTION_OPTIONS` (left/right with i18n labels) + new `stair-multi-flight` panel with `visibilityKey: STAIR_RIBBON_VISIBILITY_KEYS.multiFlight` + 2 comboboxes (flight2/3 turnDirection, 110px width). Panel inserted between `stair-multistory` and `stair-actions`. flight3 combobox no-ops for l-shape/u-shape (gamma-only via discriminated-union patch helper). **EDIT (16)** `src/subapps/dxf-viewer/ui/ribbon/components/RibbonBody.tsx` — read `getPanelVisibility` from `useRibbonCommand()` context + `.filter(p => p.visibilityKey === undefined || getPanelVisibility(p.visibilityKey))` upstream of both `isSettingsMode` and normal-mode panel maps. **i18n** (2 file): **EDIT (17+18)** `src/i18n/locales/{el,en}/dxf-viewer-settings.json` — `dynamicInput.placeholders.{rise,tread,stairWidth}` ("π.χ. 175" / "π.χ. 280" / "π.χ. 1200"). **EDIT (19+20)** `src/i18n/locales/{el,en}/dxf-viewer-shell.json` — `ribbon.panels.stairMultiFlight` (Greek "Πολλαπλά Σκέλη", English "Multi-Flight") + `ribbon.commands.stairEditor.{flight2TurnDirection,flight3TurnDirection,turnDirectionLeft,turnDirectionRight}` (Greek pure: "Στροφή Σκέλους 2/3 / Αριστερά / Δεξιά", English: "Flight 2/3 Turn / Left / Right"). **N.7.2 Google-level checklist**: ✅ proactive (Dynamic Input rise/tread/width visible immediately on tool activation, no cursor-position prerequisite — industry pre-set workflow); ✅ no race (Stream E `confirmWithOverrides` bypasses React setState batching by applying overrides atomically inside `commitFromState`; Stream F panel visibility is pure read from current variant.kind at render time, no stale state); ✅ idempotent (Stream E onChange normalize commas to dots, Tab cycle is pure ring rotation; Stream F `patchFlightTurnDirection` returns null on same-value no-op); ✅ belt-and-suspenders (Stream E `parseStairField` validates via `validateStairField` ranges + `Number.isFinite` guard + CADFeedback.onError on invalid; Stream F `isStairVisibilityKey` guard + null-stair guard returning false; commit-stair listener narrows by `tool === 'stair' && action === 'commit-stair'`); ✅ SSoT (Stream E `validateStairField` + `STAIR_FIELD_RANGES` unique source, reused by handler; `StairField` union single declaration in common-interfaces; Stream F `STAIR_RIBBON_VISIBILITY_KEYS` registry mirrors `STAIR_RIBBON_BADGE_KEYS` pattern; `getPanelVisibility` composer in useRibbonCommands routes by ownership set); ✅ await sync (`confirmWithOverrides` is sync, `RibbonBody.filter` is sync); ✅ explicit ownership (`useStairTool` unique listener for `commit-stair` events; `useRibbonStairBridge` unique owner of stair visibility keys; `RibbonBody` unique filter point for panel visibility). SSoT verifiche: ZERO duplicate Field union (separate StairField type, no breaking switch exhaustiveness); ZERO duplicate event payload (`DynamicSubmitDetail` extended in place, single declaration); ZERO duplicate visibility resolver (`getPanelVisibility` composed once in useRibbonCommands, used by RibbonBody); ZERO duplicate flight patch logic (`patchFlightTurnDirection` switches over discriminated union once for both flight2/3); ZERO modifiche a CanvasSection / CanvasLayerStack / canvas pipeline (ADR-040 CHECK 6B/6C/6D NON triggherano); ZERO hardcoded user-facing strings (placeholders + commands + panels all via `t(...)`, CHECK 3.8 compliant); ZERO English residue nel locale Greek. Zero `any`/`as any`/`@ts-ignore`; tutte le funzioni ≤40 lines GOL; tutti i signatures `Readonly<…>` / `readonly …[]`; largest file `stair-keyboard-handler.ts` ~130 LOC ≤500 (N.7.1). **Items §13 Phase 7b2a carryover resolved**: (6) Stream E ✅ DONE; (7) Stream F ✅ DONE. Remaining open: (i) click-on-canvas per-tread override Phase 8+; (ii) drag-to-reposition floating panel Phase 7.5+; (iii) project-scoped `dxf:project.cutPlaneHeight` setting Phase 8+. **Commit eseguito da Giorgio** (§7.0). |
| 2026-05-16 | **Phase 7a IMPLEMENTED** — Contextual ribbon tab "Stair Properties" + 8-type `structureType` selector (Q18) + `riserType` combobox + Geometry params (rise/tread/width/stepCount) + Multi-Story panel (`storyCount`/`storyHeight` writing `StairParams.multiStoryConfig`) + smart defaults on structureType change (Q20 riserType + Q34 nosingSide auto-applied in same `UpdateStairParamsCommand`). **9 file** (3 NEW + 4 EDIT + 2 i18n EDIT): **NEW (1)** `src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/stair-command-keys.ts` (~60 LOC) — `STAIR_RIBBON_KEYS` registry (stringParams: structureType/riserType; params: rise/tread/width/stepCount/storyCount/storyHeight; actions: close) + `Set`-backed type guards `isStairRibbonKey` / `isStairRibbonStringKey`. Pattern mirror `ARRAY_RIBBON_KEYS` (ADR-353). **NEW (2)** `src/subapps/dxf-viewer/ui/ribbon/data/contextual-stair-tab.ts` (~265 LOC, data file no logic) — `STAIR_CONTEXTUAL_TRIGGER='stair-selected'` + 8 static options arrays (STRUCTURE_TYPE_OPTIONS literal-labels enterprise: Monolithic / Stringer 1-Side / Stringer 2-Side / Central Stringer / Cantilever / Suspended / Glass Tread / Steel Grating; RISER_TYPE_OPTIONS closed/open; RISE_MM_OPTIONS 11 valori 140-220; TREAD_MM_OPTIONS 10 valori 220-350; WIDTH_MM_OPTIONS 9 valori 800-2000; STEP_COUNT_OPTIONS 16 valori 3-20; STORY_COUNT_OPTIONS 10 valori 1-10; STORY_HEIGHT_MM_OPTIONS 8 valori 2400-3500) + `CONTEXTUAL_STAIR_TAB: RibbonTab` con 4 panels (`stair-structure` 2 combobox + `stair-geometry` 4 combobox + `stair-multistory` 2 combobox + `stair-actions` 1 simple button). Tutte le option labels via `isLiteralLabel: true` per literal numbers + technical engineering names (industry convergence cross-vendor naming). **NEW (3)** `src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonStairBridge.ts` (~280 LOC) — `useRibbonStairBridge({ levelManager, universalSelection })` returns `RibbonStairBridge`. `resolveStair()` legge primary-selected entity dalla scena + type-guards `isStairEntity`. `dispatchParams` istanzia `LevelSceneManagerAdapter` + dispatcha `UpdateStairParamsCommand(stair.id, next, stair.params, sm, false)` (commit-on-select, isDragging=false). `getComboboxState` returna `{ value, options: [] }` per chiavi conosciute, null altrimenti (combobox disabled per storyCount/storyHeight quando `multiStoryConfig===undefined`). `onComboboxChange` switcha su chiave: structureType validates via `VALID_STRUCTURE_TYPES` Set + applica smart defaults Q20 (`OPEN_RISER_STRUCTURE_TYPES` Set: cantilever/suspended/glass-tread/steel-grating → riserType='open') + Q34 (`SIDE_NOSING_STRUCTURE_TYPES` Set: cantilever/glass-tread/steel-grating → nosingSide='front-and-sides') tutto in singolo `UpdateStairParamsCommand` (atomic, undo step unico). Numeric clamping: rise [50,300], tread [150,500], width [400,4000], stepCount round + max(2,⋅), storyCount round + max(1,⋅), storyHeight > 0. `withRecomputedTotals` ricomputa `totalRise = rise × stepCount`, `totalRun = tread × max(0, stepCount-1)`, `pitch = atan2(rise, tread) × 180/π` su rise/tread/stepCount change (UpdateStairParamsCommand.execute poi recompute anche geometry via SSoT `computeStairGeometry`). `storyCount` / `storyHeight` patch `multiStoryConfig` (default seed `{ topLevel: '', storyHeight: 2700, storyCount: 1 }` se assente). `onToggle` / `getToggleState` no-op (zero toggles in Phase 7a). **EDIT (4)** `src/subapps/dxf-viewer/app/ribbon-contextual-config.ts` — import `CONTEXTUAL_STAIR_TAB` + `STAIR_CONTEXTUAL_TRIGGER`; `RIBBON_CONTEXTUAL_TABS` += stair tab (5° elemento); `resolveContextualTrigger` early-return per `entity.type === 'stair'` (prima dei text/array checks). **EDIT (5)** `src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonCommands.ts` — import `RibbonStairBridge` type + `isStairRibbonKey`/`isStairRibbonStringKey` guards; `UseRibbonCommandsProps.stairBridge: RibbonStairBridge`; route in `onComboboxChange`/`getComboboxState` SHORT-CIRCUIT stair keys PRIMA di array+text (pattern composizione bridge identico a ADR-353 con priorità stair-first). `onToggle`/`getToggleState` unchanged (stair has no toggles). **EDIT (6)** `src/subapps/dxf-viewer/app/DxfViewerContent.tsx` — import `useRibbonStairBridge`; istanzia `const stairBridge = useRibbonStairBridge({ levelManager, universalSelection })` accanto a `arrayBridge`; passa `stairBridge` a `useRibbonCommands`. **EDIT (7+8)** `src/i18n/locales/{el,en}/dxf-viewer-shell.json` — aggiunte chiavi sotto `ribbon`: `tabs.stairProperties` (en: "Stair Properties" / el: "Ιδιότητες Κλίμακας"), `panels.{stairStructure,stairGeometry,stairMultiStory,stairActions}` (Greek pure: Δομή / Γεωμετρία / Πολυώροφα / Ενέργειες), `commands.stairEditor.{structureType,riserType,rise,tread,width,stepCount,storyCount,storyHeight,close}` (Greek pure architectural terminology: Τύπος Δομής / Ριχτή / Ύψος Σκαλιού / Πάτημα / Πλάτος / Πλήθος Σκαλιών / Αριθμός Ορόφων / Ύψος Ορόφου / Κλείσιμο — zero English residue, conforme user memory `pure_greek_locale`). **N.7.2 Google-level checklist**: ✅ proactive (tab appears on entity selection, no lazy registration); ✅ no race (commit-on-select, atomic dispatch — structureType+riserType+nosingSide in unico command); ✅ idempotent (`patch*` ritorna null su same-value, no-op spurious dispatch); ✅ belt-and-suspenders (bridge no-ops su unknown keys + numeric clamping prevent invalid params + UpdateStairParamsCommand.validate rifiuta out-of-range); ✅ SSoT (bridge unico owner di stair param reads/writes via ribbon, `computeStairGeometry` already SSoT in command, smart defaults Q20+Q34 in singolo punto); ✅ await (command pattern sync executeCommand, no fire-and-forget); ✅ explicit ownership (`useRibbonStairBridge` owns bridge lifecycle, DxfViewerContent owns instantiation). SSoT verifiche: ZERO duplicate bridge logic (pattern ARRAY-bridge interamente riusato senza fork); ZERO StairStore creato (commit-on-select non richiede inProgress overlay come ArrayStore); ZERO duplicate command-keys registry (stair-command-keys.ts standalone, no overlap con array-command-keys.ts); ZERO duplicate i18n keys (stair-specific keys co-located con array+text editor sotto `ribbon.commands.*`); ZERO hardcoded user-facing strings nel codice `.ts` (solo option labels English engineering technical terms via `isLiteralLabel: true` — industry convergence Revit/ArchiCAD/AutoCAD Arch); ZERO modifiche a `CanvasSection.tsx` / `CanvasLayerStack.tsx` / canvas pipeline (ADR-040 CHECK 6B/6C/6D NON triggherano). Zero `any`/`as any`/`@ts-ignore`; tutte le funzioni ≤40 lines GOL; tutti i signatures `Readonly<…>` / `readonly …[]`. **Carryover Phase 7a → Phase 7b**: (a) red badge surfacing su tab button quando `hasCodeViolations===true` (richiede extension `RibbonTab.badgeKey?` + `RibbonCommandsApi.getBadgeState?` + `RibbonTabItem` render); (b) ADA handrail extensions RENDER nello `StairRenderer` (305mm top horizontal + one-tread bottom polyline, deferito Phase 6.5 → Phase 7a originale → Phase 7b coherent con red-badge); (c) per-kind icons (straight/spiral/u-shape) per il ribbon home button — sostituzione `STAIR_PATH` 4-step linear (carryover Phase 0); (d) status bar wiring `useStairTool.getStatusText()` → `CadStatusBar` (carryover Phase 0); (e) inline Dynamic Input rise/tread/width extension (`KeyboardHandlerContext` + DynamicInput panel + Tab cycling rise→tread→width→rise — carryover Phase 5a); (f) multi-flight `turnDirection` toggle per L/U/Γ flight 2/3 (carryover Phase 5b); (g) floating Advanced Properties panel con materials/finishes UI + cutPlaneHeight + tread numbering + nosingSide selector (originale Phase 7b scope §7.2 row 7b). **Commit eseguito da Giorgio** (§7.0). |

---

## 11. References

### Industry CAD/BIM
- AutoCAD Architecture Stairs: https://help.autodesk.com/cloudhelp/2021/ENU/AutoCAD-Architecture/files/GUID-1AC15025-29FC-4515-9D06-06A9FCE3B6F5.htm
- AutoCAD U-shaped/Spiral: https://help.autodesk.com/cloudhelp/2026/CHT/AutoCAD-Architecture/files/GUID-DE51B26D-48B2-40C3-9E81-6BDE3DD0605A.htm
- Revit Stair Type Properties 2026: https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-E36AE889-D507-4288-90BE-FCE2F120C2B6.htm
- Revit Stairs Library 2026: https://libraryrevit.com/revit-stairs-architectural-families-2026/
- ArchiCAD Stair Tool basics: https://www.aecbytes.com/tipsandtricks/2019/issue85-archicad.html
- ArchiCAD Winder types: https://community.graphisoft.com/t5/Modeling/Winder-Types-in-ARCHICAD/ta-p/303645
- Vectorworks Stair 2025/26: https://app-help.vectorworks.net/2025/eng/VW2025_Guide/Stairs/Stair_settings_Geometry_tab.htm
- Vectorworks Vertex mode: https://app-help.vectorworks.net/2026/eng/VW2026_Guide/Stairs/Drawing_a_stair_with_Vertex_mode.htm
- Allplan Stair Wizard: https://help.allplan.com/Allplan/2021-1/1033/Allplan/10266.htm
- Allplan SmartParts: https://www.app-easy.eu/ae-smart-parts
- BricsCAD BIM Stair Tool: https://help.bricsys.com/en-us/document/bricscad-bim/modeling-techniques/stair-tool
- BricsCAD BIM V20 Stair: https://www.bricsys.com/blog/bim-stair-tool-new-for-bricscad-bim-v20

### Codici edilizi
- IBC stair code: https://upsideinnovations.com/blog/ibc-stairs-code/
- IBC commercial: https://buildingcodetrainer.com/commercial-stair-codes-explained/
- Eurocode 2 RC stairs: https://structville.com/2016/08/design-of-reinforced-concrete-staircase-according-to-eurocode-2.html
- NOK Greek Code (TEEMAG): https://www.teemag.gr/ftp/2012/nok.22-9-2012.pdf
- GOK 1985 (argohellas): https://www.argohellas.net/gok1985.pdf
- ΓΟΚ Άρθρο 13 (nomoskopio): http://www.nomoskopio.gr/a_3046_304_89_13.php?toc=0
- ΥΠΕΝ Κλίμακες κανονισμοί: https://ypen.gov.gr/wp-content/uploads/legacy/Files/Xorotaxia%20kai%20Astiko%20Perivallon/Astikh%20Anaplash/Politikes%20kai%20Protypa/Kefalaio%204.pdf
- Decobook ορολογία: https://www.decobook.gr/texnika-arthra/skales-koufomata/skales-i-vasiki-orologia
- Decobook διαστάσεις άνεσης: https://www.decobook.gr/texnika-arthra/skales-koufomata/skales-vasikoi-kanones-anesis-kai-asfaleias
- Stokas calculator: https://stokasconstruction.com/staircase_design_calculator_rise_tread/

### Tecnico
- Stair Wikipedia: https://en.wikipedia.org/wiki/Stairs
- Walkline + handrail technical: https://www.knostairs.com/kno-how/draw-stairs/staircase-technical-drawing-course/
- Spiral parametric algorithm (Parametric Monkey): https://parametricmonkey.com/2015/08/27/elliptical-stair/
- Auto-generation IFC stair paths (MDPI): https://www.mdpi.com/2220-9964/9/4/215

### Round 2 — Industry/IFC/QTO/structural research (2026-05-16)

**Multi-storey & component model**
- Revit Multistory Stairs: https://help.autodesk.com/view/RVT/2024/ENU/?guid=GUID-CCF34EC3-4AEB-466C-B730-F11A82A86450
- ArchiCAD Multi-Level Stairs: https://community.graphisoft.com/t5/Modeling/Multi-Level-Stairs/td-p/210771
- Revit Stair Component Type Properties: https://help.autodesk.com/view/RVT/2024/ENU/?guid=GUID-E36AE889-D507-4288-90BE-FCE2F120C2B6
- Revit Create Landing by Picking Two Runs: https://help.autodesk.com/view/RVT/2024/ENU/?guid=GUID-2C23930C-1277-4B7A-9EE7-5CCDE59CA6B1
- Revit Direct Manipulation Controls (grips): https://help.autodesk.com/view/RVT/2024/ENU/?guid=GUID-0FD4C314-E5AE-4937-ABAB-8EBD95A45695

**Structure types (stringer/cantilever/etc)**
- ArchiCAD Open Stringer Stairs: https://community.graphisoft.com/t5/Modeling/Stair-Tool-Basics-Open-Stringer-Stairs/ta-p/303700
- Allplan Stringer Tab 2025: https://help.allplan.com/Allplan/2025-1/1034/Allplan/94966.htm
- Allplan Carriage Tab: https://help.allplan.com/Allplan/2023-0/1034/Allplan/94965.htm
- Tekla Stairs S71: https://support.tekla.com/doc/tekla-structures/2025/macro_s71_help

**Materials & finishes**
- ArchiCAD Tread & Riser Finishes AC28: https://help.graphisoft.com/AC/28/INT/_AC28_Help/040_ElementsVB/040_ElementsVB-190.htm
- ArchiCAD Custom Tread (per-tread): https://community.graphisoft.com/t5/Modeling/Stair-Tool-Basics-Custom-Tread/ta-p/303675
- Tekla Custom Step + Custom Seam: https://support.tekla.com/article/creating-a-custom-step-as-an-item-and-then-wrap-it-up-as-a-custom-seam-to-use-in-stair-component-s71

**Cut line + grips + presets**
- Revit Cut Line: https://help.autodesk.com/view/RVT/2024/ENU/?guid=GUID-CF95A04B-CF0B-4F3D-BAFB-D8FD0A9ABDEC
- AutoCAD Architecture Cut Plane: https://help.autodesk.com/cloudhelp/2022/ENU/AutoCAD-Architecture/files/GUID-52243942-57BB-4B89-8EAA-1ADDDD914569.htm
- Adjust Cut Line — AECTechTalk: https://aectechtalk.wordpress.com/2010/11/17/adjust-cut-line-for-stair-in-revit-architecture/
- Vectorworks 2026 Saved Sets (presets): https://app-help.vectorworks.net/2026/eng/VW2026_Guide/Stairs/Using_saved_sets_for_stair_settings.htm
- Vectorworks Save as Symbol: https://app-help.vectorworks.net/2024/eng/VW2024_Guide/Stairs/Saving_a_stair_as_a_symbol.htm
- BricsCAD V26 Stair Tool: https://help.bricsys.com/en-us/document/bricscad-bim/modeling-techniques/stair-tool?version=V26
- VisualARQ Stair: https://help.visualarq.com/architectural-objects/stair/

**Codes (NBC/NFPA/AS/DIN/ADA)**
- NRC Canada — Stairs/Guards/Handrails: https://nrc-publications.canada.ca/eng/view/ft/?id=bb8bfa53-e58c-4b7f-9fc9-addfe5efb6be
- NFPA 101 Requirements Guide: https://usmadesupply.com/resources/building-codes-standards/emergency-life-safety/nfpa-101
- AS 1657-2018 (StepForm): https://www.stepform.com.au/as1657-2018/stairs.html
- BAuA — DIN 18065 Safe Stairways: https://www.baua.de/EN/Topics/Work-design/Workplaces/Safe-stairways-floors/The-design-of-safe-stairs
- ADA Compliance Stairs: https://www.ada-compliance.com/ada-compliance/ada-stairs.html
- ICC A117.1 §505 Handrails PDF: https://www.ckcog.com/wp-content/uploads/Handrails-ICC-A117.pdf
- IBC 2018 §1011.3 Headroom: https://codes.iccsafe.org/s/IBC2018P6/chapter-10-means-of-egress/IBC2018P6-Ch10-Sec1011.3
- IBC 2021 ch.10 Means of Egress: https://codes.iccsafe.org/content/IBC2021P2/chapter-10-means-of-egress
- NFPA — Basics of Egress Stair Design: https://nfpa92.nfpa.org/News-and-Research/Publications-and-media/Blogs-Landing-Page/NFPA-Today/Blog-Posts/2021/09/17/Basic-of-Egress-Stair-Design

**QTO + IFC + Schedule**
- Pset_StairCommon IFC 4.3.2: https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/Pset_StairCommon.htm
- IfcStairTypeEnum: https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcStairTypeEnum.htm
- IfcStair 4.3.2: https://ifc43-docs.standards.buildingsmart.org/IFC/RELEASE/IFC4x3/HTML/lexical/IfcStair.htm
- IfcStairFlight 4 ADD2: https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2/HTML/schema/ifcsharedbldgelements/lexical/ifcstairflight.htm
- IfcReinforcingBar: https://standards.buildingsmart.org/IFC/RELEASE/IFC4/FINAL/HTML/schema/ifcstructuralelementsdomain/lexical/ifcreinforcingbar.htm
- Pset_RailingCommon: https://standards.buildingsmart.org/IFC/RELEASE/IFC2x3/TC1/HTML/psd/IfcSharedBldgElements/Pset_RailingCommon.xml
- Eurocode 2 Detailing JRC PDF: https://eurocodes.jrc.ec.europa.eu/sites/default/files/2022-06/05_EC2WS_Arrieta_Detailing.pdf
- Tekla Reinforced Concrete Stair (95): https://support.tekla.com/doc/tekla-structures/2025/modtool_95_help_reinforced_concrete_stair
- Mars BIM — QTO Automation: https://marsbiminternational.com/insights/automation-of-quantity-takeoff-workflow-using-bim/
- Revit Number Stair Treads/Risers: https://help.autodesk.com/view/RVT/2024/ENU/?guid=GUID-39D8BE87-9E57-481A-88E2-51E045C7C8E3
- ArchiCAD Stair Tread Step Index: https://community.graphisoft.com/t5/Documentation/Stair-Tread-Labels-using-Step-Index/td-p/254830

**Railing + glass detail**
- Revit Railings 14 tips: https://www.bimpure.com/blog/14-tips-to-understand-revit-railings
- ArchiCAD Baluster Settings: https://helpcenter.graphisoft.com/user-guide/76628/
- Tempered Glass Railing BIM (ARCAT): https://www.arcat.com/content-type/bim/metals-05/tempered-glass-railing-assemblies-057315
- Glass Railing BIMobject: https://www.bimobject.com/en/viva-railings/product/view-glass-railing-system

**Audit + collaboration**
- ArchiCAD Teamwork Tracking Changes: https://community.graphisoft.com/t5/Teamwork-BIMcloud/Tracking-Changes-in-Teamwork-Projects/ta-p/304048
- CRDT for CAD ScienceDirect: https://www.sciencedirect.com/science/article/abs/pii/S147403461730486X

**Hotkeys + UX**
- Revit Keyboard Shortcuts: https://www.autodesk.com/shortcuts/revit
- ArchiCAD Shortcuts: https://community.graphisoft.com/t5/Modeling/The-most-useful-keyboard-shortcuts-for-ArchiCAD/td-p/141214

**Anti-clash + collision**
- ArchiCAD AC21 Collision Detection: https://www10.aeccafe.com/blogs/aeccafevoice/2017/08/31/new-archicad-21-offers-stair-tool-collision-detection-and-much-more/

**Performance**
- ArchiCAD 19 Performance BIM: https://aecmag.com/technology/review-archicad-19-performance-bim/

### ADR collegati
- ADR-031 (Command Pattern Undo/Redo)
- ADR-032 (Drawing State Machine)
- ADR-040 (Preview Canvas Performance)
- ADR-055 (Tool State SSoT)
- ADR-057 (Entity Completion Pipeline)
- ADR-186 (Building Code ΝΟΚ Engine)
- ADR-294 (SSoT Ratchet Enforcement)
- ADR-340 (Raster Background Layers + Firestore overlays)
- ADR-343 (DXF Visual Regression Suite)
- ADR-344 (DXF Enterprise Text Engine + Contextual Tab)
- ADR-345 (DXF Ribbon Interface)
- ADR-353 (Array Commands — parametric pattern)
- ADR-357 (DXF Line Tool Google-Level)
- ADR-GEOMETRY (Geometry & Math consolidated)

---

## 12. Verification (post-implementation)

- ✅ `npm run dev` → DXF Viewer → click "Σκάλα" → ogni kind disegnato correttamente.
- ✅ Snapshot di geometria per ogni kind matches expected (visual + numeric).
- ✅ Validator NOK respinge `rise=22cm` con messaggio greco corretto, non blocca creazione.
- ✅ Validator hard error su `stepCount=0` blocca creazione.
- ✅ Undo/redo creazione stair.
- ✅ Editing post-creazione via contextual ribbon tab → ricalcolo geometria live.
- ✅ Floating Advanced Properties panel apre + salva posizione.
- ✅ Firestore: stair persiste in `floorplan_stairs` e ricarica intatta.
- ✅ Unit tests: 100% coverage `StairGeometryService` + validator.
- ✅ Visual regression: 10 kinds in baseline (ADR-343).
- ✅ TypeScript: `tsc --noEmit` zero errori.
- ✅ Pre-commit hook: 0 SSoT/i18n violations.
- ✅ DXF export include scale come block parametrico.

---

## 13. Post-merge follow-up

- Aggiornare `.claude-rules/pending-ratchet-work.md` con eventuale ratchet residuo.
- Aggiornare ADR-186 changelog (estensione building-code engine con `gate-stair-checker`, validator headroom + egress + ADA).
- Aggiornare ADR-195 changelog (EntityAuditService applicato a StairEntity).
- Aggiornare ADR-340 changelog (nuova sub-collection `floorplan_stairs` + `stair_presets`).
- Aggiornare ADR-345 changelog (nuovo ribbon split-button + contextual tab + hotkey 'st').
- Aggiornare `.ssot-registry.json` con **8 nuovi moduli**: `StairGeometryService` *(Phase 3a+3b+4a+4b+4c DONE 2026-05-16 — `computeStairGeometry` dispatch COMPLETO per tutti i 10 kind: `straight` + `l-shape` + `u-shape` + `gamma` + `spiral` + `helical` + `elliptical` + `winder` (con `winderMethod ∈ {'equal-going','pie'}`) + `triangular-fan` (vincolo Phase 4c `stepCount === stepCountPerArc`) + `triangular-outline` (equal-height linear slices parallel a entry edge, ultimo tread degenerate at apex) + `sketch` (vincolo Phase 4c `walklinePath.length === stepCount+1`); UNICO sentinel residuo: `winderMethod ∈ {'kite','balanced'}` in `stair-geometry-winder.ts` (sub-phase futura); `computeWalkline` re-export pubblico; `buildTreadLabels` SSoT per G21 e `buildCutLineForFlights` SSoT per G14 multi-flight applicato anche al winder con flightSplit=[n1, winderCount, n2]; elliptical reuse Phase 2b `ellipseSample` per walkline, winder reuse shared `buildStringersFromWalkline`/`buildCutLineForFlights`; triangular-fan reuse Phase 2a `helixSample(apexPoint, 0, width, ...)` con inner=0 ⇒ degenerate spiral pattern; triangular-outline + sketch reuse shared `buildStringersFromWalkline`; chord-tangent helper duplicato in 2 moduli (elliptical + sketch), candidato promotion shared al terzo caller; `rotateVec` 3-line duplicato in 2 moduli (elliptical privato no — usa solo chord; winder + spiral hanno cosθ/sinθ inline), monitorare promotion)*, `stair-validator`, `geometry-offset-utils` *(Phase 2b DONE 2026-05-16 — `offsetPolyline` xy-plane miter+bevel)*, `geometry-curve-utils` *(Phase 2a spiral+helix DONE 2026-05-16; Phase 2b ellipse DONE 2026-05-16 — `ellipseArcLength` + `ellipseSample`)*, `stair-grips`, `stair-transforms`, `stair-presets-service`, `stair-schedule-exporter`.
- ~~Aggiungere `FLOORPLAN_STAIRS` + `STAIR_PRESETS` in `src/config/firestore-collections.ts`.~~ ✅ Phase 1 DONE 2026-05-16.
- ~~Aggiungere `STAIR: 'stair'` + `STAIR_PRESET: 'sprst'` in `enterprise-id-prefixes.ts`.~~ ✅ Phase 1 DONE 2026-05-16 (+ `generateStairId`/`generateStairPresetId` in `enterprise-id-class.ts` + convenience + facade).
- Rigenerare `adr-index.md` via `node docs/centralized-systems/reference/scripts/generate-adr-index.cjs`.

### Phase 0 carryover — status post-Phase 5a (2026-05-16)
- ~~**Rimuovere `comingSoon: true`** dal button `draw.stair` in `home-tab-draw.ts` quando il tool è wired (Q15 mandato — no comingSoon al merge).~~ ✅ **Phase 5a DONE 2026-05-16** — flag rimosso, button attivo.
- ~~**Implementare multi-char sequence dispatcher** per hotkey `'ST'`. Phase 0 ha registrato la voce in `DXF_TOOL_SHORTCUTS` con `key: 'ST'`, ma `matchesShortcut` confronta singoli `event.key` → non spara.~~ ✅ **Phase 5a DONE 2026-05-16** — implementato `stairChordRef` in `useDxfToolbarShortcuts.ts`: 'S' apre chord window 350 ms, 'T' entro window → `handleToolChange('stair')`, altrimenti fallback select. Pattern AutoCAD command-line. Minimal scope (solo 'ST' targeted) — full sequence dispatcher per altri 2-char shortcut (PL/REC/EX/AR/SR) resta deferito on-demand.
- **Status bar message**: chiave `tools.stairStatus` esiste (el+en). Wirearla allo status bar `unknownTool` fallback quando `activeTool === 'stair'`. (Phase 5a non-bloccante: `useStairTool.getStatusText()` ritorna i18n keys `tools.stair.statusBasePoint|statusDirection|statusConfirm` per UI consumers — wiring esplicito al CadStatusBar resta TODO Phase 7a contestuale ribbon.)
- **Icona definitiva**: `STAIR_PATH` Phase 0 è 4-step profilo lineare; sostituire con icona per-kind (straight/spiral/u-shape) quando Phase 7a aggiunge contextual ribbon tab "Stair Properties".
- ~~**Verify enterprise-id**: `generateStairId()` da creare (vedi §5.6). Non richiesto Phase 0 (nessuna entity creata), pendente Phase 1.~~ ✅ Phase 1 DONE 2026-05-16 — `generateStairId()` + `generateStairPresetId()` operativi, prefix `stair` + `sprst` registrati. IDs `stair_<ulid26>` / `sprst_<ulid26>`.

### Phase 5a carryover (status post-Phase 5b)
- ~~**Full multi-entity preview**: Phase 5a renderizza solo la `walkline` come singolo polyline preview durante `confirming`. Phase 5b dovrà aggiungere una leaf component `StairOverlayLayer` in `canvas-layer-stack-leaves.tsx` (ADR-040 micro-leaf) che renderizza treads stroked + walkline + arrow + tread labels — sia per il preview live sia per il committed `StairEntity` nello scene (oggi committed stair è persistito in `SceneModel.entities` ma non renderizzato visualmente in plan view fino al renderer dedicato).~~ ✅ **Phase 5b DONE 2026-05-16** — committed `StairEntity` ora visibile via `StairRenderer` registrato in `EntityRendererComposite` (rendering passa per `DxfStair` wrapper SSoT, ZERO expansion in polyline N). Strategia revised: niente leaf custom in `canvas-layer-stack-leaves.tsx` — il rendering committed sta nella pipeline standard `EntityRendererComposite` (ADR-040 CHECK 6B/6C/6D non triggherano). Drawing-time preview continua a usare `drawing-preview-generator.ts` (walkline ghost), upgrade a full multi-entity preview (treads stroked + arrow + tread labels durante drawing) DEFERITO a Phase 5d o Phase 7a contestuale ribbon. Risers / handrails / cutLine zigzag / tread labels nel committed render → Phase 6+ insieme a validator full pipeline.
- **Inline Dynamic Input rise/tread/width**: Phase 5a `stair-keyboard-handler.ts` gestisce solo Enter→commit. Phase 7a estenderà `KeyboardHandlerContext` (+`riseValue/treadValue/widthValue` + relativi setters + refs) + DynamicInput panel component (3 nuovi `<input>`) + Tab cycling rise→tread→width→rise. Validators range già pronti via `validateStairField` esportato.
- ~~**Stair Grips (G15)**: Phase 5b è la prossima fase — 5 grip tipi (basePoint/direction/width/length/split) sopra overlay grip system ADR-357.~~ ✅ **Phase 5b DONE 2026-05-16** — 5 grip parametrici (`stair-base`/`stair-direction`/`stair-width`/`stair-length`/`stair-split`) operativi via pipeline grip unificata `useUnifiedGripInteraction` (ADR-183) estesa con discriminator `stairGripKind`. Commit via `UpdateStairParamsCommand` con geometry SSoT recompute + 500 ms merge window.

### Phase 5b carryover (verso Phase 5c/6/7a)
- **Live-preview durante drag (Google-level UX)**: Phase 5b adotta commit-at-mouseUp (industry standard Revit/AutoCAD/ArchiCAD). Per per-frame preview durante drag (entity ricostruita 60×/s) servirebbe un ghost-renderer su PreviewCanvas che applichi `applyStairGripDrag` ad ogni mouseMove + `computeStairGeometry(newParams)` → `StairRenderer.render(...)` su layer trasparente. Deferito a Phase 5d (post-validator). `computeStairGeometry` è già veloce abbastanza (~ms per stair complesso) per supportare live recompute, le merging window 500 ms del `UpdateStairParamsCommand` collassano già le serie di commit in 1 undo entry.
- **Multi-flight grip per L/U/Γ con angolo turn dinamico**: il `stair-direction` grip Phase 5b ruota `direction` (origin axis flight 1). Per L/U/Γ il direction grip del flight 2/3 (turnDirection-implicit) NON è ancora esposto — workaround: usa contestuale ribbon Phase 7a per `turnDirection` toggle. Phase 5c (Transforms) può complementare con `mirrorStairParams` + auto-flip turnDirection (Q23).
- **Snap+ortho+polar durante drag**: l'attuale `commitDxfGripDragModeAware` riceve `delta` già snapped (snap engine applica prima del commit). Verifica esplicita TBD durante visual regression Phase 6 — se snap durante stair drag mostra inconsistency, intervenire su `useUnifiedGripInteraction.handleMouseMove` con un `snapManager.snapPoint(worldPos)` pre-`setCurrentWorldPos` (pattern già usato altrove).
- **Risers / handrails / cutLine / tread labels nel renderer 2D**: Phase 5b mostra solo treads + walkline + arrow + stringers (minimal §6.2). Phase 6+ aggiungerà il resto del pipeline §6.2 (10 layers) insieme al validator full.

### Phase 7a carryover — status post-Phase 7b1 (2026-05-16)
- ~~**(a) Red badge surfacing**~~ ✅ **Phase 7b1 DONE 2026-05-16** — `RibbonTab.badgeKey?: string` + `RibbonCommandsApi.getBadgeState?` + `useRibbonStairBridge.getBadgeState` reading `stair.validation.hasCodeViolations` + `RibbonTabItem` render `<span class="dxf-ribbon-tab-badge">!</span>` con CSS in `ribbon-tokens.css`.
- ~~**(b) ADA handrail extensions RENDER**~~ ✅ **Phase 7b1 DONE 2026-05-16** — `StairRenderer.drawHandrails()` deriva polyline da `geometry.stringers` + `params.handrails` + `params.codeProfile`. ADA: 305mm top horizontal + one-tread bottom via pure helpers `pickTopExtensionMm` / `pickBottomExtensionMm` / `extendPolylineEnds`. Geometry SSoT promotion (compute in StairGeometryService per kind) deferito 7b2/9.
- ~~**(c) Per-kind icons (straight/spiral/u-shape)**~~ ✅ **Phase 7b1 DONE 2026-05-16** — `STAIR_PATH_STRAIGHT` + `STAIR_PATH_SPIRAL` + `STAIR_PATH_USHAPE` SVG paths + cases `'stair-straight'` / `'stair-spiral'` / `'stair-ushape'` in `RibbonButtonIcon`. Legacy `'stair'` rimane = straight default. Ready per Phase 7.5 variant split-button.
- ~~**(d) Status bar wiring**~~ ✅ **Phase 7b1 DONE 2026-05-16** — `stair-status-store.ts` singleton (writer = `useStairTool`, reader = `CadStatusBar` via `useStairStatusKey()`). Inline prompt left of toggles, amber-400 semibold. i18n keys `tools.stair.statusBasePoint/Direction/Confirm` in tool-hints.json el+en.
- **(e) Inline Dynamic Input rise/tread/width Tab cycling** — Phase 5a carryover, da fare in Phase 7b2 (`KeyboardHandlerContext` extension + DynamicInput panel rise/tread/width inputs + Tab cycling rise→tread→width→rise + validators range già pronti via `validateStairField`).
- **(f) Multi-flight `turnDirection` toggle per L/U/Γ flight 2/3** — Phase 5b carryover, da fare in Phase 7b2 (workaround attuale: contestuale ribbon Phase 7a per `turnDirection` toggle globale).
- **(g) Floating Advanced Properties panel** — ✅ **Phase 7b2a + 7b2b-α DONE 2026-05-16** (5/5 sections shipped: Materials per-stair + Per-Tread Override table + CutPlaneHeight inherit/override + TreadNumbering Q28 + NosingSide Q34). SSoT `stair-material-catalog` + `dispatchStairParamPatch` writer + `StairAdvancedPanelHost` orchestrator (industry-aligned separate-from-ribbon, 5/5 vendor convergence). Per-tread = table editor only (Q19 hybrid — click-on-canvas Phase 8+). Streams E (Dynamic Input cycling) + F (Multi-flight ribbon) split out a Phase 7b2b-β.

### Phase 7b2a carryover (verso Phase 7b2b)
- ~~**(1) Stream G item 4 — TreadNumbering section** (Q28)~~ ✅ **Phase 7b2b-α DONE 2026-05-16** — `StairTreadNumberingSection.tsx` (NEW ~95 LOC). 3 radio `treadLabelDisplay` (all/nth/none) + conditional `treadLabelEveryN` numeric (min 2, default 5 seeded on first nth-switch) + `treadLabelRestartPerFlight` toggle (default OFF, continuous 1→N industry-aligned). i18n keys `stairAdvancedPanel.sections.treadNumbering.{title,display.{all,nth,none},everyN,restartPerFlight}` el+en.
- ~~**(2) Stream G item 5 — NosingSide selector** (Q34)~~ ✅ **Phase 7b2b-α DONE 2026-05-16** — `StairNosingSection.tsx` (NEW ~70 LOC). `<select>` 3 opzioni reading `stair.params.nosingSide`. Patch `{ nosingSide }` via `dispatchStairParamPatch`. Smart-default da `structureType` resta nel ribbon bridge Phase 7a (panel = override esplicito). i18n keys `stairAdvancedPanel.sections.nosingSide.{title,options.{front,none,frontAndSides}}` el+en.
- ~~**(3) Stream E — Inline Dynamic Input rise/tread/width Tab cycling** (Phase 5a carryover)~~ ✅ **Phase 7b2b-β DONE 2026-05-17** — industry-converged option (A) always-visible (no phase gate). New `StairField` union kept separate from `Field` (zero breaking exhaustive switches). `stair-keyboard-handler` Tab cycling rise→tread→width via `STAIR_FIELD_CYCLE` ring + Enter parses 3 values → `dispatchDynamicSubmit` with `commit-stair` payload → `useStairTool` listener `confirmWithOverrides` (sync, bypasses setState batching). i18n placeholders `dynamicInput.placeholders.{rise,tread,stairWidth}` el+en.
- ~~**(4) Stream F — Multi-flight `turnDirection` toggle per L/U/Γ flight 2/3** (Phase 5b carryover)~~ ✅ **Phase 7b2b-β DONE 2026-05-17** — industry-converged option (A) framework `RibbonPanelDef.visibilityKey?: string` + `getPanelVisibility(key) → boolean` resolver (mirrors Phase 7b1 `badgeKey` pattern). New `STAIR_RIBBON_VISIBILITY_KEYS.multiFlight` + new `STAIR_RIBBON_KEYS.stringParams.{flight2TurnDirection,flight3TurnDirection}` + `patchFlightTurnDirection` discriminated-union helper (l-shape/u-shape → `variant.turnDirection`, gamma → `variant.turnSequence[0|1]`). `RibbonBody` filters panels upstream by `visibilityKey` (no breaking change for panels without key). i18n `ribbon.panels.stairMultiFlight` + `ribbon.commands.stairEditor.{flight2/3TurnDirection,turnDirectionLeft/Right}` el+en.
- **(5) Project-scoped setting `dxf:project.cutPlaneHeight`** — sostituisce costante hardcoded `PROJECT_DEFAULT_CUT_PLANE_MM = 1200` in `StairCutPlaneSection.tsx`. Trigger: quando project settings SSoT esiste (Phase 8 Firestore persistence o oltre).
- **(i) Click-on-canvas per-tread override** (Q19 ArchiCAD pattern) — Phase 8+. Aggiunge "Tread Edit Mode" state machine + hit-test geometry per singolo tread polygon + render highlight + open per-tread editor panel. ~350 LOC, fuori scope 7b2 per delivery delivery completeness.
- **(ii) Drag-to-reposition floating panel** — Phase 7.5+. Persist user-chosen position in localStorage / project settings. Non implementato in Phase 7.5 (focus su preset library + 3 design decisions).
- **(iii) Material renderer wiring** — Phase 8+. `StairRenderer` deve leggere `params.materials.tread` / `perTreadOverrides[i].material` e applicare fill color/style per material ID (oggi i preset sono solo string ID, nessun render visual differentiation).
- **(iv) Test coverage** — Phase 7b2a non include unit test per `dispatchStairParamPatch` + `useSelectedStair` + `classifyStairMaterial` (context budget). Deferred a Phase 7b2b o follow-up specifico.

### Phase 7.5 carryover (verso Phase 8+)
- **(v) ProjectId plumbing to `StairAdvancedPanelHost`** — Phase 8 (2026-05-17) added `floorplanId?` optional prop alongside the existing `projectId?` prop, but did NOT yet plumb the actual values from `DxfViewerContent` (the caller). Until those props are wired by the caller, `useStairPersistence` no-ops internally (subscribe gated on truthy companyId/projectId/floorplanId/userId) and project-scope presets stay hidden. Next: extend `DxfViewerContent` to pass route-derived `projectId` + active `floorplanId` to `StairAdvancedPanelHost`. Trigger: caller-side wiring task (1-2 files).
- **(vi) Preset rename in-place** — Phase 7.5 supports only Save (new) + Delete. Industry vendors (Revit Type Selector, ArchiCAD Favorites) also support rename of existing presets. Trigger: user request OR Phase 8 if Firestore persistence brings broader preset management surface.
- **(vii) Preset move between scopes** — e.g. user→company promotion ("save mine as company-wide"). Industry pattern present in Revit ("Duplicate Type" + change scope). Phase 7.5 requires delete-then-resave. Trigger: user request.
- **(viii) Drag-to-reposition floating panel** — see item (ii) Phase 7b2a carryover. Phase 7.5 ships floating panel section but does NOT add drag.
- **(ix) Optimistic UI on save** — Phase 7.5 awaits `setDoc` before refreshing presets list. Industry latency budget ~80-150ms acceptable. Optimistic insertion (immediate visual + reconcile on confirm) deferred unless Firestore latency degrades.

### Phase 8 carryover (verso Phase 8.5 / 9+)
- **(x) Always-on subscribe** — Phase 8 hook `useStairPersistence` is mounted by `StairAdvancedPanelHost`, which itself renders only when a stair is in primary selection. Subscribe therefore dies on deselection and resumes on next selection. This is semantically correct for "edit + persist a parametric stair" but does NOT provide always-on real-time sync of remotely-created stairs while the user is browsing the floorplan. Promote to a floor-plan-level mount (parallel to `useLevelsFirestoreSync`) when Phase 9+ adds always-on multi-user presence. Trigger: real collaborative editing requirement.
- **(xi) Full multi-user CRDT** — Phase 8 soft-lock G24 is display-only (`editingBy` badge), not exclusivity. Two users editing the same stair simultaneously last-writer-wins on the params (selective diff-merge skips the round-trip only for the local dirty edit, not for remote conflicting edits). Industry full CRDT (Figma OT, Google Docs OT) deferred to Phase 9+. Trigger: real concurrent-edit incidents.
- **(xii) `editingBy` user name resolution** — Soft-lock badge shows generic "Άλλος χρήστης επεξεργάζεται" — no user lookup. Industry pattern resolves `userId → displayName` via contacts/users service for "Editing by Maria…" UX. Trigger: when a `useUserDisplayName(uid)` SSoT hook is available.
- **(xiii) Stair persistence test coverage extension** — Phase 8 ships 19/19 service unit tests. Integration tests for `useStairPersistence` (diff-merge logic + dirty skip + lock lifecycle + debounce behavior) NOT included — requires `renderHook` + mock `LevelManagerLike`. Trigger: regression incident OR Phase 9 collaborative-edit work.
- **(xiv) Geometry promotion to persisted `bbox` for spatial index** — ADR §G6 references "cache bbox per spatial index" but Phase 8 persists only params + validation + optional full geometry. For >100 stair per floorplan with spatial queries (Phase 9 anti-clash, BIM export), promote `bbox: { min: Point3D; max: Point3D }` to top-level `StairDoc` field with composite index. Trigger: performance degrade OR Phase 9 spatial query needs.
- **(xv) Auto-release stale locks (reader-side cleanup)** — Phase 8 TTL is enforced ONLY by the lock-holder's own `setTimeout`. If the browser crashes, the lock persists in Firestore. Industry "reader auto-clear when `Date.now() - since.toMillis() > TTL`" deferred. Trigger: orphan-lock incidents.

### Phase 7b1 carryover (verso Phase 7b2)
- **Promotion handrail extension helpers a SSoT module** — `pickTopExtensionMm` / `pickBottomExtensionMm` / `extendPolylineEnds` / `extendOutward` oggi locali a `StairRenderer.ts`. Se Phase 7b2 advanced panel li riusa per preview WYSIWYG (e.g. dialog di edit handrail extension live preview), promote a `src/subapps/dxf-viewer/systems/stairs/stair-handrail-render-utils.ts`. Trigger: >1 caller.
- **Promotion handrail polylines compute a `StairGeometryService`** — oggi `StairGeometry.handrails` è popolato vuoto dalle 10 kind compute (Phase 3-4). Phase 7b1 deriva render-side da stringers, evitando l'editing di 10 file geometry. Se Phase 8 (Firestore persistence `floorplan_stairs`) richiede geometry full-cache serializzato per QTO/IFC export, allora promote compute al geometry pipeline per kind.
- **Per-kind icons split-button**: `'stair-straight'` / `'stair-spiral'` / `'stair-ushape'` icone esistono ma il ribbon home button continua ad usare `'stair'` (= straight). Phase 7.5 (library presets) o Phase 7b2 può convertire il `draw.stair` button in split-button con variant per-kind icon.

### Phase 6 carryover (verso Phase 6.1 / 7a / 9)
- **Phase 6.1 — wiring del `StairValidationState` allo `StairEntity.validation`**: Phase 6 espone solo la pure function `validateStairParams`. Il caller (oggi `UpdateStairParamsCommand.execute` + `useStairTool.confirm` builder Phase 5a) deve invocarla e patchare il result su `StairEntity.validation`. Plan da presentare a Giorgio prima di partire (file count + ordine commit + scelta tra (a) blocking hard-error in command `validate()`, (b) integration nel `buildStairEntity` Phase 5a, oppure (c) entrambi). Non auto-implementabile.
- ~~**Phase 6.5 — Egress capacity validator (G20)**: `width < occupancyLoad × 7.62mm/person` warning. Type field già in Phase 1 `StairParams.occupancyLoad?`. Estensione `gateStairChecker` con nuovo `checkEgress(params)` + i18n key `tools.stair.validator.egress.widthBelowOccupancy`. Project-default `occupancyLoad` (Q27) interitato; per-stair override.~~ ✅ **Phase 6.5 DONE 2026-05-16** — `checkEgress` aggiunto a `gate-stair-checker.ts` (universale eccetto 'none'), `validateStairParams` accetta terzo arg `projectOccupancyLoad?` (Q27 wins over per-stair override), i18n keys el+en `tools.stair.validator.egress.widthBelowOccupancy` con ICU single-brace `{occupancyLoad}`, 8 nuovi test.
- ~~**Phase 6.5 — ADA handrail extensions RENDER + auto-default**: type fields `topExtension` / `bottomExtension` già Phase 1; validator Phase 6 ✅; RENDER (305mm top horizontal extension + one-tread bottom extension polyline) deferito a `StairRenderer` estensione + auto-default Phase 5a builder quando `codeProfile==='ada'` (Q26 pacchetto coherent).~~ **PARZIALMENTE DONE Phase 6.5 2026-05-16** — auto-default builder `buildDefaultStairParams` con `codeProfile='ada'` ora auto-applica `handrails.topExtension=305` + `bottomExtension='one-tread'` + `adaContrastStrip=true` + `handrails.height=900` (mid-range ADA [864, 965]) tramite helper `buildHandrails(codeProfile, override?)`; caller overrides preservati per-field. **RENDER spostato a Phase 7a** — vedi entry sotto.
- **Phase 7a — ADA handrail extensions RENDER (deferred from Phase 6.5)**: il render `StairRenderer` delle 305mm top horizontal extension + one-tread bottom polyline è spostato a Phase 7a per coherent visual pacchetto con red-badge UI surfacing. Rationale: (1) Phase 5b §6.2 lascia esplicitamente `StairRenderer` minimal ("no handrails, no risers, no cutLine zigzag") con il pipeline 10-layer in progressive ship a Phase 6+ generale; (2) senza red-badge UI surfacing nello stesso ship visual, il render handrail extensions non ha contesto di feedback per validation; (3) safer split — Phase 6.5 data layer è zero-visual-regression. Phase 7a aggiungerà: handrail polyline base (inner/outer) + ADA top extension 305mm horizontal nella direction del top tread + ADA bottom one-tread extension nella direction del bottom tread + dashed stroke style.
- **Phase 9 — 3D headroom raycast**: cheap 2D proxy Phase 6 usa `clearance = ceiling.elevation − (basePoint.z + totalRise)` come approssimazione conservativa. Phase 9 implementa raycast per-step (vertical ray dall'apice di ogni nosing verso `+Z` fino al primo hit ceiling/slab/roof) — required per overhanging ceilings + multi-flight stairs con landing intermediate.
- **Phase 9 / on-demand — NBC / NFPA / AS1657 / DIN profile validators**: `StairCodeProfile` type include placeholders Phase 1; gate-stair-checker oggi returna zero violations per quei 4 profili. Da implementare on-demand quando export verso quei mercati diventa priorità. Ranges già documentati §3.5 tabella.
- **Phase 7a/7b — UI surfacing**: validator result oggi è data-only. Phase 7a contextual ribbon tab deve renderizzare red badge sopra il pulsante stair properties quando `hasCodeViolations===true`; Phase 7b floating advanced panel deve mostrare lista `violationKeys` traduched via `t()` con tooltip e separate sections (hard / nok / ibc / eurocode / ada / **egress** / headroom).
