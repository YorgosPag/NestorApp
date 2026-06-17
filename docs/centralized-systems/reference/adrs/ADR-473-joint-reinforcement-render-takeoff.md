# ADR-473 — Joint Reinforcement 3D Render + BOQ Takeoff

**Status:** IMPLEMENTED — UNCOMMITTED (2026-06-17)
**Extends:** ADR-459 (Structural Organism Connectivity) Phase 4c
**Related:** ADR-456, ADR-458, ADR-463, ADR-471

---

## 1. Πρόβλημα

Στους **κόμβους** δομικών μελών (πέδιλο↔κολόνα, κολόνα↔δοκάρι, κολόνα↔κολόνα ορόφου)
δεν εμφανίζονταν οπτικά οι **αναμονές / ματίσεις / αγκυρώσεις** στο 3Δ, και δεν
μετριούνταν ως διακριτά steel items στο BOQ.

Το μοντέλο συνέχειας **ΥΠΗΡΧΕ** (`reinforcement-continuity.ts`, ADR-459 Φ4c) αλλά ήταν
**ΟΡΦΑΝΟ** — καταναλωνόταν μόνο από `reinforcement-checks.ts` (validation), όχι από
3Δ converters ή schedule.

---

## 2. Απόφαση (Revit-grade)

### Αρχή: το continuity model = ΗΔΗ SSoT → το ΚΑΛΩΔΙΩΝΟΥΜΕ

Όχι νέα math. Δύο orphan consumers:

| Workstream | Υλοποίηση |
|---|---|
| **A — 3Δ render** | Scene-level post-pass (mirror ADR-458 cutback). Κάθε joint type → 3Δ mesh. |
| **B — BOQ** | `computeJointReinforcementQuantities()` — pure function, discrete rows per edge. |

### Joint types

| `ContinuityKind` | Ακμή graph | 3Δ οπτικοποίηση |
|---|---|---|
| `dowel` | `footing-bearing` | Κατακόρυφες ράβδοι στις ακριβείς θέσεις ράβδων κολόνας, lbd μέσα στο πέδιλο + l₀ στην κολόνα |
| `anchorage` (beam) | `column-bearing` | Οριζόντιες stub ράβδοι στο άκρο δοκαριού που μπαίνουν στην κολόνα |
| `anchorage` (column top) | `top-attachment` σε μη-κολόνα | Κατακόρυφες ράβδοι από κορυφή κολόνας πάνω στον host |
| `lap` | `top-attachment` κολόνα↔κολόνα | Κατακόρυφες ράβδοι ±l₀/2 γύρω από τη στάθμη ορόφου |

---

## 3. Αρχιτεκτονική

### Workstream A — `joint-rebar-3d.ts`

```
BimSceneLayer.syncFloorEntities()
  → syncJointRebar(group, entities)          [bim-scene-joint-rebar-sync.ts]
      → buildStructuralGraph(structural)      [re-derive graph]
      → computeOrganismReinforcementContinuity(graph, structural, provider)
      → buildJointRebarGroup(continuity, graph, entityById, provider)
                                              [joint-rebar-3d.ts]
          → per-item: dowelSegs / anchorageBeamSegs / lapSegs / ...
          → buildRods (InstancedMesh per Ø)  [rebar-3d-shared.ts]
```

**Φιλοσοφία:** DERIVED, ΠΟΤΕ persisted. Cross-member geometry ΕΚΤΟΣ per-entity cache.

**Gate:** `isReinforcementVisible()` — ίδιο SSoT με per-member rebar.

**Bar positions:** για dowels/laps/column-top-anchorage = ΑΚΡΙΒΕΙΣ θέσεις ράβδων κολόνας
μέσω `resolveColumnRebarLayout` (geometry-is-SSoT πάρτι με to 2Δ).

**MAX_JOINT_RODS = 8:** cap για visual clarity (HEAVY sections με 24 ράβδους δεν χρειάζονται 24 dowels).

### Workstream B — `joint-reinforcement-quantities.ts`

```typescript
computeJointReinforcementQuantities(OrganismContinuityResult)
  → JointReinforcementQuantities {
      rows: JointReinforcementRow[],  // one per graph edge
      summary: JointReinforcementSummary
    }
```

**Κάθε row:** `edgeId, kind, fromEntityId, toEntityId, count, Ø, lengthMm, totalLengthM, weightKg`.

**No double-counting:** joint items ξεχωριστά από per-member development lengths.

---

## 4. Νέα αρχεία

| Αρχείο | Ρόλος |
|---|---|
| `bim-3d/converters/joint-rebar-3d.ts` | Pure 3Δ geometry (buildJointRebarGroup + helpers) |
| `bim-3d/scene/bim-scene-joint-rebar-sync.ts` | Scene-level post-pass sync |
| `bim/structural/organism/joint-reinforcement-quantities.ts` | BOQ data (pure computation) |

**Τροποποιημένα αρχεία:**
- `bim-3d/scene/BimSceneLayer.ts` — add `syncJointRebar` call in `syncFloorEntities`

---

## 5. Reused SSoT (μηδέν νέα math)

| Ανάγκη | SSoT |
|---|---|
| Continuity model (dowel/lap/anchorage math) | `reinforcement-continuity.ts` |
| Bar positions | `column-rebar-layout-resolve.ts` → `resolveColumnRebarLayout` |
| Local→world transform | `column-geometry.ts` → `columnLocalMmToWorld` |
| 3Δ rod geometry | `rebar-3d-shared.ts` → `buildRods`, `REBAR_MATERIAL` |
| Weight per Ø | `rebar-catalog.ts` → `barMassPerMeterKg` |
| Visibility gate | `rebar-visibility.ts` → `isReinforcementVisible()` |
| Graph builder | `organism-checks.ts` → `buildStructuralGraph` |
| Code provider | `codes/index.ts` → `resolveStructuralCode` |

---

## 6. DEFER (μελλοντικές φάσεις)

- **2Δ joint rebar** (κάτοψη/τομή detail-sheet parity) — Slice 3
- **Schedule UI** για `JointReinforcementRow[]` (πίνακας στο BOQ panel)
- **Per-bar exact anchorage** (beam bottom/top rows separately, not vertical stack)
- **Cross-level** joint rebar (πέδιλο Θεμελίωσης ↔ κολόνα ισογείου — needs `floorElevationByEntityId`)
- **Tilted beam** rebar cage follow-up

---

## 7. Changelog

| Ημερομηνία | Φάση | Περιγραφή |
|---|---|---|
| 2026-06-17 | Slice 0-2 | Initial: Workstream A (3Δ render) + Workstream B (BOQ data). UNCOMMITTED. |
