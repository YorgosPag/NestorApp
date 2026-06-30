# ADR-558 — Cinema-4D-style ground grid στην 3D προβολή

**Status:** 🟡 IMPLEMENTED (UNCOMMITTED, v7) — 🔴 browser-verify εκκρεμεί
**Date:** 2026-06-30
**Domain:** Canvas & Rendering / DXF Viewer / 3D BIM viewport
**Related:** ADR-537 (post-FX overlay registry SSoT — `'underlay'` kind), ADR-040 (preview-canvas micro-leaf / render-gating), ADR-446/ADR-004 (Cinema 4D canvas theme + grid tokens), ADR-110 (subdivisions SSoT), ADR-009/ADR-366 (3D coordinate system Y-up/m), ADR-452 (αφαίρεση debug `AxesHelper`)

---

## 1. Πρόβλημα

Η 3D προβολή **δεν είχε κανένα grid/ground reference** (επιβεβαιωμένο grep — μηδέν `GridHelper`/floor mesh· ο debug `AxesHelper` αφαιρέθηκε στο ADR-452). Ο Giorgio ζήτησε grid **πανομοιότυπο με το εγκατεστημένο Cinema 4D R15**: ίδια χρώματα, major/minor γραμμές, world άξονες, ορίζοντας — big-player επίπεδο.

**Κρίσιμη απαίτηση (τελική, μετά από browser-verify iterations του Giorgio):** το grid **ΛΙΩΝΕΙ** στον ορίζοντα με **απαλό horizon fade** (ΟΧΙ σκληρή περίμετρος — όπως πραγματικά κάνει το C4D, dissolve προς το γκρι background). Ο fade είναι **view-relative** (κλιμακώνεται με την απόσταση κάμερας→target ώστε να κάθεται πάντα κοντά στον ορίζοντα) με **hard cap 1000m** (`GRID3D_MAX_REACH_M`). Το grid είναι **world-locked** (γραμμές σε σταθερές world θέσεις, συγκλίνουν στον ορίζοντα σε αληθινή προοπτική)· το quad απλώς **re-centre στον target** κάθε frame.

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

**Custom shader grid σε ΕΝΑ XZ quad (Y=0) με per-fragment DECADE LOD** — η σύγχρονη big-player τεχνική (Blender `overlay_grid` / Maya / Ben Golus "pristine grid"):

- **fwidth anti-aliasing** → λεπτές ~1px γραμμές σε **κάθε** zoom (δεν παχαίνουν), 1 draw-call, μηδέν geometry rebuild.
- **per-fragment decade LOD** (η ΚΑΡΔΙΑ της δυναμικής): ο shader υπολογίζει το επίπεδο λεπτομέρειας **ανά pixel** από το screen-space derivative (`worldPerPx = fwidth(worldXZ)`). Συνέπειες, όλες συνεχείς & δωρεάν:
  - zoom-in → πέφτει το LOD → φαίνονται **λεπτότερες minor** (το πλέγμα υποδιαιρείται)·
  - zoom-out → ανεβαίνει το LOD → οι λεπτές συγχωνεύονται, μένουν οι χονδρότερες δεκάδες·
  - **κλίση κάμερας** → τα μακρινά fragments έχουν μεγαλύτερο derivative → **αυτο-αραιώνουν προς τον ορίζοντα** (ποτέ συμπαγές moiré). Αυτό είναι το C4D «Dynamic Grid 1..10».
- **2 τύποι γραμμών** (όπως οι μεγάλοι παίκτες): **minor** (0.7px, sub-pixel → λεπτότερη/απαλότερη) κάθε decade cell + **major** (1px + token χρώμα **darken ×0.6 μόνο για το 3D**, το 2D/token ανέπαφα) κάθε **10η** — C4D «Major Lines Every 10th». Cross-fade των over-dense finest minor με `(1 − fract(lod))`.
- **soft horizon fade** (ΟΧΙ σκληρή περίμετρος): το grid **λιώνει** στο γκρι background καθώς πλησιάζει τον ορίζοντα — full strength μέχρι `uFadeNear`, σβηστό στο `uFadeFar`, keyed στην απόσταση fragment→κάμερα (`distance(vWorld, cameraPosition)`). Οι radii είναι **view-relative** (`NEAR_K·d` / `FAR_K·d`) με **hard cap `GRID3D_MAX_REACH_M`=1000m**. Έτσι ακριβώς το C4D dissolve-άρει προς τον ορίζοντα.
- **world άξονες** στο origin (z=0 → X κόκκινο, x=0 → Z μπλε)· mesh **re-centre στον target** κάθε frame (lines world-locked).

### Γιατί ΟΧΙ ο 2D ortho cascade (διόρθωση v1)
Η **πρώτη** υλοποίηση επανα-χρησιμοποίησε το 2D `computeAdaptiveLevels` (single representative scale στην απόσταση target) + radial fade δεμένο 1:1 στην απόσταση → **self-similar = φαινόταν ΣΤΑΤΙΚΟ** (το πλήθος γραμμών δεν άλλαζε με zoom/κλίση) και γραμμές ~3px. **Ρίζα:** ο 2D cascade είναι **ortho/single-scale** — αδυνατεί εγγενώς να εκφράσει την per-fragment πυκνότητα ενός **κεκλιμένου perspective ground plane** (near πυκνό / far αραιό). Λύση: per-fragment decade-LOD μέσα στον shader (η σωστή domain τεχνική· 2D Canvas2D vs 3D WebGL είναι ούτως ή άλλως ξεχωριστοί renderers). **Κοινό 2D↔3D:** χρώματα (tokens) + η έννοια major/minor — όχι ο pixel αλγόριθμος (αδύνατο να μοιραστεί).

### Γιατί ΟΧΙ `GridHelper` / procedural lines
`GridHelper` = fixed-size, χωρίς LOD/fade/AA control. Procedural line geometry = rebuild ανά zoom + χωρίς AA. Ο shader καλύπτει finite + AA + per-fragment LOD σε 1 draw-call.

### Rendering seam — reuse του post-FX `'underlay'` overlay (ADR-537)
Το grid είναι ground-plane reference layer — **ίδια κλάση με το DXF underlay**. Εγγράφεται μέσω `registerPostFxOverlay(scene, provider, 'underlay', OVERLAY_ORDER.GROUND)`:
- **AO-immune** (δεν το βάφει το SSAO composite → μηδέν «mustard» tint).
- **depth-tested** (occluded από το κτίριο που πατάει πάνω του).
- `root.visible=false` (owner-kept· το main render το προσπερνά)· ο provider κάθε frame κάνει refresh uniforms + επιστρέφει το root.

#### z-order: grid **κάτω** από τις DXF οντότητες (v7 fix)
**Bug (v7):** οι DXF οντότητες (wireframe/κείμενο/σύμβολα) εμφανίζονταν **ΚΑΤΩ** από το grid. **Ρίζα (όχι depth — draw order):** grid + DXF underlay είναι **και τα δύο** `'underlay'`, coplanar στο Y=0, `depthWrite:false` → κανένα δεν νικά στο depth· **η σειρά σχεδίασης** αποφασίζει. Ο overlay pass κάνει **ξεχωριστό `renderer.render(root)` ανά root**, άρα το `mesh.renderOrder=-1` του grid είναι **inert μεταξύ roots** (ταξινομεί μόνο μέσα σε ΕΝΑ render). Ο `collectPostFxOverlayRoots` διέτρεχε το registry σε **σειρά εγγραφής** → το grid (`new` στο `ThreeJsSceneManager:162`, **μετά** τον `DxfToThreeConverter:118`) ζωγραφιζόταν **τελευταίο** → πάνω από το DXF.

**Fix (big-player explicit z-order — Figma z-index / Revit draw-order / C4D object-order):** προστέθηκε `OVERLAY_ORDER = { GROUND: −100, CONTENT: 0 }` στο `post-fx-overlay-pass.ts`· ο `collectPostFxOverlayRoots` κάνει **stable-sort κατά order** (GROUND πρώτα, CONTENT μετά, ίσα order = σειρά εγγραφής). Το grid εγγράφεται ως `GROUND` → πάντα bottom-most **ανεξάρτητα από σειρά κατασκευής**· το DXF (`CONTENT`) ζωγραφίζεται από πάνω = reference έδαφος κάτω, οντότητες πάνω. Το grid **παραμένει** `'underlay'` → ο frozen-DXF-backdrop (ADR-516 Φ2) το cache-άρει κανονικά (μένει ορατό στο entity-drag), AO-immunity & depth semantics ανέπαφα· μηδέν αλλαγή σε `dxf-backdrop-cache.ts`. Το gizmo (`CONTENT`, εγγράφεται αργότερα) μένει on-top όπως πριν.

### Χρώματα — FULL SSoT, μηδέν νέο hex
major/minor διαβάζονται **ζωντανά** από τα υπάρχοντα design-tokens μέσω `resolveCssVarColor('var(--canvas-grid-cinema4d-major|minor)')` → theme switch κινεί **2D + 3D μαζί**. Άξονες/horizon (όχι ακόμη tokens) = named constants με αναφορά στην πηγή `dark.col` (αποφυγή edit στα shared generated token files — shared working tree).

## 3. Αρχεία

| Αρχείο | Ρόλος |
|---|---|
| `bim-3d/scene/grid/cinema4d-grid-config.ts` | Σταθερές (χρώματα/βήμα LOD/fade-K/max-reach/line px/major-darken/plane size) |
| `bim-3d/scene/grid/cinema4d-grid-material.ts` | `ShaderMaterial` — **per-fragment decade-LOD** + **horizon-fade** fragment shader (fwidth AA, 2 line classes, cross-fade)· `toneMapped:false` + THREE.Color uniforms + `<colorspace_fragment>`· **GLSL ASCII-only** |
| `bim-3d/scene/grid/cinema4d-grid-frame.ts` | **Pure** horizon-fade radii (`computeGrid3DFrame` → `fadeNear`/`fadeFar`, view-relative + cap 1000m) — η μόνη CPU per-frame λογική (LOD = shader) |
| `bim-3d/scene/grid/cinema4d-grid-floor.ts` | Κλάση owner· `registerPostFxOverlay('underlay', GROUND)`· per-frame refresh (χρώματα + fade radii + re-centre)· `dispose()` |
| `bim-3d/scene/grid/__tests__/cinema4d-grid-frame.test.ts` | 3 jest (fade radii view-relative, hard cap, near<far) |
| `bim-3d/scene/post-fx-overlay-pass.ts` | **v7** — `OVERLAY_ORDER` SSoT + stable z-order sort στο `collectPostFxOverlayRoots` (ADR-537 registry· grid GROUND κάτω από DXF CONTENT) |
| `bim-3d/scene/__tests__/post-fx-overlay-pass.test.ts` | +2 jest (GROUND draws first regardless of registration order· stable sort for equal order) |
| `bim-3d/scene/ThreeJsSceneManager.ts` | construct (μετά `poi`) + dispose |

## 4. SSoT reuse (audit ΠΡΙΝ τον κώδικα)

- `resolveCssVarColor` (`config/color-config.ts`) — token-live major/minor χρώματα (theme switch κινεί 2D+3D μαζί).
- `registerPostFxOverlay` `'underlay'` + `OVERLAY_ORDER.GROUND` (`scene/post-fx-overlay-pass.ts`, ADR-537) — overlay seam + z-order SSoT (κανένα παράλληλο σύστημα draw-order· reuse του υπάρχοντος registry).
- `cameraPosition` — built-in uniform της THREE για `ShaderMaterial` (μηδέν custom uniform για τη θέση κάμερας).
- **Κοινό 2D↔3D** = μόνο χρώματα (tokens) + η έννοια major/minor· ο per-fragment shader αλγόριθμος είναι 3D-only (ξεχωριστός WebGL renderer — δεν μοιράζεται με τον 2D Canvas2D cascade, βλ. §2 «Γιατί ΟΧΙ ο 2D ortho cascade»).

## 5. Συνέπειες

- **+** ΕΝΑ draw-call, AO-immune, theme-live, **soft horizon fade** (lines λιώνουν στον ορίζοντα όπως C4D, cap 1000m)· per-fragment LOD δυναμικό σε zoom+tilt· **z-order GROUND** → grid πάντα κάτω από τις DXF οντότητες.
- **−** `resolveCssVarColor` (getComputedStyle) καλείται ανά frame όταν το grid φαίνεται — αμελητέο (on-demand render loop, μη-layout-dirty DOM στο orbit). Future: cache + theme-switch subscription αν χρειαστεί.
- Toggle ON by default (όπως C4D)· `setEnabled()` εκτεθειμένο για μελλοντικό settings wiring (δεν προστέθηκε UI — shared tree).

## 6. Εκκρεμή / Open

- 🔴 **browser-verify** (Giorgio): εμφάνιση, fade-to-horizon, occlusion από κτίριο, χρώματα vs C4D, adaptive στο zoom, **DXF οντότητες πάνω από το grid** (v7), και ότι το grid μένει ορατό+κάτω κατά το entity-drag (frozen backdrop).
- Πιθανό follow-up: tokenize axis/horizon χρώματα· settings toggle· cache χρωμάτων με theme-switch subscription.

## Changelog
- **2026-06-30 (v7)** — **DXF οντότητες πάνω από το grid (z-order fix)** + **doc-alignment §1–§5**. (1) Οι DXF οντότητες εμφανίζονταν ΚΑΤΩ από το grid. Ρίζα = **draw order, όχι depth**: grid + DXF underlay και τα δύο `'underlay'` coplanar Y=0 `depthWrite:false`· ο overlay pass κάνει ξεχωριστό `render()` ανά root (το `renderOrder=-1` inert μεταξύ roots)· ο `collectPostFxOverlayRoots` διέτρεχε registry σε σειρά εγγραφής → grid (construct μετά το DXF) ζωγραφιζόταν τελευταίο = πάνω. Fix (big-player explicit z-order): `OVERLAY_ORDER={GROUND:−100,CONTENT:0}` + stable z-order sort στο `collectPostFxOverlayRoots`· grid εγγράφεται `GROUND` → bottom-most ανεξάρτητα construct order· grid μένει `'underlay'` (frozen-backdrop/AO/depth ανέπαφα, μηδέν αλλαγή `dxf-backdrop-cache.ts`). +2 jest στο `post-fx-overlay-pass.test.ts` (5/5 GREEN· 16/16 grid+overlay+backdrop). (2) §1–§5 ευθυγραμμίστηκαν με τον **τρέχοντα κώδικα** (N.0.1 code=SSoT): η τελική υλοποίηση είναι **soft horizon fade view-relative + cap 1000m + world-locked + major ×0.6 darken** (το προηγούμενο doc περιέγραφε ακόμη το «hard finite extent / `computeGrid3DExtent`» των v5/v6 που αντικαταστάθηκε από το `computeGrid3DFrame` fade μοντέλο σε επόμενο uncommitted refit). 🔴 browser-verify.
- **2026-06-30 (v6)** — **Ορατό σκληρό όριο** (Giorgio browser-verify: «οι γραμμές σταματούν στον ορίζοντα με fade, όχι σε συγκεκριμένο όριο — δες C4D»). Ρίζα: ο σκληρός κόφτης `uExtent` υπήρχε αλλά `GRID3D_EXTENT_K=16` → το όριο έπεφτε **πάνω στον ορίζοντα**, οπότε φαινόταν μόνο η grazing-angle θόλωση (μοιάζει με fade), ποτέ η κοπή. Fix: `K 16→4` ώστε το τετράγωνο να κόβει **κάτω από τον ορίζοντα** (ορατή σκληρή γραμμή + γκρι κενό από πάνω = C4D look). `K` = ο knob (μεγαλύτερο→προς ορίζοντα, μικρότερο→πιο κοντά/χαμηλά). 🔴 browser-verify (tune K).
- **2026-06-30 (v5-hotfix)** — **Shader compile fix** (`THREE.WebGLProgram: Fragment shader is not compiled`, `ERROR: 0:121: '' : syntax error`). Ρίζα: το σχόλιο του v5 hard-extent block περιείχε **backticks** (`` `fade` ``) μέσα στο GLSL — ο ANGLE/Chrome GLSL-ES lexer **δεν** δέχεται backtick/apostrophe ούτε μέσα σε σχόλιο → κενό token = syntax error (το grid material δεν μεταγλωττιζόταν ποτέ μετά το v5). Fix: ASCII-only σχόλιο στο `cinema4d-grid-material.ts` (αφαίρεση backticks + apostrophe). Αλλαγή **μόνο σε σχόλιο**, μηδέν επίπτωση render. ΜΑΘΗΜΑ: ποτέ backtick/apostrophe σε GLSL strings.
- **2026-06-30 (v5)** — **Hard finite extent αντί distance-fade** (Giorgio: «οι γραμμές προς τον ορίζοντα δεν σβήνουν με fade — σταματούν»). Επιβεβαίωση από C4D deep-dive: το `GetGridStep`'s `fade` είναι **LOD-only**, όχι distance. Αντικατάσταση radial fog + horizon tint με **square hard cutoff** `±GRID3D_EXTENT_K·d` (~1px AA edge)· αφαιρέθηκε `GRID3D_HORIZON_COLOR`/`uHorizonColor` (ο gradient bg = ορίζοντας). `computeGrid3DFog`→`computeGrid3DExtent`. 3/3 jest. 🔴 browser-verify.
- **2026-06-30 (v4)** — **Κούρδισμα στα πραγματικά C4D νούμερα** (deep-dive στα installed resources). **Πάχος → 1px για major & minor** (C4D: colour-only διάκριση, μηδέν thicker-major — διόρθωση του v1/v2/v3 που είχαν major 1.3–1.6px). `MIN_CELL_PX 48→64` (C4D target ~5–15 γραμμές/παράθυρο). Επιβεβαίωση `MAJOR_EVERY=10` (ROUGHSUB) + decade-LOD = Dynamic Grid «1..10». 4/4 jest. 🔴 browser-verify.
- **2026-06-30 (v3)** — **Πυκνότητα fix** (Giorgio: «πολύ πυκνό· δες πόσο αραιά χρησιμοποιούν οι μεγάλοι»). Ρίζα: το v2 sub-layer ζωγραφιζόταν στο `cellMinor/10` σχεδόν πλήρως → 10× πυκνό = συμπαγές. Λύση big-player: `GRID3D_MIN_CELL_PX=48` (οι λεπτότερες minor ≥48px μεταξύ τους — minor spacing ∈ [48, 480)px· major 480–4800px), και η επόμενη finer δεκάδα κάνει cross-fade-in **μόνο όταν κι αυτή ξεπεράσει το gap** (`blend · smoothstep`) → ποτέ solid. `ceil`-based LOD. 4/4 jest.
- **2026-06-30 (v2)** — **Δυναμικότητα fix** (Giorgio browser-verify: «δεν αλλάζει πλήθος γραμμών με zoom/κλίση· πολύ χοντρές»). Αντικατάσταση του 2D ortho cascade με **per-fragment decade-LOD** μέσα στον fragment shader (Blender/Golus)· λεπτές γραμμές (minor 1.0 / major 1.3 / axis 1.4 px)· 2 τύποι (minor + major κάθε 10η, decade)· cross-fade subdivisions. `cinema4d-grid-frame.ts` απλοποιήθηκε σε distance-fog μόνο. 4/4 jest GREEN. UNCOMMITTED.
- **2026-06-30 (v1)** — Αρχική υλοποίηση (Opus 4.8). 5 νέα αρχεία + wiring στον `ThreeJsSceneManager`. 7/7 jest. (στατικό look → v2)
