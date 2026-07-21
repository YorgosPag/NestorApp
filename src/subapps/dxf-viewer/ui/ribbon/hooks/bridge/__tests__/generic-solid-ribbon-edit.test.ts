/**
 * ADR-684 Φ4-B — unit tests για το pure key→params SSoT του generic-solid ribbon editor
 * (`classifyGenericSolidKey` / `readGenericSolidValue` / `applyGenericSolidRibbonEdit`).
 *
 * Καθαρή λογική (μηδέν React) → κοινή στα δύο modes του bridge (selected-entity ↔ tool-defaults).
 */

import {
  classifyGenericSolidKey,
  readGenericSolidValue,
  applyGenericSolidRibbonEdit,
} from '../generic-solid-ribbon-edit';
import { GENERIC_SOLID_RIBBON_KEYS } from '../generic-solid-command-keys';
import type { GenericSolidParams, GenericSolidShape } from '../../../../../bim/entities/generic-solid/generic-solid-types';

const mkParams = (shape: GenericSolidShape): GenericSolidParams => ({
  kind: 'generic',
  shape,
  position: { x: 0, y: 0, z: 0 },
  rotationDeg: 15,
  mountingElevationMm: 200,
  sceneUnits: 'mm',
});

const RADIUS_KEY = GENERIC_SOLID_RIBBON_KEYS.dim('radiusMm');

describe('classifyGenericSolidKey', () => {
  it('αναγνωρίζει shapeKind / structuralRole / rotation / mounting / dim, αλλιώς null', () => {
    expect(classifyGenericSolidKey(GENERIC_SOLID_RIBBON_KEYS.stringParams.shapeKind)).toEqual({ t: 'shapeKind' });
    expect(classifyGenericSolidKey(GENERIC_SOLID_RIBBON_KEYS.stringParams.structuralRole)).toEqual({ t: 'structuralRole' });
    expect(classifyGenericSolidKey(GENERIC_SOLID_RIBBON_KEYS.params.rotation)).toEqual({ t: 'rotation' });
    expect(classifyGenericSolidKey(GENERIC_SOLID_RIBBON_KEYS.params.mountingElevation)).toEqual({ t: 'mounting' });
    expect(classifyGenericSolidKey(RADIUS_KEY)).toEqual({ t: 'dim', field: 'radiusMm' });
    expect(classifyGenericSolidKey('unrelated.key')).toBeNull();
  });
});

describe('readGenericSolidValue', () => {
  const shape: GenericSolidShape = { kind: 'cylinder', radiusMm: 250, heightMm: 500 };
  it('διαβάζει shapeKind / structuralRole / rotation / mounting / dim ως string', () => {
    expect(readGenericSolidValue({ t: 'shapeKind' }, shape, 15, 200, 'decorative')).toBe('cylinder');
    expect(readGenericSolidValue({ t: 'structuralRole' }, shape, 15, 200, 'structural')).toBe('structural');
    expect(readGenericSolidValue({ t: 'rotation' }, shape, 15, 200, 'decorative')).toBe('15');
    expect(readGenericSolidValue({ t: 'mounting' }, shape, 15, 200, 'decorative')).toBe('200');
    expect(readGenericSolidValue({ t: 'dim', field: 'radiusMm' }, shape, 15, 200, 'decorative')).toBe('250');
  });
  it('dim πεδίο ξένο στο σχήμα → null (το control κρύβεται)', () => {
    expect(readGenericSolidValue({ t: 'dim', field: 'majorRadiusMm' }, shape, 15, 200, 'decorative')).toBeNull();
  });
});

describe('applyGenericSolidRibbonEdit', () => {
  it('shapeKind swap → φορτώνει τις προεπιλογές του νέου σχήματος (family-type swap)', () => {
    const next = applyGenericSolidRibbonEdit(mkParams({ kind: 'box', widthMm: 500, depthMm: 500, heightMm: 500 }), { t: 'shapeKind' }, 'sphere');
    expect(next.shape).toEqual({ kind: 'sphere', radiusMm: 250 });
  });

  it('rotation / mounting → top-level πεδία', () => {
    const base = mkParams({ kind: 'sphere', radiusMm: 250 });
    expect(applyGenericSolidRibbonEdit(base, { t: 'rotation' }, '90').rotationDeg).toBe(90);
    expect(applyGenericSolidRibbonEdit(base, { t: 'mounting' }, '350').mountingElevationMm).toBe(350);
  });

  it('structuralRole → γράφει το metadata flag· άκυρη τιμή → ΙΔΙΕΣ params', () => {
    const base = mkParams({ kind: 'sphere', radiusMm: 250 });
    expect(applyGenericSolidRibbonEdit(base, { t: 'structuralRole' }, 'structural').structuralRole).toBe('structural');
    expect(applyGenericSolidRibbonEdit(base, { t: 'structuralRole' }, 'decorative').structuralRole).toBe('decorative');
    expect(applyGenericSolidRibbonEdit(base, { t: 'structuralRole' }, 'garbage')).toBe(base);
  });

  it('dim → γράφει το πεδίο του shape union', () => {
    const next = applyGenericSolidRibbonEdit(mkParams({ kind: 'cylinder', radiusMm: 250, heightMm: 500 }), { t: 'dim', field: 'heightMm' }, '800');
    expect(next.shape).toEqual({ kind: 'cylinder', radiusMm: 250, heightMm: 800 });
  });

  it('μη-έγκυρος αριθμός → ΙΔΙΕΣ params (referential, short-circuit)', () => {
    const base = mkParams({ kind: 'sphere', radiusMm: 250 });
    expect(applyGenericSolidRibbonEdit(base, { t: 'rotation' }, 'abc')).toBe(base);
    expect(applyGenericSolidRibbonEdit(base, { t: 'dim', field: 'radiusMm' }, 'xyz')).toBe(base);
  });

  it('dim πεδίο ξένο στο σχήμα → ΙΔΙΕΣ params (no-op guard)', () => {
    const base = mkParams({ kind: 'sphere', radiusMm: 250 });
    expect(applyGenericSolidRibbonEdit(base, { t: 'dim', field: 'heightMm' }, '800')).toBe(base);
  });
});
