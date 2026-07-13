# ADR-649 — Εργαλείο «Ετικέτα Εμβαδού Γραμμοσκίασης» (Hatch Area Label)

- **Status**: 🔵 PROPOSED
- **Date**: 2026-07-13
- **Category**: DXF Viewer / Annotation / Hatch
- **Σχετικά**: ADR-507 (Hatch Creation System), ADR-557 (Center Measurement Label), ADR-344 (Enterprise Text Engine), ADR-462 (Canonical mm units), ADR-057 (`completeEntity` unified pipeline), ADR-040 (event-time SSoT reads)

---

## Context (το πρόβλημα)

Ο χρήστης θέλει, με το ποντίκι, να **διαβάζει το εμβαδόν μιας γραμμοσκίασης** και να
**τοποθετεί μόνιμη ετικέτα-κείμενο** με αυτό το εμβαδόν μέσα στο σχέδιο (annotation που
επιλέγεται / μετακινείται / σβήνεται / υποστηρίζει undo — όχι εφήμερο overlay/tooltip).

Υπήρχε ήδη το `auto-measure-area` (κλικ μέσα σε πολύγωνο → υπολογισμός εμβαδού) αλλά δείχνει
**screen-space HTML panel** (`AutoAreaResultStore` + `AutoAreaResultPanel`), όχι entity στο
σχέδιο. Επίσης όλα τα δομικά κομμάτια (εμβαδόν hatch, format, centroid, text entity, pattern→
υλικό) υπήρχαν ήδη ως SSoT — έλειπε μόνο η **ενορχήστρωση 2 κλικ**.

## Decision (η λύση)

Νέο **2-κλικ placement/creation tool** `'hatch-area-label'` (category `drawing`):

1. **Κλικ 1** — `pickTopHatchAt` (even-odd SSoT) διαλέγει τη γραμμοσκίαση κάτω από τον κέρσορα,
   την κλειδώνει στην FSM και την highlight-άρει (`replaceEntitySelection`).
2. **Κλικ 2** — χτίζει `TextEntity` με το εμβαδόν και το commit μέσω `completeEntity`
   (undo + persistence + `drawing:complete`). **Θέση (hybrid, επιλογή Giorgio):** αν το 2ο κλικ
   πέσει ΜΕΣΑ στην ίδια γραμμοσκίαση → **centroid** (`polygon2DAreaCentroid`)· αλλιώς → **σημείο
   του κλικ**. Μετά το commit επαναφορά στη φάση 1 (συνεχής χρήση, AutoCAD-style).

**Κείμενο (i18n, N.11):** «Εμβαδόν: 25,00 m²», και όταν το `HatchEntity.patternName` αντιστοιχεί
σε αναγνωρίσιμο υλικό (`HATCH_PATTERN_CATALOG`) → «Εμβαδόν **γρασιδιού**: 25,00 m²». Η γενική
(genitive) ζει ΜΟΝΟ στο locale (`hatchAreaLabel.materials.<key>`), με `i18n.exists` guard·
MISS → fallback στο σκέτο «Εμβαδόν: …». (EN: `of grass`/`of concrete`/… → «Area of grass: …».)

### Reuse (μηδέν re-implementation)

| Ανάγκη | SSoT |
|---|---|
| Εμβαδόν (mm², outer−islands) | `computeHatchAreaMm2` (`bim/hatch/hatch-completion.ts`) |
| Format ενεργής μονάδας | `formatAreaForDisplay` (`config/display-length-format.ts`) |
| Pick hatch (even-odd) | `pickTopHatchAt` (`bim/hatch/hatch-pick-at.ts`) |
| Centroid (area-weighted) | `polygon2DAreaCentroid` (`bim/geometry/shared/polygon-utils.ts`) |
| pattern → υλικό | `HATCH_PATTERN_CATALOG[patternName].labelKey` → i18n |
| textNode (unit-safe ύψος) | `makeRun`/`makeParagraph`/`makeNode` + `paperHeightToModel` |
| commit + undo + persistence | `completeEntity` (`hooks/drawing/completeEntity.ts`) |
| enterprise id | `generateEntityId` (N.6) |

### Αρχιτεκτονική (auto-area pattern, ADR-040-safe)

- **Pure builders**: `bim/hatch/hatch-area-label.ts` (`buildHatchAreaLabelText`,
  `resolveHatchMaterialGenitive`, `resolveHatchLabelAnchor`, `buildHatchAreaLabelTextNode`,
  `buildHatchAreaLabelEntity`).
- **FSM store** (vanilla, event-time): `bim/hatch/hatch-area-label-store.ts`
  (`awaitingHatch` → `awaitingPlacement`). Ο click handler διαβάζει live getter (ΟΧΙ React snapshot).
- **Click handler**: `handleHatchAreaLabelClick` (`hooks/canvas/canvas-click-tool-handlers.ts`),
  dispatch από `useCanvasClickHandler` PRIORITY 1.72 (πριν το unified accumulator).
- **Lifecycle**: `hooks/drawing/useHatchAreaLabelTool.ts` (reset FSM + status prompt σε
  activate/deactivate), wired στο `useSpecialTools-placement-tools.ts`.
- **Registration**: `ToolType 'hatch-area-label'`· `TOOL_DEFINITIONS` (category `drawing` ⇒
  `isInDrawingMode=true`, ώστε το mouse-up select block να ΜΗΝ τρέχει παράλληλα → κανένα διπλό
  select)· `TOOL_CREATES_ENTITY: 'text'`· ribbon κουμπί στο Annotate/Measure panel.

## Consequences

- ✅ Η ετικέτα είναι κανονικό `TextEntity` — select/move/delete/undo, persist όπως κάθε text.
- ✅ Το εμβαδόν παραμένει συνεπές με τα υπόλοιπα readouts (ίδιο `computeHatchAreaMm2` +
  `formatAreaForDisplay` που ήδη χρησιμοποιεί το `RibbonHatchListWidget`).
- ⚠️ Η ετικέτα **δεν** ενημερώνεται αυτόματα αν αλλάξει το όριο της γραμμοσκίασης (είναι
  στιγμιότυπο, όχι associative dimension) — αποδεκτό για annotation. Μελλοντικό follow-up:
  associative area label.
- ⚠️ Γενικές (genitive) υπάρχουν μόνο για ~15 ground/construction/metal/insulation patterns·
  τα υπόλοιπα πέφτουν καθαρά στο «Εμβαδόν: …».

## Changelog

- **2026-07-13** — Αρχική υλοποίηση (2-κλικ tool, hybrid anchor, pattern→genitive label,
  reuse όλων των SSoT). Νέα αρχεία: `hatch-area-label.ts`, `hatch-area-label-store.ts`,
  `useHatchAreaLabelTool.ts`. i18n: `hatchAreaLabel.*` + `ribbon.commands/tooltips.hatchAreaLabel`
  (el+en).
