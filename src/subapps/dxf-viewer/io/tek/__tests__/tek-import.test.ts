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

// ADR-526 Φ5a — μεικτό αρχείο: 1 σκάλα + 2 γραμμές (type 4) + 1 τόξο (type 5).
const TEK_MIXED = `<?xml version="1.0" encoding="UTF-8"?>
<tekton>
<head><version>9.1.0.46</version><numfloors>1</numfloors></head>
<body><building>
<floor>
<stair><record>
<type>21</type>
${point2d([[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]])}
<start_elevation>0</start_elevation><end_elevation>2.9</end_elevation>
<stair_width>0.8</stair_width><steps>16</steps>
<horiz_b>0.2743</horiz_b><vert_b>0.17059</vert_b><slope_h>0.15</slope_h>
</record></stair>
<line>
<record><type>4</type><v0X>0</v0X><v0Y>0</v0Y><v1X>3</v1X><v1Y>0</v1Y><color>00805C</color><type>0</type></record>
<record><type>4</type><v0X>3</v0X><v0Y>0</v0Y><v1X>3</v1X><v1Y>4</v1Y><color>C0C0C0</color><type>0</type></record>
</line>
<arc>
<record><type>5</type><circle>0</circle><centreX>0</centreX><centreY>0</centreY><p0X>1</p0X><p0Y>0</p0Y><p1X>0</p1X><p1Y>1</p1Y><color>FC8000</color></record>
</arc>
</floor>
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

  it('warning όταν δεν υπάρχει καμία οντότητα', () => {
    const empty = `<?xml version="1.0"?><tekton><head></head><body><building></building></body></tekton>`;
    const result = importTekContent(empty, 'level-1');
    expect(result.success).toBe(true);
    expect(result.stats.stairCount).toBe(0);
    expect(result.stats.lineCount).toBe(0);
    expect(result.stats.arcCount).toBe(0);
    expect(result.warnings.join(' ')).toMatch(/καμία οντότητα/);
  });

  it('ADR-526 Φ5a — εισάγει σκάλα + 2Δ γραμμές + τόξο (mixed)', () => {
    const result = importTekContent(TEK_MIXED, 'level-1');
    expect(result.success).toBe(true);
    expect(result.stats.stairCount).toBe(1);
    expect(result.stats.lineCount).toBe(2);
    expect(result.stats.arcCount).toBe(1);
    expect(result.scene?.entities).toHaveLength(4);
    const types = result.scene?.entities.map((e) => e.type).sort();
    expect(types).toEqual(['arc', 'line', 'line', 'stair']);
    // bounds καλύπτουν ΚΑΙ τα 2Δ primitives (η γραμμή φτάνει x=3m → 3000mm)
    const b = result.scene?.bounds;
    expect(b && b.max.x).toBeGreaterThanOrEqual(3000);
  });
});
