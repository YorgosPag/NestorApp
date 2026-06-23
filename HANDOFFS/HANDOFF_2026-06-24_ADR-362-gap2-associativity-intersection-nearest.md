# HANDOFF — ADR-362 Dimension System: gap #2 — associativity για `intersection` / `nearest` snap modes

**Ημερομηνία:** 2026-06-24
**Domain:** DXF Viewer — Dimensions (`src/subapps/dxf-viewer/`)
**Κύριο ADR:** `docs/centralized-systems/reference/adrs/ADR-362-enterprise-dimension-system.md`
**⚠️ Working tree:** μοιράζεται με ΑΛΛΟΝ agent → άγγιξε ΜΟΝΟ dimension-σχετικά αρχεία.
**⚠️ COMMIT:** τον κάνει ο Giorgio, ΟΧΙ ο agent. ΟΧΙ `--no-verify`. ΟΧΙ `git add -A`.

---

## 0. ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ (Giorgio)

- **Revit-grade, FULL ENTERPRISE + FULL SSOT.** Όπως οι μεγάλοι παίχτες (Revit/AutoCAD DIMASSOC=2).
- **ΠΡΙΝ κάθε κώδικα: ΠΡΑΓΜΑΤΙΚΟ SSoT audit (grep)** — ψάξε αν υπάρχει ήδη αντίστοιχος κώδικας/SSoT για να τον χρησιμοποιήσεις. ΜΗΝ φτιάξεις διπλότυπα.
- **Αν βρεις προϋπάρχοντα διπλότυπα → κεντρικοποίησέ τα κι αυτά** (ΔΙΑΤΑΓΗ Giorgio).
- code = source of truth (N.0.1) — αν το ADR διαφωνεί με τον κώδικα, διόρθωσε το ADR.
- N.17: ΕΝΑ tsc τη φορά (έλεγξε process πριν: `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*tsc*' }`).
- Απαντάς στον Giorgio στα **Ελληνικά**.
- Ο Giorgio κάνει σκληρό SSoT interrogation («κεντρικοποιημένο; διπλότυπο; θα το έκανε έτσι η Google;») — κάνε ΠΡΑΓΜΑΤΙΚΟ audit, 100% ειλικρίνεια.

---

## 1. ΤΙ ΕΓΙΝΕ ΗΔΗ (προηγούμενη συνεδρία, UNCOMMITTED — ο Giorgio κάνει commit)

**🟢 gap #1 (create tools dead) — ΕΠΙΛΥΘΗΚΕ + browser-verified.** Τα dim create tools (Ακτίνα/Διάμετρος/Μήκος Τόξου/Γραμμική) ήταν νεκρά: κανένα highlight, καμία απόκριση. Ρίζα: ΔΕΝ είχαν συνδεθεί ΠΟΤΕ στο entity hit-test SSoT (`entityPickingActive`). Fix (ADR-362 Round 19):
- `components/dxf-layout/CanvasSection.tsx` (ADR-040) — `entityPickingActive` += `isDimTool(activeTool)`.
- `hooks/drawing/drawing-hover-handler.ts` + `hooks/drawing/useDrawingHandlers.ts` — dim entity-pick διαβάζει `getHoveredEntity()` (HoverStore hit-test SSoT) με fallback `snap.entityId`. (ΣΗΜ: στο shared tree ο άλλος agent/linter το αναδίπλωσε σε `resolveDimPickContext` helper στο `drawing-handler-utils` — μην το αναιρέσεις, είναι ΟΚ/πιο SSoT.)
- ADR-362 Round 19 changelog + status header ενημερωμένα.
- 538/538 dim tests GREEN. **🔴 ΜΟΝΟ commit (ο Giorgio): stage ADR-040 + ADR-362** (CHECK 6B/6D — CanvasSection + drawing-hover-handler canvas-critical).

**ΜΗΝ ξανα-αγγίξεις τα παραπάνω.** Επίσης UNCOMMITTED από παλιότερα (ο Giorgio commitάρει): gap #3 (per-variant hit), gap #1 DIMBREAK/DIMSPACE wiring, cross-host centralization (`levelSceneManagerFor`).

---

## 2. 🎯 Η ΑΠΟΣΤΟΛΗ ΑΥΤΗΣ ΤΗΣ ΣΥΝΕΔΡΙΑΣ — gap #2: associativity για `intersection` / `nearest`

### Σύμπτωμα
Οι διαστάσεις των οποίων ένα defPoint «κούμπωσε» σε **intersection** (διασταύρωση 2 οντοτήτων) ή **nearest** (πλησιέστερο σημείο πάνω σε οντότητα) **κρατούν τη θέση τους αλλά ΔΕΝ ακολουθούν τη γεωμετρία** όταν μετακινηθεί/αλλάξει η οντότητα. Στο Revit/AutoCAD (DIMASSOC=2) ακολουθούν.

### Πού ζει σήμερα (code = source of truth — verified 2026-06-24)

**Recompute SSoT:** `systems/dimensions/dim-association-service.ts`
- `recomputeAssociatedDefPoint(assoc, entity)` (γρ. 54) — ΚΑΝΕΙ endpoint / midpoint / center· για **`intersection` ΚΑΙ `nearest` επιστρέφει `null`** (γρ. 99-102 → «position preserved»). **ΕΔΩ είναι το κενό.**
- `applyAssociationUpdates(dim, getEntity)` (γρ. 121) — διατρέχει τα `associations[]`, καλεί recompute, εφαρμόζει αλλαγές, μετράει orphans. **Αμετάβλητο** — αυτόματα θα χρησιμοποιήσει τον βελτιωμένο recompute.

**Observer (mount point — ΗΔΗ συνδεδεμένο, καμία αλλαγή):** `hooks/dimensions/useDimAssociationObserver.ts`
- Mounted μία φορά στο `DxfViewerContent.tsx`. Σε κάθε command execute/undo/redo: rebuild graph → `applyAssociationUpdates` σε όλα τα dims με associations → batch `LevelSceneManagerAdapter.updateEntities`. **Δουλεύει· απλώς ο recompute γυρνά null για τα 2 modes.**

**Inverse index:** `systems/dimensions/dim-association-graph.ts` (geometryId → dimIds). Αμετάβλητο.

**Data model:** `types/dimension.ts:263` `interface DimensionAssociation`:
```ts
{ defPointIndex: number; geometryId: string; associationType: DimensionAssociationType; subIndex?: number; }
```
**ΠΡΟΒΛΗΜΑ:** ΕΝΑΣ `geometryId` + προαιρετικό `subIndex`. ΑΝΕΠΑΡΚΕΣ για:
- **intersection** = χρειάζεται **2 οντότητες** (η τομή τους ορίζει το σημείο). Δεν υπάρχει `geometryId2`.
- **nearest** = χρειάζεται **παραμετρική αγκύρωση** (t∈[0,1] κατά μήκος γραμμής, ή γωνία σε κύκλο/τόξο) για να ξανα-προβληθεί. Δεν υπάρχει `param`.

**Capture (δημιουργία):** `hooks/dimensions/dimension-create-entity-builder.ts`
- `collectAssociations(state, entity)` (γρ. ~290+) χτίζει associations από `state.clicks[].pickedEntity`.
- `makeNearestAssociation` (γρ. 368) — διάμετρος: 2 αντιδιαμετρικά σημεία ως `nearest` subIndex 0/1 → **ΔΕΝ ακολουθούν** (recompute null).
- `makeAssociation` (γρ. 395) — generic line/ordinate pick → fallback `nearest` ΧΩΡΙΣ subIndex, **σκόπιμα placeholder** (σχόλιο γρ. 396-402: «keep geometry reference for orphan tracking but skip recompute», hotfix 2026-05-19 για να μην σναπάρει σε `line.end`).
- **`intersection` ΔΕΝ καταγράφεται ΠΟΤΕ** στο capture (κανένα `associationType: 'intersection'` δεν παράγεται). 

**ΚΡΙΣΙΜΟ — έλλειψη μεταδεδομένων:**
- `ClickRecord` (`hooks/dimensions/dimension-create-state.ts:43`) = `{ world; pickedEntity? }` — **ΔΕΝ καταγράφει snap mode**. Άρα στο capture ΔΕΝ ξέρουμε αν το κλικ ήταν 'intersection' ή 'nearest' snap.
- `SnapCandidate` (`snapping/extended-types.ts:58`) έχει **ΕΝΑΝ** `entityId` — **ΔΕΝ φέρει τη 2η οντότητα** της τομής. Ο intersection snap engine τις ξέρει εσωτερικά αλλά δεν τις εκθέτει. (`activeMode` ΥΠΑΡΧΕΙ στο `ProSnapResult` → μπορούμε να μάθουμε ΟΤΙ ήταν intersection, όχι ΠΟΙΕΣ 2 οντότητες.)

### SSoT ΓΙΑ REUSE (μη φτιάξεις διπλότυπα — verified να υπάρχουν)
- **Line-line τομή:** `intersectLines(...)` → `systems/dimensions/builders/shared-geometry-helpers.ts:55`. (Reuse για intersection re-projection.)
- **Projection + παράμετρος σε γραμμή:** `getNearestPointOnLine(point, a, b, clampToSegment)` (χρησιμ. στο `dim-hit-geometry.ts:182`). (Reuse για nearest σε line + υπολογισμό t.)
- **Segment crossing params:** `findIntersectionTs(seg, crossings)` + `pointAtT(seg, t)` → `dim-break-engine.ts:243/...`. (Reuse αν χρειαστεί t-based.)
- **Κύκλος/τόξο γωνία:** `pointOnCircle` / `calculateAngle` (υπάρχουν, χρησιμ. στο column-polar· grep για ακριβές path). (Reuse για nearest/diameter σε circle/arc → γωνιακή παράμετρος.)
- **Observer/graph/apply:** ΗΔΗ έτοιμα — μην τα ξαναγράψεις.

---

## 3. ΠΡΟΤΕΙΝΟΜΕΝΟ ΠΛΑΝΟ (Revit-grade — επιβεβαίωσέ το με SSoT audit ΠΡΙΝ κώδικα)

### Φ1 — Data model (`types/dimension.ts`)
Επέκτεινε `DimensionAssociation` **additively** (back-compat — υπάρχοντα dims δεν σπάνε):
- `param?: number` — για `nearest`: t∈[0,1] σε line/polyline edge, ή γωνία(rad) σε circle/arc.
- `geometryId2?: string` + `subIndex2?: number` — για `intersection`: η 2η οντότητα (+ sub-element της).
(Πιθανώς προτίμησε διακριτά optional πεδία αντί union για ευκολία serialization/Firestore.)

### Φ2 — Capture (`dimension-create-entity-builder.ts` + `dimension-create-state.ts`)
- Πρόσθεσε **snap mode** στο `ClickRecord` (π.χ. `snapMode?: ExtendedSnapType`) — γέμισέ το από το `findSnapPoint().activeMode` τη στιγμή του κλικ (δες πώς ρέει το snap result στο `useDrawingHandlers` onDrawingPoint / `dim-skip-snap`). Χωρίς αυτό δεν ξεχωρίζεις intersection/nearest.
- **nearest:** στο capture υπολόγισε `param` (project clicked world στην οντότητα via `getNearestPointOnLine` για line, ή γωνία via `calculateAngle` για circle/arc). Η διάμετρος (subIndex 0/1) → γωνίες 0 / π. Αντικατέστησε το placeholder `makeAssociation`/`makeNearestAssociation` ώστε να γράφει `param`.
- **intersection:** όταn `snapMode === INTERSECTION`, βρες τις **2 οντότητες** που διασταυρώνονται στο clicked point. Δύο επιλογές (διάλεξε & δικαιολόγησε):
  - **Επιλογή Α (self-contained, ΠΡΟΤΙΜΩΜΕΝΗ):** re-detect στο commit — scan scene entities κοντά στο σημείο, βρες τις 2 που περνούν από εκεί (reuse `intersectLines`/`findIntersectionTs`). ΜΗΔΕΝ αλλαγή στο shared snap system.
  - **Επιλογή Β (exact, αλλά broad):** εκθέτεις τις 2 οντότητες στο `SnapCandidate` (αλλάζει shared snapping — μεγαλύτερο blast radius). 

### Φ3 — Recompute (`dim-association-service.ts`)
Αντικατέστησε τα `return null` (γρ. 99-102):
- **`nearest`:** αξιολόγησε το σημείο στο `assoc.param` πάνω στην ΤΡΕΧΟΥΣΑ γεωμετρία (line: lerp start→end κατά t· circle/arc: `pointOnCircle(center, r, angle)`). Reuse SSoT.
- **`intersection`:** υπολόγισε την τομή `getEntity(geometryId)` × `getEntity(geometryId2)` via `intersectLines` (ή κατάλληλο line-circle/circle-circle αν χρειαστεί). Αν δεν τέμνονται πλέον → επέστρεψε null (preserve + ίσως orphan-style ένδειξη).
ΠΡΟΣΟΧΗ: μη σπάσεις το 2026-05-19 hotfix (nearest ΧΩΡΙΣ param πρέπει να μένει preserve — δηλ. αν `param === undefined` → null).

### Φ4 — Tests
- Επέκτεινε `systems/dimensions/__tests__/dim-association-service.test.ts`: nearest follow (line move → t-point ακολουθεί· circle move → γωνία ακολουθεί), intersection follow (μετακίνηση καθεμίας οντότητας → νέα τομή), no-intersection → preserve, back-compat (παλιό nearest χωρίς param → preserve).
- Capture tests στο `dimension-create-entity-builder*.test.ts` (param/geometryId2 γράφονται σωστά).

### Φ5 — ADR-362 changelog (N.0.1 Phase 3)
Νέο Round («gap (2) closed»), ενημέρωσε status header (γρ. 5: το gap (2) από «deferred» → «closed»).

---

## 4. ΠΡΩΤΑ ΒΗΜΑΤΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. **SSoT audit (grep)**: επιβεβαίωσε ότι υπάρχουν & βρες ακριβή paths/signatures: `intersectLines`, `getNearestPointOnLine`, `pointOnCircle`, `calculateAngle`, `findIntersectionTs`/`pointAtT`. Έλεγξε αν υπάρχει ΗΔΗ γενικός intersection resolver αλλού (π.χ. `utils/geometry/GeometryUtils`, snapping intersection engine) πριν φτιάξεις νέο — **reuse, όχι παράλληλο**.
2. Διάβασε πώς ρέει το `activeMode`/snap result στο `useDrawingHandlers.onDrawingPoint` ώστε να καταγράψεις snap mode στο `ClickRecord` (ίσως μέσω `resolveDimPickContext` στο `drawing-handler-utils`).
3. Υλοποίησε Φ1→Φ3, γράψε tests (Φ4), τρέξε `npx jest src/subapps/dxf-viewer/systems/dimensions src/subapps/dxf-viewer/hooks/dimensions` (ΕΝΑ tsc τη φορά, N.17).
4. **ΟΧΙ commit** — άσε τον Giorgio. Ανέφερε αρχεία για staging.

---

## 5. ΑΡΧΕΙΑ-ΚΛΕΙΔΙΑ (quick map)
| Ρόλος | Αρχείο |
|---|---|
| Recompute SSoT (ΕΔΩ το κενό) | `systems/dimensions/dim-association-service.ts` |
| Data model | `types/dimension.ts:263` (`DimensionAssociation`) |
| Capture | `hooks/dimensions/dimension-create-entity-builder.ts` (`collectAssociations`, `make*Association`) |
| ClickRecord (+snap mode) | `hooks/dimensions/dimension-create-state.ts:43` |
| Observer (mounted, no change) | `hooks/dimensions/useDimAssociationObserver.ts` |
| Inverse graph (no change) | `systems/dimensions/dim-association-graph.ts` |
| Reassociate command | `core/commands/entity-commands/DimReassociateCommand.ts` |
| Line τομή SSoT | `systems/dimensions/builders/shared-geometry-helpers.ts:55` (`intersectLines`) |
| Projection/param SSoT | `dim-hit-geometry.ts:182` (`getNearestPointOnLine`) |
| Snap result type | `snapping/extended-types.ts:58` (`SnapCandidate` — μόνο 1 entityId) |
| ADR | `docs/centralized-systems/reference/adrs/ADR-362-enterprise-dimension-system.md` |

---

## 6. DEFINITION OF DONE
- nearest dims (διάμετρος + generic line/ordinate picks) ακολουθούν τη γεωμετρία σε move/edit.
- intersection dims ακολουθούν τη νέα τομή· αν χαθεί η τομή → preserve/orphan ένδειξη.
- Back-compat: παλιά dims χωρίς `param`/`geometryId2` δεν σπάνε (preserve).
- Όλα reuse υπαρχόντων SSoT (μηδέν διπλό intersection/projection math).
- dim test suite GREEN + νέα tests. ADR-362 Round + status header ενημερωμένα.
- 🔴 browser-verify (Giorgio): φτιάξε dim σε intersection/nearest → μετακίνησε την οντότητα → η διάσταση ακολουθεί. Commit από Giorgio (stage ADR-362, + ADR-040 αν αγγίξεις canvas-critical).
