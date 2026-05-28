# ADR-393 — BIM Stair Extended Parametric Grips (Industry-Aligned Symmetric Pattern)

**Status**: 🟢 IMPLEMENTED v1 + 🟡 v2 Phase 1 DONE / Phase 2 PENDING (see §12 — grip UX redesign, 2026-05-28, 29/29 tests PASS)
**Date**: 2026-05-27 (v1) · 2026-05-28 (v2)
**Category**: Drawing System / DXF Viewer / BIM
**Author**: Giorgio Pagonis + Claude (Opus 4.7)
**Related ADRs**: ADR-031, ADR-040, ADR-294, ADR-345, ADR-353, ADR-358 (parent), ADR-363 (Wall corner-grip pattern mirror), ADR-369

---

## 1. Context

Το ADR-358 παρέδωσε `StairEntity` με **5 parametric grips** (§5.12, υλοποιημένα σε `bim/stairs/stair-grips.ts`):

| # | `StairGripKind` | Action |
|---|-----------------|--------|
| G0 | `stair-base` | translate `basePoint` |
| G1 | `stair-direction` | rotate `direction` (atan2 from base) |
| G2 | `stair-width` | resize `width` συμμετρικά (project on perp) |
| G3 | `stair-length` | resize via `stepCount = floor(run/tread) + 1` |
| G4 | `stair-split` | adjust `variant.flightSplit` ratio (L/U/Γ μόνο) |

Όλα τα grips βρίσκονται **στον άξονα ή στο κέντρο**. Καμία γωνία (corner), καμία ασυμμετρία ανά-πλευρά (per-stringer), καμία ανά-πτήση επεξεργασία (per-flight) για L/U/Γ, κανένα handle για landing, walkline, handrail, nosing, tread, riser, flip up-direction, multi-story.

**Παράλληλη εξέλιξη — ADR-363 Phase 1C-bis** (2026-05-27): οι τοίχοι απέκτησαν 4 corner grips ασύμμετρα (`wall-corner-{start,end}-{pos,neg}`, ArchiCAD/Vectorworks reference-line pattern). Οι σκάλες έμειναν πίσω — διαφορετική εμπειρία χρήστη ανάμεσα σε δύο γειτονικά BIM entities.

Giorgio ζητάει gap-analysis: πόσα ακόμη grips, πού (γωνίες/πλευρές), τι κάνουν.

---

## 2. Background — Industry Reference (2026-05-27)

| Software | Pattern | Grips per straight |
|----------|---------|-------------------|
| **Revit 2024** | start-riser + end-riser arrows + flight-width arrows (two-sided) + landing edge handles | ~8-10 |
| **ArchiCAD 27** | reference-line corner asymmetric + per-arm width arrows + landing depth/width handles | ~10-12 |
| **Vectorworks 2024** | walkline drag handle + per-flight stretch + handrail end-grips | ~9-11 |
| **AutoCAD Architecture** | flip-up arrow (toggle) + start/end shoulder grips + landing corner radius | ~8 |
| **Nestor σήμερα** | center/axis-only (5 grips, καμία γωνία, καμία πλευρά, καμία per-flight) | 5 |

**Convergence**: industry standard ~8-12 grips για straight, 14-18 για L/U/Γ. Nestor υπολειπόμενο ~50%.

---

## 3. Decision

Επέκταση `StairGripKind` union κατά **15 νέους τύπους** σε 4 φάσεις, mirror-ing το ADR-363 Phase 1C-bis wall-corner pattern για consistency εμπειρίας μεταξύ τοίχου ↔ σκάλας.

**Αρχιτεκτονικά invariants** (μη διαπραγματεύσιμα):

1. **Pure functions** σε `bim/stairs/stair-grips.ts`: zero React/DOM/Firestore/canvas deps (όπως υπάρχει σήμερα).
2. **SSoT**: όλη η geometry μαθηματικά μέσω `computeStairGeometry()` καλούμενη ΜΟΝΟ από `UpdateStairParamsCommand.execute()`. Το `applyStairGripDrag()` επιστρέφει μόνο νέο `StairParams`.
3. **Command pipeline**: zero νέα commands. Επεκτείνεται το switch στο `applyStairGripDrag(gripKind, input) → StairParams`.
4. **Deterministic gripIndex order**: νέα grips μπαίνουν σε υψηλότερα indices (5+) για να μη σπάσει drag re-attach μετά από refresh.
5. **Optional grips**: corner/per-flight grips emit-ονται μόνο όταν έχουν νόημα (π.χ. `stair-flight2-*` μόνο για L/U/Γ, `stair-landing-corner-radius` μόνο όταν `landingCornerStyle !== 'sharp'`).
6. **Per-StairParams field min/max floors**: όπως το `minWidthFloorFor()` σήμερα — kept για scene-unit awareness (mm / cm / m).
7. **Audit + undo**: όλα τα grip commits περνούν ήδη από `UpdateStairParamsCommand` → `useStairPersistence` → `StairAuditClient.recordChange()` (ADR-380). Zero νέο audit code.

---

## 4. Νέα `StairGripKind` Union (9 νέα strings + 1 replacement)

**Scope reduction post Q1-Q5** (2026-05-27): η αρχική πρόταση (22 νέα) μειώθηκε σε **9 νέα + 1 αντικατάσταση** μετά τις αποφάσεις του Giorgio.

```ts
export type StairGripKind =
  // === EXISTING — kept ===
  | 'stair-base'                    // G0  ✅ existing
  | 'stair-direction'               // G1  ✅ existing
  | 'stair-width'                   // G2  ✅ existing (symmetric — confirmed Q2)
  | 'stair-length'                  // G3  ✅ existing
  // 'stair-split'                  // G4  ❌ REMOVED (replaced by G12+G13, Q4)
  // === Phase A1 — Straight asymmetric corners (mirror ADR-363 Phase 1C-bis) ===
  | 'stair-corner-start-left'       // G5  🆕 BL — axial + perp asymmetric
  | 'stair-corner-start-right'      // G6  🆕 BR
  | 'stair-corner-end-left'         // G7  🆕 TL
  | 'stair-corner-end-right'        // G8  🆕 TR
  // === Phase A2 — Mid-front start grip ===
  // 'stair-width-left'             // G9  ❌ DROPPED (Q2: symmetric width — G2 sufficient)
  // 'stair-width-right'            // G10 ❌ DROPPED (Q2)
  | 'stair-start-side'              // G11 🆕 mid-front edge, moves basePoint along direction
  // === Phase B1 — Per-flight landing edges (replaces G4) ===
  | 'stair-flight1-end'             // G12 🆕 end-of-flight-1 (landing entry edge)
  | 'stair-flight2-start'           // G13 🆕 start-of-flight-2 (landing exit edge)
  // 'stair-flight2-width'          // G14 ❌ DROPPED (Q3: unified width across flights)
  // === Phase B2 — Landing depth + corner radius ===
  | 'stair-landing-depth'           // G15 🆕 resize `landingDepth` ('auto' → number)
  // 'stair-landing-width'          // G16 ❌ DROPPED (Q5: landing width = stair width always)
  | 'stair-landing-corner-radius';  // G17 🆕 resize `landingCornerRadius` (when cornerStyle ≠ sharp)
```

**Σύνολο**: 4 existing (kept) + 9 new = **13 grips union members**. G4 removed.

Default emit ανά variant:

| Variant | Emitted grips | Count |
|---------|---------------|-------|
| `straight` | G0-G3 + G5-G8 + G11 | **9** (industry parity με Revit/AutoCAD) |
| `l-shape` (landing) | straight 9 + G12 + G13 + G15 + (G17 if cornerStyle≠sharp) | **12-13** |
| `u-shape` | l-shape 12-13 + extra G12/G13/G15 για 2ο landing | **15-17** |
| `gamma` | l-shape 12-13 + extra για 2 landings | **15-17** |
| `helical` | G0-G3 (no corners/landings make sense) | **4** |

Phases C και D (universal utility + 3D) παραμένουν deferred — εκτός scope τρέχοντος ADR (επιλογή Γ του Giorgio = Phase A + B μόνο).

---

## 5. Grip Positions & Drag Semantics

### 5.1 Phase A — Straight corners + per-side (mirror ADR-363 Phase 1C-bis)

Footprint σκάλας = ορθογώνιο `width × totalRun` οριοθετημένο από:
- **bottom edge** (front of tread #1): `base ± width/2·p`
- **top edge** (back of tread #stepCount): `base + totalRun·u ± width/2·p`
- **left/right edges**: outer/inner stringers

```
                  G_end (G3 — αμετάβλητο)
       TL ─────────┼─────────── TR        (G7, G8 — 🆕 corner end)
        │          ↑           │
        │          │           │
       G_wL    G_walkline     G_wR        (G9, G18, G10 — 🆕 per-side width + walkline)
        │          │           │
        │          │           │
       BL ─────────┼─────────── BR        (G5, G6 — 🆕 corner start)
                G_strt                    (G11 — 🆕 mid-start moves basePoint)
                 G0 (center)
```

**Asymmetric corner drag math** (ίδιο pattern με `wall-corner-{end,start}-{pos,neg}` στο `wall-grips.ts:applyCornerDrag`):

```
ποσότητες:
  u = unitVector(direction)
  p = perpUnit(u)                          // ccw 90°
  dx = currentPos − cornerOrigPos
  axial      = dx · u                      // κατά μήκος direction
  perpendicular = dx · p                   // εγκάρσια

semantics ανά corner:
  start-left  (G5):  axial → shift basePoint κατά axial·u
                     perp  → grow width LEFT side μόνο,
                             axis re-centers κατά perp/2 (parallel faces preserved)
  start-right (G6):  ίδιο symmetric αντίθετο πρόσημο perp
  end-left    (G7):  axial → extend totalRun κατά axial (recalc stepCount = floor(newRun/tread)+1)
                     perp  → ίδιο logic με G5 για left side
  end-right   (G8):  ίδιο symmetric
```

**Per-side width** (G9/G10):

Σήμερα `width` είναι scalar. Προτεινόμενη επέκταση:

- **Option A (μικρή αλλαγή)**: keep scalar `width`, drag mid-left/right ασύμμετρα → recenter basePoint κατά (left_drag − right_drag)/2 ώστε ο άξονας να μένει στη μέση. Φυσικά πλάτη ίσα — όχι trapezoid.
- **Option B (data model change)**: add `widthLeft` + `widthRight` στο `StairParams`. Backward-compat: αν undefined → fallback σε `width/2` και στις δύο πλευρές. Επιτρέπει trapezoid stairs (industry σπάνιο εκτός Vectorworks).

**Decision (default)**: Option A για Phase A1, Option B σε επόμενο ADR αν Giorgio το ζητήσει.

### 5.2 Phase B — Per-flight (L/U/Γ)

- **G12 `stair-flight1-end`**: inline drag του landing entry-edge. Διαφορά από G4 (centroid ratio): G4 περιστρέφει γύρω από το landing centroid, G12 σπρώχνει inline → φυσικότερο για "θέλω 8 σκαλιά πριν τη γωνία".
- **G13 `stair-flight2-start`**: symmetric — επηρεάζει `flightSplit` αλλά από την άλλη μεριά.
- **G14 `stair-flight2-width`**: εφόσον υπάρχει 2η πτήση, μπορεί να έχει διαφορετικό πλάτος (industry rare, αλλά Vectorworks επιτρέπει). Απαιτεί data model `variant.flight2Width?: number`.
- **G15 `stair-landing-depth`**: drag στενής πλευράς landing → resize `landingDepth: 'auto' | number`. Πρώτο drag μετατρέπει σε number.
- **G16 `stair-landing-width`**: drag φαρδιάς πλευράς landing → resize landing perpendicular dim (σήμερα δεν είναι ανεξάρτητο — συνδέεται με `width`). Απαιτεί data model `variant.landingWidthOverride?: number`.
- **G17 `stair-landing-corner-radius`**: εμφανίζεται μόνο όταν `landingCornerStyle === 'round' | 'chamfer'`. Drag στη γωνία landing → resize `landingCornerRadius`.

### 5.3 Phase C — Universal utility

| Grip | Position | Action | Min/Max |
|------|----------|--------|---------|
| **G18 walkline** | walkline midpoint (offset side) | `walklineOffset` | 0 ≤ x ≤ `width/2` |
| **G19 tread** | μπροστινή ακμή tread #1 | `tread` (επηρεάζει `totalRun = tread · (stepCount-1)`) | 200mm ≤ x ≤ 400mm (ΝΟΚ/Eurocode) |
| **G20 nosing** | μπροστινή προεξοχή tread #1 | `nosing` | 0 ≤ x ≤ 50mm (ΝΟΚ §6.2.5) |
| **G21 flip** | βέλος πάνω από G_end | **CLICK** → toggle `upDirection` ('up'⇄'down') | — (boolean toggle) |
| **G22 handrail-left** | άκρο `handrails.left` (αρχή ή τέλος εξαρτάται από προτιμώμενο anchor) | extend/trim `handrails.left.extension?` | -200mm ≤ x ≤ +500mm |
| **G23 handrail-right** | mirror G22 | mirror | mirror |

**G21 ειδικό**: είναι το μοναδικό **click-grip** (όχι drag). Pattern AutoCAD Architecture. Απαιτεί νέο `GripInteractionMode: 'click' | 'drag'` (σήμερα όλα drag). Επέκταση `useUnifiedGripInteraction`.

### 5.4 Phase D — 3D / Multi-story (ADR-366 dependency)

Εξαρτάται από ADR-366 (3D BIM Viewer). Grips εμφανίζονται μόνο όταν `viewport === '3d'` ή `helical`-variant.

| Grip | Position | Action |
|------|----------|--------|
| **G24 helix-radius** | εξωτερικός κύκλος helical | resize `variant.radius` (helical-only) |
| **G25 helix-angle** | άκρο τόξου | resize `variant.sweepAngle` |
| **G26 storey-top** (3D) | πάνω άκρο σε 3D viewport | drag vertical → magnet snap σε `multiStoryConfig.storyCount` ακέραιο |

---

## 6. Phases & Order of Delivery (Round 1 Approved Scope)

| Phase | Scope | Status | Notes |
|-------|-------|--------|-------|
| **A1** | G5-G8 4 corner grips straight (asymmetric mirror walls) | ✅ DONE | UX parity walls↔stairs |
| **A2** | G11 mid-front start grip (moves basePoint inline) | ✅ DONE | Συμμετρική απόφαση Q2 → G9/G10 dropped |
| **B1** | G12 + G13 per-flight landing edges. **Remove G4** | ✅ DONE | Q4: G4 → G12+G13 replacement. Both edges reapportion `flightSplit` |
| **B2** | G15 (landing depth) + G17 (landing corner radius, conditional) | ✅ DONE | Zero data-model change — `landingDepth` + `landingCornerRadius` reused |

**Total**: 4 phases, **26/26 tests PASS** (2026-05-28).

### Implementation map (code = SoT)

| File | Role |
|------|------|
| `hooks/grip-types.ts` | `StairGripKind` union — `stair-split` removed, 9 ADR-393 kinds added |
| `bim/stairs/stair-grip-math.ts` 🆕 | Shared vector/scalar helpers + constants (extracted for the 500-line ceiling) |
| `bim/stairs/stair-grip-transforms.ts` 🆕 | `applyStairGripDrag` dispatcher + all drag transforms |
| `bim/stairs/stair-grips.ts` | `getStairGrips` positions; re-exports `applyStairGripDrag` / `StairGripDragInput` for a stable public API |
| `bim/stairs/__tests__/stair-grips.test.ts` | 26 tests (layout per variant + every transform) |

**Note on G17 (chamfer/fillet landing)**: the corner-radius grip is wired end-to-end, but the chamfer/fillet landing GEOMETRY is not yet implemented (`StairGeometryService` Phase 3c throws). The grip emits + the transform writes `landingCornerRadius` correctly; the rounded landing will render once Phase 3c lands. Tests overlay the fillet style on a built square l-shape to exercise grip layout + transform without the unbuilt geometry.

**Deferred ADRs (Phase C/D moved out)**:
- Phase C (walkline + tread + nosing + click-flip + handrails) → ξεχωριστό ADR αν/όταν χρειαστεί
- Phase D (3D helical + storey magnet) → εξαρτάται από ADR-366 (3D viewer) ωρίμανση

---

## 7. Data Model Changes Required

**ZERO**. Όλες οι data-model επεκτάσεις της αρχικής πρότασης (widthLeft/widthRight, flight2Width, landingWidthOverride, handrail.extension) **dropped** μετά Q2/Q3/Q5. Τα νέα grips χρησιμοποιούν αποκλειστικά υπάρχοντα `StairParams` / `StairVariantParams` fields:

| Grip | Reads/writes |
|------|--------------|
| G5-G8 corners | `basePoint`, `width`, `stepCount`/`totalRun` (recomputed via existing length formula) |
| G11 mid-front | `basePoint` (project on direction) |
| G12, G13 per-flight | `variant.flightSplit` (existing field, ήδη `readonly [number, number]`) |
| G15 landing-depth | `variant.landingDepth` (existing `'auto' \| number`) |
| G17 landing-corner-radius | `variant.landingCornerRadius` (existing optional field) |

Zero Firestore migration, zero schema bump.

---

## 8. SSoT Touch Points (Σχέση με υπάρχοντα συστήματα)

| SSoT | Αρχείο | Επέκταση |
|------|--------|----------|
| `StairGripKind` union | `hooks/grip-types.ts` | +9 strings, −1 (`stair-split`) |
| Grip getter | `bim/stairs/stair-grips.ts:getStairGrips()` | +9 emit branches (variant-gated) |
| Grip transform | `bim/stairs/stair-grip-transforms.ts:applyStairGripDrag()` | +9 cases, −1 |
| Vector math | `bim/geometry/stairs/stair-geometry-shared.ts:directionToUnitVector + perp` | **CONSUMED** — `stair-grip-math.ts` re-exports, δεν re-implements |
| Scene-unit factor | `stair-floor-link.ts:mmFactorFromWidth` | **CONSUMED** — `getStairGrips` scales the 100 mm handle offset → scene-unit-safe direction/mid-front handles (metre/cm scenes) |
| Command pipeline | `core/commands/UpdateStairParamsCommand` | **ΚΑΜΙΑ ΑΛΛΑΓΗ** (γενικό command) |
| Ghost preview | `rendering/ghost/apply-entity-preview.ts` | **ΚΑΜΙΑ ΑΛΛΑΓΗ** — generic `stairGripKind` routing |
| Persistence | `useStairPersistence` (ADR-358 Phase 8) | **ΚΑΜΙΑ ΑΛΛΑΓΗ** |
| Audit | `stair-audit-client.ts` (ADR-380) | Auto-detected via `diffTrackedFields()` (variant diff) |
| ADR-040 perf | Micro-leaf compliance | **NO new high-freq subscribers** — όλα event-time |
| Tests | `__tests__/stair-grips.test.ts` | 27 tests (incl. metre-scene regression 5b) |

### 8.1 SSoT Audit (post-review 2026-05-28)

Giorgio SSoT review αποκάλυψε δύο διορθώσεις που έγιναν **on the spot** (N.0.2):

1. **Duplicate vector helpers (FIXED)**: το πρώτο draft είχε δικά του `unitVectorFromDirection`/`perpUnit` στο `stair-grip-math.ts` — identical με τα `directionToUnitVector`/`perp` του `stair-geometry-shared.ts` (ΙΔΙΟ domain, ήδη consumed από geometry builders). Τώρα re-exported, zero re-implementation.
2. **Scene-unit handle offset (FIXED)**: G1 (direction, pre-existing) + G11 (mid-front, νέο) χρησιμοποιούσαν σκέτο `DIRECTION_GRIP_OFFSET_MM = 100` ως canvas offset → 1000× off-screen σε metre scenes (ίδιο class με το wall incident 2026-05-28). Τώρα `/ mmFactorFromWidth(width)`. Metre-scene regression test 5b το κλειδώνει.

**Corner positions (G5-G8)**: derive από `params.width`/`totalRun`/`basePoint` — **scene-units by construction** (ο builder κλιμακώνει με `mmToSceneUnits`), άρα scene-safe. Η αυστηρή μορφή του κανόνα ("positions read from geometry") προτιμά `geometry.stringers` ως source· καταγράφεται ως **purity follow-up** (όχι active bug — βλ. pending-ratchet).

### 8.2 Cross-BIM-grip duplication (flagged → pending-ratchet, N.0.2 large)

Τα `project2D`, `unitAxis`/`perpUnit`-style helpers + το **asymmetric corner decompose+recenter math** είναι αντιγραμμένα σε `wall-grips.ts` + `beam-grips.ts` + stair (3 BIM grip families). Επίσης το scene-floor heuristic (`minWidthFloorFor` vs wall `minThicknessFloorFor`) αντί να καταναλώνει το `utils/scene-units.ts`. Extraction ενός shared `bim-grip-geometry` module = >1h / 4+ files / wall σε parallel flux → pending-ratchet, όχι σε αυτό το ADR.

---

## 9. Q&A Round 1 — Resolved 2026-05-27

| # | Question | Answer | Impact |
|---|----------|--------|--------|
| **Q1** | Πόσα grips στην πρώτη φάση; | **Γ** — όλα Phase A + Phase B (~6h) | Phase A1+A2+B1+B2 entered scope. C/D deferred. |
| **Q2** | Drag αριστερής πλευράς width → δεξιά πλευρά τι κάνει; | **Συμμετρική** (κουνιέται κι αυτή) | G9, G10 dropped. G2 (existing symmetric) sufficient. ⚠️ **SUPERSEDED by v2 §12** — η ασυμμετρία γίνεται πλέον μέσω γωνιών (αντίθετη όψη αγκυρωμένη)· τα G2/G3 (width/length) ΚΡΥΒΟΝΤΑΙ στην ίσια. |
| **Q3** | Σκάλες Γ/U/Π — διαφορετικό πλάτος ανά σκέλος; | **Όχι — ενιαίο** | G14 dropped. No `flight2Width` field. |
| **Q4** | Πλατύσκαλο L/U/Γ — ποια χερούλια κρατάμε; | **Μόνο 2 στα άκρα** (όχι κεντρικό) | G4 removed, G12+G13 replace. Existing tests migrate. |
| **Q5** | Πλατύσκαλο διαφορετικό πλάτος από σκάλα; | **Όχι — ίδιο πάντα** | G16 dropped. No `landingWidthOverride` field. |

**Cumulative effect**: σύνθεση 22 νέων grips → 9 νέα + 1 αντικατάσταση. Zero data-model changes. ~6h total effort (από ~18.5h της αρχικής max πρότασης).

---

## 10. Changelog

- **2026-05-28** (v2 Phase 1, Opus 4.7) — **Grip UX redesign** (§12). (1) `stair-base` MOVE handle relocated to the walkline arc-midpoint + 4-arrow icon glyph; `stair-direction` ROTATION handle relocated to front-centre (base − offset·u) + curved-arrow icon glyph. (2) `rotateDirection` made anchor-relative (was absolute atan2 → would flip the stair when grabbing the off-axis front handle). (3) **straight** stairs SUPPRESS `stair-width`/`stair-length`/`stair-start-side` — the 4 corners own both resize axes (Q2 superseded); transforms + union members kept (corners reuse them). L/U/Γ + curved keep width/length unchanged this phase. (4) Glyph plumbing: `GripShape` += `'move'|'rotation'`; rendering `GripInfo.shape?` hint (type-only import); `StairRenderer.getGrips` maps kind→shape via new `stairGripGlyphShape()`; `GripPhaseRenderer.renderStandardGrips` honours `grip.shape`; `GripShapeRenderer` draws the two glyphs. 9 files. 29/29 tests PASS, tsc clean. **Phase 2 PENDING**: hide width/length on L/U/Γ + add corners there (positions from `geometry.stringers`, multi-flight transforms).
- **2026-05-28** (SSoT review) — Two on-the-spot fixes post Giorgio review (§8.1): (1) removed duplicate `unitVectorFromDirection`/`perpUnit`, now consume `directionToUnitVector`/`perp` from `stair-geometry-shared`; (2) scaled the 100 mm direction/mid-front handle offset via `mmFactorFromWidth` SSoT → fixes 1000×-off-screen handles in metre scenes (G1 pre-existing + G11 new). Added metre-scene regression test 5b. Removed dead `DEG_TO_RAD`. Cross-BIM-grip duplication (project2D / corner-decompose math / scene-floor) flagged to pending-ratchet (§8.2). 27/27 tests PASS.
- **2026-05-28** — Phase A1+A2+B1+B2 IMPLEMENTED (Opus 4.7). 9 new `StairGripKind` members + `stair-split` removed. `stair-grips.ts` split into 3 modules (math / transforms / positions) to stay under the 500-line ceiling (N.7.1). Corner transforms mirror `wall-grips.ts:moveCorner` (width↔thickness, basePoint/totalRun↔start/end). Per-flight grips (G12/G13) both reapportion `flightSplit` via run-axis projection (landing slides as a rigid block). Landing depth/corner-radius reuse existing `landingDepth`/`landingCornerRadius` fields → zero data-model change. 26/26 tests PASS. Status 🟢 APPROVED → 🟢 IMPLEMENTED.
- **2026-05-27** (later) — Round 1 Q&A resolved (Opus 4.7, Q1-Q5 answered by Giorgio). Scope reduced from 22 new grips → 9 new + 1 replacement. Phase C/D deferred. Zero data-model changes (όλα τα νέα grips χρησιμοποιούν existing `StairParams`/`StairVariantParams` fields). Effort 18.5h → 6h. Status 🟡 PROPOSED → 🟢 APPROVED. Έτοιμο για Phase A1 implementation (model: Sonnet 4.6).
- **2026-05-27** — ADR-393 created (Opus 4.7, round 1). Gap analysis: stairs σήμερα 5 grips vs industry 8-12 (straight) / 14-18 (L/U/Γ). Proposed +22 grips σε 4 phases (A: corners + per-side, B: per-flight L/U/Γ, C: universal utility incl. click-flip, D: 3D/multi-story). Mirror pattern ADR-363 Phase 1C-bis walls.

---

## 12. ADR-393 v2 — Grip UX Redesign (2026-05-28)

Μετά τη v1 (13 grips), ο Giorgio ζήτησε ανασχεδιασμό της εμπειρίας ώστε οι γωνίες
να αναλαμβάνουν πλάτος+μήκος (αντίθετη όψη αγκυρωμένη) και τα on-axis width/length
handles να κρύβονται. Επίσης restyle των move/rotation handles σε εικονίδια.

### 12.1 Αποφάσεις (Giorgio, 2026-05-28)
- **Εύρος**: κρύβουμε width/length σε **όλες** τις σκάλες· γωνίες σε **ίσια + Γ/U/Π** (όχι καμπύλες — δεν υπάρχει ορθογώνιο αποτύπωμα).
- **MOVE handle** (`stair-base`): θέση = arc-midpoint του walkline (κέντρο διαδρομής)· glyph = 4-βέλη.
- **ROTATION handle** (`stair-direction`): θέση = μπρος-κέντρο (base − offset·u)· glyph = καμπύλο βέλος· pivot = `basePoint` (= μπρος-κέντρο)· drag-to-rotate **anchor-relative** (όχι click-mode — Q-A).
- **Q2 superseded**: η ασυμμετρία γίνεται μέσω γωνιών, όχι symmetric width grip.
- **walkline "μέσο"** = arc-length midpoint (όχι bbox center — Q-B).
- **ίσια corners**: παραμένουν param-derived (purity → ratchet)· **L/U/Γ end-corners** read-from-geometry (`stringers`).

### 12.2 Φάσεις
| Phase | Scope | Status |
|-------|-------|--------|
| **1** | move/rotation relocate + glyphs · anchor-relative rotation · hide width/length/mid-front στην **ίσια** · καμπύλες αμετάβλητες · tests | ✅ DONE 2026-05-28 |
| **2** | **L/U/Γ**: hide width/length + add 4 corners (θέσεις από `geometry.stringers` · multi-flight transforms: perp→width, axial start→`flightSplit[0]`, axial end→`flightSplit[last]`) + tests | ❌ PENDING |

### 12.3 Glyph render path (Phase 1)
`getStairGrips` (stairGripKind) → `StairRenderer.getGrips` map kind→`shape` via `stairGripGlyphShape()` → `GripInfo.shape?` (rendering type, type-only import) → `GripPhaseRenderer.renderStandardGrips` (`grip.shape ?? 'square'`) → `GripShapeRenderer.renderShape` (`'move'` 4-arrow / `'rotation'` curved-arrow). SSoT mapping = `stairGripGlyphShape` (tested).

### 12.4 Emit ανά variant (v2 Phase 1)
| Variant | Grips | Count |
|---------|-------|-------|
| `straight` | move + rotation + 4 corners | **6** |
| `l-shape`/`u-shape`/`gamma` | move + rotation + width + length + landing grips (Phase 1· corners → Phase 2) | 7-9 |
| καμπύλες (spiral/helical/elliptical/winder/triangular×2/sketch/v-shape) | move + rotation + width + length | **4** |

---

## 11. References

- ADR-358 §5.12 Grips & §9.2 Q22 — original 5-grip design
- ADR-363 §6 Phase 1C-bis — wall asymmetric corner grip math (mirror)
- ADR-353 — Array entity parametric grip pattern (original template)
- `src/subapps/dxf-viewer/bim/walls/wall-grips.ts:applyCornerDrag` — implementation reference
- `src/subapps/dxf-viewer/bim/stairs/stair-grips.ts` — current 5-grip implementation
