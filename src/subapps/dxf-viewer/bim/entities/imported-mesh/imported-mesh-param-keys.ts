/**
 * ADR-683 Φ3.1γ (A1) — Imported-mesh param command-keys (SSoT).
 *
 * Mirror of `bim/railings/railing-param-keys.ts` (ADR-407 Φ9): ONE source of truth for the
 * `commandKey` strings a future Properties-palette row / ribbon bridge would read/write through,
 * shared by both consumers so a label or key rename happens once. This file is **pure data** —
 * zero React/DOM/Firestore, exactly like its railing sibling.
 *
 * ## Why this schema is NOT a 1:1 mirror of railing's shape
 *
 * Railing has ~18 authored parameters (heights/widths/enums) — a genuinely parametric object.
 * `ImportedMeshEntity` (ADR-683 §3) is deliberately **not** parametric: the mesh geometry is
 * measured from imported triangles, not authored, and reshaping it is explicitly forbidden. Two
 * consequences that make this file's shape differ on purpose:
 *
 *  - **No `scale` key.** There is no uniform-scale (or any resize) field anywhere in
 *    `ImportedMeshParams` — only `measuredWidthMm/measuredDepthMm/measuredHeightMm`, which
 *    `UpdateImportedMeshParamsCommand.validate()` **rejects** if changed (mirrors the partner's
 *    geometry, §3). Do NOT invent a scale control on top of this SSoT — there is nothing to drive.
 *  - **No editable `name` key.** `nodeName` is the `.glb` node identity — half of the
 *    `<uploadId>#<nodeName>` mesh-cache key (`imported-mesh-types.ts`). Renaming it here would
 *    desync the entity from its cached mesh. It is exposed **read-only** (`IMPORTED_MESH_READONLY_KEYS.name`).
 *
 * ## Writable set: continuous coordinates, not a combobox ladder
 *
 * Railing's numeric fields are discrete engineering choices (baluster width ∈ {12,16,20,…}), so
 * they ship with `literalNumberOptions` ladders consumed by a `<Select>`. Position/rotation are
 * continuous — there is no finite ladder that makes sense — so this file exports **no option
 * ladders**. A future numeric-typed-input row (not `BimPropertyRow`'s select-only model) is the
 * right widget; that choice belongs to the consumer, not this data layer.
 *
 * ## `displayName` — the ONE writable string field (ADR-683 Φ3.1γ follow-up)
 *
 * Everything above (and the file's original header note "No editable `name` key") predates the
 * Properties-palette click-to-edit identity row. `nodeName` stays read-only for the reason
 * documented there (mesh-cache key half); `displayName` is a NEW, separate, purely presentational
 * field (`ImportedMeshParams.label`) added specifically so the palette can offer an AutoCAD/Revit
 * "Rename" affordance without touching the `.glb` identity. It is grouped into the SAME
 * `isImportedMeshRibbonStringKey` guard as the read-only readouts (both resolve through
 * `readImportedMeshField`, so `getComboboxState` treats them uniformly) — the write-side asymmetry
 * survives at the `patchImportedMeshField` level, which now routes `displayName` to an actual
 * mutation instead of the read-only no-op every other member of that bucket gets.
 *
 * ## ⚠️ Read before wiring `posX/posY/elevation/rotation` into the ribbon (for B1/B2)
 *
 * `contextual-imported-mesh-tab.ts` (ADR-683 Φ3.1β) is **explicitly actions-only** — its own header
 * states "no properties, ever" because position/rotation are edited via the two move/rotation grips
 * (`imported-mesh-grips.ts`), not typed fields, and `BimPropertyRow`/`RibbonCombobox` are select-only
 * widgets (Radix `<Select>`, no freeform numeric entry) that suit a discrete ladder poorly for
 * continuous coordinates. Wiring these keys into a NEW ribbon properties panel would contradict
 * that documented decision. Recommendation: surface them (if at all) as a **Properties-palette
 * readout/typed-input** (Revit-style instance parameters), not a ribbon combobox tab — flagged in
 * this phase's `blockers` for the orchestrator/Giorgio to confirm before any UI wiring lands.
 *
 * @see ./imported-mesh-param-access.ts — `readImportedMeshField` / `patchImportedMeshField`
 * @see ./imported-mesh-types.ts — `ImportedMeshParams` (the schema these keys index into)
 * @see ../../railings/railing-param-keys.ts — the pattern this file mirrors
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §3, §10.1, §10.2
 */

/**
 * Numeric (mm / deg), **writable** fields — routed via `isImportedMeshRibbonKey`. All four are
 * legitimate mutations of `ImportedMeshParams` today: `applyImportedMeshGripDrag` already writes
 * `position.x/y` + `rotationDeg` through `UpdateImportedMeshParamsCommand`, and `elevation`
 * (`mountingElevationMm`) is a plain stored field that command's `applyPatch` recomputes geometry
 * for unconditionally — no new command needed, this SSoT just gives it a typed key.
 */
export const IMPORTED_MESH_NUMBER_KEYS = {
  posX: 'importedMesh.number.posX',
  posY: 'importedMesh.number.posY',
  /**
   * mm — `mountingElevationMm` (height above floor FFL), NOT `position.z`. `position.z` is
   * vestigial for this entity: `computeCentredBoxFootprint` hardcodes `z: 0` in the footprint math
   * (`bim/geometry/shared/centred-box-footprint.ts`) and `moveImportedMesh` (`bim-move-geometry.ts`)
   * only ever translates X/Y — unlike the MEP hosts, there is no wired vertical-move path for this
   * entity yet. `mountingElevationMm` is the field the 3D converter actually reads for placement
   * height, so it is the correct target for a "Z position" control.
   */
  elevation: 'importedMesh.number.elevation',
  /** deg — `rotationDeg`, CCW in plan around `position`. */
  rotation: 'importedMesh.number.rotation',
} as const;

/**
 * Read-only display fields — routed via `isImportedMeshRibbonStringKey`. Unlike railing's
 * "string keys" (which ARE writable enums/booleans), every key here is a **readout**: either an
 * immutable identity (`name`), a measured quantity that must never be hand-edited (§3), or a value
 * whose ONE write path is a dedicated command that already exists elsewhere (see field docs).
 */
export const IMPORTED_MESH_READONLY_KEYS = {
  /** The `.glb` node name (`nodeName`) — identity, not a display label; see file header. */
  name: 'importedMesh.readonly.name',
  /** mm, rounded — `measuredWidthMm`. Measured from triangles; editing would deform the partner's mesh. */
  width: 'importedMesh.readonly.width',
  /** mm, rounded — `measuredDepthMm`. */
  depth: 'importedMesh.readonly.depth',
  /** mm, rounded — `measuredHeightMm`. */
  height: 'importedMesh.readonly.height',
  /** `storeyId` (floor reference). Absent → `null` (unassigned). */
  level: 'importedMesh.readonly.level',
  /** `sourceMaterialName` — the dominant `.glb` material name, or `null` if the node had none. */
  currentMaterial: 'importedMesh.readonly.currentMaterial',
  /** `materialSlots` joined for display (`"Inox_304, Wood_Oak"`), or `null` if single/anonymous. */
  materialSlots: 'importedMesh.readonly.materialSlots',
  /**
   * `importedMeshIdentity.categoryCode` — the ATOE costing assignment. Write path is
   * `withImportedMeshIdentity` / `AssignImportedMeshIdentityCommand` (a guided multi-field dialog,
   * ADR-683 §10.2) — deliberately NOT this generic single-value patch surface.
   */
  boqCategoryCode: 'importedMesh.readonly.boqCategoryCode',
  /** `importedMeshIdentity.titleEL`. */
  boqTitle: 'importedMesh.readonly.boqTitle',
  /** `importedMeshIdentity.unit`. */
  boqUnit: 'importedMesh.readonly.boqUnit',
} as const;

/**
 * ADR-683 Φ3.1γ (follow-up) — the ONE writable string field. Separate constant (not folded into
 * `IMPORTED_MESH_READONLY_KEYS`, which stays a truthful "read-only" bucket) — see file header for
 * why `displayName` exists and how it differs from `name`/`nodeName`.
 */
export const IMPORTED_MESH_STRING_KEYS = {
  /** `label` — click-to-edit display identity (`control:'rename'`); falls back to `nodeName`. */
  displayName: 'importedMesh.string.displayName',
} as const;

/** Convenience aggregate (mirror `RAILING_RIBBON_KEYS`). */
export const IMPORTED_MESH_RIBBON_KEYS = {
  number: IMPORTED_MESH_NUMBER_KEYS,
  readonly: IMPORTED_MESH_READONLY_KEYS,
  string: IMPORTED_MESH_STRING_KEYS,
} as const;

/**
 * Field label i18n keys (SSoT). Reuses the `ribbon.commands.importedMesh` namespace already
 * established by `contextual-imported-mesh-tab.ts` (ADR-683 Φ3.1β) rather than minting a second
 * prefix for the same entity. Translations are added by whichever agent wires the consuming UI.
 */
export const IMPORTED_MESH_LABEL_KEYS = {
  posX: 'ribbon.commands.importedMesh.posX',
  posY: 'ribbon.commands.importedMesh.posY',
  elevation: 'ribbon.commands.importedMesh.elevation',
  rotation: 'ribbon.commands.importedMesh.rotation',
  name: 'ribbon.commands.importedMesh.name',
  displayName: 'ribbon.commands.importedMesh.displayName',
  width: 'ribbon.commands.importedMesh.width',
  depth: 'ribbon.commands.importedMesh.depth',
  height: 'ribbon.commands.importedMesh.height',
  level: 'ribbon.commands.importedMesh.level',
  currentMaterial: 'ribbon.commands.importedMesh.currentMaterial',
  materialSlots: 'ribbon.commands.importedMesh.materialSlots',
  boqCategoryCode: 'ribbon.commands.importedMesh.boqCategoryCode',
  boqTitle: 'ribbon.commands.importedMesh.boqTitle',
  boqUnit: 'ribbon.commands.importedMesh.boqUnit',
} as const;

const NUMBER_KEY_SET: ReadonlySet<string> = new Set(Object.values(IMPORTED_MESH_NUMBER_KEYS));
// Both flavours resolve through `readImportedMeshField` the same way (a non-numeric readout), so
// the "string key" guard covers the read-only bucket AND the one writable `displayName` field —
// the write-side distinction (readout vs. real mutation) lives in `patchImportedMeshField`, not here.
const STRING_KEY_SET: ReadonlySet<string> = new Set([
  ...Object.values(IMPORTED_MESH_READONLY_KEYS),
  ...Object.values(IMPORTED_MESH_STRING_KEYS),
]);

/** `true` when `key` is a numeric, writable imported-mesh field (posX/posY/elevation/rotation). */
export function isImportedMeshRibbonKey(key: string): boolean {
  return NUMBER_KEY_SET.has(key);
}

/**
 * `true` when `key` is a non-numeric imported-mesh display field — the read-only readouts
 * (`IMPORTED_MESH_READONLY_KEYS`) PLUS the one writable `displayName` (`IMPORTED_MESH_STRING_KEYS`).
 * Mirrors railing's dual-gate shape (`getComboboxState` resolves both families uniformly); unlike
 * railing, most members here are still read-only — `patchImportedMeshField` is what actually
 * distinguishes "no-op" from "real mutation" for a given key in this bucket.
 */
export function isImportedMeshRibbonStringKey(key: string): boolean {
  return STRING_KEY_SET.has(key);
}

/** `true` when `key` belongs to the imported-mesh surface at all (either flavour). */
export function isAnyImportedMeshRibbonKey(key: string): boolean {
  return isImportedMeshRibbonKey(key) || isImportedMeshRibbonStringKey(key);
}
