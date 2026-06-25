/**
 * ADR-526 — tests για το service-level import (content → SceneModel).
 */

import { importTekContent, isTekFileName } from '../tek-import';

function point2d(pts: readonly (readonly [number, number])[]): string {
  return `<point2d>${pts.map(([x, y]) => `<record><pX>${x}</pX><pY>${y}</pY></record>`).join('')}</point2d>`;
}

const TEK = `<?xml version="1.0" encoding="UTF-8"?>
<tekton>
<head><version>9.1.0.46</version><numfloors>2</numfloors></head>
<body><building>
<floor><stair><record>
<type>21</type>
${point2d([[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]])}
<start_elevation>0</start_elevation><end_elevation>2.9</end_elevation>
<stair_width>0.8</stair_width><steps>16</steps>
<horiz_b>0.2743</horiz_b><vert_b>0.17059</vert_b><slope_h>0.15</slope_h>
</record></stair></floor>
<floor><stair></stair></floor>
</building></body>
</tekton>`;

describe('isTekFileName', () => {
  it('αναγνωρίζει .tek και .tek.txt', () => {
    expect(isTekFileName('ΣΚΑΛΑ.tek')).toBe(true);
    expect(isTekFileName('ΣΚΑΛΑ.tek.txt')).toBe(true);
    expect(isTekFileName('drawing.dxf')).toBe(false);
  });
});

describe('importTekContent', () => {
  it('παράγει SceneModel με μία σκάλα + σωστά bounds', () => {
    const result = importTekContent(TEK, 'level-1');
    expect(result.success).toBe(true);
    expect(result.stats.stairCount).toBe(1);
    expect(result.scene?.entities).toHaveLength(1);
    expect(result.scene?.units).toBe('mm');
    const e = result.scene?.entities[0];
    expect(e?.type).toBe('stair');
    // bounds μη-εκφυλισμένα (το bbox της σκάλας έχει θετική έκταση)
    const b = result.scene?.bounds;
    expect(b && b.max.x - b.min.x).toBeGreaterThan(0);
    expect(b && b.max.y - b.min.y).toBeGreaterThan(0);
  });

  it('επιστρέφει error για άκυρο XML χωρίς exception', () => {
    const result = importTekContent('<<<garbage', 'level-1');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/XML|tek/i);
  });

  it('warning όταν δεν υπάρχει σκάλα', () => {
    const empty = `<?xml version="1.0"?><tekton><head></head><body><building></building></body></tekton>`;
    const result = importTekContent(empty, 'level-1');
    expect(result.success).toBe(true);
    expect(result.stats.stairCount).toBe(0);
    expect(result.warnings.join(' ')).toMatch(/καμία σκάλα/);
  });
});
