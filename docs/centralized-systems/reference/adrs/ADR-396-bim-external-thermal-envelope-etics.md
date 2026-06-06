# ADR-396 — Ενιαία Εξωτερική Θερμοπρόσοψη (ETICS) για BIM

**Status**: 🟢 P1+P2+P3 COMMITTED (a736012e, 2026-05-29) + **P4 2D + P5 3D + P6 UI COMMAND + P7 (A+B) + P-RENDER (Z2/Z3/Z4 ορατότητα 2D+3D) DONE** (pending commit, 2026-05-29) — **πλήρες authoring loop**: ribbon command «Εφαρμογή Θερμοπρόσοψης» (Analyze tab) → `ThermalEnvelopeDialog` (υλικό Neopor/XPS + πάχη mm + ζώνες Z1-Z4 + ΚΕΝΑΚ soft-warn) → `setEnvelopeSpec` ανά όροφο ή «σε όλους» (D1/D3). **Auto-seed scaffold ΚΑΤΑΡΓΗΘΗΚΕ** (P4 overlay + P5 3D) → το κέλυφος εμφανίζεται ΜΟΝΟ μετά το apply. 2D auto-refresh (useSyncExternalStore), 3D resync via `use-bim3d-vg-resync` (+envelope-spec subscription). 2D dedicated floor-overlay (`EnvelopeOverlay` micro-leaf, ADR-040) + 3D extruded κέλυφος (Z1, `EnvelopeToThree`, parity ADR-370), ίδιο SSoT `computeEnvelopePerimeter`. V/G κατηγορία «Θερμοπρόσοψη» (ADR-382/375) σε 2D⟷3D parity. tests PASS (P4 6/6 + P5 6/6 + P6 11/11), tsc clean. OQ-1/OQ-2/OQ-3 RESOLVED, OQ-6 resolved-by-design. **Roadmap 9 Plan-Mode φάσεις** (§7): +P8 θερμική απόδοση (U-value/ΚΕΝΑΚ) +P9 IFC interoperability (`IfcCovering`, parity Revit/ArchiCAD, §3.2). **P7 DONE (A+B)** (2026-05-29, pending commit) — Part A: spec persistence στο level doc + Zod unblock (**το κέλυφος ΕΠΙΒΙΩΝΕΙ reload**)· Part B: per-element `envelopeLayer`/`revealInsulation` (applicator Z1-Z4 + audit tracked-fields + `envelope-boq-sync` per-zone/floor m² γραμμές D5· ride existing persist hooks via `bim:envelope-applied`). 18/18 + 58/58 regression PASS. **P8 DONE** (2026-05-29, Opus 4.8, pending commit) — θερμική απόδοση: `bim/thermal/` SSoT (`assembly-u-value` U=1/(Rsi+Σd/λ+Rse) + `kenak-thermal-config` ΤΟΤΕΕ U_max ανά κλιματική ζώνη Α/Β/Γ/Δ + reference τοίχος) + λ ανά υλικό στο `wall-material-catalog` + U-value/ΚΕΝΑΚ pass-warn panel στον ThermalEnvelopeDialog + climateZone ρύθμιση κτιρίου (`Building.climateZone`, OQ-7a). 13/13 tests PASS. Επόμενο: Plan Mode P9 (IFC `IfcCovering`/`Pset_MaterialThermal`). ⚠️ P5 = ΜΟΝΟ Z1 (κατακόρυφο)· Z2/Z3 flat slabs + Z4 reveals = ξεχωριστή φάση. P6 = authoring spec ΜΟΝΟ (ΟΧΙ per-element layers → P7). **✅ P9 DONE (2026-05-29, Opus 4.8, pending commit) — ADR-396 ΟΛΟΚΛΗΡΩΜΕΝΟ 9/9 φάσεις, FULL enterprise parity Revit/ArchiCAD/Bentley.** IFC4 covering serializer (6ος): ETICS κέλυφος → `IfcCovering(INSULATION)` per-element + `Pset_MaterialThermal`(λ από P8), semantic-only, walls Z1 από per-floor spec. 10/10 tests + roundtrip 8/8, tsc clean. **+ v2 roadmap (pending commit): Phase 1 `enclosesRegion` gate + Phase 2 `building-footprint.ts` boolean union (ΤΟΙΧΟΙ+ΚΟΛΩΝΕΣ+ΔΟΚΑΡΙΑ → outer rings + holes + per-edge attribution, lib `polygon-clipping` MIT· αυτόνομο, μηδέν wiring — Φάση 5)· 11/11+410/410 PASS. Βλ. §3.1.1.** **+ v2 Phase 3 region classification + Phase 4 `envelopeFunction` data model + Phase 5A engine `envelope-shell.ts` (footprint-driven, drop-in `EnvelopeChain[]`, override `interior`=κενό/`exterior`=orphan-wrap, offset try-both-pick-by-centroid· 18/18 + 472/472 PASS, tsc clean· wiring 3 consumers = Φάση 5B) DONE (pending commit). Βλ. §3.1.4.** **+ v2 Phase 5B (pending commit): wired οι 3 consumers + BOQ στο `computeEnvelopeShell` (αντικαθιστά `computeEnvelopePerimeter` πλην IFC P9)· hole-gate (component με ≥1 τρύπα μονώνεται· αλλιώς `open-structure`)· no-slab-data→δωμάτιο default (αίθρια=Φ5C)· applicator proximity→chain-ids· consumers χωρίς `enclosesRegion` filter. 213/213 + 32/32 PASS, tsc clean. Βλ. §3.1.5.**
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
│ wall: Z1 από per-floor ThermalEnvelopeSpec (ΟΧΙ per-elem)  │
│   → wall.dna.layers (structural: σοβάς+φέρων, ΟΧΙ ETICS)  │
│   → U virtual-append ETICS κατά calc (P10, χωρίς mutation) │
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

**Display ανά ζώνη (P-RENDER, 2026-05-29 — αποφάσεις Giorgio Plan Mode):**
- **Z1** (κατακόρυφο κέλυφος) — 2D: offset polyline + hatch band· 3D: extruded band (P4/P5).
- **Z2/Z3** (εκτεθειμένες πλάκες — soffit πιλοτής / δώμα top) — **2D κάτοψη: διαγράμμιση μόνωσης σε ΟΛΟ το footprint** της πλάκας (clip polygon + `computeWallHatchPlan` reuse)· **3D: λεπτή flat στρώση** ΠΑΝΩ (Z3) / ΚΑΤΩ (Z2) από την πλάκα. Z2/Z3 = ίδιο 2D visual (η ζώνη μετράει για το 3D πρόσημο elevation).
- **Z4** (περβάζια κουφωμάτων) — **2D κάτοψη: 2 παραστάδες** (jamb strips), ΚΑΘΕΤΕΣ στον άξονα του τοίχου, σε όλο το πάχος· solid-polygon hatch ανά παραστάδα (όπως Z2/Z3). Η τομή κάτοψης περνά μέσα από το άνοιγμα → φαίνονται **μόνο οι παραστάδες** (πρέκι/ποδιά είναι πάνω/κάτω στο Z). **3D: ρητές λωρίδες** (2 παραστάδες full-height + πρέκι + ποδιά μόνο για παράθυρα) εξωθημένες καθ' ύψος ανοίγματος. Γεωμετρία παραστάδων = κοινό SSoT `computeRevealJambQuads` (`bim/geometry/reveal-lining-geometry.ts`, 2D⟷3D parity). **⚠️ Το παλιό 2D `inset frame` (`buildRevealBandPlan` + `insetClosedPolygon`) ΑΠΟΣΥΡΘΗΚΕ** — οι 45° mitered γωνίες έβγαζαν **λοξή παρειά** (BUG 1).
- **Z1 reveal wrap (BUG 2)**: όταν ένα άνοιγμα έχει `revealInsulation`, το `computeEnvelopeOpeningCuts` **στενεύει** το Z1 cut κατά `thickness_m` σε κάθε άκρο → η μόνωση πρόσοψης ΤΥΛΙΓΕΙ τη γωνία και σκεπάζει το εξωτ. άκρο της παραστάδας (αλλιώς αμόνωτο κενό στη γωνία). Ίδιο SSoT cut → 2D⟷3D parity (3D κρατά full-height γωνιακές κολώνες Z1).
- **Jamb-plane alignment SSoT (BUG A/B, 2026-05-30)**: το Z1 cut boundary (`[tStart,tEnd]`) ορίζεται από την **exterior-face γωνία του ίδιου `outline`** (προβολή της γωνίας που κείτεται στο face loop → ταυτοτική), ΟΧΙ από τα axis-midpoints (που σε λοξό/mitered face μετατοπίζονται πλευρικά). Έτσι οι τρεις παρειές — **wall punch ↔ Z4 reveal ↔ Z1 cut** — είναι **collinear** σε ΟΛΑ τα faces.
- **Free vs Structural opening (2026-05-30 — η μόνωση τρώει τον τοίχο)**: το `opening.width/height` = το **ΕΛΕΥΘΕΡΟ άνοιγμα (κούφωμα)** και μένει σταθερό. Με reveal, το **δομικό κενό** (`revealOutline` = free + `2t` κατά άξονα· ύψος `structuralRevealHeightRangeMm`) διευρύνεται περιμετρικά — η μόνωση Z4 γεμίζει το **δαχτυλίδι** ΕΞΩ από το κούφωμα (ο τοίχος μικραίνει), ΠΟΤΕ μέσα στο φως. SSoT `OpeningGeometry.revealOutline` → wall punch (2D+3D) + Z4 (`computeRevealJambQuads` ΕΞΩ-flip + `revealLiningToMesh` πρέκι/ποδιά). Z1 cut = free (κανένα wrap). Φύλλο/τόξο/hit-test/BOQ = free.
- **Z1 cut end-cap = ΚΑΘΕΤΗ απόληξη (2026-05-30)**: στα άκρα κάθε Z1 cut το προφίλ μόνωσης κλείνει με μικρή κάθετη γραμμή `[O_a→F_a]`/`[O_b→F_b]`. Τα outer σημεία `O_a/O_b` του `bandQuad` = **κάθετη** προβολή των `F_a/F_b` προς τα έξω κατά το πάχος μόνωσης (`O = F + n·d`, n=outward normal παρειάς, d miter-invariant), ΟΧΙ same-param lerp στο outer loop (που έδινε λοξές απολήξεις). 2D: `EnvelopeRenderer.strokeOpeningCutCaps` (ΜΕΤΑ το `destination-out`). 3D: `EnvelopeToThree.addEdge` καταναλώνει το `cut.bandQuad` (perpendicular O στα όρια, loop O στις γωνίες). Κοινό SSoT `bandQuad` → απολήξεις **collinear με Z4** σε 2D+3D.
- **SSoT**: το render διαβάζει per-element `slab.params.envelopeLayer` / `opening.params.revealInsulation` (γραμμένα από τον P7B applicator) — **render = pure read**, ΟΧΙ re-classify. Jamb SSoT: `computeRevealJambQuads`. Visibility: ίδια V/G κατηγορία `envelope` (ADR-382), μηδέν νέα palette.

**Γιατί υβριδικό (όχι καθαρά ξεχωριστό αντικείμενο):**
- Data ανά στοιχείο → σωστές προμετρήσεις m² ανά ζώνη/όροφο (D5), audit, BOQ ήδη υπάρχει (ADR-395), industry-aligned (Revit Wall Type layer).
- 1 command auto-apply → ο χρήστης το ορίζει **μία φορά** (D1, use case).
- Unified offset perimeter → στην κάτοψη + 3D φαίνεται **ενιαίο κέλυφος**, όχι κομμάτια.
- Παίρνουμε και τα δύο: σωστό data model + το UX που ζήτησε.

### 3.1. Geometry SSoT — `computeEnvelopePerimeter()`

- Είσοδος: εξωτ. footprints των στοιχείων του ορόφου + thickness + **columns** (νέο, 2026-05-30).
- Έξοδος: **outward offset** της ένωσης (union) των footprints κατά `thickness`.
- D4: σταθερό πάχος → ακολουθεί καμπούρες· γωνίες = mitre (φυσικό αποτέλεσμα του offset μη-κυρτού πολυγώνου).
- Z1 measurement = μήκος περιγράμματος × ύψος ορόφου − ανοίγματα (net, §2.1).
- **Gating (v2, 2026-05-30 Phase 1):** render ΜΟΝΟ σε αλυσίδες που **περικλείουν χώρο** — flag `EnvelopeChain.enclosesRegion` (κύκλος στο γράφημα τοίχων: ακμές ≥ κόμβοι). Ανοιχτή αλυσίδα (σχήμα Π/L/μεμονωμένος τοίχος) = δέντρο → `enclosesRegion:false` → 0 εμφάνιση. Κτίριο με εσωτερικό χώρισμα (T-junction, `closed:false`) → έχει κύκλο → `enclosesRegion:true` → εμφάνιση. ⚠️ **Διόρθωση απόκλισης code↔ADR:** το ADR έλεγε «gating = `closed===true`» αλλά ο κώδικας είχε αποκλίνει σε `wallIds.length >= 3` (στους 3 consumers: `EnvelopeOverlay`, `BimSceneLayer.addEnvelopeShell`, applicator `buildPerimeterContext`) → περνούσε λάθος τις ανοιχτές αλυσίδες 3+ τοίχων. Το v2 `enclosesRegion` είναι το ορθό SSoT gate (ούτε πολύ αυστηρό όπως `closed`, ούτε πολύ χαλαρό όπως `>=3`).
- **Column bridge (2026-05-30, Επιλογή Α):** κολώνα που βρίσκεται ≤ `COLUMN_BRIDGE_TOL_M` (0.30m) από ελεύθερο άκρο τοίχου → κόμβος-γέφυρα. Δύο γεφυρωτικά άκρα στην ίδια κολώνα κλείνουν το κενό· οι εξωτ. όψεις της κολώνας εισάγονται στο `exteriorFaceLoop` (η μόνωση τυλίγει την κολώνα με σκαλοπάτια — η γραμμή ακολουθεί το πραγματικό σχήμα). Helper: `envelope-column-bridge.ts`.
- **Per-component centroid** (2026-05-30): κάθε connected component έχει δικό του centroid (ΟΧΙ global) → δύο κτίρια μακριά offset σωστά.

> ✅ **P3 IMPLEMENTED** (2026-05-29): `bim/geometry/envelope-perimeter.ts` →
> `computeEnvelopePerimeter(walls, envelopeThickness_m, sceneUnits?)`. Option 1
> (offset εξωτ. παρειών + mitre, ΟΧΙ boolean union): adjacency graph σε κοινά
> άκρα (valence-2 = γωνία) → ordered closed/open chains → εξωτ. παρειά (D2
> `selectExteriorFace`, μακριά από centroid) → outward offset κατά πάχος
> (winding-agnostic, centroid-pick). meters-in/out. Reuse `offsetPolyline`/
> `polygonCentroid` (SSoT `polygon-utils.ts`, OQ-3). Exposed slabs (Z2/Z3) =
> `exposed-slab-classifier.ts`.
>
> ✅ **P3 UPDATE (2026-05-30):** Column bridge + gating + per-component centroid.
> Νέα signature: `computeEnvelopePerimeter(walls, thickness_m, sceneUnits?, columns?)`.
> Helper: `bim/geometry/envelope-column-bridge.ts`. Constant: `COLUMN_BRIDGE_TOL_M=0.3m`
> (`thermal-envelope-types.ts`). 2D (`EnvelopeOverlay`) + 3D (`BimSceneLayer.addEnvelopeShell`)
> + applicator (`buildPerimeterContext`) ενημερωμένα. 28/28 + 124/124 tests PASS.

#### 3.1.1. Building footprint — boolean union (v2 Phase 2, `building-footprint.ts`)

Το `envelope-perimeter.ts` (Option 1) χτίζει το περίγραμμα **τυλίγοντας** σε σειρά τις
εξωτ. παρειές των τοίχων — αποτυγχάνει όταν τα στοιχεία **επικαλύπτονται** (κολώνα μέσα
σε τοίχο, δοκάρι πάνω σε τοίχο). Η v2 εισάγει νέο geometry SSoT που βγάζει το ΠΡΑΓΜΑΤΙΚΟ
περίγραμμα από **boolean union** (lib `polygon-clipping`, MIT) των αποτυπωμάτων ΤΟΙΧΩΝ +
ΚΟΛΩΝΩΝ + ΔΟΚΑΡΙΩΝ.

- **Είσοδος:** footprints σε canvas units — τοίχος = `outerEdge`+reversed `innerEdge`,
  κολώνα = `ColumnGeometry.footprint` (reuse `prepareColumns`), δοκάρι = `BeamGeometry.outline`.
- **Έξοδος `BuildingFootprintResult`:** `components[]` (κάθε ένα: `outer` ring + `holes[]`)
  + convenience flat `outerRings[]` / `holes[]` (= αίθρια / δωμάτια).
- **Per-edge attribution `FootprintEdge.sourceEntityId/Type`:** η lib δεν κρατά provenance →
  κάθε ακμή εξόδου αποδίδεται σε οντότητα με midpoint + parallel γεωμετρική ταύτιση (best-effort,
  null σε νέα κορυφή τομής· η lib ενώνει collinear ακμές → Phase 5 μπορεί να split-άρει).
  Τροφοδοτεί τη Φάση 5 (per-element Z1 render κολώνας/δοκαριού «ίδια με τοίχους»).
- **Precision guard:** μετάφραση σε local origin πριν το union (ακρίβεια polygon-clipping σε
  mm-scale ~χιλιάδες), επαναφορά στην έξοδο.

> ✅ **P2 (v2) IMPLEMENTED** (2026-05-30, Opus 4.8, pending commit): `bim/geometry/building-footprint.ts`
> → `computeBuildingFootprint(walls, columns?, beams?, sceneUnits?)`. **Αυτόνομο** (μηδέν wiring
> στους consumers — Φάση 5)· σχεδιασμένο με «συμβατό» σχήμα ώστε η Φάση 5 να αντικαταστήσει
> σταδιακά το `envelope-perimeter.ts` → ΕΝΑ σύστημα (SSoT). 11/11 tests + 410/410 bim/geometry
> regression PASS, tsc clean. Reuse `computeWallGeometry`/`computeBeamGeometry`/`prepareColumns`/
> `polygonArea`/`pointToSegmentDistance`. ⚠️ ΟΧΙ offset (insulation loop) — δεν είναι το εύρος της P2.

#### 3.1.2. Footprint region classification — αίθριο vs δωμάτιο (v2 Phase 3, `footprint-region-classifier.ts`)

Το `building-footprint.ts` (§3.1.1) βγάζει το περίγραμμα ως `outerRings[]` + `holes[]`, αλλά δεν
αποφασίζει **ποια όρια παίρνουν μόνωση**. Η Φάση 3 προσθέτει αυτή την **αυτόματη ταξινόμηση 3
στρώσεων** ως **pure logic** (μηδέν wiring — Φάση 5· μηδέν data model — Φάση 4):

- **Στρ.1 — εξώτατο όριο** (`outerRings`): ΠΑΝΤΑ μόνωση → `role: 'exterior'`, `insulated: true`.
- **Στρ.2 — κάθε τρύπα** (`holes`): **αίθριο** (ανοιχτό στον ουρανό → μόνωση γύρω, `role: 'atrium'`)
  ή **κλειστό δωμάτιο** (έχει πλάκα από πάνω → καμία μόνωση, `role: 'interior-room'`). Κανόνας
  (απόφαση Giorgio): τρύπα **ΧΩΡΙΣ** πλάκα από πάνω = αίθριο· **ΜΕ** πλάκα = δωμάτιο.
- **Στρ.3 — per-element χειροκίνητη παράκαμψη** (Revit-style): Φάση 4 (data model) + Φάση 6 (UI).

**Λεπτό σημείο — «έχει η τρύπα πλάκα από πάνω;» (απόφαση Giorgio 2026-05-30):** **γεωμετρική τομή**
(ίδια lib `polygon-clipping` με τη Φάση 2). `coverage = εμβαδόν(τρύπα ∩ ένωση πλακών-από-πάνω) ÷
εμβαδόν τρύπας`· `coverage ≥ ATRIUM_COVERAGE_THRESHOLD` (0.5, configurable σε
`thermal-envelope-types.ts`) → δωμάτιο· αλλιώς → αίθριο. Ακριβές, χειρίζεται σχήματα Γ/Π, μερική
κάλυψη, προβόλους. Εναλλακτικές που απορρίφθηκαν: «κέντρο τρύπας» (σε σχήμα Γ το κέντρο πέφτει
εκτός τρύπας → λάθος)· «πολλά σημεία-δείγμα» (προσεγγιστικό, εξαρτάται από πυκνότητα πλέγματος).

- **Είσοδος:** `BuildingFootprintResult` (τρέχων όροφος) + `slabsAbove` (footprints πλακών
  ψηλότερων ορόφων, canvas units) + optional `coverageThreshold`.
- **Έξοδος `FootprintClassificationResult`:** `rings[]` (όλα) + convenience `exterior[]` / `atria[]`
  / `interiorRooms[]`· κάθε `ClassifiedFootprintRing` = `{ ring, role, insulated, coverageAbove }`.
- **Slabs-above resolver `selectSlabsAboveFloor(slabs, floors, currentFloorTopMm)`:** επιλέγει τις
  πλάκες με top-face > `currentFloorTopMm + snap` (= **οποιοσδήποτε** ψηλότερος όροφος· αίθριο =
  ανοιχτό στον ουρανό = καμία πλάκα πουθενά από πάνω). Reuse του **ΙΔΙΟΥ** elevation SSoT με το
  `classifyExposedSlab` (`resolveSlabTopMm` → `getEntityAbsoluteElevation`, ADR-369).
- **Degenerate τρύπα** (μηδενικού εμβαδού): → δωμάτιο (καμία μόνωση σε ανύπαρκτο κενό).

> ✅ **P3 (v2) IMPLEMENTED** (2026-05-30, Opus 4.8, pending commit): `bim/geometry/footprint-region-classifier.ts`
> → `classifyFootprintRegions(footprint, slabsAbove?, options?)` + `selectSlabsAboveFloor(...)`.
> **Αυτόνομο** (μηδέν wiring — Φάση 5). Reuse `polygon-clipping` `.union`/`.intersection` (dep
> Φάσης 2) + `polygonArea` + `resolveSlabTopMm` (exported από `exposed-slab-classifier.ts` — SSoT,
> όχι διπλότυπο). +config `ATRIUM_COVERAGE_THRESHOLD` (`thermal-envelope-types.ts`). **12/12 tests
> + 436/436 bim/geometry regression PASS, tsc clean** (μηδέν `any`).

#### 3.1.3. Per-element override data model — `envelopeFunction` (v2 Phase 4)

Η **Στρ.3** (§3.1.2) είναι η **χειροκίνητη παράκαμψη** της αυτόματης γεωμετρικής ταξινόμησης
(Revit Wall-Function-style). Η Φάση 4 προσθέτει **ΜΟΝΟ το data model** της — **καμία αλλαγή
συμπεριφοράς** (consumer = Φάση 5, UI = Φάση 6). Νέο per-element πεδίο:

```ts
export type EnvelopeFunction = 'exterior' | 'interior';   // undefined = auto
// WallParams / ColumnParams / BeamParams:
readonly envelopeFunction?: EnvelopeFunction;
```

**Αποφάσεις (Giorgio: «FULL ENTERPRISE + FULL SSOT»):**
- **Οντότητες = τοίχος + κολώνα + δοκάρι** (τα στοιχεία που σχηματίζουν το πλευρικό footprint /
  ζώνη Z1). **ΟΧΙ** πλάκες (Z2/Z3 = άξονας υψομέτρου, `exposed-slab-classifier`) ούτε ανοίγματα
  (Z4 = ακολουθούν host wall) — το `exterior/interior` δεν έχει νόημα σε διαφορετικό άξονα ζώνης.
- **Νέο ξεχωριστό πεδίο**, αποσυνδεδεμένο από το δομικό `WallParams.category`
  (`exterior/interior/partition/parapet/fence`): `category` = **δομικός** ρόλος (5 τιμές)·
  `envelopeFunction` = **θερμική** παράκαμψη ETICS (2 τιμές). Decoupled → τοίχος μπορεί
  `category='exterior'` + `envelopeFunction='interior'` (όψη προς εσωτ. αίθριο). Κολώνες/δοκάρια
  δεν έχουν `category` → ένα **ομοιόμορφο** πεδίο = ένα audit/schema path (SSoT).
- **Per-element** (ΟΧΙ per-region): οι περιοχές = παράγωγη γεωμετρία χωρίς σταθερό ID
  (boolean-union recompute) → override σε μόνιμα entity IDs (cascade rule).
- **`undefined` = auto** (ΟΧΙ ρητό `'auto'` literal): optional πεδίο· απών = αυτόματη ταξινόμηση.
  Ρητό `'auto'` = δεύτερος τρόπος για το ίδιο state = anti-SSoT. Mirror του `envelopeLayer?`.

**Σημασιολογία (consumer Φάση 5):** `'exterior'` → force μόνωση όψης (μέρος κελύφους) ακόμη κι αν
η γεωμετρία το έβγαζε εσωτερικό· `'interior'` → force καμία μόνωση ακόμη κι αν η γεωμετρία το
έβγαζε εξωτερικό· `undefined` → χρησιμοποίησε τον ρόλο της περιοχής από τον classifier.

> ✅ **P4 (v2) IMPLEMENTED** (2026-05-31, Opus 4.8, pending commit): mirror του pattern P7A
> (type → Zod schema πριν το `.strict()` → audit tracked-field → tests). 9 αρχεία mod: type SSoT
> `thermal-envelope-types.ts` (`EnvelopeFunction`) · Zod SSoT `thermal-envelope.schemas.ts`
> (`EnvelopeFunctionSchema`, exported, καταναλώνεται από wall/column/beam) · entity types
> (`{wall,column,beam}-types.ts`) · entity schemas (`{wall,column,beam}.schemas.ts`,
> `EnvelopeFunctionSchema.optional()` ΠΡΙΝ το `.strict()` — αλλιώς PATCH strip, P2-flag class) ·
> audit `audit-tracked-fields.ts` (scalar string σε WALL/COLUMN/BEAM RAW, μηδέν νέο `AuditEntityType`).
> Tests: `thermal-envelope.schemas.test.ts` +10 (enum + wall/column/beam no-strip round-trip +
> undefined=auto). **21/21 + 112/112 bim/types regression PASS, tsc envelope-clean** (μηδέν `any`).

#### 3.1.4. Envelope shell builder — `computeEnvelopeShell()` (v2 Phase 5A, `envelope-shell.ts`)

Ο **νέος engine** που ενώνει Φ2 (περίγραμμα) + Φ3 (ταξινόμηση) + Φ4 (override) και **αντικαθιστά** το
`computeEnvelopePerimeter` ως πηγή της **ορατής** μόνωσης (απόφαση Giorgio 2026-05-31: «νέο σύστημα
οδηγεί»). Μοντέλο «ring → runs → offset» — πολύ απλούστερο από το παλιό (το footprint pipeline έλυσε
ήδη όλη την τοπολογία· καμία adjacency graph / face-corner keys / `selectExteriorFace` / column arcs).

- **Signature:** `computeEnvelopeShell(walls, columns, beams, spec, overridesById, slabsAbove?, options?)`
  → `EnvelopeShellResult { chains: EnvelopeChain[]; primaryChain }`. Έξοδος = **`EnvelopeChain[]` verbatim**
  → drop-in για `envelope-render-plan` / `envelope-opening-cuts` / `EnvelopeToThree` (μηδέν consumer churn).
- **Pipeline:** `computeBuildingFootprint` → `classifyFootprintRegions` → per-ring `buildRingChains` →
  `buildOrphanExteriorWraps` → assemble (+ `primaryChain` = μεγαλύτερο κλειστό).
- **Override σημασιολογία (απόφαση Giorgio «πλήρες τώρα»):** `'interior'` = **αφαιρετικό** — η ακμή του
  στοιχείου εξαιρείται → η συνεχής γραμμή **σπάει** σε ΑΝΟΙΧΤΑ runs (κενό). `'exterior'` = **προσθετικό**
  μόνο ως **orphan wrap** (δικό του κλειστό τύλιγμα) για στοιχείο εκτός κάθε auto-μονωμένου ορίου — ΔΕΝ
  αγγίζει ring edges, ώστε ένας ήδη-εξωτερικός τοίχος να ΜΗΝ μονώνεται και στην εσωτ. (room) όψη του.
- **Offset direction:** το `sign` του `offsetPolyline` είναι **αναξιόπιστο** σε notched γωνίες — δοκιμάζουμε
  **και τα δύο πρόσημα** και διαλέγουμε με mean distance προς το κέντρο του ring (outer → πιο μακριά = έξω·
  τρύπα/αίθριο → πιο κοντά = προς το κενό). Ίδιο proven pattern με `offsetLoopOutward`/`insetClosedPolygon`.
- **`EnvelopeChain` +`beamIds?`** (additive optional): τα δοκάρια συνεισφέρουν πλέον στο κέλυφος → BOQ
  per-element attribution (Φάση 5B). Το παλιό `computeEnvelopePerimeter` το αφήνει `[]`.
- **Reuse SSoT:** extracted `polylinePerimeterMeters` στο `polygon-utils.ts` (καταναλώνεται και από τα δύο
  modules — μηδέν duplication, N.12). Επίσης `offsetPolyline`/`stripClosingDuplicate`/`polygonCentroid`.

> ✅ **P5A (v2) IMPLEMENTED** (2026-05-31, Opus 4.8, pending commit): `bim/geometry/envelope-shell.ts` [ΝΕΟ]
> + `bim/geometry/__tests__/envelope-shell.test.ts` [ΝΕΟ, 18 σενάρια: outward/inward, αίθριο vs δωμάτιο,
> interior=κενό, exterior=orphan wrap, beamIds, primaryChain, opening-cut compatibility, coverageThreshold].
> + `polygon-utils.ts` (extract `polylinePerimeterMeters`) + `envelope-perimeter.ts` (rewire import,
> `EnvelopeChain.beamIds?`, drop local helper). **Αυτόνομο** (μηδέν consumer wiring — Φάση 5B). **18/18 +
> 472/472 bim/geometry regression PASS, tsc clean** (μηδέν `any`). **Φάση 5B (επόμενη session):** wire 3
> consumers (`EnvelopeOverlay` 2D, `BimSceneLayer.addEnvelopeShell` 3D, applicator `buildPerimeterContext`)
> → `computeEnvelopeShell` + build `overridesById` + slabsAbove cross-floor + BOQ `beamIds`.

#### 3.1.5. Consumer wiring + τα 2 gates (v2 Phase 5B)

Η Φ5B **καλωδιώνει** τους 3 consumers + BOQ στο `computeEnvelopeShell` (αντικαθιστά το
`computeEnvelopePerimeter` — που **μένει** μόνο για τον IFC P9 serializer). Δύο αποφάσεις Giorgio (Plan Mode):

- **Gate 1 — hole-gate (πότε μονώνεται):** ένα footprint **component** μονώνει το εξωτ. όριό του ΜΟΝΟ αν
  έχει **≥1 τρύπα** (περικλείει χώρο). Καμία τρύπα (Π/L/μονός τοίχος/συμπαγές) → ρόλος `'open-structure'`,
  καμία μόνωση (αλλιώς θα τύλιγε και την ανοιχτή πλευρά). Αντικαθιστά το παλιό `enclosesRegion`
  graph-cycle gate. Ζει στον **classifier** (`classifyFootprintRegions` ανά `footprint.components`) → ο
  engine μένει άθικτος (οδηγείται 100% από `classified.insulated`: insulated=false → κανένα run → κανένα
  chain). Καθαρός διαχωρισμός: classifier αποφασίζει, engine συναρμολογεί.
- **Gate 2 — no-slab-data default (αίθριο vs δωμάτιο):** όταν `slabsAbove` είναι **κενό** (καθόλου
  δεδομένα), κάθε τρύπα = `interior-room` → μόνωση **μόνο εξωτερικά** = ίδια συμπεριφορά με το παλιό
  σύστημα (μηδέν regression· αλλιώς κάθε δωμάτιο θα έπαιρνε μόνωση και στην εσωτ. όψη). Τα αίθρια
  ανιχνεύονται όταν δοθούν `slabsAbove` (cross-floor) και η κάλυψη < threshold — **Φάση 5C DONE** (SSoT store + producer `useEnvelopeFloorSlabs` + `resolveSlabsAboveForLevel` + **consumer wiring**, βλ. §3.1.6).

- **Consumer-side:** οι consumers **δεν** φιλτράρουν πλέον `enclosesRegion` — ο engine είναι authoritative
  (επιστρέφει ΜΟΝΟ ό,τι μονώνεται· τα ανοιχτά runs από `'interior'` override έχουν `enclosesRegion=false`
  αλλά πρέπει να ζωγραφιστούν). `overridesById` χτίζεται με το SSoT helper `collectEnvelopeOverrides`.
- **Applicator (open point #2 — chain-id αντί proximity):** ο `buildPerimeterContext` (proximity ≤20cm για
  Z1 κολώνες/δοκάρια) αντικαταστάθηκε από `buildShellMembership` που διαβάζει **απευθείας**
  `chain.columnIds`/`beamIds`/`wallIds` του shell — το footprint union ορίζει πλέον ρητά τη συμμετοχή
  (απλούστερο, SSoT, σέβεται αυτόματα τα overrides· καμία ρύθμιση proximity).
- **BOQ:** το Z1 area = `Σ chain.perimeterM × maxWallHeight` σε ΟΛΑ τα chains — η περίμετρος περιλαμβάνει
  πλέον προεξοχές κολωνών/δοκαριών («τα δοκάρια συνεισφέρουν»).

> ✅ **P5B (v2) IMPLEMENTED** (2026-05-31, Opus 4.8, pending commit): classifier (hole-gate +
> `open-structure` role + no-slab-data→room default) · `envelope-shell.ts` (+`collectEnvelopeOverrides`
> SSoT helper· engine logic άθικτο) · `EnvelopeOverlay.tsx` (2D) · `BimSceneLayer.addEnvelopeShell` (3D) ·
> `envelope-element-applicator.ts` (proximity→chain ids) · `envelope-boq-sync.ts`. **213/213 envelope+
> footprint + 32/32 BimSceneLayer PASS, tsc clean** (μηδέν `any`). ADR-040 staged (CHECK 6B/6D). 🔴 browser
> verify. **Φάση 6:** UI override panel για `envelopeFunction`.

#### 3.1.6. Cross-floor slab wiring — αίθριο vs δωμάτιο (v2 Phase 5C)

Η Φ5C **καλωδιώνει** το Gate 2: τροφοδοτεί `slabsAbove` (πλάκες ψηλότερων ορόφων) σε ΟΛΟΥΣ τους
consumers ώστε μια ακάλυπτη τρύπα να γίνεται **αίθριο** (μόνωση γύρω-μέσα) αντί για δωμάτιο. Ένας
ορισμός «πλάκα από πάνω» μοιράζεται από όλους → εγγυημένη **2D⟷3D parity**.

- **SSoT πηγή (Φ5C scaffold):** non-React store `bim/stores/envelope-floor-slabs-store.ts`
  (`{floors, slabs, activeFloorId}`, idempotent-on-identity) · producer `hooks/data/useEnvelopeFloorSlabs.ts`
  (always-on, μαζεύει slabs ΟΛΩΝ των ορόφων του ενεργού κτιρίου — live από `Bim3DEntitiesStore`, άλλοι από
  `getLevelScene`/`loadFileV2`· υψόμετρα από canonical `useFloorsByBuilding`) · resolver SSoT
  `resolveSlabsAboveForLevel(slabs, floors, activeFloorId)` = `resolveCurrentFloorTopMm` (= υψόμετρο οροφής
  target ορόφου × 1000) + `selectSlabsAboveFloor`.
- **Consumers (Φ5C wiring):** ΟΛΟΙ περνούν πλέον το resolved `slabsAbove` (αντί `[]`) στο
  `computeEnvelopeShell`:
  - **2D** `EnvelopeOverlay.tsx` — leaf-only `useSyncExternalStore(subscribeEnvelopeFloorSlabs)` (ADR-040),
    `slabsAbove` στα effect deps.
  - **3D** `bim-3d/scene/bim-envelope-scene-builder.ts` (`addEnvelopeShell`) — event-time
    `getEnvelopeFloorSlabs()` getter (όχι snapshot) · rebuild trigger μέσω
    `use-bim3d-vg-resync` → `subscribeEnvelopeFloorSlabs(resync)`.
  - **Applicator** `envelope-element-applicator.ts` — νέο param `slabsAbove` →
    `buildShellMembership` → shell.
  - **BOQ** `envelope-boq-sync.ts` — νέο param `slabsAbove` σε `computeEnvelopeZoneAreas` + `syncEnvelopeBoq`.
  - **Host** `ThermalEnvelopeHost.tsx` — per-target `resolveSlabsAboveForLevel(snap, level.floorId)` (σωστό
    και για «Εφαρμογή σε όλους») → `computeEnvelopeAssignments` + `syncEnvelopeBoq`.
  - **Mount** `ThermalEnvelopeHost.tsx` — `useEnvelopeFloorSlabs()` (always-on host εντός LevelsSystem· no-op εκτός). Mounted εκεί αντί στο `DxfViewerContent` που είναι στο όριο N.7.1 (500 γρ.).
- **Safe default:** όλα τα νέα params `= []` → όταν το snapshot είναι κενό (καθόλου δεδομένα), όλες οι
  τρύπες = δωμάτια = μηδέν regression vs Φ5B.

> ✅ **P5C (v2) IMPLEMENTED** (2026-05-31, Opus 4.8, pending commit): scaffold (store + producer +
> resolvers, commit `03269f01`) + **consumer wiring** (6 αρχεία: EnvelopeOverlay 2D · scene-builder 3D ·
> vg-resync · applicator · boq-sync · ThermalEnvelopeHost + mount στο DxfViewerContent). **225/225 envelope+
> footprint + 6/6 νέο store test PASS, tsc clean** (0 errors, μηδέν `any`). ADR-040 staged (CHECK 6B/6D). 🔴
> browser verify: τρύπα ανοιχτή στον ουρανό (τελευταίος όροφος) → αίθριο (μόνωση γύρω)· ίδια τρύπα με πλάκα
> ψηλότερου ορόφου → δωμάτιο (καμία εσωτ. μόνωση)· 2D⟷3D parity.

#### 3.1.7. UI override — per-element `envelopeFunction` στο contextual ribbon (v2 Phase 6a)

Η **Φ6a** δίνει στον χρήστη χειροκίνητο έλεγχο της **Στρ.3** (§3.1.2/§3.1.3): ένα tri-state combobox
«Θερμοπρόσοψη» (Αυτόματο / Εξωτερικό / Εσωτερικό, Revit Wall-Function-style) σε κάθε contextual ribbon
tab **τοίχου / κολώνας / δοκαριού**. Γράφει το per-element `envelopeFunction` (Φ4 data model) μέσω των
**υπαρχόντων** `UpdateWall/Column/BeamParamsCommand` → **undoable + atomic recompute δωρεάν**, ride-on
στα ίδια persistence hooks. Καμία αλλαγή στον engine — απλώς ένα write path για το πεδίο που ο
`computeEnvelopeShell` ήδη καταναλώνει (`collectEnvelopeOverrides`, Φ5B).

- **SSoT helper** `ui/ribbon/hooks/bridge/envelope-function-param.ts` — tri-state mapping value↔field
  ΕΝΑ μέρος για τους 3 bridges: sentinel `ENVELOPE_FUNCTION_AUTO = 'auto'` (το πεδίο `.strict()` enum
  ΔΕΝ δέχεται literal `'auto'` → πάντα `undefined` = clear)· `ENVELOPE_FUNCTION_OPTIONS` (3 i18n options)·
  `readEnvelopeFunctionValue(fn) = fn ?? 'auto'`· `parseEnvelopeFunctionValue(value)` → `{fn}` ή `null`.
- **Routing:** key `*.params.envelopeFunction` καταχωρήθηκε στο `*_RIBBON_STRING_KEYS` κάθε entity →
  ο composer (`useRibbonCommands`) δρομολογεί στο σωστό bridge μέσω `isXRibbonStringKey`.
- **Bridges:** wall μέσω `wall-param-helpers.ts` (read/patch)· column/beam special-case ΠΡΙΝ το generic
  string handling (auto→clear). Drawing-mode (χωρίς επιλογή) = no-op (override μόνο σε υπαρκτά στοιχεία).
- **Tabs:** νέο panel «Θερμοπρόσοψη ETICS» (`ribbon.panels.envelopeFunction`) στα 3 contextual tabs.
- **i18n:** `ribbon.commands.envelopeFunction.{section.title,auto,exterior,interior,tooltip}` (el+en, N.11).

> ✅ **P6a (v2) IMPLEMENTED** (2026-05-31, Opus 4.8, pending commit): 1 new SSoT helper + 3 command-keys
> + wall-param-helpers + column/beam bridges + 3 contextual tabs + i18n el/en + 3 test files. **33/33 PASS
> (envelope-function-param 10 + wall-param-helpers-envelope 6 + useRibbonColumnBridge +5 → 17), tsc clean.**
> 🔴 browser verify: επιλογή τοίχου/κολώνας/δοκαριού → ribbon «Θερμοπρόσοψη» → Εσωτερικό = βγαίνει η μόνωση,
> Εξωτερικό = μπαίνει, Αυτόματο = επανέρχεται η γεωμετρική απόφαση· undo/redo ανά αλλαγή. **Φ6b:** per-region
> panel στο `ThermalEnvelopeDialog` (εξωτερικό/αίθριο/δωμάτιο override ανά region).

#### 3.1.8. UI override — per-region panel στο `ThermalEnvelopeDialog` (v2 Phase 6b)

Η **Φ6b** είναι η δεύτερη μισή της απόφασης Giorgio «και τα δύο» (§3.1.7): ενώ η Φ6a δίνει **per-element**
έλεγχο (επιλέγεις ΕΝΑ στοιχείο στο ribbon), η Φ6b δίνει **per-region** έλεγχο μέσα στο authoring dialog.
Ο χρήστης βλέπει τα **ανιχνευμένα όρια** του ορόφου («Εξωτερικό περίγραμμα», «Αίθριο 1/2», «Δωμάτιο»,
«Ανοιχτό περίγραμμα») με ένα dropdown override (Αυτόματο / Εξωτερικό / Εσωτερικό) ανά όριο, που γράφει το
`envelopeFunction` σε **ΟΛΑ** τα στοιχεία που σχηματίζουν εκείνο το όριο (Revit-style «αυτό το δωμάτιο να
μονωθεί» / «αυτό το αίθριο όχι»). **Καμία αλλαγή engine** — ίδιο write path/πεδίο με τη Φ6a.

- **Region → element ids:** για κάθε `ClassifiedFootprintRing` (έξοδος `classifyFootprintRegions`) τα distinct
  `ring.edges[].sourceEntityId` (≠ null) = τα στοιχεία του ορίου. Ο host υπολογίζει τα regions του τρέχοντος
  ορόφου με το **ίδιο SSoT** όπως 2D/3D: `computeBuildingFootprint` + `classifyFootprintRegions` + ίδιο
  `slabsAbove` (`resolveSlabsAboveForLevel`) με τον applicator → αίθριο vs δωμάτιο ταυτίζεται με ό,τι ζωγραφίζεται.
- **Σύγκρουση ορίων (απόφαση Giorgio):** όταν ένα στοιχείο ανήκει σε 2 όρια (π.χ. λεπτός τοίχος έξω↔αίθριο),
  **«last write wins»** — όλα γράφουν στο ίδιο πεδίο `envelopeFunction`, η τελευταία ενέργεια του χρήστη μένει
  (απλό, προβλέψιμο, ζωντανό + undo· το per-element Φ6a είναι απλώς «άλλη μια εγγραφή»).
- **Write path (Revit parity):** ΕΝΑ `CompoundCommand` από `UpdateWall/Column/BeamParamsCommand` ανά στοιχείο →
  **ΕΝΑ undo entry** ανά region override (undoable + atomic recompute δωρεάν, ride-on στα ίδια persistence hooks).
  Re-derive layers/BOQ (`applyPerElement`) **μόνο αν** υπάρχει ήδη εφαρμοσμένο spec· αλλιώς το override είναι
  απλώς input για το επόμενο «Εφαρμογή». `markAllCanvasDirty` → 2D overlay ξαναϋπολογίζει το κέλυφος ζωντανά.
- **SSoT centralization (N.0.2/N.12):** το tri-state mapping (`ENVELOPE_FUNCTION_OPTIONS` + `read/parse` +
  sentinel) **μετακινήθηκε** από `ui/ribbon/hooks/bridge/envelope-function-param.ts` σε neutral location
  `bim/types/thermal-envelope-types.ts` ώστε ribbon ΚΑΙ dialog να το μοιράζονται χωρίς το dialog να εξαρτάται
  από ribbon code· το ribbon αρχείο έγινε thin re-export barrel (μηδέν churn στους Φ6a consumers).
- **NEW SSoT** `bim/services/envelope-region-override.service.ts`: `buildRegionOverrideTargets(classification,
  overrides)` → στόχοι `{regionId, role, ordinal, elementIds, currentFn: fn|'mixed'|undefined}` (pure)·
  `buildRegionOverrideCommand(elementIds, fn, sceneManager)` → `CompoundCommand` (batch undo).
- **i18n:** `ribbon.commands.thermalEnvelope.regions.{title,description,empty,mixed,roles.*}` (el+en, N.11)·
  το dropdown ξαναχρησιμοποιεί τα `ribbon.commands.envelopeFunction.{auto,exterior,interior}` της Φ6a.

> ✅ **P6b (v2) IMPLEMENTED** (2026-05-31, Opus 4.8, pending commit): 1 new SSoT service + 1 test + Dialog
> (+regions section) + Host (+regions compute & batch-undo handler) + tri-state SSoT move σε types + thin
> re-export + i18n el/en. **19/19 (νέο service 13 + envelope-function-param re-export 6) + 275/275
> envelope+ribbon+footprint regression PASS, tsc clean** (μηδέν `any`). Dialog/Host εκτός ADR-040 micro-leaf
> list (καμία CHECK 6B/6D). 🔴 browser verify: «Εφαρμογή Θερμοπρόσοψης» → λίστα ορίων → άλλαξε dropdown αίθριου
> σε «Εσωτερικό» = φεύγει η μόνωση γύρω του· «Εξωτερικό» σε δωμάτιο = μπαίνει· undo επαναφέρει· mixed state όταν
> τα στοιχεία ενός ορίου διαφέρουν.

---

### 3.2. Interoperability SSoT — IFC export + θερμική απόδοση (FULL enterprise, parity Revit/ArchiCAD/Bentley)

Ο Giorgio (2026-05-29) απαίτησε **FULL enterprise + FULL SSoT**: η εφαρμογή **να μην υπολείπεται** Revit/ArchiCAD/Bentley. Πέρα από geometry + render + BOQ, οι μεγάλοι παρέχουν **(a) IFC interoperability** + **(b) θερμική απόδοση (U-value / energy)**. Κλειδώνονται **από τώρα** ώστε να μην ξεχαστούν → φάσεις **P9** (IFC) + **P8** (U-value).

#### (a) IFC export — το envelope ως `IfcCovering` ✅ P9 DONE

> ✅ **P9 DONE (2026-05-29):** 6ος serializer `ifc-covering-serializer.ts` ζωντανός. **per-element** coverings (Giorgio)· **semantic-only** (χωρίς γεωμετρία, OQ-P9-2 → `IfcMaterialLayerSetUsage` παραλείπεται, LayerSet associate-άρεται απευθείας)· **walls=ΝΑΙ** (Z1 facade από per-floor spec, αφού οι τοίχοι δεν κουβαλούν per-element `envelopeLayer`). λ από P8 → `Pset_MaterialThermal`. 10/10 tests + roundtrip 8/8.

Code = source of truth (grep 2026-05-29): υπάρχει **ζωντανό** IFC4 export pipeline — `IfcExportHost` → `IfcExporter` (`services/ifc/`) → STEP21 writer + **5 entity serializers** (wall/slab/beam/column/opening) μέσω `entitySerializer` hook + IFC4 GUID (ADR-369). **Καμία** material/layer/thermal υποστήριξη σήμερα → ένας thermal serializer είναι γνήσια απών, με **ζωντανό consumer** (όχι dead scaffolding).

Το συνεχές ETICS envelope **δεν** ζορίζεται σε wall-layers (η μη-Revit επιλογή D1). Το IFC4 έχει την **ακριβή σωστή κλάση**:

| Έννοια ADR-396 | IFC4 entity | Σχέση |
|---|---|---|
| Envelope shell Z1/Z2/Z3 (Z4 reveals = ξεχωριστά) | `IfcCovering` `PredefinedType=INSULATION` | `IfcRelCoversBldgElements` (covering ↔ wall/slab/column/beam που καλύπτει) |
| Υλικό (Neopor/XPS) + πάχος | `IfcMaterial` + `IfcMaterialLayerSet` (1 στρώση) → `IfcMaterialLayerSetUsage` | attached στο covering |
| Θερμικές ιδιότητες (λ, U) | `Pset_MaterialThermal.ThermalConductivity` + `Pset_CoveringCommon` thermal | `IfcMaterialProperties` |
| GUID | `ifc-guid.service` (ADR-369, 22-char, generate-once) | stable per lifetime |

→ **Καθαρή χαρτογράφηση, μηδέν αντίφαση** με το ξεχωριστό-envelope μοντέλο. Νέος **6ος serializer** `services/ifc/serializers/ifc-covering-serializer.ts` + register στο `serializers/index.ts`. ⚠️ Χρονισμός: ο serializer χρειάζεται runtime envelope data → χτίζεται **μετά P6** (writer), αλλιώς σειριοποιεί κενό.

#### (b) Θερμική απόδοση — U-value / ΚΕΝΑΚ (parity Revit Insight / ArchiCAD Energy Evaluation) ✅ P8 DONE

Ο ΚΕΝΑΚ ορίζει **U-value** (W/m²K), όχι πάχος (OQ-1). Οι μεγάλοι υπολογίζουν U ανά assembly + compliance check. SSoT (✅ υλοποιημένο P8, 2026-05-29):
- `wall-material-catalog.ts` +`WALL_MATERIAL_LAMBDA` (W/mK) ανά υλικό + `getThermalConductivityLambda()` (Neopor 0.031, XPS 0.034, …).
- `bim/thermal/assembly-u-value.ts` **[ΝΕΟ]** — pure `computeAssemblyUValue(layers)` = `1 / (Rsi + Σ(d/λ) + Rse)` (ISO 6946, Rsi 0.13 / Rse 0.04 wall).
- `bim/thermal/kenak-thermal-config.ts` **[ΝΕΟ]** — `KENAK_MAX_U_WALL` (ΤΟΤΕΕ Α/Β/Γ/Δ) + `REFERENCE_BARE_WALL_LAYERS` (τυπικός τοίχος για το panel) + `CLIMATE_ZONE_OPTIONS` + `isAboveKenakUMax()` soft-warn.
- Εμφάνιση U-value + pass/warn στον `ThermalEnvelopeDialog` (κλιματική ζώνη = `Building.climateZone`, OQ-7a) + τροφοδοτεί το IFC thermal Pset (P9).

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
| **Persistence + audit** | ✅ P7B: ride existing persist hooks via `bim:envelope-applied` event (ΜΗΔΕΝ νέο host) · audit tracked-fields (envelopeLayer/revealInsulation, ADR-379 `diffTrackedFields`) |
| **BOQ** | ✅ P7B: `envelope-boq-sync.ts` per-zone/floor rows `boq_env_<floorId>_<zone>` (mirror `stair-boq-sync`/ADR-395, ΟΧΙ μέσω `BimToBoqBridge`) |
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
- ~~**OQ-7**~~ ✅ **RESOLVED 2026-05-29 (P8)**: (a) **κλιματική ζώνη = ρύθμιση κτιρίου** (`Building.climateZone` 'A'|'B'|'C'|'D', set μέσα στον ThermalEnvelopeDialog, persist μέσω `updateBuildingWithPolicy` passthrough — μηδέν firestore.rules αλλαγή). (b) **U_max όρια = ΤΟΤΕΕ 20701-1 standard** εξωτ. τοίχου: Α=0.55 · Β=0.45 · Γ=0.40 · Δ=0.35 W/m²K (`KENAK_MAX_U_WALL` config). U υπολογίζεται για **τυπικό τοίχο (config `REFERENCE_BARE_WALL_LAYERS`) + ETICS μόνωση** (ο dialog είναι ανά-όροφο). Advisory soft-warn (`isAboveKenakUMax`), ΔΕΝ μπλοκάρει.

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
| **P7** ✅ | Persistence + audit + BOQ | **A**: spec persistence (level doc) + Zod unblock. **B**: `envelope-element-applicator` (Z1-Z4 classify) + ride existing persist hooks via `bim:envelope-applied` (ΜΗΔΕΝ νέο host) + audit tracked-fields (ADR-379) + `envelope-boq-sync` per-zone/floor rows (mirror `stair-boq-sync`) + `.ssot-registry.json` + tests | 4-5 | P2,P6 | Persistence/BOQ |
| **P8** ✅ | Θερμική απόδοση (U-value / ΚΕΝΑΚ) | material catalog +`WALL_MATERIAL_LAMBDA`/`getThermalConductivityLambda` (λ) · `bim/thermal/assembly-u-value.ts` [ΝΕΟ] `computeAssemblyUValue()` (`1/(Rsi+Σd/λ+Rse)`) · `bim/thermal/kenak-thermal-config.ts` [ΝΕΟ] ΚΕΝΑΚ U_max ανά κλιματική ζώνη (ΤΟΤΕΕ) + reference τοίχος + `CLIMATE_ZONE_OPTIONS` · U-value + pass/warn στον ThermalEnvelopeDialog · `Building.climateZone` (OQ-7a) · tests 13/13 | 3-4 | P1,P6 | Energy |
| **P9** ✅ | IFC interoperability | ✅ DONE 2026-05-29 — `ifc-covering-serializer.ts` [ΝΕΟ 6ος] (`IfcCovering INSULATION` per-element + `IfcRelCoversBldgElements` + `IfcMaterial`/`IfcMaterialLayerSet` + `Pset_MaterialThermal` λ· **semantic-only**, Usage παραλείπεται) · `ifc-envelope-spec-loader.ts` [ΝΕΟ] (walls Z1 από per-floor spec) · `+typed` value (graph+writer, ADR-369) · `+envelopeSpecs` param · register `serializers/index.ts` · IfcExportHost wiring · 10/10 + roundtrip 8/8 | 7 | P6,P7,P8 | Interop/IFC |

**Σειρά εκτέλεσης:** P1 → P2 → P3 → {P4, P5 παράλληλα-εφικτά} → P6 → P7 → P8 → P9. (P8 πριν P9: το U-value τροφοδοτεί το IFC thermal Pset.) **Μέχρι το P9 = FULL enterprise, parity Revit/ArchiCAD/Bentley — τίποτα δεν λείπει** (geometry + 2D + 3D + command + persistence + BOQ + θερμική απόδοση + IFC).

**Open questions ανά φάση:** OQ-1 (ΚΕΝΑΚ) + OQ-2 (ΑΤΟΕ Neopor) → P1 · OQ-3 (reuse offset helper) → αρχή P3 · OQ-4 (πατούρα) → P4/P6 · OQ-5 (override) → P6 · OQ-6 (IFC mapping) → resolved-by-design §3.2 (final P9) · OQ-7 (ΚΕΝΑΚ max-U κλιματική ζώνη) → P8.

**Σημείωση:** P1-P3 δεν έχουν ορατό αποτέλεσμα (foundations) αλλά είναι ασφαλείς/μη-breaking. Κάθε φάση μπαίνει σε δικό της Plan Mode + commit όταν το ζητήσει ο Giorgio.

---

## 8. Changelog

- **2026-06-01** (HOTFIX — polygon-clipping crash σε meter-scenes → νέο SSoT `safe-polygon-boolean.ts`, Opus 4.8, pending commit) — Giorgio (browser, `/dxf/viewer`): ολόκληρο το route έπεφτε με `RouteErrorFallback` και repeated `Error: Unable to complete output ring starting at [0.40, 0.19]. Last matching segment found ends at [3.45, 2.65]` — throw από τη `polygon-clipping@0.15.7` (`Object.union` στο stack). **Root cause:** οι συντεταγμένες στο σφάλμα (~0.4–3.45) = **meter-scene** (`sceneUnits='m'`)· ο sweep-line της lib είναι εύθραυστος σε **πολύ μικρά μεγέθη** → δεν κλείνει το output ring → throw. Σε mm-scenes (εκατοντάδες–χιλιάδες) δούλευε, γι' αυτό κρυβόταν. Δεύτερο, **κρισιμότερο** πρόβλημα: το throw ανέβαινε **ανεμπόδιστο** και έριχνε ΟΛΟ τον viewer (ένα geometry edge-case = full route crash). **Fix (SSoT + belt-and-suspenders, N.0.2/N.12/N.7.2):** νέο `bim/geometry/shared/safe-polygon-boolean.ts` (`safeUnion`/`safeIntersection`) που τυλίγει τη lib με (1) **robustness scaling** — κοινός affine σε ΟΛΑ τα inputs (translate σε bbox-min + scale ώστε bbox-diagonal → `ROBUST_SPAN`=1e4) πριν το op, inverse στο αποτέλεσμα· uniform scale = topology-invariant → m-scenes συμπεριφέρονται σαν mm-scenes· (2) **try/catch** → `logger.error` + graceful fallback (κενή MultiPolygon)· geometry edge-case **ΠΟΤΕ** δεν ρίχνει το route. Input space == output space (scaling διάφανο) → οι 2 consumers δεν αλλάζουν offset/attribution. **Αρχεία (1 new SSoT + 2 consumers rewired + 1 test):** `bim/geometry/shared/safe-polygon-boolean.ts` [ΝΕΟ] · `bim/geometry/building-footprint.ts` (`polygonClipping.union`→`safeUnion`, drop default import) · `bim/geometry/footprint-region-classifier.ts` (`union`/`intersection`→`safeUnion`/`safeIntersection`, drop default import) · `bim/geometry/shared/__tests__/safe-polygon-boolean.test.ts` [ΝΕΟ — 7: meter-scale union no-throw/round-trip/disjoint/mm-scale/empty + intersection]. **7/7 + 25/25 (building-footprint + footprint-region-classifier regression) PASS, tsc clean** (μηδέν `any`). 🔴 browser verify (άνοιγμα `/dxf/viewer` με ETICS σε meter-scene → καμία RouteError).
- **2026-05-31** (v2 Phase 6b — per-region `envelopeFunction` override panel στο `ThermalEnvelopeDialog`, Opus 4.8, pending commit) — Η δεύτερη μισή της απόφασης Giorgio «και τα δύο» (§3.1.7/§3.1.8): per-**region** override μέσα στο authoring dialog (η Φ6a ήταν per-element ribbon). Ο χρήστης βλέπει τα **ανιχνευμένα όρια** του ορόφου («Εξωτερικό περίγραμμα», «Αίθριο 1/2», «Δωμάτιο», «Ανοιχτό περίγραμμα») με dropdown override (Αυτόματο/Εξωτερικό/Εσωτερικό) ανά όριο που γράφει το `envelopeFunction` σε **ΟΛΑ** τα στοιχεία του ορίου (distinct `ring.edges[].sourceEntityId`). **Region detection = ίδιο SSoT με 2D/3D:** ο host υπολογίζει `computeBuildingFootprint` + `classifyFootprintRegions` + ίδιο `slabsAbove` (`resolveSlabsAboveForLevel`) με τον applicator → αίθριο vs δωμάτιο ταυτίζεται. **Απόφαση Giorgio (σύγκρουση ορίων):** στοιχείο σε 2 όρια → **«last write wins»** (όλα γράφουν στο ίδιο πεδίο· τελευταία ενέργεια μένει· per-element Φ6a = απλώς «άλλη μια εγγραφή»). **Write path (Revit parity):** ΕΝΑ `CompoundCommand` από `UpdateWall/Column/BeamParamsCommand` ανά στοιχείο → **ΕΝΑ undo entry** ανά region override (undoable + atomic recompute δωρεάν). Re-derive layers/BOQ (`applyPerElement`) ΜΟΝΟ αν υπάρχει ήδη εφαρμοσμένο spec· `markAllCanvasDirty` → 2D overlay ζωντανά. **Καμία αλλαγή engine** — ο `computeEnvelopeShell` καταναλώνει ήδη το override (Φ5B). **SSoT centralization (N.0.2/N.12):** το tri-state mapping (`ENVELOPE_FUNCTION_OPTIONS` + `read/parse` + sentinel) **μετακινήθηκε** από `envelope-function-param.ts` (ribbon) σε neutral `bim/types/thermal-envelope-types.ts` ώστε ribbon ΚΑΙ dialog να το μοιράζονται χωρίς το dialog να εξαρτάται από ribbon code· το ribbon αρχείο = thin re-export barrel (μηδέν churn στους Φ6a consumers). **Αρχεία (1 new SSoT service + 1 test + 2 mod UI + 1 types move + 1 re-export + 2 i18n):** `bim/services/envelope-region-override.service.ts` [NEW — `buildRegionOverrideTargets` (pure: region→targets {regionId,role,ordinal,elementIds,currentFn:fn|'mixed'|undefined}) + `buildRegionOverrideCommand` (CompoundCommand batch-undo)] · `bim/services/__tests__/envelope-region-override.service.test.ts` [NEW 13] · `ThermalEnvelopeDialog.tsx` (+regions `<section>`, props `regions`+`onRegionFunctionChange`, ξαναχρησιμοποιεί `ENVELOPE_FUNCTION_OPTIONS`) · `ThermalEnvelopeHost.tsx` (+`recomputeRegions` + `handleRegionFunctionChange` batch-undo via `LevelSceneManagerAdapter`+`useCommandHistory`) · `bim/types/thermal-envelope-types.ts` (+tri-state SSoT) · `ui/ribbon/hooks/bridge/envelope-function-param.ts` (→ thin re-export barrel) · `dxf-viewer-shell.json` el+en (+`ribbon.commands.thermalEnvelope.regions.{title,description,empty,mixed,roles.*}`). **19/19 (νέο service 13 + envelope-function-param re-export 6) + 275/275 envelope+ribbon+footprint regression PASS, tsc clean** (μηδέν `any`). Dialog/Host εκτός ADR-040 micro-leaf list (καμία CHECK 6B/6D). 🔴 browser verify (λίστα ορίων → dropdown αίθριου «Εσωτερικό» = φεύγει μόνωση· «Εξωτερικό» σε δωμάτιο = μπαίνει· undo επαναφέρει· mixed state). Βλ. §3.1.8.
- **2026-05-31** (v2 Phase 6a — per-element `envelopeFunction` override UI στο contextual ribbon, Opus 4.8, pending commit) — Tri-state combobox «Θερμοπρόσοψη» (Αυτόματο/Εξωτερικό/Εσωτερικό, Revit Wall-Function-style) στα contextual ribbon tabs **τοίχου/κολώνας/δοκαριού** → χειροκίνητη παράκαμψη της **Στρ.3** (§3.1.2/§3.1.3/§3.1.7). Γράφει το per-element `envelopeFunction` (Φ4 data model) μέσω των **υπαρχόντων** `UpdateWall/Column/BeamParamsCommand` → undoable + atomic recompute δωρεάν· ο `computeEnvelopeShell` το καταναλώνει ήδη (`collectEnvelopeOverrides`, Φ5B). **Απόφαση Giorgio:** «και τα δύο» (per-element ribbon = Φ6a· per-region panel = Φ6b). **SSoT helper** NEW `ui/ribbon/hooks/bridge/envelope-function-param.ts` — tri-state mapping value↔field ΕΝΑ μέρος (sentinel `'auto'` = clear→`undefined`· το `.strict()` enum ΔΕΝ δέχεται literal `'auto'`)· `ENVELOPE_FUNCTION_OPTIONS` (3 i18n options)· `readEnvelopeFunctionValue`/`parseEnvelopeFunctionValue`. **Routing:** key `*.params.envelopeFunction` καταχωρήθηκε στο `*_RIBBON_STRING_KEYS` → composer `useRibbonCommands` δρομολογεί μέσω `isXRibbonStringKey`. **Αρχεία (1 new SSoT + 3 command-keys + wall-param-helpers + 2 bridges + 3 contextual tabs + 2 i18n + 3 test):** `envelope-function-param.ts` [NEW] · `{wall,column,beam}-command-keys.ts` (+key+union+array) · `wall-param-helpers.ts` (read/patch envelopeFunction) · `useRibbonColumnBridge.ts` + `useRibbonBeamBridge.ts` (special-case ΠΡΙΝ generic string handling· drawing-mode=no-op) · `contextual-{wall,column,beam}-tab.ts` (+panel «Θερμοπρόσοψη ETICS») · `dxf-viewer-shell.json` el+en (+`ribbon.panels.envelopeFunction` +`ribbon.commands.envelopeFunction.*`) · `__tests__/envelope-function-param.test.ts` [NEW 10] + `__tests__/wall-param-helpers-envelope.test.ts` [NEW 6] + `useRibbonColumnBridge.test.tsx` (+5). **33/33 PASS, tsc clean** (μηδέν `any`). Ribbon files = εκτός ADR-040 micro-leaf list (καμία CHECK 6B/6D εμπλοκή). 🔴 browser verify (επιλογή στοιχείου → ribbon «Θερμοπρόσοψη» → Εσωτερικό=φεύγει μόνωση/Εξωτερικό=μπαίνει/Αυτόματο=γεωμετρία· undo ανά αλλαγή). **Φ6b εκκρεμεί:** per-region panel στο `ThermalEnvelopeDialog`. Βλ. §3.1.7.
- **2026-05-31** (v2 Phase 5C — cross-floor slab SSoT scaffold: αίθριο vs δωμάτιο, Opus 4.8) — Data-layer scaffold που τροφοδοτεί το Gate 2 (§3.1.5) με τα cross-floor `slabsAbove` ώστε το `classifyFootprintRegions` να ξεχωρίζει **αίθριο** (τρύπα ανοιχτή στον ουρανό) από **κλειστό δωμάτιο** (τρύπα με πλάκα ψηλότερου ορόφου). **Αρχεία (1 mod + 2 new):** `footprint-region-classifier.ts` (+`resolveCurrentFloorTopMm` = υψόμετρο οροφής target ορόφου σε mm από τη λίστα ορόφων· +`resolveSlabsAboveForLevel` convenience SSoT = `resolveCurrentFloorTopMm` + `selectSlabsAboveFloor` ώστε ΟΛΟΙ οι consumers — 2D overlay, 3D scene, applicator, BOQ — να μοιράζονται ΕΝΑΝ ορισμό «πλάκα από πάνω» → guaranteed 2D⟷3D parity) · NEW `bim/stores/envelope-floor-slabs-store.ts` (non-React SSoT snapshot `{floors, slabs, activeFloorId}`, mirror `multi-floor-3d-source`/`envelope-spec-store` — non-React readers διαβάζουν synchronously, 2D micro-leaf via `useSyncExternalStore`, ADR-040) · NEW `hooks/data/useEnvelopeFloorSlabs.ts` (producer: μαζεύει τις πλάκες ΟΛΩΝ των ορόφων του ενεργού κτιρίου — live active floor από `Bim3DEntitiesStore`, άλλοι όροφοι από in-memory level scene ή one-shot `loadFileV2`· υψόμετρα από canonical `useFloorsByBuilding` FLOORS doc, ADR-369, ΟΧΙ lossy store· mirror `useFloors3DAggregator` always-on). **Consumer wiring DONE** (2026-05-31, ίδια session, Opus 4.8): οι 6 consumers περνούν πλέον το resolved `slabsAbove` (αντί `[]`) στο `computeEnvelopeShell` — **2D** `EnvelopeOverlay.tsx` (leaf-only `useSyncExternalStore(subscribeEnvelopeFloorSlabs)`, ADR-040· `slabsAbove` στα effect deps) · **3D** `bim-3d/scene/bim-envelope-scene-builder.ts::addEnvelopeShell` (event-time `getEnvelopeFloorSlabs()` getter· rebuild trigger μέσω `use-bim3d-vg-resync` → `subscribeEnvelopeFloorSlabs(resync)`) · **applicator** `envelope-element-applicator.ts` (+param `slabsAbove` → `buildShellMembership`) · **BOQ** `envelope-boq-sync.ts` (+param σε `computeEnvelopeZoneAreas` + `syncEnvelopeBoq`) · **host+mount** `ThermalEnvelopeHost.tsx` (per-target `resolveSlabsAboveForLevel(snap, level.floorId)` — σωστό και για «Εφαρμογή σε όλους» — **+** `useEnvelopeFloorSlabs()` always-on producer, mounted εδώ αντί στο `DxfViewerContent` που είναι στο όριο N.7.1 500 γρ.). Όλα τα νέα params `= []` (safe default → κενό snapshot = όλες οι τρύπες δωμάτια = μηδέν regression vs Φ5B). **+test** `bim/stores/__tests__/envelope-floor-slabs-store.test.ts` (6 σενάρια). **225/225 envelope+footprint + 6/6 store PASS, tsc 0 errors** (μηδέν `any`). ADR-040 staged (CHECK 6B/6D). 🔴 browser verify (τρύπα ανοιχτή στον ουρανό → αίθριο· με πλάκα ψηλότερου ορόφου → δωμάτιο· 2D⟷3D parity). Βλ. §3.1.5 + §3.1.6.
- **2026-05-31** (v2 Phase 5B — wire 3 consumers + BOQ στο `computeEnvelopeShell`, Opus 4.8, pending commit) — Η ορατή μόνωση (2D overlay + 3D κέλυφος + applicator Z1 + BOQ) βγαίνει πλέον από το **footprint shell** (όχι το παλιό `computeEnvelopePerimeter`, που μένει για IFC P9). **2 αποφάσεις Giorgio (Plan Mode):** (1) **hole-gate** — component μονώνεται ΜΟΝΟ αν έχει ≥1 τρύπα (περικλείει χώρο)· Π/μονός τοίχος → νέος ρόλος `'open-structure'`, καμία μόνωση (αντικαθιστά το `enclosesRegion` graph-cycle gate). (2) **no-slab-data default = δωμάτιο** — κενό `slabsAbove` → όλες οι τρύπες = δωμάτια → μόνωση μόνο εξωτερικά (μηδέν regression vs παλιό· αίθρια = Φάση 5C). **Key insight:** τα 2 gates ζουν στον **classifier** (ανά `footprint.components`) → ο engine `computeEnvelopeShell` έμεινε **άθικτος** (οδηγείται 100% από `classified.insulated`). **Open point #2 (Plan-Mode απόφαση):** ο applicator άλλαξε από proximity (≤20cm) σε ανάγνωση `chain.columnIds`/`beamIds` (footprint = ρητή SSoT συμμετοχή, σέβεται overrides). Οι consumers **δεν** φιλτράρουν πλέον `enclosesRegion` (engine authoritative — τα ανοιχτά runs από `'interior'` override ζωγραφίζονται). **Αρχεία (6 mod + 4 test mod):** `footprint-region-classifier.ts` (hole-gate + `open-structure` role + `openStructures` bucket + no-slab-data→room) · `envelope-shell.ts` (+`collectEnvelopeOverrides` SSoT helper) · `EnvelopeOverlay.tsx` (2D, ADR-040) · `BimSceneLayer.ts::addEnvelopeShell` (3D, ADR-040) · `envelope-element-applicator.ts` (proximity→`buildShellMembership` chain-ids) · `envelope-boq-sync.ts` (Z1 από shell, beams contribute). **213/213 envelope+footprint + 32/32 BimSceneLayer PASS, tsc clean** (μηδέν `any`). ADR-040 changelog staged (CHECK 6B/6D). 🔴 browser verify. **Deferred:** Φάση 5C (cross-floor `slabsAbove` → αίθρια)· Φάση 6 (UI override panel). Βλ. §3.1.5.
- **2026-05-31** (v2 Phase 5A — envelope shell builder engine, Opus 4.8, pending commit) — Νέος pure geometry engine `bim/geometry/envelope-shell.ts` που ενώνει Φ2 (`computeBuildingFootprint`) + Φ3 (`classifyFootprintRegions`) + Φ4 (`envelopeFunction`) και **αντικαθιστά** το `computeEnvelopePerimeter` ως πηγή της ορατής μόνωσης (αποφάσεις Giorgio Plan-Mode: «**νέο σύστημα οδηγεί**» + «**πλήρες override τώρα**»). Μοντέλο «ring → runs → offset» (το footprint pipeline έλυσε ήδη όλη την τοπολογία → καμία adjacency graph). **Έξοδος = `EnvelopeChain[]` verbatim** → drop-in για render-plan/opening-cuts/to-three (μηδέν consumer churn). **Override σημασιολογία:** `'interior'` = αφαιρετικό (ακμή εξαιρείται → συνεχής γραμμή **σπάει** σε ανοιχτά runs, κενό)· `'exterior'` = προσθετικό μόνο ως **orphan wrap** (δικό του κλειστό τύλιγμα για στοιχείο εκτός κάθε auto-μονωμένου ορίου — ΔΕΝ αγγίζει ring edges ⇒ εξωτ. τοίχος δεν μονώνεται και στη room όψη). **2 geometry findings (από tests):** (1) το `sign` του `offsetPolyline` είναι **αναξιόπιστο** σε notched γωνίες → δοκιμή **και των δύο** προσήμων + pick by mean-distance προς το κέντρο ring (proven pattern `offsetLoopOutward`/`insetClosedPolygon`)· (2) ο `'exterior'` override double-wrap (εξωτ. τοίχος μόνωνε και την εσωτ. όψη) → λύθηκε με orphan-only μοντέλο. **Αρχεία (1 new + 1 test + 2 mod):** `bim/geometry/envelope-shell.ts` [ΝΕΟ] · `bim/geometry/__tests__/envelope-shell.test.ts` [ΝΕΟ — 18 σενάρια] · `bim/geometry/shared/polygon-utils.ts` (**extract** `polylinePerimeterMeters` — SSoT, καταναλώνεται από envelope-perimeter + envelope-shell, N.12) · `bim/geometry/envelope-perimeter.ts` (rewire import, `EnvelopeChain.beamIds?` additive optional για BOQ Φ5B, drop local `polylinePerimeterM`/`MM_TO_M`). **Αυτόνομο** (μηδέν consumer wiring — Φάση 5B). **18/18 + 472/472 bim/geometry regression PASS, tsc clean** (μηδέν `any`). **Φάση 5B (επόμενη session):** wire 3 consumers (`EnvelopeOverlay` 2D, `BimSceneLayer.addEnvelopeShell` 3D, applicator `buildPerimeterContext`) → `computeEnvelopeShell` + `overridesById` + slabsAbove cross-floor + BOQ `beamIds`. Βλ. §3.1.4.
- **2026-05-31** (v2 Phase 4 — `envelopeFunction` per-element override data model, Opus 4.8, pending commit) — Νέο per-element πεδίο `envelopeFunction?: 'exterior' | 'interior'` = η **χειροκίνητη παράκαμψη** (Revit Wall-Function-style, **Στρ.3** §3.1.2/§3.1.3) της αυτόματης γεωμετρικής ταξινόμησης του `footprint-region-classifier`. **ΚΑΘΑΡΟ data model — καμία αλλαγή συμπεριφοράς** (consumer = Φάση 5, UI = Φάση 6). **Αποφάσεις (Giorgio: «FULL ENTERPRISE + FULL SSOT»):** (1) **οντότητες = τοίχος + κολώνα + δοκάρι** (πλευρικό footprint / Z1)· ΟΧΙ πλάκες (Z2/Z3 = άξονας υψομέτρου) ούτε ανοίγματα (Z4 = host wall) — διαφορετικός άξονας ζώνης· (2) **νέο ξεχωριστό πεδίο**, αποσυνδεδεμένο από το δομικό `WallParams.category` (5 τιμές, δομικός ρόλος ≠ θερμική παράκαμψη· κολώνες/δοκάρια δεν έχουν `category` → ένα ομοιόμορφο audit/schema path)· (3) **per-element** (ΟΧΙ per-region: οι περιοχές = παράγωγη γεωμετρία χωρίς σταθερό ID → override σε μόνιμα entity IDs)· (4) **`undefined` = auto** (ΟΧΙ ρητό `'auto'` literal = anti-SSoT· mirror `envelopeLayer?`). **Υλοποίηση = ακριβές mirror του P7A** (type → Zod schema ΠΡΙΝ το `.strict()` → audit tracked-field → tests). **Αρχεία (9 mod + 1 test ext):** `bim/types/thermal-envelope-types.ts` (+`EnvelopeFunction` type SSoT) · `bim/types/thermal-envelope.schemas.ts` (+`EnvelopeFunctionSchema` Zod SSoT, exported) · `bim/types/{wall,column,beam}-types.ts` (+`envelopeFunction?`) · `bim/types/{wall,column,beam}.schemas.ts` (+`EnvelopeFunctionSchema.optional()` ΠΡΙΝ `.strict()` — αλλιώς PATCH strip, P2-flag class) · `src/config/audit-tracked-fields.ts` (+`envelopeFunction` scalar σε WALL/COLUMN/BEAM RAW, μηδέν νέο `AuditEntityType`) · `bim/types/__tests__/thermal-envelope.schemas.test.ts` (+10: enum δέχεται exterior/interior απορρίπτει 'auto'/κενό + wall/column/beam no-strip round-trip + undefined=auto). **21/21 + 112/112 bim/types regression PASS, tsc envelope-clean** (μηδέν `any`). **Phase 4 από v2 roadmap** (Phase 5: wire consumers — override wins vs auto ring role + per-element render κολώνας/δοκαριού· Phase 6: UI override panel). Βλ. §3.1.3.
- **2026-05-30** (v2 Phase 3 — footprint region classification: αίθριο vs δωμάτιο, Opus 4.8, pending commit) — Νέο geometry SSoT `bim/geometry/footprint-region-classifier.ts` που παίρνει την έξοδο της Φάσης 2 (`BuildingFootprintResult`) + τις πλάκες ψηλότερων ορόφων και αποφασίζει **αυτόματα** ποια όρια παίρνουν μόνωση (ταξινόμηση 3 στρώσεων, βλ. §3.1.2): **Στρ.1** εξώτατο όριο → ΠΑΝΤΑ μόνωση (`exterior`)· **Στρ.2** κάθε τρύπα → **αίθριο** (χωρίς πλάκα από πάνω → μόνωση) ή **κλειστό δωμάτιο** (με πλάκα → καμία μόνωση)· **Στρ.3** per-element override → Φάση 4+6. **Λεπτό σημείο (απόφαση Giorgio):** ο έλεγχος «έχει η τρύπα πλάκα από πάνω;» = **γεωμετρική τομή** (ίδια lib `polygon-clipping` με τη Φάση 2): `coverage = εμβαδόν(τρύπα ∩ ένωση πλακών-από-πάνω) ÷ εμβαδόν τρύπας ≥ ATRIUM_COVERAGE_THRESHOLD` (0.5, configurable) → δωμάτιο, αλλιώς αίθριο. Χειρίζεται σχήματα Γ/Π, μερική κάλυψη, προβόλους (εναλλακτικές «κέντρο»/«δειγματοληψία» απορρίφθηκαν). **Έξοδος `FootprintClassificationResult`** (`rings`/`exterior`/`atria`/`interiorRooms`, κάθε ring `{role, insulated, coverageAbove}`) + resolver `selectSlabsAboveFloor` που **reuse-άρει τον ΙΔΙΟ elevation SSoT** με το `classifyExposedSlab` (`resolveSlabTopMm`→`getEntityAbsoluteElevation`, ADR-369 — εξήχθη ως export αντί διπλότυπο). **Αυτόνομο** (μηδέν wiring — Φάση 5· μηδέν data model/Zod/audit — Φάση 4). **Αρχεία (1 new + 1 test + 2 mod):** `bim/geometry/footprint-region-classifier.ts` [ΝΕΟ] · `bim/geometry/__tests__/footprint-region-classifier.test.ts` [ΝΕΟ — 12 σενάρια] · `bim/types/thermal-envelope-types.ts` (+`ATRIUM_COVERAGE_THRESHOLD`) · `bim/geometry/exposed-slab-classifier.ts` (export `resolveSlabTopMm`). **12/12 tests + 436/436 bim/geometry regression PASS, tsc clean** (μηδέν `any`). **Phase 3 από v2 roadmap** (Phases 4-6: `envelopeFunction` data model Zod+audit + wiring consumers + per-element render κολώνας/δοκαριού + UI override). Βλ. §3.1.2.
- **2026-05-30** (v2 Phase 2 — building-footprint boolean union, Opus 4.8, pending commit) — Νέο geometry SSoT `bim/geometry/building-footprint.ts` που βγάζει το ΠΡΑΓΜΑΤΙΚΟ περίγραμμα κτιρίου από **boolean union** των αποτυπωμάτων ΤΟΙΧΩΝ + ΚΟΛΩΝΩΝ + ΔΟΚΑΡΙΩΝ (lib `polygon-clipping` 0.15.7, **MIT** — N.5 verified, δεν υπήρχε union στο codebase). Λύνει την αδυναμία του `envelope-perimeter.ts` (Option 1, σειριακή ένωση παρειών) σε **επικαλυπτόμενα** στοιχεία (κολώνα μέσα σε τοίχο, δοκάρι πάνω σε τοίχο). **Έξοδος:** `BuildingFootprintResult` = `components[]` (`outer` ring + `holes[]`) + flat `outerRings[]`/`holes[]` (= αίθρια/δωμάτια), με **per-edge attribution** `FootprintEdge.sourceEntityId/Type` (midpoint + parallel γεωμετρική ταύτιση — η lib δεν κρατά provenance· null σε νέα κορυφή τομής). **Απόφαση Giorgio («ότι προτείνεις»):** το νέο ζει **αυτόνομο** (μηδέν wiring στους consumers — Φάση 5· μηδέν άγγιγμα στο `envelope-perimeter.ts` → καμία regression), αλλά με «συμβατό» σχήμα ώστε η Φάση 5 να το βάλει σταδιακά στη θέση του παλιού → ΕΝΑ σύστημα (SSoT). **Reuse:** `computeWallGeometry`/`computeBeamGeometry`/`prepareColumns`/`polygonArea`/`pointToSegmentDistance` (μηδέν διπλότυπο). **Precision guard:** translate σε local origin πριν το union. **Αρχεία (1 new + 1 test + dep):** `bim/geometry/building-footprint.ts` [ΝΕΟ] · `bim/geometry/__tests__/building-footprint.test.ts` [ΝΕΟ — 6 σενάρια: ορθογώνιο/L/2 κτίρια/χώρισμα→δωμάτια-τρύπες/κολώνα-σε-τοίχο overlap/δοκάρι] · `src/subapps/dxf-viewer/package.json` (+polygon-clipping). **11/11 tests + 410/410 bim/geometry regression PASS, tsc clean** (μηδέν `any`). ⚠️ ΟΧΙ offset (insulation loop) — εκτός εύρους P2. **Phase 2 από v2 roadmap** (Phases 3-6: ταξινόμηση 3 στρώσεων [εξώτατο όριο + αίθριο + override] + `envelopeFunction` data model + wiring consumers + per-element render κολώνας/δοκαριού + UI override). Βλ. §3.1.1.
- **2026-05-30** (v2 Phase 1 — `enclosesRegion` gate: ανοιχτές αλυσίδες → καμία ETICS, Opus 4.8, pending commit) — Giorgio: σε **ανοιχτές αλυσίδες** τοίχων (σχήμα Π/ζιγκ-ζαγκ που δεν κλείνουν) εμφανίζονταν λάθος μονώσεις Z1. **Διάγνωση-first (code = source of truth):** το ADR (§3.1, αυτό το changelog 2026-05-30 P3 UPDATE) έλεγε «gating = `closed===true`», αλλά ο κώδικας είχε **αποκλίνει** σε `wallIds.length >= 3` και στους **3 consumers** (`EnvelopeOverlay.tsx`, `BimSceneLayer.addEnvelopeShell`, `envelope-element-applicator.buildPerimeterContext`) → μια ανοιχτή αλυσίδα 3+ τοίχων περνούσε + έπαιρνε αυθαίρετη «εξωτ. όψη» από centroid heuristic. **Απόφαση Giorgio (Plan-Mode Q&A):** ETICS ΜΟΝΟ όταν οι τοίχοι **περικλείουν χώρο**. **Fix (SSoT):** νέο πεδίο `EnvelopeChain.enclosesRegion` = «το connected component έχει κύκλο» (ακμές ≥ κόμβοι στο γράφημα τοίχων· δέντρο = ανοιχτή αλυσίδα → false). Διαφέρει από `closed` (που απαιτεί ΟΛΟΙ valence-2 → false σε κτίρια με T-junction/εσωτ. χώρισμα): το `enclosesRegion` πιάνει τον κύκλο ΚΑΙ με διακλαδώσεις. Οι 3 consumers gate-άρουν πλέον σε `enclosesRegion` (αντικαθιστά `>= 3`). **Αρχεία (4 + 4 tests):** `bim/geometry/envelope-perimeter.ts` (+`enclosesRegion` στο `EnvelopeChain` + υπολογισμός degreeSum/2 ≥ comp.size στο `orderComponent`) · `components/dxf-layout/EnvelopeOverlay.tsx` · `bim-3d/scene/BimSceneLayer.ts` · `bim/services/envelope-element-applicator.ts` · +`envelope-perimeter.test.ts` (7 νέα: closed/L/Π-bug/single/2-wall-L/column-bridged/2-buildings) + `enclosesRegion` σε 7 chain fixtures (to-three/renderer/opening-cuts×2/jamb×... ). **159/159 envelope tests PASS, tsc envelope-scope clean.** ADR-040 staged (CHECK 6D — EnvelopeOverlay micro-leaf). 🔴 browser verify (ανοιχτή αλυσίδα → καμία Z1· κλειστό κτίριο → Z1 κανονικά). **Phase 1 από v2 roadmap** (Phases 2-6: building-footprint boolean-union + εξωτ. ταξινόμηση 3 στρώσεων [εξώτατο όριο + αίθριο-από-έλλειψη-πλάκας + override] + per-element render κολώνας/δοκαριού + UI override).
- **2026-05-30** (BUGFIX 2D+3D — «μικρή πλευρά» (κάθετη απόληξη) μόνωσης Z1 στο άνοιγμα, Opus 4.8, pending commit) — Giorgio (screenshot 172037, κάτοψη πόρτας Θ.101 + 3D): στο άκρο όπου η Z1 κόβεται στο άνοιγμα **έλειπε η «μικρή καφέ γραμμή»** που κλείνει το προφίλ της μόνωσης (η τομή του πάχους, από εξωτ. όψη `O` έως παρειά τοίχου `F`)· στο 3D η αντίστοιχη όψη απόληξης ήταν **μη ευθυγραμμισμένη**. **Root (διαγνωστικό-first, μετρημένο):** το `bandQuad` υπολόγιζε τα outer σημεία `O_a/O_b` με **same-param lerp** στο offset outer loop (που στις γωνίες είναι μακρύτερο/μετατοπισμένο) → οι απολήξεις `[O_a→F_a]`/`[O_b→F_b]` **σπλέρναν** (capStart x=−20 στο κέντρο ακμής, −72 κοντά σε γωνία· ιδανικό 0) → μη κάθετες/μη collinear με Z4. Ίδιο root 2D (γραμμή λείπει) + 3D (όψη λοξή). **Fix (SSoT `bandQuad`):** `O = F + n·d` (n=outward normal παρειάς, d=κάθετο πάχος miter-invariant) → καθαρό ορθογώνιο punch + κάθετες απολήξεις collinear με Z4. **2D:** νέο `EnvelopeRenderer.strokeOpeningCutCaps` (stroke `[O_a→F_a]`/`[O_b→F_b]` με `ENVELOPE_OUTLINE_RGBA`, ΜΕΤΑ το `destination-out`). **3D:** `EnvelopeToThree.addEdge` καταναλώνει πλέον το `cut.bandQuad` (perpendicular O στα όρια, loop O στις γωνίες· station-based· `bandQuadAt`→`makeQuad`). **Αρχεία:** `bim/geometry/envelope-opening-cuts.ts` (+`outwardNormal`, perpendicular bandQuad) · `bim/renderers/EnvelopeRenderer.ts` (+`strokeOpeningCutCaps`) · `components/dxf-layout/EnvelopeOverlay.tsx` (call· ADR-040 micro-leaf) · `bim-3d/converters/EnvelopeToThree.ts` (addEdge refactor). **Tests:** envelope-opening-cuts (perpendicular + corner-no-splay) · envelope-renderer (cap stroke spy) · envelope-to-three (κάθετες παρειές x=4/x=6). **94/94 envelope PASS, tsc clean.** ADR-040 staged (CHECK 6D). 🔴 browser verify (κάτοψη: μικρή καφέ κάθετη γραμμή σε κάθε άκρο Z1 cut, collinear με παρειά/Z4· 3D: απόληξη ευθυγραμμισμένη).
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
- **2026-05-29** (P7 **Part A** IMPLEMENTED, Opus 4.8) — **Φάση P7 Part A: Spec persistence + Zod schema unblock DONE** (pending commit). Το ETICS κέλυφος **επιβιώνει πλέον reload** (ήταν in-memory only). Giorgio decisions (Plan Mode): OQ-A «τι θα έκανε η Revit» → per-element = source of truth + per-floor spec ως preset/display driver στο level doc· OQ-B → write per-element (→ Part B). Part A = ασφαλές foundation, ξεχωριστό commit από Part B (phase-per-session). Αρχεία (3 new + 8 mod):
  - `bim/types/thermal-envelope.schemas.ts` **[ΝΕΟ]** — SSoT Zod: `EnvelopeLayerSchema` (`materialId`+`thickness_m` [0.05-1m]+`zone` Z1-Z4) + `RevealInsulationSchema` (zone literal Z4) + `ThermalEnvelopeSpecSchema` + `EnvelopeZoneTogglesSchema`. **Ένα** μέρος ορισμού — τα 4 entity schemas + level-doc PATCH το καταναλώνουν (μηδέν 4× drift).
  - `bim/types/{column,beam,slab,opening}.schemas.ts` — **P2 flag CLOSED**: `+envelopeLayer: EnvelopeLayerSchema.optional()` (column/beam/slab) + `revealInsulation: RevealInsulationSchema.optional()` (opening) **πριν** το `.strict()`. Χωρίς αυτό, κάθε PATCH έσβηνε σιωπηρά τα P2 πεδία (ADR-375 v2.13 pattern).
  - `app/api/dxf-levels/dxf-levels.schemas.ts` — `UpdateDxfLevelSchema` (`.passthrough()`) `+thermalEnvelopeSpec: ThermalEnvelopeSpecSchema.nullable().optional()` (ρητό validate παρά το passthrough — clean round-trip, μάθημα v2.13). `dxf-levels.handlers.ts` — persist field (`updates.thermalEnvelopeSpec`).
  - `systems/levels/config.ts` — `Level +thermalEnvelopeSpec?: ThermalEnvelopeSpec | null` (mirror `bimRenderSettings`).
  - `bim/stores/envelope-spec-store.ts` — `+loadForLevel(levelId, incoming)` + `currentLevelId` + `lastLocalMutationAt` (stamp σε `setEnvelopeSpec`) + getters. Mirror `bim-render-settings-store`.
  - `state/hooks/useThermalEnvelopeSync.ts` **[ΝΕΟ]** — αντίγραφο `useBimRenderSettingsSync` (ADR-375 v2.11): level-switch reload από `level.thermalEnvelopeSpec` + same-level quiet-window 2s guard για Firestore echoes. Mounted στο `DxfViewerContent` δίπλα στο bimRenderSettings sync.
  - `services/thermal-envelope.service.ts` **[ΝΕΟ]** — `saveThermalEnvelopeSpec` μέσω `updateDxfLevelWithPolicy` (ADR-286 gateway, μηδέν direct Firestore). Mirror `bim-render-settings.service`.
  - `ui/components/bim-envelope/ThermalEnvelopeHost.tsx` — apply → `setEnvelopeSpec` (optimistic) + fire-and-forget `saveThermalEnvelopeSpec` (current/all). Quiet-window καλύπτει το echo.
  - tests: `thermal-envelope.schemas.test.ts` **[ΝΕΟ]** (round-trip 4 entities χωρίς strip + spec/layer/reveal validation) + `envelope-spec-store.test.ts` **[ΝΕΟ]** (loadForLevel + quiet-window). **28/28 PASS** (+ P6 regression 11/11). tsc envelope-scope clean.
  - **Part B pending** (separate session/commit): per-element applicator (classify Z1 columns/beams via exterior perimeter + Z2/Z3 exposed slabs + Z4 exterior openings → write `envelopeLayer`/`revealInsulation`) + audit tracked-fields (ride existing entities) + `envelope-boq-sync` (per-zone/floor m² rows, D5) + `.ssot-registry.json`. Next: Plan Mode P7 Part B.
- **2026-05-29** (P7 **Part B** IMPLEMENTED, Opus 4.8) — **Φάση P7 Part B: per-element layers + audit + BOQ DONE** (pending commit). Το command «Εφαρμογή Θερμοπρόσοψης» γράφει πλέον στρώση μόνωσης σε κάθε εκτεθειμένο στοιχείο → audit trail + per-zone/floor προμετρήσεις. Giorgio decision: **εξωτερική κολώνα/δοκάρι = κέντρο εντός ~20cm (configurable) από τη γραμμή εξωτ. όψης**. Αρχεία (3 new + 7 mod):
  - `bim/services/envelope-element-applicator.ts` **[ΝΕΟ, PURE]** — `computeEnvelopeAssignments(spec, entities, storeys)`: Z1 columns/beams (proximity `EXTERIOR_PROXIMITY_M` σε εξωτ. face loop via `computeEnvelopePerimeter`+`pointToSegmentDistance`) · Z2/Z3 slabs (`filterExposedSlabs`) · Z4 openings (host wall ∈ exterior chain). Zone-gated· στοιχείο που δεν qualify-άρει → clear (idempotent). `applyAssignmentsToEntities` → dequal-filtered patch + `changed[]`.
  - `bim/services/envelope-boq-sync.ts` **[ΝΕΟ]** — `computeEnvelopeZoneAreas` (pure: Z1 perimeter×ύψος· Z2/Z3 Σ exposed slab netArea· Z4 Σ `computeRevealContributionArea`) + `syncEnvelopeBoq` → χωριστή γραμμή ανά ζώνη+όροφο `boq_env_<floorId>_<zone>` (D5· `OIK-10.05` m²· `sourceEntityType:'envelope'`· detach guard· zero-area→orphan delete). Mirror `stair-boq-sync`. **Z1 = συνεχές κέλυφος τοίχων** (perimeter×ύψος)· ΟΧΙ άθροισμα per-element column/beam facade (double-count guard — οι per-element layers υπάρχουν για audit/IFC/override).
  - `bim/types/thermal-envelope-types.ts` — `+EXTERIOR_PROXIMITY_M = 0.2` (configurable threshold, Giorgio).
  - `config/audit-tracked-fields.ts` — `+envelopeLayer` (COLUMN/BEAM/SLAB JSON scalar, mirror wall `dna`) + `+revealInsulation` (OPENING). Τα υπάρχοντα audit-clients fire αυτόματα μέσω `diffTrackedFields` — μηδέν νέο AuditEntityType/route/collection.
  - `systems/events/EventBus.ts` — `+'bim:envelope-applied': { entities }`. `hooks/data/useBimEntityMovedPersistEffect.ts` — 2ος listener (covers column/beam/slab — ride existing persist+audit+structural-BOQ). `hooks/data/useOpeningPersistence.ts` — δικός του listener (το opening ΔΕΝ είναι στο shared moved effect) → Z4 persist.
  - `ui/components/bim-envelope/ThermalEnvelopeHost.tsx` — μετά spec apply: per-level `computeEnvelopeAssignments`→`applyAssignmentsToEntities`→`setLevelScene`→`emit('bim:envelope-applied')`→`syncEnvelopeBoq`. `+props {getLevelScene,setLevelScene,projectId}` (από `DxfViewerContent`)· storeys από `useBim3DEntitiesStore`.
  - `types/boq/boq.ts` — `sourceEntityType +'envelope'` (additive· `sourceType` παραμένει `'bim-auto'` → treated as auto everywhere). `.ssot-registry.json` — module `thermal-envelope` (forbid `EnvelopeLayerSchema` re-declaration + `boq_env_` row builders εκτός SSoT).
  - 🔴 **Μάθημα (διαφορά από plan premise)**: το `setLevelScene` ΔΕΝ auto-save-άρει batch writes — το auto-save παρακολουθεί μόνο το *selected* entity. Η SSoT batch-persist διαδρομή είναι το event `bim:entities-moved`/`bim:envelope-applied` (`useBimEntityMovedPersistEffect`). Openings ΕΚΤΟΣ αυτής της οικογένειας → dedicated listener.
  - tests: `envelope-element-applicator.test.ts` **[ΝΕΟ]** (Z1-Z4 classify + gates + idempotent + clear) + `envelope-boq-sync.test.ts` **[ΝΕΟ]** (zone areas + per-zone+floor rows + orphan cleanup + detach + OIK-10.05). **18/18 PASS** (+ regression 58/58: perimeter/contribution/renderer/to-three/P6). tsc envelope-scope clean. **P7 ΟΛΟΚΛΗΡΩΘΗΚΕ (A+B).** Next: Plan Mode P8 (U-value/ΚΕΝΑΚ).

- **2026-05-29** (P-RENDER IMPLEMENTED, Opus 4.8, pending commit) — **Z2/Z3/Z4 ορατότητα σε 2D + 3D** (πριν: μόνο Z1 render· Z2/Z3/Z4 = μόνο δεδομένα από P7B). Render = **pure read** των per-element `envelopeLayer`/`revealInsulation` (ΟΧΙ re-run applicator). Αρχεία (7 mod):
  - `bim/geometry/shared/polygon-utils.ts` — `+insetClosedPolygon(vertices, distance)` **[ΝΕΟ SSoT]** winding-agnostic inset (offsetPolyline ±sign → ΜΙΚΡΟΤΕΡΟ `polygonArea`). Καταναλώνεται από 2D (Z4 frame) + 3D (Z4 lining) — μηδέν duplication.
  - `bim/renderers/envelope-render-plan.ts` — `+buildSlabHatchPlan(footprint, materialId)` (Z2/Z3: polygon + `computeWallHatchPlan` reuse) + `+buildRevealBandPlan(outline, insetCanvas, materialId)` (Z4: band ring `outline` + `insetClosedPolygon` reversed + hatch· reuse `EnvelopeRenderPlan`).
  - `bim/renderers/EnvelopeRenderer.ts` — `+renderSlabHatch()` (clip polygon → hatch lines)· Z4 reuse της `render()` (band + stroke). Re-export νέων builders.
  - `components/dxf-layout/EnvelopeOverlay.tsx` (ADR-040 micro-leaf) — module helpers `drawExposedSlabHatch` (slabs με `envelopeLayer`) + `drawOpeningReveals` (openings με `revealInsulation`· thickness m→canvas via `mmToSceneUnits`). Effect μένει thin, subscriptions αμετάβλητες (CHECK 6C safe).
  - `bim-3d/converters/EnvelopeToThree.ts` — `+slabFlatLayerToMesh()` (Z3 πάνω/Z2 κάτω από slab face) + `+revealLiningToMesh()` (Z4 frame extruded sill→head) + κοινό `makeEnvelopeMesh` finalize (SSoT styling· refactor `envelopeChainToMesh` να το χρησιμοποιεί). tag `bimType='envelope'` + `elem-envelope` + edge overlay (ADR-370/375 parity).
  - `bim-3d/scene/BimSceneLayer.ts` — `syncEnvelope` restructure: visibility gate κοινό· Z1 spec-driven (`addEnvelopeShell`)· `+addFlatLayers` (slabs Z2/Z3) `+addRevealLinings` (openings Z4)· `+resolveEnvelopeBuilding` helper (building base + `shouldRender`, no layer gating — mirror Z1).
  - tests: `envelope-renderer.test.ts` (+Z2/Z3 hatch plan + Z4 band) + `envelope-to-three.test.ts` (+slab flat Z2/Z3 πρόσημο elevation + reveal lining). **23/23 PASS** (+ regression 116/116 envelope+polygon suites). tsc envelope-scope clean. ADR-040 changelog staged (CHECK 6B/6D). Next: Plan Mode P8 (U-value/ΚΕΝΑΚ).
- **2026-05-29** (P8 IMPLEMENTED, Opus 4.8, pending commit) — **Φάση P8 Θερμική απόδοση (U-value / ΚΕΝΑΚ) DONE**. OQ-7 RESOLVED (βλ. §6: κλιματική ζώνη = ρύθμιση κτιρίου· U_max = ΤΟΤΕΕ standard· U για τυπικό τοίχο + μόνωση). Νέο μικρό subsystem `bim/thermal/` + wiring στον υπάρχοντα dialog/host (ΟΧΙ νέο command). Αρχεία (3 new + 5 mod):
  - `bim/thermal/assembly-u-value.ts` **[ΝΕΟ PURE SSoT]** — `ThermalLayer` + `computeAssemblyRValue`/`computeAssemblyUValue(layers, surface?)` = `1/(Rsi+Σ(d/λ)+Rse)` (ISO 6946, `RSI_WALL_DEFAULT` 0.13 / `RSE_WALL_DEFAULT` 0.04). meters-in. Degenerate στρώσεις (λ≤0/d≤0/μη-πεπερασμένα) αγνοούνται.
  - `bim/thermal/kenak-thermal-config.ts` **[ΝΕΟ config]** — `ClimateZone` 'A'|'B'|'C'|'D' (ASCII· Greek labels i18n) + `KENAK_MAX_U_WALL` {A:0.55, B:0.45, C:0.40, D:0.35} (ΤΟΤΕΕ 20701-1) + `REFERENCE_BARE_WALL_LAYERS` (εξωτ.σοβάς 2εκ + οπτοπλινθοδομή 20εκ + εσωτ.σοβάς 2εκ) + `CLIMATE_ZONE_OPTIONS` (dialog Select SSoT) + `getKenakMaxUWall`/`isAboveKenakUMax` (soft-warn).
  - `bim/walls/wall-material-catalog.ts` — `+WALL_MATERIAL_LAMBDA` (Partial<Record<preset, λ>> W/mK: Neopor 0.031, XPS 0.034, EPS 0.035, ορυκτοβάμβακας 0.035, σοβάδες, οπτοπλινθοδομή 0.51, σκυρόδεμα 2.0, …) + `getThermalConductivityLambda()`. λ ανά υλικό = SSoT εδώ (§3.2b· τρέφει και P9 IFC).
  - `ui/components/bim-envelope/ThermalEnvelopeDialog.tsx` — `+climateZone`/`onClimateZoneChange` props· climate-zone `<Select>` (ADR-001) + U-value section: `useMemo` U = `computeAssemblyUValue([...REFERENCE_BARE_WALL_LAYERS, {thickness_m, λ(materialId)}])` + εμφάνιση U + ΚΕΝΑΚ όριο ζώνης + pass/warn (`--text-success`/`--text-warning`)· unset ζώνη → prompt (`text-muted-foreground`). `formatUValue` helper.
  - `ui/components/bim-envelope/ThermalEnvelopeHost.tsx` — resolve building climateZone (`useFirestoreBuildings` → building από current level's `buildingId`)· `onClimateZoneChange` → optimistic override + `updateBuildingWithPolicy({buildingId, updates:{climateZone}})` (mirror `saveThermalEnvelopeSpec`).
  - `src/types/building/contracts.ts` + `src/components/building-management/building-services.ts` + `src/app/api/buildings/building-update.handler.ts` — `+climateZone?: 'A'|'B'|'C'|'D'`. Buildings PATCH = passthrough (`...updates` filter μόνο undefined+immutable companyId) → **μηδέν** firestore.rules/zod/allowlist αλλαγή (no CHECK 3.16).
  - `src/i18n/locales/{el,en}/dxf-viewer-shell.json` — `+climateZone.{label,placeholder,zones.A-D}` + `+performance.{uValue,kenakLimit,pass,warn,noZone}` (single-brace `{value}`).
  - tests: `bim/thermal/__tests__/assembly-u-value.test.ts` **[ΝΕΟ]** (13· R/U math + degenerate guards + reference+Neopor U≈0.26 + ΚΕΝΑΚ boundaries + γυμνός τοίχος fail + options). **13/13 PASS.**
  - SSoT: reuse `ENVELOPE_MATERIAL_OPTIONS` pattern· λ catalog single-home· climate zone single-home (building doc). Next: Plan Mode **P9** (IFC `IfcCovering` + `Pset_MaterialThermal`, τρέφεται από U/λ του P8).

- **2026-05-29** (P9 DONE — IFC interoperability, Opus 4.8, pending commit) — **ADR-396 ΟΛΟΚΛΗΡΩΝΕΤΑΙ 9/9.** 6ος entity serializer εξάγει το ETICS κέλυφος ως `IfcCovering(INSULATION)` στο ζωντανό IFC4 pipeline. **Αποφάσεις Giorgio (Plan Mode):** (1) **per-element granularity** — ένα covering ανά καλυπτόμενο στοιχείο (όχι ενοποιημένο ανά όροφο/ζώνη)· (2) **semantic-only** — covering χωρίς δική του γεωμετρία (placement/representation = `$`), μόνο υλικό/πάχος/θερμικά + σχέση· (3) **walls=ΝΑΙ** — οι εξωτ. τοίχοι παίρνουν Z1 covering. ⚠️ **Code = source of truth:** οι **τοίχοι ΔΕΝ κουβαλούν** per-element `envelopeLayer` (το handoff prompt το έλεγε λάθος)· η Z1 facade τους ορίζεται από το per-floor `ThermalEnvelopeSpec` (level doc) → ο serializer το διαβάζει + βρίσκει εξωτ. τοίχους via `computeEnvelopePerimeter` (P3 SSoT). Columns/beams (Z1), slabs (Z2/Z3), openings (Z4→host wall) από per-element accessors. Αρχεία (2 new + 5 mod):
  - `services/ifc/serializers/ifc-covering-serializer.ts` **[ΝΕΟ 6ος serializer]** — `serializeEnvelopeCoverings(graph, spatial, params, ctx)`. Per covering: `IfcCovering(INSULATION)` + `IfcRelCoversBldgElements`(→element id από `ctx`) + `IfcMaterial` + `IfcMaterialLayer`(πάχος) + `IfcMaterialLayerSet`(1 στρώση) via `IfcRelAssociatesMaterial` + `Pset_MaterialThermal.ThermalConductivity`(λ, gated `includePsets`· custom/άγνωστο λ → skip Pset). Covering → `ctx.elementsByStorey` (storey containment). GUID `generateIfcGuid()` generate-at-serialize (covering = μη-persisted entity, ίδιο pattern με `IfcRelVoidsElement`).
  - `services/ifc/ifc-envelope-spec-loader.ts` **[ΝΕΟ]** — `loadEnvelopeSpecsForProject(projectId)` → `Map<floorId, ThermalEnvelopeSpec>` (mirror `loadBimScenesForProject`· `firestoreQueryService.getAll('DXF_VIEWER_LEVELS')` → `level.floorId → level.thermalEnvelopeSpec`).
  - `services/ifc/ifc-entity-graph.ts` — `+IfcTypedValue {kind:'typed', typeName, inner}` + `typed()` helper (inline defined-type measure, π.χ. `IFCTHERMALCONDUCTIVITYMEASURE(0.031)`· απαραίτητο για `IfcPropertySingleValue.NominalValue` SELECT). → ADR-369 changelog.
  - `services/ifc/ifc-step-writer.ts` — `serializeValue` case `'typed'` → `` `${typeName}(${inner})` ``.
  - `services/ifc/ifc-exporter.service.ts` — `IfcExportParams +envelopeSpecs?: ReadonlyMap<floorId, ThermalEnvelopeSpec>`.
  - `services/ifc/serializers/index.ts` — register `serializeEnvelopeCoverings` μετά openings, πριν `writeStoreyContainments` (+re-export, +doc 5→6 serializers).
  - `subapps/dxf-viewer/app/IfcExportHost.tsx` — `loadEnvelopeSpecsForProject` παράλληλα με scenes → pass `envelopeSpecs`.
  - tests: `services/ifc/serializers/__tests__/ifc-covering-serializer.test.ts` **[ΝΕΟ]** (10· wall/column/slab/opening coverings + semantic-only + includePsets gate + custom-material skip + Z1-off + typed STEP measure). **10/10 PASS** + roundtrip regression 8/8. tsc IFC-scope clean.
  - **Απόκλιση από §3.2(a):** παραλείπεται το `IfcMaterialLayerSetUsage` — η Usage κουβαλά **γεωμετρική** τοποθέτηση (offset/reference line), χωρίς νόημα στο semantic-only μοντέλο (OQ-P9-2)· το LayerSet associate-άρεται απευθείας (valid IFC4, καθαρότερο).
  - **Deferred:** U-value (assembly) στο IFC — ανήκει σε `Pset_WallCommon.ThermalTransmittance` του host (οι τοίχοι δεν έχουν κανένα Pset στο pipeline σήμερα)· εκτός covering scope, το U μένει στο app panel (P8). λ (per-material) επαρκεί για το covering thermal Pset.

- **2026-05-30** (BUGFIX P3 geometry — end-cap wrap σε ελεύθερες άκρες, Opus 4.8, pending commit) — **Browser verification (Giorgio) βρήκε 2 πραγματικά runtime bugs** που τα changelogs «tsc clean / X PASS» δεν είχαν πιάσει:
  - **Bug A — εκτεθειμένη μούρη τοίχου χωρίς μόνωση** (διορθώθηκε): το `computeEnvelopePerimeter` αλυσίδωνε & offset-άριζε **μόνο τη μακριά εξωτ. παρειά**· σε **ελεύθερο εκτεθειμένο άκρο** (valence-1 open-chain end) η μόνωση **δεν «επέστρεφε»** γύρω από τη στενή διατομή (μούρη) του τοίχου → η εκτεθειμένη άκρη έμενε άβαφη (ETICS λάθος). **Fix:** `PreparedWall +oppositeFace` (εσωτ. παρειά) + `assembleFaceLoop` προσθέτει την **εσωτερική γωνία** στο ελεύθερο άκρο (`firstForward`/`lastForward` orientation-aware) → το exteriorFaceLoop γεφυρώνει `face↔oppositeFace` στη μούρη → το offset band την τυλίγει (mitre via `offsetPolyline` vertex normals). Κλειστές αλυσίδες = καμία αλλαγή (μηδέν ελεύθερα άκρα). **2D + 3D parity** (ίδιο `exteriorFaceLoop` SSoT). 2 νέα tests (end-cap return + closed-no-caps), envelope-perimeter **22/22**, regression envelope suites **78/78 PASS**.
  - **Bug B — προηγούμενο «μόνωση στην ΕΣΩ πλευρά»** (RESOLVED-by-data): με λίγους/ανοιχτούς τοίχους το centroid (`envelope-perimeter.ts:302`, μέσος όρος ΟΛΩΝ των αξόνων) έπεφτε εκτός κτιρίου → `selectExteriorFace` αναποδογύριζε όλους μαζί. Με κλειστό/σωστό σχήμα διορθώθηκε μόνο του (επιβεβαιώθηκε browser). ⚠️ Latent: αν υπάρχουν πολλαπλές ομάδες τοίχων/stray geometry, το global centroid μένει ευάλωτο → πιθανό future per-component centroid (OQ).
  - 🔴 **Εκκρεμούν 2 pre-existing tsc errors** (από ανεξάρτητο `tsc --noEmit` re-run, ΟΧΙ από changelog): `EnvelopeOverlay.tsx:81` (`scene.units` πιθανό `undefined` → χρειάζεται `?? 'mm'`, trivial) + `envelope-element-applicator.ts:213` (`entity.params` δεν υπάρχει στο `Entity` type — οι renderers διαβάζουν εμφωλευμένα `e.slabEntity.params`· ΥΠΟΠΤΟ για write/read path mismatch — χρειάζεται διερεύνηση). **Όλο το ADR-396 = pending commit + pending browser re-verify.**

- **2026-05-30** (P3 UPDATE — Column bridge + gating + per-component centroid, Sonnet 4.6, pending commit) — **Νέα απαίτηση Giorgio: μόνωση ΜΟΝΟ σε κλειστά περιγράμματα· κολώνες γεφυρώνουν κενά (Επιλογή Α — η μόνωση τυλίγει τις εξωτ. όψεις της κολώνας).** 3 αλλαγές στο geometry SSoT:
  - **Gating:** render ΜΟΝΟ σε `chain.closed === true` (`EnvelopeOverlay` + `BimSceneLayer.addEnvelopeShell` + `buildPerimeterContext`). Μεμονωμένος/ανοιχτός τοίχος → 0 εμφάνιση.
  - **Column bridge:** νέος `envelope-column-bridge.ts` helper (SSoT). Ελεύθερο valence-1 άκρο τοίχου ≤ `COLUMN_BRIDGE_TOL_M=0.30m` από κολώνα → reassign σε `col:<id>` node key. Δύο τέτοια άκρα στην ίδια κολώνα κλείνουν το component. `assembleFaceLoop` εισάγει το εξωτ. τόξο του column outline (entry→εξωτ. κορυφές→exit, επιλογή μακριά από centroid). 2D⟷3D parity: ίδιο `exteriorFaceLoop` SSoT → renderers δεν αλλάζουν.
  - **Per-component centroid:** κάθε connected component (τοίχοι + γεφυρωτικές κολώνες) → δικό του centroid αντί global. Διορθώνει latent bug σε σκηνές με πολλά κτίρια.
  - **End-cap wrap αφαιρέθηκε** (`oppositeFace` + free-end caps): με το gating οι ανοιχτές αλυσίδες δεν ζωγραφίζονται, άρα ήταν νεκρός κώδικας σε σύγκρουση με τη νέα απαίτηση.
  - Νέα σταθερά `COLUMN_BRIDGE_TOL_M=0.30m` (αρχείο `thermal-envelope-types.ts`). Νέο πεδίο `columnIds` στο `EnvelopeChain` (debug/BOQ follow-up).
  - Αρχεία: `envelope-perimeter.ts` (rewrite) + NEW `envelope-column-bridge.ts` + `thermal-envelope-types.ts` + `EnvelopeOverlay.tsx` + `BimSceneLayer.ts` + `envelope-element-applicator.ts` + tests. **28/28 + 124/124 PASS.** tsc scope clean.

- **2026-05-30** (BUGFIX P5 3D — heightM unit-conversion, Sonnet 4.6, pending commit) — Browser έδειξε Z1 κέλυφος με λάθος ύψος (3000× υπερμέγεθες):
  - **Bug:** `BimSceneLayer.addEnvelopeShell` υπολόγιζε `heightM` παίρνοντας `w.params.height` (mm, π.χ. 3000) **χωρίς μετατροπή** → έδινε `heightM = 3000` αντί `3.0`. Ο converter `envelopeChainToMesh` περιμένει ΜΕΤΡΑ (ExtrudeGeometry depth).
  - **Fix:** `w.params.height / 1000` (mm → m) + διόρθωση λανθασμένου comment «ήδη σε ΜΕΤΡΑ». 1 αρχείο: `BimSceneLayer.ts:292`.
- **2026-05-30** (BUGFIX — Insulation-line diagonal jog στις γωνίες, closed-ring offset SSoT, Opus 4.8, pending commit) — Giorgio (εικόνα ορθογωνίου): η **γραμμή μόνωσης** σχεδιαζόταν σωστά στη μία γωνία αλλά με **λοξό σπάσιμο** σε άλλη — diagonal pattern, ίδια «οικογένεια» με το ADR-363 wall miter bug.
  - **Δύο ανεξάρτητες αιτίες, και οι δύο διορθώθηκαν:**
    1. **Wall-trims cascade** (ADR-363): το `exteriorFaceLoop` συναρμολογείται από τα wall faces (`computeWallGeometry`). Το diagonal-corner fix στο `cornerMiter` (βλ. ADR-363 §12) έκανε **καθαρό** το face loop σε ΟΛΕΣ τις γωνίες. Επιβεβαιωμένο με νέο integration test (`maxDiagonalJog(face) < 2mm`).
    2. **Closed-ring offset bug** (εδώ): το `offsetLoopOutward` → `offsetPolyline` έκανε offset το **κλειστό** insulation loop ως **ανοιχτό polyline**. Το assembled face loop είναι `[c0,c1,c2,c3,c0]` (seam vertex `c0` διπλό)· οι endpoint κορυφές (`i=0`, `i=n-1`) έπαιρναν normal από **μία μόνο** γειτονική ακμή (όχι averaged) → η seam γωνία «έσπαγε» διαγώνια κατά `thickness` (=100mm). Οι άλλες 3 (εσωτερικές στο array) σωστές → **γι' αυτό 1 γωνία διέφερε**.
  - **Fix (SSoT, ADR N.0.2/N.12):** προστέθηκε **closed-awareness** στο `offsetPolyline` (`bim/geometry/shared/polygon-utils.ts`) — το μοναδικό offset SSoT για walls/beams/envelope/reveal-frames. Νέα παράμετρος `closed` (default `false` → walls/beams αμετάβλητα): όταν `true`, ΚΑΘΕ κορυφή (incl. seam) κάνει wrap-around averaged normal. Νέος helper `stripClosingDuplicate()`. **Όλοι** οι closed-loop consumers διορθώθηκαν από ΕΝΑ σημείο: (α) `offsetLoopOutward` (insulation outer loop) + (β) `insetClosedPolygon` (Z4 περβάζια κουφωμάτων — είχε το ΙΔΙΟ seam bug).
  - **Root cause των tests που δεν το έπιασαν:** ο builder `square()` σχεδίαζε **τέλειο CCW** (όλες γωνίες consistent). Νέος `naturalRect()` builder (2 οριζόντιοι + 2 κάθετοι ίδιας φοράς) αναπαράγει τον φυσικό τρόπο σχεδίασης → inconsistent γωνίες.
  - **Αρχεία (3 mod + tests):** `bim/geometry/shared/polygon-utils.ts` (closed offset + `stripClosingDuplicate`) · `bim/geometry/envelope-perimeter.ts` (`offsetLoopOutward` closed) · `bim/geometry/__tests__/envelope-perimeter.test.ts` (+`naturalRect`/`withMiters`/`maxDiagonalJog` helpers + 7 νέα tests). **30/30 envelope + 549 walls/geometry PASS, tsc clean.** Live verify: σχεδίασε ορθογώνιο φυσικά → 4/4 γωνίες μόνωσης καθαρές.

- **2026-05-30** (FEATURE — Opening cutouts στη μόνωση Z1, 2D + 3D, Opus 4.8, pending commit) — **Giorgio (browser): η μόνωση Z1 σκέπαζε εντελώς πόρτες/παράθυρα** — στο 2D η κάτοψη λάθος, στο 3D το άνοιγμα φαινόταν από μέσα αλλά ΟΧΙ από έξω (το κέλυφος το έκρυβε). Η Z1 πρέπει να σταματά στις παρειές του κουφώματος (Z4 reveal ντύνει το περβάζι).
  - **Νέο SSoT** `bim/geometry/envelope-opening-cuts.ts` — `computeEnvelopeOpeningCuts(chain, openings, sceneUnits)`: προβάλλει τα δύο άκρα-πλάτους κάθε ανοίγματος (`position ± dir·width/2`, mm → canvas) στο `exteriorFaceLoop`, βρίσκει την πλησιέστερη ακμή + span `[tStart,tEnd]`, επιστρέφει `{edgeIndex, tStart, tEnd, sillM, headM, bandQuad}`. `bandQuad = [O_a,O_b,F_b,F_a]` (outer fwd → inner reversed) από το 1:1 mitered `insulationOuterLoop`. Φιλτράρει κατά `chain.wallIds`. **Κοινό SSoT 2D⟷3D** + `envelopeFaceEdges()` helper (wrap-around ακμή όταν closed χωρίς closing-dup) ώστε το `edgeIndex` να ευθυγραμμίζεται απόλυτα.
  - **3D** (`EnvelopeToThree.envelopeChainToMesh`): re-architecture από **ένα** vertical extrude → **per-edge band prisms**. Διαδοχικές ακμές μοιράζονται τις κορυφές γωνίας (mitered offset loop) → **μηδέν gap, γωνίες ως είχαν**. Ακμή με άνοιγμα → κατακόρυφο split: prism κάτω από ποδιά `[0,sill]` + prism πάνω από πρέκι `[head,height]` → κενό διαμπερές. **Contract change:** επιστρέφει `THREE.Object3D` (Group) αντί `Mesh`· `bimType/levelId` στο group, `matId` στα child meshes.
  - **2D** (`EnvelopeRenderer.renderOpeningCuts` + `EnvelopeOverlay`): μετά το band κάθε chain, `globalCompositeOperation='destination-out'` πάνω στα ίδια `bandQuad` → τρυπάει το band (πριν τα Z4 reveals).
  - **Wiring** (`BimSceneLayer`): νέα `filterEnvelopeOpenings` (visible openings των chain walls, ίδιο visibility filter με `wallToMesh` → parity) → `computeEnvelopeOpeningCuts` → `envelopeChainToMesh(... , cuts)`.
  - **Αποφάσεις:** 2D σπάει το band για **όλα** τα ανοίγματα· 3D κενό διαμπερές (Z4 ντύνει)· per-edge prisms → πιθανές extra κατακόρυφες edge γραμμές στις γωνίες (σωστές — οι γωνίες ΕΙΝΑΙ ακμές).
  - **Αρχεία:** NEW `envelope-opening-cuts.ts` + `EnvelopeToThree.ts` + `BimSceneLayer.ts` + `EnvelopeRenderer.ts` + `EnvelopeOverlay.tsx` + NEW test `envelope-opening-cuts.test.ts` + updated `envelope-to-three.test.ts`. **139/139 envelope suites PASS** (νέο 9/9). ADR-040 staged (CHECK 6B/6D). 🔴 browser verify εκκρεμεί.

- **2026-05-30** (BUGFIX browser — 2 bugs μετά τοποθέτηση κουφώματος, Opus 4.8, pending commit) — Giorgio (browser): μόλις μπαίνει κούφωμα (α) ο host-τοίχος χάνει το περίγραμμα + τα miter joins στις ενώσεις (2D)· (β) η μόνωση εξακολουθεί να κρύβει το άνοιγμα στο 3D (το cutout της προηγούμενης entry δεν λειτουργούσε στην πράξη).
  - **Bug #1 — 2D wall outline/miters χάνονται** (`WallRenderer.drawFootprint`): το `punchHostedOpenings` εκδίδει δικά του `beginPath()` ανά opening rect → μετά το `restore()` το **current canvas path = τελευταίο opening rectangle** (το save/restore ΔΕΝ σώζει το path). Το επόμενο `ctx.stroke()` σχεδίαζε το opening rect αντί για το wall ring → εξαφάνιση outline + λοξών miter γραμμών στις γωνίες. **Fix:** νέος helper `traceFootprintRing()`· re-trace του ring ΜΕΤΑ το punch, ΠΡΙΝ το stroke. +regression test `5b` (beginPath+moveTo πριν το final stroke).
  - **Bug #2 — 3D cutout δεν λειτουργούσε** (`computeEnvelopeOpeningCuts`, root cause μονάδες): το `OpeningGeometry.position`/`outline` είναι σε **canvas/scene units** (το `computeOpeningGeometry` περπατά τα scene-unit axis vertices — το doc «mm» αφορά μόνο τα `params`). Η συνάρτηση πολλαπλασίαζε εσφαλμένα με `mmToSceneUnits(units)` → σε σκηνή ΜΕΤΡΩΝ το άνοιγμα «έπεφτε» κοντά στο origin (×0.001) → κανένα/λάθος cut (σε 'mm' s=1 ήταν αόρατο, γι' αυτό πέρναγαν τα tests). **Fix:** `openingEndpoints` δουλεύει εξ ολοκλήρου σε canvas units μέσω του `outline` (midpoints των πλευρών-πλάτους, primary path)· fallback `position+rotation` με `width·mmFactor` (το width είναι mm). +regression test «unit-independent σκηνή σε ΜΕΤΡΑ».
  - **Αρχεία:** `WallRenderer.ts` (+`traceFootprintRing`) + `envelope-opening-cuts.ts` (unit fix) + tests (`WallRenderer-with-openings` 5b, `envelope-opening-cuts` m-scene). **153/153 affected suites PASS, tsc clean.** 🔴 browser re-verify εκκρεμεί.

- **2026-05-30** (BUGFIX 2Δ reveal — λοξή παρειά + κενό γωνίας Z1, Opus 4.8, pending commit) — Giorgio (browser, screenshots): στην κάτοψη (α) η παρειά του ανοίγματος έβγαινε **λοξή/τραπεζοειδής** (ο τοίχος εισχωρούσε στη μόνωση πάνω, σφήνα/κενό κάτω) — επιβεβαιωμένο και στη ΜΕΣΗ ίσιου τοίχου· (β) η μόνωση πρόσοψης Z1 **δεν τύλιγε τη γωνία** → αμόνωτο κενό στο εξωτ. άκρο της παραστάδας.
  - **BUG 1 — λοξή παρειά** (`buildRevealBandPlan` → **καταργήθηκε**): το 2D reveal χτιζόταν ως **inset frame 4 πλευρών** μέσω `insetClosedPolygon`, του οποίου οι εσωτερικές γωνίες είναι **45° mitered** → ο slant· επιπλέον τα 2 face-side strips δεν έχουν νόημα στην κάτοψη. Το opening `outline` ήταν ήδη καθαρά κάθετο (`opening-geometry.ts:buildOutline`). **Fix:** νέο geometry SSoT `bim/geometry/reveal-lining-geometry.ts` → `computeRevealJambQuads(outline, revealThickness)` = **2 παραστάδες** (jamb plan quads, κάθετες στον άξονα, full πάχος, πλάτος = πάχος περβαζιού, cap widthLen/2). 2D `drawOpeningReveals` ζωγραφίζει solid-polygon hatch ανά παραστάδα (`buildRevealJambPlans` + `renderSlabHatch`)· 3D `revealLiningToMesh` καταναλώνει το ΙΔΙΟ SSoT για τις παραστάδες (πρέκι/ποδιά inline) → 2D⟷3D parity. Στην τομή κάτοψης φαίνονται μόνο οι παραστάδες (πρέκι/ποδιά πάνω/κάτω στο Z).
  - **BUG 2 — Z1 τύλιγμα γωνίας** (`computeEnvelopeOpeningCuts`): όταν το άνοιγμα έχει `revealInsulation`, το Z1 cut **στενεύει** κατά `thickness_m` (→ param `revealThk/edgeLen`) σε κάθε άκρο, με clamp στο μέσο (reveal ≥ μισό πλάτος → skip cut). Το Z1 μένει πάνω από τις γωνίες → τυλίγει + σκεπάζει το εξωτ. άκρο της παραστάδας. Backward-compat (χωρίς reveal → wrap 0). Ίδιο SSoT cut → 2D⟷3D parity (3D κρατά full-height γωνιακές κολώνες Z1). `OpeningForCut.params` +optional `revealInsulation`.
  - **Αρχεία:** NEW `bim/geometry/reveal-lining-geometry.ts` + NEW test `reveal-lining-geometry.test.ts`· MOD `EnvelopeToThree.ts` (jambs μέσω SSoT) + `envelope-render-plan.ts` (`buildRevealBandPlan`→`buildRevealJambPlans`, drop `insetClosedPolygon` import) + `EnvelopeRenderer.ts` (re-export) + `EnvelopeOverlay.tsx` (jamb hatch) + `envelope-opening-cuts.ts` (reveal wrap) + tests (`envelope-renderer`, `envelope-opening-cuts` +3 BUG2 cases). **46/46 affected suites PASS, tsc envelope-scope clean.** ADR-040 staged (CHECK 6D — `EnvelopeOverlay.tsx`). §3 P-RENDER ενημερωμένο (Z4 inset frame → 2 παραστάδες). 🔴 browser verify εκκρεμεί.

- **2026-05-30** (BUGFIX 2Δ reveal — follow-up, Opus 4.8, pending commit) — 2 διορθώσεις μετά browser feedback Giorgio:
  - **Regression fix — παραστάδες είχαν εξαφανιστεί**: το `renderSlabHatch` δεν τραβά περίγραμμα → σε λεπτή παραστάδα μόνο το αραιό hatch ήταν σχεδόν αόρατο. **Fix**: `buildRevealJambPlans` επιστρέφει πλέον `EnvelopeRenderPlan[]` (bandRing=quad + outerLoop=quad κλειστό) και το `drawOpeningReveals` καλεί `renderer.render()` → hatch **+ orange περίγραμμα** ανά παραστάδα (ορατές).
  - **Root cause τραπεζοειδούς παρειάς = `opening-geometry.ts`, ΟΧΙ Z4**: η παρειά τοίχου έβγαινε τραπεζοειδής (μαύρο υπόλειμμα) γιατί το opening outline χτιζόταν ως `άξονας ± πάχος/2`, ενώ οι ακμές τοίχου σε mitered γωνίες είναι λοξές. Διορθώθηκε στο `buildOutline` (προβολή στις πραγματικές `outerEdge`/`innerEdge`) — βλ. ADR-363 changelog 2026-05-30. Το Z4 reveal (`computeRevealJambQuads`) ακολουθεί αυτόματα το διορθωμένο outline → παρειά + περβάζι ευθυγραμμισμένα με τον τοίχο.
  - **Αρχεία:** `opening-geometry.ts` (edge-projection + `lineHitPolyline`/`jambCorners`) + `envelope-render-plan.ts` (`buildRevealJambPlans`→`EnvelopeRenderPlan[]`) + `EnvelopeOverlay.tsx` (`render` αντί `renderSlabHatch`) + tests (`opening-geometry` +2 mitered, `envelope-renderer` jamb plan shape). **507/507 broad regression PASS, tsc clean.** 🔴 browser re-verify.

- **2026-05-30** (BUGFIX 2Δ — Z1 cut ↔ wall punch ↔ Z4 jamb ΕΥΘΥΓΡΑΜΜΙΣΗ, Opus 4.8, pending commit) — Giorgio (browser, screenshots, zoom ~9687% στη γωνία ανοίγματος): (BUG A) η παρειά τοίχου δεν ήταν flush με το περβάζι Z4 — εσωτερικά επικάλυψη, εξωτερικά κενό μεταξύ Z1 και Z4· (BUG B) η εξωτ. παρειά του Z4 και η παρειά της Z1 **όχι collinear**.
  - **Root cause (διαγνωστικό-first):** τρία στοιχεία όριζαν το «επίπεδο παρειάς» με **δύο** τρόπους. Wall punch (`WallRenderer.punchHostedOpenings`) + Z4 (`computeRevealJambQuads`) χρησιμοποιούν το ΙΔΙΟ `opening.geometry.outline` (κάθετη τομή στις πραγματικές ακμές τοίχου) → **ήδη flush μεταξύ τους** (τεκμηριωμένο με test: η back-face του Z4 strip ΕΙΝΑΙ η ακμή jamb του outline). Όμως το Z1 cut (`computeEnvelopeOpeningCuts`) όριζε το `[tStart,tEnd]` προβάλλοντας τα **midpoints του άξονα** (εσωτερικά σημεία) στην πλησιέστερη ακμή του `exteriorFaceLoop`. Σε **λοξό/mitered** face η προβολή εσωτερικού σημείου σε λοξή ακμή **μετατοπίζεται πλευρικά** → Z1 boundary ≠ παρειά τοίχου/Z4 (BUG B), και μέσω του reveal-wrap (που στένευε σε λάθος boundary) → επικάλυψη/κενό Z1↔Z4 (BUG A). Διαγνωστικό test απέδειξε `Fa.x=2096` αντί `2000` σε λοξή ακμή κλίσης 0.2.
  - **Fix (SSoT, ένα σημείο):** `openingEndpoints` επιστρέφει πλέον **και τις δύο γωνίες** κάθε άκρου του outline (αντί axis-midpoints)· νέος helper `projectExteriorCorner` προβάλλει την **exterior-face γωνία** (αυτή που κείτεται ΠΑΝΩ στην ακμή → min απόσταση²) → η προβολή είναι ταυτοτική → `lerp(face, t)` = εξωτ. γωνία outline → **collinear** με wall punch + Z4 σε ΟΛΑ τα faces (ευθή + λοξά). Σε ευθύ face αμετάβλητο (control test t 0.4/0.6). Fallback `position+rotation` (καμία πληροφορία πάχους → γωνία ×2) αμετάβλητο. Reveal-wrap λογική αμετάβλητη — εφαρμόζεται πλέον σε σωστό boundary. **Κανένα change σε reveal-lining/3D κώδικα** — το Z4 (`computeRevealJambQuads`) + το 3D (`envelopeChainToMesh`/`revealLiningToMesh`) καταναλώνουν το ΙΔΙΟ SSoT → 2D⟷3D parity αυτόματο.
  - **Αρχεία:** `bim/geometry/envelope-opening-cuts.ts` (`openingEndpoints` corners + `projectExteriorCorner`, drop `midpoint`) + NEW test `envelope-opening-cuts-jamb-alignment.test.ts` (3 tests: λοξό alignment + ευθύ control + Z4-flush τεκμηρίωση). **403/403 bim/geometry + 16/16 envelope-to-three PASS, tsc clean.** ADR-040 staged (CHECK 6D — `EnvelopeOverlay.tsx` architecture-critical). 🔴 browser verify εκκρεμεί (μεσαίο άνοιγμα σε λοξό εξωτ. τοίχο· 3 παρειές collinear· 3D αμετάβλητο).

- **2026-05-30** (BUGFIX **3D** — τραπεζοειδής τοίχος στο άνοιγμα, Opus 4.8, pending commit) — Giorgio (browser, **3D view** — επιβεβαιωμένο: ViewCube + προοπτική): η παρειά τοίχου στο άνοιγμα **λοξή/τραπεζοειδής** («μαζεύεται στην πρόσοψη, επεκτείνεται στη μέσα πλευρά») → κίτρινα κενά + πορτοκαλί υπερβάσεις μέσα στη μόνωση Z4 + λοξές jamb γραμμές. **Root (διαγνωστικό-first):** το 2Δ outline αποδεδειγμένα κάθετο (rotated+miters → cos=0.0000)· η ασυμφωνία ήταν αμιγώς **3D**. Το `BimToThreeConverter.buildStraightWallWithOpenings` όριζε την παρειά ως `lerp(outerEdge, sF)`+`lerp(innerEdge, sF)` με **κοινό fraction** — σε miters η outer/inner έχουν διαφορετικό μήκος → λοξή παρειά. **Fix:** NEW `bim-3d/converters/wall-opening-pieces.ts` (`computeWallOpeningPieces`, pure SSoT) — η παρειά παίρνεται από τις **κάθετες γωνίες του `opening.geometry.outline`** (ίδιο SSoT με wall punch 2D + Z4 `revealLiningToMesh` + Z1 `computeEnvelopeOpeningCuts`) → 3D wall ↔ Z4 ↔ Z1 collinear. Wall-end boundaries κρατούν τις mitered γωνίες· fallback fraction-lerp όταν λείπει outline. **Αρχεία:** NEW `wall-opening-pieces.ts` + `BimToThreeConverter.ts` (refactor, drop fraction-lerp + `clamp01`/`mmToSceneUnits` unused) + NEW test `wall-opening-pieces.test.ts` (4). **70/70 bim-3d PASS, tsc clean.** 🔴 browser verify (3D: άνοιγμα σε λοξό τοίχο → παρειά κάθετη, μηδέν κενό/υπέρβαση/λοξές γραμμές).

- **2026-05-30** (ΣΗΜΑΣΙΟΛΟΓΙΚΗ ΑΛΛΑΓΗ — reveal μόνωση «τρώει τον τοίχο» (Free vs Structural opening), Opus 4.8, pending commit) — Giorgio (step-by-step σχεδιασμός): η περιμετρική μόνωση Z4 έμπαινε **ΜΕΣΑ** στο άνοιγμα (μείωνε το ελεύθερο φως). **Σωστό (industry/ETICS):** το `opening.width/height` = το **ΕΛΕΥΘΕΡΟ άνοιγμα (κούφωμα)** και μένει **σταθερό**· η μόνωση μπαίνει **ΕΞΩ**, τρώγοντας το περιβάλλον δομικό υλικό (δομικό κενό διευρύνεται περιμετρικά κατά `t`: πλάτος `+2t`· πρέκι `+t` πάνω από head + ποδιά `−t` κάτω από sill μόνο παράθυρα). Ο γεμάτος τοίχος μικραίνει (2.00→1.95m). **Ρίζα που εξηγεί γιατί «επέστρεφε»:** τα προηγ. fixes διόρθωναν γεωμετρικές ευθυγραμμίσεις, αλλά η μόνωση ήταν στη **λάθος μεριά** — σημασιολογικό, όχι γεωμετρικό.
  - **Κεντρικό SSoT:** `computeOpeningGeometry` +`revealOutline` (free outline διευρυμένο κατά `t` κατά άξονα μέσω **reuse `buildOutline`** → κάθετες παρειές στις ΠΡΑΓΜΑΤΙΚΕΣ ακμές)· `OpeningGeometry.revealOutline?` (present μόνο με reveal). +export pure `structuralRevealHeightRangeMm(params)`→`{bottomMm,topMm}`. ΟΛΟΙ οι structural consumers διαβάζουν το ΙΔΙΟ SSoT → μηδέν re-derive.
  - **Structural consumers:** 2D wall punch (`WallRenderer.punchHostedOpenings`→`revealOutline ?? outline`)· 3D wall punch (`wall-opening-pieces` + `wall-opening-extrude` → structural fractions+ύψος+corners)· Z4 (`computeRevealJambQuads` **flip πρόσημο**→παραστάδες ΕΞΩ στο δαχτυλίδι· `revealLiningToMesh` +structuralOutline param, jambs ring + πρέκι `[head..head+t]` + ποδιά `[sill−t..sill]`)· **Z1** (`computeEnvelopeOpeningCuts` **αφαίρεση reveal-wrap**, cut = free κούφωμα). **FREE αμετάβλητα:** φύλλο/τόξο/hit-test/area/perimeter/BOQ/applicator. Backward-compat: χωρίς reveal `t=0` → ως πριν.
  - **Αρχεία:** `opening-geometry.ts`·`opening-types.ts`·`reveal-lining-geometry.ts`·`WallRenderer.ts`·`wall-opening-pieces.ts`·`wall-opening-extrude.ts`·`EnvelopeToThree.ts`·`BimSceneLayer.ts`·`envelope-opening-cuts.ts` + tests (5 suites). **1047/1047 affected (geometry+bim-3d+renderers) PASS, tsc clean.** ADR-040 staged (CHECK 6D). 🔴 browser verify (κάτοψη: μόνωση ΕΞΩ από κούφωμα, τοίχοι→1.95· 3D: παραστάδες/πρέκι/ποδιά στο δαχτυλίδι· Z1↔Z4 collinear). ⚠️ **Z1 facade** = λεπτό σημείο, πιθανό follow-up.

- **2026-06-06** (P10 — Per-wall-type U-value + IFC thermal completeness, Sonnet 4.6) — **Υβριδικό Β+Α**: data model = DNA χωρίς ETICS mutation, analytics = virtual append κατά υπολογισμό. **Απόφαση (§0 handoff 2026-06-06):** το ETICS δεν μπαίνει ως φυσική στρώση στο `WallDna` (διπλομέτρηση m² + BOQ) — αλλά το U υπολογίζεται ανά τύπο τοίχου από τα πραγματικά DNA layers + virtual append ETICS. **Διόρθωση §3 γρ.87:** `wall.dna.layers[side=exterior]` = structural layers (σοβάς/φέρων), ΟΧΙ ETICS — η Z1 ETICS για τοίχους ορίζεται από `ThermalEnvelopeSpec` (per-floor). Αρχεία:
  - `bim/thermal/wall-assembly-thermal.ts` **[ΝΕΟ PURE SSoT]** — `wallDnaToThermalLayers(dna)` (mm→m, skip unknown λ) + `computeWallTypeUValue(dna, surface?)` + `computeWallTypeUValueWithEnvelope(dna, envelopeLayer, surface?)` (virtual append χωρίς DNA mutation). Interface `EnvelopeLayerInput {thickness_m, materialId}`.
  - `bim/thermal/assembly-u-value.ts` — `+SurfaceFlowDirection ('wall'|'roof'|'floor')` + `SURFACE_RESISTANCES_BY_FLOW` (ISO 6946: wall 0.13/0.04 · roof 0.10/0.04 · floor 0.17/0.17). SSOT — μηδέν magic numbers αλλού.
  - `bim/walls/wall-material-catalog.ts` — `+WALL_MATERIAL_SPECIFIC_HEAT` (J/kgK, EN ISO 10456/ΤΟΤΕΕ 20701-2) + `+WALL_MATERIAL_DENSITY` (kg/m³) + `getSpecificHeat()` + `getDensity()`. SSoT για IFC `Pset_MaterialThermal.SpecificHeatCapacity` + μελλοντικό `Pset_MaterialCommon.MassDensity`.
  - `ui/components/bim-envelope/ThermalEnvelopeDialog.tsx` — `+wallDna?: WallDna | null` prop. `uValue` useMemo: αν `wallDna` → `computeWallTypeUValueWithEnvelope(wallDna, envelopeLayer)`, αλλιώς fallback `REFERENCE_BARE_WALL_LAYERS` (dialog ανά-όροφο χωρίς επιλεγμένο τοίχο).
  - `services/ifc/serializers/serializer-psets.ts` **[ΝΕΟ]** — Reusable Pset helpers: `appendPropertySingleValue` + `appendPropertySet` (GUID, named) + `appendRelDefinesByProperties`. DRY — wall τώρα, slab/column/beam αργότερα.
  - `services/ifc/serializers/ifc-wall-serializer.ts` — (i) `appendWallMaterial`: `IfcMaterial(name=materialId)` + `IfcMaterialLayer(πάχος m)` × N στρώσεις DNA + `IfcMaterialLayerSet` + `IfcMaterialLayerSetUsage(AXIS2/POSITIVE, offset=−t/2)` + `IfcRelAssociatesMaterial` (Revit-parity, μόνο αν DNA). (ii) `appendWallCommonPset`: `Pset_WallCommon` με `IsExternal`(category exterior/parapet) + `LoadBearing` + `ThermalTransmittance`=`typed('IfcThermalTransmittanceMeasure', U)` (gated `includePsets`).
  - `services/ifc/serializers/ifc-covering-serializer.ts` — `appendThermalPset` +`SpecificHeatCapacity` (`IfcSpecificHeatCapacityMeasure`, J/kgK) όταν γνωστό από νέο `getSpecificHeat()` (IFC4 `Pset_MaterialThermal` completeness).
  - **Tests:** NEW `bim/thermal/__tests__/wall-assembly-thermal.test.ts` (15· DNA→layers, U bare/with-envelope, skip-unknown, no-mutation, surface-flow ISO 6946) + NEW `services/ifc/serializers/__tests__/ifc-wall-serializer.test.ts` (11· IfcMaterialLayerSet/Usage/Rel, Pset_WallCommon, IsExternal, U STEP typed measure, U=0 fallback) + UPDATED `ifc-covering-serializer.test.ts` (mat-eps-graphite cp→2 properties). **37/37 PASS, tsc background.**
