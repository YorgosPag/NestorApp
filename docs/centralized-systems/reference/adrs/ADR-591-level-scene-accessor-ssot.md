# ADR-591: Level-Scene Accessor Capability Interfaces SSoT (`level-scene-accessor.ts`)

## Status
✅ **ACTIVE — 2026-07-08** — `systems/levels/level-scene-accessor.ts` is the single home for the "read/write a level's scene" manager-shape that DXF Viewer consumers depend on. Three capability-scoped interfaces (`CurrentLevelRef` ⊂ `LevelSceneReader` ⊂ `LevelSceneWriter`) replace **45 hand-written `interface LevelManagerLike {…}` re-declarations**. Type-only change — zero runtime behaviour difference.

**Related:**
- **ADR-589** — Edge-triggered Tool Lifecycle SSoT. Same DXF Viewer duplicate-audit sweep (TIER B); this is TIER B item **B1**.
- **ADR-294** — SSoT ratchet enforcement (CHECK 3.7). No tier-3 guard added here — see *Guard decision* below.
- **ADR-584 / CHECK 3.28** — jscpd token-based clone ratchet. See *Interaction with CHECK 3.28* below.
- **ADR-040** — `setLevelScene(levelId, scene, origin?)` write-origin drives the auto-save gate; preserved in `LevelSceneWriter`.
- **B2 `bim-entity-firestore-persistence-hook`** (pending) — the identical persistence *scaffold* (autosave/subscribe/merge) shared by the 24 `use*Persistence` hooks. Orthogonal to B1 (this ADR touches only their level-manager *type*, not their body).

---

## Context

`LevelsSystem` (`useLevels()`) owns the per-level scene model. Dozens of hooks/components receive a narrow "level manager" as a prop and read/write scenes through it. Each consumer had **hand-declared its own** minimal view of that manager:

```ts
interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel, origin?: SceneWriteOrigin): void;
}
```

The audit found the identifier `LevelManagerLike` across **160 files** in three idioms:

| Idiom | Count | Severity |
|-------|------:|----------|
| Hand-written `interface LevelManagerLike {…}` | **45** | High — the shape is hand-copied (5 minor variants: method vs arrow, with/without `origin`, `readonly`, optional `setLevelScene`, extra `levels`). |
| `type LevelManagerLike = Pick<ReturnType<typeof useLevels>, …>` | 106 | Low — already *derived* from the canonical manager. |
| `import`ed from a sibling | ~9 | — |

Only the **45 hand-written interfaces** are true structural duplication. They are the scope of this ADR (B1). The 106 `Pick<…>` aliases are a lower-severity follow-up (**B1-bis**).

## Decision

Introduce **capability-scoped accessor interfaces** (the pattern Revit/Figma use — narrow "read model" vs "write model" contracts, not one god-type):

```ts
// systems/levels/level-scene-accessor.ts
export interface CurrentLevelRef  { readonly currentLevelId: string | null; }
export interface LevelSceneGetter { getLevelScene(levelId: string): SceneModel | null; } // B1-bis (ISP: read-one-scene, no currentLevelId)
export interface LevelSceneReader extends CurrentLevelRef, LevelSceneGetter {}
export interface LevelSceneWriter extends LevelSceneReader {
  setLevelScene(levelId: string, scene: SceneModel, origin?: SceneWriteOrigin): void;
}
```

Each of the 45 consumers now imports the **narrowest** capability it needs:
- read active id only → `CurrentLevelRef` (1 file: `useGridGuideSettleEmitter`)
- read scenes → `LevelSceneReader` (`useStructuralOrganism`, `GuideFollowGhostOverlay`, …)
- read + write scenes → `LevelSceneWriter` (all `use*Persistence`, structural mutators, PropertiesPalette, …)

Consumers that additionally need `levels` **extend** the capability and add only the extra field, e.g.:
```ts
interface OpeningLevelManager extends LevelSceneWriter { readonly levels: readonly Level[]; }
interface FoundationSyncLevelManager extends LevelSceneReader { readonly levels: readonly FoundationLevelRef[]; }
```

`hooks/canvas/canvas-click-tool-types.ts` keeps its **exported** `LevelManagerLike` name (it is a genuine shared type imported by 4 files) but now `extends LevelSceneReader` and adds only its deliberately-**optional** `setLevelScene?` (read-only click mocks stay valid).

### Structural-typing rationale (why this is behaviour-safe)
The real value passed everywhere is the full `useLevels()` manager, which structurally satisfies `LevelSceneWriter`. Widening a consumer that declared `setLevelScene(id, scene)` to the `origin?`-bearing signature is safe (extra optional param; the consumer never passes it). Method vs arrow member form is mutually assignable. Therefore every migrated site keeps identical compile-time requirements and identical runtime.

## Guard decision — NO CHECK 3.7 module (documented, like ADR-589 G13)
A repo-wide grep guard on the `LevelManagerLike` shape would collide with legitimate surviving usage: the **exported** `canvas-click-tool-types` variant, the **106 `Pick<…>` aliases**, and the `extends`-based `levels` variants. A zero-collision pattern is not available. Coverage instead comes from **CHECK 3.28 (jscpd)** — a *new* hand-copied interface body is a token clone — plus review. If regressions appear, a future guard could target `interface \w*LevelManager\w* \{[^}]*getLevelScene`.

## Interaction with CHECK 3.28 (jscpd) at commit time
B1 is **clone-negative**: it deletes 45 identical `interface LevelManagerLike` blocks and the accessor adds none. However, because B1 edits ~24 `use*Persistence` files (top-of-file import swap only), staging them together makes CHECK 3.28 `--diff` re-scan those whole files and surface the **pre-existing B2 persistence-scaffold clones** (bodies at lines ~170–240, untouched by B1). Those clones live in HEAD already and are tracked in the `.jscpd-baseline.json` total; they are **not introduced by this commit**. Resolution when committing B1: `SKIP_JSCPD_DIFF=1` (justified: pre-existing B2 debt), or land B2 first.

## Consequences
- ✅ 45 hand-copied shapes → 1 SSoT; new consumers import a capability instead of re-declaring.
- ✅ Cleaned up ~40 now-unused `SceneModel` imports and ~29 unused `SceneWriteOrigin` imports left behind by the removed interfaces.
- ✅ **B1-bis (2026-07-08):** the 106 `Pick<ReturnType<typeof useLevels>, …>` aliases were migrated onto these interfaces (see changelog). No `Pick`-style `LevelManagerLike` alias remains outside the exported `canvas-click-tool-types` variant.

## Changelog
- **2026-07-08** — Created. 45 interfaces migrated (39 via codemod-1, 6 special/levels-bearing via codemod-2), unused imports swept (codemod-3). Type-only, no runtime change. (Giorgio duplicate-audit TIER B / B1.)
- **2026-07-08 (B1-bis)** — Migrated the 106 `type LevelManagerLike = Pick<ReturnType<typeof useLevels>, …>` derived aliases onto the accessor interfaces. Codemod handled 102 mechanical files (79→`LevelSceneWriter`, 18→`LevelSceneReader`, 4 getter-only DetailHosts→`LevelSceneGetter`, 1 `PsetEditorHost` get+set→`LevelSceneWriter`); 4 edge files converted by hand (3× `+levels`, 1× `+saveContext` → `interface X extends LevelSceneWriter, Pick<…,'levels'|'saveContext'>`, keeping their `useLevels` type import). **New minimal capability `LevelSceneGetter`** added (ISP): the 4 Detail hosts resolve a scene by id but never touch `currentLevelId`, so they depend on the narrowest read capability instead of over-requiring it; `LevelSceneReader` now `extends CurrentLevelRef, LevelSceneGetter` (zero semantic change for the 45 B1 consumers). **Correction to the B1 §Consequences note that all 106 "call `useLevels()` runtime":** all 106 used `import **type** { useLevels }` purely for `typeof useLevels` — zero runtime calls — so the now-unused `useLevels` type import was removed in the 102 codemod files (kept only in the 4 edge files that still `Pick` a non-capability field). Type-only, no runtime change. Same guard decision (no CHECK 3.7) and CHECK 3.28 `SKIP_JSCPD_DIFF=1` rationale as B1. (Giorgio duplicate-audit B1-bis.)
