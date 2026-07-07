/**
 * ADR-581 — Match registry tests.
 */

import {
  getMatchableProperties,
  getDescriptorByKey,
  __clearMatchRegistryCache,
} from '../match-registry';

beforeEach(() => __clearMatchRegistryCache());

describe('getMatchableProperties', () => {
  it('δίνει καθολικά style descriptors σε raw-DXF τύπο (line) — όλα κανάλι scene', () => {
    const descs = getMatchableProperties('line');
    expect(descs.length).toBeGreaterThan(0);
    expect(descs.every((d) => d.channel === 'scene')).toBe(true);
    expect(descs.some((d) => d.role === 'style.color')).toBe(true);
  });

  it('δίνει geometry (params) + style + material για κολόνα', () => {
    const descs = getMatchableProperties('column');
    const keys = descs.map((d) => d.key);
    expect(keys).toEqual(expect.arrayContaining([
      'params.width', 'params.depth', 'params.height', 'params.material', 'scene.color',
    ]));
    const width = getDescriptorByKey('column', 'params.width');
    expect(width?.channel).toBe('params');
    expect(width?.unit).toBe('mm');
  });

  it('text τύπος έχει και τα text-extras (widthFactor/fontFamily)', () => {
    const roles = getMatchableProperties('text').map((d) => d.role);
    expect(roles).toEqual(expect.arrayContaining(['style.text.widthFactor', 'style.text.fontFamily']));
  });

  it('ΚΑΝΕΝΑΣ descriptor δεν είναι readOnly (readouts αποκλείονται εξ ορισμού)', () => {
    for (const type of ['line', 'column', 'beam', 'wall', 'slab', 'text', 'hatch'] as const) {
      expect(getMatchableProperties(type).every((d) => d.readOnly === false)).toBe(true);
    }
  });

  it('memoises — ίδια αναφορά για ίδιο τύπο', () => {
    expect(getMatchableProperties('column')).toBe(getMatchableProperties('column'));
  });
});
