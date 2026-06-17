# ADR-476 — Unified Slab Reinforcement (Οπλισμός Πλακών: εδαφόπλακα / δάπεδο / οροφή)

**Status:** 🟡 IN PROGRESS 2026-06-18 (Opus) — **Slices 0-4 DONE (UNCOMMITTED)** [data unification + kind-aware suggester + auto re-study + 2Δ overlay + 3Δ κλωβός + Properties panel & structural ribbon, ΟΛΑ τα slab kinds]. **Slice 5 PENDING** [PDF detail sheet]. tsc-clean (πλην 4 προϋπαρχόντων beam WIP errors άλλου agent). 🔴 browser-verify + commit.
**Discipline:** Δομοστατικά / Structural Engineering
**Scope:** Πλήρως **ενοποιημένος** (full SSoT, μηδέν διπλότυπα) οπλισμός **ΟΛΩΝ** των ειδών πλάκας (εδαφόπλακα/raft + αναρτημένη δάπεδο/οροφή), Revit-grade. Επαναχρησιμοποιεί ΟΛΗ την υποδομή κολόνας/δοκαριού/πεδίλου: ίδιο μοντέλο σχάρας, ίδιο rebar χρώμα/υλικό, ίδιο visibility gating, ίδιο auto-reinforce pipeline, ίδιο detail-sheet engine. Επεκτείνει ADR-456/459/463/464 (structural), ADR-470 (component visibility), ADR-471 (member facade), ADR-472 (load-aware).

---

## 1. Context & Problem

Ο οπλισμός **κολόνας/δοκαριού/πεδίλου** είναι πλήρης end-to-end (Revit-grade): μοντέλο πρόθεσης → compute ποσοτήτων → **auto re-derive σε κάθε αλλαγή διάστασης/φορτίου** → 2Δ overlay → 3Δ κλωβός → Ribbon/panel → PDF.

Για **πλάκες** υπήρχε **μόνο το data μισό της εδαφόπλακας** (ADR-459 Φ4e/E3): `SlabFoundationReinforcement` (4 σχάρες + cover), `computeSlabFoundationReinforcementQuantities`, `suggestSlabFoundationReinforcementFrom`, `buildSlabFoundationSectionContext`, `buildReinforcePatch` case, guard `isFoundationSlabEntity` — όλα jest-tested.

**Κενά που έκλεισε το ADR-476:**
1. Καμία 2Δ απεικόνιση οπλισμού πλάκας (μόνο σχηματικό hatch). → **S2**
2. Κανένας 3Δ κλωβός πλάκας. → **S3**
3. Καμία auto re-study σε αλλαγή διάστασης (η εδαφόπλακα οπλιζόταν μία φορά). → **S1**
4. Κανένα structural μοντέλο για **αναρτημένες** πλάκες (floor/ceiling/roof). → **S0**

**Κενά που ΕΚΚΡΕΜΟΥΝ (S4-S5):** Slab Properties panel + structural ribbon controls + slab detail-sheet PDF.

---

## 2. Architecture Decision (Revit-grade, SSoT)

**Μία σχάρα-μοντέλο, ένας renderer (2Δ+3Δ), kind-aware ΜΟΝΟ ο suggester.**

Το σχήμα `SlabFoundationReinforcement` (4 σχάρες: `bottomMeshX/Y` + `topMeshX/Y` + `coverMm`) είναι **ήδη γενικό** — καλύπτει εδαφόπλακα (top+bottom πλήρης) ΚΑΙ αναρτημένη δίδρομη (κάτω ανοίγματος + άνω στηρίξεων). **Γενικεύθηκε επιτόπου** (additive, μηδέν disruptive rename — 22 callers + tests + uncommitted work άλλων agents).

### §Naming — γιατί ΟΧΙ rename
Το όνομα `SlabFoundationReinforcement`/`SlabFoundationSectionContext`/`suggestSlabFoundationReinforcement` **διατηρείται ιστορικά**: το rename σε `SlabStructuralReinforcement` θα άγγιζε 22 αρχεία (+ shared tree άλλων agents) με υψηλό merge ρίσκο και μηδενικό λειτουργικό όφελος. Το type/context/method τεκμηριώνονται ως **universal** (foundation + suspended). Η `kind` διάκριση ζει στο context (`SlabReinforcementKind`).

---

## 3. Slices

### S0 — Data unification + kind-aware suggester ✅ DONE
- `SlabReinforcementKind = 'foundation' | 'suspended'` + kind-aware πεδία (`kind?`, `maxFreeSpanMm?`, `designLoadKpa?`, `concreteGrade?`) στο `SlabFoundationSectionContext` (όλα optional → foundation behavior αμετάβλητη). — `codes/structural-code-types.ts`
- `auto?: boolean` στο `SlabFoundationReinforcement`. — `reinforcement/slab-foundation-reinforcement-types.ts`
- Kind-aware όρια στους **δύο** providers: αναρτημένη → Ø8, `smax = min(3h,400)` (EC2 §9.3.1.1(3)) / `min(2h,300)` (ΕΚΩΣ §18), cover 25· εδαφόπλακα → Ø12, βήμα 250/200, cover 50 (αμετάβλητη). — `eurocode-provider.ts`, `greek-legacy-provider.ts`
- Kind-aware suggester `suggestSlabFoundationReinforcementFrom`: αναρτημένη → κάτω σχάρα = `max(ρ_min, As(q·L²/8))` (EC2 §6.1, z=0.9d), άνω = ελάχιστη διάταξη· εδαφόπλακα → top+bottom πλήρης (αμετάβλητη). Reuse SSoT `resolveMatMesh`. — `suggest-reinforcement.ts`
- `SlabParams.concreteGrade?: ConcreteGrade`. — `bim/types/slab-types.ts`
- Guards `isSuspendedSlabEntity` + `resolveSlabReinforcementKind` + γενίκευση `buildSlabFoundationSectionContext` (kind/span/grade/load) + `resolveSlabDesignLoad` (q_Ed = W_Ed(ULS)/area). — `section-context.ts`

### S1 — Auto re-study (η «στατική μελέτη που ξανατρέχει») ✅ DONE
- `resolveActiveSlabReinforcement(slab, provider)` (auto-aware re-derive) + `resolveActiveMemberReinforcement` SlabEntity overload + `slabReinforcementMateriallyDiffers` (4 σχάρες, anti-oscillation) + γενίκευση `buildReinforcePatch` slab branch (ΟΛΑ τα kinds: absent→auto:true, manual→null, auto→re-derive+guard). — `section-context.ts`
- `resolveActiveSlabReinforcementForEntity` store-coupled wrapper για renderers. — `active-reinforcement.ts`
- `isReinforceable` → όλες οι πλάκες (`isSlabEntity`). — `structural-auto-reinforce-core.ts`
- `bim:slab-params-updated` στα `PROACTIVE_REINFORCE_EVENTS` + `GEOMETRY_EDIT_TRIGGERS` + `PROACTIVE_LOAD_EVENTS` (το event εκπέμπεται ήδη από grip/ribbon). — `useProactiveOrganismReinforce.ts`, `useProactiveStructuralLoads.ts`

### S2 — Unified 2Δ slab rebar overlay ✅ DONE
- NEW `bim/renderers/slab-rebar-2d.ts` → `drawSlabRebar2D`: δι-διευθυντικές σχάρες (bbox−cover) με **polygon clip** (Revit-grade, μη-ορθογώνιες πλάκες)· κάτω = συμπαγείς, άνω = διακεκομμένες (top mark)· χρώμα `REBAR_COLOR_HEX` SSoT.
- NEW `canvas-v2/dxf-canvas/dxf-slab-reinforcement-overlay.ts` → `drawSlabReinforcement2D` (mirror foundation overlay)· gate `structuralReinforcement` + `isStructuralComponentVisible('reinforcement', slabEntity)` + `isHiddenByCutPlane`· ⚠️ slab = wrapper (`entity.slabEntity`).
- Wiring: `DxfRenderer.render()` βήμα 7 (μετά foundation overlay). Το σχηματικό `SlabRenderer.drawReinforcementHatch` (hint enum) **μένει αμετάβλητο**.

### S3 — Unified 3Δ slab rebar cage ✅ DONE
- NEW `bim-3d/converters/slab-rebar-3d.ts` → `buildSlabRebarCage`: οριζόντιες σχάρες (κάτω `bottomY+cover`, άνω `bottomY+thickness−cover`)· reuse `rebar-3d-shared` (`buildRods` InstancedMesh, `REBAR_MATERIAL`, `toThree`, `MM_TO_M`).
- `attachSlabRebar` (mirror `attachBeamRebar`) στο `slabToMesh` μετά το `applyStructuralCoreVisibility3D`· `bottomY = mesh.position.y` (= κάτω παρειά μέσω `hangDownMeshY`)· gate `showReinforcement`. — `bim-three-structural-converters.ts`
- DEFER: multilayer-DNA slab path (`buildMultiLayerSlabSolid`) — μόνο single-extrude wired (οι περισσότερες πλάκες).

### S4 — UI: Properties panel + Ribbon ✅ DONE
- NEW `ui/slab-advanced-panel/{slab-property-fields, SlabAdvancedPanel, SlabPropertiesTab}` (reuse generic `bim-property-types`/`BimPropertyRow` — μηδέν νέο row component) + `slab-structural-bridge` (resolve/apply state + readouts· `auto:false` lock στο edit· `effectiveReinforcement` = SSoT `resolveActiveSlabReinforcement` → πίνακας δείχνει ΙΔΙΟ design με 2Δ/3Δ) + `useSlabParamsDispatcher` (wrap **υπάρχον** `UpdateSlabParamsCommand` + emit `bim:slab-params-updated` → re-study) + `isSlabEntity` branch στο `BimPropertiesRouter`.
- Structural keys προστέθηκαν στο **υπάρχον** `slab-command-keys.ts` (mirror `beam-command-keys`): `SLAB_STRUCTURAL_KEYS` (code/concreteGrade/bottom·topMeshDiameter·Spacing/cover) + `SLAB_STRUCTURAL_READOUT_KEYS` (bottom/top label, βάρος, ρ%, g/q/q_Ed) + `SLAB_STRUCTURAL_VISIBILITY_KEYS` + `SLAB_STRUCTURAL_KEY_TO_FIELD` + guards + `resolveSlabPanelVisibility` (RC-only gating) + `autoReinforce` action.
- **Πεδία σχάρας:** ένα ζεύγος combos κάτω + ένα άνω (Ø+βήμα· X/Y ίδια στο default UI — DEFER ξεχωριστά X/Y)· options reuse `FOUNDATION_*` (ίδιο μοντέλο σχάρας με πέδιλο, μηδέν νέα options) + `STRUCTURAL_CODE_OPTIONS`/`CONCRETE_GRADE_OPTIONS`.
- **Ribbon `slab-reinforcement-actions`** (RC-gated μέσω `getPanelVisibility` wired στο `useRibbonSlabBridge` + `useRibbonCommands`): widget `show-reinforcement-toggle` (κοινό per-view flag) + κουμπί «Αυτόματος Οπλισμός» → emit `bim:auto-reinforce-requested` → **υπάρχον** undoable organism pipeline (ήδη χειρίζεται slabs, S1). Boy-scout SSoT: `formatSlabFoundationTopLabel` δίπλα στο main label.
- i18n: `slabAdvancedPanel.*` + `ribbon.commands.slabStructural.*` + `ribbon.panels.slabStructural` (el+en)· reuse `reinforcement.label`/`autoReinforceOrganism`.
- Tests: `slab-structural-keys.test.ts` (8 — KEY_TO_FIELD completeness, guards, RC gating, action key, labels). tsc-clean (δικά μας).

### S5 — PDF detail sheet 🔴 PENDING (αναβλητέο)
- NEW `bim/structural/detail-sheet/slab-detail-*` → `buildSlabDetailSheet` (reuse `DetailSheetModel`/layout/canvas+pdf renderers/`DetailSheetDialog`/`detail-3d-capture-core`) + `SlabDetailHost`.

---

## 4. DEFER / Limitations
- **Suspended top mesh** = ελάχιστη διάταξη (detailing/anti-crack), ΟΧΙ continuity-driven hogging (χρειάζεται ανάλυση συνέχειας/πλαισίου).
- **Span model** αμφιέρειστο (M=q·L²/8) — ΟΧΙ δι-διευθυντικός συντελεστής/coefficient method. `maxFreeSpanM` = min bbox dimension fallback.
- **q_Ed source** = `slab.params.appliedLoad` (tributary). Πλάκες εκτός load-graph (ADR-467) → όταν absent, min-detailing κυριαρχεί (όπως κολόνα/δοκάρι χωρίς φορτίο).
- **Multilayer-DNA slabs** (3Δ): rebar μόνο στο single-extrude path.
- **Old stored foundation reinforcement** (χωρίς `auto`) → manual (μηδέν regression· νέες πλάκες παίρνουν `auto:true`).

---

## 5. SSoT Reuse (μηδέν διπλότυπα)
Χρώμα/υλικό `REBAR_COLOR_HEX/INT` + `REBAR_MATERIAL`/`buildRods`· επιλογή σχάρας `resolveMatMesh`· ποσότητες `meshDirectionTotals`/`footingEffectiveDepthMm`· visibility `isStructuralComponentVisible`/`isHiddenByCutPlane`/`applyStructuralCoreVisibility3D`· facade `resolveActiveMemberReinforcement`/`buildReinforcePatch`/proactive pipeline· vertical datum `hangDownMeshY`.

---

## 6. Changelog
- **2026-06-18 (Opus) — S4:** Slab Properties panel + structural ribbon DONE (UNCOMMITTED). NEW `ui/slab-advanced-panel/{slab-property-fields, SlabAdvancedPanel, SlabPropertiesTab}` + `slab-structural-bridge` + `useSlabParamsDispatcher` + `slab-structural-keys.test.ts`. MOD `slab-command-keys` (structural keys + RC visibility + autoReinforce action) + `useRibbonSlabBridge` (getPanelVisibility + autoReinforce) + `useRibbonCommands` (slab panel-visibility branch) + `BimPropertiesRouter` (slab branch) + `contextual-slab-tab` (RC-gated reinforcement panel) + `slab-foundation-reinforcement-types` (formatSlabFoundationTopLabel) + i18n el/en. Full SSoT (reuse generic BimPropertyRow + FOUNDATION_* options + existing UpdateSlabParamsCommand + organism auto-reinforce pipeline). 8 jest GREEN· tsc-clean (πλην 4 προϋπαρχόντων beam WIP errors άλλου agent). S5 (PDF) pending.
- **2026-06-18 (Opus):** Slices 0-3 DONE (UNCOMMITTED). Universal slab reinforcement (foundation + suspended): kind-aware suggester (EC2 §9.3.1/§9.8.2), auto re-study, 2Δ polygon-clipped mesh overlay, 3Δ bbox mesh cage. ~14 αρχεία (8 mod + 3 new src + 1 new ADR + 2 proactive). S4-S5 pending.
