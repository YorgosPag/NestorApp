# ADR-615: Free-standing / self-hosted opening (host-less parametric κούφωμα)

## Status
🔵 **RECOGNITION + DESIGN — 2026-07-09** — Ο μηχανικός δουλεύει πάνω σε **εισαγμένη DXF κάτοψη (σκέτες γραμμές `LineEntity`/`PolylineEntity`)** και θέλει να **τοποθετεί κάτοψη κουφώματος ΧΩΡΙΣ να υπάρχει BIM τοίχος** — ελεύθερο, self-hosted, αλλά **πλήρως παραμετρικό/επεξεργάσιμο** (smart, όχι dumb block). Επεκτείνουμε το **υπάρχον** `opening` entity· ΔΕΝ φτιάχνουμε ξεχωριστό σύστημα συμβόλων.

**Related:**
- **ADR-363 / 370 / 396 / 421 / 376** — το ώριμο `opening` subsystem (17 kinds, geometry SSoT, tags, family-types, envelope reveal).
- **ADR-611 (opening-frame-profile)** — η editable διατομή κάσας (constant cross-section)· το self-hosted άνοιγμα την κληρονομεί **αυτούσια** (params-only resolution → δουλεύει και χωρίς host).
- **ADR-600** — `createSingleClickPlacementTool` factory FSM· βάση για το placement tool του self-hosted ανοίγματος.
- **ADR-533 / wall-on-entity** — ο **αντίθετος** δρόμος (DXF→τοίχος→auto-detect κουφώματος). Απαιτεί τοίχο· γι' αυτό ο Giorgio θέλει το host-less path.

---

## Context

### Το πρόβλημα
Το `opening` είναι **σφιχτά δεμένο** με `WallEntity`:
- `OpeningParams.wallId` = **required** foreign key.
- `computeOpeningGeometry(params, hostWall: WallEntity)` διαβάζει `getWallAxisVertices(hostWall.params, hostWall.kind)`, `hostWall.params.thickness`, `hostWall.params.sceneUnits`, `hostWall.geometry?.outerEdge/innerEdge.points`.
- `opening-completion.ts`, `opening-grips.ts`, ο validator, το 3D, τα cascade coordinators (siblings / junction-refs / wall-opening-coordinator / host-patch) παίρνουν παντού `hostWall: WallEntity`.

Δεν υπάρχει σήμερα free-standing / dumb 2D opening block, ούτε host-abstraction — `WallEntity` παντού.

### Κρίσιμο εύρημα (SSoT audit, grep + full diffs)
Το geometry coupling είναι **ρηχό**: το `computeOpeningGeometry` χρειάζεται από τον host **μόνο 5 πράγματα** (άξονας σε scene-units, thickness mm, sceneUnits, real outer/inner edges — **optional**, host length). Οι πραγματικές ακμές είναι ήδη προαιρετικές: όταν λείπουν, ο κώδικας πέφτει στο **υπάρχον fallback `άξονας ± πάχος/2`** (`opening-geometry.ts` §70-83). Ο validator κάνει ήδη early-return όταν `hostWall === null` (`validateAgainstHost`). Το persistence layer (`opening-firestore-service.ts`) **δεν** αναφέρει καθόλου `wallId`.

→ Άρα το host-less path είναι εφικτό **χωρίς re-write του geometry engine** — αρκεί να αφαιρέσουμε την εξάρτηση από τον **συγκεκριμένο τύπο** `WallEntity`.

### Big-player convergence
- **ArchiCAD «Objects» / Vectorworks «parametric symbols»** — παραμετρικά αντικείμενα (πόρτα/παράθυρο) ανεξάρτητα από τοίχο, πλήρως editable.
- **AutoCAD dynamic door/window blocks** — stretch/flip/array παράμετροι· **δεν** κόβουν τον τοίχο αυτόματα (ο χρήστης κάνει trim/wipeout).
- **Revit** — «Host» abstraction: ένα Family μπορεί να είναι wall-hosted **ή** face-based / free-standing, με **κοινή** παραμετρική μηχανή και έναν host provider.

Σύγκλιση: **self-hosted parametric object με κοινή μηχανή + host abstraction** = η σωστή, big-player-aligned λύση. ΟΧΙ παράλληλο dumb-block engine (θα ήταν παραβίαση SSoT).

---

## Decision

### 1. `OpeningHost` interface — SSoT host-abstraction
Ένα λεπτό interface που αποσυνδέει το geometry/grip pipeline από τον **συγκεκριμένο τύπο** `WallEntity`. Δύο providers, ΕΝΑ geometry path:

```ts
// bim/geometry/opening-host.ts (NEW)
export interface OpeningHost {
  /** Άξονας polyline σε SCENE units (ήδη κλιμακωμένο). */
  readonly axisVerticesScene: readonly Point3D[];
  /** mm — πάχος διατομής που διασχίζει το κούφωμα. */
  readonly thicknessMm: number;
  readonly sceneUnits: SceneUnits;
  /** Πραγματικές outer/inner ακμές (miter-accurate). Absent σε self-host → axis±t/2 fallback. */
  readonly outerEdgePoints?: readonly Point3D[];
  readonly innerEdgePoints?: readonly Point3D[];
  /** mm — μήκος host κατά τον άξονα (offset clamp / grip bounds). */
  readonly lengthMm: number;
  /** Host wall id, ή `null` όταν self-hosted. */
  readonly hostId: string | null;
}

export function wallAsOpeningHost(wall: WallEntity): OpeningHost; // adapter — μηδέν αλλαγή στον WallEntity
export function selfOpeningHost(params: OpeningParams): OpeningHost; // σύνθεση από self-host params
```

- `wallAsOpeningHost` = καθαρός adapter (getWallAxisVertices + thickness + edges + length).
- `selfOpeningHost` = συνθέτει **straight 2-vertex άξονα** κεντραρισμένο στο `anchor`, μήκος = `width`, `offsetFromStart = 0`, edges `undefined` (→ υπάρχον axis±t/2 fallback), thickness = `selfHost.hostThicknessMm`, `hostId = null`.

**Zero-ripple normalize (ΚΡΙΣΙΜΟ — δεν τρέχουμε tsc, N.17):** το `computeOpeningGeometry` (και τα συγγενικά `projectPointToWallOffsetMm` / `wallAxisPointAtOffsetMm`) δέχονται **union** `WallEntity | OpeningHost` και κάνουν `resolveOpeningHost(x)` στην είσοδο (`isOpeningHost(x) ? x : wallAsOpeningHost(x)`, discriminated χωρίς `any`). Έτσι **ΟΛΑ τα ~40 υπάρχοντα wall call-sites μένουν αμετάβλητα** (μηδέν seam risk χωρίς type-check)· μόνο ο νέος self-host κώδικας περνά `OpeningHost`. Η εσωτερική λογική (outline/reveal/frame/hinge/bbox) δεν αλλάζει καθόλου.

### 2. Data model — optional `wallId` + `selfHost`
```ts
export interface OpeningParams {
  readonly kind: OpeningKind;
  readonly wallId?: string;               // ⬅ WAS required. Absent ⇒ self-hosted.
  readonly selfHost?: OpeningSelfHost;     // ⬅ NEW — present ⇔ wallId absent (discriminator).
  readonly offsetFromStart: number;        // self-host: πάντα 0 (host = το ίδιο το άνοιγμα)
  readonly width: number;
  // …όλα τα υπόλοιπα ΩΣ ΕΧΟΥΝ (height/sill/frameProfile ADR-611/handing/mark/reveal…)
}

export interface OpeningSelfHost {
  readonly anchor: Point3D;         // mm world — κέντρο του ανοίγματος
  readonly rotationRad: number;     // προσανατολισμός άξονα πάνω στις DXF γραμμές
  readonly hostThicknessMm: number; // «πάχος τοίχου» που δείχνει το σύμβολο
}
```
Invariant: **ακριβώς ένα** από `wallId` / `selfHost` είναι set. Type-guard SSoT `isSelfHostedOpening(params): boolean`.

### 3. Placement tool — «Ελεύθερη τοποθέτηση κουφώματος»
Νέο mode πάνω στο **`createSingleClickPlacementTool` (ADR-600)** — ΔΕΝ αναπαράγουμε FSM. FSM: `idle → awaitingPosition → committed` (continuous). Ο προσανατολισμός (`rotationRad`) προκύπτει από **snap στην πλησιέστερη DXF γραμμή** κάτω από τον κέρσορα (reuse του υπάρχοντος snap engine)· fallback = 0 ή ribbon override. `buildParams` → `buildDefaultSelfOpeningParams(clickPoint, rotation, overrides)`· `buildEntity` → `buildSelfOpeningEntity`· `computeFootprint` → outline μέσω `selfOpeningHost`. (Αν χρειαστεί ρητή γωνία με 2ο click, γίνεται extension· default = snap-to-line, όπως τα AutoCAD dynamic blocks.)

### 4. Grips — self-host commit path
Το βαρύτερο coupling (`opening-grips.ts`: move/resize/rehost πάνω σε `hostWall.geometry.length` + `projectPointToWallOffsetMm`). Για self-hosted:
- **Move** = μετακίνηση του `selfHost.anchor` (whole-object), όχι slide-along-wall.
- **Resize width/height** = απευθείας στα `width/height` (το synthetic host μεγαλώνει μαζί), χωρίς clamp σε wall length.
- **Rotate** = `selfHost.rotationRad`.
- **Rehost** = **N/A** (δεν υπάρχει wall).

Οι grip commits διακλαδώνονται με `isSelfHostedOpening(params)`· ο wall-hosted δρόμος μένει **byte-identical**.

### 5. Cascade guards (τα 42 wall↔opening αρχεία)
`opening-siblings`, `opening-junction-refs`, `wall-opening-coordinator`, `opening-host-patch`, `wall-opening-pieces`, `envelope-opening-cuts` κ.λπ. αφορούν **μόνο** host-driven συντονισμό. Guard `if (!params.wallId) return;` (ή skip στο σημείο εισόδου) → τα self-hosted openings **παρακάμπτονται** καθαρά. Μηδέν διπλός δρόμος· απλή παράκαμψη.

### Τι ΔΕΝ γίνεται χωρίς τοίχο (honesty)
- **Αυτόματο κόψιμο/punch τοίχου** — δεν υπάρχει BIM τοίχος να κοπεί. Το σύμβολο κάθεται πάνω στις DXF γραμμές. Big-player parity (AutoCAD dynamic blocks): ο χρήστης κάνει trim.
- **Wipeout/mask** (κρύψιμο των DXF γραμμών πίσω από το άνοιγμα) → **Phase 2**, προαιρετικό.

---

## File plan (orchestrator, pipeline όπως ADR-611)

**Foundation (σειριακά):**
- NEW `bim/geometry/opening-host.ts` — `OpeningHost` interface + `wallAsOpeningHost` + `selfOpeningHost`.
- MOD `bim/types/opening-types.ts` — `wallId?`, `OpeningSelfHost`, `isSelfHostedOpening`.

**Parallel build (disjoint file sets):**
- **Geometry** — MOD `bim/geometry/opening-geometry.ts` (signature `OpeningHost`), all wall call-sites → `wallAsOpeningHost`.
- **Placement** — NEW self-opening completion + tool (`createSingleClickPlacementTool` config) + `useSpecialTools`/ribbon wiring.
- **Grips** — MOD `opening-grips.ts` + `grip-parametric-opening-commits.ts` self-host branch.
- **Validator + persistence** — MOD `opening-validator.ts` (self-host intrinsic checks), verify Firestore serializer (no `undefined`).
- **3D** — MOD `bim-3d/converters/opening-mesh.ts` self-host host synthesis.
- **UI/i18n** — ribbon command + el/en locales.

**Integrate:** cascade guards + jscpd:diff + targeted jest.

---

## Changelog
- **2026-07-09** — Created (612· next free· 611 collision stair vs opening-frame προϋπάρχει, δεν το αγγίζω). Phase 1 design: `OpeningHost` host-abstraction SSoT (dual provider wall/self), optional `wallId` + `selfHost`, placement tool πάνω σε ADR-600, self-host grip branch, cascade guards. Implementation = orchestrator pipeline.
- **2026-07-09** — Renumber **612 → 615** (612/613/614 πιάστηκαν από παράλληλους agents· 612-opening-info-tag ανέπαφο). Click-dispatch wiring στο `dispatchBimToolClick` (branch `'self-opening'`, ADR-040 co-staged).
- **2026-07-09 — §Decision 4 revision (Giorgio browser test):** το self-hosted κούφωμα μετακινείται/περιστρέφεται/αλλάζει μέγεθος ΕΛΕΥΘΕΡΑ στην κάτοψη → πρέπει να συμπεριφέρεται ως **centred box** (furniture parity), ΟΧΙ ως wall-hosted. Fix: (1) `getOpeningGrips` **ΚΡΑΤΑ** το central MOVE handle (4-way arrow) για self-hosted (drop μόνο για wall-hosted). (2) Το self-host grip-drag delegate-άρει στο **`createCentredBoxGripAdapter` (ADR-602) SSoT** μέσω `applySelfHostedBoxGripDrag` (bridge: `selfHost.anchor` mm ⇄ box `position` scene· `rotationRad` ⇄ deg· `width`=μήκος· `hostThicknessMm`=πλάτος): MOVE=free translate, ROTATION=**πραγματικό** drag-rotate (όχι flip-handing), CORNER=resize **δύο** διαστάσεων. (3) Νέο `MIN/MAX_SELF_HOST_THICKNESS_MM` (50/600) — το πάχος clamp-άρεται στο `fromBoxPatch` (Giorgio: «όχι πλάτος 1 μέτρο»). (4) `opening-facing` μένει host-agnostic toggle. Commit περνά `delta` (box SSoT = delta-based). Removed χειροποίητα `resizeSelfHostJamb`/`translateSelfHostedAnchor` (αντικαταστάθηκαν από το adapter, μηδέν duplicate). Tests: +6 self-hosted (28 opening-grips· furniture-grips 33 ανέπαφα)· jscpd clean.
