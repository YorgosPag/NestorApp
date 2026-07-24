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

## 5. Critical files

- **ΝΕΟ** `src/subapps/dxf-viewer/bim-3d/materials/resolve-entity-current-material.ts` —
  `resolveEntityCurrentMaterialId`, `resolveFaceCurrentMaterialId` (pure, zero React, zero `any`).
- **ΝΕΟ** `src/subapps/dxf-viewer/bim-3d/materials/__tests__/resolve-entity-current-material.test.ts` (7/7 πράσινα).
- **ΕΠΕΞΕΡΓΑΣΙΑ** `src/subapps/dxf-viewer/bim-3d/ui/MaterialEntryButton.tsx` — `+active?: boolean` prop,
  ring-highlight + `aria-current` + i18n label.
- **ΕΠΕΞΕΡΓΑΣΙΑ** `src/subapps/dxf-viewer/bim-3d/ui/PolygonMaterialPanel.tsx` — `activeMaterialId` computation
  (single-face owning-entity lookup μέσω `useSceneEntityById` + `levels?.currentLevelId` υπάρχον scope) και
  `active={entry.id === activeMaterialId}` στο `barEntries.map`.
- **Reused αυτούσια (καμία αλλαγή):** `useSceneEntityById` (`systems/scene/useSceneSelectors.ts`),
  `FaceAppearanceMap` (`bim/types/face-appearance-types.ts`), `resolveFaceMaterial` (cascade semantics mirror).
- **i18n:** `polygonMode.activeMaterialLabel` προστέθηκε στο `src/i18n/locales/{el,en}/bim3d.json` (μέσα στο
  υπάρχον `polygonMode` block).

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
