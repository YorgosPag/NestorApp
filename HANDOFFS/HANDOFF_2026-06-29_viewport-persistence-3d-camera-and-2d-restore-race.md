# HANDOFF — Viewport persistence: 3D camera (DONE) + 2D restore race (root-caused, OPEN)

**Ημ/νία:** 2026-06-29 · **ADR:** 400 §3D (+ 040, 366, 399/418) · **Model:** Opus 4.8
**Working tree:** ⚠️ **ΜΟΙΡΑΖΕΤΑΙ με άλλον agent** (γράφει στο `ThreeJsSceneManager.ts` — πρόσθεσε `DxfBackdropCache`).
**COMMIT/PUSH μόνο ο Giorgio.** Ποτέ `--no-verify`, ποτέ `git add -A`. Όλα **UNCOMMITTED**. Απάντα **Ελληνικά**.

---

## 0. ΤΙ ΖΗΤΗΘΗΚΕ
Μετά από hard reload (και 2D↔3D toggle) η εφαρμογή δεν κρατούσε την όψη, **σε 2D ΚΑΙ 3D**. Doctrine: big-player
(Revit/C4D/Figma), FULL ENTERPRISE + FULL SSOT, μηδέν διπλότυπα. Εγκεκριμένο πλάνο:
`C:\Users\user\.claude\plans\robust-toasting-pearl.md`.

---

## 1. ✅ PART A — 3D CAMERA PERSISTENCE (ΟΛΟΚΛΗΡΩΘΗΚΕ, deduped, 33/33 jest)

Big-player: **URL deep-link (`c3d`) + localStorage fallback** — ΜΙΑ φιλοσοφία persistence 2D & 3D. Το URL επιβιώνει
και στο 2D↔3D toggle (replaceState, ίδια σελίδα) → restore χωρίς καν storage· storage = fallback για fresh-link.

**Νέα/αλλαγμένα αρχεία (UNCOMMITTED):**
- **NEW `services/camera3d-persistence.ts`** — `Camera3DPose {position[3],target[3],zoom,projection}`, compact URL
  `c3d=px,py,pz,tx,ty,tz,zoom,modeCode`, per-level localStorage, guards. **Reuse** `currentSearchParams` /
  `isFiniteNumber` / `roundToSignificantFigures` + `replaceUrlSearchParams` από `viewport-persistence` (ΜΗΔΕΝ
  διπλότυπα — βλ. §3). Μόνο `roundCoord` (3dp) είναι local (μοναδικό).
- **NEW `services/__tests__/camera3d-persistence.test.ts`** — 15/15 (mirror του viewport-persistence test).
- **`services/viewport-persistence.ts`** — εξήχθησαν & έγιναν `export`: `replaceUrlSearchParams` (κοινό
  `history.replaceState` path), `currentSearchParams`, `isFiniteNumber`, `roundToSignificantFigures`.
  `writeViewportToUrl` ξαναγράφτηκε πάνω στο `replaceUrlSearchParams`.
- **`utils/storage-utils.ts`** — `STORAGE_KEYS.CAMERA3D_STATE_PREFIX = 'dxf-viewer:camera3d-state'`.
- **`bim-3d/viewport/viewport-types.ts`** — `ViewportCamera.setPose(position,target,zoom,projection)` στο interface.
- **`bim-3d/viewport/viewport-camera.ts`** — `setPose` (instant absolute pose) + **NEW SSoT
  `applyProjectionModeFlags(mode)`** (active cam + control flags + ortho up + `currentMode`) που μοιράζονται
  ο `applyProjectionInstant` ΚΑΙ ο `setProjection` (perspective branch).
- **`bim-3d/scene/ThreeJsSceneManager.ts`** — `restoreCameraView(pos,target,zoom,proj)` (καλεί `viewport.setPose`
  + **latch `initialCameraFitDone=true`** ώστε το `syncDxfOverlay` Zoom-Extents να ΜΗΝ σβήσει το restored pose) +
  `setCameraSettledCallback(cb)` (καλείται στο υπάρχον `onInteractionEnd`). + import `ProjectionMode`.
- **`bim-3d/viewport/BimViewport3D.tsx`** — mount effect: restore-on-mount **πριν** `resyncDxfOverlay`
  (`readPersistedCamera3D(lvl)`), debounced persist στο settle (reuse `DXF_TIMING.ui.URL_DEBOUNCE`), flush-on-teardown.
  + imports `THREE`, `readPersistedCamera3D/persistCamera3D/Camera3DPose`, `DXF_TIMING`.
- **ADRs:** ADR-400 §3D + changelog· ADR-040 changelog (CHECK 6B — ThreeJsSceneManager touched).

**Σχεδιαστικά:** perspective zoom = implicit στην απόσταση (restored μέσω position)· `zoom` μόνο για ortho.
3D localStorage key = active level id από το URL `lvl` (per-floor 3D view).

---

## 2. 🔴 PART B — 2D RESTORE RACE: ROOT CAUSE ΒΡΕΘΗΚΕ, **FIX ΟΧΙ ΥΛΟΠΟΙΗΜΕΝΟ** (επόμενο βήμα)

⚠️ **ΔΙΟΡΘΩΣΗ ΠΡΟΗΓΟΥΜΕΝΟΥ ΛΑΘΟΥΣ:** μια πρώτη στατική ιχνηλάτηση είχε πει «κανένα override» — **ΛΑΘΟΣ**.
Deep trace (Explore agent) απέδειξε deterministic override:

1. Στο reload το Firestore δίνει **2 `levels` snapshots**: cached IndexedDB (`sceneFileId='fid_A'`) → server
   (`'fid_B'`, διαφέρει γιατί το `linkSceneToLevel` γράφει με **Admin SDK** που παρακάμπτει το client cache).
2. Το 2ο snapshot αλλάζει `fileRecordId` fid_A→fid_B στο **ΙΔΙΟ level**, ΑΦΟΥ `hasFittedRef=true`.
3. `resolveAutoFitAction` (`systems/zoom/viewport-autofit-policy.ts:53`): `fileChanged && !levelChanged` →
   **`'fit'`** (παρερμηνεύει το bare id-swap ως re-import).
4. `useViewportAutoFit.ts:174` `clearTimeout` ακυρώνει το pending `performInitialDecision` restore →
   `fitCurrentContent` → `EventBus.emit('canvas-fit-to-view',{source:'auto'})` (`useViewportAutoFit.ts:119`) →
   `useFitToView.ts:141` `setTransform` = **Zoom-Extents νικά**.

**Ασφαλές path (όταν `sceneFileId` ΔΕΝ αλλάζει):** `useViewportAutoFit.ts:165` ενημερώνει `prevFileRecordIdRef`
πριν το early-return, άρα `fileChanged=false` → `'initial'` → restore OK.

**Προτεινόμενο fix (ΕΠΟΜΕΝΟ ΒΗΜΑ — δικό του session + browser repro):** ο policy/hook να ΜΗΝ θεωρεί re-import ένα
σκέτο `fileRecordId` swap στο ίδιο level με αμετάβλητο scene — π.χ. (α) gate το `'fit'` όταν υπάρχει έγκυρο persisted
viewport & το scene reference δεν άλλαξε, ή (β) καταστολή του spurious 2ου-snapshot `fileRecordId` change στο
loader/firestore-dedup layer. **Big-player + SSoT πρώτα audit** (`viewport-autofit-policy` είναι ήδη το SSoT).
Τα `canvas-fit-to-view {auto}` του `useSceneState.ts:187/223` είναι **import-only**, ΟΧΙ η αιτία.

---

## 3. SSoT / DEDUP (διαταγή Giorgio: μηδέν διπλότυπα)
Έγραψα αρχικά 3 διπλότυπα helpers στο camera3d (`currentSearchParams`, `isFiniteNumber`, `roundZoom`) + overlap
στο `applyProjectionInstant`. **Όλα κεντρικοποιήθηκαν** (βλ. §1). **Persistence 33/33 πράσινα μετά το dedup.**

**FLAG (pre-existing, ΔΕΝ δημιουργήθηκε από εμένα):** ο **ortho-onComplete του `setProjection`**
(`viewport-camera.ts`) έχει ~5 γρ. inline flags που επικαλύπτουν τον `applyProjectionModeFlags`. Δεν το άγγιξα
(timing-sensitive animated path + shared tree + χωρίς tsc/browser verify). Follow-up: refactor να καλεί τον helper
ΚΡΑΤΩΝΤΑΣ το sync `currentMode = mode` (αλλιώς αλλάζει timing του `projectionMode` getter).

---

## 4. VERIFY / ΕΚΚΡΕΜΗ
- **Jest:** `camera3d-persistence` 15/15 + `viewport-persistence` 18/18 = **33/33** ✅.
- **tsc:** ❌ ΔΕΝ έτρεξε (N.17 — έτρεχαν 2 tsc άλλου agent, PIDs 12396/5200). **Τρέξε όταν ελευθερωθεί ο slot**
  (`Get-CimInstance Win32_Process ... *tsc*` πρώτα). Το type-surface είναι straightforward (signatures συνεπείς).
- 🔴 **browser-verify (Giorgio):** 3D orbit/zoom → hard reload → ίδια όψη· Top View (ortho projection restore)·
  2D↔3D toggle· share-link με `c3d`.
- 🔴 **2D race fix** (§2) — δεν υλοποιήθηκε.
- 🔴 **ortho-flags dedup** (§3) — pre-existing follow-up.
- **commit (Giorgio):** stage τα αρχεία §1 (6 code + 2 test + ADR-400 + ADR-040). **ΟΧΙ** `git add -A`, ποτέ `--no-verify`.
  CHECK 6B → ADR-040 μαζί (ThreeJsSceneManager). CHECK 6D: το `BimViewport3D.tsx`/canvas αρχεία → ADR ήδη staged.

---

## 5. ΜΗΝ ΚΑΝΕΙΣ
- ΜΗΝ ξανα-γράψεις «κανένα 2D override» — απεδείχθη ψευδές (§2).
- ΜΗΝ αγγίξεις τον ortho-onComplete του `setProjection` χωρίς να ελέγξεις το `currentMode` timing + browser.
- ΜΗΝ τρέξεις tsc αν τρέχει άλλος (N.17).
- ΜΗΝ commit/push χωρίς ρητή εντολή Giorgio.
- ΜΗΝ δημιουργήσεις νέα διπλότυπα persistence helpers — υπάρχουν exported στο `viewport-persistence.ts`.
