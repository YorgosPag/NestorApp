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
- Sub-path: `companies/{cid}/projects/{pid}/floorplan_stairs/{stairId}`.
- Schema `StairDoc` = params + bbox cached + validation summary. Geometry NON persistita (ricomputata client-side da params; cache bbox per spatial index).
- Indici composite: `(projectId, level, codeProfile)`, `(projectId, validation.hasCodeViolations, updatedAt)`.

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
| **4a** | `StairGeometryService`: kind `spiral` + `helical` (riusa `helixSample`) | 3 | M | 400 | 3b |
| **4b** | `StairGeometryService`: kind `elliptical` + `winder` (riusa `ellipseArcLength`) | 3 | M | 400 | 4a |
| **4c** | `StairGeometryService`: kind `triangular-fan` + `triangular-outline` + `sketch` (free-form) | 4 | L | 500 | 4b |
| **5a** | Tool wire-up: `useStairTool` hook + preview rendering + click pipeline + Dynamic Input (rise/run/width inline) | 4 | L | 500 | 4c |
| **5b** | Stair Grips (G15): 5 tipi (`basePoint`, `direction`, `width`, `length`, `split`) — riusa overlay grip system ADR-357 | 4 | L | 500 | 5a |
| **5c** | Transforms (G17): `mirrorStairParams`, `rotateStairParams`, `copyStairParams` con auto-flip turnDirection/turnSequence (Q23) | 3 | M | 300 | 5b |
| **6** | Stair validator: NOK + IBC + Eurocode + ADA (Q25) + headroom check hybrid 2D (Q29) + i18n violation messages | 5 | M | 600 | 1 |
| **6.5** | Egress capacity validator (G20) + ADA handrail extensions render+default (G19, Q26) | 3 | S | 250 | 6 |
| **7a** | Contextual ribbon tab "Stair Properties" + `structureType` selector 8 tipi (G12, Q18) + `multiStoryConfig` UI (G11, Q17) | 4 | M | 500 | 5c |
| **7b** | Floating Advanced Properties panel + materials/finishes UI per-stair+per-tread override (G13, Q19) + `riserType` smart default (Q20) + `cutPlaneHeight` toggle (Q21) + tread numbering UI (Q28) + `nosingSide` selector (Q34) | 5 | L | 600 | 7a |
| **7.5** | Library presets (G26, Q32): `stair-presets-service` + Firestore CRUD + 3 scope (user/company/project) + UI Save/Load + dropdown grouped | 4 | M | 500 | 7b |
| **8** | Firestore persistence collection `floorplan_stairs` + integration tests + soft-lock `editingBy` (G24) | 4 | M | 400 | 5c |
| **8.5** | QTO + Schedule export (G23, Q30): `stair-schedule-exporter` factory + CSV writer + Excel writer (`exceljs`) + PDF writer (`pdfmake`) + UI export menu | 4 | M | 500 | 8 |
| **9** | (FUTURE, fuori scope ADR-358) 3D renderer + IFC export + IfcRailing + custom step profile + real-time anti-clash + CRDT | — | — | — | post |

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

---

## 10. Changelog

| Date | Change |
|---|---|
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
| 2026-05-16 | **§7.0 commit policy** aggiunta — riafferma a livello ADR la regola CLAUDE.md N.(-1): agente non committa né pusha senza ordine esplicito. Titolo §7 aggiornato da "ogni phase = 1 commit autonomo" a "commit eseguito da Giorgio". |
| 2026-05-16 | **ROUND 2** — Deep cross-vendor research (Revit/ArchiCAD/AutoCAD Architecture/Allplan/Vectorworks/BricsCAD BIM/Tekla/SOFiSTiK/VisualARQ). 23 nuovi gap identificati (G11-G33). §3.5 tabella codes estesa (NBC/NFPA/AS1657/DIN/ADA). Nuove §3.6 (ADA), §3.7 (egress), §3.8 (cut line convention), §3.9 (out-of-scope industry-wide). §5.1 StairParams espanso (multiStoryConfig, structureType, materials, riserType, cutPlaneHeight, treadNumbering, occupancyLoad, ADA handrail extensions, codeProfile esteso). Nuove §5.11 transforms, §5.12 grips. §5.4 SSoT count 4→8. §6.2 render con cut split. Nuove §6.5 QTO/schedule, §6.6 presets, §6.7 headroom check, §6.8 soft-lock multi-user. §7 phases con Phase 6.5/7.5/8.5 nuove. §9.2 Q17-Q34 in attesa. References +30 URL. |

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
- Aggiornare `.ssot-registry.json` con **8 nuovi moduli**: `StairGeometryService` *(Phase 3a+3b DONE 2026-05-16 — `computeStairGeometry` dispatch `straight` + `l-shape` + `u-shape` + `gamma` operativi; kinds `spiral`/`helical` (4a), `elliptical`/`winder` (4b), `triangular-fan`/`triangular-outline`/`sketch` (4c) ancora throw-sentinel; `computeWalkline` re-export pubblico; `buildTreadLabels` SSoT per G21 e `buildCutLineForFlights` SSoT per G14 multi-flight)*, `stair-validator`, `geometry-offset-utils` *(Phase 2b DONE 2026-05-16 — `offsetPolyline` xy-plane miter+bevel)*, `geometry-curve-utils` *(Phase 2a spiral+helix DONE 2026-05-16; Phase 2b ellipse DONE 2026-05-16 — `ellipseArcLength` + `ellipseSample`)*, `stair-grips`, `stair-transforms`, `stair-presets-service`, `stair-schedule-exporter`.
- ~~Aggiungere `FLOORPLAN_STAIRS` + `STAIR_PRESETS` in `src/config/firestore-collections.ts`.~~ ✅ Phase 1 DONE 2026-05-16.
- ~~Aggiungere `STAIR: 'stair'` + `STAIR_PRESET: 'sprst'` in `enterprise-id-prefixes.ts`.~~ ✅ Phase 1 DONE 2026-05-16 (+ `generateStairId`/`generateStairPresetId` in `enterprise-id-class.ts` + convenience + facade).
- Rigenerare `adr-index.md` via `node docs/centralized-systems/reference/scripts/generate-adr-index.cjs`.

### Phase 0 carryover (verso Phase 5a)
- **Rimuovere `comingSoon: true`** dal button `draw.stair` in `home-tab-draw.ts` quando il tool è wired (Q15 mandato — no comingSoon al merge).
- **Implementare multi-char sequence dispatcher** per hotkey `'ST'`. Phase 0 ha registrato la voce in `DXF_TOOL_SHORTCUTS` con `key: 'ST'`, ma `matchesShortcut` confronta singoli `event.key` → non spara. Aggiungere command-buffer (pattern AutoCAD) in `useKeyboardShortcuts.ts` (o nuovo hook `useToolCommandBuffer`).
- **Status bar message**: chiave `tools.stairStatus` esiste (el+en). Wirearla allo status bar `unknownTool` fallback quando `activeTool === 'stair'`.
- **Icona definitiva**: `STAIR_PATH` Phase 0 è 4-step profilo lineare; sostituire con icona per-kind (straight/spiral/u-shape) quando Phase 7a aggiunge contextual ribbon tab "Stair Properties".
- ~~**Verify enterprise-id**: `generateStairId()` da creare (vedi §5.6). Non richiesto Phase 0 (nessuna entity creata), pendente Phase 1.~~ ✅ Phase 1 DONE 2026-05-16 — `generateStairId()` + `generateStairPresetId()` operativi, prefix `stair` + `sprst` registrati. IDs `stair_<ulid26>` / `sprst_<ulid26>`.
