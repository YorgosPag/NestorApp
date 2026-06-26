# ADR-536 — Cinema 4D / Revit-style selection **silhouette outline** στο BIM 3D viewport

**Status:** ✅ APPROVED · **Date:** 2026-06-26 · **Domain:** DXF Viewer — 3D Rendering / Selection
**Supersedes (mechanism only):** ADR-366 A.1 (emissive highlight) · **Render-loop governance:** ADR-040

---

## Context / Problem

Στο BIM 3D viewport, όταν επιλέγεται μια οντότητα, ο `BimSelectionHighlighter` **κλωνοποιούσε
το material** κάθε επιλεγμένου mesh και έβαζε **emissive gold (`0xffd700`) σε ΟΛΟ το σώμα** →
«βάφεται όλο το αντικείμενο». Ο χρήστης (Giorgio) το θεωρεί άσχημο και ζήτησε συμπεριφορά όπως
**Cinema 4D (Maxon) / Revit**: να φωτίζεται **ΜΟΝΟ το εξωτερικό περίγραμμα (silhouette)** με
κίτρινη/χρυσή γραμμή, **χωρίς** αλλαγή στο material του σώματος, και να μένει **πάντα ορατό
(και κατά το orbit)**.

## Decision

Χρήση του Three.js **`OutlinePass`** (`three/addons/postprocessing/OutlinePass.js`, three@0.170)
— το ίδιο effect με Cinema 4D / Revit: silhouette glow γύρω από τα `selectedObjects`, χωρίς
αλλαγή του material τους, μόνο εξωτερικό περίγραμμα (όχι όλες οι ακμές).

### Recognition (SSoT audit — τι έγινε reuse)
- **`SSAOModulator`** (`bim-3d/lighting/ssao-modulator.ts`) έχει ΗΔΗ `EffectComposer`
  (`RenderPass → SSAOPass → CopyPass`). Reuse — το OutlinePass μπαίνει στο **ίδιο** composer.
- **`BimSelectionHighlighter`** έχει ΗΔΗ το lifecycle (group-traverse ανά `userData.bimId`,
  diff old/new, callers στο `scene-manager-actions.ts`). Reuse — αλλάζει μόνο ο μηχανισμός
  (emissive → silhouette), το API `onSelect(Set)/onClear()` μένει ίδιο (callers ανέγγιχτοι).
- **3D outline color token pattern**: mirror του `accessibility/bim-a11y-color-tokens.ts`
  (focus ring = cyan). Νέο SSoT token για selection = gold.
- **Render-loop**: mutation→redraw μέσω υπάρχοντος `markSceneDirty()` (ADR-040 Phase XXIII·
  `selectBimEntity` ήδη το καλεί). **Καμία νέα subscription / RAF.**

### Αρχιτεκτονική — unified composer + preserved raster fast-path (hybrid)

Ένα `OutlinePass` μέσα στο υπάρχον composer:

```
RenderPass → SSAOPass → OutlinePass → CopyPass
              (idle)      (selection)
```

Κάθε pass ελέγχεται με `.enabled`:
- **SSAOPass.enabled** = μόνο on-idle (αμετάβλητο — το ακριβό refine-on-idle ΔΕΝ χαλάει).
- **OutlinePass.enabled** = μόνο όταν υπάρχει επιλογή (αλλιώς το `EffectComposer` το skip-άρει,
  μηδέν κόστος).

Routing στο `scene-render-frame.ts`:

| Συνθήκη | Path |
|---|---|
| `pathTracer.isActive` | path tracer (αμετάβλητο) |
| `section stencil active` | section controller (αμετάβλητο) |
| `ssaoActive \|\| outline.hasSelection()` | **composer** (`ssaoModulator.render()`) |
| αλλιώς (navigation, no selection) | **raster fast-path** (`renderRaster()`, διατηρείται) |

**Γιατί hybrid:** το outline πρέπει να είναι **πάντα ορατό** (idle ΚΑΙ orbit) — άρα όταν υπάρχει
επιλογή τρέχει το composer σε κάθε frame. Όμως κατά το orbit το **SSAO μένει disabled** → καμία
`overrideMaterial`/program churn (η αιτία του παλιού zoom/orbit lag, βλ. ADR-040 §SSAO follow-up).
Στο κοινό «orbit χωρίς επιλογή» διατηρείται το direct raster fast-path → μηδέν regression. Είναι ο
κανονικός τρόπος που το three.js συνδυάζει passes — ΕΝΑ composer, ΕΝΑ OutlinePass (SSoT).

## Files

**NEW**
- `bim-3d/systems/selection/selection-outline-tokens.ts` — SSoT χρώμα
  (`BIM_SELECTION_OUTLINE_COLOR_THREE = 0xffd700` + CSS variant).
- `bim-3d/systems/selection/SelectionOutlinePass.ts` — thin wrapper γύρω από `OutlinePass`
  (color token, edgeStrength 4 / edgeThickness 1.5 / edgeGlow 0.3 / `pulsePeriod = 0`·
  `setSelected` → `selectedObjects` + `enabled = length>0`· `setCamera`/`setSize`/`hasSelection`/
  `get pass`/`dispose`· **`renderOverlayToScreen(renderer)`** — edges→transparent RT → additive
  blit to screen, για τον section path· lazy edge-RT + `FullScreenQuad` additive blit material).
- `__tests__/SelectionOutlinePass.test.ts` (6) + ξαναγραμμένο `__tests__/BimSelectionHighlighter.test.ts` (4).

**MODIFY**
- `BimSelectionHighlighter.ts` — emissive/material-clone **αφαιρέθηκε**· τώρα συλλέγει τα matching
  meshes ανά bimId → `outlinePass.setSelected(meshes)`. Constructor: `(group, outlinePass)`. API ίδιο.
- `ssao-modulator.ts` — δέχεται optional `outlinePass`, το προσθέτει στο composer **πριν** το copyPass·
  sync camera/size· `isOutlineActive()`· `renderOutlineOverlayToScreen()` (delegation για section path)·
  dispose του outline pass (ζει στο composer του).
- `scene-render-frame.ts` — routing `ssaoActive || isOutlineActive()` → composer· **+ section branch:
  μετά το `renderFrameWithCaps` καλεί `renderOutlineOverlayToScreen()`** ώστε το outline να φαίνεται
  και με ενεργό cut.
- `scene-rendering-subsystems.ts` — δημιουργεί το `SelectionOutlinePass` + το περνά στο `SSAOModulator`.
- `ThreeJsSceneManager.ts` — instantiate `BimSelectionHighlighter(group, outlinePass)` μετά τα subsystems.
- `scene-dispose.ts` — dispose του outline pass (μετά το `selectionHighlighter.dispose()`).

## Render-path coverage
Το outline εμφανίζεται σε **ΟΛΑ** τα interactive render paths:
- **raster** (navigation) & **SSAO-idle**: μέσω του OutlinePass μέσα στο composer (routing
  `isSsaoActive() || isOutlineActive()`).
- **section-cut stencil path** (ADR-452/455): αυτός ο path κάνει direct render + stencil caps και
  **παρακάμπτει το composer** (το RT του δεν έχει stencil). → `SelectionOutlinePass.renderOverlayToScreen()`
  υπολογίζει τις ακμές σε διάφανο RT και τις κάνει **additive blit** πάνω στο τελικό καρέ, μετά το
  `renderFrameWithCaps`. (Κρίσιμο: ο section ήταν ο **κύριος** path του χρήστη — όχι edge case.)

**Out of scope:** το **path-tracer** (final-render) path — διαφορετικός render κόσμος, ξεχωριστό
follow-up αν χρειαστεί.

**Composite entity** (πυρήνας+σοβάς+οπλισμός με ίδιο bimId): όλα τα matching meshes μπαίνουν μαζί →
ΕΝΑ ενιαίο εξωτερικό silhouette (ο οπλισμός μέσα occluded). Σωστό.

## Verification
- **jest (ts-jest):** 10/10 GREEN (`SelectionOutlinePass.test.ts` 6 + `BimSelectionHighlighter.test.ts` 4).
- **N.17:** όχι full tsc (OOM) — ts-jest + static type check (`Pass` base typed: enabled/setSize/dispose).
- **Browser (Giorgio):** τελική οπτική επιβεβαίωση — κίτρινο silhouette, σώμα **αναλλοίωτο**, ορατό
  ΚΑΙ κατά το orbit. (Selection = visual → δηλώνεται ρητά: jest-verified, όχι browser-verified.)

## ADR-040 compliance
Καμία `useSyncExternalStore`/subscription σε orchestrator· κανένα νέο RAF. Το outline ενημερώνεται
μέσω του υπάρχοντος dirty flow (`selectBimEntity → markSceneDirty`). Αγγίζεται `scene-render-frame.ts`
(ADR-040-governed) → stage ADR-040 μαζί (CHECK 6B/6D).

## Changelog
- **2026-06-26** — Initial. emissive whole-body highlight → OutlinePass silhouette (ADR-366 A.1
  mechanism replaced). Unified composer + preserved raster fast-path. 14 jest GREEN.
- **2026-06-26 (v2, browser-verified)** — **Section-cut path fix:** ο χρήστης δούλευε με ενεργό
  section cut → όλα τα frames περνούσαν από τον section stencil path (bypass composer) → το outline
  ΔΕΝ φαινόταν. Προστέθηκε `SelectionOutlinePass.renderOverlayToScreen()` (edges→transparent RT →
  additive blit) + `SSAOModulator.renderOutlineOverlayToScreen()` delegation + κλήση στο section
  branch του `scene-render-frame`. **✅ Browser-verified από Giorgio** (περίγραμμα ορατό).
- **2026-06-26 (v3)** — Χρώμα token: gold `#FFD700` → πορτοκαλί **`#FFAA16`** (RGB 255,170,22)
  κατ' απαίτηση Giorgio. UNCOMMITTED — περιμένει commit από Giorgio.
