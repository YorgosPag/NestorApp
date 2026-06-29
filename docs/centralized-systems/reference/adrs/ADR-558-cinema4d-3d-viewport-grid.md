# ADR-558 — Cinema-4D-style ground grid στην 3D προβολή

**Status:** 🟡 IMPLEMENTED (UNCOMMITTED) — 🔴 browser-verify εκκρεμεί
**Date:** 2026-06-30
**Domain:** Canvas & Rendering / DXF Viewer / 3D BIM viewport
**Related:** ADR-537 (post-FX overlay registry SSoT — `'underlay'` kind), ADR-040 (preview-canvas micro-leaf / render-gating), ADR-446/ADR-004 (Cinema 4D canvas theme + grid tokens), ADR-110 (subdivisions SSoT), ADR-009/ADR-366 (3D coordinate system Y-up/m), ADR-452 (αφαίρεση debug `AxesHelper`)

---

## 1. Πρόβλημα

Η 3D προβολή **δεν είχε κανένα grid/ground reference** (επιβεβαιωμένο grep — μηδέν `GridHelper`/floor mesh· ο debug `AxesHelper` αφαιρέθηκε στο ADR-452). Ο Giorgio ζήτησε grid **πανομοιότυπο με το εγκατεστημένο Cinema 4D R15**: ίδια χρώματα, major/minor γραμμές, world άξονες, ορίζοντας — big-player επίπεδο.

**Κρίσιμη απαίτηση (από screenshot του Giorgio):** το C4D grid **ΔΕΝ πάει στο άπειρο** — έχει πεπερασμένη έκταση και **σβήνει (radial fade) προς τον ορίζοντα**.

### Πηγή αλήθειας χρωμάτων (διαβάστηκε από την εγκατάσταση του Giorgio)
`…\MAXON\CINEMA 4D R15\resource\schemes\Dark\dark.col` → ενότητα `VIEWCOLORS`:

| C4D key | RGB | Hex |
|---|---|---|
| `VIEWCOLOR_GRID_MAJOR` | 65,65,65 | **#414141** |
| `VIEWCOLOR_GRID_MINOR` | 75,75,75 | **#4B4B4B** |
| `VIEWCOLOR_XAXIS` | 229,45,45 | #E52D2D |
| `VIEWCOLOR_ZAXIS` | 45,45,229 | #2D2DE5 |
| `VIEWCOLOR_HORIZON` | 150,150,150 | #969696 |

### Dynamic-grid μοντέλο (deep-dive στα αρχεία C4D, v4)
`resource/res/description/dbasedraw.{h,res,str}` + `resource/_api/c4d_basedraw.h`:
- **`DYNAMICGRID` enum**: 0=None, **1=«1..10»** (×10 decade), 2=«1..5..10», 3=«1..2..5..10», 4=«1..2,5..5..10». Το per-fragment decade-LOD μας = **mode 1 «1..10»**.
- **major/minor**: `SPACING` (βάση), `SUB`=«Lines» (minor κάθε SPACING/SUB), **`ROUGHSUB`=«Major Lines Every nth»** (major κάθε ROUGHSUB-η minor). Τυπικά defaults SUB=10/ROUGHSUB=10 → **major κάθε 10η minor** = `MAJOR_EVERY=10` ✓.
- **`GetGridStep(step, fade)`** (compiled vtable): επιστρέφει adapted spacing + 0–1 **crossfade** — το ίδιο smooth-merge που κάνει το `blend` μας. Target πυκνότητα **~5–15 γραμμές/παράθυρο** → `MIN_CELL_PX=64`.
- **ΠΑΧΟΣ ΓΡΑΜΜΗΣ**: **1px για ΟΛΕΣ**· major διακρίνεται **ΜΟΝΟ με χρώμα** (#414141 πιο σκούρο από #4B4B4B). **ΔΕΝ** υπάρχει thicker-major πουθενά στα resources. → minor/major line px = **1.0** (axis 1.2).
- Tilt/perspective + το ίδιο το grid-draw είναι **compiled** (binary `.exe`/`.prf` `QC4DLPR6`)· δεν υπάρχει readable αλγόριθμος — η αναπαραγωγή στηρίζεται στο parameter model + standard world-space projection.

(Παλιότερη εσφαλμένη υπόθεση v1: «major πιο σκούρο → διάκριση με πάχος» — **διαψεύστηκε**, C4D = colour-only 1px.)

## 2. Απόφαση

**Custom shader grid σε ΕΝΑ bounded XZ quad (Y=0) με per-fragment DECADE LOD** — η σύγχρονη big-player τεχνική (Blender `overlay_grid` / Maya / Ben Golus "pristine grid"):

- **fwidth anti-aliasing** → λεπτές ~1px γραμμές σε **κάθε** zoom (δεν παχαίνουν), 1 draw-call, μηδέν geometry rebuild.
- **per-fragment decade LOD** (η ΚΑΡΔΙΑ της δυναμικής): ο shader υπολογίζει το επίπεδο λεπτομέρειας **ανά pixel** από το screen-space derivative (`worldPerPx = fwidth(worldXZ)`). Συνέπειες, όλες συνεχείς & δωρεάν:
  - zoom-in → πέφτει το LOD → φαίνονται **λεπτότερες minor** (το πλέγμα υποδιαιρείται)·
  - zoom-out → ανεβαίνει το LOD → οι λεπτές συγχωνεύονται, μένουν οι χονδρότερες δεκάδες·
  - **κλίση κάμερας** → τα μακρινά fragments έχουν μεγαλύτερο derivative → **αυτο-αραιώνουν προς τον ορίζοντα** (ποτέ συμπαγές moiré). Αυτό είναι το C4D «Dynamic Grid 1..10».
- **2 τύποι γραμμών** (όπως οι μεγάλοι παίκτες): **minor** κάθε decade cell + **major** (λίγο πιο χοντρό + σκουρότερο token χρώμα) κάθε **10η** — C4D «Major Lines Every 10th». Cross-fade των finer subdivisions με `(1 − fract(lod))`.
- **distance fog → ορίζοντας** (πεπερασμένο, ΟΧΙ άπειρο): σβήνει μεταξύ `K_START·d` και `K_END·d` (d = camera→target). Η **δυναμική προέρχεται από το per-fragment LOD, ΟΧΙ από το fog**.
- **world άξονες** στο origin (z=0 → X κόκκινο, x=0 → Z μπλε)· mesh **re-centre στον target** κάθε frame (lines world-locked).

### Γιατί ΟΧΙ ο 2D ortho cascade (διόρθωση v1)
Η **πρώτη** υλοποίηση επανα-χρησιμοποίησε το 2D `computeAdaptiveLevels` (single representative scale στην απόσταση target) + radial fade δεμένο 1:1 στην απόσταση → **self-similar = φαινόταν ΣΤΑΤΙΚΟ** (το πλήθος γραμμών δεν άλλαζε με zoom/κλίση) και γραμμές ~3px. **Ρίζα:** ο 2D cascade είναι **ortho/single-scale** — αδυνατεί εγγενώς να εκφράσει την per-fragment πυκνότητα ενός **κεκλιμένου perspective ground plane** (near πυκνό / far αραιό). Λύση: per-fragment decade-LOD μέσα στον shader (η σωστή domain τεχνική· 2D Canvas2D vs 3D WebGL είναι ούτως ή άλλως ξεχωριστοί renderers). **Κοινό 2D↔3D:** χρώματα (tokens) + η έννοια major/minor — όχι ο pixel αλγόριθμος (αδύνατο να μοιραστεί).

### Γιατί ΟΧΙ `GridHelper` / procedural lines
`GridHelper` = fixed-size, χωρίς LOD/fade/AA control. Procedural line geometry = rebuild ανά zoom + χωρίς AA. Ο shader καλύπτει finite + AA + per-fragment LOD σε 1 draw-call.

### Rendering seam — reuse του post-FX `'underlay'` overlay (ADR-537)
Το grid είναι ground-plane reference layer — **ίδια κλάση με το DXF underlay**. Εγγράφεται μέσω `registerPostFxOverlay(scene, provider, 'underlay')`:
- **AO-immune** (δεν το βάφει το SSAO composite → μηδέν «mustard» tint).
- **depth-tested** (occluded από το κτίριο που πατάει πάνω του).
- `root.visible=false` (owner-kept· το main render το προσπερνά)· ο provider κάθε frame κάνει refresh uniforms + επιστρέφει το root.

### Χρώματα — FULL SSoT, μηδέν νέο hex
major/minor διαβάζονται **ζωντανά** από τα υπάρχοντα design-tokens μέσω `resolveCssVarColor('var(--canvas-grid-cinema4d-major|minor)')` → theme switch κινεί **2D + 3D μαζί**. Άξονες/horizon (όχι ακόμη tokens) = named constants με αναφορά στην πηγή `dark.col` (αποφυγή edit στα shared generated token files — shared working tree).

## 3. Αρχεία

| Αρχείο | Ρόλος |
|---|---|
| `bim-3d/scene/grid/cinema4d-grid-config.ts` | Σταθερές (χρώματα/βήμα/fade px/plane size)· reuse `RULERS_GRID_CONFIG.DEFAULT_SUBDIVISIONS` |
| `bim-3d/scene/grid/cinema4d-grid-material.ts` | `ShaderMaterial` — **per-fragment decade-LOD** fragment shader (fwidth AA, 2 line classes, cross-fade)· `toneMapped:false` + THREE.Color uniforms + `<colorspace_fragment>` |
| `bim-3d/scene/grid/cinema4d-grid-frame.ts` | **Pure** distance-fog math (`computeGrid3DFog`) — η μόνη CPU per-frame λογική (LOD = shader) |
| `bim-3d/scene/grid/cinema4d-grid-floor.ts` | Κλάση owner· `registerPostFxOverlay('underlay')`· `dispose()` |
| `bim-3d/scene/grid/__tests__/cinema4d-grid-frame.test.ts` | 7 jest (cascade steps, fade radii, lerp, zero-guard) |
| `bim-3d/scene/ThreeJsSceneManager.ts` | construct (μετά `poi`) + dispose (2 σημεία) |

## 4. SSoT reuse (audit ΠΡΙΝ τον κώδικα)

- `computeAdaptiveLevels` + `lerpOpacityTowards` (`rendering/ui/grid/grid-adaptive.ts`) — η ΙΔΙΑ cascade/fade μηχανή με το 2D grid (3D-tuned μόνο τα fade px).
- `RULERS_GRID_CONFIG.DEFAULT_SUBDIVISIONS` (=5, ADR-110) + `DEFAULT_GRID_SETTINGS.behavior.smoothFadeDurationMs` — κοινές σταθερές 2D↔3D.
- `resolveCssVarColor` (`config/color-config.ts`) — token-live χρώματα.
- `registerPostFxOverlay` `'underlay'` (`scene/post-fx-overlay-pass.ts`, ADR-537).
- `getPixelWorldSize` (`viewport/coordinate-transforms.ts`) — mode-aware px→world (perspective & ortho).

## 5. Συνέπειες

- **+** ΕΝΑ draw-call, AO-immune, theme-live, finite-with-horizon όπως C4D· πλήρης 2D↔3D parity στη grid math.
- **−** `resolveCssVarColor` (getComputedStyle) καλείται ανά frame όταν το grid φαίνεται — αμελητέο (on-demand render loop, μη-layout-dirty DOM στο orbit). Future: cache + theme-switch subscription αν χρειαστεί.
- Toggle ON by default (όπως C4D)· `setEnabled()` εκτεθειμένο για μελλοντικό settings wiring (δεν προστέθηκε UI — shared tree).

## 6. Εκκρεμή / Open

- 🔴 **browser-verify** (Giorgio): εμφάνιση, fade-to-horizon, occlusion από κτίριο, χρώματα vs C4D, adaptive στο zoom.
- Πιθανό follow-up: tokenize axis/horizon χρώματα· settings toggle· cache χρωμάτων με theme-switch subscription.

## Changelog
- **2026-06-30 (v4)** — **Κούρδισμα στα πραγματικά C4D νούμερα** (deep-dive στα installed resources). **Πάχος → 1px για major & minor** (C4D: colour-only διάκριση, μηδέν thicker-major — διόρθωση του v1/v2/v3 που είχαν major 1.3–1.6px). `MIN_CELL_PX 48→64` (C4D target ~5–15 γραμμές/παράθυρο). Επιβεβαίωση `MAJOR_EVERY=10` (ROUGHSUB) + decade-LOD = Dynamic Grid «1..10». 4/4 jest. 🔴 browser-verify.
- **2026-06-30 (v3)** — **Πυκνότητα fix** (Giorgio: «πολύ πυκνό· δες πόσο αραιά χρησιμοποιούν οι μεγάλοι»). Ρίζα: το v2 sub-layer ζωγραφιζόταν στο `cellMinor/10` σχεδόν πλήρως → 10× πυκνό = συμπαγές. Λύση big-player: `GRID3D_MIN_CELL_PX=48` (οι λεπτότερες minor ≥48px μεταξύ τους — minor spacing ∈ [48, 480)px· major 480–4800px), και η επόμενη finer δεκάδα κάνει cross-fade-in **μόνο όταν κι αυτή ξεπεράσει το gap** (`blend · smoothstep`) → ποτέ solid. `ceil`-based LOD. 4/4 jest.
- **2026-06-30 (v2)** — **Δυναμικότητα fix** (Giorgio browser-verify: «δεν αλλάζει πλήθος γραμμών με zoom/κλίση· πολύ χοντρές»). Αντικατάσταση του 2D ortho cascade με **per-fragment decade-LOD** μέσα στον fragment shader (Blender/Golus)· λεπτές γραμμές (minor 1.0 / major 1.3 / axis 1.4 px)· 2 τύποι (minor + major κάθε 10η, decade)· cross-fade subdivisions. `cinema4d-grid-frame.ts` απλοποιήθηκε σε distance-fog μόνο. 4/4 jest GREEN. UNCOMMITTED.
- **2026-06-30 (v1)** — Αρχική υλοποίηση (Opus 4.8). 5 νέα αρχεία + wiring στον `ThreeJsSceneManager`. 7/7 jest. (στατικό look → v2)
