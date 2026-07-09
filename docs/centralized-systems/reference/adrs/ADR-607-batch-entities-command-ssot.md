# ADR-607: Batch-create entities command factory SSoT (`createBatchEntitiesCommand`)

## Status
✅ **ACTIVE — 2026-07-09** — De-duplication of the 6 `Create<Entity>Command` batch grid-gen commands under `src/subapps/dxf-viewer/core/commands/entity-commands/` (`CreateBeamsCommand` · `CreateColumnsCommand` · `CreateFoundationsCommand` · `CreateSlabsCommand` · `CreateWallsCommand` · `CreateMepSegmentsCommand`). Each was a ~124-line `ICommand` class repeating the SAME body **verbatim** — `execute`/`redo`/`undo`, `applyScene`/`revertScene`, the microtask-deferred `deferFirestore`, `canMergeWith`/`getDescription`/`getAffectedEntityIds`/`validate`/`serialize` — differing ΜΟΝΟ σε 6 παραμέτρους. Collapsed onto **one generic factory** `createBatchEntitiesCommand<TEntity>(config)` that returns the command class + 6 ~12-line config bindings keeping their exact public API.

**Related:**
- **ADR-605 / ADR-606** — same 2026-07-09 de-duplication sweep, sibling archetype (**shared primitive + per-instance binding**), different buckets (3D placement hooks / MEP commit builders). ADR-607 is the undoable-command bucket.
- **ADR-390** — symmetric create/undo + the `emitBimEntityCreated` / `emitBimEntityDeleteRequested` lifecycle-event SSoT the factory reuses. `CreateBimEntityCommand` (single entity, manual-draw + Ctrl-COPY) is the SIBLING, deliberately NOT merged — it mints ids and has different id/timestamp semantics.
- **ADR-441** — the grid-gen slices (beam/column/foundation/slab/wall) reproduced 1:1; **ADR-426** — the MEP-segment accept path.
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28) — the guard.

---

## Context

A real SSoT audit (grep for `deferFirestore`/`applyScene` + full diffs of all 6 against `CreateColumnsCommand.ts`, plus a jscpd pass) confirmed the six bodies were byte-identical apart from comments/loop-variable names. The **only** variance:

| Config field | e.g. Columns | e.g. MEP segments |
|---|---|---|
| `name` (`ICommand.name`) | `CreateColumns` | `CreateMepSegments` |
| `type` (discriminant) | `create-columns` | `create-mep-segments` |
| `bimType` (create + delete event) | `column` | `mep-segment` |
| `descriptionNoun` | `grid columns` | `MEP pipe segments` |
| `serializeIdsKey` | `columnIds` | `segmentIds` |
| `validationNoun` | `column` | `segment` |

Crucially, these batch commands **serialize but are never deserialized via `CommandRegistry`** (no factory is registered for `create-*`; they are only ever `new`-ed at the call-site), so the `type` string is not a round-trip discriminant — collapsing them onto one class carries no replay risk. No consumer uses any of them as a *type* or with `instanceof` (verified) — only `new XCommand(entities, sceneManager)` — so `export const XCommand = createBatchEntitiesCommand<E>({…})` is a drop-in.

---

## Decision

### New factory `entity-commands/create-batch-entities-command.ts`
`createBatchEntitiesCommand<TEntity extends { id: string }>(config)` returns a `BatchCreateEntitiesCommandClass<TEntity>` (a `new (entities, sceneManager) => ICommand` constructor). The factory owns the invariant undoable-batch body; `config` injects the 6 strings above. Each of the 6 files is now:

```ts
export const CreateColumnsCommand = createBatchEntitiesCommand<ColumnEntity>({
  name: 'CreateColumns', type: 'create-columns', bimType: 'column',
  descriptionNoun: 'grid columns', serializeIdsKey: 'columnIds', validationNoun: 'column',
});
```

### Consequences
- **−7 jscpd clones** (3688 → 3681, CHECK 3.28) — modest clone-count drop (the ICommand scaffolding still partially matches the untouched Attach/Detach commands), but a large **LOC** win (~600 duplicated lines → one ~150-line factory + 6 tiny configs) and a real SSoT: a new batch grid-gen command is a config object.
- `CreateFoundationsCommand` + `CreateMepSegmentsCommand` direct tests (12 tests) stay green — API unchanged.
- The single-entity `CreateBimEntityCommand` (ADR-390) is intentionally left separate.

---

## Changelog
- **2026-07-09** — Created. Extracted `createBatchEntitiesCommand`; migrated all 6 batch grid-gen commands to config bindings. 12 tests green; jscpd −7.
