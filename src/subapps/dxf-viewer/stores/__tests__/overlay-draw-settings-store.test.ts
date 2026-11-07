/// <reference types="jest" />
/**
 * ADR-933 — SSoT ρυθμίσεων της εντολής «Περιοχή».
 *
 * Κλειδώνει: (1) κάθε τιμή που μπαίνει στο store περνά από κανονικοποίηση — άκυρο είδος ή
 * μέθοδος δεν φτάνει ΠΟΤΕ στην πόρτα αποθήκευσης· (2) το είδος επιβιώνει ανάμεσα σε
 * συνεδρίες (Revit/ArchiCAD: «κολλώδης» προεπιλογή του επόμενου στοιχείου)· (3) ο κατάλογος
 * ειδών είναι ο ΙΔΙΟΣ με το `KIND_LABELS` (καμία δεύτερη λίστα).
 */

import {
  DEFAULT_OVERLAY_DRAW_SETTINGS,
  normalizeOverlayDrawSettings,
  overlayDrawSettingsStore,
} from '../overlay-draw-settings-store';
import { KIND_LABELS, OVERLAY_KINDS, isOverlayKind } from '../../overlays/types';
import { STORAGE_KEYS } from '../../utils/storage-utils';

beforeEach(() => {
  localStorage.clear();
  overlayDrawSettingsStore.reset();
});

describe('normalizeOverlayDrawSettings', () => {
  it('returns the defaults for garbage input', () => {
    expect(normalizeOverlayDrawSettings(null)).toEqual(DEFAULT_OVERLAY_DRAW_SETTINGS);
    expect(normalizeOverlayDrawSettings('x')).toEqual(DEFAULT_OVERLAY_DRAW_SETTINGS);
  });

  it('keeps valid fields and replaces only the invalid ones', () => {
    expect(normalizeOverlayDrawSettings({ kind: 'common_space', method: 'nope' })).toEqual({
      kind: 'common_space',
      method: DEFAULT_OVERLAY_DRAW_SETTINGS.method,
    });
    expect(normalizeOverlayDrawSettings({ kind: 'apartment', method: 'rectangle' })).toEqual({
      kind: DEFAULT_OVERLAY_DRAW_SETTINGS.kind,
      method: 'rectangle',
    });
  });
});

describe('overlayDrawSettingsStore', () => {
  it('update() merges, persists and notifies', () => {
    let notified = 0;
    const unsubscribe = overlayDrawSettingsStore.subscribe(() => { notified += 1; });
    overlayDrawSettingsStore.update({ kind: 'common_space' });
    unsubscribe();
    expect(overlayDrawSettingsStore.get()).toEqual({ kind: 'common_space', method: 'polygon' });
    expect(notified).toBe(1);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.OVERLAY_DRAW_SETTINGS) as string)).toEqual({
      kind: 'common_space',
      method: 'polygon',
    });
  });

  it('an invalid value never reaches the store', () => {
    overlayDrawSettingsStore.update({ kind: 'storage' });
    // Τύπος που δεν υπάρχει (π.χ. από παλιό/χειροποίητο localStorage) ⇒ προεπιλογή, όχι διαρροή.
    overlayDrawSettingsStore.update(JSON.parse('{"kind":"apartment"}'));
    expect(overlayDrawSettingsStore.get().kind).toBe(DEFAULT_OVERLAY_DRAW_SETTINGS.kind);
  });

  it('a same-value update does not notify', () => {
    overlayDrawSettingsStore.update({ method: 'rectangle' });
    let notified = 0;
    const unsubscribe = overlayDrawSettingsStore.subscribe(() => { notified += 1; });
    overlayDrawSettingsStore.update({ method: 'rectangle' });
    unsubscribe();
    expect(notified).toBe(0);
  });
});

describe('OVERLAY_KINDS', () => {
  it('is exactly the KIND_LABELS key set (one declaration point)', () => {
    expect([...OVERLAY_KINDS].sort()).toEqual(Object.keys(KIND_LABELS).sort());
    expect(OVERLAY_KINDS).toContain('common_space');
  });

  it('isOverlayKind rejects unknown values', () => {
    expect(isOverlayKind('common_space')).toBe(true);
    expect(isOverlayKind('apartment')).toBe(false);
    expect(isOverlayKind(undefined)).toBe(false);
  });
});
