/**
 * Unit tests — migrateSelectionBox (persisted selection settings migration)
 *
 * This is the read path for settings users have already saved: it fills in
 * fields added after they last wrote, and renames the pre-schema `opacity` to
 * `fillOpacity`. A regression here silently resets someone's selection colours,
 * so the defaulting rules are pinned per field.
 *
 * The helper replaced two byte-identical inline blocks (one per mode); these
 * tests cover both modes to prove the shared path still picks the right
 * defaults for each.
 */

// `config.ts` reaches the Firestore-backed settings repository at import time,
// which drags in the Firebase auth SDK (needs `fetch`). The migration helper
// under test touches none of it.
jest.mock('@/services/user-settings', () => ({
  userSettingsRepository: {
    bind: jest.fn(),
    subscribeSlice: jest.fn(() => jest.fn()),
    updateSlice: jest.fn(),
  },
}));

import {
  DEFAULT_CURSOR_SETTINGS,
  migrateSelectionBox,
  type SelectionBoxSettings,
} from '../config';

const WINDOW_DEFAULTS = DEFAULT_CURSOR_SETTINGS.selection.window;
const CROSSING_DEFAULTS = DEFAULT_CURSOR_SETTINGS.selection.crossing;

describe('migrateSelectionBox — absent input', () => {
  it('returns the window defaults when nothing was persisted', () => {
    expect(migrateSelectionBox('window', undefined)).toEqual(WINDOW_DEFAULTS);
  });

  it('returns the crossing defaults when nothing was persisted', () => {
    expect(migrateSelectionBox('crossing', undefined)).toEqual(CROSSING_DEFAULTS);
  });

  it('picks defaults per mode — the two boxes do not share a style', () => {
    // Guards the mode parameter: crossing defaults to dashed, window to solid.
    expect(migrateSelectionBox('window', undefined).borderStyle).toBe('solid');
    expect(migrateSelectionBox('crossing', undefined).borderStyle).toBe('dashed');
    expect(migrateSelectionBox('window', undefined).fillColor).not.toBe(
      migrateSelectionBox('crossing', undefined).fillColor,
    );
  });

  it('does not return the defaults object itself', () => {
    // A shared reference would let a later write mutate the defaults.
    expect(migrateSelectionBox('window', undefined)).not.toBe(WINDOW_DEFAULTS);
  });
});

describe('migrateSelectionBox — persisted values win', () => {
  it('keeps every persisted field', () => {
    const stored: SelectionBoxSettings = {
      fillColor: '#123456',
      fillOpacity: 0.55,
      borderColor: '#abcdef',
      borderOpacity: 0.4,
      borderStyle: 'dash-dot',
      borderWidth: 3.25,
    };

    expect(migrateSelectionBox('window', stored)).toEqual(stored);
  });

  it('keeps falsy-but-valid numbers rather than falling back', () => {
    const stored = {
      ...WINDOW_DEFAULTS,
      fillOpacity: 0,
      borderOpacity: 0,
    } as SelectionBoxSettings;

    const result = migrateSelectionBox('window', stored);

    // `??` not `||` — 0 is a legitimate "fully transparent".
    expect(result.fillOpacity).toBe(0);
    expect(result.borderOpacity).toBe(0);
  });
});

describe('migrateSelectionBox — schema gaps', () => {
  it('fills fields the persisted box never had', () => {
    const legacy = { fillColor: '#111111' } as SelectionBoxSettings;

    const result = migrateSelectionBox('crossing', legacy);

    expect(result.fillColor).toBe('#111111');
    expect(result.borderColor).toBe(CROSSING_DEFAULTS.borderColor);
    expect(result.borderStyle).toBe(CROSSING_DEFAULTS.borderStyle);
    expect(result.borderWidth).toBe(CROSSING_DEFAULTS.borderWidth);
    expect(result.borderOpacity).toBe(CROSSING_DEFAULTS.borderOpacity);
  });

  it('renames the pre-schema `opacity` to `fillOpacity`', () => {
    const legacy = { opacity: 0.75 } as unknown as SelectionBoxSettings;

    expect(migrateSelectionBox('window', legacy).fillOpacity).toBe(0.75);
  });

  it('prefers an explicit fillOpacity over the legacy `opacity`', () => {
    const both = {
      fillOpacity: 0.3,
      opacity: 0.9,
    } as unknown as SelectionBoxSettings;

    expect(migrateSelectionBox('window', both).fillOpacity).toBe(0.3);
  });

  it('treats an empty borderStyle as missing', () => {
    // `||` not `??` — '' is not a usable style.
    const blank = { borderStyle: '' } as unknown as SelectionBoxSettings;

    expect(migrateSelectionBox('crossing', blank).borderStyle).toBe(
      CROSSING_DEFAULTS.borderStyle,
    );
  });
});
