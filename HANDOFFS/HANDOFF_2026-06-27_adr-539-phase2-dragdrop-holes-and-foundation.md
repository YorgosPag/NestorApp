# HANDOFF — ADR-539 Cinema 4D «Polygon Mode» · Φ1.5 (foundation) + Φ2 (drag-drop / holes / custom color / hover)

**Date:** 2026-06-27 · **Status:** Φ1 (slab) ✅ COMMITTED & browser-verified · επόμενο = Φ1.5 + Φ2 · **Model:** Opus (orchestrator-scale)

---

## 🎯 ΣΤΟΧΟΣ ΤΗΣ ΣΥΝΕΔΡΙΑΣ

Συνεχίζεις το **ADR-539** (per-face χρώμα/υλικό ανά όψη δομικού solid, Cinema 4D Maxon / Revit «Paint on face»).
Η **Φ1 (slab, click-to-apply) είναι ΟΛΟΚΛΗΡΩΜΕΝΗ & committed**. Δύο επόμενα increments:

- **Φ1.5 (Μικρό — προτείνεται ΠΡΩΤΑ):** επέκταση σε **foundation** (πέδιλα/θεμέλια). Ολοκληρώνει το «όλα τα δομικά solids» για τη βασική περίπτωση. ΜΟΝΟ converter + persistence wiring (η αρχιτεκτονική είναι ήδη solid-agnostic).
- **Φ2 (Μεσαίο — η Cinema 4D υπογραφή):** **HTML5 drag-drop** υλικού από βιβλιοθήκη πάνω στην όψη · **holes/ανοίγματα** στο faced path · **custom χρώμα** μέσω `EnterpriseColorDialog`/`UnifiedColorPicker` · **face hover** (preview πριν το κλικ).

**Ποιότητα: FULL ENTERPRISE + FULL SSOT, Revit/Maxon-grade. Μηδέν διπλότυπα.**

---

## 🚨 ΠΡΩΤΟ ΒΗΜΑ — ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ

**Μην εμπιστευτείς τυφλά αυτό το handoff.** Κάνε ΠΡΑΓΜΑΤΙΚΟ grep για να επιβεβαιώσεις/βρεις reuse. Ελάχιστα targets
(τα ⟶ έχουν ήδη επαληθευτεί στο audit της 2026-06-27· ξανατρέξ' τα για σιγουριά + ψάξε ό,τι αλλιώς):

1. **Foundation render:** `foundationToMesh` ⟶ `bim-3d/converters/foundation-to-three.ts:68` (χρησιμοποιεί
   `getElementMaterial3D('foundation-${kind}')` + ExtrudeGeometry). Πρότυπο: ό,τι έκανα στο slab.
2. **Foundation persistence:** `foundation-firestore-service.ts` ⟶ `bim/foundations/foundation-firestore-service.ts`
   (`FoundationDoc`/`FoundationSaveInput`/`saveFoundation`/`entityToSaveInput`) + το αντίστοιχο `docToEntity`
   στο `hooks/data/*foundation*persistence*` (grep `useFoundationPersistence`, `foundation-persistence-helpers`).
3. **Faced prism + face material (ΗΔΗ ΥΠΑΡΧΟΥΝ — reuse, ΜΗΝ ξαναγράψεις):**
   `bim-3d/converters/bim-three-faced-prism.ts` (`buildFacedPrism` → groups + `faceKeyByMaterialIndex`),
   `bim-3d/materials/face-appearance-material.ts` (`resolveFaceMaterial`).
4. **Holes/openings (Φ2):** `THREE.ShapeUtils.triangulateShape(contour, holes)` · `pushHoles`
   ⟶ `bim-3d/converters/bim-three-shape-helpers.ts` · `wall-opening-extrude.ts` ·
   `structural-finish-horizontal-3d.ts`. **Τα slab openings ΗΔΗ φτάνουν** στο `slabToMesh` ως `openings` param:
   `BimSceneLayer.ts:343` `filterHostedSlabOpenings(...)` → `openingsForSlab`. Άρα το faced path απλώς πρέπει
   να ΤΑ ΧΡΗΣΙΜΟΠΟΙΗΣΕΙ (σήμερα τα αγνοεί).
5. **HTML5 drag-drop πρότυπα (Φ2):** `dataTransfer`/`onDrop`/`onDragOver` ⟶ `ui/ribbon/hooks/useRibbonTabDrag.ts`,
   `ui/ribbon/components/RibbonTabItem.tsx`, `bim-3d/lighting/HdriUploader.tsx`,
   `bim-3d/comments/CommentAttachmentUploader.tsx`. **Δεν υπάρχει ακόμη** `application/x-bim-material` MIME →
   νέο, αλλά mirror των παραπάνω.
6. **Custom color (Φ2):** `EnterpriseColorDialog` ⟶ `ui/color/EnterpriseColorDialog.tsx`,
   `ui/color/UnifiedColorPicker.tsx`, `ui/ribbon/components/RibbonColorField.tsx` (το canonical ribbon wrapper).
7. **Face hover (Φ2):** `HoverStore` (`systems/hover/HoverStore.ts`) + `applyBimHover` + το ADR-538 hover pattern
   (`use-bim3d-pointer-handlers.ts` `pickHover`). Reuse τον `FaceSelectionHighlighter` (δεύτερο instance ή hover material).
8. **Material 3D (αν θες πραγματικό PBR αντί flat χρώμα):** `getMaterial3D`/`getElementMaterial3D`
   (`bim-3d/materials/MaterialCatalog3D.ts`), `MaterialLibraryService` (`bmat_*`), `material-catalog-defs.ts`.

➡️ Αν κάποιο grep δείξει ότι κάτι υπάρχει ήδη → **reuse / extend**, ενημέρωσε το ADR-539, ανέφερέ το στον Giorgio (100% ειλικρίνεια).

---

## 📦 ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ (Φ1 — COMMITTED· τα building blocks της Φ2/Φ1.5)

**Solid-agnostic πυρήνας (έτοιμος για κάθε kind):**
- `bim/types/face-appearance-types.ts` — `FaceKey` (`top`/`bottom`/`side:${i}`/`sub:${i}:${string}`),
  `FaceAppearance { materialId?; colorHex? }`, `FaceAppearanceMap = Readonly<Record<string, FaceAppearance>>`.
- `bim/types/bim-base.ts` — `BimEntity.faceAppearance?` (base field· **όλα τα solids το έχουν ήδη**, incl. foundation).
- `bim-3d/converters/bim-three-faced-prism.ts` — `buildFacedPrism(topRing, depthM)` → `{ geometry (groups),
  faceKeyByMaterialIndex }`. materialIndex 0=bottom, 1=top, 2+i=side:i. **ΧΩΡΙΣ holes** (Φ2 το προσθέτει).
- `bim-3d/materials/face-appearance-material.ts` — `resolveFaceMaterial(faceKey, appearance, baseMat)` (flat colour
  από `getWallCoveringColor`· αβαφές → base material).
- `core/commands/entity-commands/SetFaceAppearanceCommand.ts` — **generic** (1 command για 6 kinds· γράφει το base
  `faceAppearance`, reuse `signalEntitiesAttached`· apply/undo/redo/no-merge).
- `bim-3d/stores/PolygonMode3DStore.ts` — `active`, `targetBimId`, `selectedFace`, `setActive(active, bimId?)`,
  `selectFace`, `reset`.
- `bim-3d/systems/selection/FaceSelectionHighlighter.ts` — overlay sub-mesh (group range, parented στο target mesh).
- `bim-3d/systems/raycaster/BimEntityRaycaster.ts` — `raycastBimFace` + `RaycastHit.faceKey`.
- `bim-3d/ui/PolygonMaterialPanel.tsx` — βιβλιοθήκη swatches (click-to-apply· reuse `listWallCoveringMaterials`).
- `bim-3d/viewport/PolygonModeToggle3D.tsx` — toggle button «⬢ Όψεις» + lifecycle (gate `POLYGON_FACED_KINDS={'slab'}`).
- `bim-3d/scene/ThreeJsSceneManager.ts` — `raycastBimFace`, `setSelectedFace`, `faceHighlighter` + `refresh()` στο sync.

**Slab-specific (πρότυπο για foundation):**
- `bim-3d/converters/bim-three-slab-converter.ts` — `buildFacedSlabBody` + gate
  `facedByAppearance || facedByPolygonTarget` (όπου polygon-target = `PolygonMode3DStore.active && targetBimId===id`).
  **ΣΗΜΑΝΤΙΚΟ:** το faced path καλείται όταν η πλάκα είναι ο live Polygon target (λύνει το chicken-and-egg:
  pickable όψεις πριν την πρώτη βαφή). Το toggle κάνει `resyncBimScene` (`bimLayer.sync()` = rebuild-all).
- slab persistence round-trip: `bim/slabs/slab-firestore-service.ts` (`SlabDoc`/`SlabSaveInput`/`saveSlab`/
  `entityToSaveInput` +`faceAppearance`) + `hooks/data/slab-persistence-helpers.ts` `docToEntity` (+`faceAppearance`).
- i18n: `bim3d.json` (el+en) → `polygonMode.{toggle,tooltip,title,hintPickFace,hintApply,clearFace}`.
- Tests: `bim-three-faced-prism.test.ts` (6), `SetFaceAppearanceCommand.test.ts` (7) — 13/13 GREEN.

---

## 🏛️ ΑΡΧΙΤΕΚΤΟΝΙΚΗ — Φ1.5 (FOUNDATION)

Αντιγραφή του slab pattern. Foundation = πέδιλο/πεδιλοδοκός/συνεχές → solid με outline + βάθος (όπως slab).

1. **Converter** (`foundation-to-three.ts`): πρόσθεσε branch `facedByAppearance || facedByPolygonTarget`
   (διάβασε `usePolygonMode3DStore.getState()`) → `buildFacedSlabBody`-style helper (γενίκευσέ το ή φτιάξε
   `buildFacedFoundationBody` reuse `buildFacedPrism`). baseMat = `getElementMaterial3D('foundation-${kind}')`.
   Αποθήκευσε `mesh.userData.faceKeyByMaterialIndex`. ⚠️ Πρόσεξε το vertical datum (foundation κρέμεται με δικό του
   `hangDownMeshY`/elevation — μην το χαλάσεις· κράτα την ίδια `position.y` με το legacy).
2. **Persistence:** `+faceAppearance` σε `FoundationDoc`, `FoundationSaveInput`, `saveFoundation` (write μόνο όταν
   defined), `entityToSaveInput`, και στο foundation `docToEntity`. (Ίδια 5 σημεία με slab.)
3. **Gate UI:** `POLYGON_FACED_KINDS` στο `PolygonModeToggle3D.tsx` → πρόσθεσε `'foundation'`.
4. **Persistence hook:** βεβαιώσου ότι το foundation persistence ακούει `bim:entities-attached`
   (grep `useBimEntityMovedPersistEffect`/`useBimEntityAttachedPersistEffect` στο `useFoundationPersistence`)·
   αν όχι, mount το (το slab χρησιμοποιεί `useBimEntityMovedPersistEffect(isSlab, ...)` που ΗΔΗ folds-in το attached event).
5. **Tests:** foundation faced render + persistence round-trip.

**Trade-off (ίδιο με slab Φ1):** το faced foundation αγνοεί holes/slope (Φ2). Πέδιλο = flat → ΟΚ.

---

## 🏛️ ΑΡΧΙΤΕΚΤΟΝΙΚΗ — Φ2 (drag-drop / holes / custom color / hover)

### (α) HTML5 Drag-drop (η Cinema 4D υπογραφή — Giorgio το ζήτησε ρητά)
- Στο `PolygonMaterialPanel.tsx`: κάθε swatch γίνεται `draggable`· `onDragStart` →
  `e.dataTransfer.setData('application/x-bim-material', JSON.stringify({ materialId } | { colorHex }))`.
- Στο canvas root (`BimViewport3D.tsx` ή νέο leaf): `onDragOver` (preventDefault → επιτρέπει drop),
  `onDrop` → `raycastBimFace(clientX, clientY)` → αν faceKey → `SetFaceAppearanceCommand`.
- **ADR-040 / OrbitControls:** το drag ξεκινά ΕΚΤΟΣ canvas (στο panel) → δεν συγκρούεται με OrbitControls (καλό).
  Πρόσεχε το `stopPropagation` στο BimViewport3D root (μην μπλοκάρει το drop). Πιθανό: live face-highlight κατά
  το `onDragOver` (raycastBimFace στο dragover → `setSelectedFace`) για Cinema 4D «το υλικό κουμπώνει στην όψη».
- Κράτα **click-to-apply** ως fallback (ήδη δουλεύει).

### (β) Holes / slab-openings στο faced path
- Τα openings ΗΔΗ φτάνουν στο `slabToMesh(slab, openingsForSlab, ...)`. Το faced path πρέπει να τα περάσει
  στο `buildFacedPrism`. Επέκτεινε `buildFacedPrism(topRing, depthM, holes?)`:
  `THREE.ShapeUtils.triangulateShape(contour, holes2d)` αντί `[]` στα caps· τα side quads μένουν ίδια· **πρόσθεσε
  side faces και για κάθε hole** (περιμετρικά του ανοίγματος) — αλλιώς το άνοιγμα φαίνεται «κούφιο» χωρίς τοιχώματα.
  FaceKey για hole-walls: σκέψου `hole:${h}:${i}` (νέο variant — πρόσθεσέ το στο `FaceKey` union SSoT).
- Reuse `pushHoles` winding logic (CCW outer + CW holes) από `bim-three-shape-helpers.ts`.

### (γ) Custom color (EnterpriseColorDialog)
- Πρόσθεσε στο `PolygonMaterialPanel` κουμπί «Προσαρμοσμένο χρώμα» → άνοιγμα `EnterpriseColorDialog`/`UnifiedColorPicker`
  → `apply({ colorHex })`. (Το `SetFaceAppearanceCommand` + `resolveFaceMaterial` ήδη δέχονται `colorHex`.)
- i18n key: `polygonMode.customColor` (el+en) ΠΡΩΤΑ στα locales (N.11).

### (δ) Face hover preview
- Στο `pickHover` (`use-bim3d-pointer-handlers.ts`): όταν `PolygonMode3DStore.active`, κάνε `raycastBimFace` και
  highlight την όψη κάτω από τον κέρσορα (διαφορετικό χρώμα από selection — π.χ. κίτρινο, mirror ADR-538).
  Reuse `FaceSelectionHighlighter` (δεύτερο instance «hoverFace») ή πρόσθεσε hover-material στον υπάρχοντα.

---

## 🔁 REUSE POINTS (μηδέν διπλότυπα)
- `buildFacedPrism` / `resolveFaceMaterial` / `SetFaceAppearanceCommand` / `PolygonMode3DStore` /
  `FaceSelectionHighlighter` / `raycastBimFace` — **όλα solid-agnostic, έτοιμα**.
- `buildFacedSlabBody` (slab converter) → γενίκευσε σε shared `buildFacedSolidBody(verts, thicknessM, appearance, baseMat)`
  αν το foundation το χρειαστεί (Boy-Scout: αν 2ος caller, βγάλ' το SSoT).
- `pushHoles` / `triangulateShape(contour, holes)` — holes.
- `EnterpriseColorDialog` / `UnifiedColorPicker` / `RibbonColorField` — custom color.
- `useRibbonTabDrag` / `dataTransfer` patterns — drag-drop.
- `HoverStore` / `applyBimHover` / ADR-538 hover — face hover.
- Persistence: `useBimEntityMovedPersistEffect` (folds-in `bim:entities-attached`), `signalEntitiesAttached`.

---

## ⚠️ GUARDS / ΠΕΡΙΟΡΙΣΜΟΙ (ΚΡΙΣΙΜΟ)
- 🔴 **NO COMMIT / NO PUSH.** Ο Giorgio κάνει ΟΛΑ τα commits (CLAUDE.md N.(-1)). Εσύ μόνο γράφεις + stage-aware.
- 🔴 **SHARED WORKING TREE με άλλον agent.** Άγγιξε ΜΟΝΟ τα αρχεία της φάσης σου. Πριν edit, έλεγξε ότι το αρχείο
  δεν είναι mid-edit (git status / πρόσφατο mtime). Στη Φ1 ένας άλλος agent refactored το UI σε `PolygonModeToggle3D`
  ΧΩΡΙΣ να σπάσει το fix μου — να περιμένεις παρόμοια ταυτόχρονη δραστηριότητα.
- 🔴 **ADR-040 CHECK 6B/6D:** αγγίζεις canvas/3D αρχεία (converters, raycaster, ThreeJsSceneManager,
  use-bim3d-pointer-handlers, BimViewport3D) → στο commit (Giorgio) **stage ADR-040 + ADR-539**.
- **N.17:** ΕΝΑΣ tsc τη φορά — έλεγξε για άλλον tsc process ΠΡΩΤΑ (`Get-CimInstance Win32_Process ... '*tsc*'`).
  Στη Φ1 το full tsc πήρε >5 λεπτά· τρέξε το σε background, μην μπλοκάρεις.
- **N.7.1:** κάθε νέο αρχείο < 500 γραμμές, functions < 40.
- **N.11:** μηδέν hardcoded strings — i18n keys ΠΡΩΤΑ στα locales (el+en). Material labels υπάρχουν ήδη στο
  `dxf-viewer-shell:wallCovering.materials.*`.
- **N.2:** zero `any` / `as any` / `@ts-ignore`. (Στο Φ1 το μόνο cast ήταν `materialId as WallCoveringMaterialId` —
  controlled, με σχόλιο.)
- **N.3:** inline style ΜΟΝΟ για data-driven χρώμα (εγκεκριμένη εξαίρεση, βλ. `MaterialSwatch.tsx`).

---

## 🐛 ΓΝΩΣΤΟΙ ΠΕΡΙΟΡΙΣΜΟΙ Φ1 (που η Φ2 διορθώνει)
- Πλάκα **με κλίση ή με άνοιγμα**: μόλις μπει σε Polygon Mode χάνει προσωρινά κλίση/άνοιγμα (faced path = flat χωρίς
  holes). Επιστρέφει στην έξοδο. → Φ2 (holes) + (slope: σκέψου shear του prism ή κράτα το ως γνωστό περιορισμό).
- **Cross-client live sync** του `faceAppearance` δεν καλύπτεται (`slabEntityDiffersFromDoc` συγκρίνει μόνο `params`).
  Το reload round-trip persist-άρει σωστά. Live per-face diff = Φ3.
- Μη βαμμένες όψεις σε polygon-target slab δημιουργούν faced mesh με **νέα materials** ανά rebuild (όπως soffit)·
  ΟΚ για MVP. Αν γίνει perf θέμα σε πολλά solids → material cache (Φ3).

---

## ✅ CHECKLIST Φ1.5 (foundation)
- [ ] SSoT audit (grep παραπάνω, ειδικά foundation converter + persistence)
- [ ] `foundation-to-three.ts` → faced branch (reuse `buildFacedPrism`· vertical datum προσοχή)
- [ ] foundation persistence round-trip (+`faceAppearance` σε Doc/SaveInput/save/entityToSaveInput/docToEntity)
- [ ] `POLYGON_FACED_KINDS` += `'foundation'`
- [ ] foundation persistence ακούει `bim:entities-attached` (verify/mount)
- [ ] Jest (faced foundation + round-trip) · tsc (N.17) · ADR-539 changelog
- [ ] 🔴 browser-verify + commit (Giorgio· stage ADR-040 + ADR-539)

## ✅ CHECKLIST Φ2
- [ ] SSoT audit (grep drag-drop / holes / color / hover)
- [ ] Drag-drop: swatch `draggable` + `application/x-bim-material` + canvas `onDragOver`/`onDrop` → `raycastBimFace` → command
- [ ] Holes: `buildFacedPrism(topRing, depthM, holes?)` + hole-wall faces + `FaceKey` variant `hole:${h}:${i}`
- [ ] Custom color: «Προσαρμοσμένο χρώμα» → `EnterpriseColorDialog` → `apply({ colorHex })` + i18n `polygonMode.customColor`
- [ ] Face hover preview (reuse `FaceSelectionHighlighter`/HoverStore)
- [ ] Jest + tsc (N.17) + ADR-539 changelog
- [ ] 🔴 browser-verify + commit (Giorgio· stage ADR-040 + ADR-539)

---

## 📎 ΑΝΑΦΟΡΕΣ
- **ADR-539:** `docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md` (changelog έχει Φ1 + fix)
- **Φ1 handoff (αρχικό):** `HANDOFFS/HANDOFF_2026-06-27_adr-539-cinema4d-polygon-mode-per-face.md`
- Πρότυπα: ADR-534 (soffit finish — per-face), ADR-417 (roof prism — `buildPrismIndex`), ADR-511 (wall-covering catalog),
  ADR-040 (canvas/3D perf· CHECK 6B/6D), ADR-470 (`SetComponentVisibilityCommand` — base-field writer πρότυπο).

---

## 📍 ΕΠΟΜΕΝΟ ΒΗΜΑ
1. Δήλωσε μοντέλο (N.14). 2. **SSoT audit (grep)**. 3. **Φ1.5 (foundation) πρώτα** (γρήγορο, ολοκληρώνει solids), μετά **Φ2**.
4. Στο τέλος → declare Google-level (N.7.2) + context health (N.9). **ΜΗΝ κάνεις commit** — άσε τον Giorgio.
