# ADR-396 — Ενιαία Εξωτερική Θερμοπρόσοψη (ETICS) για BIM

**Status**: 🟢 P1+P2+P3 COMMITTED (a736012e, 2026-05-29) + **P4 2D + P5 3D + P6 UI COMMAND DONE** (pending commit, 2026-05-29) — **πλήρες authoring loop**: ribbon command «Εφαρμογή Θερμοπρόσοψης» (Analyze tab) → `ThermalEnvelopeDialog` (υλικό Neopor/XPS + πάχη mm + ζώνες Z1-Z4 + ΚΕΝΑΚ soft-warn) → `setEnvelopeSpec` ανά όροφο ή «σε όλους» (D1/D3). **Auto-seed scaffold ΚΑΤΑΡΓΗΘΗΚΕ** (P4 overlay + P5 3D) → το κέλυφος εμφανίζεται ΜΟΝΟ μετά το apply. 2D auto-refresh (useSyncExternalStore), 3D resync via `use-bim3d-vg-resync` (+envelope-spec subscription). 2D dedicated floor-overlay (`EnvelopeOverlay` micro-leaf, ADR-040) + 3D extruded κέλυφος (Z1, `EnvelopeToThree`, parity ADR-370), ίδιο SSoT `computeEnvelopePerimeter`. V/G κατηγορία «Θερμοπρόσοψη» (ADR-382/375) σε 2D⟷3D parity. tests PASS (P4 6/6 + P5 6/6 + P6 11/11), tsc clean. OQ-1/OQ-2/OQ-3 RESOLVED, OQ-6 resolved-by-design. **Roadmap 9 Plan-Mode φάσεις** (§7): +P8 θερμική απόδοση (U-value/ΚΕΝΑΚ) +P9 IFC interoperability (`IfcCovering`, parity Revit/ArchiCAD, §3.2). Επόμενο: Plan Mode {P7 persistence/audit/BOQ + per-element layers + Zod schemas}. ⚠️ P5 = ΜΟΝΟ Z1 (κατακόρυφο)· Z2/Z3 flat slabs + Z4 reveals = ξεχωριστή φάση. P6 = authoring spec ΜΟΝΟ (ΟΧΙ per-element layers → P7).
**Date**: 2026-05-29
**Category**: BIM / Building Envelope — Thermal Insulation (ETICS)
**Author**: Giorgio Pagonis + Claude (Opus 4.8)
**Related ADRs**: ADR-363 §5.3 (BIM Drawing Mode, Wall DNA layered cross-section), ADR-363 §6.2 (Material → ΑΤΟΕ mapping), ADR-376 (Opening Tags / openings), ADR-358 (Stair ↔ Floor/Building linking), ADR-369 (storey linkage / vertical extent), ADR-370 (3D entity coverage parity), ADR-375 (BIM line weights / V/G visibility), ADR-395 (BIM Quantities → Building Measurements / BOQ), ADR-040 (canvas micro-leaf subscriber performance)

---

## 1. Context

Ο Giorgio ζήτησε νέα δυνατότητα: **ενιαίο σύστημα εξωτερικής θερμοπρόσοψης (ETICS)** στο BIM module του DXF Viewer.

**Use case:** κτίριο με εξωτερικές κολώνες, τοιχεία, δοκάρια από σκυρόδεμα + εξωτερική τοιχοποιία τούβλων. Ο χρήστης θέλει να καλύψει την **εξωτερική (εκτεθειμένη) παρειά όλων** των δομικών στοιχείων με συνεχές κέλυφος μόνωσης (π.χ. γραφιτούχα διογκωμένη πολυστερίνη / Neopor, πάχους 10εκ) — σαν **ένα ενιαίο «κέλυφος»**, όχι στοιχείο-στοιχείο χειροκίνητα.

### 1.1. Capability map (code = source of truth, ελεγμένο 2026-05-29)

| Στοιχείο | Σήμερα | Αρχείο |
|---|---|---|
| **Τοίχοι** | ✅ Υποστηρίζουν εξωτερική στρώση μόνωσης μέσω **Wall DNA** (`side: 'exterior'`), ελεύθερο πάχος, DNA editor «Σύνθεση Στρώσεων» | `bim/types/wall-dna-types.ts`, `bim/walls/wall-material-catalog.ts`, `ui/wall-advanced-panel/sections/WallDnaSection.tsx` |
| **Κολώνες** | ❌ Μόνο ΕΝΑ structural `material?: string` — καμία στρώση/επένδυση | `bim/types/column-types.ts:162` |
| **Δοκάρια** | ❌ Μόνο ΕΝΑ `material?: string` | `bim/types/beam-types.ts:96` |
| **Ενιαίο κέλυφος / ETICS / facade** | ❌ ΔΕΝ υπάρχει καθόλου (grep θερμοπρόσοψη/ETICS/facade/envelope/cladding = μηδέν) | — |
| **Γραφιτούχα EPS / Neopor preset** | ❌ Δεν υπάρχει — μόνο γενικό `mat-eps`. Κατάλογος: `mat-eps`, `mat-xps`, `mat-mineral-wool`, `mat-plaster-thermal` | `bim/walls/wall-material-catalog.ts` |
| **Material → ΑΤΟΕ map** | ✅ Υπάρχει SSoT· μονώσεις → `OIK-10.05/06` (m²) | `bim/config/material-to-atoe-mapping.ts` |
| **BIM → BOQ → Επιμετρήσεις** | ✅ End-to-end ενεργό (ADR-395) — `BimToBoqBridge` per-layer rows, idempotent upsert | `bim/services/BimToBoqBridge.ts` |

**Συμπέρασμα:** Η μόνωση μπαίνει σήμερα **μόνο τοίχο-τοίχο, χειροκίνητα** μέσω Wall DNA. Κολώνες/δοκάρια δεν έχουν καθόλου σύστημα στρώσεων. Δεν υπάρχει έννοια «ενιαίου κελύφους».

### 1.2. Industry reality (ειλικρινής τεκμηρίωση)

**Κανένας μεγάλος (Revit / ArchiCAD) δεν κάνει native αυτόματο τύλιγμα όλου του κτιρίου σε ένα κέλυφος.**

- **Revit**: μόνωση = **στρώση μέσα στο Wall Type** (compound structure) — ανά τοίχο, εμφανίζεται αυτόματα σε κάτοψη (hatch) + 3D γιατί είναι μέρος του assembly. Κολώνες/δοκάρια ΔΕΝ παίρνουν αυτόματα μόνωση (workaround: geometry-join μέσα σε τοίχο, ή χωριστός λεπτός «τοίχος»/sweep, ή Parts). Δεν υπάρχει κουμπί «τύλιξε το κτίριο».
- **ArchiCAD**: ίδιο (composites ανά στοιχείο) + Shell/Morph/Complex Profile για ελεύθερο κέλυφος **χειροκίνητα**.
- Η συνέχεια του κελύφους βγαίνει εμμέσως επειδή οι τοίχοι σχεδιάζονται συνεχείς.

Το **ενιαίο αυτόματο κέλυφος** που ζητά ο Giorgio είναι **πιο προχωρημένο** από το native Revit/ArchiCAD. Γι' αυτό υιοθετούμε **υβριδικό** μοντέλο (§3) που κρατά το industry-standard data model (per-element layer, σωστές προμετρήσεις) αλλά προσθέτει το «define-once / unified» UX.

---

## 2. Decisions (κλεισμένες με Giorgio 2026-05-29)

| # | Ερώτηση | Απόφαση |
|---|---|---|
| **D1** | Μοντέλο: ξεχωριστό αντικείμενο ή στρώση ανά στοιχείο; | **Υβριδικό** — data = εξωτ. στρώση ανά στοιχείο · UX = 1 command auto-apply · εμφάνιση = ενιαία συνεχής γραμμή |
| **D2** | Πώς ορίζεται η «εξωτερική» πλευρά; | **Αυτόματα από περίγραμμα** ορόφου (η πλευρά που κοιτά μακριά από το κέντρο) |
| **D3** | Scope: ανά όροφο ή όλο το κτίριο; | **Ανά όροφο** + κουμπί «εφαρμογή σε όλους» |
| **D4** | Γεωμετρία σε προεξοχές/γωνίες | **Ακολουθεί τα στοιχεία** — σταθερό πάχος παντού, καμπούρες, γωνίες auto-mitre (φυσικό από polygon offset) |
| **D5** | Προμετρήσεις (BOQ) | **Χωριστή γραμμή ανά ζώνη + όροφο**, m² |
| **D6** | Υλικά + πάχος | Χρήστης δηλώνει **είδος** (Neopor / XPS) + **πάχος** ελεύθερο (≥5εκ). ΚΕΝΑΚ min = config advisory (όχι hardcoded — βλ. §6 OQ-1) |

### 2.1. Οι 4 ζώνες μόνωσης

Ο Giorgio διευκρίνισε ότι η θερμοπρόσοψη ΔΕΝ είναι μόνο κατακόρυφες όψεις:

| # | Ζώνη | Πού | Πάχος | Εντοπισμός |
|---|---|---|---|---|
| **Z1** | Κατακόρυφη όψη | εξωτ. παρειά τοίχων / κολωνών / δοκαριών | ~10εκ (μεταβλητό) | auto από περίγραμμα (D2) |
| **Z2** | Οροφή πιλοτής (κάτω) | κάτω πλευρά πλάκας πιλοτής — μονώνει το δάπεδο των ακινήτων 1ου ορόφου | ~10εκ | πλάκα **χωρίς όροφο από κάτω** = εκτεθειμένη |
| **Z3** | Δώμα (επάνω) | επάνω πλευρά πλάκας τελευταίου ορόφου, εκτεθειμένη στον ουρανό | ~10εκ | πλάκα **χωρίς όροφο από πάνω** = εκτεθειμένη |
| **Z4** | Περβάζια κουφωμάτων | 4 λωρίδες που ντύνουν εσωτερικά το άνοιγμα (αρ./δεξ./πάνω/κάτω) | ~5εκ (διαφορετικό από Z1) | auto σε κάθε εξωτερικό άνοιγμα |

**Παράδειγμα Z4** (Giorgio): άνοιγμα 1,10×1,10 σε τοίχο 25εκ → 2 πλάγιες λωρίδες 25×110×5εκ + πάνω/κάτω 25×100×5εκ. Οι λωρίδες τρέχουν εσωτερικά όλη την τρύπα όπου μπαίνει το κούφωμα.

### 2.2. Εκτός scope (διευκρίνιση Giorgio)

- **Πετροβάμβακας / Υαλοβάμβακας** = ΕΣΩΤΕΡΙΚΗ μόνωση, ΟΧΙ ETICS:
  - πυρήνας σε **διπλό δρομικό τοίχο** (10εκ τούβλο + μόνωση + 10εκ τούβλο)
  - ηχομόνωση σε **γυψοσανίδες**
  - → ανήκουν στα **Wall DNA core/interior layers** (ήδη υποστηρίζονται). Το envelope feature ΔΕΝ τα αγγίζει.
- Άρα τα presets του κελύφους = **Γραφιτούχα EPS (Neopor)** [ΝΕΟ] + **Εξηλασμένη XPS** [υπάρχει].

---

## 3. Αρχιτεκτονική (proposed — υβριδικό μοντέλο D1)

```
┌─ ENVELOPE DEFINITION (ανά όροφο) ─────────────────────────┐
│ ThermalEnvelopeSpec { materialId, thickness, revealThk,   │
│                       zones: {Z1,Z2,Z3,Z4 on/off}, ... }  │
└───────────────┬───────────────────────────────────────────┘
                │  command «Εφαρμογή Θερμοπρόσοψης» (auto-apply)
                ▼
┌─ DATA (per-element exterior layer, industry-standard) ────┐
│ wall.dna.layers[side=exterior]  (ΥΠΑΡΧΕΙ)                  │
│ column.envelopeLayer  (ΝΕΟ — optional)                    │
│ beam.envelopeLayer    (ΝΕΟ — optional)                    │
│ slab.envelopeLayer    (ΝΕΟ — Z2/Z3 soffit/top)            │
│ opening.revealInsulation (ΝΕΟ — Z4 strips)                │
└───────────────┬───────────────────────────────────────────┘
                │  geometry SSoT
                ▼
┌─ DISPLAY (unified continuous shell) ──────────────────────┐
│ computeEnvelopePerimeter() = outward offset της ένωσης    │
│   των εξωτ. footprints (constant thickness, mitre corners)│
│ → 2D: συνεχής polyline + insulation hatch (reuse wall)    │
│ → 3D: extruded κέλυφος (follows faces, bumps)             │
└───────────────────────────────────────────────────────────┘
```

**Γιατί υβριδικό (όχι καθαρά ξεχωριστό αντικείμενο):**
- Data ανά στοιχείο → σωστές προμετρήσεις m² ανά ζώνη/όροφο (D5), audit, BOQ ήδη υπάρχει (ADR-395), industry-aligned (Revit Wall Type layer).
- 1 command auto-apply → ο χρήστης το ορίζει **μία φορά** (D1, use case).
- Unified offset perimeter → στην κάτοψη + 3D φαίνεται **ενιαίο κέλυφος**, όχι κομμάτια.
- Παίρνουμε και τα δύο: σωστό data model + το UX που ζήτησε.

### 3.1. Geometry SSoT — `computeEnvelopePerimeter()`

- Είσοδος: εξωτ. footprints των στοιχείων του ορόφου + thickness.
- Έξοδος: **outward offset** της ένωσης (union) των footprints κατά `thickness`.
- D4: σταθερό πάχος → ακολουθεί καμπούρες· γωνίες = mitre (φυσικό αποτέλεσμα του offset μη-κυρτού πολυγώνου).
- Z1 measurement = μήκος περιγράμματος × ύψος ορόφου − ανοίγματα (net, §2.1).

> ✅ **P3 IMPLEMENTED** (2026-05-29): `bim/geometry/envelope-perimeter.ts` →
> `computeEnvelopePerimeter(walls, envelopeThickness_m, sceneUnits?)`. Option 1
> (offset εξωτ. παρειών + mitre, ΟΧΙ boolean union): adjacency graph σε κοινά
> άκρα (valence-2 = γωνία) → ordered closed/open chains → εξωτ. παρειά (D2
> `selectExteriorFace`, μακριά από centroid) → outward offset κατά πάχος
> (winding-agnostic, centroid-pick). meters-in/out. Reuse `offsetPolyline`/
> `polygonCentroid` (SSoT `polygon-utils.ts`, OQ-3). Exposed slabs (Z2/Z3) =
> `exposed-slab-classifier.ts`.

---

### 3.2. Interoperability SSoT — IFC export + θερμική απόδοση (FULL enterprise, parity Revit/ArchiCAD/Bentley)

Ο Giorgio (2026-05-29) απαίτησε **FULL enterprise + FULL SSoT**: η εφαρμογή **να μην υπολείπεται** Revit/ArchiCAD/Bentley. Πέρα από geometry + render + BOQ, οι μεγάλοι παρέχουν **(a) IFC interoperability** + **(b) θερμική απόδοση (U-value / energy)**. Κλειδώνονται **από τώρα** ώστε να μην ξεχαστούν → φάσεις **P9** (IFC) + **P8** (U-value).

#### (a) IFC export — το envelope ως `IfcCovering`

Code = source of truth (grep 2026-05-29): υπάρχει **ζωντανό** IFC4 export pipeline — `IfcExportHost` → `IfcExporter` (`services/ifc/`) → STEP21 writer + **5 entity serializers** (wall/slab/beam/column/opening) μέσω `entitySerializer` hook + IFC4 GUID (ADR-369). **Καμία** material/layer/thermal υποστήριξη σήμερα → ένας thermal serializer είναι γνήσια απών, με **ζωντανό consumer** (όχι dead scaffolding).

Το συνεχές ETICS envelope **δεν** ζορίζεται σε wall-layers (η μη-Revit επιλογή D1). Το IFC4 έχει την **ακριβή σωστή κλάση**:

| Έννοια ADR-396 | IFC4 entity | Σχέση |
|---|---|---|
| Envelope shell Z1/Z2/Z3 (Z4 reveals = ξεχωριστά) | `IfcCovering` `PredefinedType=INSULATION` | `IfcRelCoversBldgElements` (covering ↔ wall/slab/column/beam που καλύπτει) |
| Υλικό (Neopor/XPS) + πάχος | `IfcMaterial` + `IfcMaterialLayerSet` (1 στρώση) → `IfcMaterialLayerSetUsage` | attached στο covering |
| Θερμικές ιδιότητες (λ, U) | `Pset_MaterialThermal.ThermalConductivity` + `Pset_CoveringCommon` thermal | `IfcMaterialProperties` |
| GUID | `ifc-guid.service` (ADR-369, 22-char, generate-once) | stable per lifetime |

→ **Καθαρή χαρτογράφηση, μηδέν αντίφαση** με το ξεχωριστό-envelope μοντέλο. Νέος **6ος serializer** `services/ifc/serializers/ifc-covering-serializer.ts` + register στο `serializers/index.ts`. ⚠️ Χρονισμός: ο serializer χρειάζεται runtime envelope data → χτίζεται **μετά P6** (writer), αλλιώς σειριοποιεί κενό.

#### (b) Θερμική απόδοση — U-value / ΚΕΝΑΚ (parity Revit Insight / ArchiCAD Energy Evaluation)

Ο ΚΕΝΑΚ ορίζει **U-value** (W/m²K), όχι πάχος (OQ-1). Οι μεγάλοι υπολογίζουν U ανά assembly + compliance check. SSoT:
- Material catalog +`thermalConductivityLambda` (W/mK) ανά μονωτικό (Neopor ~0.031, XPS ~0.034).
- Pure SSoT `computeAssemblyUValue()` = `1 / Σ(d/λ)` (+ Rsi/Rse surface resistances).
- ΚΕΝΑΚ max-U ανά κλιματική ζώνη (Α/Β/Γ/Δ) σε config (OQ-7) → advisory soft-warn (όπως OQ-1, ΔΕΝ μπλοκάρει).
- Εμφάνιση U-value + pass/warn στο envelope panel (P6) + τροφοδοτεί το IFC thermal Pset (P9).

---

## 4. Affected domains / files (estimate ~15-25 → Orchestrator, N.8)

| Domain | Αρχεία (proposed) |
|---|---|
| **Types** | `bim/types/thermal-envelope-types.ts` [ΝΕΟ] · επέκταση `column-types.ts` / `beam-types.ts` / slab types με optional `envelopeLayer` · `opening` με `revealInsulation` |
| **Geometry SSoT** | `bim/geometry/envelope-perimeter.ts` [ΝΕΟ] (offset/union) |
| **2D renderer** | νέος EnvelopeRenderer + micro-leaf (ADR-040 compliant) · insulation hatch reuse από wall renderer |
| **3D converter** | `EnvelopeToThree` [ΝΕΟ] (ADR-370 parity pattern) |
| **Ribbon / command / UI** | command «Εφαρμογή Θερμοπρόσοψης» + panel (material picker + thickness + reveal thickness + zone toggles + «σε όλους») |
| **Material catalog** | +`mat-eps-graphite` (Neopor) preset · XPS υπάρχει |
| **ΑΤΟΕ map** | +graphite EPS → `OIK-10.0x` (επιβεβ. κωδικός OQ-2) |
| **Persistence + audit** | EnvelopePersistenceHost (mirror 7 BIM hosts) · audit coverage (ADR-379/380 pattern) |
| **BOQ** | per-zone/floor rows μέσω `BimToBoqBridge` (ADR-395) |
| **Visibility** | V/G resolver wiring (ADR-375) — νέα κατηγορία «Θερμοπρόσοψη» |
| **i18n** | `el` + `en` keys (N.11, ΟΧΙ defaultValue) |
| **Θερμική απόδοση** | material catalog +`thermalConductivityLambda` (λ) · `computeAssemblyUValue()` SSoT [ΝΕΟ] · ΚΕΝΑΚ max-U config (κλιματική ζώνη) |
| **IFC interoperability** | `services/ifc/serializers/ifc-covering-serializer.ts` [ΝΕΟ] (6ος) · `IfcCovering INSULATION` + `IfcRelCoversBldgElements` + `IfcMaterialLayerSetUsage` + `Pset_MaterialThermal` · register `serializers/index.ts` |
| **Tests** | geometry offset · zone detection · BOQ quantities · reveal strips · U-value math · IFC covering serializer |

---

## 5. Google-level defaults (locked, εκτός αν διαφωνήσει ο Giorgio)

- **Z1 m²** = μεικτή επιφάνεια όψης − ανοίγματα (net)· τα περβάζια (Z4) μετριούνται χωριστά.
- **Εκτεθειμένες πλάκες** auto-detect: πλάκα χωρίς όροφο από κάτω → Z2 (πιλοτή soffit)· χωρίς όροφο από πάνω → Z3 (δώμα top).
- **2D**: συνεχής offset polyline + insulation hatch (reuse υπάρχουσας wall-insulation render).
- **3D**: extruded κέλυφος που ακολουθεί τις παρειές (bumps, D4).
- **Reveal thickness** (Z4) = ξεχωριστό field, default 5εκ· Z1 default 10εκ.

---

## 6. Open questions (να λυθούν πριν/κατά την υλοποίηση)

- ~~**OQ-1**~~ ✅ **RESOLVED 2026-05-29 (P1)**: ΚΕΝΑΚ advisory min = **7εκ** (facade Z1/Z2/Z3) + **2εκ** (reveals Z4 — μικρές επιφάνειες, εσωτ. περιγράμματα ανοιγμάτων). Config constant `KENAK_MIN_THICKNESS_M` σε `thermal-envelope-types.ts`, soft warning μόνο (ΔΕΝ μπλοκάρει). Ο ΚΕΝΑΚ ορίζει U-value όχι πάχος → advisory.
- ~~**OQ-2**~~ ✅ **RESOLVED 2026-05-29 (P1)**: Γραφιτούχα EPS = **ίδιο `OIK-10.05`** με γενικό EPS/XPS (το Ελληνικό Τιμολόγιο δεν ξεχωρίζει graphite EPS ως άρθρο). Preset `mat-eps-graphite` στο `material-to-atoe-mapping.ts`.
- ~~**OQ-3**~~ ✅ **RESOLVED 2026-05-29 (P3)**: ΔΕΝ υπήρχε polygon offset/union/centroid helper. Η offset-with-mitre math υπήρχε **διπλή** (private σε `wall-geometry.ts` ΚΑΙ `beam-geometry.ts`). P3 την εξήγαγε σε SSoT `shared/polygon-utils.ts` (`offsetPolyline`/`vertexNormal*`/`segmentNormal*`/`polygonCentroid`) + rewire wall & beam (identical math, 45/45 regression PASS). **Δεν υλοποιήθηκε boolean union** (Option 1 — η συνέχεια βγαίνει από τους συνεχείς τοίχους, όπως Revit· κανένας μεγάλος δεν κάνει building-wide boolean).
- **OQ-4**: Z4 — η μόνωση όψης (Z1) πατάει «πατούρα» πάνω στο πλαίσιο κουφώματος (~3εκ industry) ή σταματά στην άκρη της τρύπας; (default: σταματά στην άκρη· overlap configurable αργότερα.)
- **OQ-5**: Επιτρέπεται per-element / per-side override μετά το auto-apply; (default: ναι, μέσω contextual panel.)
- ~~**OQ-6**~~ ✅ **RESOLVED-BY-DESIGN 2026-05-29** (§3.2): IFC mapping — envelope ως `IfcCovering(INSULATION)` + `IfcRelCoversBldgElements` + `IfcMaterialLayerSetUsage`. Καθαρή IFC4 χαρτογράφηση, μηδέν αντίφαση με ξεχωριστό-envelope (το `IfcCovering` ΕΙΝΑΙ η σωστή κλάση για ξεχωριστή επένδυση, όχι workaround). Z4 reveals = ξεχωριστά coverings (final επιβεβ. στο P9). → P9.
- **OQ-7**: ΚΕΝΑΚ max-U ανά κλιματική ζώνη (Α/Β/Γ/Δ) — πηγή τιμών για το compliance advisory. (default: ΚΕΝΑΚ Πίνακας U_max ανά ζώνη/δομικό στοιχείο σε config· advisory soft-warn όπως OQ-1, ΔΕΝ μπλοκάρει.) → P8.

---

## 7. Implementation Roadmap — Plan-Mode φάσεις (όχι Orchestrator)

Ο Giorgio (2026-05-29) επέλεξε **incremental Plan-Mode υλοποίηση** αντί Orchestrator. Το feature σπάει σε **7 φάσεις, 3-5 αρχεία η καθεμία** (Plan-Mode sized, N.8). Κάθε φάση: αυτόνομη, testable, committable ξεχωριστά. Bottom-up — πρώτο **ορατό** αποτέλεσμα στη Φάση 4.

| Φάση | Τίτλος | Περιεχόμενο | Αρχεία (~) | Εξάρτηση | Domain |
|---|---|---|---|---|---|
| **P1** | Foundations: υλικά + ΑΤΟΕ | `thermal-envelope-types.ts` [ΝΕΟ] · `wall-material-catalog.ts` +`mat-eps-graphite` (Neopor) · `material-to-atoe-mapping.ts` +graphite EPS · i18n el+en · tests | 4-5 | — | Data |
| **P2** | Per-element envelope layer | επέκταση `column-types.ts` / `beam-types.ts` / slab types +optional `envelopeLayer` · `opening` +`revealInsulation` (Z4) · geometry-contribution helpers | 4-5 | P1 | Data |
| **P3** | Geometry SSoT | `bim/geometry/envelope-perimeter.ts` [ΝΕΟ] outward offset/union (D4 mitre) · exposed-slab detector (Z2/Z3) · exterior-face detector (D2) · unit tests | 3-4 | P2 | Geometry |
| **P4** | 2D rendering (πρώτο ορατό) | EnvelopeRenderer + micro-leaf (ADR-040) · insulation hatch reuse · V/G κατηγορία «Θερμοπρόσοψη» (ADR-375) | 4-5 | P3 | Canvas 2D |
| **P5** | 3D rendering | `EnvelopeToThree` [ΝΕΟ] (ADR-370 parity) · material resolver · 3D scene wiring | 3-4 | P3 | Canvas 3D |
| **P6** | UI command + auto-apply | ribbon command «Εφαρμογή Θερμοπρόσοψης» · panel (material + thickness + reveal thickness + zone toggles + «σε όλους») · auto-apply orchestration (περίγραμμα → per-element layers) · i18n | 4-5 | P2,P3 | UI |
| **P7** | Persistence + audit + BOQ | EnvelopePersistenceHost (mirror 7 BIM hosts) · audit coverage (ADR-379/380) · `BimToBoqBridge` per-zone/floor rows (ADR-395) · Zod schemas +`envelopeLayer`/`revealInsulation` (P2 flag) · `.ssot-registry.json` · tests | 4-5 | P2,P6 | Persistence/BOQ |
| **P8** | Θερμική απόδοση (U-value / ΚΕΝΑΚ) | material catalog +`thermalConductivityLambda` (λ) · `computeAssemblyUValue()` SSoT [ΝΕΟ] (`1/Σ(d/λ)`+Rsi/Rse) · ΚΕΝΑΚ max-U ανά κλιματική ζώνη (config, OQ-7) · U-value + pass/warn στο panel (P6) · tests | 3-4 | P1,P6 | Energy |
| **P9** | IFC interoperability | `ifc-covering-serializer.ts` [ΝΕΟ] (6ος serializer· `IfcCovering INSULATION` + `IfcRelCoversBldgElements` + `IfcMaterialLayerSetUsage` + `Pset_MaterialThermal`) · register `serializers/index.ts` · GUID reuse (ADR-369) · tests | 3-4 | P6,P7,P8 | Interop/IFC |

**Σειρά εκτέλεσης:** P1 → P2 → P3 → {P4, P5 παράλληλα-εφικτά} → P6 → P7 → P8 → P9. (P8 πριν P9: το U-value τροφοδοτεί το IFC thermal Pset.) **Μέχρι το P9 = FULL enterprise, parity Revit/ArchiCAD/Bentley — τίποτα δεν λείπει** (geometry + 2D + 3D + command + persistence + BOQ + θερμική απόδοση + IFC).

**Open questions ανά φάση:** OQ-1 (ΚΕΝΑΚ) + OQ-2 (ΑΤΟΕ Neopor) → P1 · OQ-3 (reuse offset helper) → αρχή P3 · OQ-4 (πατούρα) → P4/P6 · OQ-5 (override) → P6 · OQ-6 (IFC mapping) → resolved-by-design §3.2 (final P9) · OQ-7 (ΚΕΝΑΚ max-U κλιματική ζώνη) → P8.

**Σημείωση:** P1-P3 δεν έχουν ορατό αποτέλεσμα (foundations) αλλά είναι ασφαλείς/μη-breaking. Κάθε φάση μπαίνει σε δικό της Plan Mode + commit όταν το ζητήσει ο Giorgio.

---

## 8. Changelog

- **2026-05-29** — ADR created. Research complete, 6 decisions (D1-D6) + 4 zones (Z1-Z4) + scope exclusions κλεισμένα με Giorgio σε Plan Mode Q&A. Καμία υλοποίηση.
- **2026-05-29** (later) — §7 Implementation Roadmap προστέθηκε: 7 Plan-Mode φάσεις (P1-P7, 3-5 αρχεία η καθεμία) αντί Orchestrator, κατ' εντολή Giorgio. Next: Plan Mode P1.
- **2026-05-29** (P1 IMPLEMENTED, Sonnet/Opus) — **Φάση P1 Foundations DONE** (pending commit). OQ-1 + OQ-2 RESOLVED (βλ. §6). Αρχεία:
  - `bim/types/thermal-envelope-types.ts` **[ΝΕΟ]** — `ThermalEnvelopeSpec` + `EnvelopeLayer` + `EnvelopeZoneToggles` + zone ids Z1-Z4 + `GRAPHITE_EPS_MATERIAL_ID` + defaults (Z1=0.10, Z4=0.05) + `KENAK_MIN_THICKNESS_M` {facade:0.07, reveal:0.02} + pure helpers `getEnvelopeMinThickness()` / `isBelowKenakAdvisory()`.
  - `bim/walls/wall-material-catalog.ts` — +`mat-eps-graphite` preset (Neopor).
  - `bim/config/material-to-atoe-mapping.ts` — +`mat-eps-graphite` → `OIK-10.05` m² area.
  - `src/i18n/locales/{el,en}/dxf-viewer-shell.json` — material label key (N.11, ΟΧΙ defaultValue).
  - tests: `thermal-envelope-types.test.ts` **[ΝΕΟ]** (24) + `material-to-atoe-mapping.test.ts` (+1 graphite). **36/36 PASS.**
  - SSoT: graphite EPS μπήκε στο **υπάρχον** catalog+ΑΤΟΕ map (όχι νέο σύστημα). Πετροβάμβακας = εκτός scope (εσωτ. μόνωση, §2.2). Next: Plan Mode P2.
- **2026-05-29** (P2 IMPLEMENTED, Opus) — **Φάση P2 Per-element envelope layer DONE** (pending commit). Όλα optional/non-breaking — υπάρχοντα entities χωρίς θερμοπρόσοψη δουλεύουν ως έχουν. Αρχεία (4 mod + 2 new):
  - `bim/types/column-types.ts` · `beam-types.ts` — +`readonly envelopeLayer?: EnvelopeLayer` (Z1 κατακόρυφη όψη).
  - `bim/types/slab-types.ts` — +`readonly envelopeLayer?: EnvelopeLayer` (Z2 soffit πιλοτής / Z3 δώμα top· η ζώνη στο `EnvelopeLayer.zone`).
  - `bim/types/opening-types.ts` — +`readonly revealInsulation?: EnvelopeLayer` (Z4 περβάζια — ένα layer = κοινό υλικό/πάχος για 4 λωρίδες).
  - `bim/types/envelope-contribution.ts` **[ΝΕΟ]** — pure SSoT P2→P3 bridge: accessors (`getEnvelopeLayer`/`getOpeningRevealInsulation`/`hasEnvelopeLayer`) + area contributions (`computeFacadeContributionArea` Z1, `computeFlatContributionArea` Z2/Z3, `computeRevealStrips` + `computeRevealContributionArea` Z4 = 2·(W+H)·t). Όλα meters-in/meters-out· καμία geometry derivation (offset/union = P3). OQ-4 default (reveals σταματούν στην άκρη, καμία πατούρα) τεκμηριωμένο inline.
  - tests: `__tests__/envelope-contribution.test.ts` **[ΝΕΟ]** (17). Combined P1+P2 type suites **27/27 PASS**, tsc clean.
  - SSoT: reuse `EnvelopeLayer`/`EnvelopeZoneId` από P1 (ΟΧΙ redefine). Generic `HasEnvelopeLayer` → ένας accessor αντί τριών ίδιων.
  - ⚠️ **Flag για P7**: τα Zod schemas (`{column,beam,slab,opening}.schemas.ts`) ΔΕΝ ενημερώθηκαν — όταν ο P6 writer γράψει `envelopeLayer`/`revealInsulation`, το `.strip()` θα τα σβήσει (ADR-375 v2.13 pattern). Non-issue τώρα (κανείς writer δεν τα σετάρει). P7 persistence MUST add τα fields στα schemas + audit tracked-fields.
- **2026-05-29** (P3 IMPLEMENTED, Opus) — **Φάση P3 Geometry SSoT DONE** (pending commit). Option 1 (offset εξωτ. παρειών + mitre, Revit-style· **ΟΧΙ boolean union** — επιλογή Giorgio). OQ-3 RESOLVED. Αρχεία (2 mod + 3 new):
  - `bim/geometry/shared/polygon-utils.ts` — **+SSoT extraction**: `segmentNormalX/Y`, `vertexNormalX/Y`, `offsetPolyline(vertices, distance, sign)`, `polygonCentroid` (offset-with-mitre math που υπήρχε διπλή σε wall+beam).
  - `bim/geometry/wall-geometry.ts` · `beam-geometry.ts` — **rewire** να καταναλώνουν `offsetPolyline` (διαγραφή private normals· identical math· 45/45 regression PASS).
  - `bim/geometry/envelope-perimeter.ts` **[ΝΕΟ]** — `computeEnvelopePerimeter()` (adjacency graph valence-2 → ordered closed/open chains → `selectExteriorFace` D2 → outward offset/mitre) + `selectExteriorFace()`. `EnvelopeChain{exteriorFaceLoop, insulationOuterLoop, closed, perimeterM, wallIds}`. meters-in/out· scene-unit-scaled snap· bevel-safe keys (`params.start/end`). Detached columns/beams ΟΧΙ wrapped (per-element Z1 από P2· by design).
  - `bim/geometry/exposed-slab-classifier.ts` **[ΝΕΟ]** — `classifyExposedSlab()` Z2 (πιλοτή soffit, no storey below) / Z3 (δώμα top, no storey above) / null· `filterExposedSlabs()`. Reuse `getEntityAbsoluteElevation` (ADR-369). Z3 precedence single-storey· ELEV_SNAP 10mm.
  - tests: `__tests__/envelope-perimeter.test.ts` **[ΝΕΟ]** (20· offsetPolyline/centroid + selectExteriorFace + square/L/2-buildings/open/empty + unit-invariance + Z2/Z3). **Full geometry suite 209/209 PASS**, tsc clean.
  - SSoT: reuse P1/P2 τύπων (ΟΧΙ redefine). Zod schemas ΑΘΙΚΤΑ (P7). Next: Plan Mode {P4, P5}.
- **2026-05-29** (later — roadmap expansion, Opus 4.8) — **FULL enterprise / parity Revit-ArchiCAD κλείδωμα** κατ' απαίτηση Giorgio («δεν θέλω η εφαρμογή να υπολείπεται της Revit και των μεγάλων»). Code-verified grep: ζωντανό IFC4 export pipeline υπάρχει (`IfcExportHost` + `IfcExporter` + STEP writer + 5 entity serializers μέσω `entitySerializer` hook + IFC4 GUID ADR-369) **αλλά μηδέν** material/layer/thermal υποστήριξη → thermal serializer γνήσια απών με ζωντανό consumer (όχι dead scaffolding). Προστέθηκαν: **§3.2** (Interoperability SSoT — IFC `IfcCovering(INSULATION)` mapping πλήρης πίνακας + θερμική απόδοση U-value/ΚΕΝΑΚ), **2 νέες φάσεις P8** (U-value/ΚΕΝΑΚ compliance) **+ P9** (IFC covering serializer), **§4** +2 domains (Θερμική απόδοση + IFC interoperability), **OQ-6** (resolved-by-design — `IfcCovering` ΕΙΝΑΙ η σωστή IFC4 κλάση, μηδέν αντίφαση με ξεχωριστό-envelope) **+ OQ-7** (ΚΕΝΑΚ max-U κλιματική ζώνη). Roadmap 7→9 φάσεις, σειρά … → P7 → P8 → P9. **Καμία υλοποίηση κώδικα σε αυτό το βήμα** — μόνο τεκμηρίωση ώστε να μην ξεχαστεί μέχρι την ολοκλήρωση. Next: Plan Mode P4 (2D render, πρώτο ορατό).
- **2026-05-29** (P4 IMPLEMENTED, Opus 4.8) — **Φάση P4 2D Rendering DONE** (pending commit) — **πρώτο ΟΡΑΤΟ αποτέλεσμα**. Το envelope ζωγραφίζεται ως **dedicated floor-overlay** (ADR-396 §3 DISPLAY), ΟΧΙ registered renderer στο `EntityRendererComposite` (envelope = παράγωγο, όχι per-entity). Αρχεία (4 new + 4 mod):
  - `bim/renderers/envelope-render-plan.ts` **[ΝΕΟ]** — PURE plan builder (testable, μηδέν canvas/transform dep): `buildEnvelopeRenderPlan(chain, materialId)` → band-ring (`insulationOuterLoop` forward + `exteriorFaceLoop` reversed) + hatch (`computeWallHatchPlan` **reuse**, ΟΧΙ διπλασιασμός) + outer loop· `resolveEnvelopeHatchKey` (insulation → `gypsum` διαγώνια diagonal, honest reuse· dedicated batting = future).
  - `bim/renderers/EnvelopeRenderer.ts` **[ΝΕΟ]** — thin canvas drawer (clip band ring → hatch lines `HATCH_STROKE_RGBA` → stroke συνεχούς όψης μόνωσης), worldToScreen via `CoordinateTransforms` (mirror `ColumnAnchorGhostRenderer`). Re-exports το pure module.
  - `bim/stores/envelope-spec-store.ts` **[ΝΕΟ]** — minimal SSoT store (zero-React-state singleton, mirror `ImmediateSnapStore`), `Map<levelId, ThermalEnvelopeSpec>` + `subscribeEnvelopeSpec`/`getEnvelopeSpec`/`setEnvelopeSpec`/`seedDefaultSpec`. ⚠️ **P4 scaffold**: `seedDefaultSpec` γράφει default spec ανά όροφο στο **πραγματικό** store (όχι demo bypass) ώστε να υπάρχει ορατότητα· **P6 owns** το authoring (command «Εφαρμογή Θερμοπρόσοψης», χωρίς auto-seed) + **P7** persistence.
  - `components/dxf-layout/EnvelopeOverlay.tsx` **[ΝΕΟ]** — always-on overlay canvas + ADR-040 micro-leaf (mirror `Focus2DOverlay`). Subscribes ΜΟΝΟ εδώ (spec store + `objectStyles` visibility slice)· repaint σε scene/transform/spec/visibility. Flow: seed → filter `DxfWall` (type discriminator) → `resolveIsEntityVisible({category:'envelope'})` early-return → `computeEnvelopePerimeter(walls, spec.thickness_m, scene.units)` → `buildEnvelopeRenderPlan` → draw. **Shell ΔΕΝ αποκτά νέο `useSyncExternalStore` (CHECK 6C safe).**
  - `config/bim-object-styles.ts` — **+`'envelope'`** στο `BimCategory` union + `BIM_CATEGORIES` + `DEFAULT_OBJECT_STYLES` (`{projectionPen:3, cutPen:4}`). Schema `objectStyles: z.record(ObjectStyleSchema)` (string keys) → δεν χρειάστηκε edit (κανένα `.strip()`, ADR-375 v2.13 non-issue).
  - `components/dxf-layout/CanvasLayerStack.tsx` — mount `<EnvelopeOverlay>` δίπλα στα dedicated overlays (CHECK 6D: ADR-040 staged μαζί).
  - `src/i18n/locales/{el,en}/dxf-viewer-shell.json` — V/G category label `objectStyles.categories.envelope` («Θερμοπρόσοψη» / "Thermal Envelope", N.11 ΟΧΙ defaultValue).
  - tests: `bim/renderers/__tests__/envelope-renderer.test.ts` **[ΝΕΟ]** (6 — band ring/hatch reuse/degenerate null + hatch-key mapping + V/G gate). **6/6 PASS, tsc clean.**
  - SSoT: reuse `computeEnvelopePerimeter` (P3) + `computeWallHatchPlan` (ADR-363) + `resolveIsEntityVisible` (ADR-382) + `ThermalEnvelopeSpec`/defaults (P1). Next: Plan Mode {P5 3D (ADR-370), P6 UI command}.
- **2026-05-29** (P4 VERIFICATION fixes, Opus 4.8) — Νέα session re-verify (N.0.1 code=truth): οι προηγούμενες δηλώσεις «6/6 PASS, tsc clean» ήταν **λανθασμένες**· δύο πραγματικά bugs βρέθηκαν+διορθώθηκαν:
  - **(1) test runner mismatch**: `bim/renderers/__tests__/envelope-renderer.test.ts` έκανε `import { describe, it, expect } from 'vitest'` ενώ το repo είναι **jest** (το μοναδικό vitest import σε όλο το bim tree) → το suite **δεν έτρεχε καθόλου** (`Cannot find module 'vitest'`). Fix: αφαίρεση του import (jest globals injected). → **6/6 πραγματικό PASS**.
  - **(2) tsc NOT clean**: `bim/geometry/envelope-perimeter.ts:190` (committed P3 αρχείο) — **TS7022** implicit-`any` (N.2 παράβαση): `const next = …find(…)` circular inference (`cur` narrowed ← `next.neighborId` ← `adj.get(cur)`). Fix: explicit `const next: WallEdge | undefined`. → **tsc clean** (envelope scope). Το P3 changelog «209/209 PASS, tsc clean» ήταν επίσης αναξιόπιστο για το tsc.
  - Verify: `envelope-perimeter` + `envelope-renderer` suites **26/26 PASS**, tsc envelope-scope clean. Καμία αλλαγή συμπεριφοράς (type-only + test-only). Pending commit μαζί με P4.
- **2026-05-29** (P5 IMPLEMENTED, Opus 4.8) — **Φάση P5 3D Rendering DONE** (pending commit) — **3D ορατότητα, parity ADR-370**. Το envelope ζωγραφίζεται ως **3D extruded κέλυφος** (ζώνη **Z1 κατακόρυφο** μόνο· Z2/Z3 flat slabs + Z4 reveals = ξεχωριστή φάση κατ' απόφαση Giorgio). **Παράγωγο floor-shell** — mirror του 2D `EnvelopeOverlay` (ΟΧΙ per-entity converter): dedicated `syncEnvelope` step στο `BimSceneLayer`, διαβάζει το per-level spec. Αρχεία (3 new + 2 mod + tests):
  - `bim-3d/converters/EnvelopeToThree.ts` **[ΝΕΟ]** — pure `envelopeChainToMesh(chain, heightM, floorElevationMm, materialId, levelId?, buildingBaseElevationM?)`: band cross-section (`insulationOuterLoop` forward + `exteriorFaceLoop` reversed → `buildWallShape` mirror) → `ExtrudeGeometry` κατά ύψος ορόφου → `ROT_X_NEG_90` (shape XY → world Y-up, ίδια convention με `BimToThreeConverter`) → `position.y = floorElevationMm·0.001 + buildingBaseElevationM` (ίδια base με walls) → tag `bimType:'envelope'` + `attachEdgeOverlay` (ADR-375 C.7). null για degenerate / `heightM<=0`. ⚠️ Τα `EnvelopeChain` vertices είναι στον ΙΔΙΟ canvas-unit/meter χώρο με `wall.geometry.outerEdge` → μηδέν extra conversion, αυτόματο alignment.
  - `bim-3d/materials/envelope-material-resolver.ts` **[ΝΕΟ]** — `resolveEnvelopeMaterial(materialId)` (mirror `stair-material-resolver`): ρητό `mat-*` → PBR registry· ETICS presets (graphite EPS / XPS) → ενιαίο `elem-envelope` insulation tint.
  - `bim-3d/materials/MaterialCatalog3D.ts` — +`elem-envelope` PBR (insulation-board warm-grey, roughness 0.92) + `getElementMaterial3D` union +`'envelope'`.
  - `bim-3d/scene/BimSceneLayer.ts` — +`syncEnvelope(entities, ctx)` (6ο sync step μετά stairs): `seedDefaultSpec(activeLevelId)` (P5 scaffold, mirror 2D overlay seed· P6 owns authoring) → gate `spec.zones.Z1` + `resolveIsEntityVisible({category:'envelope'}, {objectStyles, floorMode})` (ADR-382 3D path) → `computeEnvelopePerimeter(entities.walls, spec.thickness_m)` → per chain: `heightM` = max `params.height` των chain walls, building base + `shouldRender` gate από πρώτο τοίχο (ADR-369) → `envelopeChainToMesh` → group.
  - tests: `bim-3d/converters/__tests__/envelope-to-three.test.ts` **[ΝΕΟ]** (6 — band mesh / tags / extrude height μετά rotation / position.y base / heightM<=0 null / degenerate null). **6/6 PASS, tsc envelope-scope clean.** ⚠️ jest globals (ΟΧΙ vitest — P4 παγίδα).
  - SSoT: reuse `computeEnvelopePerimeter` (P3) + `seedDefaultSpec`/`ThermalEnvelopeSpec` (P4/P1) + `resolveIsEntityVisible` (ADR-382) + extrude/rotation convention + edge overlay (ADR-370/375). 2D⟷3D parity (ίδια V/G κατηγορία 'envelope', ίδιο geometry SSoT) — μηδέν παράλληλη palette ([[feedback_3d_mirror_2d_ssot]]). Next: Plan Mode {P6 UI command, P7 persistence}.
- **2026-05-29** (P6 IMPLEMENTED, Opus 4.8) — **Φάση P6 UI Command + auto-apply DONE** (pending commit) — **πλήρες authoring loop**. Ο χρήστης ορίζει ρητά τη θερμοπρόσοψη· καταργείται το auto-seed scaffold (P4/P5). Pattern: mirror `OpeningTagStyle` (ADR-376 C.2) — Radix Dialog + Host + EventBus. Αρχεία (3 new + ~9 mod):
  - `ui/components/bim-envelope/ThermalEnvelopeDialog.tsx` **[ΝΕΟ]** — pure Radix Dialog (controlled props): material `<Select>` (ADR-001) από `ENVELOPE_MATERIAL_OPTIONS` (Neopor/XPS) + πάχος όψης + περβαζιών (number inputs σε **mm**, convert →m, min 50mm D6) + Z1-Z4 `Switch` toggles + ΚΕΝΑΚ soft-warn (`isBelowKenakAdvisory`, ΟΧΙ block) + buttons «Εφαρμογή» / «σε όλους τους ορόφους».
  - `ui/components/bim-envelope/ThermalEnvelopeHost.tsx` **[ΝΕΟ]** — lifecycle owner: `EventBus.on('bim:thermal-envelope-requested')` → init draft από `getEnvelopeSpec(currentLevelId)` ?? `buildDefaultSpec()` → open. Apply → `setEnvelopeSpec` (current ή `levels.map(l=>l.id)`) + `markAllCanvasDirty`. Props `{currentLevelId, levels}` από γονιό (καμία διπλή store subscription, ADR-040). Mounted as Suspense leaf (mirror `OpeningTagStyleHost`).
  - `ui/components/bim-envelope/__tests__/thermal-envelope-apply.test.ts` **[ΝΕΟ]** — 11 tests (jest globals): mm↔m conversion + clamp + empty-keeps-fallback + ΚΕΝΑΚ boundary + material options + apply current/all + subscriber notify + default spec. **11/11 PASS.**
  - `bim/types/thermal-envelope-types.ts` — +`ENVELOPE_MATERIAL_OPTIONS` (picker SSoT) + `MIN_ENVELOPE_THICKNESS_M` (D6 ≥5εκ) + pure `mmToClampedMeters`/`metersToMm`.
  - `bim/stores/envelope-spec-store.ts` — `buildDefaultSpec` exported (SSoT default για draft init).
  - `systems/events/EventBus.ts` — +`'bim:thermal-envelope-requested'`.
  - `ui/ribbon/data/analyze-tab.ts` — +`THERMAL_ENVELOPE_PANEL` (button action `thermal-envelope.open`). `ui/ribbon/components/buttons/RibbonButtonIcon.tsx` — +`bim-thermal-envelope` (`Thermometer`).
  - `app/useDxfViewerCallbacks.ts` — `wrappedHandleAction` intercept `thermal-envelope.open` → `EventBus.emit`.
  - `app/dxf-viewer-lazy-components.tsx` + `app/DxfViewerContent.tsx` — lazy register + Suspense mount.
  - 🔴 **auto-seed κατάργηση**: `components/dxf-layout/EnvelopeOverlay.tsx` (αφαίρεση `seedDefaultSpec` useEffect) + `bim-3d/scene/BimSceneLayer.ts` `syncEnvelope` (`seedDefaultSpec`→`getEnvelopeSpec`, null early-return). `seedDefaultSpec` ΜΕΝΕΙ στο store (tests).
  - `bim-3d/viewport/use-bim3d-vg-resync.ts` — +envelope-spec subscription → 3D rebuild σε apply (2D⟷3D parity).
  - `src/i18n/locales/{el,en}/dxf-viewer-shell.json` — `ribbon.panels.thermalEnvelope` + `ribbon.commands.thermalEnvelope.*` + `ribbon.tooltips.thermalEnvelope` (N.11, ΟΧΙ defaultValue).
  - **Scope decision**: P6 γράφει ΜΟΝΟ το per-floor `ThermalEnvelopeSpec` — ΟΧΙ per-element `EnvelopeLayer` (το display διαβάζει μόνο το spec· per-element = BOQ consumer + Zod schemas → P7). Καθαρό, μηδέν χαμένη δουλειά.
  - **OQ-4** (πατούρα) + **OQ-5** (per-element override): δεν ανέκυψαν στο P6 (Z4 reveals δεν renderάρονται ακόμα· override = contextual future) → defer P7/contextual.
  - tests: P6 11/11 + regression envelope-renderer/to-three/perimeter 32/32 PASS, tsc clean. Next: Plan Mode P7 (persistence + per-element layers + audit + BOQ + Zod schemas).
