/**
 * ADR-446 — Visual Style SSoT tests.
 *
 * Covers the preset↔axes mapping (the single source of truth for the FACES/EDGES
 * appearance axes) + the `resolveBimSettings` derivation/back-compat path.
 */

import {
  VISUAL_STYLE_PRESETS,
  VISUAL_STYLE_AXES,
  DEFAULT_VISUAL_STYLE,
  resolveVisualStyleAxes,
  isVisualStylePreset,
  type VisualStylePreset,
} from '../bim-visual-style';
import {
  resolveBimSettings,
  deriveVisualStyleFromLegacy,
} from '../bim-render-settings-types';

describe('ADR-446 — Visual Style preset↔axes mapping', () => {
  it('exposes all 8 Revit presets in display order', () => {
    expect(VISUAL_STYLE_PRESETS).toEqual([
      'wireframe', 'hidden-line', 'shaded', 'shaded-edges',
      'consistent', 'consistent-edges', 'realistic', 'realistic-edges',
    ]);
  });

  it('every preset has a {faceMode, edgeMode} entry', () => {
    for (const preset of VISUAL_STYLE_PRESETS) {
      expect(VISUAL_STYLE_AXES[preset]).toBeDefined();
    }
  });

  it.each<[VisualStylePreset, string, string]>([
    ['wireframe', 'none', 'all'],
    ['hidden-line', 'hidden-line', 'visible'],
    ['shaded', 'shaded', 'none'],
    ['shaded-edges', 'shaded', 'visible'],
    ['consistent', 'consistent', 'none'],
    ['consistent-edges', 'consistent', 'visible'],
    ['realistic', 'realistic', 'none'],
    ['realistic-edges', 'realistic', 'visible'],
  ])('%s → faces=%s edges=%s', (preset, faceMode, edgeMode) => {
    expect(resolveVisualStyleAxes(preset)).toEqual({ faceMode, edgeMode });
  });

  it('default = shaded-edges (Giorgio default 2026-06-13)', () => {
    expect(DEFAULT_VISUAL_STYLE).toBe('shaded-edges');
    expect(resolveVisualStyleAxes(null)).toEqual({ faceMode: 'shaded', edgeMode: 'visible' });
  });

  it('isVisualStylePreset guards unknown input', () => {
    expect(isVisualStylePreset('shaded')).toBe(true);
    expect(isVisualStylePreset('bogus')).toBe(false);
    expect(isVisualStylePreset(undefined)).toBe(false);
  });
});

describe('ADR-446 — resolveBimSettings derivation + legacy back-compat', () => {
  it('null settings → default shaded-edges axes', () => {
    const r = resolveBimSettings(null);
    expect(r.visualStyle).toBe('shaded-edges');
    expect(r.faceMode).toBe('shaded');
    expect(r.edgeMode).toBe('visible');
    expect(r.realisticMaterials).toBe(false); // derived (shaded ⇒ not realistic)
  });

  it('explicit visualStyle wins over legacy bit', () => {
    const r = resolveBimSettings({ drawingScale: 100, visualStyle: 'wireframe', realisticMaterials: true });
    expect(r.faceMode).toBe('none');
    expect(r.edgeMode).toBe('all');
    expect(r.realisticMaterials).toBe(false); // wireframe ⇒ not realistic
  });

  it('legacy realisticMaterials:false → shaded-edges when no visualStyle', () => {
    const r = resolveBimSettings({ drawingScale: 100, realisticMaterials: false });
    expect(r.visualStyle).toBe('shaded-edges');
    expect(r.faceMode).toBe('shaded');
    expect(r.realisticMaterials).toBe(false);
  });

  it('deriveVisualStyleFromLegacy maps the legacy bit', () => {
    expect(deriveVisualStyleFromLegacy(false)).toBe('shaded-edges');
    expect(deriveVisualStyleFromLegacy(true)).toBe('realistic-edges');
    expect(deriveVisualStyleFromLegacy(undefined)).toBe('shaded-edges');
  });
});
