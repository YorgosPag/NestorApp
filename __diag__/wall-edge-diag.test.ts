import { computeStructuralFinishSilhouette } from '../../src/subapps/dxf-viewer/bim/finishes/structural-finish-scene-silhouette';
import type { WallFinishObstacle } from '../../src/subapps/dxf-viewer/bim/finishes/structural-finish-scene';
import { buildDefaultWallParams } from '../../src/subapps/dxf-viewer/hooks/drawing/wall-completion';

const w: WallFinishObstacle = { id: 'w1', kind: 'straight', params: buildDefaultWallParams({ x: 0, y: 0 }, { x: 3000, y: 0 }, { height: 3000 }) };

describe('diag', () => {
  it('μεμονωμένος τοίχος segments', () => {
    const bands = computeStructuralFinishSilhouette([], [], [w], 0, undefined, true);
    const segs = bands.flatMap(b => b.faces.segments);
    // ταξινόμησε ακμές σε ∥ άξονα (μεγάλες) vs ⊥ άξονα (άκρα)
    const summary = segs.map(s => {
      const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
      const horiz = Math.abs(dx) > Math.abs(dy);
      return { len: Math.hypot(dx,dy).toFixed(0), dir: horiz ? 'ΜΕΓΑΛΗ(∥)' : 'ΑΚΡΟ(⊥)' };
    });
    console.log('TOTAL segments:', segs.length);
    console.log(JSON.stringify(summary, null, 0));
    const withDrop = bands.flatMap(b=>b.faces.segments).length;
    const bandsNoDrop = computeStructuralFinishSilhouette([], [], [w], 0, undefined, false);
    console.log('χωρίς dropPlanHidden:', bandsNoDrop.flatMap(b=>b.faces.segments).length);
  });
});
