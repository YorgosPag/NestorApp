# HANDOFF — 3D cursor lag: Phases 1-3 DONE, residual hover-lag = GPU/compositing (NOT CPU)

**Ημ/νία:** 2026-06-29 · **ADR:** 549 · **Model:** Opus 4.8
**Working tree:** όλες οι δικές μου αλλαγές **COMMITTED** (shared tree — άλλοι agents τις μάζεψαν σε
`7a99b132` glow guard + scheduler + ADR, `c9bb68ec` tests, `b9852807` wire-waypoint hook). Uncommitted =
ΑΛΛΩΝ agents (analytical-painter, overlay-dispatch, proposal-overlays).

---

## 0. TL;DR — τι λύθηκε & τι ΜΕΝΕΙ

| Phase | Τι | Αποτέλεσμα (browser-measured, dev) |
|-------|----|-----------------------------------|
| **Φ1** ✅ COMMITTED | wire-waypoint `onMove` spurious `markSceneDirty` ×150 → arm-gate σε ενεργό circuit + idempotent | renders **42→0**, totalLag **~60→~10ms** σε καθαρό sweep |
| **Φ2** ✅ COMMITTED | hover refine-on-settle **αποσύνδεση**: hover-id live (DXF glow), silhouette refine-on-settle (BIM) | καμία stale-glow «κόλληση»· renders ~0-2 |
| **Φ3** ✅ COMMITTED | glow `DxfHoverGlowOverlay2D` redraw-on-demand guard (skip όταν ίδια οντότητα + στατική κάμερα) | **οριακή** βελτίωση μόνο |

### 🔴 ΑΛΥΤΟ: residual hover-lag
Σαρώνοντας **πάνω σε οντότητες**: `cursor.totalLag` **~30ms (DXF) / ~40ms (BIM)** vs **~10ms σε κενό χώρο**.
`inputLatency` ~1-2ms (input ΟΚ → **paint** καθυστερεί).

---

## 1. ΤΟ ΚΡΙΣΙΜΟ ΕΥΡΗΜΑ (γιατί κόλλησε το profiling)

**Το lag ΔΕΝ είναι σε ΚΑΜΙΑ CPU διαδρομή που μετράει το diag.** Per-type dumps (`__bim3dPerf.dump()`):
- **DXF-only:** `renders=0`, `markSceneDirty: none`, overlay/pick **όλα <1ms** (hover-glow avg 0.16ms,
  pick:raycast 0.53ms, pick:dxf-resolve 0.16ms). Κι όμως totalLag ~30ms.
- **BIM-only:** `renders=1`, pick:snap avg 0.6ms, pick:raycast 0.57ms, snap-indicator 0.02ms — **όλα <1ms**.
  Κι όμως totalLag ~40ms.

➡️ **Συμπέρασμα: GPU compositing / rAF-present latency**, ΟΧΙ main-thread CPU. Fullscreen WebGL canvas +
N Canvas2D/DOM overlay layers σε **αδύναμη integrated GPU** → ο compositor καθυστερεί το paint του κέρσορα.
Το `performance.now()`-based diag μετράει CPU, **όχι** GPU/compositor → γι' αυτό «όλα φαίνονται φθηνά».

**Στοιχείο κατεύθυνσης:** BIM (~40ms) > DXF (~30ms). Στο BIM υπάρχει **snap** → ο κέρσορας περνά σε
**rAF snap-jump** (το `crosshair` useRafWhile γίνεται active). Στο DXF (χωρίς snap) ο κέρσορας μένει
σύγχρονος (window listener) — κι όμως ~30ms. Άρα φταίει ΚΑΙ το compositing ΚΑΙ (στο BIM επιπλέον) το
rAF-bound crosshair.

---

## 2. NEXT STEPS (ιεραρχία — PROFILE διαφορετικά)

1. **A/B DEFINITIVE — `dxf-no-overlays` flag:** πρόσθεσε one-line gate στο `useRafWhile`
   (`bim-3d/viewport/overlay-raf.ts`): αν `localStorage['dxf-no-overlays']==='1'` → μην τρέχει το rAF
   (καθάρισε + onStop). Giorgio: set flag + reload + hover-sweep + dump totalLag.
   - **Αν πέσει σε ~10ms** → επιβεβαιώθηκε overlay-compositing → μείωσε layers: (α) **merge** όλα τα
     Canvas2D overlays σε ΕΝΑΝ canvas (Finding 3 — ένα layer αντί για 7), ή (β) ζωγράφισε το glow **μέσα
     στο WebGL scene** (όχι ξεχωριστό canvas layer), ή (γ) χαμήλωσε DPR στα overlay canvases.
   - **Αν μείνει ~30ms** → overlays αθώα → είναι το **WebGL present/compositor baseline** ή το rAF cadence.
2. **Crosshair rAF→sync (BIM):** το snap-jump περνά τον κέρσορα σε rAF (latency). Κάν' τον **πάντα
   σύγχρονο** (window listener, GPU translate3d) — το snap-jump να εφαρμόζεται κι αυτό σύγχρονα. Στόχος:
   BIM ~40ms → ~DXF.
3. **GPU profiling:** Chrome DevTools Performance → δες GPU/compositor track κατά το hover-sweep (το diag
   δεν το πιάνει). Επιβεβαίωσε αν ο compositor είναι το bottleneck.
4. **Big-player (Finding 3):** ενοποίηση των 7 ιδιωτικών overlay rAF στον ΕΝΑ `UnifiedFrameScheduler` με
   dirty-gating (ADR-040 single-master-rAF). Λύνει ΚΑΙ το cadence ΚΑΙ το layer count μακροπρόθεσμα.

---

## 3. REVERTIBLE DIAG (Phase 0 — σβήσε όταν κλείσει το θέμα, `git revert`/χειρ.)
- `bim-3d/scene/bim3d-perf-diag.ts` (`window.__bim3dPerf`), `overlay-raf.ts` `diagLabel`,
  `bim3d-pointer-scheduler.ts` `pick:*` timing (3 wraps + import `recordOverlayDraw`),
  `BimViewport3D.tsx` `onFrame`/`collectMetrics`.
- **ΣΗΜ:** `scheduler frames=0` ακόμα (diag onFrame quirk· δεν χρειάστηκε — ο ένοχος δεν ήταν registered system).

## 4. TESTS (όλα GREEN, committed)
- `bim3d-pointer-scheduler.test.ts` 12/12 (decouple contract: hover-id live, silhouette refine-on-settle).
- `use-bim3d-wire-waypoint-interaction-3d.test.ts` 4/4 (Φ1 arm-gate/idempotent/teardown).

## 5. ΚΑΝΟΝΕΣ
- **PROFILE ΠΡΙΝ FIX** — το CPU diag εξαντλήθηκε· επόμενο = GPU/compositor (DevTools) + A/B flag.
- COMMIT/PUSH μόνο ο Giorgio· ποτέ `--no-verify`/`git add -A`. CHECK 6B/6D: snap/grips/cursor → stage ADR-549/366.
- N.17: ΕΝΑ tsc τη φορά. Dev = ψέματα ~86% inflation (relative breakdown OK).
- ADR-549 = ζωντανό· πρόσθεσε Phase 4 findings εκεί.
