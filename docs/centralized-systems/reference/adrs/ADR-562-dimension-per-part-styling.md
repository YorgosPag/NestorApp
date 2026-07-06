# ADR-562 — Dimension Per-Part Styling (πλήρης έλεγχος χρώματος / πάχους / τύπου γραμμής / βελών ανά μέρος διάστασης)

> **Status:** 🟢 Φ1+Φ2+Φ3+Φ4+Φ5+Φ7+Φ8 IMPLEMENTED + Φ9.1+Φ9.2+Φ9.3(MOVE tool) (UNCOMMITTED) — data model + 2D rendering + ribbon bridge + contextual tab + Style Manager controls + **Φ7 dimension true-color (enterprise color picker)** + **Φ8 linetype/arrowhead thumbnails** + **Φ9.1 alignment traces στη ΔΗΜΙΟΥΡΓΙΑ** + **Φ9.2 στις ΛΑΒΕΣ (grip-drag)** + **Φ9.3 στο MOVE tool (2-click «M»)** + **Φ9.4 action-drag «tracking pull» aperture BUGFIX (τα ίχνη ΕΠΙΤΕΛΟΥΣ εμφανίζονται σε MOVE/body-drag/grip — 8px αντί 3px)** έτοιμα· Φ9.3 row-move overlay DEFERRED (SVG↔canvas paint) + Φ6 (DXF round-trip / per-side / 3D) PROPOSED.
> **Date:** 2026-07-01
> **Subapp:** `src/subapps/dxf-viewer` (https://nestorconstruct.gr/dxf/viewer)
> **Author:** Giorgio + agent
> **Related:** ADR-510 (Line Creation System — πρότυπο contextual tab bridge + Unified Linetype SSoT),
> ADR-362 (Dimension ribbon E2 command-key stubs), ADR-344 (text engine / font resolve),
> ADR-509 (Adaptive Entity Color), ADR-040 (canvas performance CHECK 6B/6D), ADR-001 (Select component).

---

## 1. Πλαίσιο / Problem Statement

Ο Giorgio ζήτησε να διαπιστωθεί αν, **όταν επιλέγει μια διάσταση**, μπορεί αυτή τη στιγμή να χειρίζεται
**όλα** τα οπτικά μέρη της — και να τεκμηριωθεί πώς θα υλοποιηθεί ό,τι λείπει. Τα 4 μέρη κάθε διάστασης:

1. **Κείμενο διάστασης** (dimension text) — χρώμα, ύψος, γραμματοσειρά, θέση.
2. **Γραμμή διάστασης** (dimension line) — χρώμα, πάχος γραμμής (lineweight), τύπος γραμμής (linetype).
3. **Βοηθητικές / προεκτάσεις** (extension lines) — χρώμα, πάχος, τύπος, offset από σημείο εκκίνησης
   (DIMEXO), extension πέρα από τη γραμμή διάστασης (DIMEXE).
4. **Σύμβολα στα άκρα / βελάκια** (arrowheads / terminators) — τύπος, χρώμα, μέγεθος.

**Ζητούμενο:** «όλες τις ρυθμίσεις, για κάθε μέρος, τα πάντα» — δηλαδή AutoCAD-grade (και ανώτερο)
per-part styling επιλεγμένης διάστασης.

**Απάντηση σε μία γραμμή:** **ΟΧΙ**, σήμερα δεν μπορεί να τα χειριστεί πλήρως. Υπάρχει γερό θεμέλιο
(κεντρικό `DimStyle` SSoT με χωριστά χρώματα ανά μέρος + 20 τύποι βελών), αλλά (α) λείπουν πεδία
data-model (lineweight, linetype, χρώμα βελών) και (β) λείπει το UI/bridge που να συνδέει τα υπάρχοντα
πεδία με χειριστήρια — τα ribbon controls είναι stubs (φάση E2, ADR-362).

---

## 2. Έρευνα: τρέχουσα κατάσταση κώδικα

### 2.1 Αρχιτεκτονική (κεντρικό SSoT υπάρχει ήδη)

| Στρώμα | Αρχείο | Ρόλος |
|---|---|---|
| **Data model** | `types/dimension.ts:95-242` | `DimStyle` interface (~60 πεδία). Κάθε `DimensionEntity` έχει `styleId: string` + `overrides?: Partial<DimStyle>` (γρ. 319-320). |
| **Registry** | `systems/dimensions/dim-style-registry.ts` | `DimStyleRegistry` (map id → DimStyle), `updateCustomStyle()`. |
| **Resolver** | `systems/dimensions/dim-style-resolver.ts` | `resolveDimStyle()` merge: built-in fallback → `styleId` → `overrides`. |
| **Templates** | `systems/dimensions/dim-style-templates.ts` | 3 built-in (ISO 129 / ASME Y14.5 / Architectural). |
| **Render 2D main** | `rendering/entities/DimensionRenderer.ts` | Μόνιμες διαστάσεις (main canvas). |
| **Render 2D preview** | `canvas-v2/preview-canvas/preview-dimension-renderer.ts` | Διαστάσεις υπό κατασκευή. |
| **Render 3D** | `bim-3d/dimensions/Dimension3DRenderer.ts` | Three.js overlay — **hardcoded, χωρίς σύνδεση με `DimStyle`**. |
| **Ribbon keys** | `ui/ribbon/hooks/bridge/dim-command-keys.ts` | `DIM_RIBBON_KEYS` + `isDimRibbonKey` (stub φάση E2). |
| **Contextual tab (επιλεγμένη)** | `ui/ribbon/data/contextual-dimension-tab.ts` | Panels Στυλ/Παράκαμψη/Κείμενο/Τροποποίηση/Ιδιότητες. |
| **Style Manager panel** | `ui/panels/dimensions/DimensionsTab.tsx` + `DimStyleAccordion` | Δημιουργία/επεξεργασία DIMSTYLE. |
| **Context menu** | `ui/context-menus/DimensionContextMenu.tsx` | Precision/Flip/Apply Style/Explode κ.λπ. |

### 2.2 Πίνακας κάλυψης ανά μέρος × ιδιότητα

| Μέρος | Ιδιότητα | Data model | Render το διαβάζει | UI επεξεργάσιμο |
|---|---|---|---|---|
| **Κείμενο** | Χρώμα `dimclrt` (`dimension.ts:139`) | ✅ | ✅ `dim-text-renderer.ts:92-94` (`resolveDimColor`) | ❌ **λείπει παντού** |
| | Ύψος `dimtxt`/`paperTextHeight` (`:137,173`) | ✅ | ✅ `dim-text-renderer.ts:88-89` | ⚠️ Style Manager ✅ · ribbon combobox = STUB |
| | Γραμματοσειρά `textFontFamily` (`:153`) | ✅ | ✅ `dim-text-renderer.ts:95` | ❌ λείπει |
| | Θέση `dimtad` / gap `dimgap` / mask `dimtfill` | ✅ | ✅ | ⚠️ μερικώς (Style Manager TextSection) |
| **Γραμμή διάστ.** | Χρώμα `dimclrd` (`:105`) | ✅ | ✅ `DimensionRenderer.ts:401` | ❌ **λείπει** (ribbon color-swatch = STUB) |
| | **Πάχος (lineweight)** | ❌ **λείπει** | ❌ hardcoded `ctx.lineWidth=1` `DimensionRenderer.ts:402` | ❌ |
| | **Τύπος γραμμής (linetype)** | ❌ **λείπει** | ❌ hardcoded solid `setLineDash([])` `:403-404` | ❌ |
| | Suppress 1/2 `suppressDimLine1/2` | ✅ | ✅ `:321-323` | ✅ Style Manager LinesSection |
| **Extension** | Χρώμα `dimclre` (`:107`) | ✅ | ✅ `DimensionRenderer.ts:306` (ξεχωριστό) | ❌ **λείπει** |
| | **Πάχος** | ❌ **λείπει** | ❌ hardcoded 1 | ❌ |
| | **Τύπος γραμμής** | ❌ **λείπει** | ❌ hardcoded solid | ❌ |
| | Offset `dimexo` (`:111`) / extend `dimexe` (`:109`) | ✅ | ✅ `linear-aligned-builder.ts:52-65` | ✅ Style Manager NumField |
| | Suppress 1/2 `suppressExtLine1/2` | ✅ | ✅ | ✅ Style Manager |
| **Βελάκια** | Τύπος `dimblk`/`dimblk1`/`dimblk2` (`:125-129`, **20 τύποι** `dim-arrowhead-blocks.ts`) | ✅ (per-side!) | ✅ `DimensionRenderer.ts:346-349` | ⚠️ Style Manager Select ✅ (γράφει και τα 3 μαζί) · ribbon STUB |
| | Μέγεθος `dimasz` (`:123`) | ✅ | ✅ `DimensionRenderer.ts:352-353` | ✅ Style Manager LinesSection |
| | **Χρώμα** | ❌ **λείπει** (κληρονομεί `dimclrd`, `DimensionRenderer.ts:354`) | — | ❌ |
| | Flip inside/outside | — | ✅ `block.flipOnSecondArrow` | ✅ context menu `onFlipArrows()` |

### 2.3 Τα δύο κρίσιμα κενά

**Κενό Α — Data model (3 ελλείψεις):**
- **Lineweight**: κανένα πεδίο. Ο writer (`utils/dxf-dimstyle-writer.ts:167-168`) εκπέμπει πάντα
  `DIMLWD=-2` / `DIMLWE=-2` (ByLayer) hardcoded· ο 2D renderer αγνοεί εντελώς το πάχος (πάντα 1px).
- **Linetype**: κανένα πεδίο. Τα DXF vars `DIMLTYPE`(345)/`DIMLTEX1`(346)/`DIMLTEX2`(347) δεν
  υπάρχουν ούτε στον τύπο ούτε στον writer· ο renderer ζωγραφίζει πάντα solid.
- **Χρώμα βελών**: κανένα πεδίο· τα βελάκια παίρνουν `dimclrd`.

**Κενό Β — UI / bridge (το μεγάλο):**
- Υπάρχουν `DIM_RIBBON_KEYS` + `isDimRibbonKey` (`dim-command-keys.ts`) και controls στο
  `contextual-dimension-tab.ts` (color-swatch `dim.override.color` γρ. 136-142, arrow-style combobox
  γρ. 144-153, text height/position/rotation), **αλλά λείπει το bridge**: το `useRibbonCommands.ts`
  δεν έχει κλάδο `isDimRibbonKey` ούτε στο `onComboboxChange` ούτε στο `getComboboxState` — άρα όλα
  είναι νεκρά stubs (μόνο `dim.text.override`/`dim.modify.dimBreak`/`dim.modify.dimSpace` δρομολογούνται
  μέσω fallthrough `wrappedHandleAction`).
- Τα υπάρχοντα χρώματα `dimclrd`/`dimclre`/`dimclrt` **δεν εκτίθενται** ούτε στον Style Manager
  (`DimStyleAccordion` — LinesSection δεν έχει color, TextSection δεν έχει `dimclrt`).

---

## 3. Απόφαση (scope — Giorgio 2026-07-01)

1. **Στόχος εφαρμογής**: **ΚΑΙ τα δύο** — (α) contextual-tab overrides ανά επιλεγμένη διάσταση
   (γράφει `entity.overrides`, πρότυπο ADR-510) **ΚΑΙ** (β) συμπλήρωση των ελλειπόντων controls στον
   Style Manager (global DIMSTYLE μέσω `updateCustomStyle()`).
2. **Χρώμα βελών**: ΝΕΟ **ξεχωριστό κανάλι** `arrowColor` (ξεπερνά το AutoCAD, που δένει τα βελάκια
   στο χρώμα της γραμμής). Στο DXF export = μη-standard → fallback σε `dimclrd`.
3. **Granularity**: **Ενιαίο τώρα** — ένα χρώμα/πάχος/τύπος για dim-line, ένα (κοινό) για extension
   lines, ένας τύπος+μέγεθος βελών. (Ο τύπος βέλους ανά άκρο `dimblk1`/`dimblk2` ήδη υποστηρίζεται.)
   Per-side χρώμα/μέγεθος/τύπος = μελλοντική φάση.
4. **3D**: **2D τώρα** (main + preview canvas). Η 3D προβολή (`Dimension3DRenderer.ts`, τώρα εντελώς
   hardcoded) τεκμηριώνεται ως ξεχωριστή μελλοντική φάση.

---

## 4. Σχέδιο υλοποίησης

### Φ1 — Data model (`types/dimension.ts` + templates + importer) — ✅ IMPLEMENTED 2026-07-01
Νέα πεδία στο `DimStyle`:
- `dimlwd: LineweightMm` — lineweight γραμμής διάστασης. **SSoT audit refinement:** χρησιμοποιεί
  τον υπάρχοντα canonical τύπο `LineweightMm` (`types/scene-types.ts`, DXF g370 — τιμές mm + `-3`
  Default / `-2` ByLayer / `-1` ByBlock), **ΟΧΙ** σκέτο `number` με «εκατοστά χιλιοστού». Έτσι η Φ2
  περνά το πεδίο κατευθείαν στον ίδιο lineweight→px resolver με γραμμές/layers (μηδέν μετατροπή· το
  hundredths-encoding ανήκει μόνο στον DXF writer της Φ6).
- `dimlwe: LineweightMm` — lineweight extension lines.
- `dimltype: string` — linetype name γραμμής διάστασης (σύμβαση ADR-510 `linetypeName`· π.χ.
  `'ByLayer'`, `'Continuous'`, `'DASHED'`).
- `dimltex1: string`, `dimltex2: string` — linetype names των δύο extension lines (στη φάση «ενιαίο»
  τα ορίζει ταυτόχρονα ένα UI control· κρατάμε 2 πεδία για μελλοντικό per-side + DXF 346/347 parity).
- `arrowColor?: number` — ACI χρώμα βελών. **SSoT audit refinement:** **optional** override channel
  (όχι required). Όταν λείπει → τα βελάκια κληρονομούν `dimclrd` στο render (`arrowColor ?? dimclrd`),
  σωστό και για ASME/Arch (`dimclrd=5`). Ταιριάζει με το ίδιο το render snippet της Φ2 και αποφεύγει
  dead-code fallback + per-template διπλότυπο. DXF export → fallback `dimclrd`.

Defaults στα 3 templates (`sharedDefaults()`): `dimlwd=dimlwe=-2` (ByLayer),
`dimltype=dimltex1=dimltex2='ByLayer'`, `arrowColor` **omitted** (κληρονομεί `dimclrd`).
Ο importer (`translateToDimStyle()`) seed-άρει τα ίδια ByLayer defaults (DXF DIMLWD/DIMLWE/DIMLTYPE
δεν parsάρονται ακόμη — round-trip = Φ6). Το `resolveDimStyle()` δεν αλλάζει (generic merge πάνω σε
`Partial<DimStyle>`). Test: `dim-style-templates-per-part.test.ts` (3) + 47 existing dim suites GREEN.

### Φ2 — Rendering wiring 2D (`DimensionRenderer.ts` + `preview-dimension-renderer.ts`) — ✅ IMPLEMENTED 2026-07-01
**SSoT audit refinement:** αντί να επαναλάβω τη resolve-logic σε 2 renderers, δημιουργήθηκε **ΕΝΑ shared
pure helper** `rendering/entities/dimension/dim-stroke-resolver.ts` — `resolveDimStroke(lineweight,
linetype, scale) → { lineWidthPx, dashPx }`. Κάνει **reuse** 3 υπάρχοντα SSoT: `lineweightToPx`
(`config/lineweight-iso-catalog`, zoom-independent LWT), `resolveAnyDashMm` (`config/linetype-aliases`,
ADR-510 catalog), `dashMmToScreenPx` (`rendering/linetype-dash-resolver`, zoom×LTSCALE). Καλείται και
από τους δύο renderers → WYSIWYG preview↔commit, μηδέν διπλότυπο (N.0.2).
- **Πάχος**: `applyLineStyle(aci, _suppressed)` → `applyLineStyle(aci, lineweight, linetype)`· dim-line
  = `dimlwd`, ext-lines = `dimlwe`. Sentinels (-3/-2/-1) → baseline **1px** (`DIM_SENTINEL_STROKE_PX`),
  ώστε κάθε ByLayer built-in να ζωγραφίζει byte-identical με πριν (zero regression· concrete layer/block
  LWT inheritance = μελλοντική φάση). Glow pass = ίδιο width+glow αλλά **solid halo** (dashed halo=σπασμένο).
- **Τύπος γραμμής**: `ctx.setLineDash([])` → `setLineDash(resolveDimStroke(...).dashPx)`· dim-line
  = `dimltype`, ext-lines = `dimltex1`. 'ByLayer'/'Continuous'/unknown → `[]` = solid (zero regression).
- **Βελάκια**: `resolveDimColor(r.style.arrowColor ?? r.style.dimclrd, layerColour)` (`DimensionRenderer.ts`
  drawArrowheads) — ξεχωριστό κανάλι, fallback dimclrd όταν άδειο.
- **Preview** (`preview-dimension-renderer.ts`): `applyDimStroke` δέχεται τώρα per-part lineweight+linetype+
  scale, καλεί τον ίδιο `resolveDimStroke` (κρατά το preview-green color override). Το `overlayLineStyle`
  "listening" state μένει άθικτο. `applySolidStroke` (dead πλέον) αφαιρέθηκε. Arrows μένουν green (preview
  convention — arrowColor δεν εφαρμόζεται στο preview).
- Tests: `dim-stroke-resolver.test.ts` (6) + 48 existing dim suites (DimensionRenderer/preview/text) GREEN.
- ⚠️ **ADR-040 CHECK 6D**: αγγίζει `DimensionRenderer.ts` (entity renderer) → **stage ΑΥΤΟ το ADR** μαζί
  με τον κώδικα, αλλιώς μπλοκάρει το pre-commit.

### Φ3 — Ribbon bridge (πρότυπο ADR-510 `useRibbonLineToolBridge.ts`) — ✅ IMPLEMENTED 2026-07-01
- ΝΕΟ `ui/ribbon/hooks/useRibbonDimBridge.ts` — mirror του line bridge (single-mode: overrides ΜΟΝΟ σε
  επιλεγμένη διάσταση· τα global defaults = Style Manager Φ5, όχι draw-defaults):
  - `resolveSelectedDim()` → `isDimensionEntity` narrow.
  - `getComboboxState(key)`: `resolveDimStyle(entity, getDimStyleRegistry())` → τρέχουσα resolved τιμή.
  - `onComboboxChange(key, value)`: patch `{ overrides: { ...prev, [field]: value } }` μέσω
    **`UpdateEntityCommand`** (undoable). Καμία επιλογή → no-op.
  - **Key→field map SSoT** (ΕΝΑ `DIM_KEY_MAP` οδηγεί read+write): color/lineweight/linetype/arrowStyle/
    number/font kinds. **Unified writes:** ext linetype γράφει `dimltex1`+mirror `dimltex2`· arrow style
    γράφει `dimblk`+clear `dimblk1/dimblk2` (και τα δύο άκρα κοινά).
  - **Options reuse (μηδέν διπλή λίστα):** linetypes = `listSelectableLinetypeNames()` (ίδιο με line
    bridge/radial-ring)· arrow styles = `listArrowheadBlockNames()` (τα 20 πραγματικά blocks). Colors/
    weights/sizes/font = editable/color-swatch (τα presets τα δίνει το tab Φ4, το bridge μόνο την τιμή —
    ίδιο pattern με `text.height`).
- Εγγραφή στο `useRibbonCommands.ts`: `if (isDimRibbonKey(key)) return dimBridge.getComboboxState(key);`
  + το αντίστοιχο στο `onComboboxChange` (πριν τον xline κλάδο)· props type `useRibbonCommands-types.ts`
  (`dimBridge: RibbonDimBridge`)· instantiation `app/useDxfViewerRibbon.ts`
  (`useRibbonDimBridge({ levelManager, universalSelection })`)· deps array getComboboxState.
- Επέκταση `DIM_RIBBON_KEYS.override` (`dim-command-keys.ts`) με τα missing keys: `lineWeight`, `lineType`,
  `extColor`, `extWeight`, `extType`, `arrowColor`, `arrowSize`, `textColor`, `textFont` (κρατώντας τα
  υπάρχοντα `color`=dimclrd, `arrowStyle`=dimblk, `text.height`=paperTextHeight — reuse, όχι διπλότυπα).
- Tests: `useRibbonDimBridge.test.tsx` (14, read/unified-write/guards) + line bridge suite GREEN (no regression).

### Φ4 — Contextual tab controls (`contextual-dimension-tab.ts`) — ✅ IMPLEMENTED 2026-07-01
- **SSoT audit refinement:** το `type: 'color-swatch'` renders `RibbonColorSwatchWidget` που είναι
  **hardwired στο text-toolbar store** (δεν περνά από το dim bridge) → το υπάρχον `dim.override.color`
  color-swatch ήταν **σπασμένο stub** (έγραφε σε λάθος store). Αντ' αυτού ΟΛΑ τα per-part χρώματα =
  **`combobox` + COLOR_OPTIONS** (ByLayer + 7 ACI, i18n-keyed) — το working pattern του line tool
  (ADR-510), που περνά από το `onComboboxChange` → dim bridge. (Απόκλιση από το §4 «color-swatch»,
  ακολουθεί το πραγματικό working SSoT.)
- Το single «Παράκαμψη» panel σπάει σε **AutoCAD-grade per-part panels** (7 panels συνολικά):
  Στυλ · **Γραμμή Διάστασης** (χρώμα/πάχος/τύπος) · **Προεκτάσεις** (χρώμα/πάχος/τύπος) · **Βελάκια**
  (στυλ/χρώμα/μέγεθος) · Κείμενο (+χρώμα/γραμματοσειρά) · Τροποποίηση · Ιδιότητες. Το `reset` πήγε στο
  Στυλ panel.
- **Options reuse (μηδέν διπλή λίστα):** πάχος = shared `LINEWEIGHT_RIBBON_OPTIONS`· linetype + arrow-style
  = **ΚΕΝΑ** στο tab (`options: []`), τα τροφοδοτεί live το bridge (Φ3)· arrow size = editable numericInput·
  font = preset dropdown. Το παλιό μεταφρασμένο `ARROW_STYLE_OPTIONS` αφαιρέθηκε (bridge-supplied πλέον).
- i18n keys (N.11): 3 panels (`dimLine/dimExt/dimArrow`) + 9 command labels + 8 `colorOptions.*` σε
  **el ΚΑΙ en** `dxf-viewer-shell.json` (πριν τη χρήση). Ενημέρωση structural test (7 panels, color=combobox).

### Φ5 — Style Manager controls (`ui/panels/dimensions/sections/*`) — ✅ IMPLEMENTED 2026-07-01
**SSoT audit refinement:** τα `dimclrd/dimclre/dimclrt`/`arrowColor` είναι **ACI numbers** (0=ByBlock,
256=ByLayer, 1-255). Ο υπάρχων `EnterpriseColorDialog`/`RibbonColorField` δουλεύει με **hex** → mismatch
(lossy hex→ACI + απόκλιση από την αδελφή Φ4). Επιλέχθηκε **ACI `Select` + swatch** (AutoCAD/Revit DIMSTYLE
colour-dropdown pattern) με το **ίδιο option set με τη Φ4** (`ByLayer + 7 ACI`) → συνέπεια Style Manager ↔
contextual tab. Swatch = `resolveDimColor(aci)` + `getDynamicBackgroundClass` (dynamic bg χωρίς inline
style, N.3).
- **ΝΕΟ shared SSoT** `sections/dim-style-field-options.ts` (data): `DIM_COLOR_OPTIONS` (ByLayer+7 ACI),
  `DIM_LINEWEIGHT_OPTIONS` (derived από `LINEWEIGHT_CONCRETE_MM_VALUES` + `LINEWEIGHT_SPECIAL.BYLAYER` —
  τιμές `LineweightMm`, **μηδέν `as LineweightMm` cast**, ratchet-safe), `DIM_FONT_OPTIONS` (ίδιες 5 με Φ4).
- **ΝΕΟ shared SSoT** `sections/dim-style-fields.tsx` (components): `NumField`/`BoolField` (extract από
  `LinesSection` — ήταν local), `SelectField` (generic Radix Select), `ColorField` (ACI+swatch),
  `LineweightField` (LineweightMm lookup, no cast), `LinetypeField` (live `listSelectableLinetypeNames()`).
  Reuse και στα 3 sections → μηδέν copy-paste.
- `LinesSection`: `ColorField dimclrd/dimclre` + `LineweightField dimlwd/dimlwe` + `LinetypeField
  dimltype` + `dimltex1` (**unified mirror `dimltex2`**, όπως Φ3).
- `TextSection`: `ColorField dimclrt` + `SelectField textFontFamily`.
- `SymbolsSection`: `ColorField arrowColor` (κληρονομεί `dimclrd` όταν unset — `arrowColor ?? dimclrd`).
- Γράφει μέσω του υπάρχοντος `onChange(patch)` → `getDimStyleRegistry().updateCustomStyle()` (Φ4/existing).
- i18n (N.11): 9 field labels + `byLayer` + 8 `colorOptions.*` σε **el ΚΑΙ en** `dxf-viewer-panels.json`.
- Tests: `dim-style-per-part-controls.test.tsx` (7) + 40 dim suites GREEN (542 tests, zero regression).
- ⚠️ **Flagged consolidation (post-Φ4-commit):** τα `COLOR_OPTIONS`/`FONT_OPTIONS` της Φ4 είναι private
  inline στο `contextual-dimension-tab.ts`. Δεν αγγίχθηκαν (κανόνας «μην ξαναγγίξεις Φ1-Φ4»)· μετά το
  commit της Φ4 να migrate-άρουν ώστε να import-άρουν από το `dim-style-field-options.ts` (ένα SSoT).

### Φ6 — Μελλοντικές φάσεις (μόνο τεκμηρίωση, εκτός τρέχοντος scope)
- **DXF round-trip**: writer `dxf-dimstyle-writer.ts` να εκπέμπει `DIMLWD/DIMLWE` (αντί hardcoded `-2`),
  `DIMLTYPE`(345)/`DIMLTEX1`(346)/`DIMLTEX2`(347)· importer `dim-style-importer.ts` να τα διαβάζει
  (σήμερα απορρίπτει block names / font / tfill — `dim-style-importer.ts:129,148-150,163`).
  `arrowColor` = μη-standard → xdata ή fallback `dimclrd`.
- **Per-side** χρώμα/μέγεθος/τύπος βελών & extension lines (arrow1/arrow2, ext1/ext2).
- **3D parity**: σύνδεση `Dimension3DRenderer.ts` με `DimStyle` (χρώμα/μέγεθος/τύπος βελών, font)
  αντί hardcoded `UI_COLORS_BASE`.

---

### Φ7 — Dimension true-color (IMPLEMENTED) — enterprise color picker στα 4 ribbon πεδία «Χρώμα»

**Πρόβλημα:** Τα 4 πεδία «Χρώμα» του contextual tab «Διάσταση» (γραμμή `dimclrd`, προεκτάσεις `dimclre`,
βελάκια `arrowColor`, κείμενο `dimclrt`) ήταν ACI dropdown («Κατά Επίπεδο» + 7 χρώματα). Ο Giorgio ζήτησε
αντικατάσταση με τον **υπάρχοντα enterprise color picker** (`ColorDialogTrigger`/`EnterpriseColorDialog`,
ίδιος με «Ρυθμίσεις DXF»), με **πλήρες true-color** (ακριβές hex, όχι snap σε ACI παλέτα).

**Λύση — companion true-color πεδία (μοτίβο `BaseEntity.colorTrueColor`):**
- **Data model** (`types/dimension.ts`): προαιρετικά `dimclrdTrueColor?`, `dimclreTrueColor?`,
  `dimclrtTrueColor?`, `arrowTrueColor?` — packed 24-bit `0xRRGGBB` `number | null`. `null`/absent → χρήση
  του ACI καναλιού. Templates/registry/`resolveDimStyle` (spread merge) & persistence (JSON blob σε Storage)
  τα καλύπτουν αυτόματα — καμία αλλαγή (ίδιο convention με το υπάρχον optional `arrowColor`).
- **Resolver** (`dim-color-resolver.ts`): νέο `resolveDimColorTC(trueColor, aci, layerColour)` — true-color
  πρώτα (`trueColorToHex`), αλλιώς `resolveDimColor` (ίδιο ByLayer/ByBlock fallback). Το `resolveDimColor`
  μένει ως έχει (χρησιμοποιείται από `dimtfillclr` κ.λπ.).
- **Render** (`DimensionRenderer.ts` γραμμή/προεκτάσεις/βελάκια, `dim-text-renderer.ts` κείμενο,
  `preview-dimension-renderer.ts`): κάθε χρωματικό κανάλι περνά το companion στο `resolveDimColorTC`. Τα
  βελάκια κληρονομούν το true-color της γραμμής όταν το δικό τους κανάλι είναι κενό (mirror του
  `arrowColor ?? dimclrd`). Το preview μηδενίζει τα companion ώστε το ByLayer→preview-colour routing να μη σκιάζεται.
- **Ribbon bridge** (`useRibbonDimBridge.ts`): τα 4 color keys μιλούν **hex** (in/out). Read → hex μέσω
  `resolveDimColorTC`. Write (hex από picker) → γράφει **και** το εξακ true-color companion (`hexToTrueColor`,
  render/persist) **και** το πλησιέστερο ACI (`findClosestAci`, DXF export degrade). Νέο `trueColorField` στο
  `DimKeySpec`.
- **Tab** (`contextual-dimension-tab.ts`): τα 4 color commands → `comboboxVariant:'dxf-color'`
  (→ `RibbonDxfColorPickerWidget` → `RibbonColorField`, ήδη hex in/out). Ο ACI `COLOR_OPTIONS` const αφαιρέθηκε.
- **DXF export** (`dxf-dimstyle-writer.ts`): helper `dimColorAci(aci, tc)` — degrade true-color→πλησιέστερο ACI
  για τα codes 176/177/178 (το DXF DIMSTYLE δεν έχει group code για true-color· τεκμηριωμένο όριο).

**SSoT reuse:** `trueColorToHex`/`hexToTrueColor` (`utils/dxf-true-color.ts`), `findClosestAci`/`getAciColor`
(`settings/standards/aci.ts`), `RibbonColorField` + `comboboxVariant:'dxf-color'`. Καμία νέα υποδομή.

**Όριο/όριο απώλειας:** το ByLayor «Κατά Επίπεδο» ως ρητή επιλογή dropdown χάνεται (ο picker είναι hex)· η
επιλογή χρώματος γίνεται πλέον explicit true-color. **Εκτός scope:** Style Manager `dim-style-fields.tsx`
(ξεχωριστό `ColorField`, «Edit style» comingSoon), `dimtfillclr` (φόντο κειμένου — παραμένει ACI).

---

### Φ8 — Linetype/Arrowhead thumbnails (IMPLEMENTED) — inline-SVG previews στα ribbon dropdowns

**Πρόβλημα:** Τα dropdown «Τύπος» (linetype) και «Στυλ» (βελάκια) της Διάστασης έδειχναν **μόνο κείμενο**.
Industry standard (AutoCAD linetype preview + DIMSTYLE arrowhead icon, Figma/Illustrator/Affinity stroke
previews, Revit Line Pattern) = **οπτικό preview (μικρογραφία)** δίπλα στο όνομα.

**Λύση — inline SVG με `currentColor` (μοτίβο `HatchPatternPicker`, theme-correct):**
- **SSoT builders** (pure + memoized, ίδια γεωμετρία με τον renderer):
  - `rendering/linetype-thumbnail.ts` — `buildLinetypeThumbnail(name)` → `stroke-dasharray` px, μέσω
    `resolveAnyDashMm` (+ `resolveLinetype` fallback) + `dashMmToScreenPx`. Solid → κενό dash.
  - `systems/dimensions/arrowhead-thumbnail.ts` — `buildArrowheadThumbnail(name)` → normalized SVG
    primitives (line/polygon/circle) από το `ARROWHEAD_BLOCKS` unit-space SSoT (bbox-fit, flip Y).
- **Renderer component** `ui/ribbon/components/buttons/RibbonComboboxThumbnail.tsx` — inline `<svg>` με
  `stroke`/`fill="currentColor"` (μηδέν hardcoded χρώμα, N.3· αλλάζει με light/dark + hover).
- **Shared combobox** — νέο `RibbonComboboxThumbnailDescriptor` + optional `thumbnail?` στο
  `RibbonComboboxOption` (`ribbon-types.ts`)· ο `RibbonComboboxDefault` (`RibbonCombobox.tsx`) το ζωγραφίζει
  σε trigger + items (κανονικό ύψος σειράς, δίπλα στο υπάρχον `imageUrl` path).
- **Wiring** (`useRibbonDimBridge.ts`) — τα live `linetypeOptions` (τύπος γραμμής **+** προεκτάσεων) και
  `arrowStyleOptions` αποκτούν `thumbnail:{kind,name}`. Ένα σημείο, SSoT.

**SSoT reuse:** `resolveAnyDashMm`/`resolveLinetype`/`dashMmToScreenPx`, `getArrowheadBlock`/`ARROWHEAD_BLOCKS`,
`imageUrl` rendering pattern. **Reusable:** ο builder δουλεύει και για τον Line-tool linetype dropdown (ADR-510),
μελλοντικά. **Εκτός scope:** Style Manager dialog.

---

### Φ9 — Alignment traces (AutoAlign) στις ροές της διάστασης — phased (Giorgio 2026-07-04)

**Πρόβλημα:** τα ίχνη ευθυγράμμισης (dashed alignment traces + intersection halo + label) που κάθε εργαλείο
σχεδίασης δείχνει (SSoT brain `resolveAlignmentTracking`, `systems/tracking/`) **παρακάμπτονταν** και στις 3
ροές της διάστασης (δημιουργία / λαβές / μετακίνηση).

**Κοινός SSoT wrapper** `hooks/dimensions/dim-alignment-tracking.ts` — `resolveDimAlignmentTracking(cursor,
refPoints, {scale, polarEnabled, sceneEntities})`: mirror του `rotation-tracking-overlay.ts`, αλλά δέχεται
**ρητά reference points** (τα ήδη-picked σημεία της τρέχουσας διάστασης) ως extra anchors, merged με
acquired (`TrackingPointStore`) ⊕ ambient (`collectAmbientAlignmentAnchors`, AutoAlign-gated) → το ΙΔΙΟ
`composeTrackingSnap`. Μηδέν παράλληλη μηχανή.

**Φ9.1 — Δημιουργία (IMPLEMENTED):**
- Hover: `drawing-hover-handler.ts` (dim κλάδος) — resolve με refPoints=`dimensionCreateStore.get().clicks`,
  override του preview point + `previewCanvasRef.drawTrackingAlignment(...)` πάνω από το dim preview. Skipped
  στο free dim-line offset pick (`isDimLineRefPhase`).
- Commit parity (WYSIWYG): `useDrawingHandlers.onDrawingPoint` (dim κλάδος) — ίδιο override στο committed point.

**Φ9.2 — Λαβές (IMPLEMENTED 2026-07-04):** όταν σέρνεις λαβή διάστασης, εμφανίζονται τα ίδια ίχνη ευθυγράμμισης
με anchors τα **υπόλοιπα defPoints** της διάστασης ⊕ acquired ⊕ ambient.
- **Anchors SSoT:** `useDimensionGrips.getDimGripAlignmentAnchors(kind, dim)` — ανά grip-kind επιστρέφει τα ρητά
  anchors (endpoint→partner origin· dim-line/text→οι δύο origins· aligned-extra→origins· radius/diameter/ordinate
  extra→center/datum-origin) ή `null` όταν η λαβή δεν μεταφράζει σημείο (linear rotation handle, angular vertices) →
  παράλειψη. `toDimensionEntity(raw)` = κοινός resolver του `DimensionEntity` (wrapper ή raw).
- **Resolve override (WYSIWYG):** `mouse-handler-move.ts` — ΜΕΤΑ το OSNAP/face/corner snap, ανεξάρτητα του OSNAP
  toggle, `resolveDimAlignmentTracking(moveWorldPos, anchors, …)` → override του `moveWorldPos` (→ grip delta →
  ghost geometry) + publish στο `DimAlignmentTrackingStore` (zero-React). `mouse-handler-up.ts` — ΙΔΙΟ override στο
  `upWorldPos` (commit ≡ preview). Το `dimGripKind` εκτίθεται στο mousedown (`grip-mouse-handlers` → `GripDragStore`).
- **Paint:** `useDimGripGhostPreview.ts` διαβάζει το store + `paintDimAlignmentTracking(...)` (νέος thin wrapper στο
  `dim-alignment-tracking.ts`, mirror του `paintRotationTracking`) πάνω από το ghost. ΕΝΑΣ resolve/frame τρέφει
  geometry + paint. Lifecycle clear: `GripDragStore.clearActiveDragGrip` (release/ESC) + commit. ⚠️ ADR-040 CHECK 6D (`cursor/`).
**Φ9.3 — Μετακίνηση (MERO — MOVE tool IMPLEMENTED 2026-07-04· row-move DEFERRED):**
- **MOVE tool (2-click «M») — IMPLEMENTED:** `useMovePreview.ts` (destination override + traces) + `useMoveTool.ts`
  (commit override), με ref anchor το base point (click #1) ⊕ ambient. Νέος convenience SSoT
  `resolveActionAlignmentTracking(cursor, refPoints, scale, sceneEntities)` στο `dim-alignment-tracking.ts` (διαβάζει
  POLAR/ORTHO + AutoAlign toggle, delegate στο `resolveDimAlignmentTracking`). Σειρά: ORTHO(F8) → AutoAlign override →
  ίδιο override σε preview & commit (WYSIWYG). Gated: με όλα τα CAD aids OFF → identity (καμία αλλαγή). Ισχύει για
  **κάθε** επιλογή (Revit/AutoCAD parity — το MOVE δείχνει ίχνη· 3px tolerance = απαλός μαγνήτης).
- **Row-move overlay («Λαβές Μετακίνησης Σειρών») — DEFERRED:** το `DimRowHandleOverlay` ζωγραφίζει **SVG** ghost
  (όχι canvas PreviewCanvas), οπότε τα canvas-based traces (`tracking-paint` SSoT) δεν ταιριάζουν χωρίς αρχιτεκτονική
  απόφαση (είτε SVG-paint των traces μέσα στο overlay = παράλληλο paint, είτε δρομολόγηση του row-ghost μέσω του
  canvas preview). Επιπλέον είναι ADR-040 perf-critical micro-leaf + η αλληλεπίδραση alignment↔normal-constrain
  (`projectRowDelta`) χρειάζεται προσοχή. Χρειάζεται ξεχωριστό session/απόφαση Giorgio → βλ. handoff.

**Φ9.4 — Action-drag «tracking pull» aperture (BUGFIX 2026-07-04):** τα ίχνη του Φ9.2/Φ9.3 (grip / MOVE / body-drag)
**ποτέ δεν εμφανίζονταν οπτικά** — το `resolveActionAlignmentTracking` γύριζε null σε κάθε frame. Root cause: τα action
drags έχουν **φτωχό anchor set** (μόνο `[basePoint]` ⊕ ambient· κανένα hover-acquired point — ο acquisition timer
τρέχει μόνο στο drawing-hover-handler) **και δεν κάνουν POLAR-lock πρώτα** (μόνο ORTHO), οπότε το single-anchor
`findClosestProjection` απαιτούσε τον **raw/ORTHO-only** cursor εντός **3px** ενός H/V/polar path → σε ελεύθερο
hand-drag πρακτικά ποτέ → null → fallback distance pill («λευκή πινακίδα κατά το σύρσιμο»). Η ΔΗΜΙΟΥΡΓΙΑ δούλευε γιατί
(α) κάνει hover-acquire σημεία, (β) περνά `segmentBase` (clean-corner intersections, flood-cap-exempt), (γ) POLAR-lock
πρώτα → ο cursor κάθεται στον άξονα → το ίδιο 3px κουμπώνει συχνά. **Fix:** το `matchTolerancePx` έγινε παράμετρος του
`resolveDimAlignmentTracking` (default 3 = OSNAP hover aperture, η δημιουργία αμετάβλητη)· ο `resolveActionAlignmentTracking`
περνά **8px** (`ACTION_ALIGN_TOLERANCE_PX` = AutoCAD tracking aperture). Έτσι όλοι οι action-drag consumers (MOVE 2-click,
body-drag, grip) παίρνουν ενιαία την ευρύτερη ανοχή → τα ίχνη κουμπώνουν όταν όντως ευθυγραμμίζεσαι, χωρίς να «κολλάνε»
παντού. Το προηγούμενο σχόλιο «3px = απαλός μαγνήτης» (Φ9.3) ήταν λάθος: 3px = ξυράφι για hand-drag. Test:
`dim-alignment-tracking-tolerance.test.ts` (3px reject / 8px resolve / 12px still-bounded).

**SSoT reuse:** `resolveAlignmentTracking`/`composeTrackingSnap`/`collectAmbientAlignmentAnchors`/`TrackingPointStore`,
`ambientAlignmentConfigStore` (AutoAlign toggle), `tracking-paint.ts`, `rotation-tracking-overlay.ts` (πρότυπο).
Ref: ADR-357 (Object Snap Tracking), ADR-397 (rotation consumer).

---

## 5. SSoT reuse (N.0 / N.12 — καμία διπλή υλοποίηση)

| Ανάγκη | Επαναχρησιμοποιούμενο SSoT | Αρχείο |
|---|---|---|
| Linetype → dash array | ADR-510 Unified Linetype | `linetype-iso-catalog`, `linetype-aliases.resolveAnyLinetype`, `bim-dash-resolver`, `getDashArray` |
| Lineweight → px | υπάρχων line lineweight resolver | QuickStyle / line render path |
| Ribbon bridge δομή | ADR-510 line bridge | `ui/ribbon/hooks/useRibbonLineToolBridge.ts` (`resolveSelected`/`patchEntity`/`UpdateEntityCommand`) |
| ACI → χρώμα | dim color resolver | `resolveDimColor()` (ήδη στους dim renderers) |
| Global style write | dim registry | `getDimStyleRegistry().updateCustomStyle()` |
| Ribbon keys | ήδη υπάρχει | `DIM_RIBBON_KEYS` / `isDimRibbonKey` (`dim-command-keys.ts`) |

---

## 6. Verification plan (για την υλοποίηση — όχι τώρα)

- **jest**: bridge tests (mirror των `useRibbonLineToolBridge` tests) + render helper tests
  (lineweight/linetype/arrowColor resolution) + data-model defaults.
- **browser-verify**: επιλογή διάστασης → αλλαγή κάθε ιδιότητας ανά μέρος (χρώμα/πάχος/τύπος/βελάκια
  γραμμής+προεκτάσεων+κειμένου) → optimistic update + `Ctrl+Z` undo.
- ❌ **ΟΧΙ `tsc`** από agent (N.17) — type-check από Giorgio / pre-commit hook.
- ⚠️ ADR-040 CHECK 6B/6D: η Φ2 τροποποιεί `DimensionRenderer.ts` → staged ADR υποχρεωτικά.

---

## 7. Changelog

- **2026-07-06 (Φ11 — Per-part VISIBILITY toggles / ορατότητα μερών διάστασης, UNCOMMITTED)** — Επέκταση του per-part
  ελέγχου από «στυλ» σε «ορατότητα»: εμφάνιση/απόκρυψη ανά διάσταση, σε οποιονδήποτε συνδυασμό, των μερών —
  βοηθητικές (αρ./δεξ.), κεντρική γραμμή, σημάδια άκρου (αρ./δεξ.). **SSoT audit (re-grep)**: βρέθηκαν ΗΔΗ πλήρη
  `suppressExtLine1/2` + `suppressDimLine1/2` (data+render+DXF 75/76/281/282)· έλειπε μόνο flag ορατότητας βέλους +
  UI. Απόφαση Giorgio: το «tick» = arrowhead block → **ΕΝΑ marker-toggle ανά πλευρά** (τρόπος AutoCAD/Revit· το ΣΧΗΜΑ
  μένει στο «Στυλ Βέλους»). Υλοποίηση: νέα `suppressArrow1/2` στο `DimStyle`+defaults· render gate σε **και τους δύο**
  renderers (`DimensionRenderer`+`preview-dimension-renderer`, preview≡commit)· νέο `DIM_RIBBON_KEYS.visibility`+
  `isDimVisibilityKey`· `useRibbonDimBridge` απέκτησε `getToggleState`/`onToggle` (VISIBILITY_FIELD_MAP, «ορατό»=κανένα
  `suppress*` set· κεντρική=1 toggle→2 μισές) μέσω του ΙΔΙΟΥ undoable `overrides` path (μηδέν νέα store)· νέο panel
  «Ορατότητα» (5 `type:'toggle'`, icon `Eye`) στο contextual tab· wiring 2 branches στο `useRibbonCommands`·
  i18n el+en (1 panel + 5 commands). **Global surface = reuse, ΟΧΙ phase-2**: το `LinesSection.tsx` (Φ5) ήδη έχει
  `BoolField` για `suppressDimLine1/2`+`suppressExtLine1/2` → προστέθηκαν 2 ακόμη για `suppressArrow1/2` (+labels
  `dxf-viewer-panels`). ΕΝΑ data SSoT (`suppress*`), ΔΥΟ surfaces (ribbon override + Style Manager global) — ίδιο μοτίβο
  με Φ1-Φ5. DXF (honesty): τα `suppressArrow1/2` persist-άρονται μόνο εσωτερικά (scene JSON) — ο απλοποιημένος writer
  δεν εκπέμπει block names, οπότε δεν γίνεται fake DIMSAH (documented). Πλήρες root-cause/files: **ADR-362 §7 Round 36**. tsc SKIP (N.17)·
  🔴 browser-verify Giorgio. ✅ Google-level: FULL SSoT reuse, preview≡commit, undoable, honest DXF scope.
- **2026-07-04 (Φ9.4 — Action-drag «tracking pull» aperture, BUGFIX, UNCOMMITTED)** — Τα alignment ίχνη των Φ9.2/Φ9.3
  (grip / MOVE / body-drag) **ποτέ δεν εμφανίζονταν** (`resolveActionAlignmentTracking` → null κάθε frame): τα action
  drags έχουν μόνο `[basePoint]` anchor, κανένα hover-acquire, και δεν κάνουν POLAR-lock → το single-anchor projection
  με **3px** (OSNAP hover aperture) δεν κουμπώνει ποτέ με το χέρι → fallback «λευκή πινακίδα». Fix: `matchTolerancePx`
  παράμετρος στο `resolveDimAlignmentTracking` (default 3, δημιουργία αμετάβλητη)· ο `resolveActionAlignmentTracking`
  περνά **8px** (`ACTION_ALIGN_TOLERANCE_PX`, AutoCAD tracking aperture) → όλοι οι action-drag consumers παίρνουν ενιαία
  την ευρύτερη ανοχή. ΕΝΑ αρχείο (`dim-alignment-tracking.ts`)· τα preview hooks το κληρονομούν. Test:
  `dim-alignment-tracking-tolerance.test.ts` (3/3 GREEN, +179 tracking/dim regression GREEN). Διορθώνει το ΠΡΟΒΛΗΜΑ Α
  του handoff-2026-07-04 (structural-single-path-and-gesture-unification). Εκκρεμεί browser-verify (screenshot-driven).
- **2026-07-04 (Φ9.3 — Alignment traces στο MOVE tool (2-click «M»), UNCOMMITTED)** — Η μετακίνηση με το εργαλείο
  MOVE δείχνει πλέον ίχνη ευθυγράμμισης με ref anchor το base point (click #1) ⊕ ambient, WYSIWYG (preview ≡ commit).
  Νέος convenience SSoT `resolveActionAlignmentTracking` (`dim-alignment-tracking.ts` — διαβάζει POLAR/ORTHO +
  AutoAlign toggle, delegate στο `resolveDimAlignmentTracking`). Wiring: `useMovePreview` (override του destination +
  `paintDimAlignmentTracking`) + `useMoveTool.handleMoveClick` (ίδιο override στο commit). ORTHO(F8)→AutoAlign σειρά.
  Gated: με CAD aids OFF → identity (καμία αλλαγή). Ισχύει για ΚΑΘΕ επιλογή (Revit/AutoCAD parity, 3px tolerance).
  **DEFERRED — row-move overlay:** SVG ghost vs canvas traces + ADR-040 perf-critical leaf → ξεχωριστό session (handoff).
- **2026-07-04 (Φ9.2 — Alignment traces στις ΛΑΒΕΣ διάστασης / grip-drag, UNCOMMITTED)** — Το grip-drag διάστασης
  (endpoint / dim-line offset / text / aligned-extra / radius-diameter-ordinate extra) δείχνει πλέον τα ίδια ίχνη
  ευθυγράμμισης (AutoAlign) με τη δημιουργία. SSoT audit (grep) ΠΡΙΝ: επαναχρησιμοποιήθηκε ο έτοιμος wrapper
  `resolveDimAlignmentTracking` (Φ9.1) + το πρότυπο grip consumer `rotation-tracking-overlay`. Νέο: (α)
  `useDimensionGrips.getDimGripAlignmentAnchors` (anchors ανά grip-kind, `null` όπου δεν έχει νόημα) + κοινός
  `toDimensionEntity`· (β) `paintDimAlignmentTracking` (thin wrapper στα `tracking-paint` SSoT, mirror του
  `paintRotationTracking`)· (γ) zero-React `DimAlignmentTrackingStore` (μία resolve/frame → geometry + paint).
  Wiring: `grip-mouse-handlers`→`GripDragStore.dimGripKind` (publish στο mousedown)· `mouse-handler-move` (override
  `moveWorldPos` + store set, ΜΕΤΑ OSNAP/face/corner, ανεξ. OSNAP toggle)· `mouse-handler-up` (ίδιο override στο
  `upWorldPos` → commit ≡ preview)· `useDimGripGhostPreview` (paint traces πάνω από το ghost). Lifecycle clear στο
  `clearActiveDragGrip` (release/ESC) + commit. ⚠️ ADR-040 CHECK 6D (staged με `mouse-handler-*` + `GripDragStore`).
  Επόμενο: Φ9.3 μετακίνηση (row-move + MOVE tool).
- **2026-07-04 (Φ9.1 — Alignment traces στη δημιουργία διάστασης, UNCOMMITTED)** — Η δημιουργία διάστασης
  δείχνει πλέον τα ίδια ίχνη ευθυγράμμισης (AutoAlign) με κάθε άλλο εργαλείο, με anchors τα ήδη-picked σημεία
  ⊕ acquired ⊕ ambient. Νέος κοινός SSoT wrapper `hooks/dimensions/dim-alignment-tracking.ts`
  (`resolveDimAlignmentTracking`, δέχεται ρητά refPoints — mirror του `rotation-tracking-overlay`). Wiring: dim
  κλάδος στο `drawing-hover-handler.ts` (hover override + `drawTrackingAlignment`) + `useDrawingHandlers.onDrawingPoint`
  (commit parity, WYSIWYG). Skipped στο free dim-line offset pick. Phased (Giorgio): Φ9.2 λαβές + Φ9.3 μετακίνηση
  σε επόμενο γύρο. Reuse: `composeTrackingSnap`/`collectAmbientAlignmentAnchors`/`TrackingPointStore`. 🔴 browser-verify.
- **2026-07-04 (Φ7 test-alignment)** — `useRibbonDimBridge.test.tsx`: ευθυγράμμιση των 5 stale assertions με το
  Φ7 hex-picker contract (ο κώδικας ήταν ήδη σωστός — code = SoT). Read πεδία χρώματος → **HEX** (`dimclrd`
  ACI 1 → `#FF0000`, `arrowColor` ACI 3 → `#00FF00`, ByLayer 256 → default `#ffffff`)· writes → **ACI
  (`findClosestAci`) + true-color companion (`hexToTrueColor`)** (`dimclrd`+`dimclrdTrueColor`,
  `arrowColor`+`arrowTrueColor`). Καμία αλλαγή production κώδικα. **23/23 GREEN**. (Παράλληλα: το
  `contextual-dimensions-tab.test.ts` ενημερώθηκε για το νέο `dim-entity` tool — 15 tool keys.)
- **2026-07-04 (Φ8 — Linetype/Arrowhead thumbnails, UNCOMMITTED)** — Τα ribbon dropdowns «Τύπος» (linetype,
  γραμμή + προεκτάσεις) και «Στυλ» (βελάκια) της Διάστασης δείχνουν πλέον **inline-SVG preview** δίπλα στο
  όνομα (AutoCAD/Figma-style), theme-correct μέσω `currentColor`. Νέοι SSoT builders
  `rendering/linetype-thumbnail.ts` + `systems/dimensions/arrowhead-thumbnail.ts` (ίδια γεωμετρία με renderer)·
  νέο component `RibbonComboboxThumbnail.tsx`· `RibbonComboboxOption.thumbnail?` + rendering στο
  `RibbonComboboxDefault`· wiring στο `useRibbonDimBridge`. Reuse: `resolveAnyDashMm`/`dashMmToScreenPx`,
  `ARROWHEAD_BLOCKS`, `imageUrl` pattern· πρότυπο `HatchPatternPicker`/`hatch-pattern-thumbnail.ts`. 🔴 browser-verify.
- **2026-07-04 (Φ7 — Dimension true-color / enterprise color picker, UNCOMMITTED)** — Τα 4 ribbon πεδία
  «Χρώμα» της Διάστασης (γραμμή/προεκτάσεις/βελάκια/κείμενο) άλλαξαν από ACI dropdown σε **enterprise color
  picker** (`comboboxVariant:'dxf-color'` → `RibbonColorField`), με **πλήρες true-color**. Νέα optional companion
  πεδία στο `DimStyle` (`dimclrdTrueColor`/`dimclreTrueColor`/`dimclrtTrueColor`/`arrowTrueColor`, packed
  `0xRRGGBB`)· νέος resolver `resolveDimColorTC` (true-color πρώτα, αλλιώς ACI)· render (main+preview+text) περνά
  τα companion· bridge γράφει hex→(true-color + πλησιέστερο ACI)· DXF writer degrade true-color→ACI (176/177/178).
  Reuse: `trueColorToHex`/`hexToTrueColor`, `findClosestAci`. Αφαιρέθηκε ο ACI `COLOR_OPTIONS`. Αρχεία:
  `types/dimension.ts`, `dim-color-resolver.ts`, `DimensionRenderer.ts`, `dim-text-renderer.ts`,
  `preview-dimension-renderer.ts`, `useRibbonDimBridge.ts`, `contextual-dimension-tab.ts`, `dxf-dimstyle-writer.ts`.
  ⚠️ ADR-040 CHECK 6B/6D: τροποποιεί `DimensionRenderer.ts`/preview → staged ADR (αυτό το αρχείο). 🔴 browser-verify.
- **2026-07-01 (Φ5c FIX — «Στροφή/Θέση Κειμένου» wired, UNCOMMITTED)** — Browser-verify: το ribbon
  **«Στροφή Κειμένου»** (`dim.text.rotation`) ΔΕΝ λειτουργούσε. **ΔΥΟ bugs:** (1) το `dim.text.rotation`
  ΚΑΙ το `dim.text.position` ΔΕΝ ήταν στο `DIM_KEY_MAP` → `onComboboxChange` no-op (ίδιο μοτίβο με τον
  chooser)· (2) ο `linear-aligned-builder` υπολόγιζε το text angle ΑΠΟΚΛΕΙΣΤΙΚΑ από τη γεωμετρία
  (`computeTextRotation(angle, dimtih)`) **αγνοώντας** το entity-level `textRotation` override. **Fix:**
  (α) bridge — `dim.text.position` → `DIM_KEY_MAP` (νέο `kind:'enum'`, γράφει `overrides.dimtad`)·
  `dim.text.rotation` → special branch (entity field `textRotation` deg, ΟΧΙ override) read/write μέσω
  `patchEntity`. (β) `computeTextRotation` (κοινό SSoT) δέχεται optional `overrideDeg` (deg→rad, replace)·
  ο linear/aligned builder περνά `entity.textRotation` (καλύπτει linear+aligned+chained). Tests: bridge
  position+rotation (5) + linear builder override (1) — 2742/2742 dim suites GREEN. 🔴 commit + browser-verify.
  ⚠️ radial/angular/ordinate builders δέχονται το ίδιο param αλλά δεν το περνούν ακόμη (μελλοντικό, αν ζητηθεί).
- **2026-07-01 (Φ5b FIX — DIMSTYLE chooser + «Εφαρμογή Στυλ» wired, UNCOMMITTED)** — Browser-verify
  αποκάλυψε ότι το ribbon **«Στυλ Διάστασης» dropdown** (`dim.style.chooser`) ήταν **νεκρό stub**:
  δεν υπήρχε στο `DIM_KEY_MAP` → `getComboboxState` null + `onComboboxChange` no-op → η επιλογή DIMSTYLE
  ΔΕΝ εφαρμοζόταν στην επιλεγμένη διάσταση. Επίσης το κουμπί **«Εφαρμογή Στυλ»** (`dim.style.apply`) ήταν
  `comingSoon` → toast «Σύντομα διαθέσιμο». **Fix (Revit type-selector):** (1) ο chooser wire-άρεται στο
  `useRibbonDimBridge` — read = `entity.styleId`, options **registry-driven** (`getDimStyleRegistry().
  getSnapshot().styles`, incl. custom), write = **immediate apply** `UpdateEntityCommand({ styleId })`
  (undoable). Γενίκευση `patchOverrides`→`patchEntity` (overrides ΚΑΙ styleId). (2) «Εφαρμογή Στυλ»
  γίνεται LIVE: propagates το styleId της primary διάστασης σε ΟΛΕΣ τις επιλεγμένες (batch «apply type to
  selection») μέσω `dim:apply-style-requested` EventBus → `useDimensionModify.buildApplyStyleCommands`
  (καθιερωμένο pattern, CompositeCommand atomic-undo). Αρχεία: `useRibbonDimBridge.ts`, `useDimensionModify.ts`,
  `dxf-special-actions.ts`, `drawing-event-map.ts`, `contextual-dimension-tab.ts` (apply: comingSoon→action).
  Tests: bridge chooser (4) + `buildApplyStyleCommands` (2) + tab structural update — 44/44 GREEN. 🔴 commit
  → Giorgio + browser-verify (επιλογή στυλ → άμεση αλλαγή· «Εφαρμογή Στυλ» → όλες οι επιλεγμένες).
- **2026-07-01 (Φ5 IMPLEMENTED, UNCOMMITTED)** — Style Manager per-part controls. SSoT audit (grep)
  ΠΡΙΝ τον κώδικα: (α) τα dim colours = **ACI numbers** → `EnterpriseColorDialog` (hex) = mismatch →
  **ACI `Select` + swatch** με ίδιο option set με Φ4 (συνέπεια), (β) lineweight derived από ISO catalog
  SSoT **χωρίς `as LineweightMm` cast** (lookup — ratchet-safe), (γ) linetypes = live
  `listSelectableLinetypeNames()`, (δ) swatch = `resolveDimColor` + `getDynamicBackgroundClass` (no inline
  style). 2 ΝΕΑ shared SSoT αρχεία (`dim-style-field-options.ts` data + `dim-style-fields.tsx` components:
  Num/Bool/Select/Color/Lineweight/Linetype fields — extract + reuse στα 3 sections, μηδέν copy-paste).
  `LinesSection` (dimclrd/dimclre + dimlwd/dimlwe + dimltype + dimltex1 mirror dimltex2), `TextSection`
  (dimclrt + textFontFamily), `SymbolsSection` (arrowColor `?? dimclrd`). i18n: 9 labels + byLayer + 8
  colorOptions σε el+en. Tests: `dim-style-per-part-controls.test.tsx` (7) + accordion mock cleanup.
  40 dim suites GREEN (542 tests, zero regression). 🔴 commit → Giorgio (stage: 2 ΝΕΑ + 3 sections +
  1 accordion test + 1 ΝΕΟ test + 2 locales + ADR). ⚠️ browser-verify: Style Manager → edit custom
  DIMSTYLE → χρώμα/πάχος/τύπος/font live update. ⚠️ flagged: unify Φ4 private COLOR/FONT options post-commit.
- **2026-07-01 (Φ4 IMPLEMENTED, UNCOMMITTED)** — Contextual tab. SSoT audit βρήκε ότι `color-swatch` =
  text-store-hardwired (σπασμένο για dims) → όλα τα per-part χρώματα combobox+COLOR_OPTIONS (bridge-wired).
  Single «Παράκαμψη» → 7 AutoCAD-grade per-part panels (Γραμμή/Προεκτάσεις/Βελάκια + Κείμενο χρώμα/font).
  Options reuse `LINEWEIGHT_RIBBON_OPTIONS`· linetype/arrow options=[] (bridge live). i18n: 3 panels +
  9 commands + 8 colorOptions σε el+en. Structural test rewrite (15, 7 panels). jest: 120/120 GREEN
  (8 dim suites Φ1-Φ4 + line bridge regression). 🔴 commit → Giorgio (stage: 1 tab + 1 test + 2 locales +
  ADR). ⚠️ browser-verify: επιλογή διάστασης → per-part panel controls → live update + Ctrl+Z.
- **2026-07-01 (Φ3 IMPLEMENTED, UNCOMMITTED)** — Ribbon bridge. SSoT audit (grep) → mirror ακριβώς του
  `useRibbonLineToolBridge` (resolveSelected/UpdateEntityCommand/live options). ΝΕΟ `useRibbonDimBridge.ts`
  (ΕΝΑ `DIM_KEY_MAP` οδηγεί read+write· unified ext-linetype mirror + arrow clear-siblings· options reuse
  `listSelectableLinetypeNames`/`listArrowheadBlockNames`). Wiring 4 αρχεία (dim-command-keys keys,
  useRibbonCommands 2 branches+deps, -types prop, useDxfViewerRibbon instantiation). Test
  `useRibbonDimBridge.test.tsx` (14) + line bridge suite GREEN. 🔴 commit → Giorgio
  (stage: 5 code [1 νέο] + 1 test + ADR). ⚠️ τα controls γίνονται ορατά/χρησιμοποιήσιμα στη Φ4 (tab).
- **2026-07-01 (Φ2 IMPLEMENTED, UNCOMMITTED)** — 2D rendering wiring. SSoT audit (grep) βρήκε τα 3
  canonical resolvers (`lineweightToPx`, `resolveAnyDashMm`, `dashMmToScreenPx`) → **ΕΝΑ** νέο shared pure
  helper `dim-stroke-resolver.ts` (`resolveDimStroke`) που τα ενώνει, καλείται από **και τους δύο**
  renderers (μηδέν διπλότυπο). `DimensionRenderer.ts`: `applyLineStyle` per-part width+dash, arrows
  `arrowColor ?? dimclrd`. `preview-dimension-renderer.ts`: `applyDimStroke` per-part (κρατά preview color),
  αφαιρέθηκε το dead `applySolidStroke`. Sentinel/ByLayer → 1px solid = **zero regression** (48 existing
  dim suites GREEN). Νέο test `dim-stroke-resolver.test.ts` (6). ⚠️ ADR-040 CHECK 6D → stage ADR-562 με
  τον κώδικα. 🔴 commit → Giorgio (stage: 3 code [1 νέο] + 1 test + ADR).
- **2026-07-01 (Φ1 IMPLEMENTED, UNCOMMITTED)** — Data model per-part styling. SSoT audit (grep) ΠΡΙΝ
  τον κώδικα: (α) τα 6 πεδία απόντα, (β) βρέθηκε canonical `LineweightMm` SSoT → `dimlwd/dimlwe`
  τυποποιήθηκαν ως `LineweightMm` (όχι σκέτο number/hundredths), (γ) `arrowColor` έγινε **optional**
  override channel (αντί required) ώστε να ταιριάζει το `?? dimclrd` fallback του render. Πεδία σε
  `types/dimension.ts` (import `LineweightMm`), defaults σε `sharedDefaults()`, seed στον
  `dim-style-importer.ts`, fixture update `dim-text-renderer-scene-units.test.ts`. Νέο test
  `dim-style-templates-per-part.test.ts` (3) + 47 existing dim suites GREEN. `resolveDimStyle` αμετάβλητο.
  🔴 commit → Giorgio (stage: 5 αρχεία + ADR).
- **2026-07-01** — Δημιουργία (PROPOSED). Research spike: χαρτογράφηση data-model / 3 render pipelines /
  UI (3 παράλληλα Explore agents + επιβεβαίωση). Καθορισμός 2 κενών (data-model: lineweight/linetype/
  arrowColor· UI: missing dim ribbon bridge + missing color controls). 4 scope αποφάσεις Giorgio.
  Σχέδιο 5 φάσεων υλοποίησης + 3 μελλοντικές. **Καμία υλοποίηση κώδικα.**
