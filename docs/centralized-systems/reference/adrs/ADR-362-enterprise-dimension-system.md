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
