# ADR-425 — Stage 0 Semantic Recognition (the shared foundation)

> **Status:** 🟢 IMPLEMENTED (pilot) — 2026-06-08 (Opus 4.8). The first real piece of the auto-design vision. Child-ADR of **ADR-423** (MEP Auto-Design) and **ADR-424** (Building Auto-Modeling); both consume this layer.
> **Scope:** the **discipline-agnostic / authoring-agnostic** recognition layer that turns a loaded DXF/scene into a *meaning model* (classified spaces + typed elements). Pilot wires the **sanitary** terminal recognizer (ύδρευση/αποχέτευση terminals) + room detection; the contract is built once for ALL disciplines and for structural auto-modeling.
> **Decision driver (Giorgio, 2026-06-08):** *«όπως οι μεγάλοι παίχτες, όπως η Revit — FULL ENTERPRISE + FULL SSOT»*. Recognition is the single non-negotiable prerequisite (ADR-423 §3): without it nothing downstream has meaning.

---

## 1. Context

ADR-423 §3 defines Stage 0 as *Semantic Recognition* — the foundation of the whole MEP pipeline — and binds it with a **hard SSOT constraint (ADR-424 §3):** it MUST be **authoring-agnostic**, because the **same** recognition layer feeds both MEP network routing (ADR-423) and structural/architectural element generation (ADR-424). Build the semantic layer once; both frameworks read it.

The building blocks already existed and were verified against the code before any line was written:
- **Region/room geometry** — the ADR-419 perimeter engine already finds every closed wall loop (`getCachedRegionPerimeters` → `ClosedPerimeter[]`, cached O(n²)) + the pure polygon math SSoT (`polygonArea`/`normalize`/`classifyPerimeter`).
- **Sanitary terminals** — ADR-408 Φ14 already made the five sanitary fixtures connectable BIM entities (`isMepFixtureEntity` + `isSanitaryKind`, pipe connectors carrying `systemClassification`).

What was missing was the **brain**: a contract that reads those primitives into a meaning model, pluggable per discipline.

---

## 2. Decision

A **single, agnostic recognition kernel** + **pluggable per-discipline recognizers**, assembled by an **SSoT registry** (the "big-player" pattern — adding a discipline is a *registration*, not an engine edit). The kernel never imports MEP or structural concrete types.

```
┌─ AGNOSTIC KERNEL (shared ADR-423 + ADR-424) ─────────────────┐
│  RecognizedSpace        room/region detection (reuse ADR-419) │
│  RecognizedElement      agnostic base of every typed finding  │
│  Recognizer<T>          plug-in contract                      │
│  recognizeScene()       orchestrator (GIVEN its recognizers)  │
│  space-binding / space-classification (pluggable rule sets)   │
│  RecognitionRegistry    SSoT wiring                           │
└───────────────────────────────────────────────────────────────┘
        ▲ consumes                         ▲ consumes
┌───────┴──────────────────┐      ┌────────┴────────────────────┐
│ ADR-423 (MEP) — ACTIVE   │      │ ADR-424 (Structural) — later │
│ RecognizedTerminal/Source│      │ wall/column recognizers      │
│ sanitary recognizer PILOT│      │ (reserved categories)        │
└──────────────────────────┘      └─────────────────────────────┘
```

**Why ADR-424 consumes it without a fork:** `RecognizedSpace` + the recognizer framework + binding + classification are pure geometry/semantics, zero MEP. ADR-424 reads the spaces (room → slab/boundary) and registers its OWN recognizers producing `RecognizedElement` subtypes (categories `structural-wall`/`structural-column`/… already **reserved** in the kernel union, mirror of the reserved disciplines in ADR-423 §2.1). The only MEP-specific code is under `recognizers/`.

---

## 3. The contract (SSoT — `systems/recognition/recognition-types.ts`)

| Type | Role |
|---|---|
| `RecognitionTier` | `'bim-entity' \| 'dxf-block' \| 'geometry'` — tiered, ONE contract (ADR-423 §8). Pilot = `bim-entity`. |
| `RecognizedElementCategory` | MEP (`mep-terminal`/`mep-source`) **active** + structural (`structural-wall`/`-column`/`-beam`/`-slab`/`opening`) **reserved**. |
| `SpaceClassification` | `bathroom\|wc\|kitchen\|utility\|living\|bedroom\|circulation\|unknown`. |
| `RecognizedSpace` | classified room: `polygon`, `holes`, `area` (m²), `centroid`, `shape`, `classification`+confidence, `containedElementIds`. Deterministic `spaceId` (geometry-hashed). |
| `RecognizedElement` | agnostic base: `elementId`, `category`, `position`, `tier`, `confidence`, `spaceId?`. |
| `Recognizer<T>` | plug-in: `recognize(ctx) → readonly T[]`. Pure. |
| `RecognitionContext` / `RecognitionInput` / `RecognitionModel` | engine I/O. |

**MEP specialization** (`recognizers/mep-recognized-types.ts` — the ONLY place MEP semantics enter):
- `RecognizedTerminal extends RecognizedElement` — `terminalKind`, `serviceClassifications` (from the host connectors), `connectorRefs` (`(entityId, connectorId, classification)` tuples, ADR-408 global identity → Stage 1 demand reads them).
- `RecognizedSource extends RecognizedElement` — `sourceKind` (`meter\|manifold\|boiler\|panel\|ahu`).

---

## 4. The pipeline (`recognizeScene`)

1. **detectSpaces** — `getCachedRegionPerimeters(entities, tol)` (reuse ADR-419) → `RecognizedSpace[]`. `tol` = `LOOP_JOIN_TOLERANCE_MM (50)` → scene units via `mmToSceneUnits`. Area scene-units²→m²; `centroid` via the new `polygonCentroid` SSoT; direct holes via nested-perimeter test.
2. **runRecognizers** — each registered recognizer emits typed elements.
3. **bindElementsToSpaces** — element → **smallest containing space** (mirror of `pickSmallestContainingPerimeter`), writes both back-refs.
4. **classifySpaces** — pluggable `SpaceClassifier` (composed by max-confidence) fills each space's room type.

All pure + deterministic (no `Date`/random) → unit-testable, stable across recomputes. The model is a **transient read-model** — recomputed from the scene like a geometry cache, **never persisted to Firestore**.

### 4.1 Sanitary pilot (Tier 1)
- `sanitaryTerminalRecognizer` — `isMepFixtureEntity` + `isSanitaryKind` → `RecognizedTerminal`, services from `getEntityConnectors`, confidence 1.
- `mepSourceRecognizer` — manifold/boiler/panel → `RecognizedSource` (pilot-light; real source auto-placement is Stage 2).
- `sanitarySpaceClassifier` — data-driven ordered rule table: bath/shower⇒bathroom (0.9), WC+basin⇒bathroom (0.7), WC⇒wc (0.8), basin/bidet⇒bathroom (0.5).

> **Honest pilot scope:** with only sanitary kinds available, classification realistically resolves to `bathroom`/`wc`. `kitchen`/`utility`/living-spaces need a kitchen-sink kind + non-MEP recognizers (ADR-424) — reserved, not yet wired.

---

## 5. Files (all ≤500 lines, functions ≤40) — `src/subapps/dxf-viewer/systems/recognition/`

| File | Role |
|---|---|
| `recognition-types.ts` | agnostic contract (types — no size limit) |
| `recognition-engine.ts` | `recognizeScene` + `recognizeSceneFromRegistry` |
| `space-detection.ts` | `ClosedPerimeter` → `RecognizedSpace` (reuse ADR-419) |
| `space-binding.ts` | element → smallest space |
| `space-classification.ts` | classifier contract + compose + apply |
| `recognition-registry.ts` | SSoT registry (`RecognitionRegistry` + singleton) |
| `recognizers/mep-recognized-types.ts` | `RecognizedTerminal`/`Source` + guards |
| `recognizers/sanitary-terminal-recognizer.ts` | pilot recognizer + sanitary classifier |
| `recognizers/mep-source-recognizer.ts` | manifold/boiler/panel source recognizer |
| `recognizers/mep-recognition.ts` | `registerMepRecognition` wiring (no import side-effects) |
| `index.ts` | public barrel |
| `__tests__/recognition.test.ts` | 16 tests (detection/recognizer/source/binding/classification/engine/registry) |

**Boy-Scout (SSoT):** added `polygonCentroid` (area-weighted) to `bim/walls/perimeter-polygon-math.ts` — the canonical centroid (distinct from the auto-area vertex-mean hole-test heuristic, deliberately left untouched to avoid touching a working perf-sensitive path).

**Reuse (zero duplication):** `getCachedRegionPerimeters`, `polygonArea`, `classifyPerimeter`, `isPointInPolygon`, `mmToSceneUnits`, `isMepFixtureEntity`, `isSanitaryKind`, `getEntityConnectors`, the source entity guards.

---

## 6. What is explicitly NOT in Stage 0
- **Demand/Loading Units** = Stage 1. **Routing/Sizing** = Stage 3/4. **Source auto-placement** = Stage 2.
- **No persistence** (transient read-model). **No UI** yet (preview arrives with the Stage 3 "suggest + batch preview" router).
- **OUTSIDE ADR-040** — no high-frequency store / canvas-leaf subscriptions touched.

---

## 7. Test coverage
16 tests / 1 suite, all green: space detection (area/shape/centroid/determinism, 1- & 2-room), sanitary recognizer (Tier-1 confidence, service classifications per kind, ignores walls), source recognizer (manifold positive + fixtures-only negative), binding (inside both-ways + outside unbound), classification (bath/shower/WC/empty rules), engine end-to-end, registry register/unregister/clear + `composeClassifiers` max-confidence.

---

## 8. Next steps
- **Water-supply pilot** (ADR-423 §6 step 3): Demand → Placement → Routing → Sizing, consuming this model.
- **Tier 2** (`dxf-block` recognizer for imported plans) + **Tier 3** (geometry/ML) — same contract, no rewrite.
- **ADR-424 element recognizers** (wall/column from DXF) register into the same registry.

---

## Changelog
- **2026-06-08 (Opus 4.8)** — ADR created + pilot IMPLEMENTED. Agnostic recognition kernel (spaces/elements/recognizer/engine/registry) + sanitary terminal recognizer + MEP source recognizer + sanitary space classifier, reusing the ADR-419 region engine and ADR-408 Φ14 connectable fixtures. `polygonCentroid` SSoT added to polygon-math (Boy-Scout). 16 tests green. Built authoring-agnostic per the binding ADR-424 §3 constraint. Outside ADR-040. No persistence (transient read-model).
