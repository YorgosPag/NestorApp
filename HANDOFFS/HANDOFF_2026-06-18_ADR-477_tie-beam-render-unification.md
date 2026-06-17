# HANDOFF — ADR-477 Slice 2: Ενοποίηση render συνδετήριας δοκού (no-duplicates) + Slice 3 EC8

**Ημερομηνία:** 2026-06-18 | **Μοντέλο:** Opus | **Κατάσταση:** Slice 1 DONE & UNCOMMITTED· Slice 2 (render unification) = ΑΥΤΟ ΠΟΥ ΚΑΝΕΙΣ ΤΩΡΑ· Slice 3 (EC8) = μετά.

> ⚠️ **Working tree μοιράζεται με ΑΛΛΟΝ agent** (slab agent, ADR-476). `git add` **ΜΟΝΟ τα δικά σου αρχεία**. **ΠΟΤΕ commit/push** — ο Giorgio κάνει commit (N.(-1)). Πριν από edit σε shared αρχείο (`section-context.ts`, `beam-rebar-2d/3d`) → **re-read first** (stale-write protection).
> 🎯 **FULL ENTERPRISE + FULL SSOT, Revit-grade, ΜΗΔΕΝ διπλότυπα** (ρητή εντολή Giorgio). N.7.1: functions ≤40 γρ., files ≤500 γρ.
> ⚠️ **tsc serialization (N.17):** πριν τρέξεις tsc → έλεγξε ότι δεν τρέχει άλλος (`Get-CimInstance Win32_Process ... '*tsc*'`).

---

## 1. Πλαίσιο — τι είναι & τι έγινε (Slice 1)

Συνδετήριο δοκάρι θεμελίωσης = `FoundationEntity` με `params.kind === 'tie-beam'` (πεδιλοδοκός). **ΕΙΝΑΙ δοκός** → ο οπλισμός του = `TieBeamReinforcement extends BeamReinforcement`, ο suggester delegate-άρει στο beam.

**Slice 1 (live auto re-study σε resize) — DONE, UNCOMMITTED, 7+63 jest GREEN, tsc-clean.** Άλλαξε 3 source + 1 test:
- `bim/structural/section-context.ts`: `resolveActiveTieBeamReinforcement(params, provider)` + tie-beam branch στο facade `resolveActiveMemberReinforcement` + `buildFootingSectionContextFromParams(params)` (refactor params-based· το entity-version delegate-άρει) + `buildTieBeamReinforcePatch` (absent→auto:true· manual→null· auto→re-derive + `beamReinforcementMateriallyDiffers` guard).
- `bim/structural/active-footing-reinforcement.ts`: auto-aware για tie-beam (store-coupled· fast-path passthrough για pad/strip & non-auto). **→ οι ΥΠΑΡΧΟΝΤΕΣ footing renderers ξανα-μελετούν σε resize χωρίς αλλαγή renderer.**
- `ui/ribbon/hooks/bridge/foundation-structural-bridge.ts`: `effectiveReinforcement`→active· manual edit→`auto:false` lock.
- `bim/structural/__tests__/active-tie-beam-reinforcement.test.ts` (7/7).
- Docs: `ADR-477-tie-beam-reinforcement-unification.md`, `adr-index.md`, `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`, MEMORY.

---

## 2. Slice 2 — Ενοποίηση render (ΤΟ TASK ΣΟΥ)

**Πρόβλημα/διπλότυπο:** το tie-beam ζωγραφίζεται σήμερα από **ξεχωριστούς** footing renderers (απλούστερους, ομοιόμορφο βήμα συνδετήρων), ΟΧΙ από το beam pipeline που έχει **EC8 κρίσιμες ζώνες (lcr≈h)** + layered bars:
- 2Δ: `bim/renderers/footing-rebar-2d.ts` → `drawTieBeam(...)` (γρ. ~173), dispatch στο `drawFootingRebar2D` (γρ. ~236: `else if (p.kind === 'tie-beam' && r.kind === 'tie-beam') drawTieBeam(...)`).
- 3Δ: `bim-3d/converters/footing-rebar-3d.ts` → `buildTieBeamCage(...)` (γρ. ~161), dispatch γρ. ~192.
- PDF: `bim/structural/detail-sheet/footing-detail-{plan,elevation}.ts` έχουν tie-beam branches (π.χ. `pushTieBeamRebar`).

**Στόχος:** το tie-beam να τροφοδοτεί ΤΟ ΙΔΙΟ beam rebar pipeline → EC8 ζώνες + διαγραφή διπλότυπου κώδικα.

### Συνιστώμενη αρχιτεκτονική (SSoT core-extraction — προτιμότερη από fake-BeamEntity)

Τα beam renderers δέχονται `Pick<BeamEntity,'id'|'params'|'geometry'>` και **εσωτερικά** καλούν `resolveActiveBeamReinforcementForEntity` + `buildBeamSectionContext` + `resolveBeamRebarLayout`, χρησιμοποιώντας `beam.geometry.axisPolyline.points`. Υπογραφές:
- `drawBeamRebar2D(ctx, beam: Pick<BeamEntity,'params'|'geometry'>, pxPerMm, worldToScreen)` — `bim/renderers/beam-rebar-2d.ts`.
- `buildBeamRebarCage(beam: Pick<BeamEntity,'id'|'params'|'geometry'>, bottomFaceY, levelId?)` — `bim-3d/converters/beam-rebar-3d.ts`.
- `resolveBeamRebarLayout(ctx: BeamSectionContext, r: BeamReinforcement): BeamRebarLayout | null` — **pure, ΑΜΕΣΑ reusable** (`reinforcement/beam-rebar-layout.ts`). `TieBeamSectionContext extends BeamSectionContext` → απευθείας συμβατό.

**Βήματα:**
1. **Extract core** από `beam-rebar-2d.ts` → νέα `drawLinearMemberRebar2D(ctx, { axisPts, sceneUnits, layout, stirrupType }, pxPerMm, worldToScreen)` (το σώμα μετά το resolve). `drawBeamRebar2D` γίνεται thin wrapper (resolve → core). Ίδιο για 3Δ: extract `buildLinearMemberRebarCage({ axisPts, sceneUnits, layout, stirrupType, bottomFaceY })` από `beam-rebar-3d.ts`· `buildBeamRebarCage` thin wrapper.
2. **Νέο SSoT helper** `bim/structural/reinforcement/tie-beam-linear-member.ts`:
   - `tieBeamSectionContext(p: TieBeamParams): BeamSectionContext` (narrow του `buildFootingSectionContextFromParams` ή inline: widthMm=`p.width`, depthMm=`p.thicknessMm`, spanMm=`hypot(end-start)`, supportType:'simple').
   - `tieBeamAxisPointsMm(p): Point2D[]` = `[p.start, p.end]` (mm-world).
3. **2Δ rewire**: `drawTieBeam` → `r = resolveActiveFootingReinforcementForParams(p)` (ήδη auto-aware, kind 'tie-beam')· `layout = resolveBeamRebarLayout(tieBeamSectionContext(p), r)`· `drawLinearMemberRebar2D(...)`. **Διέγραψε** το bespoke drawing.
4. **3Δ rewire**: `buildTieBeamCage` → ίδιο, με `bottomFaceY` = το foundation bottom Y (ήδη υπολογίζεται στο `buildFootingRebarCage`, γρ. ~183-192 — πέρασέ το). **Διέγραψε** το bespoke cage.
5. **PDF**: `footing-detail-sheet.ts` για `kind==='tie-beam'` → delegate στους `beam-detail-{elevation,section,schedule,titleblock}.ts` builders (παράγουν `DetailSheetModel`· host `FoundationDetailHost` αμετάβλητος). Διέγραψε τα tie-beam branches σε `footing-detail-plan/elevation`.
6. **Tests**: adapter parity (tie-beam vs beam → ίδιο `resolveBeamRebarLayout` output για ίδια διατομή/άνοιγμα)· 2Δ/3Δ no-crash· PDF model regions.
7. **Docs**: ADR-477 Slice 2 changelog + status· `adr-index` status· `local_ΕΚΚΡΕΜΟΤΗΤΕΣ` (ενημέρωσε τη γραμμή ADR-477)· MEMORY.

**Gotchas:**
- **Cover divergence**: ΜΗΝ αφήσεις το tie-beam να re-resolve μέσω του beam suggester (`resolveActiveBeamReinforcementForEntity`) — η θεμελίωση έχει μεγαλύτερο cover (EC2 §4.4.1). Πέρασε το **footing-resolved** reinforcement (`resolveActiveFootingReinforcementForParams`) στο core. Γι' αυτό προτιμάμε core-extraction (core δέχεται layout+reinforcement έτοιμα), ΟΧΙ fake-BeamEntity που θα ξανα-resolve-άρει.
- **Datum 3Δ**: το tie-beam κάθεται σε αρνητικό υψόμετρο (`topElevationMm` default −500). Χρησιμοποίησε το ΙΔΙΟ `bottomY` που ήδη υπολογίζει το `buildFootingRebarCage`.
- **axisPolyline**: η δοκός έχει `geometry.axisPolyline.points`· το tie-beam έχει μόνο `start`/`end` → φτιάξε `[start, end]`. Το core να δέχεται `axisPts` ΟΧΙ ολόκληρο geometry.
- **CHECK 6B/6D (pre-commit)**: αν αγγίξεις canvas drawing files / 3D converters → stage ADR (ADR-477 ή ADR-040). Δες CLAUDE.md DXF VIEWER ARCHITECTURE.
- **Shared `section-context.ts`** μόνο αν χρειαστεί (ίσως όχι στη Slice 2).

---

## 3. Slice 3 — EC8 σεισμική αξονική δύναμη σύνδεσης (ΜΕΤΑ τη Slice 2)

EC8 §5.4.1.2(7): `N_tie = ±0.3·a_g·S·N_Ed,mean` (ground B-E) των συνδεόμενων υποστυλωμάτων.
- Σεισμικά settings building-level στο `StructuralSettings` (`structural-settings.ts`): `seismicGroundAccelAgR?` + `groundType?` (ή έτοιμο `seismicTieFactor`). Default ασφαλές (a_gR≈0.16g, ground B). Update `DEFAULT_STRUCTURAL_SETTINGS`+`resolveStructuralSettings`. i18n keys ΠΡΩΤΑ.
- Νέο `bim/structural/loads/tie-beam-tie-force.ts` (scene-level): εύρεση columns/pads στα άκρα `start`/`end` (structural graph ή spatial) → `N_Ed,mean` (από `appliedLoad`/load-path takedown) → `N_tie`.
- Αποθήκευση στα tie-beam params (όπως column `appliedLoad`) → `buildFootingSectionContextFromParams` περνά `designAxialTieKn` → suggester `As,tie = N_tie/f_yd`, `max(min-detailing, tie-force)`.
- Re-study chain: proactive hook (mirror `useProactiveStructuralLoads`). Readout `N_tie`/`As,req` στο `foundation-property-fields.ts`.
- ΟΧΙ προσθήκη tie-beam στο gravity `isLoadPathMember` (σεισμική αξονική ≠ βαρυτικό tributary).

---

## 4. Επαλήθευση (Slice 2)

1. tsc full (N.17: έλεγξε πρώτα). 2. `npx jest src/subapps/dxf-viewer/bim/structural/__tests__/` + νέα adapter-parity. 3. Browser: σχεδίασε συνδετήρια δοκό, «Οπλισμός» ON → 2Δ/3Δ **ίδιας ποιότητας με δοκάρι** (πύκνωση συνδετήρων στα άκρα EC8). 4. PDF «Λεπτομέρεια Οπλισμού» → όψη/τομή/3Δ/schedule σαν δοκός. 5. Resize → live re-study (Slice 1 παραμένει). 6. Μηδέν regression pad/strip + super-structure beams.

## 5. Reuse inventory (ΜΗΝ διπλασιάσεις)

`resolveBeamRebarLayout` (EC8 ζώνες) · `drawBeamRebar2D`/`buildBeamRebarCage` (→ extract core) · `beam-detail-*` (PDF) · `samplePolylineFrame` (`geometry/shared/polyline-frame.ts`) · `REBAR_COLOR_HEX`/`REBAR_COLOR_INT`/`REBAR_MATERIAL` (`rebar-catalog`, `rebar-3d-shared`) · `resolveActiveFootingReinforcementForParams` (auto-aware, Slice 1) · `buildFootingSectionContextFromParams` (Slice 1).
