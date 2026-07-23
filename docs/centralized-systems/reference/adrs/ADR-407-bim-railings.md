# ADR-407 — Κάγκελα / Κιγκλιδώματα (Railings) ως πλήρες BIM στοιχείο

| Field | Value |
|---|---|
| Status | 🟢 **Φ1 + Φ7 + Φ8 DONE (uncommitted)** — Φ1 standalone path-based `RailingEntity` end-to-end (types+Zod, enterprise-id, 2-click 2Δ tool + renderer, persist+audit, units-safe 3Δ converter, discipline visibility, ΑΤΟΕ BOQ). **Φ7:** η σκάλα γεννά **αυτόματα** persisted hosted κάγκελο (posts+balusters+rail, σλοπαρισμένα + Baluster Per Tread) μέσω derived-cascade lifecycle (mirror ADR-632). **Φ8:** per-material/per-component βαφή (χρώμα/υλικό/υφή). Φ3–Φ6 (slab-edge hosting/handrail-separation/infill/Type-UI) εκκρεμούν· retire γυμνού stair tube = επόμενο υπο-βήμα. **Φ7b:** SSoT «balusters από `resolvedPath`» (bake μόνο scalar `treadCount`, όχι anchor positions) → η κουπαστή δεν μπορεί ν' αποκλίνει από τα κάθετα + **self-healing** stale persisted κάγκελων σε κάθε reload (ground-truth: gap ≤4mm). (2026-07-23, Opus 4.8) |
| Date | 2026-06-02 |
| Owner | Giorgio / Claude (Opus 4.8) |
| Related | ADR-406 (point-based MEP fixture — **πρότυπο entity-pipeline end-to-end**), ADR-405 (discipline taxonomy — **discipline visibility «δωρεάν»**), ADR-401 (attach-to-structural — **πρότυπο hosting / host-follow cascade**), ADR-363 (BIM drawing mode — **πρότυπο entity pipeline**), ADR-358 (stair system — **υπάρχων χειρολισθήρας**), ADR-382 (visibility resolver — **reuse**), ADR-375/377 (object styles/lineweights), ADR-195 (audit), ADR-040 (canvas perf — micro-leaf renderer) |

---

## Context

Σήμερα το κάγκελο **δεν υπάρχει ως οντότητα**. Υπάρχει μόνο ένας **απλός χειρολισθήρας ως υπο-εξάρτημα της σκάλας** — το απλούστερο δυνατό κομμάτι ενός `IfcRailing`:

| Αρχείο | Τι κάνει σήμερα |
|---|---|
| `bim/types/stair-types.ts:165` | `StairHandrails { inner, outer (bool), height (900mm), topExtension?, bottomExtension? }` — υπο-πεδίο του `StairParams`. |
| `bim/geometry/stairs/stair-geometry-shared.ts:189` | `buildHandrailsFromParams` — γεωμετρία = `offsetPolyline(walkline, ±halfW)` → **μία πολυγραμμή/πλευρά**. SSoT, καλείται από όλα τα stair kinds. |
| `bim-3d/converters/StairToThreeConverter.ts:234` | `buildHandrailMeshes` → ανά πλευρά **ένας `TubeGeometry`** (r=25mm) στα 900mm. |
| `bim/renderers/StairRenderer.ts:302` | `drawHandrails` — 2Δ κάτοψη: λεπτή διακεκομμένη + ADA προεκτάσεις (305mm top / one-tread bottom). |

**Τι λείπει vs μεγάλοι:** κανένας στύλος (post) · κανένα μπαλούστρο (baluster) · καμία διάκριση top-rail/handrail · κανένα infill (γυαλί/πλέγμα) · μόνο σε σκάλα (όχι σε ακμή πλάκας/μπαλκονιού) · καμία ξεχωριστή BIM οντότητα/Type · καμία ενσωμάτωση κανονισμών (ύψος/κενό). **Καλή βάση γεωμετρίας διαδρομής, αλλά απέχει από πλήρες `IfcRailing`.**

Ο Giorgio ζήτησε **«όπως οι μεγάλοι» (Revit/ArchiCAD/IFC)** — βλ. memory `feedback_industry_standard_default`, `feedback_completeness_over_mvp`.

---

## Industry Framing — τι κάνουν ΠΡΑΓΜΑΤΙΚΑ οι μεγάλοι

**Είναι BIM:** ΝΑΙ. `IfcRailing` με `PredefinedType`: **HANDRAIL** (χειρολισθήρας/κουπαστή) · **GUARDRAIL** (στηθαίο ασφαλείας) · **BALUSTRADE** (κιγκλίδωμα με μπαλούστρα). Σε λεπτομερές μοντέλο το `IfcRailing` **aggregates** `IfcMember` (ράγες/posts) + `IfcPlate` (infill panels) μέσω `IfcRelAggregates`.

**Τι είναι θεμελιωδώς:** **παραμετρική συναρμολόγηση πολλών εξαρτημάτων που παράγεται κατά μήκος διαδρομής (path-based assembly)** — ΟΧΙ ένα στερεό. Δίνεις (α) διαδρομή/host + (β) Τύπο → γεννιούνται αυτόματα όλα τα μέλη.

### Revit — System Family, ο Τύπος αποσυντίθεται σε 3 ορθογώνια υπο-συστήματα

| Υπο-σύστημα | Τι ορίζει |
|---|---|
| **Rail Structure** (Non-Continuous) | Οι οριζόντιες ράγες (top + ενδιάμεσες). Καθεμία: `height, offset, profile, material`. **Πίνακας ραγών.** |
| **Baluster Placement** | Το κατακόρυφο μοτίβο: balusters (pattern/spacing/justification) + **Posts** (start/corner/end) + κανόνας **«Baluster Per Tread»** (ανά σκαλοπάτι). |
| **Top Rail / Handrail** | Συνεχή μέλη κορυφής, **ξεχωριστά sub-types** (από Revit 2013) με δικό προφίλ, **extensions/returns** (γυρίσματα ADA) + **Supports** (μπράτσα). |

### ArchiCAD / Tekla / IFC

- **ArchiCAD:** εργαλείο Railing — ιεραρχικό/associative (Railing→Segments→Posts/Rails/Panels/Balusters/Handrails), δένει σε πλάκες/σκάλες/ελεύθερα.
- **Tekla:** κυρίως μεταλλικά via custom component → posts+rails ως steel members **με συνδέσεις**.
- **IFC:** `IfcRailing` + PredefinedType (export target).

### Τα 3 αρχιτεκτονικά μαθήματα (το «γιατί» της Revit)

1. **PATH ⊥ TYPE.** Η διαδρομή (πού πάει) είναι **τελείως ανεξάρτητη** από τον Τύπο (πώς συναρμολογείται). Ο ίδιος Τύπος μπαίνει σε οποιαδήποτε διαδρομή — σκάλα, ακμή πλάκας, ελεύθερο sketch.
2. **Generation engine, ΟΧΙ stored solid.** Το κάγκελο = **καθαρή συνάρτηση** `generate(path, type, host) → geometry`. Αποθηκεύεις τη **συνταγή** (params), όχι το στερεό· η γεωμετρία είναι **derived**.
3. **Hosting → path · derived geometry → ρητό cascade.** «Place on host» → η διαδρομή προκύπτει από τον host & ακολουθεί κλίση/σκαλοπάτια αυτόματα· αλλάζει ο host → **ρητό recompute cascade** (ίδιο μοτίβο: ADR-401 attach, ADR-363 §5.4 hosted-opening, memory `feedback_derived_geometry_central_cascade`).

---

## Decision

Νέα **standalone path-based οντότητα** `RailingEntity` (`EntityType: 'railing'`), κατά το πρότυπο pipeline του ADR-406 (MEP fixture).

### Locked αποφάσεις (Giorgio 2026-06-02)

| Θέμα | Απόφαση |
|---|---|
| Οντότητα | **Standalone `RailingEntity`** (path-based). `EntityType: 'railing'`, `BimCategory: 'railing'` → discipline `architectural` (Revit: Railings ⊂ Architecture). Ο stair handrail → special-case/migrate (Φ7). |
| Scope/hosting | **Σκάλα + ακμή πλάκας/μπαλκονιού + standalone path** — με ADR-401 follow-on-host-change. |
| Components | **Πλήρες**: posts + balusters + top rail + handrail (returns/supports) + intermediate rails + infill panels (γυαλί/πλέγμα). |
| Type system | **Revit-style `RailingType`**: Rail Structure[] + Baluster Placement + Top/Handrail — reusable named types. |
| Πυρήνας | **Καθαρός generation engine** `computeRailingGeometry(params, host) → RailingGeometry` ως SSoT. Όλα τα downstream (3Δ/2Δ/BOQ) διαβάζουν **μόνο** το derived geometry. |

### Αρχιτεκτονική: ο πυρήνας είναι μία συνάρτηση

```
                       ┌─────────────────────────────────────────┐
   RailingParams ─────►│  computeRailingGeometry(params, host)    │
   (path⊥type)         │  SSoT generation engine                  │
   RailingHostContext ►│  path → posts → balusters → rails →      │
                       │  panels  (καθαρή συνάρτηση, no side fx)   │
                       └───────────────────┬─────────────────────┘
                                           ▼
                                   RailingGeometry  (derived)
                          ┌────────────────┼────────────────┐
                          ▼                ▼                ▼
                   2Δ renderer       3Δ converter        BOQ feed
                  (micro-leaf)    (instancing balusters)  (a-t-o-e)
```

---

## Data Model (interface sketches — το data model ΕΙΝΑΙ η απόφαση)

> Ενδεικτικά sketches· τελικές υπογραφές κατά την υλοποίηση. Όλες οι διαστάσεις σε **mm** (BIM convention).

```typescript
// bim/types/railing-types.ts

/** IfcRailing PredefinedType. */
export type RailingPredefinedType = 'handrail' | 'guardrail' | 'balustrade';

/** Προφίλ μέλους (ράγα/post/baluster). Round → height = diameter. */
export interface RailProfile {
  readonly shape: 'round' | 'rectangular';
  readonly widthMm: number;
  readonly heightMm: number;
}

// ── PATH ⊥ TYPE: η πηγή διαδρομής ──────────────────────────────────────
export type RailingPathSource =
  | { readonly kind: 'sketch'; readonly path: Polyline3D }                       // ελεύθερη διαδρομή
  | {
      readonly kind: 'hosted';
      readonly hostId: string;
      readonly hostType: 'stair' | 'slab-edge' | 'ramp';
      readonly side?: 'inner' | 'outer';                                          // π.χ. πλευρά σκάλας
    };

// ── RailingType: 3 ορθογώνια υπο-συστήματα (Revit) ─────────────────────

/** 1) Rail Structure — μία οριζόντια ράγα (top ή ενδιάμεση). */
export interface RailStructureRail {
  readonly id: string;
  readonly heightMm: number;          // ύψος από το datum της διαδρομής
  readonly lateralOffsetMm: number;
  readonly profile: RailProfile;
  readonly material?: string;
}

/** 2) Baluster Placement — κατακόρυφο μοτίβο + posts + per-tread. */
export interface BalusterPlacement {
  readonly pattern: {
    readonly profile: RailProfile;
    readonly spacingMm: number;        // ΜΕΓΙΣTO κενό — validated ≤100mm («κανόνας σφαίρας»)
    readonly justification: 'start' | 'center' | 'end';
    readonly material?: string;
  };
  readonly posts: {
    readonly enabled: boolean;
    readonly profile: RailProfile;
    readonly atStart: boolean;
    readonly atCorners: boolean;
    readonly atEnd: boolean;
    readonly spacingMm?: number;       // ενδιάμεσοι posts (optional)
    readonly material?: string;
  };
  readonly perTread?: { readonly count: 1 | 2 };   // stair-only (Revit "Baluster Per Tread")
}

/** 3) Top Rail / Handrail — συνεχή μέλη κορυφής (Revit sub-types). */
export interface ContinuousRail {
  readonly enabled: boolean;
  readonly profile: RailProfile;
  readonly heightMm: number;
  readonly extension: {
    readonly topMm?: number;                       // ADA 305mm (ήδη υπάρχει βάση στη σκάλα)
    readonly bottom?: 'one-tread' | number;
    readonly returnToWall?: boolean;               // γύρισμα/return στα άκρα
  };
  readonly material?: string;
}

/** Infill (γυαλί/πλέγμα/συμπαγές) → IfcPlate. */
export interface RailingInfill {
  readonly kind: 'none' | 'glass' | 'mesh' | 'solid';
  readonly thicknessMm?: number;
  readonly material?: string;
}

/** Ο πλήρης reusable named Τύπος (Revit Railing Type). */
export interface RailingType {
  readonly id: string;
  readonly name: string;
  readonly predefinedType: RailingPredefinedType;
  readonly railStructure: readonly RailStructureRail[];   // ενδιάμεσες ράγες
  readonly balusterPlacement: BalusterPlacement;
  readonly topRail: ContinuousRail;
  readonly handrail: ContinuousRail;
  readonly infill: RailingInfill;
}

// ── Instance ───────────────────────────────────────────────────────────

export interface RailingParams {
  readonly type: RailingType;                 // (ή typeId + lookup σε named-types store)
  readonly pathSource: RailingPathSource;
  readonly totalHeightMm: number;             // guardrail 1000–1100 (validated)
  readonly baseElevationMm: number;           // datum (FFL-relative, όπως stair basePoint.z)
}

/** Computed — derived ΜΟΝΟ από τον generation engine (SSoT). */
export interface RailingGeometry {
  readonly resolvedPath: Polyline3D;          // μετά host-follow (κλίση/σκαλοπάτια)
  readonly posts: readonly RailMemberSolid[];
  readonly balusters: readonly RailMemberSolid[];
  readonly rails: readonly RailSweep[];        // top + intermediate + handrail
  readonly panels: readonly RailPanel[];       // infill
}

export interface RailingEntity extends BaseEntity {
  readonly type: 'railing';
  readonly bimCategory: 'railing';             // → DISCIPLINE_BY_CATEGORY['railing'] = 'architectural'
  readonly params: RailingParams;
  readonly geometry: RailingGeometry;
}
```

**Generation engine (SSoT):**

```typescript
// bim/railings/railing-geometry.ts
export function computeRailingGeometry(
  params: RailingParams,
  host?: RailingHostContext,   // resolved path/slope από σκάλα/πλάκα
): RailingGeometry;

export function validateRailingParams(params: RailingParams): RailingValidationResult;
```

---

## Hosting & Associativity (reuse ADR-401)

- **`pathSource.kind === 'hosted'`** → ο engine ζητά `RailingHostContext` (resolved path + slope) από τον host:
  - **σκάλα:** path = `buildHandrailsFromParams` walkline offset (ήδη SSoT, `stair-geometry-shared.ts:189`) — ακολουθεί σκαλοπάτια/κλίση· `perTread` balusters ευθυγραμμίζονται στα treads.
  - **ακμή πλάκας/μπαλκονιού:** path = επιλεγμένη ακμή (pick-host tool, reuse `useWallAttachTool` pattern του ADR-401).
- **Host change → ρητό cascade:** reuse `*-structural-attach-coordinator` + `useStructuralAutoAttach` (ADR-401) ώστε αλλαγή host (μετακίνηση/edit σκάλας ή πλάκας) → recompute railing geometry. **ΠΟΤΕ «follows automatically»** — ρητό cascade σε όλα τα transform paths (memory `feedback_derived_geometry_central_cascade`).

---

## Κανονισμοί ως validated params

Ενσωματώνονται στο `validateRailingParams` + (μελλοντικά) στους `services/building-code/engines` (υπάρχει ήδη `gate-stair-checker.ts` ως πρότυπο):

| Κανόνας | Όριο | Πηγή |
|---|---|---|
| Ύψος guardrail | **1.00–1.10 m** | Eurocode / IBC / Κτιριοδομικός |
| Μέγιστο κενό μπαλούστρων | **≤ 100 mm** («κανόνας σφαίρας 10cm») | Eurocode / IBC |
| Οριζόντιο φορτίο κουπαστής | ~0.5–1.0 kN/m (informational) | Eurocode 1 |

Validation = warnings (όχι hard block) στο v1 — Revit pattern (επιτρέπει non-compliant με προειδοποίηση).

---

## Pipeline — SSoT αρχεία (πρότυπο ADR-406)

**NEW (data/geometry):**
- `bim/types/railing-types.ts` — types παραπάνω + defaults (`DEFAULT_RAILING_TYPE`).
- `bim/types/railing.schemas.ts` — Zod (strict).
- `bim/railings/railing-geometry.ts` — `computeRailingGeometry` + `validateRailingParams` (generation engine SSoT).
- `bim/railings/railing-symbol.ts` — 2Δ family symbol (κάτοψη: γραμμή διαδρομής + κουκκίδες balusters/posts).

**NEW (command/audit/persistence):**
- `core/commands/entity-commands/UpdateRailingParamsCommand.ts`
- `bim/railings/railing-audit-client.ts` — `recordRailingChange` (ADR-195).
- `bim/railings/railing-firestore-service.ts` — `setDoc` + `generateRailingId` (N.6).
- `hooks/data/useRailingPersistence.ts` + `app/RailingPersistenceHost.tsx`.
- `services/factories/railing.factory.ts` — `createRailing`.

**NEW (tool 2Δ + 3Δ):**
- `hooks/drawing/useRailingTool.ts` + `hooks/drawing/railing-completion.ts` (sketch path: κλικ-κλικ· hosted: pick-host).
- `bim/railings/add-railing-to-scene.ts` (wrapper πάνω στο `appendEntityToScene` SSoT).
- `ui/ribbon/hooks/bridge/railing-tool-bridge-store.ts`.
- `bim-3d/placement/use-bim3d-railing-placement.ts` + `RailingPlacementGhost.ts`.

**NEW (render):**
- `bim/renderers/RailingRenderer.ts` (ADR-040 micro-leaf, registered στο `EntityRendererComposite`).
- `railingToMesh()` στο `bim-3d/converters/BimToThreeConverter.ts` — **instancing** για επαναλαμβανόμενα balusters (`InstancedMesh`)· `TubeGeometry`/sweep για ράγες (reuse `StairToThreeConverter.handrailTube` pattern).

**MODIFIED (registrations / taxonomy):**
- `types/base-entity.ts` (`EntityType += 'railing'`), `bim/types/bim-base.ts` (`BimElementType`), `types/entities.ts` (`Entity` union + `isRailingEntity`).
- `config/bim-object-styles.ts` (`BimCategory += 'railing'` + arrays + `DEFAULT_OBJECT_STYLES`).
- `bim/discipline/bim-discipline.ts` (`DISCIPLINE_BY_CATEGORY['railing'] = 'architectural'`).
- `services/enterprise-id-{prefixes,class,convenience}.ts` + facade (`RAILING: 'rail'`).
- `config/firestore-collections.ts` (`FLOORPLAN_RAILINGS`).
- `config/audit-tracked-fields.ts` (`RAILING_TRACKED_FIELDS` + dispatch).
- `bim/types/ifc-entity-mixin.ts` (`IfcRailing` + PredefinedType).
- `systems/events/EventBus.ts` (`bim:place-railing-3d`, `bim:railing-{params-updated,delete-requested}`, restore union).
- `ui/toolbar/types.ts` (`ToolType`) + `systems/tools/tool-definitions.ts`.
- `hooks/canvas/*` + `hooks/tools/useSpecialTools.ts` + `components/dxf-layout/CanvasSection.tsx`.
- `bim-3d/{stores/Bim3DEntitiesStore,scene/BimSceneLayer,scene/bim3d-resync,viewport/BimViewport3D}.ts` + `hooks/data/useFloors3DAggregator.ts`.
- `bim-3d/materials/MaterialCatalog3D.ts` (`elem-railing`).
- `core/commands/entity-commands/DeleteEntityCommand.ts` (restore-eligible set).
- `bim/config/bim-to-atoe-mapping.ts` (BOQ) + `ui/ribbon/data/home-tab-draw.ts` + i18n el+en.

---

## Discipline visibility (reuse ADR-405 — μηδέν νέος κώδικας)

Ο 2Δ renderer + το 3Δ `resolveEntity` καλούν `resolveIsEntityVisible` με `category: 'railing'`· το discipline (`architectural`) προκύπτει από `DISCIPLINE_BY_CATEGORY`. Το toggle «Αρχιτεκτονικά» (ADR-405 multi-toggle) κρύβει/δείχνει το κάγκελο σε 2Δ **και** 3Δ.

---

## IFC mapping (future export)

| Στοιχείο | IFC |
|---|---|
| `RailingEntity` (predefinedType handrail/guardrail/balustrade) | `IfcRailing` + `PredefinedType` |
| ράγες / posts / balusters | `IfcMember` (aggregated) |
| infill panels | `IfcPlate` (aggregated) |
| hosting σε σκάλα/πλάκα | `IfcRelContainedInSpatialStructure` / `IfcRelAggregates` |

---

## Implementation Phases (vertical slice — πρότυπο ADR-406)

| Φάση | Περιεχόμενο | Στόχος |
|---|---|---|
| **Φ1 — Vertical slice** | Standalone **ευθεία διαδρομή** + core type (posts + balusters spacing/perTread + top rail) → **end-to-end**: types+Zod, enterprise-id, tool 2Δ+3Δ, persist+audit, 2Δ renderer, 3Δ converter (instancing), discipline visibility, BOQ. | Αποδεικνύει το pipeline (όπως MEP fixture) |
| **Φ2** | **Stair hosting** (path από walkline, perTread balusters). | Generation engine δουλεύει σε host |
| **Φ3** | **Slab/balcony-edge hosting** + ADR-401 follow-on-host-change. | Associativity |
| **Φ4** | **Top Rail / Handrail separation** + returns/extensions (ADA — βάση υπάρχει) + intermediate rails + supports. | Revit sub-types |
| **Φ5** | **Infill panels** (γυαλί/πλέγμα → IfcPlate). | Completeness |
| **Φ6** | **RailingType UI** (Rail Structure + Baluster Placement editor) + named types persistence. | Reusable types |
| **Φ7** | **Stair hosting + auto-create** (Φ2 συγχωνευμένη): η σκάλα γεννά **αυτόματα** persisted hosted `RailingEntity` ανά ενεργή πλευρά handrail (posts + balusters + rail) μέσω derived-cascade lifecycle (create/update/delete), **σλοπαρισμένα μέλη + Baluster Per Tread**. ⚠️ retire του γυμνού stair tube = επόμενο υπο-βήμα. | Ενοποίηση SSoT |
| **Φ8** | **Per-material / per-component appearance** (βαφή: χρώμα/υλικό/υφή, Revit «Paint» / Cinema 4D tag) — whole-railing `appearance` + `componentAppearance` (post/baluster/rail), click-into + drag-drop, 2Δ color. | Cinema 4D-grade υλικά |

---

## Consequences

- ✅ **Revit-grade αρχιτεκτονική:** path ⊥ type · καθαρός generation engine SSoT · `RailingType` σε 3 ορθογώνια υπο-συστήματα · derived geometry με ρητό cascade.
- ✅ **Πλήρες `IfcRailing`** ως τελικό scope (posts/balusters/rails/handrail/infill), χτισμένο με vertical-slice φασικότητα (σταθερό θεμέλιο πριν breadth — όπως ADR-406).
- ✅ **Discipline visibility «δωρεάν»** (ADR-405)· **hosting reuse** ADR-401· **2Δ family symbol** & **instancing balusters** κατά το πρότυπο ADR-406.
- ⚠️ **Deferred μετά Φ7:** καμπύλες/ελικοειδείς διαδρομές με ακριβές sweep · σύνθετα baluster patterns (multi-baluster repeat) · supports/brackets λεπτομέρεια · structural load checks (informational στο v1).
- ⚠️ Ο υπάρχων stair handrail **παραμένει ανέπαφος** μέχρι τη Φ7 (καμία regression στη σκάλα ενδιάμεσα).

---

## Changelog

- **v0.8 (2026-07-23, Opus 4.8) — 🐛 Φ7b: η κουπαστή αιωρούνταν πάνω από τα κάθετα → SSoT «balusters από resolvedPath» (self-healing).** GROUND-TRUTH ΠΡΩΤΑ (feedback Giorgio, μηδέν αλλαγή τύπου στα τυφλά): diagnostic με πραγματικό `StairGeometryService` → όλο το railing pipeline → μετρήθηκε η **πραγματική CatmullRom** κουπαστή: gap κουπαστή_κάτω − baluster_top = **≤4mm** σε straight / L-shape / U-shape. **Άρα ο τρέχων engine ΔΕΝ αιωρεί** — το float 30-40cm του screenshot ήταν **stale persisted geometry**: στο reload το geometry ξανα-υπολογίζεται (`railingDocToEntity`→`computeRailingGeometry(params)` χωρίς live host) από τα **baked `perTreadAnchors`**, τα οποία είχαν ψηθεί νωρίτερα (flat/λάθος z, πριν το slope-riding fix) → balusters χαμηλά, rail (από `resolvedPath`) σωστό → φαινομενικό float + «ανομοιόμορφα ύψη». Ο healing `materializeUpdate` δεν το έπιανε (gate `pathChanged` συγκρίνει ΜΟΝΟ `resolvedPath`). **Αρχιτεκτονικό ελάττωμα:** τα balusters είχαν **δεύτερη ανεξάρτητη πηγή z** (baked anchor positions) που αποκλίνει από το `resolvedPath` που τρέφει την κουπαστή. **Fix (SSoT, Google/Revit-grade):**
  - **Engine (`railing-geometry.ts`):** «Baluster Per Tread» δεν διαβάζει πλέον baked positions — υπολογίζει `treadCount × perTread.count` balusters δειγματοληπτώντας το `resolvedPath` **LIVE** (`sampleRailingPath`, θέση+slope z από το ΙΔΙΟ path με την κουπαστή). Οι δύο δεν μπορούν πλέον ν' αποκλίνουν → **self-healing σε ΚΑΘΕ reload** για κάθε ήδη-persisted κάγκελο. NEW helper `perTreadBalusterCount` (baked scalar `treadCount`, με legacy fallback στο `perTreadAnchors.length` — μόνο count, το z re-derive-άρεται).
  - **Snapshot (types + Zod):** hosted `RailingPathSource` + `RailingHostContext` απέκτησαν scalar **`treadCount`**· `perTreadAnchors` → **@deprecated** (κρατιέται optional για legacy hydrate, positions αγνοούνται).
  - **Host (`stair-railing-host.ts`):** `buildStairRailingHost(stair, side)` bake-άρει `treadCount = stepCount` (τέλος του baking anchor positions· έφυγαν `sampleRailingPath`/`polylineLength` imports). Coordinator: `buildHostedParams`/`materializeUpdate` κουβαλούν `treadCount`, ρίχνουν το legacy `perTreadAnchors`, και re-bake ΚΑΙ όταν `src.treadCount !== host.treadCount` (πιάνει pre-Φ7b docs → drop legacy field + self-heal).
  - **Tests:** host (treadCount, μηδέν baked anchors), engine hosted (derive-from-path count/z, **LEGACY self-heal:** stale flat anchors z=0 → z re-derived >0, **REGRESSION float-guard:** κάθε baluster_top = rail_underside ≤1mm), coordinator/plan ΠΡΑΣΙΝΑ (49/49). **jscpd 0** στα 5 αρχεία. Commit = Giorgio.
- **v0.7 (2026-07-23, Opus 4.8) — 🟢 Φ7: η σκάλα αποκτά ΑΥΤΟΜΑΤΑ πλήρες hosted κάγκελο (posts + balusters + rail), βαφόμενο.** RECOGNITION (code = SoT): το hosting υπήρχε ΜΟΝΟ ως reserved interface — `RailingPathSource {kind:'hosted'}` + `RailingHostContext` + `computeRailingGeometry(params, host)` hosted branch (`host?.resolvedPath ?? []`), κανένας producer· `BalusterPlacement.perTread` δηλωμένο, ΑΝΥΛΟΠΟΙΗΤΟ· η σκάλα έβγαζε ΜΟΝΟ γυμνό `handrailTube`. **Κρίσιμο εύρημα:** `entityToSaveInput` ΔΕΝ αποθηκεύει geometry + `railingDocToEntity` κάνει `computeRailingGeometry(params)` χωρίς host → ένα persisted hosted railing θα φόρτωνε **άδειο** (vanish-on-reload). **Design (mirror `cascadeStairwellOpenings` ADR-632 — μηδέν νέος μηχανισμός, N.0.2):**
  - **Self-hydrating snapshot:** το hosted `RailingPathSource` απέκτησε **baked** `resolvedPath` (+ `perTreadAnchors` + `slopeRatio`), sole writer = ο cascade· `computeRailingGeometry` συνθέτει `hostFromSnapshot` όταν λείπει live host → το κάγκελο ξαναφτιάχνεται σωστά στο reload (types + Zod schema).
  - **Engine (`railing-geometry.ts`):** sloped members — post/baluster base z ακολουθεί το vertex z του path· `liftPath` σηκώνει heightMm **πάνω από κάθε z** (σλοπαρισμένη κουπαστή, μηδέν αλλαγή σε sketch)· **Baluster Per Tread** — όταν ο host δίνει `perTreadAnchors` μπαίνει ένα baluster ανά anchor· NEW exported `sampleRailingPath` (SSoT along-path sampler, κοινό engine↔host).
  - **Host bridge (NEW `stair-railing-host.ts`):** `buildStairRailingHost(stair, side, perTreadCount)` — path από `stair.geometry.handrails.inner/outer` (units-safe: scene→mm για z, xy pass-through), slopeRatio, per-tread anchors· `stairRailingSides` οδηγείται από το υπάρχον `handrails.inner/outer` toggle (wall-adjacency = σταδιακά, εντολή Giorgio).
  - **Planner (NEW `stair-railing-plan.ts`):** pure diff (create/update/delete), deterministic id `generateDeterministicRailingId('stairId::side')` (NEW, N.6).
  - **Coordinator (NEW `stair-railing-coordinator.ts`):** `cascadeStairRailings` (mirror stairwell) — create=factory+addEntity, **paint-preserving** update (refresh ΜΟΝΟ pathSource+geometry, κρατά appearance/type), delete=removeEntity· deferred lifecycle emits (`drawing:entity-created` tool `'railing'` / `bim:railing-delete-requested`) → persist+BOQ+audit μέσω `useRailingPersistence`. Idempotent (path-change gate → μηδέν churn).
  - **Wiring:** `reconcileAssociativeGeometry` (host-change) + `reconcileAssociativeGeometryOnCreate` (stair create) → cascade· delete-path `findHostedStairRailings` (NEW resolver) στο `delete-entities-core`. **Boy Scout:** το `railing` έλειπε από το smart-delete SSoT (`bim-entity-lifecycle-events` + `smart-delete-bim-events`) → προστέθηκε (wire-άρει ΚΑΙ standalone railing delete→Firestore, pre-existing gap).
  - **Auto-paint (δωρεάν):** μόλις υπάρχει το `RailingEntity`, βάφεται per-component από τη Φ8 χωρίς νέο κώδικα.
  - **Tests:** 40 νέα (engine hosted/perTread/sloped/hydrate, host, plan, coordinator create/delete/paint-preserving/idempotent/perf-gate) + 8 delete-core + stairwell-trigger + railing suite ΠΡΑΣΙΝΑ. **jscpd 0 clones** (coordinator ≠ structural clone του stairwell — reuse του engine SSoT). **Διπλή κουπαστή fix (browser-verified Giorgio 2026-07-23):** `stairToMeshes` απέκτησε optional `suppressHandrail` (default false)· `BimSceneLayer.syncStairs` το θέτει `true` όταν η σκάλα έχει hosted railing στη σκηνή → ο γυμνός stair tube παραλείπεται (μηδέν διπλή κουπαστή). **Zero-regression:** legacy σκάλες χωρίς κάγκελο κρατούν τον σωλήνα· self-healing (recompute ανά sync). ⚠️ ΕΚΚΡΕΜΕΙ: check 2Δ dedup (αν διπλασιάζεται) + load-time resync legacy σκαλών. Glass-panel/no-handrail = ήδη στο type model (`infill` + optional `topRail/handrail`), render panels = Φ5.
- **v0.6 (2026-07-23, Opus 4.8) — 🟢 Φ8: per-material / per-component βαφή κιγκλιδώματος (χρώμα/υλικό/υφή).** Standalone `RailingEntity` βάφεται όπως σκάλα/solids (Revit «Paint» / Cinema 4D object+per-face tag). Two-tier (whole-railing `appearance` + per-component `componentAppearance` για post/baluster/rail) — big-player parity. **Reuse (N.0.2):** NEW κοινό `resolveAppearanceMaterial(FaceAppearance)` (extract από σκάλα· textured/color) + `resolveRailingMaterial(railing, component)` (cascade component→whole→`elem-railing`)· writers `apply-railing-appearance` (→ `UpdateRailingParamsCommand`, ΕΝΑ undo)· «click-into» per-component selection (mirror stair-sub-element) + drag-drop + 2Δ color cascade. `railing-to-three` 4× hardcoded material → `resolveRailingMaterial`· **+Phase-0 fix:** `InstancedMesh.computeBoundingSphere()` στα balusters (frustum-culling τα εξαφάνιζε σε orbit). `railing-firestore-service` += `stripUndefinedDeep` (Firestore απορρίπτει undefined· χρειάζεται για appearance clear). Tests πράσινα, jscpd 0.
- **v0.5 (2026-06-02, Opus 4.8) — 🐛 3Δ browser-verify fix: ένωση κουπαστής↔ορθοστάτη.** Giorgio feedback από 3Δ screenshot: (α) η κουπαστή τελείωνε στο **κέντρο** του ακραίου ορθοστάτη (το rail path endpoint = post centre), (β) ο κούφιος `TubeGeometry` (`closed=false`) **δεν είχε τάπες** → ανοιχτός σωλήνας. Fix εντοπισμένο στο `railing-to-three.ts` (μηδέν αλλαγή σε geometry SSoT / 2Δ / BOQ): (1) NEW `extendRailEndsToPosts` — προεκτείνει τα ελεύθερα άκρα της κουπαστής κατά **μισό βάθος ορθοστάτη** κατά τον terminal tangent, ώστε να φτάνει στην **εξωτερική παρειά** του post (Revit handrail-over-newel· gated σε `posts.atStart/atEnd`)· (2) NEW `buildTubeCap` — δίσκος `CircleGeometry(radius)` σε κάθε άκρο, normal εξωτερικά (perpendicular στον tangent) → κλείνει τον σωλήνα· (3) `buildRailTube` επιστρέφει πλέον `THREE.Group` (tube + 2 caps), όλα tagged 'rail' για picking parity. railing-mesh 5/5 PASS, tsc clean. 🔴 re-verify 3Δ.

- **v0.4 (2026-06-02, Opus 4.8) — 🐛 browser-verify fix: railing αόρατο στον 2Δ καμβά.** Root cause (RECOGNITION): το railing entity δημιουργούνταν+έμπαινε στο scene σωστά, αλλά **έλειπε η εγγραφή του από το canvas-v2 render pipeline** (η ροή παραγωγής: `SceneEntity → convertEntity → DxfEntityUnion → DxfRenderer → EntityRendererComposite → RailingRenderer`). Το railing wiráρονταν μόνο στο τελευταίο στάδιο (`EntityRendererComposite`)· στα 3 πρώτα έπεφτε στο `default` του `convertEntity` → `return null` → πετιόταν πριν φτάσει στον renderer (ίδιο μοτίβο με τα τεκμηριωμένα drop column/mep-fixture). **Fix = πιστό mirror του `mep-fixture` σε 3 αρχεία:** (1) `canvas-v2/dxf-canvas/dxf-types.ts` — `+'railing'` στο `DxfEntity.type` union + νέο `DxfRailing` interface + `DxfEntityUnion` += `DxfRailing` + import `RailingEntity`· (2) `canvas-v2/dxf-canvas/dxf-renderer-entity-model.ts` — `case 'railing'` (υποχρεωτικό· ο `exhaustiveCheck: never` το επιβάλλει)· (3) `hooks/canvas/dxf-scene-entity-converter.ts` — `case 'railing'` + import `isRailingEntity`+`RailingEntity`. Bonus: ξεκλειδώνει 2Δ hit-test/selection/grips (το `convertEntity` τροφοδοτεί BoundsCalculator+HitTestingService). tsc clean. ✅ browser re-verify: κάγκελο εμφανίζεται. **+🐛 Root cause #2 (persistence): `floorplan_railings` έδινε 0 docs — έλειπε security-rules match block (default-deny → writes σιωπηλά rejected). Fix: `firestore.rules` += `floorplan_railings` block (πιστό mirror `floorplan_mep_fixtures`, ίδιες hasAll keys) + `coverage-manifest.ts` FIRESTORE_RULES_PENDING += `'floorplan_railings'` (CHECK 3.16 ✅) + `firebase deploy --only firestore:rules` στο `pagonis-87766` (additive, χωρίς `--force`, compiled+released OK).** 🔴 re-verify persistence (draw → `ral_*` doc).
- **v0.3 (2026-06-02, Opus 4.8) — commit-prep (2 pre-commit blockers λύθηκαν, χωρίς bypass):** (1) **CHECK 3.15 Firestore index coverage** — προστέθηκαν 2 composite indexes για `floorplan_railings` στο `firestore.indexes.json` (`default`: companyId+floorplanId+projectId· `super_admin`: floorplanId+projectId, mirror των `floorplan_mep_fixtures`) **και έγινε `firebase deploy --only firestore:indexes` στο project `pagonis-87766` (additive, χωρίς `--force`).** (2) **CHECK 4 file-size (>500 LOC)** — 3 αρχεία ξεπέρασαν το όριο λόγω Φ1 wiring· extract helper (N.7.1, μηδέν αλλαγή συμπεριφοράς): `useSpecialTools.ts` 514→491 (νέο `useSpecialTools-wall-retrim.ts`)· `useDxfSceneConversion.ts` 509→196 (νέο `dxf-scene-entity-converter.ts` SSoT — κοινό από hook + `convertSceneToDxf`)· `EventBus.ts` 504→138 (νέο `drawing-event-map.ts` pure type module, με `export type` re-export για backward-compat). tsc clean (exit 0).
- **v0.2 (2026-06-02, Opus 4.8):** **Φ1 vertical slice ΥΛΟΠΟΙΗΘΗΚΕ** (pending commit, 🔴 browser verify). **Φ1.A–C** (προηγ. session): geometry SSoT `computeRailingGeometry` (straight sketch → end/corner posts + center-justified ball-rule balusters + ένα top rail) + Zod schemas + 2Δ plan symbol + full type registrations (EntityType/BimElementType/BimCategory/discipline/IfcRailing/enterprise-id `ral`/firestore `floorplan_railings`/audit) + factory + persistence service + audit client + `UpdateRailingParamsCommand` + EventBus events + `Bim3DEntitiesStore.railings`. **Φ1.D (2Δ tool+renderer+wiring):** `railing-completion.ts` (2-click builders) + `useRailingTool.ts` (FSM idle→awaitingStart→awaitingEnd, 3Δ bridge `bim:place-railing-3d`, pure `getGhostPath`) + `railing-tool-bridge-store.ts` + `RailingRenderer.ts` (ADR-040 micro-leaf: path stroke + post footprints + baluster dots, polyline hit-test) + registrations (EntityRendererComposite, ToolType, tool-definitions, useSpecialTools, CanvasSection, canvas-click-handler `bimPoint` ORTHO-aware, RailingPersistenceHost mount). **Φ1.E (3Δ):** **units-safe** `railing-to-three.ts` (stair-converter `sceneUnitsToMeters` pattern — ΟΧΙ ο latent-buggy fixture pattern· **InstancedMesh** balusters = ένα draw call + posts + `TubeGeometry` rails) + `BimSceneLayer.syncRailings` + `elem-railing` brushed-metal material. **Φ1.F (ribbon+i18n+BOQ):** home-tab-draw entry (commandKey `railing`, icon `bim-railing`=lucide Fence, shortcut RL) + i18n el+en (tools/ribbon/validation keys) + ΑΤΟΕ BOQ: `RAILING_MAPPING` (OIK-12.01 «Κιγκλίδωμα μεταλλικό», unit `m`) + `deriveAtoeQuantity` νέο `'m'`→`geometry.lengthM` branch + `BimEntityForBoq.geometry.lengthM` + `BOQItem.sourceEntityType += 'railing'` + `useRailingPersistence` upsert + combined schedule preset. **Tests:** 56/56 PASS (railing-completion 6, railing-mesh 5 incl. units-safety mm==m, bim-to-atoe railing, + Φ1.A 26). **tsc clean.** **Deferred (όπως ο MEP ανέβαλε το 2Δ ghost leaf):** 3Δ-viewport raycast placement hook (`use-bim3d-railing-placement` + ghost), property panel.
- **v0.1 (2026-06-02, Opus 4.8):** Αρχικό design ADR. RECOGNITION υπάρχοντος stair handrail (4 αρχεία, code = source of truth) + industry framing (Revit 3 υπο-συστήματα / ArchiCAD / IFC). Locked αποφάσεις: standalone path-based `RailingEntity`, full hosting (σκάλα + ακμή πλάκας), πλήρη components, Revit-style `RailingType`, καθαρός generation engine SSoT. Data-model interface sketches + 7-phase vertical-slice plan. Εκκρεμεί υλοποίηση (Φ1).
