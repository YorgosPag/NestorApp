# ADR-650 — Τοπογραφικές Αποτυπώσεις & Ισοϋψείς Γραμμές (Έρευνα Αγοράς + Αρχιτεκτονικό Blueprint)

- **Status**: 🔵 PROPOSED (research / documentation — καμία υλοποίηση σε αυτό το βήμα)
- **Date**: 2026-07-13
- **Category**: DXF Viewer / Topography / Research
- **Σχετικά**: ADR-635 (culling gap σε geo-referenced συντεταγμένες ±1e6), ADR-462 (canonical mm),
  ADR-057 (`completeEntity` pipeline), ADR-034 (License policy — MIT/Apache/BSD/ISC only),
  ADR-639 (WebGL line layer), ADR-366 (3D BIM viewer scope), SPEC-3D-004B/C/D (GenArc topographic EXCLUDED)

> **Ιστορικό ερευνας**
> - **Round 1** (2026-07-13): αρχική έρευνα αγοράς + κλαδική ροή + ελληνικό πλαίσιο (§1–§4 παρακάτω).
> - **Round 2** (2026-07-13): **βαθιά έρευνα με 6 παράλληλους πράκτορες** (orchestrator, έγκριση Giorgio)
>   σε: (α) τεχνική δυτικών ηγετών, (β) AI/ML για topo & point clouds, (γ) κορυφαία κινεζική αγορά,
>   (δ) SOTA αλγόριθμοι + άδειες, (ε) αυτοματοποιημένα παραδοτέα + ελληνικό δίκαιο, (στ) differentiators.
>   → ενσωματώθηκε στα §5–§11.

---

## Context (το πρόβλημα / γιατί)

Ερώτημα Giorgio: *«Υπάρχει μηχανισμός για δημιουργία ισοϋψών, σαν αυτές στα τοπογραφικά;»*
**Απάντηση από τον κώδικα: ΟΧΙ.** Καμία υλοποίηση contour/isoline/TIN/DTM/marching-squares. Οι μόνες
αναφορές σε «topographic» ζουν στα GenArc port-catalogs (`SPEC-3D-004B/C/D`) όπου το τοπογραφικό domain
**εξαιρέθηκε ρητά** και δεν μεταφέρθηκε ποτέ.

Στόχος (Giorgio, Round 2): **να χτίσουμε AI-native παραγωγή τοπογραφικών/ισοϋψών που θα ξεπερνά ακόμη
και τους κορυφαίους** (Civil 3D / Trimble / Carlson / CASS), αξιοποιώντας ό,τι «μαγικό & αυτοματοποιημένο»
δίνει η εποχή της ΤΝ. **Scope αυτού του ADR = τεκμηρίωση έρευνας + αρχιτεκτονικό blueprint.** Δεν
προστίθεται κώδικας/npm package εδώ· η υλοποίηση είναι ξεχωριστή, επόμενη απόφαση.

---

## 1. Έρευνα Αγοράς — Κορυφαίοι παίκτες / εφαρμογές (παγκόσμια)

| # | Εφαρμογή | Ρόλος / Δύναμη | Κόστος (τάξη) |
|---|----------|----------------|--------------|
| 1 | **AutoCAD Civil 3D** 🏆 | **De facto ηγέτης** full civil/topo: points→figures→surface/DTM→alignments→profiles→contours | ~$2.430–2.870/έτος |
| 2 | **Trimble Business Center** | **Κορυφαίο office-processing** GNSS/TS: least-squares, COGO, **AI point-cloud classification** | ~$250/μήνα· perpetual $5k–15k |
| 3 | **Carlson Survey** | **Κορυφαίο ανεξάρτητο** (hardware-agnostic): CAD-based DTM/contours/COGO, one-time license | one-time ~$2.350 |
| 4 | **Bentley OpenRoads / iTwin** | Infrastructure/corridors· **Copilot (LLM) + Label Optimizer (ML)** | enterprise |
| 5 | **Leica Infinity / Esri ArcGIS Pro** | Office GNSS/scanner· **ArcGIS: PointCNN/RandLA-Net + SAM** | enterprise |
| 6 | **南方CASS (China)** | **~90% κινεζική αγορά** cadastral/topo· breakline-aware contour clipping | (δομικά ξεπερασμένο, βλ. §7) |

**Συμπέρασμα:** top ενιαία εφαρμογή → **Civil 3D**· top office-processing → **Trimble BC**· top ανεξάρτητο
→ **Carlson**· top κινεζικό → **CASS**. Στην Ελλάδα κυριαρχεί AutoCAD + ελληνικά add-ons, εξαρτημένα ΕΓΣΑ'87.

---

## 2. Κλαδικές Απαιτήσεις — Τεχνική ροή

1. **Συλλογή:** GNSS/RTK (~cm), Total Station (sub-cm), **UAV φωτογραμμετρία** (1–3cm H/2–5cm V με GCP/PPK),
   **LiDAR** (bare-earth κάτω από βλάστηση).
2. **Επεξεργασία σημείων:** points + **feature/figure codes**, least-squares adjustment, COGO.
3. **Επιφάνεια (DTM/TIN):** **Delaunay** + **breaklines** (constraints) — ρείθρα/άξονες/ridgelines/τάφροι.
4. **Ισοϋψείς:** τομή TIN-τριγώνων με οριζόντια επίπεδα → segments → πολυγραμμές. **Contour interval**
   αντ. ανάλογο κλίμακας· ακρίβεια ≈ ½ interval· **major/minor** (index κάθε 5η)· spot heights· labels.
5. **Παραδοτέα:** διάγραμμα (κάτοψη), profiles (κατά μήκος), cross-sections, πίνακες συντεταγμένων,
   εμβαδά, **όγκοι εκσκαφών (cut/fill)**.

---

## 3. Ελληνικό Πλαίσιο — Βασικά (πλήρες compliance στο §10)

ΕΓΣΑ'87 (EPSG:2100) εξάρτηση υποχρεωτική· εξαρτημένο διάγραμμα· υπόβαθρο Κτηματολογίου· πίνακας μεταβολών
εμβαδού· τεχνική περιγραφή/**δήλωση μηχανικού**· **Ν.4409/2016** ηλεκτρονική υποβολή· υψόμετρα κορυφών +
ισοϋψείς/χαρακτηριστικά σημεία.

---

## 4. Ισοϋψείς — Δύο προσεγγίσεις

- **TIN-based** (πιο πιστό στο ανάγλυφο): Delaunay + breaklines → **marching/meandering triangles** ανά στάθμη.
- **Grid/DEM-based** (ομαλότερο): interpolation σε κάνναβο → **marching squares**.

---

# ΒΑΘΙΑ ΕΡΕΥΝΑ (ROUND 2) — §5 έως §11

## 5. Βαθιά τεχνική των δυτικών ηγετών

**Field-to-Finish = FSM πάνω σε code tokens.** Το Civil 3D «Field to Finish» δεν είναι manual drafting:
κάθε σημείο φέρει στο description έναν κωδικό feature + connectivity token (`B`=begin line, `C`=curve,
`MC`=multi-point curve, `E`=end). Ένας **Linework Code Set** (parser/FSM) διαβάζει το token stream και
βγάζει polylines/arcs αυτόματα στο import. Το ίδιο μοτίβο σε Trimble (`start/end join sequence`), Carlson
(`ST/E`, με **inference** ορίων από επανάληψη κωδικού), Bentley (`Feature Definition`), Leica. **Σύγκλιση
όλης της βιομηχανίας** → μην το ανασχεδιάσουμε· υποστήριξέ το, αλλά κάν' το self-healing (§9).

**TIN = Delaunay + Constrained Delaunay (CDT) για breaklines.** Το plain Delaunay **δεν εγγυάται** ότι ένα
breakline segment θα επιβιώσει ως triangle edge — χρειάζεται CDT (insert constraint + local re-triangulate).
**«False flat triangles» trap:** TIN χτισμένο κατευθείαν από ψηφιοποιημένες ισοϋψείς (αντί spot points)
δίνει τρίγωνα με 3 κορυφές στο ίδιο υψόμετρο → οριζόντιες «ταράτσες», μηδενικό gradient, ασταθή contour
crossings. Λύση: constrained edges κατά μήκος contour/breaklines (§8 pitfalls).

**AI στους incumbents (κατάσταση 2026):**
- **Trimble BC**: πραγματικό deep-learning point-cloud classification (ground/vegetation/building/poles/
  wires/noise), 100% auto, + **custom model training**. **ΚΕΝΟ:** classification και TIN/breakline είναι
  **ξεχωριστά manual βήματα** — κανείς δεν κλείνει το loop «classified curb points → auto breaklines → TIN
  → contours».
- **Bentley**: **Copilot** (LLM design assistant) + **Label Optimizer** (ML auto-placement labels —
  άμεσα σχετικό με contour labeling).
- **Esri ArcGIS**: PointCNN/RandLA-Net/SQN + productized **SAM** για imagery segmentation.
- **Civil 3D**: μόνο in-app AI Q&A (όχι generation)· generative ζει στο Forma (site layout).

**Smoothing που κάνουν οι pros:** GRASS **RST** (Regularized Spline with Tension — tension + smoothing
params) πολύ καλύτερο από naive linear TIN για θορυβώδη δεδομένα· **regularize-then-contour** (fine grid
resample πριν το contouring) δίνει ομαλότερες ισοϋψείς που σέβονται breaklines. Global Mapper παράμετροι
ως checklist «τι πρέπει να εκθέτει ένα σοβαρό contour tool»: interval, minor/major multiplier, spatial
res, simplification (Douglas-Peucker), smooth (spline), min-contour-length, spot elevations, find-peaks.

## 6. AI/ML για topography & point clouds (SOTA + άδειες)

**Bare-earth / ground filtering:**
- **CSF (Cloth Simulation Filter)** — industry default, **Apache-2.0** ✅, ~93% OA· αδυναμίες σε
  απότομο/βλάστηση. **PMF/SMRF** (μέσω PDAL, BSD) ✅ deterministic baseline.
- **Deep learning upgrade** για δύσκολο terrain: **KPConv (MIT** ✅, ~97.8% OA βουνό), **PointNet++**.
  ⚠️ **RandLA-Net = CC-BY-NC** → **ΑΠΑΓΟΡΕΥΜΕΝΟ** (μόνο αρχιτεκτονική-ιδέα, όχι κώδικας/weights).
  **PTv3** = frontier αλλά server-only + license check. Toolkit: **Open3D core MIT** (απόφυγε το bundled
  RandLA-Net path). Dataset: **OpenGF**.
- **Breaklines από ML**: curb/edge detection = height discontinuity + slope + DBSCAN/RANSAC + CNN. Δεν
  υπάρχει έτοιμο permissive pretrained breakline model → build-it-yourself πάνω σε KPConv labels.

**Foundation models / imagery:** **SAM (Apache-2.0** ✅) zero-shot αδύναμο χωρίς fine-tune· **SAMPolyBuild/
SAMLoRA** για building footprints (fine-tune <30′)· **MobileSAM / FastSAM (Apache** ✅) = browser-capable
(WASM/WebGPU). Cadastral boundary auto-trace = πραγματικό use-case.

**Client-side inference:** **ONNX Runtime Web (MIT** ✅) + **Transformers.js (Apache** ✅, WebGPU 10–100x)·
realistic split: heavy KPConv → server GPU· client → SAM/MobileSAM picking, light per-tile refine,
d3-contour, Depth-Anything-V2-**Small** (Apache ✅· V2 Base/Large = NC ⚠️).

**NeRF / 3D Gaussian Splatting:** **ΟΧΙ survey-grade** (GS ~7.8cm±11.5cm error vs 1–3cm photogrammetry).
Χρήση **μόνο** ως visualization layer πάνω σε πραγματικό DTM (walk-the-site demo, near-zero marginal cost).

**DEM super-resolution / ML interpolation:** research-stage (detrend CNN, FEN, ET-SDE joint denoise+void-fill
+SR). ML interpolation vs kriging = context-dependent· **κρίσιμο:** kriging/IDW χαλάνε ακριβώς στις απότομες
μεταβολές — εκεί που χρειαζόμαστε τη μεγαλύτερη βοήθεια → legit ML opportunity. **ΠΡΟΣΟΧΗ:** η εξαγωγή
ισοϋψούς καθαυτή είναι deterministic (marching squares) — η ΤΝ αξία είναι **upstream** (καθαρό DTM) +
downstream (smart labeling/QA), ΟΧΙ στο ίδιο το contouring.

## 7. Κορυφαία κινεζική αγορά (συχνά αγνοείται)

- **南方CASS** (~90% share): TIN + **αυτόματο clipping ισοϋψών σε breaklines/骨架线, cliffs (陡坎),
  text/symbols** — purpose-built rule που οι δυτικοί δεν έχουν out-of-box. Earthwork με **3 μεθόδους**
  (grid/TIN/cross-section) cross-checked (~2–5%). **Δομικές αδυναμίες:** τρέχει πάνω σε παλιό AutoCAD,
  μόνο DWG, simple-code error-prone, de-facto piracy, μηδέν English footprint, Windows/admin-locked.
- **清华山维 EPS** (~80% provincial bureaus): photogrammetry-native DLG, **stereo editing**, 2D/3D linked,
  100% automation για coded features· bottleneck = manual stereo correction κάτω από βλάστηση.
- **Hi-Target Hi-LiDAR**: UAV-LiDAR + auto QC + **3D Gaussian Splatting σε production** (μπροστά από
  δυτικούς)· **SLAM RTK** walk-and-scan. **CHCNAV LandStar 8**: MetaCAD engine (τεράστια DWG σε δευτερόλεπτα
  σε tablet). **DJI Terra/智图**: turnkey drone → **contours native DXF/SHP** + DEM/mesh, «免像控» GCP-free.
- **实景三维中国** (εθνικό πρόγραμμα): AI auto-extract footprints, **~500 buildings/sec**, entity contour
  extraction — κρατικά χρηματοδοτούμενο ακριβώς το πρόβλημα που λύνουμε.
- **SuperMap GIS 2025**: **SAM-based** point-cloud/imagery segmentation + NL GIS assistant.
  **DeepSeek** integration σε cadastral (98% accuracy σε registration Q&A, 智能审图 document review).
- **Learn/steal:** (1) breakline-aware clipping ως first-class rule· (2) field-code field-to-finish (20+ έτη
  ώριμο)· (3) cross-validation παραγώγων (3 μέθοδοι volume)· (4) one-core-engine → many verticals (DJI)·
  (5) **LLM layer πάνω σε deterministic geometry** (όχι black-box contouring).

## 8. SOTA αλγόριθμοι + **RECOMMENDED PERMISSIVE STACK**

> **Bottom line:** world-class browser contour engine χτίζεται **100% από permissive** κομμάτια. Οι
> κυρίαρχες engines (**Triangle/Shewchuk, CGAL**) και δύο point-cloud tools (**Entwine, GEOS-WASM**) είναι
> **license-blocked** — αλλά υπάρχει permissive υποκατάστατο για καθένα. Volume & cross-section = in-house.

**Triangulation / TIN (CDT για breaklines):**
- Bulk unconstrained: **delaunator (ISC)** ✅ ή **d3-delaunay (ISC)** ✅.
- **CDT (breaklines):** **cdt2d (MIT)** ή **cdt-js (MIT)** pure-JS· ή **poly2tri.js (BSD-3)**· heavy →
  **spade / cdt** Rust crate (MIT/Apache) → WASM.
- Robustness: **robust-predicates (public domain)** ✅ (exact orient2d/incircle — degeneracy-free).

**Contour extraction:**
- **TIN-native: d3-tricontour (ISC)** ✅ — meandering triangles, **κανένα saddle ambiguity** (3-vertex cells).
- Grid path: **d3-contour (ISC)** ✅ (marching squares)· DEM mesh: **Martini (ISC)** ✅ (RTIN LOD).
- Smoothing: **chaikin-smooth (MIT)** ή **d3-shape** curveCatmullRom/curveBasis — bounded + self-intersection sweep.

**Interpolation scattered → surface:**
- **Default: TIN + barycentric linear** (δωρεάν μετά το CDT, exact, τοπικό, **ποτέ extrapolation** πέρα από
  hull = legal virtue· ~1.7× ακριβέστερο από IDW σε πυκνά survey data).
- Optional smooth: **rbf (MIT)** thin-plate (pure-JS)· **kriging-rs (MIT, WASM)** όταν χρειάζεται
  uncertainty/geostatistics· scale με **nalgebra (Apache)** WASM solver. Quick raster: **@turf/interpolate IDW (MIT)**.

**Point clouds (browser + offline):**
- Render: **Potree (BSD-2)** ✅ (three.js octree, δισεκατομμύρια σημεία)· format **COPC** (open spec).
- Server tiling: **PDAL (BSD-3 core)** ✅ → COPC. **⚠️ Entwine = LGPL** (χρήση format, ΟΧΙ codebase).
- Indexing: **kdbush (ISC)**, **flatbush (ISC)**, **rbush (MIT)**, **three-mesh-bvh (MIT)**.
- Decimation: in-house voxel-grid (zero-dep) ή **poisson-disk-sampling (MIT)**.

**Volume & cross-section: IN-HOUSE (δεν υπάρχει permissive lib):**
- Cut/fill: άθροισμα τριγωνικών πρισμάτων `V = A·(Δz₁+Δz₂+Δz₃)/3`, O(n) — TIN method σέβεται breaklines.
- Cross-section/profile: triangle-walk κατά μήκος plane (~O(k) τρίγωνα), (station, elevation) points.

**Render:** **three.js (MIT)** — υπάρχει ήδη στο repo.

**🚫 License traps (κρίσιμα — ADR-034):** Triangle/CGAL (non-commercial/GPL)· τα ports «λένε ψέματα»
(**Triangle.NET/triangle-wasm βάζουν fake «MIT»** πάνω σε restricted code)· **Entwine/GEOS-WASM = LGPL**·
**artem-ogre/CDT = MPL-2.0** (εκτός allowlist)· GDAL «MIT» μόνο core (drivers audit)· **CONREC = ambiguous**
(re-implement από αλγόριθμο, όχι vendor)· `@turf/isolines` = grid-only (όχι TIN).

## 9. Differentiators — πώς ξεπερνάμε τους κορυφαίους

**Η κοινή ρωγμή ΟΛΩΝ** (Civil 3D/TBC/Carlson/CASS + cloud drone platforms Propeller/Pix4D/DroneDeploy):
αυτοματοποιούν το *surface math* αλλά **σταματούν πριν το legal, editable, CAD-native σχέδιο** — αυτο-
χαρακτηρίζονται «bridges to CAD». Desktop pain points (από forums): breaklines σιωπηλά αγνοούνται, surface
corruption σε routine editing, crashes σε μεγάλα datasets, subscription cost (#1 λόγος διαφυγής), steep
AutoCAD-gated learning curve. Cloud «tax»: paywalled basics, connectivity dependency, κρυμμένα accuracy specs.

**Top-10 differentiators (feature → γιατί δεν το έχουν → feasibility):**
1. **Closed-loop drone/point-cloud → editable CAD σε ΕΝΑ tool** (όχι bridge). *Υψηλή* (έχεις ήδη CAD engine).
2. **Auto-clean point cloud με "trust map" + self-tuning params.** *Υψηλή* (CSF/SMRF σε WASM).
3. **Inline AI breakline proposals, human-in-the-loop accept/reject.** *Μεσαία* — το moat είναι το UX.
4. **Natural-language editing** («interval στο 0.5m», «σβήσε spikes <2m²»). *Υψηλή* — tool-calling πάνω στο
   υπάρχον command SSoT· intent-aware editing σε *υπάρχον* μοντέλο (όχι generation).
5. **Continuous background QA / blunder detection** (elevation busts, COGO closure, outliers, missing
   breaklines) με inline flags. *Υψηλή* — rules engine σε worker.
6. **Instant what-if grading** — sub-frame cut/fill σε κάθε drag (WebGL/WebGPU, ADR-639). *Μεσαία-Υψηλή*.
7. **Real-time multiplayer (Figma-for-topo)** — CRDT shared point-cloud/contour review. *Μεσαία* (moonshot).
8. **One-click compliant διάγραμμα** (ΕΓΣΑ'87 + Κτηματολόγιο rules-engine validator). *Μεσαία* — τοπικό moat.
9. **Zero learning curve / no-AutoCAD-license onboarding.** *Υψηλή* — structural browser advantage.
10. **Offline-tolerant + transparent accuracy/QA provenance sheet.** *Μεσαία* — defensible output.

**Quick wins:** #2 auto-clean, #5 background QA, #4 NL editing, #9 zero-install, #6 live grading.
**Moonshots:** #3 autonomous breaklines, #7 multiplayer, #8 legal diagram, #1 full closed-loop.

**🔑 Σταθερή αρχή (professional ceiling):** **AI-as-accelerant + human-as-certifier.** Το AI draft/calculate/
cross-check/flag· **μόνο η σφραγίδα αδειούχου τοπογράφου** έχει νομική ισχύ. **Ποτέ** ισχυρισμός αυτόνομης
πιστοποίησης — και νομικά σωστό, και το σημείο όπου οι incumbents *δεν* μπορούν να μας κατηγορήσουν.

## 10. Ελληνικό compliance — ακριβή στοιχεία (codeable)

**ΕΓΣΑ'87 (EPSG:2100)** — Transverse Mercator, ενιαία ζώνη: central meridian **24°E**, lat origin **0°**,
scale factor **0.9996**, false easting **500.000 m**, false northing **0**, ellipsoid **GRS80**. Geographic:
EPSG:4121. Μετασχηματισμός → operational method = **grid-based HTRS07↔ΕΓΣΑ87** (ΑΠΘ), ~2–3cm τοπικά /
~8.3cm εθνικά (ΟΧΙ απλό 3-param Helmert).

**HEPOS** — 98 μόνιμοι GNSS σταθμοί (ΕΚΧΑ), VRS/FKP/MAC, NTRIP· RTK ~cm, DGPS ~0.30m, static ~mm.
Συνδρομές (excl. VAT): RTK 3μήνες €160, 1 έτος €480, post-processing €90.

**Νομικό πλαίσιο:**
- **ΠΔ 696/1974** — τεχνικές προδιαγραφές τοπογραφικών.
- **Ν.651/1977 Άρθρο 5** — δήλωση μηχανικού (πλευρές, όρια, γείτονες, εμβαδόν· buildability «υπευθύνως»).
- **Ν.4409/2016 Άρθρο 40** — υποχρεωτική ηλεκτρονική υποβολή (**επί ποινή ακυρότητας**), από **16/7/2018**.
- **Ν.4495/2017 Άρθρα 39–40** — εξάρτηση κορυφών από **κρατικό τριγωνομετρικό δίκτυο**, ορθογώνιες
  συντεταγμένες. **(ΟΧΙ ο ΝΟΚ Ν.4067/2012 — αυτός ρυθμίζει κάλυψη/ύψη/αποστάσεις.)**
- **Ανοχές (νομικά κωδικοποιημένες, scale-independent):** κτίριο **2% / ≤20cm**· περίμετρος οικοπέδου
  **2% / ≤40cm**· εμβαδόν **±5% εντός σχεδίου / ±10% εκτός** (Ν.4495/2017 Αρ.39§2 & Αρ.42§10 όπως τροπ.
  Ν.4759/2020). Εγκύκλιος ΥΠΕΝ/ΔΑΟΚΑ/110061/3317/2020.
- **Υποβολή:** ZIP = **DXF** (structured vector + πίνακες συντεταγμένων) + **ψηφιακά υπογεγραμμένο PDF** →
  engineer portal (ΤΕΕ account + eIDAS cert) → **Αποδεικτικό Ηλεκτρονικής Υποβολής**.
- **Δικαίωμα υπογραφής:** Αγρονόμος-Τοπογράφος / Πολιτικός Μηχανικός (πλήρες)· Αρχιτέκτονας (περιορισμένο).

**⚠️ Open gaps (χρειάζονται primary source πριν hardcode):** το byte-exact **«Τεχνικές Προδιαγραφές
Ψηφιακών Αρχείων Διαγραμμάτων v03»** PDF (DXF layer-naming schema) — να ανοιχτεί χειροκίνητα· ακριβή
contour intervals για 1:500/1:1000· vertical (spot-height) tolerance.

## 11. Automation opportunities για ελληνικά παραδοτέα

Auto πίνακας συντεταγμένων ΕΓΣΑ'87· one-click DXF pre-validated vs Κτηματολόγιο schema· auto ΕΓΣΑ'87↔HTRS07
με accuracy report· **auto tolerance-compliance check** (2%/20cm, 2%/40cm, ±5/±10%)· auto δήλωση Ν.651/1977·
HEPOS RTK → accuracy-tier report· auto profiles/cross-sections σε ελληνικές κλίμακες· auto cut/fill PDF·
auto εντός/εκτός σχεδίου detection (→ σωστό template Ν.4951/2022 Αρ.157).

---

## 12. Αποφάσεις προϊόντος (Q&A με Giorgio, 2026-07-13)

> Διευκρινιστικές αποφάσεις που καθορίζουν το scope της υλοποίησης. Ενημερώνεται ερώτηση-ερώτηση.

- **Q1 — Κύριος σκοπός / τι λύνουμε πρώτα:** **ΚΑΙ ΤΑ ΔΥΟ ΜΑΖΙ.** Το εργαλείο στοχεύει εξ αρχής και
  στα (Α) **επίσημα ελληνικά τοπογραφικά διαγράμματα** (Κτηματολόγιο/άδειες: όρια, εμβαδόν, ΕΓΣΑ'87,
  νόμιμη υποβολή) και στα (Β) **ισοϋψείς + όγκους χώματος (cut/fill)** για έργα/εκσκαφές. → Πλήρες
  εργαλείο, όχι single-purpose MVP. *(Συνέπεια: το αρχιτεκτονικό `systems/topography/` πρέπει να καλύπτει
  και το legal-diagram path §10/§11 και το terrain/contour/volume path §8 — κοινός πυρήνας points→TIN,
  δύο «εξόδους».)*
- **Q2 — Πηγή δεδομένων (πρώτα):** **ΤΡΟΠΟΣ Α — σημείο-σημείο (όργανο/GPS).** Ξεκινάμε από **αρχεία
  μετρήσεων** (λίγες εκατοντάδες ακριβή σημεία X,Y,Z — π.χ. PNEZD CSV), η κλασική ελληνική ροή. Το βαρύ
  path των drone/LiDAR point clouds (§6, εκατομμύρια σημεία, ground-filtering) είναι **μεταγενέστερο**.
  *(Συνέπεια: MVP core = points file → TIN → contours/legal-diagram. Ο AI ground-filter/point-cloud
  αγωγός μπαίνει σε επόμενη φάση· η αρχιτεκτονική να μην τον αποκλείει.)*
- **Q3 — Μέγεθος έργου:** **ΜΕΓΑΛΟ** (λόφος/δρόμος/πολλά στρέμματα εκτός σχεδίου — χιλιάδες σημεία,
  μεγάλες αποστάσεις). *(Συνέπειες: (1) το **culling gap / local-origin offset** ΕΓΣΑ'87 (ADR-635, ±1e6)
  γίνεται **υποχρεωτικό από την αρχή** — τα σημεία είναι μακριά από το 0,0. (2) Χρειάζεται spatial indexing
  (kdbush/flatbush) + πιθανώς web worker για TIN πάνω σε χιλιάδες σημεία, ώστε να μένει στα 60fps.
  (3) Contour simplification/LOD ανά zoom για ομαλό pan/zoom. Το «εκτός σχεδίου» ταιριάζει και με την
  ανοχή εμβαδού ±10% + εξαρτημένο ΕΓΣΑ'87 §10.)*
- **Q4 — Επίπεδο αυτοματισμού:** **ΚΑΙ ΟΙ ΤΡΕΙΣ ΤΡΟΠΟΙ ΜΑΖΙ.** Το εργαλείο πρέπει να προσφέρει: (Α)
  **«ένα κουμπί» πλήρως αυτόματο** (φόρτωσε σημεία → βγαίνουν όλα έτοιμα), (Β) **καθοδηγούμενο βήμα-βήμα**
  (ρωτάει τα βασικά, π.χ. contour interval, δείχνει preview προς έγκριση), και (Γ) **χειροκίνητο με AI
  βοηθό** (ο μηχανικός οδηγεί, το AI προτείνει/προειδοποιεί — π.χ. flag σε ύποπτο υψόμετρο). *(Συνέπειες:
  ίδιος **deterministic πυρήνας** (points→TIN→contours) με **3 UX modes** από πάνω· ο αυτόματος και ο
  guided μοιράζονται τα ίδια commands. Ο «AI βοηθός» = background QA (§9 quick-win #5) + NL editing (#4).
  Σταθερή αρχή §9: **AI-accelerant, μηχανικός-certifier** — ακόμη και το «ένα κουμπί» θέλει τελική έγκριση/
  σφραγίδα ανθρώπου, ποτέ αυτόνομη νομική πιστοποίηση.)*
- **Q5 — Στυλ ισοϋψών:** **ΔΙΑΚΟΠΤΗΣ (ακριβείς ↔ όμορφες).** Δύο modes: (Α) **ακριβείς** (raw TIN
  linear — κορυφές ακολουθούν ακριβώς τις μετρήσεις· default για νόμιμα/Κτηματολόγιο) και (Β) **ομαλές**
  (smoothing pass — για παρουσίαση). *(Συνέπειες: το smoothing (chaikin-smooth / d3-shape curve §8) είναι
  **προαιρετικό display layer πάνω** στις ακριβείς — ΠΟΤΕ δεν αλλοιώνει τα raw δεδομένα/υψόμετρα. Πρέπει
  **self-intersection guard** (§8 pitfall: το smoothing μπορεί να διασταυρώσει γειτονικές ισοϋψείς) +
  ένδειξη ότι το «όμορφο» mode έχει μικρή απόκλιση, άρα **κλειδώνει στο ακριβές για export νόμιμου
  διαγράμματος**.)*
- **Q6 — «Απότομες γραμμές» (breaklines):** **ΝΑΙ, ΑΠΟ ΤΗΝ ΑΡΧΗ.** Το εργαλείο πρέπει να καταλαβαίνει
  τοιχία/άκρες δρόμων/ρέματα/πρανή ως **breaklines** που κρατούν το κοφτό σκαλί (όχι ομαλή πλαγιά από
  πάνω). *(Συνέπειες: **ΚΡΙΣΙΜΟ αρχιτεκτονικά** — ο TIN builder ΔΕΝ αρκεί με plain Delaunay (delaunator)·
  χρειάζεται **Constrained Delaunay (CDT)** από την αρχή (cdt2d/cdt-js/poly2tri §8) + robust-predicates +
  **false-flat-triangle handling** (§5). Οι breaklines = υπάρχουσες polylines μαρκαρισμένες ως constraints.
  Αυτό μας βάζει άμεσα στο επίπεδο CASS/Civil 3D, που είναι και ο στόχος «ξεπερνάμε τους κορυφαίους». Το AI
  auto-breakline detection (§9 #3) έρχεται αργότερα — πρώτα ο χρήστης σχεδιάζει/δηλώνει τις γραμμές.)*
- **Q7 — AI προτεραιότητα:** **ΟΛΑ** (καμπανάκι-λάθους + κανόνες, «μίλα στο σχέδιο», «ένα κουμπί→φάκελος»).
  **Προτεινόμενη σειρά υλοποίησης** (quick-wins → moonshot, §9): (1) **Καμπανάκι λάθους + έλεγχος ελληνικών
  κανόνων** (background QA rules engine — χαμηλό ρίσκο, τεράστια αξία, deterministic)· (2) **«Μίλα στο
  σχέδιο»** (NL editing = LLM tool-calling πάνω στο υπάρχον command SSoT)· (3) **«Ένα κουμπί → φάκελος
  Κτηματολογίου»** (full closed-loop — το μεγάλο, απαιτεί ώριμο τον πυρήνα + το ελληνικό export §10/§11).
  *(Όλα κάτω από την αρχή AI-accelerant/human-certifier.)*
- **Q8 — 3D όψη εδάφους:** **ΝΑΙ, ΣΗΜΑΝΤΙΚΟ.** Εκτός από την 2D κάτοψη (καμπύλες), θέλουμε **3D μακέτα
  ανάγλυφου** (γυρίζεις τον λόφο, βλέπεις ψηλά/χαμηλά). *(Συνέπειες: **reuse του υπάρχοντος bim-3d engine**
  (three.js, ADR-366/645) — το TIN μετατρέπεται σε `BufferGeometry` mesh με Z=υψόμετρο (πρβλ. Martini/RTIN
  για LOD σε μεγάλες εκτάσεις §8). Η 3D είναι **παράγωγο του ίδιου TIN** — μηδέν διπλή πηγή αλήθειας. Δίνει
  και «walk-the-site» παρουσίαση· μελλοντικά Gaussian-Splat photoreal layer πάνω (§6, μόνο visualization).
  Προσοχή στο vertical datum/scale για mm-scenes, πρβλ. 3D BIM mesh scale.)*
- **Q9 — Μορφή εισόδου:** **ΠΟΙΚΙΛΛΕΙ** (άλλοτε λίστα σημείων, άλλοτε έτοιμο CAD). *(Συνέπειες: χρειάζεται
  **ευέλικτος importer** με 2 δρόμους: (1) **point-list parser** για CSV/TXT/Excel — configurable
  column-mapping (PENZD/PNEZD κ.λπ., delimiter, σειρά στηλών, μονάδες) γιατί κάθε όργανο βγάζει διαφορετικά·
  (2) **DXF POINT/TEXT extraction** — reuse του υπάρχοντος DXF parser για σημεία με υψόμετρο (Z ή text label).
  Το column-mapping wizard είναι από μόνο του UX win (το CASS απαιτεί manual μετονομασία/reorder — §7 pain).
  Κοινή έξοδος και των δύο δρόμων = `TopoPointStore` {x,y,z,code}. Μελλοντικά: LAS/LAZ/COPC για point clouds.)*
- **Q10 — Πρώτο ορόσημο:** **«ΒΛΕΠΩ ΙΣΟΫΨΕΙΣ».** Το πρώτο ορατό αποτέλεσμα = φόρτωση σημείων → άμεση
  εμφάνιση καμπυλών στο σχέδιο (ο deterministic πυρήνας). *(→ MVP milestone 1, βλ. σύνοψη κάτω.)*

### 12.1 Σύνοψη σκοπού (από Q1–Q10) — καθορίζει το MVP

**Τι χτίζουμε:** Πλήρες, browser-native, AI-native τοπογραφικό subsystem μέσα στον DXF viewer, που καλύπτει
**και** επίσημα ελληνικά διαγράμματα **και** ισοϋψείς/όγκους (Q1), με **3D όψη** (Q8), για **μεγάλες
εκτάσεις** (Q3), από **ευέλικτη είσοδο** (Q9), με **3 UX modes** auto/guided/manual+AI (Q4), **breakline-
aware από την αρχή** (Q6), **διακόπτη ακρίβειας/ομορφιάς** ισοϋψών (Q5), και **όλα τα AI features** σε σειρά
quick-win→moonshot (Q7).

**Milestone 1 (πρώτο ορατό — Q10):** `TopoPointStore` (canonical mm + **local-origin offset** για ΕΓΣΑ'87
μεγάλες συντεταγμένες) → **CDT** (delaunator + cdt2d/poly2tri + robust-predicates, breaklines ως constraints,
false-flat handling) → **d3-tricontour** contours (major/minor) → **native POLYLINE/TextEntity** μέσω
`completeEntity`. **Ορατό:** «ρίχνω αρχείο σημείων → βλέπω καμπύλες».
**Milestone 2:** import wizard (CSV column-mapping + DXF POINT) + smoothing switch + 3D mesh όψη.
**Milestone 3:** AI καμπανάκι (background QA + ελληνικοί κανόνες) → NL editing → όγκοι cut/fill.
**Milestone 4:** ελληνικό export (πίνακας ΕΓΣΑ'87 + DXF Κτηματολογίου + PDF) → «ένα κουμπί → φάκελος».
**Αργότερα:** drone/LiDAR point clouds (AI ground-filter), auto-breakline detection, multiplayer, Gaussian-Splat.

---

## Decision (σύσταση — μη δεσμευτική)

**Δεν υλοποιείται τώρα.** Όταν εγκριθεί feature:
1. **Νέο subsystem `src/subapps/dxf-viewer/systems/topography/`** — chain: `TopoPointStore` (SSoT, canonical
   mm, ADR-462) → **CDT builder** (delaunator + cdt2d/poly2tri + robust-predicates, breaklines ως constraints)
   → **contour generator** (d3-tricontour) → **native POLYLINE/TextEntity** μέσω `completeEntity` (ADR-057,
   undo+persistence) σε major/minor layers. Reuse render/select/snap/export (τζάμπα).
2. **Permissive-only stack** §8 (κανένα GPL/LGPL/AGPL· προσοχή στα fake-MIT ports).
3. **AI layer** (§6, §9) σταδιακά: quick-wins (auto-clean trust-map, background QA, NL editing) → moonshots
   (autonomous breaklines, multiplayer, legal-diagram). Πάντα **AI-accelerant + human-certifier**.
4. **Ελληνικό moat** (§10): ΕΓΣΑ'87 constants + Ν.4495 tolerances + Κτηματολόγιο export ως πρώτο codeable κομμάτι.
5. **Ξεχωριστά ADR** ανά μεγάλο κομμάτι (Topographic Import Wizard, AI classification pipeline, κ.λπ.).

## Consequences / Open Questions

- **ΕΓΣΑ'87 μεγάλες συντεταγμένες** (X~100k–900k, Y~3.7M–4.6M): culling gap (ADR-635, ±1e6) → local-origin
  offset (survey base point) απαραίτητο.
- **Performance/LOD**: πυκνά LiDAR/drone clouds → web worker + COPC streaming + decimation (πρβλ. ADR-639).
- **CDT για breaklines**: το delaunator είναι unconstrained → επιπλέον CDT βήμα (cdt2d/poly2tri) + false-flat
  handling.
- **Server vs browser split** για heavy ML (KPConv server-GPU· SAM/light client).
- **Legal**: ποτέ αυτόνομη πιστοποίηση· open gaps §10 (DXF schema PDF, contour intervals, vertical tolerance).

---

## Sources (Round 1 + Round 2)

**Αγορά/incumbents:** Autodesk Civil 3D help (field-to-finish, TIN, contours), forums.autodesk.com,
rpls.com, CADTutor, Carlson manuals & comparison, ChasmTech, Trimble help/community, Bentley (AEC Magazine
Copilot/Label Optimizer), Leica Infinity, Esri (PointCNN/SAM blogs), gitnux/wifitalents surveying rankings.

**AI/ML:** OpenGF (arxiv 2101.09641), CSF (github jianboqi/CSF), PDAL (pdal.io), KPConv (github HuguesTHOMAS),
RandLA-Net (⚠️NC), Open3D-ML, PTv3 (arxiv 2312.10035), SAM/MobileSAM/FastSAM, Depth-Anything-V2, ONNX Runtime
Web, Transformers.js, Gaussian Splatting accuracy (thefuture3d, ISPRS Annals 2025), DEM-SR (ET-SDE arxiv
2407.01908), ML-vs-kriging (MDPI Sensors), Pointly/Flai/Lidarvisor.

**China:** 南方CASS (CSDN, zhihu, rivermap), SouthMap/南方测绘, 清华山维 EPS, Hi-Target Hi-LiDAR/SLAM,
CHCNAV LandStar/CGO, DJI Terra, 实景三维中国 (csgpc.org), SuperMap GIS 2025, MapGIS, 南方数码 DeepSeek,
Glodon BIMMAKE.

**Αλγόριθμοι/άδειες:** delaunator/d3-delaunay/d3-contour/d3-tricontour (ISC), poly2tri.js (BSD), cdt2d/cdt-js
(MIT), spade/cdt (Rust MIT/Apache), robust-predicates (PD), Triangle/CGAL (🚫), Tinfour (Apache), Potree
(BSD-2), PDAL (BSD), Entwine (🚫LGPL), COPC, kdbush/flatbush (ISC), rbush/three-mesh-bvh (MIT), Martini (ISC),
kriging-rs/kriging.js/rbf (MIT), nalgebra (Apache), GRASS RST/r.surf.contour (docs — αλγόριθμος), Global
Mapper GENERATE_CONTOURS, Wikipedia CDT/Marching Squares.

**Ελληνικά:** epsg.io/2100, el.wikipedia (ΕΓΣΑ'87), hepos.gr, ktimatologio.gr/gov.gr, e-nomothesia (ΠΔ
696/1974, Ν.651/1977), lawspot.gr (Ν.4409/2016 Αρ.40, Ν.4495/2017 Αρ.39–40), news.b2green.gr (ανοχές),
technologismiki (Ν.4495/2017), xyz.gr/geodimetro.gr/greenbuilding.gr/cityengineering.gr, ΤΕΕ top_diag PDF,
ΕΚΧΑ «Τεχνικές Προδιαγραφές Ψηφιακών Αρχείων Διαγραμμάτων v03» (un-parsed — open gap).

---

## Changelog

- **2026-07-13 (v1)** — Δημιουργία. Round-1 έρευνα: αγορά (Civil 3D/Trimble/Carlson), κλαδική ροή, ελληνικό
  πλαίσιο, αλγόριθμοι + βιβλιοθήκες, blueprint. Status PROPOSED.
- **2026-07-13 (v2)** — **Round-2 βαθιά έρευνα με 6 πράκτορες (orchestrator).** Προστέθηκαν §5–§11: βαθιά
  τεχνική δυτικών (field-to-finish FSM, CDT, false-flat trap, TBC/Bentley AI), AI/ML SOTA + άδειες
  (CSF/KPConv/SAM/ONNX-web· RandLA-Net & ODM ακατάλληλα), κινεζική αγορά (CASS/EPS/Hi-Target/DJI/实景三维/
  SuperMap/DeepSeek), **recommended permissive-only stack** + license traps (Triangle/CGAL/Entwine/GEOS-WASM
  🚫, fake-MIT ports), top-10 differentiators + quick-wins/moonshots, πλήρες ελληνικό compliance (ΕΓΣΑ'87
  constants, Ν.4495 ανοχές, Ν.651/1977, Ν.4409/2016, HEPOS, Κτηματολόγιο submission) + open gaps. Ενημερώθηκε
  Decision (subsystem `systems/topography/` + AI roadmap + ελληνικό moat + AI-accelerant/human-certifier).
  **Status PROPOSED — καμία υλοποίηση.**
- **2026-07-13 (v3)** — **Q&A με Giorgio (§12, Q1–Q10)** → καθορίστηκε το scope του MVP: και τα δύο
  (legal+contours), input σημείο-σημείο/ποικίλλει, μεγάλες εκτάσεις, 3 UX modes, breakline-aware από την
  αρχή, διακόπτης ακρίβειας/ομορφιάς, όλα τα AI features σε σειρά, 3D όψη, πρώτο ορόσημο «βλέπω ισοϋψείς».
  Προστέθηκε §12.1 (σύνοψη + 4 milestones). **Status PROPOSED — καμία υλοποίηση.**
