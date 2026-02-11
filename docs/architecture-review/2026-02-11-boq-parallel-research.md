# Παράλληλη Έρευνα: Σύστημα Επιμετρήσεων (BOQ) για Nestor App

**Ημερομηνία:** 2026-02-11
**Αρχείο:** `docs/architecture-review/2026-02-11-boq-parallel-research.md`
**Σκοπός:** Τεκμηρίωση για ΑΤΟΕ, IFC Quantity Sets, DXF auto-recognition, Excel import/export.

---

## ΘΕΜΑ 1: Ελληνικό ΑΤΟΕ - Κατάλογος Κατηγοριών/Υποκατηγοριών

## 1.1 Τι βρέθηκε σε επίσημες πηγές

1. Η επίσημη πηγή αναφοράς για ΑΤΟΕ εμφανίζεται μέσω GGDE/SATE ως τριμηνιαία πακέτα/αρχεία (ΑΤΟΕ ανά τρίμηνο).
2. Τα αρχεία ΑΤΟΕ που διατίθενται δημόσια είναι κυρίως PDF (πολλά scanned), με μεγάλο όγκο κωδικών άρθρων.
3. Στις νεότερες πρακτικές δημοπράτησης (NET OIK / Περιγραφικά Τιμολόγια) εμφανίζονται σαφείς ομάδες οικοδομικών εργασιών και κωδικοί αναθεώρησης ΟΙΚ.

## 1.2 Επιβεβαιωμένες ομάδες (από περιγραφικά τιμολόγια ΟΙΚ)

Από το «Περιγραφικό Τιμολόγιο Εργασιών Οικοδομικών Έργων - Έκδοση 4.0» προκύπτουν τουλάχιστον οι ακόλουθες ομάδες:

1. `Ομάδα 1: ΟΙΚΟΔΟΜΙΚΑ (Α) - Χωματουργικά, καθαιρέσεις`
2. `Ομάδα 2: ΟΙΚΟΔΟΜΙΚΑ (Β) - Σκυροδέματα`
3. `Ομάδα 4: ΟΙΚΟΔΟΜΙΚΑ (ΣΤ) - Κατασκευές ξύλινες ή μεταλλικές`
4. `Ομάδα 5: ΟΙΚΟΔΟΜΙΚΑ (Ε) - Επενδύσεις, επιστρώσεις`

Σημείωση: το συγκεκριμένο extract είναι δείγμα/τμήμα 20σέλιδου περιγραφικού τεύχους, όχι ο πλήρης ενιαίος κατάλογος όλων των άρθρων ΑΤΟΕ.

## 1.3 Μονάδες μέτρησης που προκύπτουν στα άρθρα

Από τα ίδια τεύχη και από παραδείγματα άρθρων:

1. `m3` (κυβικό μέτρο)
2. `m2` (τετραγωνικό μέτρο)
3. `kg` (χιλιόγραμμο)
4. `ton` (τόνος)
5. `τεμ` (τεμάχιο)

## 1.4 Τυπική φύρα (waste %)

Κρίσιμο εύρημα:

1. Στα επίσημα κείμενα που εξετάστηκαν (ΑΤΟΕ/ΝΕΤ ΟΙΚ excerpts) **δεν βρέθηκε ενιαίος πίνακας “τυπικής φύρας %” ανά κατηγορία** ως υποχρεωτικό καθολικό πεδίο.
2. Η λογική των δημοσίων τιμολογίων είναι κυρίως «τιμή μονάδας άρθρου» με ενσωμάτωση δαπανών σύμφωνα με περιγραφή/ΕΤΕΠ, όχι ξεχωριστό universal waste-column.

Πρακτική σύσταση για Nestor:

1. Να κρατηθεί πεδίο `wasteFactorDefault` σε επίπεδο template (configurable), όχι ως «θεσμικά δεσμευμένη σταθερά».
2. Να υποστηρίζονται 3 επίπεδα: `global default`, `category default`, `item override`.

## 1.5 Για τον «πλήρη κατάλογο»

1. Ο πλήρης κατάλογος άρθρων ΑΤΟΕ υπάρχει πρακτικά στα τριμηνιαία αρχεία (πολλά εκατοντάδες/χιλιάδες άρθρα), αλλά μεγάλο μέρος των διαθέσιμων αρχείων είναι scanned και δύσκολα μηχαναγνώσιμο.
2. Για αξιόπιστη μηχανοποίηση χρειάζεται ETL από πρωτογενές ψηφιακό source (όχι OCR-only PDF), ή επίσημη δομημένη εξαγωγή (zip/xls/db) από φορέα.

---

## ΘΕΜΑ 2: buildingSMART IFC Quantity Sets

## 2.1 Standard quantity types (IFC)

Το buildingSMART/IFC ορίζει ως βασικούς quantity τύπους:

1. `IfcQuantityCount`
2. `IfcQuantityLength`
3. `IfcQuantityArea`
4. `IfcQuantityVolume`
5. `IfcQuantityWeight`
6. `IfcQuantityTime`

Επιπλέον σε IFC4.3 υπάρχει και `IfcQuantityNumber` (derived numeric quantity), ενώ το enum templates παραμένει με Q_LENGTH/Q_AREA/Q_VOLUME/Q_COUNT/Q_WEIGHT/Q_TIME.

## 2.2 Mapping IFC -> ΑΤΟΕ/ΟΙΚ πρακτική

| IFC Type | Ελληνική χρήση (ΑΤΟΕ/ΟΙΚ) | Τυπική μονάδα |
|---|---|---|
| `IfcQuantityCount` | Κουφώματα, πόρτες, είδη υγιεινής, συσκευές, τεμάχια ειδών | `τεμ` |
| `IfcQuantityLength` | Σωληνώσεις, καλωδιώσεις, σοβατεπί, στηθαία, γραμμικά στοιχεία | `m` |
| `IfcQuantityArea` | Επιχρίσματα, χρωματισμοί, επενδύσεις τοίχων, δάπεδα, ψευδοροφές | `m2` |
| `IfcQuantityVolume` | Σκυρόδεμα, εκσκαφές, επιχώσεις, όγκοι υλικών | `m3` |
| `IfcQuantityWeight` | Οπλισμός, χαλυβουργικά/μεταλλικά σε βάρος | `kg`, `ton` |
| `IfcQuantityTime` | Εργασίες ημερομισθίων/μισθώσεις εξοπλισμού/χρονικά κονδύλια | `h`, `day` |

## 2.3 Αρχιτεκτονικό συμπέρασμα για Nestor

1. Το BOQ schema πρέπει να είναι IFC-compatible στα quantity dimensions.
2. Η αντιστοίχιση σε ελληνικά άρθρα γίνεται με `articleCode` + `measurementType` + `unit`.
3. Δεν αρκεί μόνο μονάδα (`m2`): χρειάζεται και σημασιολογία (`area_internal_wall_plaster`, `area_floor_finish`, κ.λπ.).

---

## ΘΕΜΑ 3: DXF - Αυτόματη Αναγνώριση Χώρων

## 3.1 Πρακτικό pipeline για DXF floorplans

1. **DXF parsing**: entities/layers/blocks (`LWPOLYLINE`, `LINE`, `ARC`, `INSERT`).
2. **Normalization**: explode blocks όπου χρειάζεται, transform σε world coords, layer filtering.
3. **Linework graph build**: node snapping, segment merging, tolerance cleanup.
4. **Closed-room detection**: polygonization/cycle detection.
5. **Semantic enrichment**: openings (doors/windows), symbols (sanitary/kitchen), adjacency graph.
6. **Room classification** (rules + ML/GNN).
7. **BOQ extraction**: area/perimeter/count/volume/time placeholders.

## 3.2 Αλγόριθμοι για closed rooms

1. **Polyline closed flag**: εκμετάλλευση `LWPOLYLINE_CLOSED` όπου υπάρχει.
2. **Planar graph polygonization**: `shapely.polygonize()` για κλειστά πολύγωνα από linework.
3. **Diagnostics**: `polygonize_full()` για dangles/cut edges/invalid rings.
4. **Graph cycles**: `networkx.cycle_basis()` ή `minimum_cycle_basis()` όταν η γεωμετρία δεν είναι καθαρή.

## 3.3 Αναγνώριση blocks (πόρτες/παράθυρα/είδη υγιεινής)

Με `ezdxf`:

1. Εντοπισμός `INSERT` entities.
2. Matching σε block name/layer/attributes.
3. Ανάγνωση transform (scale/rotation) ώστε να προκύπτει πραγματική γεωμετρική θέση.
4. Rule dictionaries ανά CAD standard γραφείου (block naming conventions).

## 3.4 AI models για room classification

### Μοντέλα/κατευθύνσεις από papers

1. Multi-task floorplan recognition (rooms + boundaries + openings): arXiv:1908.11025.
2. Graph Neural Networks σε floor plan graphs (room adjacency): arXiv:2108.05947.
3. Graph/vector-based indoor element classification framework: ISPRS IJGI 2021 (MDPI).

### Δεδομένα/datasets

1. CubiCasa5K (annotated floorplans, open dataset repo).
2. House-GAN / RPLAN-derived vector floorplan ecosystem (graph-based representations).
3. HouseExpo (room-labeled indoor layouts).

## 3.5 Open-source libraries (άμεσα αξιοποιήσιμες)

1. `ezdxf` (DXF parsing, entities, blocks, xref basics).
2. `Shapely` (polygonize / geometry ops).
3. `NetworkX` (cycle and graph analysis).

---

## ΘΕΜΑ 4: Excel Import/Export Format

## 4.1 Τι δείχνουν τα ελληνικά τεύχη/τιμολόγια στην πράξη

Από ελληνικά PDF τιμολογίων/προσφορών/δημοπρατήσεων προκύπτει σταθερό μοτίβο στηλών:

1. `Α/Α`
2. `Άρθρο` ή `Κωδικός`
3. `Περιγραφή`
4. `Μονάδα` / `Μονάδα μέτρησης`
5. `Ποσότητα`
6. `Τιμή μονάδας`
7. `Δαπάνη` / `Αξία`

Άρα το format που πρότεινες είναι πλήρως συμβατό με ελληνική πρακτική.

## 4.2 Προτεινόμενο template για Nestor (import/export)

### Sheet 1: `BOQ_Items`

Υποχρεωτικές στήλες:

1. `A/A`
2. `BuildingCode`
3. `Scope` (`building` | `unit`)
4. `UnitCode` (nullable)
5. `ArticleCode` (π.χ. `ΟΙΚ-7311` ή custom)
6. `Category`
7. `Description`
8. `IfcQuantityType` (`count|length|area|volume|weight|time`)
9. `Unit`
10. `EstimatedQty`
11. `WasteFactorPct`
12. `NetQty` (formula)
13. `MaterialUnitCost`
14. `LaborUnitCost`
15. `EquipmentUnitCost`
16. `TotalUnitCost` (formula)
17. `TotalCost` (formula)
18. `LinkedPhaseCode` (nullable)
19. `LinkedTaskCode` (nullable)
20. `Source` (`manual|dxf_auto|dxf_verified`)
21. `Status` (`draft|confirmed|completed`)
22. `Notes`

### Sheet 2: `Dictionaries`

1. Units dictionary
2. IFC quantity types
3. Category dictionary
4. Allowed scopes/statuses/sources

### Sheet 3: `Project_Rollup`

1. Aggregation ανά Building
2. Aggregation ανά Category
3. Totals Υλικά/Εργασία/Εξοπλισμός
4. Variance (`Actual - Estimated`)

## 4.3 Import rules

1. Strict validation σε unit + ifcQuantityType συμβατότητα.
2. Duplicate detection με key: `(BuildingCode, Scope, UnitCode, ArticleCode, Description)`.
3. Rejection report με row-level errors.
4. Versioned import batches για audit/rollback.

---

## Συνολικά Συμπεράσματα

1. Η ελληνική πρακτική μπορεί να υποστηριχθεί άμεσα με schema τύπου `Α/Α-Άρθρο-Μονάδα-Ποσότητα-Τιμή-Δαπάνη`.
2. Για modularity και διεθνή διαλειτουργικότητα, ο πυρήνας BOQ πρέπει να είναι IFC-quantity-aware.
3. Για DXF automation, ο ασφαλής δρόμος είναι hybrid pipeline: rules + geometry + graph + ML classification.
4. Το ζήτημα «πλήρης ΑΤΟΕ κατάλογος» απαιτεί αξιόπιστο structured source (όχι μόνο OCR scanned PDFs) για production-grade master data.

---

## Πηγές

### Επίσημες/θεσμικές

1. buildingSMART IFC Quantity Sets (IFC4.3):
https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/concepts/Object_Definition/Quantity_Sets/content.html

2. buildingSMART IfcQuantityResource / entities:
https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2/HTML/toc.htm

3. buildingSMART enum Q_LENGTH/Q_AREA/Q_VOLUME/Q_COUNT/Q_WEIGHT/Q_TIME:
https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2/HTML/schema/ifckernel/lexical/ifcsimplepropertytemplatetypeenum.htm

4. GGDE portal / downloads categories:
https://www.ggde.gr/index.php?option=com_docman&task=cat_view&Itemid=38

5. SATE index for Αναλυτικά Τιμολόγια (ΑΤΟΕ ανά τρίμηνο):
https://sate.gr/html/timologia.aspx

6. ΑΤΟΕ τριμηνιαίο αρχείο (ενδεικτικό, 1ο τρίμηνο 2012):
https://sate.gr/%CE%A3%CE%A5%CE%9D%CE%A4%CE%95%CE%9B%CE%95%CE%A3%CE%A4%CE%95%CE%A3/at_atoe_201201.pdf

### Περιγραφικά/δημοπράτησης ΟΙΚ (για ομάδες, μονάδες, δομή άρθρων)

7. Περιγραφικό Τιμολόγιο ΟΙΚ (Edition 4.0 excerpt):
https://ddm.gov.gr/wp-content/uploads/2017/09/%CE%A0%CE%95%CE%A1%CE%99%CE%93%CE%A1%CE%91%CE%A6%CE%99%CE%9A%CE%9F-%CE%A4%CE%99%CE%9C%CE%9F%CE%9B%CE%9F%CE%93%CE%99%CE%9F-1.pdf

8. Τιμολόγιο μελέτης ΟΙΚ (UoM):
https://www.uom.gr/assets/site/public/nodes/6742/4371-TIMOLOGIO-MELETHSsigned.pdf

9. Τιμολόγιο δημοπράτησης (Δήμος Αθηναίων):
https://www.cityofathens.gr/wp-content/uploads/2024/06/timologio-dimopratisis-ergo-syntiriseis-scholikon-ktirion-dimoy-athinaion-7i-dimotiki-koinotita.pdf

10. Τιμολόγιο τμήματος (Δήμος Αθηναίων):
https://www.cityofathens.gr/wp-content/uploads/2024/10/timologio-tmima-3-syntiriseis-veltioseis-ktirion-scholeion-dimoy-athinainon.pdf

### DXF / Geometry / Graph / AI

11. ezdxf Blocks tutorial (INSERT handling):
https://ezdxf.readthedocs.io/en/stable/tutorials/blocks.html

12. ezdxf LWPolyline (`closed`, `is_closed`):
https://ezdxf.readthedocs.io/en/stable/dxfentities/lwpolyline.html

13. Shapely polygonize:
https://shapely.readthedocs.io/en/2.1.2/reference/shapely.polygonize.html

14. Shapely polygonize_full:
https://shapely.readthedocs.io/en/maint-2.0/reference/shapely.polygonize_full.html

15. NetworkX cycle_basis:
https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.cycles.cycle_basis.html

16. NetworkX minimum_cycle_basis:
https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.cycles.minimum_cycle_basis.html

17. Deep Floor Plan Recognition (arXiv:1908.11025):
https://arxiv.org/abs/1908.11025

18. Room Classification on Floor Plan Graphs (arXiv:2108.05947):
https://arxiv.org/abs/2108.05947

19. Indoor Elements Classification on Floor Plan Graphs (MDPI ISPRS IJGI 2021):
https://www.mdpi.com/2220-9964/10/2/97

20. CubiCasa5K dataset repo:
https://github.com/CubiCasa/CubiCasa5k

---

## Σημείωση αξιοπιστίας

Η έρευνα βασίστηκε σε πρωτογενείς πηγές όπου ήταν εφικτό. Για τον πλήρη article-level κατάλογο ΑΤΟΕ με ονομασία+μονάδα+φύρα, τα δημόσια διαθέσιμα scanned τριμηνιαία PDFs δεν δίνουν αξιόπιστη machine-readable εξαγωγή χωρίς εξειδικευμένο OCR/validation pipeline.
