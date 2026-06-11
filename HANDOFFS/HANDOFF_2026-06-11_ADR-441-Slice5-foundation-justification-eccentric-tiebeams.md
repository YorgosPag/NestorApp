# HANDOFF — ADR-441 Slice 5: Foundation Justification + έκκεντρα πέδιλα + συνδετήριες (tie-beams)

**Date:** 2026-06-11 · **Branch:** main · **Shared working tree** (άλλος agent δουλεύει ταυτόχρονα — grips/snapping: rotation/grip-temperature/SnapEngine) · **Μοντέλο: Opus**

> 🎯 **ΕΝΤΟΛΗ GIORGIO:** «ΟΠΩΣ ΟΙ ΜΕΓΑΛΟΙ ΠΑΙΧΤΕΣ, ΟΠΩΣ Η REVIT — ΥΛΟΠΟΙΗΣΗ ΜΕ ΣΥΣΤΗΜΑ, FULL ENTERPRISE + FULL SSOT.» **SEARCH FIRST** (τα signatures στο §2 είναι επιβεβαιωμένα 2026-06-11 — code=SoT· ξανα-confirm μόνο αν κάτι δεν ταιριάζει). Απάντα **ΕΛΛΗΝΙΚΑ**.
>
> ⚠️ **ΚΑΝΟΝΕΣ (απαράβατοι):** ΠΟΤΕ `git commit`/`push` — **ο Giorgio κάνει commit**. `git add` **ΜΟΝΟ τα δικά σου αρχεία**, **ΠΟΤΕ `-A`** (shared tree — μην αγγίξεις grips/snapping/rotation αρχεία άλλου agent). **N.17: ΕΝΑ tsc τη φορά** (έλεγξε process πρώτα· `Get-CimInstance Win32_Process … *tsc*`). function ≤40γρ, file ≤500γρ, no `any`/`as any`/`@ts-ignore`, i18n ICU. **N.17 lesson:** ΠΟΤΕ `tsc … | head` — επιστρέφει exit code του `head` (0) και κρύβει errors· γράψε σε αρχείο και grep το.

---

## 0. ΔΙΑΒΑΣΕ ΠΡΩΤΑ (Recognition — N.0.1 Phase 1)
1. **`ADR-441-foundation-strip-grid-auto-design.md`** — §8.2/§8.6 (κεντρικά vs **έκκεντρα** πέδιλα + strap/balanced beams), §10 **Slice 5** (γρ.207, το scope αυτού του handoff), §10 Slices 0-4+JOIN (τι υπάρχει ήδη).
2. **`ADR-436-…foundation.md`** — BIM Foundation Discipline (pad/strip/tie-beam geometry, grips, persistence, validator). Το Slice 5 επεκτείνει αυτά.
3. **`ADR-040-preview-canvas-performance.md`** — ΜΟΝΟ αν αγγίξεις renderer/canvas/scene-write/guide-render (grips ναι· geometry/params όχι). Stage ADR-040 αν χρειαστεί (CHECK 6B/6D).
4. Αυτό το handoff (§2 signatures· §3 σχέδιο).

---

## 1. ΤΙ ΕΓΙΝΕ ΗΔΗ (DONE — μένει browser-verify+commit από Giorgio)
- **ADR-441 Slices 0+1+2+3+JOIN+4 DONE.** v1 = associative grid hosting + εσχάρα από κάναβο + follow-on-move + corner-fill γωνιών + BOQ net-volume. Slice 1 rules/indexes **DEPLOYED**.
- **Foundation στο schedule (Slice 4 + ADR-363 Phase 8 CONTENT):** `mapFoundation`, `FOUNDATION_COLUMNS`, `PRESET_REGISTRY['foundation']`, net όγκος μέσω `applyFoundationGridNet`. Στο combined view η θεμελίωση τώρα δίνει ΑΤΟΕ (`OIK-2.02` pad/strip, `OIK-2.04` tie-beam, m³) μέσω **NEW** `resolveFoundationMapping` (`bim/config/bim-to-atoe-mapping.ts`, εκτός `BimEntityType` bridge-contract).
- **ΕΠΙΒΕΒΑΙΩΜΕΝΟ:** `computeFoundationGeometry` (`bim/geometry/foundation-geometry.ts`) **υπολογίζει `volume`** (area × thickness) → τα foundation entities έχουν geometry.volume· ο όγκος εμφανίζεται στο schedule.

## 1.1 ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΛΥΝΕΙΣ (Slice 5)
Σήμερα **όλες** οι πεδιλοδοκοί είναι **κεντρικές (concentric)** στον άξονα του κανάβου (`±w/2` εκατέρωθεν) — δομικά ιδανικό default. ΑΛΛΑ σε **όριο οικοπέδου / υπάρχον κτίριο** το `w/2` overhang **περνά το όριο** → ο μηχανικός χρειάζεται **έκκεντρο** πέδιλο (ανάπτυξη μόνο προς τα μέσα). Revit-grade = παράμετρος **Justification/Alignment** ανά στοιχείο. Η εκκεντρότητα δημιουργεί **ροπή** → απαιτεί **συνδετήριες/strap beams** για ισορροπία.

**ΣΤΟΧΟΣ (Revit-grade):** Justification ανά πεδιλοδοκό/πέδιλο (`center` default | `inner-face` | `outer-face` | signed offset), follow-move-safe (επιβιώνει re-derive του Slice 3), persist, grip/UI για ρύθμιση, + tie-beam ισορρόπησης σε έκκεντρα.

---

## 2. SSoT / SIGNATURES — REUSE αυτούσια (ΕΠΙΒΕΒΑΙΩΜΕΝΑ 2026-06-11)

| Τι | Πού | Σημείωση |
|---|---|---|
| **Foundation params** | `bim/types/foundation-types.ts` | `FoundationCommonParams` (topElevationMm/thicknessMm/material/sceneUnits/storeyId)· `StripFootingParams` (kind:'strip', `start`/`end` mm world, `width`)· `PadFootingParams` (position/width/length/rotation/**`anchor: FoundationAnchor` 9-pos** center\|n\|s\|e\|w\|nw\|ne\|sw\|se/profile)· `FoundationKind='pad'\|'strip'\|'tie-beam'`. **Εδώ μπαίνει το νέο `justification`.** |
| **Geometry (SSoT)** | `bim/geometry/foundation-geometry.ts` `computeFoundationGeometry` → `buildBandFootprint` (strip/tie-beam: band start→end × width, **centered στον centerline**) / `buildPadFootprint` (rect+anchor+rotation). Υπολογίζει footprint/bbox/area/**volume**/thickness. | **Εδώ honor-άρεις το justification** = perpendicular offset του band σχετικά με τον άξονα (shift centerline κατά signed amount· `inner-face`=±w/2). ΜΗΝ αλλάξεις την υπογραφή· πρόσθεσε perpendicular-offset λογική. |
| **Hosting binding (SSoT)** | `bim/hosting/guide-binding-types.ts` `GuideBinding { guideId, slot, extend? }`· slot ∈ start-x/start-y/end-x/end-y/center-x/center-y· `hasGuideBindings`/`extractBoundGuideIds` | Το **`extend?` (signed mm) = ο μηχανισμός εκκεντρότητας** (ADR-441 §10 Slice 5): signed offset coordinate σχετικά με άξονα. Ίδιο SSoT που έκλεισε corner-fill (Slice JOIN). |
| **Derive (follow-move-safe)** | `bim/hosting/derive-params-from-guides.ts` `deriveFoundationParamsFromGuides(params, bindings, getOffset)` — slot→coordinate writes, honor `extend` με mm→scene (`mmScaleFor`), idempotent | **ΚΡΙΣΙΜΟ:** το justification ΠΡΕΠΕΙ να επιβιώνει του re-derive (όπως το corner-fill extend). Πέρασέ το ως binding-`extend` ΟΧΙ ως σκέτη αλλαγή start/end (αλλιώς το follow-move το ακυρώνει). |
| **Grid build** | `bim/foundations/foundation-from-grid.ts` `buildStripGridFromGuides` (strips born-hosted, slot-based bindings, corner-fill `±w/2` σε γωνιακά endpoints, helpers `emitVerticalStrips`/`emitHorizontalStrips`) | Εδώ εφαρμόζεται default justification στις **περιμετρικές** λωρίδες (boundary detection: extreme-parallel-axis). |
| **Grips** | `bim/foundations/foundation-grips.ts` (strip start/end/line-width· pad corners+rotation) | Πρόσθεσε grip/handle για justification toggle (ή properties panel). Touch grips → **stage ADR-040**. |
| **Validator** | `bim/…/validateFoundationParams` (δες ADR-436) | Επέκτεινε για το νέο πεδίο (allowlist/range). |
| **Completion/defaults** | `hooks/drawing/foundation-completion.ts` `buildFoundationEntity`/`buildDefaultFoundationParams`/`completeFoundationFromTwoClicks` | default `justification:'center'`. |
| **Persistence** | `foundation-firestore-service.ts` (`entityToSaveInput`/`FoundationDoc`) + `useFoundationPersistence.ts` (`docToEntity`) | round-trip του νέου πεδίου (+ binding.extend ήδη round-trips από Slice 3). firestore.rules create = `hasAll` allowlist — έλεγξε αν χρειάζεται προσθήκη πεδίου. |
| **tie-beam** | `kind:'tie-beam'` υπάρχει ήδη (geometry/3Δ/validator/move = total over 3 kinds, ADR-436 Slice 2) | Slice 5c: auto-generate strap/συνδετήρια σε έκκεντρα. ΜΗΝ φτιάξεις νέο kind. |

---

## 3. ΣΧΕΔΙΟ — Slice 5 (FULL SSoT, phased· έγκριση ανά phase από Giorgio)

### Slice 5a — Justification παράμετρος (έκκεντρες πεδιλοδοκοί) — ΚΥΡΙΟ ΠΡΩΤΟ
1. **Param:** πρόσθεσε `justification?: 'center' | 'inner-face' | 'outer-face'` (ή signed `eccentricityMm`) στο `FoundationCommonParams` (ή strip-specific). Default `'center'` (backward-compatible — optional). Zod schema (`guide-binding.schemas`/foundation schema) `.optional()`.
2. **Geometry (SSoT):** στο `buildBandFootprint`, offset του band **κάθετα** στον άξονα κατά signed amount (π.χ. `inner-face` → centerline shift `+w/2` προς τα μέσα ώστε η μία παρειά να πέφτει στον άξονα). Pure, idempotent. Καμία αλλαγή σε pad path.
3. **Follow-move-safe (ΚΡΙΣΙΜΟ):** εξέφρασε την εκκεντρότητα ως **`GuideBinding.extend`** στο perpendicular-coordinate slot (όχι σκέτη start/end αλλαγή) ώστε να επιβιώνει του `deriveFoundationParamsFromGuides`. Mirror ακριβώς τη φιλοσοφία corner-fill (Slice JOIN).
4. **Grid default:** στο `buildStripGridFromGuides`, οι **περιμετρικές** λωρίδες (boundary = extreme parallel axis) παίρνουν `inner-face` αυτόματα (αλλιώς overhang έξω από το περίγραμμα)· εσωτερικές = `center`.
5. **Grips/UI:** grip-toggle ή contextual panel για αλλαγή justification ανά επιλεγμένη λωρίδα (touch grips/canvas → **stage ADR-040**). i18n el/en (ICU).
6. **Validator + persistence + defaults** (βλ. §2).
7. **Tests:** geometry net/offset (jest) + derive idempotency (extend) + grid boundary default.

**Αποτέλεσμα 5a:** περιμετρικές πεδιλοδοκοί μένουν εντός ορίου· follow-move ανέπαφο· schedule όγκος σωστός.

### Slice 5b — Έκκεντρα πέδιλα (pad) — follow-on
Το `PadFootingParams.anchor` (9-position) **υπάρχει ήδη** — έλεγξε αν το `buildPadFootprint` το honor-άρει για boundary pads· αν ναι, 5b είναι κυρίως UI/default-wiring (anchor σε boundary). Reuse `FoundationAnchor`, ΜΗΝ νέο μοντέλο.

### Slice 5c — Συνδετήριες / strap beams ισορρόπησης — follow-on
Auto-generate `tie-beam` (υπάρχον kind) που συνδέει έκκεντρο πέδιλο με γειτονικό (balanced/strap), παραλαμβάνει ροπή εκκεντρότητας. Mirror `buildStripGridFromGuides` orchestration (atomic `CreateFoundationsCommand`). ADR §8.6.

### 3.4 ΣΕΙΡΑ (incremental, tsc serialized)
param+schema → geometry honor → derive extend (follow-move) → grid boundary default → grips/UI → validator/persistence/defaults → tests → tsc → browser. **Έγκριση Giorgio ανά phase (5a → 5b → 5c).**

### 3.5 ΡΙΣΚΑ
1. **Follow-move regression:** αν η εκκεντρότητα μπει ως start/end αντί `extend`, το Slice 3 derive την ακυρώνει σε κάθε move άξονα. **Πάντα μέσω `extend`.**
2. **BOQ net-volume:** το `foundationStripNetGeometry` (Slice 4) υποθέτει centered overlap· με έκκεντρες λωρίδες οι επικαλύψεις κόμβων αλλάζουν → επαλήθευσε το net math (ή gate σε center-only για v1).
3. **Boundary detection:** «περιμετρική λωρίδα» = extreme parallel axis· πρόσεξε non-uniform grids.
4. **shared tree:** άλλος agent στα grips/snapping — git add ΜΟΝΟ δικά σου, ΟΧΙ -A.

---

## 4. ΚΑΝΟΝΕΣ / WORKING TREE
- **Δικά σου (αναμενόμενα):** `bim/types/foundation-types.ts`, `bim/types/guide-binding.schemas.ts`, `bim/geometry/foundation-geometry.ts`, `bim/hosting/derive-params-from-guides.ts`, `bim/foundations/foundation-from-grid.ts`, `bim/foundations/foundation-grips.ts` (+ADR-040), `hooks/drawing/foundation-completion.ts`, validator, `foundation-firestore-service.ts`, `useFoundationPersistence.ts`, i18n el/en, + tests.
- **ΑΛΛΟΥ agent (ΜΗΝ αγγίξεις):** rotation/grip-temperature/GripColorManager/BaseEntityRenderer/SnapContext/SnapEngine/RotationSnapEngine/color-config/tolerance-config/phase-manager. **ΠΟΤΕ `git add -A`.**
- N.15 docs: ADR-441 §10 Slice 5 changelog (τι έγινε) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (τι εκκρεμεί, 1-2 γρ.) + MEMORY [[project_adr441_foundation_strip_grid]]. **ΜΗΝ** adr-index (shared tree).
- **COMMIT ΤΟΝ ΚΑΝΕΙ Ο GIORGIO.**

## 5. QUICK START
1. Recognition: ADR-441 §8.6 + §10 Slice 5 + §2 signatures αυτού του handoff (code=SoT).
2. `git status` (Slices 0-4+JOIN + schedule content ΗΔΗ committed/working· grips/snapping από άλλον agent — μην τα αγγίξεις).
3. Πρότεινε στον Giorgio το σχέδιο **Slice 5a** (Plan Mode αν 3-5+ αρχεία) → έγκριση → incremental (§3.4). tsc serialized (ΟΧΙ `| head`). ΜΗΝ commit/push.
4. Browser-verify: σχεδίασε εσχάρα → επίλεξε περιμετρική πεδιλοδοκό → justification `inner-face` → η παρειά πέφτει στον άξονα (όχι overhang) → μετακίνησε τον άξονα → η εκκεντρότητα **επιβιώνει** (follow-move-safe) → schedule όγκος σωστός.
