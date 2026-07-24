# ADR-688 — Γενικό highlight εφαρμοσμένου υλικού στο swatch (Υλικά όψης)

**Status:** 🟢 IMPLEMENTED UNCOMMITTED (2026-07-24)
**Related:** ADR-687 (Material Editor — γενική βιβλιοθήκη υλικών + `MaterialEntryButton`/`MaterialLibraryPopover`),
ADR-539 (Polygon Mode per-face appearance, `faceAppearance` SSoT), ADR-686 (imported-mesh appearance override,
`faceAppearance['slot:*']`), ADR-683 (imported-mesh collaboration roundtrip).

---

## 1. Πρόβλημα (Giorgio 2026-07-24)

Στο panel «Υλικά όψης» (`PolygonMaterialPanel`), το swatch grid δεν έδειχνε **ποιο** υλικό είναι ήδη
εφαρμοσμένο στο επιλεγμένο στοιχείο/όψη — καμία οπτική ένδειξη (ring/highlight) πάνω στο ενεργό
`MaterialEntryButton`. Ίσχυε για **όλα** τα entity types (δομικά solids + imported meshes), όχι μόνο
για ένα.

## 2. SSoT audit — τι υπήρχε ήδη

- Η αποθήκευση/επίλυση υλικού είναι ήδη **ενιαία** μέσω `faceAppearance` (ADR-539 + επέκταση ADR-686):
  `appearance['*']` = βάση (όλο το στοιχείο), `appearance[side:i]`/`appearance[slot:name]` = per-face/per-slot
  override, με το ίδιο fallback σε `'*'` και στους δύο κόσμους (`resolveFaceMaterial` στο 3D enhancer).
- **Δεν υπήρχε κανένας resolver** που να επιστρέφει απλώς το **materialId string** (όχι κατασκευασμένο
  `THREE.Material`) από ένα entity/face — μόνο ο βαρύς constructor-path υπήρχε.
- Το `MaterialEntryButton` (ADR-687) δεν είχε καμία έννοια «ενεργό/επιλεγμένο» — ήταν καθαρό κουμπί-επιλογής.

## 3. Απόφαση

Γενικός, entity-agnostic **resolver SSoT** αντί για per-entity-type διακλαδώσεις μέσα στο panel:

- **`resolveEntityCurrentMaterialId(entity)`** — διαβάζει `faceAppearance['*']`, επιστρέφει `materialId | null`.
- **`resolveFaceCurrentMaterialId(entity, faceKey)`** — διαβάζει `faceAppearance[faceKey]` με fallback σε `'*'`,
  ίδια σειρά cascade με τον υπάρχοντα `resolveFaceMaterial` (ADR-539/686), αλλά επιστρέφει **id**, όχι υλικό.
- Και οι δύο δέχονται ελάχιστο structural type `{ readonly faceAppearance?: FaceAppearanceMap }` — καμία
  εξάρτηση σε `AnySceneEntity` — άρα δουλεύει αυτούσιο για walls/columns/slabs/beams/imported-mesh κ.λπ.
  χωρίς καμία αλλαγή σε renderer/enhancer/command.
- **`MaterialEntryButton`**: νέο **optional** prop `active?: boolean` (default `false`, 100% backward
  compatible) — όταν `true` προσθέτει ring-highlight (Tailwind/CVA className, ΟΧΙ inline style) +
  `aria-current="true"` + `aria-label` μέσω `t('polygonMode.activeMaterialLabel')`.
- **`PolygonMaterialPanel`**: υπολογίζει `activeMaterialId` πριν το `barEntries.map` —
  - 1 επιλεγμένη όψη (`isPolygon && faceCount===1`) → βρίσκει το entity που **κατέχει** εκείνη την όψη
    (`face.bimId`, μπορεί να διαφέρει από το body-level `selectedBimId` σε imported-mesh selection) μέσω
    του υπάρχοντος `useSceneEntityById` selector, μετά `resolveFaceCurrentMaterialId(entity, faceKey)`.
  - Multi-face / body / finish mode → `selectedBimId` + `resolveEntityCurrentMaterialId(entity)` (βάση).
  - `entry.active = entry.id === activeMaterialId` περνάει στο `MaterialEntryButton`.

## 4. Ground truth σημείωση (τι ΔΕΝ καλύπτει ακόμη)

- Το finish-layer palette (`isFinish === true`) **δεν** παίρνει ουσιαστικό highlight — τα finish overrides
  ζουν σε ξεχωριστό πεδίο params (`faceAppearanceToFinishOverride`), όχι στο `faceAppearance` map που
  διαβάζει αυτός ο resolver. Μελλοντικό `resolveFinishCurrentMaterialId` mirror αν χρειαστεί (out of scope,
  δεν έγινε τώρα).
- Ad-hoc synth-color entries (`id = adhoc-color:...`) δεν ταιριάζουν ποτέ με `activeMaterialId`
  (materialId-based) — σωστό, αντιπροσωπεύουν raw `colorHex`, όχι κατάλογο υλικού.
- **[ΔΙΟΡΘΩΘΗΚΕ 2026-07-24, βλ. §7]** Το §3/§5 αρχικό σχήμα διάβαζε ΜΟΝΟ το base `'*'` στο
  whole-entity branch (`resolveEntityCurrentMaterialId`) — για ένα named-multi-slot `.glb` με ΕΝΑ
  βαμμένο slot (`faceAppearance = {'*':…, 'slot:x':…}`), ο renderer (`resolveSlotMaterial`) εφαρμόζει
  ΚΑΙ τα δύο ανά slot, αλλά panel/highlight έδειχναν ΜΟΝΟ το base → διαφωνία με τον καμβά. Δες §7.

## 4.1 Λανθάνουσα απόκλιση με τον renderer (εντοπίστηκε 2026-07-24)

Ο 3D renderer (`bim-3d/converters/imported-mesh-material-enhance.ts::resolveSlotMaterial`) εφαρμόζει
υλικό **ανά slot**: `appearance[slot:name] ?? appearance['*'] ?? embedded`. Το panel (§3, imported-mesh
«Τρέχον υλικό») και το swatch highlight (whole-entity branch) διάβαζαν ΜΟΝΟ το base `'*'`
(`resolveEntityCurrentMaterialId`) — σωστό όσο ΟΛΑ τα slots μοιράζονται το ίδιο υλικό (base-only
faceAppearance), αλλά **λάθος** μόλις ένα slot βαφτεί ξεχωριστά: ο καμβάς δείχνει 2 υλικά, το panel/
highlight έδειχναν μόνο το ένα. Fix (§7): νέος `resolveEntityMaterialIdSet(entity)` επιστρέφει το
ΠΛΗΡΕΣ σύνολο distinct materialIds σε ΟΛΑ τα faceAppearance keys (base + κάθε slot), και panel/
highlight πλέον διαβάζουν ΑΠΟ ΕΚΕΙ αντί για το base-only resolver στο whole-entity branch.

## 5. Critical files

- **ΕΠΕΞΕΡΓΑΣΙΑ** `src/subapps/dxf-viewer/bim-3d/materials/resolve-entity-current-material.ts` —
  `resolveEntityCurrentMaterialId`, `resolveFaceCurrentMaterialId` (pure, zero React, zero `any`), + ΝΕΟ
  `resolveEntityMaterialIdSet(entity): string[]` (§7, 2026-07-24) — το πλήρες applied-material SET
  (base + κάθε per-face/per-slot override), order-stable, deduplicated.
- **ΕΠΕΞΕΡΓΑΣΙΑ** `src/subapps/dxf-viewer/bim-3d/materials/__tests__/resolve-entity-current-material.test.ts`
  (12/12 πράσινα μετά το §7 — 5 νέα cases για το `resolveEntityMaterialIdSet`).
- **ΕΠΕΞΕΡΓΑΣΙΑ** `src/subapps/dxf-viewer/bim-3d/ui/MaterialEntryButton.tsx` — `+active?: boolean` prop,
  ring-highlight + `aria-current` + i18n label (αναλλοίωτο στο §7).
- **ΕΠΕΞΕΡΓΑΣΙΑ** `src/subapps/dxf-viewer/bim-3d/ui/PolygonMaterialPanel.tsx` — whole-entity branch
  πλέον υπολογίζει `activeMaterialIds: readonly string[]` (μέσω `resolveEntityMaterialIdSet`) αντί για
  μονό `activeMaterialId`· `active={activeMaterialIds.includes(entry.id)}` στο `barEntries.map`.
  Single-face branch αναλλοίωτο (`resolveFaceCurrentMaterialId`, wrapped σε 0/1-length array).
- **ΕΠΕΞΕΡΓΑΣΙΑ** `src/subapps/dxf-viewer/ui/imported-mesh-advanced-panel/ImportedMeshAdvancedPanel.tsx` —
  `MaterialSection` πλέον διαβάζει `resolveEntityMaterialIdSet(mesh)`: 0 → embedded/no-material (ίδιο),
  1 → library label + swatch (ίδιο), 2+ → `importedMeshAdvancedPanel.field.multipleMaterials`, χωρίς
  swatch (θα παραπλανούσε).
- **i18n:** `importedMeshAdvancedPanel.field.multipleMaterials` προστέθηκε στο
  `src/i18n/locales/{el,en}/dxf-viewer-shell.json`. (`polygonMode.activeMaterialLabel` ήδη υπήρχε στο
  `bim3d.json` από την αρχική §3/§5 εκδοχή.)
- **Reused αυτούσια (καμία αλλαγή):** `useSceneEntityById` (`systems/scene/useSceneSelectors.ts`),
  `FaceAppearanceMap` (`bim/types/face-appearance-types.ts`), `resolveFaceMaterial` (cascade semantics mirror).
- **ΔΕΝ αγγίχτηκαν (out of scope):** `ImportedMeshMaterialMapHost.tsx`, `MaterialCatalog3D.ts`,
  `pbr-material-builder.ts`, `bim-visual-style.ts`, render-settings stores, ADR-687-glass files.

## 6. Συνέπειες

- ✅ Ένας resolver για ΟΛΑ τα entity types — μηδέν per-entity-type διακλάδωση μέσα στο panel/button.
- ✅ Καμία επίδραση στο apply/dispatch path — μόνο ανάγνωση για highlight, το commit path (drag-drop,
  `SetFaceAppearanceCommand`/`SetEntityFaceAppearanceMapCommand`) παραμένει αναλλοίωτο.
- ✅ `active` prop backward-compatible (default `false`) — καμία υπάρχουσα κλήση του `MaterialEntryButton`
  (π.χ. `MaterialLibraryPopover`, ADR-687) δεν άλλαξε συμπεριφορά.
- ⚠️ Καλύπτει **μερικώς** το ADR-686 Φ4 roadmap item («per-slot selection highlight στο ΠΟΛΥΓΩΝΑ» — εκεί
  αναφερόταν σε outline πάνω στη γεωμετρία 3D, όχι στο swatch panel). Το ADR-688 καλύπτει τη **swatch-level**
  ένδειξη· το geometry-level outline (π.χ. `FaceSelectionHighlighter` για imported) παραμένει ανοιχτό.
- ⚠️ Finish-layer palette highlight εκκρεμεί (βλ. §4).
- 🔴 Pending: browser verify (επιλογή στοιχείου/όψης με ήδη εφαρμοσμένο υλικό → το αντίστοιχο swatch να
  φωτίζεται με ring· αλλαγή επιλογής → το highlight μετακινείται σωστά· multi-face selection → κανένα
  ψευδές highlight).

## 7. Changelog

- **2026-07-24 (Φ B1/B2/B3 batch, μέρος του imported-mesh properties-panel effort — IMPLEMENTED
  UNCOMMITTED)** — Νέος γενικός resolver `resolve-entity-current-material.ts` (A2) + καλωδίωση σε
  `MaterialEntryButton`/`PolygonMaterialPanel` (B3). Tests: resolver 7/7, jscpd:diff clean (καμία νέα
  κλωνοποίηση, N.18). Καμία αλλαγή σε `MaterialCatalog3D.ts`/`pbr-material-builder.ts`/`bim-visual-style.ts`/
  render-settings stores/`ImportedMeshMaterialMapHost.tsx` (εκτός scope, ADR-686/687 άλλου agent). NO tsc
  (N.17). Pending: browser verify + commit.
- **2026-07-24 (follow-up — per-slot applied-material SET, IMPLEMENTED UNCOMMITTED)** — Διορθώθηκε η
  λανθάνουσα απόκλιση της §4.1: το imported-mesh «Τρέχον υλικό» panel και το whole-entity swatch
  highlight διάβαζαν ΜΟΝΟ το base `'*'`, ενώ ο renderer (`resolveSlotMaterial`) εφαρμόζει
  `appearance[slot:name] ?? appearance['*'] ?? embedded` ΑΝΑ slot — για ένα named-multi-slot `.glb`
  με ΕΝΑ βαμμένο slot το panel/highlight διαφωνούσαν με τον καμβά. Fix: νέος
  `resolveEntityMaterialIdSet(entity): string[]` (distinct materialIds σε ΟΛΑ τα faceAppearance keys,
  order-stable) σε `resolve-entity-current-material.ts`· `ImportedMeshAdvancedPanel.tsx` `MaterialSection`
  και `PolygonMaterialPanel.tsx` whole-entity branch διαβάζουν πλέον από εκεί (single-face branch
  αναλλοίωτο). 0 υλικά → embedded/no-material (ίδιο)· 1 → label+swatch (ίδιο)· 2+ → νέο i18n key
  `importedMeshAdvancedPanel.field.multipleMaterials` (el/en), χωρίς single swatch· highlight πλέον
  φωτίζει ΟΛΑ τα εφαρμοσμένα swatches (`activeMaterialIds.includes(entry.id)`). Ground-truth data
  (η καρέκλα, `faceAppearance = {'*': {...}}` anonymous/all-base) → συμπεριφορά ΑΝΑΛΛΟΙΩΤΗ (set = 1
  στοιχείο) — το fix αλλάζει μόνο το πραγματικά multi-slot-painted σενάριο. Tests: resolver
  12/12 (5 νέα cases). NO tsc (N.17). Καμία αλλαγή σε `ImportedMeshMaterialMapHost.tsx`/
  `MaterialCatalog3D.ts`/`pbr-material-builder.ts`/`bim-visual-style.ts`/render-settings stores/
  ADR-687-glass files (εκτός scope). Pending: jscpd:diff + jest run αυτού του follow-up, browser verify,
  commit.
