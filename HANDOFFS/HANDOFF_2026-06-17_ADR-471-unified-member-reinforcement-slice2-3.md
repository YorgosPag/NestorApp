# HANDOFF — ADR-471 Unified Member Reinforcement (κολόνα+δοκάρι) → Slices 2+3

**Ημερομηνία:** 2026-06-17 · **Μοντέλο:** Opus 4.8 · **Κατάσταση tree:** UNCOMMITTED, **shared με άλλον agent** (git add ΜΟΝΟ τα δικά σου αρχεία).

---

## 🎯 Στόχος ADR-471

Ενοποίηση του συστήματος οπλισμού/auto-reinforce/προβολών σε **member-agnostic SSoT facade** (4 dispatchers: `resolveActiveMemberReinforcement`, `drawMemberReinforcement2D`, `attachMemberRebar`, `buildMemberDetailSheet`) + **πλήρης Revit-grade οπλισμός δοκού** στο επίπεδο της κολόνας (layout/2Δ/3Δ/PDF/panel/auto). Κοινό facade, **ΟΧΙ** refactor των column engines (η κολόνα μένει intact σε production).

📄 **Πλήρες spec:** `docs/centralized-systems/reference/adrs/ADR-471-unified-member-reinforcement.md` (§2 facade, §3 beam spec, §5 slices). **ΔΙΑΒΑΣΕ ΤΟ ΠΡΩΤΟ.**

---

## ✅ Τι έγινε (Slices 0-1, DONE, UNCOMMITTED)

- **Slice 0:** ADR-471 + adr-index (2 πίνακες) + γραμμή ΕΚΚΡΕΜΟΤΗΤΕΣ.
- **Slice 1 (reinforcement engine + auto):**
  - **NEW** `src/subapps/dxf-viewer/bim/structural/reinforcement/beam-rebar-layout.ts`
    - `resolveBeamRebarLayout(ctx: BeamSectionContext, r: BeamReinforcement): BeamRebarLayout | null`
    - `computeBeamStirrupLevelsMm(ctx, r): number[]` (πύκνωση κρίσιμης ζώνης lcr≈h)
    - `BeamRebarLayout` interface: `longitudinalBars[] (vMm,wMm,uStartMm,uEndMm,diameterMm,layer,role)` + `stirrupSectionPathMm` (Point2D x=v,y=w) + `stirrupHookEndsMm` + `stirrupLevelsMm` + `stirrupCornerRadiusMm` + `stirrupDiameterMm` + `stirrupCenterlineLengthMm`.
    - **Coords: beam-local mm** — u=κατά μήκος (0→span), (v,w)=διατομή centered (v=εγκάρσια/πλάτος, w=κατακόρυφα/ύψος).
    - Reuse από `column-rebar-layout.ts`: `buildRoundedStirrupPath`, `buildStirrupHookEndsMm`, `STIRRUP_BEND_CL_FACTOR`, `STIRRUP_BEND_ARC_SEGMENTS`, `closedPolylineLengthMm`.
  - `BeamReinforcement += auto?: boolean` (`beam-reinforcement-types.ts`).
  - `resolveActiveBeamReinforcement(beam, provider)` (`section-context.ts`) + store-coupled `resolveActiveBeamReinforcementForEntity(beam)` (`active-reinforcement.ts`).
  - `buildReinforcePatch` beam case → `{ ...r, auto: true }`.
  - **10 νέα jest** (`reinforcement/__tests__/beam-rebar-layout.test.ts`), **202 structural GREEN**, **tsc clean**.

**Αρχεία μου (git add ΜΟΝΟ αυτά):** `beam-rebar-layout.ts`, `beam-rebar-layout.test.ts`, `beam-reinforcement-types.ts`, `section-context.ts`, `active-reinforcement.ts`, `ADR-471-*.md`, `adr-index.md`, `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`.

---

## 🔜 ΕΠΟΜΕΝΟ: Slices 2+3 (2Δ render + 3Δ κλωβός)

### Slice 2 — Beam 2Δ render + unified overlay (domain 2Δ)
- **NEW** `bim/renderers/beam-rebar-2d.ts` → `drawBeamRebar2D(...)` — **mirror** του `bim/renderers/column-rebar-2d.ts`.
  - Κάτοψη: διαμήκεις ως γραμμές **κατά τον άξονα** της δοκού + συνδετήρες ως **εγκάρσιες** στο cover.
  - Resolve ενεργού οπλισμού: `resolveActiveBeamReinforcementForEntity(beam)` → `resolveBeamRebarLayout(buildBeamSectionContext(beam), r)`.
  - Μεταφορά beam-local (u,v) → world κατά μήκος άξονα start→end (curve-aware· δες `displayAxisPolyline` cutback ADR-458 στο `BeamGeometry`).
  - Χρώμα: `REBAR_COLOR='#c0392b'` (ίδιο με κολόνα).
- **Γενίκευση** `canvas-v2/dxf-canvas/dxf-renderer-structural-overlays.ts`: `drawColumnReinforcement2D` → `drawMemberReinforcement2D` (dispatch column/beam ανά `entity.type`· gate `isStructuralComponentVisible('reinforcement', e)`). Ενημέρωσε τον caller στο `DxfRenderer.ts` (~γραμμή 209-213).
- Ghost pass: `rendering/ghost/draw-ghost-entity.ts` (drag preview, re-derive). Bitmap cache ήδη keyed σε `showReinforcement` (`dxf-bitmap-cache.ts`) — μηδέν αλλαγή.

### Slice 3 — Beam 3Δ κλωβός (domain 3Δ)
- **NEW** `bim-3d/converters/beam-rebar-3d.ts` → `buildBeamRebarCage(beam, baseY, ...)` — **mirror** `column-rebar-3d.ts`.
  - Reuse `rebar-3d-shared.ts`: `REBAR_MATERIAL`, `buildRods` (InstancedMesh), `toThree`, `MM_TO_M`.
  - Vertical datum SSoT: `bim-three-shape-helpers` (δοκάρι top/bottom floor-relative +floorElevation). **ΠΡΟΣΟΧΗ** beam 3Δ vertical datum (δες MEMORY `reference_bim_3d_vertical_datum_ssot` — beam στη θεμελίωση).
  - Διαμήκεις = ράβδοι κατά τον άξονα στα (v,w)· συνδετήρες = κλειστά loops στο (v,w) επίπεδο σε κάθε `stirrupLevelsMm`.
- **NEW** `attachBeamRebar` στο `beamToMesh` (`bim-3d/converters/bim-three-structural-converters.ts`) + dispatcher `attachMemberRebar(composed, entity, ...)` (γενίκευση `attachColumnRebar`). Gate `isStructuralComponentVisible('reinforcement', beam)`.
  - `use-bim3d-vg-resync.ts` ήδη generic για `showReinforcement` — μηδέν αλλαγή.

---

## ⚠️ ΚΑΝΟΝΕΣ (κρίσιμα)
- **SSOT AUDIT (grep) ΠΡΙΝ από κάθε νέο αρχείο** — δες αν υπάρχει ήδη, reuse, μηδέν διπλότυπα. Όλο το beam backend ΥΠΑΡΧΕΙ ήδη.
- **ADR-040:** τα render files (DxfRenderer, structural-overlays, converters) είναι performance-critical. ΔΙΑΒΑΣΕ ADR-040· pre-commit CHECK 6B/6D μπλοκάρει αν αγγίξεις render χωρίς staged ADR → stage ADR-471.
- **Shared tree:** `git add` ΜΟΝΟ τα δικά σου. **ΟΧΙ commit/push** — ο Giorgio κάνει commit (N.(-1)).
- **tsc:** N.17 — ΕΝΑΣ tsc τη φορά, έλεγξε process πρώτα, τρέξε background.
- **Γλώσσα:** απαντάς ΠΑΝΤΑ στα Ελληνικά.
- Μετά το slice: update ΕΚΚΡΕΜΟΤΗΤΕΣ + ADR changelog + adr-index + MEMORY (N.15).

---

## 🔍 Verification (Slices 2+3)
- Browser (Firestore-first): δοκάρι → ribbon «Αυτόματος Οπλισμός» → toggle «Οπλισμός» ON → 2Δ διαμήκεις+συνδετήρες ορατοί κατά μήκος· 3Δ κλωβός ευθυγραμμισμένος με το σώμα· resize με `auto=true` → re-derive. Parity με κολόνα.
- Jest νέα 2Δ/3Δ layout-transform tests (όπου εφαρμόσιμο) + 202 structural GREEN.
