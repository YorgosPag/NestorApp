/**
 * CHARACTERIZATION test — export ACI (code 62) για non-basic entity colors.
 *
 * Κλειδώνει το ΤΩΡΙΝΟ end-to-end export mapping hex → ACI μέσω `writeDxfAscii`
 * (entities path → `resolveAci` → `hexToAci` ramp). Στο **Phase C** ο ramp
 * αντικαθίσταται από `findClosestAci` → οι μη-βασικές τιμές θα μετακινηθούν· το
 * inline snapshot θα σπάσει και τα deltas θα παρουσιαστούν στον Giorgio πριν
 * κλειδωθούν. Επίσης τεκμηριώνει το ΤΩΡΙΝΟ entity-vs-dimstyle inconsistency:
 * το ίδιο hex δίνει ενδεχομένως διαφορετικό ACI από το dimstyle path
 * (`dxf-dimstyle-writer` → `findClosestAci`).
 */

import { writeDxfAscii } from '../dxf-ascii-writer';
import { findClosestAci } from '../../../settings/standards/aci';
import type { Entity } from '../../../types/entities';

function coloredLine(id: string, hex: string): Entity {
  return {
    id,
    type: 'line',
    layerId: 'L',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    color: hex,
  } as unknown as Entity;
}

const LAYERS = { L: { name: 'L0' } };

/** Extract the sequence of code-62 ACI values in document order. */
function aciCodes(dxf: string): number[] {
  const out: number[] = [];
  const re = /\n62\n(\d+)\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(dxf)) !== null) out.push(Number(m[1]));
  return out;
}

const NON_BASIC = ['#804020', '#3366cc', '#123456', '#b07d1f', '#00994c', '#cc6600'] as const;

describe('export ACI — entities path (LOCKED, pre-Phase-C ramp)', () => {
  it('code-62 per non-basic color (snapshot)', () => {
    const entities = NON_BASIC.map((hex, i) => coloredLine(`e${i}`, hex));
    const codes = aciCodes(writeDxfAscii(entities, { layersById: LAYERS }));
    const map = Object.fromEntries(NON_BASIC.map((hex, i) => [hex, codes[i]]));
    expect(map).toMatchInlineSnapshot(`
{
  "#00994c": 170,
  "#123456": 146,
  "#3366cc": 227,
  "#804020": 93,
  "#b07d1f": 103,
  "#cc6600": 39,
}
`);
  });

  it('basic colors export stably (red=1, blue=5, cyan=4)', () => {
    const dxf = writeDxfAscii(
      [coloredLine('r', '#FF0000'), coloredLine('b', '#0000FF'), coloredLine('c', '#00FFFF')],
      { layersById: LAYERS },
    );
    expect(aciCodes(dxf)).toEqual([1, 5, 4]);
  });
});

describe('export ACI — entity-vs-dimstyle inconsistency (the bug, documented)', () => {
  // dimstyle path uses findClosestAci (real ACI_PALETTE); entity path uses the ramp.
  // Where they disagree today, Phase C makes them agree. Snapshot the divergence set.
  it('divergence between entity-ramp ACI and dimstyle findClosestAci', () => {
    const entities = NON_BASIC.map((hex, i) => coloredLine(`e${i}`, hex));
    const entityCodes = aciCodes(writeDxfAscii(entities, { layersById: LAYERS }));
    const divergences = NON_BASIC.filter((hex, i) => entityCodes[i] !== findClosestAci(hex));
    // Pre-Phase-C: expect at least one divergence (proves the bug exists).
    expect(divergences.length).toMatchInlineSnapshot(`6`);
  });
});
