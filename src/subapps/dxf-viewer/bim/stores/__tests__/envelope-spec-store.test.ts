/**
 * ADR-396 P7 — envelope-spec-store loadForLevel + quiet-window state.
 *
 * Επιβεβαιώνει το persistence-sync contract που καταναλώνει ο
 * `useThermalEnvelopeSync`: level switch reload, quiet-window stamping,
 * null incoming = clear.
 *
 * jest globals (ΟΧΙ vitest — P4 παγίδα).
 */

import {
  getEnvelopeSpec,
  setEnvelopeSpec,
  buildDefaultSpec,
  loadForLevel,
  getCurrentLevelId,
  getLastLocalMutationAt,
  __resetEnvelopeSpecStore,
} from '../envelope-spec-store';

beforeEach(() => {
  __resetEnvelopeSpecStore();
});

describe('loadForLevel', () => {
  it('φορτώνει incoming spec + σημειώνει currentLevelId', () => {
    const spec = buildDefaultSpec();
    loadForLevel('lvl-1', spec);
    expect(getCurrentLevelId()).toBe('lvl-1');
    expect(getEnvelopeSpec('lvl-1')).toEqual(spec);
  });

  it('null incoming = καθαρίζει το spec του ορόφου', () => {
    setEnvelopeSpec('lvl-1', buildDefaultSpec());
    loadForLevel('lvl-1', null);
    expect(getEnvelopeSpec('lvl-1')).toBeNull();
  });

  it('reset-άρει το quiet-window stamp (server load = authoritative)', () => {
    setEnvelopeSpec('lvl-1', buildDefaultSpec());
    expect(getLastLocalMutationAt()).toBeGreaterThan(0);
    loadForLevel('lvl-1', buildDefaultSpec());
    expect(getLastLocalMutationAt()).toBe(0);
  });
});

describe('setEnvelopeSpec — quiet-window stamping', () => {
  it('σημειώνει lastLocalMutationAt > 0 (pending τοπική εγγραφή)', () => {
    expect(getLastLocalMutationAt()).toBe(0);
    setEnvelopeSpec('lvl-1', buildDefaultSpec());
    expect(getLastLocalMutationAt()).toBeGreaterThan(0);
  });
});
