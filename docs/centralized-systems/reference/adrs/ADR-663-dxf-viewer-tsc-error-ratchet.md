# ADR-663: DXF Viewer TypeScript Error Ratchet — CHECK 3.29

## Status
✅ **ACTIVE — 2026-07-16 — BASELINE 381 errors (117 source / 264 test) over `src/subapps/dxf-viewer/tsconfig.json`** — Layer 1 (pre-commit baseline smoke) + Layer 2 (CI full type-check ratchet) live. Baseline: `.dxf-tsc-baseline.json`. Engine: `scripts/check-dxf-tsc-ratchet.js` (+ 39 Jest tests). CI: `.github/workflows/dxf-tsc-ratchet.yml`.

**Related:**
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28) — the two-layer "fast local smoke + authoritative CI full scan" pattern reused here, engine and all.
- **ADR-294** (SSoT Ratchet Enforcement) — the ratchet philosophy (violations only decrease) this check mirrors.
- **ADR-299** (Ratchet Backlog Master Roadmap) — CHECK 3.29 is a new ratchet; baseline drift >10% updates §2 there.
- **CLAUDE.md N.17** — agents must NOT run `tsc` per task. This ADR is what makes that rule safe: the type-check moves to CI instead of disappearing.

---

## Context

`tsconfig.json` at the repo root **excludes `src/subapps/dxf-viewer/**`**. The subapp carries its own `src/subapps/dxf-viewer/tsconfig.json` and needs a raised heap (`--max-old-space-size=8192`) to type-check at all.

The consequence had never been written down: **`npm run typecheck` — and therefore every automated gate in the repo — is structurally blind to the entire DXF Viewer.** Type errors there are caught by nothing. Not the pre-commit hook, not CI, not the periodic check (which runs the root project). They are visible only when someone runs the subapp's own project by hand.

Measured on 2026-07-15, that blind spot had accumulated **469 errors** (205 in source, 264 in tests) — none of which had ever failed a build.

CLAUDE.md **N.17** forbids agents from running `tsc` per task, for a good reason: a full type-check is 60-90s on Giorgio's machine and the per-change error yield is tiny, so per-task checking is pure waste. But N.17 delegates the check to "Giorgio periodically + the pre-commit hook" — and for this subapp **neither of those actually covers it**. The rule was load-bearing on a gate that did not exist.

This is the same shape as ADR-584's blind spot (CHECK 3.18 cannot see clones with different names): a rule everyone believed was enforced, enforced by nothing.

---

## Decision

Add **CHECK 3.29 — DXF Viewer TypeScript error ratchet** as a **two-layer** gate, **reusing the ADR-584 ratchet framework** (baseline-load → scan → compare → smoke/full modes → Jest suite) rather than inventing a new engine.

### Layer 1 — pre-commit smoke (`scripts/git-hooks/pre-commit`, Phase 0.7)
Runs **only** when the commit stages a file under `src/subapps/dxf-viewer/`, and asserts **only** that `.dxf-tsc-baseline.json` exists and parses. **It does NOT type-check.**

This is deliberate and is the whole reason the design works: paying 60-90s on every commit is exactly the cost N.17 exists to avoid, and a hook everyone disables is worth less than no hook. The smoke leg costs ~50ms and guards the one thing a local hook usefully can — that the baseline was not deleted or corrupted.

Escape hatch: `SKIP_DXF_TSC_SMOKE=1 git commit …` (justify to Giorgio).

### Layer 2 — CI ratchet (`.github/workflows/dxf-tsc-ratchet.yml`)
On every PR / push to `main` touching `src/**/*.ts(x)`, runs the **full** type-check over the subapp's own project and compares **per-file** error counts against `.dxf-tsc-baseline.json`. A rise **BLOCKS**. CI is the authoritative gate.

### Per-file baseline, not a global total
Unlike `.jscpd-baseline.json` (one global count), this baseline is a **per-file map**, mirroring `.i18n-violations-baseline.json`:

```json
{ "totalErrors": 381, "sourceErrors": 117, "testErrors": 264,
  "byFile": { "src/subapps/dxf-viewer/…/foo.ts": 3 } }
```

A total-only ratchet lets a **brand-new broken file** land as long as the same PR fixed more errors elsewhere. Per-file gives the house rule — *new file with violations → BLOCK, zero tolerance* — for free, and it is pinned by a test (`BLOCKS a new broken file even when the overall total dropped`).

### Tests are ratcheted too
The 264 test-file errors are tracked alongside source. Tracking them costs nothing and stops them rotting. The summary reports the **source/test split** because source errors are what §4 burns down.

### `any` is not an escape hatch
The remediation text points at fixing the types. `any` / `as any` / `@ts-ignore` remain forbidden (CLAUDE.md), and would in any case only move the error rather than remove it.

---

## Consequences

**Positive**
- The subapp's type errors are now **visible and monotonically decreasing**. The count can never silently grow again.
- **N.17 becomes safe.** Agents still never run `tsc`; the check now genuinely exists — in CI, where it costs Giorgio nothing.
- New DXF Viewer files are held to **zero type errors** from day one.

**Negative / accepted**
- CI spends ~45-90s per PR touching `src/**/*.ts`. Accepted: it is the only place the check can live without taxing every commit.
- A local `npm run dxf:tsc:check` is opt-in, so a regression is discovered at PR time rather than commit time. Accepted for the same reason.
- The baseline needs a refresh (`npm run dxf:tsc:baseline`) after each burn-down, or CI keeps nudging with the `−N vs baseline` trend line.

---

## Commands

| Command | Purpose |
|---|---|
| `npm run dxf:tsc:check` | Full type-check + per-file baseline compare (Layer 2, ~45-90s) |
| `npm run dxf:tsc:baseline` | Lock current counts after a legitimate burn-down |
| `npm run test:dxf-tsc` | The engine's own Jest suite (39 tests) |
| `node scripts/check-dxf-tsc-ratchet.js` | Smoke only (what the hook runs) |

Raw: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit -p src/subapps/dxf-viewer/tsconfig.json`

---

## §4 — Burn-down log

Source errors only (tests tracked separately, see §"Tests are ratcheted too").

| Date | Source errors | Δ | What was fixed |
|---|---|---|---|
| 2026-07-15 | 205 | — | Starting measurement (469 total incl. tests) |
| 2026-07-16 | 117 | −88 | Root-cause batches, below |
| 2026-07-16 | 84 | −33 | Long-tail batches, below (also −11 test errors, un-touched: two roots lived in shared guards) |
| 2026-07-16 | 67 | −17 | Part 3: `OpeningParams.wallId?` = ADR-615 self-hosted discriminator (one root, 13 call-sites) + the RC3/RC4 twin-writer bug |
| 2026-07-16 | 62 | −10 | Part 4a: `DialogContent size="md"` (3 files, live full-width layout bug) + `createEntityFromTool` declared with the preview union (7 errors, 3 files). Measured 71 → 62: **−10 ours, +1 concurrent foreign** (`DxfLeader`, commit `16e9f4cc`) |
| 2026-07-16 | 60 | −2 | Part 4b: ADR-544 `PlacementOverlayFields` finished — the ghost-meta field set is now declared once (2× TS2352 twins + 8 inline re-declarations removed) |
| 2026-07-16 | 53 | −7 | Part 5: `framework-agreement` Doc/Wire/client split (7× TS2741). **Part 4's "live 3-way bug" retracted** — the consumers are fed by a client-SDK subscription, not the REST route. Also: `toWysiwygPreviewEntity` options object (`as unknown as` gone), the TS2345 cluster's root (`PlacementGhostEntityBuilder` declared `object | null`), and a real import cycle that had `add-wall-to-scene` running **zero** tests |

### 2026-07-16 batches

Each was a **shared root cause**, not a per-site patch — which is why 88 errors fell out of 8 edits:

1. **`ResolvedBimScope` duplicate type (−45).** `hooks/data/bim-entity-persistence-hook-types.ts` re-declared a twin of the resolver's own `ResolvedBimPersistenceScope`, typing `floorplanId`/`floorId` as `string | null` while the resolver guarantees `floorplanId: string` and *omits* `floorId`. Every one of the ~25 `use*Persistence` hooks passes the scope straight into a `*FirestoreServiceConfig`, so all of them failed. Deleted the twin, re-exported the real type, and stopped `create-bim-entity-persistence-hook` from re-spreading the scope field-by-field (which re-introduced a `floorId: undefined` key). Same edit fixed the `Promise<XDoc>` vs `Promise<void>` adapter mismatch: the factory awaits `save`/`update`/`remove` purely for ordering and never reads the value, so the contract is now `Promise<unknown>`.
2. **ADR-615 `wallId` optionality (−13).** ADR-615 made `OpeningParams.wallId` optional (self-hosted openings) without updating the consumers that need a host wall. Added `isWallHostedOpening()` as the type-predicate counterpart to the existing `isSelfHostedOpening()` (SSoT, `bim/types/opening-types.ts`), and used it to *narrow* rather than assert in `bim-envelope-scene-builder`. `useOpeningPersistence` now guards the `bim:opening-persisted` emit — a self-hosted opening has no host wall BOQ to re-feed (the `onDeleted` path already had this guard; `onPersisted`/`onRestored` had missed it). `section-intersect.toOpeningPlan` reads `hostWall.id`, which is the truthful source — the caller has already resolved the host to get there.
3. **`ToolHandleLike.overrides` (−9).** Declared `Readonly<Record<string, unknown>>`, but every bridge's overrides is a precise *interface*, and interfaces get no implicit index signature — so none of them ever satisfied it. Typed as `object`; the single dynamic lookup in `readToolOverrideNumber` narrows the value itself.
4. **`AnyFamilyTypeParams` drift (−9, with #5).** A hand-listed union in `bim-family-type-audit-client.ts` that had fallen behind `BimTypeParamsByCategory` (missing `stair`). Now **derived** from the category map, so it cannot drift again.
5. **`create-family-type-controller` nullability.** `GetType` said `| undefined`; the store's `getType` returns `| null`. Aligned with the store, and widened `asFamilyType` to `| null | undefined` (the `as*FamilyType` helpers already accepted both). Also constrained `E extends Entity & FamilyTypedEntity<…>` — `isEntity` is a type predicate over `Entity`, so its narrowed type must actually be a scene entity.
6. **`apply-entity-preview` dead comparisons (−7).** `DxfEntityUnion` does not model `lwpolyline` / `mtext` / `group` / `block`, but this pipeline is handed the RAW scene entity, whose tag can be any of them — each already handled behind a cast. Added `rawTypeOf()` so the guards are type-legal instead of comparing against tags the union had narrowed away. **These comparisons were live behaviour, not dead code** — the file's own comments document the `mtext` case as a regression re-fix ("το κείμενο δεν ανταποκρίνεται", Giorgio 2026-06-30). Removing them would have re-broken it.
7. **`rotation-math` (−6).** `Partial<Entity>` distributes over the union, so the rectangle accumulator could not take `corner1`/`corner2`/`x`/`y`. Typed against `Partial<RectangleEntity>`.
8. **`create-bim-boq-audit-lifecycle` (−1).** Reading a property off a type parameter yields the *constraint's* type (`kind: string`), not `TEntity['kind']`, so the pruned delete snapshot no longer matched the recorder. Kept the projection (it deliberately prunes `geometry` out of the audit snapshot — pinned by `create-bim-boq-audit-lifecycle.test.ts`) and asserted the type the values already have.

**Verification:** all touched domains ran green — `hooks/data` + `bim/persistence` (188 tests), `ui/ribbon/hooks` (530), `bim-3d`/`bim/geometry`/`bim/types`/`hooks/data` (1947), `rendering/ghost` + `bim/family-types` + `utils`. Three pre-existing failures (`systems-discipline-tabs`, `dxf-linetype-compound-roundtrip`, `dxf-attrib-attdef`) were confirmed failing on a stashed tree beforehand — unrelated to these changes and still open.

### 2026-07-16 batches, part 2 (117 → 84)

The "long tail" turned out to still hold **small shared roots** — 33 source errors fell out of 9 edits. The pattern in almost every case: a **consumer re-declaring what its producer already knew**, and the re-declaration being wrong.

1. **`TextRun | TextStack` narrowing (−4, 3 files).** The union has no discriminant, so `'text' in run` was copy-pasted across the text engine — and three title-block sites had simply forgotten it, reading `run.text` off a stack. That yields `undefined`, which `Array.join` renders as `''`: a stacked fraction vanished from the glossary/preview **silently**. New SSoT `text-engine/types/text-ast.guards.ts` (`isTextRun` / `isTextStack`); the local twin in `InsertTextTokenCommand` now imports it (N.0.2). Stacks pass through the localizer unchanged — the file's own contract is that translation changes *words*, not drawing.
2. **`gripKindOf` producer/consumer seam (−3, 3 files).** `commitParametricAnnotationGripDrag` declared `kind: K | null`, but its documented sole producer `gripKindOf` returns `K | undefined` (and is the ecosystem-wide producer, ~120 files). Aligned the SSoT to the producer. Runtime was already fine (`if (!kind)` catches both) — the seam was type-only.
3. **`pushStyledGuide` producer/consumer seam (−4).** Identical shape: consumer said `Guide | null`, `addGuideRaw` / `addDiagonalGuideRaw` — its only feeders — return `Guide | undefined`.
4. **ESC never registered for wall-merge / wall-gap-opening (−4). A real bug, not type noise.** `useCanvasEscapeRegistrations` registered both tools, but its params interface never declared them, and `useCanvasKeyboardShortcuts` — which *does* declare them (`.types.ts:130-137`) and receives them from `CanvasSection` — never destructured or forwarded them. So `p.handleWallMergeEscape` was always `undefined`, and `buildModifyHandler`'s `if (!callback) return null` **dropped the handler**: pressing ESC during a wall-merge or wall-gap-opening flow cancelled nothing. Declared + destructured + forwarded, mirroring the working `stairAddTurn` wiring.
5. **`ParseResult` non-discriminating flag (−3, 2 files).** `{ valid: boolean; color?: ColorValue }` cannot narrow, so `if (parsed.valid) parsed.color` stayed possibly-undefined and callers double-checked a field the flag already promised. Now a discriminated union on `valid`.
6. **`isValidPoint` discarded the caller's fields (−2).** `point is Point2D` narrows a `{x?, y?, bulge?}` vertex down to a bare `Point2D` — so the DXF **bulge could not be read after validating the very vertex carrying it**. Now generic: `isValidPoint<T>(point: T): point is T & Point2D`. Backwards-compatible (`unknown & Point2D` = `Point2D`).
7. **`InheritedStyle.lineweightMm` widened by hand (−5, one file).** Re-declared as `number`; `LineweightMm` is the ISO plot-width literal union, copied straight off `Entity`. Every `make*` primitive failed on it. Imported the real type.
8. **`beginDistanceLabel` dropped `Required<>` (−4).** It merges over `Required<DistanceLabelOptions>` defaults, so every field *is* present — but the signature typed both the defaults and the result as the optional `DistanceLabelOptions`, re-introducing the `undefined` it had just eliminated.
9. **`interfaces.ts` split leftover (−2).** `export type { … } from './types/persistence-types'` is a **re-export**: it serves importers, but does not bring the names into the file's own scope, so its two local uses were unresolved. The same file already handles this correctly for `audit-types` (import + re-export) — followed that.

Roots 1, 5 and 6 lived in shared guards/types, so they also removed **11 test-file errors** without a single test file being touched.

**Verification:** touched domains green — text-engine + core/commands/text (701), ui/color + rendering/entities (400), guides + grips + core/commands (864), hooks/canvas (48), export (436), utils + zoom + rendering/entities/shared (762). `jscpd:diff` clean on all 15 files (N.18). Pre-existing failures unchanged and unrelated: `dxf-linetype-compound-roundtrip`, `dxf-attrib-attdef` (both listed in the previous session's handoff) and `move-entity-geometry-coverage` — the last one is **new since that handoff and is a live gap, not noise**: `floorplan-symbol` was added to `RENDERABLE_ENTITY_TYPES` without a MOVES/NO-OP classification, which is exactly what that completeness anchor exists to catch. Untouched here — it is outside this task and sits in a file Giorgio is committing to live.

**Remaining 84 source errors.** The remaining large-ish item, `procurement/services/framework-agreement-service.ts` (7), is **outside the dxf-viewer** and is one root: `firebase-admin`'s `Timestamp` vs the client `@firebase/firestore` `Timestamp` (missing `toJSON`). The rest is a genuine long tail. The ratchet holds the line while they are burned down opportunistically (Boy Scout rule, N.0.2).

### 2026-07-16 batches, part 3 (84 → 67)

**One root, 13 call-sites, and a live bug the type error was hiding.** The previous session flagged "`string | undefined` → `string` in ~10 files (~14 errors)" as *"look for a common cause FIRST — may be 1-2 roots, not 14 one-offs."* That was right, and the root is a single field: **`OpeningParams.wallId?: string`**.

The `?` is **deliberate** (ADR-615): a κούφωμα is hosted by EXACTLY ONE of `wallId` (a BIM wall) or `selfHost` (a synthetic free-standing host, for openings placed on imported DXF lines). So these were never "wrong types" — they were **13 consumers that silently ignore self-hosted openings**. The fix is not to widen or assert; it is to route every one through `isWallHostedOpening()`, the type-predicate SSoT ADR-615 already provides for exactly this ("callers that genuinely need the host wall NARROW `params.wallId` to `string` instead of asserting it").

1. **Group-by-wall (−6, 3 files).** `bim-readonly-render`, `dxf-renderer-frame-builders`, `bim-to-tek`: a self-hosted opening would land in a bucket keyed `undefined`.
2. **Set-membership / cascade (−4, 3 files).** `envelope-boq-sync`, `envelope-element-applicator`, `bim-cascade-resolver`: no host wall ⇒ no reveal contribution, no cascade.
3. **IFC (−2, 2 files).** `ifc-opening-serializer` (no host ⇒ no `IfcRelVoidsElement`), `ifc-covering-serializer` (no wall to line with a Z4 reveal).
4. **Host lookup (−3, 3 files).** `useFloorplanBimEntities`, `ifc-bim-scene-loader`, `opening-type-resolution`: all already handled "wall not found" via `?? null` — they just asked the map with an `undefined` key first. A `null` host is the **normal** state of a self-hosted opening, not an error.
5. **`EnvelopeOverlay` (−1).** `OpeningForCut.params.wallId` is required (an envelope cut is meaningless without a host); the caller passed every opening. Filtered at source.
6. **🔴 `AssignOpeningTypeCommand` — RC3/RC4 live, in the twin writer (−1 + a real bug).** ADR-615 fixed RC3 (`validate()` demanding `wallId` → every self-hosted commit silently rejected) and RC4 (no self-hosted branch → stale geometry) on **2026-07-09 — but only in `UpdateOpeningParamsCommand`.** Its twin kept a **copy-pasted `resolveHostWall()`** and carried **both bugs**: every family-type assign/clear on a self-hosted κούφωμα was dropped, and a type-driven width change left `outline/position/rotation` stale. The `wallId?` optionality made it read as type noise rather than the bug it was. **Root cause of the recurrence: the host-branch choice was copy-pasted per command, not SSoT.** Extracted `core/commands/entity-commands/opening-derived-state.ts` (`resolveOpeningHostWall` + `computeOpeningDerivedState` + `applyOpeningDerivedPatch` + `validateOpeningHostRef`); both writers now go through it, so a future opening writer cannot "forget" the self-hosted branch. See ADR-615 changelog 2026-07-16.

**Verification:** 549/550 green across entity-commands + cascade + validators, incl. a **new `AssignOpeningTypeCommand.test.ts` (6 tests)** guarding RC3′/RC4′ as regressions. `jscpd:diff` clean on all 15 files (N.18) — the extraction removed a twin rather than adding one. All 15 touched files are error-free in the final type-check.

**Count: 84 → 67 from this batch.** The full run reports **68**, because one **unrelated** error appeared concurrently in `export/core/entity-export-coverage.ts` (TS2741, `"topo-surface"` missing from an exhaustive `Record`) — the file is **unmodified in this working tree**; a `topo-surface` entity type was added elsewhere without updating the exhaustive coverage record. That is the same completeness-anchor class as `move-entity-geometry-coverage` (§4 part 2) and belongs to concurrent work — **not touched here.**

**Note on the pattern.** Two sessions running, the biggest wins came from the same shape: *a consumer re-declaring, or re-deriving, what its producer already owns.* Part 2 called it out for types; part 3 shows the harsher version — when the producer's shape encodes a **domain rule** (`wallId?` ⇒ "may be self-hosted"), a consumer ignoring it is not a type error, it is a **feature silently not working**. Grouping by TS code before fixing is what surfaces it; fixing file-by-file would have hidden it as 13 unrelated casts.

---

### 2026-07-16 batches, part 4 (71 → 60)

Start-of-session full run: **71** source errors (part 3 ended at 67 + 3 `Block*Dialog` never previously grouped + 1 foreign `entity-export-coverage`). Three roots closed, **12 errors**, and **two live bugs** — again both were *type errors that were hiding broken features*, not noise.

**Measured, reconciled:** the mid-session gate run reported **62**, not the arithmetic 61, because **one foreign error appeared concurrently**: `dxf-types.ts` gained `TS2430 Interface 'DxfLeader' incorrectly extends 'DxfEntity'` from commit `16e9f4cc` (ADR-635 Φ B leader wiring) **between** the two runs — the file is clean in this working tree, and it is the same class as the `DxfTopoSurface` error already sitting there. So: **71 − 10 (ours) + 1 (foreign) = 62** ✅. Part 4b then took it to **60**.

1. **🔴 `size="md"` on `DialogContent` — 3 files, 1 root, a live layout bug (−3).** `BlockEditDialog` / `BlockPromoteDialog` / `BlockSaveToLibraryDialog` all passed `size="md"`. The `dialogContentVariants` CVA scale (`@/components/ui/dialog`, ADR-241) has **no `md`** — the middle step is deliberately named **`default`** (`max-w-lg`), because it is the `defaultVariants` value. **This was not cosmetic.** `DialogContent`'s base class list carries `w-full` and **no `max-w-*`** — the max-width comes *only* from the size variant. Verified against the installed `class-variance-authority`: an **invalid** variant value emits `""` (and `defaultVariants` does **not** rescue it — it only applies when the prop is `undefined`). So all three Block Library dialogs were rendering **`w-full` with no max-width, stretching to the full viewport**. Fixed to `size="default"` (the repo's existing explicit precedent). **Why it shipped:** these files live under `src/subapps/dxf-viewer/**`, which the root `tsconfig.json` **excludes** — the type error was invisible to both `npm run typecheck` and the pre-commit hook. This is exactly the gap CHECK 3.29 exists to close, and the first live bug it has surfaced in the UI layer.
2. **`ExtendedSceneEntity` on the commit path — 3 files, 1 root (−7).** TS2345 «`ExtendedSceneEntity` not assignable to `Entity | null`» in `useUnifiedDrawing` (×4), `useSketchFreehandCommit` (×1), `DrawingOrchestrator` (×2). Root: **`createEntityFromTool` is a *commit* builder declared with the *preview* union.** `ExtendedSceneEntity = Extended{Line,Circle,Polyline,Arc} | PreviewPoint | PreviewText | AnySceneEntity`, and `AnySceneEntity = Entity`; the `Extended*` variants all extend real entities, so **the only non-`Entity` members are `PreviewPoint`/`PreviewText`** — the preview-only pseudo-entities that deliberately lack `BaseEntity` fields. (TS names the culprit outright: `… | PreviewText' is not assignable to parameter of type 'Entity'`.) The error therefore read: *"a preview pseudo-entity could reach `completeEntity(entity: Entity | null)` and be committed to the scene."* **No branch of the builder ever returns one** — the only `preview: true` it emits is on an `ExtendedPolylineEntity` (measure-angle), which *is* a `PolylineEntity`. The declaration simply promised pseudo-entities it never produces, and every commit consumer inherited the lie. Narrowed the producer to `Entity | null` (`drawing-entity-builders.ts`), plus the two declarations that restated it: the `useUnifiedDrawing` wrapper and the injected `CreateEntityFn` type. One redundant `as ExtendedSceneEntity` cast dropped. The **preview** boundary keeps the wide union correctly — `generatePreviewEntity` genuinely returns a `PreviewPoint` (e.g. the foundation start-marker).

**Verification:** 45 suites / 401 tests green (`hooks/drawing/__tests__`) + 19 (`sketch-freehand-store`). `jscpd:diff` clean on all 6 files (N.18).

#### Not fixed — escalated to Giorgio (needs a scope decision)

> ⚠️ **CORRECTION (part 5, 2026-07-16).** The item below calls this a **live** 3-way client bug. **It is not — the claim is withdrawn.** The analysis ground-truthed the *producer* (the Admin SDK really does serialise to `{_seconds}`) but never traced **which producer feeds the consumers**, and reasoned about the bug from the consumers' source alone. `useFrameworkAgreements` **reads via `firestoreQueryService.subscribe`** — the *client* SDK — and only **writes** through the REST routes; its own header comment says so. So the components receive **real client `Timestamp`s**, `.toDate()` / `.toMillis()` / `.seconds` all work, and nothing crashes. The `{_seconds}` shape never reaches the component tree: the GET route's `ok(items)` has **no caller at all**, and the POST/PATCH response is discarded by `page.tsx`. The 7× TS2741 are real, but they are a **latent server-side type lie**, inert only by luck. See part 5 for what was actually true and what was done. **Lesson: ground-truthing the producer is half the job — trace which producer reaches the consumer before calling anything live.**

3. **`framework-agreement-service.ts` (7× TS2741) — reported at the time as a live 3-way client bug; see the correction above.** The handoff filed this as "one clean, self-contained root: admin vs client `Timestamp`". It is not self-contained. `FrameworkAgreement` declares `validFrom/validUntil/createdAt/updatedAt` as the **client** `Timestamp` (`firebase/firestore`), while the sole writer is a `server-only` service building **admin** Timestamps. Ground-truthed against the installed `firebase-admin`: the admin `Timestamp` has **no `toJSON()`** (precisely what TS2741 reports) and `JSON.stringify` yields **`{"_seconds":…,"_nanoseconds":…}`**. The route returns `ok(items)` → `NextResponse.json`, so the client receives a **plain object with no methods and no `seconds` key** — neither a client Timestamp nor an admin one. All three consumers are broken, each differently: `AgreementDetail.tsx:110` calls `validFrom.toDate()` → **TypeError, component crashes**; `AgreementSlimList.tsx:85` guards with `?.toMillis?.() ?? 0` → **every row sorts as 0**; `FrameworkAgreementFormDialog.tsx:99` casts through `unknown` to `{seconds?}` → reads `seconds`, wire has `_seconds` → **the edit form shows empty dates**. Two consumers had already invented private workarounds around reality; the type kept the third compiling. The honest fix is **ISO at the API boundary** — the codebase's own convention, already used by `CreateFrameworkAgreementDTO.validFrom: string // ISO at API boundary` — but it spans the service + the shared type + 3 components + hooks + tests (5+ files, 2 domains, user-visible date rendering) ⇒ **N.8: Giorgio decides scope.** Not patched here: any cast would have hidden a real crash. Note the existing ADR-218 SSoT (`normalizeToDate`) does **not** cover the `{_seconds}` wire shape either. **Also note:** this file is not dxf-viewer code at all — it is in this program only via a transitive import chain reaching `@/services/ai-pipeline/*` (which also explains the `messaging-handler` / `file-purge-helpers` errors in the list). The leak itself is worth a separate look.
---

### 2026-07-16, part 4b — ADR-544 `PlacementOverlayFields` finished (−2, and the anti-pattern closed)

**The 2× TS2352 were never about a cast — they were the receipt for a half-finished SSoT.**

`column-preview-helpers.ts:109` and `foundation-preview-helpers.ts:109` are **twins**: `{ ...ghost, xHud } as ExtendedSceneEntity`, which TS rejected («neither type sufficiently overlaps»). Root: **`ExtendedSceneEntity` declares none of the ghost-meta fields** the preview layer attaches. So the whole producer↔painter channel was untyped in *both* directions: every writer cast, and every reader cast **and re-declared the field's shape inline** — including `drawing-hover-overlays.ts:168`, which hand-rolled `{ bandMm: readonly [number, number] }` even though `OpeningConflictMeta` is exported right next to it.

**The SSoT already existed and was half-done.** `bim/placement/placement-overlay-fields.ts` came out of exactly this audit (ADR-544, Giorgio): *"the same set of fields was read with inline structural casts in TWO places… now it lives here, once… zero duplicate field knowledge."* It covered only `polarDiskGrid`/`rectGrid`/`faceDimensions`/`alignmentGuide`. **The HUD/ghost fields were never added — so the anti-pattern simply survived in the fields nobody moved.** That is the lesson worth keeping: *a partially-applied SSoT does not shrink the problem, it hides it in the remainder.*

**Done now — the field set is declared once, in full:** added `wallHud`, `hudSpecLabel`, `columnHud` (+ `ColumnHudMeta`), `footprintHud` (+ `FootprintHudMeta`), `wysiwygPreview`, `ghostStatusColor`, `openingConflict`, plus `PlacementGhostEntity = ExtendedSceneEntity & PlacementOverlayFields` for writers.
- **Writers (−2):** both twins now return `PlacementGhostEntity` and build the augmented ghost **with no cast at all**.
- **Readers (−8 inline re-declarations):** `drawing-hover-overlays.ts` (×4 → the single existing `overlay` read), `WallPlacementGhost.ts`, `wall-joint-miter-preview.ts`, `preview-entity-paint.ts`. Verified by grep: **zero** inline casts of these fields remain.
- **Deliberately left alone:** `liveDimHud` — unlike `columnHud`, it **is** declared by its producer (`ExtendedLineEntity`/`ExtendedPolylineEntity`); its reader cast only narrows a union to a member that owns the field, which is not the duplicate-knowledge anti-pattern. Moving it would have created a *second* declaration — the very thing ADR-544 forbids. The line: `PlacementOverlayFields` owns meta attached to **real entity ghosts** (which cannot declare it); the `Extended*` interfaces own their **own** preview fields.
- **Still open (not a regression):** `toWysiwygPreviewEntity` keeps its `as unknown as ExtendedSceneEntity` and its **7 positional params** — now that the fields are declared, it is a candidate to take an options object typed by `PlacementOverlayFields` instead of growing an eighth. Separate change.

**Verification:** 125/126 suites, **1239/1239 tests** green across `hooks/drawing` + `preview-canvas` + `bim/walls` + `bim-3d/placement`. `jscpd:diff` clean on all 7 files (N.18). The 1 failing suite (`add-wall-to-scene`) is **pre-existing and unrelated**: a real circular-import TDZ (`Cannot access '_griplinearcommits' before initialization`) entirely inside `hooks/grips/`, a folder that is **clean in this tree** (== HEAD) and references none of the touched files — worth a separate look, as it is not in the part-3 handoff's known-failures list.

---

### 2026-07-16 batches, part 5 (60 → 53)

Start-of-session: **60** source errors → **53** (−7, all TS2741; measured, reconciled: the mid-batch run read 56 = 53 + the 3 this session's own honest narrowings surfaced, each then fixed at its root — see 2 below. Zero foreign errors added; the only apparent newcomers in the run-to-run diff were the *same* errors with TS's union members printed in a different order). Three roots closed, one dead test suite revived. The session's most valuable output was a **retraction**, not a fix.

**0. 🔴 The part-4 "live 3-way bug" was not live — and the way it was wrong is the lesson.** Part 4 escalated `framework-agreement` as a crash-on-render bug, on evidence that looked airtight: the Admin SDK genuinely has no `toJSON()` and genuinely serialises to `{_seconds,_nanoseconds}`, and three consumers genuinely read `.toDate()` / `.toMillis()` / `.seconds`. Both halves were true; the **join** was never checked. `useFrameworkAgreements` **reads via `firestoreQueryService.subscribe`** (client SDK, `onSnapshot` → `d.data()` → real client `Timestamp`) and **writes** via REST — its header comment says exactly that. So all nine consumers work, `{_seconds}` never enters the tree (the GET route has **no caller**; the POST/PATCH response is discarded by `page.tsx:115,118`), and the proposed "ISO everywhere" fix would have **broken nine working consumers** that legitimately rely on the subscription's client `Timestamp`. Part 4 ground-truthed the *producer* and inferred the bug from the *consumers' source*. **Ground-truthing the producer is half the job: trace which producer actually reaches the consumer.** The type errors were real; the story attached to them was not.

**What was actually true — a latent server-side type lie (−7).** One interface was pretending to be three shapes at once. The instants have three *legitimate* representations, because three producers feed three consumers: client `Timestamp` (subscription), admin `Timestamp` (the service), ISO string (JSON over HTTP — no Timestamp survives `JSON.stringify`). Fixed in the **opposite direction** to part 4's proposal: `FrameworkAgreement` (client `Timestamp`) is **correct as-is** and untouched — the subscription really does yield that. Added `FrameworkAgreementTimestampField` as the one canonical field list, with `FrameworkAgreementWire` (ISO, per Google AIP-142 and this module's own `CreateFrameworkAgreementDTO.validFrom: string // ISO at API boundary`) and server-only `FrameworkAgreementDoc` (admin `Timestamp`) **derived** from it, so a fifth instant field cannot be added to one and forgotten in the others. The service now returns `Doc`; the routes serialise through one mapper (`framework-agreement-doc.ts`); the hook's write path declares `Wire` — an honest cast at last. Inert today only by luck: `createAgreement` already did `json.data as FrameworkAgreement`, the very cast that would have hidden the crash the first time anyone used the response for an optimistic update — which N.7 actively encourages. **Zero consumers changed.** Route tests upgraded from `mockResolvedValue({id:'a1'})` (which asserted nothing about instants) to a real doc → asserts ISO on the wire. `FrameworkAgreementLike` lets the discount resolver — which runs server-side over docs *and* in the browser over subscription output, reading instants only through ADR-218 — accept any representation honestly. CHECK 3.28 also caught a pre-existing twin: the load + `companyId` tenant-isolation guard was hand-copied across `update` / `softDelete` → extracted to `loadOwnedAgreement` (a security check that exists twice is one edit from existing once).

**1. `toWysiwygPreviewEntity` — options object, and the lie it was hiding (Task B).** Replaced 7 positional overlay params with one options object typed by **`PlacementOverlayFields`** (ADR-544's SSoT — the field types keep one owner; `liveDimHud` deliberately stays out, per part 4b). The real prize was the **return** cast: `as unknown as ExtendedSceneEntity` existed only because `T extends object` — a bare `object` is not a ghost, so no honest cast was possible. Constrained to `T extends AnySceneEntity`, which is what every caller already passes, and **the cast is gone**. That constraint then surfaced the cluster's shared root (below). `wall-ghost-build` no longer reads `(e, id, null, null, null, hud, label)`.

**2. 🔴 The TS2345 cluster's common root — `PlacementGhostEntityBuilder` declared `() => object | null` (−2).** Exactly part 4's `createEntityFromTool` lesson, one layer over: **a producer under-declared, and every consumer inherited the widened type.** Both real builders (`buildColumnGhostEntity` / `buildPadGhostEntity`) return `built.entity` from `buildColumnEntity` / `buildFoundationEntity` — a real scene entity, never a bare `object`. Narrowed to `AnySceneEntity | null`. **This had been hiding a whole branch from the tests:** the assembly's neighbour-clearance path is gated on `resolveEntityFootprintForDims(entity)`, and the suite's fake `{ type: 'column' }` yielded no footprint — so the branch was *never executed*, and `TARGETS` had been missing **nine of its twelve** collections without anyone noticing. Real stub entity → branch runs → fixture completed. 63/63 green, with genuinely more covered than before.

**3. 🔴 Task C — a real import cycle: `add-wall-to-scene` had been running zero tests.** `ReferenceError: Cannot access '_griplinearcommits' before initialization` killed the whole suite at module-init. Root: **modules importing a symbol from a re-exporter instead of its owner.** `createSceneManagerAdapter` lives in `grip-scene-manager-adapter.ts` (which has no edge back), but **17 modules** imported it from `grip-commit-adapters` — which merely re-exports it *and* imports `grip-parametric-dispatch`, whose module-level `PARAMETRIC_COMMIT_HANDLERS` registry eagerly reads every handler out of the `grip-parametric-commits` **barrel**, which re-exports those same 17 modules. Each import dragged the entire graph in to fetch a function living elsewhere. Pointed all 17 at the owner — the correct precedent already existed (`grip-group-commits`, both adapter tests). One edge remained (`grip-parametric-footprint-commits` needs `commitWholeEntityMove`, genuinely owned by `grip-commit-adapters`), so that **leaf SSoT** was extracted to `grip-whole-entity-move.ts` — mirroring the earlier `grip-scene-manager-adapter` split, same reason. Cycle dissolved as a **class**, not an instance. Suite runs: **6/6**, from zero.

**Verification:** 3219/3220 across `hooks/grips` + `bim/walls` + `hooks/drawing` + `bim-3d`, plus 63 `bim/placement`, 141 procurement/date-local. `jscpd:diff` clean (N.18). **One pre-existing failure, not ours:** `bim3d-resize-bridge-stair` (a scene-units-vs-mm precision gap — expected <5e-7, got 25) in `bim-3d/gizmo`, a folder that is **clean at HEAD** and whose imports touch nothing in this diff. It is absent from every handoff's known-failures list only because no session had run `bim-3d/gizmo` — part 4 ran `bim-3d/placement`. Needs a decision, like `move-entity-geometry-coverage`.

**Foreign, unchanged:** `dxf-types.ts` TS2430 ×2 (`DxfTopoSurface` / `DxfLeader`), `entity-export-coverage.ts` (a completeness anchor working correctly).

---

## Changelog

| Date | Change |
|---|---|
| 2026-07-16 | ADR created. CHECK 3.29 live: engine + 39 Jest tests + per-file baseline (381 errors) + CI Layer 2 + pre-commit Layer 1 smoke. Source errors burned 205 → 117 in the same session (§4). |
| 2026-07-16 | Burn-down part 2: source 117 → 84 (−33), total 381 → 337 (−44 across 15 files; test errors 264 → 253 as a side effect of three shared-guard roots). Fixed a **live ESC bug** found via the type errors (wall-merge / wall-gap-opening ESC handlers were never registered — §4 batch 4). Baseline **not** re-locked: the fixes are uncommitted, and an un-paired baseline would over-tighten CI. Run `npm run dxf:tsc:baseline` after committing. |
| 2026-07-16 | Burn-down part 3: source 84 → **67** (−17 across 15 files; full run reports 68 due to one concurrent, unrelated `entity-export-coverage.ts` error in an unmodified file — §4 part 3). **ONE root**: `OpeningParams.wallId?` is the ADR-615 self-hosted discriminator, and 13 consumers were reading it as always-present, i.e. **silently ignoring self-hosted openings**. All routed through the existing `isWallHostedOpening()` predicate. Fixed a **live bug**: `AssignOpeningTypeCommand` still carried ADR-615 RC3/RC4 (family-type assign on a self-hosted κούφωμα silently rejected + stale geometry) because the host-branch logic was copy-pasted from its twin instead of shared — extracted to `opening-derived-state.ts` SSoT; +6 regression tests. Baseline still **not** re-locked (fixes uncommitted). |
| 2026-07-16 | Burn-down part 5: source 60 → **53** (−7). **The headline is a retraction, not a fix**: part 4's "live 3-way client bug" in `framework-agreement` is **withdrawn** — it ground-truthed the Admin SDK (correctly: no `toJSON()`, serialises `{_seconds}`) but never traced *which producer feeds the consumers*. `useFrameworkAgreements` **reads via `firestoreQueryService.subscribe`** (client SDK → real client `Timestamp`) and only **writes** via REST, so all nine consumers work and `{_seconds}` never reaches the tree; part 4's proposed "ISO everywhere" fix would have **broken nine working consumers**. What was real: a **latent** server-side type lie — one interface pretending to be all three legitimate shapes. Fixed the other way round: the client type is untouched, with `FrameworkAgreementWire` (ISO, AIP-142) + server-only `FrameworkAgreementDoc` **derived** from one canonical instant-field list; routes serialise via a single mapper. Zero consumers changed. Also: **ADR-218's `{_seconds}` gap closed** (8 privately re-implemented clones deleted — the gap is why Phase 2's de-dup regrew; 20 new tests, first suite for that module); `toWysiwygPreviewEntity` takes an options object and **lost its `as unknown as`** by constraining `T` to what callers actually pass — which then exposed **the TS2345 cluster's shared root**: `PlacementGhostEntityBuilder` declared `() => object | null` while both builders return real entities (part 4's `createEntityFromTool` lesson again), a lie that had kept an entire branch unexecuted in its test and left `TARGETS` missing 9 of 12 collections. And a **real import cycle** — 17 modules importing `createSceneManagerAdapter` from a re-exporter instead of its owner, detonated by an eager module-level registry — left `add-wall-to-scene` running **zero** tests; dissolved as a class (6/6 now). 3219/3220 + 63 + 141 green; `jscpd:diff` clean. Baseline still **not** re-locked. |
| 2026-07-16 | Burn-down part 4: source 71 → **61** (−10 across 6 files; the run starts at 71 because part 3's 67 excluded the 3 never-grouped `Block*Dialog` errors + 1 foreign `entity-export-coverage`). **Two roots, two live bugs.** (1) `DialogContent size="md"` in the 3 Block Library dialogs: `md` is not in the CVA scale (`sm/default/lg/xl/2xl/fullscreen`), and an invalid variant emits **no class** while `defaultVariants` only rescues `undefined` — since the base carries `w-full` with no `max-w-*`, all three dialogs rendered **full-viewport width**. Shipped because the root tsconfig excludes `dxf-viewer` → **the first live UI bug CHECK 3.29 has surfaced.** (2) `createEntityFromTool`, a **commit** builder, was declared returning the **preview** union `ExtendedSceneEntity`, whose only non-`Entity` members are the `PreviewPoint`/`PreviewText` pseudo-entities it never produces → 7 errors in 3 files inherited the lie; narrowed to `Entity \| null` at the producer + the 2 declarations restating it. 45 suites/401 tests + 19 green; `jscpd:diff` clean. **Escalated, not patched** (§4 part 4): `framework-agreement-service` (7× TS2741) is a **live 3-way client bug** (admin Timestamp → JSON `{_seconds}` → `.toDate()` crashes `AgreementDetail`, sort silently 0, edit form dates empty) needing an N.8 scope decision; and the 2× TS2352 ghost-HUD twins want ADR-544's `PlacementOverlayFields` SSoT finished. Baseline still **not** re-locked. |
