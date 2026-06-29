/**
 * ADR-049 (inverted ghost) — the SOLID moving-copy colour delegates to the canonical
 * `resolveEntityColorHex` SSoT (same hex the canvas paints), with a white fallback.
 * One colour rule shared by useMovePreview + useGripGhostPreview — no duplicated cascade.
 */
import type { Entity } from '../../../types/entities';

const resolveEntityColorHex = jest.fn();
const getLayersById = jest.fn();
jest.mock('../../../systems/selection/select-similar-by-color', () => ({
  resolveEntityColorHex: (...a: unknown[]) => resolveEntityColorHex(...a),
}));
jest.mock('../../../stores/LayerStore', () => ({
  getLayersById: (...a: unknown[]) => getLayersById(...a),
}));

import { resolveGhostSolidColor } from '../ghost-solid-color';

const ENTITY = { id: 'e1', type: 'line', layerId: 'L1' } as unknown as Entity;

describe('resolveGhostSolidColor', () => {
  beforeEach(() => {
    resolveEntityColorHex.mockReset();
    getLayersById.mockReset();
    getLayersById.mockReturnValue({ L1: { id: 'L1', color: '#AABBCC' } });
  });

  it('returns the canonical resolved colour (the hex the canvas paints)', () => {
    resolveEntityColorHex.mockReturnValue('#aabbcc');
    expect(resolveGhostSolidColor(ENTITY)).toBe('#aabbcc');
  });

  it('resolves against the LIVE layer table (getLayersById)', () => {
    resolveEntityColorHex.mockReturnValue('#123456');
    resolveGhostSolidColor(ENTITY);
    expect(getLayersById).toHaveBeenCalledTimes(1);
    expect(resolveEntityColorHex).toHaveBeenCalledWith(ENTITY, { L1: { id: 'L1', color: '#AABBCC' } });
  });

  it('falls back to white when no colour resolves', () => {
    resolveEntityColorHex.mockReturnValue(null);
    expect(resolveGhostSolidColor(ENTITY)).toBe('#FFFFFF');
  });
});
