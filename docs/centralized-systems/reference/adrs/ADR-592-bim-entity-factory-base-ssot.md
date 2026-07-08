# ADR-592: BIM Entity Factory Base SSoT (`bim-entity-factory-base` + `bim-binding-params`)

## Status
✅ **ACTIVE — 2026-07-08** — De-duplication of the copy-pasted BIM entity factories under `src/services/factories/`. All 23 BIM entity factories (`beam` / `column` / `slab` / `wall` / `roof` / `foundation` / every `mep-*` / `furniture` / `floorplan-symbol` / …) shared byte-identically: (1) the `CreateXInput` common override + tenant fields, (2) the conditional-spread assembly tail, (3) the `id ?? genId() / validation ?? makeBimValidation() / ifcGuid ?? generateIfcGuid()` assembly core, and — for `wall`/`column` — (4) the ADR-369 binding-defaults resolver. Collapsed onto two shared modules; each factory keeps only its genuinely per-type parts (`type` / `ifcType`, `generateXId`, per-type `resolveXParams`, and any extra fields). jscpd (min-tokens 50) on the refactored fileset: **0 clones** (`jscpd:diff`); global clone count **4465 → 4300 (−165)**. No God-shell: the divergent `building` / `floor` factories (top-level Firestore, non-BIM) do NOT use this base.

**Related:**
- **ADR-585** / **ADR-586** / **ADR-588** / **ADR-590** / **ADR-591** — same 2026-07-08 de-duplication sweep, same archetype (**shared primitive + per-instance binding**), different buckets.
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28) — the token-based detector that surfaced these twins and gates re-introduction.
- **ADR-369** (BIM Elevation Convention) — the binding-defaults semantics centralised in `resolveBindingParams`.

---

## Context

`src/services/factories/` holds pure `createX(input): XEntity` factories that build BIM entities (no Firestore write — the caller persists). A **real SSoT audit (grep + jscpd, 16.97% duplicated lines)** showed **no** shared helper existed; every factory re-declared four identical pieces:

1. **`CreateXInput` common fields** — `layerId` + `visible` / `id` / `ifcGuid` / `pset` / `validation` + 7 tenant fields (`companyId`…`updatedBy`). Identical in 23 files.
2. **Assembly tail** — 9 conditional-spread lines (`...(input.visible !== undefined && { visible: input.visible })` × 9). Identical in 23 files.
3. **Assembly core** — `id: input.id ?? generateXId()`, `validation: input.validation ?? makeBimValidation()`, `ifcGuid: input.ifcGuid ?? generateIfcGuid()`. Structurally identical; twin pairs (e.g. `mep-radiator` ↔ `mep-underfloor`, both `IfcSpaceHeater`) exceeded the clone threshold.
4. **Binding resolver** — `wall` / `column` shared a byte-identical ADR-369 block (validate `unconnectedHeight` vs `topBinding`, strip the four binding fields, re-apply defaults). `ColumnBaseBinding` is a type alias of `WallBaseBinding`, so one resolver serves both.

What genuinely differs per factory — the `type` / `ifcType` discriminants, the `generateXId` generator, the per-type `resolveXParams` (defaults / validation), and per-type extra fields (`typeId`, `hostedOpeningIds`, `predefinedType`, …) — stays per-file. Big-player practice for entity factories (a shared typed constructor + per-type binding) is exactly **shared primitive + per-instance binding**.

---

## Decision

### New module `src/services/factories/bim-entity-factory-base.ts`
| Export | Owns |
|---|---|
| `BimEntityCommonFields` | The 9 optional `visible` / `pset` / tenant fields. |
| `CreateBimEntityInputBase` | `BimEntityCommonFields` + `layerId` / `id` / `ifcGuid` / `validation`. Concrete `CreateXInput` **extend** this and add `params` + `geometry` (+ per-type extras). |
| `spreadBimEntityCommonFields(input)` | The byte-identical 9-line assembly tail, once. |
| `assembleBimEntity(core, input)` | The typed assembly core: `id ?? generateId()`, `validation ?? makeBimValidation()`, `ifcGuid ?? generateIfcGuid()`, discriminants, + common-field spread. Returns `BimEntity<TKind,TParams,TGeometry> & IfcEntityMixin & { type; ifcType }`. |

### New module `src/services/factories/bim-binding-params.ts`
`resolveBindingParams(input, label)` — the ADR-369 binding validation + defaults, generic over the caller's param shape. Consumed by `resolveWallParams` / `resolveColumnParams` (now thin wrappers).

### Migrations (23 factories)
- `interface CreateXInput extends CreateBimEntityInputBase { params; geometry; …extras }`.
- `createX` returns `assembleBimEntity({ type, kind, layerId, params, geometry, ifcType, generateId }, input)`. Factories with extra fields spread them onto the result (`{ ...assembleBimEntity(...), ...(input.typeId && {…}), predefinedType }`).
- `wall` / `column` `resolveXParams` delegate to `resolveBindingParams`.

**Public API unchanged** → `createBeam(input)` etc. keep their signatures; consumers untouched.

> **i18n note (N.11):** `resolveBindingParams` carries the two `throw new Error(...)` developer messages verbatim from the old inline code — server-side developer errors, not user-facing i18n; the audit only flags `t(..., { defaultValue })`.

---

## Consequences

- **−165 clones** globally (4465 → 4300), 0 clones in the refactored fileset (`jscpd:diff`).
- One place now owns the BIM-entity assembly + binding-defaults contract — a future `BaseEntity` field or IFC default changes in one primitive, not 23.
- `building` / `floor` factories deliberately excluded (top-level Firestore, non-BIM — no IFC mixin, no binding).

---

## Verification
- `npx jest src/services/factories/__tests__/bim-entity-factory-base.test.ts` → **8 GREEN** (spread / assemble id+ifcGuid+validation+overrides / binding defaults + throws).
- `npx jest src/services/factories/__tests__` → **228 GREEN** (8 pre-existing factory suites — beam/building/column/floor/foundation/opening/slab/wall — regression-verify the assembler path, + the new base suite).
- `npm run jscpd:diff -- <27 files>` → **0 new clones**.
- `npm run jscpd:check` → **4300/4465 (−165)**.
- ❌ No `tsc` (N.17 — agents do not run TypeScript checks).

## Changelog
- **2026-07-08** — Created. New `bim-entity-factory-base.ts` (`spreadBimEntityCommonFields` + `assembleBimEntity` + input base types) + `bim-binding-params.ts` (`resolveBindingParams`) + 23 factory migrations + `bim-entity-factory-base.test.ts` (8 tests). jscpd 4465 → 4300.
