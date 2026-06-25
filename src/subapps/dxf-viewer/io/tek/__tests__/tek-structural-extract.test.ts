/**
 * ADR-531 Φ5b — tests για την εξαγωγή `<dim>` / `<wall>` (+ `<open>`) από Tekton XML.
 */

import { parseTektonXml } from '../tek-xml-reader';
import { extractDimRecords, extractWallRecords } from '../tek-structural-extract';

const XMATRIX = (x00: number, x11: number, x20: number, x21: number) =>
  `<xmatrix><x00>${x00}</x00><x01>0</x01><x10>0</x10><x11>${x11}</x11><x20>${x20}</x20><x21>${x21}</x21></xmatrix>`;

// Μοντελοποίηση του πραγματικού «Ισόγειο 312.tek»: 1 διάσταση 2.10m + 1 τοίχος 5.03m + 2 κουφώματα 1.4m.
const TEK = `<?xml version="1.0" encoding="UTF-8"?>
<tekton><head><numfloors>1</numfloors></head><body><building><floor>
<dim><record>
<type>0</type><color>00FF00</color><size>0.15875</size><end_style>8</end_style>
<seg><record>
<end0X>-2.21</end0X><end0Y>6.98</end0Y><end1X>-0.11</end1X><end1Y>6.98</end1Y>
<gap0X>-1.32</gap0X><gap0Y>6.98</gap0Y><gap1X>-1.0</gap1X><gap1Y>6.98</gap1Y>
<s>2.10</s>${XMATRIX(1, 1, -1.32, 6.39)}
</record></seg>
<inter>
<record><pX>-2.21</pX><pY>6.98</pY></record>
<record><pX>-0.11</pX><pY>6.98</pY></record>
</inter>
</record></dim>
<wall><record>
<type>1</type><height>3</height><elevation>0</elevation><inner_width>0.09</inner_width><color>80BCFC</color>
${XMATRIX(5.03, 0.25, -8.25, 0.58)}
<open>
<record><type>2</type><elevation>1</elevation><top>2.2</top><style>1</style><side>3</side><frame_width>0.15</frame_width><frame_thickness>0.03</frame_thickness><jamb_width>0.05</jamb_width><jamb_thickness>0.05</jamb_thickness><ledge_height>0.03</ledge_height><color>50A490</color>${XMATRIX(1.4, -1, -7.86, 0.73)}</record>
<record><type>2</type><elevation>1</elevation><top>2.2</top><style>0</style><side>2</side><color>50A490</color>${XMATRIX(-1.4, -1, -4.16, 0.73)}</record>
</open>
</record></wall>
</floor></building></body></tekton>`;

const root = parseTektonXml(TEK);

describe('extractDimRecords (ADR-531)', () => {
  it('εξάγει 1 διάσταση με 1 seg πατιά', () => {
    const { dims, warnings } = extractDimRecords(root);
    expect(warnings).toHaveLength(0);
    expect(dims).toHaveLength(1);
    expect(dims[0].segs).toHaveLength(1);
  });

  it('διαβάζει σωστά end/gap/text/size/color', () => {
    const seg = extractDimRecords(root).dims[0].segs[0];
    expect(seg.end0).toEqual({ x: -2.21, y: 6.98 });
    expect(seg.end1).toEqual({ x: -0.11, y: 6.98 });
    expect(seg.gap0).toEqual({ x: -1.32, y: 6.98 });
    expect(seg.text).toBe('2.10');
    expect(seg.textMatrix.x20).toBe(-1.32);
    const dim = extractDimRecords(root).dims[0];
    expect(dim.color).toBe('00FF00');
    expect(dim.textSizeM).toBeCloseTo(0.15875, 5);
    expect(dim.endStyle).toBe(8);
    expect(dim.refPoints).toHaveLength(2);
    expect(dim.refPoints[0]).toEqual({ x: -2.21, y: 6.98 });
  });
});

describe('extractWallRecords (ADR-531)', () => {
  it('εξάγει 1 τοίχο με τα σωστά πεδία + matrix', () => {
    const { walls, warnings } = extractWallRecords(root);
    expect(warnings).toHaveLength(0);
    expect(walls).toHaveLength(1);
    const w = walls[0];
    expect(w.heightM).toBe(3);
    expect(w.elevationM).toBe(0);
    expect(w.innerWidthM).toBeCloseTo(0.09, 5);
    expect(w.matrix.x00).toBeCloseTo(5.03, 5);
    expect(w.matrix.x11).toBeCloseTo(0.25, 5);
    expect(w.color).toBe('80BCFC');
  });

  it('εξάγει 2 ανοίγματα (κουφώματα) με elevation/top/style', () => {
    const w = extractWallRecords(root).walls[0];
    expect(w.openings).toHaveLength(2);
    expect(w.openings[0].topM).toBeCloseTo(2.2, 5);
    expect(w.openings[0].elevationM).toBe(1);
    expect(w.openings[0].style).toBe(1);
    expect(w.openings[0].matrix.x00).toBeCloseTo(1.4, 5);
    expect(w.openings[0].side).toBe(3);
    expect(w.openings[0].frameWidthM).toBeCloseTo(0.15, 5);
    expect(w.openings[0].jambWidthM).toBeCloseTo(0.05, 5);
    expect(w.openings[1].style).toBe(0);
    expect(w.openings[1].matrix.x00).toBeCloseTo(-1.4, 5);
  });

  it('αγνοεί wall record λάθος type με warning', () => {
    const bad = parseTektonXml(
      `<tekton><body><building><floor><wall><record><type>9</type></record></wall></floor></building></body></tekton>`,
    );
    const { walls, warnings } = extractWallRecords(bad);
    expect(walls).toHaveLength(0);
    expect(warnings.join(' ')).toMatch(/type=1/);
  });
});
