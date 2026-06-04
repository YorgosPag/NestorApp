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
`bim-3d/preview/preview-orbit-controls.ts` (SSoT zoom/pan/rotate) · `bim-3d/preview/preview-pivot.ts` (SSoT Alt+click pivot pick + crosshair) ·
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
- **2026-06-04 (d)** — **Preview orbit** (commit `c7aa184e`): `PreviewOrbitControls` SSoT (LEFT=pan, RIGHT=rotate, wheel=zoom-to-cursor, render-on-demand) + Alt+left-click → orbit pivot, σε wall + slab preview.
- **2026-06-04 (f)** — **Υφές preview ταιριάζουν με 3D (τέλος «λωρίδες»)** (Opus): Ο Giorgio: το ίδιο υλικό φαινόταν «σκάκι» στο 3D αλλά «λωρίδες» στο preview. ΡΙΖΑ: το preview χρησιμοποιούσε `setPlanarWorldUvs(dominantAxis:'z')` που προβάλλει **ΟΛΕΣ** τις όψεις στο (x,y) — σωστό μόνο στην μπροστινή, αλλά στην **πάνω/πλαϊνή** όψη το y είναι ~σταθερό → το UV.v κατέρρεε → τεντωμένη λωρίδα. Το κύριο 3D (`slab-/wall-multilayer-solid-3d.ts`, ExtrudeGeometry + `ensureWorldUvs`) έχει σωστά per-face UV. **Fix:** νέο SSoT `setBoxWorldUvs` στο `bim-uv-helpers.ts` (ADR-413) — επιλέγει το ζεύγος world-axes **ανά όψη** βάσει του normal (±X→z,y · ±Y→x,z · ±Z→x,y), world meters όπως το 3D. Εφαρμόστηκε στα band boxes wall + slab preview. +4 tests, tsc 0. 🔴 browser verify + commit.
- **2026-06-04 (e)** — **Alt+drag orbit-around-cursor — SSOT με κύριο 3D** (Opus): Ο Giorgio: η περιστροφή στο 3D γίνεται με **Alt+σύρσιμο** και θέλει «το σημείο του κλικ = το σημείο περιστροφής», ΙΔΙΟ και στα δύο. ΡΙΖΑ: το pivot οριζόταν μόνο σε **static** Alt-click (pointer-up) → Alt+press-and-drag περιστρεφόταν γύρω από το παλιό κέντρο. **Fix και στα δύο:** το pivot ορίζεται στο **pointer-DOWN**. (Α) Κύριος viewport: νέο `tumble-rotation.onAltPress` (fired στο Alt+left down, wired `viewport-camera → scene-setup → ThreeJsSceneManager.setOrbitPivotAt`). (Β) Preview: `PreviewOrbitControls` πλέον Alt+left=ROTATE (window Alt keydown/keyup flips `mouseButtons.LEFT` ROTATE↔PAN, αφού το OrbitControls διαβάζει το mapping στο pointer-down) + στο Alt+left down καλεί `onAltPick`→re-centre target στο σημείο. Νέο SSoT `preview-pivot.ts`: `resolvePreviewPivot` (raycast bands → **fallback σε camera-facing plane** ώστε Alt+click οπουδήποτε να ορίζει pivot) + `PreviewPivotMarker` (crosshair `depthTest:false`, flash 900ms). Boy-Scout: αφαιρέθηκε το copy-pasted `setPivotAt`. tsc 0, +6 preview-pivot tests +2 tumble onAltPress tests. Εκτός ADR-040. 🔴 browser verify + commit.
