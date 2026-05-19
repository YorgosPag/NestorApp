# ADR-362 — Enterprise Dimension System

| Field | Value |
|---|---|
| **Status** | ✅ IMPLEMENTED — ADR-362 FULLY IMPLEMENTED 2026-05-18. Groups A→O3 complete (all pending commit). |
| **Date** | 2026-05-17 |
| **Last Updated** | 2026-05-18 |
| **Category** | DXF Viewer — Annotation / Dimensions |
| **Location** | `docs/centralized-systems/reference/adrs/ADR-362-enterprise-dimension-system.md` |
| **Author** | Claude Opus 4.7 + Giorgio Pagonis (Q&A iterativo) |
| **Related ADRs** | ADR-040 (Preview Canvas), ADR-041 (Distance Label), ADR-150 (Arrow Head Size), ADR-344 (Text Engine), ADR-345 (Ribbon Contextual Tab + FloatingPanel), ADR-358 (Stair Tool) |

---

## Summary

**✅ FULLY IMPLEMENTED 2026-05-18.** Sistema enterprise di dimension annotations per il DXF Viewer subapp, combinando i punti di forza di AutoCAD, BricsCAD, Revit con gli standard ISO 129 / ASME Y14.5. Supporto completo per tutti i 10 tipi DIMENSION (Linear/Aligned/Angular/Radial/Diameter/Ordinate/Arc-length/Jogged/Baseline/Continued), 3 DIMSTYLE template built-in configurabili, Revit-style annotation scaling, native DXF round-trip, UI integrato nel left FloatingPanel (4° tab) + contextual ribbon tab. Test suite: 7 suites × ~200 tests — dim-geometry-builder, dim-association-graph, dim-association-service, dim-text-formatter, dim-text-field-parser, dim-text-field-evaluator, center-mark-builder, dim-break-engine, dim-space-engine, dxf-dimstyle-writer, dxf-dimension-writer, dim-text-formatter-fields — all PASS.

---

## 1. Context

L'attuale subapp DXF Viewer ha solo **2 strumenti di misura**:

| Strumento | File | Output |
|-----------|------|--------|
| "Απόσταση Δύο Σημείων" (two-point) | `ui/ribbon/data/home-tab-measure.ts:8-39` | `LinearMeasurement` (`types/measurements.ts:20-24`) |
| "Συνεχόμενη Μέτρηση" (continuous) | stesso ribbon split-button | catena di `LinearMeasurement` |

**Cosa manca rispetto a un sistema CAD enterprise (AutoCAD / BricsCAD / Revit):**

- ❌ Nessun `DimensionEntity` nativo — solo `LinearMeasurement` (text + line, senza extension lines, arrowhead, DIMSTYLE)
- ❌ Nessun renderer `DimensionRenderer` (l'importer decomposta DIMENSION→TEXT+LINE, ma non c'è leaf di rendering)
- ❌ Tipi mancanti: Aligned, Angular, Radial, Diameter, Ordinate, Baseline, Continued, Arc-length, Jogged
- ❌ Nessun DIMSTYLE editabile dall'utente (parser legge DXF DIMSTYLE table read-only)
- ❌ Nessuna annotation scale
- ❌ Nessun supporto override del testo (`<>` measured, user text, tolerance, limits)
- ❌ Layer convention assente
- ❌ Export DXF: dimensioni non riemesse come `DIMENSION` entity native (interop perdita)

**Obiettivo**: progettare e implementare un sistema enterprise di dimensions che combini i punti di forza di AutoCAD, BricsCAD, Revit, e gli standard ISO 129 / ASME Y14.5.

---

## 2. Industry Research Summary

### 2.1 Tipi di dimensione standard (AutoCAD reference)

| Tipo | DXF group 70 base | Use case |
|------|-------------------|----------|
| Linear/Rotated | 0 | distanza H/V rispetto asse mondo o asse ruotato |
| Aligned | 1 | distanza parallela all'oggetto |
| Angular (2-line) | 2 | angolo tra 2 segmenti |
| Diameter | 3 | diametro cerchio |
| Radius | 4 | raggio arco/cerchio |
| Angular (3-point) | 5 | angolo da 3 punti |
| Ordinate | 6 | distanza perpendicolare da datum (X o Y, bit 64) |
| Arc-length | — (sub-type radial) | lunghezza arco |
| Jogged radius | — (sub-type radial) | raggio "zig-zag" per archi grandi |
| Baseline | derivato | catena dallo stesso punto |
| Continued (chained) | derivato | catena end-to-end |

### 2.2 DIMSTYLE — variabili critiche (60+ totali)

| Var | Significato | Default |
|-----|------------|---------|
| DIMSCALE | scala globale di tutti i valori di stile | 1.0 |
| DIMASZ | arrow size | 2.5mm |
| DIMTXT | text height | 2.5mm |
| DIMEXE | extension oltre dim line | 1.25mm |
| DIMEXO | extension offset dall'oggetto | 0.625mm |
| DIMGAP | gap testo↔dim line | 0.625mm |
| DIMTAD | text vertical pos: 0=centered, 1=above, 2=outside, 3=JIS, 4=below | 1 (ISO) / 0 (ASME) |
| DIMTIH | text inside horizontal vs aligned with line | 0 (ISO) / 1 (ASME) |
| DIMTOH | text outside horizontal | 0 / 1 |
| DIMTIX | force text inside extension lines | 0 |
| DIMTOFL | force line inside even if text outside | 0 |
| DIMCLRD/DIMCLRE/DIMCLRT | colore dim line / ext line / text | ByBlock |
| DIMBLK / DIMBLK1 / DIMBLK2 | arrowhead block | closed filled (ASME) / oblique (ISO) |
| DIMDEC / DIMTDEC | decimal precision (linear / tolerance) | 2 |
| DIMLUNIT / DIMAUNIT | unit format | decimal |
| DIMDSEP | decimal separator | '.' / ',' |
| DIMPOST | prefix/suffix text "[]" | "" |
| DIMTFAC | tolerance text scale | 1.0 |
| DIMTM/DIMTP | tolerance minus/plus | 0 |
| DIMTOL / DIMLIM | tolerance / limits display flag | 0 |
| DIMANNO | annotative flag | 0 |

### 2.3 Arrowhead types (DIMBLK)

- **Closed filled** — default ASME/mechanical
- **Architectural tick** (45° tick mark) — default architettura US
- **Oblique** (slash) — ISO 129 architettura/civile EU
- **Open, Closed, Dot, Origin, Right-angle, Box, Datum triangle, None, ...** (16+ blocchi predefiniti + custom)

### 2.4 Text placement (UX moderno)

| Convention | Text position | Text rotation | Line break at text |
|-----------|--------------|---------------|-------------------|
| **ISO 129** (EU/architettura/civile) | sopra la dim line | allineato con la dim line | NO (dim line continua sotto) |
| **ASME Y14.5** (US/mechanical) | centrato sulla dim line | sempre orizzontale | SÌ (dim line si spezza per il testo) |
| **JIS** (Giappone) | sopra | orizzontale | NO |

### 2.5 Annotation scale

Una sola DIMSTYLE marcata `ANNOTATIVE=1` produce dimensioni che si auto-scalano al viewport scale. Standard moderno — sostituisce la pratica vecchia di creare DIMSTYLE separati per ogni scala.

**Implementations**:
- AutoCAD/BricsCAD: **entity-driven** (ogni dim ha lista scales)
- Revit/ArchiCAD: **view-driven** (view ha scale, dim dichiara mm carta, auto-scale)
- Risultato finale identico, filosofia diversa

### 2.6 Layer convention

- `Dimensions` (o `A-ANNO-DIMS` AIA US National CAD Standard) — layer dedicato per dim entities
- `Defpoints` — layer speciale AutoCAD (non plottabile) per i punti di definizione delle dimensioni
- EU/Italian: `Quote` o `_QUOTE` comuni
- Greek: `ΔΙΑΣΤΑΣΕΙΣ`

### 2.7 MLEADER vs DIMENSION

- **DIMENSION** = misurazione automatica di geometria (linear/angular/radial/...)
- **MLEADER** = annotazione con leader line + testo libero, NON usa DIMSTYLE
- Entità separate in CAD enterprise; servono casi diversi.

### 2.8 DXF interop — DIMENSION entity structure

```
0       DIMENSION
5       <handle>
100     AcDbEntity
8       <layer>
100     AcDbDimension
2       *D0  (anonymous block name with rendering geometry)
10/20/30  defpoint (WCS)
11/21/31  text midpoint (OCS)
70      type+flags (bit 32=block ref, 64=ordinate X, 128=user-pos text)
1       user text override ("" | "<>" | "value")
3       DIMSTYLE name
51      text rotation
52      extension line oblique angle
100     AcDbAlignedDimension | AcDbRotatedDimension | ...
13/23/33  ext line 1 origin
14/24/34  ext line 2 origin
50      dim rotation (linear only)
40      leader length (radial only)
```

Sources: [Autodesk DXF Reference](https://help.autodesk.com/view/OARX/2025/ENU/?guid=GUID-EDD54EAC-A339-4EBA-AEA6-EC8066505E2B), [ezdxf docs](https://ezdxf.readthedocs.io/en/stable/dxfentities/dimension.html)

---

## 3. Decisions

### D1. Scope = full enterprise (2026-05-17)

TUTTI i tipi di dimensione da Day 1: Linear, Aligned, Angular (2-line + 3-point), Radial, Diameter, Ordinate, Baseline, Continued, Arc-length, Jogged. Nuovo ribbon group "Διαστάσεις" nella Home tab. I 2 strumenti esistenti `measure-distance` + `measure-distance-continuous` restano come "quick measure" parallel nel group "Μέτρηση" — invariati, non-entity, non-persistent.

Coerente con preferenza utente "completeness over MVP".

### D2. Standard configurabile, 3 template built-in (2026-05-17)

3 DIMSTYLE template predefiniti:

1. **ISO 129** (default — EU/architettura/civile): oblique tick, testo sopra & allineato, no break, decimale `,`, target layer `ΔΙΑΣΤΑΣΕΙΣ`
2. **ASME Y14.5** (US/mechanical): closed filled arrow, testo centrato & orizzontale, line break, decimale `.`, target layer `A-ANNO-DIMS`
3. **Architectural US** (hybrid): closed filled arrow, testo sopra & allineato, no break, decimale `.`, target layer `A-ANNO-DIMS`

Selezione per-progetto. Default nuovo progetto = ISO 129 (coerente con Nestor_Pagonis = oikodomikà erga Grecia). Utente può duplicare/customizzare template.

### D3. Annotation scaling = Revit-style view-driven (2026-05-17)

**Implementation**:
- `DimStyle` ha `paperTextHeight: mm` (es. 2.5mm)
- Canvas ha `currentScale: number` (es. 100 per 1:100)
- Renderer: `worldTextHeight = paperTextHeight × currentScale × unitScale`
- Stessa logica per arrow size, ext line offset, gap
- Single scale per session — cambio scale → tutte le dim si ridimensionano insieme

**Future-proof schema**:
- `DimensionEntity.annotativeScales: number[]` esiste fin da Fase 1, popolato con `[currentScale]` solo
- Aggiornabile a vera entity-driven AutoCAD-style senza schema break

**DXF export**: scale-baked, `DIMANNO=0`, `DIMSCALE=currentScale`.

### D4. Ribbon UX = Smart DIM + manual dropdown (2026-05-17)

AutoCAD 2016+ style. Primary "DIM" button grande con auto-detect tipo da hover:
- hover line → Linear/Aligned (basato su orientamento)
- hover 2 lines → Angular (2-line)
- hover arc → Radius o Arc Length (toggle via Tab/modifier)
- hover circle → Diameter
- hover 3 points → Angular (3-point)

Secondary dropdown per manual select: Ordinate, Baseline, Continued, Jogged Radius.

Modifier toggles: Tab (Linear↔Aligned), Shift (constrain orthogonal), Spacebar (switch type), Ctrl (snap override).

### D5. Layer convention = configurable per DIMSTYLE + auto-create (2026-05-17)

- `DimStyle.targetLayer: string` campo
- Defaults: ISO→ΔΙΑΣΤΑΣΕΙΣ (color cyan ACI 4), ASME/Arch→A-ANNO-DIMS (color blue ACI 5)
- Layer "Defpoints" sempre auto-created al primo dim:
  - Hidden by default nel layer panel (special icon)
  - Non-plottable (`plot: false` / `flags: 4`)
  - Contiene tutti i def points (ext line origins) per AutoCAD compatibility
- Target layer auto-created al primo dim se non esiste
- Utente può override `targetLayer` editando DIMSTYLE

### D6. DXF export = native DIMENSION entities (2026-05-17)

Round-trip pieno con AutoCAD/BricsCAD/Revit.

**Implementation**:
- Estendere `utils/dxf-dimension-converter.ts` con `convertSceneEntityToDxfDimension(entity, dimStyle)`
- Emettere `0 DIMENSION` + `100 AcDbDimension` + sub-class specifico (AcDbAlignedDimension/AcDbRotatedDimension/AcDbRadialDimension/AcDbDiametricDimension/AcDb2LineAngularDimension/AcDb3PointAngularDimension/AcDbOrdinateDimension/AcDbArcDimension)
- Group codes minimi: 10/20/30 def point, 11/21/31 text midpoint, 70 type+flags, 1 user text, 3 dimstyle name, 13/14 ext line origins, 50 angle, 40 leader, 100 sub-class marker, 51/52 text/oblique rotation
- `DIMSTYLE` table emessa con tutte le 60+ vars (compresi i 3 template predefiniti)
- `DIMSCALE = currentSessionScale` (Revit-style baked, per D3)
- Block reference `*D0/*D1/...` con anonymous block rendering (AutoCAD requirement post-R13)
- Defpoints layer emesso con `flags: 4` (non-plot)

### D7. DIMSTYLE editor UI = left panel 4° tab + ribbon contextual tab (2026-05-17)

**Project-wide style management** nel left FloatingPanel:
- 4° tab "Διαστάσεις" accanto a Levels/Colors/Properties
- Style list + Active style selector (ISO 129/ASME/Architectural/+custom)
- CRUD: Νέο / Διπλασιασμός / Διαγραφή / Μετονομασία
- Accordion sections (6): Γραμμές & Επεκτάσεις, Σύμβολα & Βελάκια, Κείμενο, Προσαρμογή, Πρωτεύουσες Μονάδες, Ανοχές
- Live preview mini-canvas
- Files: extend `panel-types.ts`, `PanelTabs.tsx`, `usePanelContentRenderer.tsx`; new `ui/panels/dimensions/DimensionsTab.tsx`

**Per-entity overrides** in contextual ribbon tab "Διάσταση":
- Pattern identical to `TEXT_EDITOR_CONTEXTUAL_TAB` (ADR-345)
- Trigger: `'dim-selected'` when DimensionEntity is primary selection
- Groups: Στυλ (chooser), Override (color, text height, arrow style), Κείμενο (position, rotation), Ιδιότητες (layer, annotation scale)
- File: new `ui/ribbon/data/contextual-dimension-tab.ts`

### D8. Advanced features = all-in (2026-05-17)

Pienamente professionale:
- **Text override**: `<>` substitution token, free text replacement, prefix/suffix (DIMPOST), multi-line MTEXT
- **Tolerance**: Symmetric (`±0.05`), Deviation (`+0.10/-0.05`), tolerance text scale (DIMTFAC)
- **Limits display**: alternative tolerance display ('3.55/3.45')
- **Alternate units**: dual unit display (metric + imperial), separate precision/suffix
- **Inspection dimension**: GD&T inspection rate marker (ASME) con 0%/100%/custom rate

DIMSTYLE editor accordion sections "Ανοχές" + "Δευτερεύουσες Μονάδες" completamente popolate.

### D9. Grip editing default = full enterprise

5 grips per dim:
- 2 def points + 2 ext line origins + 1 text midpoint
- Drag def point → reshape dim (geometry update)
- Drag text midpoint → reposition text (override DIMTAD per-entity)
- Stretch dim line away/toward object → DIMEXO adjustment

### D10. Snap default = full enterprise

- During creation: tutti gli snap esistenti (endpoint, midpoint, center, intersection, perpendicular, etc.)
- Nuovo mode `def-point`: snap a def points di dimensioni esistenti (AutoCAD compat)
- Nuovo mode `dim-line`: snap a dim line esistente per baseline/continued chains

### D11. Associativity = fully associative (DIMASSOC=2 equivalent) — Q-extra-1 (2026-05-17)

**Decisione**: dimensioni **fully associative** by default. Quando la geometria sottostante si modifica → dim segue automaticamente (def points + valore + posizione).

**Implementation**:
- `DimensionEntity.associations: Array<{ defPointIndex: number, geometryId: string, associationType: 'endpoint'|'midpoint'|'center'|'intersection'|'nearest', subIndex?: number }>`
- Quando crei dim con Smart DIM → cattura geometry reference, non solo coordinate
- Update flow: geometry move/modify → emit `GeometryChangedEvent` → DimensionEntity observer recomputes def points + measurement value
- `LineDimensionStore` o `DimensionAssociationGraph` per indice inverso geometryId → dim[]
- DIMSTYLE variable equivalent: `dimAssoc: 0 | 1 | 2`, default 2
- Reuse pattern di ADR-358 stair-floor linking (stessa filosofia)
- Edge cases:
  - Geometria cancellata → dim diventa "orphan" (visual indicator, ma valore last-known preserved)
  - Restore via `DimReassociate` command (corrisponde a AutoCAD DIMREASSOCIATE)
- Schema future-proof per parametric constraints (driven dimensions Phase 2+)

**Effort**: +2-3 giorni in Phase 5B (geometry builder) + 1-2 giorni in Phase 5D (tool handlers). Updated total ~3.5-4.5 settimane.

### D12. Convenience features — all-in (DIMBREAK + DIMSPACE + DIMTFILL) — Q-extra-2 (2026-05-17)

Tutti 3 in Fase 1:

**1. DIMBREAK (Dimension Break)**:
- Comando `dim-break` accessibile da ribbon contextual tab + right-click menu su dim entity
- Modes: **Auto** (calcola intersezioni con altri entities crossing the dim line, applica gap automatici, ricalcola al modify) + **Manual** (utente clicca punti di break)
- Gap size = `DimStyle.breakGap: mm` (default 3.75mm), nuovo campo DIMSTYLE accordion "Σύμβολα & Βελάκια"
- Implementation: nuovo file `systems/dimensions/dim-break-engine.ts` — intersection detection + gap geometry
- Live update via geometry change events (associativity D11)

**2. DIMSPACE (Dimension Space)**:
- Comando `dim-space` da ribbon "Διαστάσεις" group + contextual tab
- Modes: **Auto** (spacing = 2 × paperTextHeight) + **Custom value** + **Align** (spacing = 0)
- Selection: base dim + N target dims (linear/angular, parallele/concentrici)
- Implementation: `systems/dimensions/dim-space-engine.ts` — compute new dim line offsets, update entities

**3. DIMTFILL (Background Mask)**:
- DIMSTYLE variable `dimtfill: 0 | 1 | 2` (None | Background-color | Custom-color) + `dimtfillclr: ACIColor`
- DIMSTYLE editor accordion "Κείμενο" section — toggle + color picker
- Per-entity override via contextual ribbon tab
- Implementation: in `DimensionRenderer.ts`, draw filled rect under text bounding box prima del text
- Render order: ext lines → dim line → mask rect → arrowheads → text

**Effort**: +3-4 giorni total (1.5 DIMBREAK, 1 DIMSPACE, 0.5 DIMTFILL). Updated total ~4-5 settimane.

### D13. Center Marks + Centerlines — full enterprise (entrambi) — Q-extra-3 (2026-05-17)

**Approach 1 (bundled)** — DIMSTYLE-driven, auto-generated con radial/diameter dim:
- DIMSTYLE variable `dimcen: number` (default 2.5mm). Positive = mark + line crossing circle, Negative = mark with center line extensions, 0 = none
- Quando crei Radius/Diameter dim → DimensionRenderer renderizza anche il center mark
- Sbliv automatica con la dim parent
- Configurato in DIMSTYLE editor "Σύμβολα & Βελάκια" accordion

**Approach 2 (standalone)** — separate entity:
- Nuovi tipi entity: `CenterMarkEntity` (cross at center) + `CenterLineEntity` (line through 2 points / circle center)
- Nuovi tool: "Σταυρός Κέντρου" (CenterMark) + "Κεντρική Γραμμή" (Centerline) in ribbon "Διαστάσεις" group sub-dropdown
- Associative al cerchio/arco (D11): segue se la geometria si muove
- Independent grip editing, delete senza intaccare dim
- DXF emit: `0 ACAD_TABLE` o native `0 CENTERMARK` (AutoCAD 2017+)
- Ribbon: nuovo split button "Σταυρός / Κεντρική Γραμμή" accanto al Smart DIM

Files extra:
- `types/center-mark.ts` (NEW): `CenterMarkEntity`, `CenterLineEntity` types
- `systems/dimensions/center-mark-renderer.ts` (NEW)
- `hooks/dimensions/useCenterMarkCreate.ts` (NEW)
- ASME Y14.2 compliance per drawings mechanical (anche se main use case Greek architectural)

**Effort**: +2-3 giorni. Updated total ~4.5-5.5 settimane.

### D14. Right-click context menu = full enterprise — Q-extra-4 (2026-05-17)

Quando l'utente fa right-click su una DimensionEntity, contextual menu con tutte le azioni:

**Dim-specific actions**:
1. **Ακρίβεια** ▸ submenu (0 / 0.0 / 0.00 / 0.000 / 0.0000) — override `dimdec` per-entity
2. **Αναστροφή Βελών** — flip arrow direction (inside/outside)
3. **Επαναφορά Θέσης Κειμένου** — reset text midpoint to dim line center (clear DIMTMOVE override)
4. **Παράκαμψη Κειμένου...** — opens inline editor per text override (`<>`, free text, prefix/suffix)
5. **Εφαρμογή Στυλ** ▸ submenu (lista DIMSTYLE disponibili)
6. **Επανασύνδεση** (DIMREASSOCIATE) — re-link def points a nuova geometria se orphaned (D11)
7. **Σπάσιμο σε γραμμές** (Explode) — converte dim a entities separate (TEXT+LINE+SOLID) — irreversible warning

**Standard edit actions**:
8. Αποκοπή / Αντιγραφή / Επικόλληση / Διαγραφή
9. **Ιδιότητες...** — focus opens contextual ribbon tab "Διάσταση" (D7)

**Implementation**:
- File: `ui/context-menus/dimension-context-menu.tsx` (NEW)
- Pattern reuse: simile a ADR-345 contextual text menu se esiste, oppure check `useCanvasContextMenu.ts:1-N` (esiste già nel codice)
- i18n: nuovo sub-namespace `dimensions.contextMenu.*`
- Multi-selection support: se più dim selected, actions applicano a tutte (Precision/Style/Flip work bulk)

**Effort**: +1-2 giorni. Updated total ~4.5-6 settimane.

### D15. Fields + DIESEL expressions = AutoCAD parity — Q-extra-5 (2026-05-17)

Power-user feature, full implementation:

**Field tokens** — runtime-evaluated placeholders:
- `<measurement>` — measured value (default per dim, equivalente a `<>` AutoCAD)
- `<length>` — length of associated geometry (D11)
- `<area>` — area (per closed polylines / rooms)
- `<angle>` — angle of associated geometry
- `<perimeter>` — perimeter
- `<x>`, `<y>` — coordinate of def point
- `<scale>` — current annotation scale
- `<filename>`, `<date>`, `<author>` — drawing metadata

**DIESEL-style expressions** — math + string ops:
- Math: `<[length * 2.5]>` `<[length / 1000]>` `<[area * costPerSqm]>`
- Conditionals: `<[if(area > 50, "Μεγάλο", "Μικρό")]>`
- Format: `<[fmt(measurement, "0.00")]>` `<[fmt(area, "0.0 m²")]>`
- Variables: `<[$projectCostPerSqm]>` (resolve from project settings)

**Implementation**:
- Parser: `systems/dimensions/dim-text-field-parser.ts` — tokenize + AST + evaluator
- Reuse pattern: if existing in `text-engine/` (ADR-344) → extend, don't duplicate
- Evaluator runs on:
  - Initial dim creation
  - Geometry change events (D11 associativity)
  - Annotation scale change
  - Project settings change
- Update granularity: per-entity re-evaluation, not full scene
- UI: text override editor con autocomplete dropdown per token names + syntax highlighting per expressions
- DXF interop: Fields preservati in `MTEXT` formatting codes (AutoCAD field syntax: `\Fl{<\\AcVar Length>}%lu2`)

**Effort**: +5-7 giorni. Updated total ~5.5-7 settimane.

---

## 4. Implementation Plan

> ⚠️ **NOTA (2026-05-17)**: La sezione 4.1 sotto è SUPERSEDED dalla **§8 Session-Sized Phases** (breakdown granulare). Mantenuta solo come overview generale. Per l'implementazione effettiva, seguire §8.

### 4.1 Phase Structure (~3-4 settimane totali) — SUPERSEDED, vedi §8

| Phase | Scope | Effort | Deliverable |
|-------|-------|--------|-------------|
| **5A** | Types + Data Model + DIMSTYLE | 2-3 giorni | `DimensionEntity`, `DimStyle`, `DimensionType` enum, 60+ vars, 3 built-in templates, registry service |
| **5B** | Geometry Builder (per tipo) | 4-5 giorni | `dim-geometry-builder.ts` con calc per 10 tipi |
| **5C** | DimensionRenderer + PreviewRenderer | 2-3 giorni | ADR-040 compliant micro-leaf renderer, text via ADR-344 engine, arrowhead blocks |
| **5D** | Tool handlers + Smart DIM | 3-4 giorni | `useDimensionCreate.ts` per type, hover-based auto-detect, ribbon wiring |
| **5E** | Left panel 4° tab "Διαστάσεις" | 3-4 giorni | Style CRUD, accordion sections (6), live preview |
| **5F** | Contextual ribbon tab "Διάσταση" | 2 giorni | Per-entity overrides, identical pattern TEXT_EDITOR_CONTEXTUAL_TAB |
| **5G** | Advanced features | 3-4 giorni | Text override, tolerance, limits, alt units, inspection |
| **5H** | DXF export — native DIMENSION emitter | 3-5 giorni | Reverse of `dxf-dimension-converter`, DIMSTYLE table emit, anonymous block ref |
| **5I** | Snap integration + Grip editing | 2-3 giorni | Snap to def points, drag handles |
| **5J** | i18n + tests + ADR finalization | 2 giorni | el+en locales (`dimensions.json`), Jest test suite, ADR promotion |

### 4.2 Critical Files

```
src/subapps/dxf-viewer/
├── types/
│   ├── entities.ts                      [modify: enhance EntityType 'dimension']
│   └── dimension.ts                     [NEW: DimensionEntity, DimStyle, types]
├── systems/dimensions/                   [NEW folder]
│   ├── dim-style-resolver.ts            [NEW: resolution chain entity→style→default]
│   ├── dim-style-registry.ts            [NEW: 3 templates + user customs]
│   ├── dim-geometry-builder.ts          [NEW: per-type geometry calc]
│   ├── dim-arrowhead-blocks.ts          [NEW: 16 arrowhead variants]
│   ├── dim-text-formatter.ts            [NEW: format + tolerance + limits + alt units]
│   └── dim-smart-detector.ts            [NEW: auto-detect type from hover]
├── rendering/entities/
│   └── DimensionRenderer.ts             [NEW: ADR-040 micro-leaf]
├── canvas-v2/preview-canvas/
│   └── preview-dimension-renderer.ts    [NEW: preview during creation]
├── hooks/dimensions/                     [NEW folder]
│   ├── useDimensionCreate.ts            [NEW: creation flow per type]
│   └── useDimensionGrips.ts             [NEW: drag-edit handles]
├── ui/panels/dimensions/                 [NEW folder]
│   ├── DimensionsTab.tsx                [NEW: 4° left panel tab]
│   ├── DimStyleAccordion.tsx            [NEW: 6 sections]
│   └── DimStylePreview.tsx              [NEW: live preview canvas]
├── ui/ribbon/data/
│   ├── home-tab-dimensions.ts           [NEW: Smart DIM group + dropdown]
│   └── contextual-dimension-tab.ts      [NEW: per-entity overrides ribbon]
├── ui/
│   ├── FloatingPanelContainer.tsx       [modify: add 'dimensions' panel type]
│   ├── components/PanelTabs.tsx         [modify: add tab def]
│   └── hooks/usePanelContentRenderer.tsx [modify: add switch case]
├── ui/toolbar/types.ts                  [modify: add ToolTypes for each dim]
├── utils/
│   ├── dxf-dimension-converter.ts       [modify: add reverse direction (export)]
│   ├── dxf-table-parsers.ts             [modify: enhance DIMSTYLE parse to 60+ vars]
│   ├── dxf-parser-types.ts              [modify: full DimStyleEntry]
│   └── dxf-scene-builder.ts             [modify: wire dimensions]
├── snapping/
│   └── pro-snap-engine.ts               [modify: add def-point snap mode]
├── hooks/drawing/useDrawingHandlers.ts  [modify: wire dim tool handlers]
└── i18n/locales/{el,en}/
    └── dimensions.json                  [NEW namespace]
```

### 4.3 Reuse Existing Centralized Systems (per CLAUDE.md N.0)

- **Enterprise IDs (ADR-017)**: prefix `dim_` per `DimensionEntity.id`, `dimstyle_` per `DimStyle.id` → 2 new generators in `enterprise-id.service.ts`
- **Layer System**: existing `dxf-layer-table-parser.ts` + auto-create flow
- **Text Engine (ADR-344)**: dim text via existing MTEXT renderer
- **Snap (ProSnapEngineV2)**: extend con `def-point` mode
- **i18n SSoT (N.11)**: all strings via `t('dimensions.X')`, NO hardcoded defaultValue
- **FloatingPanel (ADR-345)**: extend con 4° tab — zero new pattern
- **Ribbon Contextual Tab (ADR-345 Phase 6)**: pattern identico TEXT_EDITOR_CONTEXTUAL_TAB
- **Distance label utils**: reuse `distance-label-utils.ts` formatters per dim text
- **Annotative resolver**: reuse `annotative-resolver.ts`

---

## 5. Verification

Dopo ogni Phase 5A-5J:
- `npm run dev` → load DXF file con dimensioni esistenti → verify rendering parity vs AutoCAD/BricsCAD reference screenshots
- Create new dim di ogni tipo → verify 60+ DIMSTYLE vars rispettate
- DXF export → re-import in AutoCAD 2024 (o BricsCAD) → verify dim entities preserved, editable, DIMSTYLE intact
- Test suite `tools/__tests__/dimensions/*` mandatory ≥80% coverage per type
- Manual smoke test:
  1. Switch active DIMSTYLE: ISO 129 → ASME → Architectural → verify all dims auto-restyle
  2. Create each type (10 types) con Smart DIM auto-detect
  3. Edit via grip + drag → verify geometry consistency
  4. Override text + tolerance + alternate units → verify rendering
  5. Annotation scale change (1:50 → 1:100) → verify all dims rescale
  6. Export DXF → diff vs AutoCAD-emitted reference

---

## 10. Smoke Test Checklist (manual verification — Phase O3)

Εκτελείται μία φορά μετά το commit όλων των phases. Τρέχει στο dev server (`localhost:3000`).

### Linear / Aligned Dimension creation
- [ ] Άνοιγμα DXF Viewer → Home tab → Panel "Διαστάσεις" ορατό
- [ ] Smart DIM ενεργοποιείται → κλικ 2 σημεία → δημιουργία LinearDimension
- [ ] Aligned DIM (dropdown) → κλικ 2 σημεία διαγώνια → measurement parallel στη γραμμή
- [ ] Baseline DIM → αλυσίδα από τελευταία dim → 3 parallel dim lines
- [ ] Continued DIM → αλυσίδα end-to-end → ενιαία αλυσίδα

### Angular / Radial Dimension creation
- [ ] Angular (2L) → επιλογή 2 γραμμών → γωνιακή διάσταση
- [ ] Radius → κλικ σε κύκλο/arc → ακτίνα με leader
- [ ] Diameter → κλικ σε κύκλο → διάμετρος Ø
- [ ] Arc Length → κλικ σε arc → μήκος τόξου ⌒

### Text override dialog + field token autocomplete
- [ ] Επιλογή dimension → contextual tab "Διάσταση" εμφανίζεται
- [ ] "Παράκαμψη Κειμένου" button → ανοίγει TextOverrideDialog
- [ ] Mode `measured` → `<>` preview δείχνει calculated value
- [ ] Mode `prefix/suffix` → π.χ. `L=<>mm`
- [ ] Mode `free text` → πληκτρολόγηση `<` → dropdown με 12 tokens
- [ ] Token autocomplete: ArrowUp/Down/Enter/Tab εισάγουν token
- [ ] ColoredPreview: field tokens μπλε, DIESEL πορτοκαλί, literals plain

### Context menu — 9 actions
- [ ] Right-click σε dimension → DimensionContextMenu εμφανίζεται
- [ ] Precision submenu (5 επίπεδα)
- [ ] "Επαναφορά Κειμένου" → userText = undefined
- [ ] "Παράκαμψη Κειμένου" → ανοίγει dialog
- [ ] "Εφαρμογή Στυλ" submenu → DIMSTYLE list

### Center marks rendering
- [ ] Radius dim με DIMCEN > 0 → cross mark στο κέντρο
- [ ] DIMCEN < 0 → cross + 4 extension lines πέρα από κύκλο
- [ ] DIMCEN = 0 → κανένα center mark

### DIMSTYLE manager (FloatingPanel 4° tab)
- [ ] Left sidebar → tab "Διαστάσεις" → λίστα styles (ISO-25, ISO-100, ISO-129)
- [ ] Create new style → accordion editor (6 sections)
- [ ] DimStylePreview SVG ανανεώνεται live
- [ ] Set Active → αλλαγή active style
- [ ] Delete custom style → AlertDialog confirm

### Tolerance / Limits rendering
- [ ] DIMTOL = true → ±0.10 εμφανίζεται δίπλα στο κείμενο
- [ ] DIMLIM = true → upper/lower limits
- [ ] DIMLIM overrides DIMTOL (AutoCAD parity)

---

## 6. Future Items (post-Phase 1)

- **Multi-viewport sheets**: future ADR — abilita full annotative entity-driven mode (upgrade D3 da Revit-style a AutoCAD-style senza schema break)
- **MLEADER (Multileader)**: separate ADR — annotation con free-form leader + text (non-DIMSTYLE)
- **GD&T Feature Control Frames**: ASME-specific, future phase
- **3D dimensions**: aligned dim su 3D faces, future phase

---

## 8. Session-Sized Implementation Phases

> **Principio**: ogni fase fits in 1 Claude Code session, ≤70% context, ≤6 file touched, focus su 1 topic coerente. Memoria `[[feedback_phase_per_session]]` enforced.

**Total: 35 phases in 15 groups. ~7 settimane di sviluppo serialed (1 fase/giorno).**

### Group A — FOUNDATION (3 sessions, blocking per tutto)

| # | Phase | Files | Output |
|---|---|---|---|
| **A1** | Types + Enterprise IDs | `types/dimension.ts` (NEW), `types/center-mark.ts` (NEW), `types/entities.ts` (mod), `services/enterprise-id.service.ts` (mod: +4 generators `dim_`/`dimstyle_`/`cmark_`/`cline_`) | DimensionEntity union, DimStyle interface ~60 vars, CenterMark/CenterLine types, EntityType enhanced |
| **A2** | DIMSTYLE Templates + Registry + Resolver + Arrowheads | `systems/dimensions/dim-style-templates.ts` (NEW: ISO/ASME/Arch), `dim-style-registry.ts` (NEW: CRUD), `dim-style-resolver.ts` (NEW: chain), `dim-arrowhead-blocks.ts` (NEW: 16+ defs) | 3 templates + registry service + 16+ arrowhead blocks |
| **A3** | Text Formatter + i18n skeleton | `systems/dimensions/dim-text-formatter.ts` (NEW), `i18n/locales/el/dimensions.json` (NEW ~80 keys), `i18n/locales/en/dimensions.json` (NEW) | Formatter base + locale skeleton |

### Group B — GEOMETRY BUILDERS (3 sessions, blocked by A)

| # | Phase | Files | Output |
|---|---|---|---|
| **B1** | Linear + Aligned + Rotated | `systems/dimensions/dim-geometry-builder.ts` (NEW: orchestrator), `builders/linear-aligned-builder.ts` (NEW), unit tests | 3 dim types geom computation |
| **B2** | Angular + Radial + Diameter + ArcLength + Jogged | `builders/angular-builder.ts` (NEW: 2-line + 3-point), `builders/radial-builder.ts` (NEW: radius/diameter/arc/jogged), tests | 5 dim types |
| **B3** | Ordinate + Baseline + Continued | `builders/ordinate-builder.ts` (NEW), `builders/chained-builder.ts` (NEW: baseline + continued), tests | 3 dim types (10 total ✓) |

### Group C — RENDERING (2 sessions, blocked by B)

| # | Phase | Files | Output |
|---|---|---|---|
| **C1** | DimensionRenderer (main canvas) | `rendering/entities/DimensionRenderer.ts` (NEW: ADR-040 micro-leaf), `DxfRenderer.ts` (mod: registry) | Persistent dim rendering |
| **C2** | Preview Renderer + Smart Detector | `canvas-v2/preview-canvas/preview-dimension-renderer.ts` (NEW), `systems/dimensions/dim-smart-detector.ts` (NEW: hover auto-detect) | Live preview + auto-detect engine |

### Group D — TOOL HANDLERS (3 sessions, blocked by C)

| # | Phase | Files | Output |
|---|---|---|---|
| **D1** ✅ | Hook orchestrator + Linear/Aligned/Angular create flow | `hooks/dimensions/useDimensionCreate.ts` (NEW), `hooks/drawing/useDrawingHandlers.ts` (mod: wire) | DONE 2026-05-17 — 4 dim types creatable end-to-end |
| **D2** ✅ | Radial family + Ordinate create flow | `dimension-create-state.ts` (mod), `dimension-create-entity-builder.ts` (mod: dispatcher + assoc), `dimension-create-radial-builders.ts` (NEW), `toolbar/types.ts` + `ToolStateManager.ts` + `useDimToolRouting.ts` (mod: +5 ToolTypes) | DONE 2026-05-17 — 9/10 dim types creatable (resta baseline/continued) |
| **D3** ✅ | Chained (Baseline/Continued) + Modifier toggles | `dimension-create-state.ts` (mod: +parentDimensionId+setParent, baseline/continued=1 click), `dimension-create-chained-builders.ts` (NEW), `dimension-create-entity-builder.ts` (mod: dispatcher+assoc), `useDimensionCreate.ts` (mod: parent resolver + Q-B chain progression), `useDimensionKeyboardRouting.ts` (NEW: global Tab/Space/Escape gate), `useDimToolRouting.ts`/`toolbar/types.ts`/`ToolStateManager.ts`/`DimensionCreateStore.ts` (mod: +2 ToolTypes + setParent action) | DONE 2026-05-17 — **10/10 dim types creatable** + live keyboard routing. Group D CLOSED. |

### Group E — RIBBON UX (2 sessions, blocked by D)

| # | Phase | Files | Output |
|---|---|---|---|
| **E1** ✅ | Home tab Smart DIM group + ToolTypes | `ui/ribbon/data/home-tab-dimensions.ts` (NEW: Smart DIM + dropdown + baseline/continued), `ui/ribbon/data/ribbon-default-tabs.ts` (mod: register), `ui/ribbon/components/buttons/RibbonButtonIcon.tsx` (mod: +12 dim icons), `i18n/locales/{el,en}/dxf-viewer-shell.json` (mod: +ribbon.panels.dimensions + ribbon.commands.dim/dimVariants/dimBaseline/dimContinued) | DONE 2026-05-17 — Visible ribbon entry-point. 10/10 dim ToolTypes (D1/D2/D3) already in `toolbar/types.ts`, no further additions needed in E1. |
| **E2** ✅ | Contextual ribbon tab "Διάσταση" | `ui/ribbon/data/contextual-dimension-tab.ts` (NEW: 4 panels, 13 buttons, comingSoon stubs), `hooks/bridge/dim-command-keys.ts` (NEW: key registry + `isDimRibbonKey`), `app/ribbon-contextual-config.ts` (mod: +DIMENSION_CONTEXTUAL_TAB + dimension type→trigger), `RibbonButtonIcon.tsx` (mod: +6 E2 icons), `i18n/locales/{el,en}/dxf-viewer-shell.json` (mod: +tab/panel/command/contextual keys) | DONE 2026-05-17 — 15/15 tests PASS. **Group E CLOSED.** |

### Group F — LEFT PANEL TAB (3 sessions, parallel to D-E)

| # | Phase | Files | Output |
|---|---|---|---|
| **F1** ✅ | Panel tab skeleton + Style Manager | `panel-types.ts` (mod), `PanelTabs.tsx` (mod), `usePanelContentRenderer.tsx` (mod), `ui/panels/dimensions/DimensionsTab.tsx` (NEW), `DimStyleList.tsx` (NEW), `DimStyleCreateDialog.tsx` (NEW), `systems/dimensions/dim-style-registry.ts` (mod: +getSnapshot), `i18n/{el,en}/dxf-viewer-panels.json` (mod: +dimensions keys) | 4° tab visible, CRUD styles — **DONE 2026-05-17** |
| **F2** ✅ | Accordion sections 1-3 (Γραμμές, Σύμβολα, Κείμενο) | `DimStyleAccordion.tsx` (NEW), `sections/LinesSection.tsx` (NEW), `sections/SymbolsSection.tsx` (NEW), `sections/TextSection.tsx` (NEW), `DimensionsTab.tsx` (mod: +editingId state + edit-mode view), `i18n/{el,en}/dxf-viewer-panels.json` (mod: +editor keys) | Edit button wired, 3/6 sections editable — **DONE 2026-05-17** |
| **F3** ✅ | Accordion sections 4-6 (Προσαρμογή, Μονάδες, Ανοχές) + Live Preview | `FitSection.tsx` (NEW), `UnitsSection.tsx` (NEW), `TolerancesSection.tsx` (NEW), `DimStylePreview.tsx` (NEW), `DimStyleAccordion.tsx` (mod: +3 sections +preview) | 6/6 sections + preview — **DONE 2026-05-17** |

### Group G — ADVANCED FEATURES D8 (3 sessions, blocked by F)

| # | Phase | Files | Output |
|---|---|---|---|
| **G1** | Text override + Inline editor | `ui/panels/dimensions/text-override-editor.tsx` (NEW), contextual ribbon mod | `<>` token + free text + prefix/suffix |
| **G2** | Tolerance + Limits rendering | `dim-text-formatter.ts` (mod), `DimensionRenderer.ts` (mod: layout) | Symmetric/deviation/limits visual |
| **G3** | Alternate Units + Inspection dimension | `dim-text-formatter.ts` (mod: alt units), `DimensionRenderer.ts` (mod: inspection marker) | Dual metric/imperial + GD&T inspection |

### Group H — DXF EXPORT D6 (3 sessions, parallel-able)

| # | Phase | Files | Output |
|---|---|---|---|
| **H1** | DIMSTYLE table emit | `utils/dxf-dimension-converter.ts` (mod: writer), `dxf-table-parsers.ts` (mod: 60+ vars write), `dxf-parser-types.ts` (mod) | DIMSTYLE roundtrip |
| **H2** | Linear/Aligned/Rotated/Angular DIMENSION emit | `dxf-dimension-converter.ts` (mod), anonymous block ref `*D0/*D1` emit | 5 dim types DXF |
| **H3** | Radial/Diameter/Ordinate/ArcLength/Jogged emit + Defpoints non-plot | `dxf-dimension-converter.ts` (mod), layer emit con `flags:4` | 10/10 dim types + Defpoints |

### Group I — SNAP + GRIPS D9/D10 (2 sessions)

| # | Phase | Files | Output |
|---|---|---|---|
| **I1** | Snap def-point + dim-line modes | `snapping/pro-snap-engine.ts` (mod), `snapping/SnapPresets.ts` (mod) | Snap a def points + dim lines |
| **I2** | Grip editing (5 grips per dim) | `hooks/dimensions/useDimensionGrips.ts` (NEW), grip system wiring | Drag def points / text / ext lines |

### Group J — ASSOCIATIVITY D11 (2 sessions)

| # | Phase | Files | Output |
|---|---|---|---|
| **J1** | Association schema + graph | `types/dimension.ts` (mod: +`associations[]`), `systems/dimensions/dim-association-graph.ts` (NEW: inverse index) | Data model + indice |
| **J2** | Observer wiring + DimReassociate command | `dim-association-service.ts` (NEW: observer), `dim-reassociate-command.ts` (NEW), event subscription mod | Auto-follow geometry + orphan recovery |

### Group K — CONVENIENCE FEATURES D12 (3 sessions)

| # | Phase | Files | Output |
|---|---|---|---|
| **K1** | DIMBREAK engine + UI | `systems/dimensions/dim-break-engine.ts` (NEW: intersection + gap), ribbon mod, context menu mod | Auto + manual dim break |
| **K2** | DIMSPACE engine + UI | `systems/dimensions/dim-space-engine.ts` (NEW: compute spacing), ribbon mod | Auto-equispace dims |
| **K3** | DIMTFILL background mask render | `DimensionRenderer.ts` (mod: mask rect), DIMSTYLE editor TextSection (mod: toggle) | Text readability mask |

### Group L — CENTER MARKS D13 (2 sessions)

| # | Phase | Files | Output |
|---|---|---|---|
| **L1** | CenterMark builder + renderer (bundled mode) | `systems/dimensions/center-mark-builder.ts` (NEW), `center-mark-renderer.ts` (NEW), DimensionRenderer integration con DIMCEN | Auto centermarks dei radial/diameter dim |
| **L2** | Standalone CenterMark tool + ribbon | `hooks/dimensions/useCenterMarkCreate.ts` (NEW), ribbon button mod | Independent centermark creation |

### Group M — CONTEXT MENU D14 (1 session)

| # | Phase | Files | Output |
|---|---|---|---|
| **M1** | Right-click context menu | `ui/context-menus/dimension-context-menu.tsx` (NEW: 9 actions), `useCanvasContextMenu.ts` (mod: register) | Right-click dim menu completo |

### Group N — FIELDS D15 (4 sessions, complex)

| # | Phase | Files | Output |
|---|---|---|---|
| **N1** | Field parser + tokenizer + AST | `systems/dimensions/dim-text-field-parser.ts` (NEW) | Parser per `<token>` + expressions |
| **N2** | Field evaluator + token resolvers | `dim-text-field-evaluator.ts` (NEW: token resolvers per `<measurement>`/`<length>`/`<area>`/etc.) | Tokens runtime-resolvable |
| **N3** | DIESEL math/string/conditional expressions | `dim-text-field-evaluator.ts` (mod: math ops, `if()`, `fmt()`, variables) | Full expression engine |
| **N4** | Fields UI: autocomplete + syntax highlight | `text-override-editor.tsx` (mod: extend), token suggestion dropdown | Power-user UI completo |

### Group O — TESTING + FINALIZATION (3 sessions, terminal)

| # | Phase | Files | Output |
|---|---|---|---|
| **O1** | Test suite — Builders + Renderer | `tools/__tests__/dimensions/builders/*.test.ts` (~5-7 NEW), renderer snapshot tests | ≥80% coverage builders |
| **O2** | Test suite — DXF round-trip + Associativity | `tools/__tests__/dimensions/dxf-roundtrip/*.test.ts`, association tests | Round-trip verified |
| **O3** | Test suite — Fields + Advanced + Smoke + ADR finalize | Fields/tolerance tests, manual smoke walkthrough, ADR status → IMPLEMENTED, MEMORY.md update | Phase 1 COMPLETE |

### Dependency Graph (sessione-by-sessione)

```
A1 → A2 → A3                            (Foundation)
       └─→ B1 → B2 → B3                 (Builders)
              └─→ C1 → C2               (Rendering)
                    └─→ D1 → D2 → D3    (Tools)
                          └─→ E1 → E2   (Ribbon UX)

F1 → F2 → F3   (Panel — parallel to D-E)
         └─→ G1 → G2 → G3 (Advanced)

H1 → H2 → H3   (DXF Export — parallel to G)

I1 → I2  (Snap+Grips, after D)
J1 → J2  (Associativity, after C+D)
K1 → K2 → K3  (Convenience, after C+G)
L1 → L2  (Center Marks, after C)
M1       (Context Menu, after D+G)
N1 → N2 → N3 → N4  (Fields, after A3+G1)

O1, O2, O3  (Testing, terminal)
```

### Suggested execution order (linear, no parallelization)

A1 → A2 → A3 → B1 → B2 → B3 → C1 → C2 → D1 → D2 → D3 → E1 → E2 → F1 → F2 → F3 → G1 → G2 → G3 → H1 → H2 → H3 → I1 → I2 → J1 → J2 → K1 → K2 → K3 → L1 → L2 → M1 → N1 → N2 → N3 → N4 → O1 → O2 → O3

**35 sessions × ~1 ora effective work cadauna = ~35 ore di Claude Code sessions distribuite su ~7 settimane.**

### Hard rules per ogni phase

1. **All'inizio session**: leggere ADR-362 §8 + la specific phase row + i file source di blocco
2. **Durante**: ≤70% context indicator. Se sale → split la phase
3. **Fine phase**: 
   - Verify build + dev server up
   - Run any relevant test
   - Update ADR-362 changelog con entry "Phase XY DONE — [files] [verification result]"
   - Handoff report se vicino al limit
4. **NESSUN commit autonomo** (CLAUDE.md N.(-1)). Giorgio confirms quando vuole.

---

## 7. Changelog

- **2026-05-19 (HOTFIX Round 4 — bug 1 REAL root cause: DimensionRenderer used backing-store viewport, not CSS rect)** — User retested after Round 3 (`mouse-handler-up.ts` snap gate). Logs proved Round 3 was correctly committing `defPoints[2]` at the raw cursor (no snap nudge), but visual placement of the committed dim STILL jumped to a wrong Y at non-100% browser zoom. DIM-DIAG R3 round-2 logs nailed it: `preview viewport=(2424×587)` (CSS pixels from `getBoundingClientRect`) vs `render canvas=(1616×390)` (backing-store from `ctx.canvas.width/height`) — ratio 1.5×, exactly matching browser-zoom 67% (`devicePixelRatio≈0.67`). Preview rendered dim line at screen Y=527.7 (correct, near click Y=534). Persistent render computed screen Y=338 because `DimensionRenderer.toScreen()` and `drawPrimaryText` used `ctx.canvas.width/height` (DPR-scaled backing store) for the `worldToScreen` viewport argument, instead of `getBoundingClientRect()` (CSS pixels) which the rest of the entity renderers use via `BaseEntityRenderer.getViewport()`.
  - **Why other renderers worked.** `BaseEntityRenderer.worldToScreen` → `getViewport()` → cached `getBoundingClientRect()` = CSS pixels. Lines, circles, polylines all go through that path. Click coords come from `getPointerSnapshotFromElement` which also uses `getBoundingClientRect()` = CSS pixels. End-to-end consistent.
  - **Why Dimension diverged.** `DimensionRenderer.toScreen()` is a **private override** that bypasses base and reads `this.ctx.canvas.width/height` directly. With DPR ≠ 1 (Giorgio's case: browser zoom 67% → DPR 0.67 → backing store ⅔ of CSS), the `worldToScreen` formula `screenY = (height - top) - worldY*scale - offsetY` produces a different Y than the click side. Effect: dim drawn at backing-store Y=338 displays at CSS Y≈340, while preview drawn at CSS-pixel Y=527.7 displays at CSS Y≈532. User sees ~190 CSS-pixel gap between hover preview and committed dim → "πετάει ψηλά".
  - **Why preview was correct.** `preview-dimension-renderer.ts` receives `viewport` as a param from PreviewCanvas, which propagates the CSS rect (since PreviewCanvas's render path is the SSoT for overlay). The bug existed only on the persistent canvas because only `DimensionRenderer`/`dim-text-renderer` override the viewport source for `worldToScreen`.
  - **Why earlier rounds couldn't see it.** Round 1+2+3 all chased the WORLD-coords side (snap, defPoints mutation, store substitution). They all converged on world coords being correct at commit time. The SCREEN-coords side (transform-to-pixels) was never instrumented until DIM-DIAG R3 round-2 added `dimLineScreen` and `textAnchorScreen` to the render-side log. The cssW/cssH vs canvas mismatch became visible the moment we logged both.
  - **Fix** — `rendering/entities/DimensionRenderer.ts`:
    - `toScreen(p)`: replace `width: this.ctx.canvas.width, height: this.ctx.canvas.height` with `getBoundingClientRect().{width,height}` (fallback to backing store if rect is 0×0 for off-screen canvases). Matches `BaseEntityRenderer.getViewport()` exactly.
    - `drawPrimaryText(r)`: same change to the `viewport` argument passed into `renderDimensionText`. Dim text now lands at the same screen Y as the dim line.
    - 2 sites, +12 / −5 lines. Symmetric to all other entity renderers. No new SSoT module needed — the rect is the canonical viewport source already in use elsewhere.
  - **Verification.** With fix: re-run Giorgio's 3-click test → render screen Y should equal preview screen Y (both ≈ 527 at click screen Y=534). DIM-DIAG R3 logs already in place will confirm both paths emit the same `screen=` coords. Once confirmed, remove the diagnostic logs (5 sites) + the `CANVAS_VS_RECT_MISMATCH` detector and ship Round 4 as the persistent fix.
  - **Boy Scout (N.0.2)** — Long-term: `BaseEntityRenderer.getViewport()` could be exposed as `protected` and `DimensionRenderer.toScreen` should call `this.worldToScreen` (inherited) instead of constructing its own viewport. Open as pending ratchet — fixing it now would touch more files than necessary for the hotfix.

- **2026-05-19 (DIM-DIAG R3 round-2 — επεκτάσεις logs, 4 ακόμη σημεία)** — Τα logs round-1 (5 sites) δεν εντόπισαν layer όπου αλλάζουν defPoints. Συμπεραίνεται ότι το πρόβλημα ίσως είναι render-side (screen-space projection / textAnchor / canvas size). Νέα logs:
  - `rendering/entities/DimensionRenderer.draw` — επέκταση: + dimLine **screen-space** projection μέσω `this.toScreen()`, textAnchor world+screen, canvas size, full transform, dimscale/dimtxt/dimtad style.
  - `rendering/entities/dimension/dim-text-renderer.ts` — textAnchor world+screen + viewport + primaryHeight calculation.
  - `canvas-v2/dxf-canvas/DxfRenderer.render` — frame-start dimCount + canvas/cssW/cssH + skipInteractive flag + first 10 dim IDs.
  - `hooks/drawing/drawing-hover-handler.ts` — hover trace μόνο σε dimLineRef phase (raw + snapped). Avoid noise on other phases.
  - **STILL TEMPORARY** — διαγραφή μόλις βρεθεί root cause.

- **2026-05-19 (DIM-DIAG R3 — temporary diagnostic logs, 5 sites)** — Round-3 fix landed σε `mouse-handler-up.ts`, αλλά παραμένει συμπτωματική απόκλιση commit→render στα defPoints. Προστέθηκαν προσωρινά `console.warn('[DIM-DIAG R3] …')` σε 5 σημεία για να συγκριθεί το ίδιο σημείο πριν/μετά από κάθε layer:
  - `systems/cursor/mouse-handler-up.ts` — client/screen/world point + snap source/target + transform + dimLineRefPhase flag.
  - `stores/DimensionCreateStore.click` — world + clicksBefore + cursorWorldBefore + stack (4 frames).
  - `hooks/dimensions/useDimensionCreate.runCommit` — built defPoints + state.clicks + rotation.
  - `rendering/entities/DimensionRenderer.draw` — defPoints + dimLine + rotation στο render-time.
  - `systems/dimensions/dim-association-service.applyAssociationUpdates` — before/after defPoints + associations (observer-driven mutations).
  - **TEMPORARY** — διαγραφή μόλις εντοπιστεί το layer όπου αλλάζουν τα defPoints. Όχι production code.

- **2026-05-19 (HOTFIX Round 3 — bugs 1 + 3 + 4 persisted after Round 1+2: upstream click-snap was the real root cause)** — User retested after Round-2 fixes. Bugs 1, 3, 4 still present (preview at correct Y, committed dim line jumps to a different Y; brief side-by-side green+cyan flash; committed dim doesn't accept hover/select). Root cause investigation finally identified the actual culprit, missed by both prior rounds.
  - **Two-layer snap, only the downstream layer was gated.** `mouse-handler-up.ts` (the centralized canvas mouse-up handler) applies snap to the click world point **before** calling `onCanvasClick(worldPoint)` (line 93-98). Then `onCanvasClick` flows through `useCanvasClickHandler` → `useDrawingHandlers.onDrawingPoint(p)` where Round-1's `isDimLineRefPhase()` gate sits. That gate is *too late* — `p` has already been corrupted by the upstream snap. So on the dimLineRef click, the world point passed to `dimensionCreateStore.click({world})` is the snapped position (the nearest entity endpoint, often the line start/end far from the cursor), not the raw cursor world. `state.clicks[2].world` → `defPoints[2]` → `buildLinearGeometry` uses `defPoints[2].y` for the dim-line foot Y → dim line lands at the snap target's Y, not the cursor's Y. User sees the committed dim "jump up" to wherever the line endpoint is.
  - **Why preview was correct.** Hover side does NOT apply upstream snap in `mouse-handler-move.ts` (line 122 passes raw `worldPos` to `onDrawingHover`). Downstream `processDrawingHover` has the `isDimLineRefPhase()` gate around its own `applySnap(p)` call. Net: hover→`state.cursorWorld` stays at raw cursor → preview renders correctly. Asymmetry between move (no upstream snap) and up (upstream snap) is what made the bug invisible to symmetry-checks during Round 1+2.
  - **Cascade resolution.** Bug 3 (green preview flashing next to cyan committed) was a *visual* artifact of Bug 1: preview at correct Y + committed at wrong Y → user sees them side-by-side for one frame. Once Bug 1 is fixed they overlap perfectly → no perceptible flash. Bug 4 (no hover/select on committed dim) cascades from Bug 1 via `BoundsCalculator.calculateDimensionBounds`: when defPoints[2] collapses onto the feature line, the dim's AABB sits where the user isn't hovering → `containsPoint` misses → `hitTestDimension` never fires. Cursor-position bounds resume correct overlap once Bug 1 lands.
  - **Why Round 1 + 2 were misdiagnosed.** Round 1 traced the snap site to `useDrawingHandlers.onDrawingPoint` (true but downstream). Round 2 noticed `state.cursorWorld` substitution masking the issue and removed it (correct cleanup but didn't move the diagnosis closer to the real cause). Both rounds verified the fix in `useDrawingHandlers` via grep but never traced *upstream* through `useCanvasClickHandler` → `mouse-handler-up.ts`. The two-layer architecture (centralized mouse handlers calling `onCanvasClick`, which then routes through several hooks before reaching `onDrawingPoint`) hid the upstream snap behind two indirections.
  - **Fix** — `mouse-handler-up.ts::handleMouseUp`: import `isDimLineRefPhase` from `hooks/dimensions/dim-skip-snap` (existing SSoT module); gate the upstream `findSnapPoint` call with `!isDimLineRefPhase()`. Surgical 1-line change + 1 import. Symmetric with the downstream `useDrawingHandlers.onDrawingPoint` gate and the `drawing-hover-handler` gate — three sites, one predicate, AutoCAD-parity OSNAP-off semantics for the free-position pick.
  - **Files changed** (1 production): `systems/cursor/mouse-handler-up.ts` — added import + `!isDimLineRefPhase()` guard around the upstream snap.
  - **Out of scope for this hotfix** — (a) Bug 2 (committed dim line color): templates already set `dimclrd/e/t = 256` (ByLayer) in `sharedDefaults` per Round-1 fix, but `EntityRendererComposite.setDimensionLayerColour` has no production caller, so `DimensionRenderer.this.layerColour` stays `undefined` → `resolveDimColor(256, undefined)` → `CAD_UI_COLORS.entity.default` = `#ffffff` (white). User reports text already renders white; lines pending re-verification post-Bug-1 (cyan-vs-white visual was hard to tell while the dim line jumped to a wrong Y). If lines still render cyan after this fix, separate audit needed for `setDimensionLayerColour` wiring or for templates that set `dimclrd = 4` elsewhere; (b) snap-aware association capture (Phase J — record which snap mode fired at each click so the observer can use proper `endpoint`+`subIndex` / `midpoint` / `center`).

- **2026-05-19 (HOTFIX Round 2 — bugs 1 + 3 persisted after Round 1: stale cursorWorld + RAF re-paint)** — User retested after Round-1 fixes (hard refresh, color fix verified — teal text became white). Bugs 1 + 3 + 4 still reported. Investigation found:
  - **Bug 1 (position jump) — Round-1 fix was incomplete.** Skipping snap on the dimLineRef click made the click `world` raw, but `useDimToolRouting.handlePoint` was STILL substituting `state.cursorWorld` (a 2026-05-19 Round-1 hotfix designed to dodge snap-mismatch). The reducer overwrites `cursorWorld` with `action.world` on every click (`dimension-create-state.ts:301`). Immediately after click#2 — and before any mousemove fires — `state.cursorWorld === click2_world`. If click#3 lands without an intervening mousemove (common: user clicks fast, or DynamicInputOverlay intercepts mousemove between click#2 and click#3), `commitWorld` collapses onto click#2 → dim line snaps onto the feature segment / "jumps". **Fix** — remove the `state.cursorWorld` substitution entirely from `handlePoint`. With Round-1's `isDimLineRefPhase()` snap gating in place, the raw `world` IS the correct commit position. Enter-key commits keep using `cursorWorld` because they have no click event (`useDimensionCreate::onKey('Enter')`). Side-effect: `requiredClickCount` import removed (unused).
  - **Bug 3 (green flash) — Round-1 fix was incomplete.** Synchronous `previewRef.clear()` in `handlePoint` was undone by the next RAF tick: the `dim-preview-persist` callback (`useDimToolRouting:118-127`, RAF-driven via `UnifiedFrameScheduler`) re-invokes `pushPreview` every frame, with no status gate. `buildPreviewDimensionEntity` only checked `currentType + styleId + (clicks OR cursorWorld)` — all true at `commit-ready` (3 clicks present) — so it happily rebuilt the green dim from the 3 clicks for every RAF frame between the sync click and the microtask-scheduled `runCommit`. **Fix** — `buildPreviewDimensionEntity` now returns `null` when `state.status === 'commit-ready'`. Closes the RAF re-paint window at the SSoT (one guard, two callers: the sync clear AND the RAF persist loop both respect it).
  - **Bug 4 (no hover/select)** — Traced the full hover path: `DxfCanvas:207 hitTestCallback` → `HitTestingService.hitTest` → `HitTester.linearHitTest` (single-entity scenes have <100 entities so spatial index is skipped) → `BoundsCalculator.calculateDimensionBounds` (already present from Phase I3, reads `entity.defPoints` from top-level after `convertToEntityModel case 'dimension'` unwraps `DxfDimension.dimensionEntity`) → `containsPoint(bounds, cursor)` → `performDetailedHitTest` → my Round-1 `hitTestStraightDim`. Architecture is correct end-to-end. Most likely Bug 4 cascades from Bug 1: when defPoints[2] collapses onto the feature line, the dim's AABB becomes near-degenerate (or sits where the user isn't hovering), `containsPoint` misses for cursor positions above the feature line, and hover never reaches `hitTestDimension`. Expected to self-resolve once the Round-2 Bug 1 fix lands. Falsifiable: if hover still fails after Bug 1 is verified visually correct, investigate `setDimensionLayerColour` wiring (`EntityRendererComposite.setDimensionLayerColour` defined at line 137 but no production caller — separate audit needed) + a force-reload of the `DimStyleRegistry` singleton if HMR doesn't reset it.
  - **Files changed** (3 production):
    - `hooks/dimensions/useDimToolRouting.ts` — `handlePoint` uses `world` directly; removed `state.cursorWorld` substitution + unused `requiredClickCount` import
    - `hooks/dimensions/dimension-create-entity-builder.ts` — `buildPreviewDimensionEntity` returns null when status is `commit-ready`
    - (ADR-362 §7 changelog — this entry)

- **2026-05-19 (HOTFIX session — 4 bugs after linear dim 3rd-click: snap, color, preview flash, hit test)** — User testing report (Greek): «πρώτο κλικ → πράσινη διακεκομμένη γραμμή· δεύτερο κλικ → οριζόντια διάσταση πράσινη· τρίτο κλικ → πηδάει πάνω, εμφανίζεται τιρκουάζ, και η αρχική πράσινη μένει στιγμιαία· μετακίνηση cursor → μένει μόνο τιρκουάζ σε λάθος θέση· δεν κάνει hover, δεν επιλέγεται.» Four distinct root causes, four independent fixes.
  - **Bug 1 — Position jump on click#3 (residual after 2026-05-19 cursorWorld fix)** — Root cause: `useDrawingHandlers::onDrawingPoint` + `drawing-hover-handler::processDrawingHover` unconditionally call `applySnap(p)` before forwarding to `dimRouting.handlePoint` / `handleHover`. For the dim-line-offset pick (3rd click of `linear`/`aligned`) the user wants a *free* position, not an entity snap. The earlier `cursorWorld` hotfix in `useDimToolRouting.handlePoint` only papered over the click side; the hover side still snapped, so `state.cursorWorld` itself was a snapped value and the commit followed the snap target. **Fix** — both code paths now consult `isDimLineRefPhase()` (already-existing SSoT helper in `dim-skip-snap.ts`); when true, the raw `p` is forwarded and entity resolution is short-circuited. AutoCAD pattern: OSNAP off for dim-line offset picks.
  - **Bug 2 — Committed dim renders cyan instead of layer color** — Root cause: `dim-style-templates.ts::sharedDefaults` set `dimclrd / dimclre / dimclrt = 4` (ACI 4 = `#00FFFF`). Preview pipeline overrides to `#00ff00` via `withPreviewColors`, so preview was green but committed dim flipped to cyan — looked like a different entity at a different location. **Fix** — defaults changed to `256` (ByLayer). Templates that *intentionally* want a hardcoded color (ASME Y14.5 + Architectural US → ACI 5 blue) keep their explicit overrides. ISO 129 stale comment "cyan ACI 4" updated.
  - **Bug 3 — Green preview flash next to committed dim** — Root cause: `useDimToolRouting::handlePoint` always called `pushPreview(previewRef)` after `dimCreate.onClick()`. The commit runs in a `queueMicrotask` (per `useDimensionCreate`), so the post-click `pushPreview` painted ONE frame of green rubber-band that lingered until the microtask cleared it. Visible as a "double dim" flash. **Fix** — read `dimensionCreateStore.get().status` after `onClick`; if `'commit-ready'`, call `previewRef.current?.current?.clear()` synchronously instead of re-pushing the preview. Frame budget tightens from "paint green, then clear, then paint committed" to "clear, then paint committed".
  - **Bug 4 — Committed dim doesn't accept hover/click** — Root cause (3 layers): (a) `DimensionRenderer.hitTest()` returned `false` (stubbed Phase I); (b) `hitTestDimension` in `hit-test-entity-tests.ts` used `pts[0]→pts[1]` (the *feature* segment) as the dim line and `midpt(pts[0], pts[1])` as the text anchor — both wrong for any dim whose dim line is offset from the feature segment (the normal case); (c) the legacy text-anchor approximation was equally off. **Fix** — new SSoT helper `systems/dimensions/dim-hit-geometry.ts::computeDimHitGeometry()` derives the *actual* foot points (perpendicular projections of `pts[0]` and `pts[1]` onto the dim line through `pts[2]`) using the linear `rotation` or aligned `pts[0]→pts[1]` direction. Both `hitTestDimension` and `DimensionRenderer.hitTest()` now consume this helper for linear/aligned; radial/angular/ordinate fall back to the legacy defPoints approximation until a future Phase I delivers per-variant geometry. `BoundsCalculator.calculateDimensionBounds()` was already in place (Phase I3 earlier), so the spatial-index broad-phase was not the blocker.
  - **Files changed** (6 production + 1 new SSoT):
    - NEW `systems/dimensions/dim-hit-geometry.ts` — `computeDimHitGeometry()` SSoT (foot points + text anchor for linear/aligned)
    - `systems/dimensions/dim-style-templates.ts` — `sharedDefaults` colors → ByLayer (256)
    - `hooks/drawing/useDrawingHandlers.ts` — import `isDimLineRefPhase`; gate `applySnap` + entity resolution on dim-line-offset pick
    - `hooks/drawing/drawing-hover-handler.ts` — same gating, symmetric on hover side
    - `hooks/dimensions/useDimToolRouting.ts` — `handlePoint` skips preview push when post-click status is `commit-ready`
    - `rendering/hitTesting/hit-test-entity-tests.ts` — `hitTestDimension` split into `hitTestStraightDim` (linear/aligned, uses SSoT) + `hitTestLegacyDim` (radial/angular/ordinate)
    - `rendering/entities/DimensionRenderer.ts` — `hitTest()` implemented (delegates to SSoT for linear/aligned, defPoints proximity fallback)
  - **Out of scope** — grips (`DimensionRenderer.getGrips` still returns `[]` — Phase I); per-variant hit geometry for angular/radial/ordinate (legacy approximation retained); snap-aware association capture (Phase J).

- **2026-05-19 (HOTFIX — Linear/aligned dim "jumps to wrong Y position" after click#3: snap mismatch hover vs click)** — User testing report (via console diagnostics): committed dim line appears at y=0 (on the measured line) instead of at the cursor offset position shown in the preview. Click#2 diagnostic showed `raw(-10,0) → snapped(0,0) → cursorWorld(-10,0)` — snap at click time pulled to the endpoint (0,0) while the last hover had reported (-10,0) as cursorWorld (preview position). Click#3 then used cursorWorld=(0,0) (set by click#2 reducer), producing a degenerate dim line coincident with the measured geometry.
  - **Root cause** — Snap at hover time and snap at click time can disagree at the tolerance boundary (~10 world units from an endpoint). Two contributing factors: (1) `DynamicInputOverlay (showInput:true)` intercepts `mousemove` events → hover doesn't fire between click#2 and click#3 → cursorWorld stays stale; (2) React re-render triggered by hover dispatch updates `scaleRef.current` via `useEffect`, so `findSnapPoint` sees a slightly different scale at the next click, crossing the threshold. For feature-pick clicks (extOrigin1/2), the snap disagreement is acceptable (endpoint snap is desired). For the dimLineRef click (3rd click of linear/aligned), the disagreement causes the dim line to jump to a wrong Y position — the visual preview was correct, the committed entity was not.
  - **Fix** — `useDimToolRouting.ts::handlePoint`: for `linear`/`aligned` dims, when `clickIndex === requiredClickCount(type) - 1` (the dimLineRef pick) AND `state.cursorWorld !== null`, use `state.cursorWorld` (the last hover = the preview position) instead of the incoming re-snapped `world`. Enter-based commits already use `cursorWorld` (per `useDimensionCreate.ts:189-195`). This makes mouse-click commits and Enter commits consistent: commit == preview for the dimLineRef position.
  - **Files changed** (1 production): `hooks/dimensions/useDimToolRouting.ts` — added import `requiredClickCount` from `dimension-create-state`; modified `handlePoint` callback.
  - **Diagnostic cleanup** — removed 4 temporary `[DIM-DIAG ...]` console.log/warn blocks from: `hooks/drawing/useDrawingHandlers.ts` (click diagnostic + `dimensionCreateStore` import), `hooks/drawing/drawing-hover-handler.ts` (hover diagnostic), `hooks/dimensions/useDimensionCreate.ts` (commit defPoints diagnostic), `hooks/dimensions/useDimAssociationObserver.ts` (observer MOVING diagnostic).

- **2026-05-19 (HOTFIX — Linear/aligned dim "jumps to line endpoint" after commit: association observer overwrite)** — User testing report: «στο τρίτο κλικ η διάσταση μεταφέρεται προς την πάνω πλευρά της οθόνης» on smart dim. Preview stayed at click position (green, lower), committed entity rendered at unexpected upper position (cyan). Same dim, two locations. Verified via diagnostics: persists post-reload, opaque (not ghost overlay), hit-test misses it (Phase I) — entity is real but at wrong defPoints.
  - **Root cause** — `dimension-create-entity-builder.ts::makeAssociation()` stamps `associationType: 'endpoint'` for every clicked entity in linear/aligned/angular3P/ordinate/baseline/continued, **without setting `subIndex`**. `useDimAssociationObserver` fires on every command execute (commit triggers one). `recomputeAssociatedDefPoint('endpoint', lineEntity)` does `assoc.subIndex === 0 ? e.start : e.end` — when `subIndex === undefined`, the ternary falls through to `e.end`. The observer overwrites the user-clicked defPoint with the line's far endpoint, snapping the dim "up" (or wherever the line ends).
  - **Why preview was correct** — preview uses raw `state.cursorWorld` / `state.clicks[i].world` (the click position). The association recompute only runs *after* commit, inside the observer's command-event subscription. So preview ↔ committed mismatch was guaranteed for any smart-dim click on a line where the click point wasn't already at `line.end`.
  - **Fix (2-layer)**:
    1. `makeAssociation` now stamps `associationType: 'nearest'` instead of `'endpoint'`. `recomputeAssociatedDefPoint` returns `null` for `'nearest'` (position preserved in `applyAssociationUpdates`). Geometry reference kept for orphan tracking + future snap-aware re-association. No live dim-follows-geometry update until a snap-aware capture path resolves the exact sub-feature (endpoint `subIndex` 0/1, midpoint, etc.).
    2. **Defense-in-depth** — `recomputeAssociatedDefPoint` `case 'endpoint'` now returns `null` when `subIndex === undefined` instead of falling through to `e.end`. Protects pre-fix dims already saved with `{ type: 'endpoint', subIndex: undefined }` from being snapped to `line.end` on the next command event. Without this, hard-refreshing a scene that contains old buggy dims would re-trigger the jump.
  - **Files changed** (2 production + 1 test):
    - `hooks/dimensions/dimension-create-entity-builder.ts::makeAssociation`
    - `systems/dimensions/dim-association-service.ts::recomputeAssociatedDefPoint`
    - `systems/dimensions/__tests__/dim-association-service.test.ts` — "line subIndex undefined" expectation flipped from `e.end` to `null` (documents the new safeguard, replaces the pre-fix bug-as-spec test).
  - **Out of scope for this hotfix** — (a) Hit-test for committed dims (`DimensionRenderer.hitTest` returns `false` — Phase I); (b) Snap-aware association capture (Phase J — record which snap mode fired at click time so the observer can use proper `endpoint`+`subIndex` / `midpoint` / `center`).

- **2026-05-19 (HOTFIX — Committed dims invisible: missing `case 'dimension'` in scene conversion)** — User testing report: «3o κλικ / Enter δεν τοποθετεί τη διάσταση». Root cause: `useDxfSceneConversion.ts::convertEntity()` has no `case 'dimension'` branch → freshly-committed `DimensionEntity` falls into `default` and is silently dropped via `dwarn('Unsupported entity type:', 'dimension'); return null`. The commit flow (`useDimensionCreate` → `onDimensionCreated` → `sceneState.handleSceneChange`) does push the entity into `SceneModel.entities`, but `useDxfSceneConversion` then filters it out of `DxfScene.entities`, so `DxfRenderer.unwrapForRender()` + `buildDimensionLookup()` never see it. Result: 3rd click + Enter "appear to do nothing" — they actually commit, but the dim is invisible and the auto-restart clears the preview, so the user keeps re-placing invisible duplicates.
  - **Fix** — `useDxfSceneConversion.ts`: imports `DimensionEntity` from `types/dimension`; `convertEntity()` switch gains `case 'dimension'` that wraps the raw `DimensionEntity` into a `DxfDimension` (`{ ...base, type: 'dimension', dimensionEntity: entity }`). Mirrors the existing `case 'stair'` / `case 'slab'` / `case 'opening'` wrapping pattern.
  - **Why a wrap, not a flatten** — `DxfDimension` is the SSoT-preserving wrapper introduced in Phase C1 so the renderer can resolve `DimStyle` + `DimGeometry` on the fly via the registry singleton + per-frame `DimensionLookup`. Flattening to legacy primitives would defeat live DIMSTYLE edits + associativity.
  - **Files changed** (1 production): `hooks/canvas/useDxfSceneConversion.ts`.
  - **Out of scope for this hotfix** — `case 'center-mark'` / `case 'centerline'` missing too (Phase L2). Sibling bug, separate ratchet.

- **2026-05-18 (HOTFIX — Smart DIM 3-bug fix: rubber-band preview + Enter commit + hoveredEntity routing)** — Post-implementation hotfix identified via user testing. Three bugs + root cause addressed. Zero breaking changes to any existing API or test.
  - **Bug 1 fix — rubber-band preview after 1st click**: `preview-dimension-renderer.ts` — `renderPreviewDimension()` no longer returns early when `tryBuildGeometry()` fails. When `entity.defPoints.length ≥ 2` and no explicit `opts.helperPath`, auto-derives a dashed rubber-band polyline from the available `defPoints` (click1 → cursor). Matches AutoCAD/BricsCAD behavior: user sees live dashed feedback immediately after the first click.
  - **Bug 2 fix — dim line "dancing" after 2nd click**: dancing IS correct behavior (3-click tool waiting for `dimLineRef`). Addressed indirectly via Bug 3 (Enter key): user can press Enter to commit at cursor instead of a 3rd physical click.
  - **Bug 3 fix — Enter key commits current cursor as next click**: `useDimensionCreate.ts` — `DimensionCreateKey` extended `'Tab'|'Space'|'Escape'` → adds `'Enter'`; `onKey('Enter')` dispatches a synthetic `click` at `state.cursorWorld` when `clicks.length === requiredClickCount(currentType) - 1` (one click short of commit-ready). AutoCAD/Revit pattern: Enter = "accept current cursor position". `useDimensionKeyboardRouting.ts` — `mapKey()` extended with `e.key === 'Enter' → 'Enter'`; `preventDefault()` fires (matches Tab/Space, suppresses form submission / browser default).
  - **Root cause fix — hoveredEntity never reached smart detector**: `drawing-hover-handler.ts` — `DrawingHoverCtx.handleDimHover` signature extended with `hoveredEntity?: DetectableEntity`; `resolveEntity: (id: string) => DetectableEntity | undefined` added to `DrawingHoverCtx`; `processDrawingHover` dim branch calls `findSnapPointRef.current()` → resolves entity from `snapResult.entityId` → passes to `handleDimHover`. `useDrawingHandlers.ts` — `onDrawingPoint` dim branch calls `findSnapPoint(p.x, p.y)` → looks up entity in `currentScene.entities` → passes as `hoveredEntity` to `dimRouting.handlePoint`. `onDrawingHover` ctx: `handleDimHover` now forwards `hoveredEntity`; `resolveEntity` lambda closes over `currentScene`. `FindSnapResult` local type alias extended with `entityId?: string` to surface `ProSnapResult.entityId`.
  - **Test update** — `useDimensionKeyboardRouting.test.ts` — "ignores unrelated keys": `Enter` removed from ignored set (replaced with `ArrowLeft`). New test added: "dispatches Enter and prevents default (ADR-362 hotfix: early-commit)". Total: 6 → 7 tests; **7/7 PASS**.
  - **Files changed** (5 production + 1 test): `canvas-v2/preview-canvas/preview-dimension-renderer.ts`, `hooks/dimensions/useDimensionCreate.ts`, `hooks/dimensions/useDimensionKeyboardRouting.ts`, `hooks/drawing/drawing-hover-handler.ts`, `hooks/drawing/useDrawingHandlers.ts`, `hooks/dimensions/__tests__/useDimensionKeyboardRouting.test.ts`.
  - **Verification**: `npx jest useDimensionCreate|useDimensionKeyboard|preview-dimension` → **41/41 PASS**. Pre-existing 5 failures (contextual-dimension-tab button counts, Phase E2 ribbon UI mismatch) unaffected.

- **2026-05-18 (HOTFIX Round 2 — DIMSCALE auto-scale + preview persistence + input-focus key routing)** — Three additional UX fixes post Round-1 hotfix. Zero breaking changes.
  - **Fix A — DIMSCALE auto-scale in preview-dimension-renderer**: `preview-dimension-renderer.ts` — `renderPreviewDimension()` derives `autoScale = 4 / max(transform.scale, 1e-6)` and overrides `style.dimscale` for the preview pipeline. Keeps arrows + text at ~10px on screen regardless of drawing units (mm vs m vs in). Without this, mm-unit drawings showed sub-pixel arrows.
  - **Fix B — RAF-persist dim preview**: `useDimToolRouting.ts` — registers a `dim-preview-persist` callback via `registerRenderCallback` (RENDER_PRIORITIES.NORMAL) that re-pushes the dim preview every frame while a dim tool is active. Survives external `canvas.clear()` paths (e.g. `markAllCanvasDirty`) that otherwise erased the rubber-band line when the cursor stopped moving.
  - **Fix C — Enter/Escape still route while Dynamic Input has focus**: `useDimensionKeyboardRouting.ts` — when `isEditableFocus()` returns true, instead of swallowing the event the handler now blurs the editable target and dispatches `Enter` (with `preventDefault`) or `Escape` (without `preventDefault`, so legacy ESC paths still fire). Tab/Space keep normal browser behaviour. Lets Dynamic Input commit a typed length/angle and Enter to finish the dim in one keystroke.
  - **Test update** — `useDimensionKeyboardRouting.test.ts`: gate test split — "suppresses Tab / Space when an INPUT is focused" + new "dispatches Enter even when INPUT is focused — blurs input and prevents default" + new "dispatches Escape even when INPUT is focused — blurs input, does NOT prevent default". Total 7 → 9 tests.
  - **Files changed** (3 production + 1 test): `canvas-v2/preview-canvas/preview-dimension-renderer.ts`, `hooks/dimensions/useDimToolRouting.ts`, `hooks/dimensions/useDimensionKeyboardRouting.ts`, `hooks/dimensions/__tests__/useDimensionKeyboardRouting.test.ts`.

- **2026-05-18 (HOTFIX Session 2 — Dynamic-Input keyboard hijack + rubber-band flicker + annotation auto-scale)** — Post-implementation user-testing session identified 5 more bugs. 3 critical fixed, 1 deferred, 1 low-priority. Zero breaking changes.
  - **Bug Δ fix — Enter blocked by Dynamic Input**: `useDimensionKeyboardRouting.ts` — `handler()` no longer unconditionally returns when `isEditableFocus()`. For `Enter` with an INPUT focused: `e.preventDefault()` + `blur()` the input + `onKeyRef.current('Enter')`. AutoCAD pattern: Enter in dynamic input → commit current value.
  - **Bug Ε fix — Escape blocked by Dynamic Input**: Same file, same handler. For `Escape` with INPUT focused: `blur()` + `onKeyRef.current('Escape')`, intentionally NO `preventDefault` so the legacy `useKeyboardShortcuts` ESC path (overlay/color reset) still fires.
  - **Tab/Space with INPUT focused**: unchanged — suppressed as before (browser native behavior).
  - **Bug Β fix — rubber-band dashed line disappears when cursor stops**: `useDimToolRouting.ts` — added RAF persist loop via `registerRenderCallback('dim-preview-persist', ..., RENDER_PRIORITIES.NORMAL)`. Callback runs every frame while a dim tool is active and re-calls `pushPreview(previewRef)`. Ensures the dim preview survives any external `clear()` calls (e.g. `markAllCanvasDirty` path) and is re-drawn even when no `mousemove` events arrive. Root cause: canvas was being cleared by the RAF sync group between hover events.
  - **Bug Γ fix — annotation features (arrows + text) too large/small relative to drawing**: `preview-dimension-renderer.ts` — auto-computes `dimscale = 4 / transform.scale` at render time. This keeps arrows ≈ 10 px and text ≈ 10 px on screen regardless of the drawing's unit scale (meters vs mm vs km). Formula derived from `unitPx = dimasz × dimscale × scale = 10 → dimscale = 4/scale`. Does not persist to the style registry — preview only.
  - **Bug A (snap grip mismatch) deferred**: visual-only, low priority. No code change this session.
  - **Test update** — `useDimensionKeyboardRouting.test.ts` — renamed existing "suppresses dispatch" test to "suppresses Tab / Space when INPUT focused". Added 2 new tests: "dispatches Enter even when INPUT is focused" + "dispatches Escape even when INPUT is focused". Total: 7 → 9 tests; **9/9 PASS**.
  - **Files changed** (3 production + 1 test): `hooks/dimensions/useDimensionKeyboardRouting.ts`, `hooks/dimensions/useDimToolRouting.ts`, `canvas-v2/preview-canvas/preview-dimension-renderer.ts`, `hooks/dimensions/__tests__/useDimensionKeyboardRouting.test.ts`.
  - **Verification**: `npx jest useDimension|preview-dimension` → **43/43 PASS**.

- **2026-05-18 (HOTFIX Session 2 followup — Escape δεν αλλάζει active tool)** — `useDimToolRouting.ts`: added `onToolChange?: (tool: ToolType) => void` to `UseDimToolRoutingParams`. New `wrappedOnKey`: on Escape → `dimCreate.onKey('Escape')` + `canvas.clear()` + `onToolChangeRef.current?.('select')`. Same in `handleCancel`. `useDrawingHandlers.ts`: passes `onToolChange` to `useDimToolRouting`. Escape now exits the dim tool completely (AutoCAD pattern). Tests: 43/43 PASS.

- **2026-05-18 (HOTFIX Session 2 — Escape χρειάζεται 2 πατήματα — belt-and-suspenders fix)** — Root cause: `onToolChangeRef.current?.('select')` routes through the React props chain (2 instances of `useDimToolRouting` running simultaneously: one from `useDxfViewerState`, one from `useCanvasEffects`), causing timing issues that require a 2nd Escape press to complete the tool switch. Fix: added `handleToolCompletion(activeTool, true)` call in `wrappedOnKey` (Escape branch) and `handleCancel` — this directly calls `toolStateStore.handleToolCompletion(activeTool, true)` which immediately sets `activeTool='select'` in the module-scoped store and notifies all subscribers, bypassing the React props chain entirely. 1 Escape press now guaranteed. Files changed: `hooks/dimensions/useDimToolRouting.ts` (+import `handleToolCompletion`, +belt-and-suspenders in `wrappedOnKey`/`handleCancel`, +`activeTool` in useCallback deps).

- **2026-05-18 (HOTFIX Session 2 Fix 2 — Escape πήγαινε στο onColorMenuClose αντί για onDrawingCancel)** — Root cause #2: `useKeyboardShortcuts.ts` ESC handler είχε hardcoded list `['line', 'polyline', 'polygon', ...]` που ΔΕΝ περιλάμβανε dim tools. Αποτέλεσμα: ESC με active dim tool έπεφτε στο fallback `onColorMenuClose()` αντί για `onDrawingCancel()` (που καλεί `dimRouting.handleCancel()` + `handleToolCompletion(activeTool, true)`). Fix: προστέθηκαν όλα τα 11 dim tools (`dim-smart`, `dim-linear`, `dim-aligned`, `dim-angular2L`, `dim-angular3P`, `dim-radius`, `dim-diameter`, `dim-arc-length`, `dim-jogged-radius`, `dim-ordinate`, `dim-baseline`, `dim-continued`) στο `isDrawingTool` array. Τώρα ESC σε dim tool → `onDrawingCancel()` → `dimRouting.handleCancel()` → `handleToolCompletion(activeTool, true)` → 1 πάτημα guaranteed. Files changed: `hooks/useKeyboardShortcuts.ts` (line 100).

- **2026-05-17 (Phase G1 DONE — Dimension Text Override dialog + inline editor; ribbon action wired; 15 unit tests PASS.)** — `userText` field exposed via a dedicated dialog (module-scoped external store pattern, zero Zustand). Three editing modes: measured (userText=undefined/`<>`), prefix/suffix (`PREFIX<>SUFFIX`), free text. Ribbon "Παράκαμψη Κειμένου" button in contextual Dimension tab Panel C dispatches to `openDimTextOverride(entityId)` via `wrappedHandleAction`. Dialog reads entity from `getCurrentScene()` and writes via `updateEntity()`.
  - **NEW** `src/subapps/dxf-viewer/ui/panels/dimensions/DimTextOverrideStore.ts` (~54 LOC) — hand-rolled module-scoped external store (`openDimTextOverride` / `closeDimTextOverride` / `getDimTextOverrideState` / `subscribeDimTextOverride` / `__resetDimTextOverrideStoreForTests`). Idempotent open (no re-notify if same entityId already open). Mirrors `DimensionCreateStore` + `HoverStore` pattern.
  - **NEW** `src/subapps/dxf-viewer/ui/panels/dimensions/TextOverrideEditor.tsx` (~164 LOC) — pure UI component. `detectMode(userText)` determines initial radio selection. Prefix/suffix inputs appear only in `prefixSuffix` mode; free-text input only in `free` mode. Live preview shows formatted result. `readOnly` prop disables all inputs. `useTranslation('dxf-viewer-panels')` with prefix `panels.dimensions.textOverride.*`. No stores, no Firestore.
  - **NEW** `src/subapps/dxf-viewer/ui/panels/dimensions/TextOverrideDialog.tsx` (~95 LOC) — connected dialog consuming `DimTextOverrideStore` via `useSyncExternalStore`. Reads entity via `getCurrentScene()?.entities.find(…)` guarded by `asDimensionEntity()`. On save: `updateEntity(entityId, { userText: localUserText })` then `closeDimTextOverride()`.
  - **NEW** `src/subapps/dxf-viewer/ui/panels/dimensions/__tests__/TextOverrideEditor.test.tsx` (~160 LOC) — 15 tests in 2 suites: `TextOverrideEditor` (8 tests: measured mode for undefined/`<>`, prefixSuffix mode shows prefix+suffix inputs, free mode, mode change → onChange(undefined), prefix change → composite string, empty free text → onChange(undefined), readOnly disables radios); `DimTextOverrideStore` (7 tests: starts closed, open sets state, idempotent open (1 notify not 2), close resets, close idempotent, unsubscribe removes listener).
  - **MOD** `src/subapps/dxf-viewer/layout/FloatingPanelsSection.tsx` — import `TextOverrideDialog` + `<TextOverrideDialog />` rendered at end of desktop branch (always mounted, internally hidden when store.isOpen=false).
  - **MOD** `src/subapps/dxf-viewer/app/useDxfViewerCallbacks.ts` — static import `openDimTextOverride`; action handler for `'dim.text.override'` reads `params.selectedEntityIds[0]` and calls `openDimTextOverride(entityId)`.
  - **MOD** `src/subapps/dxf-viewer/ui/ribbon/data/contextual-dimension-tab.ts` — added 3rd row to Panel C "Κείμενο": `{ type:'simple', command:{ id:'dim.text.override', labelKey:'ribbon.commands.dimTextOverride', icon:'dim-text-override', commandKey: DIM_RIBBON_KEYS.text.override, action:'dim.text.override' } }`.
  - **MOD** `src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/dim-command-keys.ts` — added `override: 'dim.text.override'` to `DIM_RIBBON_KEYS.text` group.
  - **MOD** `src/subapps/dxf-viewer/ui/ribbon/components/buttons/RibbonButtonIcon.tsx` — added `Type` to lucide-react import; added `case 'dim-text-override': return <Type …/>`.
  - **MOD** `src/i18n/locales/el/dxf-viewer-shell.json` + `en/dxf-viewer-shell.json` — `ribbon.commands.dimTextOverride` key (Παράκαμψη Κειμένου / Text Override).
  - **MOD** `src/i18n/locales/el/dxf-viewer-panels.json` + `en/dxf-viewer-panels.json` — `panels.dimensions.textOverride` block: dialogTitle, mode.{measured,prefixSuffix,free}, placeholderPrefix, placeholderSuffix, placeholderFree, preview, previewMeasured, previewEmpty, noEntitySelected, cancel, apply.
  - **Next**: Phase G3 — Alternate Units + Inspection dimension. ✅ DONE 2026-05-18.

- **2026-05-18 (Phase G2 DONE — Tolerance + Limits stacked rendering; 14 new formatter tests + 3 renderer tests PASS; 35 total.)** — `composeFullDimText()` added to `dim-text-formatter.ts` returning a `FullDimText` interface (primary + optional tolerancePlus/toleranceMinus or limitsUpper/limitsLower). `dim-text-renderer.ts` extended with `buildFullText()` + two private helpers (`drawToleranceStack`, `drawLimitsStack`) handling visual stacking. DIMTOLJ (`'bottom'|'middle'|'top'`) controls vertical alignment of tolerance block vs primary. DIMLIM overrides DIMTOL when both flags true (AutoCAD parity). Angular and radial dims keep their existing single-text path (tolerance/limits on radial = rare, deferred). File sizes remain ≤500 LOC.
  - **MOD** `src/subapps/dxf-viewer/systems/dimensions/dim-text-formatter.ts` — Added `FullDimText` interface (exported) + `composeFullDimText(valueMm, style, userText?)` public function. DIMLIM takes precedence when both `dimlim` and `dimtol` are true. Returns plain `{ primary }` when neither flag is set.
  - **MOD** `src/subapps/dxf-viewer/rendering/entities/dimension/dim-text-renderer.ts` — Import extended with `composeFullDimText`, `FullDimText`, `DimToleranceJustify`. `renderDimensionText` refactored: angular path preserved as-is (no tolerance G2), linear/radial path delegates to `buildFullText()` then branches on `limitsUpper` / `tolerancePlus` / plain. `drawLimitsStack` draws upper+lower at `dimtxt × 0.75` (fixed ratio, limits convention). `drawToleranceStack` draws primary at full `dimtxt`, ± lines at `dimtxt × dimtfac`, with `primaryOffsetY` driven by `dimtolj` ('bottom'/'middle'/'top').
  - **NEW** `src/subapps/dxf-viewer/systems/dimensions/__tests__/dim-text-formatter.test.ts` (~175 LOC) — 14 tests in 5 suites: `formatToleranceText` (3), `formatLimitsText` (2), `composeFullDimText — plain` (3), `composeFullDimText — tolerance` (3), `composeFullDimText — limits` (3). **14/14 PASS**, ~6s.
  - **MOD** `src/subapps/dxf-viewer/rendering/entities/__tests__/DimensionRenderer.test.ts` — Added suite `DimensionRenderer — tolerance + limits rendering (Phase G2)`: 3 tests (tolerance mode = 3 fillText, limits mode = 2 fillText, DIMLIM override). **21/21 PASS** (was 18), ~8s.
  - **Next**: Phase G3 — Alternate Units + Inspection dimension. ✅ DONE 2026-05-18.

- **2026-05-18 (Phase G3 DONE — Alternate Units + Inspection dimension marker; 4 new formatter tests + 4 renderer tests PASS; 43 total.)** — `renderDimensionText` extended with two new visual layers. Alternate units (`dimalt=true`): `formatAlternateUnit()` (Phase A3) wired into the renderer — draws `[value]` on a second line below the primary stack at `dimtxt × dimtfac` height. Inspection marker (`dimInspect !== 'off'`): ASME-style pill oval (two `arc()` semicircle caps + `lineTo()` straight edges) drawn before the text so the label renders on top; vertical divider separates measurement from rate label (`0%` / `100%` / custom); `ctx.measureText` used when available, falls back to character-count estimate in test/mock contexts.
  - **MOD** `src/subapps/dxf-viewer/rendering/entities/dimension/dim-text-renderer.ts` (230 → 322 LOC) — import `formatAlternateUnit` + `DimInspectionMode`. Two new private helpers: `drawAltUnit` (second-line below main stack), `drawInspectionMarker` (pill outline + divider + rate fillText).
  - **MOD** `src/subapps/dxf-viewer/systems/dimensions/__tests__/dim-text-formatter.test.ts` — Added `formatAlternateUnit` suite (4 tests: null when off, `[value]` wrapping, dimapost suffix, dimaltrnd rounding). **18 tests / 5 suites total**.
  - **MOD** `src/subapps/dxf-viewer/rendering/entities/__tests__/DimensionRenderer.test.ts` — Added suite `Phase G3` (4 tests). **25/25 PASS** (was 21), ~5s.
  - **Group G CLOSED.** Next: Phase H1 — DIMSTYLE table DXF export. ✅ DONE 2026-05-18.

- **2026-05-18 (Phase H1 DONE — DIMSTYLE table roundtrip writer; 24/24 tests PASS.)** — TypeScript-side DXF DIMSTYLE table writer following the `dxf-layer-table-writer.ts` pattern. NOT a production exporter (production = ezdxf Python microservice). Purpose: in-process roundtrip integrity test (write `DimStyle` → tokenised `string[]` → `parseDimStyles()` re-read → verify key rendering fields survive). Zero production code changes.
  - **NEW** `src/subapps/dxf-viewer/utils/dxf-dimstyle-writer.ts` (~195 LOC) — `writeDimStyleTable(styles: ReadonlyArray<DimStyle>): string[]` emitting 65 DXF group codes per style (codes 2, 40-48, 70, 71-79, 140-148, 170-179, 270-289, 340-344, 371-372). Enum-to-integer lookup maps for `DimLinearUnitFormat` (1-6), `DimAngularUnitFormat` (0-4), `DimTextVerticalPlacement` (0-4), `DimToleranceJustify` (0/1/2). DIMTM stored negative in `DimStyle` → emitted as positive absolute value (AutoCAD spec). DIMDSEP char → ASCII code (46/44). Nestor-internal fields (id, isBuiltIn, paperTextHeight, etc.) skipped.
  - **MOD** `src/subapps/dxf-viewer/utils/dxf-parser-types.ts` (157 → 285 LOC) — `DimStyleEntry` interface expanded from 4 to 42 fields covering all rendering-relevant DXF DIMSTYLE variables. `DEFAULT_DIMSTYLE` expanded with defaults for all 42 fields (AutoCAD "Standard" defaults).
  - **MOD** `src/subapps/dxf-viewer/utils/dxf-table-parsers.ts` (~220 → 330 LOC) — `parseDimStyles()` extended: 45 new `case` branches for all DXF group codes emitted by the writer. `finalizeDimStyleEntry()` helper added (DRY — replaces duplicated inline object literal at ENDTAB + new-entry boundaries). Bug fix: code 283 (DIMTOLJ) used `parseInt() || 1` which treated valid value `0` as falsy → changed to `Number.isNaN` guard.
  - **NEW** `src/subapps/dxf-viewer/utils/__tests__/dxf-dimstyle-writer.test.ts` (~200 LOC) — 24 tests in 3 suites: structure (5: markers, empty array, count, names, code-70), field values (10: dimscale, dimtxt, dimtfac, boolean flags, decimal separator, DIMTOLJ enum, DIMLUNIT enum, DIMTM absolute), roundtrip (9: style in map, dimtxt/dimscale/dimtfac/dimtol/dimlunit/dimdsep/dimtolj values survive, multi-style map). **24/24 PASS**, ~7s.
  - **Architecture note**: `dxf-dimension-converter.ts` NOT modified in H1 — DIMENSION entity writer follows in H2/H3 as `dxf-dimension-writer.ts` (same SRP pattern as this file). ADR file list updated accordingly.
  - **Next**: Phase H2 — DIMENSION entity writer for linear/aligned/rotated/angular dim types. ✅ DONE 2026-05-18.

- **2026-05-18 (Phase H2 DONE — DIMENSION entity writer for H2 types; 44/44 tests PASS.)** — TypeScript-side DXF DIMENSION entity section writer. Same SRP + SECTION/ENDSEC pattern as `dxf-dimstyle-writer.ts`. NOT a production exporter — purpose is in-process inspect-by-group-code roundtrip (a full reverse DIMENSION parser is out of H2/H3 scope).
  - **NEW** `src/subapps/dxf-viewer/utils/dxf-dimension-writer.ts` (~240 LOC) — `writeDimensionSection(entries: ReadonlyArray<DimensionWriterEntry>): string[]`. Exports `DimensionWriterEntry { entity, styleName }`. H2 types implemented: linear (flag 0) → `AcDbAlignedDimension` + `AcDbRotatedDimension` + code 50 rotation; aligned (flag 1) → `AcDbAlignedDimension` (no code 50); angular2L (flag 2) → `AcDb2LineAngularDimension`, codes 13/23/14/24/15/25/16/26 (5 defPoints); angular3P (flag 5) → `AcDb3PointAngularDimension`, codes 13/23/14/24/15/25/16/26 (4 defPoints). Common header: `AcDbEntity` (layer code 8) + `AcDbDimension` (block name `*D{i}`, ref point 10/20/30, text midpoint 11/21/31, type flag 70, text override code 1, style name code 3, measurement code 42, optional text rotation code 53). H3 types (radius/diameter/ordinate/arcLength/joggedRadius/baseline/continued) emit DXF comment placeholder `code 9`.
  - `resolveRefPoint()`: linear/aligned/baseline/continued → defPoints[2]; angular2L → defPoints[4]; angular3P → defPoints[3]; default → defPoints[0].
  - `resolveTextCode1()`: `undefined`/`'<>'` → `''` (AutoCAD "use measured value"); anything else → passthrough.
  - `emitPt()` helper: emits X (codeY−10), Y (codeY), Z=`'0.0'` (codeY+10) for 2D DXF.
  - **NEW** `src/subapps/dxf-viewer/utils/__tests__/dxf-dimension-writer.test.ts` (~300 LOC) — 44 tests in 7 suites: structure (12: SECTION/ENTITIES/ENDSEC wrapping, empty array, entity count, AcDbEntity/AcDbDimension markers, block indices *D0/*D1, style name, layer, measurement, text rotation optional), code-1 text override (3: undefined/`<>`/custom), linear type-0 (9: flag, subclasses, defPoints 13/23/14/24, rotation code 50, ref point 10/20), aligned type-1 (6: flag, subclass, no AcDbRotated, no code 50, defPoints), angular2L type-2 (7: flag, subclass, 5 defPoint codes + fallback), angular3P type-5 (5: flag, subclass, 4 defPoint codes), H3 placeholder (2: radius + ordinate code-9). **44/44 PASS**, ~3s. Fix applied: `findAllCodes`/`findCode` helpers step by 2 (even indices only) to avoid false-positive match when a value `'50'` appears as measurementValue.
  - **Next**: Phase H3 — DIMENSION entity writer for radius, diameter, ordinate, arcLength, joggedRadius, baseline, continued + Defpoints non-plot layer (flags: 4/3/6/+bit32/+bit64) in `dxf-dimension-writer.ts`. ✅ DONE 2026-05-18.

- **2026-05-18 (Phase I1 DONE — Snap def-point + dim-line modes.)** — `DIM_DEF_POINT` + `DIM_LINE` snap modes added to the enterprise snap system. All 11 dimension types covered.
  - **NEW** `src/subapps/dxf-viewer/snapping/engines/DimDefPointSnapEngine.ts` (~75 LOC) — `ExtendedSnapType.DIM_DEF_POINT`. Indexes all `defPoints[]` of `DimensionEntity` instances via `initializeSpatialIndex`. Mirrors AutoCAD OSMODE DIMSNAP bit: cursor locks to exact extension-line origins, arc centres, angle vertices. Priority: `DIM_DEF_POINT = 2` (equivalent to INSERTION — exact defined point). Tolerance: 10px.
  - **NEW** `src/subapps/dxf-viewer/snapping/engines/DimLineSnapEngine.ts` (~110 LOC) — `ExtendedSnapType.DIM_LINE`. Indexes `textMidpoint` + type-specific dim-line reference point per variant (linear/aligned/baseline/continued → defPoints[2]; angular2L → defPoints[4]; angular3P → defPoints[3]; radius/diameter → midpoint of the two endpoint defPoints; ordinate → `datum`; arcLength → center; joggedRadius → jogPoint defPoints[2]). Prevents duplicate indexing when textMidpoint equals refPt. Priority: `DIM_LINE = 3`. Tolerance: 10px.
  - **MOD** `src/subapps/dxf-viewer/snapping/extended-types.ts` — `ExtendedSnapType` enum: +`DIM_DEF_POINT = 'dim_def_point'`, +`DIM_LINE = 'dim_line'`. `DEFAULT_PRO_SNAP_SETTINGS`: both added to `enabledTypes`, `priority` array (after CONSTRUCTION_POINT, before GRID), `perModePxTolerance` (10px each).
  - **MOD** `src/subapps/dxf-viewer/config/tolerance-config.ts` — `SNAP_ENGINE_PRIORITIES`: +`DIM_DEF_POINT: 2`, +`DIM_LINE: 3`.
  - **MOD** `src/subapps/dxf-viewer/snapping/orchestrator/SnapEngineRegistry.ts` — `initializeEngines()`: registers `DimDefPointSnapEngine` + `DimLineSnapEngine`.
  - **MOD** `src/subapps/dxf-viewer/snapping/SnapPresets.ts` — Architectural preset: +`DIM_DEF_POINT` (8px tolerance). Engineering preset: +`DIM_DEF_POINT` + `DIM_LINE` (8px each). Simple preset: unchanged.
  - **TypeScript**: `tsc --noEmit` exit 0 (no new errors).
  - **Next**: Phase I2 — Grip editing (5 grips per dim). ✅ DONE 2026-05-18.

- **2026-05-18 (Phase I2 DONE — Grip editing: 5 grips per DimensionEntity, full drag commit.)** — AutoCAD-style grip editing wired into the unified grip system for all 10 `DimensionType` variants.
  - **NEW** `src/subapps/dxf-viewer/hooks/dimensions/useDimensionGrips.ts` (~155 LOC) — two public exports: `getDimensionGrips(entity: DxfDimension): GripInfo[]` (5 grips: ext-line-origin-1/2, dim-line-ref, text-midpoint, type-specific extra) + `applyDimensionGripDrag(kind, dimEntity, delta, gripPos): DimensionEntity` (pure immutable transform). Internal helpers: `patchDefPoint`, `resolveTextMidpoint`, `extraGripPos`, `applyExtraGripDrag`. `dim-extra` routing: linear → rotation angle via `atan2(cursor − dimLineRef)`; aligned → offset defPoints[2]; radius/diameter → arcPoint defPoints[1]; angular2L → arcPoint defPoints[4]; angular3P → arcPoint defPoints[3]; ordinate → datum point; arcLength/joggedRadius → jogPoint defPoints[2]; baseline/continued → newExtOrigin defPoints[0].
  - **MOD** `src/subapps/dxf-viewer/hooks/grip-types.ts` — `DimensionGripKind` union type added (`dim-defpoint-0`, `dim-defpoint-1`, `dim-line-ref`, `dim-text`, `dim-extra`); `dimGripKind?: DimensionGripKind` field added to `GripInfo`.
  - **MOD** `src/subapps/dxf-viewer/hooks/useGripMovement.ts` — `DimensionGripKind` added to re-exports.
  - **MOD** `src/subapps/dxf-viewer/hooks/grip-computation.ts` — `case 'dimension':` added to `computeDxfEntityGrips` switch → calls `getDimensionGrips(entity)`.
  - **MOD** `src/subapps/dxf-viewer/hooks/grips/unified-grip-types.ts` — `DimensionGripKind` imported + `dimGripKind?: DimensionGripKind` field added to `UnifiedGripInfo`.
  - **MOD** `src/subapps/dxf-viewer/hooks/grips/grip-registry.ts` — `wrapDxfGrip`: `dimGripKind` forwarded alongside existing `stairGripKind`.
  - **MOD** `src/subapps/dxf-viewer/hooks/grips/grip-commit-adapters.ts` (~475 → 500 LOC) — `commitDimensionGripDrag` + imports added; `commitDxfGripDragModeAware` early-branches on `grip.dimGripKind` (mirrors stair path). `sceneManager.updateEntity` patches `dimensionEntity` in-place; identity check skips no-op drags.
  - **Next**: Phase I3 — ✅ DONE 2026-05-18.

- **2026-05-18 (Phase J1+J2 DONE — Dimension Associativity: inverse graph + observer + DimReassociate command.)** — `DimensionEntity.defPoints` now auto-follow geometry after every command execute/undo/redo.
  - **NEW** `src/subapps/dxf-viewer/systems/dimensions/dim-association-graph.ts` (~55 LOC) — `DimAssociationGraph`: inverse index `geometryId → Set<dimensionId>`. Methods: `rebuild(dims)` (clear + O(n×k) scan), `getDimIds(geometryId)` (returns `[]` not undefined), `has(geometryId)`, `size`. No React/Firestore deps.
  - **NEW** `src/subapps/dxf-viewer/systems/dimensions/dim-association-service.ts` (~130 LOC) — Two pure exported functions: `recomputeAssociatedDefPoint(assoc, entity): Point2D | null` (dispatches on `associationType`: endpoint→line start/end or polyline vertex, midpoint→midpoint, center→circle/arc center, intersection/nearest→null=preserve); `applyAssociationUpdates(dim, getEntity): { updated, orphanCount }` (immutable defPoints patch, same-reference return when nothing changed). Uses `isLineEntity`/`isPolylineEntity`/`isCircleEntity`/`isArcEntity` type guards.
  - **NEW** `src/subapps/dxf-viewer/hooks/dimensions/useDimAssociationObserver.ts` (~80 LOC) — React hook. Holds `DimAssociationGraph` in `useRef`. Subscribes to `getGlobalCommandHistory()`. On every execute/undo/redo: rebuild graph, walk all dims with `associations[]`, call `applyAssociationUpdates`, batch-commit via `LevelSceneManagerAdapter.updateEntities`. Tracks `orphanedDimIds` state (dims whose geometry no longer exists — last-known position preserved). Equality guard on orphan array prevents unnecessary re-renders.
  - **NEW** `src/subapps/dxf-viewer/core/commands/entity-commands/DimReassociateCommand.ts` (~90 LOC) — `DimReassociateCommand implements ICommand`. Re-links a specific `associations[i].geometryId` to a new entity. `execute`: snapshot previous geometryId+defPoint, update association, call `recomputeAssociatedDefPoint`, commit via `sceneManager.updateEntity`. `undo`: restore previous geometryId+defPoint. Full undo/redo support.
  - **MOD** `src/subapps/dxf-viewer/app/DxfViewerContent.tsx` (+2 lines) — `useDimAssociationObserver(levelManager.getLevelScene, levelManager.setLevelScene, () => levelManager.currentLevelId)` called alongside other viewer-level hooks.
  - **K1 DONE (2026-05-18)**: `systems/dimensions/dim-break-engine.ts` — pure DIMBREAK engine, auto + manual modes, gap splitting via `GeometricCalculations.getLineIntersection`.
  - **K2 DONE (2026-05-18)**: `systems/dimensions/dim-space-engine.ts` — DIMSPACE engine, auto/custom/align modes, perpendicular-offset projection for linear/aligned dims.
  - **K3 DONE (2026-05-18)**: `dim-text-renderer.ts` + `DimensionRenderer.ts` — DIMTFILL background mask (none/backgroundColor/customColor), `setSceneEntities()` seam for auto DIMBREAK at render time.
  - Ribbon: Panel E "Τροποποίηση" added to contextual tab (DIMBREAK + DIMSPACE buttons, comingSoon). DIMTFILL toggle in Panel C.
  - **Next**: Phase L1 — Center Marks bundled (DIMCEN, radial dims).

- **2026-05-18 (Phase L1+L2 DONE — Center Marks bundled + standalone tool.)** — DIMCEN geometry computed and rendered for radial/diameter dims; standalone CenterMark + Centerline tools in ribbon.
  - **MOD** `systems/dimensions/dim-geometry-builder.ts` — `RadialDimGeometry` +`centerPoint?: Point2D` field (carries circle center for L1 renderer).
  - **MOD** `systems/dimensions/builders/radial-builder.ts` — all 4 builders (`buildRadiusGeometry`, `buildDiameterGeometry`, `buildArcLengthGeometry`, `buildJoggedRadiusGeometry`) set `centerPoint`.
  - **NEW** `systems/dimensions/center-mark-builder.ts` — `computeCenterMarkGeometry(center, radius, dimcen, dimscale)`: DIMCEN > 0 → cross only; DIMCEN < 0 → cross + 4 extension lines beyond circle boundary; DIMCEN = 0 → empty.
  - **NEW** `systems/dimensions/center-mark-renderer.ts` — `renderCenterMark(ctx, geometry, dimclrd, transform, layerColour)`: strokes cross + extension lines with DIMSTYLE colour.
  - **MOD** `rendering/entities/DimensionRenderer.ts` — `drawCenterMark()` called in `render()` after arrowheads; checks `geometry.kind === 'radial'` + `centerMarkExtent` + `centerPoint`.
  - **MOD** `ui/ribbon/data/home-tab-dimensions.ts` — new split button row: primary "Σταυρός Κέντρου" (`dim-center-mark`) + variant "Κεντρική Γραμμή" (`dim-centerline`).
  - **MOD** `ui/toolbar/types.ts` — `ToolType` +`'dim-center-mark'` + `'dim-centerline'`.
  - **NEW** `hooks/dimensions/useCenterMarkCreate.ts` — state machine: single-click → `CenterMarkEntity`, 2-click → `CenterLineEntity`. Style from active DIMSTYLE `dimcen`.
  - **MOD** `hooks/drawing/useDrawingHandlers.ts` — `useCenterMarkCreate` wired alongside `useDimToolRouting` (click/hover/cancel routing).
  - **MOD** `i18n/locales/el/dxf-viewer-shell.json` + `en/` — `dimCenterMark` + `dimCenterLine` keys (ribbon commands + action labels).
  - **Next**: Phase M1 — Tolerance stacking (DIMTOL/DIMLIM).

- **2026-05-18 (Phase M1 DONE — Dimension right-click context menu.)** — Full 9-action contextual menu per ADR-362 §D14.
  - **NEW** `src/subapps/dxf-viewer/ui/context-menus/DimensionContextMenu.tsx` — `forwardRef` component with `useImperativeHandle` handle (imperative open/close, ADR-040 micro-leaf compliant). 9 actions: Precision submenu (5 levels, 0–0.0000 decimals), Flip Arrows, Reset Text, Text Override, Apply Style submenu (dynamic DIMSTYLE list), Reassociate, Explode (window.confirm guard), Cut/Copy/Paste/Delete (with `Ctrl+X/C/V/Del` shortcuts), Properties. Shares `DrawingContextMenu.module.css` — no new styles needed.
  - **MOD** `src/subapps/dxf-viewer/hooks/canvas/useCanvasContextMenu.ts` — `UseCanvasContextMenuParams` +`dimContextMenuRef?: RefObject<DimensionContextMenuHandle>` + `selectedDimensionIds?: readonly string[]`. PRIORITY 1.5 routing: `select` mode + `selectedDimensionIds.length > 0` → opens dim menu before entity menu. Wiring into `CanvasSection.tsx` (mount + pass props) is caller responsibility at commit time.
  - **MOD** `src/i18n/locales/el/dxf-viewer-shell.json` + `en/` — `ribbon.commands.dimContextMenu.*` (18 keys: precision, flipArrows, resetText, textOverride, applyStyle, reassociate, explode, explodeWarning, cut, copy, paste, delete, properties, 5 precision level labels).
  - **Next**: Phase N1 — Field parser + tokenizer (DIESEL `<token>` expressions).

- **2026-05-18 (Phase N1-N4 DONE — Field tokens + DIESEL expression engine + autocomplete UI.)** — Full D15 implementation: field token parser, evaluator, and power-user editor UI.
  - **NEW** `src/subapps/dxf-viewer/systems/dimensions/dim-text-field-parser.ts` (~115 LOC) — Tokenizer + AST for dimension `userText` field syntax. Parses `<>` → `MeasurementPlaceholder`, `<tokenName>` → `FieldToken` (12 tokens: measurement/length/area/angle/perimeter/x/y/scale/filename/date/time/author), `$(op,...)` → `DieselExpr` (nested paren-aware), everything else → `Literal`. `FieldAST = ReadonlyArray<FieldNode>`. Zero React, zero side effects. Exports: `parseFieldAST`, `FIELD_TOKEN_NAMES`, `hasFieldSyntax`, `extractFieldNodes`.
  - **NEW** `src/subapps/dxf-viewer/systems/dimensions/dim-text-field-evaluator.ts` (~195 LOC) — N2+N3 combined: token resolvers + DIESEL math/string/conditional engine. `FieldEvalContext` carries measurementValue, style, date, area, length, angle, perimeter, x/y, scale, filename, author. Token resolvers reuse `formatLinearMeasurement` from Phase A3. DIESEL ops: `$(+/-/*//)` arithmetic, `$(if,cond,then,else)` conditional, `$(fmt,val,fmt)` number formatting, `$(strlen,s)`, `$(substr,s,start,len)`, `$(upper/lower/strcat)`. Fully recursive via `splitDieselArgs` (nested paren + quote-aware splitter). Entry: `evaluateFieldAST(ast,ctx)` + `evaluateFieldText(text,ctx)`.
  - **MOD** `src/subapps/dxf-viewer/ui/panels/dimensions/TextOverrideEditor.tsx` — N4: `FieldTokenInput` sub-component added (wraps `Input`, shows token autocomplete dropdown when user types `<`, keyboard nav: ArrowUp/Down/Enter/Tab/Escape, `insertToken` with cursor restoration via `setSelectionRange`). `ColoredPreview` sub-component: renders parser AST with colored spans (field tokens = blue, DIESEL = orange, literals = plain). Applied to all text inputs (prefix, suffix, free). Field hint shown in edit modes.
  - **NEW** `src/subapps/dxf-viewer/ui/panels/dimensions/TextOverrideEditor.module.css` — Autocomplete dropdown styles (popover-themed, Radix-compatible vars), suggestion item hover/active states, `.fieldToken` (blue) + `.dieselToken` (orange) classes.
  - **MOD** `src/i18n/locales/el/dxf-viewer-panels.json` + `en/` — `panels.dimensions.textOverride.fieldHint` + `panels.dimensions.textOverride.fieldTokens.*` (12 token descriptions in Greek + English).
  - **Next**: Phase O1 — Test suite for builders + renderer.

- **2026-05-18 (Phase O2 DONE — Orchestrator dispatch + Associativity tests; 46 tests PASS.)** — Three new test files covering the `buildDimensionGeometry` orchestrator and the full J1/J2 associativity pipeline.
  - **NEW** `systems/dimensions/__tests__/dim-geometry-builder.test.ts` — 12 tests: `buildDimensionGeometry` dispatch for all 11 DimensionType variants (linear/aligned → `kind=linear`; angular2L/angular3P → `kind=angular`; radius/diameter/arcLength/joggedRadius → `kind=radial`; ordinate → `kind=linear`; baseline/continued via lookup → `kind=linear`); throws with entity id for unknown type. **12/12 PASS**.
  - **NEW** `systems/dimensions/__tests__/dim-association-graph.test.ts` — 10 tests: empty state, rebuild with no-assoc dims, single-dim index, `getDimIds` found/missing, `has()` true/false, size counts distinct geos (not dims), rebuild clears stale state, undefined associations handled. **10/10 PASS**.
  - **NEW** `systems/dimensions/__tests__/dim-association-service.test.ts` — 24 tests across 6 suites: `recomputeAssociatedDefPoint` (endpoint line start/end/undefined/polyline-clamp/mismatch, midpoint line/polyline/mismatch, center circle/arc/mismatch, intersection→null, nearest→null); `applyAssociationUpdates` (no-assoc same-ref, undefined-assoc same-ref, orphan preserve+count, updated-geo new entity, same-position identity guard, multi-assoc batch update, mix orphan+updated). **24/24 PASS**.
  - **Note**: `utils/__tests__/dxf-dimension-writer.test.ts` already ships 72/72 tests (H2+H3, all 11 variants, group-code roundtrip verification) — no new DXF writer tests needed for O2.
  - **Next**: Phase O3 — Fields passthrough + formatter edge-case tests + ADR finalize. ✅ DONE 2026-05-18.

- **2026-05-18 (Phase O3 DONE — Field token passthrough + formatter edge-case tests + ADR finalized; 14 tests PASS. Group O CLOSED. ADR-362 FULLY IMPLEMENTED.)** — Terminal phase of the ADR-362 test suite.
  - **NEW** `systems/dimensions/__tests__/dim-text-formatter-fields.test.ts` — 14 tests in 2 suites: `composePrimaryText — field token passthrough` (8 tests: all 12 known tokens in `FIELD_TOKEN_NAMES` pass verbatim; `<>` adjacent to token only substitutes `<>`; DIESEL expression verbatim; nested DIESEL verbatim); `composeFullDimText — edge cases` (6 tests: zero measurement → 0.00, negative measurement → formatted, field token with DIMTOL — primary is token + tolerances computed, field token with DIMLIM — primary is token + limits computed, very large measurement no overflow, dimlfac scaling). **14/14 PASS**.
  - **ADR finalized**: Status → ✅ IMPLEMENTED, §1 summary updated with test count, §10 Smoke Test Checklist added.
  - **MEMORY.md updated**: `project_adr362_dimension_system.md` → ADR-362 FULLY IMPLEMENTED.
  - **Group O CLOSED. ADR-362 FULLY IMPLEMENTED 2026-05-18.**

- **2026-05-18 (Phase O1 DONE — Test suite for new dimension systems: 5 suites, 95 tests, all PASS.)** — GOL-grade test coverage for all Phase K1/K2/L1/N1/N2+N3 systems.
  - **NEW** `systems/dimensions/__tests__/dim-text-field-parser.test.ts` — 30 tests (3 suites): `parseFieldAST` (20 cases: empty, `<>`, all 12 known tokens, unknown token → Literal, DIESEL expr, nested DIESEL, mixed prefix/suffix/text, unclosed `<`); `hasFieldSyntax` (5 cases); `extractFieldNodes` (2 cases).
  - **NEW** `systems/dimensions/__tests__/dim-text-field-evaluator.test.ts` — 34 tests (6 suites): Literal passthrough; `<>` MeasurementPlaceholder; FieldToken resolvers (measurement/length/area/angle/x/y/scale/filename/author/date/time + missing optional fields → ""); DIESEL ops (`+/-/*//, if, fmt, strlen, substr, upper, lower, strcat`, nested `$(+,$(+,1,2),3)`); mixed expressions; `evaluateFieldText` wrapper. Bug fixed: `applyFmt` was using `parseInt('00')=0` instead of `.length` for decimal count.
  - **NEW** `systems/dimensions/__tests__/center-mark-builder.test.ts` — 12 tests (3 suites): `dimcen=0` → empty; `dimcen>0` → 2 crossLines only; `dimcen<0` → 2 crossLines + 4 extLines; arm length = `abs(dimcen)*dimscale`; extLine positions at circle edge ± arm length; arbitrary center offset.
  - **NEW** `systems/dimensions/__tests__/dim-break-engine.test.ts` — 11 tests (2 suites): `computeAutoBreaks` (breakGap=0, no crossings, crossing LINE at midpoint → 2 segments, two crossings → 3 segments, null extLine, ordinate kind → {}); `computeManualBreaks` (breakGap=0, empty input, break at midpoint, break at extLine).
  - **NEW** `systems/dimensions/__tests__/dim-space-engine.test.ts` — 8 tests (4 suites): empty targets, unsupported type (angular) skipped, insufficient defPoints; `align` mode collapses to base offset; `custom` mode shifts target by spacing; target between base and origins; target already at correct position → not in result; `auto` mode uses `2×paperTextHeight`; multiple targets + angular filtering.
  - **Next**: Phase O2 — DXF round-trip + Associativity tests.

- **2026-05-18 (Phase I3 DONE — Geometry-aware hit-testing for DimensionEntity; click-select now works.)** — `DimensionEntity` wired into all three layers of the hit-testing pipeline.
  - **MOD** `src/subapps/dxf-viewer/services/HitTestingService.ts` — `DxfDimension` added to imports; new `case 'dimension'` in `convertToEntityModel`: spreads `dxfDim.dimensionEntity` (brings `defPoints`, `textMidpoint`, `dimensionType`) then overrides base fields (`id/layer/color/visible/selected`) from the scene-resolved `baseModel`. This promotes a `DimensionEntity` into the spatial index so broad-phase bounds are populated.
  - **MOD** `src/subapps/dxf-viewer/rendering/hitTesting/Bounds.ts` — `BoundsCalculator.calculateEntityBounds`: new `case 'dimension'` dispatches to `calculateDimensionBounds` (private). `calculateDimensionBounds`: collects all `defPoints` + `textMidpoint` into a points array, computes AABB → returns inflated `BoundingBox`. Missing `defPoints` or empty array → returns `null` (graceful skip).
  - **MOD** `src/subapps/dxf-viewer/rendering/hitTesting/hit-test-entity-tests.ts` — `DimensionEntity` imported; new `case 'dimension'` in `performDetailedHitTest` dispatches to `hitTestDimension`. `hitTestDimension` (new, ~50 LOC): tests (1) text label proximity (circle tolerance×1.5 around `textMidpoint`), (2) extension lines as `pts[0]→pts[2]` and `pts[1]→pts[2]` (linear/aligned/angular variants), (3) dimension line as `pts[0]→pts[1]`, (4) proximity to any individual defPoint. Reuses existing `pointToLineDistance`, `closestPointOnLine`, `calculateDistance` helpers — zero new deps.
  - **Note**: Phase I4 (canvas rendering) was already done in Phase C1 — `DimensionRenderer` registered in `EntityRendererComposite` (`renderers.set('dimension', dimensionRenderer)`) + `buildDimensionLookup` in `DxfRenderer`. No further work needed.
  - **Next**: Phase J1+J2 — Dimension Associativity. ✅ DONE 2026-05-18.

- **2026-05-18 (HOTFIX — 2-press Escape: escape reactivation lock in ToolStateStore)** — Root cause identified via debug accordion logs: after ESC #1 correctly sets `toolStateStore.activeTool='select'`, a `RibbonSplitDropdown` button `onClick` event (likely queued from a prior user interaction) fires and calls `handleSelect → onToolChange('dim-aligned') → setActiveTool → selectTool('dim-aligned')`, re-activating the just-escaped tool. ESC #2 was then needed to cancel again.
  - **Root cause**: `RibbonSplitDropdown` button `onClick` (line 114) can fire as a separate browser task *after* the ESC `keydown` task has already processed, at which point `current.activeTool` is already `'select'`. The `selectTool('dim-aligned')` guard (`if current.activeTool === tool return`) does NOT block it because the store is at `'select'`, not `'dim-aligned'`.
  - **Fix — escape reactivation lock**: `ToolStateStore.ts` — added module-level `escapedTool: ToolType | null` + `escapeExpiresAt: number`. In `handleToolCompletion(tool, forceDeselect=true)`: sets `escapedTool = tool` + `escapeExpiresAt = Date.now() + UI_TIMING.ESCAPE_REACTIVATION_LOCK` (200 ms) before notifying listeners. In `selectTool(tool)`: added early-return guard `if (tool === escapedTool && Date.now() < escapeExpiresAt) return`. `reset()` clears both lock variables.
  - **Fix — `UI_TIMING.ESCAPE_REACTIVATION_LOCK` (200 ms)**: new constant added to `config/timing-config.ts`. 200 ms covers any queued click events without perceptibly delaying intentional re-activation by the user.
  - **Cleanup**: removed all `// 🔴 DEBUG ESC` `console.error` calls from `ToolStateStore.ts`, `useKeyboardShortcuts.ts`, `useDrawingHandlers.ts`, `useDimToolRouting.ts` (5 log statements total).
  - **Files changed** (5): `stores/ToolStateStore.ts`, `config/timing-config.ts`, `hooks/useKeyboardShortcuts.ts`, `hooks/drawing/useDrawingHandlers.ts`, `hooks/dimensions/useDimToolRouting.ts`.
  - **Verification**: 1 ESC press now exits any dim tool completely. No regression on intentional tool re-activation (200 ms lock window, well below human reaction time for re-clicking).

- **2026-05-18 (Phase H3 DONE — all 7 remaining DimensionType variants; 72/72 tests PASS.)** — Completes the DXF DIMENSION entity writer to cover all 11 variants (H2 + H3 = full coverage).
  - **MOD** `src/subapps/dxf-viewer/utils/dxf-dimension-writer.ts` (~240 → ~320 LOC) — H3 subclass emitters added: `emitRadiusSubclass` (flag 4 → `AcDbRadialDimension`, arcPoint via codes 15/25); `emitDiameterSubclass` (flag 3 → `AcDbDiametricDimension`, side2 via codes 15/25); `emitOrdinateSubclass` (flag 6 / 6|64=70 for Y-axis → `AcDbOrdinateDimension`, featurePoint via codes 13/23, leaderEnd via codes 14/24); `emitArcLengthSubclass` (flag 32 → `AcDbArcDimension`, center/arcStart/arcEnd via codes 13/14/15 + 23/24/25); `emitJoggedRadiusSubclass` (flag 36 = 4|32 → `AcDbRadialDimensionLarge`, jogVertex via 13/23, arcPoint via 15/25, jogPoint via 16/26); `emitBaselineSubclass` (flag 32 → `AcDbAlignedDimension`, newExtOrigin via 13/23); `emitContinuedSubclass` (flag 64 → `AcDbAlignedDimension`, newExtOrigin via 13/23). `resolveRefPoint()` extended: ordinate → `entity.datum` (the measured origin) instead of defPoints[0]. Placeholder `default` case removed — all 11 types explicitly handled. Imports extended to include all 7 H3 entity types.
  - **MOD** `src/subapps/dxf-viewer/utils/__tests__/dxf-dimension-writer.test.ts` (~440 → ~720 LOC) — H3 placeholder describe block removed (2 tests). 7 new describe blocks added (28 new tests): radius (4), diameter (4), ordinate (6: X/Y flag, subclass, featurePoint 13/23, leaderEnd 14/24, datum as ref point), arcLength (5), joggedRadius (5), baseline (3), continued (3). `entry()` helper signature updated: narrow union → `DimensionEntity` (removes need for `as never` casts). 7 fixture helpers added: makeRadius/makeDiameter/makeOrdinate/makeArcLength/makeJoggedRadius/makeBaseline/makeContinued. **72/72 PASS** (was 44/44 in H2).

- **2026-05-17 (Phase F1 DONE — left FloatingPanel 4° tab "Διαστάσεις" skeleton + DIMSTYLE Manager CRUD; 9/9 unit tests PASS.)** — 4th tab added to the left sidebar alongside Levels/Colors/Properties. DIMSTYLE list with active badge, built-in badge, set-active, duplicate, delete (AlertDialog confirm), and "New Style..." create flow. `getSnapshot()` added to `DimStyleRegistry` for stable `useSyncExternalStore` references (prevents infinite render loop). Create/Duplicate dialogs with name uniqueness validation. Edit stub = comingSoon (Phase F2 scope).
  - **MOD** `src/subapps/dxf-viewer/types/panel-types.ts` — `FloatingPanelType` union + `FLOATING_PANEL_TYPES` + `PANEL_METADATA` + `isFloatingPanelType` + `PANEL_LAYOUT.topRow` extended with `'dimensions'`. `PanelMetadata.iconName` extended with `'Ruler'`.
  - **MOD** `src/subapps/dxf-viewer/ui/components/PanelTabs.tsx` — `Ruler` icon imported, 4th tab `{id:'dimensions', icon:Ruler}` added.
  - **MOD** `src/subapps/dxf-viewer/ui/hooks/usePanelContentRenderer.tsx` — `case 'dimensions': return <DimensionsTab />`.
  - **MOD** `src/subapps/dxf-viewer/systems/dimensions/dim-style-registry.ts` — `DimStyleSnapshot` interface exported; `getSnapshot()` method added with `cachedSnapshot` (invalidated in `notify()`). Stable reference for `useSyncExternalStore` consumers.
  - **NEW** `src/subapps/dxf-viewer/ui/panels/dimensions/DimensionsTab.tsx` (~145 LOC) — root tab component. `useRegistrySnapshot()` uses `registry.getSnapshot()` via `useSyncExternalStore`. Create/Duplicate/Delete/SetActive handlers. `DeleteConfirmDialog` sub-component (Radix AlertDialog). `defaultStyleFields()` clones active style for new style defaults.
  - **NEW** `src/subapps/dxf-viewer/ui/panels/dimensions/DimStyleList.tsx` (~110 LOC) — presentational list. Per-row: style name, active badge, built-in badge, action buttons (setActive/duplicate/edit/delete) visible on hover. Built-in styles: no edit/delete buttons. `ActionButton` sub-component (icon + aria-label + hover).
  - **NEW** `src/subapps/dxf-viewer/ui/panels/dimensions/DimStyleCreateDialog.tsx` (~90 LOC) — modal dialog for create + duplicate modes. Real-time validation (empty name, duplicate name). `Enter` = confirm, `Escape` = cancel. Error shown in `role="alert"` `<p>`.
  - **MOD** `src/i18n/locales/el/dxf-viewer-panels.json` + `src/i18n/locales/en/dxf-viewer-panels.json` — `panels.dimensions` section: title, loading, styleManager, newStyle, duplicate, delete, edit, setActive, activeBadge, builtInBadge, emptyList, deleteConfirm.{title,description,confirm,cancel}, createDialog.{title,placeholder,confirm,cancel,errorEmpty,errorDuplicate}, duplicateDialog.{title,placeholder,confirm,cancel}.
  - **NEW** `src/subapps/dxf-viewer/ui/panels/dimensions/__tests__/DimensionsTab.test.tsx` (~175 LOC) — 9 tests: renders 3 built-ins, builtInBadge ×3, activeBadge ×1, create dialog open, create + list update, duplicate name validation, style selection, no delete for built-ins, delete custom + confirm. **9/9 PASS**, ~4s.
  - **No integration yet** (Phase F2 scope): Edit button = stub, no accordion sections (lines/symbols/text/fit/units/tolerances), no live preview.

- **2026-05-17 (Phase F2 DONE — accordion editor sections 1-3: Γραμμές, Σύμβολα, Κείμενο.)** — Edit button now wired: clicking Edit on a custom style switches DimensionsTab to edit-mode view (← Back button + style name header + DimStyleAccordion). AccordionSection (existing DXF-viewer SSoT pattern, `useAccordion`) used for collapsible sections. Live updates via `registry.updateCustomStyle` on every field change — re-renders via `useSyncExternalStore` snapshot chain. All 4 components accept `readOnly?: boolean` — built-in styles render with disabled inputs (no edit).
  - **NEW** `src/subapps/dxf-viewer/ui/panels/dimensions/DimStyleAccordion.tsx` (~37 LOC) — wrapper with 3 AccordionSection (Γραμμές open by default, Σύμβολα + Κείμενο closed). Props: `style`, `onChange`, `readOnly?`. Passes all 3 down to each section.
  - **NEW** `src/subapps/dxf-viewer/ui/panels/dimensions/sections/LinesSection.tsx` (~69 LOC) — 8 fields: dimasz, dimexe, dimexo, dimdli (number inputs, step 0.1 mm), suppressDimLine1/2, suppressExtLine1/2 (checkboxes). `NumField` + `BoolField` sub-components; both accept `disabled?` prop from `readOnly`.
  - **NEW** `src/subapps/dxf-viewer/ui/panels/dimensions/sections/SymbolsSection.tsx` (~67 LOC) — dimblk Select (19 arrowhead names; sets dimblk/dimblk1/dimblk2 simultaneously), dimcen number input. `disabled={readOnly}` on both controls.
  - **NEW** `src/subapps/dxf-viewer/ui/panels/dimensions/sections/TextSection.tsx` (~84 LOC) — dimtxt/dimgap (number inputs), dimtad (Select: 5 DimTextVerticalPlacement values), dimtih/dimtoh (checkboxes). `disabled={readOnly}` on all 5 controls.
  - **MOD** `src/subapps/dxf-viewer/ui/panels/dimensions/DimensionsTab.tsx` — `editingId` state, `handleEdit`/`handleStyleChange` callbacks, early-return edit-mode branch (ArrowLeft back button + style name + DimStyleAccordion). Edit button shown only for custom styles (`!style.isBuiltIn` guard in DimStyleList).
  - **MOD** `src/i18n/locales/el/dxf-viewer-panels.json` + `en/dxf-viewer-panels.json` — `panels.dimensions.editor` section: backButton, editingTitle, sections.{lines,symbols,text}, fields.{dimasz,dimexe,dimexo,dimdli,suppress*,dimblk,dimcen,dimtxt,dimtad,dimtih,dimtoh,dimgap}, dimtad.{centered,above,outside,jis,below}, dimblk.{19 names}.
  - **NEW** `src/subapps/dxf-viewer/ui/panels/dimensions/__tests__/DimStyleAccordion.test.tsx` (~145 LOC) — 8 tests: renders 3 sections, number input fires onChange, checkbox fires onChange, dimtad select fires onChange, dimblk fires onChange with dimblk1+dimblk2, readOnly=true disables spinbuttons, readOnly=true disables checkboxes, readOnly=false leaves inputs enabled.
  - **No integration yet** (Phase F3 scope): sections 4-6 (Προσαρμογή/Μονάδες/Ανοχές), live canvas preview.
  - **Next**: Phase F3 — sections 4-6 + DimStylePreview.

- **2026-05-17 (Phase F3 DONE — sections 4-6 + DimStylePreview + 12/12 tests PASS.)** — Three new accordion sections (Τοποθέτηση/Μονάδες/Ανοχές), SVG live preview at accordion top, 3 new DimStyle fields, 4 new tests (dimatfit/dimaunit/dimtolj selects + DimStylePreview render).
  - **NEW DimStyle fields** (added to `types/dimension.ts` + defaults in `dim-style-templates.ts`): `dimatfit: number` (0-3, arrowhead/text fit when space insufficient), `dimtmove: number` (0-2, text move rule), `dimzin: number` (zero suppression bitmask). Defaults: dimatfit=3 (best fit), dimtmove=0 (move with dim line), dimzin=0.
  - **NEW** `src/subapps/dxf-viewer/ui/panels/dimensions/sections/FitSection.tsx` (~100 LOC) — dimatfit (Select: 4 options), dimtmove (Select: 3 options), dimscale (number input, step 0.01), dimlunit (Select: 6 DimLinearUnitFormat values). All disabled when readOnly.
  - **NEW** `src/subapps/dxf-viewer/ui/panels/dimensions/sections/UnitsSection.tsx` (~100 LOC) — dimdec/dimrnd/dimlfac/dimzin/dimadec (number inputs), dimaunit (Select: 5 DimAngularUnitFormat values). Integer clamping on dimdec/dimadec (0-8), dimlfac fallback=1.
  - **NEW** `src/subapps/dxf-viewer/ui/panels/dimensions/sections/TolerancesSection.tsx` (~100 LOC) — dimtol/dimlim (checkboxes), dimtp/dimtm/dimtdec (number inputs), dimtolj (Select: 3 DimToleranceJustify values: bottom/middle/top).
  - **NEW** `src/subapps/dxf-viewer/ui/panels/dimensions/DimStylePreview.tsx` (~80 LOC) — Stateless SVG (160×80) showing a linear dimension: extension lines, dim line segments, closed-filled arrowheads (triangles), measured label (computed via dimlfac + dimdec + dimpost). Updates live as style changes via useMemo.
  - **MOD** `src/subapps/dxf-viewer/ui/panels/dimensions/DimStyleAccordion.tsx` — Added DimStylePreview at top + 3 new AccordionSection (fit/units/tolerances, defaultOpen=false). Now renders 6 total sections.
  - **MOD** `src/i18n/locales/el/dxf-viewer-panels.json` + `en/dxf-viewer-panels.json` — Added sections.{fit,units,tolerances}, fields.{dimatfit,dimtmove,dimscale,dimlunit,dimdec,dimrnd,dimlfac,dimzin,dimaunit,dimadec,dimtol,dimlim,dimtp,dimtm,dimtdec,dimtolj}, dimatfit.{0-3}, dimtmove.{0-2}, dimlunit.{6 keys}, dimaunit.{5 keys}, dimtolj.{bottom,middle,top}.
  - **MOD** `src/subapps/dxf-viewer/ui/panels/dimensions/__tests__/DimStyleAccordion.test.tsx` — Updated to 12 tests: renders 6 sections (was 3), + dimatfit/dimaunit/dimtolj select tests + DimStylePreview renders. Added DimStylePreview jest.mock. **12/12 PASS**.
  - **Next**: Phase F4 — DimensionsTab persistence (Firestore backing for custom styles) or Phase G (ribbon contextual dim commands wired to registry).

- **2026-05-17 (Phase E2 DONE — contextual "Διάσταση" ribbon tab + trigger wiring; 15/15 unit tests PASS. Group E CLOSED.)** — Industry defaults (AutoCAD/Revit: one unified tab for all 10 dim types, combobox style chooser, comingSoon stubs for Phase F/G writes). Tab `id='dimension'`, `contextualTrigger='dim-selected'` — fires when `entity.type === 'dimension'` via `resolveContextualTrigger`.
  - **Design decisions** (AutoCAD/Revit industry defaults; Giorgio confirmed "OK + GOL + SSOT" without explicit Q-A/B/C/D answers so defaults applied): Q-A = pure 'dim-selected' trigger (one tab for all 10 dim types); Q-B = shared-values stub (Phase G impl); Q-C = combobox for DIMSTYLE chooser (scales with custom styles); Q-D = "Edit Style..." = comingSoon stub (opens Phase F left-panel tab).
  - **NEW** `src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/dim-command-keys.ts` — `DIM_RIBBON_KEYS` registry (4 groups: style/override/text/properties), `isDimRibbonKey()` predicate. Mirrors `stair-command-keys.ts` pattern for future bridge composition in `useRibbonCommands.ts`.
  - **NEW** `src/subapps/dxf-viewer/ui/ribbon/data/contextual-dimension-tab.ts` (~230 LOC) — `DIMENSION_CONTEXTUAL_TAB: RibbonTab` with 4 panels (dim-style/dim-override/dim-text/dim-properties), 13 buttons total. Action stubs (`comingSoon: true`): dimApplyStyle, dimEditStyle, dimResetOverrides, dimResetTextPosition, dimOpenPanel. Comboboxes: DIMSTYLE chooser (3 presets), arrowhead (5), text height (5 paper-mm), text position (above/centered/below), text rotation (6°), layer (dynamic), annotation-scale (widget). Color override = color-swatch.
  - **MOD** `src/subapps/dxf-viewer/app/ribbon-contextual-config.ts` — `RIBBON_CONTEXTUAL_TABS` + 1 entry (`DIMENSION_CONTEXTUAL_TAB`); `resolveContextualTrigger` + `entity.type === 'dimension'` branch (first guard, before stair/text/array).
  - **MOD** `src/subapps/dxf-viewer/ui/ribbon/components/buttons/RibbonButtonIcon.tsx` — 6 new E2 icon cases (`dim-apply-style`=Check, `dim-edit-style`=Pencil, `dim-reset-overrides`=RotateCcw, `dim-reset-text-position`=RefreshCw, `dim-open-panel`=Settings, `dim-style-chooser`=Palette) + import additions from `lucide-react`.
  - **MOD** `src/i18n/locales/el/dxf-viewer-shell.json` + `src/i18n/locales/en/dxf-viewer-shell.json` — `ribbon.tabs.dimension`, `ribbon.panels.{dimStyle,dimOverride,dimText,dimProperties}`, 14 `ribbon.commands.dim*` flat keys + `ribbon.commands.dimContextual.{styleOptions,arrowOptions,textPositionOptions}` nested namespace.
  - **NEW** `src/subapps/dxf-viewer/ui/ribbon/data/__tests__/contextual-dimension-tab.test.ts` — 15 structural assertions (tab shape, panel ids/labels, button counts, type checks, i18n namespace, icon presence, comingSoon coverage). **15/15 PASS**, ~4s.
  - **No integration yet** (Phase F+G scope): bridge `useRibbonDimensionBridge` NOT created (stubs only); `useRibbonCommands` NOT modified (Phase F); real DIMSTYLE registry writes NOT wired; left FloatingPanel 4° tab NOT created (Phase F1); text override / tolerance / alt-units NOT implemented (Phase G).
  - **Group E CLOSED.** Next: Phase F1 — left FloatingPanel 4° tab "Διαστάσεις" skeleton + DIMSTYLE Manager CRUD.

- **2026-05-17 (Phase E1 DONE — Home ribbon DIMENSIONS panel + 12 dim icons + i18n keys; 7/7 unit tests PASS)** — Group E Phase E1 implementata. Static ribbon config file + i18n keys + icon switch-case additions — zero behavioural changes to the Phase D1/D2/D3 hook surface. All 12 dim tools (`dim-smart` + 9 manual variants + `dim-baseline` + `dim-continued`) now activable from the Home tab. AutoCAD 2016+ pattern: 1 large split button (Smart DIM primary + 10-item dropdown) + 2 small standalone buttons (Baseline / Continued) on a second row.
  - **Design decisions captured** (Q-A through Q-D, 2026-05-17, AutoCAD industry defaults per [[feedback_industry_standard_default]]; user replied "OK + GOL + SSOT" without explicit answers, so defaults applied):
    - **Q-A — Grouping = 3-section AutoCAD pattern**: `[Smart DIM ▼ (with 10 dropdown variants)] [Baseline] [Continued]`. Smart DIM dropdown contains the manual variant list **plus the Smart DIM entry itself as the first item** (matches AutoCAD/Revit split-button convention — the primary command appears in its own dropdown so users can re-select after using a variant). Baseline + Continued live OUTSIDE the dropdown because they require a parent dim (Phase D3 chain semantics) and are conceptually different commands (DIMBASELINE / DIMCONTINUE in AutoCAD are sibling commands to DIM, not variants).
    - **Q-B — Hotkey only on Smart DIM = `DIM`**. AutoCAD canonical primary. Variants in the dropdown have no individual hotkeys (AutoCAD-style alias dispatch is Phase E1b — needs a command-line input UI to fire `DLI/DAL/DRA/...`). Baseline + Continued without hotkey for Phase E1 (would be `DBA/DCO` if added later; deferred to avoid hotkey conflict surface until a fuller audit). Existing shortcuts inventoried: `L/PL/C/A/REC/T/MD/AA/MA/ST` — `DIM` is free.
    - **Q-C — Icons = lucide-react**. 12 icons registered in `RibbonButtonIcon.tsx`: `Ruler` (smart), `MoveHorizontal` (linear), `MoveDiagonal2` (aligned), `Triangle` (both angular variants — distinguishable via label), `CircleDot` (radius), `Diameter` (diameter), `Spline` (arc-length), `CircleSlash` (jogged-radius), `MoveUpRight` (ordinate), `Rows3` (baseline — parallel rows visual), `Equal` (continued — equal/continuation visual). Project already uses lucide-react throughout the ribbon icon system; no custom SVG needed for E1. Custom dim SVGs (per-direction arrows, projection lines) can land in a later cleanup pass without breaking the API.
    - **Q-D — Group placement = new panel after `ANNOTATE_MEASURE_PANEL` in the Home tab**. AutoCAD/Revit ship DIM as a separate panel (sibling to Measure / Annotate), not nested. Insertion position keeps "measurement-class" tools adjacent (Measure → Dimensions → AI). Annotate tab itself stays an empty scaffold (placeholder `text` panel) for now — Phase E2 will move the dimensions panel there if `Annotate` becomes the primary surface (AutoCAD Annotate tab convention). For Phase E1 the Home tab gives maximum discoverability.
  - **NEW** `src/subapps/dxf-viewer/ui/ribbon/data/home-tab-dimensions.ts` (~130 LOC) — exports `HOME_DIMENSIONS_PANEL: RibbonPanelDef`. Row 1 = 1 large split button (Smart DIM + 10-item dropdown: smart/linear/aligned/angular2L/angular3P/radius/diameter/arcLength/joggedRadius/ordinate). Row 2 = 2 small simple buttons (baseline/continued). Every `commandKey` matches a registered `ToolType` literal from `toolbar/types.ts` (Phase D1/D2/D3 ✅ — no new ToolTypes added in E1 because the brief overestimated; all 12 were already in place).
  - **MOD** `src/subapps/dxf-viewer/ui/ribbon/data/ribbon-default-tabs.ts` — imports `HOME_DIMENSIONS_PANEL` + inserts it into the Home tab `panels` array between `ANNOTATE_MEASURE_PANEL` and `HOME_AI_PANEL` (Q-D placement).
  - **MOD** `src/subapps/dxf-viewer/ui/ribbon/components/buttons/RibbonButtonIcon.tsx` — 12 new icon cases (`dim-smart` / `dim-linear` / `dim-aligned` / `dim-angular2L` / `dim-angular3P` / `dim-radius` / `dim-diameter` / `dim-arc-length` / `dim-jogged-radius` / `dim-ordinate` / `dim-baseline` / `dim-continued`) + import additions from `lucide-react` (`Ruler, MoveHorizontal, MoveDiagonal2, Triangle, CircleDot, Diameter, Spline, CircleSlash, MoveUpRight, Rows3, Equal`). Fallback path (unknown icon → generic dot) unchanged.
  - **MOD** `src/i18n/locales/el/dxf-viewer-shell.json` — `ribbon.panels.dimensions = "Διαστάσεις"`; `ribbon.commands.dim = "Διάσταση"`; `ribbon.commands.dimVariants.{smart, linear, aligned, angular2L, angular3P, radius, diameter, arcLength, joggedRadius, ordinate}`; `ribbon.commands.dimBaseline = "Από Βάση"`; `ribbon.commands.dimContinued = "Συνεχόμενη"`. SOS N.11 compliance: zero hardcoded labels in the panel def.
  - **MOD** `src/i18n/locales/en/dxf-viewer-shell.json` — symmetric English keys (Dimensions / Dimension / Smart Dimension / Linear / Aligned / Angular (2 Lines) / Angular (3 Points) / Radius / Diameter / Arc Length / Jogged Radius / Ordinate / Baseline / Continued).
  - **NEW** `src/subapps/dxf-viewer/ui/ribbon/data/__tests__/home-tab-dimensions.test.ts` (~100 LOC, **7 tests / 1 group**) — structural assertions on the static `RibbonPanelDef`: panel id + labelKey, row layout (1 + 2), Smart DIM primary command shape + `DIM` shortcut, exact 10-item variant ordering with correct `commandKey`s, baseline/continued standalone shape, every label routed through `ribbon.(commands|panels).*` namespace + no `comingSoon` flag set, non-empty `icon` token on every command, shortcut uniqueness within the panel.
  - **Verification**: `npx jest src/subapps/dxf-viewer/ui/ribbon/data/__tests__/home-tab-dimensions.test.ts` → **7/7 PASS**, ~3.5s. JSON validity check on both locale files (`node -e JSON.parse...`) → green. `npx tsc --noEmit` filtered on `home-tab-dimensions|ribbon-default-tabs|RibbonButtonIcon` → ran in background; results not blocking commit per project policy.
  - **Constraints honored**: zero `any` / `as any` / `@ts-ignore`. All new files ≤500 LOC (panel def ~130, test ~100). Zero hardcoded user-facing strings (SOS N.11). ADR-040 compliance — ribbon data is static config, zero high-frequency store subscriptions. Smart DIM dropdown contains its own entry as first item (AutoCAD/Revit split-button convention) so the variant list count is 10, not 9.
  - **No integration yet** (Phase E2+ scope): NOT wired into a contextual `Διάσταση` tab for per-entity edits (Phase E2), NOT integrated with the left FloatingPanel `Διαστάσεις` tab (Group F), NO "Select parent" hover-pick toggle for the chained dims' optional explicit parent override (Phase E1b — `useDimensionCreate.resolveParentDimension` already accepts it; just needs a ribbon trigger), NO snap intelligence (Phase I), NO DXF export (Phase H). Smoke testing path: open DXF viewer → Home tab → "Διαστάσεις" panel visible → click Smart DIM → `activeTool === 'dim-smart'`; click dropdown arrow → 10 variants render with labels + icons; click Baseline / Continued → activates `dim-baseline` / `dim-continued` (Phase D3 hook warns + aborts if no parent dim exists yet, per Q-D D3).
  - **Next**: Phase E2 — contextual ribbon tab `Διάσταση` (trigger: `'dim-selected'`) with 4 groups (Στυλ / Παράκαμψη / Κείμενο / Ιδιότητες). Pattern reuse from `TEXT_EDITOR_CONTEXTUAL_TAB` (ADR-345). New file `ui/ribbon/data/contextual-dimension-tab.ts`.

- **2026-05-17 (Phase D3 DONE — Chained dims (Baseline / Continued) + live Tab/Space/Escape keyboard routing — 10/10 dim types creatable; Group D CLOSED. 29 new unit tests across 3 files; 104/104 PASS in `hooks/dimensions`)** — Group D Phase D3 implementata. Extension only on top of Phase D1+D2 — zero breaking changes to the D1/D2 API surface. The last 2 ToolTypes (`dim-baseline`, `dim-continued`) wire end-to-end via PreviewCanvas overlay + click-by-click commit. The dim creation flow can now receive `Tab` / `Space` / `Escape` directly from the canvas (no longer programmatic-only via test API).
  - **Design decisions captured** (Q-A through Q-D, 2026-05-17, AutoCAD industry defaults per [[feedback_industry_standard_default]]; user replied "OK + GOL + SSOT" without explicit answers, so defaults applied):
    - **Q-A — Parent selection = auto-last (most recently committed linear/aligned/chained dim wins)**. AutoCAD DIMBASELINE / DIMCONTINUE default behaviour: when activated, they implicitly chain off the immediately-preceding dim. Optional "Select" mode (hover-pick a different parent) deferred to Phase E1 ribbon ("Select parent" toggle). Phase D3 implementation: hook keeps an in-session `lastChainableRef` advanced after every commit of `linear|aligned|baseline|continued`; explicit `resolveParentDimension` callback param is an optional override (returns null → fall back to auto-last). No scene-store lookup needed — the chain head is a session-local concept.
    - **Q-B — Continued chain auto-progression: each commit advances the chain head to the just-placed dim, so the next click chains off it (not the original linear parent)**. Matches AutoCAD DIMCONTINUE — end-to-end propagation creates an unbroken length chain. Baseline does the same in the parent reference (each new baseline's `parentDimensionId` = immediately-preceding baseline), and `chained-builder.ts:resolveChain` (Phase B3) recursively walks back through baseline ancestors adding 1× DIMDLI offset per level, so visual spacing stays predictable. Implemented in `useDimensionCreate.runCommit`: after `onDimensionCreated`, if the entity is chainable, `lastChainableRef.current` advances; the auto-restart path then re-issues `setParent(lastChainableRef.current)` so the continuous-mode loop arms the next chained dim with the updated head.
    - **Q-C — Keyboard routing = global `window` `keydown` listener gated by `isDimTool(activeTool)`**. AutoCAD / Revit / BricsCAD command-line shortcuts are effectively global (focus drifts to ribbon / dynamic input / status bar during normal interaction). Canvas-scoped `onKeyDown` was rejected because it loses events when focus is elsewhere. New `useDimensionKeyboardRouting` hook: attaches a capture-phase `keydown` listener while a dim tool is active, gates by `isEditableFocus()` (matches `useKeyboardShortcuts` editable-target guard pattern), maps `Tab` / `Space` / `Escape` to `DimensionCreateKey`, `preventDefault` for Tab + Space (so browser focus traversal / page scroll don't run) but NOT for Escape (the legacy `useKeyboardShortcuts` Escape handler still needs to fire its overlay/color fallback paths). Wired by `useDimToolRouting` directly so no caller integration changes are needed.
    - **Q-D — Pre-requisite missing parent = silent + `console.warn`**. AutoCAD DIMBASELINE prints `*No previous dimension found*` and prompts "Select a base dimension" if none. Phase D3 simpler: hook checks at `start('baseline'|'continued')` time; if no parent is resolvable, it warns + aborts (`return`) so the store never enters a chained flow without a parent. Reducer additionally has a defensive guard in `handleClick` (no clicks recorded for manual baseline/continued without `parentDimensionId`). Toast / status-bar messaging = Phase E1 (visual ribbon prompt).
  - **MOD** `src/subapps/dxf-viewer/hooks/dimensions/dimension-create-state.ts` (311 → 351 LOC) — `requiredClickCount('baseline'|'continued')` flipped from placeholder `3` to actual `1` (one click = new extOrigin2; extOrigin1 + dimLineRef inherited from parent at render time). New state field `parentDimensionId: string | null` + new action `setParent`. `handleSetParent` validates `status === 'collecting'` and returns the same reference when the parent value is unchanged (referential-equality safety for `useSyncExternalStore` subscribers). `handleStart` resets `parentDimensionId` to null implicitly via `initialDimensionCreateState` spread (so loop-restart must re-set it). `handleClick` defensive guard: manual baseline/continued click is silently swallowed when `parentDimensionId` is null.
  - **NEW** `src/subapps/dxf-viewer/hooks/dimensions/dimension-create-chained-builders.ts` (~95 LOC) — exports `buildBaseline`, `buildContinued`, shared `ChainedBuildOpts`. Both builders read `state.parentDimensionId` (return null if missing — defensive at the builder layer too), grab the new extOrigin from `state.clicks[0]?.world` (with cursor fallback when `includeCursor`), and stamp `parentDimensionId` onto the produced `BaselineDimensionEntity` / `ContinuedDimensionEntity`. `defPoints = [newExtOrigin]` (single point) — the chained-builder.ts render-time walker derives extOrigin1 + dimLineRef from the parent chain.
  - **MOD** `src/subapps/dxf-viewer/hooks/dimensions/dimension-create-entity-builder.ts` (347 → 367 LOC) — dispatcher extended with `baseline` / `continued` cases delegating to the chained builders. `collectAssociations` extended: baseline/continued → optional `endpoint` association on `defPoints[0]` when click 1 hovered a host entity (inherited extOrigin1 + dimLineRef are NOT duplicated here — they're traced through `parentDimensionId` by `chained-builder.ts:resolveChain` at render time, so assoc would double-count).
  - **MOD** `src/subapps/dxf-viewer/hooks/dimensions/useDimensionCreate.ts` (183 → 234 LOC) — new optional param `resolveParentDimension(mode: 'baseline'|'continued') => DimensionEntity | null`. `start()` for chained modes: resolves parent via `resolveChainParentId` (explicit callback wins, else `lastChainableRef.current`), warns + aborts if none, else dispatches `start` + `setParent` to the store. `runCommit` now takes `lastChainableRef` as a 4th arg: advances it for any chainable commit (`isChainable(type)`), and on continuous-mode restart for baseline/continued it re-dispatches `setParent(lastChainableRef.current)` after the `start()` reset (Q-B chain progression). `cancel` / `Escape` clear both `lastStartRef` AND `lastChainableRef` so subsequent `start('baseline')` correctly warns.
  - **MOD** `src/subapps/dxf-viewer/stores/DimensionCreateStore.ts` (133 → 137 LOC) — new convenience action `setParent(parentDimensionId)` mirroring the existing `start` / `click` / `pressTab` shape.
  - **NEW** `src/subapps/dxf-viewer/hooks/dimensions/useDimensionKeyboardRouting.ts` (~80 LOC) — Q-C global `window.keydown` listener gated by `params.isDimTool(activeTool)` + editable-focus guard. Maps `Tab` / `Space` / `Escape` to `DimensionCreateKey`; `preventDefault` for Tab + Space (browser focus traversal / page scroll suppression); Escape passes through so the legacy `useKeyboardShortcuts` ESC handler can still fire its overlay/color fallback paths downstream. Capture-phase listener, cleanup on unmount + tool flip. Zero high-frequency store subscriptions (ADR-040 leaf compliance).
  - **MOD** `src/subapps/dxf-viewer/hooks/dimensions/useDimToolRouting.ts` (182 → 196 LOC) — `DIM_TOOL_INPUTS` map extended with `'dim-baseline' → 'baseline'`, `'dim-continued' → 'continued'`. Wires `useDimensionKeyboardRouting({ activeTool, isDimTool, onKey: dimCreate.onKey })` so caller (Phase E1+) gets keyboard routing automatically when consuming the routing hook.
  - **MOD** `src/subapps/dxf-viewer/ui/toolbar/types.ts` — 2 new `ToolType` literals appended after the Phase D2 set: `'dim-baseline' | 'dim-continued'`.
  - **MOD** `src/subapps/dxf-viewer/systems/tools/ToolStateManager.ts` — 2 new exhaustive entries in `TOOL_DEFINITIONS`. Category `'drawing'`, `allowsContinuous: true` (AutoCAD DIMBASELINE/DIMCONTINUE loop), `preservesOverlayMode: false`, `canInterrupt: true` — identical metadata to the Phase D1/D2 dim tools.
  - **NEW** `src/subapps/dxf-viewer/hooks/dimensions/__tests__/dimension-create-chained-builders.test.ts` (~135 LOC, **10 tests / 2 groups**) — buildBaseline + buildContinued: parent-missing returns null at both paths, preview cursor fallback fills new extOrigin, commit defPoints = [click 0 world] + parentDimensionId stamped, commit ignores cursor.
  - **NEW** `src/subapps/dxf-viewer/hooks/dimensions/__tests__/useDimensionKeyboardRouting.test.ts` (~115 LOC, **6 tests / 1 group**) — dispatches Tab/Space/Escape when dim tool active, ignores unrelated keys, no listener when not a dim tool, `preventDefault` for Tab+Space but NOT Escape, INPUT focus suppresses dispatch, listener torn down when activeTool flips away.
  - **MOD** `src/subapps/dxf-viewer/hooks/dimensions/__tests__/dimension-create-state.test.ts` — `requiredClickCount` test for baseline/continued updated to `1` (was placeholder `3`). New `parentDimensionId` assertion in initial state. **2 new describe blocks (8 tests)**: "Phase D3 — setParent action" (idle no-op, stamps when collecting, referential stability on no-change, start() resets); "Phase D3 — baseline/continued click guard + commit-ready" (rejects click without parent, 1-click commits with parent for both variants).
  - **MOD** `src/subapps/dxf-viewer/hooks/dimensions/__tests__/dimension-create-entity-builder.test.ts` — replaced the legacy "baseline still out-of-scope" test with **3 new D3 tests**: defensive null without `parentDimensionId`, baseline commit with parent produces correct entity, continued + hovered host yields endpoint association.
  - **MOD** `src/subapps/dxf-viewer/hooks/dimensions/__tests__/useDimensionCreate.test.ts` — **6 new tests** in a new "Phase D3 baseline + continued chained flows" describe: `start("baseline")` aborts silently when no parent (Q-D warn), explicit `resolveParentDimension` wins over auto-last, auto-last picks committed linear as parent, baseline single-click commits + auto-progresses chain head, continued 2 commits chain end-to-end (parent advances per commit), Escape clears `lastChainable` so next baseline warns.
  - **Verification**: `npx jest src/subapps/dxf-viewer/hooks/dimensions --coverage --collectCoverageFrom=…` → **104/104 PASS** (75 D1/D2 + 29 D3), ~10s (Linux baseline; Windows wall-clock ~5min cold). Coverage on touched modules: `dimension-create-chained-builders.ts` **95% stmts / 92.85% branch / 100% funcs / 100% lines**; `useDimensionKeyboardRouting.ts` **96.96% stmts / 95.45% branch / 100% funcs / 100% lines**; `useDimensionCreate.ts` **90.8% stmts / 82.5% branch / 92.85% funcs / 92.4% lines**; `dimension-create-state.ts` **92.4% stmts / 95.65% branch / 100% funcs / 91.42% lines**; `dimension-create-entity-builder.ts` **85.03% stmts / 77.66% branch / 94.44% funcs / 89.62% lines**; `DimensionCreateStore.ts` **90% stmts / 100% branch / 87.5% funcs / 88.88% lines**. All ≥80% target from brief. `useDimToolRouting.ts` 0% (composed-only glue layer — coverage arrives with Phase E1 integration test). `npx tsc --noEmit` filtered on D3 scope → 0 errors introduced (ran in background).
  - **Constraints honored**: zero `any` / `as any` / `@ts-ignore` in production code (the lone `as unknown as Parameters<...>[0]` cast in `useDimToolRouting` from Phase D1 is unchanged). All new functions ≤40 LOC. All files ≤500 LOC (entity-builder 367, chained-builders 95, useDimensionCreate 234, keyboard-routing 80, state 351). Comments only on non-obvious "why" (chain progression rationale in `runCommit`, parent inheritance for chained-builder.ts render walk, editable-focus guard motivation in `useDimensionKeyboardRouting`). ADR-040 compliance unchanged — Phase D3 adds zero new high-frequency store subscriptions; keyboard routing is a leaf-level `window` listener with capture-phase cleanup tied to `activeTool` lifecycle.
  - **No integration yet** (Phase E+ scope): NOT wired into ribbon Smart DIM dropdown (Phase E1), NOT wired into contextual "Διάσταση" ribbon tab (Phase E2), NO "Select parent" hover-pick mode for Q-A explicit override (Phase E1 — `resolveParentDimension` param already exists, just needs the ribbon trigger), NO snap intelligence (Phase I), NO associativity observers (Phase J), NO DXF export (Phase H), NO real UCS datum for ordinate (Phase F multi-viewport). Both new dim tools can be activated programmatically via `toolStateStore.selectTool('dim-baseline' | 'dim-continued')` for manual smoke-testing pending the ribbon UI.
  - **Group D CLOSED.** Next: Phase E1 — Home ribbon Smart DIM group + visible entry-point for all 10 dim tools, then Phase E2 — contextual ribbon tab "Διάσταση" for per-entity quick edits (Style / Override / Text / Properties).

- **2026-05-17 (Phase D2 DONE — Radial family + Ordinate creation, 9/10 dim types creatable, 31 new unit tests)** — Group D Phase D2 implementata. Extension only on top of the Phase D1 store/reducer/entity-builder/hook — zero breaking changes to the D1 API surface. 5 new ToolTypes (`dim-radius`, `dim-diameter`, `dim-arc-length`, `dim-jogged-radius`, `dim-ordinate`) creatable end-to-end via PreviewCanvas overlay + click-by-click commit. Only `baseline` + `continued` remain (Phase D3 = chained dims + keyboard event routing from canvas).
  - **Design decisions captured** (Q-A through Q-D, 2026-05-17, AutoCAD industry defaults per [[feedback_industry_standard_default]]; system reminder asked to proceed without clarifying questions):
    - **Q-A — Radius / diameter / arcLength / joggedRadius require an entity pick on click 1**. AutoCAD DIMRADIUS / DIMDIAMETER / DIMARC reject freestyle 2-point variants — the leader has to anchor on real geometry so the measurement is meaningful. Reducer guard in `dimension-create-state.ts:handleClick` silently swallows click 1 when `state.manualOverride ∈ {radius, joggedRadius, diameter, arcLength}` and `action.hoveredEntity` is missing or of the wrong type. Smart mode is unaffected (existing `'linear'` bare-points fallback still wins). Ordinate has no guard (matches AutoCAD DIMORDINATE — feature can be any point).
    - **Q-B — Diameter side2 auto-derived as the antipodal point of side1 on the picked circle**. AutoCAD DIMDIAMETER captures a single side click + a text position; the opposite side is `center + (center − side1)`. Click 1's world position picks the side1 direction (`perimeterPointAtDirection(center, radius, click1.world)`); click 2 = text position only. Matches AutoCAD / BricsCAD / Revit; user can drag the text around without ever clicking the second side explicitly.
    - **Q-C — ArcLength = 2-click pick-based only (DIMARC pattern), no 3-click manual fallback**. AutoCAD DIMARC = pick arc (1 click — derives center / arcStart / arcEnd from the arc's own `startAngle` / `endAngle`) + text position (2nd click). Phase D2 follows verbatim. Manual 3-click center/start/end flow is not provided (no real-world need when click 1 reads them off the arc).
    - **Q-D — Ordinate datum hardcoded at scene origin `{x:0, y:0}` for Phase D2**. AutoCAD DIMORDINATE uses the active UCS origin transparently; vero UCS origin = Phase F multi-viewport scope. Two clicks: feature + leader endpoint. `axis` auto-derived from leader direction (`|Δx|>|Δy|` ⇒ horizontal leader ⇒ measuring Y; otherwise X — matches `ordinate-builder.ts` semantics already shipped in Phase B3).
  - **MOD** `src/subapps/dxf-viewer/hooks/dimensions/dimension-create-state.ts` (282 → 311 LOC) — `requiredClickCount` updated to industry pattern: `radius=2, diameter=2, arcLength=2, ordinate=2, joggedRadius=4`. New helper `firstClickNeedsEntityPick(type, picked)` + guard branch in `handleClick` (only manual mode + clicks.length===0). Smart mode + `baseline`/`continued` placeholder unchanged (=3 for D3).
  - **NEW** `src/subapps/dxf-viewer/hooks/dimensions/dimension-create-radial-builders.ts` (~204 LOC) — split out of `dimension-create-entity-builder.ts` so the main dispatcher stays under the 500-LOC cap (it grew from 287 → 347 with the new dispatch cases + import). Exports `buildRadius`, `buildDiameter`, `buildArcLength`, `buildJoggedRadius`, `buildOrdinate` + shared `RadialBuildOpts`. Internal helpers: `firstArcLike` (arc OR circle → `{center, radius}`), `firstCircle`, `firstArc`, `secondPoint` (clicks[1] OR cursor in preview), `collectExtraPoints` (clicks[1..N] padded with cursor), `perimeterPointAtDirection` (project world point onto a circle/arc perimeter at the angle from center), `deriveOrdinateAxis` (leader direction → axis). All builders return null gracefully when `firstArcLike`/`firstCircle`/`firstArc` returns null (preserves the Phase D1 contract — preview just renders nothing while waiting).
  - **MOD** `src/subapps/dxf-viewer/hooks/dimensions/dimension-create-entity-builder.ts` (287 → 347 LOC) — dispatcher extended with `radius`/`diameter`/`arcLength`/`joggedRadius`/`ordinate` cases delegating to the sibling builders. `collectAssociations` extended with: radius/joggedRadius → `center` association on the picked arc/circle; diameter → 2 × `nearest` associations on the picked circle (subIndex 0/1); arcLength → `center` + 2 × `endpoint` (subIndex 0/1) on the picked arc; ordinate → 1 × `endpoint` association on the feature point when click 1 hovered an entity. New helpers `makeCenterAssociation`, `makeNearestAssociation`.
  - **MOD** `src/subapps/dxf-viewer/ui/toolbar/types.ts` — 5 new `ToolType` literals appended after Phase D1 set: `'dim-radius' | 'dim-diameter' | 'dim-arc-length' | 'dim-jogged-radius' | 'dim-ordinate'`.
  - **MOD** `src/subapps/dxf-viewer/systems/tools/ToolStateManager.ts` — 5 new exhaustive entries in `TOOL_DEFINITIONS`. Category `'drawing'`, `allowsContinuous: true` (AutoCAD DIM loop), `preservesOverlayMode: false`, `canInterrupt: true` — identical metadata to the Phase D1 dim tools.
  - **MOD** `src/subapps/dxf-viewer/hooks/dimensions/useDimToolRouting.ts` — `DIM_TOOL_INPUTS` map extended with `'dim-radius' → 'radius'`, `'dim-diameter' → 'diameter'`, `'dim-arc-length' → 'arcLength'`, `'dim-jogged-radius' → 'joggedRadius'`, `'dim-ordinate' → 'ordinate'`.
  - **NEW** `src/subapps/dxf-viewer/hooks/dimensions/__tests__/dimension-create-entity-builder-radial.test.ts` (~265 LOC, **14 tests / 5 groups**) — per variant (radius / diameter / arcLength / joggedRadius / ordinate): preview path (cursor-as-text-direction, perimeter snapping, null without entity pick), commit path (defPoints assembly, side2 antipodal derivation, arcStart/arcEnd from arc angles, axis auto-detection, datum {0,0}), and association capture (center / nearest / endpoint per variant).
  - **MOD** `src/subapps/dxf-viewer/hooks/dimensions/__tests__/dimension-create-state.test.ts` — existing `requiredClickCount` test updated to Phase D2 expectations (radius/diameter/arcLength/ordinate = 2, joggedRadius = 4, baseline/continued = 3 placeholder). **2 new describe blocks (11 tests)**: "Phase D2 — radial click guard" (manual dim-radius rejects no-hover click, dim-diameter rejects arc, dim-arc-length rejects circle, dim-radius accepts circle, ordinate has no guard, smart mode unaffected); "Phase D2 — commit-ready transitions" (radius 2-click, diameter 2-click, arcLength 2-click, joggedRadius 4-click with 3 still collecting, ordinate 2-click).
  - **MOD** `src/subapps/dxf-viewer/hooks/dimensions/__tests__/dimension-create-entity-builder.test.ts` — updated the "out-of-scope variants return null" test: radius still returns null at the builder level when no entity is picked (Q-A guard works at both reducer AND builder), and a new test added covering `baseline` (still out-of-scope until Phase D3).
  - **MOD** `src/subapps/dxf-viewer/hooks/dimensions/__tests__/useDimensionCreate.test.ts` — **3 new tests** in a new "Phase D2 radial + ordinate end-to-end" describe: radius 2-click commit with arc hover on click 1 (verifies `defPoints[0]` is the derived center, not the click world); ordinate 2-click commit with auto axis='y' (horizontal leader) + datum `{x:0, y:0}`; manual dim-radius rejects clicks until valid arc/circle hover (verifies the reducer guard reaches the hook surface, no `onDimensionCreated` fires).
  - **Verification**: `npx jest src/subapps/dxf-viewer/hooks/dimensions --coverage` → **75/75 PASS** (44 D1 + 31 D2), ~10s. Coverage on touched modules: `dimension-create-state.ts` **91.54% stmts / 95.06% branch / 100% funcs / 90.62% lines**; `dimension-create-radial-builders.ts` **90.24% stmts / 74.57% branch / 100% funcs / 97.10% lines**; `dimension-create-entity-builder.ts` **85% stmts / 77.31% branch / 94.44% funcs / 90% lines**; `useDimensionCreate.ts` **90% stmts / 70% branch / 91.66% funcs / 92.59% lines**. All ≥80% target from brief. `useDimToolRouting.ts` 0% (composed-only glue layer — coverage arrives with Phase E1 integration test). `npx tsc --noEmit` filtered on D2 scope (`dimension-create|useDimensionCreate|useDimToolRouting|toolbar/types|ToolStateManager`) → 0 errors introduced (ran in background).
  - **Constraints honored**: zero `any` / `as any` / `@ts-ignore` in production code (the lone `as unknown as Parameters<...>[0]` cast in `useDimToolRouting` from Phase D1 is unchanged). All functions ≤40 LOC. All files ≤500 LOC (entity-builder 347, radial-builders 204). Comments only on non-obvious "why" (Q-A guard motivation inline in `firstClickNeedsEntityPick`, side2 antipodal derivation, ordinate axis convention reference to Phase B3 `ordinate-builder.ts`). ADR-040 compliance unchanged — Phase D2 only touches the orchestrator's pure-function dispatcher path; no new high-frequency store subscriptions.
  - **No integration yet** (Phase D3+ scope): NOT wired into ribbon Smart DIM dropdown (Phase E1), NOT wired into contextual "Διάσταση" ribbon tab (Phase E2), NO baseline/continued chained creation (Phase D3), NO full modifier wiring (Tab/Space/Shift/Ctrl keyboard event routing from canvas = Phase D3), NO snap intelligence (Phase I), NO associativity observers (Phase J), NO DXF export (Phase H), NO real UCS datum for ordinate (Phase F multi-viewport). All 5 new dim tools can be activated programmatically via `toolStateStore.selectTool('dim-radius' | ...)` for manual smoke-testing pending the ribbon UI.
  - **Next**: Phase D3 — baseline + continued chained dim flows + full modifier event routing from the canvas (Tab/Space toggle dispatched from `useKeyboardShortcuts` instead of programmatic test-only API). Closes Group D.

- **2026-05-17 (Phase D1 DONE — `useDimensionCreate` hook orchestrator + Smart DIM / 4 manual ToolTypes + 44 unit tests)** — Group D Phase D1 implementata. Linear / Aligned / Angular2L / Angular3P creatable end-to-end via PreviewCanvas overlay + click-by-click commit. Opens Group D (Phase D2 = radial family + ordinate creation, Phase D3 = baseline + continued chained + full modifier wiring).
  - **Design decisions captured** (Q-A through Q-D, 2026-05-17, see also [[project_adr362_dimension_system]]):
    - **Q-A — State storage = global hand-rolled store (`DimensionCreateStore`)** with ADR-040 micro-leaf pattern. Industry convergence 6/6 (AutoCAD command class + global ActiveCommand, Revit IExternalCommand, Rhino command stack, BricsCAD AutoCAD-clone, SketchUp `Sketchup.active_model.tools`, OnShape tool framework). Phase E surfaces (ribbon contextual "Διάσταση" tab, status-bar prompt line, dynamic-input tooltip, keyboard dispatch Tab/Space/Escape with focus on ribbon) all need read access without prop-drilling through CanvasSection. Retrofit cost from local→global is signature changes across 5+ files — paid up-front. Hand-rolled (`useSyncExternalStore` listener Set, same shape as `ToolStateStore` / `HoverStore`), NOT the Zustand library, for consistency with the dxf-viewer subapp's existing micro-leaf stores.
    - **Q-B — Smart DIM = AutoCAD-pattern (smart + 4 manual ToolTypes parallel)**. AutoCAD 2016+ ships DIM (smart) + DIMLINEAR/DIMALIGNED/DIMANGULAR (classic) in parallel; BricsCAD + OnShape match this. Revit/Rhino = pure manual (legacy). All 5 `dim-*` ToolTypes wired in Phase D1 so the state machine supports both modes from day 1; ribbon UI = Phase E1. ToolType registry: `'dim-smart'`, `'dim-linear'`, `'dim-aligned'`, `'dim-angular2L'`, `'dim-angular3P'` (category: 'drawing', allowsContinuous: true, preservesOverlayMode: false — matches line/circle/polyline metadata).
    - **Q-C — Associativity = hybrid (hover-tracking in store, capture-time persistence on entity)**. AutoCAD/Revit/Rhino/BricsCAD/SketchUp/OnShape (6/6) show hover-time visual feedback + capture at click. Phase D1 leverages the existing snap system's visual indicators (no new hover UI); store keeps `hoveredEntity` ref so Phase E1 ribbon contextual tab can read it without prop-drilling, but `DimensionAssociation`s materialise on the entity only at commit time. Snap intelligence deeper integration = Phase J.
    - **Q-D — Commit destination = callback-based (`onDimensionCreated`)**. Mirrors existing `useDrawingHandlers` → `onEntityCreated(entity: Entity)` route used by every line/circle/polyline tool. Hook stays agnostic of scene storage; CAD plugin frameworks (AutoCAD `IExternalCommand.OnCommandComplete`, Revit `IExternalApplication`, Rhino `OnRunCommand`) all converge on event/callback semantics. Test-friendly: mock callback, no scene store mock needed.
  - **NEW** `src/subapps/dxf-viewer/stores/DimensionCreateStore.ts` (~133 LOC) — module-scoped `current: DimensionCreateState` + `listeners: Set<() => void>` mirroring `ToolStateStore`. `dimensionCreateStore.{get, subscribe, dispatch, start, cursorMove, click, pressTab, pressSpace, cancel}` + `useDimensionCreateState()` React adapter. `__resetDimensionCreateStoreForTests` test-only escape hatch. Pure dispatch on top of `dimensionCreateReducer`; all side effects live in `useDimensionCreate`.
  - **NEW** `src/subapps/dxf-viewer/hooks/dimensions/dimension-create-state.ts` (~282 LOC) — pure state machine. State: `status: 'idle' | 'collecting' | 'commit-ready'`, `mode: 'smart' | 'manual' | null`, `currentType`, `manualOverride`, `styleId`, `clicks: ClickRecord[]` (each `{ world, pickedEntity? }`), `cursorWorld`, `hoveredEntity`, `spacePressCount`, `tabPressCount`. Actions: `start`, `cursorMove`, `click`, `pressTab`, `pressSpace`, `cancel`. `requiredClickCount(type)` = 3 for linear/aligned/angular2L/radius/diameter/ordinate, 4 for angular3P. Smart mode click 1 with no hover defaults to `'linear'` (matches AutoCAD Smart DIM bare-points behaviour). Tab/Space no-ops in manual mode (Tier 1 override pins type). `start` always resets every transient slot — re-entering mid-flow wipes clicks/tab/space.
  - **NEW** `src/subapps/dxf-viewer/hooks/dimensions/dimension-create-entity-builder.ts` (~286 LOC) — `buildPreviewDimensionEntity(state)` (cursor-as-next-point, used per frame) + `buildCommittedDimensionEntity(state, { id, layerId })` (clicks-only, gated on `status==='commit-ready'`, materialises `DimensionAssociation[]`). Per-variant builders: linear (defPoints[0..2]), aligned (same shape), angular2L (defPoints = [line1.start, line1.end, line2.start, line2.end, arcPoint] with degenerate cursor placeholder when line2 not yet picked), angular3P (defPoints[0..3]). Associations: linear/aligned/angular3P → 1 per picked click (defPointIndex=clickIndex); angular2L → 4 endpoint associations per picked line + optional arc anchor pick. Phase D1 scope: radial/diameter/ordinate/baseline/continued/arcLength/joggedRadius return null (Phase D2/D3).
  - **NEW** `src/subapps/dxf-viewer/hooks/dimensions/useDimensionCreate.ts` (~183 LOC) — `useDimensionCreate({ onDimensionCreated, resolveLayerId, resolveStyleId? }): DimensionCreateAPI`. Thin proxy over `dimensionCreateStore` — NO React state subscription (orchestrator stays out of re-render loop per ADR-040 cardinal rule). API: `start(initial: 'smart' | DimensionType)`, `onCursorMove(world, hoveredEntity?)`, `onClick(world, hoveredEntity?)`, `onKey('Tab' | 'Space' | 'Escape')`, `cancel()`. `useEffect` subscribes to store; on every notify checks `status==='commit-ready'` and defers commit via `queueMicrotask` (avoids re-entry during listener loop). Commit path: `generateDimensionId()` (enterprise-id SSoT, SOS N.6) + `resolveLayerId()` → `buildCommittedDimensionEntity` → `onDimensionCreated(entity)` → auto-restart with cached `lastStartRef` params (AutoCAD/BricsCAD continuous-mode DIM loop). Escape clears `lastStartRef` so subsequent flows don't auto-restart.
  - **NEW** `src/subapps/dxf-viewer/hooks/dimensions/useDimToolRouting.ts` (~175 LOC) — routing layer separated from `useDrawingHandlers` to keep the orchestrator under the 500-line cap (it grew from 411 to 430). `DIM_TOOL_INPUTS` map: `'dim-smart' → 'smart'`, `'dim-linear' → 'linear'`, `'dim-aligned' → 'aligned'`, `'dim-angular2L' → 'angular2L'`, `'dim-angular3P' → 'angular3P'`. Lifecycle `useEffect` watches `activeTool`: enters → `dimCreate.start(input)` once; leaves → `dimCreate.cancel()` + preview clear. `handlePoint/handleHover/handleCancel/handleKey` dispatch to the hook + push preview via `buildPreviewDimensionEntity(store.get()) → previewCanvasRef.drawPreview(entity)`. `resolveLayerId` = `getLayer(DXF_DEFAULT_LAYER)?.id ?? '0'` (Phase D1 fallback; real DIMSTYLE `targetLayer` enforcement ships in Phase D5).
  - **MOD** `src/subapps/dxf-viewer/ui/toolbar/types.ts` — 5 new `ToolType` literals added after `'stair'`: `'dim-smart' | 'dim-linear' | 'dim-aligned' | 'dim-angular2L' | 'dim-angular3P'`.
  - **MOD** `src/subapps/dxf-viewer/systems/tools/ToolStateManager.ts` — 5 new entries in the exhaustive `Record<ToolType, ToolInfo>`. Category `'drawing'`, `allowsContinuous: true` (AutoCAD DIM loop), `preservesOverlayMode: false`, `canInterrupt: true`.
  - **MOD** `src/subapps/dxf-viewer/canvas-v2/preview-canvas/PreviewRenderer.ts` — added `'dimension'` case to `render()` switch. Routes through `renderPreviewDimension` (Phase C2 deliverable) with DIMSTYLE resolved via `getDimStyleRegistry().getStyle(entity.styleId) ?? getActiveStyle()`. Preview color + opacity flow through the existing `renderOpts.color`/`renderOpts.opacity` plumbing. No PreviewCanvas API change — `drawPreview(entity, ...)` accepts the dim entity transparently.
  - **MOD** `src/subapps/dxf-viewer/hooks/drawing/useDrawingHandlers.ts` (411 → 430 LOC) — `useDimToolRouting` instantiated alongside `useUnifiedDrawing`. Three early-return branches in `onDrawingPoint`/`onDrawingHover`/`onDrawingCancel`: if `dimRouting.isDimTool` short-circuit through the dim routing API (snap applied identically — `applySnap(p)` → dim hook). Dim path bypasses the `addPoint`/`updatePreview` state machine of `useUnifiedDrawing` entirely.
  - **NEW** `src/subapps/dxf-viewer/hooks/dimensions/__tests__/dimension-create-state.test.ts` (~265 LOC, **21 tests / 7 groups**) — initialState shape + frozen guard, `requiredClickCount` per type, `start` (smart/manual/restart-mid-flow), `cursorMove` (idle no-op, smart detector drive, manual override pin), `click` (idle no-op, ClickRecord append with pickedEntity, smart no-hover fallback to 'linear', linear 3→commit-ready, angular3P 4→commit-ready, smart line→line angular2L upgrade), Tab/Space (smart increment + re-detect, manual mode no-op), `cancel` (returns initial frozen state).
  - **NEW** `src/subapps/dxf-viewer/hooks/dimensions/__tests__/dimension-create-entity-builder.test.ts` (~210 LOC, **12 tests / 2 groups**) — preview path (null when no type/no cursor, linear cursor-fills-next, linear caps at max, angular2L degenerate placeholder, angular3P 2 clicks + cursor), commit path (null until commit-ready, linear with real id/layerId/defPoints, association capture for picked clicks, angular2L 4 line endpoint associations, angular3P picked-only associations, radial returns null per scope).
  - **NEW** `src/subapps/dxf-viewer/hooks/dimensions/__tests__/useDimensionCreate.test.ts` (~210 LOC, **11 tests / 3 groups**) — dispatch surface (start smart/manual, onCursorMove, onClick, onKey Tab/Space/Escape, cancel + cached-start clear), commit + restart (commit fires `onDimensionCreated` with entity carrying generated id + resolved layerId + 3 defPoints, auto-restart in continuous mode preserves mode/styleId/manualOverride, no restart after cancel + re-start), angular3P 4-click flow (commits only at 4th click). `@/services/enterprise-id-convenience` mocked to return deterministic `'dim_test-id-123'`; `__resetDimensionCreateStoreForTests` in `beforeEach`/`afterEach` ensures isolated store state.
  - **Verification**: `npx jest src/subapps/dxf-viewer/hooks/dimensions --coverage` → **44/44 PASS**, ~10s. Coverage: `dimension-create-state.ts` **88.7% stmts / 87.5% branch / 100% funcs / 87.27% lines**; `useDimensionCreate.ts` **90% stmts / 70% branch / 91.66% funcs / 92.59% lines**; `dimension-create-entity-builder.ts` **80.64% stmts / 74.66% branch / 93.75% funcs / 86.66% lines**; `DimensionCreateStore.ts` **89.65% stmts / 100% branch / 86.66% funcs / 88.46% lines`. `useDimToolRouting.ts` 0% (composed-only glue layer — full coverage arrives with Phase E1 integration test on `useDrawingHandlers`). Brief target ≥80% on hook + reducer ✓ met. `npx tsc --noEmit | grep -E "useDimensionCreate|useDimToolRouting|dimension-create|DimensionCreateStore|useDrawingHandlers|preview-dimension-renderer|PreviewRenderer|toolbar/types|ToolStateManager"` → 0 errors introduced.
  - **Constraints honored**: zero `any` / `as any` / `@ts-ignore` in production code (one `as unknown as Parameters<...>[0]` cast in `useDimToolRouting` to bridge `PreviewCanvas.drawPreview`'s historical `ExtendedSceneEntity` signature with the dim entity it now also handles via the new 'dimension' switch case — would be removed with a follow-up PreviewCanvas API widening). All functions ≤40 LOC. All files ≤500 LOC (max useDrawingHandlers 430 after mod). Comments only on non-obvious "why" (microtask deferral rationale for commit re-entry, Q-A/Q-B/Q-C/Q-D design decisions inline in store + hook + builder file headers). ADR-040 compliance: `useDimensionCreate` hook does NOT subscribe to high-frequency stores (only the commit detector `useEffect`); `useDimToolRouting` does NOT subscribe either; preview rendering goes through the existing PreviewCanvas overlay (separate canvas layer, registerRenderCallback with HIGH priority); event handlers receive getters via `previewCanvasRef.current` access pattern (no stale snapshots).
  - **No integration yet** (Phase E1+ scope): NOT wired into ribbon Smart DIM button (Phase E1), NOT wired into contextual "Διάσταση" ribbon tab (Phase E2), NO radial / diameter / ordinate creation (Phase D2), NO baseline / continued chained creation (Phase D3), NO full modifier wiring (Tab/Space/Shift/Ctrl wiring only at hook surface — keyboard event routing from canvas = Phase D3), NO snap intelligence (Phase I), NO associativity observers (Phase J — data capture only at click time), NO DXF export (Phase H). Dim tools can be activated programmatically via `toolStateStore.selectTool('dim-smart' | 'dim-linear' | ...)` for manual smoke-testing pending the ribbon UI.
  - **Next**: Phase D2 — `useDimensionCreate` extension for radial family (radius / diameter / arcLength / joggedRadius) + ordinate (axis + datum). 2-click flows mostly; jogged radius needs 4 clicks (center, arcPoint, jogPoint, jogVertex). Reuses the existing store + reducer + entity builder modules — additions only, no breaking changes to the Phase D1 API.

- **2026-05-17 (Phase C2 DONE — Preview Renderer + Smart Detector + 40 unit tests)** — Group C Phase C2 implementata. Group C closed (C1 main-canvas dim renderer + C2 PreviewCanvas overlay + auto-detect engine). Phase C2 unlocks Phase D1 (`useDimensionCreate` hook orchestrator).
  - **NEW** `src/subapps/dxf-viewer/canvas-v2/preview-canvas/preview-dimension-renderer.ts` (~245 LOC) — pure function `renderPreviewDimension(params)`. Reuses the Phase B `buildDimensionGeometry` + Phase C1 `renderArrowhead` / `renderDimensionText` / `getArrowheadBlock` pipeline; overrides styling with preview tokens (`CAD_UI_COLORS.entity.preview` bright green + `OPACITY.HIGH`). Industry-aligned with `preview-entity-renderers.ts` convention: **solid stroke for the final-shape geometry, dashed only for helpers** (matches AutoCAD/Revit/Rhino — distinct preview color + solid = "under construction"). Color injection into the C1 text renderer via a cheap DIMSTYLE clone with `dimclrd`/`dimclre`/`dimclrt` set to `ACI_BYLAYER` (256) so `resolveDimColor()` falls back to the supplied `layerColour = opts.color`. `DimensionLookup` is NOT supplied — baseline/continued chain parents during initial creation aren't yet committed; builder throws are swallowed at `tryBuildGeometry` so partial def points render nothing (consistent with `DimensionRenderer.resolveFromEntity`). Optional `helperPath: Point2D[]` rubber-band polyline (Phase D1+) drawn with `LINE_DASH_PATTERNS.DASHED` + `OPACITY.MEDIUM`.
  - **NEW** `src/subapps/dxf-viewer/systems/dimensions/dim-smart-detector.ts` (~215 LOC) — pure function `detectDimensionType(ctx): DimensionType | null`. 4-tier state machine per ADR-362 §3 D4:
    1. **manualOverride** (highest) — ribbon dropdown explicit pick → returned verbatim, ignores hover.
    2. **spacePressCount** (mod-N) — Spacebar cycles ALL valid types for current hover (arc: radius→arcLength→diameter, circle: diameter→radius, line: linear→aligned).
    3. **tabPressCount** (mod-2) — Tab binary-toggles to the alternative (ADR D4: "Tab — Linear↔Aligned" generalised to all hover families).
    4. **base hover** (lowest) — line axis-aligned ⇒ `'linear'`, oblique ⇒ `'aligned'` (5° axis-alignment tolerance, `tan(5°) ≈ 0.087`); circle ⇒ `'diameter'`; arc ⇒ `'radius'`; polyline/lwpolyline ⇒ nearest-edge axis-aligned check via `distancePointToSegment` over all edges. Plus post-click upgrade: `firstClickedEntity` is line + hover different line ⇒ `'angular2L'` (modifiers do NOT transform the angular result — kept stable). Space precedence over Tab when both set. `shift` / `ctrl` are intentionally NOT detector inputs — they belong to the drawing pipeline (orthogonal constraint + snap override per ADR D4).
  - **NEW** `src/subapps/dxf-viewer/canvas-v2/preview-canvas/__tests__/preview-dimension-renderer.test.ts` (~265 LOC, **15 tests / 4 groups**) — mocked `CanvasRenderingContext2D` (records every draw call + style setter, mirrors `DimensionRenderer.test.ts`). Groups: dispatch + draw structure (linear/aligned/angular3P/radius/diameter + 'Ø' prefix), preview styling (default `BRIGHT_GREEN` color + `OPACITY.HIGH` alpha + opts override of both), helper polyline (dashed setLineDash only when `helperPath ≥ 2 pts`, ignored for `< 2 pts`), robustness (geometry-builder failures swallowed without throwing, save/restore wraps the render).
  - **NEW** `src/subapps/dxf-viewer/systems/dimensions/__tests__/dim-smart-detector.test.ts` (~250 LOC, **25 tests / 5 groups**) — Tier 1 manualOverride (verbatim + beats all modifiers + works without hover), Tier 4 base hover (horizontal/vertical/oblique line, ±5° axis tolerance, circle/arc/polyline/lwpolyline, polyline nearest-edge selection, polyline <2 verts ⇒ null, null on missing hover), post-click angular upgrade (line→different line ⇒ angular2L; same line ⇒ no upgrade; non-line clicked ⇒ no upgrade; modifiers don't transform angular), Tier 3 tab toggle (mod-2 binary alternate on line/circle/arc), Tier 2 space cycle (3-element arc cycle radius→arcLength→diameter, 2-element circle + line cycles, space precedence over tab).
  - **Verification**: `npx jest preview-dimension-renderer.test.ts dim-smart-detector.test.ts --coverage` → **40/40 PASS**, ~5.5s. Coverage: `preview-dimension-renderer.ts` **96.26% stmts / 88% branch / 100% funcs / 97.97% lines** (uncovered = exhaustive `never` default in `drawDimLineOrArc`, structurally unreachable). `dim-smart-detector.ts` **88% stmts / 87.01% branch / 100% funcs / 91.56% lines** (uncovered = exhaustive `never` defaults in `baseTypeFromHover` + `hoverCycleKey` + the `samePoint`/`projT` edge of `distancePointToSegment` zero-length branch). Aggregate **92.27% / 87.4% / 100% / 95.05%** — every file ≥80% on every metric (target met). `npx tsc --noEmit | grep -E "preview-dimension-renderer|dim-smart-detector"` → 0 errors introduced.
  - **Constraints honored**: zero `any` / `as any` / `@ts-ignore` in production code. All functions ≤40 LOC (`renderPreviewDimension` 19 LOC, `drawArrowheads` 22 LOC, `drawHelperPolyline` 17 LOC, `applyCycleAndToggle` 27 LOC, `detectDimensionType` 12 LOC). All files ≤500 LOC (max preview-renderer 245). Comments only on non-obvious "why" (DIMSTYLE clone to inject preview color, geometry-builder swallow for partial def points, Y-flip arc-angle convention reused from C1, Space-over-Tab precedence rationale). ADR-040 compliance: preview overlay is a separate PreviewCanvas pure-function call site — no main `DxfRenderer` pipeline modification, no `useSyncExternalStore` introduced, no orchestrator subscriptions added.
  - **No integration yet** (Phase D1+ scope): NOT wired into `useDimensionCreate.ts` (Phase D1), NOT wired into ribbon Smart DIM button (Phase E1), NOT wired into hover system (Phase D1 supplies the hook surface), NO snap/grips (Phase I), NO associativity (Phase J). Both modules are pure leaves consumed by the Phase D1 orchestrator.
  - **Design decisions captured**:
    - **Preview styling = solid + distinct color + helpers dashed** (industry convergence: AutoCAD/Revit/Rhino all use a distinct preview color + solid for the entity-being-constructed + dashed/alpha only for rubber-band helpers). Consistent with existing `preview-entity-renderers.ts` for line/circle/rect/polyline/arc.
    - **4-tier state machine, manualOverride at top** (FULL ENTERPRISE per Giorgio 2026-05-17 — combines AutoCAD Smart DIM hover prediction + Revit AutoDIM cycling + explicit user override escape hatch). Predictable: ribbon dropdown wins everything, then Spacebar cycles, then Tab toggles, then base hover.
    - **`alt` reserved, not used** (avoids Windows OS Alt-menu collision per AutoCAD convention; reserved for future ordinate quick-toggle in Phase J).
    - **Tab semantics = binary toggle, Space semantics = full cycle** (per ADR-362 D4 verbatim: "Tab (Linear↔Aligned)" + "Spacebar (switch type)"). Earlier draft (shift=toggle, Tab=cycle) revised to match ADR exactly.
  - **Next**: Phase D1 — `hooks/dimensions/useDimensionCreate.ts` (NEW) orchestrator that wires `dim-smart-detector` → `preview-dimension-renderer` into the drawing pipeline (`hooks/drawing/useDrawingHandlers.ts` mod). Linear/Aligned/Angular create flow end-to-end.

- **2026-05-17 (Phase C1 DONE — `DimensionRenderer` + DxfRenderer registry mod + 18 unit tests)** — Group C Phase C1 implementata. Persistent dim rendering operational across all 10 variants via the `DimGeometry` discriminated union (Phase B3 output).
  - **NEW** `src/subapps/dxf-viewer/rendering/entities/DimensionRenderer.ts` (~220 LOC) — `BaseEntityRenderer` subclass. Entry `render(entity, options)`: resolve via `resolveDimStyle` + `buildDimensionGeometry` → save → drawExtensionLines → drawDimLineOrArc (dispatch on `geometry.kind`: linear=strokeSegment, angular=strokeArc with Y-flip-aware sweep, radial=strokeLeader polyline) → drawArrowheads → drawPrimaryText → restore. `setDimensionLookup(lookup)` injects the per-frame parent `Map`-backed callback (used by baseline/continued builders); `setStyleRegistry(registry)` is a test seam (default = `getDimStyleRegistry()` singleton); `setLayerColour(colour)` forwards owning-layer hex for ByLayer/ByBlock sentinel resolution. `getGrips` + `hitTest` stubs return empty/false (Phase I delivers grip set + geometry-aware hit). Malformed-geometry throws (e.g. baseline parent missing) are swallowed at `resolveFromEntity` boundary so one broken dim doesn't crash the scene render.
  - **NEW** `src/subapps/dxf-viewer/rendering/entities/dimension/dim-color-resolver.ts` (~35 LOC) — `resolveDimColor(aci, layerColour)`. ACI 0 (ByBlock) + 256 (ByLayer) fall back to the supplied layer colour (block resolution = Phase H). ACI 1-255 via `settings/standards/aci.ts` palette SSoT.
  - **NEW** `src/subapps/dxf-viewer/rendering/entities/dimension/dim-arrowhead-renderer.ts` (~125 LOC) — `renderArrowhead(ctx, block, params)`. Stamps `ArrowheadBlockDefinition.geometry` (unit-space primitives — line/triangle/circle, Phase A2) at a screen anchor via translate→rotate→scale. Direction angle inverted for Y-flip parity with text rotation convention. `flipOnSecondArrow` blocks (architecturalTick / oblique / openSlanted / integral) get an extra 180° on side=2. Zero-length direction = single-arrow no-op (radial/ordinate convention). `lineWidth = 1 / unitPx` keeps strokes at 1px regardless of zoom.
  - **NEW** `src/subapps/dxf-viewer/rendering/entities/dimension/dim-text-renderer.ts` (~100 LOC) — `renderDimensionText`. Composes text via Phase A3 formatters (`composePrimaryText` for linear/radial, `formatAngularMeasurement` for angular). Radial gets 'Ø '/'R ' prefix only when user text is the measured token (`undefined` / `<>`). Empty user text suppresses draw. Screen height = `dimtxt × view.scale`; rotation negated for canvas Y-flip (matches `TextRenderer` ADR-344 convention). Font via `buildUIFont(screenHeight, style.textFontFamily)`. Text color via `resolveDimColor(style.dimclrt, layerColour)`.
  - **MOD** `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/dxf-types.ts` — `DxfEntity.type` extended with `'dimension'`. New `DxfDimension extends DxfEntity { type:'dimension'; dimensionEntity: DimensionEntity }` wrapper (parallel to `DxfStair.stairEntity`). Added to `DxfEntityUnion`.
  - **MOD** `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfRenderer.ts` — `toEntityModel` switch case `'dimension'` unwraps `dxfDim.dimensionEntity` into the renderer pipeline. `render()` calls `entityComposite.setDimensionLookup(this.buildDimensionLookup(scene.entities))` once per frame. `buildDimensionLookup(entities)` private: O(n) scene scan filtered by `type==='dimension'` → `Map<id, DimensionEntity>` → returned as O(1) closure. Imports added: `DimensionEntity`, `DimensionLookup`.
  - **MOD** `src/subapps/dxf-viewer/rendering/core/EntityRendererComposite.ts` — `DimensionRenderer` registered under `'dimension'` key. `setDimensionLookup(lookup)` + `setDimensionLayerColour(colour)` relay setters forward state to the dim leaf when registered (no-op otherwise — defensive for partial test setups).
  - **NEW** `src/subapps/dxf-viewer/rendering/entities/__tests__/DimensionRenderer.test.ts` (~370 LOC, **18 tests / 6 groups**) — mocked `CanvasRenderingContext2D` (records every draw call + style setter). Coverage on Phase C1 files: `DimensionRenderer.ts` **94.11% / 84.61% / 89.47% / 96.8%**, `dim-arrowhead-renderer.ts` **91.3% / 81.25% / 100% / 92.85%**, `dim-color-resolver.ts` **80% / 63.63% / 100% / 80%**, `dim-text-renderer.ts` **92.1% / 72.72% / 100% / 94.11%**, aggregate **92.34% / 78.4% / 92.85% / 94.44%** — every file ≥80% on every code metric (the 78.4% aggregate branch reflects untested ACI out-of-range + alt-format branches, acceptable for C1). Test groups: dispatch + draw structure (linear/aligned/angular3P/radius/diameter + 'Ø' / 'R' prefix), userText suppression, DIMSTYLE colour resolution (per-entity override of dimclrd + dimclrt), extension line suppression (suppressExtLine1/2), ordinate single arrow, chained dim lookup (baseline invokes callback, missing parent doesn't throw), arrowhead block variants (closedFilled fill / dot arc / closedBlank stroke), Phase I stubs (getGrips empty + hitTest false).
  - **Verification**: `npx jest src/subapps/dxf-viewer/rendering/entities/__tests__/DimensionRenderer.test.ts` → **18/18 PASS**, ~7s. `npx tsc --noEmit` filter `DimensionRenderer|dim-color-resolver|dim-arrowhead-renderer|dim-text-renderer|DxfRenderer|EntityRendererComposite|dxf-types` → 0 new errors from Phase C1 work. (Pre-existing TS2322 in `DxfRenderer.toEntityModel` cases line/circle/polyline/arc/angle-measurement carry over from HEAD — unchanged by C1.)
  - **Constraints honored**: zero `any` / `as any` / `@ts-ignore` in production code (one `as unknown as Entity` cast in `DxfRenderer.toEntityModel` 'dimension' case — same pattern as existing 'text'/'stair' cases, justified by the discriminated-union widening of `DxfEntity.type`). All functions ≤40 LOC (`render` 14 LOC, `drawDimLineOrArc` 18 LOC, `drawArrowheads` 23 LOC, helpers smaller). All files ≤500 LOC (max DimensionRenderer 220). Comments only on non-obvious "why" (canvas Y-flip rotation/sweep parity, single-arrow zero-vector skip, lineWidth unit correction under scale transform, malformed-geometry swallow). ADR-040 micro-leaf compliance: zero new `useSyncExternalStore` on orchestrators; dim renderer pulls per-frame state via setter injection from `EntityRendererComposite`, not store subscriptions.
  - **DimensionLookup architecture decision**: callback signature reused from Phase B (single SSoT type — `DimensionLookup = (id: string) => DimensionEntity | undefined`) backed by an O(1) `Map` built once per frame by `DxfRenderer.render()`. Renderer stays pure (no store coupling, no scene scan); caller controls implementation (Map for prod perf, mock callback for tests). Rejected alternatives: A1 array+find (O(n) per chained dim), A3 store callback (couples renderer to scene store, violates pure-leaf invariant).
  - **Out of scope for C1** (reserved hooks): Center mark drawing (Phase L1 — `centerMarkExtent` field already carried through `RadialDimGeometry`), DIMBREAK / DIMSPACE gaps (Phase K), tolerance / limits / alt-unit stacking (Phase G2/G3), snap (Phase I), grips (Phase I — stubs return `[]`), associativity observers (Phase J), DXF entity-driven annotation scaling (currently Revit-style baked via `DIMSCALE`, D3).
  - **Next**: Phase C2 — Preview Renderer + Smart Detector (`canvas-v2/preview-canvas/preview-dimension-renderer.ts` + `systems/dimensions/dim-smart-detector.ts`). Live preview during creation flow + hover auto-detect engine selecting the most-appropriate dim type from the picked geometry.

- **2026-05-17 (Phase B3 DONE — Ordinate + Baseline + Continued (chained) geometry builders → 10/10 dim types complete)** — Group B Phase B3 implementata. Group B fully closed (B1+B2+B3 cover all 10 DIMENSION variants).
  - **NEW** `src/subapps/dxf-viewer/systems/dimensions/builders/ordinate-builder.ts` (~85 LOC) — `buildOrdinateGeometry`. `defPoints=[featurePoint]`, `axis: 'x' | 'y'` selects coordinate being read out, `datum: Point2D` is the user origin. `axis='x'` → `measurement = |feature.x - datum.x|`, leader VERTICAL; `axis='y'` → `measurement = |feature.y - datum.y|`, leader HORIZONTAL. Returns `LinearDimGeometry` (reuses `kind:'linear'` shape; renderer dispatches by kind) with `extLine1/2 = null` (ordinate has no perpendicular ext lines — only a tick at the feature point, per AutoCAD convention). Single-arrow convention from `radial-builder`: `arrowAnchor2 == arrowAnchor1`, `arrowDirection2 = {x:0,y:0}`. Default leader length when `entity.textMidpoint` absent = `style.dimasz × 8` (factor consistent with AutoCAD ordinate leader). When `textMidpoint` provided, leader endpoint follows it directly; otherwise default direction = `+Y` (for `axis='x'`) or `+X` (for `axis='y'`). `textAnchor` past the leader end by `style.dimgap` along the leader direction (defaults), or = `textMidpoint` (override). Degenerate throw: feature coincides with datum on measured axis → `Degenerate ordinate dim`.
  - **NEW** `src/subapps/dxf-viewer/systems/dimensions/builders/chained-builder.ts` (~200 LOC) — `buildBaselineGeometry` + `buildContinuedGeometry`. Both delegate to `buildLinearGeometry` via a synthetic `LinearDimensionEntity` (rotation derived from inherited axis via `vectorAngle / DEG_TO_RAD`, `defPoints` reconstructed from chain resolution). **Parent resolution = lazy callback (Option A)**: orchestrator-level `DimensionLookup = (id: string) => DimensionEntity | undefined` passed through. Recursion via internal `resolveChain(parentId, style, lookup): ResolvedChain` walks back through nested baseline/continued ancestors until a linear/aligned root. `ResolvedChain` carries `{axis, perpOutward, baselineOrigin, continueOrigin, parentDimLineOffset}`. `perpOutward` derived from sign of `dot(rootDimLineRef - extOrigin1, perpendicular(axis))` (negated when negative, ensuring outward direction). Each baseline ancestor contributes one `style.dimdli` step to `parentDimLineOffset`; continued ancestors keep the offset but advance `continueOrigin` to their own `defPoints[0]` (newExtOrigin2). **DIMDLI source = current entity's style** (not ancestor's) — chain spacing follows the chained entity's DIMSTYLE, predictable when user re-styles a baseline. Baseline new offset = `parentDimLineOffset + style.dimdli`. Continued uses parent offset unchanged. Synthetic linear defPoints: baseline = `[baselineOrigin, newExtOrigin, dimLineRef]`; continued = `[continueOrigin, newExtOrigin, dimLineRef]`. `dimLineRef = baselineOrigin + perpOutward × offset`. Degenerate / error throws: lookup missing (`requires a DimensionLookup`), parent not found (`Parent dim 'X' not found`), unsupported parent type (`cannot anchor a baseline/continued chain` — e.g. radius/angular/ordinate parent), aligned root with coincident ext origins, root dim line passes through baseline origin (zero `signedOffset` → no outward direction derivable).
  - **MOD** `src/subapps/dxf-viewer/systems/dimensions/dim-geometry-builder.ts` (~165 LOC) — added `DimensionLookup` exported type alias. `buildDimensionGeometry(entity, style, lookup?)` signature extended with optional `lookup` (required only for `baseline`/`continued`; other variants ignore it). Switch extended with `ordinate` / `baseline` / `continued` cases. Default branch replaced with exhaustive `never` check (compile-time guard against future union additions). 10/10 dimension types now wired.
  - **MOD** `src/subapps/dxf-viewer/systems/dimensions/__tests__/linear-aligned-builder.test.ts` — replaced the orchestrator throw test for `ordinate` (Phase B2 "not implemented") with a dispatch success test (Phase B3 returns `kind:'linear'`, measurement=25).
  - **NEW** `src/subapps/dxf-viewer/systems/dimensions/__tests__/ordinate-builder.test.ts` (~130 LOC, 10 tests) — axis=x +Y default leader, axis=y +X default leader, negative coord absolute measurement, `textMidpoint` override, single-arrow convention assertions, `extLine1/2 === null`, degenerate axis=x throw, degenerate axis=y throw, DIMTIH=true → textRotation=0, default leader length = `dimasz × 8`.
  - **NEW** `src/subapps/dxf-viewer/systems/dimensions/__tests__/chained-builder.test.ts` (~280 LOC, 15 tests) — Baseline: single chain off linear root (dim line offset by DIMDLI), triple chain (offset × 3), rotation=90 vertical root (axis propagation), aligned 3-4-5 root (non-axis-aligned propagation with full perpOutward math), parent missing → throw, radius parent → "cannot anchor", root dim line through baseline origin → throw, lookup undefined → throw, aligned root coincident → throw, custom `dimdli` from chained style honoured. Continued: single off linear (same dim line, chains from parent extOrigin2), c→c chain (advances ext, same dim line), continued off baseline (inherits offset), parent missing → throw, lookup undefined → throw, radius parent → throw.
  - **Verification**: `npx jest src/subapps/dxf-viewer/systems/dimensions/__tests__/` → **71/71 PASS**, ~14s. Coverage on Phase B3 files (per `--collectCoverageFrom` filter `systems/dimensions/**/*.ts`): `ordinate-builder.ts` **100% / 100% / 100% / 100%**, `chained-builder.ts` **100% / 100% / 100% / 100%**, `dim-geometry-builder.ts` (orchestrator) **80% / 75% / 100% / 80%** (uncovered = exhaustive `never` default branch, structurally unreachable). All B1+B2 builders unchanged in coverage (linear-aligned 97.43%/93.75%, angular 100%/89.28%, radial 100%/95.83%, shared-helpers 93.33%/90% — every metric still ≥80%). `npx tsc --noEmit` filter `dim-geometry-builder|linear-aligned-builder|ordinate-builder|chained-builder`: 0 errori introdotti.
  - **Constraints honored**: zero `any` / `as any` / `@ts-ignore` in production code (tests cast fixture literals to entity types — same pattern as Phase B1/B2). All functions ≤40 LOC (`resolveChain` 22 LOC, `buildBaselineGeometry` 18 LOC, `buildContinuedGeometry` 18 LOC, `buildOrdinateGeometry` 27 LOC, helpers smaller). All files ≤500 LOC (max chained-builder 215). Comments only on non-obvious "why" (single-arrow convention reuse, lazy lookup rationale, current-DIMSTYLE-wins for DIMDLI source, ordinate AutoCAD no-ext-line convention). No integration with renderer (Phase C1), tool handlers (Phase D1), registry/store/scene builder.
  - **Group B closure**: B1 (linear/aligned, 2 types) + B2 (angular×2 + radial×4, 6 types) + B3 (ordinate + baseline + continued, 3 types) = **10/10 dimension variants implemented** at the pure-geometry layer. Discriminated union `DimGeometry = LinearDimGeometry | AngularDimGeometry | RadialDimGeometry` covers all variants — ordinate + baseline + continued all reduce to `LinearDimGeometry` (zero new variants needed). All builders pure functions, fully unit-tested, ready for Phase C1 renderer.
  - **Next**: Phase C1 — `DimensionRenderer.ts` consuming `DimGeometry` discriminated union, dispatching by `kind` to per-variant draw passes (line/arrow/text/extension). Bound into `DxfRenderer` entity render pipeline (ADR-040 micro-leaf pattern).

- **2026-05-17 (Phase B2 DONE — Angular + Radial geometry builders + DimGeometry discriminated union)** — Group B Phase B2 implementata, 5 dim types added on top of B1 (linear/aligned).
  - **NEW** `src/subapps/dxf-viewer/systems/dimensions/builders/shared-geometry-helpers.ts` (~70 LOC) — Boy Scout extract from B1 (third consumer appeared): `rotateVector`, `intersectLines` (ε=1e-12, exported `COLINEAR_EPSILON`), `perpendicularOf`, `computeTextAnchor`, `computeTextRotation`. Consumed by B1 linear-aligned-builder + B2 angular-builder + B2 radial-builder. ADR-065 SSoT pattern, zero duplication.
  - **NEW** `src/subapps/dxf-viewer/systems/dimensions/builders/angular-builder.ts` (~225 LOC) — `buildAngular2LGeometry` + `buildAngular3PGeometry`. defPoints: 2L=`[line1.a, line1.b, line2.a, line2.b, arcPoint]`; 3P=`[vertex, ray1End, ray2End, arcPoint]`. Dim "line" is an ARC centred at vertex with `arcRadius = distance(vertex, arcPoint)`. `arcStartAngle = vectorAngle(vertex→rayEndpoint1)`, `arcEndAngle = arcStartAngle + signedSweep` (unwrapped — sign tells CCW/CW). `measurementValue` = |signedSweep| in **radians**. For 2L: vertex via `intersectLines`, ray endpoints picked by `pickRayEndpoint` (endpoint with positive projection onto `(arcPoint - vertex)` direction). Sweep direction via `computeSignedSweep` — picks short or long arc so dimensioned arc always contains arcPoint (reflex case handled). Arrows tangent OUTWARD via `arrowDirections({sweepSign})`: arrow1 = `s*(sin(start), -cos(start))`, arrow2 = `s*(-sin(end), cos(end))`. Ext lines bridge endpoint→arc tangent point with DIMEXO/DIMEXE (null when endpoint outside arc). `textAnchor` = arc midpoint (or `entity.textMidpoint`), `textRotation` = tangent at midAngle via shared `computeTextRotation`. Degenerate throws: parallel lines (`Degenerate angular2L: lines parallel`) + arcPoint==vertex (`arcPoint coincides with vertex`).
  - **NEW** `src/subapps/dxf-viewer/systems/dimensions/builders/radial-builder.ts` (~200 LOC) — `buildRadiusGeometry` + `buildDiameterGeometry` + `buildArcLengthGeometry` + `buildJoggedRadiusGeometry`. All return `RadialDimGeometry` (polyline `leaderPath` + arrows + `isDiameter` flag + `centerMarkExtent = style.dimcen` for Phase L1). Radius: `defPoints=[center, arcPoint]`, `measurementValue=distance(center,arcPoint)`, leader 2-vertex outward by `entity.leaderLength ?? style.dimasz*3`, single arrow at arcPoint (`arrowDirection2 = {x:0,y:0}` signals "no arrow"). Diameter: `defPoints=[side1, side2]`, leader 2-vertex chord through midpoint, two arrows outward, `isDiameter=true`. ArcLength: `defPoints=[center, arcStart, arcEnd]`, validates `|radiusStart - radiusEnd| ≤ 1e-6`, `measurementValue = radius × |signedSweep|`, leader = 9-vertex arc polyline (`sampleArc` 8 segments), arrows tangent outward at arc ends via shared `arcTangentOutward`. JoggedRadius: `defPoints=[center, arcPoint, jogPoint, jogVertex]`, `measurementValue=distance(center,arcPoint)` (full radius), leader 4-vertex zig-zag `[arcPoint, jogVertex, jogPoint, tail]` where `tail = jogPoint + unit(jogVertex→jogPoint) * dist(jogVertex,jogPoint)` (mirror extension), single arrow at arcPoint outward. **Convention deviation**: spec prompt suggested arrow "inward" for jogged but radial-family CAD convention is outward (consistent with `buildRadiusGeometry`) — adopted outward for consistency. Degenerate throws across the family: arcPoint==center, sides coincide, arcStart/arcEnd radii differ, zero radius.
  - **MOD** `src/subapps/dxf-viewer/systems/dimensions/dim-geometry-builder.ts` (~135 LOC) — `DimGeometry` refactored to **discriminated union** `LinearDimGeometry | AngularDimGeometry | RadialDimGeometry` (all extend `DimGeometryBase` with shared `arrowAnchor*`/`arrowDirection*`/`textAnchor`/`textRotation`/`measurementValue`). Variant-specific fields: linear=`dimLine`+`extLine1/2`; angular=`arcCenter`+`arcRadius`+`arcStartAngle`+`arcEndAngle`+`extLine1/2`; radial=`leaderPath`+`isDiameter`+`centerMarkExtent?`. Switch extended with `angular2L`/`angular3P`/`radius`/`diameter`/`arcLength`/`joggedRadius` cases. `ordinate`/`baseline`/`continued` still throw with updated sentinel `not implemented in Phase B2 (chained/ordinate land in Phase B3)`.
  - **MOD** `src/subapps/dxf-viewer/systems/dimensions/builders/linear-aligned-builder.ts` — imports shared helpers from `./shared-geometry-helpers.ts` (deleted local copies of `rotateVector`/`intersectLines`/`perpendicularOf`/`computeTextAnchor`/`computeTextRotation`). Return type narrowed from `DimGeometry` to `LinearDimGeometry` (assembleGeometry now sets `kind:'linear'`). No behavioural change.
  - **MOD** `src/subapps/dxf-viewer/systems/dimensions/__tests__/linear-aligned-builder.test.ts` — replaced 2 orchestrator throw tests (`radius`/`angular2L` "not implemented") with **6 dispatch success tests** (angular2L, angular3P, radius, diameter, arcLength, joggedRadius) + 1 throw test for `ordinate` ("not implemented in Phase B2"). All 17 B1 tests still pass unchanged.
  - **NEW** `src/subapps/dxf-viewer/systems/dimensions/__tests__/angular-builder.test.ts` (~210 LOC, 11 tests) — Angular2L: perp 90° (full assertions on arcRadius, anchors, arrow tangent dirs), parallel→throw, oblique 60°, arcPoint==vertex→throw, suppressExt flags. Angular3P: right 90°, obtuse 135°, reflex (long arc 3π/2 via CW signedSweep), textMidpoint override, ext line bridging logic (built when `radius>endpointDist`, null when `radius<endpointDist`).
  - **NEW** `src/subapps/dxf-viewer/systems/dimensions/__tests__/radial-builder.test.ts` (~230 LOC, 11 tests) — Radius: simple +X (leader length default = `dimasz*3`, single-arrow zero vector), leaderLength override, degenerate→throw, textMidpoint override. Diameter: horizontal chord (2 arrows outward, isDiameter=true), degenerate→throw. ArcLength: quarter circle (50π, 9-vertex leader, tangent arrows), hemicircle (100π), radii differ→throw, zero radius→throw. JoggedRadius: 4-vertex leaderPath with tail extension formula, degenerate→throw.
  - **Verification**: `npx jest src/subapps/dxf-viewer/systems/dimensions/__tests__/` → **45/45 PASS**, ~14s. Coverage on Phase B2 files (per `--collectCoverageFrom` filter): `dim-geometry-builder.ts` **100% stmts / 100% branch / 100% funcs / 100% lines**, `angular-builder.ts` **100% / 89.28% / 100% / 100%**, `radial-builder.ts` **100% / 95.83% / 100% / 100%**, `shared-geometry-helpers.ts` **90% / 80% / 100% / 100%**, `linear-aligned-builder.ts` (post-refactor) **97.43% / 93.75% / 100% / 100%** — every file ≥80% on every metric. `npx tsc --noEmit` filter `dim-geometry-builder|linear-aligned-builder|angular-builder|radial-builder|shared-geometry-helpers`: 0 errori introdotti.
  - **Constraints honored**: zero `any` / `as any` / `@ts-ignore` (test files use `as unknown as Parameters<...>[0]` only to construct deliberately-invalid orchestrator dispatch fixtures — production code clean). All functions ≤40 LOC (`assembleAngular` post-refactor 26 LOC, `buildArcLengthGeometry` 22 LOC, `buildJoggedRadiusGeometry` 17 LOC, others smaller). All files ≤500 LOC (max radial-builder 200). Comments only on non-obvious "why" (defPoints semantic, sweep convention, single-arrow zero-vector flag). No integration with renderer (Phase C1), tool handlers (Phase D1), registry/store/scene builder.
  - **Next**: Phase B3 — Ordinate + Baseline + Continued (chained) builders (`builders/ordinate-builder.ts` + `builders/chained-builder.ts` + tests).

- **2026-05-17 (Phase B1 DONE — Linear + Aligned + Rotated geometry builder)** — Group B Phase B1 implementata.
  - **NEW** `src/subapps/dxf-viewer/systems/dimensions/dim-geometry-builder.ts` (~70 LOC) — orchestrator esporta `DimGeometry` + `DimLineSegment` + `buildDimensionGeometry(entity, style)`. Dispatch via switch su `dimensionType`; Phase B1 chiude solo `linear` + `aligned`, le altre varianti tirano `Error` con prefix sentinel `[dim-geometry-builder]` (Phase B2/B3 estenderanno il switch senza toccare il payload).
  - **NEW** `src/subapps/dxf-viewer/systems/dimensions/builders/linear-aligned-builder.ts` (~205 LOC) — `buildLinearGeometry` + `buildAlignedGeometry`. defPoints semantic: `[extOrigin1, extOrigin2, dimLineRef]`. Linear usa `rotation` (deg) per l'asse della dim line; `obliqueAngle?` (deg, default 0 = perpendicolare) inclina le ext line ruotando il vettore perpendicolare. Aligned ricava l'asse da `unit(extOrigin2 - extOrigin1)`. Foot points = intersezione line-line tra (ext origin + ext direction) e (dimLineRef + axis). `measurementValue` = `|dot(extOrigin2 - extOrigin1, axis)|` per linear, `distance(extOrigin1, extOrigin2)` per aligned. Helper module-local: `rotateVector`, `intersectLines` (epsilon 1e-12), `buildExtLine` (DIMEXO start offset + DIMEXE end overshoot, null se origine coincide col foot), `computeTextAnchor` (entity.textMidpoint override → midpoint dim line), `computeTextRotation` (DIMTIH=true → 0; altrimenti angle dim line normalizzato a (-π/2, π/2] per readability), `perpendicularOf`, `assembleGeometry` (back-half condivisa tra le due varianti — riduce duplicazione e onora `suppressExtLine1/2`). Vector math (`addPoints`, `subtractPoints`, `scalePoint`, `getUnitVector`, `dotProduct`, `vectorAngle`, `calculateDistance`) tutta importata da `rendering/entities/shared/geometry-vector-utils.ts` (ADR-065 SSoT) — zero duplicati.
  - **NEW** `src/subapps/dxf-viewer/systems/dimensions/__tests__/linear-aligned-builder.test.ts` (~240 LOC, 17 test) — copre i 10 casi spec del plan + 7 extra:
    1. horizontal linear (rot=0) measurement+dimLine+ext lines verticali ✓
    2. vertical linear (rot=90) measurement+dimLine+ext lines orizzontali ✓
    3. rotated linear (rot=30) projection math (`100·cos30° = 50√3`) ✓
    4. negative direction (extOrigin2 sinistra di extOrigin1) → measurement positivo, arrows invertiti ✓
    5. textMidpoint override ✓
    6. suppressExtLine1=true → extLine1 null, extLine2 presente ✓
    7. suppressExtLine2=true → extLine2 null, extLine1 presente ✓
    8. DIMEXO=0 → ext line start su ext origin esatta ✓
    9. obliqueAngle=45 → ext lines tilted, measurement preservato ✓
    10. degenerate linear (ext dir parallela a axis, obliqueAngle=90 su rot=0) → throw `Degenerate linear dim` ✓
    11. aligned 3-4-5 triangle → measurement=100, foot positions calcolate ✓
    12. aligned horizontal degenera a comportamento linear orizzontale ✓
    13. aligned con ext origins coincidenti → throw `Degenerate aligned dim` ✓
    14-15. orchestrator dispatch linear/aligned ✓
    16-17. orchestrator throw per `radius`/`angular2L` ("not implemented in Phase B1") ✓
  - **Verification**: `npx jest linear-aligned-builder.test.ts` → 17/17 PASS, ~3s. Coverage isolato sui 2 builder file: **stmts 95.58% / branch 89.65% / funcs 100% / lines 100%** (target ≥80% rispettato). Uncovered: una branch su `computeTextRotation` (a ≤ -π/2 ramo) — angolo negativo grande non raggiunto nei test correnti (acceptable, sarà esercitato in Phase C1 rendering test). `npx tsc --noEmit` filter `dim-geometry-builder|linear-aligned-builder`: 0 errori.
  - **Constraints honored**: zero `any` / `as any` / `@ts-ignore` (in produzione; test ha 1 `as unknown as` per costruire entity invalida apposta per testare orchestrator throw). Funzioni ≤40 LOC ciascuna (`buildLinearGeometry` 22 LOC, `buildAlignedGeometry` 17 LOC, `assembleGeometry` 28 LOC, helper ≤10 LOC). File ≤500 LOC (orchestrator 70, builder 205, test 240). Comments solo su semantica non ovvia (DimGeometry convention block, defPoints semantic). No integrazione con renderer (Phase C1), tool handlers (Phase D1), registry/store/scene builder.
  - **Next**: Phase B2 — Angular (2-line + 3-point) + Radial (radius/diameter/arcLength/joggedRadius) geometry builders (`builders/angular-builder.ts` + `builders/radial-builder.ts` + tests).

- **2026-05-17 (Phase A3 DONE — Text Formatter + i18n skeleton)** — Foundation Phase A3 implementata.
  - **NEW** `src/subapps/dxf-viewer/systems/dimensions/dim-text-formatter.ts` (185 LOC) — pure formatters consuming the resolved `DimStyle`:
    - `formatLinearMeasurement(valueMm, style)` — DIMLFAC → DIMRND → DIMLUNIT/DIMDEC → DIMDSEP → DIMPOST.
    - `formatAngularMeasurement(radians, style)` — DIMAUNIT/DIMADEC → DIMDSEP (no DIMLFAC for angles).
    - `formatAlternateUnit(valueMm, style)` — DIMALT only, wraps in `[…]` per AutoCAD convention, applies DIMALTF/DIMALTRND/DIMALTU/DIMALTD/DIMAPOST. Multiplication semantic (AutoCAD spec): for mm-base drawings set DIMALTF ≈ 0.03937 to get inches.
    - `formatToleranceText(style)` — DIMTOL only, returns `{plus, minus}` strings with DIMTDEC precision and DIMDSEP. Renderer applies DIMTFAC font scale.
    - `formatLimitsText(measurementMm, style)` — DIMLIM only, returns `{upper, lower}` = measurement ± DIMTP/DIMTM (DIMTM stored negative).
    - `composePrimaryText(valueMm, style, userText?)` — `''` suppress, `undefined`/`'<>'` measured, otherwise literal with `<>` substitution.
    - Reuses ADR-082 `formatter-unit-formats.ts` helpers (`formatScientific`/`formatEngineering`/`formatArchitectural`/`formatFractional`/`formatDMS`/`formatGrads`/`formatSurveyor`) — no duplication. Decimal output uses native `toFixed`/`toExponential` then `swapDecimalSeparator` for DIMDSEP control (FormatterRegistry's locale-driven separator wouldn't honour DIMSTYLE).
    - Internal helpers: `clampPrecision(0..8)`, `applyRounding(v, rnd)`, `swapDecimalSeparator(s, sep)`, `applyDimPost(post, value)` (`[]` placeholder substitution, plain suffix fallback).
  - **NEW** `src/i18n/locales/el/dxf-viewer-dimensions.json` — 76 keys, **pure Greek** (zero English words outside standard names "ISO 129"/"ASME Y14.5"). Sub-namespaces (ADR-280): `panel.*` (15 incl. `panel.sections.*`), `templates.*` (3), `ribbon.*` (12), `contextualTab.*` (5), `contextMenu.*` (8), `arrowheads.*` (20), `units.*` (5), `angularUnits.*` (5), `errors.*` (3).
  - **NEW** `src/i18n/locales/en/dxf-viewer-dimensions.json` — 76 keys, English mirror. Count parity verified (76/76, keys identical).
  - **Path deviation noted**: ADR/plan referenced `src/subapps/dxf-viewer/i18n/locales/{el,en}/dimensions.json`, but DXF Viewer locales are centralized under `src/i18n/locales/{el,en}/` per existing convention (`dxf-viewer.json`, `dxf-viewer-panels.json`, `dxf-viewer-wizard.json`, `dxf-viewer-shell.json`, `dxf-viewer-settings.json`, `dxf-viewer-guides.json`). New file follows `dxf-viewer-dimensions.json` naming pattern.
  - **Constraints honored**: zero `any` / `as any` / `@ts-ignore` (single `as Precision` after `clampPrecision` runtime guard, type-narrowing only). Functions ≤40 LOC each. File ≤500 LOC (185). Comments only on non-obvious "why". No hardcoded `defaultValue: 'literal'` (locale files exist before any `t('dimensions.X')` consumer). No integration with rendering pipeline / UI / i18n hook reachability registry (Phase F1 wires the panel hook).
  - **Smoke verification (logic walkthrough)**:
    - `formatLinearMeasurement(1234.567, ISO_129)` → toFixed(2)="1234.57" → dimdsep ',' → `"1234,57"` ✓
    - `formatLinearMeasurement(1234.567, ASME_Y14_5)` → `"1234.57"` ✓
    - `formatAngularMeasurement(Math.PI/4, ISO_129)` → 45° decimal, dimadec=0 → `"45°"` ✓
    - `formatToleranceText({dimtol:true, dimtp:0.05, dimtm:-0.05, dimtdec:2, dimdsep:','})` → `{plus:"+0,05", minus:"-0,05"}` ✓
    - JSON parse both locales OK, 76/76 keys identical.
  - tsc `--noEmit` filter `dim-text-formatter|dxf-viewer-dimensions`: pulito (no new errors).
  - **Next**: Phase B1 — Linear+Aligned+Rotated geometry builder (`systems/dimensions/dim-geometry-builder.ts` orchestrator + `builders/linear-aligned-builder.ts` + unit tests).

- **2026-05-17 (Phase A2 DONE — DIMSTYLE Templates + Registry + Resolver + Arrowhead Blocks)** — Foundation Phase A2 implementata.
  - **NEW** `src/subapps/dxf-viewer/systems/dimensions/dim-style-templates.ts` (209 LOC) — 3 built-in `DimStyle` templates con deterministic IDs (`dimstyle_iso_129` / `dimstyle_asme_y14_5` / `dimstyle_arch_us`): `ISO_129_TEMPLATE` (oblique tick, text above & aligned, dimdsep ',', layer 'ΔΙΑΣΤΑΣΕΙΣ', ACI 4 cyan), `ASME_Y14_5_TEMPLATE` (closedFilled, text centered & horizontal, dimdsep '.', layer 'A-ANNO-DIMS', ACI 5 blue), `ARCHITECTURAL_US_TEMPLATE` (hybrid: closedFilled + text above & aligned, dimdsep '.', ACI 5). Shared 60-field defaults via `sharedDefaults()` helper. `BUILTIN_DIM_STYLES` array per bulk init. `DEFAULT_ACTIVE_DIM_STYLE_ID = ISO_129` (D2 Greek default).
  - **NEW** `src/subapps/dxf-viewer/systems/dimensions/dim-style-registry.ts` (143 LOC) — `DimStyleRegistry` class: `getStyle(id)`, `getAllStyles()`, `getActiveStyleId()` / `setActiveStyleId(id)` / `getActiveStyle()` (with fallback), `createCustomStyle(input)` via `generateDimStyleId()` (N.6 enterprise IDs), `updateCustomStyle(id, patch)`, `deleteCustomStyle(id)` (throws on built-in), `duplicateStyle(sourceId, newName)`, `subscribe(listener)` con `Set<RegistryListener>` (HoverStore pattern). Pre-populated con 3 built-in nel constructor. Lazy session singleton via `getDimStyleRegistry()` + `__setDimStyleRegistryForTests()` per testability. In-memory only (persistence Phase F).
  - **NEW** `src/subapps/dxf-viewer/systems/dimensions/dim-style-resolver.ts` (41 LOC) — Pure functions per render-time resolution: `resolveDimStyle(entity, registry)` merge order (built-in fallback → base → overrides), `resolveDimStyleField<K>(entity, registry, field)` fast-path single-field lookup.
  - **NEW** `src/subapps/dxf-viewer/systems/dimensions/dim-arrowhead-blocks.ts` (357 LOC) — 20 arrowhead block definitions AutoCAD standard set: `none`, `closedFilled`, `closedBlank`, `closed`, `dot`, `dotSmall`, `dotBlank`, `dotSmallBlank`, `architecturalTick`, `oblique`, `open`, `openRightAngle`, `openSlanted`, `origin`, `origin2`, `box`, `boxFilled`, `datumTriangle`, `datumTriangleFilled`, `integral`. Geometry in **unit space** (1.0 = `DIMSTYLE.dimasz`), apex at `[0,0]` pointing toward `-X` axis (renderer rotates per dim-line direction, ADR-150 pattern). Primitive types: `ArrowheadLine` / `ArrowheadTriangle` / `ArrowheadCircle` (discriminated union). `ArrowheadBlockDefinition` con bilingual `displayName` (en/el) + `flipOnSecondArrow` flag + `solid` flag. Helpers: `getArrowheadBlock(name)` con fallback `closedFilled`, `listArrowheadBlockNames()`.
  - tsc `--noEmit`: nessun errore introdotto dai 4 nuovi files (solo errori pre-esistenti noti).
  - **Constraints honored**: zero `any` / `as any` / `@ts-ignore`. Functions ≤40 LOC. Files ≤500 LOC (max 357). Comments only on non-obvious "why". No integration con rendering pipeline / UI in questa fase (pure services).
  - **Next**: Phase A3 — Text Formatter + i18n skeleton (`dim-text-formatter.ts` + `i18n/locales/{el,en}/dimensions.json` ~80 keys).

- **2026-05-17 (Phase A1 DONE — Types + Enterprise IDs)** — Foundation Phase A1 implementata.
  - **NEW** `src/subapps/dxf-viewer/types/dimension.ts` — `DimensionEntity` discriminated union su 10 varianti (linear/aligned/angular2L/angular3P/radius/diameter/arcLength/joggedRadius/ordinate/baseline/continued), `DimStyle` interface con ~60 DIMSTYLE variables (lines & extensions, symbols & arrows, text, fit, primary/alternate units, tolerances, inspection, associativity, layer, annotative), `DimensionOverride = Partial<DimStyle>`, `DimensionAssociation` per D11, sub-types DimLinearUnitFormat/DimAngularUnitFormat/DimTextVerticalPlacement/DimTextFillMode/DimToleranceJustify/DimAssociativity/DimInspectionMode, 11 type guards.
  - **NEW** `src/subapps/dxf-viewer/types/center-mark.ts` — `CenterMarkEntity` + `CenterLineEntity` (D13 standalone variant), `CenterMarkStyle` enum, `CenterLineKind` enum, 2 type guards. Entrambi associativi tramite `geometryId`.
  - **MOD** `src/subapps/dxf-viewer/types/entities.ts` — legacy minimal `DimensionEntity` rimosso (era 7-field stub); nuovo `DimensionEntity` ri-esportato da `./dimension`; `CenterMarkEntity`/`CenterLineEntity` aggiunti al `Entity` union; `EntityType` esteso con `'center-mark'` + `'centerline'`; tutti i tipi/guards di `./dimension` e `./center-mark` ri-esportati per import unico. Legacy fields `startPoint/endPoint/textPosition/value/unit/precision` preservati come optional deprecated in `DimensionEntityCommon` per back-compat con `rendering/cache/PathCache.ts:247-249` e `snapping/engines/InsertionSnapEngine.ts:92-95` (rimossi in Phase B-C).
  - **MOD** `src/services/enterprise-id-prefixes.ts` — 4 nuovi prefix: `DIMENSION='dim'`, `DIM_STYLE='dimstyle'`, `CENTER_MARK='cmark'`, `CENTER_LINE='cline'`.
  - **MOD** `src/services/enterprise-id-class.ts` — 4 metodi: `generateDimensionId()`, `generateDimStyleId()`, `generateCenterMarkId()`, `generateCenterLineId()`.
  - **MOD** `src/services/enterprise-id-convenience.ts` — 4 convenience exports per i metodi sopra.
  - **MOD** `src/services/enterprise-id.service.ts` — 4 nuovi convenience re-exports nel facade pubblico (CLAUDE.md N.6 conformance).
  - tsc `--noEmit`: solo errori pre-esistenti noti (FloorplanGallery, ParkingHistoryTab, LayerCanvas) — nessun nuovo errore introdotto dai file Phase A1.
  - **Next**: Phase A2 — DIMSTYLE templates (ISO/ASME/Arch) + Registry + Resolver + Arrowhead blocks.

- **2026-05-17 (session-sized phase breakdown)** — §8 aggiunta: 35 phases organizzate in 15 groups (A-O), ciascuna fit-in-1-session (≤70% context, ≤6 files, 1 topic). Suggested linear execution order documentato. Dependency graph chiarito. §4.1 marked SUPERSEDED. Hard rules per phase definite (build verify, ADR changelog, no autonomous commit). Total ~35 sessions distribuite su ~7 settimane di sviluppo.

- **2026-05-17 (deep dive #2)** — Giorgio richiede review per gap. Second-round web research identifica 6+ feature mancanti vs AutoCAD/BricsCAD/Revit enterprise parity. 5 nuove decisioni:
  - **D11 Associativity (DIMASSOC=2)** — dim segue automaticamente geometria quando modificata. Schema con `associations` field + observer pattern.
  - **D12 Convenience features all-in** — DIMBREAK (auto+manual break su intersezioni) + DIMSPACE (auto-equispacing) + DIMTFILL (background mask per text readability).
  - **D13 Center Marks + Centerlines (entrambi)** — bundled with radial/diameter dim (DIMSTYLE-driven) + standalone entity for independent center marks.
  - **D14 Right-click context menu = full enterprise** — 9 dim-specific actions (Precision, Flip Arrows, Reset Text, Override Text, Apply Style, Reassociate, Explode) + 4 standard edit actions.
  - **D15 Fields + DIESEL expressions = AutoCAD parity** — token system (`<measurement>`, `<length>`, `<area>`, etc.) + math/string/conditional expressions con evaluator integrato.
  - Updated total effort: ~5.5-7 settimane (era ~3-4). +12-19 giorni cumulative.
  - File inventory aggiornato implicitamente: nuovi files `dim-break-engine.ts`, `dim-space-engine.ts`, `center-mark-renderer.ts`, `useCenterMarkCreate.ts`, `dimension-context-menu.tsx`, `dim-text-field-parser.ts`.

- **2026-05-17 (initial)** — ADR-362 creato. Phase 1 = Plan & Research. Q&A iterativo con Giorgio in Greek (8 decisioni grandi D1-D8, 2 default full-enterprise D9-D10). Industry research: ISO 129, ASME Y14.5, AutoCAD/BricsCAD/Revit comparison, DXF group codes spec. Implementation roadmap in 10 fasi (5A-5J), ~3-4 settimane. Status: APPROVED (Plan Phase).

- **2026-05-17** — `dim-color-resolver.ts` aggiunto: risolve colore/alpha per entità dimension a render-time (ByLayer cascade, isolate dim-mode support).
- **2026-05-17 (Phase C1 — DimensionRenderer)** — `rendering/entities/DimensionRenderer.ts` (266 LOC). Extends `BaseEntityRenderer`. Draws extension lines, dim line/arc/leader, two arrowheads, primary text. Consumes `DimGeometry` + resolved `DimStyle` + `DimensionLookup` (per baseline/continued). ADR-040 micro-leaf compliant: no store subscriptions. Delegates arrowheads → `dim-arrowhead-renderer.ts`, text → `dim-text-renderer.ts`.
- **2026-05-17 (Phase C1 — dim-arrowhead-renderer)** — `rendering/entities/dimension/dim-arrowhead-renderer.ts` (125 LOC). Canvas2D leaf: renders one arrowhead from `ArrowheadBlockDefinition` unit-space geometry, scaled by `dimasz`, rotated to dim-line direction. Handles all 20 AutoCAD standard arrowhead types.
- **2026-05-17 (Phase C1 — dim-text-renderer)** — `rendering/entities/dimension/dim-text-renderer.ts` (108 LOC). Canvas2D leaf: renders dimension primary text with `DIMTXSTY`/`DIMTXT`/`DIMCLRT`/`DIMGAP` from resolved `DimStyle`. Handles horizontal vs aligned placement (DIMTIH/DIMTOH). DIMTFILL stub reserved for Phase K.
- **2026-05-18 (Phase K1 — dim-break-engine)** — `systems/dimensions/dim-break-engine.ts` (NEW, ~230 LOC). Pure DIMBREAK engine: auto mode (segment intersections via `GeometricCalculations`, gap = `breakGap / 2` each side) + manual mode (explicit world-space break points). Returns `DimBreakResult` with split `DimLineSegment[]` arrays for dim line, ext lines, leader path. Supports LINE, LWPOLYLINE, POLYLINE crossing entities.
- **2026-05-18 (Phase K2 — dim-space-engine)** — `systems/dimensions/dim-space-engine.ts` (NEW, ~170 LOC). Pure DIMSPACE engine: modes auto (2×paperTextHeight) / custom / align (0). Projects dim-line offsets onto perpendicular axis, computes sign-aware repositioning for each target dim. Outputs `Map<id, defPoints>` patches. LINEAR + ALIGNED dims only.
- **2026-05-18 (Phase K3 — DIMTFILL)** — `dim-text-renderer.ts` + `DimensionRenderer.ts` modified. `drawTextBackgroundMask()` helper: estimates text bounding box via `ctx.measureText`, draws filled rect with `DIMTFILL` mode color before text. `DimensionRenderer` gains `setSceneEntities()` + `setCanvasBackground()` seams; auto DIMBREAK computed per render call when scene entities present. Render order: ext lines → dim line → mask → arrowheads → text.
- **2026-05-18 (Phase K — ribbon/i18n)** — Panel E "Τροποποίηση" added to `contextual-dimension-tab.ts` (DIMBREAK + DIMSPACE buttons, comingSoon=true pending tool integration). DIMTFILL toggle added to Panel C. New i18n keys: `dimBreak`, `dimSpace`, `dimTfillToggle`, `dimModify` in el + en `dxf-viewer-shell.json`. New command keys in `dim-command-keys.ts`: `modify.dimBreak`, `modify.dimSpace`, `text.tfillToggle`.
