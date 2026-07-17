# ADR-668 — Εξαγωγή 3Δ (OBJ + glTF) στο dialog «Εξαγωγή Σχεδίου»

**Κατάσταση:** Υλοποιημένο (routing + UI + tests) — εκκρεμεί το e2e του Giorgio στο C4D R15
**Ημερομηνία:** 2026-07-17
**Σχετικά:** ADR-505 (unified export), ADR-462 (three = μέτρα), ADR-459/484 (foundations),
ADR-448 (storey ceiling), ADR-399 (all-floors stack), ADR-382 (visibility resolver),
ADR-217 (greek-text SSoT), ADR-587 (capability anchors)

---

## 1. Πρόβλημα

Ο Giorgio εξήγαγε το μοντέλο για το **Cinema 4D** και βρήκε δύο πράγματα σπασμένα:

1. **«Στο C4D το βλέπω σαν μία ενιαία οντότητα»** — δεν ξεχώριζαν τοίχοι/κολώνες/πλάκες.
2. **«Η κλίμακα δεν είναι σωστή»** — το μοντέλο άνοιγε 100× μικρό.

Και οι δύο έχουν **μετρημένες** ρίζες, όχι εικασίες:

| # | Ρίζα | Απόδειξη |
|---|------|----------|
| 1 | Ο `OBJExporter.js:44` γράφει `o ${mesh.name}`, αλλά **κανένας** BIM converter δεν θέτει `mesh.name` (μόνο `group.name='bim-entities'`) → κάθε mesh = ανώνυμο `o `. Το ζωντανό 3D δεν χρειάστηκε ποτέ ονόματα (δουλεύει με `userData` + raycasting). | `node_modules/three/.../OBJExporter.js:44` |
| 2 | Το OBJ **δεν ορίζει μονάδα** στο spec. Ο three κόσμος είναι μέτρα (ADR-462)· το C4D διαβάζει OBJ ως **εκατοστά** → 100× μικρό. | OBJ spec· ADR-462 |

**Πλαίσιο στόχου (κρίσιμο):** το Cinema 4D του χρήστη είναι **R15 (2013)**. Ο glTF importer μπήκε
στο **R2024** → το R15 **δεν** διαβάζει glTF. Το **OBJ είναι το μόνο** που ανοίγει εκεί. Το `.c4d`
native είναι αδύνατο (κλειστό format, μόνο Maxon C++ SDK). Μην ψάξεις «C4D glTF import» και
συμπεράνεις ότι δουλεύει.

---

## 2. SSoT Audit (2026-07-17)

| Ερώτημα | Εύρημα | Απόφαση |
|---|---|---|
| Υπάρχει export service; | `runExport()` + adapter pattern (ADR-505) | **Επαναχρήση** — `case 'obj'/'gltf'` στο switch· κανένα νέο engine |
| Πώς βγαίνει το εύρος ορόφων; | `resolveExportFloors()` | Επαναχρήση αυτούσιο |
| Πώς πακετάρονται πολλά αρχεία; | `packageArtifacts()` (zip όταν >1) | Επαναχρήση + `zipLabel` param (το `.obj`+`.mtl` **ενός** ορόφου δεν είναι «floors») |
| Υπάρχει BIM→THREE; | `BimSceneLayer` + `BimToThreeConverter` — **καθαρές συναρτήσεις, μόνο `new THREE.Scene()`** | **Headless επαναχρήση** (βλ. §3) |
| Υπάρχει transliteration ελληνικών; | `transliterateGreekToLatin()` — pure, με tests, αλλά **θαμμένο** στο `ai-pipeline` ενώ τα αδέρφια του (`stripAccents`/`normalizeGreekText`) ήταν ήδη κεντρικά (ADR-217) | **Μετακίνηση** στο `@/utils/greek-text` + re-export· μηδέν breakage |
| Υπάρχει `greekToLatin` δεύτερο; | Ναι — αλλά **επιστρέφει `''`** όταν δεν υπάρχουν ελληνικά και ο πίνακάς του **δεν έχει κεφαλαία** → search-oriented, ακατάλληλο για ονόματα | Δεν χρησιμοποιείται εδώ |
| Υπάρχουν `export.units.*` i18n keys; | Ναι (DXF) | Επαναχρήση — κανένα νέο key για μονάδες |
| Πού ζουν τα storey elevations; | `useFloorsByBuilding` → FLOORS doc (**όχι** `Bim3DEntitiesStore.floors`, όπου `elevation` = undefined) | Ίδιο hook στο `ExportHost` |

**Διορθώσεις σε προηγούμενα έγγραφα** (μην τα ξαναπιστέψεις):

- ❌ «Ο OBJExporter γράφει `usemtl` αλλά ποτέ `.mtl`» → **ΛΑΘΟΣ**. Γράφει `usemtl` **μόνο αν το
  υλικό έχει όνομα** — τα υλικά μας είναι **ανώνυμα**, άρα δεν γραφόταν **ούτε** `usemtl`. Ούτε
  `mtllib` γράφεται ποτέ → το εισάγουμε εμείς (`injectMtlLib`).
- ❌ «Μία γραμμή `name: matId` στον `pbr-material-builder`» → **ΛΑΘΟΣ**. Ο `buildMat(def)` δέχεται
  μόνο `PbrMaterialDef` (**δεν ξέρει το id**) και τα υλικά είναι **cached singletons κοινά με το
  ζωντανό viewport**. Λύση: **ονοματισμένα clones** στη δική μας σκηνή (μηδέν mutation).
- ❌ CLAUDE.md «ADR-370 = επόμενο ελεύθερο» → μπαγιάτικο κατά ~300 (max = **ADR-667**).

---

## 3. Η κεντρική απόφαση: **headless build**, όχι gate «μόνο από 3D»

Ο exporter χτίζει **δική του σκηνή offscreen** αντί να διαβάζει το ζωντανό `getActiveSceneManager()`.

**Γιατί:** το dialog «Εξαγωγή Σχεδίου» τρέχει και από **2D**, όπου δεν υπάρχει mounted 3D viewport.

- `BimSceneLayer` constructor θέλει **μόνο** `THREE.Scene` — όχι renderer/DOM/React (το αποδεικνύουν
  δεκάδες υπάρχοντα `BimSceneLayer-*.test.ts`).
- `BimToThreeConverter` = **καθαρές συναρτήσεις**, μηδέν hooks.
- Precedent σε production: `detail-3d-capture-core.ts` («fully offscreen, ADR-040 safe»).
- Το `throw` του PoC (`GLB_POC_NO_ACTIVE_SCENE`) ήταν **αυτο-επιβαλλόμενο όριο**, όχι αρχιτεκτονικό.

**Γιατί όχι ο live store:** το `useBim3DEntitiesStore` έχει μόνο τον **ενεργό** όροφο και το
`getMultiFloorStack()` είναι **άδειο** αν ο χρήστης δεν έχει πατήσει «Όλοι» — δηλαδή ο live store
δεν μπορεί καν να σερβίρει το «όλοι οι όροφοι». Τα `ExportDeps.levelScenes` μπορούν, ομοιόμορφα.

Το `ShaderMaterial not supported` του PoC **δεν μας αφορά**: είναι το C4D-style ground grid, ζει στη
`scene` — **όχι** στο `bimLayer.group`. Ο headless build επιστρέφει μόνο το `group`.

---

## 4. Απόφαση: η εξαγωγή κουβαλά **ΟΛΟ** το μοντέλο (Giorgio, 2026-07-17)

> «Θέλω να εξάγονται όλα. Αλλά αν κατά την εξαγωγή ο οπλισμός είναι ανενεργός, τότε θα εξάγεται
> στο C4D αλλά θα είναι κι εκεί ανενεργός, και αν θέλει ο χρήστης θα τον εμφανίζει.»

### 4.1 Τι ίσχυε

Το `BimSceneLayer.buildContext()` διαβάζει **τρία** φίλτρα οθόνης μέσω `getState()`: isolate
snapshot, V/G `objectStyles`/`disciplineVisibility`, και ορατότητα layer (`getLayer`). Ό,τι έκρυβε
η οθόνη **δεν αποκτούσε καν mesh** (`resolveEntity` → `return null`).

### 4.2 Τι είναι **αδύνατο** (μετρημένο — μην το ξαναπροσπαθήσεις)

Το «θα είναι κι εκεί ανενεργός» **δεν γίνεται σε κανένα από τα δύο formats**:

| Format | Γιατί όχι |
|---|---|
| **OBJ** | Το format **δεν έχει καθόλου έννοια ορατότητας**. Ο `OBJExporter` γράφει `o <όνομα>` + γεωμετρία, τίποτε άλλο — αγνοεί εντελώς το `.visible`. |
| **glTF** | Το glTF 2.0 **core δεν έχει visibility**. Υπάρχει extension `KHR_node_visibility`, αλλά ο `GLTFExporter` του three **δεν το γράφει ποτέ** (0 εμφανίσεις στο αρχείο). Το μόνο του κουμπί είναι `onlyVisible`, που *παραλείπει* τα αόρατα — το αντίθετο. |

### 4.3 Τι εφαρμόστηκε

Ό,τι μπαίνει στο αρχείο μπαίνει **ορατό** — άρα το σημαδεύουμε ώστε ο χρήστης να το κρύψει μόνος
του με μία κίνηση. **Και τα δύο** (απόφαση Giorgio):

1. **Πρόθεμα `HIDDEN_`** στο όνομα, **και στα δύο formats**. Στο Object Manager του C4D: search
   «HIDDEN» → select all → ένα κλικ στα dots. Μπαίνει **πρώτο** ώστε να ταξινομούνται μαζί.
2. **Ξεχωριστό διαφανές υλικό** (`HIDDEN_<matId>`, `d 0`) — **μόνο OBJ** (το glTF κουβαλά τα υλικά
   του σωστά· δεν τα νοθεύουμε). Κρατά το **πραγματικό χρώμα**: ο χρήστης ανεβάζει το `d` και το
   αντικείμενο επανέρχεται σωστά χρωματισμένο — ένα κοινό «hidden» υλικό θα τα επανέφερε μονόχρωμα.

### 4.4 Το seam

**Ένα** σημείο: `BimSceneLayer.resolveEntity()` — το gate που **ήδη ξέρει** την ετυμηγορία. Με
`new BimSceneLayer(scene, { includeHidden: true })` το φιλτραρισμένο entity **δεν πέφτει**: χτίζεται
και το id του καταγράφεται στο `hiddenEntityIds`.

**Γιατί εκεί και όχι στα meshes:** το `userData` stamping είναι σκορπισμένο σε **~30 converters** —
δεν υπάρχει ενιαίο σημείο. Καταγράφοντας στο gate, μηδέν converter αλλάζει.

Ο ζωντανός viewport μένει σε `includeHidden: false` (default): χτίζοντας κρυφή γεωμετρία κάθε sync
θα πλήρωνε frames **και** θα άφηνε φιλτραρισμένα entities να πιάνονται από τον raycaster.

---

## 5. Απόφαση: ελληνικά ονόματα **ανά format** (Giorgio, 2026-07-17)

| Format | Charset | Γιατί |
|---|---|---|
| **glTF** | **Unicode** — «Ισόγειο_Wall_w-42» | Το spec **επιβάλλει UTF-8**. Ασφαλές. |
| **OBJ** | **Λατινικά** — «Isogeio_Wall_w-42» | Το format **δεν ορίζει encoding**· ο C4D **R15 (2013)** διαβάζει bytes ως latin-1 → κουτάκια. |

Το transliteration είναι lowercase by design (φτιαγμένο για fuzzy search) → ξανα-κεφαλαιοποιείται
με το υπάρχον `toGreekTitleCase` («isogeio» → «Isogeio»), αναγνώσιμο στο Object Manager.

**Οι κατηγορίες μένουν πάντα λατινικά slugs** (`Wall`, `SlabOpening`) και **ποτέ i18n**: ένα
εξαγόμενο αρχείο δεν επιτρέπεται να αλλάζει περιεχόμενο επειδή ο χρήστης γύρισε το UI στα αγγλικά.

---

## 6. Εύρος ορόφων

Το grouping **διαφέρει** από DXF/TEK, γιατί ένα 3Δ μοντέλο έχει πραγματικό άξονα Z:

| Scope | 3Δ συμπεριφορά |
|---|---|
| `active` | 1 όροφος → 1 μοντέλο· κανένα πρόθεμα ορόφου (ένας είναι) |
| `all-zip` | **1 μοντέλο ανά όροφο** → N αρχεία σε zip· ο όροφος είναι στο **όνομα αρχείου** → κανένα πρόθεμα |
| `all-single` | **ΟΛΟΙ στοιβαγμένοι** στα πραγματικά τους υψόμετρα → 1 μοντέλο· το **πρόθεμα ανά mesh** είναι το μόνο που τους ξεχωρίζει |

Το `all-single` είναι **μία** κλήση `exportFloorsToMesh3d(όλοι)` — όχι merge από per-floor outputs:
η στοίβαξη είναι αυτό που το κάνει κτίριο, και το `buildMesh3dScene` την κάνει ήδη (ίδιο μονοπάτι
με τη ζωντανή όψη «Όλοι οι όροφοι»).

Κάθε mesh παίρνει το πρόθεμα **του δικού του** ορόφου, μέσω `userData.levelId` → γι' αυτό
`floorNameByLevelId: Map` και όχι ένα string.

**Fail-closed:** χωρίς `ExportDeps.floors` (τα storey elevations) το «>1 όροφος» **σκάει ρητά**
(`MESH3D_MISSING_FLOOR_ELEVATIONS`) αντί να στοιβάξει σιωπηλά τα πάντα στο Z=0.

---

## 7. Μονάδα OBJ

Ρητό πεδίο «Μονάδες» στο dialog, **default εκατοστά** → ανοίγει σωστά στο C4D με **Scale 1**.

Οι μεγάλοι (Revit/ArchiCAD) δεν το ψήνουν σιωπηλά ούτε το πετούν στον χρήστη: το κάνουν **ρητή
επιλογή με σωστό default**. Το glTF **επιβάλλει μέτρα** στο spec → εκεί το πεδίο είναι **κρυφό**
(με σημείωση), γιατί μια επιλογή που ο exporter είναι υποχρεωμένος να αγνοήσει είναι ψέμα.

Ο τύπος είναι **alias** της υπάρχουσας ένωσης του DXF (`ExportLengthUnit = DxfUnit`) — **όχι**
δεύτερο πανομοιότυπο union — και το picker είναι **ένα** component (`UnitField`) με δύο
καταναλωτές. Το `dxfUnit` και το `mesh3dUnit` ξεκίνησαν ως sibling clones· το **CHECK 3.28 (jscpd)
τα έπιασε στο ίδιο commit** και εξήχθησαν σε ένα (N.18 — ακριβώς το σενάριο για το οποίο υπάρχει).

---

## 8. Αρχεία

**Νέα:**

| Αρχείο | Ρόλος |
|---|---|
| `bim-3d/scene/extract-bim3d-entities.ts` | **SSoT** `SceneModel → Bim3DEntities` (μεταφέρθηκε από ιδιωτική συνάρτηση του aggregator) — registry module `extract-bim3d-entities`, tier 3 |
| `export/core/mesh3d/mesh3d-identity.ts` | `resolveBimMeshIdentity()` — **ανεβαίνει στους προγόνους** (τα meshes κρατούν `userData` άλλοτε στο mesh, άλλοτε στο group). Το `matId` λύνεται **φραγμένο στο σύνορο του element** (`readWithinElement`, 2026-07-18) — δεν διαρρέει σε γειτονικό element (§10) |
| `export/core/mesh3d/mesh3d-naming.ts` | `buildMeshName()`, `HIDDEN_NAME_PREFIX`, charset ανά format |
| `export/core/mesh3d/mesh3d-materials.ts` | `assignExportMaterials()` (ονοματισμένα **clones**), `writeMtl()` |
| `export/core/mesh3d/mesh3d-prepare.ts` | `nameMeshesForExport()`, `applyExportUnit()` |
| `export/core/mesh3d/mesh3d-serialise.ts` | `serialiseObj()`, `serialiseGlb()`, `injectMtlLib()` |
| `export/core/mesh3d/build-mesh3d-scene.ts` | **headless** build |
| `export/formats/mesh3d-export-adapter.ts` | `exportFloorsToMesh3d()` |
| `export/formats/__tests__/mesh3d-export-adapter.test.ts` | 14 tests — κάθε ένα καρφώνει μια ρίζα/απόφαση |
| `export/core/mesh3d/__tests__/mesh3d-identity.test.ts` | 4 tests (2026-07-18) — κλειδώνουν το element-boundary του `matId` (§10) |
| `bim-3d/converters/__tests__/bim-three-wall-opening-attach.test.ts` | 3 tests (2026-07-18) — τα ανοίγματα σφραγίζονται με σημασιολογικό `matId` (§10, απόφαση §2.4) |

**Τροποποιημένα (2026-07-18):** `export/core/mesh3d/mesh3d-identity.ts` (element-boundary `matId`),
`bim-3d/converters/bim-three-wall-opening-attach.ts` (σημασιολογικό `matId` ανοιγμάτων — §2.4).

**Τροποποιημένα (αρχική):** `export/export-service.ts` (routing + `zipLabel`), `export/types.ts`,
`app/ExportHost.tsx` (storey elevations), `ui/.../ExportDialog.tsx` (+`UnitField`),
`ui/.../useExportDialogState.ts`, `bim-3d/scene/BimSceneLayer.ts` (`includeHidden` seam),
`hooks/data/useFloors3DAggregator.ts` (import από SSoT), `utils/greek-text.ts` (+transliteration),
`services/ai-pipeline/shared/greek-text-utils.ts` (re-export), i18n el/en.

**Διαγραμμένα:** `debug/glb-export-poc.ts` + το registration του στο `BimViewport3D.tsx` (ο PoC
ζητούσε ρητά τη διαγραφή του μόλις προσγειωθεί ο adapter).

---

## 9. Επαλήθευση

| Gate | Αποτέλεσμα |
|---|---|
| `mesh3d-export-adapter.test.ts` | **14/14** |
| export + bim-3d + dialog suites | **2529/2530** (το 1 fail = `bim3d-resize-bridge-stair`, **προϋπάρχον** — ούτε το test ούτε ο source του είναι modified από κανέναν, καθαρά μαθηματικό `computeStairResizeParams`, μηδέν σχέση με export) |
| `npm run test:ai-pipeline:all` (N.10) | **73 suites / 1179 tests** |
| `npm run test:registry-golden` | **90/90** |
| `npm run jscpd:diff` (N.18) | **καθαρό** — μετά την εξαγωγή του `UnitField` |
| tsc | **δεν τρέχει από πράκτορα** (N.17) — CI CHECK 3.29 |

**Το e2e που μετράει (Giorgio):** `Δοκιμη ισογεια κατοικια.tek` → Νέστορας → «Εξαγωγή Σχεδίου» →
OBJ → import στο **C4D R15 με Scale 1**: τοίχοι/κολώνες/πλάκες = **ξεχωριστά** αντικείμενα με
ονόματα ανά όροφο/κατηγορία, **σωστές διαστάσεις** χωρίς χειροκίνητο Scale 100, χρώματα από το `.mtl`.

---

## 10. Changelog

- **2026-07-17** — Αρχική έκδοση. Πυρήνας + adapter (uncommitted, ανεπαλήθευτα) → routing στο
  `export-service`, storey elevations στο `ExportHost`, UI (formats + πεδίο μονάδας), 14 tests
  (πρώτη εκτέλεση του πυρήνα — **καμία γραμμή δεν είχε τρέξει ποτέ**), καθαρισμός PoC, registry
  entry. Αποφάσεις Giorgio: (α) εξάγονται **όλα** με σήμανση `HIDDEN_` + διαφανές υλικό (το
  «ανενεργό στο C4D» **αποδείχθηκε αδύνατο** και στα δύο formats — §4.2), (β) **OBJ→λατινικά,
  glTF→ελληνικά**. Boy Scout: `transliterateGreekToLatin` → `@/utils/greek-text` (ADR-217),
  `UnitField` de-duplication, `makeState()` fixture χωρίς `as unknown as`, αφαίρεση περιττού
  `jest.mock('@/utils/greek-text')`.
- **2026-07-18** — **Bug fix: το `matId` διέρρεε πάνω από σύνορο element** (τεκμηριώθηκε στο
  ADR-669 §5.6). Το `resolveBimMeshIdentity` έτρεχε `readUp('matId')` ανεξάρτητα ανά κλειδί, οπότε
  ένα φύλλο πόρτας (`bimId=opening.id`, χωρίς δικό του `matId`) φιλοξενημένο ΜΕΣΑ σε wall group
  (`matId=σκυρόδεμα`) κληρονομούσε το σκυρόδεμα του τοίχου. Λόγω dedup **με το όνομα** στο
  `assignExportMaterials`, η πόρτα έπαιρνε κυριολεκτικά το material clone του τοίχου → **λάθος
  χρώμα στο OBJ/glTF** (και μη-ντετερμινιστικό ως προς τη σειρά `traverse`). **Fix:** νέα
  `readWithinElement(mesh, 'matId', ownerBimId)` — η αναρρίχηση του `matId` σταματά μόλις συναντήσει
  κόμβο με **ΔΙΑΦΟΡΕΤΙΚΟ** `bimId` (μοντέλο Revit/ArchiCAD: το υλικό είναι ιδιότητα ΕΝΟΣ element,
  δεν κληρονομείται από άλλο). Το σύνορο ορίζεται από **αλλαγή** `bimId`, όχι από την παρουσία του,
  ώστε η νόμιμη αναρρίχηση εντός του ίδιου element (wall body mesh → wall group, ίδιο `bimId`) να
  συνεχίζει· `ownerBimId === null` (envelope) → κανένα σύνορο, συμπεριφορά `readUp` (μηδέν regression).
  `bimType`/`bimId`/`levelId` αμετάβλητα (co-located ή αβλαβή). **SSoT:** ένας reader, ένας writer —
  καμία διπλή υλοποίηση. 4 νέα tests σε πραγματική εμφωλευμένη ιεραρχία (τα adapter tests χτίζουν
  επίπεδη σκηνή → δεν το έπιαναν). Gates: export **36 suites / 458 ✅**, bim-3d **235 / 2071 ✅**,
  `jscpd:diff` **καθαρό ✅**. Το e2e (§9) παραμένει στον Giorgio.
- **2026-07-18 (§2.4 — απόφαση Giorgio: «όπως οι μεγάλοι»)** — **Τα ανοίγματα αποκτούν πραγματικό,
  σημασιολογικό `matId` αντί για color-hash fallback.** Revit/ArchiCAD δίνουν στην κάσα/φύλλο/
  υαλοστάσιο μιας πόρτας **δικές τους named surfaces** — ποτέ το υλικό του τοίχου-host. Τα catalog
  ids **υπήρχαν ήδη** (`mat-wood` κάσα+φύλλο, `mat-glass` υαλοστάσιο· `getMaterial3D` στο
  `bim-three-wall-opening-attach.ts`) — απλώς δεν σφραγίζονταν ως `userData.matId`. **Υλοποίηση
  (full SSoT, ένα σημείο):** τα ids δηλώνονται ΜΙΑ φορά ως σταθερές, το `stampOpeningMaterialIds`
  σφραγίζει σε κάθε sub-mesh το **ίδιο** id που έχτισε το υλικό του (material-singleton → id map).
  Έτσι ένα id οδηγεί build + export-naming (+ αύριο BOQ). Το `.mtl` βγάζει πλέον `newmtl mat-wood`/
  `newmtl mat-glass`. Καμία αλλαγή σε `buildOpeningMesh`/`OpeningMeshMaterials` (μηδέν ρίσκο στο
  υπάρχον opening-mesh suite). Δεν είναι δεύτερος identity writer: το `matId` είναι νόμιμο raw
  augmentation (ADR-669 §6.1, ίδιο σημείο με το raw `levelId`). 3 νέα tests
  (`bim-three-wall-opening-attach.test.ts`). Gates: bim-3d+export **272 suites / 2532 ✅**,
  `jscpd:diff` **καθαρό ✅**. **Μελλοντικό (ξεχωριστό ADR):** editable per-opening-type material DNA
  (η κάσα/φύλλο να επιλέγονται από τον χρήστη ανά family, όπως τα Revit family surfaces) — σήμερα τα
  υλικά είναι σταθερά ξύλο/γυαλί.
