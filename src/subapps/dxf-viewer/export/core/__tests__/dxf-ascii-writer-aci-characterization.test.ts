/**
 * CHARACTERIZATION test — export ACI (code 62) για non-basic entity colors.
 *
 * **Phase C DONE:** το end-to-end export mapping hex → ACI μέσω `writeDxfAscii`
 * (entities path → `resolveAci` → `hexToAci`) πλέον delegateάρει στο
 * `findClosestAci` (πραγματικό ACI_PALETTE, single SSoT). Οι snapshot τιμές είναι
 * οι ΣΩΣΤΕΣ ACI. Το entity-vs-dimstyle inconsistency ΛΥΘΗΚΕ: entity path και
 * dimstyle path (`dxf-dimstyle-writer` → `findClosestAci`) συμφωνούν πλέον →
 * μηδέν divergences.
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

describe('export ACI — entities path (real ACI_PALETTE SSoT, post-Phase-C)', () => {
  it('code-62 per non-basic color (snapshot)', () => {
    const entities = NON_BASIC.map((hex, i) => coloredLine(`e${i}`, hex));
    const codes = aciCodes(writeDxfAscii(entities, { layersById: LAYERS }));
    const map = Object.fromEntries(NON_BASIC.map((hex, i) => [hex, codes[i]]));
    expect(map).toMatchInlineSnapshot(`
{
  "#00994c": 114,
  "#123456": 148,
  "#3366cc": 152,
  "#804020": 17,
  "#b07d1f": 45,
  "#cc6600": 32,
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

describe('export ACI — entity/dimstyle consistency (bug FIXED in Phase C)', () => {
  // Both the entity path (writeDxfAscii → hexToAci → findClosestAci) and the dimstyle
  // path (dxf-dimstyle-writer → findClosestAci) now derive from the same ACI SSoT.
  it('entity ACI == dimstyle findClosestAci for every colour (zero divergence)', () => {
    const entities = NON_BASIC.map((hex, i) => coloredLine(`e${i}`, hex));
    const entityCodes = aciCodes(writeDxfAscii(entities, { layersById: LAYERS }));
    const divergences = NON_BASIC.filter((hex, i) => entityCodes[i] !== findClosestAci(hex));
    expect(divergences.length).toBe(0);
  });
});
