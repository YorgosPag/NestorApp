# HANDOFF — ADR-441/401: Storey-aware beams + framing-based column→beam attach (VERIFY + COMMIT)

**Date:** 2026-06-13 · **Branch:** main · **Μοντέλο: Opus** · **Shared working tree** (ΑΛΛΟΣ agent: **ADR-449 finish-skin** σε `bim-3d/converters/structural-finish-3d.ts`/`structural-finish-resolver.ts` + `ADR-449-*.md`).

> 🎯 **ΕΝΤΟΛΗ GIORGIO (διαρκής):** «όπως οι μεγάλοι παίκτες, όπως η Revit. FULL ENTERPRISE + FULL SSoT.» Απάντα **ΕΛΛΗΝΙΚΑ**.
> ⚠️ **COMMIT/PUSH τα κάνει ΜΟΝΟ ο Giorgio.** Ο agent ετοιμάζει & σταματά (N.(-1)).
> ⚠️ **Shared tree:** `git add` ΜΟΝΟ δικά μου hunks, **ΠΟΤΕ `git add -A`**.

---

## 0. ΚΑΤΑΣΤΑΣΗ — Ο κώδικας ΕΙΝΑΙ ΓΡΑΜΜΕΝΟΣ, UNCOMMITTED, jest+IDE clean

Το feature υλοποιήθηκε πλήρως στην προηγούμενη συνεδρία. **Δεν χρειάζεται νέα υλοποίηση** — μένει **browser-verify + commit** (και διόρθωση μόνο αν το verify δείξει πρόβλημα).

### Τι λύθηκε (read-only έλεγχος δημιουργίας «από κάναβο», όροφος `flr_161aa890` `height:5m`):
- **Εύρημα Α (bug):** δοκάρια «από κάναβο» γεννιόνταν με `topElevation=3000` αγνοώντας το storey (5000). Το `buildDefaultBeamParams` δεν είχε μπει στο ADR-448 Φ2 storey seam.
- **Εύρημα Β:** 0 κολώνες έκαναν attach στα δοκάρια — τα δοκάρια **frame-into** (κόβονται στην παρειά → footprint δεν ΚΑΛΥΠΤΕΙ την κολώνα → ο slab-style `hostCoversColumn` + per-corner soffit resolver αδρανείς).

### Λύση (FULL SSoT):
- **(Α)** `hooks/drawing/beam-completion.ts` `buildDefaultBeamParams`: `topElevation = resolveStoreyCeilingElevationMm(override, DEFAULT_BEAM_TOP_ELEVATION_MM)` (REUSE ADR-448 Φ2 resolver· top-of-beam = floor-relative storey ceiling· πιάνει manual+grid+sloped· fallback 3000).
- **(Β1)** `bim/columns/column-structural-attach-coordinator.ts` NEW `findColumnsFramedByBeam` — κολώνα framed όταν το κέντρο της κάθεται στον άξονα δοκαριού (perp≈0) εντός span+support· REUSE exported `columnSupportAlong` (`column-face-trim.ts`)· Z-gate beam-top > max(base,FFL).
- **(Β2)** `hooks/useStructuralAutoAttach.ts` `attachEntitiesUnderHost`: ένωση (dedup) covering+framing κολωνών → `AttachColumnsCommand('top')` (`topBinding='attached'`+`attachTopToIds`).
- **(Β3)** `bim/geometry/column-vertical-profile.ts` NEW `classifyTopHosts` + framing branch στο `resolveColumnTopProfile`: attached host που δεν καλύπτει γωνία → column top = beam `topsideZmm` (flat, max αν πολλά)· covering πλάκες κλιπάρουν per-corner κάτω **ΑΜΕΤΑΒΛΗΤΟ**. Associative δωρεάν (live resync).

**Tests:** 10 νέα jest (beam-storey ×3· `findColumnsFramedByBeam` ×7· framing top ×4) + 42 regression PASS· IDE diagnostics clean (5 source files).

---

## 1. ΤΑ ΑΡΧΕΙΑ ΜΟΥ (commit με EXPLICIT PATHS — βλ. §3)

**Source:**
- `src/subapps/dxf-viewer/hooks/drawing/beam-completion.ts`
- `src/subapps/dxf-viewer/bim/columns/column-structural-attach-coordinator.ts`
- `src/subapps/dxf-viewer/bim/columns/column-face-trim.ts` (export `columnSupportAlong`)
- `src/subapps/dxf-viewer/bim/geometry/column-vertical-profile.ts`
- `src/subapps/dxf-viewer/hooks/useStructuralAutoAttach.ts`

**Tests:**
- `src/subapps/dxf-viewer/hooks/drawing/__tests__/beam-completion-storey.test.ts` (NEW)
- `src/subapps/dxf-viewer/bim/columns/__tests__/column-structural-attach-coordinator.test.ts`
- `src/subapps/dxf-viewer/bim/geometry/__tests__/column-vertical-profile.test.ts`

**Docs:**
- `docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md` (§9 changelog — πλήρες detail)
- `docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md` (§8 changelog)

## 2. ⚠️ ΜΟΛΥΣΜΕΝΟ INDEX (κρίσιμο)

Το git index έχει **staged ξένα αρχεία του ADR-449 agent** (ΟΧΙ δικά μου — δεν έτρεξα `git add`):
`ADR-449-structural-finish-skin.md`, `bim-3d/converters/structural-finish-3d.ts`(+test), `bim-3d/converters/__tests__/structural-finish-3d-beam.test.ts`, `bim/finishes/structural-finish-resolver.ts`.
**Σκέτο `git commit` θα μπερδέψει τις δύο δουλειές.** Χρήση EXPLICIT PATHS (§3).

## 3. ΕΝΤΟΛΗ COMMIT (ο Giorgio, μόνο αφού verify ΟΚ)
```
git commit -- \
  src/subapps/dxf-viewer/hooks/drawing/beam-completion.ts \
  src/subapps/dxf-viewer/bim/columns/column-structural-attach-coordinator.ts \
  src/subapps/dxf-viewer/bim/columns/column-face-trim.ts \
  src/subapps/dxf-viewer/bim/geometry/column-vertical-profile.ts \
  src/subapps/dxf-viewer/hooks/useStructuralAutoAttach.ts \
  src/subapps/dxf-viewer/hooks/drawing/__tests__/beam-completion-storey.test.ts \
  src/subapps/dxf-viewer/bim/columns/__tests__/column-structural-attach-coordinator.test.ts \
  src/subapps/dxf-viewer/bim/geometry/__tests__/column-vertical-profile.test.ts \
  docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md \
  docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md
```

## 4. LIVE BASELINE (project pagonis-87766, ΤΩΡΑ — μετά το σβήσιμο δοκαριών)
- `floorplan_beams` = **0** (σβήστηκαν)
- `floorplan_columns` = **9**, ΟΛΕΣ `topBinding:'storey-ceiling'` (0 attached) — καθαρή αφετηρία
- `floorplan_foundations` = 24 (12 strip + 12 tie-beam)· `floorplan_slabs` = 4 (floor)· όλα verified σωστά προηγουμένως
- Όροφος `flr_161aa890-fda3-47bf-95b5-4d76d53b79b9`: `elevation:3`, `height:5` → storey ceiling = 5000mm

## 5. VERIFY (ο Giorgio θα ξαναδημιουργήσει τα δοκάρια «από κάναβο»)
**Προϋπόθεση:** dev server τρέχει τον ΝΕΟ κώδικα (HMR ή refresh — αλλιώς θα δεις παλιό behavior).

Μετά τη δημιουργία, ο agent ελέγχει **read-only** (MCP firestore):
1. `floorplan_beams` count = 12, `params.topElevation` = **5000** (όχι 3000) σε όλα.
2. `floorplan_columns` με `params.topBinding=='attached'` = **9** (ή όσες framed)· κάθε attached κολώνα έχει `params.attachTopToIds` με beam ids.

**3D (ο Giorgio):** κολώνες + δοκάρια + οροφή κλείνουν στην ίδια στάθμη (5000)· μετακίνηση/αλλαγή δοκαριού → κολώνες ακολουθούν· αλλαγή ύψους ορόφου → όλο το πλαίσιο τεντώνεται (συνεργεία με ADR-448 Φ4b cascade).

**Αν ΟΚ →** commit (§3). **Αν bug →** διόρθωση (full context στο ADR-441 §9 2026-06-13· τα 5 source files).

## 6. DEFER (μετά)
- drop-beam soffit cut (δοκάρι χαμηλότερα από οροφή → κολώνα κόβεται στο soffit).
- per-column footing-aware framing.
- Συνέχεια σταδιακού ελέγχου «από κάναβο»: **τοίχοι** (επόμενο entity) — ίδιο reverse-attach (`findHostsToAttachWallTop` υπάρχει ήδη, ADR-401 Phase D).

## 7. REFERENCE
- Πλήρες detail: **ADR-441 §9 (2026-06-13)** + ADR-401 §8 (2026-06-13).
- Σχετικό committed: **ADR-448 Φ4b** (floor-height cascade — beams + attached κολώνες/τοίχοι ακολουθούν αλλαγή ύψους ορόφου).
- MEMORY: `MEMORY.md` index line «ADR-441/401 Storey-aware beams + framing column→beam attach».
- ΕΚΚΡΕΜΟΤΗΤΕΣ: `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (κορυφή ΠΡΟΣΦΑΤΑ).
