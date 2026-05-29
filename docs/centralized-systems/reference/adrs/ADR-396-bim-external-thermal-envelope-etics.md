# ADR-396 — Ενιαία Εξωτερική Θερμοπρόσοψη (ETICS) για BIM

**Status**: 🟢 PHASE P3 IMPLEMENTED 2026-05-29 (pending commit) — Geometry SSoT: `envelope-perimeter.ts` (wall-chaining → εξωτ. παρειά → outward offset/mitre, Option 1 Revit-style ΟΧΙ boolean union) + `exposed-slab-classifier.ts` (Z2/Z3) + offset-with-mitre extraction σε `polygon-utils.ts` (dedup wall+beam). 209/209 geometry tests PASS, tsc clean. P1+P2+P3 complete. OQ-1/OQ-2/OQ-3 RESOLVED. Roadmap = 7 Plan-Mode φάσεις (§7). Επόμενο: Plan Mode {P4 2D render, P5 3D} (παράλληλα-εφικτά).
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
| **Tests** | geometry offset · zone detection · BOQ quantities · reveal strips |

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
| **P7** | Persistence + audit + BOQ | EnvelopePersistenceHost (mirror 7 BIM hosts) · audit coverage (ADR-379/380) · `BimToBoqBridge` per-zone/floor rows (ADR-395) · `.ssot-registry.json` · tests | 4-5 | P2,P6 | Persistence/BOQ |

**Σειρά εκτέλεσης:** P1 → P2 → P3 → {P4, P5 παράλληλα-εφικτά} → P6 → P7.

**Open questions ανά φάση:** OQ-1 (ΚΕΝΑΚ) + OQ-2 (ΑΤΟΕ Neopor) → P1 · OQ-3 (reuse offset helper) → αρχή P3 · OQ-4 (πατούρα) → P4/P6 · OQ-5 (override) → P6.

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
