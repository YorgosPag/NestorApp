# HANDOFF — Tekton structural import (τοίχος/παράθυρα/διάσταση): Revit-grade, FULL ENTERPRISE + FULL SSOT

**Ημερομηνία:** 2026-06-25
**ADR:** **ADR-531** (Tekton .TEK import Φ5b). ΜΗΝ ανοίξεις νέο — ενημέρωσε το ADR-531 changelog.
**Σχετικά:** ADR-526 (Tekton import Φ1–Φ5a), ADR-363 (BIM wall/opening), ADR-362 (dimensions).

---

## 0. ΑΠΑΡΑΒΑΤΟΙ ΚΑΝΟΝΕΣ (διάβασέ τους ΠΡΩΤΑ)
- **Απαντάς ΕΛΛΗΝΙΚΑ** πάντα.
- **ΟΧΙ commit / ΟΧΙ push** — ο Giorgio κάνει commit, όχι εσύ (N.(-1)). Ετοίμασε, μην committάρεις.
- **ΟΧΙ `--no-verify`** (N.(-1.1)).
- **Το working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent.** Άγγιξε ΜΟΝΟ τα αρχεία αυτού του task· μην πειράξεις
  άσχετες uncommitted αλλαγές.
- **N.17 — ΕΝΑ tsc τη φορά** (έλεγξε `Get-CimInstance Win32_Process … *tsc*` πριν τρέξεις· background).
- **N.14 — μοντέλο:** πες Opus για το πλάνο/αρχιτεκτονική, περίμενε «ok».
- **SSoT ΠΡΩΤΑ (ρητή εντολή Giorgio):** «**ΠΡΙΝ την υλοποίηση κώδικα κάνεις ΠΡΑΓΜΑΤΙΚΟ SSOT AUDIT
  (grep)** για να δεις αν υπάρχει ήδη αντίστοιχος κώδικας, να τον χρησιμοποιήσεις, να ΜΗΝ δημιουργήσεις
  διπλότυπα.» → §4 έχει έτοιμα τα targets, αλλά **επαλήθευσέ τα με grep μόνος σου**.
- **Ποιότητα:** «**όπως οι μεγάλοι παίκτες, όπως η Revit**· FULL ENTERPRISE + FULL SSOT.»

---

## 1. ΤΟ ΖΗΤΟΥΜΕΝΟ
Εισαγωγή κάτοψης Τέκτονα (`.tek`) ώστε **3Δ τοίχος + κουφώματα (παράθυρα) + διάσταση** να αποδίδονται
**όπως η Revit** — σωστά, παραμετρικά, Revit-grade. Ο Giorgio έδωσε δείγμα:
`C:\Users\user\Downloads\Ισόγειο 312.tek.txt` (1 τοίχος 5.03m, **2 παράθυρα με ποδιά 1μ**, 1 διάσταση 2.10m).

---

## 2. 🔴 ΤΡΕΧΟΥΣΑ ΚΑΤΑΣΤΑΣΗ — ΔΙΑΒΑΣΕ ΠΡΟΣΕΚΤΙΚΑ

### Τι έχει γίνει (COMMITTED από Giorgio):
- `431e9412` — **Φ5b.1** (extract `<dim>`/`<wall>`/`<open>` + 2Δ mappers ωμές γραμμές).
- `3573fec8` — **Φ5b.1+** (faithful 2Δ σύμβολο: wall-cutouts + window glass + dimension ticks/witness/text).
- io/tek working tree **καθαρό** (όλος ο κώδικας committed). Μόνο το `ADR-531.md` changelog είναι
  uncommitted (μικρή αλλαγή).
- **Tests: 26 jest GREEN** (io/tek/__tests__: structural-extract, structural-to-scene, window-symbol,
  dimension-symbol, import). **tsc 0** στα io/tek.

### ⚠️ ΤΟ ΠΡΟΒΛΗΜΑ (γιατί ο Giorgio λέει «ΠΑΛΙ ΤΑ ΙΔΙΑ»):
Ο Giorgio έκανε import + export 2 φορές (`Ισόγειο 312-ΝΕΣΤΟΡ.tek.txt`, `…ΝΕΣΤΟΡ-2.tek.txt`). **ΚΑΙ ΟΙ
ΔΥΟ exports δείχνουν το ΠΑΛΙΟ Φ5b.1** (12 line records: 80BCFC×4 wall + 50A490×6 jambs + 00FF00×2 dim),
**ΟΧΙ** το faithful Φ5b.1+ (που θα έβγαζε ~24 lines + μπορντώ ticks). Δηλαδή **η εφαρμογή του τρέχει
παλιό build** — ο committed faithful κώδικας **ΔΕΝ έχει επαληθευτεί ποτέ live**.

➡️ **ΠΡΩΤΟ ΒΗΜΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ:** ζήτα από τον Giorgio να **κάνει rebuild/restart το dev server** και
ξανα-import, ΓΙΑ ΝΑ ΔΕΙΤΕ τι πραγματικά κάνει ο faithful κώδικας. Μπορεί να είναι ήδη ΟΚ, μπορεί όχι.

---

## 3. 🎯 ΣΤΡΑΤΗΓΙΚΗ ΑΠΟΦΑΣΗ (ΤΟ ΠΙΟ ΣΗΜΑΝΤΙΚΟ — confirm με Giorgio ΠΡΩΤΑ)

Υπάρχει **σύγκρουση κατεύθυνσης** που πρέπει να λυθεί ΠΡΙΝ γράψεις κώδικα:

- **Δρόμος Α — Faithful 2Δ replay (ΤΟ ΤΡΕΧΟΝ committed code):** χτίζω γραμμές/κείμενο που μιμούνται
  το σχέδιο Τέκτονα. ⚠️ **Πρόβλημα SSOT:** ξαναϋλοποιεί ό,τι κάνουν ΗΔΗ οι BIM renderers (wall cutouts,
  door-swing/glazing, dimension arrows/witness/text) → **διπλότυπη λογική**, ΟΧΙ «FULL SSOT».
- **Δρόμος Β — BIM entities (Revit-grade, FULL SSOT) ✅ ΣΥΝΙΣΤΩΜΕΝΟ:** map Tekton →
  **υπάρχοντα** `WallEntity`/`OpeningEntity`/`DimensionEntity` → οι **υπάρχοντες** renderers ζωγραφίζουν
  τα σύμβολα. **Αυτό κάνει η Revit** (import → BIM objects, redraw με δικά της σύμβολα). Μηδέν διπλότυπο.

**ΣΥΣΤΑΣΗ (100% ειλικρίνεια):** Η ρητή εντολή Giorgio «like Revit + FULL SSOT + όχι διπλότυπα» δείχνει
**Δρόμο Β (BIM)**. Ο faithful-2Δ (Δρόμος Α) ήταν προηγούμενη επιλογή του («ακριβώς όπως Τέκτονας»), αλλά
**αντιφάσκει** με το FULL SSOT. **Ξεκαθάρισε ΡΗΤΑ με τον Giorgio** ποιο θέλει:
> «Θες (Α) ακριβές pixel σύμβολο Τέκτονα [διπλότυπη λογική] ή (Β) σωστά BIM παράθυρα/τοίχοι/διαστάσεις
> που τα ζωγραφίζει ο Νέστορας με τα δικά του σύμβολα [Revit-grade, FULL SSOT, αλλά όχι pixel-Τέκτονα];»

Αν διαλέξει **Β**: ο extraction layer (§5) μένει, αλλάζει ΜΟΝΟ ο mapper → BIM. Ο faithful-2Δ mapper
αφαιρείται/γίνεται fallback.

---

## 4. SSoT AUDIT — ΥΠΑΡΧΟΝΤΑ BIM building blocks (ΕΠΑΛΗΘΕΥΣΕ ΜΕ GREP, reuse — ΜΗΝ διπλασιάσεις)
*(Βρέθηκαν με Explore agents· κάνε grep να επιβεβαιώσεις γραμμές πριν τα χρησιμοποιήσεις.)*

**Τοίχος:**
- `createWall(input)` → `src/services/factories/wall.factory.ts` (~γρ.136)· id `generateWallId()`.
- `WallParams`/`WallEntity` → `src/subapps/dxf-viewer/bim/types/wall-types.ts` (params: `category,
  start:Point3D, end:Point3D, height(mm), thickness(mm), flip, baseBinding:'storey-floor',
  topBinding:'storey-ceiling', baseOffset, topOffset, sceneUnits:'mm'`).
- **ΥΠΟΧΡΕΩΤΙΚΟ geometry:** `computeWallGeometry(params,'straight')` → `bim/geometry/wall-geometry.ts`
  (~γρ.82) γεμίζει `geometry` (outerEdge/innerEdge/axis) — απαραίτητο για render + cutouts.

**Κούφωμα (παράθυρο):**
- `createOpening(input)` → `src/services/factories/opening.factory.ts` (~γρ.88)· id `generateOpeningId()`.
- `OpeningParams`/`OpeningKind` → `bim/types/opening-types.ts` (params: `kind:'window', wallId(FK),
  offsetFromStart(mm)=προβολή θέσης στον άξονα τοίχου, width, height=top−elevation, sillHeight=elevation
  (1m=1000mm), glazingPanes?, frameWidth?`). **Και τα 2 = `'window'`** (Giorgio: «και τα δύο παράθυρα
  με ποδιά 1μ»).
- **ΥΠΟΧΡΕΩΤΙΚΟ geometry:** `computeOpeningGeometry(params, hostWall, 'mm')` → `bim/geometry/
  opening-geometry.ts` (~γρ.48) — υπολογίζει cutout/glazing/swing ΑΥΤΟΜΑΤΑ.
- **Hosting ΑΥΤΟΜΑΤΟ:** το `openingsByWall` index χτίζεται per-frame (`buildOpeningsByWall` →
  `EntityRendererComposite.setOpeningsByWall`). Ο importer ΔΕΝ χρειάζεται `hostedOpeningIds`.
  Renderers: `bim/renderers/WallRenderer.ts` (punchHostedOpenings cutouts), `OpeningRenderer.ts` (glazing).

**Διάσταση:**
- `AlignedDimensionEntity` → `src/subapps/dxf-viewer/types/dimension.ts` (~γρ.366). Hand-built literal:
  `{id, type:'dimension', dimensionType:'aligned', layerId, styleId:'dimstyle_iso_129',
  defPoints:[p0, p1, dimLineRef]}` (3 σημεία· dimLineRef = μέσο + κάθετο offset). 100% pure.
- Default style id `'dimstyle_iso_129'` → `systems/dimensions/dim-style-templates.ts` (πάντα στο registry).
- Renderer `rendering/entities/DimensionRenderer.ts` ζωγραφίζει βελάκια/witness/κείμενο ΑΥΤΟΜΑΤΑ από
  defPoints+style. Καμία per-frame ρύθμιση δεν χρειάζεται.

**Coordinate SSoT (reuse):** `tekMetersToScene(x,y,units)` (Y-flip+meters→mm), `metersToScene(scalar)`
→ `src/subapps/dxf-viewer/export/core/tek/tek-geometry.ts`. `colorHex6` → `tek-xml-writer.ts`.

---

## 5. EXTRACTION LAYER — ΕΤΟΙΜΟ & REUSABLE (μένει ό,τι δρόμο και να πάρεις)
`src/subapps/dxf-viewer/io/tek/tek-structural-extract.ts` διαβάζει ΗΔΗ:
- **Wall** (type 1): matrix (start=(x20,x21), u=(x00,x01) μήκος, v=(x10,x11) πάχος), height, elevation,
  inner_width, openings[].
- **Opening** (type 2): matrix (x00=πλάτος), elevation(περβάζι), top(ανώφλι), style, side, frame_width,
  frame_thickness, jamb_width, jamb_thickness, ledge_height, color.
- **Dimension** (type 0): segs (end0/end1/gap0/gap1/s/xmatrix), color, size, end_style, refPoints (inter pX/pY).

Types: `tek-import-types.ts` (`TekWallRecord`/`TekOpeningRecord`/`TekDimRecord`/`TekDimSeg`).
Helpers exported: `recordsInFloors`/`isEntityType`/`readXMatrix` (στο `tek-primitive-extract.ts`).

### Πραγματικές τιμές δείγματος (από `Ισόγειο 312.tek.txt`):
- Τοίχος: x00=5.03 (μήκος), x11=0.25 (πάχος band), start=(-8.25, 0.58)· inner_width=0.09.
- Παράθυρο#1: x00=1.4 (πλάτος), pos=(-7.86, 0.73), elevation=1, top=2.2, style=1, side=3, frame_width=0.15,
  frame_thickness=0.03, jamb_width=0.05, jamb_thickness=0.05, ledge_height=0.03.
- Παράθυρο#2: x00=-1.4, pos=(-4.16, 0.73), style=0, side=2.
- Διάσταση: p0=(-2.214,6.984), p1=(-0.114,6.984), |Δ|=2.10, size=0.159, end_style=8, color=00FF00, format=%.2lf.

⚠️ **Σημείωση exporter:** ο `.tek` exporter (`export/core/tek/dxf-to-tek.ts`) γράφει ΜΟΝΟ line/arc/circle —
**όχι text, όχι BIM**. Άρα το round-trip export ΔΕΝ είναι αξιόπιστος έλεγχος για BIM/κείμενο· ο σωστός
έλεγχος είναι **οπτικά στον καμβά** (screenshots).

---

## 6. ΑΡΧΕΙΑ (committed, io/tek)
- `tek-structural-extract.ts` (extractors) · `tek-structural-to-scene.ts` (faithful-2Δ mapper — Δρόμος Α)
- `tek-window-symbol.ts` · `tek-dimension-symbol.ts` (pure γεωμετρία — Δρόμος Α· ΑΦΑΙΡΟΥΝΤΑΙ αν Δρόμος Β)
- `tek-import-types.ts`, `tek-scene-extract.ts`, `tek-scene-builder.ts`, `tek-import.ts`, `tek-primitive-extract.ts` (additive)
- `__tests__/{tek-structural-extract,tek-structural-to-scene,tek-window-symbol,tek-dimension-symbol,tek-import}.test.ts`

---

## 7. ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ (προτεινόμενη σειρά)
1. **Giorgio rebuild** dev server + re-import → δες live τι κάνει ο committed faithful (§2).
2. **Ξεκαθάρισε Α vs Β** με Giorgio (§3) — ΚΡΙΣΙΜΟ πριν κώδικα.
3. **Πραγματικό grep SSoT audit** (§4 targets) — επιβεβαίωσε signatures.
4. Αν **Β (BIM)**: νέο `tek-structural-to-bim.ts` → `createWall`+`computeWallGeometry`,
   `createOpening`+`computeOpeningGeometry`, `AlignedDimensionEntity`· switch το `tek-scene-builder.ts`·
   αφαίρεσε faithful-2Δ mapper+symbol modules (dead). Colocated tests. ADR-531 changelog.
5. Plan Mode (5+ αρχεία, 2 domains) → παρουσίασε πλάνο πριν υλοποιήσεις.
6. tsc background (N.17). Browser-verify (Giorgio). Commit (Giorgio).

## 8. ΔΕΙΓΜΑΤΑ / ANCHORS
- Δείγμα: `C:\Users\user\Downloads\Ισόγειο 312.tek.txt` (original), `…ΝΕΣΤΟΡ-2.tek.txt` (Nestor export = παλιό build).
- Στιγμιότυπα σύγκρισης: `C:\Nestor_Pagonis\Στιγμιότυπο οθόνης 2026-06-25 211319.jpg` (Νέστορας export σε
  Τέκτονα), `…211345.jpg` (πρωτότυπο Τέκτονα: παράθυρα + διάσταση 4.20 με μπορντώ βελάκια).
- ADR-040 ΔΕΝ απαιτείται (io/tek δεν πέφτει σε CHECK 6B/6D).
