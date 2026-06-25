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
<text>
<record><type>3</type><s>ΚΟΥΖΙΝΑ</s><color>FC9C80</color><hallign>0</hallign><ttfont><name>Arial</name></ttfont><xmatrix><x00>1</x00><x01>0</x01><x10>0</x10><x11>1</x11><x20>2</x20><x21>3</x21></xmatrix></record>
</text>
</floor>
</building></body>
</tekton>`;

// ADR-531 Φ5b.1 — αρχείο με 1 διάσταση + 1 τοίχο + 2 κουφώματα (όπως «Ισόγειο 312.tek»).
const XM = (x00: number, x11: number, x20: number, x21: number) =>
  `<xmatrix><x00>${x00}</x00><x01>0</x01><x10>0</x10><x11>${x11}</x11><x20>${x20}</x20><x21>${x21}</x21></xmatrix>`;
const TEK_STRUCT = `<?xml version="1.0" encoding="UTF-8"?>
<tekton><head><numfloors>1</numfloors></head><body><building><floor>
<dim><record><type>0</type><color>00FF00</color><size>0.15875</size>
<seg><record><end0X>-2.21</end0X><end0Y>6.98</end0Y><end1X>-0.11</end1X><end1Y>6.98</end1Y>
<gap0X>-1.32</gap0X><gap0Y>6.98</gap0Y><gap1X>-1.0</gap1X><gap1Y>6.98</gap1Y><s>2.10</s>${XM(1, 1, -1.32, 6.39)}
</record></seg></record></dim>
<wall><record><type>1</type><height>3</height><elevation>0</elevation><inner_width>0.09</inner_width><color>80BCFC</color>
${XM(5.03, 0.25, -8.25, 0.58)}<open>
<record><type>2</type><elevation>1</elevation><top>2.2</top><style>1</style><color>50A490</color>${XM(1.4, -1, -7.86, 0.73)}</record>
<record><type>2</type><elevation>1</elevation><top>2.2</top><style>0</style><color>50A490</color>${XM(-1.4, -1, -4.16, 0.73)}</record>
</open></record></wall>
</floor></building></body></tekton>`;

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
    expect(result.stats.textCount).toBe(0);
    expect(result.warnings.join(' ')).toMatch(/καμία οντότητα/);
  });

  it('ADR-526 Φ5a — εισάγει σκάλα + 2Δ γραμμές + τόξο + κείμενο (mixed)', () => {
    const result = importTekContent(TEK_MIXED, 'level-1');
    expect(result.success).toBe(true);
    expect(result.stats.stairCount).toBe(1);
    expect(result.stats.lineCount).toBe(2);
    expect(result.stats.arcCount).toBe(1);
    expect(result.stats.textCount).toBe(1);
    expect(result.scene?.entities).toHaveLength(5);
    const types = result.scene?.entities.map((e) => e.type).sort();
    expect(types).toEqual(['arc', 'line', 'line', 'stair', 'text']);
    const txt = result.scene?.entities.find((e) => e.type === 'text');
    expect(txt && 'text' in txt && txt.text).toBe('ΚΟΥΖΙΝΑ');
    expect(txt && 'fontFamily' in txt && txt.fontFamily).toBe('Arial');
    // bounds καλύπτουν ΚΑΙ τα 2Δ primitives (η γραμμή φτάνει x=3m → 3000mm)
    const b = result.scene?.bounds;
    expect(b && b.max.x).toBeGreaterThanOrEqual(3000);
  });

  it('ADR-531 Φ5b.1++ — εισάγει διάσταση + τοίχο + 2 κουφώματα ως 2Δ primitives', () => {
    const result = importTekContent(TEK_STRUCT, 'level-1');
    expect(result.success).toBe(true);
    expect(result.stats.dimCount).toBe(1);
    expect(result.stats.wallCount).toBe(1);
    expect(result.stats.openingCount).toBe(2);
    // faithful: τοίχος-με-κουφώματα 12 + πόρτα 13 + παράθυρο 7 = 32· διάσταση 2 γραμμές + 8 markers = 10· κείμενο 1.
    const lines = result.scene?.entities.filter((e) => e.type === 'line') ?? [];
    const texts = result.scene?.entities.filter((e) => e.type === 'text') ?? [];
    expect(lines).toHaveLength(42);
    expect(texts).toHaveLength(1);
    expect(texts[0] && 'text' in texts[0] && texts[0].text).toBe('2.10');
  });
});
