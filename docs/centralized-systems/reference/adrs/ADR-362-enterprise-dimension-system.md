# ADR-362 — Enterprise Dimension System

| Field | Value |
|---|---|
| **Status** | 🟢 APPROVED (Plan Phase) — Implementation pending |
| **Date** | 2026-05-17 |
| **Last Updated** | 2026-05-17 |
| **Category** | DXF Viewer — Annotation / Dimensions |
| **Location** | `docs/centralized-systems/reference/adrs/ADR-362-enterprise-dimension-system.md` |
| **Author** | Claude Opus 4.7 + Giorgio Pagonis (Q&A iterativo) |
| **Related ADRs** | ADR-040 (Preview Canvas), ADR-041 (Distance Label), ADR-150 (Arrow Head Size), ADR-344 (Text Engine), ADR-345 (Ribbon Contextual Tab + FloatingPanel), ADR-358 (Stair Tool) |

---

## Summary

Sistema enterprise di dimension annotations per il DXF Viewer subapp, combinando i punti di forza di AutoCAD, BricsCAD, Revit con gli standard ISO 129 / ASME Y14.5. Supporto completo per tutti i 10 tipi DIMENSION (Linear/Aligned/Angular/Radial/Diameter/Ordinate/Arc-length/Jogged/Baseline/Continued), 3 DIMSTYLE template built-in configurabili, Revit-style annotation scaling, native DXF round-trip, UI integrato nel left FloatingPanel (4° tab) + contextual ribbon tab.

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
| **D1** | Hook orchestrator + Linear/Aligned/Angular create flow | `hooks/dimensions/useDimensionCreate.ts` (NEW), `hooks/drawing/useDrawingHandlers.ts` (mod: wire) | 3 dim types creatable end-to-end |
| **D2** | Radial family + Ordinate create flow | `useDimensionCreate.ts` (mod: +5 types) | 8/10 types creatable |
| **D3** | Chained (Baseline/Continued) + Modifier toggles | `useDimensionCreate.ts` (mod), modifier wiring (Tab/Shift/Space/Ctrl) | 10/10 ✓ + modifiers |

### Group E — RIBBON UX (2 sessions, blocked by D)

| # | Phase | Files | Output |
|---|---|---|---|
| **E1** | Home tab Smart DIM group + ToolTypes | `ui/ribbon/data/home-tab-dimensions.ts` (NEW: Smart DIM + dropdown), `ui/toolbar/types.ts` (mod: +10 ToolTypes) | Visible ribbon entry-point |
| **E2** | Contextual ribbon tab "Διάσταση" | `ui/ribbon/data/contextual-dimension-tab.ts` (NEW: Style/Override/Text/Properties), trigger wiring | Per-entity quick edits |

### Group F — LEFT PANEL TAB (3 sessions, parallel to D-E)

| # | Phase | Files | Output |
|---|---|---|---|
| **F1** | Panel tab skeleton + Style Manager | `panel-types.ts` (mod), `PanelTabs.tsx` (mod), `usePanelContentRenderer.tsx` (mod), `ui/panels/dimensions/DimensionsTab.tsx` (NEW), `DimStyleList.tsx` (NEW) | 4° tab visible, CRUD styles |
| **F2** | Accordion sections 1-3 (Γραμμές, Σύμβολα, Κείμενο) | `DimStyleAccordion.tsx` (NEW), `sections/LinesSection.tsx` (NEW), `SymbolsSection.tsx` (NEW), `TextSection.tsx` (NEW) | 3/6 sections editable |
| **F3** | Accordion sections 4-6 (Προσαρμογή, Μονάδες, Ανοχές) + Live Preview | `FitSection.tsx` (NEW), `PrimaryUnitsSection.tsx` (NEW), `AltUnitsSection.tsx` (NEW), `TolerancesSection.tsx` (NEW), `DimStylePreview.tsx` (NEW) | 6/6 sections + preview |

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
