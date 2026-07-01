# ADR-562 — Dimension Per-Part Styling (πλήρης έλεγχος χρώματος / πάχους / τύπου γραμμής / βελών ανά μέρος διάστασης)

> **Status:** 🟢 Φ1 IMPLEMENTED (UNCOMMITTED 2026-07-01) — data model έτοιμο· Φ2-Φ5 PROPOSED.
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

### Φ2 — Rendering wiring 2D (`DimensionRenderer.ts` + `preview-dimension-renderer.ts`)
- **Πάχος**: αντικατάσταση hardcoded `ctx.lineWidth=1` με resolved lineweight — **reuse του υπάρχοντος
  lineweight→px resolver των γραμμών** (QuickStyle/line render· ό,τι χρησιμοποιεί το `LineEntity.lineWidth`).
  Ξεχωριστά για dim-line (`dimlwd`) και extension lines (`dimlwe`).
- **Τύπος γραμμής**: αντικατάσταση hardcoded solid με **reuse του Unified Linetype SSoT (ADR-510)**:
  `linetype-iso-catalog` + `linetype-aliases.resolveAnyLinetype` + zoom×LTSCALE resolver
  (`getDashArray`/`bim-dash-resolver`). Δίνει dash array στο `ctx.setLineDash()`.
- **Βελάκια**: χρώμα από `resolveDimColor(style.arrowColor ?? style.dimclrd, layerColour)` αντί σκέτο
  `dimclrd` (`DimensionRenderer.ts:354` + `dim-arrowhead-renderer.ts`).
- Ο preview renderer αντικατοπτρίζει (ίδια sub-helpers· διατηρεί το preview-color override).
- ⚠️ **ADR-040 CHECK 6B/6D**: αγγίζει `DimensionRenderer.ts` → στην υλοποίηση θα γίνει staged **αυτό**
  το ADR (ή ADR-040) μαζί με τον κώδικα.

### Φ3 — Ribbon bridge (πρότυπο ADR-510 `useRibbonLineToolBridge.ts`)
- ΝΕΟ `ui/ribbon/hooks/useRibbonDimBridge.ts` — mirror του line bridge:
  - `getComboboxState(key)`: διαβάζει `resolveDimStyle(selectedDim)` για την τρέχουσα τιμή.
  - `onComboboxChange(key, value)`: γράφει στο `entity.overrides` μέσω **`UpdateEntityCommand`**
    (undoable, ίδιο generic `patchEntity()` pattern — `useRibbonLineToolBridge.ts:278-289`),
    π.χ. patch `{ overrides: { ...prev, dimclrd: aci } }`.
- Εγγραφή στο `useRibbonCommands.ts` (mirror `isLineToolRibbonKey`, γρ. ~255-257 & ~301):
  `if (isDimRibbonKey(key)) { dimBridge.onComboboxChange(key, value); return; }` και αντίστοιχα στο
  `getComboboxState`.
- Επέκταση `DIM_RIBBON_KEYS` (`dim-command-keys.ts`) με νέα keys ανά μέρος:
  `dimLine.{color,weight,type}`, `ext.{color,weight,type}`, `arrow.{color,size,style}`,
  `text.{color,font}` (κρατώντας τα υπάρχοντα `override.color`/`override.arrowStyle`/`text.height` κ.λπ.).

### Φ4 — Contextual tab controls (`contextual-dimension-tab.ts`)
- Ενεργοποίηση των STUB controls + προσθήκη νέων, οργανωμένα σε panels ανά μέρος
  (Γραμμή διάστασης / Προεκτάσεις / Βελάκια / Κείμενο): color-swatch + editable combobox για
  πάχος/τύπος/μέγεθος. **Reuse** `ARROW_STYLE_OPTIONS` + το editable-combobox pattern του line tab.
- i18n keys (N.11): προσθήκη σε `src/i18n/locales/el/*.json` **και** `en/*.json` **πριν** τη χρήση.

### Φ5 — Style Manager controls (`ui/panels/dimensions/DimStyleAccordion/*`)
- `LinesSection`: color pickers `dimclrd` + `dimclre`, + lineweight/linetype για dim & ext.
- `TextSection`: color picker `dimclrt` + font-family control (`textFontFamily`).
- `SymbolsSection`: arrow color (`arrowColor`).
- **Reuse** των υπαρχόντων `NumField`/`Select` + κοινό color-field component. Γράφει μέσω
  `getDimStyleRegistry().updateCustomStyle()`.

### Φ6 — Μελλοντικές φάσεις (μόνο τεκμηρίωση, εκτός τρέχοντος scope)
- **DXF round-trip**: writer `dxf-dimstyle-writer.ts` να εκπέμπει `DIMLWD/DIMLWE` (αντί hardcoded `-2`),
  `DIMLTYPE`(345)/`DIMLTEX1`(346)/`DIMLTEX2`(347)· importer `dim-style-importer.ts` να τα διαβάζει
  (σήμερα απορρίπτει block names / font / tfill — `dim-style-importer.ts:129,148-150,163`).
  `arrowColor` = μη-standard → xdata ή fallback `dimclrd`.
- **Per-side** χρώμα/μέγεθος/τύπος βελών & extension lines (arrow1/arrow2, ext1/ext2).
- **3D parity**: σύνδεση `Dimension3DRenderer.ts` με `DimStyle` (χρώμα/μέγεθος/τύπος βελών, font)
  αντί hardcoded `UI_COLORS_BASE`.

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
