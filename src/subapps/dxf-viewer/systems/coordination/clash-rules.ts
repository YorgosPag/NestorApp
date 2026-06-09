/**
 * ADR-435 — pluggable clash rules + severity (Slice 0).
 *
 * Hard clashes (solid interpenetration) always fire — no rule needed. Clearance
 * rules encode regulation gaps between services and live here as DATA, mirror of
 * the pluggable demand/sizing standards in the auto-design registry. v1 ships two
 * realistic, segment-classification-driven demos; more are added without touching
 * the engine.
 *
 * @see ./clash-types.ts
 */

import type { ClashEntity, ClashEntityKind, ClashRule, ClashSeverity } from './clash-types';

const STRUCTURAL: ReadonlySet<ClashEntityKind> = new Set(['beam', 'column', 'wall', 'slab']);

/** Is this a load-bearing structural element (drives high-severity penetrations)? */
export function isStructural(kind: ClashEntityKind): boolean {
  return STRUCTURAL.has(kind);
}

/** Severity of a confirmed HARD clash: structural penetration = high, else medium. */
export function hardSeverity(a: ClashEntityKind, b: ClashEntityKind): ClashSeverity {
  return isStructural(a) || isStructural(b) ? 'high' : 'medium';
}

const POTABLE: ReadonlySet<string> = new Set(['domestic-cold-water', 'domestic-hot-water']);
const DRAINAGE: ReadonlySet<string> = new Set(['sanitary-drainage']);
const FIRE: ReadonlySet<string> = new Set(['fire-sprinkler']);
const NON_FIRE_PIPE: ReadonlySet<string> = new Set([
  'domestic-cold-water', 'domestic-hot-water', 'sanitary-drainage', 'hydronic-supply', 'hydronic-return',
]);

function inSet(e: ClashEntity, set: ReadonlySet<string>): boolean {
  return e.discipline !== undefined && set.has(e.discipline);
}

/** Unordered match: one side in `setA`, the other in `setB`. */
function pairMatches(a: ClashEntity, b: ClashEntity, setA: ReadonlySet<string>, setB: ReadonlySet<string>): boolean {
  return (inSet(a, setA) && inSet(b, setB)) || (inSet(b, setA) && inSet(a, setB));
}

/**
 * v1 clearance demos (both segment↔segment, classification-driven):
 *   1. Drainage must keep a hygiene gap from potable water (50 mm).
 *   2. Fire-sprinkler mains keep a gap from other piped services (30 mm).
 */
export const DEFAULT_CLEARANCE_RULES: readonly ClashRule[] = [
  {
    id: 'drainage-potable-separation',
    type: 'clearance',
    clearanceMm: 50,
    severity: 'medium',
    applies: (a, b) => pairMatches(a, b, DRAINAGE, POTABLE),
  },
  {
    id: 'fire-services-separation',
    type: 'clearance',
    clearanceMm: 30,
    severity: 'low',
    applies: (a, b) => pairMatches(a, b, FIRE, NON_FIRE_PIPE),
  },
];

/** Largest clearance (metres) across the active rules — broad-phase search margin. */
export function maxClearanceM(rules: readonly ClashRule[]): number {
  let max = 0;
  for (const r of rules) {
    if (r.type === 'clearance' && r.clearanceMm !== undefined) {
      max = Math.max(max, r.clearanceMm * 0.001);
    }
  }
  return max;
}
