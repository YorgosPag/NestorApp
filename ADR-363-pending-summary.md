# ADR-363 BIM Drawing Mode — Πόρισμα Εκκρεμών Φάσεων
_Ημερομηνία ανάλυσης: 2026-05-19_
_Ενημέρωση 2026-05-20: Μεγάλη διόρθωση — πολλά "pending" items ήταν ήδη DONE στον κώδικα. Verified από ADR-363 checklist._

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

---

## Εκκρεμείς Φάσεις ❌

### Phase 3.7b+ — Slab-Opening extras (~2-3h remaining)
- [ ] Multi-storey stack group UI ("Copy to all floors") — cross-level persistence, dedicated session
- [x] ~~Fire-rating ribbon~~ **✅ DONE Phase 3.7b (2026-05-20)** — fireRating combobox (60/90/120/none)
- [ ] Snap-to-edge-midpoint preview ghost — needs ADR-040 micro-leaf or grip hover in RenderOptions
- [ ] Material ribbon field — deferred to Phase 6.5 material library

---

### Phase 4.5e+ — Material Pickers activation (~2-3h)
_(Deferred from Phase 4.5d — ribbon buttons exist, pickers disabled/comingSoon)_
- [ ] Wall material picker → depends on WallDna composable layer stack
- [ ] Slab material picker → depends on Phase 6.5 material library
- [ ] Beam material picker → Phase 5.5c hatch DONE, but comingSoon placeholder remains
- [ ] Tab/Shift+Tab cycling για material picker (lower priority)

---

### Phase 5.5j — ✅ DONE (2026-05-20)
- [x] H-beam variant (`sectionType='H'`, `SECTION_H_FLANGE_T_PX=9`, `computeHProfileOutline()`)
- [x] `profileDesignation` canvas label (screen-space, horizontal, 14 ribbon presets)
- [ ] Scale-adaptive symbol size (low priority enhancement)
- [ ] Anchor highlight pulse animation (decorative, lowest priority)

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
| Phase 3.7b+ | 3 | ~2-3h |
| Phase 4.5e+ (material pickers) | 4 | ~2-3h |
| Phase 5.5i+ extras (beam polish) | 4 | ~1-2h |
| Phase 2 leftover (polyline host) | 1 | ~1-2h |
| Phase 6.5 (material library editor) | ~5 | ~4-6h |
| Phase 7 (multi-select) | 4 | ~4-6h |
| Phase 8 (schedule export) | 6 | ~5-8h |
| **ΣΥΝΟΛΟ** | **~27 items** | **~19-30h** |

---

## Κρίσιμα αρχεία

- `src/subapps/dxf-viewer/bim/` — κεντρικό BIM directory
- `src/subapps/dxf-viewer/bim/services/BimToBoqBridge.ts` — BOQ bridge SSoT
- `src/subapps/dxf-viewer/bim/types/` — BIM types
- `src/subapps/dxf-viewer/canvas-v2/rendering/bim/` — renderers
- `docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md` — master ADR
