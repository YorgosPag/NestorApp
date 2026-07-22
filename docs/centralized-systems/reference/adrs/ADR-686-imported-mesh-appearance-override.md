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
| **Φ1** | 3D: `FaceKey += slot:${name}` · enhancer διαβάζει override (χρώμα/flat catalog/textured PBR) · raycast per-slot · converter περνά `faceAppearance` | 🟢 IMPLEMENTED UNCOMMITTED |
| **Φ2** | 2D: ο override νικά το preset-by-name στην κάτοψη (`slotPaletteWithOverride`) | 🟢 IMPLEMENTED UNCOMMITTED |
| **Φ3** | Persistence: `faceAppearance` στο `ImportedMeshDoc`/save/update/hydrate (επιβιώνει reload) | 🟢 IMPLEMENTED UNCOMMITTED |
| **Φ4** | (μελλοντικό) per-slot selection highlight στο ΠΟΛΥΓΩΝΑ (FaceSelectionHighlighter για imported) | ⬜ PLANNED |

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
