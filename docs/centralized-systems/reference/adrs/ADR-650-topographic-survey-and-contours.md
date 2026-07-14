# ADR-650 — Τοπογραφικές Αποτυπώσεις & Ισοϋψείς Γραμμές (Έρευνα Αγοράς + Αρχιτεκτονικό Blueprint)

- **Status**: 🟡 IN PROGRESS — **M1 IMPLEMENTED** (πυρήνας σημεία→CDT/TIN→ισοϋψείς· v4) · **M2 IMPLEMENTED** (μέρος Α import wizard· v5 — μέρος Β breakline picking· v6) · **M4 IMPLEMENTED** (3Δ όψη εδάφους: μοναδικό derived TIN → `BufferGeometry` mesh + hypsometric· v7) · **M6 IMPLEMENTED** (όγκοι cut/fill: prisms + daylight split + στάθμη/επιφάνεια/όριο + cross-check + 3Δ cut/fill style· v8, §12.4) · **M7 IMPLEMENTED** (ελληνικό export «ένα κουμπί → φάκελος»: πίνακες στο σχέδιο + ZIP με DXF/PDF/CSV/XLSX + auto tolerance-check §10· v9, §12.5) · **M3 IMPLEMENTED** (ισοϋψείς ακριβείς↔όμορφες + LOD· v10) · **M5α IMPLEMENTED** (AI «καμπανάκι» = deterministic QA rules engine + inline flags, χωρίς LLM· v11) · **M5β IMPLEMENTED** («μίλα στο σχέδιο» = NL editing με LLM tool-calling πάνω στα υπάρχοντα topo commands· 8 tools + destructive spike-removal με confirm· v12 — **M5 ΠΛΗΡΕΣ**) · **M8α IMPLEMENTED** (point-cloud ingestion: LAS + bulk ASCII → in-house CSF bare-earth filter → voxel decimation → ΥΠΑΡΧΟΝ `TopoPointStore`· μηδέν νέα dependency· v13) · **M8β/Α IMPLEMENTED** (**LAZ decode** — ο δρόμος των drones: `laz-perf` **Apache-2.0** (επαληθευμένο, εγκεκριμένο) → ασυμπίεστα records → **ο ΙΔΙΟΣ** `decodeLasRecords` του LAS· lazy WASM πίσω από dynamic import· v14) · **M8β/Γ IMPLEMENTED** (**auto-breakline detection** — differentiator §9 #3: ο ΥΠΑΡΧΩΝ M5α ανιχνευτής dihedral fold εξήχθη σε SSoT· το νέο είναι το **chaining** ακμών σε ordered πολυγραμμές με **stop-at-junction** + φίλτρα θορύβου· preview στον καμβά + **ρητό confirm** πριν το `addBreakline` — καμία αυτόματη εγγραφή· deterministic, μηδέν LLM· v15) · **M8β/Β IMPLEMENTED** (**3Δ point-cloud layer** — το νέφος ζει ως `THREE.Points` πάνω από το έδαφος αντί να πεθαίνει με τον wizard· ο builder υπήρχε ήδη από το M8α, γράφτηκε **μόνο ο καταναλωτής**· κοινό `writeDxfPlanToWorld` με το TIN· **§6 επιβεβλημένο στον κώδικα**: `raycast = () => {}` → ΟΨΗ, ποτέ γεωμετρία μέτρησης· 48 MB μετρημένα + ρητό «Αφαίρεση νέφους»· καμία νέα dependency· v16) · **M8β/Δ IMPLEMENTED** (**id-aware ASCII cloud** — ο reader του νέφους μαθαίνει το `ColumnMapping` που ο δρόμος CSV ήδη ήξερε (M2)· **deterministic sniffer** προτείνει τις στήλες από τα δεδομένα, ο μηχανικός τις πιστοποιεί σε grid **πριν** το φίλτρο· ένα PENZD αρχείο δεν διαβάζεται πια με X = id σημείου· **χωρίς mapping ⇒ σημερινή συμπεριφορά**· καμία νέα dependency· v17) · **M8β/Ε IMPLEMENTED** (**unit-aware binary cloud** — το LAS/LAZ **δεν** δηλώνει μονάδα στο header· ο dropdown μονάδας γίνεται ορατός & επεξεργάσιμος **για ΚΑΘΕ** μορφή νέφους (όχι μόνο ASCII, όπως μετά το M8β/Δ), με **readout έκτασης** ανά μονάδα ώστε η επιλογή να επαληθεύεται με τα μάτια — **καμία σιωπηλή μαντεψιά** (m/ft διαφέρουν ×3.28, όπως PDAL/CloudCompare)· + belt-and-suspenders sanity warning για εξωπραγματικό span σε **όλες** τις μορφές· default `m` αμετάβλητο· καμία νέα dependency· v18). **Εκκρεμεί**: multiplayer, Gaussian-Splat, COPC streaming. Έρευνα §1–§11 & roadmap §12.2 παραμένουν το blueprint.
- **Date**: 2026-07-13
- **Category**: DXF Viewer / Topography / Research
- **Σχετικά**: ADR-635 (culling gap σε geo-referenced συντεταγμένες ±1e6), ADR-462 (canonical mm),
  ADR-057 (`completeEntity` pipeline), ADR-034 (License policy — MIT/Apache/BSD/ISC only),
  ADR-639 (WebGL line layer), ADR-366 (3D BIM viewer scope), SPEC-3D-004B/C/D (GenArc topographic EXCLUDED),
  **ADR-656** (presentation & compliance layer: πάχος κύριων ισοϋψών · labels σημείων Χ/Υ/Ζ · κάναβος ΕΓΣΑ87 — M9/M10/M11)

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

### 12.2 Λεπτομερές roadmap μετά το Milestone 1 (προγραμματισμένες φάσεις — ΟΛΑ θα υλοποιηθούν)

> **Αρχή προγραμματισμού (Giorgio):** ΟΛΑ τα §12.1 features **θα υλοποιηθούν** — δεν είναι «εκτός scope»,
> είναι **σε σειρά**. **1 φάση ανά συνεδρία** (καθαρό context). Κάθε φάση: big-player pattern + Full
> Enterprise + Full SSOT· **SSOT audit (grep) ΠΡΙΝ κώδικα**· άδειες MIT/Apache/BSD/ISC μόνο· ΟΧΙ tsc·
> ≤500 γρ/αρχείο, ≤40 γρ/function· i18n el+en· commit/push μόνο ο Giorgio.
>
> **Milestone 1 = ✅ DONE** (πυρήνας σημεία→CDT/TIN→ισοϋψείς· changelog v4).

| Φάση | Τίτλος | Τι περιλαμβάνει | Big-player πρακτική | Κύριο SSoT reuse | Νέες άδειες |
|------|--------|-----------------|--------------------|--------------------|-------------|
| **M2** ✅ | **Import Wizard** (Q9) | Column-mapping CSV/TXT/Excel (PNEZD/PENZD/…, delimiter, units, σειρά στηλών) + DXF POINT/TEXT extraction → `TopoPointStore`. Breakline picking (mark υπάρχουσες polylines ως constraints) — **DONE, changelog v5 (μέρος Α) + v6 (μέρος Β)**. | Civil 3D «Field to Finish» point import· CASS column reorder (§7 pain-point → κάν'το UX win) | υπάρχων DXF parser (`utils/dxf-entity-parser.ts`)· `parse-topo-points.ts` (extend)· `TopoPointStore` | — (SheetJS αν Excel = Apache-2.0 ✅) |
| **M3** ✅ | **Smoothing switch + LOD** (Q5) | Διακόπτης «ακριβείς↔όμορφες»· smoothing = **non-destructive render-time στυλ** (AutoCAD spline-fit / Civil 3D «Contour Smoothing»): γενικό πεδίο `BaseEntity.smoothDisplay` — ο `PolylineRenderer` ζωγραφίζει cached Catmull-Rom καμπύλη, οι `vertices` (control) μένουν **ΑΚΡΙΒΕΙΣ** → export/Κτηματολόγιο κλειδωμένο δωρεάν. **Self-intersection guard** (windowed· raw fallback ανά span) + **Douglas-Peucker LOD ανά zoom** (bucketed cache → 0 per-frame smoothing, ADR-040). **DONE, changelog v10.** | Civil 3D «Surface Style · Contour Smoothing»· AutoCAD PEDIT spline-fit polyline | `catmullRom`/`tessellateSplinePoints` (`geometry-spline-utils`)· `segmentsIntersect` (`GeometryUtils`)· `simplifyPolyline` RDP (`geometry-polyline-utils`)· `EntityIdsBatchPatchCommand`· `terrain-3d-store` pattern | **καμία νέα** (και οι 3 αλγόριθμοι in-house) |
| **M4** ✅ | **3D όψη εδάφους** (Q8) | TIN → `BufferGeometry` mesh (Z=υψόμετρο)· «γύρνα τον λόφο»· hypsometric elevation banding. **Παράγωγο του ΙΔΙΟΥ TIN** (μηδέν διπλή πηγή — επιβάλλεται από `topo-surface.ts`). **DONE, changelog v7.** RTIN LOD (martini) **ΔΕΝ** μπήκε: καμία μετρημένη ανάγκη ακόμη (§12.3) — dependency μόνο όταν αποδειχθεί. | Civil 3D Surface + Surface Style· Revit Toposolid· C4D | `bim-3d` engine (three.js, ADR-366/645)· `TinSurface` (M1)· `dxfPlanToWorld` + `MaterialCatalog3D` + `disposeObjectTree` | **καμία νέα** — υπάρχον `three` |
| **M5α** ✅ | **AI καμπανάκι (QA rules engine)** (Q7 #1) | Background **deterministic** QA (elevation busts = MAD robust· duplicate/outliers· closure = self-intersect/degenerate ring· missing breaklines = dihedral fold χωρίς constraint) με **inline flags**: λίστα panel με zoom-to + ⊙ markers (reuse ADR-435). **Μηδέν LLM/κόστος, offline. AI-accelerant/human-certifier.** **DONE, changelog v11.** | Civil 3D «Surface Statistics»· TBC blunder detection | `getTopoSurface`/`TopoPointStore`· `median` (`utils/statistics`)· `polygon-utils`· `scene-units`· `ClashMarkerLayer`+`canvas-fit-to-view-selected` (ADR-435/394) | **καμία νέα** (in-house, μηδέν LLM) |
| **M5β** ✅ | **«Μίλα στο σχέδιο» (NL editing)** (Q7 #2) | NL editing («interval 0.5m», «σβήσε spikes») = **LLM tool-calling** πάνω στο υπάρχον command SSoT (`useTopoContours`/`contour-display-store`/`terrain-3d-store`/`cut-fill-store`/`runTopoQa`/`TopoPointStore`) — **8 topo tools** + executor στο ΥΠΑΡΧΟΝ `ai-assistant/` chat (ό,τι κάνει το `grid-tool-definitions`). Το LLM **ΔΕΝ** γράφει γεωμετρία· καλεί τα ίδια commands. Destructive «σβήσε spikes» = reuse M5α detector + **ρητό confirm** (human-certifier). **DONE, changelog v12.** | SuperMap/Autodesk AI assistant· Speckle NL-CAD | `ai-assistant/` (`grid/match-tool-definitions`, `dxf-openai-call`, `useDxfAiChat`)· command SSoT· M5α `runTopoQa` | **καμία νέα** — υπάρχον gpt-4o-mini |
| **M6** ✅ | **Όγκοι cut/fill** (Q1) | Triangular-prism πάνω στο TIN + **daylight split** + προαιρετικό **όριο οικοπέδου** + αναφορά **στάθμη Ή μελετημένη επιφάνεια** + **cross-check με κάνναβο** (§7 CASS) + 3Δ **cut/fill analysis style**. **DONE, changelog v8.** BOQ output **ΔΕΝ** μπήκε: το έδαφος δεν είναι entity → δεν υπάρχει `sourceEntityId` να κρεμαστεί γραμμή (βλ. §12.4) — μεταφέρεται σε M4b/M7. | Civil 3D Volumes Dashboard· CASS 3-method cross-check | `TinSurface` (M1)· `polygon-utils` (area/centroid/S-H clip)· `marching-triangles` (crossEdge)· `scene-units` (mm³→m³) | — (in-house, **καμία νέα**) |
| **M7** ✅ | **Ελληνικό export → «ένα κουμπί → φάκελος»** (Q1, Q7 #3) | Πίνακας συντεταγμένων ΕΓΣΑ'87 + εμβαδομέτρηση οικοπέδου + πίνακας όγκων + **auto tolerance-check** (§10) — **ΚΑΙ** ως entities μέσα στο σχέδιο **ΚΑΙ** ως ZIP (DXF+PDF+CSV+XLSX). **DONE, changelog v9** (§12.5). **ΔΕΝ** μπήκαν: proj4/pdf-lib (**καμία μετρημένη ανάγκη** — βλ. §12.5), ψηφιακή υπογραφή (eIDAS — ο μηχανικός, εκτός εφαρμογής), DXF layer schema Κτηματολογίου (**open gap §10** — λείπει το primary source). | CASS cadastral output· Civil 3D «coordinate table in drawing + report files» | `bim/schedule` exporters (CSV/XLSX/PDF)· `buildScheduleTable`+`detailPrimitivesToEntities` (ADR-622)· `zip-pack` (ADR-505)· DXF export (ADR-648)· `polygon-utils`· `scene-units` | **καμία νέα** |
| **M8α** ✅ | **Point-cloud ingestion + bare-earth** | Point cloud (LAS 1.0–1.4 / bulk ASCII XYZ) → **CSF ground filter (in-house, Zhang 2016)** → voxel decimation → **ΥΠΑΡΧΟΝ `TopoPointStore`** → `getTopoSurface()` δίνει ισοϋψείς/3Δ/QA/όγκους δωρεάν. **4ος δρόμος του υπάρχοντος `TopoImportWizard`, ΟΧΙ δεύτερο pipeline.** Τιμά την ταξινόμηση της πηγής (ASPRS class 2), preview πριν την έγκριση (human-certifier). **DONE, changelog v13.** | Autodesk ReCap / Civil 3D «Point Cloud to Surface»· CloudCompare CSF plugin· PDAL `filters.csf` | `TopoImportWizard`/`useTopoImport` (extend)· `TopoPointStore`· `io/dxf-import` worker pattern (ADR-639)· `topo-local-origin` | **καμία νέα** (CSF in-house· LAZ decode ΔΕΝ μπήκε — θα ήθελε `laz-perf`) |
| **M8β/Α** ✅ | **LAZ decode** (ο δρόμος των drones) | `.laz` (DJI Terra / Pix4D / Terrasolid — **κανένα drone δεν βγάζει `.las`**) → **laz-perf WASM** → ασυμπίεστα LAS records → **ο ΙΔΙΟΣ** `decodeLasRecords` που ήδη διαβάζει το `.las`. **Μηδέν δεύτερος reader/pipeline.** Stride κατά την αποσυμπίεση (τα LAZ chunks δεν παραλείπονται)· lazy WASM singleton πίσω από dynamic import (τα 214 KB δεν χρεώνονται σε όποιον δεν ανοίγει `.laz`). **DONE, changelog v14.** | LAStools/laszip· CloudCompare· potree/copc.js (ίδιο laz-perf) | `las-reader.ts` (εξήγαγε τον decoder)· `pointcloud-read` dispatcher· `pointcloud.worker` | **`laz-perf@0.0.7` — Apache-2.0 ✅** (επαληθευμένο σε 3 επίπεδα· **ΟΧΙ** το LGPL LASzip)· `@types/emscripten` (MIT, dev) |
| **M8β/Γ** ✅ | **Auto-breakline detection** (§9 #3) | Το σύστημα διαβάζει την **ΙΔΙΑ** επιφάνεια και **προτείνει** τις γραμμές ασυνέχειας που λείπουν. Ο ανιχνευτής **υπήρχε ήδη** (M5α dihedral fold) → εξήχθη σε SSoT (`detect-feature-edges`) που **καλούν και οι δύο**. Το νέο = **chaining**: ακμές → ordered πολυγραμμές, **stop-at-junction** (3 σπασίματα = 3 γραμμές, όχι μαντεψιά) + φίλτρα θορύβου (≥3 ακμές, ≥5 μ). **Preview στον καμβά + ρητό confirm** → `addBreakline`· **καμία αυτόματη εγγραφή** (§9 human-certifier). Deterministic, **μηδέν LLM**. **DONE, changelog v15.** RDP simplification **ΔΕΝ** μπήκε (ο υπάρχων `simplifyPolyline` είναι 2Δ → θα πετούσε το Ζ). | Civil 3D «Extract feature lines from surface»· CloudCompare/PDAL ridge-valley extraction (**πάντα** ανθρώπινη έγκριση) | `check-missing-breaklines` (M5α — εξαγωγή του fold)· `topo-qa-topology`· **`contour-chainer` (M1) → γενικεύτηκε σε `graph-chain` SSoT**· `calculatePolylineLength`· `TopoPointStore.addBreakline`· `RegionPerimeterPreviewOverlay` pattern | **καμία νέα** (in-house, μηδέν LLM) |
| **M8β/Β** ✅ | **3Δ point-cloud layer** | Το νέφος ζει ως **`THREE.Points` layer** στην 3Δ όψη (καφέ έδαφος / γκρι απόρριψη) αντί να πεθαίνει με τον wizard. Ο builder **υπήρχε ήδη** (M8α `buildCloudPreview` — interleaved θέσεις + ASPRS χρώματα, ήδη stride-sampled): γράφτηκε **μόνο ο καταναλωτής** (store που επιβιώνει του React + pure converter + scene layer + panel toggle). Τα plan→three-world μαθηματικά **δεν** αντιγράφηκαν — καλείται το υπάρχον `writeDxfPlanToWorld`. **§6 επιβεβλημένο στον κώδικα:** `raycast = () => {}` → ποτέ pickable/snappable. **DONE, changelog v16.** Potree/COPC/EDL **ΔΕΝ** μπήκαν: καμία μετρημένη ανάγκη (2M σημεία = ένα draw call). | Autodesk ReCap· CloudCompare· Potree (ίδιο 1-draw-call `Points` για αυτό το μέγεθος) | `buildCloudPreview` + `PointCloudPreview` (M8α)· `writeDxfPlanToWorld`· `TerrainSceneLayer` (owner pattern)· `terrain-3d-store` (store pattern)· `disposeObjectTree` | **καμία νέα** — υπάρχον `three` |
| **M8β/Δ** ✅ | **id-aware ASCII cloud** (το νέφος που κουβαλά στήλες) | Ο bulk ASCII reader έπαιρνε **τα πρώτα τρία αριθμητικά πεδία** ως X/Y/Z → ένα **PENZD/PNEZD** αρχείο (id πρώτο — το default των ελληνικών exports) διαβαζόταν με **X = id σημείου**: κανένα σφάλμα, καμία προειδοποίηση, νέφος-τέρας και ισοϋψείς από σκουπίδια. Λύση: ο reader δέχεται **προαιρετικό `ColumnMapping`** — **το ΙΔΙΟ** που ήδη ξέρει ο δρόμος CSV (M2: `ColumnRole`, `TOPO_ORDER_PRESETS`, `isMappingComplete`) — και **deterministic sniffer** (μηδέν LLM) **ΠΡΟΤΕΙΝΕΙ** ανάθεση από τα ίδια τα δεδομένα· ο μηχανικός τη βλέπει σε **grid με τις πραγματικές γραμμές** και την **πιστοποιεί πριν** το φίλτρο. **Χωρίς mapping ⇒ σημερινή συμπεριφορά** (μηδέν regression στα σκέτα `x y z` dumps). **DONE, changelog v17.** | CloudCompare «Open ASCII file» dialog (μαντεύει, δεν επιβάλλει)· PDAL `readers.text` (απαιτεί ρητό `order=`)· Civil 3D / CASS point-file **formats** από κατάλογο | `ColumnMapping`/`ColumnRole` + `TOPO_ORDER_PRESETS` + `isMappingComplete` (M2)· `detectDelimiter` (M2)· `parseLocaleNumber`· `PointCloudReadOptions` (ταξιδεύει ήδη στον worker) | **καμία νέα** (in-house, deterministic) |
| **M8β/Ε** ✅ | **unit-aware binary cloud** (η μονάδα που κανείς δεν ρώτησε) | Το LAS/LAZ **δεν** δηλώνει μονάδα στο header (ζει σε προαιρετικό CRS VLR)· ο κώδικας υποσχόταν «ρωτάμε τον χρήστη» (`LasHeader` doc) αλλά ο dropdown μονάδας φαινόταν **μόνο** στον δρόμο ASCII (μέσα στο grid, M8β/Δ) → ένα binary νέφος σε **πόδια/mm** διαβαζόταν σιωπηλά ως **μέτρα** (CSF «βρίσκει έδαφος», cut/fill λάθος ×3). Λύση: ο **ΥΠΑΡΧΩΝ** `TopoUnit` dropdown εξήχθη σε κοινό `TopoUnitSelect` (**όχι** δεύτερο dropdown/πίνακα κλίμακας) και εμφανίζεται **για ΚΑΘΕ** μορφή· για binary συνοδεύεται από **readout έκτασης** ανά μονάδα (από το `LasHeader.min/max`, χωρίς αποσυμπίεση) ώστε ο μηχανικός να δει «200 μ. ή 61 πόδια;» και να **πιστοποιήσει**. **Καμία σιωπηλή πρόταση** (m/ft ×3.28 → αμφίσημα, μια λάθος αυτόματη επιλογή θα ΗΤΑΝ το bug). + **sanity warning** για εξωπραγματικό span (>50 km ή >5 km ύψος) σε **όλες** τις μορφές (πιάνει και λάθος στήλη). **Default `m` αμετάβλητο.** **DONE, changelog v18.** | Civil 3D / ReCap point-cloud import (ρωτά μονάδα ή διαβάζει CRS)· PDAL / CloudCompare (αρνούνται να μαντέψουν — ρητό scale/SRS) | `TopoUnit` + `TOPO_UNIT_SCALE_TO_MM` (M2)· `LasHeader.min/max` + `readLasHeader` (M8α)· `PointCloudReadOptions.unit` (ταξιδεύει ήδη)· `POINTCLOUD_MSG` warnings ως keys | **καμία νέα** (in-house, deterministic) |
| **M8 moonshots +** | **Moonshots** | closed-loop drone→CAD· multiplayer (CRDT)· Gaussian-Splat visualization layer (**ΠΟΤΕ** ως γεωμετρία μέτρησης, §6)· server-GPU KPConv· COPC/EPT octree streaming. | §6, §9 differentiators | worker split (client/server)· Potree· `bim-3d` engine (ADR-366/645) | Potree (BSD-2 ✅) — server-GPU για heavy ML |

**Εξαρτήσεις/σειρά:** M2 (input) → M3 (display) → M4 (3D) είναι ανεξάρτητα-παράλληλα δυνατά μετά το M1.
M5 (AI) θέλει ώριμο core. M6 (όγκοι) θέλει μόνο το TIN (M1) → μπορεί νωρίς. M7 (export) θέλει M1+M6 για
πλήρη φάκελο. Προτεινόμενη σειρά υλοποίησης: **M2 → M4 → M6 → M3 → M5 → M7 → M8**, αλλά ο Giorgio ορίζει.

---

### 12.3 M4 — Η αρχιτεκτονική απόφαση: το έδαφος είναι **Surface + Style**, όχι entity (ακόμη)

**Η ερώτηση:** το έδαφος είναι BIM entity (Revit **Toposolid**) ή standalone 3Δ layer;

**Τι κάνουν ΠΡΑΓΜΑΤΙΚΑ οι μεγάλοι (Civil 3D — το domain του τοπογραφικού):** το `Surface` είναι
αντικείμενο με **Definition** (σημεία + breaklines + boundaries). Η τριγωνοποίηση **δεν αποθηκεύεται** —
είναι **derived** και ξαναχτίζεται («Rebuild Surface»). Το **τι βλέπεις** το ορίζει το **Surface Style**:
ισοϋψείς, τρίγωνα, elevation banding, 3D faces — **όλα από την ίδια μία επιφάνεια**.

**Απόφαση:** υιοθετούμε **αυτό ακριβώς** το μοντέλο, όχι μια δική μας παραλλαγή:

| Civil 3D | Εδώ |
|---|---|
| Surface **Definition** | `TopoPointStore` (σημεία + breaklines) — **η μία πηγή αλήθειας** |
| Derived TIN («Rebuild Surface») | **`topo-surface.ts` → `getTopoSurface()`** — memoised στο identity του store |
| Surface **Style**: contours | `generateContoursFromSurface()` → native lwpolyline entities (M1) |
| Surface **Style**: 3D faces / elevation banding | `tinToBufferGeometry()` → `TerrainSceneLayer` (M4) |

**Το κρίσιμο εύρημα του SSoT audit:** πριν το M4 **δεν υπήρχε καθόλου κοινό derived TIN** — ο `buildTin()`
καλούνταν **μόνο** μέσα στον `contour-generator`. Αν το 3Δ τον καλούσε ξεχωριστά, θα υπήρχαν **δύο
τριγωνοποιήσεις** και το ανάγλυφο θα μπορούσε να διαφωνεί σιωπηλά με τις ισοϋψείς. Το `topo-surface.ts`
είναι η διόρθωση αυτού του κενού και **επιβάλλεται από test** (`topo-surface.test.ts`: οι δύο καταναλωτές
παίρνουν το **ίδιο instance**).

**Γιατί layer και ΟΧΙ entity (προς το παρόν):** στη Revit/Civil 3D η επιφάνεια είναι element **επειδή η
Definition της ζει πάνω στο element**. Εδώ η Definition ζει στο `TopoPointStore` — ένα entity που απλώς
τυλίγει ένα store **δεν** είναι BIM citizen, είναι **δεύτερη πηγή αλήθειας**. Άρα το M4 δίνει το ορατό
αποτέλεσμα ως standalone layer (ίδια πολιτειότητα με το DXF underlay / C4D grid), με τον converter
**pure** (`TinSurface → BufferGeometry`, μηδέν εξάρτηση από entity/scene).

**M4b (μελλοντικό) — προαγωγή σε Toposolid:** ΠΡΩΤΑ μεταφέρεται η Definition (points/breaklines) πάνω στο
element, ΜΕΤΑ μπαίνει `RenderableEntityType 'terrain'` + `ENTITY_RENDER_CONTRACTS` + `BIM_3D_CONVERTER_TYPES`
(+ persistence + 2Δ αναπαράσταση — τα contours γίνονται *style* του element αντί για baked entities).
**Δεν απαιτεί ξαναγράψιμο γεωμετρίας** — ο `tinToBufferGeometry` μένει ως έχει.

---

### 12.4 M6 — Όγκοι: η αναφορά είναι **interface**, όχι mode· και γιατί το BOQ ΔΕΝ κούμπωσε

**Η ερώτηση (Giorgio, 2026-07-13):** ως προς τι συγκρίνουμε; Απάντηση: **και τα τρία** — (Α) στάθμη,
(Β) μελετημένη επιφάνεια, (Γ) εντός ορίου οικοπέδου.

**Η απόφαση που τα κάνει ΕΝΑ σύστημα αντί για τρία:** ο πυρήνας δεν μαθαίνει ποτέ *τι* είναι η αναφορά.
Ρωτά **μία** ερώτηση — «τι υψόμετρο-στόχο έχεις σε αυτό το σημείο;» (`ElevationReference.zAtMm`) — και
η στάθμη (`datumReference`) και το μελετημένο έδαφος (`surfaceReference`, barycentric δειγματοληψία του
2ου TIN) είναι **δύο απαντήσεις**, όχι δύο μηχανές. Τρίτη αναφορά (κεκλιμένο επίπεδο, οδικός άξονας)
μπαίνει χωρίς **καμία** αλλαγή στον `computeCutFill`. Το όριο (Γ) είναι **ορθογώνιος** άξονας: ισχύει και
στις δύο αναφορές.

| Ρόλος | Αρχείο | Σημείωση |
|---|---|---|
| Πυρήνας (prism + daylight + boundary) | `systems/topography/cut-fill.ts` | pure· O(n) |
| Γεωμετρία (plane fit, split, όγκος κομματιού) | `cut-fill-geometry.ts` | reuse `polygonArea`/`polygonAreaCentroid`/`crossEdge` |
| Δειγματοληψία TIN (barycentric + grid index) | `tin-sampler.ts` | «z σε αυτό το σημείο», `null` εκτός |
| 2η μέθοδος (κάνναβος) — CASS cross-check | `cut-fill-crosscheck.ts` | μηδέν κοινός κώδικας με τον πυρήνα· αλλιώς δεν είναι έλεγχος |
| Ερώτηση + απάντηση (state) | `cut-fill-store.ts` | κάθε αλλαγή αποτύπωσης **ακυρώνει** το αποτέλεσμα (όχι stale νούμερα) |
| Όριο (pick κλειστής polyline) | `topo-boundary-pick.ts` + `canvas-click-topo-boundary.ts` | εργαλείο `topo-boundary`, toggle (mirror M2-Β) |
| 3Δ ανάλυση (κόκκινο/μπλε) | `TerrainSurfaceStyle` **+`cutfill`** | ο ίδιος TIN, **τρίτο style** — γι' αυτό έγινε style-driven το M4 |

**Η μία σιωπηλή παγίδα (και γιατί υπάρχει test γι' αυτήν):** τρίγωνο με **ΚΑΙ** θετικά **ΚΑΙ** αρνητικά
Δz τέμνει τη γραμμή μηδενικής διαφοράς. Χωρίς υποδιαίρεση, εκσκαφή και επίχωση **αλληλοακυρώνονται μέσα
στο τρίγωνο**: το `net` βγαίνει σωστό, τα cut/fill **και τα δύο μικρότερα** — και κανείς δεν το προσέχει.
Το `splitByZeroDz` κόβει το τρίγωνο εκεί· το test «DAYLIGHT LINE» απαιτεί **cut > 0 ΚΑΙ fill > 0** και
πέφτει αν κάποιος το αφαιρέσει.

**Γιατί ο όγκος ΔΕΝ μπήκε στο BOQ (ειλικρινές εύρημα του SSoT audit):** ο μηχανισμός ποσοτήτων
(`buildBoqBaseRow`) απαιτεί `sourceEntityId` + `sourceEntityType` + Firestore scope — δηλαδή **entity**.
Το έδαφος είναι **standalone layer, όχι entity** (§12.3). Παράλληλος BOQ μηχανισμός για το έδαφος θα ήταν
ακριβώς το διπλότυπο που απαγορεύει ο N.12/N.18. Άρα: **ο όγκος ζει στο panel** μέχρι το **M4b** (Toposolid
→ υπάρχει entity → μία γραμμή BOQ με τον υπάρχοντα builder) ή το **M7** (φάκελος παραδοτέων).

**Ακρίβεια — τι είναι ακριβές και τι είναι προσέγγιση (100% ειλικρίνεια):**
- (Α) στάθμη: **ακριβές** (Δz γραμμικό σε κάθε τρίγωνο· `V = A · Δz(κέντρο βάρους)` = ολοκλήρωμα).
- (Β) επιφάνεια-vs-επιφάνεια: **γραμμικοποίηση** — το Δz δειγματοληπτείται στις κορυφές του υπάρχοντος
  TIN. Όπου οι δύο τριγωνοποιήσεις **τέμνονται**, ο Civil 3D χτίζει *composite surface*· εμείς όχι (ακόμη).
  Γι' αυτό ακριβώς υπάρχει το **cross-check με κάνναβο**: απόκλιση > 5% → **προειδοποίηση στον χρήστη**,
  όχι σιωπή.
- Τρίγωνο που η αναφορά **δεν** καλύπτει → **skipped + μετρημένο**, ποτέ αποτιμημένο ως 0 (θα εφεύρισκε
  εκσκαφή από το πουθενά).

---

### 12.5 M7 — «Ένα κουμπί → φάκελος»: η απόφαση, και γιατί **καμία νέα εξάρτηση**

**Η ερώτηση στον Giorgio (2026-07-13):** τι παράγει το κουμπί; (Α) πίνακες **μέσα** στο σχέδιο ·
(Β) **αρχεία** έξω · (Γ) **και τα δύο σε ZIP**. → **Απόφαση Giorgio: (Γ).**

**Το εύρημα του SSoT audit που άλλαξε τη σύσταση του handoff:** ο φόβος ήταν ότι το (Β)/(Γ) απαιτεί
νέο PDF writer (pdf-lib) και proj4. **Ο κώδικας είπε το αντίθετο** (ο κώδικας = πηγή αλήθειας):

| Ανάγκη M7 | Τι ΥΠΗΡΧΕ ήδη | Νέα εξάρτηση |
|---|---|---|
| Πίνακας ως γεωμετρία στο σχέδιο | `buildScheduleTable` → `DetailPrimitive[]` (ADR-622) → `detailPrimitivesToEntities` → `BlockEntity` (ίδια αλυσίδα με την πινακίδα ADR-651) | — |
| CSV | `bim/schedule/exporters/csv-exporter` (RFC-4180 + UTF-8 BOM) | — |
| XLSX | `xlsx-exporter` (`exceljs` ήδη στο package.json) | — |
| PDF | `pdf-exporter` (`jsPDF` + `jspdf-autotable` + ελληνική γραμματοσειρά) | — |
| ZIP | `export/core/zip-pack` (zero-dependency STORED writer, ADR-505 §D) | — |
| DXF | `buildDxfExportRequest` + `renderDxfBlob` (ADR-648) | — |
| **ΕΓΣΑ'87** | **τίποτα — και δεν χρειάζεται**: τα σημεία εισάγονται **native σε ΕΓΣΑ'87** (world mm). Ο πίνακας συντεταγμένων είναι αλλαγή **ΜΟΝΑΔΑΣ** (mm→m), **όχι** μετασχηματισμός προβολής. Το proj4 θα χρειαστεί μόνο αν ζητηθεί ΕΓΣΑ'87↔HTRS07 (§10) — **τότε**, με μετρημένη ανάγκη (N.5). | — |

**Η αρχιτεκτονική συνέπεια (γιατί το (Γ) δεν κόστισε διπλά):** ο πυρήνας είναι **καθαρός**:
`buildSurveyDeliverables(input) → { sections, plot, checks, verdict, warnings }` — παράγει τους πίνακες
ως **δεδομένα** (`ExportableTable`), χωρίς store/σκηνή/I/O. Οι δύο έξοδοι είναι απλώς **δύο backends**
πάνω στο ίδιο αποτέλεσμα (ακριβώς το μοτίβο preview===PDF===in-scene του ADR-622). Άρα «και τα δύο»
δεν σήμαινε δύο υλοποιήσεις — σήμαινε **έναν πυρήνα, δύο καταναλωτές**.

**Η γενίκευση που το επέτρεψε (χωρίς διπλότυπο):** οι τρεις exporters διάβαζαν πάντα **μόνο**
`columns` + `rows[].cells` — ποτέ το `entityId`/`entityType` του `ScheduleRow`. Οπότε αντί να
σφυρηλατηθούν ψεύτικα entity ids (τα σημεία αποτύπωσης **δεν είναι** BIM entities) ή να γραφτεί
δεύτερος CSV/PDF/XLSX writer, ο τύπος **διευρύνθηκε** σε `ExportableTable` (structural supertype —
το `Schedule` τον ικανοποιεί ⇒ **μηδέν αλλαγή σε υπάρχοντες callers**). Μία μηχανή πινάκων, δύο
παραγωγοί. Προστέθηκαν `tablesToPdfBlob` (ένα PDF, πολλοί πίνακες) + `tablesToXlsxBlob` (ένα φύλλο
ανά πίνακα)· το `scheduleToPdfBlob` έγινε λεπτό wrapper με **αμετάβλητο layout**.

**Οι ανοχές (§10) — τι κωδικοποιήθηκε και τι ΟΧΙ:**
- **Εμβαδόν**: ±5% εντός σχεδίου / ±10% εκτός (Ν.4495/2017 Αρ.42§10).
- **Περίμετρος**: 2% **ΚΑΙ** ≤40cm (Αρ.39§2) ⇒ ο **αυστηρότερος** όρος: `min(2%·L, 0.40m)`. Αυτή είναι
  η ανάγνωση του νόμου («έως 2% **και όχι μεγαλύτερες** των…»), όχι επιλογή μας — και είναι test-covered.
- **Χωρίς δηλωμένη τιμή τίτλου ⇒ `not-declared`**, ποτέ ψεύτικο «πέρασε» (AI-accelerant/human-certifier, §9).
- **ΔΕΝ** κωδικοποιήθηκε η ανοχή **κτιρίου** (2%/≤20cm): το τοπογραφικό subsystem δεν γνωρίζει περίγραμμα
  κτιρίου — μπαίνει όταν υπάρξει καταναλωτής, όχι προληπτικά.

**Το όριο που τηρήθηκε ρητά (μη-σιωπηλό):** ο πίνακας συντεταγμένων **δεν** μπαίνει στο σχέδιο όταν τα
σημεία ξεπερνούν τις `MAX_IN_SCENE_COORDINATE_ROWS` (60) — 3.000 γραμμές κειμένου δεν είναι σχέδιο. Αυτή
είναι και η πρακτική των μεγάλων (στο διάγραμμα μπαίνει ο πίνακας **κορυφών οικοπέδου**· η πλήρης λίστα
σημείων είναι **αρχείο**). Η παράλειψη επιστρέφεται ως `droppedCoordinates` και **λέγεται στον χρήστη**.

**Race condition (N.7.2 #2):** το DXF του φακέλου χτίζεται από σκηνή που **ρητά** περιλαμβάνει το block
των πινάκων (`[...scene.entities, block]`) — δεν ξαναδιαβάζεται η σκηνή μετά το commit ελπίζοντας ότι το
React state πρόλαβε. Το παραδοτέο DXF και η οθόνη λένε πάντα το ίδιο.

**Boy-scout (N.0.2/N.18):** το `buildTitleBlockDef` (ADR-651) και το M7 έκαναν **τον ίδιο** μετασχηματισμό
`DetailPrimitive[] → InSessionBlockDef` ⇒ εξήχθη το κοινό `bim/block-library/sheet-block-def.ts`
(`buildSheetBlockDef`) και **τα δύο** το καλούν. Επίσης προστέθηκε `lengthMmToM` στο units SSoT
(`scene-units.ts`), δίπλα στα `areaMm2ToM2`/`volumeMm3ToM3` — μία πηγή για το «τι αξίζει ένα χιλιοστό».

**Ανοιχτά (δεν μαντεύτηκαν):**
- **DXF layer schema Κτηματολογίου** — παραμένει **open gap του §10** (λείπει το byte-exact «Τεχνικές
  Προδιαγραφές Ψηφιακών Αρχείων Διαγραμμάτων v03»). Οι πίνακες μπαίνουν στο **ενεργό layer**· καμία
  ονοματοδοσία layer δεν εφευρέθηκε.
- **Ψηφιακή υπογραφή PDF** (eIDAS + portal ΤΕΕ): γίνεται από τον μηχανικό, **εκτός** εφαρμογής — και ο
  κώδικας δεν προσποιείται ότι την κάνει.
- **Δήλωση Ν.651/1977** (auto-generated κείμενο δήλωσης): δεν υλοποιήθηκε — θέλει το ακριβές πρότυπο κειμένου.

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
- **2026-07-13 (v4)** — **Milestone 1 ΥΛΟΠΟΙΗΘΗΚΕ** (Phase 3, N.0.1). Νέο subsystem
  `src/subapps/dxf-viewer/systems/topography/`: `TopoPointStore` (vanilla `createExternalStore`,
  raw SSoT points+breaklines+local-origin) → `topo-local-origin` (Q3: min-corner offset για ΕΓΣΑ'87
  ±1e6, ADR-635) → `tin-builder` (**CDT μέσω `cdt2d` MIT** + robust-predicates, breaklines ως constrained
  edges, false-flat count) → `marching-triangles` + `contour-chainer` → `topo-to-entities`
  (**native `lwpolyline` με `elevation` + major/minor labels**) → `completeEntities` (ADR-057). UI:
  `ui/panels/topography/TopographyPanel` (νέο tab «Τοπογραφικό» στο FloatingPanel· basic X Y Z parser,
  interval/index-every, «Δημιουργία»). Tool `'topo-contours'` (category `utility`, panel-driven).
  Tests: tin-builder/contour-generator/parse (13 πράσινα, ground-truth κεκλιμένο επίπεδο + κώνος).
  **ΑΠΟΦΑΣΗ (απόκλιση από §8 stack):** αντί `d3-tricontour` → **in-house marching-triangles πάνω στο
  CDT**. Λόγος: το `d3-tricontour` κάνει δικό του **unconstrained** Delaunay εσωτερικά, άρα θα **αγνοούσε
  τα breaklines** (Q6 mandatory). Το marching-triangles πάνω στο δικό μας constrained TIN είναι ο
  καθιερωμένος big-player δρόμος (Civil 3D/CASS «meandering triangles», κανένα saddle ambiguity σε
  3-vertex cells) και τιμά τα breaklines. Νέο dep: `cdt2d@1.0.0` (MIT· transitive `robust-*` MIT).
  **ΕΠΟΜΕΝΕΣ ΦΑΣΕΙΣ** (προγραμματισμένες, ΟΧΙ εκτός scope — βλ. §12.2 roadmap): import wizard/CSV
  mapping, smoothing switch, 3D mesh, AI QA, όγκοι cut/fill, ελληνικό export. **Status: PROPOSED →
  Milestone 1 IMPLEMENTED (πυρήνας)· M2–M6 προγραμματισμένα (§12.2).**
- **2026-07-13 (v5)** — **Milestone 2 μέρος Α: IMPORT WIZARD** (Q9· Phase 3, N.0.1). Η είσοδος έπαψε
  να είναι μόνο `X Y Z`.

  **Αρχιτεκτονική (big-player, Civil 3D «Point File Formats»): 2 ανεξάρτητα βήματα.**
  `αρχείο → RawTable` (τι λέει το αρχείο) και `RawTable + ColumnMapping + TopoUnit → TopoPoint[]`
  (τι σημαίνει). Γι' αυτό ένα column-mapping wizard αρκεί για **κάθε** όργανο, χωρίς parser ανά
  κατασκευαστή. Κοινή έξοδος και των δύο δρόμων = `TopoPointStore` (μηδέν αλλαγή στον M1 πυρήνα).

  Νέα (`systems/topography/`): `topo-import-types` (RawTable/ColumnMapping/TopoUnit + unit→mm) ·
  `topo-order-presets` (**PNEZD/PENZD/PNEZ/PENZ/NEZ/ENZ/XYZ/XYZD**) · `topo-delimited-reader`
  (auto-detect delimiter, quote-aware, header detection) · `topo-column-mapping`
  (`applyColumnMapping` + `suggestMappingFromHeaders` EL/EN + **`mapRowToPoint` SSoT**) ·
  `topo-excel-reader` (**υπάρχον `exceljs` MIT, dynamic import** — ΚΑΝΕΝΑ νέο dep· ADR-040 bundle) ·
  `topo-dxf-points` (`DxfEntityParser` → POINT/TEXT). UI (`ui/panels/topography/`): `useTopoImport`
  (όλο το state), `TopoImportWizard` (3 βήματα, reuse `WizardProgress`), `TopoColumnMapStep`
  (preview + **Radix Select**, ADR-001), CSS module· κουμπί «Εισαγωγή σημείων…» στο `TopographyPanel`.

  **ΚΡΙΣΙΜΕΣ ΑΠΟΦΑΣΕΙΣ:**
  1. **N=Northing=Y, E=Easting=X.** Κωδικοποιείται **ΜΙΑ φορά** (`topo-order-presets`). Το `PNEZD`
     είναι `id, Y, X, Z, code` — **όχι** `id, X, Y, Z`. Η αντιστροφή καθρεφτίζει την αποτύπωση περί
     τις 45° και «μοιάζει σωστή» → ships. Ground-truth test το φυλάει.
  2. **Το DXF διαβάζεται ως ΑΡΧΕΙΟ, όχι από το scene.** Το scene είναι 2D: το `PointEntity` έχει μόνο
     `position: Point2D` — **κανένα z**. Συγκομιδή από imported entities θα έδινε σιωπηλά **επίπεδη**
     επιφάνεια. Το υψόμετρο υπάρχει μόνο στα raw group codes → `POINT` = **30**, `TEXT` = label (1)
     (Civil 3D «elevation from text»). Μόνο η ENTITIES section (ADR-635 Φ2 — όχι BLOCK templates).
     Το DXF layer γίνεται feature `code` (field-to-finish).
  3. **`parse-topo-points` (zero-config) ΔΕΝ έγινε delegate του table reader** — έχει σκόπιμα άλλο
     συμβόλαιο (lenient split ανά γραμμή με ΑΝΑΜΕΙΚΤΟΥΣ delimiters + αρχικοί αριθμοί γραμμών· ο
     wizard χρειάζεται ΕΝΑΝ delimiter για σταθερές στήλες στο preview). Κεντρικοποιήθηκε το
     **πραγματικό** κοινό: `mapRowToPoint` (parse/scale/code) — μηδέν twin.
  4. **`$INSUNITS = 0` (unitless) → μέτρα**, όχι mm. Τα όργανα εξάγουν συχνά unitless· το «1 unit = 1 mm»
     θα συνέθλιβε ολόκληρο οικόπεδο σε τετράγωνο 1 μ.

  Tests: **+26** (39 συνολικά πράσινα) — PNEZD/PENZD ground-truth + N/E swap, ελληνικά decimals
  (`384512,345`), units m/mm/ft, delimiter/quote/header detection, POINT z από code 30, TEXT label,
  2D POINT skip. `jscpd`: **0 clones**. **Νέα deps: ΚΑΜΙΑ.**

  **ΕΚΚΡΕΜΕΙ (M2 μέρος Β):** breakline picking ως **πλήρες tool-mode** (`'topo-breakline'`, πρότυπο
  ADR-649): pick polyline → constraint. Υψόμετρο: `lwpolyline.elevation` → σταθερό z· αλλιώς
  **proximity breakline** (z από πλησιέστερο μετρημένο σημείο — Civil 3D pattern, γιατί το 2D scene
  δεν έχει z). Απαιτεί κεντρικοποίηση `pickTopEntityAt` (γενίκευση του `pickTopHatchAt`, N.18).
  → **ΟΛΟΚΛΗΡΩΘΗΚΕ στο v6.**

- **2026-07-13 (v6)** — **Milestone 2 μέρος Β: BREAKLINE PICKING ως tool-mode** (Q6· Phase 3, N.0.1).
  Οι breaklines έπαψαν να είναι «τύπος χωρίς UI»: μαρκάρεις **υπάρχουσες γραμμές του σχεδίου** και
  γίνονται constrained edges στο CDT (η επιφάνεια κρατά το κοφτό σκαλί — ακμή δρόμου, κορυφογραμμή,
  τάφρος — αντί να το εξομαλύνει).

  **Νέο εργαλείο `'topo-breakline'`** (`category:'drawing'` ⇒ το mouse-up select block ΔΕΝ τρέχει
  παράλληλα με τον click handler — ίδιο σκεπτικό με ADR-649· `allowsContinuous` ⇒ πολλές γραμμές στη
  σειρά). **Σκόπιμα εκτός `TOOL_CREATES_ENTITY`**: γράφει constraint στο `TopoPointStore`, ΔΕΝ
  δημιουργεί scene entity. **Toggle**: ξανά-κλικ στην ίδια γραμμή την αφαιρεί (`sourceEntityId` στο
  `Breakline`). Ενεργοποίηση από το `TopographyPanel` (κουμπί «Επιλογή γραμμών» + ζωντανό πλήθος +
  «Καθαρισμός»).

  Νέα αρχεία: `rendering/hitTesting/pick-top-entity-at.ts` · `systems/topography/topo-breakline-pick.ts` ·
  `hooks/drawing/useTopoBreaklineTool.ts`. Άγγιξε: `TopoPointStore` (+`removeBreakline`,
  +`findBreaklineBySourceEntity`, `addBreakline(…, sourceEntityId?)`), `topo-types` (+`sourceEntityId`),
  `canvas-click-tool-handlers` (+`handleTopoBreaklineClick`), `useCanvasClickHandler` (PRIORITY **1.73**),
  `tool-definitions`, `ui/toolbar/types`, `useSpecialTools-placement-tools`, `TopographyPanel` (+CSS),
  i18n el+en (`topoBreakline.status.*` shell, `topography.breakline.*` panels).

  **ΚΡΙΣΙΜΕΣ ΑΠΟΦΑΣΕΙΣ:**
  1. **Από πού παίρνει z μια breakline** (διάκριση Civil 3D — το scene είναι **2D**, `LineEntity`/
     `PolylineEntity` ΔΕΝ έχουν z· μόνο το `LWPolylineEntity` έχει `elevation`):
     **(α) standard** — `elevation` ορισμένο ⇒ ΟΛΕΣ οι κορυφές σε σταθερό z (και δουλεύει **χωρίς**
     φορτωμένα σημεία). **(β) proximity** — 2D γραμμή ⇒ κάθε κορυφή παίρνει z από το **πλησιέστερο
     μετρημένο σημείο**. Δεν είναι hack: είναι το καθιερωμένο Civil 3D pattern — η αξία της breakline
     είναι το **constrained edge**, ακόμη κι όταν το υψόμετρό της είναι παράγωγο. Χωρίς σημεία →
     `null` + ρητό μήνυμα (`needsPoints`), **ΠΟΤΕ σιωπηλά**. Παγίδα που καρφώθηκε σε test:
     `elevation: 0` είναι **πραγματικό** υψόμετρο, όχι «λείπει» (falsy trap).
  2. **Κεντρικοποίηση αντί sibling clone (N.0.2/N.18).** Το `pickTopHatchAt` (ADR-507) ήταν έτοιμο να
     γίνει δίδυμο ως «pickTopPolylineAt». Αντ' αυτού βγήκε ο κοινός **`pickTopEntityAt(worldPoint,
     entities, predicate, tol)`** πάνω στο `performDetailedHitTest` (world-coords topmost-pick SSoT)
     και το `hatch-pick-at` έγινε **delegate** — ίδιο ερώτημα, ένας loop.

  Tests: **+10** (59 συνολικά πράσινα στο topography + tools registry) — standard vs proximity z,
  `elevation:0`, lwpolyline χωρίς elevation → proximity, refusals (χωρίς σημεία / <2 κορυφές /
  μη-γραμμική οντότητα). `jscpd:diff`: **0 clones**. **Νέα deps: ΚΑΜΙΑ.**

  **Status: M2 (import wizard + breaklines) IMPLEMENTED· M3–M8 προγραμματισμένα (§12.2).**

- **2026-07-13 (v7)** — **Milestone 4 ΥΛΟΠΟΙΗΘΗΚΕ — 3Δ όψη εδάφους («γύρνα τον λόφο»)** (Phase 3, N.0.1).

  **Το κρίσιμο εύρημα του SSoT audit (ο κώδικας διέψευσε την υπόθεση):** δεν υπήρχε **κανένα** κοινό
  derived TIN — ο `buildTin()` καλούνταν **μόνο** μέσα στον `contour-generator`. Ένα 3Δ που θα τον
  καλούσε ξεχωριστά θα δημιουργούσε **δεύτερη τριγωνοποίηση** → το ανάγλυφο θα μπορούσε να διαφωνεί
  σιωπηλά με τις ισοϋψείς. Άρα το M4 **ξεκίνησε κλείνοντας αυτό το κενό**, όχι γράφοντας mesh.

  **Αρχιτεκτονική = Civil 3D «Surface + Surface Style»** (τεκμηρίωση: **§12.3**). Definition
  (`TopoPointStore`) → **ένα** derived TIN → **δύο styles**: ισοϋψείς (2Δ) **και** mesh (3Δ).

  **Νέα** (`systems/topography/`): **`topo-surface.ts`** — `getTopoSurface()`, memoised στο identity του
  store (**ο SSoT του «ποιο είναι το τρέχον TIN»**)· **`terrain-3d-store.ts`** — display state
  (`visible`/`style`), ξεχωριστό από τη survey definition (re-style ≠ data write).
  **Νέα** (`bim-3d/`): **`converters/tin-to-three.ts`** — pure `TinSurface → BufferGeometry` (LOCAL→WORLD +
  plan-mm→three-world + indexed→non-indexed για **faceted** normals — smooth normals θα στρογγύλευαν τα ίδια
  τα breaklines που το CDT κράτησε κοφτά)· **`converters/terrain-elevation-ramp.ts`** — hypsometric ramp
  (Civil 3D «Elevation Banding», normalised στο **δικό** της εύρος)· **`scene/terrain/TerrainSceneLayer.ts`**
  — standalone Object3D layer (ίδιο ownership pattern με `Cinema4DGridFloor`: imperative subs, dispose στο teardown).

  **SSoT reuse (μηδέν νέος μηχανισμός):** `writeDxfPlanToWorld` (νέο **zero-alloc** αδελφάκι του
  `dxfPlanToWorld` **στο ίδιο αρχείο** — η σύμβαση αξόνων/κλίμακας παραμένει σε **ένα** module, αλλιώς ένας
  bulk builder θα την ξανα-έγραφε)· `MaterialCatalog3D.getTerrainMaterial3D()` + `MATERIAL_DEFS['elem-terrain']`
  (**ΟΧΙ** νέο material system)· `disposeObjectTree` (ΟΧΙ νέο dispose)· `generateContoursFromSurface()`
  (ο παλιός `generateContours` **delegate-άρει** → μηδέν διπλότυπο).

  **Η μία τεκμηριωμένη απόκλιση:** το terrain material είναι **`DoubleSide`** — μοναδικό στο catalog. Κάθε
  άλλο BIM στερεό είναι **κλειστή** εξώθηση (FrontSide, ADR-366 §B.5), αλλά ένα TIN είναι **ανοιχτή**
  επιφάνεια: κάμερα κάτω από τον λόφο θα κοιτούσε μέσα από αυτόν. Ακριβώς ό,τι κάνουν Civil 3D 3D-faces /
  Revit Toposolid. Το overdraw argument δεν ισχύει (μία επιφάνεια, όχι όλο το μοντέλο).

  **Ρητά ΔΕΝ μπήκε:** `martini`/RTIN LOD — καμία **μετρημένη** ανάγκη· dependency μόνο όταν αποδειχθεί
  (N.5 + οδηγία handoff «πρώτα μέτρησε»). Το έδαφος **δεν** έγινε BIM entity — βλ. **§12.3 / M4b**.

  UI: «Έδαφος σε 3Δ» στο `TopographyPanel` (εμφάνιση/απόκρυψη + υψομετρικός χρωματισμός), i18n el+en.
  Tests: **+9** πράσινα (`tin-to-three.test.ts` — ground truth σε **κεκλιμένο επίπεδο**: κάθε κορυφή
  ξανα-προβάλλεται στην εξίσωση του επιπέδου· non-finite → `null` αντί για NaN bounds που θα **μαύριζαν όλη
  τη σκηνή**, ADR-537· `topo-surface.test.ts` — οι δύο καταναλωτές παίρνουν το **ίδιο instance**).
  `jscpd:diff`: **0 clones**. **Νέα deps: ΚΑΜΙΑ.**

  **Status: M1 + M2 + M4 IMPLEMENTED· M3, M5–M8 προγραμματισμένα (§12.2).**

- **2026-07-13 (v8)** — **M6 IMPLEMENTED — Όγκοι cut/fill (εκσκαφές / επιχώσεις).** Το παραδοτέο που
  πληρώνει ο εργολάβος: «πόσα κυβικά σκάβω, πόσα ρίχνω;» — και **τα τρία** πεδία σύγκρισης που ζήτησε ο
  Giorgio, ως **ΕΝΑΣ** μηχανισμός (§12.4): (Α) ως προς **στάθμη**, (Β) ως προς **μελετημένη επιφάνεια**,
  (Γ) **εντός ορίου** οικοπέδου. Η αναφορά είναι **interface** (`ElevationReference.zAtMm`), όχι mode·
  ο πυρήνας δεν ξέρει ποτέ αν πίσω του κρύβεται στάθμη ή δεύτερο TIN.

  **Μέθοδος (Civil 3D «Volumes Dashboard»):** triangular prisms πάνω στον **ΙΔΙΟ** derived TIN
  (`getTopoSurface()` — **κανένα** `buildTin()` από νέο consumer), με **daylight split**: τρίγωνο που
  τέμνει τη μηδενική γραμμή **υποδιαιρείται**, αλλιώς cut/fill αλληλοακυρώνονται **σιωπηλά** (§12.4).
  Όγκος κομματιού = `Εμβαδόν × Δz(κέντρο βάρους εμβαδού)` — **ακριβές** για γραμμικό Δz, άρα δουλεύει
  αυτούσιο και για τα κομμάτια που αφήνει το boundary/daylight clip (μηδέν re-triangulation).

  **Νέα αρχεία:** `systems/topography/` → `cut-fill.ts` (πυρήνας), `cut-fill-geometry.ts` (plane fit +
  zero-Δz split + όγκος κομματιού), `tin-sampler.ts` (barycentric z + grid index), `cut-fill-crosscheck.ts`
  (**2η μέθοδος: κάνναβος**, CASS §7 — απόκλιση >5% → προειδοποίηση), `cut-fill-store.ts` (ερώτηση +
  απάντηση· κάθε αλλαγή αποτύπωσης **ακυρώνει** το αποτέλεσμα), `topo-boundary-pick.ts`·
  `hooks/canvas/canvas-click-topo-boundary.ts`· `ui/panels/topography/TopoCutFillSection.tsx`.

  **Επεκτάσεις υπαρχόντων (SSoT, μηδέν διπλότυπο):** `TopoPointStore` → **συλλογή επιφανειών**
  (`existing`/`proposed`, Civil 3D Surfaces) + `boundary` **εκτός** των definitions (αλλιώς το pick του
  ορίου θα ξανα-τριγωνοποιούσε)· `topo-surface.ts` → memo **ανά επιφάνεια** (η invariant «ποτέ δεύτερη
  τριγωνοποίηση της ΙΔΙΑΣ definition» ισχύει ακέραιη)· `TerrainSurfaceStyle` **+`cutfill`** (3Δ Cut/Fill
  analysis: κόκκινο=σκάβω, μπλε=ρίχνω, μπεζ=μηδενική γραμμή) — **αυτός ήταν ο λόγος** που το M4 έγινε
  style-driven· `marching-triangles.crossEdge` **exported** (ίδιο linear crossing, πεδίο Δz αντί Z)·
  `scene-units` → `volumeMm3ToM3`/`areaMm2ToM2` (παράγωγα του `mmToSceneUnits`, **όχι** inline `/1e9`)·
  `useTopoImport(surface)` → ο **ίδιος** wizard εισάγει και το μελετημένο έδαφος (όχι δεύτερος wizard)·
  `useTopoBreaklineTool` → κοινός πυρήνας `useTopoPickTool` (breakline + boundary· ο δίδυμος hook θα ήταν
  ακριβώς το sibling-clone του N.18).

  **Reuse αντί για νέο κώδικα (SSoT audit ΠΡΙΝ τον κώδικα):** `polygonArea`/`polygonAreaCentroid`/
  `clipPolygonBySH` (το **τρίγωνο** ως convex clipper → **κοίλο** οικόπεδο δουλεύει)/`projectVerticesTo2D`
  από το `polygon-utils`· `pickTopEntityAt` για το boundary pick· `crossEdge` από το marching-triangles.
  **ΔΙΟΡΘΩΣΗ στο handoff:** το `marching-triangles` **δεν** κόβει τρίγωνο σε **υποπολύγωνα** (μόνο σε
  τμήματα ισοϋψούς) → το half-plane split στο πεδίο Δz γράφτηκε (δεν υπήρχε), αλλά **πάνω** στον υπάρχοντα
  linear-crossing SSoT.

  **BOQ: ΔΕΝ κούμπωσε — τεκμηριωμένο, όχι παράλειψη.** `buildBoqBaseRow` απαιτεί entity (`sourceEntityId`
  + Firestore scope)· το έδαφος είναι **layer, όχι entity** (§12.3). Παράλληλος BOQ μηχανισμός = διπλότυπο
  (N.12/N.18) → μεταφέρεται σε **M4b/M7** (§12.4).

  UI: «Όγκοι χωματουργικών» στο `TopographyPanel` (αναφορά, όριο, «Υπολογισμός όγκων», πίνακας cut/fill/net
  σε **m³** + εμβαδά σε m², cross-check γραμμή)· ο υπολογισμός **ανάβει** αυτόματα το 3Δ cut/fill style.
  i18n el+en. Tests: **+13** πράσινα (`cut-fill.test.ts` — κλειστοί τύποι: επίπεδο 100 m³, πυραμίδα ⅓·A·h,
  **DAYLIGHT LINE: cut>0 ΚΑΙ fill>0** [πέφτει αν αφαιρεθεί το split], κοίλο όριο, skipped-όχι-μηδέν,
  κενό TIN → μηδενικά όχι NaN, grid cross-check). Σύνολο topography: **66 πράσινα**. `jscpd:diff`:
  **0 clones**. **Νέα deps: ΚΑΜΙΑ** (in-house, όπως προέβλεπε το §12.2).

  **Status: M1 + M2 + M4 + M6 IMPLEMENTED· M3, M5, M7, M8 προγραμματισμένα (§12.2).**

- **2026-07-13 (v9)** — **Milestone 7 ΥΛΟΠΟΙΗΘΗΚΕ: ΕΛΛΗΝΙΚΟ EXPORT — «ένα κουμπί → φάκελος»** (Q1, Q7 #3·
  Phase 3, N.0.1). **Απόφαση Giorgio: (Γ) — ΚΑΙ πίνακες μέσα στο σχέδιο ΚΑΙ αρχεία σε ZIP** (§12.5).

  **Νέος καθαρός πυρήνας** `systems/topography/deliverables/`:
  - `greek-survey-rules.ts` — οι ανοχές του **§10** κωδικοποιημένες (Ν.4495/2017 Αρ.39§2 & Αρ.42§10):
    εμβαδόν **±5% εντός / ±10% εκτός** σχεδίου· περίμετρος **min(2%·L, 40cm)** — ο **αυστηρότερος** όρος,
    όπως τον γράφει ο νόμος. Χωρίς δηλωμένη τιμή τίτλου ⇒ **`not-declared`**, ποτέ ψεύτικο «πέρασε».
  - `survey-tables.ts` — 4 πίνακες ως **δεδομένα** (`ExportableTable`): συντεταγμένες ΕΓΣΑ'87 (Α/Α·Χ·Υ·Ζ·κωδ),
    κορυφές/πλευρές/μήκη οικοπέδου + **εμβαδόν & περίμετρος** (μέσω `polygonArea`/`polygonPerimeter` SSoT·
    Ζ κορυφών **δειγματοληπτείται** από τη ΜΙΑ επιφάνεια — `getTopoSurface` → `createTinSampler`· εκτός
    αποτύπωσης ⇒ **κενό, ποτέ 0**), όγκοι cut/fill/net (M6), έλεγχος ανοχών.
  - `build-survey-deliverables.ts` — **pure** orchestrator· ό,τι λείπει επιστρέφεται ως `warnings`
    (`no-boundary`/`no-volumes`), δεν σιωπά.
  - `survey-sheet.ts` — οι ίδιοι πίνακες ως **γεωμετρία** μέσω του ΥΠΑΡΧΟΝΤΟΣ `buildScheduleTable`
    (ADR-622). Ο πίνακας συντεταγμένων **κόβεται από το σχέδιο** πάνω από 60 γραμμές (πρακτική Civil 3D:
    στο διάγραμμα οι **κορυφές οικοπέδου**, η πλήρης λίστα σημείων = **αρχείο**) — **μη-σιωπηλά**.
  - `survey-folder.ts` — ZIP μέσω `createStoredZip` (ADR-505): CSV ανά πίνακα + **ένα** multi-table PDF +
    **ένα** multi-sheet XLSX + το **DXF** (ADR-648).
  - `useSurveyExport.ts` — ο μόνος impure κρίκος. Το DXF χτίζεται από σκηνή που **ρητά** περιέχει το block
    των πινάκων ⇒ **μηδέν race** (N.7.2 #2).

  **SSoT (μηδέν διπλότυπο, ΚΑΜΙΑ νέα εξάρτηση):** οι 3 exporters (`csv`/`xlsx`/`pdf`) **διευρύνθηκαν** από
  `Schedule` σε **`ExportableTable`** (structural supertype — το `Schedule` τον ικανοποιεί ⇒ **μηδέν αλλαγή
  σε υπάρχοντες callers**), αντί για fake entity ids ή δεύτερο writer. Νέα: `tablesToPdfBlob` /
  `tablesToXlsxBlob`· το `scheduleToPdfBlob` έγινε wrapper με **αμετάβλητο layout**. **proj4 ΔΕΝ μπήκε:**
  τα σημεία είναι **ήδη native ΕΓΣΑ'87** — ο πίνακας είναι αλλαγή **μονάδας**, όχι προβολής (§12.5).

  **Boy-scout (N.0.2/N.18):** νέο `bim/block-library/sheet-block-def.ts` (`buildSheetBlockDef`) — κοινό SSoT
  για `DetailPrimitive[] → InSessionBlockDef`· το `buildTitleBlockDef` (ADR-651) **δείχνει τώρα σε αυτό**.
  Νέο `lengthMmToM` στο `scene-units.ts` (units SSoT, δίπλα στα `areaMm2ToM2`/`volumeMm3ToM3`).

  **Bugfix (M6, βρέθηκε εδώ):** τα κλειδιά **`topography.cutfill.*` ΕΛΕΙΠΑΝ ΕΝΤΕΛΩΣ** και από τα δύο locales
  — το panel των όγκων εμφάνιζε σκέτα keys. Προστέθηκαν el+en (μαζί με τα `topography.deliverables.*`).

  UI: «Εξαγωγή φακέλου» στο `TopographyPanel` — ρωτά **μόνο** ό,τι δεν προκύπτει από τα δεδομένα (εμβαδόν/
  περίμετρος **τίτλου**, **εντός/εκτός σχεδίου**, κλίμακα, όνομα έργου) και δείχνει την **ετυμηγορία** §10
  με τα νούμερα. Tests: **+13** πράσινα (`survey-deliverables.test.ts` — ανοχές: το 2%/40cm cap αποδεικνύεται
  ότι είναι ο **αυστηρότερος** όρος σε μικρό ΚΑΙ μεγάλο οικόπεδο· εμβαδομέτρηση 20m→400m²/80m· raw-mm cells·
  warnings· 60-row cap). `jscpd:diff`: **0 clones**.

  **Εκκρεμή (ρητά ΟΧΙ μαντεμένα):** DXF **layer schema Κτηματολογίου** (open gap §10 — λείπει το primary
  source)· **ψηφιακή υπογραφή** PDF (eIDAS — ο μηχανικός, εκτός εφαρμογής)· **δήλωση Ν.651/1977** (θέλει το
  ακριβές πρότυπο κειμένου).

  **Status: M1 + M2 + M4 + M6 + M7 IMPLEMENTED· M3, M5, M8 προγραμματισμένα (§12.2).**

- **2026-07-13 (v10)** — **Milestone 3 ΥΛΟΠΟΙΗΘΗΚΕ: Διακόπτης «ακριβείς ↔ όμορφες» ισοϋψείς + LOD** (Q5).
  **Αρχιτεκτονική (όπως οι μεγάλοι — Giorgio):** το «όμορφο» είναι **non-destructive render-time στυλ**, όχι
  δεύτερα entities. Πρότυπο = AutoCAD spline-fit polyline + Civil 3D «Surface Style · Contour Smoothing»: το
  polyline κρατά **πάντα** τις control κορυφές, ζωγραφίζεται ως fitted καμπύλη. Γενικό πεδίο
  `BaseEntity.smoothDisplay?: boolean` (display hint, όχι topo-specific)· ο `PolylineRenderer` — κάτω από
  width/bulge priority — ζωγραφίζει την cached Catmull-Rom καμπύλη αντί για ευθείες χορδές. Αφού οι `vertices`
  μένουν **ΑΚΡΙΒΕΙΣ**, hit-test/grips/DXF export/**Κτηματολόγιο** παίρνουν την ακριβή γεωμετρία **δωρεάν**
  (το M7 `buildSurveyDeliverables` άλλωστε δεν διαβάζει καν contour entities — διπλά κλειδωμένο).

  **SSoT reuse — ΚΑΜΙΑ νέα εξάρτηση, κανένα νέο math (§8 + N.18):** `catmullRom`/`tessellateSplinePoints`
  (`geometry-spline-utils`), `segmentsIntersect` (`GeometryUtils`), `simplifyPolyline` RDP
  (`geometry-polyline-utils`). Νέο pure `rendering/entities/shared/geometry-smooth-display.ts` που **συνθέτει**
  μόνο τους τρεις.

  **Self-intersection guard (§8 pitfall #1):** provisional smoothed → **windowed** segment-crossing scan
  (endpoint-sharing pairs εξαιρούνται· closed=wrap), και τα εμπλεκόμενα **spans** πέφτουν σε RAW χορδή· η
  υπόλοιπη γραμμή μένει καμπύλη (τοπικό fallback, όχι whole-line). Πιάνει και τα «forward folds». **Cross-contour
  (γειτονική ισοϋψής) intersection ΔΕΝ γίνεται εδώ** (ένας per-entity renderer δεν έχει το context των γειτόνων —
  όπως και το Civil 3D· documented honesty)· moderate smoothing + self-guard καλύπτει τα ορατά artefacts.

  **LOD ανά zoom (Q3):** `lodToleranceForScale(scale)` → RDP tolerance **bucketed σε δυνάμεις του 2**· render
  cache per-entity keyed by (control-array-ref, closed, tolerance-bucket) → **0 per-frame smoothing** στο hot
  path (ADR-040-safe· ο guard τρέχει μόνο σε πραγματική αλλαγή/αλλαγή bucket).

  **Διακόπτης (undo-able, instant):** vanilla `contour-display-store` (2Δ αδελφός του `terrain-3d-store`) +
  `SetContourDisplayStyleCommand` (leaf του `EntityIdsBatchPatchCommand` SSoT — **ένα** undo step για όλες τις
  ισοϋψείς, `persistSignal`)· `useContourDisplay` δένει levels+scene-adapter+command. Νέες ισοϋψείς κληρονομούν
  το τρέχον στυλ (`useTopoContours`). UI: `topography.contourStyle.*` (el+en) με ρητή ένδειξη «το νόμιμο export
  βγαίνει πάντα ακριβές».

  **Files:** +`geometry-smooth-display.ts` (+test 12 πράσινα)· +`contour-display-store.ts`· +`contour-entity-ids.ts`·
  +`useContourDisplay.ts`· +`SetContourDisplayStyleCommand.ts`· `base-entity.ts`· `PolylineRenderer.ts` (CHECK 6D:
  ADR staged)· `contour-config.ts`· `topo-to-entities.ts`· `useTopoContours.ts`· `TopographyPanel.tsx`· i18n el+en.
  Tests: **79** topography + **12** smooth-display πράσινα. `jscpd:diff`: **0 clones**.

  **Εκκρεμή (ρητά ΟΧΙ μαντεμένα):** cross-contour (neighbour) intersection guard (θέλει generation-time pass πάνω
  σε ΟΛΟ το contour set, ή topo overlay renderer με το σύνολο)· user-facing LOD/segment tuning (τώρα σταθερά).

  **Status: M1 + M2 + M3 + M4 + M6 + M7 IMPLEMENTED· M5, M8 προγραμματισμένα (§12.2).**

- **2026-07-13 (v11)** — **Milestone 5α ΥΛΟΠΟΙΗΘΗΚΕ: AI «καμπανάκι» = background QA rules engine + inline
  flags** (§12.2 M5 μέρος α· Q7 #1). **Ρητά ΕΚΤΟΣ αυτού του v11:** το μέρος β «μίλα στο σχέδιο» (NL editing /
  LLM tool-calling) — δικό του session **M5β** (γι' αυτό το μοντέλο μένει «M5 προγραμματισμένο» → τώρα «M5α»).

  **Φιλοσοφία (§9):** AI-accelerant / **human-certifier**. **Μηδέν LLM, μηδέν κόστος, offline** — καθαρή
  γεωμετρία/στατιστική. Το engine **ΠΟΤΕ** δεν πειράζει τα δεδομένα· επιστρέφει ευρήματα, ο μηχανικός κρίνει.

  **Big-player πρακτική:** Civil 3D «Surface → Statistics» / Trimble Business Center «blunder detection» —
  «Run → review» (transient report, όχι per-frame). Έξοδος σε **δύο** επιφάνειες (η πρακτική Civil 3D/TBC):
  **λίστα panel με zoom-to** + **inline ⊙ markers** στον καμβά.

  **Οι 4 deterministic έλεγχοι** (`systems/topography/qa/`): (1) **elevation busts** — residual κόμβου vs
  **median** γειτόνων στο TIN, robust **MAD** fence (Iglewicz–Hoaglin ≈3.5·MAD)· (2) **duplicate/outliers** —
  coincident XY (spatial grid O(n)) με ασυμβίβαστο Ζ· (3) **closure** — self-intersection + εκφυλισμένος βρόχος
  για όριο & κλειστές breaklines· (4) **missing breaklines** — dihedral fold ανά TIN edge, flag στα steep
  **χωρίς** breakline constraint.

  **SSoT reuse — ΚΑΜΙΑ νέα εξάρτηση, μηδέν LLM (§8 + N.18):** `getTopoSurface` (ο μοναδικός derived TIN — ΠΟΤΕ
  `buildTin`)· `TopoPointStore` (raw)· `median` (`utils/statistics`)· `isPolygonSelfIntersecting`/`polygonArea`/
  `polygon2DCentroid` (`polygon-utils`)· `lengthMmToM`/`areaMm2ToM2` (`scene-units`)· `radToDeg` (angle SSoT).
  Ο micrometre-grid key του `tin-builder` έγινε **exported** `localVertexKey` (Boy-Scout N.0.2) ώστε το QA
  edge↔breakline matching να μη rounding-drift-άρει. **Markers:** reuse `ClashMarkerLayer`+`ClashMarkerGlyph`
  (ADR-435) — ίδιο ⊙, ίδια `high/medium/low` παλέτα· overlay = **sibling του `ClashOverlayMount`**
  (`canvas-layer-stack-topo-qa-overlay.tsx`, low-freq `topo-qa-store`, ADR-040-safe). **Zoom-to:** ο κανονικός
  `canvas-fit-to-view-selected` EventBus SSoT (ίδιο μονοπάτι με το πλήκτρο Z / clash focus).

  **Closure — ρητή honesty (§9):** measured-vs-**δηλωμένο** εμβαδόν/περίμετρος (Ν.4495/2017) ζει ΗΔΗ στο M7
  `deliverables/greek-survey-rules.ts` — **δεν** διπλασιάζεται εδώ· και **traverse misclosure** (bearing/distance)
  θέλει raw παρατηρήσεις που το subsystem δεν κρατά → εκτός scope, δηλωμένο αντί «μαγειρεμένο».

  **Files:** +`qa/topo-qa-types.ts`, `qa/topo-qa-config.ts`, `qa/topo-qa-topology.ts`, `qa/topo-qa-format.ts`,
  `qa/check-elevation-busts.ts`, `qa/check-duplicate-points.ts`, `qa/check-boundary-closure.ts`,
  `qa/check-missing-breaklines.ts`, `qa/run-topo-qa.ts`, `qa/topo-qa-store.ts`·
  +`components/dxf-layout/canvas-layer-stack-topo-qa-overlay.tsx`· +`ui/panels/topography/TopoQaSection.tsx`·
  `canvas-layer-stack-preview-mounts.tsx` (mount· CHECK 6B/6D: ADR-040+ADR-650 staged)· `tin-builder.ts` (export)·
  `TopographyPanel.tsx`· `TopographyPanel.module.css`· i18n `dxf-viewer-panels` el+en (`topography.qa.*`).
  Tests: +10 QA πράσινα (elevation/duplicate/closure/missing-breakline + `runTopoQa` integration)· tin-builder/
  topo-surface/contour regression πράσινα.

  **Εκκρεμή (ρητά ΟΧΙ μαντεμένα):** **M5β** «μίλα στο σχέδιο» (topo tool-set + executor στο υπάρχον `ai-assistant/`
  chat)· 3Δ QA markers (τώρα κρύβονται σε 3D — zoom-to δουλεύει)· auto-clear του report σε αλλαγή σημείων (τώρα
  «Run → review» snapshot + Clear, όπως Civil 3D/TBC)· user-facing tuning των κατωφλίων (τώρα σταθερά config).

  **Status: M1 + M2 + M3 + M4 + M5α + M6 + M7 IMPLEMENTED· M5β, M8 προγραμματισμένα (§12.2).**

- **2026-07-14 (v12)** — **Milestone 5β ΥΛΟΠΟΙΗΘΗΚΕ: «Μίλα στο σχέδιο» = NL editing με LLM tool-calling**
  (§12.2 M5 μέρος β· Q7 #2). **Το M5 (α+β) είναι πλέον ΠΛΗΡΕΣ.**

  **Φιλοσοφία (§9):** AI-accelerant / **human-certifier**. 🔴 Το LLM **ΔΕΝ** γράφει γεωμετρία και **ΔΕΝ**
  γράφει stores απευθείας — καλεί τα **ΙΔΙΑ** commands που καλεί το UI (ένας executor ανά tool → υπάρχον
  command/store). Έτσι undo/persist/derived-TIN/QA report μένουν byte-identical με ένα πάτημα κουμπιού.

  **Big-player πρακτική (§8):** SuperMap/Autodesk AI assistant, Speckle NL-CAD — NL editing = **tool-calling
  πάνω σε υπάρχον command API**, ΟΧΙ raw geometry από το μοντέλο. Αυτό ακριβώς.

  **Reuse ΟΛΟΥ του AI infra (`ai-assistant/`) — ΚΑΝΕΝΑ δεύτερο chat/loop/executor/caller, ΚΑΜΙΑ νέα dep:**
  ίδιο chat (`DxfAiChatPanel`/`useDxfAiChat`), ίδιο route (`api/dxf-ai/command`), ίδιος caller (`callOpenAI`,
  gpt-4o-mini). Το topo tool-set μπαίνει **δίπλα** στα drawing tools (ένα AI, πολλά domain tool-sets — ό,τι
  προβλέπει το `grid-tool-definitions`). Ο client κάνει partition: drawing calls → `executeDxfAiToolCalls`,
  topo calls → νέο `executeTopoAiToolCalls`.

  **8 topo tools** (`topo-tool-definitions.ts`, ίδιο Chat-Completions σχήμα με grid: `strict:true`, optional =
  `['x','null']` στο `required`): `generate_contours` (→`useTopoContours.generate`), `set_contour_style`
  (→`useContourDisplay.setStyle`), `toggle_terrain_3d`+`set_terrain_style` (→`terrain-3d-store`),
  `run_quality_check` (→ **καλεί** το M5α `runTopoQa`+`topoQaStore`, δεν το ξαναχτίζει), `set_cutfill_reference`+
  `run_cutfill` (→`cut-fill-store`, mirror του panel: analysis style στο 3Δ), `remove_elevation_spikes`
  (**destructive**). Μονάδες: το μοντέλο δίνει **ΜΕΤΡΑ** (όπως τα λέει ο χρήστης)· ο executor →mm (ίδια αιχμή
  μετατροπής με το panel, ΠΟΤΕ το LLM).

  **Destructive «σβήσε τα spikes» — ρητό confirm (Q-spikes = ΜΕΣΑ):** νέο deterministic SSoT
  `remove-elevation-spikes.ts` — **reuse** του M5α `checkElevationBusts` ως η μοναδική πηγή «τι είναι spike»· ο
  flagged TIN node γυρίζει στο raw σημείο μέσω του **ίδιου** `localVertexKey` που έκανε dedup ο `tin-builder`
  (κόμβοι από breakline vertex → κανένα raw σημείο → δεν σβήνονται). Ο executor **ΔΕΝ** σβήνει: επιστρέφει
  `TopoPendingConfirm`· το chat δείχνει inline Confirm/Cancel· μόνο μετά το «Επιβεβαίωση» τρέχει
  `confirmRemoveElevationSpikes`→`removeElevationSpikes`→`setTopoPoints`. Ο μηχανικός εγκρίνει, ποτέ το LLM.

  **N.11:** ο executor επιστρέφει **i18n keys+params** (ίδιο συμβόλαιο με τα M5α QA flags), το chat τα resolve-άρει
  με `t()` — μηδέν hardcoded strings. i18n `aiAssistant.topo.*` el+en (`dxf-viewer-guides`).

  **Files:** +`ai-assistant/topo-tool-definitions.ts` (+`TOPO_TOOL_NAMES` SSoT — μία λίστα για type union / route
  allow-list / executor partition, ώστε να μη γίνει drift όπως το χειροκίνητο grid set)·
  +`ai-assistant/topo-ai-tool-executor.ts`· +`systems/topography/remove-elevation-spikes.ts`· MOD `ai-assistant/
  types.ts` (topo tool names/args + `TopoAiExecutionResult`/`TopoPendingConfirm`)· `dxf-system-prompt.ts` (topo
  section)· `api/dxf-ai/command/route.ts` (+`TOPO_TOOL_DEFINITIONS`)· `command-helpers.ts` (+`TOPO_TOOL_NAMES` στο
  allow-list)· `hooks/useDxfAiChat.ts` (partition + pending-confirm state + confirm/cancel)· `components/
  DxfAiChatPanel.tsx` (topo commands από hooks + inline confirm affordance)· `ai-assistant/index.ts`.
  Tests: +19 πράσινα (executor mapping με mocks· spike-removal preview/remove/idempotent)· υπάρχον
  `match-intent-schema` πράσινο (no regression).

  **Ρητά ΔΕΝ μπήκαν (ΟΧΙ μαντεμένα):** M8 (point clouds/auto-breakline)· persistent «current interval» store (το
  interval ζει σε React state του `TopographyPanel`· το `generate_contours` παίρνει το interval ως arg, ίδια
  συμπεριφορά με το κουμπί — δεν εφευρέθηκε store)· sync του panel interval field με την AI εντολή (χωριστές
  επιφάνειες ελέγχου, όπως command-line vs slider). M5α open items (3Δ markers, auto-clear, tuning) παραμένουν.

  **Status: M1 + M2 + M3 + M4 + M5 (α+β) + M6 + M7 IMPLEMENTED· M8 προγραμματισμένο (§12.2).**

- **2026-07-14 (v13)** — **Milestone 8α ΥΛΟΠΟΙΗΘΗΚΕ: point-cloud ingestion + bare-earth ground filter**
  (§12.2 γραμμή M8 — το **πρώτο** κομμάτι· §6 AI/ML + άδειες· §9 differentiators #1/#2).

  **Η καρδιά:** το point cloud **ΔΕΝ** φτιάχνει δεύτερο pipeline. Μπαίνει ως **4ος δρόμος εισαγωγής** στον
  ΥΠΑΡΧΟΝΤΑ `TopoImportWizard` και το φιλτραρισμένο έδαφος καταλήγει στο ΥΠΑΡΧΟΝ `TopoPointStore` μέσω του
  ΙΔΙΟΥ `setTopoPoints()`. Από εκεί `getTopoSurface()` → **ισοϋψείς / 3Δ / QA / όγκοι / ελληνικό export
  δουλεύουν ΔΩΡΕΑΝ** (M1–M7 αμετάβλητα — μηδέν γραμμή άλλαξε σε αυτά).

  ```
  PointCloudData  →  GroundClassifyResult  →  voxel decimate  →  TopoPoint[]  →  TopoPointStore
  (εκατομμύρια)      (ποιοι δείκτες=έδαφος)  (χιλιάδες)          (υπάρχον SSoT)   → getTopoSurface()
  ```

  **Big-player πρακτική (§8):** Autodesk ReCap / Civil 3D «Point Cloud to Surface», Trimble RealWorks,
  CloudCompare. Δύο συμπεριφορές που η αφελής υλοποίηση χάνει και εδώ μπήκαν:
  1. **Τιμούμε την ταξινόμηση της πηγής.** Clouds από DJI Terra / Pix4D / Terrasolid έρχονται ΗΔΗ
     ταξινομημένα (ASPRS class 2 = Ground). Το ReCap/Civil 3D **δεν** ξανατρέχουν φίλτρο πάνω τους — είναι
     πιο αργό ΚΑΙ χειρότερο (ο vendor είχε τα raw returns, εμείς μόνο XYZ). `method:'source-classification'`,
     με ρητό override («ξανα-φιλτράρισμα με CSF») για τον μηχανικό.
  2. **Ο μηχανικός βλέπει τι κόπηκε ΠΡΙΝ εγκρίνει** — top-down scatter preview (έδαφος vs μη-έδαφος) στον
     wizard. **AI-accelerant / human-certifier (§9)**, ποτέ αυτόνομη πιστοποίηση.

  **Ground filter = CSF (Cloth Simulation Filter), Zhang et al. 2016 — υλοποιημένο IN-HOUSE.**
  Ο industry default (CloudCompare plugin, PDAL `filters.csf`). **ΜΗΔΕΝ νέα dependency** — τα ίδια τέσσερα
  knobs με το CloudCompare (cloth resolution / class threshold / rigidness 1-3 / slope smoothing), ίδια
  σημασία, ώστε μηχανικός που ξέρει CloudCompare να αναγνωρίζει το δικό μας.

  **Νέα modules** (`systems/topography/pointcloud/`):
  | Αρχείο | Ρόλος |
  |---|---|
  | `pointcloud-types.ts` | Domain types — **SoA typed arrays** (30M σημεία ως objects ≈ 3 GB heap → η καρτέλα πεθαίνει· ως typed arrays = 360 MB, ό,τι κάνουν Potree/PDAL/laz-perf) |
  | `asprs-las-spec.ts` | ASPRS LAS 1.0–1.4 spec (header offsets, PDRF 0–10, classification codes, class colours) |
  | `pointcloud-defaults.ts` | **SSoT κάθε tunable** (CSF/voxel/preview/worker thresholds) — μηδέν inline magic number |
  | `pointcloud-read.ts` | Dispatcher (magic-first) **+ ο κοινός κορμός** των δύο readers (N.18 — αλλιώς sibling clones) |
  | `las-reader.ts` | LAS binary parser, PDRF 0–10 (classification byte: offset 15 σε PDRF 0-5, 16 σε 6-10) |
  | `ascii-xyz-reader.ts` | BULK ASCII (streaming line-scan χωρίς `split()`, 2 περάσματα) — ο υπάρχων `parse-topo-points.ts` μένει ο δρόμος για ΜΙΚΡΑ αρχεία |
  | `csf-cloth.ts` + `csf-grid.ts` | CSF: Verlet βαρύτητα → ελατήρια → σύγκρουση· height map (IHV) με raster + BFS fill + bilinear sampling |
  | `classify-ground.ts` | Dispatcher: `source-classification` vs `csf` |
  | `voxel-decimate.ts` | Voxel buckets (integer keys)· `lowest` = συντηρητικός DTM αντιπρόσωπος (ο θόρυβος μετά το φίλτρο είναι σχεδόν πάντα ΠΑΝΩ από την επιφάνεια) → `TopoPoint[]` σε WORLD mm |
  | `pointcloud-preview.ts` | Display-only cloud (≤`PREVIEW_MAX_POINTS`) — **ΠΟΤΕ** δεν φτάνει στο TIN, ποτέ δεν μετριέται (§6) |
  | `pointcloud-pipeline.ts` | read → classify → decimate → preview (τρέχει ΚΑΙ σε worker ΚΑΙ σε main thread) |
  | `workers/pointcloud.worker.ts` | Worker (transferred ArrayBuffer· dynamic import του pipeline — ADR-639 pattern) |
  | `io/pointcloud-import.ts` | Worker routing SSoT (liveness probe + timeout + **main-thread fallback**), mirror του `io/dxf-import.ts` |
  | `ui/panels/topography/TopoCloudStep.tsx` + `topo-cloud-preview-canvas.ts` | Το βήμα «γυμνό έδαφος» + canvas scatter |

  **Ακρίβεια (γιατί LOCAL origin + Float32):** ΕΓΣΑ'87 easting σε canonical mm ≈ 3e8..9e8. Το Float32 έχει
  24-bit mantissa → raw world mm στα 9e8 κουβαλά **~64 mm σφάλμα** — χειρότερο από την ανοχή που υποτίθεται
  ότι διαφυλάσσει. Αποθηκεύουμε **LOCAL mm** (world − origin· ≤0.25 mm σφάλμα σε site 2 km). Ίδιο κόλπο,
  ίδιος λόγος με το `TinSurface.origin`. Ο `las-reader` **δεν εμπιστεύεται τυφλά τα bounds του header**
  (όργανα γράφουν μηδενικά bounds → origin 0 → επιστροφή στο σφάλμα των 64 mm): sanity check + rescan.

  **Κλίμακα:** `maxPointsInMemory` (30M) με **stride-sampling ΚΑΤΑ ΤΟ PARSE** (ποτέ allocate-then-discard).
  Το `cdt2d` δεν κλιμακώνει σε εκατομμύρια → στο TIN φτάνει ΜΟΝΟ το αραιωμένο ground set (0.5 m spacing σε
  1 στρέμμα ≈ 40k σημεία).

  **Άδειες (N.5 / §6):** **ΚΑΜΙΑ νέα dependency.** Το CSF γράφτηκε in-house (το paper είναι δημόσιο· η
  reference υλοποίηση Apache-2.0 δεν χρησιμοποιήθηκε ως κώδικας). ASPRS LAS spec = δημόσιο, royalty-free.
  Δεν μπήκε τίποτα CC-BY-NC (RandLA-Net, Depth-Anything V2 Base/Large — **παραμένουν απαγορευμένα**).

  **Tests:** 5 suites / 59 tests στο `pointcloud/` (συνθετικά LAS buffers in-memory, analytic terrain για CSF:
  κεκλιμένο επίπεδο + δέντρα/κτίρια + τοίχος αντιστήριξης, ντετερμινισμός, world re-projection). Σύνολο
  topography: **17 suites / 153 tests PASS**, μηδέν regression. jscpd (N.18): **μηδέν clones** — ούτε μεταξύ
  των readers, ούτε έναντι του `io/dxf-import.ts`.

  **🔴 ΤΙ ΔΕΝ ΜΠΗΚΕ (τίμια):**
  - **LAZ (συμπιεσμένο) ΔΕΝ αποσυμπιέζεται** → καθαρό `throw` (`error.lazUnsupported`). Θα απαιτούσε
    `laz-perf`/`copc.js` (+ license check + έγκριση Giorgio). Το LAS (ασυμπίεστο) δουλεύει πλήρως.
  - **3Δ point-cloud layer** (three.js `Points`): το preview data παράγεται και ζωγραφίζεται ως **2D top-down
    scatter** στον wizard. Το πλήρες 3Δ layer = M8β.
  - **ASCII**: X/Y/Z = τα 3 πρώτα **αριθμητικά** πεδία. Αρχείο με αριθμητική στήλη id ΠΡΩΤΑ (`1 384512.3 …`)
    θα διαβάσει το id ως X. Το id-aware mode = M8β (ο υπάρχων column-mapping δρόμος καλύπτει τα μικρά αρχεία).
  - **Γνωστοί περιορισμοί του CSF μας** (τίμιοι, μετρημένοι): (α) το relaxation είναι **Jacobi**, όχι
    in-place Gauss-Seidel — το in-place sweep κάνει το ύφασμα άκαμπτη πλάκα που γεφυρώνει ολόκληρο σκαλοπάτι
    (έχανε 47% του εδάφους στο test του τοίχου αντιστήριξης)· με Jacobi η επιρροή διαδίδεται 1 κελί/pass και
    το `rigidness` γίνεται πραγματικό knob. (β) Σε σκαλοπάτι 2 m χάνονται τα σημεία μέσα σε **±1 κελί
    υφάσματος** από τη ρωγμή — το ύφασμα «κρέμεται» πάνω από τον γκρεμό· **γνωστή, αποδεκτή συμπεριφορά του
    CSF** (το ίδιο κάνει το CloudCompare)· το test επιβεβαιώνει ότι ΟΛΑ τα χαμένα σημεία είναι εντός 1 m από
    τη ρωγμή. (γ) IHV = πλησιέστερο σημείο (raster + BFS fill), όχι k-d tree. (δ) 4-connected γείτονες → λίγο
    πιο «μαλακό» ύφασμα από το reference στην ίδια τιμή rigidness.
  - **Υπόλοιπο M8** (επόμενα sessions): auto-breakline detection (#3), full closed-loop drone→CAD (#1),
    multiplayer/CRDT (#7), Gaussian-Splat visualization (#8 — **ΠΟΤΕ** ως γεωμετρία μέτρησης, §6),
    DEM super-resolution, server-GPU KPConv.

  **Status: M1 + M2 + M3 + M4 + M5 (α+β) + M6 + M7 + M8α IMPLEMENTED· υπόλοιπο M8 προγραμματισμένο (§12.2).**

---

- **2026-07-14 (v14)** — **Milestone 8β/Α ΥΛΟΠΟΙΗΘΗΚΕ: LAZ decode** (το «μισό» του M8α έκλεισε)

  **Το πρόβλημα που λύνει.** Τα drones **δεν βγάζουν `.las`**. DJI Terra, Pix4D, Terrasolid — όλα εξάγουν
  **`.laz`** (συμπιεσμένο, ~7:1). Το M8α το απέρριπτε τίμια (`error.lazUnsupported`), που σήμαινε ότι ο
  μηχανικός έπρεπε να μετατρέψει **κάθε** αρχείο μόνος του (LAStools/CloudCompare) πριν καν το ρίξει στην
  εφαρμογή. Η ροή «drone → CAD» ήταν σπασμένη στο πρώτο βήμα. **Δεν είναι πια.**

  **Η μία γραμμή που είναι όλη η αρχιτεκτονική:**

  ```
  .laz bytes → laz-perf (WASM) → ΑΣΥΜΠΙΕΣΤΑ LAS records → decodeLasRecords → PointCloudData
                                                           ^^^^^^^^^^^^^^^^ ο ΙΔΙΟΣ decoder με το .las
  ```

  Ένα LAZ **ΕΙΝΑΙ** ένα LAS του οποίου τα point records πέρασαν από arithmetic coder: ίδιο header, ίδιο PDRF,
  ίδια 12 bytes int32 XYZ, ίδιο classification byte. Άρα μόλις αποσυμπιεστούν τα chunks **δεν μένει τίποτα
  LAZ-specific**. Ο `laz-reader.ts` **δεν ξαναγράφει** ούτε τον κανόνα του origin, ούτε των bounds, ούτε τη
  legacy class mask, ούτε το hot loop — τα παραδίδει στον **έναν** decoder που εξήχθη από τον `las-reader.ts`
  (`decodeLasRecords`, νέα εξαγωγή· N.18 — δεύτερο αντίγραφο του loop = ακριβώς ο sibling clone που πιάνει το
  jscpd ratchet). **Μηδέν δεύτερο pipeline, μηδέν δεύτερος wizard, μηδέν δεύτερο ceiling πλην του παρακάτω.**

  **📦 Η ΝΕΑ ΕΞΑΡΤΗΣΗ (N.5 / ADR-034 App. C) — εγκεκριμένη από τον Giorgio 2026-07-14:**

  | Πακέτο | Άδεια | Επαλήθευση | Μέγεθος | Deps |
  |---|---|---|---|---|
  | **`laz-perf@0.0.7`** (Hobu Inc. — οι δημιουργοί του PDAL/Entwine) | **Apache-2.0** ✅ | **Τρία επίπεδα**: `package.json` · το `COPYING` του repo (πλήρες κείμενο Apache-2.0, **0 αναφορές LGPL** σε 202 γραμμές) · τα headers των C++ sources (`lazperf.hpp`, `las.hpp`, `decoder.hpp` → «*terms of the Apache Public License 2.0*») | 214 KB `.wasm` + 87 KB JS glue | **καμία** |
  | `@types/emscripten` (dev) | MIT ✅ | DefinitelyTyped | — | — |

  🚨 **Η ιστορική ανησυχία ήταν σωστή και ελέγχθηκε:** το **LASzip** του Isenburg είναι **LGPL**. Το `laz-perf`
  είναι **ανεξάρτητη re-implementation** του Hobu που ο ίδιος ο Isenburg αδειοδότησε **Apache-2.0** — δεν είναι
  dual-license, είναι **σκέτο Apache-2.0**. Είναι ό,τι χρησιμοποιούν potree, copc.js, deck.gl.
  **Απορρίφθηκαν:** `copc` (MIT, αλλά **εξαρτάται από laz-perf** → περιτύλιγμα, όχι εναλλακτική)· `las-js`
  (MIT, αλλά **δεν αποσυμπιέζει LAZ** καθόλου)· in-house LAZ decoder (arithmetic coding + chunked layout =
  εβδομάδες, με μόνιμη ευθύνη ορθότητας, για format με ΜΙΑ κανονική υλοποίηση).

  **Νέα modules:**

  | Module | Ρόλος |
  |---|---|
  | `pointcloud/laz-reader.ts` | Αποσυμπίεση → records → **υπάρχον** `decodeLasRecords`. Stride **κατά την αποσυμπίεση** (βλ. κάτω). Ελευθερώνει κάθε WASM allocation σε `finally`. |
  | `pointcloud/laz-runtime.ts` | Lazy **singleton** του WASM module (instantiate μία φορά, μοιραζόμενο in-flight promise)· καθαρίζει το promise σε αποτυχία ώστε το retry να μη δηλητηριάζεται· `LazPerfFactory` = test seam. |
  | `pointcloud/laz-wasm-url.ts` | Μόνο browser/Worker: `new URL('laz-perf/lib/laz-perf.wasm', import.meta.url)` (webpack asset module). Προσεγγίζεται με **dynamic** import ώστε το jest να μη σπάει στο `import.meta`. |

  **Τροποποιήσεις:**
  - `las-reader.ts` → εξήγαγε `decodeLasRecords` (+ `LasRecordSource`, `assertSupportedPdrf`,
    `resolveRecordLength`). Το `readLasPointCloud` έγινε **thin wrapper** από πάνω του. **Μηδέν αλλαγή
    συμπεριφοράς** (τα 153 tests του M8α το επιβεβαιώνουν).
  - `pointcloud-read.ts` → `readPointCloud` **έγινε `async`** και δρομολογεί `.laz` → `readLazPointCloud` με
    **dynamic import** (τα 214 KB WASM **δεν** κατεβαίνουν ποτέ για μηχανικό που ανοίγει μόνο `.las`/`.xyz`).
    Νέα keys: `error.lazRuntimeUnavailable`, `error.lazDecodeFailed` (el+en).
  - `pointcloud-pipeline.ts` → `async` (μόνο επειδή το **read** είναι· CSF/decimate/preview μένουν sync).
    `pointcloud.worker.ts` + `io/pointcloud-import.ts` → `await`. **Καμία αλλαγή στο routing/ceilings.**
  - `topography/index.ts` → τα `laz-*` modules **ΔΕΝ** εξάγονται από το barrel — ένα static re-export θα
    ακύρωνε το lazy loading και θα χρέωνε το WASM σε όλους.

  **⚠️ Το ένα πράγμα που το LAZ πληρώνει και το LAS όχι** (`LAZ_MAX_POINTS_IN_MEMORY = 12M`, νέο στο
  `pointcloud-defaults.ts`): ένα `.las` αποκωδικοποιείται **in place**, πάνω στα ίδια τα bytes του αρχείου. Ένα
  `.laz` **δεν μπορεί** — τα records υπάρχουν μόνο αφού τα παράγει ο decoder, άρα πρέπει να υλοποιηθούν σε ένα
  προσωρινό buffer (~34 B/σημείο, ελευθερώνεται μόλις χτιστούν τα SoA arrays). 12M × 34 B ≈ 400 MB + ~160 MB
  SoA = κορυφή που αντέχει ένα tab· τα 30M του LAS **δεν** θα την άντεχαν. Πάνω από αυτό → **stride-sampling
  κατά την αποσυμπίεση** + `warn.strideSampled`. Δεν κοστίζει τίποτα πραγματικό: η μετρημένη γεωμετρία είναι το
  **αραιωμένο ground set** (voxel 0.5 m → δεκάδες χιλιάδες σημεία), όχι το ωμό νέφος.

  **⚠️ Γιατί το stride γίνεται στον LAZ reader και όχι στον decoder:** τα LAZ chunks **δεν παραλείπονται** —
  δεν υπάρχει random access σε arithmetic-coded stream. Κάθε σημείο **αποσυμπιέζεται**· το sampling αποφασίζει
  μόνο ποια **κρατάμε**. Ο decoder καλείται μετά με `stride: 1`.

  **Tests: 19 suites / 167 tests PASS** στο `systems/topography` (από 17/153 — **+2 suites, +14 tests**, μηδέν
  regression). jscpd (N.18): **μηδέν clones** στα 9 αρχεία που άγγιξα.
  - `laz-reader.test.ts` — **ground truth: ένα `.laz` πρέπει να δώσει το ΙΔΙΟ cloud με το `.las` δίδυμό του.**
    Κάθε test χτίζει **ένα** in-memory LAS και το διαβάζει **δύο φορές**: με τον πραγματικό LAS reader, και με
    τον LAZ reader πάνω σε **fake laz-perf** που επιστρέφει ακριβώς αυτά τα records. Συγκρίνει x/y/z,
    classification, origin, bounds, histogram — οποιαδήποτε απόκλιση = fail. Καλύπτει: PDRF 1 & 6, LOCAL/WORLD
    frame, junk header bounds → bounds scan, stride κατά την αποσυμπίεση, **heap hygiene** (μηδέν live
    allocation ακόμα και όταν ο decode πετάει), progress, και τα 4 error keys.
    *Γιατί fake και όχι πραγματικό `.laz` blob:* το laz-perf έχει **decoder μόνο, όχι encoder** → ένα πραγματικό
    fixture θα ήταν checked-in binary blob άγνωστης προέλευσης, και θα τεστάριζε το **laz-perf** (δουλειά του
    Hobu, ήδη σκληραγωγημένη από potree/PDAL), όχι **τον δικό μας** seam (heap in, records out, stride, cleanup,
    error keys) — που είναι ακριβώς ό,τι τεστάρει το fake.
  - `laz-routing.test.ts` — ο dispatcher στέλνει `.laz` στον LAZ reader (M8α το απέρριπτε), και **δεν αγγίζει
    ποτέ** το module για `.las`/`.xyz` (το WASM μένει πίσω από το dynamic import).
  - `pointcloud-fixtures.ts` — ο `buildLas` builder **μετακινήθηκε εδώ** από το `las-reader.test.ts` ώστε το LAZ
    suite να μην τον κλωνοποιήσει (N.18).

  **🔴 ΤΙ ΔΕΝ ΜΠΗΚΕ (τίμια):**
  - **COPC / EPT** (cloud-optimized point cloud, octree streaming): ο `LASZip` reader φορτώνει **ολόκληρο** το
    αρχείο στο WASM heap. Για τα μεγέθη που στοχεύουμε (≤250 MB) δουλεύει· για terabyte-scale streaming θα
    ήθελε τον `ChunkDecoder` + octree index. Δεν χρειάζεται σήμερα.
  - **3Δ point-cloud layer** (M8β/Β) — ακόμα 2D top-down scatter στον wizard.
  - **Auto-breakline detection** (M8β/Γ) — αμετάβλητο.
  - **id-aware ASCII** (M8β/Δ) — αμετάβλητο.
  - Οι **γνωστοί περιορισμοί του CSF** (v13) ισχύουν αυτούσιοι — το LAZ αλλάζει μόνο **από πού** έρχονται τα
    σημεία, τίποτα κατάντη.

  ✅ **Google-level: ΝΑΙ** — ο decoder είναι ένας (SSoT· το LAZ path αποδεδειγμένα ισοδύναμο με το LAS μέσω
  test), το WASM instantiate-άρεται μία φορά και μόνο αν χρειαστεί, κάθε allocation ελευθερώνεται σε `finally`,
  κάθε αποτυχία φέρνει i18n key (ποτέ raw μήνυμα), και το κόστος bundle το πληρώνει **μόνο** όποιος ανοίγει
  `.laz`.

  **Status: M1 + M2 + M3 + M4 + M5 (α+β) + M6 + M7 + M8α + M8β/Α IMPLEMENTED· M8β/Β (3Δ layer), M8β/Γ
  (auto-breaklines), M8β/Δ (μικρά) προγραμματισμένα (§12.2).**
- **2026-07-14 (v15)** — **M8β/Γ ΥΛΟΠΟΙΗΘΗΚΕ — auto-breakline detection** (Phase 3, N.0.1). Ο
  **differentiator #3** του §9: σήμερα ο μηχανικός δείχνει τις γραμμές ασυνέχειας μία-μία με το χέρι
  (M2-Β)· τώρα το σύστημα διαβάζει την **ΙΔΙΑ** επιφάνεια που ήδη βλέπει και **του τις προτείνει**.

  **🔑 Η κρίσιμη διαπίστωση του SSoT audit: ο ανιχνευτής ΥΠΗΡΧΕ ΗΔΗ.** Το `check-missing-breaklines.ts`
  (M5α) ήδη μετρούσε τη dihedral fold κάθε εσωτερικής ακμής και πετούσε τις ήδη constrained. Δεύτερος
  ανιχνευτής **δεν** γράφτηκε: η μέτρηση **εξήχθη** στο `auto-breaklines/detect-feature-edges.ts`
  (`findSteepUnconstrainedEdges`) και **την καλούν και οι δύο** — ο QA check την διαβάζει ως advisory flag,
  ο extractor την αλυσιδώνει. Ένα `foldDeg` / ένα `triangleNormal` σε όλο το subsystem.

  **Το πραγματικά νέο = το CHAINING.** Μια breakline δεν είναι ακμή, είναι **πολυγραμμή**: η άκρη ενός
  δρόμου = ~200 συνεχόμενες απότομες ακμές που πρέπει να γυρίσουν **ΜΙΑ** ordered polyline. Και εδώ το audit
  βρήκε **δεύτερο** SSoT: ο **`contour-chainer` (M1)** έκανε ήδη ακριβώς αυτό (loose segments → πολυγραμμές)
  για τις ισοϋψείς. Αντί για δίδυμο walk (που θα το έκοβε το jscpd — N.18), ο walk **γενικεύτηκε** σε
  `systems/topography/graph-chain.ts` (`chainUndirectedEdges`) και **τον μοιράζονται και οι δύο**· ο
  `contour-chainer` ξαναγράφτηκε πάνω του με **bit-for-bit ίδια συμπεριφορά** (τα 167 tests του M1–M8α
  πράσινα, αμετάβλητα).

  **Η μία ουσιαστική διαφορά των δύο καταναλωτών — και είναι κανόνας, όχι λεπτομέρεια:** στο **junction**
  (κόμβος με ≥3 ακμές) οι ισοϋψείς **συνεχίζουν** (ιστορική M1 συμπεριφορά), οι breaklines **ΣΤΑΜΑΤΟΥΝ**
  (`stopAtJunction`). Όπου μια άκρη δρόμου συναντά μια τάφρο, το Civil 3D δίνει **ΤΡΕΙΣ** feature lines και
  αφήνει τον μηχανικό να αποφασίσει — δεν μαντεύει ποιο σκέλος «συνεχίζει». Ούτε εμείς.

  **Νέα αρχεία** (`systems/topography/`): `graph-chain.ts` (SSoT walk· `stopAtJunction`) ·
  `auto-breaklines/detect-feature-edges.ts` (ο κοινός ανιχνευτής fold) · `auto-breaklines/chain-feature-edges.ts`
  (ακμές → υποψήφιες· φίλτρα· ταξινόμηση κατά μήκος· cap) · `auto-breaklines/auto-breakline-config.ts`
  (**κάθε** κατώφλι — το `MIN_FOLD_ANGLE_DEG` **παράγεται** από το `TOPO_QA_CONFIG.MISSING_BREAKLINE_ANGLE_DEG`,
  ώστε QA και extractor να μη διαφωνήσουν ΠΟΤΕ για το τι είναι «απότομο») · `auto-breakline-types.ts` ·
  `auto-breakline-store.ts` (LOW-freq review store: report + τσεκαρισμένες· ADR-040-safe) · `index.ts`
  (`detectAutoBreaklines` = **pure**, `acceptAutoBreaklines` = **ο μόνος γράφων**). UI:
  `ui/panels/topography/TopoAutoBreaklineSection.tsx` (pattern του `TopoQaSection`: τρέξε → δες → δράσε) +
  `components/dxf-layout/TopoAutoBreaklinePreviewOverlay.tsx` (SVG leaf, mirror του
  `RegionPerimeterPreviewOverlay`· πράσινο = θα μπει, γκρι διακεκομμένο = απορρίφθηκε).

  **§9 human-certifier — ΤΗΡΕΙΤΑΙ ΚΑΤΑ ΓΡΑΜΜΑ:** ο `detectAutoBreaklines` **δεν γράφει τίποτα**. Η μόνη
  διαδρομή προς τον store είναι το κουμπί «Προσθήκη επιλεγμένων» → `acceptAutoBreaklines(τσεκαρισμένες)` →
  `addBreakline` (εκεί κόβεται και το enterprise id, N.6). Ούτε το Civil 3D ούτε το CloudCompare γράφουν
  feature lines μόνα τους· ούτε εμείς. **Idempotent by construction:** ό,τι εγκριθεί γίνεται constrained, και
  οι constrained ακμές **δεν** είναι υποψήφιες → δεύτερο πέρασμα δεν ξαναπροτείνει το ίδιο.

  **Tests:** `__tests__/auto-breaklines.test.ts` — analytic surfaces με **γνωστή απάντηση**: στέγη 5×3
  (η κορυφογραμμή = ακριβώς 4 ακμές, fold 53.13° = 2·atan(0.5) — επαληθεύεται αριθμητικά· επιστρέφεται **μία**
  υποψήφια, 5 κορυφές, monotonic, σε WORLD συντεταγμένες)· ήδη constrained κορυφογραμμή → **0** ευρήματα·
  **Y-junction → 3 αλυσίδες** (ποτέ μαντεμένη διαδρομή)· θόρυβος <3 ακμών και μήκος <5 μ → απορρίπτονται·
  κλειστός δακτύλιος → `closed: true` **χωρίς** επαναλαμβανόμενη πρώτη κορυφή. **20 suites / 180 tests
  πράσινα** (baseline 19/167 → +1 suite / +13 tests, **κανένα σπασμένο**). **jscpd (N.18): 0 clones.**

  **Ρητά ΔΕΝ μπήκαν (ΟΧΙ μαντεμένα):**
  - **Douglas-Peucker weeding** των υποψηφίων: ο υπάρχων `simplifyPolyline` είναι **2Δ** (`Point2D`) — θα
    πετούσε κορυφές κρίνοντας μόνο από κάτοψη και θα **κατέστρεφε το Ζ** μιας feature line. Μια 3Δ RDP είναι
    δουλειά δική της, όχι παρελκόμενο· ο Civil 3D επίσης το έχει **ξεχωριστή** εντολή («Weed vertices»).
  - **Ταξινόμηση τύπου** (ράχη vs τάφρος vs τοίχος): θα ήθελε πρόσημο της καμπυλότητας ανά αλυσίδα — χρήσιμο,
    αλλά δεν το ζήτησε ο §9 #3 και δεν το δείχνει ούτε το Civil 3D στο extract.
  - **Auto-run** σε κάθε αλλαγή της επιφάνειας: το πέρασμα είναι O(ακμές) αλλά η **έγκριση** είναι ανθρώπινη·
    ένα καμπανάκι που χτυπά μόνο του σε κάθε import είναι θόρυβος, όχι feature.

  ✅ **Google-level: ΝΑΙ** — ο ανιχνευτής είναι **ένας** (QA + extractor διαβάζουν το ίδιο fold), ο walk είναι
  **ένας** (ισοϋψείς + breaklines μοιράζονται τον ίδιο chainer), κάθε κατώφλι ζει στο config (μηδέν inline
  magic number), η ροή είναι **idempotent** και **καμία** γραμμή δεν φτάνει στον store χωρίς ρητή ανθρώπινη
  έγκριση.

  **Status: M1 + M2 + M3 + M4 + M5 (α+β) + M6 + M7 + M8α + M8β/Α + M8β/Γ IMPLEMENTED· M8β/Β (3Δ layer),
  M8β/Δ (μικρά) προγραμματισμένα (§12.2).**

- **2026-07-14 (v16)** — **M8β/Β ΥΛΟΠΟΙΗΘΗΚΕ — 3Δ point-cloud layer** (Phase 3, N.0.1). Το νέφος
  (LAS/LAZ) έπαυε να υπάρχει μόλις έκλεινε ο wizard: φαινόταν **μόνο** ως 2Δ top-down scatter μέσα του,
  και μετά έμεναν μόνο τα αραιωμένα survey σημεία. Τώρα ζει ως **`THREE.Points` layer** στην 3Δ όψη,
  πάνω από το έδαφος — ο μηχανικός γυρίζει τον λόφο και **βλέπει** τι κράτησε (καφέ) και τι πέταξε
  (γκρι) το φίλτρο εδάφους. Αυτό είναι το ReCap/CloudCompare/Potree parity και ο **human-certifier**
  έλεγχος του §9: βλέπει **πριν** εμπιστευτεί την επιφάνεια που βγήκε από το φίλτρο.

  **Το 90% υπήρχε ήδη — γράφτηκε μόνο ο καταναλωτής.** Το `buildCloudPreview` (M8α) ήδη παρήγαγε
  `PointCloudPreview` (interleaved Float32 θέσεις + ASPRS χρώματα, ήδη stride-sampled στα
  `PREVIEW_MAX_POINTS`) και το docstring του το έλεγε ρητά: *«for the three.js Points layer»*. **Μηδέν**
  δεύτερος builder / stride / παλέτα.

  **Τι μπήκε (4 νέα αρχεία + 4 wirings):**
  - `systems/topography/pointcloud-3d-store.ts` — ο **δίδυμος** του `terrain-3d-store`, με μία διαφορά:
    κρατά **δεδομένα** (`PointCloudPreview | null`), όχι μόνο flags. Είναι το «κάπου έξω από το React»
    όπου το preview επιβιώνει του wizard. Φρέσκο νέφος → **ορατό αμέσως** (αλλιώς ο μηχανικός τρέχει το
    φίλτρο και δεν βλέπει τίποτα)· import από άλλο δρόμο (CSV/DXF) → το παλιό νέφος **σβήνει** (ένα
    νέφος ανά αποτύπωση — αλλιώς κοιτάς άλλο εργοτάξιο).
  - `bim-3d/converters/cloud-to-three.ts` — pure `PointCloudPreview → BufferGeometry`, ο αδελφός του
    `tin-to-three`. Τα plan→three-world μαθηματικά **ΔΕΝ** αντιγράφηκαν: καλεί το **υπάρχον**
    `writeDxfPlanToWorld` (η ίδια συνάρτηση που χρησιμοποιούν TIN/grips/ghosts/snap) — αλλιώς το έδαφος
    και το νέφος θα «κάθονταν» με δύο διαφορετικά μαθηματικά και η απόκλιση θα φαινόταν μόνο σε
    geo-referenced ΕΓΣΑ'87. **Διαφορά από το TIN:** ένα μη-πεπερασμένο σημείο **παραλείπεται** αντί να
    ακυρώσει το build (το TIN δεν έχει αυτή την πολυτέλεια — κάθε κορυφή του ανήκει σε τρίγωνα· σε ένα
    νέφος 2M σημείων ένα κακό record από decoder δεν είναι λόγος να χαθεί το νέφος). NaN ⇒ NaN bbox ⇒
    μαύρη 3Δ σκηνή (ADR-537) — γι' αυτό φιλτράρεται, δεν αγνοείται.
  - `bim-3d/scene/terrain/PointCloudSceneLayer.ts` — standalone scene layer, **ΟΧΙ** BIM entity: το §12.3
    επιχείρημα του εδάφους ισχύει αυτούσιο (ο ορισμός δεν ζει πάνω σε element· entity που τυλίγει store =
    δεύτερη πηγή αλήθειας). Ίδιος owner pattern με το `TerrainSceneLayer` (construct στο
    `scene-manager-construct`, `dispose()` από τον `ThreeJsSceneManager`), imperative, μηδέν React state
    (ADR-040). Ιδιόκτητο `PointsMaterial` (**όχι** singleton του `MaterialCatalog3D` — εκείνος δίνει
    `MeshStandardMaterial` για στερεά) με `sizeAttenuation: false`: ένα νέφος με προοπτική εξασθένηση
    εξαφανίζεται στο βάθος και μοιάζει με «λείπουν δεδομένα» — ReCap/CloudCompare κρατούν σταθερό splat.
  - `ui/panels/topography/TopoCloud3DSection.tsx` — εμφάνιση/απόκρυψη + **ρητή αφαίρεση** + μετρητής
    σημείων/MB. Δεν εμφανίζεται καθόλου όσο δεν υπάρχει νέφος.

  🚨 **§6 — VISUALIZATION, ΠΟΤΕ ΓΕΩΜΕΤΡΙΑ ΜΕΤΡΗΣΗΣ, και επιβάλλεται στον κώδικα:** το `Points` βγαίνει
  **ρητά** από κάθε raycast (`points.raycast = () => {}`). Δεν είναι διακοσμητικό: το three κάνει raycast
  σε `Points` by default **και** ο 2Δ section picker (`2d-section/section-renderer.ts`) σαρώνει
  `scene.children` ολόκληρα — χωρίς αυτή τη γραμμή ο μηχανικός θα «έπιανε» σημεία νέφους σαν μετρημένη
  γεωμετρία. Το νέφος δεν αγγίζει `TopoPointStore`, δεν μπαίνει στο TIN, δεν γίνεται snap. Το clipping
  ήταν ήδη ασφαλές: το `PointsMaterial` είναι εκτός `CLIPPABLE_MATERIAL_TYPES` (ADR-452).

  ⚠️ **ΜΝΗΜΗ — μετρημένη, όχι αγνοημένη:** `PREVIEW_MAX_POINTS` (2M) × (3 θέσεις + 3 χρώματα) × 4 B =
  **48 MB** heap στο χειρότερο σενάριο (24 MB θέσεις + 24 MB χρώματα), και άλλα τόσα ως GPU buffers όσο
  το layer είναι **ορατό**. Bounded και γνωστό — αλλά **δεν** κρατιέται σιωπηλά για πάντα: (α) το layer
  κάνει πρώιμη έξοδο όταν είναι κρυμμένο και ελευθερώνει αμέσως τα GPU buffers, (β) ο μηχανικός έχει
  ρητό «**Αφαίρεση νέφους**» που πετά και τη heap, (γ) ένα νέο import αντικαθιστά πάντα το προηγούμενο
  (δεν συσσωρεύεται). Το panel του δείχνει τα MB — η μνήμη είναι ορατή απόφαση, όχι κρυφό κόστος.

  **Tests:** `cloud-to-three.test.ts` (ground truth χειρόγραφο: LOCAL→WORLD μόνο σε x/y, **ποτέ** στο Z·
  άξονες `(x, elev, −y)`· χρώματα per-vertex συγχρονισμένα με τις θέσεις που **επέζησαν** του NaN
  φίλτρου· fallback γκρι όταν λείπει ταξινόμηση· `null` σε άδειο/όλο-NaN) + `pointcloud-3d-store.test.ts`
  (φρέσκο→ορατό· CSV import→σβήνει το παλιό· hide κρατά δεδομένα / remove τα πετά· unsubscribe σιωπή).
  **22 suites / 190 tests PASS** (από 20/180 — τίποτα δεν έσπασε).

  **ΔΕΝ μπήκαν — και γιατί:**
  - **Potree / COPC / EPT octree streaming**: **καμία μετρημένη ανάγκη.** Το `PREVIEW_MAX_POINTS` = 2M
    είναι ένα draw call που τρέχει άνετα σε integrated graphics· το octree LOD αρχίζει να πληρώνει στα
    δεκάδες εκατομμύρια **ορατά** σημεία, που εδώ δεν φτάνουν ποτέ (το raw cloud μένει στον worker και
    ό,τι βλέπεις είναι ήδη αραιωμένο). Νέα dependency μόνο όταν το μετρήσουμε, όχι όταν το φανταστούμε.
  - **EDL / eye-dome lighting shading**: θέλει custom `ShaderMaterial` + depth pass. Ομορφαίνει, δεν
    προσθέτει πληροφορία που να μην τη δίνει ήδη ο χρωματισμός ground/non-ground.
  - **Χρωματισμός ανά RGB της πηγής / intensity**: το `PointCloudPreview` κουβαλά ταξινόμηση, όχι RGB —
    θα ήθελε αλλαγή στον reader (M8α). Ο χρωματισμός ΤΗΣ ΑΠΟΦΑΣΗΣ (τι κράτησε το φίλτρο) είναι αυτό που
    ζητά το §9, όχι φωτορεαλισμός.
  - **Persistence του νέφους** (Firestore/blob): 48 MB ανά αποτύπωση για ένα **display-only** τεκμήριο.
    Το ξαναφτιάχνεις σε δευτερόλεπτα από το αρχείο· η μετρήσιμη αποτύπωση (τα σημεία) **ήδη** persist-άρει.

  ✅ **Google-level: ΝΑΙ** — ένας builder νέφους (M8α, επαναχρησιμοποιήθηκε), **ένας** μετασχηματισμός
  plan→three-world (`writeDxfPlanToWorld`, κοινός με το TIN), ένα layer με ρητό owner + unregister-πριν-
  dispose, το §6 όριο επιβεβλημένο **στον κώδικα** (`raycast = () => {}`) και όχι μόνο στο ADR, και η
  μνήμη μετρημένη με έξοδο διαφυγής στα χέρια του χρήστη.

  **Status: M1 + M2 + M3 + M4 + M5 (α+β) + M6 + M7 + M8α + M8β/Α + M8β/Β + M8β/Γ IMPLEMENTED·
  M8β/Δ (id-aware ASCII) + moonshots προγραμματισμένα (§12.2).**

- **2026-07-14 (v17)** — **M8β/Δ ΥΛΟΠΟΙΗΘΗΚΕ — id-aware ASCII cloud** (Phase 3, N.0.1). Το νέφος
  σταματά να μαντεύει τις στήλες του και αρχίζει να **ρωτά**.

  **ΤΟ BUG (και ήταν bug, όχι «feature που λείπει»):** ο bulk reader (`ascii-xyz-reader.parseXyz`)
  έπαιρνε **τα πρώτα τρία αριθμητικά πεδία** κάθε γραμμής ως X/Y/Z. Σωστό για σκέτο `x y z` dump
  σαρωτή· **σιωπηλά καταστροφικό** για ό,τι κουβαλά **id πρώτο** — δηλαδή για το **PENZD/PNEZD**, το
  de-facto default των ελληνικών/Civil 3D exports:

  ```
  1  345678.123  4201234.456  125.30  EDGE     ← X=1, Y=345678, Z=4201234 (!)
  ```

  Δεν έσκαγε, δεν προειδοποιούσε: έβγαζε νέφος **χιλιομέτρων** ύψος, το CSF «έβρισκε έδαφος» μέσα
  του, και ο μηχανικός έπαιρνε ισοϋψείς από σκουπίδια. **Μια λάθος στήλη δεν παράγει ΣΦΑΛΜΑ — παράγει
  έγκυρη όψη ΛΑΘΟΥΣ εργοταξίου.** Γι' αυτό η στήλη είναι **ανθρώπινη έγκριση**, όχι μαντεψιά.

  **Η ΑΠΟΦΑΣΗ (τι κάνουν οι μεγάλοι):** CloudCompare ανοίγει **πάντα** το «Open ASCII file» dialog
  (μαντεύει προεπιλογή, **δεν** την επιβάλλει)· το PDAL (`readers.text`) **αρνείται** να μαντέψει
  χωρίς `order=`· το Civil 3D/CASS διαλέγει point-file **format** από κατάλογο. Ομόφωνο μοτίβο:
  **πρότεινε, μη μαντέψεις σιωπηλά.** Άρα: **deterministic sniffer** (μηδέν LLM, ίδια πειθαρχία με
  M5α/M8β/Γ) → **ορατό, επεξεργάσιμο mapping πριν το φίλτρο** (§9 «AI-accelerant / human-certifier»).

  **SSoT — τι ΔΕΝ ξαναγράφτηκε (το mapping υπήρχε ήδη από το M2):** `ColumnRole`/`ColumnMapping`,
  `TOPO_ORDER_PRESETS` (PNEZD/PENZD/PNEZ/PENZ/NEZ/ENZ/XYZ/XYZD — με το **N=Northing=Y** κλειδωμένο),
  `isMappingComplete`, `detectDelimiter`, `parseLocaleNumber`. **Κανένα δεύτερο `ColumnRole`, κανένα
  δεύτερο preset, κανένα δεύτερο mapping UI.**

  **Τι γράφτηκε:**
  - `topo-text-lines.ts` (**νέο, lexing SSoT**) — «τι είναι σχόλιο» + «πώς σπάει μια γραμμή σε πεδία»
    + locale-tolerant `parseTopoField` + streaming `forEachTopoLine`/`sampleTopoLines`. Υπήρχε
    **δύο φορές** (`parse-topo-points` + `ascii-xyz-reader`, ο καθένας με δικό του αντίγραφο) — N.0.2
    boy-scout: ενοποιήθηκε. ⚠️ **Μοιράζονται το LEXING, ΟΧΙ τον parser**: ο ένας βγάζει `TopoPoint[]`
    objects, ο άλλος SoA `Float32Array` (30M objects ≈ 3 GB heap → πεθαίνει το tab).
  - `topo-column-sniffer.ts` (**νέο, pure**) — 4 σήματα με τη σειρά: (1) `pointId` = **η πρώτη**
    αριθμητική στήλη, all-integer + γνησίως αύξουσα, **μόνο αν** μένουν 3 στήλες συντεταγμένων
    (αλλιώς ένα `1 2 3` dump θα έχανε το X του)· (2) `code` = η πρώτη καθαρά μη-αριθμητική· (3) `z` =
    αυτή που είναι **τάξεις μεγέθους μικρότερη** (υψόμετρο ~10²  vs ΕΓΣΑ easting ~10⁵)· (4) `x`/`y` =
    σειρά αρχείου, **εκτός** αν η πρώτη «καπελώνει» τη δεύτερη ≥4× → τότε είναι **Northing** (PNEZD/NEZ).
    **Λόγοι, όχι απόλυτα** — το ίδιο αρχείο σε mm περνά από τους ίδιους κανόνες.
  - `PointCloudReadOptions.mapping?` + `.delimiter?` → ταξιδεύουν **αυτούσια** στον worker (ήδη
    structured-cloneable· καμία αλλαγή στο worker protocol).
  - `TopoColumnMapTable.tsx` (**νέο**) — το grid στηλών εξήχθη από το `TopoColumnMapStep` και το
    μοιράζονται **και οι δύο** δρόμοι (CSV + ASCII νέφος). Δύο grids = sibling clone που θα αποκλίνει.
  - `TopoCloudStep` → νέο fieldset «Στήλες αρχείου» (μόνο για `.xyz`/`.pts`· το LAS/LAZ δηλώνει τις
    στήλες του στο binary header). Κάθε αλλαγή παραμέτρου **ακυρώνει** το προηγούμενο αποτέλεσμα —
    δεν εγκρίνεις φίλτρο που δεν έτρεξες.

  🐛 **ΔΕΥΤΕΡΟ BUG, ΙΔΙΑΣ ΟΙΚΟΓΕΝΕΙΑΣ, ΠΙΑΣΤΗΚΕ ΑΠΟ ΤΑ TESTS:** ο lexer έκοβε **και στο κόμμα**, άρα
  ένα ελληνικό export (`1;345678,123;4201234,456;125,30;EDGE`) γινόταν **8 πεδία αντί για 5** → κάθε
  δείκτης στήλης μετατοπιζόταν → σκουπίδια, πάλι σιωπηλά. Λύση: ο wizard ανιχνεύει το διαχωριστικό με
  το **υπάρχον** `detectDelimiter` (M2) και το στέλνει μαζί με το mapping· με `;`/tab/κενό το κόμμα
  μένει **υποδιαστολή** (`fieldSplitterFor`). Το grid που πιστοποιεί ο μηχανικός σπάει **ακριβώς όπως**
  θα σπάσει ο reader.

  **Tests:** `topo-column-sniffer.test.ts` (PENZD/PNEZD/ελληνικό locale· σκέτο `x y z` αμετάβλητο·
  δεν κλέβει X για pointId σε 3 στήλες· αγνοεί intensity/RGB· καμία πρόταση όταν λείπουν 3 αριθμητικές)
  + 6 νέα cases στο `ascii-xyz-reader.test.ts` (mapped PENZD = αποτύπωση· N=Y στο PNEZD· ελληνικό `;`·
  ελλιπές mapping → fallback· **case που ΤΕΚΜΗΡΙΩΝΕΙ την παλιά παγίδα**: un-mapped PENZD → X = id).
  **22 suites / 201 tests PASS** (από 22/190 — τίποτα δεν έσπασε). `jscpd:diff` καθαρό (12 αρχεία).

  **ΔΕΝ μπήκαν — και γιατί:**
  - **Χρωματισμός νέφους από intensity/RGB στήλες**: ο sniffer τις αναγνωρίζει ως `ignore`, αλλά το
    `PointCloudPreview` κουβαλά **ταξινόμηση**, όχι RGB — θέλει αλλαγή στο SoA buffer (M8α), όχι στο
    mapping. Ο χρωματισμός **της απόφασης** (τι κράτησε το φίλτρο) είναι αυτό που ζητά το §9.
  - **`.pts` / `.ptx` headers** (γραμμή-πλήθος + 4×4 πίνακας σάρωσης): άλλο πρόβλημα (metadata, όχι
    στήλες). Σήμερα ένα `.pts` διαβάζεται ως ASCII — το header line γίνεται preamble και αγνοείται.
  - **Μονάδα για LAS/LAZ από VLR/CRS**: το LAS **δεν** δηλώνει μονάδα στο header (ζει σε προαιρετικό
    CRS VLR). Όπως το Civil 3D, ρωτάμε τον χρήστη — αλλά ο dropdown μονάδας φαίνεται πλέον **μόνο**
    στον δρόμο ASCII (μαζί με το grid). Για binary νέφος ισχύει το default `m`.
  - **Persist του mapping ανά αρχείο/εταιρεία** («θυμήσου ότι τα δικά μου exports είναι PENZD»): θα
    ήταν χρήσιμο, αλλά είναι **προτίμηση χρήστη** — άλλο ADR, άλλο store.

  ✅ **Google-level: ΝΑΙ** — ένα λεξιλόγιο στηλών (M2, κοινό), ένα lexing SSoT (αντί για δύο
  αντίγραφα), ένα grid UI (αντί για δύο), deterministic πρόταση + **ανθρώπινη πιστοποίηση πριν** την
  πράξη, και **zero regression by construction**: χωρίς mapping ο reader τρέχει τον ίδιο κώδικα που
  έτρεχε πάντα.

  **Status: M1 + M2 + M3 + M4 + M5 (α+β) + M6 + M7 + M8α + M8β (Α+Β+Γ+Δ) IMPLEMENTED·
  moonshots (multiplayer, Gaussian-Splat, COPC streaming) προγραμματισμένα (§12.2).**

- **2026-07-14 (v18)** — **M8β/Ε ΥΛΟΠΟΙΗΘΗΚΕ — unit-aware binary cloud** (Phase 3, N.0.1). Το
  τελευταίο μέλος της ίδιας οικογένειας σιωπηλών λαθών με το M8β/Δ: εκεί ήταν η **λάθος στήλη**, εδώ
  η **λάθος μονάδα** — ίδιο είδος bug (δεν σκάει, δεν προειδοποιεί, βγάζει έγκυρη όψη λάθους
  εργοταξίου, απλώς σε **λάθος κλίμακα**).

  **ΤΟ BUG:** το LAS/LAZ **δεν** δηλώνει μονάδα στο public header (ζει σε προαιρετικό CRS VLR που τα
  μισά όργανα παραλείπουν) — το λέει ρητά το σχόλιο του `LasHeader`: «Like Civil 3D, **we ask the
  user instead**: the wizard's existing `TopoUnit` dropdown supplies the scale». **Μόνο που ο
  dropdown δεν εμφανιζόταν ποτέ στον δρόμο του νέφους.** Μετά το M8β/Δ ζει μέσα στο grid στηλών →
  φαίνεται **μόνο** για `.xyz`/`.pts`. Ένα **LAS/LAZ σε πόδια ή mm** διαβαζόταν σιωπηλά ως **μέτρα**:
  ένα drone export σε US survey feet → νέφος ×0,3048 λάθος → το CSF «βρίσκει έδαφος» → όγκοι cut/fill
  λάθος **κατά 3×**. Ο κώδικας υποσχόταν κάτι που **δεν έκανε**.

  **Η ΑΠΟΦΑΣΗ (τι κάνουν οι μεγάλοι):** Civil 3D / ReCap **ρωτούν** μονάδα (ή τη διαβάζουν από CRS
  metadata)· PDAL / CloudCompare **αρνούνται να μαντέψουν** (ρητό scale/SRS). Ομόφωνο: **ορατός
  dropdown για ΚΑΘΕ μορφή, ποτέ σιωπηλή υπόθεση.** Και **κρίσιμη απόφαση σχεδιασμού: δεν κάνουμε
  σιωπηλή αυτόματη πρόταση.** Το `m` και το `ft` διαφέρουν μόλις ×3.28 — και τα δύο δίνουν «λογικό»
  εργοτάξιο, οπότε μια αυτόματη επιλογή `ft` όταν είναι `m` θα **ΞΑΝΑΕΦΕΡΝΕ** το ίδιο 3× σιωπηλό λάθος
  που σκοτώνουμε. Αντ' αυτού δείχνουμε το **span κάτω από κάθε μονάδα** — η deterministic «πρόταση»
  είναι να παρουσιάσουμε τα στοιχεία, όχι να μαντέψουμε (ίδια φιλοσοφία με τον sniffer στηλών, αλλά
  εδώ η αμφισημία m/ft απαιτεί ανθρώπινη κρίση, όχι single pick).

  **SSoT — τι ΔΕΝ ξαναγράφτηκε:** `TopoUnit` + `TOPO_UNIT_SCALE_TO_MM` (M2, m/mm/ft), το `LasHeader`
  min/max + `readLasHeader` (M8α), το `PointCloudReadOptions.unit` (ταξίδευε **ήδη** σωστά στον
  reader — το μόνο που έλειπε ήταν ο ανθρώπινος έλεγχος πάνω του), τα warnings ως i18n **keys**
  (`POINTCLOUD_MSG`). **Κανένα δεύτερο dropdown, κανένας δεύτερος πίνακας κλίμακας.**

  **Τι γράφτηκε:**
  - `TopoUnitSelect.tsx` (**νέο, extraction**) — ο dropdown μονάδας εξήχθη από το `TopoColumnMapTable`
    σε ένα κοινό component· **ένα widget, μία `UNITS` λίστα**, χρησιμοποιείται και από το grid (ASCII)
    και από το binary βήμα (αντί για sibling clone, N.18).
  - `cloud-unit-span.ts` (**νέο, pure, deterministic**) — `cloudSourceExtentFromBuffer` (parse μόνο
    το header ενός head-slice· το `.laz` header είναι **ασυμπίεστο** → μηδέν WASM) + `unitSpanReadouts`
    (τι μετρά το εργοτάξιο σε m/mm/ft, σε μέτρα). Δεν το εισάγει το `pointcloud-read` → **κανένας νέος
    κύκλος** στο load-time.
  - `CLOUD_HEADER_PROBE_BYTES` (512) + `SPAN_SANITY_MAX_HORIZONTAL_MM` (50 km) / `_VERTICAL_MM` (5 km)
    στο `pointcloud-defaults` (SSoT — μηδέν inline literals).
  - `readPointCloudSourceExtent(file)` στο `io/pointcloud-import` (dynamic import του span module,
    ίδιο μοτίβο «heavy readers behind dynamic import»).
  - `useTopoImport`: νέο state `cloudSourceExtent` (διαβάζεται στο `loadFile` **μόνο** για binary)·
    το `changeUnit` **ήδη** ακύρωνε το αποτέλεσμα στο βήμα νέφους (`invalidateCloudResult`, M8β/Δ) —
    χρησιμοποιήθηκε, δεν ξαναγράφτηκε.
  - `TopoCloudStep`: νέο `CloudUnitFieldset` (dropdown + `CloudSpanReadout`) που εμφανίζεται **μόνο**
    για binary (`cloudSample` κενό)· το ASCII κρατά τον dropdown στο grid (με ορατές γραμμές).
  - **Belt-and-suspenders:** `isCloudSpanImplausible` στο `buildReadResult` (SSoT — **μία** φορά,
    καλύπτει LAS/LAZ/ASCII μαζί) → `WARN_SPAN_IMPLAUSIBLE` όταν span > 50 km ή ύψος > 5 km. Πιάνει ό,τι
    ξεφύγει και από στήλη **και** από μονάδα.

  **Tests:** `cloud-unit-span.test.ts` (**νέο**, 12 tests): source extent από header (LAS **και**
  compressed `.laz` twin)· null σε ASCII/truncated/Layer-State· readouts (m pass-through· mm καταρρέει
  σε <1 μ.· ft ×0.3048 — «ακόμα λογικό, γι' αυτό δεν auto-pick»)· `isCloudSpanImplausible` στα σωστά
  κατώφλια· ο reader **σιωπά** σε λογικό μέτρο-νέφος αλλά **προειδοποιεί** σε mm-διαβασμένο-ως-μέτρα
  (200 km span). **23 suites / 213 tests PASS** (από 22/201 — τίποτα δεν έσπασε). `jscpd:diff` καθαρό
  (7 αρχεία).

  **ΔΕΝ μπήκαν — και γιατί:**
  - **Ανάγνωση CRS/WKT VLR για αυτόματη μονάδα**: το LAS **μπορεί** να κουβαλά μονάδα σε GeoKey/WKT
    VLR — αλλά τα μισά instruments το παραλείπουν, και το parsing του (GeoTIFF keys / OGC WKT) είναι
    ολόκληρο subsystem. Όταν υπάρχει, θα ήταν καλή **προεπιλογή** του dropdown (όχι αντικατάστασή του —
    ο μηχανικός πάντα βλέπει & πιστοποιεί). Ξεχωριστή απόφαση/scope.
  - **US survey foot ως ξεχωριστή μονάδα**: το `TOPO_UNIT_SCALE_TO_MM` έχει **ένα** `ft` (304.8 mm =
    international foot). Το US survey foot (304.80061 mm) διαφέρει ~2 ppm — αμελητέο για span sanity,
    αλλά **όχι** για ΕΓΣΑ'87 easting· αν χρειαστεί, είναι νέα τιμή στο **υπάρχον** SSoT table (M2),
    όχι νέος μηχανισμός.
  - **Αυτόματη σιωπηλή πρόταση μονάδας**: σκόπιμα **όχι** (βλ. «Η ΑΠΟΦΑΣΗ» πάνω — m/ft αμφίσημα).
  - **`.pts` header line ως έλεγχος πλήθους**: παραμένει preamble που αγνοείται (όπως στο M8β/Δ) —
    δεν φούσκωσε το scope.

  ✅ **Google-level: ΝΑΙ** — ένας dropdown μονάδας (extraction, όχι clone), ένα scale table (M2),
  ένα span-sanity check (SSoT στο `buildReadResult`, όλες οι μορφές), deterministic **ορατή απόδειξη**
  αντί για σιωπηλή μαντεψιά, και **zero regression by construction**: default `m` αμετάβλητο· το `unit`
  ταξίδευε ήδη σωστά — άλλαξε **μόνο** ότι έγινε ορατό & επεξεργάσιμο για κάθε μορφή.

  **Status: M1 + M2 + M3 + M4 + M5 (α+β) + M6 + M7 + M8α + M8β (Α+Β+Γ+Δ+Ε) IMPLEMENTED — M8 ΠΛΗΡΕΣ·
  moonshots (multiplayer, Gaussian-Splat, COPC streaming) προγραμματισμένα (§12.2).**

- **2026-07-14 (v19)** — **M3 BUGFIX — ο διακόπτης «ακριβείς↔όμορφες» δεν έδειχνε ΚΑΜΙΑ διαφορά**
  (Phase 2, N.0.1). Ο Giorgio το επιβεβαίωσε ζωντανά: πάτημα «Όμορφες»/«Ακριβείς» → μηδέν ορατή αλλαγή
  στην κάτοψη, **ούτε** σε πυκνό (`01_simple_xyz`) **ούτε** σε αραιό/γωνιώδες (`05_sparse_terrain`)
  δείγμα, ούτε μετά από zoom.

  **ΤΟ BUG (whitelist drift — ίδια κλάση με το ADR-557 text-fields):** η καλωδίωση panel → hook →
  `SetContourDisplayStyleCommand` → `sceneManager.updateEntity({ smoothDisplay })` ήταν **σωστή** — το
  `smoothDisplay` γραφόταν σωστά στο **SceneModel** entity. Αλλά η **προβολή** SceneModel → `DxfScene` →
  `EntityModel` γίνεται σε **δύο διαδοχικά whitelist στάδια** που αντιγράφουν ρητά πεδία (`vertices`,
  `closed`, `bulges`, `startWidths`, `endWidths`) — και **κανένα** δεν προωθούσε το `smoothDisplay`:
  - **Στάδιο 1** (SceneModel → DxfScene): `toPolylineUnion` (`dxf-scene-entity-projections.ts`) — κοινό
    SSoT και για τα δύο arms (`polyline` + `lwpolyline`→polyline κατά ADR-186). **Πρώτο σημείο απώλειας.**
  - **Στάδιο 2** (DxfScene → EntityModel): `buildEntityModelFromDxf` polyline case
    (`dxf-renderer-entity-model.ts`).

  Ο `PolylineRenderer.render` διαβάζει `smoothDisplay === true` (`:102`, μέσω cast) — αλλά επειδή κανένα
  upstream στάδιο δεν το προωθούσε, ο κλάδος `getSmoothedDisplayPath(...)` ήταν **de facto νεκρός** σε
  ΟΛΑ τα canvas paths (normal-state bitmap **και** interactive overlay). Γι' αυτό «καμία διαφορά, πάντα».
  **Δεν** ήταν το bitmap cache (ADR-040) — το `updateEntity` παράγει νέο scene reference, ο κάμβας
  ξαναζωγραφίζει σωστά — **ούτε** ο αριθμός κορυφών (το πυκνό δείγμα θα έδειχνε καμπύλες αν έφτανε το flag).

  **Η ΔΙΟΡΘΩΣΗ (3 σημεία, όλα whitelist SSoT — falsy ⇒ omitted, «exact»):**
  - `toPolylineUnion` (`dxf-scene-entity-projections.ts`) — `arrays` param + return προωθούν
    `smoothDisplay` (mirror του `bulges`/`startWidths` pattern)· τα δύο handler arms
    (`dxf-scene-entity-handlers.ts`) εκθέτουν το πεδίο στο cast τους.
  - `DxfPolyline` (`dxf-types.ts`) — νέο προαιρετικό `smoothDisplay?: boolean` (ώστε το στάδιο 2 να το
    βλέπει type-safe).
  - `buildEntityModelFromDxf` polyline case (`dxf-renderer-entity-model.ts`) — προώθηση στο `EntityModel`.

  **SSoT — τι ΔΕΝ ξαναγράφτηκε:** ο curve builder (`geometry-smooth-display.ts`), το command, το hook, το
  `collectSmoothableContourIds`, ο `BaseEntity.smoothDisplay` ορισμός — όλα σωστά, αμετάβλητα. Το πρόβλημα
  ήταν **αποκλειστικά** τα δύο projection whitelists που ξεχνούσαν ένα πεδίο. **Καμία αλλαγή στο bitmap
  cache key** (το `smoothDisplay` είναι content που ήδη invalidate-άρει μέσω νέου scene reference —
  ADR-040 cardinal rule #3 ανέγγιχτο).

  **Status: M1 + M2 + M3 + M4 + M5 (α+β) + M6 + M7 + M8α + M8β (Α+Β+Γ+Δ+Ε) IMPLEMENTED — M8 ΠΛΗΡΕΣ·
  moonshots (multiplayer, Gaussian-Splat, COPC streaming) προγραμματισμένα (§12.2).**
