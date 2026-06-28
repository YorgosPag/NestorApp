# HANDOFF — 3D cursor «swim»: ο ένοχος είναι το 3D scene render (~40ms/frame), όχι ο κέρσορας

**Ημ/νία:** 2026-06-29 · **ADR:** 366 §B.5 (3D BIM viewer photorealistic rendering) · **Model προηγ.:** Opus 4.8

---

## 0. TL;DR — τι ψάχνουμε να λύσουμε

Ο κέρσορας/σταυρόνημα στο **3D BIM viewport «κολυμπάει»** (δεν είναι 1:1 με το ποντίκι), **παντού** (ακόμα και σε κενό χώρο), **και σε production** (όχι μόνο dev).

**ΑΠΟΔΕΔΕΙΓΜΕΝΗ ΡΙΖΑ (με δεδομένα, όχι εικασία):** το **3D scene render** (`bim-3d-scene` system στον `UnifiedFrameScheduler`) κοστίζει **~40ms/frame (spike έως 196ms)** και πυροδοτείται **~10-20 φορές** σε ένα σάρωμα κέρσορα 3-4s (σε κάθε settle: hover-on-settle + shadow-on). Κάθε τέτοιο frame γίνεται ~40ms μακρύ → ο compositor δίνει νέα θέση σταυρονήματος κάθε ~40-90ms (~12-19fps) → swim. `cursor.totalLag` p95 ≈ 95-115ms ≈ ο χρόνος του render.

**Το render 40ms για σκηνή 546 τριγώνων είναι ΠΑΘΟΛΟΓΙΚΟ** → το κόστος είναι **fullscreen post-process** (shadow PCF + πιθανόν **SSAO composer**) που κλιμακώνει με τα screen pixels, ΟΧΙ η γεωμετρία. Τα 196ms spikes μυρίζουν **shader recompile** (από το `invalidateMaterials()` σε κάθε shadow toggle).

---

## 1. ΤΑ ΔΕΔΟΜΕΝΑ (production-grade perf report, dev, `dxf-perf-trace`)

Per-system frame cost (νέο diagnostic `frame.<systemId>` — βλ. §3):

| system | avg | max | counts/sweep | σχόλιο |
|--------|-----|-----|--------------|--------|
| **`frame.bim-3d-scene`** | **38-48ms** | **44-196ms** 🔴 | **~10-20** | **Ο ΕΝΟΧΟΣ** |
| frame.dxf-canvas | 25ms | 85ms | ~5 (σπάνιο) | όχι κύριο |
| frame.bim3d-pointer-pick | 3-5ms | 32ms | 6-11 | αμελητέο |
| frame.snap-detection | 3ms | 6ms | 3 | αμελητέο |
| frame.layer-canvas | 1ms | 1ms | 1 | αμελητέο |

`cursor.totalLag` avg 75-112ms / p95 95-115ms · `cursor.inputLatency` avg 1-2ms (το input φτάνει ΓΡΗΓΟΡΑ — το **paint** μπλοκάρεται). Console: `UnifiedFrameScheduler.ts [Violation] 'requestAnimationFrame' handler took 50-88ms`.

**Απορρίφθηκαν με δεδομένα:** (α) «dev runtime μόνο» — όχι, υπάρχει named system· (β) «το 2D canvas τρέχει κάτω από το 3D» — όχι (dxf-canvas 1-25ms σπάνια, με isDirty gate)· (γ) «ο pointer pick» — όχι (3-5ms). Ο κέρσορας/compositor είναι ήδη βέλτιστος (ένα GPU `translate3d`, σύγχρονο στο mousemove — `CrosshairCompositor.applyTransform`).

---

## 2. ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΕΠΟΜΕΝΟ ΒΗΜΑ (η δουλειά)

**Στόχος:** το 3D scene render να ΜΗΝ μπλοκάρει τον κέρσορα κατά την ενεργή εργασία — big-player (Revit / Maxon Cinema4D) viewport doctrine.

### 2.0 ΠΡΩΤΑ — άμεσος έλεγχος (console, πριν κώδικα)
```js
useViewMode3DStore.getState().autoPreviewEnabled
```
- Αν **`true`** → τρέχει το **SSAO composer** (FBO + SSAO + blur) σε κάθε settle = το 40ms. Πρώτος ύποπτος.
- Επίσης μέτρα ξανά με `localStorage.setItem('dxf-no-shadows','1')` και δες αν το `frame.bim-3d-scene` πέφτει (απομονώνει shadows vs SSAO vs base raster).

### 2.1 Κατευθύνσεις διόρθωσης (big-player, ιεραρχία)
1. **Quality refine ΜΟΝΟ σε γνήσιο μακρύ idle, όχι σε κάθε micro-settle.** Σήμερα οι σκιές (και πιθανόν SSAO) ανάβουν σε κάθε settle (~350ms) → 40ms render σε κάθε παύση εξερεύνησης. Big players: κατά την ΕΝΕΡΓΗ εργασία κρατούν φθηνό raster· το ακριβό quality (shadows/SSAO/AA refine) μπαίνει μόνο μετά από **πραγματική ακινησία** (υπάρχει ήδη `IdleDetector` + `DXF_TIMING.gesture.CAMERA_IDLE=800`). **Ακύρωση** του pending refine αν ξαναρχίσει κίνηση (αλλιώς το refine μπλοκάρει το resumed motion).
2. **Settle render να μη μπλοκάρει:** cheap-immediate frame στο settle (χωρίς shadows/SSAO) + deferred full-quality refine.
3. **196ms spikes:** εξάλειψη του per-toggle `invalidateMaterials()` churn (`shadow-modulator.ts` `update()` → `invalidateMaterials()` σε ΚΑΘΕ OFF↔ON toggle· σε γρήγορη εναλλαγή motion/settle = επαναλαμβανόμενο shader re-acquire). Δες αν το program-cache hit είναι όντως φθηνό ή αν προκαλεί recompile.
4. **Hover silhouette χωρίς full-scene re-render:** ιδανικά το hover highlight να ζωγραφίζεται ως φθηνό overlay pass, όχι να ξανα-render-άρει όλη τη σκηνή (μεγάλο, μόνο αν τα 1-3 δεν αρκούν).

### 2.2 SSOT AUDIT ΠΡΙΝ ΚΩΔΙΚΑ (grep — ΥΠΟΧΡΕΩΤΙΚΟ, reuse, μηδέν διπλότυπα)
Διάβασε/grep ΠΡΙΝ γράψεις:
- `bim-3d/scene/scene-render-frame.ts` — το render body (raster vs SSAO composer vs section caps· γρ.79-93). **Εδώ αποφασίζεται τι κοστίζει.**
- `bim-3d/lighting/idle-detector.ts` + `DXF_TIMING.gesture.CAMERA_IDLE=800` — **υπάρχει ήδη** idle escalation SSoT· χρησιμοποίησέ το, ΜΗ φτιάξεις νέο timer.
- `bim-3d/lighting/ssao-modulator.ts` (`isSsaoActive`, `render`, `renderRaster`, `warmUp`), `quality-modulator.ts`, `shadow-modulator.ts` — οι ΥΠΑΡΧΟΝΤΕΣ modulators (ON↔OFF + soft↔sharp). Πιθανόν αρκεί gating, όχι νέος μηχανισμός.
- `bim-3d/scene/scene-idle-handlers.ts` — onActive/onIdle (πού μπαίνει το escalation/degrade).
- `bim-3d/scene/ThreeJsSceneManager.ts` `isSceneDirty()` / `markSceneDirty()` / `tick()` — τι κάνει τη σκηνή dirty (γιατί render-άρει σε κάθε settle).
- `rendering/core/UnifiedFrameScheduler.ts` `processFrame` (γρ.190+) — ⚠️ **ADR-040 critical file** (βλ. §5).
- `bim-3d/viewport/snap/bim3d-pointer-scheduler.ts` — `applyBimHover` + `markSceneDirty` στο hover-settle (η μία πηγή dirty κατά hover).

---

## 3. UNCOMMITTED ΑΛΛΑΓΕΣ ΑΥΤΗΣ ΤΗΣ ΣΥΝΕΔΡΙΑΣ (commit τα κάνει ο Giorgio)

### Fix A — Static shadow map (big-player Three.js/iModel.js/Forge· autoUpdate=false)
- `bim-3d/scene/scene-setup.ts` — `renderer.shadowMap.autoUpdate = false` (στατική σκηνή δεν ξαναχτίζει depth-map κάθε frame).
- `bim-3d/lighting/shadow-modulator.ts` — νέο SSoT method **`invalidateShadowMap()`** + doc· το `update()` OFF→ON ήδη flag-άρει `needsUpdate`.
- `bim-3d/scene/ThreeJsSceneManager.ts` — κλήση `invalidateShadowMap()` σε **6 geometry/light mutation SSoT**: `syncBimEntities`, `syncBimEntitiesMultiFloor`, `updateSunPosition`, `applyLightPreset`, `applyFloorVisibility`, `applyBuildingVisibility`.

### Fix B — Settle coalesce (ένα settle render αντί δύο)
- `bim-3d/viewport/snap/bim3d-pointer-scheduler.ts` — το hover refine-on-settle διαβάζει τώρα `SHADOW_SETTLE` (αντί `POINTER_SETTLE`) → hover render ΣΥΓΧΩΝΕΥΕΤΑΙ με shadow-on render.
- `config/dxf-timing.ts` — doc του `SHADOW_SETTLE` ενημερώθηκε.
- ⚠️ **Fix A+B μειώνουν τη ΣΥΧΝΟΤΗΤΑ των renders, ΟΧΙ το 40ms κόστος** — γι' αυτό το swim παραμένει. Το §2 είναι η συνέχεια.

### Diagnostics (UNCOMMITTED — όπως τα προηγούμενα `dxf-no-*`, no-op σε production)
- `bim-3d/viewport/snap/bim3d-pointer-scheduler.ts` — **`dxf-no-pick`** flag (early-return στο `onPickFrame`, καθαρίζει lingering snap).
- `rendering/core/UnifiedFrameScheduler.ts` — per-system **`frame.<id>`** instrumentation στο render loop (gated `isPerfEnabled()`, μέσω `recordSample` του `mouse-handler-perf`). **Αυτό κατονόμασε τον ένοχο.** ⚠️ ADR-040 file.

### Tests (GREEN)
- `bim-3d/lighting/__tests__/shadow-modulator.test.ts` — **ΝΕΟ, 5/5**.
- `bim-3d/viewport/snap/__tests__/bim3d-pointer-scheduler.test.ts` — **10/10** (settle window 100→350).

### ADR
- `docs/centralized-systems/reference/adrs/ADR-366-3d-bim-viewer-photorealistic-rendering.md` — §B.5 changelog entry (κορυφή).

---

## 4. DIAGNOSTIC FLAGS (dev console, localStorage)
```js
// μέτρηση + per-system breakdown:
localStorage.setItem('dxf-perf-trace','1'); window.__dxfPerfRefresh?.()
// A/B isolation:
localStorage.setItem('dxf-no-render','1')    // skip 3D scene tick
localStorage.setItem('dxf-no-shadows','1')   // shadows OFF
localStorage.setItem('dxf-no-pick','1')      // skip hover/snap pick
// cleanup:
['dxf-no-render','dxf-no-shadows','dxf-no-pick','dxf-perf-trace'].forEach(k=>localStorage.removeItem(k))
```
Το report βγαίνει αυτόματα ανά 60 samples· οι γραμμές `frame.<id>` δείχνουν το κόστος ανά system.

---

## 5. ΚΑΝΟΝΕΣ (ΥΠΟΧΡΕΩΤΙΚΟΙ)
- **Big-player doctrine:** Revit / Maxon Cinema4D. **FULL ENTERPRISE + FULL SSOT.** Αν οι big players δεν το προτείνουν → ακολούθησε τη δική τους πρακτική.
- **SSOT AUDIT ΠΡΙΝ ΚΩΔΙΚΑ (grep)** για υπάρχοντα μηχανισμό → reuse, **ΜΗΔΕΝ διπλότυπα** (βλ. §2.2).
- **COMMIT/PUSH τα κάνει ο GIORGIO**, όχι ο agent. Ποτέ `--no-verify`, ποτέ `git add -A`.
- **Working tree SHARED** με άλλον agent (ADR-548 levelManager + 3D) → **μικρά focused edits**.
- **N.17:** ΕΝΑ tsc τη φορά (έλεγξε process πρώτα· στου Giorgio κάνει **OOM** — type-safety μέσω ts-jest + inspection, ΟΧΙ full tsc).
- **ADR-040 CHECK 6B/6D:** το `UnifiedFrameScheduler.ts` ΕΙΝΑΙ στα micro-leaf critical files → αν το αγγίξεις, **stage ADR-040**. Τα υπόλοιπα `bim-3d/*` αρχεία ΔΕΝ το ενεργοποιούν· αυτά πάνε με **ADR-366 §B.5**.
- **Dev = ψέματα για perf** (~86% inflation). Μέτρα με `frame.<id>` breakdown (relative μεταξύ systems) ή σε prod-build (`npm run build && npm run start`). Το avg totalLag του dev μην το παίρνεις απόλυτα.
- N.14 model: **Opus** (cross-cutting render-loop/quality αρχιτεκτονική, 2+ domains).
