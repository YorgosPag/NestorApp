# ADR-533 — DXF symbol → BIM opening detector (πόρτα/παράθυρο σε τοίχο)

**Status:** Accepted (v1 implemented, uncommitted) · **Date:** 2026-06-25
**Sibling:** [[ADR-531]] (Tekton .TEK import — faithful window/wall symbol)

## Context

Ο χρήστης φορτώνει 2D **κατόψεις DXF** (wizard «Εισαγωγή κάτοψης», καρτέλα Επίπεδα). Η κάτοψη
περιέχει σχεδιασμένα **σύμβολα κουφωμάτων** (γραμμές + τόξα) πάνω/μέσα στο πλαίσιο ενός τοίχου.
Μέχρι τώρα, όταν ο χρήστης σχεδίαζε τοίχο πάνω σε αυτό το πλαίσιο, το σύστημα **αγνοούσε** το
σύμβολο· κάθε πόρτα/παράθυρο έπρεπε να μπει χειροκίνητα.

Στόχος: μόλις τοποθετηθεί τοίχος, να **αναγνωρίζεται γεωμετρικά** το σύμβολο και να **προτείνεται**
(confirm) η δημιουργία πραγματικού `OpeningEntity`. Πηγή = **σκέτη DXF γεωμετρία** (όχι δομημένα
records). Τα Tekton `TekOpeningRecord` θα συνδεθούν αργότερα — στον **ίδιο** resolver.

## Decision

Νέος **πηγή-ανεξάρτητος** καθαρός detector = το **ανάστροφο** του `buildDoorSymbolSegments`
(ADR-531). Αρχιτεκτονική 4 στρωμάτων, reuse-first, χωρίς νέο subsystem:

1. **Detector** — `bim/walls/dxf-symbol-detector.ts` · `detectSymbolsOnWall(wallStart, wallEnd,
   wallThicknessScene, candidates, opts?) → DetectedOpening[]`. Zero React/EventBus/store.
2. **Gatherer** — `bim/walls/dxf-symbol-gatherer.ts` · `gatherSymbolCandidates(wall, scene,
   marginScene)` → lines/arcs εντός διευρυμένου AABB (`aabbIntersectsRaw` SSoT).
3. **Confirm store + dialog** — `bim/walls/dxf-symbol-detect-confirm-store.ts` (πάνω στο SSoT
   `createConfirmStore`) + `ui/dialogs/DxfSymbolDetectConfirmDialog.tsx` (self-subscribing). Απόφαση
   Giorgio: **ένα-ένα** prompt (τύπος/πλάτος/φορά ανά κούφωμα → Ναι/Παράλειψη).
4. **Host** — `app/DxfSymbolDetectHost.tsx` (render null, mounted στο `DxfViewerTopBar`). Ακούει
   `drawing:entity-created {tool:'wall'}` (το event που εκπέμπει το `addWallToScene`· **όχι**
   `drawing:complete`), gather→detect→sequential prompt→create.

### Δημιουργία ανοίγματος (full SSoT reuse)
- `completeOpeningFromHostClick(wall, axisPoint, layerId, overrides, units)` (build params +
  `computeOpeningGeometry` + validate).
- `buildOpeningResolvers(levelManager).onOpeningCreated(entity)` — scene-add + wall
  `hostedOpeningIds` mirror + `drawing:entity-created {tool:'opening'}` → ο υπάρχων
  `OpeningPersistenceHost` αναλαμβάνει Firestore persistence. **Μηδέν** διπλό persistence path.

### Σήμα συμβόλου (γεωμετρία)
- **Πόρτα:** τόξο ~90° + φύλλο (γραμμή κέντρο→κάθετο άκρο, μήκος ≈ ακτίνα). Κέντρο = μεντεσές στην
  παρειά· κλειστό άκρο κατά μήκος τοίχου, ανοιχτό κάθετο. Τεταρτημόριο → `handing`/`openDirection`.
  Χορδή → πλάτος.
- **Παράθυρο:** 2+ γραμμές **παράλληλες** στον τοίχο που γεφυρώνουν το κενό (υαλοπίνακας), σε ≥2
  διαφορετικά perp-offsets, μήκος < ολόκληρος ο τοίχος (αλλιώς = παρειές τοίχου).

### `DetectedOpening`
`{ kind:'door'|'window', tCenter:[0,1], widthScene, handing?, openDirection?, sourceEntityId }`.
Ο host μετατρέπει `widthScene → mm` (`/ mmToSceneUnits(units)`) και `tCenter → axisPoint` (γραμμική
παρεμβολή start→end) πριν τα `OpeningParamOverrides`.

## Ανοχές (λόγοι → unit-independent· calibration constants)

| Σταθερά | Default | Ρόλος |
|---|---|---|
| `arcCenterBandRatio` | 1.5 | μέγιστη \|perp\| κέντρου-τόξου από άξονα, × πάχος |
| `arcSpanToleranceDeg` | 25° | απόκλιση γωνίας τόξου από 90° |
| `leafMatchRatio` | 0.25 | ανοχή άκρων φύλλου, × ακτίνα (ή ≥ 0.5×πάχος) |
| `windowParallelDot` | 0.97 | ελάχιστο \|dot\| «παράλληλη στον τοίχο» |
| `windowFaceBandRatio` | 1.5 | μέγιστη \|perp\| γραμμής υαλοπίνακα, × πάχος |

## Γιατί ΟΧΙ `FloorplanSymbolEntity` ως ενδιάμεσο
Το `FloorplanSymbolEntity` είναι για catalog/annotative σύμβολα, όχι για εφήμερο αποτέλεσμα
αναγνώρισης. Τα ανιχνευμένα κουφώματα πάνε **κατευθείαν** σε `OpeningParams` (μία μετατροπή).

## Risks / calibration
- **Πολυγραμμικά τόξα (bulge):** κάποια DXF εξάγουν το τόξο ως polyline με bulge, όχι `ArcEntity`.
  v1 πιάνει `ArcEntity`· pre-process polyline→arc = **Φάση 2** (χωρίς αλλαγή υπογραφής detector).
- **`arcCenterBandRatio`:** η πιο ευαίσθητη παράμετρος (false neg/pos) — calibrate σε πραγματικά DXF.
- **`handing`/`openDirection`:** η αντιστοίχιση left/right & inward/outward είναι convention-dependent
  → browser-verify σε δείγμα του Giorgio (το per-opening confirm κάνει το λάθος χαμηλού κόστους).
- **Σύμβολο σε συμβολή 2 τοίχων:** μελλοντικό dedup με `getSiblingOpeningsOnWall` (Φάση 2).

## Tests
- `bim/walls/__tests__/dxf-symbol-detector.test.ts` (16) — door (handing/dir/CCW), rejections, window,
  multi, empty. Fixtures = ίδια γεωμετρία με `buildDoorSymbolSegments` (oracle).
- `bim/walls/__tests__/dxf-symbol-gatherer.test.ts` (4) — band include/exclude, mixed, non-line/arc.

## Architecture notes (CHECK 6)
ΔΕΝ αγγίζει κανένα CHECK-6D-protected αρχείο (host στο `DxfViewerTopBar`). ADR-040 μη-ενεργό
(zero high-freq subscriptions· pure geometry).

## Changelog
- **2026-06-25 — v1 (uncommitted):** detector + gatherer + confirm store/dialog + host + i18n
  (el/en `dxfSymbolDetect`) + 20 jest GREEN. Πόρτα + παράθυρο, ένα-ένα prompt. 🔴 browser-verify
  (calibration ανοχών σε πραγματικά DXF του Giorgio) + commit.
