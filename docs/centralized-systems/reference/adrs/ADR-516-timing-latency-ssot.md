# ADR-516 — Timing & Latency SSoT (Zero-Lag Interaction)

- **Status**: **Proposed** (audit complete — υλοποίηση εκκρεμεί συζήτηση/έγκριση Giorgio)
- **Date**: 2026-06-24
- **Domain**: DXF Viewer — Interaction / Performance / Configuration (cross-cutting)
- **Author**: audit κατόπιν εντολής Giorgio (2026-06-24)
- **Related**: ADR-040 (micro-leaf overlay / zero-latency cursor), ADR-096 (`PANEL_LAYOUT.TIMING`),
  ADR-098 (`TIMING_CONFIG`), ADR-030 (UnifiedFrameScheduler), ADR-294/314 (SSoT ratchet)
- **Ratchet impact**: νέο SSoT module + pre-commit κανόνας (forbid raw timing literals σε hooks)

---

## 1. Context — γιατί υπάρχει αυτό το ADR

Ζητήθηκε (Giorgio, 2026-06-24) στρατηγικός έλεγχος του **«lag»** του DXF Viewer με τρεις στόχους:

1. Η εφαρμογή να είναι **ισάξια ή ανώτερη της Revit**.
2. **ΜΗΔΕΝ lag** ανάμεσα στον κέρσορα και την κίνησή του, **και** στη μετακίνηση αντικειμένων με
   τον κέρσορα. *(ρητή, μη-διαπραγματεύσιμη απαίτηση)*
3. Να **κεντρικοποιηθούν κατάλληλα** όλες οι χρονικές τιμές ώστε να τις ορίζουμε εμείς από ένα σημείο.

Το παρόν ADR **τεκμηριώνει τα ευρήματα του audit** και προτείνει αρχιτεκτονική. Δεν περιέχει υλοποίηση
— θα συζητηθεί και θα εγκριθεί χωριστά.

### 1.1 Ορολογία — «lag» = ΔΥΟ διαφορετικά πράγματα (κρίσιμη διάκριση)

| Είδος | Τι είναι | Επιθυμητό; | Είναι «τιμή» που ορίζεις; |
|---|---|---|---|
| **A. Ακούσιο lag** (input latency / jank) | ο κέρσορας/σχέδιο τρέχει *πίσω* από το ποντίκι | **ΟΧΙ ποτέ** — είναι bug | **ΟΧΙ.** Η σωστή τιμή είναι πάντα 0· λύνεται αρχιτεκτονικά, όχι με config |
| **B. Σκόπιμο timing** (throttle / debounce / animation / settle) | εσκεμμένη καθυστέρηση σε πράγματα που δεν πρέπει να τρέχουν 60×/sec | **ΝΑΙ** — σωστή πρακτική | **ΝΑΙ** — αυτά ακριβώς κεντρικοποιούνται |

Η απαίτηση «μηδέν lag στον κέρσορα» αφορά το **A**. Η κεντρικοποίηση αφορά το **B**.

---

## 2. Findings — η τρέχουσα κατάσταση (CODE = SOURCE OF TRUTH)

### 2.1 Δεν υπάρχει «κανένα SSoT» — υπάρχουν **ΤΡΙΑ ανταγωνιστικά**, και τα παρακάμπτουν όλοι

| «SSoT» | ADR | Ισχυρισμός στο header | Πραγματικότητα |
|---|---|---|---|
| `config/panel-tokens.ts → PANEL_LAYOUT.TIMING` | ADR-096 | *«Single source of truth for ALL setTimeout/setInterval values»* (~50 consts) | Το πληρέστερο — αλλά αγνοείται από persistence/drag/grip hooks |
| `config/timing-config.ts → TIMING_CONFIG` | ADR-098 | *«Single Source of Truth για setTimeout/setInterval values»* | Δεύτερο SSoT, επικαλύπτεται **και αντιφάσκει** με το πρώτο |
| `config/settings-config.ts` | — | `CANVAS_THROTTLE` / `DEBOUNCE_DELAY` / `AUTO_SAVE_INTERVAL` / `ANIMATION_DURATION` | Τρίτο, μικρό |

**Δύο αρχεία δηλώνουν κατά λέξη «I am the single source».** Αυτό είναι το αντίθετο του SSoT.

### 2.2 Αντιφάσεις (ίδια έννοια, διαφορετική τιμή / διπλός ορισμός)

- **Autosave debounce → 3 τιμές**:
  - `SCENE_AUTOSAVE_DEBOUNCE: 2000` (`timing-config.ts`)
  - `AUTOSAVE_DEBOUNCE: 500` (`panel-tokens.ts`)
  - `AUTO_SAVE_DEBOUNCE_MS = 500` **hardcoded σε 15+ persistence hooks** (βλ. §2.4)
- **Frame-time (16ms «1 frame @60fps») → 6 ανεξάρτητοι ορισμοί**:
  - `settings-config.CANVAS_THROTTLE: 16`
  - `systems/cursor/config.ts → crosshair.throttle_ms` (ιστορικά 16)
  - `systems/rulers-grid/config.ts → RENDER_THROTTLE_MS: 16`
  - `hooks/useEntityDrag.ts → THROTTLE_MS: 16`
  - `hooks/useGripMovement.ts → DEBOUNCE_MS: 16`
  - `hooks/useEnhancedSelection.ts → DEBOUNCE_MS: 16`
- **Double-click 300ms → διπλό μέσα στο ΙΔΙΟ block**: `DOUBLE_CLICK_MS` + `DOUBLE_CLICK_WINDOW` (`panel-tokens`).
- **Hover delay 800ms → 2 ασύνδετα**: `QuickPropertiesStore.HOVER_DELAY_MS` vs `use-bim3d-pointer-handlers.HOVER_DEBOUNCE_MS`.
- **Merge window 500ms → 2 αντίγραφα**: `useEntityDrag.MERGE_WINDOW_MS` + `useGripMovement.MERGE_WINDOW_MS`.

### 2.3 Ιστορικό — είχε εντοπιστεί, δεν ολοκληρώθηκε

Υπάρχουν ήδη αναλύσεις που πρότειναν ενοποίηση και **δεν υλοποιήθηκαν**:
- `docs/architecture/CONSTANTS_CONSOLIDATION.md` — flag `throttle_ms:16` σε 4+ σημεία.
- `docs/analysis/duplicates/Configuration_objects.md` — πρόταση `FRAME_TIME_MS:16` ως SINGLE SOURCE
  (+ `CURSOR_THROTTLE_MS`/`CANVAS_THROTTLE_MS`/`RULER_THROTTLE_MS`…) που έμεινε στα χαρτιά.

### 2.4 Bypass — local consts που ΔΕΝ εισάγουν από κανένα SSoT (hardcoded)

**Κατηγορία «autosave/persist» (το χειρότερο διπλότυπο) — `const AUTO_SAVE_DEBOUNCE_MS = 500`:**
`hooks/data/useWallPersistence.ts`, `useSlabPersistence.ts`, `useSlabOpeningPersistence.ts`,
`useRoofPersistence.ts`, `useRailingPersistence.ts`, `useOpeningPersistence.ts`,
`useWallCoveringPersistence.ts`, `useThermalSpacePersistence.ts`, `useSpaceSeparatorPersistence.ts`,
`useMepWaterHeaterPersistence.ts`, `useMepUnderfloorPersistence.ts`, `bim/hooks/use-stair-persistence.ts`,
`settings-provider/constants.ts` (+ άλλα MEP). *(15+ αρχεία, ίδια τιμή, μηδέν κοινή πηγή.)*

**Διάσπαρτα one-off (ενδεικτικά, με τιμή & αρχείο):**

| Const | Τιμή | Αρχείο |
|---|---|---|
| `WARM_DELAY_MS` | 1000 | `hooks/grips/grip-mouse-move-handler.ts` |
| `MENU_HOLD_MS` | 400 | `hooks/grips/useGripHoverMenuController.ts` |
| `LONG_PRESS_THRESHOLD_MS` | 500 | `hooks/gestures/useLongPress.ts` |
| `HOVER_DELAY_MS` | 800 | `systems/properties/QuickPropertiesStore.ts` |
| `HOVER_DEBOUNCE_MS` | 800 | `bim-3d/viewport/use-bim3d-pointer-handlers.ts` |
| `LINGER_MS` | 140 | `components/dxf-layout/GuideFollowGhostOverlay.tsx` |
| `ACQUISITION_DURATION_MS` / `INACTIVITY_TIMEOUT_MS` | 1000 / 5000 | `systems/tracking/TrackingPointStore.ts` |
| `BIM_CHORD_TIMEOUT_MS` / `GUIDE_CHORD_TIMEOUT_MS` | 350 | `hooks/useDxfToolbarShortcuts.ts` / `config/keyboard-shortcuts.ts` |
| `SEARCH_DEBOUNCE_MS` | 150 | `ui/components/layer-state/LayerStateTemplateBrowser.tsx` |
| `COMMIT_DEBOUNCE_MS` | 200 / 300 | `ui/ribbon/components/RibbonWallDimensionWidget.tsx`, `RibbonMep*Widget.tsx` |
| `SCROLL_THROTTLE_MS` / `RESIZE_DEBOUNCE_MS` | 100 / 150 | `services/CanvasBoundsService.ts` |
| `EDGE_TRIM_THROTTLE_MS` / `REFINE_DELAY_MS` | 50 / 150 | `bim-3d/scene/section-scene-controller.ts` |
| `PROJECTION_SWITCH_DURATION_MS` / `FRAME_SCENE_DURATION_MS` / `PAN_ANIMATION_DURATION_MS` / `POI_FADE_*` | 500 / 500 / 150 / 1500+300 | `bim-3d/viewport/viewport-constants.ts` |
| `smoothFadeDurationMs` | 200 | `systems/rulers-grid/config.ts`, `rendering/ui/grid/GridTypes.ts`, `CanvasSettings.ts` |
| `WHEEL_INTERACTION_IDLE_MS` | 220 | `bim-3d/viewport/viewport-camera.ts` |
| `TRANSITION_MS` / `SSAO_TRANSITION_MS` | 300 | `bim-3d/lighting/quality-modulator.ts`, `ssao-modulator.ts` |
| `IDEMPOTENCY_MS` / `DEBOUNCE_MS` (a11y) | 200 / 250 | `bim-3d/accessibility/*` |
| `DEBOUNCE_MS` / `EXPIRY_MS` (draft) | 30000 / 7d | `text-engine/draft/DraftRecoveryService.ts` |

*(Δεν εξαντλητικό· δείγμα ~25 από ~40+ σημασιολογικά distinct timings πέρα από τα 3 configs.)*

### 2.5 Κατηγορία 0 — το zero-lag path (ΔΕΝ έχει timing const, by design)

Ο κέρσορας, το σταυρόνημα, το snap marker και το ghost μετακίνησης **δεν περνούν από throttle/debounce** —
ενημερώνονται **σύγχρονα** από το event:
- `systems/cursor/ImmediatePositionStore.ts` → `registerDirectRender(pos => …)` (zero-latency, σύγχρονο).
- `systems/cursor/ImmediateTransformStore.ts` → `getImmediateTransform()` (event-time read).
- Compositor crosshair (`CrosshairOverlay.tsx`) → μόνο `transform: translate3d` στον GPU compositor
  (ADR-040), εκτός main thread.

**Αυτό είναι ήδη Revit-grade και πρέπει να μείνει ανέγγιχτο** — η κεντρικοποίηση **δεν** πρέπει να
εισαγάγει timing const εδώ (θα ήταν regression τύπου A).

⚠️ **Προς επαλήθευση (open question §6)**: η μετακίνηση *αντικειμένων* με τον κέρσορα
(`useEntityDrag`/`useGripMovement` με `THROTTLE_MS/DEBOUNCE_MS = 16`) έχει σκόπιμο 1-frame throttle.
Πρέπει να επιβεβαιωθεί ότι αυτό αφορά μόνο το **commit/persist** και ΟΧΙ το **οπτικό ghost** — αλλιώς
ο χρήστης βλέπει το αντικείμενο να «σέρνεται» 1 frame πίσω (μικρό lag τύπου A στη μετακίνηση).
Στόχος: το ghost ακολουθεί instant (κατηγορία 0), ο υπολογισμός/persist throttled (κατηγορία 1/3).

---

## 3. Η αρχή των μεγάλων παικτών (Revit / AutoCAD / Figma / Google)

Δεν βάζουν «ένα lag παντού». Εφαρμόζουν **ασυμμετρία latency**:

| Τι αγγίζει τον χρήστη | Πολιτική | Γιατί |
|---|---|---|
| Κέρσορας, σταυρόνημα, snap marker, ghost που ακολουθεί | **0 — ακαριαίο**, ξεχωριστό high-priority path, off-main-thread / GPU | ο εγκέφαλος αντιλαμβάνεται >10–15ms στον κέρσορα ως «βαριά» εφαρμογή |
| Regen / heavy recompute / occlusion / lighting | **throttle / coalesce ανά frame** (vsync 60–120Hz) | ο χρήστης δεν προσέχει αν αργήσει 1–2 frames |
| Autosave / journaling / network / indexing | **debounce** (εκατοντάδες ms) | δεν θες I/O σε κάθε keystroke |
| Tooltips / hover-reveal / fade | σκόπιμο **settle delay** + easing | UX, να μην τρεμοπαίζει |

**Κανόνας:** *instant ό,τι αγγίζει την αντίληψη· throttle/debounce ό,τι όχι.*

---

## 4. Κατηγοριοποίηση (το θεμέλιο της λύσης — ΟΧΙ «μία τιμή», αλλά κατηγορίες)

| # | Κατηγορία | Σκοπός | Τυπικές τιμές | Πολιτική |
|---|---|---|---|---|
| **0** | **Instant path** | κέρσορας, σταυρόνημα, snap marker, ghost | **0ms** | καμία const· αρχιτεκτονικά σύγχρονο/compositor (ADR-040) |
| **1** | **Per-frame throttle** | redraw / hover hit-test / snap detection | 16 / 32 / 50 / 100 | coalesce ανά frame |
| **2** | **UI debounce** | settings sliders, search, resize, input | 100 / 150 / 200 / 300 | debounce |
| **3** | **Autosave / persist** | Firestore writes | 500 / 2000 | debounce (μεγάλο) |
| **4** | **Animation / fade** | camera, grid fade, projection, POI | 150 / 200 / 300 / 500 | duration/easing |
| **5** | **Lifecycle / timeout** | TTL, cache, health, import, lock | 5s / 30s / 1min / 5min | timeout |
| **6** | **Gesture / settle** | long-press, hover-reveal, menu-hold, warm-delay, linger, chord | 140 / 350 / 400 / 500 / 800 / 1000 | settle delay |

---

## 5. Proposed Decision (για έγκριση — δεν έχει υλοποιηθεί)

### 5.1 ΕΝΑ `DXF_TIMING` SSoT, οργανωμένο στις 7 κατηγορίες
- Merge των τριών υπαρχόντων (`PANEL_LAYOUT.TIMING` + `TIMING_CONFIG` + `settings-config` timings) σε
  **ένα** module με σημασιολογικά ονόματα ανά κατηγορία (π.χ. `DXF_TIMING.frame.THROTTLE`,
  `DXF_TIMING.persist.AUTOSAVE`, `DXF_TIMING.gesture.LONG_PRESS`).
- Σβήσιμο των δύο διπλών «I am SSoT» claims (κράτηση re-export για backward-compat κατά τη μετάβαση).
- `as const` + type-safe· μηδέν magic literal εκτός του module.

### 5.2 Zero-lag guard (κατηγορία 0 — η ρητή απαίτηση Giorgio)
- Το `DXF_TIMING` περιλαμβάνει **σχόλιο/κανόνα**: *instant paths (cursor/crosshair/snap/ghost) ΔΕΝ
  παίρνουν timing const.*
- Pre-commit έλεγχος: απαγόρευση εισαγωγής throttle/debounce literal στα αρχεία της κατηγορίας 0
  (`ImmediatePositionStore`, `ImmediateTransformStore`, `CrosshairOverlay`, ghost-follow paths).
- Επαλήθευση §6: το οπτικό ghost μετακίνησης αντικειμένου πρέπει να ακολουθεί instant.

### 5.3 Rewire των bypass (η μεγάλη δουλειά)
- 15+ `AUTO_SAVE_DEBOUNCE_MS = 500` → `DXF_TIMING.persist.AUTOSAVE`.
- 6× frame-time → `DXF_TIMING.frame.THROTTLE`.
- διάσπαρτα one-off (§2.4) → αντίστοιχη κατηγορία.

### 5.4 Ratchet (ADR-294/314 pattern)
- pre-commit κανόνας: νέο raw `_MS`/`throttle`/`debounce` numeric literal σε hook/component → BLOCK
  (πρέπει να δείχνει στο `DXF_TIMING`). Baseline για τα υπάρχοντα, μειώνεται μόνο.

### 5.5 Google-level checklist (N.7.2)
- **Proactive**: τιμές ορίζονται στο config lifecycle, όχι ως side-effect.
- **SSoT**: ένα module, μία τιμή ανά έννοια.
- **Idempotent / pure**: σταθερές, μηδέν state/async.
- **Ownership**: το `DXF_TIMING` είναι ο μόνος ιδιοκτήτης· κατηγορία 0 ανήκει στην αρχιτεκτονική (ADR-040), όχι σε τιμή.

---

## 6. Open Questions (να αποφασιστούν στη συζήτηση πριν την υλοποίηση)

1. **Autosave: 500 ή 2000ms;** Υπάρχουν και οι δύο τιμές ζωντανές. Ποια είναι η σωστή (ή per-domain;).
   *(Πρόταση: 500ms per-entity persist, 2000ms scene-level — αλλά θέλει επιβεβαίωση.)*
2. **Μετακίνηση αντικειμένου (drag/grip) — υπάρχει ορατό 1-frame lag;** Πρέπει να επαληθευτεί στον
   browser ότι το ghost ακολουθεί instant και μόνο το persist είναι throttled (§2.5).
3. **Μέγεθος/scope υλοποίησης**: το rewire αγγίζει **~30–40 αρχεία σε 2+ domains** (persistence + drag +
   bim-3d). Κατά N.8 → **Orchestrator-level** (~2.5–3.5× tokens), απαιτεί ρητή έγκριση. Εναλλακτικά:
   **Φάση 1 μόνο** (merge configs + ADR + zero-lag guard, χαμηλό ρίσκο), rewire σε επόμενη φάση.

---

## 7. Consequences

- **+** Μία πηγή για κάθε χρονική τιμή· τέλος στις 3 ανταγωνιστικές πηγές & στις αντιφάσεις.
- **+** Ρητή προστασία του zero-lag path (κατηγορία 0) με guard → ο κέρσορας δεν θα αποκτήσει ποτέ lag.
- **+** Revit-grade ασυμμετρία latency κωδικοποιημένη ως αρχιτεκτονικός κανόνας.
- **−** Το rewire είναι cross-cutting (~30–40 αρχεία) → χρειάζεται προσοχή ώστε καμία τιμή να μην αλλάξει
  ακούσια (ιδίως autosave 500↔2000).
- **−** Απαιτεί απόφαση Giorgio στα open questions §6 πριν ξεκινήσει η υλοποίηση.

---

## 8. Changelog

- **2026-06-24** — Δημιουργία ADR. Πλήρες audit timing/lag (§2): 3 ανταγωνιστικά SSoT, αντιφάσεις,
  κατάλογος bypass (§2.4), zero-lag path (§2.5). Κατηγοριοποίηση 0–6 (§4). Proposed απόφαση (§5):
  ένα `DXF_TIMING` + zero-lag guard + rewire + ratchet. Open questions προς συζήτηση (§6).
  **Status: Proposed — καμία αλλαγή κώδικα. Αναμονή έγκρισης Giorgio.**
