# HANDOFF 2026-06-28 (απόγευμα) — 3D perf: ΟΙ FILL-RATE ΠΕΡΙΚΟΠΕΣ ΥΠΕΡ-ΔΙΟΡΘΩΣΑΝ → REGRESSION ΠΟΙΟΤΗΤΑΣ + cursor. ΕΠΑΝΑΣΧΕΔΙΑΣΜΟΣ.

**Working tree: SHARED με 2-3 agents (claude/codex1/codex2).** ❌ ΜΗΝ κάνεις commit/push — ο **Giorgio** committ-άρει. Μικρά focused edits.
**Doctrine:** big-player (Revit / Maxon Cinema4D) + FULL ENTERPRISE + FULL SSOT. Αν οι big players δεν το προτείνουν → ακολούθησε **τη δική τους** πρακτική.
**ΠΡΙΝ ΟΠΟΙΟΝΔΗΠΟΤΕ ΚΩΔΙΚΑ → ΠΡΑΓΜΑΤΙΚΟ SSOT AUDIT (grep)** για υπάρχοντα μηχανισμό· reuse, **μηδέν διπλότυπα**.
**ADR-040 CHECK 6B/6D:** αν αγγίξεις canvas/3D render αρχεία → stage ADR-040 (+ ADR-366 για 3D).

---

## 0. ΤΙ ΣΥΝΕΒΗ (γιατί υπάρχει αυτό το handoff)

Ο Giorgio κυνηγά **μήνες** «βαρύ 3D (και λίγο 2D)». Σε αυτόν τον κύκλο, **3 πράκτορες παράλληλα** διέγνωσαν σωστά
**fill-rate-bound** πρόβλημα (browser-verified: μικρό παράθυρο→ομαλό· σκηνή **546 τρίγωνα / 5 draw calls**· cores=4·
pixelRatio=0.8) και έκαναν **πολλές ταυτόχρονες, ασυντόνιστες περικοπές fill-rate**. Αποτέλεσμα (λόγια Giorgio):

> «Η κατάσταση άλλαξε ΔΡΑΜΑΤΙΚΑ προς το χειρότερο.»
> 1. **Μετάβαση 2D→3D (κουμπί) πολύ χρονοβόρα / καθυστερεί πάρα πολύ.**
> 2. **3D ποιότητα οντοτήτων πολύ χαμηλή· κατά την περιστροφή γίνεται ΑΚΟΜΑ πιο χαμηλή.**
> 3. **Όταν σταματά η κίνηση/περιστροφή, οι ΑΚΜΕΣ των οντοτήτων μένουν πολύ χαμηλής ανάλυσης/ποιότητας.**
> 4. **Ο κέρσορας καθυστερεί ΚΑΙ «κολυμπάει» (lag + swim) ΚΑΙ στο 2D ΚΑΙ στο 3D**, ιδίως full-screen σε μεγάλη οθόνη.

**Διάγνωση της regression:** οι περικοπές ήταν σωστές στην κατεύθυνση αλλά **υπερβολικές + κακο-εκτελεσμένες**.
Οι big players (Revit/Cinema4D) ΔΕΝ ρίχνουν μόνιμα την ποιότητα — κάνουν **adaptive degradation ΜΟΝΟ κατά την κίνηση
κάμερας** και **ΕΠΑΝΑΦΕΡΟΥΝ πλήρη ποιότητα όταν η σκηνή ηρεμεί** (restore-on-settle). Εδώ:
- **MSAA σβήστηκε ΜΟΝΙΜΑ** (`antialias:false`) → μόνιμα «σκαλοπάτια» στις ακμές = «χαμηλή ποιότητα / low-res edges on stop».
- **resolution-modulator** ρίχνει pixelRatio κατά την κίνηση αλλά (πιθανότατα) **δεν επαναφέρει** σωστά στο settle → «μένουν χαμηλής ανάλυσης οι ακμές αφού σταματήσω».
- **cursor lag+swim 2D&3D** → πιθανός ένοχος οι committed αλλαγές pointer pipeline (`pointer-activity` scheduler `fd09985d`, hover/snap glyph-key + crosshair resync `99cbb0d3`, section-box POINTER_SETTLE `7520e1c7`).
- **2D→3D slow** → άγνωστο ακόμα· υποψ.: recreation renderer/scene-setup, ή σώρευση όλων.

---

## 1. Η ΑΠΟΣΤΟΛΗ ΤΗΣ ΕΠΟΜΕΝΗΣ SESSION

**ΟΧΙ άλλες τυφλές περικοπές.** Επανασχεδίασε σε **ΕΝΑ συνεκτικό big-player adaptive-quality σύστημα**:

1. **Ποιότητα σε ηρεμία (rest) = ΥΨΗΛΗ:** σωστό anti-aliasing (δες §3), πλήρες pixelRatio, soft shadows. Ο Giorgio
   είναι οπτικά απαιτητικός (Cinema4D-grade) — η ηρεμία ΠΡΕΠΕΙ να είναι καθαρή/χωρίς σκαλοπάτια.
2. **Degrade ΜΟΝΟ κατά την ενεργή κίνηση κάμερας** (orbit/pan/zoom) — και **ΕΠΑΝΑΦΟΡΑ πλήρους ποιότητας στο settle**
   (το «low-res edges on stop» = απόδειξη ότι η επαναφορά ΔΕΝ γίνεται → bug να διορθωθεί).
3. **Διόρθωσε cursor lag+swim** σε 2D ΚΑΙ 3D (δες §2 για ύποπτα commits).
4. **Διόρθωσε 2D→3D transition slowness.**

### SSoT ευκαιρία (big-player: ΕΝΑΣ controller, όχι 4)
Υπάρχουν ΤΩΡΑ **τέσσερις ξεχωριστοί** «adaptive-on-camera-move» μηχανισμοί — fragmentation:
- `bim-3d/lighting/quality-modulator.ts` (σκιές: radius/mapSize κατά κίνηση· **έχει ανάποδο `IS_LOW_PERF` gate** — οι αδύναμες μηχανές ΔΕΝ degrade-άρουν)
- `bim-3d/lighting/ssao-modulator.ts` (SSAO idle ramp· opt-in)
- `bim-3d/lighting/resolution-modulator.ts` (**NEW**, adaptive pixelRatio — ο πιθανός ένοχος για «low-res on stop»)
- `bim-3d/systems/pointer-activity.ts` + `bim3d-pointer-scheduler.ts` (section caps fast/refine)
**Πρόταση:** ένα **InteractionQualityController** SSoT (camera active/idle → ΟΛΑ τα LOD knobs μαζί, με σωστό restore).
Hook υπάρχει ήδη: `bim-3d/scene/scene-idle-handlers.ts` (`onActive`/`onIdle`, IdleDetector). **Grep πρώτα, μη διπλασιάσεις.**

---

## 2. ΚΑΤΑΣΤΑΣΗ ΚΩΔΙΚΑ (git, 2026-06-28 απόγευμα)

### UNCOMMITTED (shared tree — review με `git diff` ΠΡΙΝ αγγίξεις):
```
 M bim-3d/scene/scene-setup.ts            ← antialias:false, PCFSoft→PCF, σκιές 2048→1024, preserveDrawingBuffer:false, NEW createOffscreenCaptureRenderer SSoT
 M bim-3d/scene/scene-idle-handlers.ts    ← resolution-modulator wiring (active/idle)
 M bim-3d/scene/ThreeJsSceneManager.ts    ← captureFrameDataURL (on-demand screenshot), resolution-modulator
 M bim-3d/scene/scene-rendering-subsystems.ts
 M bim-3d/animation/MP4Exporter.ts        ← χρήση createOffscreenCaptureRenderer
 M bim-3d/print/capture/capture-3d.ts     ← χρήση createOffscreenCaptureRenderer
 M bim-3d/materials/MaterialCatalog3D.ts
 M bim-3d/performance/performance-snapshot-service.ts
 M docs/.../ADR-040-*.md  M docs/.../ADR-366-*.md
?? bim-3d/lighting/resolution-modulator.ts (+__tests__)   ← NEW adaptive pixelRatio (ΥΠΟΠΤΟ #1 για low-res-on-stop)
?? HANDOFFS/HANDOFF_2026-06-28_3d-perf-fillrate-6-fixes.md  ← το handoff του άλλου agent (6 fill-rate fixes· ΔΙΑΒΑΣΕ ΤΟ)
```

### COMMITTED σήμερα (στο pointer/render pipeline — ΥΠΟΠΤΑ για cursor swim):
```
7520e1c7 refactor(dxf): extract section-box drag handlers + POINTER_SETTLE SSoT
fd09985d perf(dxf): 3d pointer-activity scheduler + perf collector   ← cursor pipeline + FPS-fix
99cbb0d3 perf(dxf): 3d hover/snap glyph-key + bvh + crosshair resync ← crosshair/cursor
e3849584 fix(dxf): 3d dxf-overlay sync guard + converter resync
3fdd4e0d chore(i18n): update config + lazy-config   ← i18n preload (2D, άσχετο με 3D perf)
```

### Τι έγινε ΗΔΗ καλό & επιβεβαιωμένο (ΜΗ το χαλάσεις):
- **FPS metric fix** (`bim-3d/performance/PerformanceCollector.ts`): ήταν ΣΠΑΣΜΕΝΟ (μετρούσε setInterval 250ms→ψεύτικα ~4 FPS)· τώρα real RAF fps μέσω `UnifiedFrameScheduler.onFrame` (SSoT, ίδιο με 2D collector). **Αγνόησε παλιές «4-5 FPS» ενδείξεις.** Τώρα το HUD δίνει αξιόπιστο νούμερο.
- **Fill-rate-bound** επιβεβαιωμένο (resize test). **ΔΕΝ** είναι geometry/draw-calls (546 τρίγωνα).
- DXF underlay idempotent sync, BVH per-pick skip (trace-verified) — καλά, δες το 6-fixes handoff.

---

## 3. ΚΑΤΕΥΘΥΝΣΕΙΣ big-player για το AA (το «#1 παράπονο ποιότητας»)
- MSAA (`antialias:true`) **δεν συνδυάζεται** με post-processing pipeline (EffectComposer/SSAO) — γι' αυτό μπήκε off.
  Big-player realtime (Forge/Sketchfab/Three.js editor/Cinema4D viewport) → **post-AA**: **SMAA** ή **FXAA** pass
  (φθηνό, λειτουργεί με composer), ή **TAA** σε ηρεμία (Cinema4D «progressive» viewport). Πρόταση: SMAA/FXAA pass
  στο idle/rest path ώστε οι ακμές να είναι καθαρές όταν η σκηνή ηρεμεί· raster χωρίς AA ΜΟΝΟ κατά την κίνηση.
- **Restore-on-settle** είναι το κλειδί: ό,τι ρίχνεις στην κίνηση (pixelRatio/shadows/AA) **ΠΡΕΠΕΙ** να επανέρχεται
  πλήρες όταν `IdleDetector.onIdle`. Έλεγξε γιατί το `resolution-modulator` αφήνει χαμηλή ανάλυση στο stop.

## 4. ΠΡΩΤΑ ΒΗΜΑΤΑ (προτεινόμενη σειρά)
1. `git diff` σε ΟΛΑ τα uncommitted 3D αρχεία + διάβασε `HANDOFF_2026-06-28_3d-perf-fillrate-6-fixes.md`. Κατανόησε τι έκανε κάθε agent.
2. **Browser-repro** κάθε regression στο localhost dev (FPS HUD τώρα αξιόπιστο): 2D→3D χρόνος, ποιότητα ηρεμίας vs κίνησης, cursor swim 2D&3D.
3. **SSOT audit (grep)** των 4 modulators + pointer pipeline ΠΡΙΝ γράψεις. Σχεδίασε ΕΝΑ adaptive-quality controller (ή ενοποίησε τους υπάρχοντες) με σωστό restore-on-settle.
4. Για AA: πρόσθεσε SMAA/FXAA post-pass (rest) αντί για το μόνιμο `antialias:false`.
5. Για cursor swim: bisect τα 3 committed pointer commits (7520e1c7 / fd09985d / 99cbb0d3) — ποιο εισήγαγε το swim/lag (πιθανώς throttle/RAF-slot ή POINTER_SETTLE).
6. Μετά από κάθε αλλαγή → tsc (N.17: **ΕΝΑ tsc** — έλεγξε process πρώτα), jest, browser-verify. **Giorgio κάνει commit.**

## 5. ΚΑΝΟΝΕΣ
- **ΟΧΙ commit/push** — Giorgio.  **Shared tree** — μικρά focused edits, πρόσεχε collisions στα `scene-setup.ts`/`quality-modulator.ts`/`PerformanceCollector.ts` (πολλαπλοί agents).
- **N.17:** ΕΝΑ tsc τη φορά (`Get-CimInstance ... node.exe ...tsc...` πρώτα).
- **Greek responses** στον Giorgio.
- **Big-player + FULL SSOT + grep audit πριν κώδικα.** Μη μαντεύεις — browser-verify με το (διορθωμένο) FPS HUD.

## Πηγές
- `HANDOFFS/HANDOFF_2026-06-28_3d-perf-fillrate-6-fixes.md` (6 fill-rate fixes, άλλος agent)
- `ADR-366` §B.5 (3D viewer/HUD/perf changelog) · `ADR-040` (canvas/render perf SSoT)
- Modulators: `bim-3d/lighting/{quality,ssao,resolution}-modulator.ts` · `bim-3d/scene/scene-idle-handlers.ts` · `bim-3d/scene/scene-setup.ts`
- Memory: [[feedback_giorgio_ssot_audit_before_new_mechanism]] · [[reference_3d_cursor_lag_decoupling]] · [[reference_unified_2d_3d_performance_hud]]
