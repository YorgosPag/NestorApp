# ADR-363 BIM Drawing Mode — Πόρισμα Εκκρεμών Φάσεων
_Ημερομηνία ανάλυσης: 2026-05-19_
_Ενημέρωση 2026-05-20: Μεγάλη διόρθωση — πολλά "pending" items ήταν ήδη DONE στον κώδικα. Verified από ADR-363 checklist._
_Ενημέρωση 2026-05-20 (2η): Phase 3.7b+ multi-storey stack DONE (commit a14cef17). pending-summary stale entry διορθώθηκε._

---

## Ολοκληρωμένες Φάσεις ✅

| Φάση | Περιγραφή |
|------|-----------|
| 0, 0.5 | Doc sync + stair SSoT verification (2026-05-20) |
| 1, 1A, 1B, 1C | Wall core + types + tool + Firestore + ribbon |
| 1D-A, 1D-B, 1D-C, 1D-D, 1E | WallDna Editor + AutoTrim + EntityAudit + BOQ feed + Delete |
| 2, 2.5 | Opening core + Advanced Editing |
| 2 deferred | Wall split mid-opening + cascade delete UX + shortcuts D/Wn (2026-05-19) |
| 3, 3.5, 3.6, 3.7, 3.7a | Slab core + grips + polish + slab-opening + grips |
| 4, 4.5, 4.5b, 4.5c.1–6, 4.5d | Column core + grips + variants + hatch + ghost snap + section-profile L/T symbol + ribbon |
| 5, 5.5a–5.5i+ | Beam core + grips + width + depth + hatch + auto-snap + all projections + section-profile I/H symbol + column-center snap + beam-slab BOQ deduction |
| 6 | BOQ Auto-Feed core (5 entities) + multi-layer DNA walls + material→ΑΤΟΕ mapping |
| 7A, 7B | Multi-Char BIM Hotkeys (ST/SL/OP/CL/BM) + Single-char D/Wn shortcuts |
| 3.7b, 3.7b+, 3.7b++ | Fire-rating ribbon + multi-storey slab-opening stack + edge-midpoint ghost (commit a14cef17) |

---

## Εκκρεμείς Φάσεις ❌

### Phase 3.7b/3.7b+/3.7b++ — ✅ DONE (commit a14cef17, 2026-05-20)
- [x] ~~Fire-rating ribbon~~ — fireRating combobox (60/90/120/none)
- [x] ~~Multi-storey stack group UI~~ — `SlabOpeningStackHost` + `SlabOpeningStackDialog` + `slab-opening-stack.ts` + ribbon `copyToFloors`
- [x] ~~Snap-to-edge-midpoint preview ghost~~ — `useSlabOpeningGhostPreview` + `SlabOpeningGhostRenderer`, ADR-040 compliant
- Material ribbon field → deferred to Phase 6.5 (not pending)

---

### Phase 4.5e+ — Material Pickers activation — ✅ DONE (2026-05-20/21)
_(Deferred from Phase 4.5d — ribbon buttons exist, pickers disabled/comingSoon)_
- [x] Wall material picker — ENABLED (wall-hatch-patterns.ts SSoT + drawMaterialHatch + bridge wiring)
- [x] Slab material picker — ENABLED (slab-command-keys + useRibbonSlabBridge + contextual-slab-tab)
- [x] Beam material picker — WAS ALREADY ENABLED (Phase 5.5c, not comingSoon)
- [x] Tab/Shift+Tab cycling — `useBimMaterialCycler.ts` (2026-05-21): wall/slab/beam/column, toolStateStore guard, undoable UpdateXParamsCommand

---

### Phase 5.5j — ✅ DONE (2026-05-20/21)
- [x] H-beam variant (`sectionType='H'`, `SECTION_H_FLANGE_T_PX=9`, `computeHProfileOutline()`)
- [x] `profileDesignation` canvas label (screen-space, horizontal, 14 ribbon presets)
- [x] Scale-adaptive symbol size — `symW = clamp(beamWidthPx * 0.35, [12,50]px)`, all sub-dims proportional (2026-05-21)
- [x] Anchor highlight pulse animation — `drawAnchorPulse()`, sin-modulated α @ 1.2Hz, `performance.now()` (2026-05-21)

---

### Phase 2 leftover (~1-2h)
- [x] ~~Polyline/curved host wall positioning~~ **✅ DONE (2026-05-20)** — `getWallAxisVertices` + `walkPolylineToDistance` + `projectPointToPolylineOffset` + arc-length in coordinator. 11 tests. Pre-existing test bug fixed.

---

### Phase 6.5 — Custom Material Library Editor (~4-6h)
- [ ] ~25 seeded materials (RC/Steel/Masonry/Wood variants)
- [ ] Material library editor UI
- [ ] Gates: wall/slab/beam material pickers + Phase 3.7b+ fire-rating

---

### Phase 7 — Multi-Element Selection & Bulk Edit (~4-6h)
- [ ] Selection rubber-band extension για BIM entities
- [ ] Multi-select panel (common-denominator bulk edit)
- [ ] Mirror/rotate/copy semantics για BIM entities
- [ ] Group operations (move walls + hosted openings as unit)

---

### Phase 8 — Schedule Export (~5-8h)
- [ ] `BimScheduleExporter` (table per entity type + combined)
- [ ] CSV export
- [ ] Excel (xlsx) export
- [ ] PDF export
- [ ] Filterable schedule UI (per floor, per category)
- [ ] Sample "Πίνακας Κουφωμάτων" door schedule

---

### Phase 9+ — OUT OF SCOPE (δεν υλοποιούνται στο ADR-363)
- 3D viewer (Three.js port from genarc) → ADR-366
- IFC export
- MEP entities
- Real-time clash detection

---

## Σύνοψη

| Κατηγορία | Items | Εκτίμηση |
|-----------|-------|----------|
| ~~Phase 4.5e+ (Tab cycling material pickers)~~ | ~~1~~ | ~~✅ DONE~~ |
| ~~Phase 5.5j extras (beam polish)~~ | ~~2~~ | ~~✅ DONE~~ |
| Phase 6.5 (material library editor) | ~5 | ~4-6h |
| Phase 7 (multi-select) | 4 | ~4-6h |
| Phase 8 (schedule export) | 6 | ~5-8h |
| **ΣΥΝΟΛΟ** | **~13 items** | **~13-20h** |

---

## Κρίσιμα αρχεία

- `src/subapps/dxf-viewer/bim/` — κεντρικό BIM directory
- `src/subapps/dxf-viewer/bim/services/BimToBoqBridge.ts` — BOQ bridge SSoT
- `src/subapps/dxf-viewer/bim/types/` — BIM types
- `src/subapps/dxf-viewer/canvas-v2/rendering/bim/` — renderers
- `docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md` — master ADR
