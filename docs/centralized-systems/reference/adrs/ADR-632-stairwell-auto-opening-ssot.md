# ADR-632 — Αυτόματο άνοιγμα κλιμακοστασίου σε πλάκα (Stairwell Auto-Opening)

- **Status**: In progress (Phase 0–2 DONE)
- **Date**: 2026-07-10
- **Related**: ADR-358 (Stair tool) §9.2 Q29 · ADR-363 (BIM drawing mode, slab-opening) · ADR-401 (attach-to-structural) · ADR-396 (safe polygon boolean) · ADR-594 (BIM persistence factory)

---

## 1. Context — το πρόβλημα

Σε κτίριο πολλών ορόφων, η σκάλα ανεβαίνει από όροφο σε όροφο μέσα στο
κλιμακοστάσιο. Όταν ο χρήστης τοποθετεί την **πλάκα οροφής** (slab) του επόμενου
ορόφου, αυτή «καπακώνει» τη σκάλα: χωρίς τρύπα, ο άνθρωπος δεν μπορεί να περάσει
από τον έναν όροφο στον άλλο — χτυπάει το κεφάλι.

Απαιτείται **αυτόματος** μηχανισμός: όταν μια πλάκα βρίσκεται πάνω από σκάλα, να
ανοίγει τρύπα (stairwell opening) στην πλάκα, στο σημείο όπου το **ελεύθερο ύψος
(headroom)** από τη μύτη του σκαλοπατιού μέχρι την κάτω παρειά της πλάκας πέφτει
κάτω από το νόμιμο ελάχιστο. Έτσι εξασφαλίζεται πάντα διέλευση χωρίς χτύπημα.

## 2. Νομικό ελάχιστο ελεύθερο ύψος (headroom)

Μετριέται κατακόρυφα από τη **nosing line** (γραμμή που ενώνει τις μύτες των
σκαλοπατιών) προς την κάτω παρειά του υπερκείμενου στοιχείου, συνεχώς πάνω από
όλη τη σκάλα:

| Κανονισμός | Ελάχιστο | Πηγή |
|---|---|---|
| **NOK / Ελλάδα** | **2200 mm** | Κτιριοδομικός Κανονισμός, Άρθρο 13 (Κλίμακες) |
| IBC 2018 | 2032 mm (80″) | §1011.3 Headroom |
| ADA / ICC A117.1 | 2032 mm | — |
| Eurocode / NBC / NFPA / AS1657 / DIN | 2030 mm | industry baseline |

**Απόφαση Giorgio:** default **2200 mm** (NOK). Διορθώθηκε το προϋπάρχον
`MIN_HEADROOM_MM.nok` (ήταν 2030) → **2200**. Παραμετρικό ανά code profile.

## 3. Αποφάσεις (Giorgio, 2026-07-10)

1. **Headroom default** = 2200 mm (NOK), παραμετρικό ανά profile.
2. **Πυροδότηση** = πλήρως αυτόματη (reactive): η τρύπα εμφανίζεται / ενημερώνεται
   / σβήνει μόνη της μόλις μια πλάκα καλύψει σκάλα ή αλλάξει στάθμη/θέση.
3. **Σχήμα τρύπας** = ακριβής προβολή των παραβατικών σκαλοπατιών (union), όχι
   απλό bbox.

## 4. Αλγόριθμος

Για πλάκα με top-face στα `Zt` και πάχος `T` → κάτω παρειά `Zu = Zt − T`.
Ελάχιστο `Hmin` (π.χ. 2200 mm). Για κάθε σκαλοπάτι `i` με ύψος μύτης `z_nosing(i)`:

```
clearance(i) = Zu − z_nosing(i)
παραβατικό  ⇔  clearance(i) < Hmin
```

- Άνοιγμα = `safeIntersection( safeUnion(προβολές παραβατικών treads + 1 tread
  περιθώριο), slab.outline )`.
- Όλα τα z σε mm (conversion scene-units → mm μία φορά στον engine, ADR-358 §9.2 Q22).
- x/y στις μονάδες της σκηνής (σκάλα & πλάκα μοιράζονται τη σκηνή).

## 5. Αρχιτεκτονική — reuse-first (SSoT)

Το 80% υπάρχει ήδη:

| Concern | SSoT (reused) |
|---|---|
| Οντότητα τρύπας | `SlabOpeningEntity` kind `'well'` (`slab-opening-types.ts`) |
| Visual «κόψιμο» πλάκας | `SlabRenderer.punchHostedSlabOpenings()` (destination-out) — αυτόματο |
| Geometry/undo/persistence | `computeSlabOpeningGeometry`, `buildSlabOpeningEntity`, `UpdateSlabOpeningParamsCommand`, `useSlabOpeningPersistence` (ADR-594) |
| Στάθμες σκάλας | `resolveStairVerticalProfile` + `host-footprint-eval` |
| Polygon boolean | `safe-polygon-boolean.ts` (`safeUnion`/`safeIntersection`, ADR-396) |
| Headroom threshold | **NEW SSoT** `stair-headroom-constants.ts` (κοινό validator + engine) |

### Νέα modules (Phase 0–1)
- `bim/stairs/stair-headroom-constants.ts` — `MIN_HEADROOM_MM` (nok=2200) + `resolveMinHeadroomMm`. Ο `stair-validator.ts` το εισάγει (αφαιρέθηκε το τοπικό duplicate).
- `bim/geometry/stairs/stairwell-opening-config.ts` — `STAIRWELL_OPENING_MARGIN_TREADS`, `STAIRWELL_AUTO_OPENING_KIND`.
- `bim/geometry/stairs/stair-nosing-line.ts` — `computeStairNosings` (leading-edge midpoint ανά σκαλοπάτι).
- `bim/geometry/stairs/stairwell-headroom.ts` — `evaluateStairHeadroom`, `expandViolatingRange`.
- `bim/geometry/stairs/stairwell-opening-outline.ts` — `computeStairwellOpeningOutline` (union ∩ slab).
- `SlabOpeningParams.autoStairId?` — marker: derived/managed opening (ο engine το κατέχει, δεν το πειράζει ο χρήστης).

### Νέα modules (Phase 2)
- `bim/geometry/stairs/stair-slab-overlap.ts` — pure ανιχνευτής ζεύγους «σκάλα↔πλάκα-από-πάνω»:
  - `footprintOverlapArea(a, b)` — οριζόντια επικάλυψη (reuse `safeIntersection` + `multiPolygonArea`).
  - `isSlabAboveStairBase(slab, stair)` — κατακόρυφο φίλτρο `undersideZmm > baseZmm + eps` (αποκλείει πλάκα στήριξης + κάτω ορόφους).
  - `findSlabsAboveStair(stair, slabs, opts?)` — επικάλυψη + κατακόρυφο· ταξινομημένες κατά κάτω-παρειά αύξουσα (πλησιέστερη οροφή πρώτη). Options `minOverlapArea` / `verticalEps`.
  - `findStairSlabOverlaps(stairs, slabs, opts?)` — cross-product convenience (ένα ζεύγος ανά επικάλυψη).
  - Types: `StairFootprintInput` (footprint + baseZmm/topZmm από `resolveStairVerticalProfile`), `StairwellSlabCandidate` (outline + top/underside Zmm), `StairSlabOverlap`.
- `bim/geometry/shared/polygon-utils.ts` — **NEW SSoT** `polygon3dToClipPolygon` (`Polygon3D` → clip `Polygon`). Αφαιρέθηκε το private duplicate από `stairwell-opening-outline.ts` (N.0.2/N.18 dedup)· το χρησιμοποιούν και outline (Φ1) και overlap (Φ2).

## 6. Phase plan

| Φ | Τι | Status |
|---|---|---|
| **0** | Θεμέλια: headroom SSoT (nok→2200), config, `autoStairId` marker | ✅ DONE |
| **1** | Καθαρή γεωμετρία (nosing / headroom / outline) + jest (15 tests) | ✅ DONE |
| **2** | Ανίχνευση ζεύγους σκάλα↔πλάκα-από-πάνω (`stair-slab-overlap.ts`) | ✅ DONE |
| **3** | `StairwellOpeningEngine` — derived cascade, reactive lifecycle wiring | ⏳ |
| **4** | Persistence/audit/BOQ + μη-καταστροφική συνύπαρξη + cleanup orphans | ⏳ |
| **5** | 3D + UX (badge/override/lock) + ADR finalize | ⏳ |

## 7. Google-level

- **Proactive** (Q1): η τρύπα δημιουργείται στο σωστό lifecycle moment (slab/stair change), όχι side-effect.
- **Idempotent** (Q3): ο engine ξαναϋπολογίζει· `autoStairId` εγγυάται ένα managed opening ανά σκάλα/πλάκα.
- **SSoT** (Q5): ένα headroom map, ένα boolean lib, ένα opening entity type.
- Phase 0–1: καθαρές pure συναρτήσεις, μηδέν side-effects, 15/15 jest.

## 8. Changelog

- **2026-07-10** — Phase 2 DONE. Pure ανιχνευτής `stair-slab-overlap.ts` (footprint overlap + κατακόρυφο-πάνω-από-βάση φίλτρο, sorted nearest-ceiling-first, cross-product convenience). Εξήχθη κοινό `polygon3dToClipPolygon` στο `polygon-utils.ts` (SSoT· αφαιρέθηκε private duplicate από outline module, N.0.2/N.18). +12 jest (27/27 συνολικά green), jscpd diff clean. Reuse: `safeIntersection`/`multiPolygonArea` (ADR-396), `HOST_Z_EPS` (`host-footprint-eval`), inputs από `resolveStairVerticalProfile`.
- **2026-07-10** — Phase 0 + Phase 1 DONE. Headroom SSoT (`stair-headroom-constants.ts`, nok 2030→2200), feature config, `autoStairId` marker, τρία pure geometry modules (nosing / headroom / outline), 15 jest tests (all green), jscpd clean. ADR created.
