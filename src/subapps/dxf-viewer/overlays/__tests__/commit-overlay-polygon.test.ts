/// <reference types="jest" />
/**
 * ADR-933 — Η ΜΙΑ πόρτα «πολύγωνο → περιοχή κάτοψης».
 *
 * Κλειδώνει τη ρίζα του μπλοκαρισμένου ζωντανού ελέγχου ADR-931 Β1: το είδος που γράφεται
 * είναι αυτό του SSoT την ώρα της αποθήκευσης — όχι ένα καρφωμένο `'property'`. Και την
 * ιδεμποτία: η ίδια περιοχή δεύτερη φορά ⇒ επιλέγεται η υπάρχουσα, δεν γράφεται διπλότυπο.
 */

import { commitOverlayPolygon, findEquivalentOverlay } from '../commit-overlay-polygon';
import { OverlayPersistBlockedError } from '../overlay-drawing-readiness';
import { overlayDrawSettingsStore } from '../../stores/overlay-draw-settings-store';
import type { CreateOverlayData, Overlay } from '../types';

type Ring = Array<[number, number]>;

const SQUARE: Ring = [[0, 0], [1000, 0], [1000, 1000], [0, 1000]];

function overlay(id: string, polygon: Ring): Overlay {
  return { id, levelId: 'lvl_1', kind: 'property', polygon, createdAt: 0, updatedAt: 0, createdBy: 'u' };
}

function setup(existing: Overlay[] = [], add?: (data: CreateOverlayData) => Promise<string>) {
  const emit = jest.fn();
  const addFn = jest.fn(add ?? (async () => 'ovl_new'));
  const deps = {
    levelId: 'lvl_1',
    createOverlay: addFn,
    getLevelOverlays: () => existing,
    emit,
  };
  return { deps, emit, addFn };
}

beforeEach(() => {
  localStorage.clear();
  overlayDrawSettingsStore.reset();
});

describe('commitOverlayPolygon', () => {
  it('writes the kind chosen in the SSoT at save time (not a hardcoded property)', async () => {
    overlayDrawSettingsStore.update({ kind: 'common_space' });
    const { deps, emit, addFn } = setup();
    const result = await commitOverlayPolygon(SQUARE, deps);
    expect(result).toEqual({ ok: true, overlayId: 'ovl_new', reused: false });
    expect(addFn).toHaveBeenCalledWith(expect.objectContaining({ levelId: 'lvl_1', kind: 'common_space', polygon: SQUARE }));
    expect(emit).toHaveBeenCalledWith('overlay:polygon-saved', { overlayId: 'ovl_new' });
  });

  it('is idempotent: the same region again selects the existing one, no second write', async () => {
    const { deps, emit, addFn } = setup([overlay('ovl_old', SQUARE)]);
    // Ίδια περιοχή με άλλη σειρά/αρχή κορυφών (π.χ. «κλικ μέσα» δεύτερη φορά).
    const result = await commitOverlayPolygon([[1000, 1000], [0, 1000], [0, 0], [1000, 0]], deps);
    expect(result).toEqual({ ok: true, overlayId: 'ovl_old', reused: true });
    expect(addFn).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith('overlay:polygon-saved', { overlayId: 'ovl_old', reused: true });
  });

  it('a different region on the same level is written', async () => {
    const { deps, addFn } = setup([overlay('ovl_old', SQUARE)]);
    await commitOverlayPolygon([[0, 0], [500, 0], [500, 1000], [0, 1000]], deps);
    expect(addFn).toHaveBeenCalledTimes(1);
  });

  it('no level ⇒ save-error no-level, nothing written', async () => {
    const { deps, emit, addFn } = setup();
    const result = await commitOverlayPolygon(SQUARE, { ...deps, levelId: null });
    expect(result).toEqual({ ok: false });
    expect(addFn).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith('overlay:save-error', { reason: 'no-level' });
  });

  it('fewer than 3 points ⇒ nothing happens', async () => {
    const { deps, emit, addFn } = setup();
    expect(await commitOverlayPolygon([[0, 0], [1, 1]], deps)).toEqual({ ok: false });
    expect(addFn).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('reports the REAL failure cause (blocked vs persist failure)', async () => {
    const blocked = setup([], async () => { throw new OverlayPersistBlockedError('no-background'); });
    await commitOverlayPolygon(SQUARE, blocked.deps);
    expect(blocked.emit).toHaveBeenCalledWith('overlay:save-error', { reason: 'no-background' });

    const failed = setup([], async () => { throw new Error('network'); });
    await commitOverlayPolygon(SQUARE, failed.deps);
    expect(failed.emit).toHaveBeenCalledWith('overlay:save-error', { reason: 'persist-failed' });
  });
});

describe('findEquivalentOverlay', () => {
  it('ignores a region of clearly different area even if it contains the centroid', () => {
    const big = overlay('ovl_big', [[-5000, -5000], [5000, -5000], [5000, 5000], [-5000, 5000]]);
    expect(findEquivalentOverlay(SQUARE, [big])).toBeNull();
  });
});
