/**
 * ADR-407 Φ8 — `resolveRailingMaterial` per-component cascade (Revit railing-type materials parity).
 *
 * Guards τη cascade: per-component appearance → whole-railing appearance → element default. Resolved
 * μέσω του ΙΔΙΟΥ SSoT με σκάλα/solids (`resolveAppearanceMaterial` → `getFaceColorMaterial3D`).
 * Reference equality έναντι των cached MaterialCatalog3D entries (ίδιο input → ίδιο object).
 */

import { resolveRailingMaterial } from '../railing-material-resolver';
import { getElementMaterial3D, getFaceColorMaterial3D } from '../MaterialCatalog3D';
import type { RailingEntity, RailingParams } from '../../../bim/types/railing-types';

function railing(params: Partial<RailingParams>): RailingEntity {
  return { id: 'railing_1', type: 'railing', params } as unknown as RailingEntity;
}

describe('resolveRailingMaterial — cascade (Φ8)', () => {
  it('χωρίς appearance → element default (elem-railing) για ΟΛΑ τα components', () => {
    const r = railing({});
    const def = getElementMaterial3D('railing');
    expect(resolveRailingMaterial(r, 'post')).toBe(def);
    expect(resolveRailingMaterial(r, 'baluster')).toBe(def);
    expect(resolveRailingMaterial(r, 'rail')).toBe(def);
  });

  it('whole-railing appearance βάφει ΟΛΑ τα components', () => {
    const r = railing({ appearance: { colorHex: '#654321' } });
    const brown = getFaceColorMaterial3D('#654321');
    expect(resolveRailingMaterial(r, 'post')).toBe(brown);
    expect(resolveRailingMaterial(r, 'baluster')).toBe(brown);
    expect(resolveRailingMaterial(r, 'rail')).toBe(brown);
  });

  it('per-component appearance ΚΕΡΔΙΖΕΙ της whole-railing στο ίδιο component', () => {
    const r = railing({
      appearance: { colorHex: '#654321' },
      componentAppearance: { baluster: { colorHex: '#00ffff' } },
    });
    expect(resolveRailingMaterial(r, 'baluster')).toBe(getFaceColorMaterial3D('#00ffff'));
    // post/rail → whole-railing appearance
    expect(resolveRailingMaterial(r, 'post')).toBe(getFaceColorMaterial3D('#654321'));
    expect(resolveRailingMaterial(r, 'rail')).toBe(getFaceColorMaterial3D('#654321'));
  });

  it('component appearance χωρίς πηγή χρώματος ({}) → πέφτει στο whole/default', () => {
    const r = railing({ componentAppearance: { post: {} } });
    expect(resolveRailingMaterial(r, 'post')).toBe(getElementMaterial3D('railing'));
  });

  it('δεν διαρρέει appearance άλλου component', () => {
    const r = railing({ componentAppearance: { rail: { colorHex: '#C0392B' } } });
    expect(resolveRailingMaterial(r, 'post')).not.toBe(getFaceColorMaterial3D('#C0392B'));
    expect(resolveRailingMaterial(r, 'post')).toBe(getElementMaterial3D('railing'));
  });
});
