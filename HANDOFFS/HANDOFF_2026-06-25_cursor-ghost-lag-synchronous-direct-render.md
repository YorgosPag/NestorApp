# HANDOFF — Cursor/Ghost lag: συγχρονισμός ghost στο zero-latency path του crosshair (ADR-040 Φ12)

**Ημερομηνία:** 2026-06-25
**Σχετικά ADR:** ADR-040 (preview-canvas performance — cursor-lag Φ4/Φ10/Φ11 ΗΔΗ υπάρχουν → αυτό = **Φ12**), ADR-398 §4 (`useCanvasGhostPreview` harness SSoT), ADR-516 (raf-coalesced throttle SSoT)
**Προτεινόμενο ADR doc:** ενημέρωση **ADR-040** (μην φτιάξεις νέο· είναι το canonical home· αν θες ξεχωριστό → επιβεβαίωσε highest, ADR-528 = πιασμένο)
**Προτεινόμενο μοντέλο:** Opus (αρχιτεκτονική αλλαγή σε hot path, αγγίζει ADR-040 micro-leaf αρχεία) → **Plan Mode ΠΡΩΤΑ**

---

## 0. ΑΠΑΡΑΒΑΤΟΙ ΚΑΝΟΝΕΣ (Giorgio, ρητά)

1. **ΠΡΙΝ ΟΠΟΙΟΝΔΗΠΟΤΕ κώδικα → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT με grep** (βλ. §6). Ψάξε αν υπάρχει ΗΔΗ μηχανισμός για να τον χρησιμοποιήσεις — **ΜΗΝ φτιάξεις διπλότυπο**.
2. **FULL ENTERPRISE + FULL SSoT** — «όπως η Revit / οι μεγάλοι παίκτες». Όχι μπαλώματα.
3. **COMMIT ΤΟΝ ΚΑΝΕΙ Ο GIORGIO** — ΟΧΙ εσύ. Ετοίμασε, σταμάτα, ανέφερε.
4. **Shared working tree** — άλλος agent δουλεύει ΤΑΥΤΟΧΡΟΝΑ. **Διάβαζε φρέσκο πριν κάθε Edit.** **ΜΗΝ αγγίξεις `useColumnTool.ts`.**
5. **N.17 single-tsc** — ΕΝΑ `tsc` τη φορά (έλεγξε running πρώτα). **ΠΡΟΣΟΧΗ: το tsc κάνει OOM** στο μηχάνημα — βασίσου σε jest (ts-jest compile) + static checks αντί full tsc.
6. **ΣΕΙΡΑ:** ΠΡΩΤΑ **Φάση 0 (μέτρηση)**, ΥΣΤΕΡΑ **Φάση 1 (υλοποίηση)**.
7. **ADR-040 CHECK 6B/6D (pre-commit BLOCK):** όποιο από τα cursor/preview αρχεία αγγίξεις → **πρέπει να γίνει stage και το ADR-040** στο ίδιο commit, αλλιώς το hook μπλοκάρει.

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ (αναφορά Giorgio)

- Lag ανάμεσα στον **κέρσορα** (rendered crosshair) και την **κίνηση του χεριού**.
- Lag ανάμεσα στη **μετακίνηση αντικειμένων** και τον **κέρσορα**.
- **Με τις έλξεις ΣΒΗΣΤΕΣ → η οντότητα ΠΡΟΠΟΡΕΥΕΤΑΙ του κέρσορα** (αναστρέφεται η σχέση lead/lag ανάλογα με ON/OFF snaps).

---

## 2. ΔΙΑΓΝΩΣΗ (ολοκληρωμένο audit της προηγούμενης session — μην το ξανακάνεις από το μηδέν)

### 2.1 ΔΕΝ υπάρχει διπλοτυπία — ΕΝΑ SSoT θέσης
Επιβεβαιωμένο με grep:
- Η θέση κέρσορα ζει σε **ΜΙΑ πηγή**: `systems/cursor/ImmediatePositionStore.ts` (2 κανάλια: screen + world).
- `CursorSystem.tsx:139–144` → `cursor.updatePosition/updateWorldPosition` **delegate-άρουν** στο `ImmediatePositionStore` (όχι δικό τους reducer state).
- `mouse-handler-move.ts:144` → **ΕΝΑ** `screenToWorld` ανά κίνηση (ρητό SSoT).
- Render ghosts κεντρικοποιημένο: `hooks/tools/useCanvasGhostPreview.ts` = **ένα** harness για ~19 ghost previews (ADR-398 §4).
→ **Καμία copy-paste, κανένα δεύτερο position store. Το SSoT είναι καθαρό.**

### 2.2 Η ΡΙΖΑ: ασυμμετρία στον ΤΡΟΠΟ κατανάλωσης του ίδιου SSoT (όχι duplication)
Δύο διαφορετικά οπτικά (σταυρός vs οντότητα-φάντασμα) διαβάζουν το ΙΔΙΟ SSoT με **διαφορετικό χρονισμό**:

| Στοιχείο | Τι ζωγραφίζει | Πώς διαβάζει το SSoT | Καθυστέρηση |
|---|---|---|---|
| **Crosshair** | τον σταυρό | `registerDirectRender` — **σύγχρονα** μέσα στο event (compositor `translate3d`) | ~instant (sub-frame) |
| **Move/draw ghost** | την οντότητα | `useCursorWorldPosition` = **`useSyncExternalStore`** → React re-render → `useEffect` → `requestAnimationFrame` | **~1–2 frames** |
| **Grip-drag ghost** | την οντότητα | `setDragPreviewPosition` → **React state** (`useLayerCanvasMouseMove.ts:227`) → re-render → RAF | **~1–2 frames** |

- **«lag οντότητας ↔ κέρσορα»** = το ghost περνά από React commit + RAF, ενώ ο σταυρός είναι σύγχρονος → ξεκολλάνε ~16–33ms.
- **«lag κέρσορα ↔ χεριού»** = ο native OS cursor **ΔΕΝ κρύβεται** (μόνο ο eyedropper βάζει προσωρινά `cursor:none`). Όταν ο main thread ζορίζεται (hit-test 50ms, redraw, το ίδιο το ghost RAF) → καθυστερεί η **παράδοση** του mousemove event → ο compositor σταυρός μένει πίσω από το χέρι.
- **«snaps OFF → οντότητα προπορεύεται»** = η ανίχνευση snap είναι decoupled σε RAF με throttle **~32ms/30fps** (`snap-scheduler.ts`, `SNAP_DETECTION:32`). Ανάλογα με το αν η θέση έρχεται σύγχρονα (raw, snaps off) ή από το 30fps snap RAF (snaps on), αναστρέφεται η σχετική «πρωτοπορία». ⚠️ **100% ειλικρίνεια:** η ακριβής πολικότητα ανά κατάσταση εξαρτάται από runtime (event coalescing, RAF ordering) — **βέβαιο** είναι ότι τα δύο pipelines έχουν διαφορετική καθυστέρηση και desync-άρουν.

---

## 3. ΚΡΙΣΙΜΑ ΑΡΧΕΙΑ (με γραμμές — verified)

| Αρχείο | Ρόλος |
|---|---|
| `canvas-v2/overlays/CrosshairOverlay.tsx` | Compositor crosshair· `registerDirectRender` (γρ.312), `applyTransform` translate3d (γρ.247) — **το zero-latency πρότυπο** |
| `systems/cursor/ImmediatePositionStore.ts` | SSoT θέσης· `setPosition` sync directRenderCallback (γρ.92,107–113)· `setWorldPosition` (γρ.229)· `subscribeWorldPosition` (γρ.241)· `registerDirectRender` (**ΕΝΑ slot**, γρ.129) |
| `systems/cursor/useCursor.ts` | **`useCursorWorldPosition` = `useSyncExternalStore` (γρ.45)** — ο React hop που καθυστερεί το ghost |
| `hooks/tools/useCanvasGhostPreview.ts` | **Ο harness-στόχος** (SSoT ~19 ghosts)· `useCursorWorldPosition` (γρ.89)· RAF on cursorWorld change (γρ.141–152) |
| `hooks/tools/useMovePreview.ts` | Move ghost draw· καλεί `useCanvasGhostPreview` (γρ.207, **χωρίς** `useImmediateSnap` → default false) |
| `hooks/tools/useGripGhostPreview.ts` | Grip-drag ghost (`cursorMode:'none'`, cursor μέσω `dragPreview.delta` prop = React state) |
| `hooks/canvas/useLayerCanvasMouseMove.ts` | Ενεργός handler σε select/move/layering· `setImmediatePosition`+`setImmediateWorldPosition` sync (γρ.124–125)· `setDragPreviewPosition` React state (γρ.227) |
| `systems/cursor/mouse-handler-move.ts` | Κεντρικός handler· crosshair sync (γρ.138)· grip-drag SYNC+snapped (γρ.177–281)· `drawHoverThrottleRef` raf-coalesced (γρ.74,301)· snap-scheduler arming (γρ.315–321) |
| `systems/cursor/snap-scheduler.ts` | Decoupled snap RAF, throttle 32ms |
| `hooks/raf-coalesced-throttle.ts` | **`createRafCoalescedThrottle` — REUSE το για το fix** (ίδιο που ήδη χρησιμοποιεί ο drawing-hover) |
| `systems/preview/ghost-preview-frame.ts` | `getCanonicalPreviewFrame` (viewport cached + live transform SSoT) |
| `config/dxf-timing.ts` | `THROTTLE_60:16`, `CURSOR_CONTEXT:50`, `SNAP_DETECTION:32`, `GRIP_HOVER:100` |

---

## 4. ΦΑΣΗ 0 — ΜΕΤΡΗΣΗ ΠΡΩΤΑ (built-in perf tracer)

**Δεν χρειάζεται νέος κώδικας — υπάρχει ήδη** (`mouse-handler-perf.ts`).

Βήματα (πες τα στον Giorgio να τα τρέξει στον browser, ή verify μαζί):
1. Console: `localStorage.setItem('dxf-perf-trace','1')` → refresh (ή `window.__dxfPerfRefresh()`).
2. Κάνε move/grip-drag αντικειμένων με snaps ON και OFF.
3. Ανά 60 samples βγαίνει `console.table` με stages ταξινομημένα κατά total χρόνο. Δες:
   - `set-immediate-position`, `world-coord-calc` → φθηνά; αν όχι = main-thread issue στον crosshair.
   - `hit-test-entity`, `drawing-hover-callback` → αν βαριά = main-thread συμφόρηση που μεγεθύνει το «cursor↔hand lag».
4. `window.__dxfPerfReport()` για on-demand dump.

⚠️ **ΣΗΜΑΝΤΙΚΟ caveat:** το `withPerf` μετρά ΜΟΝΟ το **σύγχρονο** handler. Το ghost desync (React re-render + RAF) ζει **ΕΚΤΟΣ** του handler → **ΔΕΝ** θα φανεί στο trace. Άρα:
- Το trace επιβεβαιώνει το **main-thread cost** (σκέλος «cursor↔hand»).
- Το **ghost↔cursor desync** είναι **δομικό** (επιβεβαιωμένο από κώδικα §2.2) — επιβεβαιώνεται οπτικά, όχι από το trace.

**Παραδοτέο Φάσης 0:** σύνοψη ποιο stage βαραίνει + οπτική επιβεβαίωση πολικότητας lead/lag (snaps on vs off) → καθορίζει αν χρειάζεται ΚΑΙ main-thread offload (π.χ. hit-test) μαζί με τον συγχρονισμό του ghost.

---

## 5. ΦΑΣΗ 1 — ΥΛΟΠΟΙΗΣΗ (Plan Mode ΠΡΩΤΑ· FULL SSoT reuse)

**Στόχος:** το move/grip ghost να διαβάζει το **ίδιο SSoT** (`ImmediatePositionStore`) με τον **ίδιο σύγχρονο τρόπο** που το διαβάζει ο crosshair — **όχι** μέσω `useSyncExternalStore → React re-render → RAF**. Ίδια πηγή, ίδιος χρονισμός → μηδέν desync, ανεξάρτητα από snaps.

### Κατεύθυνση (FULL SSoT — επιβεβαίωσέ την με το audit §6, μην την πάρεις δεδομένη):
- Μέσα στο **`useCanvasGhostPreview`** (ένα harness → διορθώνει **ΚΑΙ τα ~19 ghosts μαζί** = full SSoT win):
  - **Αντικατάστησε** το `useCursorWorldPosition` (useSyncExternalStore) με **μη-React** subscription στο `ImmediatePositionStore.subscribeWorldPosition` (υπάρχει ήδη), που **arm-άρει ένα RAF-coalesced draw** μέσω **`createRafCoalescedThrottle`** (ADR-516 SSoT — **REUSE**, το ίδιο που ήδη κάνει ο drawing-hover, `mouse-handler-move.ts:74,301`).
  - Έτσι το draw τρέχει στο **ίδιο frame** με το event (leading-edge), χωρίς React commit latency, με 60fps cap διατηρημένο.
  - **Διατήρησε το gating** (subscribe ΜΟΝΟ όταν `isActive`) — μηδέν listener σε idle (κρίσιμο για ADR-040).
  - Κράτα `getImmediateSnap` (snapped path) + `getCanonicalPreviewFrame` αμετάβλητα (ήδη SSoT).
- **Grip-drag ghost** (`useGripGhostPreview`, cursor μέσω `dragPreview` React state, γραμμένο στο `useLayerCanvasMouseMove.ts:227`): ίδια φιλοσοφία — οδήγησέ το από store/sync, όχι από React state. Δες αν μπορεί να ενοποιηθεί στον ΙΔΙΟ μηχανισμό (μην φτιάξεις 2ο).
- **ΜΗΝ** προσθέσεις 2ο position store / 2ο throttle util / νέο RAF loop. Reuse: `ImmediatePositionStore`, `createRafCoalescedThrottle`, `getImmediateSnap`, `getCanonicalPreviewFrame`, `registerDirectRender` (πρότυπο).

### Προσοχή στα ADR-040 cardinal rules:
- Μην βάλεις `useSyncExternalStore` σε orchestrators (CanvasSection/CanvasLayerStack — CHECK 6C). Εδώ **αφαιρείς** ένα useSyncExternalStore από leaf harness = βελτίωση.
- Κράτα τα leaves ≤1 canvas / ≤2 high-freq hooks.

---

## 6. ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT — ΤΡΕΞΕ ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ

```
cd src/subapps/dxf-viewer

# 1. Ο throttle util που πρέπει να κάνεις REUSE (μην φτιάξεις άλλον):
cat hooks/raf-coalesced-throttle.ts
grep -rn "createRafCoalescedThrottle" --include="*.ts" --include="*.tsx" . | grep -v __tests__

# 2. ΟΛΟΙ οι consumers του harness (επιβεβαίωσε ότι το fix τους πιάνει όλους):
grep -rln "useCanvasGhostPreview" --include="*.ts" --include="*.tsx" . | grep -v __tests__

# 3. Το React-hop που αφαιρείς (όλοι όσοι διαβάζουν world cursor μέσω React):
grep -rn "useCursorWorldPosition\|subscribeWorldPosition\|subscribeToImmediateWorldPosition" --include="*.ts" --include="*.tsx" . | grep -v __tests__

# 4. Το zero-latency πρότυπο (μην ξαναϋλοποιήσεις — δες πώς δουλεύει):
grep -rn "registerDirectRender" --include="*.ts" --include="*.tsx" . | grep -v __tests__

# 5. Grip-drag React-state path (2ος καταναλωτής):
grep -rn "setDragPreviewPosition\|dragPreview" --include="*.ts" --include="*.tsx" . | grep -v __tests__

# 6. Snap channel που τρέφει το ghost (κράτα το):
grep -rn "getImmediateSnap\|ImmediateSnapStore" --include="*.ts" --include="*.tsx" . | grep -v __tests__

# 7. Σιγουρέψου ότι ΔΕΝ υπάρχει ήδη "direct render ghost" μηχανισμός (anti-dup):
grep -rni "direct.?render\|sync.*ghost\|ghost.*sync" --include="*.ts" --include="*.tsx" . | grep -v __tests__
```

---

## 7. VERIFICATION
- **Jest** ανά αρχείο που αγγίζεις (ts-jest = compile check). Υπάρχει ήδη `hooks/tools/__tests__/useCanvasGhostPreview.test.tsx` — **κράτα το πράσινο** + πρόσθεσε case για τον σύγχρονο μηχανισμό (leading-edge, gating off→no listener).
- **tsc:** OOM (N.17) — ΜΗΝ βασιστείς σε full tsc· static import check + jest.
- **Browser (Φάση 0 + μετά το fix):** move + grip-drag, snaps ON & OFF → ghost ΚΑΙ crosshair να κινούνται **κλειδωμένα** (μηδέν desync). Επανέλεγξε με τον perf tracer ότι δεν προστέθηκε main-thread κόστος.

---

## 8. ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗΝ commit/push (ο Giorgio).
- ΜΗΝ φτιάξεις 2ο position store / 2ο RAF-throttle util / νέο RAF loop — **reuse** τα υπάρχοντα SSoT.
- ΜΗΝ αγγίξεις `useColumnTool.ts` (άλλος agent).
- ΜΗΝ αλλάξεις τη γεωμετρία/συμπεριφορά του ghost — ΜΟΝΟ τον χρονισμό κατανάλωσης θέσης.
- ΜΗΝ αγγίξεις cursor/preview αρχείο χωρίς να κάνεις stage το **ADR-040** (CHECK 6B/6D).
- ΜΗΝ ξεκινήσεις υλοποίηση πριν τη Φάση 0 (μέτρηση) + Plan Mode.
```
