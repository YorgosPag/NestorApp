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
  `get pass`/`dispose`).
- `__tests__/SelectionOutlinePass.test.ts` (6) + ξαναγραμμένο `__tests__/BimSelectionHighlighter.test.ts` (4).

**MODIFY**
- `BimSelectionHighlighter.ts` — emissive/material-clone **αφαιρέθηκε**· τώρα συλλέγει τα matching
  meshes ανά bimId → `outlinePass.setSelected(meshes)`. Constructor: `(group, outlinePass)`. API ίδιο.
- `ssao-modulator.ts` — δέχεται optional `outlinePass`, το προσθέτει στο composer **πριν** το copyPass·
  sync camera/size· `isOutlineActive()`. (Το pass disposed από τον owner, όχι εδώ.)
- `scene-render-frame.ts` — routing `ssaoActive || isOutlineActive()` → composer.
- `scene-rendering-subsystems.ts` — δημιουργεί το `SelectionOutlinePass` + το περνά στο `SSAOModulator`.
- `ThreeJsSceneManager.ts` — instantiate `BimSelectionHighlighter(group, outlinePass)` μετά τα subsystems.
- `scene-dispose.ts` — dispose του outline pass (μετά το `selectionHighlighter.dispose()`).

## Out of scope (γνωστοί περιορισμοί)
- Το outline εμφανίζεται στα interactive paths (raster + SSAO-idle). **ΟΧΙ** στο **path-tracer**
  (final-render) & **section-stencil** path — διαφορετικός render κόσμος. Αν χρειαστεί αργότερα,
  ξεχωριστό follow-up.
- Composite entity (πυρήνας+σοβάς+οπλισμός με ίδιο bimId): όλα τα matching meshes μπαίνουν μαζί →
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
  mechanism replaced). Unified composer + preserved raster fast-path. 10 jest GREEN. UNCOMMITTED —
  περιμένει browser-verify + commit από Giorgio.
