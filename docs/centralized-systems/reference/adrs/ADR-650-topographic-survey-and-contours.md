# ADR-650 — Τοπογραφικές Αποτυπώσεις & Ισοϋψείς Γραμμές (Έρευνα Αγοράς + Αρχιτεκτονικό Blueprint)

- **Status**: 🔵 PROPOSED (research / documentation — καμία υλοποίηση σε αυτό το βήμα)
- **Date**: 2026-07-13
- **Category**: DXF Viewer / Topography / Research
- **Σχετικά**: ADR-635 (AutoCAD DXF import & culling gap σε geo-referenced συντεταγμένες ±1e6),
  ADR-462 (Canonical mm units + display), ADR-057 (`completeEntity` unified pipeline),
  ADR-034 (License policy — MIT/Apache/BSD/ISC only), SPEC-3D-004B/C/D (GenArc port catalogs —
  topographic domain **ρητά EXCLUDED**), ADR-366 (3D BIM viewer scope)

---

## Context (το πρόβλημα / γιατί)

Ερώτημα Giorgio: *«Υπάρχει μηχανισμός για δημιουργία ισοϋψών γραμμών, σαν αυτές που χρησιμοποιούμε
στα τοπογραφικά;»*

**Απάντηση από τον κώδικα (2026-07-13): ΟΧΙ.** Στοχευμένη έρευνα (`contour`, `isoline`, `ισοϋψ`,
`marching squares`, `TIN`, `DTM`, `Delaunay`, `topographic`, `elevation/spot height`,
`triangulation`, `grid interpolation`) δεν επέστρεψε **καμία** υλοποίηση παραγωγής ισοϋψών.

Ο DXF viewer μπορεί να **εισάγει/απεικονίσει** ήδη-σχεδιασμένες ισοϋψείς ως polylines/splines
(γεωμετρία μόνο, χωρίς σημασιολογία υψομέτρου), αλλά:
- ❌ δεν παράγει ισοϋψείς από δεδομένα υψομέτρου,
- ❌ δεν έχει έννοια επιφάνειας εδάφους (DTM/DEM), TIN, spot heights, breaklines.

Οι μόνες αναφορές σε «topographic» ζουν στα GenArc port-catalogs (`SPEC-3D-004B/C/D`), όπου το
τοπογραφικό domain του GenArc (ΕΓΣΑ'87 / ΝΟΚ / greedy-chain plot detection) **εξαιρέθηκε ρητά** ως
out-of-scope για το ADR-366 και **δεν μεταφέρθηκε ποτέ** στο Nestor. Αναφέρεται μόνο ως πιθανό
μελλοντικό, ξεχωριστό feature («Topographic Import Wizard»).

Ο Giorgio ζήτησε **βαθιά έρευνα αγοράς + κλάδου** και καταγραφή σε ADR. **Scope αυτού του ADR =
τεκμηρίωση έρευνας + μη-δεσμευτικό αρχιτεκτονικό blueprint.** Δεν προστίθεται κώδικας ή npm
package εδώ· η υλοποίηση είναι ξεχωριστή, μελλοντική απόφαση.

---

## 1. Έρευνα Αγοράς — Κορυφαίοι παίκτες / εφαρμογές

| # | Εφαρμογή | Ρόλος / Δύναμη | Κόστος (τάξη) | Ecosystem |
|---|----------|----------------|--------------|-----------|
| 1 | **Autodesk AutoCAD Civil 3D** 🏆 | **De facto κλαδικός ηγέτης** πλήρους ροής civil/topo: import raw survey → points/figures → surface/DTM → alignments → profiles → contours | ~$2.430/έτος (ή AEC Collection ~$3.100) | Autodesk (hardware-agnostic input) |
| 2 | **Trimble Business Center (TBC)** | **Κορυφαίο office-processing** GNSS/total-station: least-squares network adjustment, COGO, surfaces, volumes, QA | ~$250/μήνα· perpetual $5k–$15k | Trimble hardware |
| 3 | **Carlson Survey** | **Κορυφαίο ανεξάρτητο** (hardware-agnostic, όπως & MicroSurvey): CAD-based DTM/contours/COGO, integration με SurvCE | CAD-based | Ανεξάρτητο |
| 4 | **Bentley OpenRoads Designer** | Infrastructure/corridors, DTM, point clouds, COGO | enterprise | Bentley |
| 5 | **Leica Infinity** | Office suite GNSS/TS/level/scanner, least-squares, 3D | — | Leica Geosystems |
| 6 | **Esri ArcGIS Pro** | GIS / χαρτογραφία / cadastral, spatial analysis | enterprise | Esri |

**Συμπέρασμα:**
- **Κορυφαία ενιαία εφαρμογή (full civil/topo workflow) → AutoCAD Civil 3D.**
- **Κορυφαίο surveyor-office processing → Trimble Business Center.**
- **Κορυφαίο ανεξάρτητο (πολλαπλών κατασκευαστών) → Carlson Survey.**

Στην Ελλάδα η πλειονότητα των μηχανικών δουλεύει σε AutoCAD (+ εξειδικευμένα ελληνικά add-ons)
για σύνταξη τοπογραφικών διαγραμμάτων εξαρτημένων σε ΕΓΣΑ'87.

---

## 2. Κλαδικές Απαιτήσεις — Τεχνική ροή τοπογραφικής αποτύπωσης

**Στάδιο 1 — Συλλογή δεδομένων (data acquisition):**
| Μέθοδος | Χρήση | Ακρίβεια |
|---------|-------|----------|
| **GNSS / RTK** | Ανοιχτός ορίζοντας, μεγάλες εκτάσεις, γρήγορη κάλυψη | ~cm |
| **Total Station** | Αστικό/πυκνή βλάστηση, χωρίς ορατότητα δορυφόρων | sub-cm |
| **UAV φωτογραμμετρία** | Εκτάσεις >5–10 acres, orthomosaic + surface | 1–3cm H / 2–5cm V (με GCP/RTK-PPK) |
| **LiDAR** | Bare-earth κάτω από βλάστηση, complex as-builts | υψηλή πυκνότητα |

**Στάδιο 2 — Επεξεργασία σημείων:** points + figures/κωδικοί χαρακτηρισμού, **least-squares
network adjustment**, COGO υπολογισμοί.

**Στάδιο 3 — Επιφάνεια εδάφους (DTM/TIN):** **Delaunay triangulation** των σημείων +
**breaklines** (ρείθρα, άξονες δρόμων, ridgelines, τάφροι) που «σπάνε» τα τρίγωνα ώστε η
επιφάνεια να σέβεται τις ασυνέχειες. Οι breaklines είναι **κρίσιμες** για ακριβές μοντέλο.

**Στάδιο 4 — Ισοϋψείς (contours):** για κάθε TIN-τρίγωνο, η τομή του με οριζόντιο επίπεδο
δεδομένου υψομέτρου δίνει ένα ευθύγραμμο τμήμα· η ένωση όλων των τμημάτων ανά στάθμη παράγει τις
πολυγραμμές των ισοϋψών.
- **Contour interval**: αντιστρόφως ανάλογο της κλίμακας (μεγάλη κλίμακα → μικρό interval). Κανόνας
  ακρίβειας: μια ισοϋψής είναι ακριβής εντός ≈ **½ του interval**.
- **Major/index vs minor/intermediate** ισοϋψείς (π.χ. κάθε 5η έντονη + label υψομέτρου).
- **Spot heights**: σημειακά υψόμετρα όπου οι ισοϋψείς δεν επαρκούν (επίπεδες περιοχές).
- Η πυκνότητα σημείων πρέπει να είναι μεγαλύτερη όπου το ανάγλυφο μεταβάλλεται απότομα.

**Στάδιο 5 — Παραδοτέα:** τοπογραφικό διάγραμμα (κάτοψη), **profiles** (κατά μήκος τομές),
**cross-sections** (εγκάρσιες), πίνακες συντεταγμένων, εμβαδά, **όγκοι εκσκαφών/επιχώσεων**.

---

## 3. Ελληνικό Πλαίσιο (κρίσιμο για Nestor)

- **ΕΓΣΑ '87** — υποχρεωτική εξάρτηση· κάθε σημείο έχει μοναδικό ζεύγος συντεταγμένων στην ελληνική
  επικράτεια (απόλυτος προσδιορισμός).
- **Εξαρτημένο τοπογραφικό** — απαιτείται όταν το ακίνητο είναι εκτός σχεδίου / δομημένο αγροτεμάχιο.
- **Υπόβαθρο Κτηματολογίου** — ορθοφωτοχάρτης / κτηματολογικό απόσπασμα· απεικόνιση παλιάς + νέας
  γεωμετρίας· **πίνακας μεταβολών εμβαδού**· ανάλυση συντεταγμένων ΕΓΣΑ'87 κορυφών· **τεχνική
  περιγραφή μηχανικού** με αιτιολόγηση μεταβολής.
- **Ν. 4409/2016** — υποχρεωτική **ηλεκτρονική υπογραφή + υποβολή** στον ψηφιακό υποδοχέα του
  Ελληνικού Κτηματολογίου από τον συντάκτη (για συμβόλαια μεταβιβάσεων/αγοραπωλησιών/γονικών).
- **Υψομετρία** — υψόμετρα στις κορυφές του γεωτεμαχίου + **ισοϋψείς ή χαρακτηριστικά υψομετρικά
  σημεία** όπου απαιτείται.
- **Ευθύνη ορίων** — οι κύριοι/δικαιούχοι δηλώνουν ενυπογράφως τα όρια και ευθύνονται για την
  ακρίβειά τους.

---

## 4. Ισοϋψείς — Αλγόριθμοι & Βιβλιοθήκες (υλοποιήσιμο)

**Δύο κύριες προσεγγίσεις:**
1. **TIN-based** (πιο διαδεδομένο, πιστό στο ανάγλυφο): Delaunay των scattered σημείων →
   **marching / meandering triangles** ανά στάθμη υψομέτρου. Σέβεται breaklines ως constraints.
2. **Grid/DEM-based**: interpolation των σημείων σε κάνναβο → **marching squares**. Πιο ομαλό,
   λιγότερο πιστό σε απότομες ασυνέχειες χωρίς breaklines.

**JS βιβλιοθήκες (όλες permissive — ADR-034 συμβατές):**
| Βιβλιοθήκη | License | Ρόλος |
|-----------|---------|-------|
| `delaunator` (mapbox) | **ISC** ✅ | Ταχύτατο 2D Delaunay (flat typed-array structures) |
| `d3-tricontour` (Fil) | **ISC** ✅ | **Άμεσο match**: δέχεται `[x, y, value]` scattered σημεία, meandering triangles πάνω σε `d3.Delaunay.from`, `.thresholds()` (interval ή explicit array), `.contour(v)`, `.isobands()` → GeoJSON MultiPolygon |
| `d3-contour` (d3) | **ISC** ✅ | Marching squares για grid/DEM |

**Reuse στο repo:** υπάρχει ήδη `three@0.170` με earcut-style triangulation
(`bim-3d/converters/bim-three-faced-prism.ts`, `export/core/solid-fill-geometry.ts`,
`bim-three-shape-helpers.ts`) — αλλά αυτό είναι **polygon triangulation** (ear clipping για κλειστά
πολύγωνα), **όχι** Delaunay σκόρπιων σημείων. Άρα για TIN/ισοϋψείς **χρειάζεται νέα εξάρτηση**
(`delaunator` και/ή `d3-tricontour`).

---

## 5. Proposed Architecture — Blueprint (μη-δεσμευτικό)

Αν/όταν προχωρήσει το feature, φυσική θέση: **νέο subsystem `src/subapps/dxf-viewer/systems/topography/`**
με SSoT-καθαρή αλυσίδα, εναρμονισμένο με το υπάρχον entity/render pipeline:

```
[Survey points source]           →  TopoPointStore (SSoT: {x,y,z,code}[] σε canonical mm — ADR-462)
  (import CSV/DXF POINT/TEXT,        + breaklines ως constraint polylines
   ή manual entry)
        │
        ▼
[TIN builder]                    →  delaunator (constrained μέσω breakline edges)
        │                            → DTM/TIN model (triangles + edges)
        ▼
[Contour generator]              →  d3-tricontour: thresholds(minZ, maxZ, interval)
        │                            major/minor split, spot heights
        ▼
[Scene emit]                     →  DXF POLYLINE entities (major/minor layers) μέσω
                                     completeEntity (ADR-057) → undo + persistence
                                     + TextEntity labels υψομέτρου (text-engine)
```

**Σημεία προσοχής (reuse-first):**
- Έξοδος ισοϋψών = **κανονικά POLYLINE/LWPOLYLINE entities** στο υπάρχον scene → «τζάμπα»
  render/select/snap/export (DXF & Tekton), χωρίς νέο renderer.
- Υψόμετρα/labels = υπάρχον `TextEntity` + text-engine.
- Layers major/minor = υπάρχον layer system + χρώματα.
- Breaklines = υπάρχουσες polylines μαρκαρισμένες ως constraints.

---

## 6. Decision (αρχική σύσταση — μη δεσμευτική)

- **Δεν υλοποιείται τίποτα τώρα.** Αυτό το ADR καταγράφει έρευνα + κατεύθυνση.
- **Αν** εγκριθεί feature ισοϋψών: υιοθέτηση **`delaunator` + `d3-tricontour` (ISC)** για TIN-based
  contours από scattered σημεία, με έξοδο σε native POLYLINE entities.
- **Εναλλακτική** για ομαλά DEM/grid δεδομένα (π.χ. από drone/LiDAR raster): `d3-contour`
  (marching squares).
- **Ξεχωριστό, μεγαλύτερο feature** = «Topographic Import Wizard» (ΕΓΣΑ'87 / Κτηματολόγιο /
  Ν.4409 παραδοτέα) — να ανοίξει δικό του ADR αν προχωρήσει.

---

## 7. Consequences / Open Questions

- **ΕΓΣΑ'87 μεγάλες συντεταγμένες** (X~100k–900k, Y~3.7M–4.6M): προσοχή στο culling gap σε
  geo-referenced συντεταγμένες (πρβλ. **ADR-635**, ±1e6) — τα σημεία/ισοϋψείς μπορεί να πέφτουν
  εκτός default bounds. Πιθανή ανάγκη local-origin offset (survey base point).
- **Ακρίβεια vs performance**: πυκνά point clouds (LiDAR/drone) → χιλιάδες τρίγωνα· χρειάζεται
  decimation/LOD και πιθανώς web worker (πρβλ. worker patterns ADR-639).
- **Breaklines ως constraints**: `delaunator` δίνει unconstrained Delaunay· constrained CDT απαιτεί
  επιπλέον βήμα (π.χ. `poly2tri`, BSD) ή edge-recovery — να αξιολογηθεί.
- **Παραδοτέα ελληνικού πλαισίου** (πίνακες συντεταγμένων, εμβαδά, Ν.4409 export) είναι ξεχωριστό
  scope από την καθαρή γεωμετρία ισοϋψών.

---

## 8. Sources (έρευνα 2026-07-13)

- Autodesk — Topographic Survey Workflow: https://www.autodesk.com/industry/land-development/topographic-survey-workflow
- gitnux — Best Surveying / Land Survey / Survey-Mapping Software 2026: https://gitnux.org/best/surveying-software/ · https://gitnux.org/best/land-survey-software/
- Autodesk Community — Civil 3D vs Trimble vs Carlson: https://forums.autodesk.com/t5/civil-3d-forum/civil-3d-and-trimble-vs-carlson/td-p/5018256
- wifitalents — Best Surveying Software 2026 Buyer's Guide: https://wifitalents.com/best/surveying-software/
- Bench Mark — Survey Methods (GNSS/Total Stations/LiDAR): https://bench-mark.ca/survey-methods-explained/
- Wingtra — Drone surveying accuracy: https://wingtra.com/surveying-gis/ · SPH: https://www.sphengineering.com/news/drone-land-surveying
- LIDAR Magazine — Contours from Lidar & Breaklines: https://lidarmag.com/2018/01/12/should-contours-be-generated-from-lidar-data-and-are-breaklines-required/
- eci3d — Spot elevations vs contours: https://www.eci3d.com/blog/spot-elevations-when-to-use-them-instead-of-contour-lines
- civinnovate — Contour Lines in Surveying: https://civinnovate.com/2024/09/21/contour-lines-in-surveying/
- Taylor & Francis — Contour lines iteration + Delaunay terrain modeling: https://www.tandfonline.com/doi/full/10.1080/10095020.2022.2070553
- ScienceDirect — Dichotomizing interpolation / TIN refinement from contours: https://www.sciencedirect.com/science/article/abs/pii/S0098300414001587
- d3-tricontour (ISC): https://github.com/Fil/d3-tricontour · delaunator (ISC): https://github.com/mapbox/delaunator · d3-contour (ISC): https://github.com/d3/d3-contour
- Ελληνικό πλαίσιο — greenbuilding.gr, xyz.gr, geodimetro.gr, eurocosm.gr (ΕΓΣΑ'87 / Κτηματολόγιο / Ν.4409) · ΤΕΕ ΤΚΜ — Περιεχόμενα Τοπογραφικού Διαγράμματος: http://portal.tee.gr/portal/page/portal/teetkm/EPAGGELMATIKA/SYNERGASIA_TEETKM_YPHRESIES_DOMHSHS/top_diag/top_diag_entos/entos_sxediou.pdf

---

## Changelog

- **2026-07-13** — Δημιουργία ADR. Έρευνα αγοράς (Civil 3D / Trimble BC / Carlson), κλαδική ροή
  (acquisition → points → DTM/TIN → contours → deliverables), ελληνικό πλαίσιο (ΕΓΣΑ'87 /
  Κτηματολόγιο / Ν.4409), αλγόριθμοι ισοϋψών + JS βιβλιοθήκες (delaunator/d3-tricontour/d3-contour,
  όλες ISC), αρχιτεκτονικό blueprint `systems/topography/`. **Status PROPOSED — καμία υλοποίηση.**
