# HANDOFF — ADR-402 Phase B (επόμενο): SNAP κατά το 3Δ gizmo drag

**Ημερομηνία σύνταξης:** 2026-05-31
**Συντάκτης:** Developer A (Opus 4.8, SOLO)
**Θέμα:** ADR-402 — 3D Viewport BIM Element Editing
**Επόμενη φάση (απόφαση Developer A):** **Snap κατά το gizmo drag** (move endpoints/grid πρώτα, resize-face μετά)
**Κατάσταση εκκίνησης:** ΚΑΘΑΡΟ ξεκίνημα — δεν έχει γραφτεί κώδικας για snap. Όλη η προηγούμενη Phase B resize είναι ✅ DONE.

---

## 0. ΠΡΩΤΟ ΒΗΜΑ ΟΤΑΝ ΞΕΚΙΝΗΣΕΙΣ

1. **Έλεγξε git status/log** — τα Phase B resize αρχεία (6 source + 3 test + ADR-402) μπορεί να είναι **είτε ακόμα uncommitted** στο working tree, **είτε committed** (αν ο Giorgio έδωσε εντολή commit μετά τη σύνταξη). ΜΗΝ υποθέσεις. Αν είναι uncommitted, ΜΗΝ τα μπλέξεις με τη νέα δουλειά — ξεχωριστά commits.
2. **Διάβασε** το ADR-402 doc (`docs/centralized-systems/reference/adrs/ADR-402-3d-bim-element-editing.md`) — Status + τα 2 τελευταία changelog entries (resize column + resize wall/beam/slab).
3. **Phase 1 recognition (ADR-driven):** διάβασε τον κώδικα ΠΡΙΝ γράψεις — οι 3 «θέσεις-κλειδιά» είναι στο §3 παρακάτω.

---

## 1. ΓΙΑΤΙ ΑΥΤΗ Η ΦΑΣΗ (απόφαση εύρους)

Phase B έκλεισε το **resize όλων των τύπων + άξονας-Y** (✅ DONE pending/commit). Απομένουν 2 πράγματα + stair:
- **Snap κατά το drag** ← **ΕΠΟΜΕΝΟ** (αυτό το handoff)
- Multi-select 3Δ centroid resize (cross-cutting: store widening + ~6 consumers — μεγαλύτερο ρίσκο, ξεχωριστά)
- Sub-Phase 1 stair (νέο domain)

**Γιατί διάλεξα snap πρώτα:** completeness-over-MVP (το move/resize χωρίς snap ΔΕΝ είναι Revit-grade — δεν «κουμπώνει» σε υπάρχουσα γεωμετρία)· είναι **αυτοτελές** και **low-risk** (αγγίζει μόνο `bim-3d/gizmo` + κάνει **reuse** του υπάρχοντος snap SSoT· **μηδέν** store widening, μηδέν άγγιγμα σε `bim/walls|beams|slabs|columns`). Το multi-select απαιτεί store widening (επικίνδυνο cross-cutting) και αξίζει δικιά του φάση.

---

## 2. ΤΙ ΘΑ ΦΤΙΑΞΕΙΣ (εύρος αυτής της φάσης)

**Στόχος:** όταν σέρνεις το gizmo στο 3Δ (move), το στοιχείο **«κουμπώνει»** σε χαρακτηριστικά σημεία της 2Δ κάτοψης (endpoint / intersection / midpoint / grid), όπως ακριβώς το 2Δ drag. Ο μηχανισμός γίνεται reuse του ΕΝΟΣ snap engine (SSoT) — **ΟΧΙ νέα snap λογική**.

**Φάση Α (πυρήνας — υλοποίησέ το πρώτο):** snap στο **move** (free/plane/axis).
**Φάση Β (stretch, ίδια συνεδρία αν προλάβεις):** snap-to-edge κατά το **resize** (η νέα παρειά «κουμπώνει» σε κοντινή ακμή).

⚠️ **ΣΕΒΑΣΟΥ το OSNAP toggle:** αν το snap είναι σβηστό (`getGlobalSnapEngine().core.isEnabled()` ή το αντίστοιχο settings flag — δες πώς το ελέγχει το 2Δ), **κανένα snap**. Ο handler περνά `null` snap-fn στον bridge.

---

## 3. ΚΡΙΣΙΜΗ ΓΝΩΣΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗΣ (recognition ΗΔΗ έγινε — μην το ξανακάνεις από την αρχή)

### 3 θέσεις-κλειδιά

**(α) Ο pure bridge — εδώ μπαίνει η snap math:**
`src/subapps/dxf-viewer/bim-3d/gizmo/bim-gizmo-drag-bridge.ts` (`BimGizmoDragBridge`)
- `update(rayOrigin, rayDir, cameraDir)` → υπολογίζει `liveTranslation` (world delta από drag start). Γραμμές ~97-106.
- `getOutcome()` → `liveTranslation` → `worldDeltaToDxfDelta` → `{kind:'move', deltaDxf}`. Γραμμές ~109-138.
- **ΕΙΝΑΙ PURE** (no React/Zustand/scene). Για να μείνει testable, **ΜΗΝ** βάλεις μέσα `getGlobalSnapEngine()` (αυτό έχει scene/singleton deps). Αντ' αυτού **inject snap callback**:
  - Πρόσθεσε `setSnapFn(fn: ((planMm: Point2D) => Point2D | null) | null)` ή πέρνα το `snapFn` ως όρισμα στο `update()`.
  - Στο `update()` για **move** constraints: αφού βρεις το νέο `end = anchorWorld + liveTranslation`, κάνε `planMm = worldToDxfPlan(end)` → `snapped = snapFn?.(planMm)` → αν `snapped`, ρύθμισε το `liveTranslation` ώστε το `worldToDxfPlan(anchorWorld+liveTranslation) === snapped` (μετέτρεψε πίσω με `dxfPlanToWorld`). Έτσι ΚΑΙ ο gizmo follow ΚΑΙ το `getOutcome().deltaDxf` σέβονται το snap **χωρίς διπλό υπολογισμό**.
  - Tests: πέρνα fake `snapFn` (π.χ. `() => ({x:1000,y:0})`) → καθαρά, χωρίς engine.

**(β) Ο controller — εδώ καλείται το update (impure side, έχει scene):**
`src/subapps/dxf-viewer/bim-3d/gizmo/bim-gizmo-controller.ts`
- `updateDrag()` καλεί `this.bridge.update(...)` (γραμμή ~70) και κάνει `overlay.updatePosition(startAnchor + liveTranslation)` για move (γραμμές ~74-76). **Αν περάσεις snap-adjusted liveTranslation, ο gizmo follow ΚΟΥΜΠΩΝΕΙ αυτόματα — δωρεάν.**
- Ο controller παίρνει το `snapFn` από το hook (επόμενο).

**(γ) Το hook/handler — εδώ γίνεται το wiring με τον snap engine SSoT:**
`use-bim3d-edit-interaction` + handlers (ψάξε `bim3d-edit-interaction-handlers.ts` + το hook που στήνει controller/overlay — grep `new BimGizmoController` ή `setActiveHandles`).
- Εδώ έχεις scene access → `getGlobalSnapEngine()`. Φτιάξε τον `snapFn`:
  ```ts
  const engine = getGlobalSnapEngine();
  const snapFn = (planMm: Point2D): Point2D | null => {
    if (!engine /*+ enabled check*/) return null;
    const r = engine.findSnapPoint(planMm, /* excludeEntityId? */ selectedId);
    return r.found && r.snapPoint ? r.snapPoint.point : r.snappedPoint ? r.snappedPoint : null;
  };
  ```
- Πέρνα το `snapFn` στον controller → bridge.

### Coordinate transforms (SSoT, ΗΔΗ υπάρχουν — μην ξαναγράψεις)
`src/subapps/dxf-viewer/bim-3d/viewport/coordinate-transforms.ts`:
- `worldToDxfPlan(v: Vector3) → {x,y}` (3Δ world → 2Δ κάτοψη mm)
- `dxfPlanToWorld(...)` (αντίστροφο — **θα το χρειαστείς** για να γυρίσεις το snapped plan-point σε world ώστε να διορθώσεις το liveTranslation)
- `worldDeltaToDxfDelta`, `worldUpDeltaToMm` (στο `bim-3d/utils/bim3d-edit-math.ts`)

### Snap engine SSoT (ΗΔΗ υπάρχει — reuse, ΜΗΝ φτιάξεις νέο)
`src/subapps/dxf-viewer/snapping/global-snap-engine.ts` → `getGlobalSnapEngine(): ProSnapEngineV2` (module singleton).
- API: `findSnapPoint(cursorPoint: Point2D, excludeEntityId?: string): ProSnapResult`
- `ProSnapResult` (`snapping/extended-types.ts`): `{ found: boolean; snapPoint: SnapCandidate|null; snappedPoint: Point2D; activeMode; ... }`. Το `snapPoint.point` είναι το snapped Point2D· το `snappedPoint` πέφτει πίσω στο original αν δεν βρέθηκε.
- ⚠️ Το engine αρχικοποιείται από `useGlobalSnapSceneSync()` (CanvasSection lifecycle owner, ADR-040). **ΜΗΝ** καλέσεις `initialize()` — απλώς `findSnapPoint`. Επιβεβαίωσε ότι το engine έχει την τρέχουσα scene όταν είσαι σε 3Δ (πιθανώς ΝΑΙ, ίδιο document· αν ΟΧΙ → flag το, ίσως χρειάζεται το 3Δ να σπρώχνει scene στο engine).

---

## 4. ΑΝΟΙΧΤΑ DESIGN QUESTIONS — ρώτησε τον Giorgio (Phase 1, ΑΠΛΑ ελληνικά + παραδείγματα, ΕΝΑ-ΕΝΑ)

> Κανόνας επικοινωνίας (feedback): απλά ελληνικά, ΟΧΙ τεχνικοί όροι, ΥΠΟΧΡΕΩΤΙΚΑ παραδείγματα, μία ερώτηση τη φορά.

1. **Ποιο σημείο του στοιχείου «κουμπώνει»;**
   Παράδειγμα: όταν σέρνεις έναν τοίχο στο 3Δ, να κουμπώνει το **κέντρο** του τοίχου σε μια γωνία άλλου τοίχου, ή να κουμπώνει η **άκρη/γωνία** του (όπως στο AutoCAD που πιάνεις από ένα σημείο); — Επηρεάζει αν κάνουμε snap το anchor (κέντρο, εύκολο) ή χαρακτηριστικά σημεία (γωνίες, πιο σύνθετο).
   *Πρόταση Developer A:* ξεκίνα με anchor/κέντρο + grid (απλό, αμέσως χρήσιμο)· χαρακτηριστικά σημεία ως επόμενο βήμα.

2. **Resize snap τώρα ή μετά;** Παράδειγμα: όταν μεγαλώνεις το πάχος τοίχου, να «κουμπώνει» η νέα παρειά σε κοντινή γραμμή/τοίχο; — Αν ΝΑΙ τώρα = πιο πολλή δουλειά· αν μετά = μένει στο move snap.

3. **Οπτικός δείκτης snap στο 3Δ;** Στο 2Δ φαίνεται μαρκαδόρος (τετράγωνο/Χ) στο σημείο που κουμπώνει. Θες να φαίνεται κι στο 3Δ μικρός δείκτης, ή φτάνει που κουμπώνει χωρίς δείκτη; — Ο δείκτης είναι έξτρα δουλειά (3Δ marker mesh).

---

## 5. ΚΑΝΟΝΕΣ / ΟΡΙΑ (ΑΥΣΤΗΡΑ)

- **ΑΓΓΙΖΕΙΣ ΜΟΝΟ:** `bim-3d/gizmo/*` (drag-bridge, controller, ίσως νέο `bim3d-snap-bridge.ts` helper), το hook/handlers του gizmo, `bim3d-edit-math` αν χρειαστεί helper, + τα δικά τους tests + ADR-402 doc + trackers (N.15).
- **ΜΗΝ αγγίξεις:** `bim/walls|beams|slabs|columns`, `snapping/*` (μόνο **import/κλήση** του `getGlobalSnapEngine`), `coordinate-transforms.ts` (μόνο import).
- **ΠΟΤΕ** `git add -A` — μόνο συγκεκριμένα αρχεία.
- **ΠΟΤΕ** commit/push χωρίς ρητή εντολή Giorgio (N.(-1)).
- **Pure bridge stays pure** — snap μέσω injected callback, ΟΧΙ απευθείας engine import στον bridge (αλλιώς σπάει η testability).
- Σεβάσου το **OSNAP enabled** flag (snap off → snapFn=null).
- **N.15 trackers** μετά: ADR-402 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory `project_adr402_genarc_gizmo_port.md`.

---

## 6. DEFINITION OF DONE

- [ ] Move drag κουμπώνει σε snap points της 2Δ κάτοψης (verify με fake + πραγματικό engine)
- [ ] OSNAP off → χωρίς snap
- [ ] `getOutcome().deltaDxf` σέβεται το snap (το commit πέφτει στο snapped σημείο, όχι στο ελεύθερο)
- [ ] gizmo follow κουμπώνει μαζί (overlay.updatePosition)
- [ ] Bridge παραμένει pure + νέα tests (snap-fn injection, snapped vs un-snapped, snap-off)
- [ ] `npx jest src/subapps/dxf-viewer/bim-3d/gizmo` ΟΛΑ PASS + `npx tsc --noEmit` 0 errors
- [ ] ADR-402 doc (Status + changelog) + trackers N.15 ενημερωμένα
- [ ] 🔴 browser verify από Giorgio

---

## 7. ΠΑΓΙΔΕΣ
- Terminal noise (`AI Agents ready...`) + PowerShell `$_` αλλοίωση → χρησιμοποίησε Grep/Read/Glob tools ή απλό git/jest/tsc μέσω bash, ΟΧΙ fragile PowerShell με `$_`/`(`.
- ΜΗΝ βάζεις fragile bash στο ΙΔΙΟ parallel μπλοκ με Edits (cascade αποτυχία).
- Resize ΔΕΝ έχει live preview (single-commit-on-release)· το snap στο move ΕΧΕΙ live follow (gizmo + position). Κράτα τη διάκριση.
