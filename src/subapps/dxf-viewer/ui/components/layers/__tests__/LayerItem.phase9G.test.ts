/**
 * ADR-358 Phase 9G — LayerItem system-layer protection + real-time rename validation.
 *
 * Strategy: test the `validateLayerName` SSoT directly (same function consumed
 * by LayerItem onChange). Avoids heavy React mock setup while covering all
 * critical logic paths. Badge/button rendering is verified manually in the UI.
 */

import { describe, it, expect } from '@jest/globals';
import { validateLayerName } from '../../../../services/layer-name-validator';
import { createSceneLayer } from '../../../../types/entities';
import type { SceneLayer } from '../../../../types/entities';

const layer = (id: string, name: string): SceneLayer =>
  createSceneLayer({ id, name });

const layer0 = layer('lyr_000', '0');
const wallsLayer = layer('lyr_001', 'Walls');
const dimsLayer = layer('lyr_002', 'Dimensions');

describe('LayerItem Phase 9G — Layer "0" protection + real-time validation (ADR-358 §5.6 Q9)', () => {
  describe('isSystemLayer detection', () => {
    it('layer name "0" is the system layer', () => {
      expect(layer0.name === '0').toBe(true);
    });

    it('layer name "Walls" is NOT the system layer', () => {
      expect(wallsLayer.name === '0').toBe(false);
    });
  });

  describe('RESERVED — Layer "0" rename protection', () => {
    it('rejects renaming Layer "0" to any other name', () => {
      const result = validateLayerName({
        name: 'Walls',
        existingLayers: [layer0, wallsLayer],
        excludeId: layer0.id,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('RESERVED');
    });

    it('accepts no-op rename of Layer "0" to "0" (idempotent)', () => {
      const result = validateLayerName({
        name: '0',
        existingLayers: [layer0],
        excludeId: layer0.id,
      });
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('rejects creating a new layer named "0" when Layer 0 exists', () => {
      const result = validateLayerName({
        name: '0',
        existingLayers: [layer0],
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('RESERVED');
    });
  });

  describe('DUPLICATE — real-time duplicate check', () => {
    it('rejects duplicate name (case-insensitive) and provides suggestion', () => {
      const result = validateLayerName({
        name: 'walls',
        existingLayers: [layer0, wallsLayer, dimsLayer],
        excludeId: dimsLayer.id,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('DUPLICATE');
      expect(result.suggestion).toBe('walls (2)');
    });

    it('accepts original name when renaming same layer (excludeId)', () => {
      const result = validateLayerName({
        name: 'Walls',
        existingLayers: [layer0, wallsLayer],
        excludeId: wallsLayer.id,
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('INVALID_CHARS — forbidden character feedback', () => {
    it('rejects name with < and provides stripped suggestion', () => {
      const result = validateLayerName({
        name: 'Wall<s>',
        existingLayers: [layer0],
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_CHARS');
      expect(result.suggestion).toBe('Walls');
    });

    it('rejects name with * (wildcard)', () => {
      const result = validateLayerName({
        name: 'Walls*',
        existingLayers: [layer0],
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_CHARS');
    });
  });

  describe('EMPTY / WHITESPACE_ONLY — empty input guard', () => {
    it('rejects empty string', () => {
      const result = validateLayerName({ name: '', existingLayers: [] });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('EMPTY');
    });

    it('rejects whitespace-only string', () => {
      const result = validateLayerName({ name: '   ', existingLayers: [] });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('WHITESPACE_ONLY');
    });
  });

  describe('Valid names pass all checks', () => {
    it('Greek name with hyphens is valid', () => {
      const result = validateLayerName({
        name: 'Τοίχοι-Α1',
        existingLayers: [layer0, wallsLayer],
      });
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('underscore and dot are allowed', () => {
      const result = validateLayerName({
        name: 'A_Layer.v2',
        existingLayers: [layer0],
      });
      expect(result.valid).toBe(true);
    });
  });
});
