/**
 * ADR-344 Phase 6.A — Tests for the layer edit guard (Q8).
 */

import { describe, it, expect } from '@jest/globals';
import { assertCanEditLayer } from '../CanEditLayerGuard';
import { CanEditLayerError } from '../types';
import { makeLayerProvider } from './test-fixtures';

describe('assertCanEditLayer', () => {
  it('passes when the layer is not registered (unknown layers are editable)', () => {
    const provider = makeLayerProvider({});
    expect(() => assertCanEditLayer({ layerName: 'ghost', provider })).not.toThrow();
  });

  it('passes when the layer exists and is neither locked nor frozen', () => {
    const provider = makeLayerProvider({ '0': {} });
    expect(() => assertCanEditLayer({ layerName: '0', provider })).not.toThrow();
  });

  it('throws CanEditLayerError when the layer is frozen, regardless of capability', () => {
    const provider = makeLayerProvider({ 'frozen-layer': { frozen: true } }, true);
    expect(() => assertCanEditLayer({ layerName: 'frozen-layer', provider })).toThrow(
      CanEditLayerError,
    );
  });

  it('throws when locked and the user lacks canUnlockLayer', () => {
    const provider = makeLayerProvider({ 'locked-layer': { locked: true } }, false);
    expect(() => assertCanEditLayer({ layerName: 'locked-layer', provider })).toThrow(
      CanEditLayerError,
    );
  });

  it('passes when locked but the user has canUnlockLayer', () => {
    const provider = makeLayerProvider({ 'locked-layer': { locked: true } }, true);
    expect(() => assertCanEditLayer({ layerName: 'locked-layer', provider })).not.toThrow();
  });

  it('surfaces the offending layer name on the thrown error', () => {
    const provider = makeLayerProvider({ 'locked-layer': { locked: true } }, false);
    try {
      assertCanEditLayer({ layerName: 'locked-layer', provider });
      fail('expected guard to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(CanEditLayerError);
      expect((err as CanEditLayerError).layerName).toBe('locked-layer');
    }
  });
});
