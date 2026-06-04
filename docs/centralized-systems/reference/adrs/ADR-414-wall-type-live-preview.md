# ADR-414 — Live 3D Preview Panel για Τύπο Τοίχου (per-layer τομή + υφές + αμφίδρομο highlight)

| Field | Value |
|---|---|
| Status | 🟢 **VERTICAL SLICE DONE** (2026-06-04, Opus — εγκεκριμένο Plan Mode). Αριστερό **panel ζωντανής 3D προεπισκόπησης** στο dialog «Επεξεργασία τύπου τοίχου» (`EditWallTypeDialog`, ADR-412 Φ5): συνθετικό κοντό stub τοίχου σε **προοπτική 3/4** (πρόσοψη + πάνω όψη), μία **textured band ανά στρώση** με **πραγματικές PBR υφές** (ADR-413), **ζωντανή** ενημέρωση καθώς αλλάζει το δεξί DNA editor, και **αμφίδρομο highlight** (hover στρώση δεξιά → λάμπει η band· hover band αριστερά → λάμπει η σειρά). Standalone mini-renderer **εκτός** ADR-040 high-freq path. tsc 0 (scope)· 5/5 helper tests PASS. 🔴 Εκκρεμεί browser verify + commit (Giorgio). |
| Date | 2026-06-04 |
| Owner | Giorgio / Claude (Opus, Plan Mode) |
| Related | **ADR-413** (PBR υφές — `getMaterial3D` texture-aware, `bim-texture-cache`, `bim-uv-helpers`, `wall-layer-geometry.layerBoundaryFractions` που reuse-άρει αυτό το ADR)· **ADR-412 Φ5** (Edit Wall Type dialog — host του preview)· **ADR-363** (Wall DNA layers)· **ADR-366** (`MaterialCatalog3D` / ThreeJsSceneManager — το preview ΔΕΝ το χρησιμοποιεί, είναι ξεχωριστό mini-scene)· **ADR-040** (canvas micro-leaf — **δεν αγγίζεται**· το preview είναι αυτόνομο WebGL context σε dialog) |

---

## Context — γιατί υπάρχει αυτό το ADR

Στο dialog «Επεξεργασία τύπου τοίχου» (ADR-412 Φ5) ο χρήστης συνθέτει τις στρώσεις του
τοίχου (DNA: εξωτ. σοβάς → φέρων → εσωτ. σοβάς) σε ένα κειμενικό editor δεξιά. Δεν έβλεπε
**πουθενά** το αποτέλεσμα — έπρεπε να κλείσει το dialog, να κοιτάξει το 3D, να επιστρέψει.
Ο Giorgio ζήτησε (σκίτσο 2026-06-04) ένα **αριστερό panel** που να δείχνει τον τοίχο σε
**προοπτική**, με τις στρώσεις **σε τομή** και **πραγματικές υφές**, να **ενημερώνεται ζωντανά**,
και με **αμφίδρομο highlight** ώστε να ξέρει ποια λωρίδα αντιστοιχεί σε ποια στρώση.

Όλα τα κομμάτια προϋπήρχαν (ADR-413, μόλις ολοκληρωμένο): per-layer fractions, texture-aware
materials, texture cache με async→resync, world-meter UV helpers. Αυτό το ADR τα **συνθέτει** σε
μια αυτόνομη μικρή 3D προεπισκόπηση.

## Decision

**Επιλογή Α — mini-3D viewport (perspective)** αντί 2D τομής (Giorgio confirmed, AskUserQuestion).

### Αρχιτεκτονική (3 layers, SSoT-first)

1. **Pure geometry** — `bim-3d/converters/wall-type-preview-geometry.ts`
   `buildWallTypePreviewBands(dna)` → μία band ανά στρώση `{ layerId, materialId, depthM, centerZM }`
   σε **μέτρα**, **reuse** του `layerBoundaryFractions` (ADR-413 crown-jewel) ώστε τα όρια να
   ταυτίζονται με τον πραγματικό τοίχο. Καθαρά μαθηματικά, χωρίς THREE/store. **Testable.**

2. **Mini-renderer** — `bim-3d/preview/WallTypePreviewRenderer.ts`
   Αυτόνομο, **lightweight** WebGL scene (ΟΧΙ `ThreeJsSceneManager`/`BimViewport3D` — το ADR-040
   high-freq path). Shadows OFF, **render-on-demand** (ένα frame ανά αλλαγή, χωρίς RAF loop),
   **fixed camera 3/4**. Κάθε band = `BoxGeometry` (world-meter UVs μέσω `setPlanarWorldUvs`) με
   `material = getMaterial3D(materialId)` (texture-aware). Highlight = bright **edge outline** στην
   active band — **ΠΟΤΕ** mutation των shared material singletons (θα μόλυνε το κύριο scene).
   `dispose()` αποδεσμεύει το WebGL context (browsers cap concurrent contexts).

3. **React wrapper** — `ui/ribbon/components/WallTypePreviewPanel.tsx`
   Μόνο React lifecycle: mount/dispose, `dna`→`setDna`, `highlightLayerId`→`setHighlight`,
   subscribe `textureAssetVersion` (`Bim3DEntitiesStore`) → `applyTextures()` όταν φορτώσει
   async υφή, ResizeObserver→`resize`, pointer→`pickLayerAt`→`onHighlightLayer`. Semantic `<section>`.

### Αμφίδρομο highlight
`WallDnaEditor` δέχεται **optional** `highlightLayerId?` + `onHighlightLayer?` (additive, back-compat
→ ο instance-consumer `WallDnaSection` δεν τα περνά, μηδέν αλλαγή). Το `DnaLayerRow` σε
`onPointerEnter`/`onFocusCapture` → broadcast· ring όταν `isHighlighted`. Το shared state ζει
τοπικά στο `EditWallTypeDialog` (`useState`), δίνεται και στο preview και στον editor.

## Consequences

- **+** Ο χρήστης βλέπει ζωντανά τη σύνθεση με πραγματικές υφές· κατανοεί ποια στρώση επεξεργάζεται.
- **+** Μηδέν επίδραση στο κύριο 3D/2D path· ξεχωριστό context, καθαρό dispose.
- **−** Νέα WebGL capability σε dialog → προσοχή στο context leak (καλύπτεται από `dispose`).
- **−** Οι υφές φαίνονται μόνο όσες έχουν ανέβει (ADR-413 hybrid source· default public = concrete/brick/plaster). Οι υπόλοιπες → graceful flat fallback.
- Box UVs: world-meter projection στην κύρια (Z) όψη· top/side faces ελαφρώς προσεγγιστικά — αποδεκτό για preview.

## Files

**ΝΕΑ:** `bim-3d/converters/wall-type-preview-geometry.ts` · `bim-3d/preview/WallTypePreviewRenderer.ts` ·
`ui/ribbon/components/WallTypePreviewPanel.tsx` · `bim-3d/converters/__tests__/wall-type-preview-geometry.test.ts` · αυτό το ADR.
**MOD:** `ui/ribbon/components/EditWallTypeDialog.tsx` (2-column layout, size lg→xl, highlight state) ·
`ui/wall-advanced-panel/sections/WallDnaEditor.tsx` (optional highlight props) ·
`i18n/locales/{el,en}/dxf-viewer-shell.json` (`bimFamilyType.preview.*`).

## ADR-040
Δεν εφαρμόζεται staging: τα αρχεία δεν ανήκουν στη λίστα CHECK 6B/6D (BimSceneLayer/DxfRenderer/
HoverStore/leaves κ.λπ.). Το preview είναι αυτόνομο WebGL scene, εκτός του high-freq canvas path.

## Changelog
- **2026-06-04** — Vertical slice (Opus, Plan Mode): pure band geometry + mini-renderer + React panel + αμφίδρομο highlight + i18n el/en + 5 helper tests. tsc 0 (scope). 🔴 browser verify + commit εκκρεμούν.
- **2026-06-04 (b)** — Camera refinements (browser-verified): VIEW_DIR=(1.5,1.05,0.85) (πλάι+πάνω όψη)· `fitCamera` = exact 8-corner frustum fit (όχι bounding-sphere) ×1.04 margin → κεντραρισμένο, καμία γωνία clipped.
- **2026-06-04 (c)** — **Floating-panel pivot** (Giorgio): modal `Dialog` → SSOT `FloatingPanel` (`@/components/ui/floating`, μη-modal → καμβάς επιλέξιμος)· SSOT positioning `PanelPositionCalculator.getTopRightPosition`· width 1010 / grid `[1fr_25rem]`. **Save δεν κλείνει** (μόνο persist)· **Cancel απορρίπτει** (draft=`structuredClone`)· **follow-selection** effect (μόνο typed walls). 🔴 Επόμενο: πλήρες Revit wall-type system (auto-assign τύπου + migration untyped walls) — handoff `HANDOFFS/2026-06-04_adr414-preview-floating-DONE_revit-wall-types-NEXT.md`.
