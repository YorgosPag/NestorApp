/**
 * Tests for layer-name-validator (ADR-358 §5.6 Q9 — Strict AutoCAD parity).
 *
 * Coverage: 7 rules + Layer "0" hardening + error precedence + suggestions.
 */

import { describe, it, expect } from '@jest/globals';
import { validateLayerName } from '../layer-name-validator';
import { createSceneLayer } from '../../types/entities';
import type { SceneLayer } from '../../types/entities';

const layer = (id: string, name: string): SceneLayer =>
  createSceneLayer({ id, name });

describe('layer-name-validator (ADR-358 §5.6 Q9 Strict)', () => {
  describe('Rule 1: EMPTY', () => {
    it('rejects empty string', () => {
      const r = validateLayerName({ name: '', existingLayers: [] });
      expect(r.valid).toBe(false);
      expect(r.error).toBe('EMPTY');
    });
  });

  describe('Rule 2: WHITESPACE_ONLY', () => {
    it('rejects all-space string', () => {
      const r = validateLayerName({ name: '   ', existingLayers: [] });
      expect(r.error).toBe('WHITESPACE_ONLY');
    });

    it('rejects tabs + newlines only', () => {
      const r = validateLayerName({ name: '\t\n  ', existingLayers: [] });
      expect(r.error).toBe('WHITESPACE_ONLY');
    });
  });

  describe('Rule 3: LEADING_TRAILING_WS', () => {
    it('rejects leading whitespace + suggests trimmed', () => {
      const r = validateLayerName({ name: '  Walls', existingLayers: [] });
      expect(r.valid).toBe(false);
      expect(r.error).toBe('LEADING_TRAILING_WS');
      expect(r.suggestion).toBe('Walls');
    });

    it('rejects trailing whitespace', () => {
      const r = validateLayerName({ name: 'Walls   ', existingLayers: [] });
      expect(r.error).toBe('LEADING_TRAILING_WS');
      expect(r.suggestion).toBe('Walls');
    });

    it('rejects both sides', () => {
      const r = validateLayerName({ name: ' Walls ', existingLayers: [] });
      expect(r.suggestion).toBe('Walls');
    });
  });

  describe('Rule 4: TOO_LONG', () => {
    it('accepts exactly 255 chars', () => {
      const r = validateLayerName({ name: 'a'.repeat(255), existingLayers: [] });
      expect(r.valid).toBe(true);
    });

    it('rejects 256 chars + suggests truncated 255', () => {
      const long = 'a'.repeat(256);
      const r = validateLayerName({ name: long, existingLayers: [] });
      expect(r.error).toBe('TOO_LONG');
      expect(r.suggestion).toBe('a'.repeat(255));
    });
  });

  describe('Rule 5: INVALID_CHARS', () => {
    it.each([
      ['<', 'Wall<s'],
      ['>', 'Wall>s'],
      ['/', 'Wall/s'],
      ['\\', 'Wall\\s'],
      ['"', 'Wall"s'],
      [':', 'Wall:s'],
      [';', 'Wall;s'],
      ['?', 'Wall?s'],
      ['*', 'Wall*s'],
      ['|', 'Wall|s'],
      [',', 'Wall,s'],
      ['=', 'Wall=s'],
      ['`', 'Wall`s'],
      ["'", "Wall's"],
    ])('rejects forbidden char %s', (_char, name) => {
      const r = validateLayerName({ name, existingLayers: [] });
      expect(r.valid).toBe(false);
      expect(r.error).toBe('INVALID_CHARS');
    });

    it('suggests stripped variant when some chars survive', () => {
      const r = validateLayerName({ name: 'Wa<ll>s', existingLayers: [] });
      expect(r.suggestion).toBe('Walls');
    });

    it('omits suggestion when strip would leave empty string', () => {
      const r = validateLayerName({ name: '<>/', existingLayers: [] });
      expect(r.error).toBe('INVALID_CHARS');
      expect(r.suggestion).toBeUndefined();
    });

    it('accepts unicode letters (Greek)', () => {
      const r = validateLayerName({ name: 'Τοίχοι-Α1', existingLayers: [] });
      expect(r.valid).toBe(true);
    });

    it('accepts hyphens, underscores, dots, parentheses', () => {
      const r = validateLayerName({ name: 'A-WALL_FULL.v2 (north)', existingLayers: [] });
      expect(r.valid).toBe(true);
    });
  });

  describe('Rule 6: RESERVED — Layer "0" hardening', () => {
    const layer0 = layer('lyr_0', '0');
    const layerWalls = layer('lyr_W', 'Walls');

    it('rejects create with name "0" when Layer 0 exists', () => {
      const r = validateLayerName({
        name: '0',
        existingLayers: [layer0, layerWalls],
      });
      expect(r.error).toBe('RESERVED');
    });

    it('rejects create with name "0" even when Layer 0 absent', () => {
      const r = validateLayerName({ name: '0', existingLayers: [] });
      expect(r.error).toBe('RESERVED');
    });

    it('rejects rename Walls → "0"', () => {
      const r = validateLayerName({
        name: '0',
        existingLayers: [layer0, layerWalls],
        excludeId: layerWalls.id,
      });
      expect(r.error).toBe('RESERVED');
    });

    it('rejects rename Layer 0 → any other name', () => {
      const r = validateLayerName({
        name: 'SystemRenamed',
        existingLayers: [layer0, layerWalls],
        excludeId: layer0.id,
      });
      expect(r.error).toBe('RESERVED');
    });

    it('allows no-op rename Layer 0 → "0" (idempotent)', () => {
      const r = validateLayerName({
        name: '0',
        existingLayers: [layer0],
        excludeId: layer0.id,
      });
      expect(r.valid).toBe(true);
    });
  });

  describe('Rule 7: DUPLICATE (case-insensitive)', () => {
    const layers = [layer('lyr_A', 'Walls'), layer('lyr_B', 'Doors')];

    it('rejects exact name match', () => {
      const r = validateLayerName({ name: 'Walls', existingLayers: layers });
      expect(r.error).toBe('DUPLICATE');
      expect(r.suggestion).toBe('Walls (2)');
    });

    it('rejects case-insensitive match', () => {
      const r = validateLayerName({ name: 'WALLS', existingLayers: layers });
      expect(r.error).toBe('DUPLICATE');
    });

    it('accepts rename to same name with own excludeId (idempotent)', () => {
      const r = validateLayerName({
        name: 'Walls',
        existingLayers: layers,
        excludeId: 'lyr_A',
      });
      expect(r.valid).toBe(true);
    });

    it('rejects rename onto a sibling name even with excludeId', () => {
      const r = validateLayerName({
        name: 'Doors',
        existingLayers: layers,
        excludeId: 'lyr_A',
      });
      expect(r.error).toBe('DUPLICATE');
    });

    it('suggestion increments until free slot found', () => {
      const filled = [
        layer('a', 'Walls'),
        layer('b', 'Walls (2)'),
        layer('c', 'Walls (3)'),
      ];
      const r = validateLayerName({ name: 'Walls', existingLayers: filled });
      expect(r.suggestion).toBe('Walls (4)');
    });
  });

  describe('Happy path', () => {
    it('accepts simple ASCII name', () => {
      const r = validateLayerName({ name: 'A-WALL', existingLayers: [] });
      expect(r.valid).toBe(true);
      expect(r.error).toBeNull();
    });

    it('accepts AIA-style sibling name', () => {
      const r = validateLayerName({
        name: 'A-WALL-FULL',
        existingLayers: [layer('1', 'A-WALL-PRTN')],
      });
      expect(r.valid).toBe(true);
    });
  });

  describe('Error precedence (fail-fast)', () => {
    it('EMPTY beats DUPLICATE', () => {
      const r = validateLayerName({
        name: '',
        existingLayers: [layer('1', '')],
      });
      expect(r.error).toBe('EMPTY');
    });

    it('WHITESPACE_ONLY beats LEADING_TRAILING_WS', () => {
      const r = validateLayerName({ name: '   ', existingLayers: [] });
      expect(r.error).toBe('WHITESPACE_ONLY');
    });

    it('LEADING_TRAILING_WS beats DUPLICATE', () => {
      const r = validateLayerName({
        name: 'Walls ',
        existingLayers: [layer('1', 'Walls')],
      });
      expect(r.error).toBe('LEADING_TRAILING_WS');
    });

    it('INVALID_CHARS beats RESERVED + DUPLICATE', () => {
      const r = validateLayerName({
        name: '0<',
        existingLayers: [layer('1', '0')],
      });
      expect(r.error).toBe('INVALID_CHARS');
    });

    it('RESERVED beats DUPLICATE', () => {
      const r = validateLayerName({
        name: '0',
        existingLayers: [layer('1', '0')],
      });
      expect(r.error).toBe('RESERVED');
    });
  });

  describe('Result shape', () => {
    it('valid result is frozen + has null error + no suggestion', () => {
      const r = validateLayerName({ name: 'X', existingLayers: [] });
      expect(r.valid).toBe(true);
      expect(r.error).toBeNull();
      expect(Object.isFrozen(r)).toBe(true);
    });

    it('invalid result is frozen', () => {
      const r = validateLayerName({ name: '', existingLayers: [] });
      expect(Object.isFrozen(r)).toBe(true);
    });
  });
});
