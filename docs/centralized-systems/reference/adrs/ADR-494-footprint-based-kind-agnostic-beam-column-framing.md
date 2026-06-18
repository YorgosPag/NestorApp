# ADR-494 — Footprint-based, kind-agnostic αναγνώριση στήριξης δοκαριού → κολώνας

**Status:** ✅ APPROVED · **Ημ/νία:** 2026-06-18 · **Συνεισφέρει στο:** ADR-487 (Living Structural Organism vision), ADR-486 (Topology-aware beam support)

---

## 1. Πρόβλημα (στιγμιότυπο-απόδειξη)

2 κολόνες 40×40 με πέδιλα, ενωμένες στην κορυφή με ένα δοκάρι (`w=250 d=700`) πλαισιωμένο
στις **εσωτερικές παρειές** (clear span, πλήρως μελετημένος οργανισμός — οπλισμός/τάσεις/
διατομές). Ο χρήστης **άλλαξε τον τύπο της αριστερής κολόνας** `rectangular → L-shape`.

**Σύμπτωμα:** το διάγραμμα ροπών «κρέμεται» σαν **πρόβολος** (~0 kNm στην L-κολόνα,
μεγάλες τιμές προς τη δεξιά ορθογωνική). Δηλαδή το δοκάρι θεωρείται ότι στηρίζεται **ΜΟΝΟ
στη δεξιά κολόνα** — η L-κολόνα **δεν αναγνωρίζεται πλέον ως στήριξη**.

## 2. Root cause

Η αλυσίδα στήριξης (`buildStructuralGraph` → `findColumnsFramedByBeamForGraph` →
`beamFramesColumn` → `column-bearing` ακμή → `beamSupportColumnIds` → `derive-beam-support`
`count===1 → 'cantilever'`) βασιζόταν στο **insertion point `params.position`** της κολόνας,
ΟΧΙ στο πραγματικό **footprint**:

- `beamFramesColumn` → `projectColumnCenterOnAxis(column, …)` → `perp` = κάθετη απόσταση του
  **`position`** από τον άξονα του δοκαριού.
- Για **ασύμμετρη** διατομή (L/T/U/I/τοιχείο) το `position` δεν είναι το κεντροειδές/σημείο
  επαφής. Στην L το `d` μεγάλωσε `400→517` ασύμμετρα → το `position` μετατοπίστηκε κάθετα
  στον άξονα > `halfWidth + tol` (130mm) → `return false` → **χάθηκε η στήριξη → πρόβολος**.

Το **ίδιο** position-based κριτήριο είχε και ο ADR-492 `reframeBeamEndpointsToColumns`
(perp ≤ halfWidth+collinearTol με `projectColumnCenterOnAxis`) → ίδια ρίζα, ίδιο fix.

> Ο proactive κύκλος (ADR-488/491) **ήδη τρέχει** σε κάθε `bim:column-params-updated` (αλλαγή
> τύπου ∈ `ORGANISM_EVENTS` ∩ `AUTO_DESIGN_EVENTS`). Δεν έλειπε re-trigger — έτρεχε πάνω σε
> **λάθος στατικό σύστημα** (πρόβολος αντί αμφιέρειστο) λόγω του geometry bug. Διορθώνοντας τη
> γεωμετρία, ο οργανισμός **ξαναστήνεται μόνος του** (ADR-487 full automation).

## 3. Απόφαση (Revit-canonical)

Η αναγνώριση «δοκάρι στηρίζεται σε κολόνα» γίνεται **kind-agnostic, footprint-based**: το
πραγματικό `geometry.footprint` (το ίδιο περίγραμμα που σκαλίζει `computeColumnGeometry` ανά
kind) (α) **τέμνει ή απέχει ≤ halfWidth+tol** από την ευθεία του άξονα, ΚΑΙ (β) η **διαμήκης
έκταση** του επικαλύπτει το span. Δουλεύει για κάθε διατομή: rectangular/circular/L/T/U/I/
τοιχείο/polygon/composite.

### SSoT — δύο επίπεδα (pure primitive + entity wrapper)

**(α) `projectPolygonOnAxis` (NEW pure primitive)** — `bim/geometry/shared/polygon-utils.ts`,
δίπλα στο `projectPointOnAxis` (ADR-493):

```ts
projectPolygonOnAxis(vertices, ax, ay, ux, uy): { alongMin, alongMax, perpMin, perpMax }
```

Η ΜΙΑ πηγή αλήθειας για κάθε «πολύγωνο εναντίον άξονα»: διαμήκης έκταση + **προσημασμένη**
κάθετη έκταση (πρόσημα εκατέρωθεν `perpMin<0<perpMax` ⇒ το πολύγωνο **τέμνει** την ευθεία).
Reuse `projectPointOnAxis` (point-level) για το `along` — μηδέν διπλότυπη projection math.

**(β) `projectColumnFootprintOnAxis` (entity wrapper)** — `bim/columns/column-face-trim.ts`:

```ts
projectColumnFootprintOnAxis(column, ax, ay, ux, uy): { alongMin, alongMax, perp }
```

Thin wrapper πάνω στο (α): ξετυλίγει το `geometry.footprint` + προσθέτει ΜΟΝΟ τη
framing-semantic (straddle → `perp=0`· αλλιώς ελάχιστη απόλυτη κάθετη). Degenerate footprint →
fallback στο `position`.

**Κεντρικοποίηση των ήδη-υπαρχόντων hand-rolled loops (N.0.2 boy-scout):** οι helpers του
ADR-493 cutback `outlineHalfWidth` (= `max|perp|`) και `framingInwardExtent` (near-face =
`alongMin`) έκαναν τον **ίδιο** per-vertex υπολογισμό footprint↔άξονα χειροκίνητα → τώρα
**delegate** στο `projectPolygonOnAxis`. Μηδέν conceptual duplicate.

### Consumers (κοινό SSoT — N.0.2 boy-scout)

| Consumer | Πριν | Μετά |
|---|---|---|
| `beamFramesColumn` (attach-coordinator) | `projectColumnCenterOnAxis` perp + center-along span-clamp | `perp ≤ halfWidth+tol` **&&** `[alongMin,alongMax]` ∩ `[−tol, L+tol]` |
| `reframeBeamEndpointsToColumns` (ADR-492) | center-perp gate | **footprint** perp gate (το `proj`/`columnSupportAlong` face-math μένει — `proj + columnSupportAlong = alongMax`, ήδη position-independent) |

Καμία αλλαγή στους downstream καταναλωτές (`derive-beam-support`, `load-path-walk`,
`buildStructuralGraph`) — διορθώνονται **αυτόματα** μόλις ο graph ξαναβλέπει τη στήριξη.

## 4. Τι ΔΕΝ αλλάζει (scope guard)

- **Καμία reactive re-emit** (μάθημα ADR-492 FREEZE): μηδέν νέο effect — διορθώθηκε μόνο pure
  geometry που ο ήδη-υπάρχων command-time/microtask κύκλος καταναλώνει.
- **Δεν προστέθηκε** trigger «reframe σε αλλαγή τύπου κολόνας» (παραμένει ADR-492 §DEFER για
  column resize/kind — συντονισμός με τον ADR-492 set). Το διάγραμμα ροπών διορθώνεται από τον
  **graph** (footprint detection), δεν χρειάζεται persisted reframe.
- `columnSupportAlong` + `projectColumnCenterOnAxis` παραμένουν live (placement trim /
  per-end nearest assignment) — μηδέν orphan.

## 5. Αρχεία

- **MOD** `bim/geometry/shared/polygon-utils.ts` — NEW pure SSoT `projectPolygonOnAxis` + `PolygonAxisProjection`.
- **MOD** `bim/columns/column-face-trim.ts` — NEW `projectColumnFootprintOnAxis` (delegate στο `projectPolygonOnAxis`).
- **MOD** `bim/columns/column-structural-attach-coordinator.ts` — `beamFramesColumn` footprint-based (import swap).
- **MOD** `bim/beams/beam-column-reframe.ts` — footprint perp-gate (ADR-492 set).
- **MOD** `bim/geometry/beam-column-cutback.ts` — `outlineHalfWidth` + `framingInwardExtent` delegate στο `projectPolygonOnAxis` (de-dup, ADR-493 set).
- **MOD** `bim/geometry/shared/__tests__/polygon-utils-projection.test.ts` — `projectPolygonOnAxis` unit tests.
- **MOD** `bim/columns/__tests__/column-structural-attach-coordinator.test.ts` — L/T/τοιχείο/circular/graph fixtures.
- **MOD** `bim/beams/__tests__/beam-column-reframe.test.ts` — L-shape reframe.

## 6. Edge cases (καλυμμένα από tests)

- L-shape με offset position (η αρχική περίπτωση) → αναγνωρίζεται ως στήριξη.
- Γνήσιος πρόβολος (1 framing κολόνα) → παραμένει `cantilever`.
- Τοιχείο που ο άξονας **τέμνει** → στήριξη· τοιχείο **μακριά** (δεν τέμνει) → ΟΧΙ.
- Κυκλική (footprint = πολύγωνο προσέγγισης) που εφάπτεται → στήριξη.

## 7. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-06-18 | Αρχική υλοποίηση. NEW SSoT `projectColumnFootprintOnAxis` (footprint-based, reuse `projectPointOnAxis`). `beamFramesColumn` + `reframeBeamEndpointsToColumns` → kind-agnostic. Λύνει cantilever-on-type-change (L/T/U/I/τοιχείο/polygon). 9 νέα jest (51+20 GREEN, μηδέν regression). UNCOMMITTED. |
