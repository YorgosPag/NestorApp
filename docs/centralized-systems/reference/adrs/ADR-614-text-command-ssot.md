# ADR-614: Text command SSoT — DxfTextCommandBase + node-mutation Template-Method

## Status
✅ **ACTIVE — 2026-07-09** — De-duplication of the DXF text command family under `src/subapps/dxf-viewer/core/commands/text/`. The 13 `ICommand` classes (create / delete / style / geometry / paragraph / annotation-scales / current-scale / layer / insert-token / replace-one / replace-all / replace-node) each repeated the same `ICommand` boilerplate — the universal envelope (`id`/`timestamp` init, `redo → execute`, `canMergeWith → false`, the `serialize()` shape), the guarded execute preamble (`getEntity` → `assertCanEditLayer(resolveEntityLayerName(entity))` → snapshot capture) and the node-restore `undo`. Collapsed onto the generic **`BaseCommand`** (ADR-613) plus two text Template-Method bases and shared free helpers, turning every class into a thin subclass with **identical public API**.

**Related:**
- **ADR-344** — DXF Text Engine (text command pipeline, Q8 layer guard, Q12 audit trail — all reproduced 1:1).
- **ADR-613** — the generic `BaseCommand` root this cluster adopts (Boy-Scout, as ADR-613 §Decision 1 anticipated: "Reusable by future clusters — text / layer / vertex commands").
- **ADR-605 / 606 / 607 / 609 / 610 / 611 / 613** — the same multi-day jscpd sweep (factory / Template-Method / composed-computer + thin bindings archetype). **ADR-610** (attach/detach command base) and **ADR-613** (guide commands) are the closest class-based precedents.
- **ADR-557 / 358 / 508** — the geometry/layer/rotation SSoT rules the migrated bodies preserve verbatim.
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28 / N.18) — gated the sibling-clone iteration to zero.

---

## Context

A real SSoT audit (grep for existing command bases + full reads of all 13 text command files + `types.ts` / `CanEditLayerGuard.ts` / `interfaces.ts`, plus a fresh jscpd pass listing **25 intra-dir clone pairs / 386 cloned lines** — `core/commands/text`) confirmed the generic `BaseCommand` (ADR-613) existed but was **only used by the guide family**; every text command still hand-rolled the full `ICommand` plumbing. The variance lived on a small number of axes:

1. **`ICommand` envelope** — `readonly id = generateEntityId()`, `readonly timestamp = Date.now()`, `redo() { this.execute(); }`, `canMergeWith() { return false; }`, the six-field `serialize()` return and the `validate()` entityId guard + `getAffectedEntityIds() → [entityId]` — repeated in **all 13** classes.
2. **Guarded resolve** — `getEntity` → `if (!entity) return` → `assertCanEditLayer({ layerName: resolveEntityLayerName(entity) ?? '', provider })` → snapshot capture: the execute preamble, the single most-cloned unit (the `DeleteTextCommand` hub cloned against 9 siblings).
3. **Node-mutation lifecycle** — read node (`ensureTextNode`) → snapshot once → compute next node → `updateEntity({ textNode })` → audit `updated`; `undo()` = restore node — **identical** across 5 commands (Style / MTextParagraph / CurrentScale / ReplaceOne / ReplaceTextNode). Only the patch body + audit changes differ.
4. **Patch-command surface** — `mergeWith` (shallow `{...patch, ...patch}` + reconstruct), the "patch must not be empty" validation and the `<label> (fields)` description — copy-pasted between `UpdateTextStyle` and `UpdateTextGeometry`.

---

## Decision

Big-player command architecture (AutoCAD / Revit expose ONE command root + a per-domain transaction base + thin per-operation leaves), layered top-down:

### 1. `core/commands/base-command.ts` — generic `BaseCommand` (ADR-613, reused as-is)
Owns `id`/`timestamp`, `redo() → execute()`, `canMergeWith() → false`, the `serialize()` envelope + `protected abstract serializeData()`.

### 2. `core/commands/text/dxf-text-command-base.ts` — text Template-Method bases + free helpers
- **`DxfTextCommandBase<I extends SingleEntityInput> extends BaseCommand`** — the single-entity boilerplate: stores `input`/`sceneManager`/`layerProvider`/`auditRecorder`, exposes `entityId`, `resolveEntity()` (guarded resolve), `recordAudit(...)`, `getAffectedEntityIds() → [entityId]`, and `validate()` (entityId guard + `protected validatePayload()` hook).
- **`DxfTextNodeMutationCommand<I> extends DxfTextCommandBase<I>`** — the dominant lifecycle: `execute()` = resolve → snapshot node once → `applyMutation()` (→ patch + audit changes, or `null` to no-op) → commit → audit; `undo()` = `restoreUpdates(snapshot)`. Hooks: `readNode()` (default `ensureTextNode`), `restoreUpdates()` (default `{ textNode }`), abstract `applyMutation()`.
- **Free helpers** — `resolveEditableTextEntity(...)` (guarded resolve, also for the multi-entity/no-layer outliers), `recordTextAudit(...)` (audit envelope), `mergePatchInputs(...)` (drag-coalesce merge rule), `validateNonEmptyPatch(...)` + `describePatchFields(...)` (patch-command surface).

### 3. Thin command files (identical public API)
- **DxfTextNodeMutationCommand:** UpdateTextStyle, UpdateMTextParagraph, UpdateTextCurrentScale, ReplaceOneText (raw-node `readNode` override + `null` no-op), ReplaceTextNode.
- **DxfTextCommandBase (bespoke execute/undo — richer snapshot / flat-field mirror):** DeleteText, UpdateTextLayer (dual source+target guard), InsertTextToken (flat-`text` mirror), UpdateTextAnnotationScales (flat annotative mirror), UpdateTextGeometry (position+rotation+node snapshot, patch-mergeable).
- **BaseCommand (outliers):** ReplaceAllText (multi-entity `entityIds`, reuses the free resolve/audit helpers), CreateText (no `layerProvider`; `redo` = BaseCommand default — its cached entity replays the add + `created` audit identically to the legacy bespoke redo).

`UpdateTextTransformCommand` is untouched — it already extends `MergeableUpdateCommand` (entity-commands), outside this clone family.

All class names, constructor signatures, exported input/patch types and extra public members (`getCreatedEntity()`, `TextStylePatch`, `GeometryPatch`, `ParagraphPatch`, …) are preserved. The barrel `commands/text/index.ts` is unchanged; external consumers (`useTextToolbarCommandBridge` et al.) are untouched.

---

## Consequences

**Positive**
- **−26 jscpd clones** full-scan (3560 → 3534, `.jscpd-baseline.json` relocked); zero new sibling clones (`jscpd:diff` clean on all 14 staged src files).
- The generic `BaseCommand` now backs two command families (guides + text); text commands shed their entire `ICommand` plumbing + execute preamble.
- New parity test `commands/text/__tests__/text-commands-ssot.test.ts` (11 cases) locks the base contract (envelope, validation, node-mutation lifecycle, guarded resolve, audit routing, outliers) against a real mock scene + LayerStore; full text suite green (90/90).

**Negative / risk**
- `CreateText` now inherits `redo() → execute()` instead of a bespoke redo. Verified equivalent: the entity is built once and cached, so a redo replays `addEntity` + the `created` audit byte-identically to the old hand-written redo (covered by the existing + new redo tests).

---

## Changelog
- **2026-07-09** — Initial. Added `dxf-text-command-base.ts` (`DxfTextCommandBase` + `DxfTextNodeMutationCommand` + `resolveEditableTextEntity`/`recordTextAudit`/`mergePatchInputs`/`validateNonEmptyPatch`/`describePatchFields`); migrated all 13 text command files to thin subclasses; added parity test suite. jscpd 3560 → 3534.
