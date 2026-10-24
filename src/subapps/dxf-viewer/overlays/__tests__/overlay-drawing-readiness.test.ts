/**
 * overlay-drawing-readiness — ADR-921 SSoT «μπορεί το επίπεδο να δεχτεί ζώνες;».
 *
 * Κλειδώνει: τη σειρά των αιτιών (η πρώτη ανεκπλήρωτη προϋπόθεση κερδίζει), ότι το DXF του
 * επιπέδου μετρά ως αναφορά (και το γεννημένο στην εφαρμογή — ADR-913), ότι η εικόνα κάτοψης
 * προηγείται του DXF, και ότι κάθε αιτία έχει μήνυμα (κανένα κενό tooltip/toast).
 */

import {
  resolveOverlayDrawingReadiness,
  OverlayPersistBlockedError,
  OVERLAY_DRAWING_BLOCK_MESSAGE_KEYS,
  OVERLAY_DRAWING_REMEDY_ACTIONS,
  type OverlayDrawingReadinessInput,
} from '../overlay-drawing-readiness';

const READY: OverlayDrawingReadinessInput = {
  levelId: 'lvl_1',
  floorId: 'flr_1',
  backgroundImageId: null,
  sceneFileId: 'file_1',
  userId: 'usr_1',
};

describe('resolveOverlayDrawingReadiness', () => {
  it('is ready on a floor-bound level with a DXF reference', () => {
    expect(resolveOverlayDrawingReadiness(READY)).toEqual({
      ready: true,
      context: { floorId: 'flr_1', backgroundId: 'file_1' },
    });
  });

  it('prefers the floorplan background image over the level DXF', () => {
    const r = resolveOverlayDrawingReadiness({ ...READY, backgroundImageId: 'bg_1' });
    expect(r).toEqual({ ready: true, context: { floorId: 'flr_1', backgroundId: 'bg_1' } });
  });

  it('accepts an image-only floor (no DXF)', () => {
    const r = resolveOverlayDrawingReadiness({ ...READY, sceneFileId: null, backgroundImageId: 'bg_1' });
    expect(r.ready).toBe(true);
  });

  it.each([
    ['no-level', { levelId: null }],
    ['no-floor', { floorId: null }],
    ['no-background', { sceneFileId: null, backgroundImageId: null }],
    ['no-auth', { userId: null }],
  ] as const)('blocks with %s', (reason, patch) => {
    expect(resolveOverlayDrawingReadiness({ ...READY, ...patch })).toEqual({ ready: false, reason });
  });

  it('reports the FIRST unmet prerequisite (floor before background before auth)', () => {
    const r = resolveOverlayDrawingReadiness({
      levelId: 'lvl_1', floorId: null, backgroundImageId: null, sceneFileId: null, userId: null,
    });
    expect(r).toEqual({ ready: false, reason: 'no-floor' });
  });

  it('a draft (floor-less) level with an in-app drawing is still not drawable — zones belong to a floor', () => {
    const r = resolveOverlayDrawingReadiness({ ...READY, floorId: null, sceneFileId: 'file_born' });
    expect(r).toEqual({ ready: false, reason: 'no-floor' });
  });
});

describe('messages + remedies', () => {
  it('every block reason has a dxf-viewer-shell message key', () => {
    for (const key of Object.values(OVERLAY_DRAWING_BLOCK_MESSAGE_KEYS)) {
      expect(key).toMatch(/^overlayReadiness\.[a-zA-Z]+$/);
    }
    expect(Object.keys(OVERLAY_DRAWING_BLOCK_MESSAGE_KEYS).sort()).toEqual(
      ['no-auth', 'no-background', 'no-floor', 'no-level'],
    );
  });

  it('only the missing-reference reason offers the import remedy', () => {
    expect(OVERLAY_DRAWING_REMEDY_ACTIONS).toEqual({ 'no-background': 'import-floorplan-wizard' });
  });

  it('OverlayPersistBlockedError carries the typed reason', () => {
    const err = new OverlayPersistBlockedError('no-floor');
    expect(err).toBeInstanceOf(Error);
    expect(err.reason).toBe('no-floor');
  });
});
