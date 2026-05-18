# ADR-363 BIM Drawing Mode — Πόρισμα Εκκρεμών Φάσεων
_Ημερομηνία ανάλυσης: 2026-05-19_
_Ενημέρωση 2026-05-19: Phase 5.5e (snap-to-wall-axis projection) ολοκληρώθηκε παράλληλα με τη συγγραφή του πορίσματος — μετακινήθηκε στις ολοκληρωμένες._

---

## Ολοκληρωμένες Φάσεις ✅

| Φάση | Περιγραφή |
|------|-----------|
| 1, 1A, 1B, 1C | Wall core + types + tool + Firestore + ribbon |
| 1D-A, 1D-B, 1D-C, 1E | WallDna Editor + AutoTrim + EntityAudit + Delete |
| 2, 2.5 | Opening core + Advanced Editing |
| 3, 3.5, 3.6, 3.7, 3.7a | Slab core + grips + polish + slab-opening + grips |
| 4, 4.5, 4.5b, 4.5c.1-4, 4.5d | Column core + grips + variants + hatch + ghost snap + ribbon |
| 5, 5.5a, 5.5b, 5.5c, 5.5d, 5.5e | Beam core + grips + width + depth + hatch + auto-snap + wall-axis projection |
| 6 | BOQ Auto-Feed core (5 entities) |
| 7A | Multi-Char BIM Hotkeys (ST/SL/OP/CL/BM) |

---

## Εκκρεμείς Φάσεις ❌

### Phase 0 + 0.5 — Documentation gap μόνο (~1h)
Ο κώδικας `bim/` skeleton υπάρχει (Phases 1-6 τρέχουν). Τα checkboxes στο ADR δεν ενημερώθηκαν ποτέ.
- [ ] Ενημέρωση checkboxes Phase 0 + 0.5 στο ADR-363
- [ ] Επαλήθευση Phase 0.5: Stair migration στο `bim/`

---

### Phase 1D-D — BOQ Auto-Feed για Wall (~1-2h)
> Dependency: Phase 6 (DONE) → μπορεί να γίνει τώρα.
- [ ] `BimToBoqBridge.feedWall()` — emit ΟΙΚ-3 BOQ item per wall

---

### Phase 2 — Deferred items (~3-5h)
- [ ] Wall split mid-opening (recompute opening positions όταν αλλάζει ο άξονας του wall)
- [ ] Wall delete cascade UX: dialog "Διαγραφή και των N κουφωμάτων;"
- [ ] Canvas pipeline call site για `composite.setOpeningsByWall(...)`
- [ ] Single-char shortcuts `D`/`Wn` → βλ. Phase 7B+

---

### Phase 3.7b+ — Slab-Opening extras (~2-4h)
- [ ] Multi-storey stack group UI ("Copy to all floors")
- [ ] Fire-rating + material fields στο ribbon (Phase 6+ BOQ dependency)
- [ ] Snap-to-edge-midpoint preview ghost

---

### Phase 4.5d — Deferred items (~3-5h)
- [ ] Wall material picker activation (depends on WallDna composable layer stack)
- [ ] Slab material picker activation (Phase 6+ material library)
- [ ] Tab/Shift+Tab cycling για material picker
- [ ] Material-aware default geometry (steel IPE/HEB profiles)
- [ ] Section-profile overlay για L-shape + T-shape columns

---

### Phase 5.5f+ — Beam/Column extras (~3-5h)
- [x] ~~Snap-to-wall-axis projection για beam endpoint~~ **✅ DONE Phase 5.5e (2026-05-19)** — βλ. ADR-363 §Phase 5.5e + `bim/walls/wall-axis-projection.ts`
- [ ] Snap-to-slab-edge perpendicular (new, Phase 5.5e deferred)
- [ ] Snap-to-opening-jamb perpendicular (new, Phase 5.5e deferred)
- [ ] Distinct i18n label "Επί άξονα τοίχου" (new, Phase 5.5e deferred)
- [ ] Column-center-line 3D wireframe snap
- [ ] Anchor highlight pulse animation (decorative)
- [ ] Beam-supports-slab analytical link (Phase 6 DONE → μπορεί τώρα)
- [ ] Section-profile preview overlay για steel I/H profile beams

---

### Phase 6.1 — DNA Layer Sub-Items per Wall (~2-4h)
- [ ] Per-layer BOQ breakdown για walls με WallDna
- [ ] `bim_materials.atoeCode` integration

---

### Phase 6.2 — Material → ΑΤΟΕ Lookup Table (~2-3h)
- [ ] `bimMaterialLibrary.atoeCode` derived mapping
- [ ] Wall-layer DNA BOQ breakdown μέσω material library

---

### Phase 6.5 — Custom Material Library Editor (~4-6h)
- [ ] ~25 seeded materials (RC/Steel/Masonry/Wood variants)
- [ ] Material library editor UI

---

### Phase 7 — Multi-Element Selection & Bulk Edit (~4-6h)
- [ ] Selection rubber-band extension για BIM entities
- [ ] Multi-select panel (common-denominator bulk edit)
- [ ] Mirror/rotate/copy semantics για BIM entities
- [ ] Group operations (move walls + hosted openings as unit)

---

### Phase 7B+ — Single-Char Variant Shortcuts (~1-2h)
- [ ] `D` → door shortcut
- [ ] `Wn` → wall variant shortcuts

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
- 3D viewer (Three.js port from genarc)
- IFC export
- MEP entities
- Real-time clash detection

---

## Σύνοψη

| Κατηγορία | Items | Εκτίμηση |
|-----------|-------|----------|
| Documentation gap (Phase 0, 0.5) | 2 | ~1h |
| Phase 1D-D | 1 | ~1-2h |
| Phase 2 deferred | 4 | ~3-5h |
| Phase 3.7b+ | 3 | ~2-4h |
| Phase 4.5d deferred | 5 | ~3-5h |
| Phase 5.5f+ (was 5.5e+, 1 done + 3 new added) | 7 | ~3-5h |
| Phase 6.1 + 6.2 + 6.5 | ~8 | ~8-13h |
| Phase 7 | 4 | ~4-6h |
| Phase 7B+ | 2 | ~1-2h |
| Phase 8 | 6 | ~5-8h |
| **ΣΥΝΟΛΟ** | **~40 items** | **~31-51h** |

---

## Κρίσιμα αρχεία

- `src/subapps/dxf-viewer/bim/` — κεντρικό BIM directory
- `src/subapps/dxf-viewer/bim/persistence/bim-to-boq-bridge.ts` — BOQ bridge (Phase 6, υπάρχει)
- `src/subapps/dxf-viewer/bim/types/` — BIM types
- `src/subapps/dxf-viewer/canvas-v2/rendering/bim/` — renderers
- `docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md` — master ADR
