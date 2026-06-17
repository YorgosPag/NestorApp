/**
 * storey-creation-defaults — SSoT for inheriting BIM creation defaults from the
 * {@link ActiveStoreyContext} at the moment a new entity is born (ADR-448 Phase 2).
 *
 * ONE place reads the active-storey store (non-React `getState()`, mirroring how
 * `bim3d-resync` consumes `Bim3DEntitiesStore`) and applies the canonical
 * precedence:
 *
 *     explicit override → active-storey default → legacy constant fallback
 *
 * Pure-ish: deterministic given the store state. When the store holds `null`
 * (no active floor link / initial state) every resolver collapses to the legacy
 * constant, so existing call sites (and their unit tests) keep their exact
 * behaviour — μηδέν regression by construction. Builders inject the `storey`
 * argument in tests for store-free determinism.
 *
 * @see systems/levels/active-storey-context.ts — the context shape + builder
 * @see systems/levels/active-storey-store.ts — the Zustand SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-448-storey-aware-dxf-viewer.md §6 Phase 2
 */

import type { FloorKind } from '@/utils/floor-naming';
import { useActiveStoreyStore } from './active-storey-store';
import type { ActiveStoreyContext } from './active-storey-context';

/**
 * Non-React read of the active storey context (SSoT). Safe in pure builders /
 * completion handlers — plain Zustand `getState()`, no hook rules apply (same
 * pattern as `bim3d-resync.ts`).
 */
export function readActiveStoreyContext(): ActiveStoreyContext | null {
  return useActiveStoreyStore.getState().context;
}

/**
 * SSoT — the active storey's floor-to-ceiling clear height (mm), **FLOOR-RELATIVE**
 * (ADR-450 §2). The single number that BOTH vertically-extruded structure (walls/
 * columns, stored as `params.height`) AND ceiling-bound structure (beams/slabs,
 * stored as floor-relative top FFL) resolve to — so a column's top and a beam's
 * top can never structurally diverge.
 *
 * Canonical source = `floor.height` (`storey.storeyHeightMm`), NOT the inter-floor
 * gap (`nextFloorElevationMm − floorElevationMm`). Rationale (ADR-450):
 *   1. Robust to a stale upper-floor elevation — the exact dual-source bug that
 *      produced a beam-top of 3000 while the column was 5000.
 *   2. Matches the server cascade (`floor-height-cascade.service.ts`), which
 *      derives beam `topElevation` from `floor.height`, not the gap.
 *   3. Correct when an intermediate floor is missing — the storey is one height
 *      tall (gap would wrongly give 2× height).
 * The ADR-450 floor-elevation cascade keeps `gap === floor.height`, so for
 * consistent data this equals the old gap formula exactly (μηδέν regression).
 *
 * Returns `null` when there is no active storey (degenerate → caller falls back
 * to its legacy per-entity constant).
 */
export function resolveStoreyCeilingRelativeMm(
  storey: ActiveStoreyContext | null = readActiveStoreyContext(),
): number | null {
  return storey?.storeyHeightMm ?? null;
}

/**
 * Storey-aware entity height (mm) for walls & columns: explicit ribbon override
 * wins, else the active storey's floor-to-ceiling clear height (SSoT,
 * {@link resolveStoreyCeilingRelativeMm}), else the legacy per-entity constant.
 * ADR-448 Phase 2 · ADR-450 §2.
 */
export function resolveStoreyHeightMm(
  overrideHeight: number | undefined,
  fallbackMm: number,
  storey: ActiveStoreyContext | null = readActiveStoreyContext(),
): number {
  return overrideHeight ?? resolveStoreyCeilingRelativeMm(storey) ?? fallbackMm;
}

/**
 * Storey-aware ceiling/roof slab top-face FFL & beam top (mm), **FLOOR-RELATIVE**.
 *
 * Entities in the single-floor editing scope are created level-relative with
 * FFL = 0 (see `column-from-grid.ts` `ACTIVE_LEVEL_FLOOR_MM = 0`), and the slab
 * `levelElevation` is "top face = FFL" with the ceiling default 3000 meaning
 * "storey 3.00m" (`slab-types.ts` `SLAB_KIND_DEFAULT_LEVEL_ELEVATION_MM`).
 *
 * ADR-450 §2 — unified onto the SAME SSoT as the column/wall height
 * ({@link resolveStoreyCeilingRelativeMm} = `floor.height`), so beam/slab tops and
 * column tops resolve to ONE number and cannot diverge. Precedence: explicit
 * override → floor-relative storey ceiling → legacy per-kind constant.
 */
export function resolveStoreyCeilingElevationMm(
  overrideElevation: number | undefined,
  fallbackMm: number,
  storey: ActiveStoreyContext | null = readActiveStoreyContext(),
): number {
  return overrideElevation ?? resolveStoreyCeilingRelativeMm(storey) ?? fallbackMm;
}

/**
 * ADR-467 — Διαβαθμισμένο SSoT: έχει η ΘΕΜΕΛΙΩΣΗ (πέδιλα/πεδιλοδοκοί/συνδετήριες/
 * εδαφόπλακες) στατικό νόημα στην ενεργή στάθμη; Η θεμελίωση ανήκει στις κατώτατες/
 * υπόγειες στάθμες — όχι σε υπέργειους ορόφους:
 *   - `foundation`            → ✅ ο φυσικός χώρος των θεμελιακών στοιχείων
 *   - `basement` (υπόγειο)    → ✅ βαθμιδωτή θεμελίωση / περιμετρικές πεδιλοδοκοί /
 *                                  εδαφόπλακα υπογείου (υπαρκτή πραγματική περίπτωση)
 *   - `ground` (ισόγειο)      → ✅ ΜΟΝΟ αν είναι ο κατώτατος όροφος (δεν υπάρχει
 *                                  υπόγειο/θεμελίωση από κάτω)
 *   - `standard`/`mezzanine`/`roof`/`stair-penthouse` → ❌ υπέργειες στάθμες, η
 *                                  θεμελίωση δεν έχει στατικό νόημα εκεί
 * `null` storey → καμία άποψη (degenerate → in-context, μηδέν regression).
 *
 * Κοινό SSoT για ΚΑΙ τον dim (ribbon gating, {@link import('../../ui/ribbon/hooks/bridge/storey-tool-gating').isCommandRecommendedForStorey})
 * ΚΑΙ το warning ({@link shouldWarnFoundationOnStorey}) — μία πηγή αλήθειας.
 */
export function isFoundationDisciplineInContext(
  storey: ActiveStoreyContext | null = readActiveStoreyContext(),
): boolean {
  if (storey === null) return true;
  switch (storey.storeyKind) {
    case 'foundation':
    case 'basement':
      return true;
    case 'ground':
      return storey.isLowestOccupiedStorey !== false;
    default:
      return false; // standard / mezzanine / roof / stair-penthouse / null kind
  }
}

/**
 * Whether creating a foundation / ground-bearing slab on the active storey
 * deserves a soft warning — i.e. the foundation discipline is OUT of context on
 * this storey ({@link isFoundationDisciplineInContext}). Revit-style: foundations
 * belong at foundation/basement levels (and the lowest ground when there is no
 * basement), but the engineer is allowed to place them anywhere (warn, don't
 * block). Returns `false` when there is no active storey (degenerate → no opinion).
 *
 * 🔑 The dedicated **foundation level** + every **basement** are the *correct* home
 * for footings / ground slabs, so they NEVER warn (incident 2026-06-16, Giorgio +
 * ADR-467 graduated gating). ADR-461.
 */
export function shouldWarnFoundationOnStorey(
  storey: ActiveStoreyContext | null = readActiveStoreyContext(),
): boolean {
  if (storey === null) return false;
  return !isFoundationDisciplineInContext(storey);
}

/**
 * Whether placing a regular (floor-framing) beam on the active storey deserves a soft
 * hint: true ONLY on the dedicated **foundation** level. A horizontal structural member
 * there is almost always a foundation tie-beam / grade beam (πεδιλοδοκός / συνδετήρια
 * δοκός) — a Structural Foundation member — rather than a storey-framing beam.
 *
 * Revit-style ADVISORY — «warn, don't block»: beams ARE allowed on the foundation
 * ({@link resolveStoreyDefaultEntityTypes}('foundation') includes 'beam', e.g. grade
 * beams), so this NEVER blocks; it only suggests the tie-beam classification. Returns
 * `false` for every other storey kind and when there is no active storey (degenerate →
 * no opinion). ADR-461.
 */
export function shouldWarnBeamOnFoundation(
  storey: ActiveStoreyContext | null = readActiveStoreyContext(),
): boolean {
  return storey?.storeyKind === 'foundation';
}

// ─── ADR-461 Phase C — per-kind creation-tool recommendation (SSoT) ──────────

/**
 * Discipline-level BIM tool category. Deliberately decoupled from the ribbon's
 * giant `ToolType` union: this stays a small, stable vocabulary so the per-storey
 * recommendation has zero dependency on the ribbon. The ribbon-side gating hook
 * (ADR-461 C4) maps each `commandKey` onto one of these categories.
 */
export type BimToolCategory =
  | 'wall'
  | 'column'
  | 'beam'
  | 'slab'
  | 'opening'
  | 'foundation'
  | 'stair'
  | 'railing'
  | 'roof'
  | 'finish';

/** Recommendation for which BIM disciplines are relevant on the active storey. */
export interface StoreyToolRecommendation {
  /** 'all' → every tool is relevant (counted storeys); 'subset' → only `categories`. */
  readonly mode: 'all' | 'subset';
  /** The recommended categories for this storey kind. */
  readonly categories: ReadonlySet<BimToolCategory>;
}

const ALL_BIM_TOOL_CATEGORIES: readonly BimToolCategory[] = [
  'wall', 'column', 'beam', 'slab', 'opening', 'foundation', 'stair', 'railing', 'roof', 'finish',
];

/**
 * SSoT — which BIM disciplines a storey of the given kind is primarily for, so the
 * UI can surface the right creation tools per active level (ADR-461 Phase C).
 * Counted storeys recommend everything ('all'); special levels narrow to their own
 * discipline:
 *   foundation       → πέδιλα / πεδιλοδοκοί / κοιτόστρωση  (foundation, beam, slab)
 *   stair-penthouse  → σκάλα / πλάκα-δώματος / τοίχοι       (stair, slab, wall, railing)
 *   roof             → πλάκα στέγης / στηθαίο               (slab, roof, railing)
 *
 * Revit-style ADVISORY — «warn, don't block» (mirrors {@link shouldWarnFoundationOnStorey}):
 * the recommendation drives emphasis/hints, never a hard restriction. Unknown/`null`
 * kind collapses to 'all' so existing behaviour is unchanged (μηδέν regression).
 */
export function resolveStoreyDefaultEntityTypes(kind: FloorKind | null): StoreyToolRecommendation {
  switch (kind) {
    case 'foundation':
      return { mode: 'subset', categories: new Set<BimToolCategory>(['foundation', 'beam', 'slab']) };
    case 'stair-penthouse':
      return { mode: 'subset', categories: new Set<BimToolCategory>(['stair', 'slab', 'wall', 'railing']) };
    case 'roof':
      return { mode: 'subset', categories: new Set<BimToolCategory>(['slab', 'roof', 'railing']) };
    default:
      return { mode: 'all', categories: new Set<BimToolCategory>(ALL_BIM_TOOL_CATEGORIES) };
  }
}
