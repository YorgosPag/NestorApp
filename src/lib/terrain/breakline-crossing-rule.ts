/**
 * ADR-920 Β4.8 Β3.6 — the engineer's decision where two breaklines meet at two elevations (Civil 3D «Crossing
 * Breaklines» › Use Higher / Lower / Average / Specify Level), as a RULE the resolver applies on every build.
 *
 * Why a rule and not an edited vertex: Civil 3D keeps surface edits as operations replayed on rebuild, never as edits
 * of the source data — and here a live breakline re-derives its vertices from its source entity, so a baked node
 * would be lost on the next edit of the drawing line, silently. The rule survives that, and «higher» stays «higher»
 * when either line's own elevation changes.
 *
 * Matching is by the unordered PAIR plus position: a meeting point that moved more than
 * {@link CROSSING_RESOLUTION_MATCH_MM} is a different question, so the decision is reported as no longer applying —
 * never re-targeted to wherever the lines meet now.
 */

import type {
  Breakline,
  BreaklineCrossingResolution,
  CrossingResolutionKey,
  LocalOrigin,
} from './terrain-types';

/**
 * How far (WORLD mm, planimetric) a meeting point may drift from where it was decided and still be the SAME decision.
 * Survey-grade: 1 cm absorbs float noise and re-derivation round-off; any real edit of the line moves it further.
 */
export const CROSSING_RESOLUTION_MATCH_MM = 10;

/** The elevation a rule gives a meeting point, from the two lines' own statements there (same frame in and out). */
export function crossingRuleZ(resolution: BreaklineCrossingResolution, keptLineZ: number, otherLineZ: number): number {
  switch (resolution.rule) {
    case 'higher': return Math.max(keptLineZ, otherLineZ);
    case 'lower': return Math.min(keptLineZ, otherLineZ);
    case 'average': return (keptLineZ + otherLineZ) / 2;
    case 'specify': return resolution.z;
  }
}

/** Two keys name the same stored decision. */
export function sameCrossingResolutionKey(a: CrossingResolutionKey, b: CrossingResolutionKey): boolean {
  return a.ownerBreaklineId === b.ownerBreaklineId && a.withBreaklineId === b.withBreaklineId && a.x === b.x && a.y === b.y;
}

/** The key of the decision `resolution`, stored on breakline `ownerBreaklineId`. */
export function crossingResolutionKeyOf(
  ownerBreaklineId: string,
  resolution: BreaklineCrossingResolution,
): CrossingResolutionKey {
  return { ownerBreaklineId, withBreaklineId: resolution.withBreaklineId, x: resolution.x, y: resolution.y };
}

export interface FoundCrossingResolution {
  readonly resolution: BreaklineCrossingResolution;
  readonly key: CrossingResolutionKey;
}

export interface CrossingResolutionIndex {
  /** The decision for the pair `a`–`b` (either order) at LOCAL `x, y`, if one was stored within the match radius. */
  find(a: string, b: string, x: number, y: number): FoundCrossingResolution | undefined;
  /** Record that a found decision actually decided something in this build. */
  markApplied(key: CrossingResolutionKey): void;
  /** Every stored decision that was never marked applied — in breakline order, then storage order. */
  unapplied(): CrossingResolutionKey[];
}

interface Entry extends FoundCrossingResolution {
  /** LOCAL frame — compared against the resolver's positions. */
  readonly lx: number;
  readonly ly: number;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

/** Index every stored decision of `breaklines` by unordered pair, in the resolver's LOCAL frame. */
export function indexCrossingResolutions(breaklines: readonly Breakline[], origin: LocalOrigin): CrossingResolutionIndex {
  const byPair = new Map<string, Entry[]>();
  const all: Entry[] = [];
  for (const bl of breaklines) {
    for (const resolution of bl.crossingResolutions ?? []) {
      const entry: Entry = {
        resolution,
        key: crossingResolutionKeyOf(bl.id, resolution),
        lx: resolution.x - origin.x,
        ly: resolution.y - origin.y,
      };
      all.push(entry);
      const k = pairKey(bl.id, resolution.withBreaklineId);
      const list = byPair.get(k);
      if (list) list.push(entry);
      else byPair.set(k, [entry]);
    }
  }
  const applied = new Set<Entry>();
  return {
    find(a, b, x, y) {
      let best: Entry | undefined;
      let bestD = CROSSING_RESOLUTION_MATCH_MM;
      for (const e of byPair.get(pairKey(a, b)) ?? []) {
        const d = Math.hypot(e.lx - x, e.ly - y);
        if (d <= bestD) [best, bestD] = [e, d];
      }
      return best;
    },
    markApplied(key) {
      const entry = all.find((e) => sameCrossingResolutionKey(e.key, key));
      if (entry) applied.add(entry);
    },
    unapplied() {
      return all.filter((e) => !applied.has(e)).map((e) => e.key);
    },
  };
}

// ─── Writing decisions (pure — the undoable command owns WHEN) ───────────────────────────────────────────────────

/** Same pair (either line may store it) and within the match radius — i.e. the same meeting point. */
function decidesSamePoint(ownerId: string, stored: BreaklineCrossingResolution, otherOwnerId: string, other: BreaklineCrossingResolution): boolean {
  return pairKey(ownerId, stored.withBreaklineId) === pairKey(otherOwnerId, other.withBreaklineId)
    && Math.hypot(stored.x - other.x, stored.y - other.y) <= CROSSING_RESOLUTION_MATCH_MM;
}

function sameDecision(a: BreaklineCrossingResolution, b: BreaklineCrossingResolution): boolean {
  return a.withBreaklineId === b.withBreaklineId && a.x === b.x && a.y === b.y && a.rule === b.rule
    && (a.rule !== 'specify' || (b.rule === 'specify' && a.z === b.z));
}

function withResolutions(bl: Breakline, next: readonly BreaklineCrossingResolution[]): Breakline {
  if (next.length === (bl.crossingResolutions?.length ?? 0)) return bl;
  if (next.length > 0) return { ...bl, crossingResolutions: next };
  const { crossingResolutions: _dropped, ...rest } = bl;
  return rest;
}

/**
 * Store `resolution` on `ownerBreaklineId`, replacing any decision for the SAME meeting point (on either line).
 * Returns `breaklines` itself when it is already stored exactly so — the command's «nothing would change».
 */
export function withCrossingResolution(
  breaklines: readonly Breakline[],
  ownerBreaklineId: string,
  resolution: BreaklineCrossingResolution,
): readonly Breakline[] {
  const owner = breaklines.find((b) => b.id === ownerBreaklineId);
  if (!owner) return breaklines;
  if ((owner.crossingResolutions ?? []).some((r) => sameDecision(r, resolution))) return breaklines;
  return breaklines.map((bl) => {
    const kept = (bl.crossingResolutions ?? []).filter((r) => !decidesSamePoint(bl.id, r, ownerBreaklineId, resolution));
    if (bl.id !== ownerBreaklineId) return withResolutions(bl, kept);
    return { ...bl, crossingResolutions: [...kept, resolution] };
  });
}

/** Drop the decisions named by `keys`. Returns `breaklines` itself when none is stored. */
export function withoutCrossingResolutions(
  breaklines: readonly Breakline[],
  keys: readonly CrossingResolutionKey[],
): readonly Breakline[] {
  let changed = false;
  const next = breaklines.map((bl) => {
    const kept = (bl.crossingResolutions ?? []).filter(
      (r) => !keys.some((k) => sameCrossingResolutionKey(k, crossingResolutionKeyOf(bl.id, r))),
    );
    const out = withResolutions(bl, kept);
    if (out !== bl) changed = true;
    return out;
  });
  return changed ? next : breaklines;
}

/**
 * Drop every decision whose partner is NOT in `breaklines` — removing a line removes the decisions about it, in the
 * same undoable step (Civil 3D leaves them behind as nothing; here they would be reported as «no longer applying»).
 */
export function withoutOrphanCrossingResolutions(breaklines: readonly Breakline[]): readonly Breakline[] {
  const ids = new Set(breaklines.map((b) => b.id));
  const orphans = breaklines.flatMap((bl) =>
    (bl.crossingResolutions ?? []).filter((r) => !ids.has(r.withBreaklineId)).map((r) => crossingResolutionKeyOf(bl.id, r)),
  );
  return orphans.length > 0 ? withoutCrossingResolutions(breaklines, orphans) : breaklines;
}
