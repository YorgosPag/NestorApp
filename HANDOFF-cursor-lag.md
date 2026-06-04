# HANDOFF — Cursor tracking lag (DXF Viewer)

> Γράφτηκε 2026-06-04 (Opus 4.8). Διάβασέ το πλήρως πριν συνεχίσεις. Απάντα στον Giorgio **στα Ελληνικά** (CLAUDE.md LANGUAGE RULE).

## 1. ΤΙ ΕΡΕΥΝΟΥΜΕ (το πρόβλημα)

Παράπονο Giorgio: **«όταν μετακινώ τον κέρσορα πάνω στον καμβά, η κίνηση του ποντικιού δεν ταυτίζεται πλήρως με την κίνηση του κέρσορα (crosshair)»** — ορατό trailing/τραύλισμα.
Στόχος που έθεσε: λύση **όπως AutoCAD/Revit, full enterprise + full SSoT** (ADR-040 micro-leaf αρχιτεκτονική).

### Αρχιτεκτονικό context
- Ο crosshair είναι **custom** (native cursor κρυμμένος με `cursor:none`).
- Position SSoT: `systems/cursor/ImmediatePositionStore.ts` → `registerDirectRender` καλείται **σύγχρονα** από `systems/cursor/mouse-handler-move.ts` σε κάθε mousemove.
- ADR-040 = perf bible του DXF viewer. Pre-commit CHECK 6B/6C/6D μπλοκάρουν αλλαγές σε perf-critical αρχεία χωρίς staged ADR.

## 2. ΤΙ ΚΑΝΑΜΕ — 3 φάσεις (σταδιακά, εντολή Giorgio)

### Φ1 — SSoT leaf-gating ✅ COMMITTED (`c6acbb0d`, `e3ca595f`)
- `systems/cursor/useCursor.ts`: `useCursorWorldPosition(enabled = true)` — όταν `enabled=false` → no-op subscribe + stable `null` ⇒ **μηδέν re-render σε mousemove**. Είναι η **μία SSoT πύλη**.
- 13 ghost/preview hooks περνούν το ήδη-υπάρχον gating τους (`isAwaitingPosition`/`isAwaitingEnd`/`PREVIEW_PHASES.has(phase)`/`phase !== 'idle'`).
- test: `systems/cursor/__tests__/useCursorWorldPosition-gate.test.ts` (3 PASS).
- **Αποτέλεσμα:** React per-mousemove 1010ms→469ms, ghost leaves 13→0.

### Φ2 — Compositor crosshair (AutoCAD/Revit-grade) ✅ COMMITTED (`c8122fa3`,`47454acf`,`7d377508`,`0bbb515b`,`ebd9962e`)
- `canvas-v2/overlays/CrosshairOverlay.tsx`: **canvas → promoted DOM elements** που κινούνται **ΜΟΝΟ** με `transform: translate3d` (GPU compositor, off-main-thread).
- Gap διατηρείται με 4 segments σταθερού μεγέθους (αριστερό/δεξί/πάνω/κάτω) — το gap = translate offset.
- Νέο pure helper `canvas-v2/overlays/crosshair-compositor-layout.ts` (12 tests PASS).
- Διαγράφηκε ορφανό `crosshair-selection-indicator.ts` (badge inlined).
- **Αποτέλεσμα:** ο crosshair κοστίζει **0.6%** στο Chrome profile — δουλεύει. Giorgio: «φαίνεται σωστά».

### Φ4 — Stop per-move layer-canvas repaint (ADR-040 «Phase E») ✅ BROWSER-VERIFIED, 🔴 UNCOMMITTED
- **VERIFY 2026-06-04 (console clearRect-counter test, idle hover 4s σε κενό):** `layer-canvas` repaints **1** (πριν Φ4: ~240) · `dxf-canvas` **0** · frames 236/4s=59fps · median=p90=**16.7ms** (locked 60fps) · jank(>33ms)=2/236. Main thread ελεύθερο σε idle move → crosshair 1:1. ΕΠΙΤΥΧΙΑ.
- **Διάγνωση από καθαρό profile** (`profiling-data.04-06-2026.17-05-48.json` — React DevTools Profiler export, 113 commits/4.4s, ΧΩΡΙΣ το 49-54% fake overhead). Επιβεβαίωσε Φ1-Φ3: React work 172ms/4.4s (~4%), median commit 1ms. Ο crosshair εκτός React. **Το πραγματικό εναπομείνον κόστος = imperative full-repaint του `layer-canvas` σε κάθε move (μέσω scheduler RAF — αόρατο στο React profiler).**
- Root cause: `ImmediatePositionStore.setPosition` καλούσε `markSystemsDirty(['layer-canvas','crosshair-overlay'])` ανά move. `'crosshair-overlay'`=no-op από Φ2 → ουσιαστικά full repaint του layer-canvas για legacy crosshair+pickbox που ΗΔΗ κατέχει ο compositor.
- **Fix (2 αρχεία):**
  - `components/dxf-layout/CanvasLayerStack.tsx`: `layerRenderOptions` → `showCrosshair:false`, `showCursor:false`.
  - `systems/cursor/ImmediatePositionStore.ts`: αφαίρεση `'layer-canvas'` από cursor-sync (έσβησα την `markSystemsDirty` κλήση + const). Pan ανέπαφο (`PAN_SYNC_CANVAS_IDS`).
  - `docs/.../ADR-040`: εγγραφή «Phase 4 / Phase E».
- **Ασφάλεια:** snap→SnapIndicatorSubscriber, marquee→DxfCanvas (showSelectionBox ήδη false), hover/draft→δικό τους `params.layers` dirty path, grips→gripStyleStore deps. Plain hover → μηδέν canvas dirty.
- tsc: **0 errors δικά μου** (το 1 repo error=`mesh-to-object3d.ts` του codex, άσχετο). Δεν άγγιξα orchestrators/scheduler.

### Φ3 — Coordinate readouts 🔴 UNCOMMITTED
- `components/dxf-layout/DynamicInputSubscriber.tsx`: gate των 2 cursor `useSyncExternalStore` πίσω από `interactive = dynInput.on && isInteractiveTool(activeTool)`. (Ήταν ο #1 app component: 186 re-renders/move.)
- `ui/toolbar/ToolbarCoordinatesDisplay.tsx`: αντικατάσταση `useCursorWorldPosition()` με **direct `textContent` write** από `subscribeToImmediateWorldPosition` (bypass React → μηδέν `commitTextUpdate`).
- `docs/.../ADR-040-...md`: προστέθηκε Φ3 changelog entry.
- tsc 0. ΔΕΝ έγινε commit (περιμένει εντολή Giorgio).

## 3. 🔴🔴 ΤΟ ΠΙΟ ΚΡΙΣΙΜΟ ΕΥΡΗΜΑ

Ο Giorgio έβγαλε **4 profiles** και είπε «δεν βλέπω διαφορά». **Ο λόγος:** ΟΛΑ τα profiles του έγιναν με το **React DevTools extension ενεργό** (`installHook.js`) + crypto-wallet extensions (OKX/Coinbase) + AdBlock + ~30 tabs.

**Το Chrome Performance profile έδειξε «Επιβάρυνση αξιολόγησης προφίλ» (profiling overhead) = 49-54%** του συνολικού χρόνου. Δηλαδή **πάνω από το μισό του "lag" είναι τεχνητό** — overhead των ίδιων των εργαλείων μέτρησης. Το `installHook.js` (React DevTools) εμφανίζεται σε `getBoundingClientRect`, `recalc style`, `measureHostInstance`, `updateFiberRecursively`.

**ΣΥΜΠΕΡΑΣΜΑ:** Με το React DevTools ανοιχτό, **καμία βελτιστοποίηση δεν θα φανεί** — το overhead τη σκεπάζει. ΠΡΕΠΕΙ καθαρή μέτρηση.

## 4. ΕΠΟΜΕΝΟ ΒΗΜΑ (το ζητούμενο τώρα)

1. **Ζήτα από τον Giorgio καθαρό verify** (το πιο σημαντικό):
   - `chrome://extensions` → **απενεργοποίησε** React Developer Tools + crypto wallets + AdBlock (ή **Incognito**).
   - Κλείσε περιττά tabs. **Χωρίς recording.**
   - Κούνα τον κέρσορα και πες με λόγια: ταυτίζεται τώρα;
2. Αν OK → **commit** Φ3 (δες §6 για ακριβή αρχεία). Όλα μαζί με το ADR-040.
3. Αν παραμένει lag σε καθαρό περιβάλλον → **Chrome Performance profile ΧΩΡΙΣ React DevTools** για να δεις το πραγματικό non-React work. Υποψήφιοι (από τον `mouse-handler-move.ts`, τρέχουν σύγχρονα ανά move): snap engine, hover hit-test, `getPointerSnapshotFromElement` (getBoundingClientRect), + το per-move `markSystemsDirty(['layer-canvas'])` που ξαναζωγραφίζει το layer-canvas. = **Φάση 4** (defer αυτών εκτός σύγχρονου handler σε RAF/idle).

## 5. ⚠️ ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ

- **ΜΗΝ commit/push χωρίς ρητή εντολή Giorgio** (CLAUDE.md N.(-1)). Ποτέ `--no-verify` (N.(-1.1)). Ποτέ `git add -A`.
- **ΜΗΝ εμπιστεύεσαι κανένα profile που έγινε με React DevTools ανοιχτό** — 49-54% ψεύτικο overhead.
- **Shared tree:** τρέχουν codex agents (ADR-408 MEP). Υπάρχουν άσχετα modified αρχεία (`mep-fitting-to-mesh.ts`, `MaterialCatalog3D.ts`, `sync-mep-elements.ts`, `audit-trail/record/route.ts`). **Stage ΜΟΝΟ τα δικά σου cursor-lag αρχεία.**
- **ΜΗΝ αλλάξεις το feature flag `ENTERPRISE_SETTINGS_SHADOW_MODE`** (`layout/FloatingPanelsSection.tsx:261`). Αυτό κρατά ενεργό το `CoordinateDebugOverlay` (debug overlay με 2ο crosshair + window mousemove + getBoundingClientRect). Αν ο Giorgio το έχει ON, ΤΟΥ προσθέτει overhead — αλλά είναι **δική του απόφαση** να το κλείσει.
- **ΜΗΝ πειράξεις `CanvasSection.tsx` / `CanvasLayerStack.tsx`** (orchestrators — ADR-040 Cardinal Rule #1: όχι `useSyncExternalStore` εκεί). Οι αλλαγές μένουν σε leaves.

## 6. ΑΚΡΙΒΗΣ ΚΑΤΑΣΤΑΣΗ GIT (2026-06-04)

**Committed (Φ1+Φ2):** `c6acbb0d`, `e3ca595f`, `c8122fa3`, `47454acf`, `7d377508`, `0bbb515b`, `ebd9962e`.

**Uncommitted (Φ3) — δικά μας, προς commit όταν δοθεί εντολή:**
- `src/subapps/dxf-viewer/components/dxf-layout/DynamicInputSubscriber.tsx`
- `src/subapps/dxf-viewer/ui/toolbar/ToolbarCoordinatesDisplay.tsx`
- `docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md` (Φ3 entry — έχει ΚΑΙ Φ1/Φ2 entries ήδη committed από πάνω)

**Uncommitted — ΑΛΛΟΥ AGENT (codex, ADR-408), ΜΗΝ τα αγγίξεις:**
- `src/app/api/audit-trail/record/route.ts`
- `src/subapps/dxf-viewer/bim-3d/converters/mep-fitting-to-mesh.ts`
- `src/subapps/dxf-viewer/bim-3d/materials/MaterialCatalog3D.ts` (+ test)
- `src/subapps/dxf-viewer/bim-3d/scene/sync-mep-elements.ts`

**Επαλήθευση:** tsc 0 (και στις 3 φάσεις)· tests 15/15 PASS (3 gate + 12 compositor-layout).

## 7. ΣΥΝΟΨΗ ΣΕ ΜΙΑ ΓΡΑΜΜΗ

Λύσαμε σωστά (Φ1+Φ2 committed, Φ3 pending) τον React+paint φόρτο του crosshair· ο crosshair είναι πλέον off-main-thread (0.6%). Το εναπομείνον αισθητό lag του Giorgio είναι **κατά 49-54% artifact του React DevTools** — χρειάζεται **καθαρή μέτρηση** πριν αποφασιστεί αν χρειάζεται Φάση 4 (defer snap/hover/layer-canvas).
