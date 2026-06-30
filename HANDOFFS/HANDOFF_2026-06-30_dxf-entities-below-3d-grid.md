# HANDOFF — Οι DXF οντότητες εμφανίζονται ΚΑΤΩ από το 3D πλέγμα (ADR-558 follow-up)

| | |
|---|---|
| **Ημερομηνία** | 2026-06-30 |
| **Author** | Opus 4.8 (session: ADR-558 grid C4D refit) |
| **Status** | 🟡 Grid ADR-558 ΛΕΙΤΟΥΡΓΕΙ & compile-άρει (UNCOMMITTED) — ΝΕΟ bug ανοιχτό |
| **ADR** | ADR-558 (`docs/centralized-systems/reference/adrs/ADR-558-cinema4d-3d-viewport-grid.md`) + ADR-537 (post-FX overlay) + ADR-040 (render gating) |
| **Working tree** | ⚠️ SHARED με άλλον agent — touch ΜΟΝΟ τα αρχεία της λίστας |
| **Commit** | ❌ ΠΟΤΕ από agent — ο **Giorgio** κάνει commit/push (N.-1) |

---

## 🎯 ΑΠΟΣΤΟΛΗ (επόμενο βήμα)

**Οι οντότητες του DXF (η εισαγμένη κάτοψη: wireframe/κείμενο/σύμβολα) εμφανίζονται ΚΑΤΩ από το
3D ground grid** — δηλ. το πλέγμα ζωγραφίζεται **πάνω** από τις DXF οντότητες ενώ θα έπρεπε να είναι
ΚΑΤΩ τους (reference έδαφος). Πρέπει να βρεθεί η ρίζα (render-order / depth / overlay-pass) και να
διορθωθεί **big-player level** (Revit / Maxon-Cinema4D / Figma).

---

## 🥇 ΥΠΟΧΡΕΩΤΙΚΑ ΠΡΩΤΑ ΒΗΜΑΤΑ (εντολή Giorgio, με τη σειρά)

1. **ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (GREP) ΠΡΙΝ γράψεις ΚΩΔΙΚΑ.** Ίχνευσε ΟΛΟ το pipeline render-order/depth
   ΠΡΙΝ φτιάξεις οτιδήποτε. Μην δημιουργήσεις διπλότυπο μηχανισμό — υπάρχει ήδη κεντρικό σύστημα
   overlay (ADR-537) + render frame. Reuse, μη παράλληλο.
2. **Δες πώς το κάνουν οι μεγάλοι** (Revit/C4D/Figma): το reference grid είναι ΠΑΝΤΑ κάτω από το
   γεωμετρικό περιεχόμενο (occluded από στερεά, αλλά κάτω από τις 2D γραμμές/σύμβολα της κάτοψης).
3. **FULL ENTERPRISE + FULL SSoT.** Αν οι μεγάλοι παίκτες δεν προτείνουν enterprise pattern, ακολούθα
   την πρακτική των μεγάλων παικτών.

---

## 🐞 ΤΟ BUG (τι ξέρουμε ήδη — μην το ξανα-ανακαλύψεις)

- Το grid εγγράφεται ως post-FX overlay **kind `'underlay'`** μέσω
  `registerPostFxOverlay(scene, provider, 'underlay')` (ADR-537).
- **Οι DXF οντότητες είναι ΚΙ ΑΥΤΕΣ `'underlay'`** (το DXF wireframe/text underlay + το frozen
  backdrop, βλ. `dxf-backdrop-cache.ts`, ADR-516 Φ2). Άρα **grid και DXF μοιράζονται τον ΙΔΙΟ
  `'underlay'` pass** → το ποιος ζωγραφίζεται πάνω καθορίζεται από draw-order + depth μέσα στον pass.
- Το grid material: `depthWrite:false`, `depthTest:true`, `renderOrder = -1`, επίπεδο Y=0,
  `side: DoubleSide` (βλ. `cinema4d-grid-floor.ts` / `cinema4d-grid-material.ts`).
- **Υπόθεση προς επιβεβαίωση (ΟΧΙ δεδομένο):** επειδή και τα δύο είναι στο Y≈0 και στον ίδιο
  `'underlay'` pass, το grid (depthWrite:false) μπορεί να καλύπτει το DXF ανάλογα με τη σειρά
  collection/draw στο `collectPostFxOverlayRoots` ή με το renderOrder. Πιθανές κατευθύνσεις:
  σωστό `renderOrder` ώστε το grid να draw-άρεται ΠΡΙΝ το DXF underlay· ή μικρό αρνητικό Y-offset
  του grid plane· ή διαχωρισμός σειράς μέσα στον underlay pass. **Διερεύνησε — μην υποθέσεις.**

### Σημεία-κλειδιά για grep/read (το audit ξεκινά εδώ)
- `src/subapps/dxf-viewer/bim-3d/scene/post-fx-overlay-pass.ts` — ο overlay registry/pass (ADR-537),
  `PostFxOverlayKind = 'underlay' | 'gizmo'`, `collectPostFxOverlayRoots`, `renderPostFxOverlays`.
- `src/subapps/dxf-viewer/bim-3d/scene/scene-render-frame.ts` — η σειρά των passes ανά frame.
- `src/subapps/dxf-viewer/bim-3d/scene/dxf-backdrop-cache.ts` — DXF underlay/backdrop (ADR-516 Φ2).
- `src/subapps/dxf-viewer/bim-3d/scene/grid/cinema4d-grid-floor.ts` — grid overlay owner (renderOrder/depth).
- `ThreeJsSceneManager.ts` — construct order (grid μετά `poi`, βλ. γρ. ~158).

---

## 🧱 ΚΑΤΑΣΤΑΣΗ ΚΩΔΙΚΑ — ADR-558 grid (UNCOMMITTED, ΛΕΙΤΟΥΡΓΕΙ, compile καθαρό)

Το grid ξαναγράφτηκε σε **C4D μοντέλο** μετά από browser-verify iterations με τον Giorgio:
- **World-locked grid σε αληθινή προοπτική** (γραμμές σε σταθερές world θέσεις, συγκλίνουν στον ορίζοντα).
- **Per-fragment decade LOD** (`fwidth`): οι γραμμές **γεννιούνται/χάνονται δυναμικά** με zoom **ΚΑΙ** κλίση.
- **Horizon fade** (απαλό dissolve στον ορίζοντα, ΟΧΙ σκληρή περίμετρος — όπως πραγματικά κάνει το C4D),
  view-relative με **hard cap 1000m**.
- **Major 1px, σκουρυντικό ×0.6** (3D-only, το 2D/token ανέπαφα)· **minor 0.7px**· **άξονες 1px**.
- post-FX `'underlay'` (AO-immune, occluded από κτίριο). `cameraPosition` = built-in uniform της THREE.
- **GLSL ASCII-ONLY** (μάθημα: ΠΟΤΕ backtick/απόστροφος/quote σε GLSL — σπάει τον ANGLE/Chrome lexer
  ΑΚΟΜΗ και μέσα σε `//` σχόλιο· μας έσπασε 2 φορές).

### Αρχεία που ΑΓΓΙΖΕΙΣ (shared tree — ΜΟΝΟ αυτά + ό,τι απαιτεί το νέο bug)
- `src/subapps/dxf-viewer/bim-3d/scene/grid/cinema4d-grid-config.ts` — knobs/χρώματα.
- `src/subapps/dxf-viewer/bim-3d/scene/grid/cinema4d-grid-material.ts` — ShaderMaterial + GLSL.
- `src/subapps/dxf-viewer/bim-3d/scene/grid/cinema4d-grid-frame.ts` — pure `computeGrid3DFrame` (fade radii).
- `src/subapps/dxf-viewer/bim-3d/scene/grid/cinema4d-grid-floor.ts` — owner· overlay register· refresh.
- `src/subapps/dxf-viewer/bim-3d/scene/grid/__tests__/cinema4d-grid-frame.test.ts` — 3 jest GREEN.
- `src/subapps/dxf-viewer/bim-3d/scene/ThreeJsSceneManager.ts` — construct+dispose (3 σημεία).
- (Για το νέο bug ίσως: `post-fx-overlay-pass.ts` / `scene-render-frame.ts` / `dxf-backdrop-cache.ts`
  — ΜΟΝΟ αφού το audit δείξει ότι εκεί είναι η ρίζα, και προσεκτικά: shared + ADR-537/ADR-516.)

### KNOBS (τελικές τιμές — `cinema4d-grid-config.ts`)
`GRID3D_BASE_CELL_M=1` · `GRID3D_MIN_CELL_PX=50` (βηματισμός spawn/merge) · `GRID3D_MAJOR_EVERY=10` ·
`GRID3D_FADE_NEAR_K=4` / `GRID3D_FADE_FAR_K=16` · `GRID3D_MAX_REACH_M=1000` ·
`GRID3D_MINOR_LINE_PX=0.7` / `GRID3D_MAJOR_LINE_PX=1.0` / `GRID3D_AXIS_LINE_PX=1.0` ·
`GRID3D_MAJOR_DARKEN=0.6` · `GRID3D_PLANE_HALF_SIZE_M=4000` · `GRID3D_MAX_OPACITY=0.9`.

---

## 📌 ΕΚΚΡΕΜΟ DOC (ADR-558) — μην το ξεχάσεις στο τέλος
Το ADR-558 §2/§3/§4 είναι **stale** (περιγράφει παλιότερες εκδόσεις: view-relative perimeter / uniform
card / computeGrid3DExtent / computeGrid3DCard). Η **ΤΕΛΙΚΗ** υλοποίηση = **per-fragment decade LOD +
horizon fade (cap 1000m), world-locked, major 1px ×0.6 darken, ΟΧΙ περίμετρος**. Διόρθωσε §2/§3/§4 +
changelog στο ΤΕΛΟΣ (αφού λυθεί το depth bug & γίνει browser-verify), στο ίδιο commit με τον κώδικα.

---

## 📏 ΚΑΝΟΝΕΣ (CLAUDE.md — κρίσιμα)
- **Γλώσσα:** απαντάς ΠΑΝΤΑ στα Ελληνικά.
- **N.-1:** ❌ ΠΟΤΕ `git commit`/`push` από agent — ο Giorgio. ❌ ΠΟΤΕ `--no-verify`.
- **N.17:** ❌ ΠΟΤΕ `tsc`/typecheck (ούτε bg). ✅ jest στοχευμένα:
  `npx jest src/subapps/dxf-viewer/bim-3d/scene/grid/` (+ τυχόν overlay/render tests).
- **N.0.1 ADR-driven:** code = source of truth· διάβασε τον τρέχοντα κώδικα, ενημέρωσε ADR.
- **N.2/N.3:** όχι `any`/`as any`/`@ts-ignore`, όχι inline styles. **N.7.1:** ≤500γρ/αρχείο, ≤40γρ/function.
- **ADR-040 / CHECK 6B/6D:** τα grid αρχεία + `ThreeJsSceneManager` ΔΕΝ είναι στις λίστες 6B/6D →
  δεν απαιτείται stage ADR-040. **ΑΝ** αγγίξεις `scene-render-frame.ts`/overlay pass, **έλεγξε** το
  `scripts/git-hooks/pre-commit` μήπως μπει σε 6D (τότε stage ADR ανάλογα).
- **Shared working tree** με άλλον agent — touch ΜΟΝΟ ό,τι χρειάζεται, μηδέν `git add -A`.

## ✅ DEFINITION OF DONE
1. Οι DXF οντότητες εμφανίζονται **ΠΑΝΩ** από το grid (το grid = reference έδαφος από κάτω), σε 2D-σε-3D
   κάτοψη + σε στερεά (occlusion από κτίριο διατηρείται).
2. SSoT: καμία διπλοτυπία — reuse του υπάρχοντος overlay/render συστήματος (ADR-537/ADR-516/ADR-040).
3. jest GREEN· GLSL ASCII-only (αν αγγιχτεί shader).
4. ADR-558 (+ ADR-537 αν χρειαστεί) ενημερωμένο + changelog.
5. 🔴 browser-verify από Giorgio· **commit από Giorgio**.
