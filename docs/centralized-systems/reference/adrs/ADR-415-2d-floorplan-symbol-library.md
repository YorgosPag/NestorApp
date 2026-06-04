# ADR-415 — Βιβλιοθήκη 2D Αποτυπωμάτων (Floorplan Symbol Library)

| Field | Value |
|---|---|
| Status | 🟢 **Φ1+Φ2 IMPLEMENTED** — 2026-06-04, Opus 4.8 (Plan Mode εγκεκριμένο). **16 σύμβολα / 3 κατηγορίες** (sanitary 5 + kitchen 4 + furniture 7), contextual picker, ξεχωριστό ribbon group «Αντικείμενα» (εκτός Δομικών). tsc 0 scope / 16 tests PASS. Firestore indexes DEPLOYED. 🔴 browser verify + commit (Giorgio). Φ5 thumbnails / Φ6 importer pending. |
| Date | 2026-06-04 |
| Owner | Giorgio / Claude (Opus 4.8) |
| Related | **ADR-410** (CC0 mesh furniture — πρότυπο pipeline)· **ADR-411** (entity-agnostic mesh library)· **ADR-409** (third-party BIM library licensing policy — επεκτείνεται εδώ §C)· **ADR-406** (point-based MEP fixture — pure-vector 2D symbol pattern)· ADR-405 (discipline taxonomy)· ADR-397 (`appendEntityToScene` SSoT)· ADR-040 (canvas micro-leaf)· ADR-017/210/294 (enterprise IDs N.6)· ADR-001 (Radix Select) |

---

## 1. Context — τι ζήτησε ο Giorgio

> «Θέλω βιβλιοθήκη με **μπλοκς από αποτυπώματα επίπλων** — κρεβάτια, τραπέζια, καρέκλες, έπιπλα, πλυντήρια, κουζίνες, μπάνια, νιπτήρες, WC, ντουζιέρες — όλον τον εξοπλισμό που χρειάζεται ένα **γραμμικό αρχιτεκτονικό σχέδιο**. Θέλω να τα βάζω στον **δισδιάστατο** καμβά του DXF. Μπορούμε να πάρουμε **δωρεάν** βιβλιοθήκες από το διαδίκτυο, **χωρίς να απαιτείται να αποκαλύψουμε τον κώδικά μας**;»

Διευκρίνιση (AskUserQuestion, 2026-06-04): **καθαρά 2D blocks (DXF/SVG)** — γνήσια διανυσματικά σύμβολα κάτοψης, ΟΧΙ projection 3D mesh σε top-view. Ζητούμενο = έρευνα + ADR + plan υλοποίησης.

**Κρίσιμη διάκριση από τα ADR-410/411:** Εκείνα έφεραν **3D mesh** έπιπλα (GLB), με την 2D κάτοψη να εξάγεται αυτόματα ως σιλουέτα *από* το mesh. Αυτό το ADR αφορά **καθαρά διανυσματικά 2D σύμβολα** — όπως τα AutoCAD blocks ή τα family-symbols του Revit — που ζουν μόνο στο 2D επίπεδο και ταιριάζουν στο γραμμικό αρχιτεκτονικό αισθητικό (λεπτές γραμμές, χωρίς σκιές/υφές).

---

## 2. Έρευνα στην εφαρμογή — τι υπάρχει ήδη

(Ενδελεχής σάρωση του `src/subapps/dxf-viewer/`. Αναφορές `file:line`.)

### 2.1 Το `'block'` EntityType υπάρχει αλλά είναι **νεκρό**

- `types/base-entity.ts:35` — το `EntityType` union περιέχει `'block'`.
- `types/entities.ts:387` — `BlockEntity { type:'block'; name; position; scale; rotation; entities: Entity[] }` + type guard `isBlockEntity` (`:619`).
- **ΟΜΩΣ:** δεν καταχωρείται στο `EntityRendererComposite` (`rendering/core/EntityRendererComposite.ts:114-142` — δεν υπάρχει `'block'` key) → **δεν ζωγραφίζεται τίποτα**.
- Στο `utils/dxf-entity-converters.ts:448-475` δεν υπάρχει `case 'INSERT'` → το DXF INSERT entity **αγνοείται σιωπηλά** (`default: return null`).
- Δεν υπάρχει **BlockRecord registry** — το BLOCKS section του DXF γίνεται parsed (markers στο `dxf-parser-types.ts`) αλλά **δεν διαβάζεται**.

**Συμπέρασμα:** Υπάρχει σκελετός block-υποστήριξης από παλιά, αλλά μη λειτουργικός. Δεν τον επαναχρησιμοποιούμε ως έχει.

### 2.2 Υπάρχει **ολοκληρωμένο** pipeline τοποθέτησης σημειακών BIM στοιχείων

Το βαρύ έργο έχει ήδη γίνει — δύο πλήρη, δοκιμασμένα παραδείγματα:

| Subsystem | Αρχεία-κλειδιά | Τι μας δίνει |
|---|---|---|
| **Furniture (ADR-410)** | `bim/types/furniture-types.ts`, `bim/furniture/furniture-catalog.ts`, `hooks/drawing/useFurnitureTool.ts`, `bim/renderers/FurnitureRenderer.ts`, `app/FurniturePersistenceHost.tsx` | Πλήρης free-point placement + catalog + 2D renderer με **authored-rectangle fallback** (`FurnitureRenderer.ts:94-106`, δουλεύει **χωρίς** GLB) |
| **MEP Fixture (ADR-406)** | `bim/.../mep-fixture-symbol.ts`, `hooks/drawing/useMepFixtureTool.ts` | **Pure-vector 2D family-symbol** — ακριβώς το μοντέλο για «καθαρό 2D block» (γραμμές/τόξα, μηδέν mesh) |

**Κοινός μηχανισμός (επαναχρησιμοποιήσιμος αυτούσιος):**
1. **EntityType union** (SSoT): `types/base-entity.ts:21-60`.
2. **Renderer registry** (SSoT): `EntityRendererComposite.ts:73-143` → `this.renderers.set('<type>', renderer)`.
3. **2D render base**: `rendering/entities/BaseEntityRenderer.ts` (`worldToScreen`, `finalizeRender`).
4. **entity-model conversion**: `canvas-v2/dxf-canvas/dxf-renderer-entity-model.ts:116`.
5. **Drawing tool state-machine**: `useFurnitureTool.ts` (`idle → awaitingPosition → committed`, με `getGhostFootprint()` live preview χωρίς state mutation — ADR-040).
6. **Είσοδος στη σκηνή (SSoT)**: `bim/scene/append-entity-to-scene.ts:41-55` → εκπέμπει `drawing:entity-created` → persistence host κάνει το πρώτο Firestore save.
7. **Ribbon**: `ui/ribbon/data/home-tab-draw.ts` (button) + `ui/ribbon/data/contextual-furniture-tab.ts` (contextual tab) + `app/ribbon-contextual-config.ts:150` (trigger on `activeTool`).
8. **Picker με thumbnails (ADR-411)**: `ui/ribbon/hooks/useRibbonMepFixtureLibraryBridge.ts:59-96` (`bimMeshThumbnailStore.use()` + combobox options).
9. **Enterprise IDs (N.6)**: `services/enterprise-id-prefixes.ts` + factory.
10. **Discipline/Category (ADR-405)**: `config/bim-object-styles.ts` (`BimCategory`) + `bim-discipline.ts` (`DISCIPLINE_BY_CATEGORY`).

### 2.3 Δεν υπάρχει SVG/DXF-block importer

- **Κανένας SVG parser** στο subapp.
- **Κανένας DXF-as-block importer** (διάβασμα εξωτερικού .dxf και ένθεση ως block).
- Άρα: αν θέλαμε να εισάγουμε εξωτερικά .dxf/.svg blocks, θα χρειαζόταν **νέα capability** (parser). Αυτό **δεν** είναι απαραίτητο για την προτεινόμενη λύση (βλ. §4).

### 2.4 Το furniture entity ως φορέας 2D

Το `FurnitureParams` (`furniture-types.ts:66-108`) έχει ήδη `position`, `rotationDeg`, `widthMm`, `depthMm`, `heightMm`, `sceneUnits`, `kind`, `assetId`. Η `computeFurnitureGeometry` παράγει το 2D `footprint` polygon **μόνο από αυτές τις διαστάσεις** — το GLB δεν είναι προϋπόθεση για το 2D. Το `assetId` σήμερα είναι υποχρεωτικό (FK→GLB), αλλά ο renderer **ήδη** έχει fallback χωρίς mesh.

---

## 3. Έρευνα στο διαδίκτυο — δωρεάν βιβλιοθήκες & αδειοδότηση

**Ζητούμενο αδειοδότησης (απαρέγκλιτο):** permissive license που (α) **ΔΕΝ** μας υποχρεώνει να ανοίξουμε/αποκαλύψουμε τον κώδικά μας (όχι copyleft), (β) επιτρέπει **εμπορική ενσωμάτωση** (bundling) σε closed-source web app, (γ) επιτρέπει **αναδιανομή** του asset μέσα στο προϊόν. Αποδεκτά: **CC0 / Public Domain, MIT, Apache-2.0, BSD, CC-BY** (με αναφορά). Απορρίπτονται: **GPL/LGPL/AGPL, CC-BY-SA** (share-alike copyleft), **CC-BY-NC** (non-commercial), και κάθε «free for personal use / no redistribution».

### 3.1 Η μεγάλη παγίδα: οι «δωρεάν» CAD-block ιστότοποι

Σχεδόν **όλοι** οι γνωστοί ιστότοποι CAD blocks λένε «δωρεάν λήψη» αλλά **απαγορεύουν ρητά** την αναδιανομή/ενσωμάτωση σε προϊόν:

| Πηγή | Πραγματικοί όροι | Bundling σε app | Πηγή |
|---|---|---|---|
| **Archweb** | "personal, non-commercial use only"· ρητή απαγόρευση μεταβίβασης σε τρίτους | ❌ | archweb.com/en/terms-and-conditions |
| **Bibliocad** | «cannot replicate and/or distribute any content… through other websites» | ❌ | bibliocad.com/conditions |
| **cadblock.org** | «no license for redistribution… without explicit permission» | ❌ (θέλει γραπτή άδεια) | cadblock.org/terms-and-conditions |
| **LibreCAD part libs** | **CC BY-SA 4.0** (copyleft) | ❌ | dokuwiki.librecad.org |
| **Sweet Home 3D** | App = **GPL**· 2D icons = μεικτό GPL/CC-BY, **μόνο PNG** | ❌ / πολύπλοκο | sweethome3d.com/license |
| **GSStnb/dxfBlocks (GitHub)** | Δηλώνει «CC0» αλλά πραγματικά **CC BY-NC-SA** | ❌ (NC+SA) | github.com/GSStnb/dxfBlocks |
| **FreeCAD-symbols** | CC-BY 3.0, αλλά **μόνο draft symbols** (όχι έπιπλα) | ⚠️ off-topic | github.com/FreeCAD/FreeCAD-symbols |

> **Μάθημα:** «free to download» ≠ «free to redistribute/bundle». Η τυπική «δωρεάν χρήση» σημαίνει «άνοιξέ το στο AutoCAD σου» — όχι «βάλ' το μέσα στο εμπορικό σου προϊόν».

### 3.2 Πηγές που **ΕΙΝΑΙ** ασφαλείς (CC0/CC-BY)

| Πηγή | Άδεια | Bundling | Format | Κάλυψη επίπλων | Σύσταση |
|---|---|---|---|---|---|
| **publicdomainvectors.org** | CC0 | ✅ | SVG/EPS | 400+ floor-plan vectors | ✅ (με curation) |
| **Openclipart** | CC0 | ✅ | SVG | ανομοιογενές | ✅ συμπληρωματικά |
| **Noun Project (CC0 υποσύνολο)** | CC0 | ✅ | SVG/PNG | 775 floor-plan icons (φίλτρο CC0) | ✅ συμπληρωματικά |
| **Kenney Furniture Kit** | CC0 | ✅ | PNG/SVG top-down | ~120 αντικείμενα | ⚠️ game-art αισθητική, λείπουν sanitary |

**Καμία** CC0/MIT **DXF** βιβλιοθήκη επίπλων δεν βρέθηκε για εμπορικό bundling. Οι CC0 πηγές είναι **SVG**.

### 3.3 Η νομικά ισχυρότερη επιλογή: **παράγουμε τα δικά μας** σύμβολα

Νομική βάση (US Copyright Office Ch. 900· EU): **απλά/τυποποιημένα γεωμετρικά σχήματα ΔΕΝ είναι copyrightable** — «a simple shape, or one that is commonly used, cannot be copyrighted». Τα standard αρχιτεκτονικά σύμβολα (ορθογώνιο = κρεβάτι, σχήμα-D = λεκάνη WC, ορθογώνιο+2 κύκλοι = νεροχύτης) είναι **functional, τυποποιημένα** σχήματα → εκτός προστασίας. Οι **διαστάσεις** είναι facts (ADR-409 §C). Άρα παράγοντας δικά μας παραμετρικά 2D σύμβολα: μηδενικός νομικός κίνδυνος, καθαρό αρχιτεκτονικό αισθητικό, πλήρης έλεγχος.

Σχετικό: **ADR-409 §C** ήδη θεμελιώνει «facts-vs-derived» (διαστάσεις = facts). Το εργαλείο `dxf-writer` (MIT) είναι διαθέσιμο αν χρειαστεί προγραμματική παραγωγή DXF.

---

## 4. Decision (Proposed)

### Δ1 — **ΚΛΕΙΔΩΜΕΝΟ (Giorgio, 2026-06-04):** παραμετρικά δικά μας 2D σύμβολα (όχι import ξένων blocks)

> **Οριστική απόφαση:** τα σύμβολα **τα κατασκευάζουμε εμείς** (~90%, παραμετρικά). CC0 SVG (publicdomainvectors/Openclipart) **μόνο** ως συμπλήρωμα σε ελάχιστες σύνθετες εξαιρέσεις, μετατρεπόμενα offline σε path-data. Καμία εξάρτηση από CAD-block sites με περιοριστικούς όρους.

Φτιάχνουμε μια βιβλιοθήκη **pure-vector 2D family-symbols** κατά το πρότυπο `mep-fixture-symbol.ts` — κάθε σύμβολο = συνάρτηση που ζωγραφίζει γραμμές/τόξα από παραμέτρους (πλάτος/βάθος/τύπος). Καλύπτει: **sanitary** (WC, νιπτήρας, ντουζιέρα, μπανιέρα, μπιντές), **kitchen** (πάγκος, εστίες, νεροχύτης, ψυγείο), **appliances** (πλυντήριο, πλυντήριο πιάτων), **έπιπλα** (κρεβάτι μονό/διπλό, καναπές, τραπέζι, καρέκλα — απλά αποτυπώματα).

**Γιατί αυτή και όχι import:**
- ✅ Νομικά ασφαλέστερη (μηδέν εξάρτηση από αμφίβολους όρους).
- ✅ Καθαρό **γραμμικό αρχιτεκτονικό** αισθητικό (το ζητούμενο) — όχι game-art ή ασύμβατα στυλ.
- ✅ Παραμετρικό → ένα σύμβολο, πολλές διαστάσεις· scale-able χωρίς απώλεια.
- ✅ Μηδέν νέα capability (δεν χρειάζεται SVG/DXF parser).
- ✅ Reuse του υπάρχοντος pipeline σχεδόν αυτούσιο.

**Συμπληρωματικά (προαιρετικό):** όπου ένα σύμβολο είναι πολύπλοκο, εισάγουμε **CC0 SVG** από `publicdomainvectors.org` / `Openclipart` και το μετατρέπουμε σε path-data offline (μία φορά, σε build-time JSON) — όχι runtime parser. CC0 → καμία υποχρέωση αναφοράς.

### Δ2 — Αρχιτεκτονική φορέα (entity type) — **ΚΛΕΙΔΩΜΕΝΟ: Revit-grade**

**Απόφαση (Giorgio, 2026-06-04 «τι θα έκανε η Revit»):** Ένα ενιαίο, **category-driven** entity `'floorplan-symbol'` — **ΟΧΙ** reuse του `furniture`, **ΟΧΙ** type-per-object.

**Πώς το κάνει η Revit:** ΕΝΑ family engine (geometry + 2D symbol + params + placement = κοινός μηχανισμός), αλλά **ΠΟΛΛΕΣ ξεχωριστές categories**:

| Αντικείμενο | Revit Category | Discipline | IFC class |
|---|---|---|---|
| Καρέκλα/τραπέζι/κρεβάτι | Furniture | Architecture | `IfcFurniture` |
| WC/νιπτήρας/ντουζιέρα/μπανιέρα | **Plumbing Fixtures** | **Plumbing** | `IfcSanitaryTerminal` |
| Κουζίνα/ντουλάπια/πάγκος | Casework | Architecture | `IfcFurniture` / `IfcSystemFurnitureElement` |
| Πλυντήριο/ψυγείο | Specialty Equipment | Architecture/Mechanical | `IfcBuildingElementProxy` |

Η Revit **ποτέ** δεν βάζει WC στην category «Furniture» — διαφορετική discipline, schedule, IFC export, V/G overrides.

**Μετάφραση στην αρχιτεκτονική μας:** ένα EntityType `'floorplan-symbol'` (= render-dispatch key, το «engine») με υποχρεωτικό `category` field (`sanitary | kitchen | furniture | appliance | …`) που οδηγεί: discipline (ADR-405), IFC class, ΑΤΟΕ/schedule, default 2D σύμβολο.

| | Reuse `furniture` + νέα `kind` | **Νέο `'floorplan-symbol'` (category-driven)** ✅ |
|---|---|---|
| Revit-faithful | ❌ WC = «έπιπλο» (λάθος category) | ✅ WC = Plumbing Fixture |
| Discipline | Όλα `interior` | Ανά κατηγορία (plumbing/interior/kitchen) |
| IFC | `IfcFurniture` για όλα | Σωστό class ανά category |
| SSoT engine | — | ΕΝΑΣ μηχανισμός (μην διπλασιάσεις — N.0.2) |
| 3D αργότερα | — | opt-in mesh (όπως mep-fixture→ADR-411) χωρίς refactor |

**Γιατί όχι reuse furniture:** hard-wired `IfcFurniture` + `interior` → αντι-Revit για sanitary. **Γιατί όχι type-per-object:** διπλασιασμός pipeline → αντι-SSoT. Το ενιαίο category-driven entity = ΑΚΡΙΒΩΣ το Revit μοντέλο (ένα engine, πολλές categories). Reuse όλου του pipeline (tool/persistence/ribbon/append) με rename.

### Δ3 — Επέκταση ADR-409 (licensing policy)

Νέα παράγραφος **§E — 2D vector symbols**: (α) τα παραμετρικά δικά μας σύμβολα είναι ιδιοκτησία μας· (β) επιτρεπτές εξωτερικές πηγές = CC0 SVG (publicdomainvectors/Openclipart/Noun-Project-CC0) μόνο· (γ) ρητή απαγόρευση CAD-block sites (Archweb/Bibliocad/cadblock.org), LibreCAD CC-BY-SA, Sweet Home 3D GPL.

---

## 5. Implementation Plan (φάσεις)

**Φ1 — Foundation + vertical slice (1 σύμβολο end-to-end):** EntityType `'floorplan-symbol'` + `floorplan-symbol-types.ts` (params: `category`, `kind`, `position`, `rotationDeg`, `widthMm`, `depthMm`) + `floorplan-symbol-catalog.ts` (SSoT presets) + 1ο σύμβολο (π.χ. WC). Renderer `FloorplanSymbolRenderer.ts` (pure-vector, mirror `mep-fixture-symbol.ts`) + registry. Tool `useFloorplanSymbolTool.ts` (mirror furniture). `appendEntityToScene` + persistence host + enterprise-id prefix (`fpsym`) + Firestore collection + rules + index. Ribbon button + contextual tab. i18n el+en. Tests + tsc 0.

**Φ2 — Sanitary pack:** WC, νιπτήρας, ντουζιέρα, μπανιέρα, μπιντές (category `sanitary` → discipline `plumbing`, `IfcSanitaryTerminal`).

**Φ3 — Kitchen pack:** πάγκος, εστίες, νεροχύτης, ψυγείο, απορροφητήρας (category `kitchen`).

**Φ4 — Appliances + furniture footprints:** πλυντήριο ρούχων/πιάτων· απλά αποτυπώματα κρεβάτι/καναπές/τραπέζι/καρέκλα (όσα θέλει «καθαρά 2D» αντί mesh).

**Φ5 — Picker με thumbnails (auto-generated 2D previews):** offline render των vector symbols σε thumbnail PNG ή inline SVG preview (reuse `bimMeshThumbnailStore` pattern ή canvas-rendered preview).

**Φ6 — (προαιρετικό) DXF/SVG import capability:** parser για ένθεση εξωτερικών CC0 blocks — μόνο αν προκύψει ανάγκη.

Κάθε φάση: tsc 0 + tests, ενημέρωση αυτού του ADR (changelog) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (N.15) στο ίδιο commit με τον κώδικα.

---

## 6. Εναλλακτικές που απορρίφθηκαν

- **Import DWG/DXF από Archweb/Bibliocad/cadblock:** ❌ νομικά (απαγόρευση redistribution/bundling).
- **Sweet Home 3D / LibreCAD libraries:** ❌ GPL / CC-BY-SA copyleft.
- **Top-view projection από τα 3D mesh (ADR-410/411):** απορρίφθηκε ρητά από Giorgio — θέλει καθαρά διανυσματικά 2D, όχι rasterized/projected mesh σιλουέτες.
- **Reuse νεκρού `'block'` EntityType:** μη λειτουργικό, χωρίς renderer/registry — δεν αξίζει η ανάσταση.

---

## 7. Επόμενο βήμα

Έγκριση Giorgio για: (1) επιλογή φορέα (Δ2: νέο type vs reuse furniture), (2) εκκίνηση **Φ1 vertical slice**. Με «ok» ξεκινά Plan Mode/υλοποίηση Φ1.

---

## Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-06-04 | **Φ3 — GRIPS WALL-PARITY (Giorgio: «ίδια χερούλια με τοίχο, FULL SSOT»).** Τα 2D σύμβολα απέκτησαν πλήρες grip UX μέσω του ΚΟΙΝΟΥ `bim/grips/centred-box-grips.ts` (ίδιο engine με έπιπλο/πίνακα/φωτιστικό, μηδέν fork): **λαβή μετακίνησης** (3-click move + Ctrl-copy) + **λαβή περιστροφής** (6-click reference) + **4 γωνίες** (2-click resize, ORTHO axis-lock). Status-bar prompts `tool-hints:gripContextMenu.prompts.*` κληρονομούνται αυτόματα. ΝΕΑ: `floorplan-symbol-grips.ts` (thin adapter) + `UpdateFloorplanSymbolParamsCommand` + `commitFloorplanSymbolGripDrag` + `commitFloorplanSymbolCopy` + renderer `getGrips`. `floorplanSymbolGripKind` στις ίδιες entity-agnostic πύλες με το έπιπλο (grip-types/useGripMovement, glyph-registry, wall-hot-grip-fsm, 5 forwarding boundaries, grip-computation, commit-adapters dispatch, parametric-commits re-exports). Μηδέν αντιγραφή rotation/resize math. 21 tests PASS (5 νέα grip), tsc 0 scope. |
| 2026-06-04 | **Φ2 — ΒΙΒΛΙΟΘΗΚΗ 16 ΣΥΜΒΟΛΩΝ + PICKER + RIBBON GROUP (Giorgio: «πού είναι τα άλλα σχήματα;» + «δεν είναι δομικά»).** Επέκταση FloorplanSymbolCategory→`sanitary|kitchen|furniture` + 16 kinds. Drawers σε registry `Record<kind,(fp)=>strokes>` (pure-vector, normalized coords). Category engine: per-category bimCategory/discipline/ifcType/**palette** (sanitary=μπλε/plumbing, kitchen=πράσινο/architectural, furniture=καφέ/interior). Νέα BimCategory `kitchen` (+totality Records). **Contextual picker** (8 αρχεία standard bridge pattern: command-keys/tool-bridge-store/useRibbonFloorplanSymbolBridge/contextual tab + composer wiring useDxfBimBridges/useDxfViewerRibbon/useRibbonCommands)· tool publishes assetId+rotation. **Ribbon:** μετακίνηση εκτός «Δομικά Στοιχεία» → νέο split-button **«Αντικείμενα»** (2D σύμβολα + έπιπλα). i18n el/en. 16 tests PASS, tsc 0 scope. |
| 2026-06-04 | **Φ1 IMPLEMENTED (vertical slice WC).** Νέο category-driven EntityType `'floorplan-symbol'` (Δ2). Core SSoT: `floorplan-symbol-types.ts` (category `'sanitary'` + kind `'wc'`), `floorplan-symbol-categories.ts` (category engine: sanitary→plumbing/`IfcSanitaryTerminal`/BimCategory `sanitary`), `-catalog.ts` (WC preset, parametric/own), `-geometry.ts`, `-symbol.ts` (pure-vector WC: cistern+bowl+seat σε normalized footprint coords, rotation-aware μηδέν trig). Pipeline: `FloorplanSymbolRenderer` (ADR-040 micro-leaf), `useFloorplanSymbolTool` (single-click), factory (N.6 `fpsym_*` + category-driven `ifcType`), firestore-service + audit-client + `useFloorplanSymbolPersistence` + `FloorplanSymbolPersistenceHost`. Registration: EntityType/Entity-union/guard/isBimEntity, EntityRendererComposite, DxfEntityUnion+entity-model switch, **3 hit-test σημεία** (Bounds/HitTestingService/selection-duplicate-utils), BimCategory `sanitary`+pen, DISCIPLINE_BY_CATEGORY, IfcEntityType `IfcSanitaryTerminal`, BimElementType, enterprise-id `fpsym`, COLLECTIONS `FLOORPLAN_SYMBOLS`, audit tracked-fields+entityType, BimRestoreEntityType. Wiring: tool-definitions+ToolType, useSpecialTools+useCanvasClickHandler+CanvasSection, ribbon button (shortcut WC), DxfViewerTopBar host. Infra: firestore.rules block + 2 indexes (**DEPLOYED**) + i18n el/en. 16 tests PASS, tsc 0 (scope). **Deferred:** grips, live-ghost leaf, contextual tab/bridge, ΑΤΟΕ/BOQ (sanitary=ΥΔΡ). Opus 4.8 (Plan Mode). |
| 2026-06-04 | **RESEARCH + DESIGN.** Έρευνα εφαρμογής (pipeline furniture/mep-fixture reusable· νεκρό `'block'` type· κανένας SVG/DXF importer) + έρευνα διαδικτύου (CAD-block sites απαγορεύουν bundling· CC0 SVG πηγές OK· παραμετρικά δικά μας = ισχυρότερη επιλογή). Plan 6 φάσεων. Opus 4.8 (Plan Mode). Εκκρεμεί έγκριση Φ1. |
| 2026-06-04 | **Δ2 ΚΛΕΙΔΩΜΕΝΟ (Giorgio «τι θα έκανε η Revit»):** ενιαίο **category-driven** `'floorplan-symbol'` entity (ΕΝΑ family engine, πολλές categories — όπως Revit). WC=Plumbing Fixture/`IfcSanitaryTerminal`, ΟΧΙ reuse furniture (αντι-Revit) ούτε type-per-object (αντι-SSoT). `category` field → discipline+IFC+ΑΤΟΕ+symbol. |
| 2026-06-04 | **Δ1 ΚΛΕΙΔΩΜΕΝΟ (Giorgio):** τα σύμβολα τα κατασκευάζουμε εμείς (~90% παραμετρικά)· CC0 SVG μόνο συμπληρωματικά. Εγκρίθηκε εκκίνηση Φ1 → **νέα συνεδρία Plan Mode** (καθαρό context). |
