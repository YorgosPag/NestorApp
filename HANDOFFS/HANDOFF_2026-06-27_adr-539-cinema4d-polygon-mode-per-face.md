# HANDOFF — ADR-539 Cinema 4D «Polygon Mode» (per-face χρώμα/υλικό σε δομικά solids)

**Date:** 2026-06-27 · **Status:** PLANNED, έτοιμο για υλοποίηση Φ1 · **Model:** Opus (orchestrator-scale)

---

## 🎯 ΣΤΟΧΟΣ

Στον **3D κάμβα** του `/dxf/viewer`: ο χρήστης επιλέγει δομικό solid (πλάκα/οροφή/τοίχο/
κολόνα/δοκάρι/θεμέλιο), πατάει πλήκτρο **«Polygon»** (mode toggle), κάνει κλικ σε **μία όψη**
(πάνω / κάτω / **κάθε** περιμετρική πλευρά ξεχωριστά), και εφαρμόζει **χρώμα Ή υλικό** —
σέρνοντάς το από βιβλιοθήκη (drag-drop) πάνω στην όψη. **Ακριβώς όπως Cinema 4D Maxon / Revit.**

**Ποιότητα:** FULL ENTERPRISE + FULL SSOT. Revit/Maxon-grade. Μηδέν διπλότυπα.

---

## 🚨 ΠΡΩΤΟ ΒΗΜΑ — ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ

**Μην εμπιστευτείς τυφλά το plan.** Κάνε ΠΡΑΓΜΑΤΙΚΟ grep για να επιβεβαιώσεις ότι δεν υπάρχει
ήδη αντίστοιχος κώδικας, και reuse ό,τι βρεις. Ελάχιστα grep targets:

1. **Per-face / face appearance:** `faceAppearance`, `FaceKey`, `perFace`, `faceColor`,
   `materialIndex`, `addGroup`, `faceKeyByMaterialIndex` — μήπως κάποιος άλλος agent το ξεκίνησε ήδη.
2. **Faced prism / index building:** `buildPrismIndex`, `buildDepthPrism`, `triangulateShape`,
   `ExtrudeGeometry`, `addGroup` — το roof έχει ήδη ρητό index (πρότυπο για `buildFacedPrism`).
3. **Per-face material πρότυπο:** `attachSoffitFinish`, `soffitFinish`, `getWallCoveringColor`
   (ADR-534) — ΤΟ ΠΡΟΤΥΠΟ. Γενίκευσέ το, μην το ξαναγράψεις.
4. **Raycast face:** `raycastBimGroup`, `raycastBimEntities`, `intersection.face`, `materialIndex`
   στο `BimEntityRaycaster.ts` — μην αλλάξεις την υπάρχουσα, πρόσθεσε `raycastBimFace` δίπλα.
5. **Selection/highlight:** `BimSelectionHighlighter`, `SelectionOutlinePass`, `Selection3DStore`.
6. **Material catalogs:** `listWallCoveringMaterials`, `getMaterial3D`, `getElementMaterial3D`,
   `MaterialLibraryService`, `material-catalog-defs` — reuse, μην φτιάξεις νέο catalog.
7. **Command base:** `MergeableUpdateCommand`, `UpdateSlabParamsCommand`, `updateEntity`.
8. **3D context-menu/micro-store πρότυπο:** `Grip3DContextMenuStore`, `Grip3DVertexContextMenu`.
9. **Color picker:** `EnterpriseColorDialog`.
10. **Toggle store πρότυπο:** `createToggleStore`, `createConfirmStore` (μήπως υπάρχει
    έτοιμο factory για το `PolygonMode3DStore` αντί χειρόγραφου).

➡️ Αν κάποιο grep δείξει ότι κάτι υπάρχει ήδη → **reuse / extend**, ενημέρωσε το ADR-539, και
ανέφερέ το στον Giorgio (100% ειλικρίνεια).

---

## 🏛️ ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΑΠΟΦΑΣΗ (από ADR-539 + εγκεκριμένο plan)

1. **Face-key SSoT** (ντετερμινιστικό, κοινό για όλα τα solids):
   `type FaceKey = 'top' | 'bottom' | \`side:${number}\` | \`sub:${number}:${string}\``
   Το `side:i` ακολουθεί το ντετερμινιστικό edge ordering του `buildPrismIndex` (`j=(i+1)%n`).
2. **`faceAppearance?: FaceAppearanceMap`** στο **`BimEntity` base** (`bim/types/bim-base.ts`),
   δίπλα στο υπάρχον `styleOverride` — cosmetic override, ΔΕΝ μολύνει geometry derivation,
   μηδέν διπλότυπα ανά params. Νέο type `face-appearance-types.ts`:
   `FaceAppearance { materialId?: string; colorHex?: string }`,
   `FaceAppearanceMap = Readonly<Record<string, FaceAppearance>>`.
3. **Geometry per-face = `BufferGeometry.addGroup()` + `material[]`** (ΟΧΙ ξεχωριστά meshes).
   Νέος `bim-three-faced-prism.ts` (γενίκευση `buildPrismIndex`): επιστρέφει
   `{ geometry (με groups), faceKeyByMaterialIndex: FaceKey[] }`. materialIndex
   `0=bottom, 1=top, 2+i=side:i`. Αποθήκευση στο `mesh.userData.faceKeyByMaterialIndex`.
   ⚠️ **Holes/slab-openings = Φ2** (το ρητό path ξεκινά χωρίς openings).
4. **`raycastBimFace`** δίπλα στο `raycastBimGroup` (zero regression): διαβάζει
   `hit.face.materialIndex` → lookup `faceKeyByMaterialIndex`. `RaycastHit + faceKey?`. Ενεργό
   ΜΟΝΟ σε Polygon mode.
5. **`FaceSelectionHighlighter`** — overlay sub-mesh από το index range του group (translucent
   emissive + polygon offset). Το OutlinePass είναι per-object → δεν κάνει για face.
6. **UX:** `PolygonMode3DStore` (micro-store) · toggle κουμπί «Polygon» στο 3D toolbar (ενεργό
   μόνο με επιλεγμένο solid) · `PolygonMaterialPanel.tsx` (reuse `listWallCoveringMaterials` +
   `MaterialLibraryService` + «Custom color»→`EnterpriseColorDialog`) · **drag-drop HTML5**
   (`dataTransfer: application/x-bim-material`), canvas root `onDragOver`+`onDrop`. **MVP
   fallback = click-to-apply** (κλικ face → κλικ swatch).
7. **`SetFaceAppearanceCommand`** generic (extends `MergeableUpdateCommand`) — 1 command για 6
   kinds (το `faceAppearance` είναι base field, δεν αλλάζει geometry). Persistence αυτόματη μέσω
   των debounced `use<Kind>Persistence` (ΕΛΕΓΞΕ ότι ο serializer δεν whitelist-άρει πεδία· αν
   ναι, πρόσθεσε `faceAppearance`). Re-render: converter διαβάζει `entity.faceAppearance` →
   group path· absent → legacy single-material (byte-for-byte, zero regression ~30 slab tests).

---

## ✅ Φ1 (MVP) — CHECKLIST ΥΛΟΠΟΙΗΣΗΣ (slab/foundation, click-to-apply)

- [ ] SSoT audit (grep παραπάνω)
- [ ] `bim/types/face-appearance-types.ts` (FaceKey, FaceAppearance, FaceAppearanceMap)
- [ ] `bim/types/bim-base.ts` → `+ readonly faceAppearance?: FaceAppearanceMap`
- [ ] `bim-3d/converters/bim-three-faced-prism.ts` (groups + faceKeyByMaterialIndex, ΧΩΡΙΣ holes)
- [ ] `bim-3d/materials/face-appearance-material.ts` (`resolveFaceMaterial(faceKey, appearance, baseMat)`)
- [ ] `bim-3d/converters/bim-three-slab-converter.ts` → group path όταν `faceAppearance` present
- [ ] `bim-3d/systems/raycaster/BimEntityRaycaster.ts` → `+ raycastBimFace`, `RaycastHit.faceKey`
- [ ] `bim-3d/scene/ThreeJsSceneManager.ts` → `+ raycastBimFace` + face selection wiring
- [ ] `bim-3d/stores/PolygonMode3DStore.ts` (active, selectedFace)
- [ ] `bim-3d/systems/selection/FaceSelectionHighlighter.ts` (overlay)
- [ ] `core/commands/entity-commands/SetFaceAppearanceCommand.ts` (apply/undo/merge)
- [ ] persistence serialize wiring (έλεγχος whitelist slab)
- [ ] `bim-3d/ui/PolygonMaterialPanel.tsx` (click-to-apply)
- [ ] `bim-3d/viewport/use-bim3d-pointer-handlers.ts` (polygon-mode click branch)
- [ ] `bim-3d/viewport/BimViewport3D.tsx` (toggle + panel mount)
- [ ] i18n keys (el + en) για labels (N.11 — ΠΡΩΤΑ στα locales)
- [ ] Jest: `buildFacedPrism` (group ranges + faceKeyByMaterialIndex + determinism),
      `SetFaceAppearanceCommand` (apply/undo/merge)
- [ ] tsc (N.17 — ΕΝΑΣ tsc τη φορά· έλεγξε για άλλον process πρώτα)

**Ορόσημο Φ1:** slab → «Polygon» → click πάνω όψη → click paint-red swatch → πάνω όψη κόκκινη,
persisted (refresh), undo/redo λειτουργεί, άλλες όψεις αμετάβλητες, entity χωρίς faceAppearance
= legacy render αναλλοίωτο.

---

## 🔁 REUSE POINTS (μηδέν διπλότυπα)
- `buildPrismIndex` (`roof-to-three.ts:105`) → πρότυπο `buildFacedPrism`
- `attachSoffitFinish` (`bim-three-slab-converter.ts:75`) → πρότυπο per-face material construction
- `MergeableUpdateCommand` → base `SetFaceAppearanceCommand`
- `Grip3DContextMenuStore` / `Grip3DVertexContextMenu.tsx` → πρότυπο micro-store/menu
- `getWallCoveringColor` / `listWallCoveringMaterials` + `getMaterial3D` → χρώματα/υλικά
- `EnterpriseColorDialog` → custom color

---

## ⚠️ GUARDS / ΠΕΡΙΟΡΙΣΜΟΙ (ΚΡΙΣΙΜΟ)
- 🔴 **NO COMMIT / NO PUSH.** Ο Giorgio κάνει ΟΛΑ τα commits. Εσύ μόνο γράφεις κώδικα + stage-aware (μην κάνεις `git commit`). (CLAUDE.md N.(-1))
- 🔴 **SHARED WORKING TREE με άλλον agent.** Άγγιξε ΜΟΝΟ τα αρχεία του Φ1. Πριν edit, έλεγξε
  ότι το αρχείο δεν είναι mid-edit από άλλον (git status / πρόσφατο mtime). Μην κάνεις
  μαζικές αλλαγές εκτός scope.
- 🔴 **ADR-040 CHECK 6B/6D:** αγγίζεις canvas/3D αρχεία (BimEntityRaycaster, ThreeJsSceneManager,
  use-bim3d-pointer-handlers, BimViewport3D) → στο (μελλοντικό, από Giorgio) commit πρέπει να
  γίνουν **stage ADR-040 + ADR-539**. Ενημέρωσε το ADR-040 changelog αν χρειαστεί.
- **N.17:** ΕΝΑΣ tsc τη φορά — έλεγξε για άλλον tsc process πρώτα (shared PC).
- **N.7.1:** κάθε νέο αρχείο < 500 γραμμές, functions < 40.
- **N.11:** μηδέν hardcoded strings — i18n keys πρώτα στα locales el+en.
- **N.2:** zero `any` / `as any` / `@ts-ignore`.
- **N.6:** enterprise IDs αν χρειαστεί νέο doc (εδώ μόνο update entities — δεν χρειάζεται).

---

## 📎 ΑΝΑΦΟΡΕΣ
- **ADR-539:** `docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md`
- **Εγκεκριμένο plan:** `C:\Users\user\.claude\plans\crispy-singing-pelican.md`
- **Πρότυπο ADR-534** (soffit finish): `docs/.../adrs/ADR-534-auto-ceiling-slab-per-bay.md`
- Σχετικά: ADR-416 (multi-layer slab), ADR-417 (roof prism), ADR-511 (wall-covering catalog),
  ADR-040 (canvas/3D perf), ADR-535/536/537/538 (3D viewport selection/grips/hover).

---

## 📍 ΕΠΟΜΕΝΟ ΒΗΜΑ
Ξεκίνα με το **SSoT audit (grep)**, μετά υλοποίησε τη Φ1 με τη σειρά του checklist. Δήλωσε
μοντέλο (N.14) πριν ξεκινήσεις κώδικα. Στο τέλος → declare Google-level (N.7.2) + context health
(N.9). **ΜΗΝ κάνεις commit** — άσε τον Giorgio.
