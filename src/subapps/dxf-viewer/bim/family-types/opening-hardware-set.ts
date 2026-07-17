/**
 * Opening Hardware-Set SSoT (ADR-674 Φ Α — hardware take-off model).
 *
 * The single source that says, PER opening kind, WHICH purchasable hardware
 * items it carries and HOW MANY (Revit-standard door/window hardware set). One
 * catalog drives BOTH the 3D geometry side (`opening-hardware-builders.ts` —
 * whether to draw a handle) and the take-off / BOQ side (item counts), so the
 * two can never drift: {@link openingHasOperableHardware} is the extracted
 * predicate and MUST equal `resolveOpeningHardwareSet(...).length > 0`.
 *
 * Pure and side-effect free — mirrors `resolve-opening-material.ts` («resolver»
 * idiom): given `OpeningParams`, returns the resolved, ready-to-consume item
 * rows. Every item is metal → its `materialId` is `resolveOpeningMaterial().hardware`
 * (default `mat-metal`); the material is NEVER re-derived here (SSoT: ADR-611).
 *
 * The catalog is EXHAUSTIVE over {@link OpeningKind} (compile-time total via
 * `Record<OpeningKind, …>`): a new kind cannot be added to the union without
 * declaring its hardware set (or an empty set) here.
 *
 * `labelKey` is a namespace-free i18n stem per component (e.g. `hardwareComponent.lever`);
 * Phase B localises it. The component→labelKey mapping is the SSoT for this file.
 *
 * @see ../../bim-3d/converters/opening-hardware-builders.ts — 3D handle parity
 * @see ./resolve-opening-material.ts — resolves the `hardware` material id (reused)
 * @see ./resolve-opening-frame-profile.ts — sibling resolver idiom
 */

import type { OpeningHardwareOverrides, OpeningKind, OpeningParams } from '../types/opening-types';
import { resolveOpeningMaterial } from './resolve-opening-material';
import type { OpeningTypeParams } from '../types/bim-family-type';

/**
 * A single purchasable hardware component. Exactly nine — the union spans every
 * item any {@link OpeningKind} in the catalog can carry (no more, no fewer).
 */
export type OpeningHardwareComponent =
  | 'lever'
  | 'pull-handle'
  | 'knob'
  | 'window-handle'
  | 'lockset'
  | 'hinge'
  | 'flush-bolt'
  | 'sliding-track'
  | 'friction-stay';

/** i18n key stem (namespace-free) per component — Phase B localises it. SSoT. */
export const HARDWARE_COMPONENT_LABEL_KEY: Readonly<
  Record<OpeningHardwareComponent, string>
> = {
  'lever': 'hardwareComponent.lever',
  'pull-handle': 'hardwareComponent.pullHandle',
  'knob': 'hardwareComponent.knob',
  'window-handle': 'hardwareComponent.windowHandle',
  'lockset': 'hardwareComponent.lockset',
  'hinge': 'hardwareComponent.hinge',
  'flush-bolt': 'hardwareComponent.flushBolt',
  'sliding-track': 'hardwareComponent.slidingTrack',
  'friction-stay': 'hardwareComponent.frictionStay',
};

/** One catalog row — a component and its per-opening default count (Revit standard). */
export interface HardwareSetEntry {
  readonly component: OpeningHardwareComponent;
  readonly quantity: number;
}

/** A fully-resolved take-off item: catalog row + resolved metal material id + label stem. */
export interface ResolvedHardwareItem {
  readonly component: OpeningHardwareComponent;
  readonly quantity: number;
  /** Resolved from `resolveOpeningMaterial().hardware` — all hardware is metal. */
  readonly materialId: string;
  /** Namespace-free i18n stem (see {@link HARDWARE_COMPONENT_LABEL_KEY}). */
  readonly labelKey: string;
}

/**
 * Per-`OpeningKind` default hardware set (Revit-standard quantities). Kinds with
 * NO user-operable hardware (`fixed` / `bay-window` / `overhead-door` /
 * `revolving-door`) map to an empty set — in exact parity with the 3D
 * `buildHardwareSpecs()` dispatch (which draws no handle for those kinds).
 *
 * EXHAUSTIVE over `OpeningKind` (compile-time total) — the SSoT for both sides.
 */
export const OPENING_HARDWARE_CATALOG: Readonly<
  Record<OpeningKind, ReadonlyArray<HardwareSetEntry>>
> = {
  // ─── Doors ────────────────────────────────────────────────────────────────
  'door': [
    { component: 'lever', quantity: 1 },
    { component: 'lockset', quantity: 1 },
    { component: 'hinge', quantity: 3 },
  ],
  'double-door': [
    { component: 'lever', quantity: 2 },
    { component: 'lockset', quantity: 1 },
    { component: 'hinge', quantity: 6 },
    { component: 'flush-bolt', quantity: 2 },
  ],
  'french-door': [
    { component: 'lever', quantity: 2 },
    { component: 'lockset', quantity: 1 },
    { component: 'hinge', quantity: 6 },
    { component: 'flush-bolt', quantity: 2 },
  ],
  'sliding-door': [
    { component: 'pull-handle', quantity: 1 },
    { component: 'sliding-track', quantity: 1 },
  ],
  'double-sliding-door': [
    { component: 'pull-handle', quantity: 2 },
    { component: 'sliding-track', quantity: 1 },
  ],
  'pocket-door': [
    { component: 'pull-handle', quantity: 1 },
    { component: 'sliding-track', quantity: 1 },
  ],
  'bifold-door': [
    { component: 'knob', quantity: 1 },
    { component: 'hinge', quantity: 3 },
  ],
  'overhead-door': [],
  'revolving-door': [],
  // ─── Windows ──────────────────────────────────────────────────────────────
  'window': [
    { component: 'window-handle', quantity: 1 },
    { component: 'hinge', quantity: 2 },
  ],
  'fixed': [],
  'double-hung-window': [{ component: 'window-handle', quantity: 1 }],
  'sliding-window': [
    { component: 'pull-handle', quantity: 1 },
    { component: 'sliding-track', quantity: 1 },
  ],
  'awning-window': [
    { component: 'window-handle', quantity: 1 },
    { component: 'friction-stay', quantity: 2 },
  ],
  'hopper-window': [
    { component: 'window-handle', quantity: 1 },
    { component: 'friction-stay', quantity: 2 },
  ],
  'tilt-turn-window': [
    { component: 'window-handle', quantity: 1 },
    { component: 'hinge', quantity: 2 },
  ],
  'bay-window': [],
};

/**
 * TRUE iff the catalog set for `kind` is non-empty — i.e. the opening's FAMILY
 * carries user-operable hardware. This is the KIND-level geometry guard shared by
 * the geometry side (`buildHardwareSpecs` early guard) and the take-off candidate
 * route, so they cannot drift; it MUST agree with the 3D handle dispatch (empty
 * for fixed/bay-window/overhead-door/revolving-door). For UN-overridden params it
 * equals `resolveOpeningHardwareSet(...).length > 0`; ADR-674 per-instance
 * quantity overrides operate BELOW this guard (they retune counts of an already
 * hardware-bearing kind), so this predicate stays a pure function of `kind`.
 */
export function openingHasOperableHardware(kind: OpeningKind): boolean {
  return OPENING_HARDWARE_CATALOG[kind].length > 0;
}

/**
 * Fold one per-component override layer onto the working quantity map (LAST wins).
 * A defined value REPLACES the component's quantity (`0` ⇒ removed downstream); a
 * component absent from the catalog default is ADDED. Undefined values are skipped
 * so a sparse override never wipes a catalog default. Mirrors the per-part fold of
 * `resolve-opening-material.ts`.
 */
function applyHardwareOverrides(
  quantities: Map<OpeningHardwareComponent, number>,
  overrides: OpeningHardwareOverrides | undefined,
): void {
  if (!overrides) return;
  for (const key of Object.keys(overrides) as OpeningHardwareComponent[]) {
    const value = overrides[key];
    if (value !== undefined) quantities.set(key, value);
  }
}

/**
 * Resolve the hardware take-off for a placed opening: the per-kind catalog rows
 * FOLDED with the family-type and per-instance quantity overrides (ADR-674), each
 * stamped with the resolved metal `materialId` (from `resolveOpeningMaterial().hardware`)
 * and the component's i18n `labelKey` stem.
 *
 * ─── QUANTITY FOLD, PER COMPONENT (LAST wins) ────────────────────────────────
 *   1. `OPENING_HARDWARE_CATALOG[kind]` — the Revit-standard default count.
 *   2. `typeParams.hardwareOverrides`   — the family Type default (all instances).
 *   3. `params.hardwareOverrides`       — the per-placement override («this door»).
 * Components folding to `≤ 0` are dropped (an override of `0` removes a component).
 *
 * Un-overridden params reproduce the catalog set exactly (zero regression). The
 * material is resolved ONCE (all items are metal → same id) and only when at least
 * one positive row survives — empty-set kinds still short-circuit to `[]`.
 *
 * @param params      Instance opening params (the take-off subject + instance override).
 * @param typeParams  Optional family-type params (material resolver + type-default override).
 */
export function resolveOpeningHardwareSet(
  params: OpeningParams,
  typeParams?: OpeningTypeParams | null,
): ReadonlyArray<ResolvedHardwareItem> {
  // Catalog default → family-type override → instance override (LAST wins). Insertion
  // order preserves the catalog sequence; overridden components keep their slot, added
  // components append (deterministic schedule breakdown order).
  const quantities = new Map<OpeningHardwareComponent, number>();
  for (const entry of OPENING_HARDWARE_CATALOG[params.kind]) {
    quantities.set(entry.component, entry.quantity);
  }
  applyHardwareOverrides(quantities, typeParams?.hardwareOverrides);
  applyHardwareOverrides(quantities, params.hardwareOverrides);

  const items: ResolvedHardwareItem[] = [];
  let materialId: string | null = null;
  for (const [component, quantity] of quantities) {
    if (quantity <= 0) continue; // 0 / negative override removes the component
    if (materialId === null) materialId = resolveOpeningMaterial(params, typeParams).hardware;
    items.push({
      component,
      quantity,
      materialId,
      labelKey: HARDWARE_COMPONENT_LABEL_KEY[component],
    });
  }
  return items;
}
