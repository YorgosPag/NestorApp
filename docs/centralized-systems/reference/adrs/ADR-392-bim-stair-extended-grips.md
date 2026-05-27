# ADR-392 — BIM Stair Extended Parametric Grips (Industry-Aligned Symmetric Pattern)

**Status**: 🟡 PROPOSED (round 1)
**Date**: 2026-05-27
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

## 4. Νέα `StairGripKind` Union (15 νέα strings)

```ts
export type StairGripKind =
  // === Phase A — Straight grips (mirror ADR-363 Phase 1C-bis wall pattern) ===
  | 'stair-base'                    // G0  ✅ existing
  | 'stair-direction'               // G1  ✅ existing
  | 'stair-width'                   // G2  ✅ existing (symmetric)
  | 'stair-length'                  // G3  ✅ existing
  | 'stair-split'                   // G4  ✅ existing (L/U/Γ only)
  | 'stair-corner-start-left'       // G5  🆕 BL — axial + perp asymmetric
  | 'stair-corner-start-right'      // G6  🆕 BR
  | 'stair-corner-end-left'         // G7  🆕 TL
  | 'stair-corner-end-right'        // G8  🆕 TR
  | 'stair-width-left'              // G9  🆕 mid-left stringer (per-side width)
  | 'stair-width-right'             // G10 🆕 mid-right stringer
  | 'stair-start-side'              // G11 🆕 mid-front (move basePoint along direction, opposite of length)
  // === Phase B — Per-flight (L/U/Γ multi-flight) ===
  | 'stair-flight1-end'             // G12 🆕 end-of-flight-1 inline drag (alternative UX vs G4 ratio)
  | 'stair-flight2-start'           // G13 🆕 start-of-flight-2 symmetric
  | 'stair-flight2-width'           // G14 🆕 per-flight stringer width (asymmetric flights)
  | 'stair-landing-depth'           // G15 🆕 resize `landingDepth` ('auto' → number)
  | 'stair-landing-width'           // G16 🆕 resize landing perpendicular dimension
  | 'stair-landing-corner-radius'   // G17 🆕 resize `landingCornerRadius` (when cornerStyle ≠ sharp)
  // === Phase C — Universal utility ===
  | 'stair-walkline'                // G18 🆕 resize `walklineOffset` (lateral 0..width/2)
  | 'stair-tread'                   // G19 🆕 resize `tread` (front edge of tread #1)
  | 'stair-nosing'                  // G20 🆕 resize `nosing` (0..50mm)
  | 'stair-flip'                    // G21 🆕 CLICK (not drag) → toggle `upDirection`
  | 'stair-handrail-left'           // G22 🆕 extend/trim left handrail
  | 'stair-handrail-right'          // G23 🆕 extend/trim right handrail
  // === Phase D — 3D / Multi-story (ADR-366 dependency) ===
  | 'stair-helix-radius'            // G24 🆕 helical only
  | 'stair-helix-angle'             // G25 🆕 helical only
  | 'stair-storey-top';             // G26 🆕 3D only — `multiStoryConfig.storyCount` magnet
```

**Σύνολο**: 5 (existing) + 22 (νέα) = **27 grips** (περισσότερα από τα 12-18 του target γιατί περιλαμβάνουν Phase D 3D). Default emit ανά variant:

| Variant | Emitted grips |
|---------|---------------|
| `straight` | G0-G3 + G5-G11 = **11** (industry parity με Revit/ArchiCAD) |
| `l-shape` (landing) | 11 + G4 + G12-G16 = **17** |
| `u-shape` | 11 + G4 + G12-G16 (×2 landings) = **22** |
| `gamma` | 11 + G4 + G12 + G14 + 2×{G15+G16} = **20** |
| `helical` | G0-G3 + G24-G25 + universal = **~11** |

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

## 6. Phases & Order of Delivery

| Phase | Scope | Effort | Tests | Notes |
|-------|-------|--------|-------|-------|
| **A1** | G5-G8 4 corner grips straight (asymmetric mirror walls) | Sonnet ~2h | +8 grip-layout + +8 applyDrag = 16 new | 🔥 PRIORITY — closes UX gap walls↔stairs |
| **A2** | G9-G11 per-side width + mid-start | Sonnet ~1.5h | +6 | Option A scalar-width |
| **B1** | G12-G14 per-flight (L/U/Γ) | Sonnet ~2.5h | +9 | data model: `variant.flight2Width?` |
| **B2** | G15-G17 landing grips | Sonnet ~2h | +9 | data model: `variant.landingWidthOverride?` |
| **C1** | G18 walkline + G19 tread + G20 nosing | Sonnet ~1.5h | +9 | |
| **C2** | G21 flip (CLICK pattern) | Opus ~3h | +5 | Επέκταση `useUnifiedGripInteraction` με click-mode — επηρεάζει όλα τα entity types |
| **C3** | G22-G23 handrail end grips | Sonnet ~2h | +6 | data model: `handrails.{left,right}.extension?` |
| **D1** | G24-G25 helical grips | Sonnet ~2h | +6 | Όταν helical variant ώριμος |
| **D2** | G26 storey-top 3D magnet | Opus ~2h | +4 | ADR-366 dependency |

**Total**: 8 phases, ~18.5h, ~78 νέα tests.

**Default recommended start**: A1 + A2 (παράλληλη εμπειρία με walls), Phase B μετά αν Giorgio θέλει L/U/Γ refinement.

---

## 7. Data Model Changes Required

| Phase | Field | Type | Backward-compat |
|-------|-------|------|-----------------|
| A2 (Option B μόνο) | `StairParams.widthLeft?` + `widthRight?` | `number?` | undefined → `width/2` |
| B1 | `StairVariantParams.flight2Width?` (L/U/Γ) | `number?` | undefined → `width` |
| B2 | `StairVariantParams.landingWidthOverride?` (L/U/Γ) | `number?` | undefined → `width` |
| C3 | `StairHandrails.left.extension?` + `right.extension?` | `number?` (mm) | undefined → 0 |
| D2 | (none — `multiStoryConfig.storyCount` ήδη υπάρχει) | — | — |

Όλα optional fields → ZERO migration needed για existing Firestore docs.

---

## 8. SSoT Touch Points (Σχέση με υπάρχοντα συστήματα)

| SSoT | Αρχείο | Επέκταση |
|------|--------|----------|
| `StairGripKind` union | `hooks/grip-types.ts:17` | +22 strings (Phase A-D) |
| Grip getter | `bim/stairs/stair-grips.ts:getStairGrips()` | +22 push branches (όλες optional) |
| Grip transform | `bim/stairs/stair-grips.ts:applyStairGripDrag()` | +22 cases στο switch |
| Command pipeline | `core/commands/UpdateStairParamsCommand` | **ΚΑΜΙΑ ΑΛΛΑΓΗ** (γενικό command) |
| Ghost preview | `rendering/ghost/apply-entity-preview.ts:75` | ήδη δηλώνει `stairGripKind?` — zero change |
| Persistence | `useStairPersistence` (ADR-358 Phase 8) | **ΚΑΜΙΑ ΑΛΛΑΓΗ** (debounced auto-save) |
| Audit | `stair-audit-client.ts` (ADR-380) | Auto-detected via `diffTrackedFields()` — προσθήκη νέων fields στο `STAIR_TRACKED_FIELDS` (~5 νέα fields) |
| ADR-040 perf | Micro-leaf compliance | **NO new high-freq subscribers** — όλα event-time |
| Tests | `__tests__/stair-grips.test.ts` | +78 tests |

---

## 9. Open Questions (για Giorgio)

> **Σε απλά ελληνικά + παραδείγματα. ΜΙΑ ΕΡΩΤΗΣΗ ΤΗ ΦΟΡΑ.** (feedback rule `feedback_questions_simple_greek_examples`)

**Q1** — Πόσα grips θες να βάλω **τώρα** σε πρώτη φάση;

Επιλογές:
- **Α**: Μόνο τα 4 γωνιακά grips (Phase A1, ~2h, ίδιο pattern με τοίχους).
- **Β**: Γωνιακά + πλευρικά (Phase A1+A2, ~3.5h, full straight parity).
- **Γ**: Όλα τα Phase A + Phase B (~6h, full L/U/Γ refinement).
- **Δ**: Όλα από A1 μέχρι D2 (~18.5h, 8 phases σε διαδοχικές sessions).

**Παράδειγμα γωνιακού grip**: είσαι σε ίσια σκάλα, πατάς την κάτω-αριστερή γωνία της και την τραβάς διαγώνια. Δύο πράγματα γίνονται μαζί:
1. Η σκάλα μετακινείται προς τα πίσω/εμπρός (αν τράβηξες κατά μήκος της φοράς της).
2. Μεγαλώνει/μικραίνει ΜΟΝΟ η αριστερή πλευρά (όχι και οι δύο), όπως ακριβώς στους τοίχους που πρόσθεσες χθες.

---

## 10. Changelog

- **2026-05-27** — ADR-392 created (Opus 4.7, round 1). Gap analysis: stairs σήμερα 5 grips vs industry 8-12 (straight) / 14-18 (L/U/Γ). Proposed +22 grips σε 4 phases (A: corners + per-side, B: per-flight L/U/Γ, C: universal utility incl. click-flip, D: 3D/multi-story). Mirror pattern ADR-363 Phase 1C-bis walls. Zero command changes, optional Firestore fields, zero migration. Awaiting Q1 answer to start.

---

## 11. References

- ADR-358 §5.12 Grips & §9.2 Q22 — original 5-grip design
- ADR-363 §6 Phase 1C-bis — wall asymmetric corner grip math (mirror)
- ADR-353 — Array entity parametric grip pattern (original template)
- `src/subapps/dxf-viewer/bim/walls/wall-grips.ts:applyCornerDrag` — implementation reference
- `src/subapps/dxf-viewer/bim/stairs/stair-grips.ts` — current 5-grip implementation
