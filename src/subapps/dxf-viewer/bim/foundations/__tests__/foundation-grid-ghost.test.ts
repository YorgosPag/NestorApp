/**
 * ADR-441 Slice 7 — `deriveGridFollowGhostFootprints` tests.
 *
 * Ο live ghost deriver είναι thin wrapper πάνω στον SSoT `buildStripGridFromGuides`
 * → τα footprints πρέπει να είναι **pixel-identical** με τα committed (seamless
 * handoff, μηδέν flash). Καλύπτει: σωστό πλήθος, geometry == builder, split μετά
 * μετακίνηση άξονα, insufficient → [].
 */

import { deriveGridFollowGhostFootprints } from '../foundation-grid-ghost';
import { buildStripGridFromGuides, type AxisGuideReader } from '../foundation-from-grid';
import type { Guide } from '../../../systems/guides/guide-types';

const guide = (id: string, axis: Guide['axis'], offset: number, visible = true): Guide =>
  ({ id, axis, offset, visible, label: null, style: null, locked: false, createdAt: '', parentId: null, groupId: null } as Guide);

const reader = (guides: readonly Guide[]): AxisGuideReader => ({
  getGuidesByAxis: (axis) => guides.filter((g) => g.axis === axis),
});

const X3 = [guide('x0', 'X', 0), guide('x1', 'X', 4000), guide('x2', 'X', 8000)];
const Y3 = [guide('y0', 'Y', 0), guide('y1', 'Y', 4000), guide('y2', 'Y', 8000)];

describe('deriveGridFollowGhostFootprints', () => {
  it('3×3 → 12 footprints, καθένα κλειστό polygon (≥4 vertices)', () => {
    const fps = deriveGridFollowGhostFootprints(reader([...X3, ...Y3]), {}, '0', 'mm');
    expect(fps).toHaveLength(12);
    for (const fp of fps) expect(fp.vertices.length).toBeGreaterThanOrEqual(4);
  });

  it('geometry == SSoT builder (pixel-identical handoff)', () => {
    const args = [reader([...X3, ...Y3]), {}, '0', 'mm'] as const;
    const ghost = deriveGridFollowGhostFootprints(...args);
    const built = buildStripGridFromGuides(...args);
    expect(built.ok).toBe(true);
    expect(ghost.map((g) => g.vertices)).toEqual(
      built.strips.map((s) => s.geometry.footprint.vertices.map((v) => ({ x: v.x, y: v.y }))),
    );
  });

  it('μετακίνηση άξονα ώστε να προστεθεί ενδιάμεσος → +split (περισσότερα footprints)', () => {
    // 3×3 = 12· προσθήκη 4ου Y (νέο φάτνωμα) → 3·3 + 4·2 = 17.
    const Y4 = [...Y3, guide('y3', 'Y', 12000)];
    const fps = deriveGridFollowGhostFootprints(reader([...X3, ...Y4]), {}, '0', 'mm');
    expect(fps).toHaveLength(17);
  });

  it('<2 άξονες ανά διεύθυνση → [] (caller fallback σε coordinate-follow)', () => {
    expect(deriveGridFollowGhostFootprints(reader([guide('x0', 'X', 0), ...Y3]), {}, '0', 'mm')).toEqual([]);
  });
});
