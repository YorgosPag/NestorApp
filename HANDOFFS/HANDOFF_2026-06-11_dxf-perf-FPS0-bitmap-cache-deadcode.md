# HANDOFF — DXF Viewer perf: FPS 0 / main-thread freeze (3 root causes)

**Date:** 2026-06-11 · **Author:** Opus 4.8 · **Status:** 🔴 investigation DONE, fixes NOT started

## Σύμπτωμα (Giorgio console)
- `[Violation] 'message' handler took 174–1793ms` ×30+ (React `scheduler.development.js`)
- `[WARN] [DxfPerformanceOptimizer] FPS below threshold: 0 < 45`
- Auto-save storm: `DxfFirestore Storage save` version 181→182→183→184→185 σε ~25s (~950KB upload + POST /api/cad-files έκαστο)
- `[useFirestoreBuildings] Buildings updated` ×9 (ίδιο building, count:1)

**ΟΧΙ logs** — είναι browser-generated perf warnings που δείχνουν ΠΡΑΓΜΑΤΙΚΟ main-thread freeze. (Το log-cleanup [DEBUG/INFO/API-contract] ολοκληρώθηκε ξεχωριστά, βλ. ΕΚΚΡΕΜΟΤΗΤΕΣ.)

---

## ROOT CAUSE #1 (PRIMARY — ο φταίχτης για FPS 0 / 1793ms) — ADR-040 critical

**Το bitmap cache είναι dead code — full sync redraw ΟΛΩΝ των entities κάθε RAF frame.**

- `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/dxf-canvas-renderer.ts:155` — `renderScene()` καλεί `renderer.render(curScene, ...)` **ανεξάρτητα**, ΠΟΤΕ δεν καλεί `bitmapCacheRef.current.isDirty()` / `rebuild()` / `blit()`.
- `dxf-bitmap-cache.ts:60–198` — το `DxfBitmapCache` instantiate-άρεται σωστά (`dxf-canvas-renderer.ts:107`, effect ~291–295) αλλά **δεν χρησιμοποιείται ποτέ** στο render path.
- Με 188–4200 entities × πολλαπλά canvas path ops = 200–1800ms/frame → ταιριάζει ακριβώς με το 1793ms violation.
- Είναι το regression που το **ADR-040 Phase D** υποτίθεται απέτρεπε: η cache infra δημιουργήθηκε αλλά δεν wire-άρηκε στο render callback.

**FPS=0 = ΠΡΑΓΜΑΤΙΚΟ freeze** (όχι 0×0-viewport false alarm): όταν το main thread μπλοκάρει 1.8s, τα RAF callbacks σταματούν, deltaTime~1800ms → instantaneous FPS≈0.5 → Math.round→0.

**Προτεινόμενο fix (ΠΡΟΣΟΧΗ — verify το πραγματικό API πρώτα):** στο `renderScene()` ~line 155, αντικατέστησε το unconditional `renderer.render(...)` με:
```
if (bitmapCacheRef.current?.isDirty(curScene, currentTransform, currentViewport)) {
  bitmapCacheRef.current.rebuild(curScene, currentTransform, currentViewport, { ... });
}
bitmapCacheRef.current?.blit(ctx!, currentViewport);
// μετά τα hover/selection overlays όπως τώρα (το cache ήδη τα skip-άρει)
```
⚠️ **ΜΗΝ σπάσεις** hover/selection/grip overlays — το cache key ΔΕΝ πρέπει να περιλαμβάνει hoveredEntityId/selectedEntityIds (ADR-040 cardinal rule #3). Verify isDirty/rebuild/blit signatures στο dxf-bitmap-cache.ts ΠΡΙΝ γράψεις. Stage ADR-040 (CHECK 6B/6D). **Φρέσκο focused context — μην το κάνεις με γεμάτο context.**

### Δευτερεύον #1b (~100–400ms bursts):
- `dxf-firestore-storage.impl.ts:91` (validateForSaveImpl) + `:165` (saveToStorageImpl) → `JSON.stringify(scene, null, 0)` **2–3×** ανά save (950KB). Serialize μία φορά, πέρνα τα bytes.
- `DxfPerformanceOptimizer.ts:310` `getCanvasElementCount()` → `Math.random()` stub (false metric, minor).

---

## ROOT CAUSE #2 (auto-save storm) — ⚠️ SHARED TREE με foundation agent

Κάθε Firestore snapshot echo (~15 persistence hooks: wall/column/foundation/slab/opening/MEP…) → `lm.setLevelScene()` → `setLevelSceneWithAutoSave` (`useAutoSaveSceneManager.ts:159`) → reset 2s debounce timer (`:181-186`). Burst ~15 subscribers μετά από save echo → πολλαπλά saves αντί 1.

**Fix:** πρόσθεσε `{ suppressAutoSave: true }` option στο `setLevelSceneWithAutoSave` (skip debounce αν set), και πέρνα το από ΟΛΑ τα persistence-hook snapshot callbacks (`useFoundationPersistence.ts:243`, `useWallPersistence.ts:248`, `useColumnPersistence.ts:247`, +~12). Δευτερεύον: `dxf-firestore.service.ts:221` autoSaveV2 redundant `getFileMetadataImpl` read (dead branch).
⚠️ Αγγίζει useFoundationPersistence → **συντόνισε με foundation agent ή περίμενε** να κλείσει το ADR-441.

---

## ROOT CAUSE #3 (buildings ×9 listener)

9 ξεχωριστά `onSnapshot` από 9 `useFirestoreBuildings()` call sites (NavigationContext/BuildingsPageContent/ThermalEnvelopeHost/useBimScheduleLookups/useSiteNeighbourMasses/useHeatLoadInputs/useBuildingFloors3DSync/useExecutiveReport/PO). Όχι 1×9 — 9×1. Module cache (ADR-300) κρατά data αλλά ΟΧΙ listener dedup.

**Fix:** `BuildingsProvider`/Context που καλεί `useFirestoreBuildings()` **μία φορά** → 9 call sites → `useBuildingsContext()`. Δευτερεύον: `useRealtimeBuildings.ts:185` αφαίρεσε `refreshTriggerRef.current` από deps (spurious re-subscribe σε auth flip).

---

## Προτεινόμενη σειρά
1. **#1 πρώτο** (ο φταίχτης για FPS 0· μεγαλύτερο impact· ADR-040 — φρέσκο context).
2. **#3** (απλό, isolated, μεγάλη μείωση listener churn).
3. **#2 τελευταίο** (μετά να κλείσει ο foundation agent — shared tree).

Κάθε ένα = ξεχωριστό commit + ADR update (ADR-040 για #1).
