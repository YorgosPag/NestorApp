/**
 * @file grip-size-default-ssot.test.ts
 * @description SSoT regression guard for the base grip size default.
 *
 * Root cause of "grips sometimes big, sometimes small" (2026-06-20): the base
 * grip pixel size was hardcoded in ~6 places split between 14, 7 and 5, so the
 * synced value flipped depending on which default/sync path won at a given
 * lifecycle moment. Unified to a single `GRIP_SIZE_DEFAULT` constant.
 *
 * This test fails if any default surface diverges from the canonical again.
 */

import { GRIP_SIZE_DEFAULT } from '../grip-size-default';
import { UI_SIZE_DEFAULTS } from '../text-rendering-config';
import { DEFAULT_GRIP_SETTINGS as DEFAULT_GRIP_SETTINGS_TYPES } from '../../types/gripSettings';
import { DEFAULT_GRIP_SETTINGS as DEFAULT_GRIP_SETTINGS_CORE } from '../../settings-core/defaults';
import { DEFAULT_GRIP_SETTINGS as DEFAULT_GRIP_SETTINGS_FACTORY } from '../../settings/FACTORY_DEFAULTS';
import { validateGripSize, validateGripSettings } from '../../settings-core/types/domain';

describe('Grip size default — Single Source of Truth', () => {
  it('canonical value is the AutoCAD GRIPSIZE (7)', () => {
    expect(GRIP_SIZE_DEFAULT).toBe(7);
  });

  it('UI_SIZE_DEFAULTS.GRIP_SIZE references the canonical', () => {
    expect(UI_SIZE_DEFAULTS.GRIP_SIZE).toBe(GRIP_SIZE_DEFAULT);
  });

  it('all DEFAULT_GRIP_SETTINGS surfaces agree on the canonical', () => {
    expect(DEFAULT_GRIP_SETTINGS_TYPES.gripSize).toBe(GRIP_SIZE_DEFAULT);
    expect(DEFAULT_GRIP_SETTINGS_CORE.gripSize).toBe(GRIP_SIZE_DEFAULT);
    expect(DEFAULT_GRIP_SETTINGS_FACTORY.gripSize).toBe(GRIP_SIZE_DEFAULT);
  });

  it('FACTORY backward-compat `size` mirrors the canonical', () => {
    expect((DEFAULT_GRIP_SETTINGS_FACTORY as { size?: number }).size).toBe(GRIP_SIZE_DEFAULT);
  });

  it('validators fall back to the canonical when no value is provided', () => {
    expect(validateGripSize(undefined)).toBe(GRIP_SIZE_DEFAULT);
    expect(validateGripSize(null)).toBe(GRIP_SIZE_DEFAULT);
    expect(validateGripSize(NaN)).toBe(GRIP_SIZE_DEFAULT);
    expect(validateGripSettings({}).gripSize).toBe(GRIP_SIZE_DEFAULT);
  });

  it('explicit valid sizes still pass through the validator unchanged', () => {
    // Guard: the SSoT default must not clobber user-provided values.
    expect(validateGripSize(12)).toBe(12);
  });
});
