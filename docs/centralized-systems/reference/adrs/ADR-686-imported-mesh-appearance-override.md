# ADR-686 — Imported-mesh appearance override (χρώμα/υλικό/υφή, ενιαίο SSoT με ADR-539)

**Status:** 🟢 IMPLEMENTED UNCOMMITTED (2026-07-22)
**Related:** ADR-539 (Polygon Mode per-face appearance), ADR-683 (imported-mesh collaboration roundtrip), ADR-449 (structural finish skin), ADR-679 Φ2b (textured per-face PBR)

---

## 1. Πρόβλημα / Ζητούμενο (Giorgio 2026-07-22)

Ο χρήστης έκανε drag-drop χρώματος πάνω στα μπράτσα μιας εισαγόμενης καρέκλας (imported 3D mesh)
και **δεν χρωματίστηκαν**. Ρώτησε ρητά:

> «Τα εισαγόμενα meshes έχουν εντελώς ξεχωριστό material pipeline — αυτό είναι σωστό ή είναι
> διπλοτυπία; Έτσι θα το έκαναν οι μεγάλοι; Εγώ θέλω και να **έρχονται** τα χρώματα/υλικά/υφές με την
> εισαγωγή του αρχείου, ΑΛΛΑ να μπορώ να τους **αλλάζω** χρώμα/υλικό/υφή.»

Επιθυμητό εύρος (Giorgio): **και τα δύο** — ΣΩΜΑ (drag-drop → όλο το έπιπλο) + ΠΟΛΥΓΩΝΑ (drag-drop →
μόνο το κομμάτι/slot κάτω από τον κέρσορα, π.χ. μόνο τα μπράτσα).

---

## 2. Ευρήματα έρευνας (SSoT audit — τι ΥΠΗΡΧΕ)

- Τα δομικά solids (slab/column/wall/beam/foundation/roof) έχουν το `faceAppearance` override
  (ADR-539) + `resolveFaceMaterial` resolver + `SetFaceAppearanceCommand`/`SetEntityFaceAppearanceMapCommand`.
- Τα **imported meshes ΔΕΝ είχαν ΚΑΝΕΝΑΝ** μηχανισμό override: τα υλικά έρχονταν **αποκλειστικά** από
  το `.glb`/OBJ (embedded PBR), + read-only «preset-by-name» safety-net (ADR-683 Φ4) για χαμένα υλικά.
- `raycastBimFace` επέστρεφε `faceKey` **μόνο** για faced-prism (structural)· imported hit = entity-only.
- Per-slot addressing υπήρχε **μόνο κατ' όνομα** (`ImportedMeshParams.materialSlots`, 2D `SlotSilhouette.materialName`), read-only.

### Απάντηση στο «σωστό ή διπλοτυπία;»

- Η **ΠΗΓΗ** του υλικού διαφέρει νόμιμα (imported = embedded PBR από αρχείο· structural = catalog).
  Αυτό είναι **σωστό**, όχι διπλοτυπία — και το «τα υλικά έρχονται με την εισαγωγή» παραμένει ανέπαφο.
- Το **κενό** ήταν ότι δεν υπήρχε **κοινός μηχανισμός override**. Οι μεγάλοι (Blender/C4D/Revit) έχουν
  **ΕΝΑ ενιαίο** material system: το imported έρχεται με προ-γεμισμένα slots και τα αλλάζεις με τον
  ΙΔΙΟ μηχανισμό. Νέο ξεχωριστό σύστημα βαφής μόνο για imported = **αυτό** θα ήταν η διπλοτυπία.

### SSoT απόφαση 2026-07-22 — `faceAppearance` vs ADR-678 (ΟΧΙ σύγκρουση)

Δεύτερο SSoT audit (grep) έκρινε αν το ADR-678 μηχανισμός (`resolveImportAppearance` / `buildKnownMaterialResolver`)
είναι **ανταγωνιστική αποθήκευση**. **Δεν είναι.** Ο `applyImportedAppearance` (ADR-678) χτίζει
`SetFaceAppearanceCommand` και **γράφει μέσα στο `faceAppearance`**:

- **`faceAppearance` (ADR-539) = ο ΕΝΑΣ SSoT** αποθήκευσης/επίλυσης/render (63 αρχεία, όλα τα entity types).
- **ADR-678 `resolveImportAppearance` = παραγωγός** τιμών `FaceAppearance` (import-time name→id/color match).
- **node-name presets (ADR-683 Φ4) = παραγωγός** (auto-tier).
- **Manual Material Mapping dialog (Φ5) = παραγωγός** (χειροκίνητη επιλογή χρήστη).

Και οι τρεις παραγωγοί καταλήγουν στο ίδιο `faceAppearance` → μηδέν δεύτερο σύστημα υλικών.

### Ground truth (μετρημένο) — per-ENTITY, όχι per-slot

Το πραγματικό `HMI_Aeron_Chair_3D.glb` = **10 ξεχωριστές `imported-mesh` οντότητες** (ο `GLTFLoader` σπάει
κάθε node σε δικό του addressable mesh), κάθε μία με **ένα ΑΝΩΝΥΜΟ** υλικό. Άρα το per-slot-ΜΕΣΑ-σε-entity
είναι **αδύνατο** (κανένα named material) και η αντιστοίχιση είναι **per-ENTITY**: το Φ5 γράφει
`faceAppearance['*']` (base) ανά κομμάτι. Το `slot:${name}` machinery μένει έγκυρο για αρχεία με ονομασμένα
υλικά, αλλά στην πράξη δεν πυροδοτείται.

---

## 3. Απόφαση (ενιαίο SSoT, δύο resolvers)

**Επέκταση** του υπάρχοντος `faceAppearance` SSoT (ADR-539), ΟΧΙ νέο σύστημα:

| Στρώμα | Δομικά | Εισαγόμενα |
|--------|--------|------------|
| **Base** («τι γεννιέται») | catalog | embedded από το αρχείο (μένει· ADR-683 preset safety-net από κάτω) |
| **Override** (user edits) | `faceAppearance[side:i]` | `faceAppearance[slot:${materialName}]` |
| **«Όλο»** (ΣΩΜΑ) | `faceAppearance['*']` | `faceAppearance['*']` (κοινό) |
| **Addressing** | `side:i`/`top`/`bottom` | material-slot **κατ' όνομα** (SSoT με `materialSlots`) |

Ένα override concept, **δύο resolvers** (structural `side:i` ↔ imported `slot:`). Το drag-drop wiring
(ADR-539 Φ5), τα commands (`SetFaceAppearanceCommand`/`SetEntityFaceAppearanceMapCommand`) και τα
apply-helpers είναι **entity-agnostic** → **δουλεύουν αυτούσια** χωρίς αλλαγή.

### Ροή

- **ΣΩΜΑ** drag-drop → `raycastBimEntities` → `applyEntityFaceAppearanceMap(bimId, entireElementFaceMap(v))`
  → `faceAppearance['*']` → ο enhancer βάφει ΟΛΑ τα slots.
- **ΠΟΛΥΓΩΝΑ** drag-drop → `raycastBimFace` → `slot:${materialName}` (νέο) → `applyFaceAppearance(bimId, 'slot:name', v)`
  → ο enhancer βάφει ΜΟΝΟ το matching slot.
- Το override **κλωνοποιεί** το κοινό cached material του `resolveFaceMaterial` + κρατά το `side` της
  πηγής (partner meshes = συχνά DoubleSide → αλλιώς τρύπες) χωρίς να μολύνει το shared singleton.

---

## 4. Roadmap

| Φάση | Περιεχόμενο | Κατάσταση |
|------|-------------|-----------|
| **Φ1** | 3D: `FaceKey += slot:${name}` · enhancer διαβάζει override (χρώμα/flat catalog/textured PBR) · raycast per-slot · converter περνά `faceAppearance` | 🟢 COMMITTED (0da6503a) |
| **Φ2** | 2D: ο override νικά το preset-by-name στην κάτοψη (`slotPaletteWithOverride`) | 🟢 COMMITTED (0da6503a) |
| **Φ3** | Persistence: `faceAppearance` στο `ImportedMeshDoc`/save/update/hydrate (επιβιώνει reload) | 🟢 COMMITTED (0da6503a) |
| **Φ4** | (μελλοντικό) per-slot selection highlight στο ΠΟΛΥΓΩΝΑ (FaceSelectionHighlighter για imported) | ⬜ PLANNED |
| **Φ4b** | auto-tier από **node name** (`resolveImportedMaterialPresetFor` + furniture stems) + 2D poché readability (alpha 0.28) | 🟢 IMPLEMENTED UNCOMMITTED |
| **Φ5** | **Manual per-entity Material Mapping dialog** (Revit-style): πίνακας κομματιών ανά `uploadId`, dropdown υλικού βιβλιοθήκης, batch apply σε ΕΝΑ undo βήμα → `faceAppearance['*']` ανά entity | 🟢 IMPLEMENTED UNCOMMITTED |

---

## 5. Critical files

**Type SSoT:** `bim/types/face-appearance-types.ts` (+`slot:${string}` FaceKey, +`slotFaceKey()` helper).
**3D:** `bim-3d/converters/imported-mesh-material-enhance.ts` (`resolveSlotMaterial` — override→preset→embedded)
· `bim-3d/converters/imported-mesh-to-three.ts` (περνά `mesh.faceAppearance`)
· `bim-3d/systems/raycaster/BimEntityRaycaster.ts` (`hitMeshSlotName` → `slot:${name}` για imported).
**2D:** `bim/renderers/ImportedMeshRenderer.ts` (`slotPaletteWithOverride` — override hex νικά preset).
**Persistence:** `bim/entities/imported-mesh/imported-mesh-firestore-service.ts` (Doc/Save/Update +`faceAppearance`)
· `hooks/data/useImportedMeshPersistence.ts` (update call) · `hooks/data/imported-mesh-persistence-helpers.ts` (hydrate).
**Reused αυτούσια (καμία αλλαγή):** `resolveFaceMaterial`, `SetFaceAppearanceCommand`,
`SetEntityFaceAppearanceMapCommand`, `apply-face-appearance`, `apply-entity-face-appearance-map`,
`use-polygon-drag-drop` (ADR-539 Φ5).

**Φ5 — Manual Material Mapping dialog** (mirror του `ImportedMeshBoq*` τρίπτυχου):
`stores/ImportedMeshMaterialMapDialogStore.ts` (νέο) · `app/ImportedMeshMaterialMapHost.tsx` (νέο, group by
`uploadId` + `useMaterialLibrary` + batch) · `ui/components/imported-mesh/ImportedMeshMaterialMapDialog.tsx`
(νέο, πίνακας rows + Radix `Select` + `MaterialSwatch`) · `bim-3d/ui/apply-imported-mesh-material-map.ts`
(νέο, `executeAsAtomicBatch([SetEntityFaceAppearanceMapCommand ανά κομμάτι])`, base `'*'` per-entity).
**Wiring:** `contextual-imported-mesh-tab.ts` (+action `imported-mesh.assign-materials` + panel «Υλικά») ·
`dxf-special-actions.ts` (+κλάδος → `open`) · `DxfViewerDialogs.tsx` + `dxf-viewer-lazy-components.tsx`
(+mount) · `RibbonButtonIcon.tsx` (+`material-map` icon) · `dxf-viewer-shell.json` el/en (+`importedMeshMaterialMap`
dialog + ribbon labels).

---

## 6. Συνέπειες

- ✅ Ένας μηχανισμός override για ΟΛΑ τα entities (δομικά + imported) — μηδέν δεύτερο σύστημα βαφής.
- ✅ Τα embedded υλικά/υφές του αρχείου παραμένουν base — ο χρήστης βάφει από πάνω (Revit/C4D μοντέλο).
- ✅ Το drag-drop/command/apply-helpers reused αυτούσια (entity-agnostic).
- ⚠️ Το per-slot selection **highlight** στο ΠΟΛΥΓΩΝΑ δεν δείχνει ακόμη outline για imported (Φ4)· η
  **βαφή** δουλεύει.
- ⚠️ Dirty-detection persist trigger: mirror του column (comparable=`params`, persist `faceAppearance`
  σε save/update) — απαιτεί **browser verify** ότι μια καθαρή βαφή (χωρίς params change) γίνεται persist.

---

## 7. Changelog

- **2026-07-22 (Φ1+Φ2+Φ3 — IMPLEMENTED UNCOMMITTED)** — Αρχική υλοποίηση. 3D enhancer override +
  raycast per-slot + 2D palette override + full persistence wiring. Reuse `resolveFaceMaterial` +
  ADR-539 commands/drag-drop. Tests: enhance override (base/per-slot/side-preservation/no-override).
  Pending: browser verify (βαφή + reload persist) + commit.
- **2026-07-22 (Φ1+Φ2+Φ3 — COMMITTED 0da6503a)** — Ο πυρήνας έγινε commit.
- **2026-07-22 (Φ4b — IMPLEMENTED UNCOMMITTED)** — auto-tier από **node name** (`resolveImportedMaterialPresetFor`
  + furniture stems: `base/frame/spndle/edg`→μέταλλο, `pell/aeron`→ύφασμα, `armpad`→δέρμα) στο 3D+2D +
  2D poché readability alpha `0.16→0.28`. Ground truth: πραγματικό HMI_Aeron = ανώνυμα υλικά → node name
  η μόνη σημασιολογία. Tests +38 (imported-material-presets). Pending browser + commit.
- **2026-07-22 (SSoT audit + Φ5 — IMPLEMENTED UNCOMMITTED)** — 2ος SSoT audit επιβεβαίωσε: `faceAppearance`
  = ο ΕΝΑΣ SSoT· ADR-678/presets/manual = **παραγωγοί** (γράφουν μέσω `SetFaceAppearanceCommand`), μηδέν
  σύγκρουση. **Manual per-entity Material Mapping dialog** (Revit-style) — mirror του `ImportedMeshBoq*`
  τρίπτυχου: store + host (group by `uploadId` + `useMaterialLibrary`) + dialog (πίνακας rows + `Select` +
  `MaterialSwatch`) + batch write `applyImportedMeshMaterialMap` (`executeAsAtomicBatch`, base `'*'` per-entity,
  ένα undo). Ribbon panel «Υλικά» + action `imported-mesh.assign-materials`. Tests: batch helper 5/5 πράσινα,
  jscpd clean. Pending: browser verify + commit.
- **2026-07-22 (Φ5 fix — browser: άδειο dropdown)** — Το dropdown έδειχνε μόνο «— Αυτόματο —» (χρησιμοποιούσε
  μόνο το user library `useMaterialLibrary`, συχνά άδειο). Fix: **κεντρικοποίηση** του `buildBodySwatches`
  (catalog cladding `FACE_TEXTURE_MATERIAL_IDS` + user library + flat wall-covering χρώματα) από το
  `PolygonMaterialPanel` (τοπικό) → κοινό `bim-3d/ui/polygon-material-swatches.ts`, reuse από panel **και**
  dialog (ίδια λίστα υλικών με το 3D Polygon panel, μηδέν clone — N.18). Tests 11/11, jscpd clean.
