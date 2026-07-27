# ADR-650 — Τοπογραφικές Αποτυπώσεις & Ισοϋψείς Γραμμές (Έρευνα Αγοράς + Αρχιτεκτονικό Blueprint)

- **Status**: 🟡 IN PROGRESS — **M1 IMPLEMENTED** (πυρήνας σημεία→CDT/TIN→ισοϋψείς· v4) · **M2 IMPLEMENTED** (μέρος Α import wizard· v5 — μέρος Β breakline picking· v6) · **M4 IMPLEMENTED** (3Δ όψη εδάφους: μοναδικό derived TIN → `BufferGeometry` mesh + hypsometric· v7) · **M6 IMPLEMENTED** (όγκοι cut/fill: prisms + daylight split + στάθμη/επιφάνεια/όριο + cross-check + 3Δ cut/fill style· v8, §12.4) · **M7 IMPLEMENTED** (ελληνικό export «ένα κουμπί → φάκελος»: πίνακες στο σχέδιο + ZIP με DXF/PDF/CSV/XLSX + auto tolerance-check §10· v9, §12.5) · **M3 IMPLEMENTED** (ισοϋψείς ακριβείς↔όμορφες + LOD· v10) · **M5α IMPLEMENTED** (AI «καμπανάκι» = deterministic QA rules engine + inline flags, χωρίς LLM· v11 — **M5α.2**: ⊙ markers + zoom-to **και στο 3Δ** + non-modal panel· v19) · **M5β IMPLEMENTED** («μίλα στο σχέδιο» = NL editing με LLM tool-calling πάνω στα υπάρχοντα topo commands· 8 tools + destructive spike-removal με confirm· v12 — **M5 ΠΛΗΡΕΣ**) · **M8α IMPLEMENTED** (point-cloud ingestion: LAS + bulk ASCII → in-house CSF bare-earth filter → voxel decimation → ΥΠΑΡΧΟΝ `TopoPointStore`· μηδέν νέα dependency· v13) · **M8β/Α IMPLEMENTED** (**LAZ decode** — ο δρόμος των drones: `laz-perf` **Apache-2.0** (επαληθευμένο, εγκεκριμένο) → ασυμπίεστα records → **ο ΙΔΙΟΣ** `decodeLasRecords` του LAS· lazy WASM πίσω από dynamic import· v14) · **M8β/Γ IMPLEMENTED** (**auto-breakline detection** — differentiator §9 #3: ο ΥΠΑΡΧΩΝ M5α ανιχνευτής dihedral fold εξήχθη σε SSoT· το νέο είναι το **chaining** ακμών σε ordered πολυγραμμές με **stop-at-junction** + φίλτρα θορύβου· preview στον καμβά + **ρητό confirm** πριν το `addBreakline` — καμία αυτόματη εγγραφή· deterministic, μηδέν LLM· v15) · **M8β/Β IMPLEMENTED** (**3Δ point-cloud layer** — το νέφος ζει ως `THREE.Points` πάνω από το έδαφος αντί να πεθαίνει με τον wizard· ο builder υπήρχε ήδη από το M8α, γράφτηκε **μόνο ο καταναλωτής**· κοινό `writeDxfPlanToWorld` με το TIN· **§6 επιβεβλημένο στον κώδικα**: `raycast = () => {}` → ΟΨΗ, ποτέ γεωμετρία μέτρησης· 48 MB μετρημένα + ρητό «Αφαίρεση νέφους»· καμία νέα dependency· v16) · **M8β/Δ IMPLEMENTED** (**id-aware ASCII cloud** — ο reader του νέφους μαθαίνει το `ColumnMapping` που ο δρόμος CSV ήδη ήξερε (M2)· **deterministic sniffer** προτείνει τις στήλες από τα δεδομένα, ο μηχανικός τις πιστοποιεί σε grid **πριν** το φίλτρο· ένα PENZD αρχείο δεν διαβάζεται πια με X = id σημείου· **χωρίς mapping ⇒ σημερινή συμπεριφορά**· καμία νέα dependency· v17) · **M8β/Ε IMPLEMENTED** (**unit-aware binary cloud** — το LAS/LAZ **δεν** δηλώνει μονάδα στο header· ο dropdown μονάδας γίνεται ορατός & επεξεργάσιμος **για ΚΑΘΕ** μορφή νέφους (όχι μόνο ASCII, όπως μετά το M8β/Δ), με **readout έκτασης** ανά μονάδα ώστε η επιλογή να επαληθεύεται με τα μάτια — **καμία σιωπηλή μαντεψιά** (m/ft διαφέρουν ×3.28, όπως PDAL/CloudCompare)· + belt-and-suspenders sanity warning για εξωπραγματικό span σε **όλες** τις μορφές· default `m` αμετάβλητο· καμία νέα dependency· v18). **M10e IMPLEMENTED** (**αυτόματη ταύτιση σχεδίου↔τοπογραφικού**· v20 blueprint → **v21 υλοποίηση**: μετρημένη αιτία = το DXF import πετούσε το offset της κανονικοποίησης (`bounds-entity.ts`) — πλέον κρατιέται ως `SceneModel.sourceOrigin`· **τέσσερα κανάλια** με μία μονάδα μέτρησης και ένα συμβόλαιο αποδοχής: `identity-restore` (αναλυτικό) → `already-aligned` → **`point-number`** (η αρίθμηση του τοπογράφου = γνωστές αντιστοιχίες) → `congruent-pairs` (**ντετερμινιστική απαρίθμηση συμμόρφων βάσεων, ΟΧΙ RANSAC** — Super4PCS smart-indexing στη 2Δ-rigid ελάχιστη μορφή του)· **ποτέ auto-apply**, ποτέ κλίμακα· 78/78 tests). **Εκκρεμεί**: multiplayer, Gaussian-Splat, COPC streaming. Έρευνα §1–§11 & roadmap §12.2 παραμένουν το blueprint.
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
| **M5α** ✅ | **AI καμπανάκι (QA rules engine)** (Q7 #1) | Background **deterministic** QA (elevation busts = MAD robust· duplicate/outliers· closure = self-intersect/degenerate ring· missing breaklines = dihedral fold χωρίς constraint) με **inline flags**: λίστα panel με zoom-to + ⊙ markers (reuse ADR-435), **σε 2Δ ΚΑΙ 3Δ** (M5α.2, v19). **Μηδέν LLM/κόστος, offline. AI-accelerant/human-certifier.** **DONE, changelog v11.** | Civil 3D «Surface Statistics»· TBC blunder detection | `getTopoSurface`/`TopoPointStore`· `median` (`utils/statistics`)· `polygon-utils`· `scene-units`· `ClashMarkerLayer`+`canvas-fit-to-view-selected` (ADR-435/394) | **καμία νέα** (in-house, μηδέν LLM) |
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
  επιφάνειες ελέγχου, όπως command-line vs slider). M5α open items (3Δ markers, auto-clear, tuning) παραμένουν. **[3Δ markers: ΕΓΙΝΑΝ στο v19 / M5α.2]**

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

- **2026-07-14 (v20)** — **M9 ΥΛΟΠΟΙΗΘΗΚΕ — PERSISTENCE (οι ισοϋψείς επιβιώνουν το reload)**
  (Phase 2+3, N.0.1). Ο Giorgio το επιβεβαίωσε ζωντανά: οι ισοϋψείς εμφανίζονταν μέσα στη συνεδρία
  αλλά **εξαφανίζονταν μετά από page refresh**.

  **ΤΟ BUG (προϋπάρχον κενό — ΟΧΙ regression):** ο τοπογραφικός όροφος προέρχεται από import
  **σημείων** (CSV/txt), όχι DXF → δεν έχει save target → `currentFileName === null` → το autosave gate
  (`useAutoSaveSceneManager.ts`) κόβεται → το `.scene.json` snapshot **δεν γράφεται ποτέ**. Επιπλέον το
  `TopoPointStore` ήταν ρητά session-only. Το write-origin (`local-edit`) και ο reconcile ΗΤΑΝ σωστά —
  οι ισοϋψείς (`lwpolyline`/`text`) είναι dumb-DXF που θα επιβίωναν αν γραφόταν snapshot. Το topo
  persistence απλώς **δεν είχε χτιστεί** (M1–M8 δεν το περιλάμβαναν).

  **Η ΑΠΟΦΑΣΗ (big players):** Civil 3D «Surface Definition» / Revit Toposurface / ArchiCAD Mesh — το
  **SSoT είναι ο ΟΡΙΣΜΟΣ** (survey points/breaklines/boundary + ρυθμίσεις)· οι ισοϋψείς/TIN/3D είναι
  **παράγωγα** που **ξαναπαράγονται** στο load, ΠΟΤΕ αποθηκευμένη «ψημένη» γεωμετρία. Full enterprise +
  full SSoT· persist **τα πάντα**.

  **ΥΛΟΠΟΙΗΣΗ — καθρέφτης του single-doc-per-floor grid-guide (ADR-441), ΟΧΙ per-entity:**
  - **`floorplan_topo_surfaces`** (ΕΝΑ doc/floor, floor-scoped μέσω ADR-420 `resolveBimPersistenceScope`/
    `buildBimScopeConstraints`/`bimScopeWriteFields`)· enterprise-id `TOPO_SURFACE:'topo'` (N.6).
  - **Inline + Storage offload:** μικρό survey → inline στο doc· payload > `TOPO_INLINE_MAX_BYTES` (700KB,
    point cloud M8) → **Storage blob** `topo-surfaces/{companyId}/{scope}/{docId}.json` (mirror του
    `.scene.json`)· το doc κρατά `pointsStoragePath`. `stripUndefinedDeep` πριν κάθε write (Firestore
    undefined trap).
  - **Full SSoT:** νέο `contour-config-store` (το interval/index ήταν component-local στο panel) ώστε ΟΛΟ
    το contour config + display style + terrain-3D + cut-fill να persist-άρεται & regenerate-άρεται.
  - **`useTopoPersistence`** (mirror `useGridGuidePersistence`): scope resolve → subscribe → **hydrate**
    (restore 5 stores → **silent regenerate** ισοϋψών) · store-subscribe → debounced save · **anti-echo**
    stable-signature guard · per-floor reset · defer/flush race (ADR-635 Φ C.15). Mount: **`TopoPersistenceHost`**
    δίπλα στο `GridGuidePersistenceHost` στο `DxfViewerTopBar`.
  - **`regenerateTopoContours` (silent + idempotent):** στο load καθαρίζει τα υπάρχοντα TOPO-CONTOUR-*
    entities → ξαναχτίζει ισοϋψείς/labels/layers με origin `system-reconcile` (κανένα undo, κανένα
    autosave-loop). Το κουμπί «Δημιουργία» μένει `local-edit`+undoable αμετάβλητο.
  - **Rules:** `firestore.rules` (`floorplan_topo_surfaces`, default-deny, tenant isolation) + `storage.rules`
    (`topo-surfaces/{companyId}/**`, 100MB cap, application/json).

  **SSoT — τι ΔΕΝ ξαναγράφτηκε:** ο scope resolver, ο sanitizer, ο `firestoreQueryService`, ο curve
  builder, ο contour generator — όλα import-άρονται. Καμία αλλαγή στο ADR-040 bitmap cache.

  **Tests:** `topo-persistence-types.test.ts` (serializer round-trip / inline-threshold / defaults /
  offload merge) + `regenerate-topo.test.ts` (idempotent cleanup + no accumulation). **26 suites / 229
  tests PASS** (topography). `jscpd:diff` καθαρό (mirror-not-clone).

  **ΕΚΚΡΕΜΕΙ (ζωντανός έλεγχος):** browser reload του reported σεναρίου (survey → ισοϋψείς → refresh →
  επιβίωση) + point-cloud offload· Firestore rules deploy (ο Giorgio).

  **Status: M1 + M2 + M3 + M4 + M5 (α+β) + M6 + M7 + M8 (ΠΛΗΡΕΣ) + M9 (persistence) IMPLEMENTED·
  moonshots (multiplayer, Gaussian-Splat, COPC streaming) προγραμματισμένα (§12.2).**
- **2026-07-14 (v21)** — **M9 SCOPE FIX — η τοπογραφία έγινε SITE-level (φαίνεται σε ΚΑΘΕ όροφο)**
  (Phase 1–3, N.0.1). Ο Giorgio το επιβεβαίωσε ζωντανά: μετά το v20 οι ισοϋψείς εμφανίζονταν **μόνο
  στον όροφο που έγινε το import** (θεμελίωση) και **όχι** στο ισόγειο/άλλους ορόφους.

  **ΑΙΤΙΑ (σχεδιαστική, ΟΧΙ bug):** το v20 persistence ήταν **`floorId`-scoped** (ADR-420, ανά
  building-storey). Το import έγινε στη θεμελίωση → το doc σώθηκε με το `floorId` της θεμελίωσης →
  hydrate/regenerate ΜΟΝΟ εκεί. Λάθος μοντέλο για τοπογραφία.

  **Η ΑΠΟΦΑΣΗ (big players, εντολή Giorgio· SSoT audit ΠΡΙΝ κώδικα):** οι κορυφαίοι θεωρούν το έδαφος
  **site-level**: IFC `IfcSite` (κάτω από `IfcProject`, πάνω από `IfcBuilding[]`/`IfcBuildingStorey`),
  Revit Toposurface / Civil 3D Surface = ΕΝΑ site object ορατό σε όλα τα levels. **Κρίσιμο:** η ίδια η
  εφαρμογή ΗΔΗ μοντελοποιεί **1 project = 1 `IfcSite`** (`ifc-spatial-hierarchy.ts` → `buildSite(project)`,
  ένα site ανά project· το survey point ζει στο `project.surveyPoint`). Άρα **topo scope = `projectId`**
  (το project ΕΙΝΑΙ το site) — καλύπτει «μεγάλο οικόπεδο με πολλά κτίρια» (ένα κοινό έδαφος), υψομετρικές
  διαφορές, υπόγεια/ισόγεια. `buildingId` θα ανάγκαζε re-import ανά κτίριο (anti-IFC).

  **ΥΛΟΠΟΙΗΣΗ (4 σημεία, extend όχι duplicate):**
  - **`bim-floor-scope.ts` (ADR-420):** νέα `buildProjectScopeConstraints(projectId)` → `[where('projectId')]`
    (SITE-level, δίπλα στο per-storey `buildBimScopeConstraints`). Δες ADR-420 changelog.
  - **`topo-firestore-service.ts`:** config → project-only (`companyId/projectId/userId`)· `subscribeTopo`
    → `buildProjectScopeConstraints` (ΟΧΙ floor)· `blobPath` → `topo-surfaces/{companyId}/{projectId}/…`·
    `floorId`/`floorplanId` → **provenance** στο create input (νέο `TopoProvenance`), ΟΧΙ scope key.
  - **`useTopoPersistence.ts`:** `scopeKey = company|project` (ΔΕΝ re-keys ανά όροφο → survey μένει φορτωμένο)·
    project-only gate· `provenanceRef`· **νέο effect** που σε κάθε αλλαγή ορόφου (μόλις `sceneLoading===false`)
    **ξαναχτίζει τις ισοϋψείς στο scene του νέου level** από το ήδη-φορτωμένο project survey (idempotent +
    `system-reconcile` silent → κανένα loop/echo). Έτσι το έδαφος φαίνεται σε foundation **και** ισόγειο **και**
    παντού.
  - **`TopoPersistenceHost`:** doc-only (props ίδια — `floorId`/`floorplanId` πλέον provenance).

  **Rules/Migration:** `firestore.rules` **αμετάβλητα** (το `floorplanId` γράφεται ακόμα ως provenance στο
  create → `hasAll` ✓· update δεν το αγγίζει → immutable ✓). Το ΗΔΗ σωσμένο doc έχει `projectId` → η
  project-query το πιάνει σε κάθε όροφο **χωρίς migration**.

  **Tests:** topography suite **PASS** (persistence: `topo-persistence-types` + `regenerate-topo` πράσινα·
  1 fail = `topo-grid-model.test.ts`, untracked WIP άλλου agent, άσχετο). `jscpd:diff` καθαρό (4 αρχεία).

  **ΕΚΚΡΕΜΕΙ (ζωντανός έλεγχος Giorgio):** θεμελίωση + ισόγειο + άλλοι όροφοι → ισοϋψείς παντού· refresh → επιβίωση.

  **Status: M9 SITE-scoped — IMPLEMENTED.**
- **2026-07-15 (v22)** — **M10 ΥΛΟΠΟΙΗΘΗΚΕ — GEO-REFERENCING (κούμπωμα του DXF πάνω στο τοπογραφικό)**
  (Phase 1–3, N.0.1). Πρόβλημα (ζωντανά, Giorgio): το αρχιτεκτονικό DXF ζει σε **τοπικές** συντεταγμένες
  γύρω στο (0,0)· το τοπογραφικό σε **πραγματικές ΕΓΣΑ'87** (~384,5 km / 4.201 km) → οι ισοϋψείς έπεφταν
  ~4.200 km μακριά από την κάτοψη.

  **Big-player mandate (εντολή Giorgio):** υλοποίηση όπως **Revit Shared Coordinates (Survey Point +
  Project Base Point + Angle to True North)** / ArchiCAD Survey Point / Civil 3D real-world coords. Αποφάσεις
  Giorgio: **per-project** (ένα site)· **χειροκίνητο κοινό σημείο ΚΑΙ auto-align**· **μετατόπιση + στροφή
  ΧΩΡΙΣ κλίμακα** (rigid — και τα δύο σε πραγματικά μέτρα, 1:1· scale θα παραμόρφωνε το κτίριο).

  **SSoT AUDIT (grep ΠΡΙΝ κώδικα, εντολή Giorgio) — ΤΟ ΜΟΝΤΕΛΟ ΥΠΗΡΧΕ ΗΔΗ:** το **ADR-369** ορίζει ήδη
  3-tier Revit reference στο `Project` (`surveyPoint`/`basePoint`/`northRotation`, `project-elevation.schemas.ts`)
  — χρησιμοποιούνταν μόνο το `z` (IFC elevation)· τα planar x/y ήταν «deferred until a separate ADR»
  (`ifc-spatial-hierarchy.ts`). **Το M10 ΕΙΝΑΙ αυτό το ADR** → extend, ΟΧΙ νέο μοντέλο.

  **ΤΟ ΜΟΝΤΕΛΟ (minimal Revit-canonical):** ένα rigid transform ανά έργο = `{originWorld, rotationDeg}`,
  όπου `originWorld` = οι ΕΓΣΑ (canonical mm) συντεταγμένες του project **local origin** (Revit Project
  Base Point σε shared coords) και `rotationDeg` = `northRotation`. `world = R(rot)·local + originWorld`.
  Αποθηκεύεται στο `Project.basePoint.x/y` (ΜΕΤΡΑ) + `northRotation`· `basePoint.z` (elevation datum)
  διατηρείται πάντα. Το runtime δουλεύει σε **canonical mm** (συνθέτει με topo+DXF)· μετατροπή metres↔mm
  ΜΟΝΟ στο schema boundary.

  **ΥΛΟΠΟΙΗΣΗ (extend όχι duplicate):**
  - **Νέο SSoT `systems/geo-referencing/`:** `geo-transform.ts` (pure rigid local↔world· 1-point=μετατόπιση
    `fromOnePointPair`, 2-point=+στροφή `fromTwoPointPairs`· `pointPairScaleRatio` guard για unit mismatch)·
    `geo-reference-schema.ts` (Project metres ↔ runtime mm)· `geo-auto-align.ts`· `geo-reference-store.ts`
    (runtime SSoT, `createExternalStore` ADR-040)· `geo-reference-persistence.ts` (load/persist/clear στο
    Project, διατηρεί `basePoint.z`)· `geo-ref-pick-store.ts` (manual-pick session)· `geo-ref-scene-points.ts`.
  - **Apply-at-render:** `regenerate-topo.ts` προβάλλει τις ισοϋψείς **world(ΕΓΣΑ)→building-local** (`worldToLocal`)
    πριν το `buildContourEntities` → το DXF μένει κοντά στο 0 (κανένα ADR-635 culling blowup), το έδαφος
    «κάθεται» πάνω του. Identity/unset ⇒ no-op (backward compatible). `useTopoPersistence` subscribe στο
    geo-reference store → οι ισοϋψείς κουμπώνουν **live**.
  - **UI:** `TopoGeoReferenceSection` (νέο section στο TopographyPanel): «Αυτόματο κούμπωμα» + χειροκίνητο
    κοινό σημείο (tool `geo-ref-anchor` → 1 κλικ σε γνωστό σημείο πιάνει την τοπική συντεταγμένη, snapped·
    ο χρήστης δίνει ΕΓΣΑ). i18n el+en (`topography.geoRef.*`, `geoRef.status.*`).
  - **Hydration:** `GeoReferenceHost` (always-on στο DxfViewerTopBar) φορτώνει το transform από το Project
    στο load → το έδαφος κάθεται σωστά σε **κάθε όροφο** μετά από refresh.
  - **Projects API (minimal):** `surveyPoint`/`basePoint`/`northRotation` προστέθηκαν στο `ProjectUpdateSchema`
    (validated) + `ProjectUpdatePayload` (client type)· ο server ήταν ήδη `.passthrough()`.

  **ROBUST BOUNDS (Εύρημα #1) — μπαίνει στο ADR:** το auto-align ΔΕΝ χρησιμοποιεί το naive
  `processedData.bounds` (κολλάει σε μακρινό cluster). Νέα `computeRobustCenter` (median + MAD trimming) στο
  υπάρχον `zoom/utils/robust-bounds.ts` (extend SSoT): median 50% breakdown → κέντρο μέσα στο κτίριο, ο
  ~17 km stamp cluster + outliers κόβονται. Big-CAD «Audit» pattern.

  **Εύρημα #2 — SCOPE BUG FIX (durable projectId):** ειδικοί όροφοι (Θεμελίωση) δημιουργούνται ΧΩΡΙΣ δικό
  τους `projectId` → `saveContext?.projectId ?? currentLevel?.projectId` = undefined → το SITE-scope topo
  persistence δεν instantiate-άρονταν εκεί (`hasScope:FALSE`) → survey ΔΕΝ σωζόταν. Νέα
  `resolveActiveProjectId(levels)` (mirror του `resolveActiveBuildingId`) + 3ο fallback στο `DxfViewerTopBar`
  → σταθερό projectId από αδελφό όροφο (ADR-309), από το load, χωρίς `null→value` flip (που προκαλούσε reset).

  **Tests:** νέα geo-referencing suite (transform/schema/robust-center/auto-align/pick/scene) + `regenerate-topo`
  geo-projection case + `resolveActiveProjectId` — **όλα πράσινα** (topography 270+, geo 16). `jscpd:diff` καθαρό.

  **ΕΚΚΡΕΜΕΙ (ζωντανός έλεγχος Giorgio):** import terrain σε ΕΓΣΑ → auto-align/κοινό σημείο → κτίριο κάθεται
  στο έδαφος σε ΚΑΘΕ όροφο· refresh → επιβίωση. Μετά τον έλεγχο: αφαίρεση των TEMP DIAGNOSTICS `[TOPO-DIAG]`.

  **Status: M10 geo-referencing — IMPLEMENTED.**

  > ⚠️ **ΜΗΝ διαβάσεις το M10 ως πλήρη απάντηση στο «ταύτισε το σχέδιο με το τοπογραφικό».** Το M10
  > παρέχει τον **μηχανισμό** (`GeoReference`, χειροκίνητο pick 1-2 σημείων) αλλά είναι **identity
  > μέχρι να το ορίσει ο χρήστης**, και το `autoAlignByRobustCenters` είναι **translation-only,
  > χωρίς στροφή και χωρίς καμία επαλήθευση** — δευτερεύουσα γρήγορη εκτίμηση, όχι λύση. Επιπλέον το
  > DXF import **πετάει** το offset της κανονικοποίησης (`bounds-entity.ts:304-312`), οπότε η
  > πληροφορία που θα έκανε την ταύτιση αναλυτική **χάνεται πριν καν φτάσει εδώ**.
  > → **βλ. §M10e (v20)** για τη μετρημένη αιτία και το σχέδιο αυτόματης ταύτισης.

- **2026-07-15 (v23)** — **M10b ΥΛΟΠΟΙΗΘΗΚΕ — GEO-REFERENCING στην 3D όψη + point cloud** (Phase 1–3, N.0.1).

  **Πρόβλημα (ζωντανά, Giorgio):** στο 3D panel «Απόκρυψη εδάφους» + «Υψομετρικός χρωματισμός» **έδειχναν
  σαν να μη λειτουργούν**. **ΔΙΑΓΝΩΣΗ (grep):** ΔΕΝ ήταν bug του toggle — το `TerrainSceneLayer.rebuild()`
  ήταν σωστά συνδεδεμένο. Το M10 (v22) γεωαναφέρει **μόνο** την 2D κάτοψη (`regenerate-topo`)· η **3D όψη +
  το νέφος** χτίζονταν ακόμη στα ΕΓΣΑ world (~384 km) → εκτός κάμερας → «τίποτα ορατό να κρύψεις/χρωματίσεις».

  **SSoT AUDIT (grep ΠΡΙΝ κώδικα) — reuse, ΟΧΙ διπλότυπο:** το geo-referencing SSoT (`geo-transform.ts`
  `worldToLocal`/`isIdentityGeoReference`, `geo-reference-store.ts` `getGeoReference`) υπήρχε ήδη. Οι converters
  `tin-to-three.ts` / `cloud-to-three.ts` είναι **ρητά PURE** (no store) → η γεωαναφορά περνά ως **param**, όχι
  store-read μέσα τους (ίδιο μοτίβο με το υπάρχον `options.reference` του cut-fill).

  **ΥΛΟΠΟΙΗΣΗ (mirror του 2D, FULL SSOT):**
  - **Κοινό SSoT primitive:** `makeWorldToDisplayProjector(geo)` (νέο, στο `geo-transform.ts`) → prepared
    `{ isIdentity, project(worldX, worldY) }`, trig **μία φορά**. Εξήχθη kernel `worldToLocalCore(x,y,c,s,ox,oy)`
    που καλούν **και** το `worldToLocal` **και** ο projector → η φόρμουλα `R⁻¹·(p−origin)` ζει σε **ΕΝΑ** σημείο
    (κανένα structural clone, N.18/jscpd καθαρό). `getActiveWorldToDisplayProjector()` (`geo-reference-store.ts`)
    = ο **μόνος** impure entry που διαβάζει το store.
  - **3 consumers του ίδιου projector (de-dup):** (1) `tin-to-three.buildPositions` — projector param πριν το
    `writeDxfPlanToWorld`· (2) `cloud-to-three.fillCloudBuffers` — ίδιο· (3) `regenerate-topo.projectContoursToLocal`
    — αντικατέστησε το inline `worldToLocal` με τον projector. Μία αλλαγή μοντέλου κινεί 2D+3D+νέφος μαζί.
  - **Fast path (backward compatible):** `isIdentity` (unset/identity geo-ref) ⇒ zero-alloc no-op στα hot
    per-vertex loops (TIN, νέφος 2M σημείων) — byte-for-byte το προηγούμενο ΕΓΣΑ-world behaviour.
  - **Live re-project:** `TerrainSceneLayer` + `PointCloudSceneLayer` προστέθηκε `subscribeGeoReference(() → rebuild)`
    (πριν δεν άκουγαν τη γεωαναφορά) → όταν ο χρήστης «κουμπώνει» ζωντανά, το 3D έδαφος/νέφος ξανα-προβάλλεται
    μαζί με τις 2D ισοϋψείς — δεν καθυστερεί μέχρι το επόμενο topo edit. Το toggle wiring **δεν** αγγίχτηκε.

  **Ρητή απόφαση — το cut/fill χρώμα ΜΕΝΕΙ σε WORLD frame (ΔΕΝ προβάλλεται):** το `buildCutFillColors`
  (`tin-to-three.ts` γρ. ~146-147) καλεί `reference.zAtMm(worldX, worldY)`. Το `ElevationReference.zAtMm` είναι
  τεκμηριωμένο **WORLD mm**· ground TIN + proposed TIN + datum ζουν στο ίδιο world frame → το Δz είναι σύγκριση
  world-vs-world, **ανεξάρτητη** από το πού ζωγραφίζεται το mesh. Άρα αλλάζει **ΜΟΝΟ** το `buildPositions`· το
  χρώμα (per-vertex attribute) μένει ως έχει, αλλιώς θα ρωτούσε το reference σε λάθος σημείο.

  **Z/elevation δεν αλλάζει** — planar geo-ref (μόνο x/y), ίδιο με το 2D.

  **Tests:** `geo-transform` (+projector: identity no-op· ισότητα με `worldToLocal`)· `tin-to-three` (+projected
  case: seats στο display frame, plane equation holds, ΟΧΙ ΕΓΣΑ magnitude)· `cloud-to-three` (+projected +identity
  byte-for-byte)· `regenerate-topo` — **40/40 πράσινα**. `jscpd:diff` καθαρό (7 αρχεία).

  **ΕΚΚΡΕΜΕΙ (ζωντανός έλεγχος Giorgio):** import ΕΓΣΑ terrain → κούμπωμα → 3D όψη → έδαφος κάθεται **κάτω από
  το κτίριο**· «Εμφάνιση/Απόκρυψη εδάφους» + «Υψομετρικός χρωματισμός» **λειτουργούν**. Μετά: Βήμα 2 (ΕΓΣΑ
  κάναβος/labels/export με `localToWorld` — έλεγχος πρώτα) + Βήμα 3 (αφαίρεση `[TOPO-DIAG]`).

  **Status: M10b 3D geo-referencing — IMPLEMENTED (εκκρεμεί ζωντανός έλεγχος).**

- **2026-07-15 (v24)** — **M10c ΥΛΟΠΟΙΗΘΗΚΕ — (1) analysis terrain UNLIT fix + (2) vertical datum** (Phase 1–3, N.0.1). **Επιβεβαιωμένο ζωντανά από Giorgio.**

  **Πρόβλημα #1 (ζωντανά):** ο «Υψομετρικός χρωματισμός» (hypsometric) **εξαφανιζόταν** — αρχικά φαινόταν «μόνο στο ισόγειο», τελικά **σε κάθε live toggle** shaded→hypso (επανερχόταν μόνο με αλλαγή επιπέδου).

  **ΔΙΑΓΝΩΣΗ (ντετερμινιστικά, live diagnostics — ΟΧΙ υποθέσεις):** αποκλείστηκαν με τη σειρά: (α) **path tracer** (κανένα `[IDLE-DIAG]` → ο idle κλάδος δεν έτρεχε)· (β) **on-demand/shader-compile** (orbit πολλών frames δεν το έφερνε πίσω)· (γ) **frustum/NaN bbox** (`bsFinite:true`, `meshInRoot:true`, `matVisible:true` — το mesh έφτανε στο draw). Το σπασμένο (toggle) vs σωστό (level-change) rebuild ήταν **πανομοιότυπα** σε geometry/material → η αιτία **δεν** ήταν ιδιότητα του mesh αλλά το **render**. **Απόδειξη (πείραμα unlit):** αλλαγή του υλικού των analysis styles σε `MeshBasicMaterial` → εμφανίστηκε **παντού**. **Ρίζα:** τα analysis styles χρησιμοποιούσαν **lit `MeshStandardMaterial`** (λευκή βάση + per-vertex colours + `receiveShadow`)· με το ανάγλυφο να «πλέει» στα ~106 m (εκτός shadow/light frustum), η λευκή PBR επιφάνεια γινόταν **μαύρη → αόρατη**.

  **ΛΥΣΗ #1 (big-player, SSoT):** `getTerrainMaterial3D` (`MaterialCatalog3D.ts`) — `shaded` **μένει lit PBR** (ο φωτισμός ΕΙΝΑΙ η ανάγνωση, hillshade μορφή)· τα analysis styles (`hypsometric`/`cutfill`) → **cached UNLIT `MeshBasicMaterial`** (vertex colours, DoubleSide· **ΟΧΙ** polygonOffset — προκαλούσε regression εξαφάνισης στο floating far-distance depth slope). Return type → `THREE.Material`. Big-player parity: Civil 3D/Revit analysis styles = display-only, ποτέ lit/σκιασμένα — τα χρώματα διαβάζονται αληθινά ανεξάρτητα φωτισμού. `TerrainSceneLayer`: analysis mesh `castShadow/receiveShadow=false` (unlit overlay), `shaded` όπως πριν.

  **Πρόβλημα #2 (vertical datum):** το ανάγλυφο κάθονταν στα **απόλυτα survey Z** (~106 m), το κτίριο σε **floor-local z≈0** → «έπλεε» ~100 m ψηλά· στο ισόγειο (κάμερα fit στο κτίριο) έβγαινε εκτός οθόνης.

  **SSoT AUDIT (grep ΠΡΙΝ κώδικα):** το κατακόρυφο datum των BIM solids = ο όρος **`buildingBaseElevationM`** (`bim-three-shape-helpers` `hangDownMeshY`/`floorBaseMeshY`/`centeredMeshY`, default 0 → κτίριο τοπικό). Το geo-ref είναι **planar** (`{originWorld, rotationDeg}`, χωρίς Z)· το `basePoint.z` (ADR-369) διατηρείται στο persistence αλλά **δεν εφαρμοζόταν**. Υπάρχων SSoT sampler: `tin-sampler.ts` (`createTinSampler(tin).zAtMm`, barycentric).

  **ΛΥΣΗ #2 (big-player = ArchiCAD «Project Zero» / Revit «acquire elevation at base point»· κατακόρυφο mirror του M10b projector):**
  - **Νέο SSoT:** `systems/topography/vertical-datum.ts` — pure `resolveVerticalDatumMm(tin, originWorldX, originWorldY)` (= έδαφος κάτω από το σημείο βάσης κτιρίου μέσω `createTinSampler`· fallback = μέσο ύψος όταν το origin πέφτει εκτός survey) + impure `getActiveVerticalDatumMm()` (διαβάζει `getGeoReference().originWorld` + `getTopoSurface`, mirror του `getActiveWorldToDisplayProjector`). **Reuse, κανένα διπλότυπο.**
  - **Εφαρμογή ΜΟΝΟ στο render:** `tin-to-three` νέο option `datumMm` → `buildPositions` αφαιρεί `datumMm` από κάθε `elevMm` (`displayZ = surveyZ − datum`). Καθαρός διαχωρισμός δεδομένων/display: τα **χρώματα** (hypso/cutfill) μένουν σε **πραγματικά** υψόμετρα (mirror της M10b απόφασης για το cut/fill). Fast path: `datumMm=0` → byte-for-byte το προηγούμενο.
  - **Το κτίριο ΔΕΝ μετακινείται** (μένει τοπικό z=0) → κανένα grip/snap regression (ADR-040).

  **Tests:** `vertical-datum` (flat/sloping barycentric datum· outside→mid-height· empty→0 — 4)· `tin-to-three` (+datum drop Y· +datum δεν αγγίζει χρώματα — 8 σύνολο)· `MaterialCatalog3D`/`scene-idle-handlers` πράσινα — **47/47** στα θιγμένα. `jscpd:diff` (εκκρεμεί στο commit).

  **Temp diagnostics αφαιρέθηκαν** (`[PT-DIAG]`, `[IDLE-DIAG]`, `[TERRAIN-BUILD]`, πείραμα unlit). **Κρατήθηκε** (μόνιμο, καθαρό σχόλιο) ο guard στο `scene-idle-handlers`: όσο topo visible → **όχι** path tracer (survey ≠ photoreal subject· + belt-and-braces για το BVH merge με το `color` attribute). Τα παλιά `[TOPO-DIAG]` (M10 προηγούμενης συνεδρίας) **δεν** αγγίχτηκαν.

  **ΕΠΙΒΕΒΑΙΩΘΗΚΕ ΖΩΝΤΑΝΑ:** hypso/cutfill φαίνονται σε όλα τα επίπεδα + από κάθε γωνία· το ανάγλυφο κάθεται **κάτω από το κτίριο** αντί να πλέει.

  **ΑΝΟΙΧΤΑ FOLLOW-ONS (νέα, ξεχωριστά — για επόμενο milestone):**
  - **A — Ισοϋψείς ανά όροφο:** οι ισοϋψείς (CAD entities του σχεδίου) τοποθετούνται στο `floorElevationMm` κάθε ορόφου (`DxfToThreeConverter.ts:291` `group.position.y = floorElevationMm·MM_TO_M`) → **στοιβάζονται** αντί να είναι μία φορά. **Σωστό (big-player):** οι ισοϋψείς = σταθερά υψόμετρα εδάφους (survey product), «ντραπαρισμένες» στην 3D επιφάνεια στο πραγματικό (datum-shifted) ύψος, **μία** φορά.
  - **B — Χρώματα κρύβονται από πάνω (μόνο ισόγειο):** το datum-seated ανάγλυφο (z≈0) **συμπίπτει** με το 2D περιεχόμενο του ισογείου (κάτοψη DXF + εικόνες στο z≈0) → occlusion από πάνω. Όχι bug υλικού (DoubleSide δείχνει και τις δύο όψεις).

  **Status: M10c — IMPLEMENTED + επιβεβαιωμένο ζωντανά. Ανοιχτά A/B (contours placement + datum/2D occlusion) σε επόμενο milestone.**

- **2026-07-15 (v25)** — **M10d #A ΥΛΟΠΟΙΗΘΗΚΕ — ισοϋψείς ΜΙΑ φορά, draped στο πραγματικό υψόμετρο (όχι ανά όροφο)** (Phase 1–3, N.0.1). **Εκκρεμεί ζωντανός έλεγχος Giorgio.**

  **ΠΡΟΒΛΗΜΑ (M10c follow-on #A):** οι ισοϋψείς ζουν ως `lwpolyline` CAD entities του σχεδίου κάθε ορόφου. Το 3D DXF overlay (`DxfToThreeConverter`) ζωγραφίζει κάθε entity **επίπεδο** μέσα στο group του ορόφου και ανεβάζει όλο το group στο `floorElevationMm` (γρ. 291) → οι **ίδιες** ισοϋψείς ξανασχεδιάζονταν σε **κάθε** όροφο, στοιβαγμένες σαν σκάλα.

  **ΑΠΟΦΑΣΗ (Giorgio):** big-player practice (Revit Toposurface / Civil 3D / ArchiCAD). Οι ισοϋψείς είναι **ιδιότητα της επιφάνειας** (σταθερό ground elevation, survey product), όχι floor-scoped annotation → ζωγραφίζονται **μία** φορά στο πραγματικό (datum-shifted) υψόμετρο, ανεξάρτητα από το floor scope.

  **ΛΥΣΗ (FULL SSOT):**
  - **Νέος pure converter `contour-to-three.ts`** — plan-view αδελφός του `tin-to-three`: `ContourLine[] → { major, minor }` `BufferGeometry` line segments. Ίδιο pattern (projector M10b + datum M10c περνιούνται IN από impure caller, NaN-guard ADR-537, reuse `writeDxfPlanToWorld`). Μια ισοϋψής = τομή επιφάνειας με οριζόντιο επίπεδο στο `level` → flat ring στο `z = level − datum` κάθεται **ακριβώς** πάνω στο mesh (implicit drape, χωρίς per-vertex TIN sample). Major/minor split → δικό τους layer χρώμα.
  - **Νέο `TerrainContourLayer`** (scene/terrain/) — αδελφός του `TerrainSceneLayer`. Ίδια ιθαγένεια/reactivity (zero React state, ADR-040): subscribes topo + terrain-3d (visibility) + contour-config (interval) + geo-reference. Rebuild-all· derive contours από την **ΙΔΙΑ** `generateContoursFromSurface(getTopoSurface(), getContourConfig())` που χρησιμοποιεί το 2D (`useTopoContours`) — κανένας δεύτερος αλγόριθμος/τριγωνοποίηση. Ορατό μαζί με το έδαφος (Revit Toposurface parity). Constructed/disposed από `ThreeJsSceneManager` (scene-manager-construct).
  - **Νέο SSoT predicate `isTopoContourEntity`** (contour-entity-ids.ts, reuse `TOPO_*_LAYER_NAME`) → το `DxfToThreeConverter.buildLineGroup` **εξαιρεί** contours (γραμμές + labels) από το per-floor overlay. Το 2D κάτοψη μένει ανέγγιχτο (CAD entities ως έχει).
  - **Νέο contour material** `getTopoContourMaterial3D(isMajor)` (MaterialCatalog3D) — unlit `LineBasicMaterial`, ίδια brown palette με το 2D (`contour-config`), cached per class. **Boy Scout:** προστέθηκε disposal για `TERRAIN_ANALYSIS_CACHE` (M10c gap) + το νέο `TERRAIN_CONTOUR_CACHE` στο `disposeMaterialCatalog3D`.

  **Tests:** `contour-to-three.test.ts` (6 — major/minor split, z=level−datum, projector, closed ring wrap, NaN drop, empty→null) + `contour-entity-ids.test.ts` (5). Επηρεαζόμενα converter tests 33/33 PASS. `jscpd:diff` **καθαρό** (incl. έναντι `tin-to-three`/`TerrainSceneLayer` sibling clones).

  - **Commit-gate addendum (N.18):** στο staging το CHECK 3.28 (jscpd) εντόπισε 2 sibling clones μεταξύ `TerrainContourLayer` και `TerrainSceneLayer` (root-seating + shared subscriptions, ~27 γρ.). **Κεντρικοποιήθηκαν** σε νέο SSoT `scene/terrain/topo-scene-layer-support.ts` (`seatTopoLayerRoot` + `subscribeTopoLayer(rebuild, extra[])`)· και οι δύο layers το καλούν (η κάθε μία περνά τον δικό της extra subscriber — cut-fill / contour-config). `jscpd:diff` πλέον **πραγματικά** καθαρό.

  **Status: M10d #A — IMPLEMENTED (εκκρεμεί ζωντανός έλεγχος). Ανοιχτό #B (datum/2D occlusion + έλεγχος διαφάνειας ανάγλυφου/ισοϋψών) — επόμενο βήμα ίδιου milestone.**

- **2026-07-15 (v26)** — **M10d #B ΥΛΟΠΟΙΗΘΗΚΕ — occlusion ισογείου («κάτοψη πάνω, έδαφος κάτω») + έλεγχος διαφάνειας** (Phase 1–3, N.0.1). **Εκκρεμεί ζωντανός έλεγχος Giorgio.**

  **ΠΡΟΒΛΗΜΑ (M10c follow-on #B):** το datum-seated ανάγλυφο κάθισε στο z≈0, όπου ζει και το 2D περιεχόμενο του ισογείου (κάτοψη DXF + εικόνες στο `floorElevationMm=0`). Δύο αδιαφανή πράγματα στο ίδιο depth → η κάτοψη κρύβει το ανάγλυφο από πάνω («από τον ισημερινό και πάνω»).

  **ΑΠΟΦΑΣΗ (Giorgio):** (1) «κάτοψη πάνω, έδαφος κάτω» — το σχεδιαστικό φύλλο μένει από πάνω, το φυσικό έδαφος = context λίγο πιο κάτω. (2) Δυνατότητα ρύθμισης **διαφάνειας** για τα ΤΡΙΑ overlays ξεχωριστά: ισοϋψείς, μονόχρωμο (shaded), έγχρωμο (hypsometric) — Civil 3D «Surface Style transparency».

  **ΛΥΣΗ:**
  - **Occlusion:** νέα σταθερά `TERRAIN_DISPLAY_DROP_MM=50` (vertical-datum.ts) → και τα δύο terrain layers (mesh + contours) κατεβαίνουν `root.position.y = −drop` (world-space translation, ΟΧΙ `polygonOffset` — αυτό προκάλεσε το M10c regression). Αμελητέο σε building scale, σπάει το depth tie ώστε η κάτοψη να κερδίζει από πάνω.
  - **Διαφάνεια (per-style memory):** `terrain-3d-store` επεκτάθηκε με `surfaceOpacity: Record<style, number>` (shaded/hypsometric/cutfill, το καθένα θυμάται τη δική του) + `contourOpacity`, clamped 0..1, identity-guarded. `getTerrainMaterial3D(style, opacity)` / `getTopoContourMaterial3D(isMajor, opacity)` εφαρμόζουν `applyTerrainOpacity` (transparent + `depthWrite=!transparent`) στα **terrain-exclusive** materials (κανένα shared BIM singleton· οι none/hidden-line face modes σκόπιμα δεν φέρουν terrain opacity — data surface, όχι solid).
  - **Perf (ADR-040):** opacity-only αλλαγή = fast path — τα layers κρατούν `lastInputs` (surface/style/datum/geoRef ± config) και σε αμετάβλητα geometry inputs **επαναχρωματίζουν** το υπάρχον mesh/lines χωρίς re-triangulation / re-marching. Slider drag = μηδέν CDT.
  - **UI:** νέο `Terrain3DSection.tsx` (extract από `TopographyPanel`, N.7.1 SRP) — show/hide + υψομετρικό toggle + 2 sliders (`@/components/ui/slider`): «Διαφάνεια επιφάνειας» (δένει στο active style → per-style memory) + «Διαφάνεια ισοϋψών». i18n keys `terrain3d.surfaceOpacity`/`contourOpacity` (el+en).
  - **N.18 de-dup:** τα δύο layers μοιράζονταν constructor/lifecycle → εξήχθη `topo-scene-layer-support.ts` (`seatTopoLayerRoot` + `subscribeTopoLayer`, μία θέση για το drop margin + το κοινό subscription set). `jscpd:diff` **καθαρό** (8 αρχεία).

  **Tests:** `terrain-3d-store.test.ts` (4 — per-style memory, contour separate, clamp, no-op identity). Topography suite **293/293 PASS**. ΟΧΙ tsc (N.17). MaterialCatalog3D στα 499 γρ. (οριακά· υποψήφιο για μελλοντικό split των terrain materials).

  **Status: M10d #B — IMPLEMENTED (εκκρεμεί ζωντανός έλεγχος). Το M10d (#A+#B) ολοκληρώθηκε ως προς κώδικα.**

- **2026-07-15 (v27)** — **M10d #Γ — ισοϋψείς ως BACKGROUND στη 2D κάτοψη («κάτοψη πάνω»)** (Phase 1–3, N.0.1). **Εκκρεμεί ζωντανός έλεγχος Giorgio.**

  **ΠΡΟΒΛΗΜΑ (ζωντανός έλεγχος Giorgio, screenshot 20:04):** στη **2D** κάτοψη οι ισοϋψείς ζωγραφίζονταν ΠΑΝΩ από την κάτοψη του κτιρίου. Ρίζα (grep, επιβεβαιωμένη): το `DxfRenderer` σχεδιάζει τα entities με **σειρά πίνακα** `scene.entities`· οι ισοϋψείς μπαίνουν **τελευταίες** (append μέσω `completeEntities`) → σχεδιάζονται τελευταίες → πάνω. **Άσχετο με #A/#B** (που ήταν 3D-only) — ξεχωριστό 2D draw-order θέμα.

  **ΑΠΟΦΑΣΗ (Giorgio):** «κάτοψη πάνω, ισοϋψείς πίσω» — οι ισοϋψείς = τοπογραφικό context (background), το κτίριο = foreground (AutoCAD «send to back» των topo layers).

  **ΛΥΣΗ:** νέο **background pass** στην αρχή του `DxfRenderer.render` — ζωγραφίζει τα topo contour entities (γραμμές + labels) ΠΡΙΝ το line-batch + `renderMatching`, χτίζοντας `topoContourIds` Set· το `renderMatching` παρακάμπτει αυτά τα ids (μηδέν διπλό draw). Reuse του **ίδιου** `isTopoContourEntity` predicate (SSoT με το 3D overlay skip). Οι ισοϋψείς είναι `lwpolyline`/`text` → ποτέ WebGL-owned (ADR-639 Στάδιο 5), οπότε κανένα GPU double-draw. Μηδέν αλλαγή bitmap-cache key.

  **⚠️ GOTCHA (fix 2, μετά από 1ο αποτυχημένο ζωντανό έλεγχο):** το predicate πρέπει να διαβάζει `options.layersById` (RAW), **ΟΧΙ** `effectiveOptions.layersById` — το `skipInteractive` branch (bitmap-cache normal-state render, **αυτό που εμφανίζεται**) ξαναχτίζει το `effectiveOptions` **ΧΩΡΙΣ** `layersById` → το predicate έπαιρνε `undefined` → ποτέ match → οι ισοϋψείς έμεναν μπροστά. Οι contour entities έχουν explicit color, οπότε ζωγραφίζονταν καφέ κανονικά μα στη λάθος σειρά. Το raw `options.layersById` περνιέται και στα δύο paths (`dxf-canvas-renderer.ts:202`).

  **Αρχεία:** `DxfRenderer.ts` (background pass + skip + `options.layersById` source), `ADR-040` changelog (CHECK 6B/6D stage). ΟΧΙ tsc (N.17)· jscpd:diff καθαρό.

  **Status: M10d #Γ — IMPLEMENTED (εκκρεμεί ζωντανός έλεγχος #2).**

- **2026-07-15 (v28)** — **M10d #Γ SUPERSEDED — draw-order περνά σε γενικό array-order SSoT (ADR-661).**
  **Πρόβλημα (ίδιο σύμπτωμα, βαθύτερη ρίζα):** το M10d #Γ background pass (v27) διόρθωσε το
  `layersById` gotcha, αλλά το υποκείμενο πρόβλημα ήταν δομικό — ο `DxfRenderer` ζωγράφιζε **όλες**
  τις γραμμές σε ένα ενιαίο batched πέρασμα **κάτω** από κάθε μη-γραμμή entity, ανεξάρτητα από τη
  σειρά του πίνακα `scene.entities` — άρα η θέση στον πίνακα δεν ήταν πραγματική z-σειρά για
  γραμμές. Ένα ειδικό «topo background pass» θα ήταν πάντα ένα ακόμη ειδικό-case patch πάνω σε ένα
  μη-γενικό μοντέλο.

  **Απόφαση (Giorgio):** η σειρά του πίνακα `scene.entities` γίνεται η ΜΙΑ SSoT για 2D draw-order,
  για ΟΛΟΥΣ τους τύπους entity (AutoCAD DRAWORDER μοντέλο) — βλ. **ADR-661** (νέο, πλήρες ADR).
  Το `DxfRenderer.render` ξαναγράφτηκε σε single array-order πέρασμα με per-style consecutive-line
  run-batching (αντικαθιστά το line-batch-first + `renderMatching`)· το M10d #Γ background
  pass/predicate **αφαιρέθηκε**. Οι ισοϋψείς πλέον κάθονται στο ΠΙΣΩ μέρος του πίνακα **στην πηγή**
  (`regenerate-topo.ts`: `entities: [...fresh, ...kept]`, fresh contours πρώτες = πίσω) αντί για
  ειδική μεταχείριση στον renderer — durable, γιατί οι ισοϋψείς ξαναχτίζονται από το survey SSoT σε
  κάθε load/level-switch/geo-ref-change (M9/M10) και όχι το `regenerate-topo` seat-at-back θα
  ακυρωνόταν σε κάθε rebuild. Το interactive «Δημιουργία ισοϋψών» (`useTopoContours`) κάνει το ίδιο
  με ένα undo step (`CompoundCommand` + νέο `BatchReorderEntityCommand`).

  Το ADR-661 προσθέτει επίσης ένα γενικό per-entity/multi-select «Αποστολή πίσω / Μεταφορά μπροστά»
  (πληκτρολόγιο `PageUp`/`PageDown` + δεξί-κλικ context menu), πάνω από το προϋπάρχον single-entity
  `ReorderEntityCommand` (ADR-507). Λεπτομέρειες αρχιτεκτονικής, invariants διατηρημένα (ADR-040
  Phase X/IX, ADR-640, ADR-639, ADR-642, ADR-358, ADR-363 §11.Q3 slab-opening two-pass) και το
  perf tradeoff (run-local αντί για global line-batching) → **ADR-661** (ξεχωριστό, πλήρες ADR).

  **Status: M10d #Γ topo-only background pass SUPERSEDED από ADR-661 (γενικό array-order SSoT).
  Draw-order concerns για τις ισοϋψείς ζουν πλέον στο ADR-661· αυτό το ADR-650 κρατά μόνο το
  «contours seat at back at generation» detail (§ regenerate-topo, βλ. ADR-661 §3).**

---

- **v-pointer (2026-07-16) — Το ανάγλυφο κόβεται πλέον στη στάθμη ενεργού ορόφου → ADR-665.**
  Το M4 (3Δ terrain) + M10d (draped ισοϋψείς) έφεραν το ανάγλυφο στο 3Δ **χωρίς κοπή**: ο μηχανικός
  στον 1ο όροφο έβλεπε μόνο χώμα, με το κτίριο θαμμένο (στιγμιότυπα Giorgio 2026-07-16). Το
  **ADR-665** προσθέτει αυτόματη οριζόντια κοπή στο FFL του ενεργού ορόφου (το κτίριο μένει ακέραιο).

  **Τι αλλάζει σε ΑΥΤΟ το ADR — τίποτα στο pipeline δεδομένων.** Το `getTopoSurface()` παραμένει το
  ένα SSoT TIN· η τριγωνοποίηση, οι ισοϋψείς και το `TopoPointStore` δεν αγγίζονται. Αλλάζει μόνο η
  **προβολή**: νέο πεδίο `autoClipAtActiveLevel` στο `terrain-3d-store` (default `true`· το `visible`
  είναι ήδη `false` by default ⇒ η default σκηνή μένει byte-identical), και τα
  `getTerrainMaterial3D` / `getTopoContourMaterial3D` μετακινούνται σε `terrain-materials-3d.ts`
  (ο `MaterialCatalog3D` ήταν 499/500 γραμμές, N.7.1).

  **⚠️ Bug που διορθώθηκε εκεί:** οι ισοϋψείς (`LineSegments`) **δεν κόβονταν ΠΟΤΕ** από καμία τομή —
  ο applicator ξεκινούσε με `if (!(obj as THREE.Mesh).isMesh) return;`. Με ενεργό section box/axis cut
  οι πορτοκαλί γραμμές αιωρούνταν άκοπες πάνω από το κομμένο χώμα. Ορατή αλλαγή σε κάθε υπάρχουσα
  άποψη με ενεργή τομή + ορατό ανάγλυφο.

  **«Όλοι οι όροφοι» → καμία κοπή** (καμία ενεργή στάθμη· ακολουθεί το ADR-399). **Point cloud
  άκοπο** (δεν καλεί `seatTopoLayerRoot`, `PointsMaterial` εκτός allowlist) — σκόπιμο, §6.

---

- **v19 (2026-07-27) — M5α.2: ο «Έλεγχος ποιότητας» απαντά και στο 3Δ (markers + zoom-to + non-modal panel).**

  **Το πρόβλημα (στιγμιότυπο Giorgio, 2026-07-27):** ο μηχανικός τρέχει «Έλεγχος ποιότητας», η λίστα
  γεμίζει ευρήματα, κάνει κλικ σε γραμμή — **και δεν βλέπει τίποτα**. Δύο ανεξάρτητες αιτίες, και οι
  δύο στο ΙΔΙΟ μονοπάτι:

  1. **Το M5α ήταν 2Δ-only.** Το `canvas-layer-stack-topo-qa-overlay` είχε ρητό
     `if (… || is3D) return null` («M5α ships 2D markers only»), και το `canvas-fit-to-view-selected`
     είναι 2Δ handler. Στο 3Δ viewport το κλικ **δεν έκανε απολύτως τίποτα ορατό**. Αυτό ήταν ήδη
     καταγεγραμμένο open item του M5α («3Δ markers») — αλλά ένα QA report που μαυρίζει μόλις
     περιστρέψεις το οικόπεδο απαντά στη μισή ερώτηση: το elevation bust **ΕΙΝΑΙ** αιχμή στο mesh,
     και στην κάτοψη είναι αόρατο.
  2. **Το panel ήταν modal.** Το ADR-662 Φ4 μετέφερε τα review sections σε `section-in-dialog`. Για
     το QA αυτό είναι λάθος κατηγορία διαλόγου: κάθε γραμμή **μιλάει για ό,τι είναι από πίσω**, και
     ένα κεντραρισμένο dialog με backdrop κάλυπτε ακριβώς το σημείο στο οποίο μόλις είχε κάνει zoom.

  **Τι μπήκε**
  - `TopoQaMarkers3DOverlay` — το 3Δ δίδυμο, mounted από `BimViewport3DProjectedOverlays`. Ίδιο
    `useTopoQaReport()` store, **ίδιο** `ClashMarkerLayer` + ⊙ glyph (ADR-435 SSoT) — ένα σχήμα
    προσοχής σε όλη την εφαρμογή, σε **δύο** όψεις. Ο 2Δ `is3D` guard γίνεται load-bearing: πλέον
    αποτρέπει **διπλούς** markers, δεν κρύβει έλλειψη.
  - `TopoQaFlag.atZMm` (**προαιρετικό**) — τα checks που ξέρουν υψόμετρο το δίνουν (κόμβου Z /
    στίγματος Z / μέσο ακμής). Το ring centroid (boundary/self-intersection) **δεν ξέρει** → μένει
    `undefined` και το 3Δ δειγματοληπτεί το TIN (`getTinSampler`). Αν ούτε αυτό απαντά → ο marker
    **κρύβεται**. «Δεν ξέρω κατακόρυφα» **δεν** γίνεται «είναι στο μηδέν»: marker στο datum plane
    στέλνει τον μηχανικό σε λάθος σημείο (fail-closed, ίδια πειθαρχία με ADR-713).
  - `topo-qa-marker-math` + `topo-qa-flag-world` — οι **ίδιοι τρεις** μετασχηματισμοί του
    `tin-to-three`, με την ίδια σειρά (geo projector M10b → −vertical datum M10c → plan-mm→world),
    ώστε ο marker να μην μπορεί να καθίσει αλλού από τον λόφο που σημαδεύει. Ο resolver είναι
    **ΕΝΑΣ** και τον μοιράζονται overlay + panel: αλλιώς ένα ⊙ και το δικό του «zoom to» θα
    μπορούσαν να δείχνουν διαφορετικά σημεία.
  - `DialogContent nonModal` (κοινό UI, default `false` ⇒ κανένα υπάρχον dialog δεν αλλάζει) —
    χωρίς backdrop **και** χωρίς `ModalKeyboardScope`. Ένα panel που δεν κατέχει την οθόνη δεν
    δικαιούται να κατέχει και το πληκτρολόγιο (ADR-711). Το QA dialog παρκάρει δεξιά, καθαρό από
    ViewCube / 3D toggle — mirror του `ClashReportPanel`.

  **Κεντρικοποιήσεις που επέβαλε το jscpd (N.18) — πέντε, όλες μέσα στο ίδιο commit** (δύο γύροι:
  το πρώτο extraction αποκάλυψε το επόμενο clone — αναμενόμενο, βλ. feedback memory)
  - `view-focus-bus` (γενίκευση του `clash-focus-bus`, το οποίο **διαγράφηκε**). Το bus μεταφέρει
    πλέον **three-world μέτρα**, όχι «συντεταγμένες κάποιου domain»: με δεύτερο producer σε άλλο
    frame (ΕΓΣΑ mm + projector + datum), ένα κοινό bus με domain coordinates θα έκανε τον μοναδικό
    subscriber να εφαρμόσει τον μετασχηματισμό του ΕΝΟΣ και στους ΔΥΟ — σιωπηλά καδράροντας την
    κάμερα στο κενό για τον άλλο. Το `halfExtentM` ταξιδεύει μαζί (σύγκρουση = 0.6 m, τοπογραφικό
    σφάλμα = 15 m· μία σταθερά στον subscriber θα ζούμαρε τον έναν άχρηστα).
  - `use-view-focus-3d` — το camera framing βγήκε από το `ClashMarkers3DOverlay`· δεν ήταν ποτέ
    clash-specific.
  - `use-camera-projected-markers` — projection + camera-move tick. Το `jscpd --diff` βρήκε 2 clones
    (12 + 18 γραμμές) μεταξύ του νέου overlay και του clash· εξήχθησαν αντί να σταλούν δίδυμα.
  - `plan-to-world-math` (THREE-free) — η σύμβαση αξόνων `(x, elev, −north)` ζούσε σε **δύο**
    αντίγραφα (`coordinate-transforms` + `clash-marker-math`)· τώρα σε ένα, και τα δύο κάνουν
    delegate. THREE-free by design: αυτό επιτρέπει σε DOM panel να μετατρέψει το δικό του domain
    πριν βάλει σημείο στο bus, χωρίς να τραβήξει το three στο module graph του.
  - `topo-qa-marker-set` — δεύτερος γύρος: μετά την εξαγωγή του camera tick, το jscpd βρήκε clone
    ανάμεσα στο **2Δ και το 3Δ QA overlay** (flag→glyph mapping + το σχήμα «null report ⇒ κενός
    πίνακας»). Εξήχθη· στα overlays μένει **μόνο** το δικό τους `map` callback. Το συμβόλαιο που
    φυλάει: και οι δύο πίνακες είναι index-aligned με το `report.flags` — ο layer τοποθετεί τον
    marker `i` με `project(i)`, οπότε ένα φιλτράρισμα στη μία πλευρά και όχι στην άλλη θα σχεδίαζε
    σιωπηλά κάθε marker στη θέση του γείτονά του.

  **Tests:** `plan-to-world-math` (11) + `topo-qa-marker-math` (8) — καρφώνουν πρόσημα, κλίμακα,
  σειρά projector/datum και το `null` στο μη-πεπερασμένο. Ένα λάθος πρόσημο εδώ καθρεφτίζει όλο το
  μοντέλο και είναι αόρατο σε review.

  **Εκτός εμβέλειας (καταγράφεται, δεν «διορθώθηκε» σιωπηλά):** ο **2Δ** focus χρησιμοποιεί
  `flag.at` (WORLD ΕΓΣΑ mm) απευθείας ως canvas units. Σε γεωαναφερμένο έργο όπου οι ισοϋψείς
  επαναπροβάλλονται (M10b), αυτό ήταν ήδη ύποπτο **πριν** από αυτή τη δουλειά και παραμένει ως έχει
  — δεν αγγίχθηκε στο ίδιο commit.

  **Το panel έγινε FloatingPanel, όχι «non-modal dialog» (Giorgio, ίδια μέρα).** Πρώτη απόπειρα ήταν
  `<Dialog modal={false}>` + `nonModal` prop στο κοινό `DialogContent`. **Λάθος primitive**: ένας Radix
  διάλογος κλείνει στο πρώτο outside click — δηλαδή τη στιγμή που ο μηχανικός αγγίζει το ίδιο το σχέδιο
  για το οποίο μιλάει ο διάλογος. Ο σωστός μηχανισμός υπήρχε ήδη: το `FloatingPanel` SSoT που
  χρησιμοποιεί το `ClashReportPanel` — draggable, χωρίς backdrop, χωρίς outside-click dismissal,
  κλείνει μόνο από το ✕ του. Το `nonModal` prop **αφαιρέθηκε** από το `dialog.tsx` (θα έμενε dead
  code)· στη θέση του μπήκε σχόλιο-φράκτης που στέλνει τον επόμενο στο `FloatingPanel`.

  **Επιλεγμένο εύρημα (Giorgio, ίδια μέρα).** Το `topo-qa-store` κρατά πλέον `selectedFlagId` **στο
  ΙΔΙΟ store** με το report (δύο stores θα χρειάζονταν συγχρονισμό από κάθε caller — ο κλασικός τρόπος
  να επιβιώσει ένα stale id ενός re-run). Δύο ιδιότητες που κλειδώνονται με tests:
  - `set(report)` **μηδενίζει** την επιλογή — τα flag ids είναι per-report.
  - `select(id)` περνά το report **by reference** ⇒ κάθε `useTopoQaReport()` κάνει bail-out και τα
    `useMemo(…, [report])` των overlays **δεν** ξαναϋπολογίζουν θέσεις (στο 3Δ: μία δειγματοληψία TIN
    ανά flag) σε κάθε κλικ γραμμής.

  Το `ClashMarkerGlyph` πήρε προαιρετικό `selected` (default `false` ⇒ το clash overlay αμετάβλητο):
  μεγαλύτερος δακτύλιος + άλως στο `UI_COLORS.SELECTION_HIGHLIGHT`, με το severity χρώμα **να μένει**
  από κάτω — «σε ποιο εύρημα είμαι» και «πόσο σοβαρό είναι» είναι δύο ερωτήσεις. Το μέγεθος μεγαλώνει
  με `overflow: visible` γύρω από το αμετάβλητο κέντρο (8,8)· αν μεγάλωνε το box, το κέντρο θα
  μετατοπιζόταν και ο επιλεγμένος marker θα ξέφευγε από το σημείο που δείχνει.

  **Status: M5α ΠΛΗΡΕΣ και στις δύο όψεις (2Δ + 3Δ), με floating panel + selection highlight.
  Ανοιχτά M5α items: auto-clear, tuning.**

  **Το ζουμ του χρήστη επιβιώνει (Giorgio, ίδια μέρα).** Bug που φάνηκε μόλις το panel έγινε
  χρηστικό: κάθε κλικ γραμμής έκανε **fit**, άρα ΞΑΝΑΟΡΙΖΕ την κλίμακα — ο μηχανικός ζούμαρε σε ένα
  εύρημα, πατούσε το επόμενο, και το ζουμ του χανόταν. Συμπεριφορά CAD: **η πρώτη μεταπήδηση ορίζει
  κλίμακα, οι επόμενες την σέβονται.**
  - `canvas-center-on-point` (νέο 2Δ event) — αντιστρέφει τον τύπο `worldToScreen` **ως προς τα
    offsets μόνο**, με το `scale` σταθερό, διαβάζοντας το ζωντανό transform με `getImmediateTransform()`
    (event-time getter· ένα React snapshot θα επανέφερε παλιά κλίμακα).
  - `viewport.centerOn()` (νέο 3Δ) — κρατά **αναλλοίωτο** το διάνυσμα camera→target· απόσταση,
    κατεύθυνση και `zoom` επιβιώνουν. Το `frameBounds` υπολογίζει νέα απόσταση **εξ ορισμού** —
    γι' αυτό δεν έγινε flag πάνω του: δύο προθέσεις, δύο συναρτήσεις.
  - **Ξεχωριστό event, όχι flag στο `canvas-fit-to-view-selected`**: το fit ΚΑΤΕΧΕΙ την κλίμακα κατά
    σχεδίαση (το πλήκτρο Z σημαίνει «δείξε μου όλο αυτό»). Ένα flag θα ανάγκαζε κάθε caller να
    μαντεύει ποια συμπεριφορά παίρνει.
  - «Πρώτη ή επόμενη;» = `getSelectedFlagId() !== null`, διαβασμένο **πριν** το `select`. Η ίδια
    κατάσταση που κρατά το highlight ορίζει και το «έχω ήδη προσγειωθεί» — μηδέν νέο state, και ο
    κύκλος μηδενίζεται ακριβώς όπου πρέπει (νέο Run / Clear).

  **Bug που έμεινε κρυφό μέχρι που ο Giorgio το είδε: το `selected` δεν έφτανε ΠΟΤΕ στο glyph.**
  Το `ClashMarkerLayer` έκανε `<ClashMarkerGlyph severity={m.severity} soft={m.soft} />` — χειροκίνητη
  λίστα props. Το `selected` χτιζόταν σωστά, έμπαινε στον πίνακα σωστά, παραδιδόταν σωστά… και
  πεταγόταν σε εκείνη τη γραμμή. **Κανένα type error** (το επιπλέον κλειδί απλώς δεν διαβάζεται),
  κανένα κόκκινο test, κανένα warning. Μόνο σύμπτωμα: «δεν βλέπω τα επιλεγμένα σημεία διαφορετικά».
  Έγινε spread (`{...m}`) + **test στο seam** (`clash-marker-layer-props.test.tsx`) που επαληθεύτηκε
  ότι πέφτει κόκκινο με το bug ξαναβαλμένο — αλλιώς θα ήταν διακοσμητικό.

  **Παρατήρηση για μετά — ΕΓΙΝΕ αμέσως μετά (2026-07-27):** το `TopoAutoBreaklineSection` είχε την
  ΙΔΙΑ σημασιολογία και ήταν ακόμη modal dialog στο `TopoRibbonHost`. Μετατράπηκε — αλλά **όχι με
  αντιγραφή**: το δεύτερο αντίγραφο θα το είχε πιάσει το `jscpd --diff` μέσα στο ίδιο commit (N.18),
  οπότε προηγήθηκε κεντρικοποίηση.
  - **NEW `systems/coordination/review-focus.ts`** — «πήγαινέ με σε αυτό το εύρημα», **μία φορά για
    κάθε review panel**. Η κίνηση δεν είναι μία συμπεριφορά αλλά τέσσερις (ποια όψη ζει· πρώτη vs
    επόμενη μεταπήδηση· 2Δ fit vs center· 3Δ bus με `preserveZoom`) και θα γράφονταν όλες ξανά.
    **Το εύρος ΠΑΡΑΓΕΤΑΙ**: το padded bbox της ίδιας της γεωμετρίας του ευρήματος δίνει ΚΑΙ το 2Δ
    κουτί ΚΑΙ το 3Δ `halfExtentM` — το χειροκίνητο `TOPO_QA_FOCUS_HALF_EXTENT_M = 15` (δύο αριθμοί
    που έπρεπε να μένουν ίσοι με το χέρι) καταργήθηκε. Σημείο με padding 15 m δίνει πάλι 15·
    ακμή δρόμου 200 m πλαισιώνεται **ολόκληρη** αντί για αυθαίρετο παράθυρο 30 m στη μέση της.
  - **NEW `ui/panels/topography/TopoReviewPanel.tsx`** — το κέλυφος `FloatingPanel` που θα
    επαναλάμβαναν και οι τέσσερις επιφάνειες review. **Γιατί ΟΧΙ modal**: ένα review panel είναι
    **σύντροφος του καμβά, όχι παράκαμψή του** — σκουραίνει το σχέδιο, παγιδεύει το πληκτρολόγιο,
    και (ακόμη και με `modal={false}`) κλείνει στο πρώτο κλικ έξω, δηλαδή τη στιγμή που αγγίζεις
    ακριβώς το σχέδιο για το οποίο μιλά. Για το pick ορίου cut/fill είναι απαγορευτικό.
  - **NEW `bim-3d/converters/topo-polyline-to-three.ts`** + `auto-breakline-to-three.ts` /
    `coordination/auto-breakline-world.ts`: το `contour-to-three` κράτησε ΜΟΝΟ τη σημασιολογία
    ισοϋψούς· η κοινή «τοπογραφική πολυγραμμή → three» έγινε ένα module. Το
    `topo-qa-marker-math` μετονομάστηκε σε **`topo-world-point-math`** — το όνομα έλεγε «QA marker»
    ενώ ο μετασχηματισμός αφορά **κάθε** σημείο τοπογραφικού κόσμου (τώρα και breaklines).

  **Τι δεν έλεγε το αίτημα και έπρεπε να λυθεί: οι υποψήφιες ΔΕΝ ΥΠΗΡΧΑΝ στην 3Δ όψη.** Το M8β/Γ
  παρέδωσε προεπισκόπηση **μόνο** ως 2Δ SVG. Άρα σε 3Δ το κλικ σε γραμμή έστελνε ένα
  `canvas-fit-to-view-selected` που **δεν φαινόταν πουθενά** — και ταυτόχρονα μετακινούσε σιωπηλά
  τον 2Δ καμβά πίσω από την 3Δ όψη. Η «τριπλή μετατροπή» θα ήταν μισή: το selection highlight δεν
  έχει τι να φωτίσει, και το ζουμ πάει σε άδειο έδαφος. **Και είναι ακριβώς η όψη που χρειάζεται**:
  η ερώτηση της υποψήφιας («ράχη ή θόρυβος τριγωνοποίησης;») είναι ερώτηση **ανάγλυφου**, και η
  κάτοψη είναι η χειρότερη όψη για ανάγλυφο. Ο μηχανικός έχανε τις προτάσεις ακριβώς τη στιγμή που
  ήταν σε θέση να τις κρίνει (§9, human-certifier).
  - **NEW `bim-3d/scene/terrain/TopoAutoBreaklineCandidateLayer.ts`** — το **τρίτο** `TopoSceneLayer`,
    μετά το mesh και τις draped ισοϋψείς. Τρία σετ γραμμών από τον converter: εγκεκριμένες (πράσινο),
    απορριφθείσες (γκρι), **εστιασμένη** (χρώμα επιλογής, τελευταία, ΜΕΣΑ από το ύψωμα, με κουκκίδες
    στις κορυφές). Ίδιοι τρεις μετασχηματισμοί (projector M10b + datum M10c + άξονες) → μια υποψήφια
    δεν μπορεί να αιωρηθεί πάνω από το έδαφος από το οποίο εξήχθη. Wiring: `scene-manager-construct`
    + `ThreeJsSceneManager.dispose` (mirror του contour layer), με `reapplyTopoClip` (ADR-665).
  - **Κρύβεται μαζί με το έδαφος** (`getTerrain3DState().visible`, ο gate της βάσης) — και εδώ αυτό
    είναι **σωστό, όχι απλώς κληρονομημένο**: μια γραμμή που αιωρείται στο κενό δεν κρίνεται· είναι
    το χώμα από κάτω που την κάνει ράχη ή θόρυβο (Revit Toposurface parity).
  - ⚠️ **ΑΝΤΙΚΑΤΑΣΤΑΘΗΚΕ ΑΠΟ ΤΟ v23 — μην το ακολουθήσεις.** Έλεγε: *«Το "μέγεθος" σε 3Δ ΔΕΝ γίνεται
    με πάχος γραμμής: το `LineBasicMaterial.linewidth` το αγνοεί το WebGL (πάντα 1 px), και η
    fat-line διαδρομή (`LineSegments2`) θα έφερνε per-resize `resolution` plumbing που το scene
    layer δεν έχει. Λύση: κουκκίδες κορυφών + `depthTest: false`. ΜΗΝ "διορθωθεί" σε `linewidth`.»*
    Το **πρώτο** σκέλος ισχύει (το WebGL όντως αγνοεί το `linewidth`)· το **δεύτερο ήταν λάθος** —
    το `bimEdgeResolutionStore` δημοσιεύει αυτό ακριβώς το `resolution` **για όλη τη σκηνή BIM 3Δ**
    από το ADR-375 Phase C.7, γραμμένο από τον scene manager σε κάθε resize. Το συμπέρασμα «άρα
    κουκκίδες» στηριζόταν σε ανύπαρκτο εμπόδιο. Το `depthTest: false` **παραμένει σωστό**. Βλ. v23.
  - ⚠️ **ΑΝΤΙΚΑΤΑΣΤΑΘΗΚΕ ΑΠΟ ΤΟ v23.** Οι κουκκίδες μοιράζονταν **το ίδιο buffer** με την εστιασμένη
    γραμμή (κάθε κορυφή δύο φορές, μία ανά γειτονικό τμήμα). Ακίνδυνο όσο ήταν αδιαφανείς σε 9
    συνθετικές κορυφές· σε πραγματική οριογραμμή 50+ κορυφών είναι ταινία θορύβου, και διπλο-blend
    σε κάθε κουκκίδα μόλις το υλικό αποκτήσει διαφάνεια.

  **Δύο σημάνσεις ανά υποψήφια, ΟΧΙ μία** (`auto-breakline-store`): `selected` = έγκριση («θα
  γραφτεί», πολλές, checkbox) και `focusedId` = εστίαση («αυτήν κοιτάω», μία, κλικ στη γραμμή). Και
  οι τέσσερις συνδυασμοί έχουν νόημα. Αν μπλεχτούν, το σφάλμα είναι **δεδομένων**: ένα κλικ για να
  δει κάποιος μια υποψήφια θα άλλαζε σιωπηλά το τι γράφεται στην αποτύπωση. Καρφωμένο σε tests.

  **Χρώματα:** `UI_COLORS.TOPO_BREAKLINE_APPROVED/REJECTED` (color-config) — **ένα** λεξιλόγιο που
  διαβάζουν 2Δ overlay ΚΑΙ 3Δ υλικό, γιατί το «πράσινη στο σχέδιο» που λέει το ίδιο το panel είναι
  υπόσχεση που οφείλει να ισχύει και στις δύο όψεις. Το CSS module κρατά αντίγραφο (δεν κάνει import
  TS) με ρητό σχόλιο-δείκτη.

  **Και τα ΤΕΣΣΕΡΑ review sections έγιναν `TopoReviewPanel`** — όχι μόνο οι ασυνέχειες:
  - **CutFill**: το «Όριο εκσκαφής» οπλίζει tool που απαιτεί **κλικ ΠΑΝΩ στο σχέδιο** ενώ το panel
    είναι ανοιχτό· με modal ήταν κυριολεκτικά **αδύνατο**. Επίσης το `runCutFill` ανάβει τον
    χρωματισμό cut/fill στο 3Δ έδαφος — που το modal σκούραινε.
  - **Cloud3D**: όλος ο σκοπός του (§6) είναι να **ΔΕΙΣ** τι κράτησε το φίλτρο· ένα toggle ορατότητας
    πίσω από backdrop δεν απαντά σε τίποτα.
  - Οι **φόρμες** (import / γεωαναφορά / παραδοτέα) **μένουν modal**: συμπληρώνεις, πατάς, τελείωσες
    — δεν μιλούν για ό,τι είναι από πίσω. Ο διαχωρισμός είναι σημασιολογικός, όχι αισθητικός.
  - Cascade slots ανά panel (σταθερά, όχι «σειρά ανοίγματος»): δύο ανοιχτά panels δεν προσγειώνονται
    στο ίδιο pixel, και καθένα ξανανοίγει εκεί που το άφησε ο μηχανικός.

  **Αγκύρωση κάμερας = ΜΕΣΟ υψόμετρο της αλυσίδας** (`meanCandidateElevationMm`), όχι της πρώτης
  κορυφής: άκρη δρόμου που κατεβαίνει 4 μ θα τραβούσε την κάμερα στο ένα της άκρο, ενώ ο μηχανικός
  ζήτησε να δει ΟΛΟΚΛΗΡΗ τη γραμμή. Και σε αντίθεση με το QA flag, εδώ **κάθε** κορυφή φέρει
  μετρημένο Z — καμία δειγματοληψία TIN, καμία επινόηση.

  **Tests (όλα πράσινα, 980 στο topo/bim-3d σύνολο):** `review-focus` (11 — δρομολόγηση ανά όψη +
  παραγόμενο εύρος + «η κάμερα ΔΕΝ κουνιέται χωρίς υψόμετρο»), `auto-breakline-store` (7 — η
  ανεξαρτησία έγκρισης/εστίασης, το by-reference `report`), `auto-breakline-world` (3 — ο κανόνας
  αγκύρωσης), `auto-breakline-to-three` (9 — κάδοι,
  υψόμετρο **ανά κορυφή**, datum, projector, NaN, κλειστός βρόχος), και **test στη ΡΑΦΗ**
  `TopoAutoBreaklinePreviewOverlay.test.tsx` (5) — **επαληθεύτηκε ότι πέφτει κόκκινο** με την
  εστίαση ξαναβγαλμένη (3/5 fail), αλλιώς θα ήταν διακοσμητικό. `jscpd --diff`: καθαρό σε 3 γύρους
  (panels/converters · scene layers vs τα αδέλφια τους · tests μεταξύ τους).

- **v20 (2026-07-27) — M10e BLUEPRINT: αυτόματη ταύτιση σχεδίου ↔ τοπογραφικού (blind point-set registration).**
  **Status: BLUEPRINT — καμία γραμμή κώδικα δεν γράφτηκε.** Εντολή Giorgio: «μόνο το σχέδιο».
  Ονομασία **M10e** (όχι M11): το `M11` είναι δεσμευμένο στο **ADR-656** (κάναβος ΕΓΣΑ87) και είναι
  επίσης topo· το M10e συνεχίζει σωστά τη σειρά geo-referencing M10 → M10b → M10c → M10d.

  ### Αφορμή (πραγματικό περιστατικό, 2026-07-27)
  Ο Giorgio ζήτησε αυτόματη ταύτιση του DXF τοπογραφικού με το τοπογραφικό που παράγεται από
  εισαγωγή κορυφών CSV/TXT, με το σκεπτικό «οι τοπογράφοι μετακινούν το σχέδιο στο CAD για ευκολία
  και τα δύο αρχεία δεν ταυτίζονται».

  ### ΜΕΤΡΗΜΕΝΟ GROUND TRUTH — η υπόθεση ήταν λάθος
  Αρχεία: `47_ergasia.dxf` (1.24 MB) + `EYOSMOS47_shm (1).csv` (**93 γραμμές**, delimiter `;`, ΕΓΣΑ87).
  - 🔴 **ΔΙΟΡΘΩΣΗ 93 → 33 (2026-07-27, ξαναμετρημένο στο ίδιο το αρχείο).** Οι **93** είναι *γραμμές*,
    **ΟΧΙ** εισαγώγιμα σημεία. Μόνο **33** από αυτές έχουν υψόμετρο στην 4η στήλη· οι άλλες **60** την
    έχουν **κενή** (π.χ. `1; 407711.138; 4502389.335;`). Ο importer απαιτεί **και τα τρία** X/Y/Z —
    `mapRowToPoint` (`topo-column-mapping.ts`) κάνει `if (x === null || y === null || z === null) return null`
    και η γραμμή πάει στο `skipped`. **Άρα η σωστή προσδοκία εισαγωγής αυτού του CSV είναι 33 σημεία,
    όχι 93.** Όποιος δει «33/93 εισήχθησαν» **δεν** έχει βρει bug — έχει βρει το αρχείο.
  - ⚠️ Ο ίδιος αριθμός εμφανίζεται και από την πλευρά του DXF (**33 από τα 93** σημεία με πραγματικό
    υψόμετρο ζουν στο `VT_ELEV`, ενώ το `VT_POINT` έχει `Z = 0`) — **δύο ανεξάρτητες όψεις της ίδιας
    πραγματικότητας**: το τοπογραφικό μετρήθηκε με υψόμετρο σε 33 σημεία. Μην «διορθώσεις» κανένα από
    τα δύο ώστε να βγει 93.
  - **93/93 CSV σημεία βρέθηκαν μέσα στα DXF `POINT` entities με ακρίβεια < 1 mm** (median απόσταση
    0.0000). Τα δύο αρχεία **ήδη ταυτίζονται bit-perfect στον δίσκο**.
  - Layers: `Point_Tax_2019`=284, `VT_POINT`=156, `VT_ELEV`=41, `Defpoints`=27, `Survey`=14,
    `VT_STASH`/`VT_ELEV_STASH`=10, `kryfo`=9, `dianomi_YG`=2 (σύνολο 562 POINT· 242 LWPOLYLINE· 1127 TEXT).
  - **Και τα 93 CSV σημεία ζουν στο `VT_POINT`.** ⚠️ **Το `VT_POINT` έχει `Z = 0`** — τα πραγματικά
    υψόμετρα ζουν σε **διπλότυπα** σημεία στο `VT_ELEV` (33 από τα 93). Όποιος consumer διαβάσει το
    `VT_POINT` παίρνει **επίπεδο** τοπογραφικό. **Ανοιχτό, χωριστό από το M10e.**
  - 52 `TEXT` entities έχουν περιεχόμενο **ακριβώς το CSV id** τους εντός 2 m — υπάρχει **δεύτερο
    κανάλι ταύτισης μέσω αρίθμησης**, αναξιοποίητο (open item).
  - 🔴 **ΔΙΟΡΘΩΣΗ 2026-07-27 — το «100% από CSV κορυφές» ΔΕΝ ταυτοποιεί το οικόπεδο.**
    Ο παλιός ισχυρισμός εδώ («το οικόπεδο = `pl` 89.70 m², κορυφές `49-53-54-55-56-57-65-70-52-50`,
    ταυτόσημο με το `bld`») ήταν **λάθος ταυτοποίηση**. Το 89.70 m² υπάρχει σε **δύο** layers,
    `pl` **και `bld`** — και το `bld` = *building*: είναι το **ΚΤΙΣΜΑ**, και οι **10/10** κορυφές του
    βρίσκονται **εντός** του πραγματικού ορίου. Το κριτήριο «όλες οι κορυφές είναι μετρημένα σημεία»
    επιλέγει ό,τι ο τοπογράφος **ταχυμέτρησε γωνία-γωνία** (ένα κτίσμα), όχι ό,τι είναι **όριο ιδιοκτησίας**.
  - **Το οικόπεδο είναι το layer `Orio`: 9 κορυφές, 223.06 m², περίμετρος 61.39 m.** Δεν χρειάζεται
    συμπερασμός — ο τοπογράφος το **δηλώνει** ρητά: το DXF περιέχει layer `Pinakas-Syntetagmenon`
    (613 entities) με «*Πίνακας Συντεταγμένων των κορυφών του Α,Β,Γ,Δ,Ε,Ζ,Η,Θ,Ι,Α*» και
    «*Εμβαδόν τεμαχίου = 223.06 τ.μ. - Περίμετρος = 61.39 μ.*». Οι 9 κορυφές του πίνακα ταυτίζονται
    **ακριβώς** με το `LWPOLYLINE` του `Orio`, και το ανεξάρτητα υπολογισμένο εμβαδόν/περίμετρος
    (223.058 m² / 61.390 m) συμφωνούν στο δεκαδικό. Ο ίδιος πίνακας υπάρχει **τέσσερις** φορές —
    ένας ανά όμορο τεμάχιο (223.06 / 209.79 / 374.87 / 797.30 τ.μ.), γι' αυτό το CSV καλύπτει
    πολύ μεγαλύτερη έκταση από το οικόπεδο.
  - **Μόνο 7 από τις 9 κορυφές του ορίου είναι στο CSV** (ids `52,70,68,67,71,72,74`, απόκλιση < 1 nm).
    Οι δύο άλλες (Α `407731.13/4502392.59`, Ι `407733.52/4502404.58`) **δεν ταχυμετρήθηκαν** —
    προκύπτουν από τα layers `KTIMATOOGIO` / `Periferia_Kentrikis_Makedonias_20251125` (σε 0.03 και
    0.11 m αντίστοιχα) και φέρουν δικό τους `CIRCLE r=0.25` σύμβολο κορυφής. **Άρα το CSV από μόνο του
    ΔΕΝ αρκεί για να αναπαραχθεί το όριο** — καμία απόπειρα ταυτοποίησης «100% από CSV» δεν θα το βρει ποτέ.
  - ⚠️ **Το DXF είναι UTF-8 παρά το `$DWGCODEPAGE = ANSI_1253`.** Ανάγνωση κατά τη δηλωμένη κωδικοσελίδα
    δίνει mojibake σε ΚΑΘΕ ελληνικό layer name και σε ΟΛΟΝ τον πίνακα συντεταγμένων — δηλαδή κρύβει
    ακριβώς την πληροφορία που ταυτοποιεί το οικόπεδο. Η δήλωση της κεφαλίδας **δεν είναι αξιόπιστη**.
  - Το layer `pl` έχει **28** κλειστές πολυγραμμές (γειτονικά οικόπεδα/ΚΤΗΜΑΤΟΛΟΓΙΟ).
  - Μόνο **2** POINT σε τοπικές συντεταγμένες (`dianomi_YG`, X≈−13.127) — τα «μεικτά συστήματα»
    υπάρχουν αλλά είναι **αμελητέα εδώ· ΔΕΝ είναι η αιτία**.

  ### ΑΙΤΙΑ — επαληθευμένη στον κώδικα, όχι υπόθεση
  **Το πρόβλημα είναι της εφαρμογής, 100%.** Το DXF import καταστρέφει τη γεωαναφορά:
  - `systems/zoom/utils/bounds-entity.ts:304-312` — `offsetX = -bounds.minX; offsetY = -bounds.minY;`
    → `normalizeEntityPositions(...)` μετακινεί **in-place** όλα τα entities στο (0,0) και επιστρέφει
    bounds που ξεκινούν από το μηδέν. **Το `(minX, minY)` είναι τοπική μεταβλητή και δεν επιστρέφεται
    ποτέ.** Η μετατόπιση των ~4.077e8 / 4.5024e9 mm χάνεται **μόνιμα**.
  - Και τα δύο import paths το εκτελούν: `io/dxf-import.ts:175` (worker, `calculateTightBounds(…, true)`)
    και `io/dxf-import.ts:236` (direct, `normalizeBounds: true`).
  - `types/scene-types.ts:164-216` — `SceneModel`/`DxfImportResult` **δεν έχουν κανένα πεδίο origin/offset**.
  - Αντίθετα το CSV μονοπάτι **δεν κανονικοποιείται**: `topo-column-mapping.ts:100-117` κάνει μόνο
    `× TOPO_UNIT_SCALE_TO_MM` και γράφει **απόλυτα ΕΓΣΑ mm** στο `TopoPointStore.setTopoPoints`.
  - Η μόνη γέφυρα, το geo-reference, είναι **identity μέχρι να το ορίσει ο χρήστης**
    (`geo-transform.ts:53-66` → `regenerate-topo.ts:93-94` early-return). Αποτέλεσμα: DXF γύρω από το
    (0,0), τοπογραφικό στα ~4.5e9 mm — απόσταση ~4.500 km, **και εκτός του culling ±1e6 του ADR-635**.
  - Ο μόνος σημερινός αυτόματος μηχανισμός, `geo-auto-align.ts:44-58`, είναι **translation-only robust
    center** και τρέφεται από `sceneEntityCenters` (`geo-ref-scene-points.ts:22-30`) = **bbox centers
    ανά entity, ΟΧΙ κορυφές τοπογράφου**. Χωρίς στροφή, χωρίς καμία επαλήθευση.

  ### ⚠️ ΔΕΥΤΕΡΗ ΕΠΑΛΗΘΕΥΜΕΝΗ ΠΑΓΙΔΑ — σιωπηλό whitelist
  `services/dxf-scene-json.ts:46-51` χτίζει το scene με **χειροκίνητο whitelist 4 πεδίων**
  (`entities / layersById / bounds / units`). **Κάθε νέο πεδίο γράφεται σωστά και εξαφανίζεται
  σιωπηλά στο reload** — μηδενικό type error, το βλέπει μόνο ο χρήστης. Το write side είναι ασφαλές
  (`JSON.stringify(scene)`, `dxf-firestore-storage.impl.ts:169`). Ίδιο μοτίβο με το ADR-650 M5α.2
  («χειροκίνητη λίστα props σε κοινό layer = σιωπηλό drop»).

  ### ΣΧΕΔΙΟ — δύο σκέλη, ένας βαθμολογητής
  Και τα δύο σκέλη παράγουν το **υπάρχον** `GeoReference{originWorld, rotationDeg}` και γράφουν μέσω
  του **υπάρχοντος** `setGeoReference` + `persistProjectGeoReference` → `Project.basePoint`/`northRotation`.
  **Καμία νέα διαδρομή αποθήκευσης, κανένα παράλληλο μοντέλο, κανένα πεδίο scale.**

  **Σκέλος Α — σταματάμε την απώλεια (αναλυτικό, μηδέν heuristic).** Το import καταγράφει το offset
  που **ήδη υπολογίζει**: `SceneModel.sourceOrigin`, συμβόλαιο **`world_αρχείου = local + sourceOrigin`**
  (canonical mm). Τότε `geo = {originWorld: sourceOrigin, rotationDeg: 0}` επαναφέρει **ακριβώς** τις
  συντεταγμένες του αρχείου, με μηδενικό υπόλοιπο. Αυτό μόνο του λύνει την περίπτωση του Giorgio.

  **Σκέλος Β — μετακινημένο/στραμμένο DXF, χωρίς γνωστές αντιστοιχίες.** Εξαγωγή υποψηφίων ανά layer →
  διαχωρισμός coordinate-frame clusters → **RANSAC σε ζεύγη σημείων με αναλλοίωτη την απόσταση** →
  refine με **Umeyama/Kabsch** στους inliers.

  **Ροή:** `identity-restore` → `already-aligned` → per-cluster `ransac` → `unit-mismatch` → `needs-manual`.

  **Πύλες αποδοχής (ΣΥΜΒΟΛΑΙΟ — μη χαλαρώσεις κατώφλι για να γίνει πράσινο):**
  `inliers ≥ max(8, 30% του συνόλου)` **ΚΑΙ** `RMS ≤ 50 mm` **ΚΑΙ** uniqueness
  (`best.inliers ≥ 1.5 × secondBest` ή ταύτιση των δύο εντός 1 mm / 0,01°).
  **Ποτέ auto-apply** — το UI δείχνει απόδειξη (μέθοδος, layer, inliers/σύνολο, RMS σε cm, στροφή,
  κλίμακα) και ο μηχανικός πατά «Εφαρμογή».

  ### Δέκα βήματα υλοποίησης
  | # | Τι | Αρχεία |
  |---|-----|--------|
  | 1 | **Η ρίζα**: `normalizeEntitiesToOrigin()` επιστρέφει `sourceOrigin`· `calculateTightBounds` **delegates** (N.18)· `+readonly sourceOrigin?: Point2D` σε `SceneModel`+`DxfImportResult`· **ΥΠΟΧΡΕΩΤΙΚΟ** το πεδίο στο whitelist | `bounds-entity.ts` (304-319), `scene-types.ts` (164-216), `dxf-import.ts` (175, 236), `run-dxf-parse.ts` (34-77), **`dxf-scene-json.ts` (46-51)** |
  | 2 | Υποψήφια σημεία ανά layer (POINT/INSERT/vertices)· cap 20k με **ντετερμινιστικό stride**, όχι `Math.random` | **ΝΕΟ** `geo-ref-candidate-points.ts` |
  | 3 | `splitByCoordinateFrame()` — σπάσιμο όπου κενό > `max(1 km, 50×MAD)`· **boy-scout**: `median`/`mad` βγαίνουν σε `robust-stats.ts` | **ΝΕΟ** `geo-point-clusters.ts`, **ΝΕΟ** `zoom/utils/robust-stats.ts`, `robust-bounds.ts` (53-64) |
  | 4 | `solveSimilarity2D` / `solveRigid2D` κλειστού τύπου· `toGeoReference()` 1:1 με `localToWorld` | **ΝΕΟ** `geo-similarity-solve.ts` |
  | 5 | **Ο ΕΠΑΛΗΘΕΥΤΗΣ**: uniform grid + `scoreGeoReference()` — μία μονάδα μέτρησης για Α **και** Β | **ΝΕΟ** `geo-point-index.ts` |
  | 6 | Pair table σε αποστάσεις (invariant) + RANSAC με **seeded mulberry32**· καλεί το **ΥΠΑΡΧΟΝ** `fromTwoPointPairs` | **ΝΕΟ** `geo-pair-table.ts`, `geo-ransac-match.ts` |
  | 7 | Orchestrator `autoMatchToSurvey()` + πύλες + `GeoMatchMethod` | **ΝΕΟ** `geo-auto-match.ts`, `index.ts` |
  | 8 | UI «Αυτόματη ταύτιση» + κάρτα απόδειξης (semantic `<section>`/`<dl>`)· i18n **el+en ΠΡΙΝ** τον κώδικα | `TopoGeoReferenceSection.tsx` (223 γρ. — η κάρτα **χωριστό αρχείο**), **ΝΕΟ** `TopoGeoMatchResultCard.tsx`, `dxf-viewer-panels.json` ×2 |
  | 9 | Tests: Umeyama exact · identity-restore 93/93 · blind θ=37,4° +θόρυβος+decoys · μεικτά clusters · unit-mismatch · **ψευδώς θετικό ⇒ `needs-manual`** · **round-trip `sourceOrigin`** | **ΝΕΟ** `__tests__/` ×3 |
  | 10 | ADR-650 §M10e (αυτό) + M10 pointer· **ADR-635/ADR-369 changelog ΜΟΝΟ όταν γραφτεί ο κώδικας** | αυτό το αρχείο |

  ### SSoT — τι επαναχρησιμοποιείται αυτούσιο
  `GeoReference` (geo-transform.ts:47-50) · **`fromTwoPointPairs` (156-176) = ήδη ο rigid solver 2
  αντιστοιχιών** — ο RANSAC τον καλεί αντί να ξαναγράψει atan2+normalise (αλλιώς sibling clone, N.18) ·
  `fromOnePointPair` (140-145) — το identity-restore είναι κυριολεκτικά `fromOnePointPair({0,0}, sourceOrigin)` ·
  `localToWorld` (69-77) — ο μόνος τρόπος προβολής · `setGeoReference` + `persistProjectGeoReference` ·
  `computeRobustCenter` · `TopoPointStore.getTopoState().surfaces.existing.points` ·
  `resolveImportSourceUnits`/`unitsOverride` (η **υπάρχουσα** διέξοδος για unit-mismatch).
  **Το rendering path δεν αγγίζεται καθόλου**: μόλις γραφτεί το geo, ισοϋψείς + 3D έδαφος + point
  cloud κουμπώνουν μόνα τους.

  ### Απαγορεύσεις
  - **ΠΟΤΕ scale στο `GeoReference`** — θα παραμόρφωνε το κτίριο (geo-transform.ts:7-8, δόγμα
    Revit/Civil 3D). Το `scaleEstimate` είναι **μόνο διαγνωστικό**· αν `|s−1| > 0,002` → `unit-mismatch`
    + προτεινόμενη μονάδα (1000 / 304,8 / 25,4 / 10) και **κανένα geo**.
  - **ΠΟΤΕ μετακίνηση των DXF entities στο ΕΓΣΑ** — θα έσκαγε το culling ±1e6 (ADR-635). Διατηρείται
    η φορά **world→local** του `regenerate-topo.ts:90-99`.
  - **ΠΟΤΕ `Math.random`** στο RANSAC — flaky tests, διαφορετικό αποτέλεσμα ανά κλικ.

  ### Ρίσκα
  1. **Το whitelist** (§ παραπάνω) — χωρίς το βήμα 1 στο `dxf-scene-json.ts` όλο το σκέλος Α είναι
     **διακοσμητικό**. Φράχτης: round-trip test (9ζ).
  2. **Ψευδώς θετική ταύτιση** — 93 σχεδόν-συγγραμμικά ή κανναβωτά σημεία «ταιριάζουν» σε στροφή
     90°/180°. Μετριασμός: πύλες + υποχρεωτική ανθρώπινη «Εφαρμογή». Test (στ) το φυλάει.
  3. **🔴 Τα ήδη αποθηκευμένα DXF έχουν χάσει το offset για πάντα** — δεν ανακτάται. Η ακριβής λύση
     ισχύει **από το επόμενο import**· τα υπάρχοντα θέλουν **re-import** ή πέφτουν στο RANSAC (heuristic).
  4. Απόδοση σε point cloud (2M σημεία × pair table) — cap 20k + ζώνη αποδοχής αποστάσεων. Στο
     πραγματικό αρχείο (562 × 93) ο χρόνος είναι **μονοψήφια ms** — δεν χρειάζεται worker.
  5. Pre-commit: N.11 (κλειδιά `topography.geoRef.match.*` σε **el+en πριν** τον κώδικα· ωμά ελληνικά
     σε JSX **δεν** πιάνονται από κανέναν scanner — μόνο pseudo locale, ADR-666) · N.7.1 (χωριστό
     αρχείο για την κάρτα) · **N.18 `jscpd:diff`** στα 6 νέα modules (point-index/pair-table/ransac
     έχουν υψηλό ρίσκο sibling clone μεταξύ τους — 2-3 γύροι φυσιολογικοί) · N.17 (κανένα tsc).
  6. **Το M10e είναι αυστηρά επίπεδο (planimetric).** Κατακόρυφη ταύτιση / vertical datum (ADR-713)
     **δεν καλύπτεται**.
  7. Boy scout: τα temp diagnostics στο `regenerate-topo.ts:109-111, 145-150` («REMOVE after fix»,
     2026-07-15) τυπώνουν ακόμη σε κάθε load — καθάρισέ τα στο ίδιο commit, μην τα αντιγράψεις.

  ### Ανοιχτά (εκτός M10e)
  - **`VT_POINT` Z = 0 vs `VT_ELEV`** — επίπεδο τοπογραφικό αν διαβαστεί το λάθος layer. Χωριστή δουλειά.
  - **Ταύτιση μέσω αρίθμησης** (52 TEXT = CSV id) — τρίτο, ντετερμινιστικό κανάλι που θα έκανε το
    RANSAC περιττό όταν υπάρχουν ετικέτες.

  **Status: M10e — BLUEPRINT (v20). Υλοποιήθηκε στο v21 παρακάτω — διάβασε ΚΑΙ τα δύο: το v21
  ανατρέπει 5 σημεία αυτού του σχεδίου.**

- **v21 (2026-07-27) — M10e IMPLEMENTED: η αυτόματη ταύτιση, με τέσσερα κανάλια και ένα συμβόλαιο.**
  **Status: ΥΛΟΠΟΙΗΜΕΝΟ & ΠΡΑΣΙΝΟ** — 83/83 στο `systems/geo-referencing`, 398/398 μαζί με
  `systems/topography`. `jscpd:diff` καθαρό στα 7 νέα modules **και** στα δύο ζεύγη υψηλού
  κινδύνου που εντόπισε ο SSoT audit.
  ⚠️ **Δεν έχει γίνει επαλήθευση σε browser** — τα tests αποδεικνύουν τον αλγόριθμο, όχι το
  κούμπωμα του UI. Θέλει δοκιμή με `47_ergasia.dxf` + `EYOSMOS47_shm.csv`.

  ### Τα modules (όλα pure: μηδέν React/DOM/store, μηδέν τυχαιότητα)
  | Αρχείο | Ρόλος |
  |---|---|
  | `core/spatial/PointHashGrid.ts` | Ο SSoT uniform hash (ήταν το **6ο** χειρόγραφο grid → κεντρικοποιήθηκε) |
  | `geo-similarity-solve.ts` | Umeyama/Kabsch κλειστού τύπου· το scale **υπολογίζεται και ΔΕΝ εφαρμόζεται ΠΟΤΕ** |
  | `geo-point-index.ts` | **Ο ΕΠΑΛΗΘΕΥΤΗΣ** — μία μονάδα μέτρησης για όλα τα κανάλια· κανόνας 1-προς-1 |
  | `geo-ref-candidate-points.ts` | Σταθερά χαρακτηριστικά σημεία σχεδίου· cap με **προτεραιότητα είδους**, μετά ντετερμινιστικό stride |
  | `geo-point-clusters.ts` | Διαχωρισμός coordinate frames — single-linkage, κατώφλι `max(1 km, 50×MAD)` |
  | `geo-point-number-match.ts` | **Το κανάλι αρίθμησης** + robust refit (απόρριψη χονδροειδών με median/MAD) |
  | `geo-pair-table.ts` | Ο πίνακας αναλλοίωτων αποστάσεων + επιλογή βάσεων |
  | `geo-congruent-match.ts` | Ντετερμινιστική απαρίθμηση συμμόρφων βάσεων |
  | `geo-match-gates.ts` | **Το συμβόλαιο αποδοχής, σε ξεχωριστό αρχείο** (βλ. γιατί, παρακάτω) |
  | `geo-auto-match.ts` | Ο orchestrator — `autoMatchToSurvey()` |
  | `TopoGeoMatchResultCard.tsx` | Η κάρτα απόδειξης (semantic `<section>`/`<dl>`) |

  ### 🔴 ΠΕΝΤΕ ΣΗΜΕΙΑ ΟΠΟΥ ΤΟ v20 ΗΤΑΝ ΛΑΘΟΣ (μη τα «ανακαλύψεις» ξανά)

  1. **ΟΧΙ RANSAC.** Το v20 έλεγε «RANSAC με seeded mulberry32». Η έρευνα (4PCS/Super4PCS,
     TEASER++, astrometry.net) δείχνει ότι η δειγματοληψία έχει εγκαταλειφθεί: **απαριθμείς**
     τις συμβατές βάσεις. Στα μεγέθη μας (93 σημεία → 4.278 αποστάσεις) η εξαντλητική
     απαρίθμηση είναι **και** γρήγορη **και** πλήρης — δεν υπάρχει «άτυχος σπόρος» που να χάνει
     πραγματική ταύτιση. Επιπλέον τα 4PCS χρησιμοποιούν **4** συνεπίπεδα σημεία επειδή λύνουν
     **3Δ με άγνωστη κλίμακα** (μόνο ένας **λόγος** είναι αναλλοίωτος). Σε **2Δ rigid με γνωστή
     κλίμακα** μία **απόσταση** είναι ήδη πλήρης αναλλοίωτη και **2** αντιστοιχίες ορίζουν το
     transform ακριβώς. Ίδια ιδέα, σωστή ελάχιστη μορφή. Αρχείο: `geo-congruent-match.ts`.
  2. **Κάθε βάση δοκιμάζεται σε ΔΥΟ σειρές** (A→A′,B→B′ **και** A→B′,B→A′). Το v20 δεν το
     ανέφερε· χωρίς αυτό ο μισός χώρος λύσεων μένει σιωπηλά ανεξερεύνητος.
  3. **Ο παρονομαστής της πύλης πλήθους ήταν ΑΔΥΝΑΤΟΣ.** Το v20 έλεγε «inliers ≥ 30% **του
     συνόλου**». Ο κανόνας 1-προς-1 όμως καπελώνει τους inliers στο **μικρότερο** από τα δύο
     σύνολα: 1.500 σημεία σχεδίου × 93 σημεία τοπογραφικού ⇒ ζητούσε **450 από 93 δυνατούς** —
     πύλη που **καμία σωστή ταύτιση δεν μπορούσε να περάσει**. Ο τίμιος παρονομαστής είναι
     `min(|σχέδιο|, |τοπογραφικό|)`. **Δεν χαλάρωσε κατώφλι — ορίστηκε.** (`matchableTotal`)
  4. **Η πύλη μοναδικότητας ήταν σπασμένη με «1 mm / 0,01°».** Με 5 mm θόρυβο, η **ίδια**
     απάντηση από **διαφορετική βάση** διαφέρει κατά χιλιοστά και μετριόταν ως **αντίπαλη** —
     άρα η πύλη απέρριπτε ακριβώς τις **καλύτερα τεκμηριωμένες** ταυτίσεις. Επιπλέον το «0,01°»
     είναι εξαρτώμενο από κλίμακα (0,01° στα 100 m = 17 mm). Πλέον δύο references είναι «ίδια
     απάντηση» αν **τοποθετούν το σχέδιο στο ίδιο σημείο**: εφαρμόζονται και οι δύο (μέσω του
     SSoT `localToWorld`) στο origin και σε ένα **απομακρυσμένο probe** και συγκρίνονται με την
     **ίδια ανοχή** που δέχεται σημείο ο επαληθευτής. Επαληθευμένο: ο συμμετρικός κάνναβος 9×9
     (4 αυτο-ταυτίσεις) πέφτει σωστά σε `needs-manual`.
  5. **Το κανάλι αρίθμησης χρειάστηκε robust refit.** Η ετικέτα είναι **σχεδιαστική**: κάθεται
     δίπλα στο σημείο της. Όπου δύο σημεία τοπογραφικού είναι πιο κοντά μεταξύ τους απ' ό,τι η
     ετικέτα στο δικό της, το snap παίρνει τον **γείτονα** — και **ένα** τέτοιο χονδροειδές
     σφάλμα έσερνε το least-squares κατά **416 mm** (μετρημένο). Το least-squares δεν έχει καμία
     άμυνα απέναντι σε gross error· το **κατανέμει** σε όλες τις αντιστοιχίες. Λύση: το fit
     αστυνομεύει τις εισόδους του — υπόλοιπα εκτός `median + 4·MAD` απορρίπτονται (με **δάπεδο**
     250 mm ώστε ένα τέλειο fit να μην πετάει ζεύγη για float θόρυβο) και το fit επαναλαμβάνεται.
     Δύο περάσματα. Πάγια πρακτική blunder detection της γεωδαισίας. Τα απορριφθέντα
     **αναφέρονται** (`rejected`), δεν εξαφανίζονται.

  ### ΔΥΟ ΚΕΝΑ ΠΟΥ ΒΡΕΘΗΚΑΝ ΣΕ ΑΥΤΟ-ΕΛΕΓΧΟ (μετά τα πρώτα «πράσινα»)
  Και τα δύο ήταν κώδικας που **φαινόταν** να δουλεύει και δεν δούλευε — τα tests ήταν πράσινα.

  6. **Το `failure` ήταν ΝΕΚΡΟ ΠΕΔΙΟ.** Δηλωμένο, τεκμηριωμένο («ποια πύλη αρνήθηκε»), **ποτέ
     γεμισμένο** — ο χρήστης έπαιρνε «δεν βρέθηκε ταύτιση» αντί για «12 σημεία ενώ χρειάζονται
     28». Ίδιο μοτίβο με το `reference_optional_callback_silently_disables_feature`. Πλέον
     καταγράφεται μέσω `FailureLog` **μόνο** για υποψηφίους που **προσγείωσαν** τουλάχιστον ένα
     σημείο: ένα κλάδος με 0 inliers δεν «απέτυχε σε πύλη», απλώς **δεν εφαρμόζεται**, και το να
     αναφερθεί η ετυμηγορία του θα ήταν **θόρυβος ντυμένος διάγνωση**. Το UI δείχνει τους αριθμούς.
  7. **🔴 Ο τυφλός έλεγχος είναι ΔΟΜΙΚΑ ΤΥΦΛΟΣ σε μεγάλη διαφορά μονάδων.** Το `congruent-pairs`
     ταιριάζει με αναλλοίωτη την **απόσταση**: στο 1000× **κανένα** τμήμα σχεδίου δεν έχει
     αντίστοιχο μήκος, άρα **καμία υπόθεση δεν σχηματίζεται** και το `scaleEstimate` **δεν
     υπολογίζεται ποτέ**. Ο έλεγχος `isUnitMismatch` μέσα στην αναζήτηση πιάνει μόνο **μικρά**
     σφάλματα (fit που βγήκε 1,003). Συνέπεια: σχέδιο σε μέτρα διαβασμένο ως χιλιοστά **χωρίς
     ετικέτες** έβγαζε «δεν βρέθηκε ταύτιση» — αληθές και άχρηστο. Το κανάλι **αρίθμησης** δεν
     έχει το πρόβλημα (ταιριάζει με **ταυτότητα**, μετρά την κλίμακα όσο μεγάλη κι αν είναι).
     **Λύση — `explainAsUnitMismatch`, τελευταία καταφυγή**: σύγκριση των δύο **εκτάσεων**.
     Συντηρητικό σε τρία σημεία: τρέχει **μόνο αφού όλα έχουν αποτύχει** (ποτέ δεν παρακάμπτει
     πραγματική ταύτιση)· ενεργοποιείται μόνο αν ο λόγος είναι **αναγνωρίσιμη** μονάδα εντός
     **0,5 %** (όχι απλώς «μεγάλος»)· παράγει **μήνυμα**, ποτέ μετασχηματισμό. Φράχτης: test που
     απαιτεί δύο **άσχετα** αρχεία διαφορετικού μεγέθους να μένουν `needs-manual`.

  ### SSoT audit — τι βρέθηκε ΕΠΙΠΛΕΟΝ του v20 (6 ευρήματα, grep σε ΟΛΟ το `src/`)
  - **`TopoPoint.pointNumber` ΥΠΗΡΧΕ ΗΔΗ** (`topo-types.ts`, ADR-656 M10) — η CSV πλευρά του
    καναλιού αρίθμησης ήταν **ήδη γραμμένη**. Το v20 σχεδίαζε νέο μοντέλο ταυτότητας· περιττό.
  - **`entityToPolylines`** (`rendering/entities/shared/entity-polylines.ts`, ADR-652 M4) =
    ο SSoT «οντότητα → **σχήμα**». **ΔΕΝ επαναχρησιμοποιείται, με λόγο**: επιστρέφει `[]` για
    `point` (η κύρια πηγή μας) και **tessellate-άρει** τόξα/κύκλους/splines — θα έχωνε εκατοντάδες
    συνθετικά σημεία που δεν αντιστοιχούν σε καμία κορυφή και αλλάζουν με το `arcSegmentDeg`.
    Άλλη ερώτηση («περίγραμμα» vs «σταθερά χαρακτηριστικά σημεία»). Επαληθευμένο μη-clone.
  - **`clusterElevations`** (`bim/structural/analytical/analytical-node-merge.ts`) = υπάρχον 1Δ
    greedy clustering, ο κοντινότερος sibling-clone κίνδυνος. **Διαφορετικός κανόνας σύνδεσης**:
    φραγμένη **διάμετρος** με **σταθερή** ανοχή (μια στάθμη δεν πρέπει να παρασυρθεί) vs.
    single-linkage με **προσαρμοστικό** κατώφλι (ένα frame τοπογραφικού είναι αυθαίρετα πλατύ και
    δεν πρέπει να κοπεί). Ενοποίηση θα **μετακινούσε στάθμες** στο structural. Επαληθευμένο μη-clone.
  - **`extractTopoPointsFromDxf`** (`topography/topo-dxf-points.ts`) — υπάρχει, αλλά διαβάζει
    **ωμό DXF κείμενο** για group code 30· εμείς δουλεύουμε στη **σκηνή**. Το σχόλιό του
    επιβεβαιώνει το ρίσκο: **το `PointEntity` της σκηνής δεν έχει Z καθόλου** ⇒ το M10e είναι
    ορθώς αυστηρά planimetric.
  - **Κανένα binary-search / sorted-range SSoT σε όλο το `src/`** (κάθε `bisect*` είναι διχοτόμος
    γωνίας ή bezier). Και δεν χρειάστηκε: με **δώδεκα** ερωτήματα πάνω σε ~10⁵ γραμμές, μια
    **γραμμική σάρωση** κοστίζει λιγότερο από την ταξινόμηση που θα την επιτάχυνε.
  - **`detectClusters`** (`geo-canvas/.../control-point-geometry.ts`) — ίδια οικογένεια με το ήδη
    απορριφθέν `transformation-calculator.ts`. Απορρίπτεται (O(n²), string ids, άλλο subapp).

  ### Γιατί το συμβόλαιο ζει σε **δικό του αρχείο** (`geo-match-gates.ts`)
  Ένα κατώφλι που ζει μέσα στον κώδικα που θέλει να το περάσει, **χαλαρώνει** — λίγο, για καλό
  λόγο, για να γίνει ένα test πράσινο — και κανείς δεν προσέχει ότι το εργαλείο σερβίρει πλέον
  εικασίες ως απαντήσεις. Χωριστό, ανεξάρτητα ελεγμένο αρχείο ⇒ η αλλαγή του είναι **ορατή πράξη**.

  ### Απαγορεύσεις που ΤΗΡΗΘΗΚΑΝ (επαληθεύσιμα στον κώδικα)
  1. **Καμία κλίμακα στο `GeoReference`** — το `scaleEstimate` είναι μόνο διαγνωστικό·
     `|s−1| > 0,002` ⇒ `unit-mismatch` + προτεινόμενη μονάδα και **κανένα geo**.
  2. **Καμία μετακίνηση entities στο ΕΓΣΑ** — η φορά μένει world→local (ADR-635 culling ±1e6).
  3. **Κανένα `Math.random`** — και ούτε καν seeded· η απαρίθμηση είναι εξαντλητική.
  4. **Κανένα auto-apply** — το `autoMatchToSurvey()` επιστρέφει **πρόταση**· ο μηχανικός πατά
     «Εφαρμογή» αφού δει την κάρτα απόδειξης.

  ### Ανοιχτά (αμετάβλητα από v20)
  - **🔴 Τα ήδη αποθηκευμένα DXF έχουν χάσει το offset ΟΡΙΣΤΙΚΑ** — θέλουν **re-import**, αλλιώς
    πέφτουν στο γεωμετρικό σκέλος.
  - **`VT_POINT` Z = 0 vs `VT_ELEV`** — επίπεδο τοπογραφικό αν διαβαστεί το λάθος layer.
  - Κατακόρυφη ταύτιση / vertical datum (ADR-713) **εκτός σκοπού**.

  **Status: M10e — IMPLEMENTED & GREEN.**

- **v22 (2026-07-27) — M10e ΚΛΕΙΣΙΜΟ, μέρος Α: ένα false positive που έλεγε ψέματα με σιγουριά,
  και ο πρώτος πραγματικός αριθμός απόδοσης.**
  **87/87** στο `systems/geo-referencing` (ήταν 83· +2 acceptance, +2 perf), **497/497** μαζί με
  `services/clip` + `bim/hatch` + `systems/topography`. `jscpd:diff` καθαρό στα 5 αρχεία.

  ### 8. 🔴 Το `explainAsUnitMismatch` μετρούσε το ΚΕΝΟ ΑΝΑΜΕΣΑ στα coordinate frames
  Το v21 μετρούσε την έκταση του σχεδίου σε **όλα** τα υποψήφια σημεία (`ctx.allXY`). Ένα DXF
  όμως κουβαλά κατά κανόνα λεζάντα / λεπτομέρεια / επικολλημένη γεωμετρία **χιλιόμετρα** μακριά,
  και τότε το bounding box κυριαρχείται από το **κενό ανάμεσα στα frames** — που δεν είναι το
  μέγεθος τίποτα. Το v21 το κατέγραψε ως υποψία («δεν σκάει σήμερα»). **Σκάει, και προς τις δύο
  κατευθύνσεις** — και τα δύο είναι πλέον κόκκινα-πριν / πράσινα-μετά tests:
  - **Σιωπή σε πραγματική αστοχία**: σχέδιο σε mm + τοπογραφικό που εισήχθη χωρίς τη μετατροπή
    m→mm. Ο τίμιος λόγος 1/1000 διαβάζεται ως **1e-4**, που δεν είναι καμία μονάδα ⇒ ο μηχανικός
    παίρνει «δεν βρέθηκε ταύτιση» αντί για «οι μονάδες σου διαφέρουν κατά 1000».
  - **🔴 Ομιλία σε αρχεία που απλώς δεν ταιριάζουν** — το σοβαρό. Δύο **άσχετα** αρχεία των 150 m
    και ένα inset **1,35 km** μακριά αρκούν ώστε ο λόγος να πέσει **ακριβώς** στο ×10: το εργαλείο
    ανακοινώνει «οι μονάδες σου διαφέρουν κατά δέκα». **Σίγουρη, εκτελέσιμη, ψεύτικη απάντηση** —
    ακριβώς η αστοχία που ολόκληρο το M10e χτίστηκε να αποφύγει.

  **Διόρθωση**: το σχέδιο είναι το **μεγαλύτερο frame** — το ίδιο, με την ίδια σειρά, που δοκίμασε
  πρώτο και η αναζήτηση. Το `splitByCoordinateFrame` καλείται **μία φορά** στο `runBranches` και
  τα frames περνούν και στους δύο καταναλωτές· δεύτερο split θα ήταν δεύτερη γνώμη για το τι
  **είναι** το σχέδιο. **Μόνο** το μεγαλύτερο: δοκιμή κάθε frame θα πολλαπλασίαζε τις ευκαιρίες να
  πέσει κανείς μέσα σε παράθυρο 0,5 % από τύχη, και αυτός ο κλάδος μιλά όταν όλοι οι άλλοι σιωπούν.
  Κανένα frame ≥3 σημεία ⇒ καμία υπερασπίσιμη έννοια «μεγέθους σχεδίου» ⇒ `needs-manual`.

  ⚠️ **Το fixture που πρότεινε το handoff ΔΕΝ θα έδειχνε το σφάλμα**: «σχέδιο σε μέτρα + inset σε
  άλλο frame». Σε σχέδιο-σε-μέτρα οι αριθμοί είναι ~150, ενώ το δάπεδο του `splitByCoordinateFrame`
  είναι **1 km = 1e6 μονάδες** ⇒ **κανένα split** ⇒ η διόρθωση δεν θα άλλαζε τίποτα. Το σφάλμα
  απαιτεί σχέδιο σε **σωστές μεγάλες μονάδες** (mm) με απομακρυσμένο frame.

  **SSoT**: το χειρόγραφο `minX = Infinity` του `extentOf` αντικαταστάθηκε από το
  `boundsOfPoints` (`services/clip/clip-geometry.ts`) — ήδη ο de-facto SSoT για «bbox λίστας
  σημείων», ήδη καταναλωνόμενο εκτός crop (`bim/hatch/hatch-area-label`). Η παράμετρός του έγινε
  `ReadonlyArray` ώστε ένας καλών με `readonly Point2D[]` να μη χρειάζεται cast.
  ⚠️ Το μοτίβο υπάρχει σε **60+ αρχεία** του `src/` — μεγάλο διπλότυπο, **όχι** αυτής της συνεδρίας
  (N.0.2 → pending-ratchet).

  ### 9. 🔴 ΜΕΤΡΗΘΗΚΕ: **6,7 s / 9,8 s** — παγωμένη καρτέλα, όχι καθυστέρηση
  Το v20 έλεγε «μονοψήφια ms — δεν χρειάζεται worker». **Αφορούσε τον RANSAC που δεν γράφτηκε
  ποτέ. Μην το επικαλείσαι.** Πρώτη πραγματική μέτρηση, στο μέγεθος του `47_ergasia.dxf`
  (562 POINT + 242 LWPOLYLINE + 1127 TEXT vs 93 σημεία CSV, αρχείο `geo-auto-match.perf.test.ts`):

  | Διαδρομή | Χρόνος |
  |---|---|
  | **FOUND** (congruent-pairs) | **6,7 s** |
  | **REFUSED** (needs-manual) | **9,8 s** |

  Ανάλυση κόστους — **μετρημένη, όχι εικασία**:

  | Στοιχείο | Κόστος |
  |---|---|
  | Υποθέσεις που βαθμολογήθηκαν | **2.456** (9 βάσεις × 1.228 σύμμορφα ζεύγη × 2 σειρές) |
  | Βαθμολόγηση **μίας** υπόθεσης έναντι 1.500 σημείων | **~3,8 ms** |
  | — εκ των οποίων grid probe | ~3 ms |
  | — εκ των οποίων `localToWorld` | ~1,3 ms → **0,08 ms** αν σηκωθεί η τριγωνομετρία έξω από τον βρόχο |
  | `buildPairTable` (1.500 σημεία → 1,12 M γραμμές) | 473 ms |

  🔴 **Αιτία, με όνομα**: το `localToWorld` υπολογίζει `cos`/`sin` **ανά σημείο** — 3,7 M φορές. Η
  **αντίστροφη** φορά έχει ήδη `worldToLocalCore` ακριβώς γι' αυτόν τον λόγο («so a hot per-vertex
  loop can compute the trig once»)· η ευθεία φορά **δεν έχει**. Ασυμμετρία, όχι φυσικό όριο.

  **Το `topography.geoRef.match.running` παραμένει νεκρό** (επαληθευμένο: μηδέν καταναλωτές σε
  el+en). **ΜΗΝ το σβήσεις ακόμη** — η απόφαση «spinner ή γρήγορος αλγόριθμος» εκκρεμεί. Το
  κριτήριο του handoff (<100 ms ⇒ σβήσε) δεν εφαρμόζεται: 6,7 s δεν είναι busy state, είναι
  ελάττωμα. **Το σωστό ερώτημα δεν είναι «πώς κρύβουμε τα 10 s» αλλά «γιατί είναι 10 s».**

  ### Ανοιχτά μετά το v22
  - **Α. SSoT registry** — έκλεισε στο v23.
  - **Γ. Απόδοση** — έκλεισε στο v23.
  - **Δ. Επαλήθευση σε browser** — **δεν έχει γίνει ΠΟΤΕ**.

- **v24 (2026-07-27) — M10e: από τα 9,8 s στα 0,57 s, χωρίς να αλλάξει ούτε μία απάντηση.**
  **89/89** στο `systems/geo-referencing`, **1.220/1.220** μαζί με `bim-3d/converters` +
  `systems/topography` + `services/clip` + `bim/hatch`. SSoT suite **608/608**.
  `jscpd:diff` καθαρό στα 8 αρχεία. Απόφαση Giorgio: «όπως οι μεγάλοι παίκτες, με έρευνα».

  | Διαδρομή | v22 | v24 | |
  |---|---|---|---|
  | FOUND (congruent-pairs) | 6.700 ms | **~250 ms** | **×27** |
  | REFUSED (needs-manual) | 9.800 ms | **~570 ms** | **×17** |

  ### 🔴 Η αρχή που διέπει και τις τέσσερις αλλαγές: ΚΑΜΙΑ δεν είναι στατιστική
  Η βιβλιογραφία λύνει το «πολλές υποθέσεις × ακριβή επαλήθευση» με **δειγματοληψία**:
  preemptive RANSAC (Nistér 2005) βαθμολογεί όλες τις υποθέσεις σε ένα **μπλοκ** σημείων και
  πετά το χειρότερο κλάσμα· το T_{d,d} (Chum & Matas) ελέγχει **d τυχαία** σημεία και απορρίπτει.
  Και τα δύο δέχονται **πραγματική πιθανότητα να χαθεί η αληθινή υπόθεση**. Για κάτι που
  καταλήγει στο `Project.basePoint` αυτό δεν είναι αποδεκτό — και **δεν χρειάστηκε**: κάθε
  επιτάχυνση εδώ είναι είτε το ίδιο ερώτημα ρωτημένο φθηνότερα, είτε απόρριψη με **απόδειξη**.
  Η έξοδος είναι bit-identical με το να βαθμολογούνταν τα πάντα ως το τέλος· τα ίδια 89 tests,
  συμπεριλαμβανομένων των λεπτών (συμμετρικός κάνναβος → `needs-manual`, ανάκτηση στροφής σε
  0,01°, οι φράχτες false-positive), το επιβεβαιώνουν.

  ### 1. Το ερώτημα ρωτιέται από τη ΜΙΚΡΗ πλευρά — ×16, χωρίς προσέγγιση
  Ο κανόνας 1-προς-1 καπελώνει τη βαθμολογία στο `min(|σχέδιο|, |τοπογραφικό|)` = **93**. Άρα η
  βαθμολόγηση 1.500 σημείων σχεδίου έκανε 1.500 αναζητήσεις για να ανακαλύψει το πολύ 93
  γεγονότα — **2.456 φορές**. Ο δείκτης χτίζεται πλέον πάνω στο **σχέδιο** (που δεν κουνιέται
  μεταξύ υποθέσεων, άρα χτίζεται **μία φορά**) και προβάλλονται τα **93** σημεία του
  τοπογραφικού μέσα στο πλαίσιο του σχεδίου. `countExplainedPoints` στο `geo-point-index.ts`.
  Η ασυμμετρία είναι **δομική** (CSV δεκάδες/εκατοντάδες σημεία, τοπογραφικό σχέδιο χιλιάδες),
  όχι συγκυριακή. Το `scoreGeoReference` κρατά τη φορά σχέδιο-πρώτα γιατί είναι η φορά στην
  οποία διατυπώνεται η **ΑΠΟΔΕΙΞΗ** (πόσα σημεία του σχεδίου προσγειώθηκαν, με τι RMS).

  ### 2. Εγκατάλειψη υποψηφίου με ΑΠΟΔΕΙΞΗ, όχι με δείγμα
  Κάτω από `leader / UNIQUENESS_FACTOR` ένας υποψήφιος **δεν μπορεί** ούτε να νικήσει (είναι
  αυστηρά κάτω από τον ηγέτη, που μόνο ανεβαίνει) ούτε να ενεργοποιήσει την πύλη μοναδικότητας
  (που ρωτά ακριβώς αν κάποιος αντίπαλος πλησιάζει εντός αυτού του παράγοντα). Η μερική
  βαθμολογία που επιστρέφεται δεν διαβάζεται ποτέ για κάτι που θα μπορούσε να αλλάξει.

  ### 3. 🔴 Καμία τετραγωνική ρίζα στη σάρωση ζευγών — **331 ms → 56 ms**
  «Είναι αυτό το ζεύγος εντός τ από μήκος L» είναι `(L−τ)² ≤ dx²+dy² ≤ (L+τ)²` — **το ίδιο
  ερώτημα με τις δύο πλευρές υψωμένες στο τετράγωνο**. Μετρημένο πάνω σε 9 M υποψήφια ζεύγη:
  με ρίζα **3.234 ms**, με τετράγωνα **72 ms**. Η ρίζα δεν ήταν *μέρος* του κόστους, **ήταν**
  το κόστος. Παίρνεται πλέον μόνο για τα λίγα ζεύγη που όντως πέφτουν μέσα στη ζώνη.
  ⚠️ **Παγίδα που έγινε test**: το `(L−τ)²` με `τ > L` ξαναγίνεται **θετικό δάπεδο** και θα
  απέρριπτε σιωπηλά ακριβώς τα κοντά ζεύγη — clamp στο 0.

  ### 4. Η μεγάλη πλευρά δεν υλοποιείται πλέον καθόλου
  Ο πίνακας 1,12 M γραμμών (18 MB) χτιζόταν για να απαντηθούν **δέκα** ερωτήματα. Το
  τοπογραφικό (93 σημεία → 4.278 ζεύγη) παραμένει πίνακας γιατί τα ζεύγη του πρέπει να
  **ταξινομηθούν** (`selectLongestBases`)· η πλευρά του σχεδίου γίνεται **streaming** πάνω σε
  επίπεδο `Float64Array`. Test καρφώνει ότι το stream δίνει τα **ίδια ζεύγη, στην ίδια σειρά**
  με τον πίνακα — η σειρά των υποθέσεων είναι που κρίνει τις ισοπαλίες.

  ### 5. `RigidMap` — μία φορά ο τύπος στροφής, μία φορά η τριγωνομετρία
  Το `localToWorld` υπολόγιζε `cos`/`sin` **ανά σημείο**: 3,7 M φορές, 1,33 ms ανά 1.500 σημεία
  έναντι **0,076 ms** με προετοιμασμένο map. Η **αντίστροφη** φορά το ήξερε ήδη
  (`makeWorldToDisplayProjector`)· η ευθεία όχι — **η ασυμμετρία ήταν το ελάττωμα**. Ο
  αντίστροφος ενός rigid map είναι απλώς **άλλος rigid map** (`R⁻¹ = Rᵀ` ⇒ `s ↦ −s`), οπότε οι
  δύο φορές είναι πλέον **ένας** τύπος και **ένας** πυρήνας — το `worldToLocalCore` καταργήθηκε.

  ### ⚠️ Μια υπόθεση που η μέτρηση ΑΠΕΡΡΙΨΕ (καταγράφεται για να μην ξαναδοκιμαστεί)
  Δοκιμάστηκε το hoisting του visitor closure έξω από τον βρόχο probe (θεωρία: νέο closure ανά
  probe κάνει το call site πολυμορφικό ⇒ μη-inline-άρισμο). **Η μέτρηση δεν το στήριξε** — και
  το κόστος του θα ήταν ένα σχόλιο που ισχυρίζεται μετρημένο όφελος που δεν υπάρχει. Έγινε
  επαναφορά στη σαφέστερη μορφή με τη βοηθητική `nearestUnclaimed`.

  ### Η ένδειξη απασχόλησης: το `match.running` ΖΩΝΤΑΝΕΨΕ (δεν σβήστηκε)
  Το v22 άφησε ανοιχτό αν το νεκρό κλειδί σβήνει. Τα **~570 ms** της διαδρομής άρνησης
  απαντούν: κάτω από 100 ms θα σβηνόταν, πάνω από 1 s θα ήθελε worker — είναι **ενδιάμεσα**,
  δηλαδή ακριβώς η περιοχή όπου χρειάζεται **ένδειξη, όχι worker**. Το `onAutoMatch` δίνει δύο
  frames πριν καλέσει, ώστε η ετικέτα «Γίνεται ταύτιση…» να **προλάβει να ζωγραφιστεί**: η React
  δεν ζωγραφίζει ανάμεσα σε `setState` και μια μπλοκάρουσα κλήση του ίδιου tick, οπότε χωρίς
  αυτό ο χρήστης βλέπει σιωπή και ξαναπατά. Το `startTransition` **δεν** βοηθά — δεν υπάρχει
  διακοπτόμενο render, μόνο μία μακριά κλήση. `finally` ⇒ μια εξαίρεση δεν κλειδώνει το panel.

  ### SSoT registry — module `point-hash-grid` (Tier: spatial)
  Golden test **ΠΡΩΤΑ**, κατ' εντολή Giorgio. Δύο patterns, μετρημένα πριν γραφτούν:
  `Math\.floor\([a-zA-Z_.]*\.[xy] */ *[A-Za-z_.]*[Cc][Ee][Ll][Ll]` (**2 αρχεία**: το SSoT +
  `IntersectionSnapEngine`) και `Map<number, *Map<number, *number\[\]>>` (**1**: το SSoT).
  **`grep -E` και JS RegExp συμφωνούν αρχείο-προς-αρχείο** — αυτός ακριβώς είναι ο έλεγχος για
  τον οποίο υπάρχει το περιστατικό `(?:...)` του ADR-294 v3.0.
  🔴 **ΕΜΒΕΛΕΙΑ — διάβασέ την πριν το επεκτείνεις**: φυλάει **point-proximity hashing**. Ένα
  ευρύτερο pattern (`Math\.floor\(.*/ *…cell`) πιάνει **7 αρχεία**, από τα οποία **3**
  (`mesh-silhouette`, `tin-sampler`, το box-sweep του `broad-phase`) ραστεροποιούν **τρίγωνα και
  κουτιά** — άλλο ερώτημα, το `PointHashGrid` **δεν** είναι η απάντησή τους. 43 % false
  positives σε blocking check = αγνοείται μέσα σε μια βδομάδα (πήχης Google ≤10 %, N.12). Είναι
  **στενό επίτηδες: regression guard, όχι απογραφή**.
  Τα 4 προϋπάρχοντα του `IntersectionSnapEngine` μπήκαν στο **baseline** (χρέος), όχι στο
  allowlist (ευλογία). ⚠️ **Το baseline ενημερώθηκε ΧΕΙΡΟΥΡΓΙΚΑ** — το `npm run ssot:baseline`
  αναγεννά όλο το αρχείο από το τρέχον δέντρο, και το δέντρο μοιράζεται με άλλον agent: θα
  έψηνε τις δικές του εν-πτήσει παραβάσεις μέσα στο ratchet.

  ### Ανοιχτά μετά το v24
  - **Δ. Επαλήθευση σε browser** — **ΔΕΝ ΕΧΕΙ ΓΙΝΕΙ ΠΟΤΕ**. Τα 1.220 tests αποδεικνύουν τον
    αλγόριθμο, όχι το κούμπωμα του UI.
  - Οι αριθμοί απόδοσης είναι μετρημένοι **υπό jest**, όχι σε browser build. Είναι η σωστή
    σύγκριση v22↔v24 (ίδιο περιβάλλον) — **δεν** είναι υπόσχεση για την παραγωγή.
  - `VT_POINT` Z = 0 vs `VT_ELEV`, κατακόρυφη ταύτιση (ADR-713): **εκτός σκοπού**, αμετάβλητα.

- **v23 (2026-07-27) — M8β/Γ v2: η 3Δ έμφαση της εστιασμένης υποψήφιας γίνεται ΓΡΑΜΜΗ, όχι κουκκίδες.**

  **Αφορμή — οπτικό εύρημα, όχι θεωρία.** Στην 3Δ όψη η εστιασμένη υποψήφια σχεδιαζόταν με
  `LineBasicMaterial` (1 px, γιατί το WebGL αγνοεί το `linewidth`) + 7 px τετράγωνες κουκκίδες σε
  **κάθε** κορυφή. Στην οθόνη η γραμμή ήταν πρακτικά αόρατη και **όλη** η έμφαση έπεφτε στις
  κουκκίδες: η επιλογή διαβαζόταν ως «σειρά από κουκκίδες», όχι ως «αυτή η γραμμή». Δίπλα στο 2Δ —
  όπου η άλως υπάρχει από το M8β/Γ και δουλεύει — το 3Δ υστερούσε αισθητά. Δεύτερο, μετρήσιμο
  πρόβλημα κλίμακας: 9 κορυφές στο συνθετικό δείγμα, **50-200** σε πραγματική οριογραμμή δρόμου →
  συμπαγής ταινία.

  ### 🔴 Η ΑΙΤΙΑ ΗΤΑΝ ΤΕΚΜΗΡΙΩΜΕΝΗ ΨΕΥΔΩΣ ΣΤΟ v19
  Το v19 δικαιολογούσε τις κουκκίδες με «η fat-line διαδρομή θα έφερνε per-resize `resolution`
  plumbing **που το scene layer δεν έχει**». **Δεν ισχύει, και δεν ίσχυε ποτέ**: το
  `bim-3d/edges/bim-edge-resolution-store` δημοσιεύει αυτό ακριβώς το μέγεθος από το **ADR-375
  Phase C.7**, γραμμένο από τον `scene-manager-resize` (τον **scene manager**, όχι το edge overlay)
  σε κάθε resize — άρα είναι SSoT **ολόκληρης** της σκηνής BIM 3Δ και κάθε layer μπορούσε να το
  καταναλώσει. Το εμπόδιο ήταν φανταστικό· η απόφαση που στηρίχθηκε πάνω του, λάθος. *(Μάθημα του
  N.0.1: ο κώδικας είναι η αλήθεια — ένα grep έλυσε ό,τι δύο handoffs επαναλάμβαναν.)*

  ### Απόφαση SSoT (η υποχρεωτική επιλογή του §4 του handoff): **(α) κοινό factory**
  Πριν γραφτεί γραμμή, grep σε ΟΛΟ το `src/`: **ακριβώς δύο** σημεία κατασκευάζουν fat line —
  `bim-3d/edges/bim-3d-edge-overlay-builder` και `canvas-v2/webgl-lines/WebglLineLayerManager`. Ένα
  τρίτο χειρόγραφο θα ήταν το sibling clone του N.18.
  - **NEW `bim-3d/lines/scene-fat-line.ts`** — `createSceneFatLineMaterial()` +
    `createFatLineMesh()`. **Ο υπάρχων edge builder ΜΕΤΑΤΡΑΠΗΚΕ** να το χρησιμοποιεί· χωρίς αυτό δεν
    θα ήταν κεντρικοποίηση αλλά «τρίτο αντίγραφο με ωραίο όνομα»
    (`reference_over_parameterised_factory_clone`).
  - **Ο 2Δ αδελφός (ADR-639 Στ.5) ΜΕΝΕΙ ΕΞΩ, τεκμηριωμένα**: άλλη σκηνή, **δική του** πηγή
    resolution (2Δ viewport ανά rAF tick), per-bucket vertex colours, LOD `instanceCount`. Το να
    μπει θα απαιτούσε παραμετροποίηση της *πηγής* και του *κύκλου ζωής* — ακριβώς το
    over-parameterised factory που είναι clone με άλλο όνομα. Ό,τι μένει κοινό είναι τρία `new`.
  - Οι παράμετροι είναι **δεδομένα** (χρώμα, πάχος, opacity, dash, polygonOffset), **όχι hooks** —
    αυτό είναι η διαφορά ανάμεσα σε factory και σε clone με config.

  ### 🐛 ΠΑΡΑΠΛΕΥΡΟ ΕΥΡΗΜΑ — σφάλμα μονάδων HiDPI σε ΟΛΕΣ τις ακμές BIM (διορθώθηκε)
  Ο vertex shader του `LineMaterial` κάνει `offset *= linewidth; offset /= resolution.y` (μετρημένο
  στο `node_modules`, γρ. 217-220) ⇒ **το `linewidth` είναι στη μονάδα που είναι και το
  `resolution`** — δεν υπάρχει ανεξάρτητο «pixel». Ο edge builder έδινε `resolution` σε **CSS px**
  και `linewidth` σε **device px** ⇒ κάθε ακμή BIM σχεδιαζόταν **`dpr×` πιο χοντρή** σε οθόνη HiDPI.
  Αόρατο σε dpr 1 (όπου ρυθμίστηκε), ορατό σε 2. Ο 2Δ αδελφός το είχε **σωστό** — δηλαδή οι δύο
  αδελφοί είχαν ήδη αποκλίνει, που είναι ακριβώς το κόστος του να μην υπάρχει κοινό primitive.
  - Το store δημοσιεύει πλέον και `pixelRatio` (από το `bimPixelRatio()`, τον ίδιο clamp `min(dpr,2)`
    που δίνεται στον renderer). Το factory παράγει **και τα δύο** από **ένα** snapshot.
  - **Δεύτερο κενό**: το `applyDevicePixelRatioSync` (αλλαγή οθόνης χωρίς resize) **δεν ενημέρωνε
    καθόλου** το store — και το CSS μέγεθος δεν αλλάζει, άρα ο identity guard θα κατάπινε ένα
    `setSize`. Όλη η 3Δ όψη κρατούσε τα πάχη της **προηγούμενης** οθόνης, σιωπηλά.
  - Σε dpr 1 (ο σταθμός του Giorgio) **καμία οπτική αλλαγή**.

  ### Τι σχεδιάζεται τώρα (η γλώσσα του 2Δ, μεταφερμένη αυτούσια)
  - **NEW `bim-3d/materials/auto-breakline-materials-3d.ts`** (split από το `terrain-materials-3d`,
    N.7.1): **άλως** (10 px, χρώμα επιλογής, opacity 0.55) **κάτω** από **πυρήνα** (5 px) — και ο
    πυρήνας παίρνει το **χρώμα ΕΓΚΡΙΣΗΣ**, όχι το χρώμα επιλογής. Αυτό διορθώνει και μια σιωπηλή
    απόκλιση του v19: εκεί η εστιασμένη βαφόταν **ολόκληρη** λευκή, δηλαδή το κλικ «για να δω»
    έκρυβε το «τι θα γραφτεί» — κάτι που το 2Δ δεν έκανε ποτέ. Οι **δύο ανεξάρτητες ερωτήσεις**
    (έγκριση / εστίαση) απαντώνται ξανά και στις δύο όψεις.
  - **Casing κάτω από core** είναι η καρτογραφική απάντηση στο «κάνε μια γραμμή αναγνώσιμη πάνω σε
    φόντο που δεν ελέγχεις» (ESRI halo/casing) — το ίδιο πρόβλημα, είτε το φόντο είναι πυκνή κάτοψη
    είτε σκιασμένο ανάγλυφο.
  - **NEW `systems/topography/auto-breaklines/auto-breakline-review-style.ts`** — τα **πάχη** (2/3/5/10
    px + opacity άλω) έγιναν SSoT που διαβάζουν **και οι δύο** όψεις. Ήταν ιδιωτική σταθερά του 2Δ
    overlay· από τη στιγμή που το 3Δ μπορεί να εκφράσει πάχος, δύο αντίγραφα θα απέκλιναν στο πρώτο
    tweak — όπως ακριβώς έγινε με το `linewidth`/`resolution` παραπάνω.
  - **`depthTest: false` ΔΙΑΤΗΡΗΘΗΚΕ** και στα τρία περάσματα (εντολή Giorgio, επαληθευμένο οπτικά).
    ⚠️ **Παρενέργεια που καταγράφεται ρητά**: το `LineMaterial` εξαιρείται από το three.js clipping
    (`section-clip-applicator`, ADR-452/665), άρα η **εστιασμένη** δεν κόβεται πια από το ενεργό
    επίπεδο στάθμης — συνεπές με το να αγνοεί το βάθος: είναι **δείκτης επιλογής**, όχι γεωμετρία
    αποτύπωσης. Οι λεπτές γραμμές έγκρισης **μένουν `LineBasicMaterial`** ακριβώς γι' αυτό (κόβονται
    κανονικά)· η πάχυνσή τους είναι ξεχωριστή απόφαση που πρέπει πρώτα να απαντήσει στο clipping.
  - **Άλως με `alphaToCoverage`, ΟΧΙ blending**: κάθε τμήμα του `LineSegments2` είναι δικό του quad
    **με στρογγυλά άκρα**, οπότε σε κοινή κορυφή δύο quads επικαλύπτονται σχεδόν πλήρως. Με
    blending η επικάλυψη συνθέτει **δύο φορές** → φωτεινή **χάντρα σε κάθε κορυφή** μιας ημιδιαφανούς
    άλω. Το alpha-to-coverage αντιστοιχίζει σταθερό alpha σε **σταθερή μάσκα δειγμάτων** → η δεύτερη
    σχεδίαση γράφει τα ίδια δείγματα με το ίδιο χρώμα = **ταυτοδύναμη**. Ο renderer έχει
    `antialias: true` (ADR-366 §B.5), άρα η μάσκα υπάρχει.

  ### Οι κουκκίδες: από «η έμφαση» σε «πού είναι οι κορυφές» — και ο κανόνας που τις κόβει
  - **NEW `bim-3d/converters/polyline-corner-vertices.ts`** (pure): κρατά **τα δύο άκρα** (ανοιχτή
    αλυσίδα) + κάθε κορυφή όπου η αλυσίδα **όντως στρίβει** ≥ **25°**, με πλαφόν **24** εσωτερικών
    (κρατώντας τις **οξύτερες**, με ντετερμινιστικό tie-break). Ευθεία αλυσίδα 50 κορυφών → **2**
    σημάδια αντί για 50 (×2).
  - **Η στροφή μετριέται σε 3Δ, όχι σε κάτοψη**: μια γραμμή ασυνέχειας ανεβαίνει· σπασμένη **κλίση**
    με ίδια διεύθυνση κάτοψης είναι πραγματικό σπάσιμο — το «elevation point» του Civil 3D, του
    οποίου το *Weed Vertices* σταθμίζει ομοίως γωνία **και** κλίση. Μέτρηση σε κάτοψη θα έριχνε
    σιωπηλά ακριβώς τις κορυφές που ένας τοπογραφικός έλεγχος υπάρχει για να δει.
  - **Camera-independent επίτηδες.** Το screen-space thinning («όχι δύο κουκκίδες < N px») είναι η
    άλλη προφανής λύση, αλλά απαιτεί επανυπολογισμό **ανά καρέ** από την κάμερα. Το layer είναι
    click-driven (ADR-040: τίποτα εδώ δεν τρέχει ανά καρέ) και **αυτό μένει**. Το LOD του
    `canvas-v2/webgl-lines` **αξιολογήθηκε και απορρίφθηκε ως μη επαναχρησιμοποιήσιμο**: δουλεύει με
    ένα 2Δ `transform.scale` ανά tick, το οποίο σε προοπτική κάμερα δεν υπάρχει.
  - **Στρογγυλές, με texture — ΟΧΙ `onBeforeCompile`**. NEW `bim-3d/materials/round-dot-texture.ts`:
    ένα 64×64 canvas για όλη την εφαρμογή. Το `discard` σε `gl_PointCoord` δίνει **σκληρή** ακμή
    (μηδενική μερική κάλυψη → aliasing που «σέρνεται» καθώς περιστρέφεις) και κουβαλά τις δύο
    παγίδες του **ADR-689** (όχι σε `ShaderMaterial`, απαιτεί `customProgramCacheKey`). Το texture
    δίνει antialiased περίγραμμα **πριν** φτάσει στη GPU, με μηδενικό ρίσκο injection. RGB καθαρό
    λευκό ⇒ το χρώμα το δίνει το υλικό (UI_COLORS SSoT), όχι το αρχείο.
  - Το `size` του `PointsMaterial` εφαρμόζεται από το three σε **device px** (`gl_PointSize = size`,
    κανένα ratio) ⇒ παρακολουθεί και αυτό το `pixelRatio` του store· αλλιώς σε HiDPI η κουκκίδα θα
    ήταν **μισή**. 8 px αντί για 7: δίσκος διαμέτρου d καλύπτει ~78 % του τετραγώνου πλευράς d.

  ### Τι απορρίφθηκε ρητά (και γιατί)
  - **Animation (pulse / dash-flow)** — θα διάβαζε ωραία, αλλά κάθε καρέ πρέπει να περνά από τον
    `UnifiedFrameScheduler` (ADR-040 απαγορεύει ιδιωτικό RAF loop). Θα μετέτρεπε ένα layer που
    σήμερα κοστίζει **μηδέν** ανάμεσα σε κλικ σε μόνιμο καταναλωτή ανά καρέ. Στατική άλως λύνει ήδη
    το πρόβλημα αναγνωσιμότητας· η κίνηση θα πλήρωνε τρέχον κόστος για γυάλισμα.
  - **Δεύτερη, σκούρα εξωτερική άλως** (το double-casing της ESRI, που επιβιώνει και σε ανοιχτό
    φόντο) — το χρώμα επιλογής της εφαρμογής **είναι** λευκό· ένα δεύτερο σκούρο δαχτυλίδι θα ήταν
    εφεύρεση **μόνο** για το 3Δ και οι δύο όψεις θα έπαυαν να περιγράφουν το ίδιο review.
  - **Post-processing `OutlinePass`** — full-screen pass + `EffectComposer` που η σκηνή δεν έχει,
    για ένα αντικείμενο. Ασύμφορο σε σκηνή 546 τριγώνων.

  ### Tests
  - **NEW `polyline-corner-vertices.test.ts` (10)** — ευθεία → μόνο άκρα· πραγματική στροφή· **3Δ
    σπάσιμο κλίσης**· κατώφλι ±1°· κλειστός βρόχος (τρίγωνο vs ομαλός κύκλος → **κανένα** σημάδι)·
    πλαφόν που κρατά τις **οξύτερες** (όχι τις πρώτες)· **ΠΟΤΕ σημάδι σε NaN** (ADR-537)· διπλή
    κορυφή· εκφυλισμένα.
  - **NEW `lines/__tests__/scene-fat-line.test.ts` (10)** — το **συμβόλαιο μονάδων** σε αριθμούς
    (dpr 1 και 2, ο λόγος `linewidth/resolution.y` σταθερός), παρακολούθηση resize **και** αλλαγής
    dpr, πάγωμα μετά το `unsubscribe`, καρφωμένο dpr που υπερισχύει **και στα δύο**, πολιτική
    overlay (alphaToCoverage / depthWrite / opacity-χωρίς-transparent), dash/polygonOffset opt-in.
  - **UPDATED `auto-breakline-to-three.test.ts`** — οι εστιασμένοι κάδοι είναι πλέον **ωμά
    `Float32Array`** (αν ξαναγίνουν `BufferGeometry`, το `setPositions` δεν παραπονιέται, απλώς δεν
    σχεδιάζει τίποτα — καρφωμένο)· ευθεία αλυσίδα 5 κορυφών → **2** σημάδια· dog-leg → άκρα + η
    στροφή.
  - **Σύνολο: 50 suites / 419 tests πράσινα** (topo + bim-3d + edges + section + 2Δ overlay).
  - `jscpd --diff` στα αρχεία αυτής της συνεδρίας: **καθαρό**.

  ### Ανοιχτά μετά το v23
  - **Πάχυνση των λεπτών γραμμών έγκρισης** (2/3 px, όπως στο 2Δ) — μπλοκάρεται από το clipping:
    fat line = εκτός `'topo'` clip scope. Θέλει απόφαση πριν γίνει, όχι σιωπηλή αλλαγή.
  - **Διακεκομμένη απορριφθείσα σε 3Δ** (το 2Δ την έχει) — `computeLineDistances` + dash σε world
    units· χαμηλή αξία όσο οι γραμμές μένουν 1 px.
  - **Οπτική επαλήθευση της νέας έμφασης στον browser** — **δεν έχει γίνει** (§7 του handoff).

- **2026-07-27 (v29)** — **Το `cdt2d.d.ts` ήταν αόρατο στο root TypeScript program** (εκστρατεία
  εξάλειψης σφαλμάτων, Φάση 1). **Σύμπτωμα:** TS7016 «could not find a declaration file for module
  `cdt2d`» στο `tin-builder.ts:17` — ενώ η ambient δήλωση **υπήρχε ήδη** και ήταν σωστή, από το v4.
  **Ρίζα:** το root `tsconfig.json` έχει `include` για κάθε `.d.ts` του `src/`, αλλά και
  `exclude: "src/subapps/dxf-viewer/**"` — και το `exclude` **φιλτράρει** το `include`. Τα κανονικά
  αρχεία του subapp μπαίνουν παρ' όλα αυτά στο program γιατί τα τραβά το import-chain από το
  `src/app/**`· οι **ambient** δηλώσεις όμως δεν εισάγονται ποτέ από κανέναν, άρα μένουν οριστικά έξω.
  **Λύση:** νέο `src/types/dxf-viewer-ambient.d.ts` — μηδέν τύποι, μόνο ένα
  `/// <reference path="…/topography/cdt2d.d.ts" />` που προσθέτει το **πραγματικό** αρχείο στο program
  παρακάμπτοντας το `exclude`. Καμία αντιγραφή τύπου, καμία αλλαγή στο `tsconfig.json` (το tree
  μοιραζόταν με άλλον πράκτορα). Η άδεια παραμένει MIT — **κανένα νέο dependency**.
  **Γιατί όχι αντίγραφο:** το `src/types/` περιέχει ήδη **4 χειρόγραφα αντίγραφα** ambient δηλώσεων
  του subapp (`opentype.d.ts` — byte-ίδιο με το `text-engine/fonts/opentype.d.ts` —, `utif.d.ts`,
  `google-cloud-storage.d.ts`, `jest-globals.d.ts`). Το μοτίβο «αντίγραψέ το» εφαρμόστηκε 4 φορές·
  το `cdt2d` θα ήταν το 5ο. Η εξάλειψη των 4 αντιγράφων υπέρ του ίδιου `reference` μηχανισμού
  καταγράφηκε ως εκκρεμότητα στο `.claude-rules/pending-ratchet-work.md`.

- **2026-07-27 (v30)** — **§M10f: η γεωαναφορά «δούλευε» και το σχέδιο δεν κουμπώνει — γιατί μόνο
  ένας στους έξι παραγωγούς περνούσε τη γέφυρα.**

  **Σύμπτωμα (μετρημένο στην οθόνη του Giorgio, 2 screenshots):** επιλεγμένη ισοϋψής
  `TOPO-CONTOUR-*` → status bar **X 407723,1041 · Y 4502396,1200** (ΕΓΣΑ'87)· επιλεγμένο μπλοκ DXF
  του σχεδίου → **X 331,3376 · Y 170,0564** (τοπικές). Δύο συστήματα στην ίδια σκηνή. Και όμως η
  ταύτιση ήταν **τέλεια**: «Αυτόματη ταύτιση 33 από 33 σημεία · μέση απόκλιση 0,0 εκ. · στροφή
  0,000°», ενεργή με `origin 407565.29, 4502055.67 m` — ταυτόσημο με το `sourceOrigin` του αρχείου.

  **Ρίζα — ΟΧΙ η γεωαναφορά, ούτε οι ισοϋψείς: ασυμφωνία κλάσης.** Το SSoT υπήρχε ήδη
  (`getActiveWorldToDisplayProjector`, M10b) και ήταν σωστό. Απλώς **κάθε παραγωγός αποφάσιζε
  μόνος του** αν θα το καλέσει, και η ίδια η προβολή ήταν **αντιγραμμένη** σε δύο σπίτια
  (`regenerate-topo.projectContoursToLocal`, `topo-surface-entity.projectFootprintToDisplay`).
  Όποιος παραγωγός γεννήθηκε μετά, γεννήθηκε χωρίς αυτή:

  | Παραγωγός | Πριν | Τι έβλεπε ο χρήστης |
  |---|---|---|
  | `regenerate-topo` (ισοϋψείς στο **reload**) | ✅ προέβαλλε | σωστά — γι' αυτό «άλλαζε μετά το reload» |
  | `topo-surface-entity` (footprint) | ✅ προέβαλλε | σωστά |
  | `useNorthArrow` (βορράς) | ✅ προέβαλλε το anchor | σωστά |
  | **`useTopoContours`** (ισοϋψείς, **interactive**) | ❌ | ωμές ΕΓΣΑ — **το σύμπτωμα** |
  | **`useTopoPointLabels`** (ετικέτες σημείων/κορυφών) | ❌ | ωμές ΕΓΣΑ |
  | **`useTopoGrid`** (ψημένος κάναβος) | ❌ | ωμές ΕΓΣΑ |
  | **`TopoGridUnderlayCanvas`** (ζωντανός κάναβος) | ❌ | **χειρότερο**: τύπωνε **τοπικές** συντεταγμένες με **ετικέτα ΕΓΣΑ** |

  Το `cut-fill-geometry` **δεν** ανήκει στην κλάση (καθαρή μαθηματική μονάδα, δεν κάθεται στη
  σκηνή· ο rigid μετασχηματισμός διατηρεί εμβαδά/όγκους) — το handoff το είχε λανθασμένα στη λίστα.
  Ο ζωντανός κάναβος **έλειπε** από τη λίστα και ήταν ο σοβαρότερος.

  **Λύση — ΕΝΑ σπίτι, όχι έξι κλήσεις.** Νέο `systems/topography/topo-display-frame.ts`:
  - `getTopoDisplayProjector()` — η **μία** είσοδος που διαβάζει store, **κανονικοποιημένη σε
    `null` όταν είναι identity**: το fast path γίνεται έλεγχος `null` που δεν ξεχνιέται, αντί για
    ένα `if (projector.isIdentity)` που κάθε καλών ξαναέγραφε (και δύο τον έγραψαν διαφορετικά).
  - `projectWorldPoint / projectWorldPoints / projectWorldRings / projectContourLines` — καθαρά,
    δέχονται τον projector· τα δύο προϋπάρχοντα αντίγραφα **διαγράφηκαν** και delegate εδώ.
  - `unprojectRectToWorld` — για τον ζωντανό κάναβο: οθόνη → display → **WORLD** (μόνο εκεί έχει
    νόημα «ποιες στρογγυλές γραμμές ΕΓΣΑ πέφτουν μέσα;») → πίσω σε display. Με στροφή επιστρέφει
    το περιβάλλον AABB — υπερ-καλύπτει, δεν κόβει κάναβο που φαίνεται.

  **Ο κανόνας που κωδικοποιείται (τον ρωτά κάθε νέος παραγωγός):**
  1. **Η ΓΕΩΜΕΤΡΙΑ προβάλλεται** — ό,τι κάθεται στο χαρτί περνά από `project`.
  2. **Το ΚΕΙΜΕΝΟ ΠΟΤΕ.** Το `Χ407723.10` μιας κορυφής οικοπέδου είναι **νομικό μέγεθος** (αυτό
     ακριβώς γράφει ο πίνακας συντεταγμένων του τοπογράφου, §ΔΙΟΡΘΩΣΗ)· προβάλλοντάς το θα
     τυπώναμε τοπικές συντεταγμένες με ετικέτα ΕΓΣΑ — σιωπηλό, και λάθος στο συμβόλαιο.
  3. **Τα offsets του υπομνήματος είναι display-frame** (τα glyphs σχεδιάζονται οριζόντια), **η
     γεωμετρία του καννάβου όμως στρίβει** (οι βραχίονες του σταυρού δείχνουν διεύθυνση ΕΓΣΑ).
  4. Ο `projector` στους καθαρούς builders είναι **υποχρεωτική** παράμετρος, όχι optional: `null`
     σημαίνει ρητά «μη-γεωαναφερμένο έργο», ενώ μια παραλειπόμενη παράμετρος σημαίνει «κανείς δεν
     το σκέφτηκε» — ακριβώς πώς γεννήθηκε αυτό το bug.

  **Τεστ — άγκιστρο κλάσης, όχι δείγματος** (`__tests__/topo-display-frame.test.ts`): παραμετρικό
  πάνω και στους **έξι** παραγωγούς — με ενεργή γεωαναφορά καμία συντεταγμένη γεωμετρίας δεν
  επιτρέπεται εκτός της ζώνης ±1e6 mm (ADR-635 culling), με **αρνητικό μάρτυρα**: ο ίδιος
  παραγωγός με `null` projector οφείλει να πέσει **έξω** από τη ζώνη. Χωρίς τον μάρτυρα ο έλεγχος
  θα ήταν πράσινος και για σπασμένο κώδικα. Επιπλέον: ταυτότητα προβολής με ακρίβεια 1e-6, ισχύ
  υπό στροφή 17,5°, και ότι οι **συμβολοσειρές** είναι ίδιες με και χωρίς γεωαναφορά.

  **Πύλες:** 315 suites / 2836 tests πράσινα (topography + persistence + geo-referencing + bim-3d)·
  `jscpd --diff` στα 9 αρχεία **καθαρό**· `tsc` **δεν** τρέχει από πράκτορα (N.17).

  **Ανοιχτό (δεν μπήκε στο εύρος):** ετικέτες / κάναβος / βορράς **δεν** έχουν idempotent
  regenerate-on-load όπως οι ισοϋψείς — αν η γεωαναφορά αλλάξει **μετά** το ψήσιμό τους, μένουν
  στο παλιό σύστημα μέχρι να τα ξαναφτιάξει ο χρήστης. Οι ισοϋψείς + το footprint είναι καλυμμένα
  (`regenerate-topo`). Χρειάζεται δικό του πέρασμα, με τον ίδιο idempotent καθαρισμό ανά layer.

  **Status: §M10f — IMPLEMENTED & GREEN (εκκρεμεί ζωντανή οπτική επιβεβαίωση στον browser).**

- **2026-07-27 (v31)** — **§M10g BLUEPRINT: το πλαίσιο συντεταγμένων γίνεται ΔΕΔΟΜΕΝΟ, όχι υπόθεση.**
  *(Εντολή Giorgio: «όπως οι μεγάλοι παίχτες — Revit/ArchiCAD/C4D/Figma — και αν γίνεται, καλύτερα.
  Καμία έκπτωση, ο χρόνος δεν μετράει.» Φάση 1 N.0.1: αναγνώριση + σχέδιο, πριν γραφτεί κώδικας.)*

  ### 1. Τι κάνουν ΠΡΑΓΜΑΤΙΚΑ οι μεγάλοι (τεκμηριωμένο, όχι εικασία)

  **Revit.** Οι θέσεις των στοιχείων αποθηκεύονται **στο internal origin system** — όχι σε
  πραγματικές συντεταγμένες. Το Survey Point / Shared Coordinates είναι **μετασχηματισμός από
  πάνω**, που κουβαλά τις μεγάλες τιμές. Ρητή σύσταση της Autodesk: «για πολύ μεγάλες
  συντεταγμένες, κράτα τη γεωμετρία κοντά στο Internal Origin και άσε τα Shared Coordinates να
  κουβαλήσουν τις μεγάλες τιμές, για να αποφύγεις προβλήματα ακρίβειας». Υπάρχει **σκληρό όριο**:
  το μοντέλο πρέπει να ζει σε σφαίρα ~20 μιλίων γύρω από το internal origin, αλλιώς η γεωμετρία
  δεν υπολογίζεται αξιόπιστα.
  *(autodesk.com TS article «Understand shared coordinates in Revit»· modelical.com «Coordinates
  in Revit»· bimpure.com «Revit Base Points and Coordinate System».)*

  **ArchiCAD**: ίδιο σχήμα (Project Origin + Survey Point). **Civil 3D**: ισοϋψείς/ετικέτες/
  κάναβος είναι **styles πάνω στην επιφάνεια**, δυναμικά — μηδέν ψημένη γεωμετρία· και όταν όντως
  αλλάζει coordinate zone, εφαρμόζει **delta rigid transform στα υπάρχοντα**, δεν τα ξαναπαράγει
  (η αναπαραγωγή θα έσβηνε τις επεξεργασίες του χρήστη).

  **Cesium / 3D Tiles (η γεω-κλίμακα λυμένη σωστά):** `CESIUM_RTC` — κάθε θέση ορίζεται **σχετικά
  με ένα κέντρο**, ώστε η ακρίβεια float32 να επαρκεί για την απόσταση από αυτό· το κέντρο
  μπαίνει στη model-view matrix. Χωρίς αυτό: «jittery vertices», Z-fighting, μετατοπίσεις.
  *(KhronosGroup/glTF CESIUM_RTC· reearth.engineering «High-Precision Rendering».)*

  ### 2. Η ΕΤΥΜΗΓΟΡΙΑ — το «ψήσιμο κοντά στο origin» **ΕΙΝΑΙ** η αρχιτεκτονική των μεγάλων

  Άρα το §M10f **δεν** ήταν συμβιβασμός: αποθηκεύουμε ό,τι κάθεται στη σκηνή σε **τοπικές κοντά
  στο 0** και αφήνουμε τη γεωαναφορά να κουβαλά τα 4·10⁸ mm — ακριβώς η σύσταση της Autodesk.
  Η εναλλακτική «ζωντανός transform node στο render» (Figma/C4D scene-graph) **απορρίπτεται
  συνειδητά**: οι οντότητές μας είναι native CAD entities (ADR-057) — ένας transform node θα
  έπρεπε να συντεθεί σε **≥6 ραφές** (renderer, 3 ραφές hit-test, snap, grips, export, 2 raycasters
  3D). Κάθε ραφή = μια ευκαιρία σιωπηλής απόκλισης· ακριβώς η κλάση σφάλματος που μόλις κλείσαμε,
  πολλαπλασιασμένη. Ο Revit το ξέρει και γι' αυτό **δεν** το κάνει.

  **Το πραγματικό κενό λοιπόν δεν είναι «τρεις παραγωγοί χωρίς rebuild». Είναι δύο πράγματα:**
  1. **Η ψημένη οντότητα δεν κουβαλά την ταυτότητα του πλαισίου στο οποίο ψήθηκε.** Ο κώδικας
     *υποθέτει* σε ποιο σύστημα κάθεται. Αυτό είναι η ρίζα ΟΛΗΣ της κλάσης — όχι το σύμπτωμα.
  2. **Δεν υπάρχει ιδιοκτήτης της ερώτησης «το πλαίσιο άλλαξε — ποιος μετακινείται;»** Σήμερα ο
     `useTopoPersistence.ts:214` ξαναχτίζει **μόνο** ό,τι ξέρει να παράγει (ισοϋψείς + footprint)·
     τα υπόλοιπα μένουν σιωπηλά στο παλιό σύστημα.

  ### 3. Η ΣΧΕΔΙΑΣΗ (§M10g)

  **α) `ProjectCoordinateFrame` — πρωτεύον, persisted, versioned αντικείμενο.** Γενίκευση του
  σημερινού `geo-reference-store`: `{ originWorld, rotationDeg, version, epsg? }`. Το `version`
  είναι μονότονο· κάθε `setGeoReference` το αυξάνει. Η σκηνή έχει **ήδη** την αδελφή έννοια
  (`SceneModel.sourceOrigin`, `world = local + sourceOrigin`) — οι δύο ενοποιούνται εννοιολογικά:
  Internal Origin (σκηνή) ↔ Survey Point (frame), όπως ο Revit.

  **β) ΣΦΡΑΓΙΔΑ (`bakedFrame`).** Το persisted topo state αποκτά, ανά ομάδα ψημένων προϊόντων
  (`grid` / `pointLabels` / `north`), τη σφραγίδα του frame στο οποίο ψήθηκαν. **Ανά ομάδα, όχι ανά
  οντότητα**: φθηνό, αρκετό, και δεν μολύνει τον τύπο `Entity` — τα layers είναι ήδη ο διαχωριστής.

  **γ) ΕΝΑΣ reconciler, ένα lifecycle moment.** Στην αλλαγή frame (ή στο load με ασύμφωνη
  σφραγίδα) ο **ένας** ιδιοκτήτης υπολογίζει το delta `old → new` και:
  - **ξαναχτίζει** ό,τι είναι παράγωγο της πηγής (ισοϋψείς, footprint) — όπως σήμερα·
  - **μετακινεί με delta rigid transform** ό,τι έχει επεξεργαστεί ο χρήστης (κάναβος, ετικέτες,
    βορράς) — έτσι ο **μετακινημένος βορράς ακολουθεί** αντί να αναγεννηθεί στη θέση-άγκιστρο.
    Χρησιμοποιεί το υπάρχον SSoT rigid transform (`translateEntityByAnchor`, `rotateEntity`) —
    μηδέν νέα μαθηματικά, μηδέν clone (N.18).
  - Ιδιότητες: **idempotent** (delta, όχι απόλυτη τιμή· ίδια σφραγίδα ⇒ no-op), **fail-closed**
    (άγνωστη/απούσα σφραγίδα ⇒ δεν μαντεύει· σημαδεύει τα προϊόντα ως «ψημένα σε άγνωστο πλαίσιο»
    και το UI προτείνει ξανα-ψήσιμο — ΠΟΤΕ σιωπηλή λάθος μετακίνηση).

  ### 4. Πού πάμε ΠΙΟ ΠΕΡΑ από τους μεγάλους (η ρητή απαίτηση)

  1. **Το όριο γίνεται συμβόλαιο με δόντια, όχι προειδοποίηση.** Ο Revit *προειδοποιεί* όταν τα
     στοιχεία απομακρυνθούν· εμείς **εμποδίζουμε**: assertion στη ραφή commit (dev) + το ήδη
     γραμμένο παραμετρικό anchor με **αρνητικό μάρτυρα** (ζώνη ±1e6 mm, ADR-635) που σκάει αν
     κάποιος παραγωγός σταματήσει να προβάλλει. Κανένας από τους μεγάλους δεν έχει presubmit πύλη.
  2. **Αυτο-ίαση αντί για σιωπηλό λάθος.** Ο Revit δεν μπορεί να καταλάβει ότι ένα link κάθεται σε
     ξεπερασμένο πλαίσιο — το δείχνει λάθος μέχρι να ξανα-acquire ο χρήστης. Η σφραγίδα μάς
     επιτρέπει **ντετερμινιστική ανίχνευση + διόρθωση στο load**.
  3. **Η αρχή του RTC γίνεται αναλλοίωτο, όχι extension.** Ο κανόνας «καμία απόλυτη ΕΓΣΑ τιμή δεν
     φτάνει σε float32 buffer» ισχύει ήδη στο 3D (projector πριν τα typed arrays)· γίνεται
     ρητός κανόνας + τεστ, αντί για συνήθεια.
  4. **Το κείμενο ως ξεχωριστή κατηγορία.** Οι μεγάλοι λύνουν το ίδιο πρόβλημα με δυναμικά label
     objects· εμείς, με ψημένα, το κωδικοποιούμε ως κανόνα (§M10f): γεωμετρία προβάλλεται, **τιμή
     ποτέ**. Ό,τι έχει νομική σημασία (Χ,Υ κορυφής) δεν προβάλλεται ποτέ κατά λάθος.

  ### 5. Σχέδιο υλοποίησης (σειρά, ~7-9 αρχεία, 1 domain + persistence)

  1. `project-frame.ts` (μετονομασία/γενίκευση του `topo-display-frame` + `version`, `stampOf()`,
     `frameDelta(old, new)`) — καθαρό, SSoT.
  2. `geo-reference-store` → versioned `setGeoReference` (μονότονο counter, χωρίς αλλαγή API στους
     καταναλωτές).
  3. `topo-persistence-types` + `topo-state-io` → πεδίο `bakedFrames` (ανά ομάδα· απόν = legacy).
  4. `topo-frame-reconcile.ts` — ο ΕΝΑΣ reconciler (delta-move + rebuild), καθαρός, με scene in/out.
  5. `useTopoPersistence:214` → καλεί τον reconciler αντί για σκέτο `regenerateTopoContours`.
  6. Οι τρεις bake hooks γράφουν τη σφραγίδα τους.
  7. Runtime assertion στη ραφή commit (dev-only, ζώνη ADR-635).
  8. Τεστ: επέκταση του `topo-display-frame.test.ts` (delta idempotency, μετακινημένος βορράς
     επιβιώνει, legacy χωρίς σφραγίδα = fail-closed) + capability anchor στον reconciler.

  ### 6. Ανοιχτά προς απόφαση πριν τον κώδικα
  - **Ποιος κρατά το «παλιό» frame** αν το app κλείσει ενδιάμεσα: η σφραγίδα στο persisted state
    (πρόταση) ή αντίγραφο στο scene doc; Προτείνεται το topo doc — εκεί ζουν ήδη τα προϊόντα.
  - **Legacy σκηνές** (ψημένα χωρίς σφραγίδα): fail-closed + προτροπή, ή best-effort εικασία από
    το μέγεθος των συντεταγμένων; Προτείνεται **fail-closed** (N.7.2 #3).

  **Status: §M10g — BLUEPRINT. Δεν έχει γραφτεί κώδικας. Απαιτεί έγκριση N.8 για υλοποίηση.**
