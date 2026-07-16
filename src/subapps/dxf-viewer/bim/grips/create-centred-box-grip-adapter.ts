/**
 * ADR-602 — Centred-box grip **adapter** factory (thin-wrapper SSoT).
 *
 * The centred rotatable-box grip GEOMETRY + drag math already live in ONE place
 * (`bim/grips/centred-box-grips.ts`, itself over the entity-agnostic
 * `rect-grip-engine`). What was still copy-pasted across the 8 consuming entities
 * was the *thin adapter* around it — the third leg after B2 (persistence) + B4
 * (placement) of the SAME MEP / furniture / floorplan family:
 *
 *   1. the `ROLE_TO_KIND` / `KIND_TO_ROLE` maps (6 + 6 entries, mechanically
 *      `${prefix}-${role}`);
 *   2. the `getX` emit loop (`getCentredBoxGrips(...).map(...)` wrapping each grip
 *      into the entity's `GripInfo` discriminant field);
 *   3. the `applyX` drag delegation (role lookup → `applyCentredBoxGripDrag` →
 *      spread patch back onto the entity params);
 *   4. the `XGripDragInput` interface (the SAME 5 fields every time).
 *
 * This factory owns (1)-(4) once. Each entity provides only what genuinely
 * differs — the grip-kind prefix, the min dimension, the discriminant-field
 * binding, and (for entities whose param field names differ) a `toBoxParams` /
 * `fromBoxPatch` pair. NO new grip core is created here; the geometry SSoT is
 * untouched.
 *
 * **No-God-shell**: entities with affordances OUTSIDE a centred rectangle keep
 * those locally and compose the factory as an escape-hatch — the MEP fixture's
 * `circular` diameter handle and the manifold's Revit ▲/▼ outlet action grips
 * wrap `adapter.getGrips` / `adapter.applyGripDrag` and add their extra path. The
 * wall-hosted opening (`bim/walls/opening-grips.ts`) is genuinely divergent
 * (outline-derived positions, wall-constrained drag, flip/facing/re-host) and is
 * intentionally EXCLUDED — it only borrows the ROLE vocabulary, not this adapter.
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps.
 *
 * @see bim/grips/centred-box-grips.ts — the shared box geometry + drag SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-602-centred-box-grip-adapter-ssot.md
 */

import type { GripInfo } from '../../hooks/grip-types';
import type { SceneUnits } from '../../utils/scene-units';
import {
  getCentredBoxGrips,
  applyCentredBoxGripDrag,
  type CentredBoxGripRole,
  type CentredBoxParams,
  type CentredBoxPatch,
} from './centred-box-grips';

// ─── Prefix → grip-kind maps (mechanical `${prefix}-${role}`) ─────────────────

/**
 * Every centred-box consumer names its grip kinds `${prefix}-${role}` (e.g.
 * `'mep-boiler-move'`, `'electrical-panel-corner-ne'`). This template-literal
 * type reconstructs that union from the prefix, so `CentredBoxKind<'mep-boiler'>`
 * is structurally identical to the hand-written `MepBoilerGripKind`.
 */
export type CentredBoxKind<P extends string> = `${P}-${CentredBoxGripRole}`;

/** Canonical role order (matches `centred-box-grips` emission: move + rotation + 4 corners). */
const CENTRED_BOX_ROLES: readonly CentredBoxGripRole[] = [
  'move',
  'rotation',
  'corner-ne',
  'corner-nw',
  'corner-sw',
  'corner-se',
];

/**
 * Build the `roleToKind` / `kindToRole` maps for a centred-box consumer from its
 * grip-kind `prefix`. Replaces the two hand-written 6-entry maps every adapter
 * used to copy-paste. The `${prefix}-${role}` concatenation is provably a
 * `CentredBoxKind<P>`, so the assertions here are exact narrowings (never `any`).
 */
export function buildCentredBoxKindMaps<P extends string>(
  prefix: P,
): {
  readonly roleToKind: Readonly<Record<CentredBoxGripRole, CentredBoxKind<P>>>;
  readonly kindToRole: Readonly<Record<CentredBoxKind<P>, CentredBoxGripRole>>;
} {
  const roleToKind = {} as Record<CentredBoxGripRole, CentredBoxKind<P>>;
  const kindToRole = {} as Record<CentredBoxKind<P>, CentredBoxGripRole>;
  for (const role of CENTRED_BOX_ROLES) {
    const kind = `${prefix}-${role}` as CentredBoxKind<P>;
    roleToKind[role] = kind;
    kindToRole[kind] = role;
  }
  return { roleToKind, kindToRole };
}

// ─── Adapter contract ─────────────────────────────────────────────────────────

/** The `GripInfo` fields the box emitter fills; the caller adds its discriminant. */
export type CentredBoxGripInfoBase = Pick<
  GripInfo,
  'entityId' | 'gripIndex' | 'type' | 'position' | 'movesEntity'
>;

/**
 * The drag input shared by every centred-box adapter — the SAME 5 fields the 8
 * entities each re-declared as `XGripDragInput`. Each entity re-exports a named
 * alias (`export type XGripDragInput = CentredBoxAdapterDragInput<XParams>`) so
 * its public API stays byte-compatible.
 */
export interface CentredBoxAdapterDragInput<TParams> {
  /** Original params at drag start (preserves invariants). */
  readonly originalParams: TParams;
  /** World-space delta from the grip anchor to the current cursor position. */
  readonly delta: { readonly x: number; readonly y: number };
  /** ORTHO (F8) active → corner resize constrained to the dominant local axis. */
  readonly ortho?: boolean;
  /** Rotation centre for the 6-click hot-grip (AutoCAD ROTATE→Reference). */
  readonly pivot?: { readonly x: number; readonly y: number };
  /** World cursor position (= grip anchor + `delta`). Pivot-rotate path only. */
  readonly currentPos?: { readonly x: number; readonly y: number };
}

/**
 * Config for a centred-box grip adapter. `TEntity` must expose `id` + `params`
 * (every BIM entity does); `toBoxParams` / `fromBoxPatch` bridge param field-name
 * differences (identity + spread for entities whose params already match the box
 * shape). `toGripInfo` binds the entity's `GripInfo` discriminant field.
 */
export interface CentredBoxGripAdapterConfig<
  TEntity extends { readonly id: string; readonly params: TParams },
  TParams,
  TKind extends string,
> {
  readonly roleToKind: Readonly<Record<CentredBoxGripRole, TKind>>;
  readonly kindToRole: Readonly<Partial<Record<TKind, CentredBoxGripRole>>>;
  /** mm — minimum footprint dimension; corner resize clamps to this. */
  readonly minDimensionMm: number;
  /** Project the entity params onto the box SSoT view (identity when field names match). */
  readonly toBoxParams: (params: TParams) => CentredBoxParams;
  /** Fold a box patch back onto the full entity params (spread when field names match). */
  readonly fromBoxPatch: (original: TParams, patch: CentredBoxPatch) => TParams;
  /** Wrap a role-derived grip into the entity's `GripInfo` (adds the discriminant field). */
  readonly toGripInfo: (base: CentredBoxGripInfoBase, kind: TKind) => GripInfo;
}

/** The two pure functions a centred-box grip module exposes. */
export interface CentredBoxGripAdapter<
  TEntity extends { readonly id: string; readonly params: TParams },
  TParams,
  TKind extends string,
> {
  readonly getGrips: (entity: TEntity) => GripInfo[];
  readonly applyGripDrag: (
    kind: TKind,
    input: CentredBoxAdapterDragInput<TParams>,
  ) => TParams;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Build the `{ getGrips, applyGripDrag }` pair for a centred rotatable-box entity.
 * Delegates 100% to the box geometry / drag SSoT; the entity supplies only the
 * kind maps, the min dimension, the param bridge, and the discriminant binding.
 *
 * `applyGripDrag` returns `originalParams` referentially unchanged on any no-op
 * (zero delta / unknown kind → the box SSoT yields `null`), so the commit path
 * short-circuits exactly as the hand-written adapters did.
 */
export function createCentredBoxGripAdapter<
  TEntity extends { readonly id: string; readonly params: TParams },
  TParams,
  TKind extends string,
>(
  config: CentredBoxGripAdapterConfig<TEntity, TParams, TKind>,
): CentredBoxGripAdapter<TEntity, TParams, TKind> {
  const { roleToKind, kindToRole, minDimensionMm, toBoxParams, fromBoxPatch, toGripInfo } = config;

  function getGrips(entity: TEntity): GripInfo[] {
    return getCentredBoxGrips(toBoxParams(entity.params)).map((g) =>
      toGripInfo(
        {
          entityId: entity.id,
          gripIndex: g.gripIndex,
          type: g.type,
          position: g.position,
          movesEntity: g.movesEntity,
        },
        roleToKind[g.role],
      ),
    );
  }

  function applyGripDrag(kind: TKind, input: CentredBoxAdapterDragInput<TParams>): TParams {
    const { originalParams } = input;
    const role = kindToRole[kind];
    if (!role) return originalParams;
    const patch = applyCentredBoxGripDrag(role, {
      originalParams: toBoxParams(originalParams),
      delta: input.delta,
      minDimensionMm,
      ortho: input.ortho,
      ...(input.pivot ? { pivot: input.pivot } : {}),
      ...(input.currentPos ? { currentPos: input.currentPos } : {}),
    });
    if (!patch) return originalParams;
    return fromBoxPatch(originalParams, patch);
  }

  return { getGrips, applyGripDrag };
}

// ─── Shared param bridge: mm-suffixed centred box (furniture / floorplan-symbol) ─

/**
 * The params shape of the centred-box entities whose field names are mm-suffixed
 * (`rotationDeg` / `widthMm` / `depthMm`) instead of the box SSoT's
 * (`rotation` / `width` / `length`). Furniture and floorplan-symbol share it 1:1.
 */
export interface MmSuffixedBoxParams {
  // `z` optional to match `Point3D` (the shape furniture/floorplan-symbol params carry) and
  // `CentredBoxParams.position` — a plan symbol's z is 0/derived, never a required authored field.
  readonly position: { readonly x: number; readonly y: number; readonly z?: number };
  readonly rotationDeg: number;
  readonly widthMm: number;
  readonly depthMm: number;
  readonly sceneUnits?: SceneUnits;
}

/**
 * The `toBoxParams` / `fromBoxPatch` pair for an `MmSuffixedBoxParams`-shaped
 * entity — ONE SSoT for the field remap so furniture / floorplan-symbol don't ship
 * twin bridges (N.18 anti-duplication). Spread into the adapter config:
 * `...mmSuffixedBoxBridge<FurnitureParams>()`.
 */
export function mmSuffixedBoxBridge<T extends MmSuffixedBoxParams>(): {
  readonly toBoxParams: (params: T) => CentredBoxParams;
  readonly fromBoxPatch: (original: T, patch: CentredBoxPatch) => T;
} {
  return {
    toBoxParams: (params) => ({
      position: { x: params.position.x, y: params.position.y, z: params.position.z },
      rotation: params.rotationDeg,
      width: params.widthMm,
      length: params.depthMm,
      sceneUnits: params.sceneUnits,
    }),
    fromBoxPatch: (original, patch) => ({
      ...original,
      position: { x: patch.position.x, y: patch.position.y, z: patch.position.z },
      rotationDeg: patch.rotation,
      widthMm: patch.width,
      depthMm: patch.length,
    }),
  };
}
