# HANDOFF — 3D Cinema-4D Grid: σκληρό όριο ορίζοντα + «ιπτάμενες» major γραμμές (ADR-558 v6)

| | |
|---|---|
| **Ημερομηνία** | 2026-06-30 |
| **Author** | Opus 4.8 (session: ADR-558 v1→v5) |
| **Status** | 🟡 Grid υλοποιημένο & δουλεύει (UNCOMMITTED) — 2 visual bugs ανοιχτά |
| **ADR** | ADR-558 (`docs/centralized-systems/reference/adrs/ADR-558-cinema4d-3d-viewport-grid.md`) |
| **Working tree** | ⚠️ SHARED με άλλον agent — touch ΜΟΝΟ τα 3D-grid αρχεία (λίστα §Αρχεία) |
| **Commit** | ❌ ΠΟΤΕ από agent — ο **Giorgio** κάνει commit (N.-1) |

---

## 🎯 ΑΠΟΣΤΟΛΗ (συνεχίζεται)
3D ground grid **πανομοιότυπο με Cinema 4D R15**, **big-player level** (Revit / Maxon / Figma).
**FULL ENTERPRISE + FULL SSoT.** Αν οι μεγάλοι παίκτες δεν προτείνουν enterprise-pattern,
ακολούθησε **την πρακτική των μεγάλων παικτών**.

---

## 🥇 ΥΠΟΧΡΕΩΤΙΚΑ ΠΡΩΤΑ ΒΗΜΑΤΑ (με τη σειρά, εντολή Giorgio)

### 1. ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (GREP) ΠΡΙΝ γράψεις ΚΩΔΙΚΑ
Grep για υπάρχοντα μηχανισμό ΠΡΙΝ φτιάξεις νέο — **μην δημιουργήσεις διπλότυπα**. Το grid ΗΔΗ
υπάρχει (αυτό το handoff) — **επέκτεινέ το, μην το ξαναγράψεις από την αρχή**. Κρίσιμα reuse targets
ήδη εν χρήσει: `registerPostFxOverlay('underlay')` (ADR-537), `resolveCssVarColor`, decade-LOD shader.

### 2. ΔΕΣ ΠΩΣ ΤΟ ΚΑΝΟΥΝ ΟΙ ΜΕΓΑΛΟΙ (για τα 2 bugs)
- **Blender** `overlay_grid_frag.glsl` (η χρυσή αναφορά): πολλαπλά **fixed decade levels**, καθένα με
  opacity-fade βάσει πυκνότητας· distance-fade προς ορίζοντα. **Οι γραμμές ΔΕΝ αλλάζουν θέση** ανά
  fragment — μόνο η διαφάνειά τους.
- **Ben Golus "The Best Darn Grid Shader (Yet)"** — pristine grid + LOD blending χωρίς ring artifacts.
- **C4D**: πεπερασμένο construction-plane grid (σταματά σε όριο), `GetGridStep(step, fade)` (fade=LOD
  crossfade, ΟΧΙ distance) — βλ. §Έρευνα C4D παρακάτω (ΗΔΗ έγινε deep-dive, μην το ξανακάνεις).

---

## 🐞 ΤΑ 2 ΑΝΟΙΧΤΑ BUGS (από browser-verify Giorgio, screenshot `Στιγμιότυπο οθόνης 2026-06-30 013536.jpg`)

### BUG 1 — Οι γραμμές **σβήνουν με fade** προς τον ορίζοντα, **ΟΧΙ** σε **συγκεκριμένο όριο**
- Giorgio: «οι γραμμές σταματούν στον ορίζοντα με fade και όχι με κάποιο όριο συγκεκριμένο».
- **Ρίζα:** το hard-cutoff (`uExtent = 16·distance`) είναι **πολύ μακριά** → οι γραμμές σβήνουν από
  **LOD density/AA** (κοντά στον ορίζοντα `worldPerPx`→μεγάλο → γραμμές sub-pixel → smoothstep AA τις
  σβήνει) **πριν** φτάσουν στο σκληρό όριο. Άρα το ορατό «τέλος» είναι το density-fade, όχι το όριο.
- **Τι θέλει ο Giorgio:** **ορατό σκληρό όριο** (όπως το πεπερασμένο grid του C4D), όχι dissolve.
- **Πιθανές λύσεις (διερεύνησε big-player):**
  - (A) **Fixed world extent** centered στο **world origin** (π.χ. ±N major-cells), σταθερό όριο που
    δεν κλιμακώνεται με zoom — το πιο C4D-faithful. Edge = πραγματική γραμμή στον κόσμο.
  - (B) Κράτα extent∝distance αλλά **πολύ μικρότερο K** ώστε το όριο να πέφτει εκεί που οι γραμμές
    είναι ακόμα κοφτές (πριν το density-fade) → ορατό σκληρό edge.
  - ⚠️ Σκέψου: θέλει ο Giorgio το όριο να **κινείται** με τη θέαση ή **σταθερό** στον κόσμο; (C4D=σταθερό).
    **Lead with concrete example** (ASCII/νούμερα) πριν επιλέξεις.

### BUG 2 — Οι **πρωτεύουσες (major)** γραμμές «**ίπτανται**» σε σχέση με τις δευτερεύουσες (minor)
- Giorgio: «φαίνεται σαν οι πρωτεύουσες γραμμές να ίπτανται σε σχέση με τις δευτερεύουσες».
- **Ρίζα (πιθανή):** το `lf = ceil(lod)` υπολογίζεται **ΑΝΑ FRAGMENT** → αλλάζει σε **δακτυλίους**
  (near/far) πάνω στο plane. Σε κάθε ring boundary το `cellMinor`/`cellMajor` **πηδάει** ×10 → οι major
  γραμμές αλλάζουν **θέση** εκατέρωθεν του ring → ασυνέχεια που διαβάζεται ως «ίπτανται/σπάνε».
- **Σωστή big-player λύση (Blender):** **fixed decade levels** σε **σταθερές world θέσεις** (πολλαπλάσια
  του base, π.χ. 0.1/1/10/100 m), όπου **μόνο η opacity** κάθε level fade-άρει ανά fragment βάσει
  πυκνότητας. Οι θέσεις **ΔΕΝ** υπολογίζονται ποτέ ξανά ανά fragment → **μηδέν ring/float artifact**.
  Minor = το λεπτότερο ορατό level, major = το ×10 (σταθερό χρώμα, ΟΧΙ θέση που πηδάει).
  → **Πρότεινε refactor του shader σε αυτό το μοντέλο** (render ~3-5 σταθερά decade levels, opacity by
  density, color minor/major by level role). Αυτό λύνει ΚΑΙ το BUG 2 ΚΑΙ βελτιώνει τη συνέπεια.

---

## 🧱 ΤΡΕΧΟΥΣΑ ΚΑΤΑΣΤΑΣΗ ΚΩΔΙΚΑ (ADR-558 v5, UNCOMMITTED — ΛΕΙΤΟΥΡΓΕΙ, ο shader compile-άρει)

**Νέα αρχεία (μόνο αυτά αγγίζεις — shared tree):**
- `src/subapps/dxf-viewer/bim-3d/scene/grid/cinema4d-grid-config.ts` — σταθερές/χρώματα/knobs.
- `src/subapps/dxf-viewer/bim-3d/scene/grid/cinema4d-grid-material.ts` — `ShaderMaterial` + GLSL
  (per-fragment decade-LOD, hard square cutoff). **Εδώ ζουν τα 2 bugs.**
- `src/subapps/dxf-viewer/bim-3d/scene/grid/cinema4d-grid-frame.ts` — pure `computeGrid3DExtent` (CPU).
- `src/subapps/dxf-viewer/bim-3d/scene/grid/cinema4d-grid-floor.ts` — κλάση owner, overlay register, dispose.
- `src/subapps/dxf-viewer/bim-3d/scene/grid/__tests__/cinema4d-grid-frame.test.ts` — 3 jest (extent math).

**Edits (3D-only, ΟΧΙ shared 2D):**
- `src/subapps/dxf-viewer/bim-3d/scene/ThreeJsSceneManager.ts` — construct (μετά `this.scene.add(this.poi.root)`)
  + dispose (`this.gridFloor.dispose()`). 3 σημεία.

**ΤΙ ΔΟΥΛΕΥΕΙ ΗΔΗ (μην το σπάσεις):**
- ✅ Grid εμφανίζεται, **δυναμικό** (αλλάζει με zoom/κλίση — per-fragment LOD).
- ✅ Λεπτές **1px** γραμμές (major=minor=1px, **διάκριση μόνο με χρώμα** — C4D-faithful).
- ✅ World **άξονες** από origin (X κόκκινο #E52D2D, Z μπλε #2D2DE5) — φαίνονται σωστά στο screenshot.
- ✅ Χρώματα **token-live** (`resolveCssVarColor('var(--canvas-grid-cinema4d-major|minor)')` #414141/#4B4B4B).
- ✅ post-FX **`'underlay'`** (AO-immune, occluded από κτίριο). 3/3 jest GREEN.

**KNOBS (`cinema4d-grid-config.ts`):**
- `GRID3D_EXTENT_K = 16` — πόσο μακριά το (αόρατο σήμερα) σκληρό όριο = K·distance.
- `GRID3D_MIN_CELL_PX = 64` — αραιότητα (min px λεπτότερων minor).
- `GRID3D_MAJOR_EVERY = 10` — major κάθε 10η (C4D ROUGHSUB).
- `GRID3D_MINOR_LINE_PX = 1.0`, `GRID3D_MAJOR_LINE_PX = 1.0`, `GRID3D_AXIS_LINE_PX = 1.2`.
- `GRID3D_BASE_CELL_M = 1` (decade anchor), `GRID3D_PLANE_HALF_SIZE_M = 2000`, `GRID3D_MAX_OPACITY = 0.9`.

---

## 🔬 ΕΡΕΥΝΑ C4D (ΗΔΗ ΕΓΙΝΕ — diavase, ΜΗΝ την ξανακάνεις)
Πηγή: εγκατεστημένο `C:\Program Files\MAXON\CINEMA 4D R15\resource\…` (πραγματικά αρχεία).
- **Χρώματα** (`schemes/Dark/dark.col`, VIEWCOLORS): GRID_MAJOR #414141, GRID_MINOR #4B4B4B,
  XAXIS #E52D2D, ZAXIS #2D2DE5, HORIZON #969696. major **πιο σκούρο** από minor.
- **Dynamic Grid** (`dbasedraw.{h,res,str}`): enum 0=None, 1=«1..10»(decade), 2=«1..5..10», 3=«1..2..5..10»,
  4=«1..2,5..5..10». `SPACING`/`SUB`(=Lines)/`ROUGHSUB`(=Major Every nth, default 10). `GetGridStep(step,fade)`
  → adapted spacing + **LOD crossfade** (το `fade` ΔΕΝ είναι distance-fade).
- **Πάχος γραμμής**: **1px για ΟΛΕΣ**, major **μόνο με χρώμα** (κανένα thicker-major directive).
- Το ίδιο το grid-draw/extent είναι **compiled** (binary `.exe`/`.prf` `QC4DLPR6`) — δεν υπάρχει readable
  αλγόριθμος για το πώς ορίζει το πεπερασμένο όριο/perspective. Αναπαραγωγή = parameter model + big-player τεχνική.

---

## 📏 ΚΑΝΟΝΕΣ (CLAUDE.md)
- **N.-1**: ❌ ΟΧΙ commit/push — ο Giorgio. **Shared tree** — touch ΜΟΝΟ τα 5 grid αρχεία + ThreeJsSceneManager.
- **N.17**: ❌ ΟΧΙ `tsc`/typecheck (agent)· ✅ jest στοχευμένα (`npx jest src/subapps/dxf-viewer/bim-3d/scene/grid/`).
- **N.0.1 ADR-driven**: code = source of truth. **ADR-558 §3/§4 είναι STALE** (λένε ακόμα v2: `computeGrid3DFog`/
  7 jest/`computeAdaptiveLevels` reuse) — **διόρθωσέ τα στην πραγματικότητα v5/v6** (frame=`computeGrid3DExtent`,
  3 jest, ΔΕΝ χρησιμοποιεί πια `computeAdaptiveLevels` — το LOD είναι per-fragment GLSL). Ενημέρωσε changelog v6.
- **N.2/N.3**: όχι `any`, όχι inline styles. **N.7.1**: ≤500γρ/αρχείο, ≤40γρ/function.
- **ADR-040 / CHECK 6B/6D**: τα grid αρχεία (`bim-3d/scene/grid/`) + `ThreeJsSceneManager` **ΔΕΝ** είναι στις
  λίστες 6B/6D (επιβεβαιώθηκε στο `scripts/git-hooks/pre-commit`) → **δεν** χρειάζεται stage ADR-040.
- **Lead with concrete example** (ASCII/νούμερα) όταν ρωτάς design choice (π.χ. fixed vs view-relative όριο).

---

## ✅ DEFINITION OF DONE
1. Οι γραμμές **σταματούν σε ορατό σκληρό όριο** προς τον ορίζοντα (όχι dissolve) — όπως C4D.
2. Οι **major** γραμμές **ΔΕΝ «ίπτανται»** — σταθερές world θέσεις (Blender fixed-decade-levels μοντέλο),
   μηδέν ring/float artifact.
3. Παραμένει: 1px, χρώματα token-live, άξονες, post-FX underlay, AO-immune, δυναμικό LOD, jest GREEN.
4. ADR-558 ενημερωμένο (§3/§4 + changelog v6), 🔴 browser-verify από Giorgio, **commit από Giorgio**.
