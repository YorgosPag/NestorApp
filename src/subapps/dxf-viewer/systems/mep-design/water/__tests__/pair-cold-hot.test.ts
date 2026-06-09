/**
 * ADR-426 — water cold/hot pairing tests.
 *
 * The hot network is offset onto its own spine (cold = untouched reference). Verifies: the hot
 * trunks run parallel to the original at `hotSpineOffsetMm`, never overlapping; the root stub;
 * every hot fixture is re-tapped (connected); the LU/DN copied from the original run; and the
 * invariants the orchestrator/integration tests rely on (`totalLU`, served members) are kept.
 */

import { buildOffsetHotNetwork } from '../pair-cold-hot';
import { WATER_SUPPLY_DISCIPLINE } from '../water-supply-discipline';
import { segmentHitsObstacles } from '../../routing/wall-obstacles';
import type { Rect2D } from '../../routing/routing-constants';
import type { FixtureDemand, ProposedNetwork, ProposedSegment } from '../water-design-types';

function trunk(sx: number, sy: number, ex: number, ey: number, dn: number, lu: number): ProposedSegment {
  return {
    start: { x: sx, y: sy },
    end: { x: ex, y: ey },
    service: 'hot',
    classification: 'domestic-hot-water',
    diameterMm: dn,
    cumulativeLU: lu,
    role: 'trunk',
  };
}

function demand(id: string, x: number, y: number, lu: number): FixtureDemand {
  return { terminalId: id, entityId: id, service: 'hot', loadingUnits: lu, connectorId: 'san-hot', point: { x, y } };
}

/** Single right-arm hot spine: source(0,0) → wb(1500) → sh(3000). */
function singleArmHot(): ProposedNetwork {
  return {
    service: 'hot',
    classification: 'domestic-hot-water',
    sourceEntityId: 'm-hot',
    sourceConnectorId: 'm-out-0',
    sourcePoint: { x: 0, y: 0 },
    sourceElevationMm: 400,
    segments: [
      trunk(0, 0, 1500, 0, 22, 3),
      trunk(1500, 0, 3000, 0, 18, 1),
      { ...trunk(1500, 0, 1500, 800, 15, 2), role: 'branch' },
      { ...trunk(3000, 0, 3000, 800, 15, 1), role: 'branch' },
    ],
    servedTerminalIds: ['wb', 'sh'],
    servedConnectors: [
      { entityId: 'wb', connectorId: 'san-hot' },
      { entityId: 'sh', connectorId: 'san-hot' },
    ],
    totalLU: 5,
  };
}

describe('ADR-426 — buildOffsetHotNetwork', () => {
  const demands = [demand('wb', 1500, 800, 2), demand('sh', 3000, 800, 1)];

  it('keeps the hot identity + metadata (service, classification, source, totalLU)', () => {
    const hot = buildOffsetHotNetwork(singleArmHot(), demands, WATER_SUPPLY_DISCIPLINE);
    expect(hot.service).toBe('hot');
    expect(hot.classification).toBe('domestic-hot-water');
    expect(hot.sourceEntityId).toBe('m-hot');
    expect(hot.sourceElevationMm).toBe(400);
    expect(hot.totalLU).toBe(5); // unchanged — the orchestrator/integration tests assert this
    expect(hot.servedConnectors).toEqual([
      { entityId: 'wb', connectorId: 'san-hot' },
      { entityId: 'sh', connectorId: 'san-hot' },
    ]);
    expect(hot.segments.every((s) => s.service === 'hot')).toBe(true);
  });

  it('runs the hot spine PARALLEL at hotSpineOffsetMm (80), never overlapping the reference', () => {
    const hot = buildOffsetHotNetwork(singleArmHot(), demands, WATER_SUPPLY_DISCIPLINE);
    const horizontalTrunks = hot.segments.filter(
      (s) => s.role === 'trunk' && Math.abs(s.start.y - s.end.y) < 1e-6,
    );
    expect(horizontalTrunks.length).toBeGreaterThan(0);
    expect(horizontalTrunks.every((s) => Math.abs(s.start.y - 80) < 1e-6)).toBe(true);
    expect(horizontalTrunks.every((s) => Math.abs(s.start.y) > 1e-6)).toBe(true);
  });

  it('copies each hot trunk run\'s LU + DN from its original counterpart', () => {
    const hot = buildOffsetHotNetwork(singleArmHot(), demands, WATER_SUPPLY_DISCIPLINE);
    const trunks = hot.segments.filter((s) => s.role === 'trunk');
    expect(trunks.some((s) => s.cumulativeLU === 3 && s.diameterMm === 22)).toBe(true);
    expect(trunks.some((s) => s.cumulativeLU === 1 && s.diameterMm === 18)).toBe(true);
  });

  it('bridges the source to the offset spine with a stub', () => {
    const hot = buildOffsetHotNetwork(singleArmHot(), demands, WATER_SUPPLY_DISCIPLINE);
    const stub = hot.segments.find((s) => Math.abs(s.start.x) < 1e-6 && Math.abs(s.start.y) < 1e-6);
    expect(stub).toBeDefined();
    expect(stub!.role).toBe('trunk');
    expect(stub!.end).toEqual({ x: 0, y: 80 });
  });

  it('re-taps EVERY hot fixture: a branch reaches each connector, connected to the spine', () => {
    const hot = buildOffsetHotNetwork(singleArmHot(), demands, WATER_SUPPLY_DISCIPLINE);
    const branches = hot.segments.filter((s) => s.role === 'branch');
    for (const d of demands) {
      expect(branches.some((b) => b.end.x === d.point.x && b.end.y === d.point.y)).toBe(true);
    }
    expect(branches.every((b) => Math.abs(b.start.y - 80) < 1e-6)).toBe(true);
  });

  it('keeps the diminishing invariant (max trunk DN ≥ max branch DN)', () => {
    const hot = buildOffsetHotNetwork(singleArmHot(), demands, WATER_SUPPLY_DISCIPLINE);
    const maxTrunk = Math.max(...hot.segments.filter((s) => s.role === 'trunk').map((s) => s.diameterMm));
    const maxBranch = Math.max(...hot.segments.filter((s) => s.role === 'branch').map((s) => s.diameterMm));
    expect(maxTrunk).toBeGreaterThanOrEqual(maxBranch);
  });

  // ── Slice 3C — wall-aware offset ────────────────────────────────────────────
  it('locally detours the offset hot trunk around a wall, never crossing it (totalLU intact)', () => {
    // The hot offset spine sits at y=80; this wall (y∈[60,260]) straddles it between the two
    // fixtures (x∈[2000,2200], clear of both branch drops at x=1500/3000) while the cold
    // reference (y=0) clears it. Pairing must A*-detour the offset trunk, not overlap the wall.
    const wall: Rect2D = { minX: 2000, minY: 60, maxX: 2200, maxY: 260 };
    const hot = buildOffsetHotNetwork(singleArmHot(), demands, WATER_SUPPLY_DISCIPLINE, [wall]);
    for (const s of hot.segments) expect(segmentHitsObstacles(s.start, s.end, [wall])).toBe(false);
    expect(hot.totalLU).toBe(5); // unchanged by the detour
    expect(hot.segments.filter((s) => s.role === 'trunk').length).toBeGreaterThan(3); // detour added runs
    expect(hot.segments.every((s) => s.service === 'hot')).toBe(true);
  });
});
