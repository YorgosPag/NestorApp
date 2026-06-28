# HANDOFF 2026-06-28 — 3D hover lag · DXF overlay re-upload στην GPU (επόμενο βήμα)

**Θέμα:** Στο **3D viewport**, η **κίνηση κέρσορα/hover** είναι βαριά/«κολυμπάει» το σταυρόνημα.
Διαγνώστηκε με **Chrome Performance trace** (όχι React DevTools — το RDT δεν βλέπει το WebGL κόστος).
**ΔΕΝ γράφτηκε κώδικας ακόμη** — αυτό είναι καθαρή διάγνωση + fix target.

---

## ✅ ΟΡΙΣΤΙΚΟ ΕΥΡΗΜΑ (hard evidence από το trace)

Trace: `C:\Users\user\Downloads\Trace-20260628T130158.json.gz` (19.76s, ~5s καθαρό 3D hover).
Scripting 8.06s / Rendering 4.5s / main thread 14.9s.

**Top self-time συναρτήσεις (CPU sampler):**
| Self time | Συνάρτηση | Σημασία |
|---|---|---|
| **3414ms** | `texSubImage2D` ← **100% από `renderPostFxOverlays`** | 🎯 **#1 ΕΝΟΧΟΣ** — texture upload στην GPU κάθε frame |
| 8535ms | `(program)` | GPU/native (επηρεάζεται από το #1) |
| 2749ms | `createTask` | ⚠️ **DEV-mode React overhead** (όχι σε production) |
| 455ms | `clearRect` ← **100% από `buildDxfTextMesh`** | χτίσιμο CanvasTexture ετικετών |
| 258ms | `getProgramInfoLog` ← `renderFrameWithCaps`/`renderPostFxOverlays` | program first-use (νέα materials) |
| 172ms | `measureHostInstance @ installHook.js` | ⚠️ **React DevTools extension** (φάντασμα) |

### Η αλυσίδα (stack, leaf→root):
```
texSubImage2D → uploadTexture → setTexture2D → setValueT1 → setProgram
  → WebGLRenderer.render → renderPostFxOverlays (bim-3d/scene/post-fx-overlay-pass.ts)
  → renderFrameWithCaps → renderSceneFrame → tick (master RAF)
```
```
clearRect → buildDxfTextMesh → buildColorGroup → sync (bim-3d/converters)
  → syncDxfOverlayIntoScene → syncDxfOverlay → resyncDxfOverlay (bim-3d/scene)
  → useBim3DStoreSync.useEffect ← setDxfScene ← useDxfOverlay3DSync.useEffect
```

### ΕΡΜΗΝΕΙΑ (root cause)
Ενώ απλώς κουνάς τον κέρσορα, **ξαναχτίζεται ολόκληρο το DXF underlay** (όλες οι ετικέτες
κειμένου = νέα geometry + νέες `CanvasTexture`), και **ανεβαίνουν ξανά στην GPU κάθε frame**
μέσω του `renderPostFxOverlays` (το οποίο τρέχει σε ΚΑΘΕ master tick).
- `clearRect`/build = **455ms** (περιορισμένα rebuilds), αλλά `texSubImage2D`/upload = **3414ms**
  → οι uploads >> τα builds → **κάθε rebuild δημιουργεί νέο πλήρες set textures (εκατοντάδες
  ετικέτες) που ανεβαίνουν όλες**, και ο κύκλος επαναλαμβάνεται κατά το hover.
- **Ο hover ΔΕΝ θα έπρεπε να αγγίζει το DXF overlay καθόλου.**

---

## 🔴 FIX TARGET (επόμενο βήμα — εστιασμένο)

**Σταμάτα το `resyncDxfOverlay`/`setDxfScene` να τρέχει κατά το hover.** Το DXF overlay πρέπει να
ξαναχτίζεται **ΜΟΝΟ** όταν αλλάζει όντως η DXF σκηνή — όχι σε κάθε hover/frame.

**Αρχεία-αφετηρία (SSoT audit ΠΡΩΤΑ — γιατί καλείται το setDxfScene στο hover;):**
1. `src/subapps/dxf-viewer/components/.../useDxfOverlay3DSync.ts` — η `useEffect` που καλεί
   `setDxfScene`. **Βρες τα deps της** — κάτι αλλάζει identity στο hover (πιθανώς το dxf scene
   object ή ένα store που περιλαμβάνει hover/selection state). Αυτό είναι το bug.
2. `src/subapps/dxf-viewer/bim-3d/viewport/...` → `useBim3DStoreSync.useEffect` → `resyncDxfOverlay`.
3. `src/subapps/dxf-viewer/bim-3d/scene/...` → `syncDxfOverlay` / `syncDxfOverlayIntoScene`
   (`ThreeJsSceneManager`). Δες αν υπάρχει diff-merge guard ή ξαναχτίζει τα πάντα.
4. `src/subapps/dxf-viewer/bim-3d/converters/dxf-text-3d.ts:75` (`new THREE.CanvasTexture`) +
   `DxfToThreeConverter.ts:276`. **Boy-scout fix αν χρειαστεί:** reuse/cache textures αντί για
   recreate (μην ξαναχτίζεις ετικέτες που δεν άλλαξαν).

**Στόχος:** μηδέν resync του DXF overlay σε καθαρό hover → εξαφανίζει τα ~3.4s `texSubImage2D` + 0.45s `clearRect`.

---

## ⚠️ ΚΡΙΣΙΜΗ ΣΗΜΕΙΩΣΗ ΓΙΑ ΤΗ ΜΕΤΡΗΣΗ
**Μέρος του «scripting» είναι το εργαλείο, όχι η app:** `createTask` (2.7s) + `measureHostInstance`
(`installHook.js`) + `jsxDEV`/`runWithFiberInDEV` = **DEV-mode React + το React DevTools extension**.
**Δεν υπάρχουν σε production build.** ➡️ Μετά το fix, ξαναμέτρα σε **production build + ΧΩΡΙΣ React
DevTools** για να δεις το πραγματικό feel.

---

## Δευτερεύοντα ευρήματα (μικρότερα, μετά το #1)
- **BVH walk:** `ensureBoundsTrees(group)` (`bim-3d/systems/raycaster/bvh-setup.ts:44`) κάνει
  `root.traverse()` ΟΛΗΣ της σκηνής σε **ΚΑΘΕ pick** (20×/δευτ), ακόμα κι όταν όλα τα δέντρα
  χτίστηκαν — λείπει σημαία «complete». Καλείται από `bim3d-pointer-scheduler.ts:75`.
  Fix: module-level `treesComplete` flag (reset σε scene sync).
- **Snap scan:** `computeSnap3DHover` → `SnapOrchestrator.findSnapPoint()` σαρώνει ΟΛΕΣ τις
  οντότητες ανά pick όταν είσαι πάνω σε επιφάνεια. Fix: spatial index ή χαμηλότερη συχνότητα.
- **React (μικρό, ~4%):** `BimCrosshairOverlay3D` + `BimSnapIndicatorOverlay3D` re-render ~34×/5δευτ
  γιατί κάνουν `useSyncExternalStore` σε ΟΛΟ το snap object (`Snap3DOverlayStore.ts`), όχι μόνο
  στο on/off. Το σχόλιο του αρχείου λέει «subscribe ONLY to ... on/off» αλλά η υλοποίηση δεν το
  τηρεί. Fix (ADR-040): non-reactive ref για τη θέση (RAF read) + reactive boolean μόνο για on/off.

## Διπλοτυπία raycast: ΟΧΙ (εξαλείφθηκε)
Το παλιό «2 full-scene raycasts» έχει διορθωθεί — `bim3d-pointer-scheduler.ts:74` «ONE BVH raycast
feeds BOTH hover and snap». Δεν υπάρχει διπλό raycast πια.

---

## ⚠️ ΚΑΝΟΝΕΣ
- **N.(-1):** ΚΑΝΕΝΑ commit/push χωρίς εντολή Giorgio.
- **bim-3d/ tree: ΚΑΘΑΡΟ/committed** (η δουλειά ADR-040 Φ-3D-pointer μπήκε· κανείς άλλος agent εκεί
  τώρα). Ασφαλές να πειραχτεί. ΟΧΙ `git add -A`.
- **CHECK 6B/6D:** αλλαγές σε bim-3d render/scene files → stage **ADR-040** (+ σχετικό ADR).
- **N.17:** ΕΝΑ tsc τη φορά (background).
- **Verify:** **Chrome Performance trace** (όχι React DevTools) — μέτρα `texSubImage2D` πριν/μετά.
- **Big-player + full SSoT audit (grep) ΠΡΙΝ από κάθε υλοποίηση.**

## 🛠️ Εργαλεία ανάλυσης trace (scratchpad, αν επιβιώσουν)
`trace.js` (self-time per fn) · `trace2.js <fn>` (ancestors/callers) · δουλεύουν σε `.json.gz`
Chrome traces. Re-run: `node trace.js "<path>"`.

## 🔴 ΕΚΚΡΕΜΕΙ ΞΕΧΩΡΙΣΤΑ — 2D selection commit (ADR-532 Stage 5/5b)
Έτοιμη & profile-verified δουλειά (DxfViewerContent + FloatingPanelContainer severance, click
247ms→117ms). **6 αρχεία UNCOMMITTED**, περιμένουν εντολή commit:
```
src/subapps/dxf-viewer/systems/selection/useSelectionLevelReset.ts
src/subapps/dxf-viewer/bim-3d/systems/selection/use-3d-selection-universal-bridge.ts
src/subapps/dxf-viewer/app/SelectionSideEffectsHost.tsx
src/subapps/dxf-viewer/app/DxfViewerContent.tsx
src/subapps/dxf-viewer/ui/hooks/useLayerOperations.ts
docs/centralized-systems/reference/adrs/ADR-532-selection-set-ssot.md
```
+ stage **ADR-040** (CHECK 6D). Λεπτομέρειες: ADR-532 changelog Stage 5/5b.

## Πηγή / σχετικά
ADR-040 (Φ-3D-pointer, micro-leaf· 6B/6D)· ADR-537 (post-fx overlay pass)· ADR-542 (3D snap markers)·
ADR-545 (3D crosshair). Memory: [[feedback_giorgio_ssot_audit_before_new_mechanism]] ·
[[feedback_trace_full_pipeline_not_isolated_hooks]] · [[reference_3d_cursor_lag_decoupling]].
