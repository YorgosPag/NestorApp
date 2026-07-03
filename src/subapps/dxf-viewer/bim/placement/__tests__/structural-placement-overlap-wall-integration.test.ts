/**
 * ADR-567 — integration: ΠΡΑΓΜΑΤΙΚΟΙ WallEntities (ίδιο `buildWallEntity` με το ghost/commit) ώστε
 * να επιβεβαιωθεί ότι το `structuralFootprintOf` + `findStructuralOverlap` πυροδοτούν σε wall-on-wall.
 * Αν ΑΥΤΟ περνά αλλά ο browser όχι → το bug είναι runtime (store population / snap), όχι geometry.
 */

import { buildDefaultWallParams, buildWallEntity } from '../../../hooks/drawing/wall-completion';
import type { Entity } from '../../../types/entities';
import { structuralFootprintOf, findStructuralOverlap } from '../structural-placement-overlap';

function wall(id: string, x1: number, y1: number, x2: number, y2: number): Entity {
  const params = buildDefaultWallParams({ x: x1, y: y1 }, { x: x2, y: y2 }, {}, 'mm');
  const built = buildWallEntity(params, 'layer-0', 'straight', 'mm');
  if (!built.ok) throw new Error(`wall build failed: ${built.hardErrors.join(',')}`);
  return { ...built.entity, id } as unknown as Entity;
}

describe('ADR-567 wall-on-wall integration (real buildWallEntity)', () => {
  it('structuralFootprintOf δίνει έγκυρο footprint για πραγματικό τοίχο', () => {
    const fp = structuralFootprintOf(wall('a', 0, 0, 3000, 0));
    expect(fp).not.toBeNull();
    expect(fp!.length).toBeGreaterThanOrEqual(3);
  });

  it('ΟΜΟΑΞΟΝΙΚΟΣ διπλότυπος τοίχος πάνω-πάνω → BLOCK', () => {
    const existing = wall('existing', 0, 0, 3000, 0);
    const ghost = wall('ghost', 0, 0, 3000, 0);
    const fp = structuralFootprintOf(ghost)!;
    const hit = findStructuralOverlap(fp, [existing], { excludeIds: new Set(['ghost']) });
    expect(hit?.blockedById).toBe('existing');
  });

  it('ΠΑΡΑΛΛΗΛΟΣ τοίχος ΑΚΡΙΒΩΣ πάνω (μετατοπισμένος λίγο) → BLOCK', () => {
    const existing = wall('existing', 0, 0, 3000, 0);
    const ghost = wall('ghost', 500, 0, 3500, 0); // επικαλύπτει 2500/3000 μήκος
    const fp = structuralFootprintOf(ghost)!;
    const hit = findStructuralOverlap(fp, [existing], { excludeIds: new Set(['ghost']) });
    expect(hit?.blockedById).toBe('existing');
  });

  it('ΚΑΘΕΤΗ διασταύρωση (T/+) → ALLOW (μικρό κοινό εμβαδό)', () => {
    const existing = wall('existing', 0, 0, 3000, 0);
    const ghost = wall('ghost', 1500, -1500, 1500, 1500); // κάθετος που περνά από τη μέση
    const fp = structuralFootprintOf(ghost)!;
    const hit = findStructuralOverlap(fp, [existing], { excludeIds: new Set(['ghost']) });
    expect(hit).toBeNull();
  });

  it('ΜΑΚΡΙΝΟΣ τοίχος → ALLOW', () => {
    const existing = wall('existing', 0, 0, 3000, 0);
    const ghost = wall('ghost', 0, 5000, 3000, 5000);
    const fp = structuralFootprintOf(ghost)!;
    const hit = findStructuralOverlap(fp, [existing], { excludeIds: new Set(['ghost']) });
    expect(hit).toBeNull();
  });
});
