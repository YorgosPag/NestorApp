/// <reference types="jest" />
/**
 * @file grip-factory-defaults-ssot.test.ts
 * @description SSoT regression guard for the canonical grip default VALUES (ADR-559 §3b).
 *
 * Root cause of the pre-2026-07-07 divergence: the default grip VALUES were re-declared in
 * 7 places that disagreed on `apertureSize` (10 vs 20) and warm colour (orange vs hot-pink).
 * Unified into `GRIP_FACTORY_DEFAULTS`; every other surface DERIVES from it.
 *
 * This test fails if any derived surface drifts from the canonical again.
 */

import { GRIP_FACTORY_DEFAULTS } from '../grip-factory-defaults';
import { GRIP_WARM_COLOR, GRIP_HOT_COLOR, GRIP_COLD_COLOR } from '../color-config';
import { DEFAULT_GRIP_SETTINGS as DEFAULT_TYPES } from '../../types/gripSettings';
import { DEFAULT_GRIP_SETTINGS as DEFAULT_CORE } from '../../settings-core/defaults';
import { DEFAULT_GRIP_SETTINGS as DEFAULT_FACTORY, FACTORY_DEFAULTS } from '../../settings/FACTORY_DEFAULTS';
import { validateGripSettings } from '../../settings-core/types/domain';
import { gripStyleStore } from '../../stores/GripStyleStore';

const CANONICAL_APERTURE = 20;

describe('Grip factory defaults — Single Source of Truth (ADR-559 §3b)', () => {
  it('canonical decisions: aperture 20, warm = GRIP_WARM_COLOR = magenta/ροζ', () => {
    expect(GRIP_FACTORY_DEFAULTS.apertureSize).toBe(CANONICAL_APERTURE);
    expect(GRIP_WARM_COLOR).toBe('#ff00ff');
    expect(GRIP_FACTORY_DEFAULTS.colors.warm).toBe(GRIP_WARM_COLOR);
    expect(GRIP_FACTORY_DEFAULTS.colors.hot).toBe(GRIP_HOT_COLOR);
    expect(GRIP_FACTORY_DEFAULTS.colors.cold).toBeNull(); // sentinel → resolved at render
  });

  it('all stored/input DEFAULT_GRIP_SETTINGS surfaces agree on aperture 20', () => {
    expect(DEFAULT_TYPES.apertureSize).toBe(CANONICAL_APERTURE);
    expect(DEFAULT_CORE.apertureSize).toBe(CANONICAL_APERTURE);
    expect(DEFAULT_FACTORY.apertureSize).toBe(CANONICAL_APERTURE);
    expect(FACTORY_DEFAULTS.grip.general.apertureSize).toBe(CANONICAL_APERTURE);
  });

  it('all surfaces agree on warm = GRIP_WARM_COLOR', () => {
    expect(DEFAULT_TYPES.colors.warm).toBe(GRIP_WARM_COLOR);
    expect(DEFAULT_CORE.colors.warm).toBe(GRIP_WARM_COLOR);
    expect(DEFAULT_FACTORY.colors.warm).toBe(GRIP_WARM_COLOR);
    expect(FACTORY_DEFAULTS.grip.general.colors.warm).toBe(GRIP_WARM_COLOR);
  });

  it('FACTORY legacy flat `hoverColor` mirrors the canonical warm', () => {
    expect((DEFAULT_FACTORY as { hoverColor?: string }).hoverColor).toBe(GRIP_WARM_COLOR);
  });

  it('validateGripSettings({}) falls back to the canonical (aperture 20, warm ροζ)', () => {
    const validated = validateGripSettings({});
    expect(validated.apertureSize).toBe(CANONICAL_APERTURE);
    expect(validated.colors.warm).toBe(GRIP_WARM_COLOR);
  });

  it('runtime GripStyleStore INITIAL derives canonical (aperture 20, warm ροζ, resolved cold)', () => {
    const style = gripStyleStore.get();
    expect(style.apertureSize).toBe(CANONICAL_APERTURE);
    expect(style.colors.warm).toBe(GRIP_WARM_COLOR);
    expect(style.colors.cold).toBe(GRIP_COLD_COLOR); // sentinel resolved to concrete at init
  });
});
