# ADR-604 — Generic BIM Family-Type Framework (SSoT)

**Status:** ✅ ACTIVE
**Date:** 2026-07-08
**Supersedes duplication flagged in:** `.claude-rules/pending-ratchet-work.md` (TIER B-bis)
**Related:** ADR-412 (BIM Family Types), ADR-417 (Roof), ADR-421 (Opening Types),
ADR-594 (`createBimEntityPersistenceHook` — the «shared core + per-instance binding»
precedent), ADR-591 (`level-scene-accessor`), ADR-279/280 (i18n resolver reachability).

---

## 1. Context

Four BIM family-typed entities — **Wall / Slab / Roof / Opening** — each shipped the
same four-part scaffolding, copy-pasted per entity (16 files, ~1,600 lines):

1. **Re-resolution hook** `use{X}TypeReresolution` — subscribe to the family-type
   store `version` and re-resolve the active scene's typed instances. The four
   hooks were byte-identical except the pure `reresolveScene{X}` SSoT they call.
2. **Edit-Type dialog store** `edit-{x}-type-store` — a `createExternalStore`
   singleton holding `{ open, typeId }` with `open/close/subscribe/get` wrappers.
   Byte-identical except the entity name in the identifiers.
3. **Controller** `use{X}FamilyTypeController` — ~290 lines of assign / override /
   reset / duplicate / rename / count / updateTypeParams / deleteType. Identical
   algorithm; differed only in the category literal, the entity type-guard, the
   family-type UI helpers, and the per-instance / catalog command classes.
4. **Ribbon widget** `Ribbon{X}FamilyTypeWidget` — the contextual selector. NOTE:
   these are **two designs**, not one — Wall/Opening use a duplicate-only selector
   (`bimFamilyType` i18n), Slab/Roof use an edit/delete selector (per-entity i18n).

The duplication was flagged as TIER B-bis in the ratchet backlog.

## 2. Decision

Extract **one shared primitive per concern** and bind each entity with a narrow
config — the ADR-594 «shared core + per-instance binding» pattern (composition,
NOT a god-config). Every per-entity file becomes a **thin wrapper that preserves
its existing public API**, so the ~12 downstream consumers (widgets, dialogs,
draw-tool draft panel, persistence hosts) are untouched (zero blast radius).

| Φ | Shared primitive (NEW) | Bound by |
|---|---|---|
| **Φ1** | `hooks/data/create-type-reresolution-hook.ts` → `createTypeReresolutionHook(reresolveSceneFn)` | 4 `use{X}TypeReresolution` one-liners |
| **Φ2** | `bim/family-types/create-edit-type-dialog-store.ts` → `createEditTypeDialogStore()` | 4 `edit-{x}-type-store` re-export wrappers (named exports kept) |
| **Φ3** | `ui/ribbon/hooks/create-family-type-controller.ts` → `useFamilyTypeController(config)` | 4 `use{X}FamilyTypeController` wrappers (spread + entity-named rename) |
| **Φ4** | `ui/ribbon/components/FamilyTypeSelect.tsx` (shared dropdown + `FamilyTypeWidgetCommon`), `create-family-type-selector-widget.tsx` (Wall/Opening design), `FamilyTypeEditorWidget.tsx` (Slab/Roof design) | 4 `Ribbon{X}FamilyTypeWidget` wrappers |

### 2.1 Key design constraints (why it is shaped this way)

- **Zero behavior change on commands.** The generic `UpdateFamilyTypeCommand<TP>` /
  `createDeleteFamilyTypeCommand` already exist (the Opening controller used them),
  but Wall/Slab/Roof still use their per-entity `Update{X}FamilyTypeCommand` /
  `createDelete{X}FamilyTypeCommand` (different `type` serialization string + a
  `thickness > 0` validate on the wall command). The controller core therefore
  **injects command construction** (`makeAssignCommand` / `makeUpdateCommand` /
  `makeDeleteCommand`) instead of forcing a migration — each entity keeps its own
  tested command. Migrating Wall/Slab/Roof onto the generic command stays a
  separate, deferred ratchet.
- **`makeAssignCommand` absorbs per-entity quirks** — e.g. the wall assign command
  takes an extra `entity.kind` argument the others do not.
- **Category-derived params, no casts.** The controller is generic over
  `C extends FamilyTypeCategory`, so `typeParams` resolves to
  `BimTypeParamsByCategory[C]` — no `as` casts on the type payload.
- **Two widget families are NOT merged.** Unifying them would change the Wall/Opening
  UX (gain edit/delete) or the Slab/Roof UX (gain duplicate) — out of scope. They
  share the dropdown scaffolding (`FamilyTypeSelect`) and the common controller
  slice (`FamilyTypeWidgetCommon`) only.
- **i18n stays statically reachable (CHECK 3.13).** The Slab/Roof editor receives
  **pre-translated labels** resolved by each wrapper with static `t('literal')`
  calls — the shared component performs no dynamic-key `t()`.

## 3. Consequences

- ~1,600 lines of copy-paste → 5 shared primitives + 16 thin wrappers.
- `jscpd` on the touched set: **0 clones** (the residual thin-binding echoes were
  removed by the controller spread pattern, the shared `FamilyTypeSelect`, and the
  `FamilyTypeWidgetCommon` base interface).
- A 5th family-typed entity now needs only 4 small wrappers + its config, no new
  algorithm.
- Tests: `create-edit-type-dialog-store.test.ts` (5) + `create-type-reresolution-hook.test.ts` (2) — GREEN.

## 4. Changelog

- **2026-07-08 — Φ1-Φ4 landed.** Extracted the four shared primitives; migrated all
  16 Wall/Slab/Roof/Opening files to thin wrappers with byte-compatible public
  APIs. Command construction injected (no command migration). jscpd 0 / jest GREEN.
  Deferred: migrate Wall/Slab/Roof `Update*/Delete*FamilyTypeCommand` onto the
  generic `UpdateFamilyTypeCommand` / `createDeleteFamilyTypeCommand`.
