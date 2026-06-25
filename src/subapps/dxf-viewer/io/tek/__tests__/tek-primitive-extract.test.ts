/**
 * ADR-526 Φ5a — tests για τους 2Δ extractors (`<line>` type 4, `<arc>` type 5) + BGR→RGB.
 */

import { parseTektonXml } from '../tek-xml-reader';
import {
  extractLineRecords, extractArcRecords, bgrToRgbHex,
} from '../tek-primitive-extract';

function root(xml: string): Element {
  return parseTektonXml(`<?xml version="1.0" encoding="UTF-8"?><tekton>${xml}</tekton>`);
}

const FLOOR_WITH_PRIMITIVES = `
<head><numfloors>1</numfloors></head>
<body><building><floor>
<line>
<record><type>4</type><v0X>-8.9</v0X><v0Y>1.05</v0Y><v1X>-9.3</v1X><v1Y>2.25</v1Y><color>00805C</color><type>0</type></record>
<record><type>4</type><v0X>0</v0X><v0Y>0</v0Y><v1X>3</v1X><v1Y>0</v1Y><color>C0C0C0</color><type>0</type></record>
</line>
<arc>
<record><type>5</type><circle>0</circle><centreX>-3.36</centreX><centreY>5.53</centreY><p0X>-3.41</p0X><p0Y>6.13</p0Y><p1X>-3.96</p1X><p1Y>5.53</p1Y><color>00805C</color></record>
<record><type>5</type><circle>1</circle><centreX>1</centreX><centreY>1</centreY><p0X>3</p0X><p0Y>1</p0Y><p1X>0</p1X><p1Y>0</p1Y><color>FC8000</color></record>
</arc>
</floor></building></body>`;

describe('bgrToRgbHex', () => {
  it.each([
    ['00805C', '5C8000'],
    ['FC8000', '0080FC'],
    ['FFFFFF', 'FFFFFF'],
    ['000000', '000000'],
  ])('αντιστρέφει BGR %s → RGB %s', (bgr, rgb) => {
    expect(bgrToRgbHex(bgr)).toBe(rgb);
  });

  it('fallback σε FC8000 για άκυρη/κενή είσοδο', () => {
    expect(bgrToRgbHex('')).toBe('FC8000');
    expect(bgrToRgbHex(null)).toBe('FC8000');
    expect(bgrToRgbHex('xyz')).toBe('FC8000');
  });
});

describe('extractLineRecords', () => {
  it('διαβάζει τα v0/v1 + χρώμα (1η <type>=entity, 2η=line-style)', () => {
    const { lines, warnings } = extractLineRecords(root(FLOOR_WITH_PRIMITIVES));
    expect(warnings).toHaveLength(0);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({ v0x: -8.9, v0y: 1.05, v1x: -9.3, v1y: 2.25, colorBgr: '00805C' });
    expect(lines[1].v1x).toBe(3);
  });

  it('άδειο/απών container → κενό, χωρίς warning', () => {
    expect(extractLineRecords(root('<body><building><floor></floor></building></body>')).lines).toHaveLength(0);
  });
});

describe('extractArcRecords', () => {
  it('διαβάζει circle flag + centre/p0/p1', () => {
    const { arcs } = extractArcRecords(root(FLOOR_WITH_PRIMITIVES));
    expect(arcs).toHaveLength(2);
    expect(arcs[0].isCircle).toBe(false);
    expect(arcs[0].centreX).toBeCloseTo(-3.36);
    expect(arcs[1].isCircle).toBe(true);
    expect(arcs[1].p0x).toBe(3);
  });
});
