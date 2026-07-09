/**
 * ADR-608 — tests για τον mapper `TekObjectRecord` → `AnnotationSymbolEntity` (αντίστροφος
 * χάρτης `type_res`). Matched → δικό μας σύμβολο· unmatched → null + ονομαστικό warning.
 */

import { tekObjectToEntity } from '../tek-object-to-scene';
import type { TekObjectRecord } from '../tek-import-types';

const IDENTITY = { x00: 1, x01: 0, x10: 0, x11: 1, x20: 0, x21: 0 } as const;

function obj(typeRes: number, matrix = IDENTITY): TekObjectRecord {
  return { typeRes, matrix, color: 'A8A8A8' };
}

describe('tekObjectToEntity — matched σύμβολα', () => {
  it('type_res 51 → northArrowSimple / north-arrow', () => {
    const { entity, warning } = tekObjectToEntity(obj(51), 'mm');
    expect(warning).toBeNull();
    expect(entity).not.toBeNull();
    expect(entity!.type).toBe('annotation-symbol');
    expect(entity!.symbolId).toBe('northArrowSimple');
    expect(entity!.kind).toBe('north-arrow');
  });

  it('type_res 383 → sectionMarkArrow / section-mark', () => {
    const { entity } = tekObjectToEntity(obj(383), 'mm');
    expect(entity!.symbolId).toBe('sectionMarkArrow');
    expect(entity!.kind).toBe('section-mark');
  });

  it('type_res 123 → elevationLevel / elevation-mark', () => {
    expect(tekObjectToEntity(obj(123), 'mm').entity!.symbolId).toBe('elevationLevel');
  });

  it('θέση από xmatrix translation (Y-flip): x20=2m,x21=-3m → (2000, 3000) mm', () => {
    const { entity } = tekObjectToEntity(obj(51, { ...IDENTITY, x20: 2, x21: -3 }), 'mm');
    expect(entity!.position.x).toBeCloseTo(2000);
    expect(entity!.position.y).toBeCloseTo(3000);
  });

  it('περιστροφή από u-άξονα (Y-flip): x00=cos90,x01=-sin90 → 90°', () => {
    const r = (90 * Math.PI) / 180;
    const { entity } = tekObjectToEntity(
      obj(51, { ...IDENTITY, x00: Math.cos(r), x01: -Math.sin(r) }), 'mm',
    );
    expect(entity!.rotation).toBeCloseTo(90);
  });
});

describe('tekObjectToEntity — unmatched σύμβολα', () => {
  it('type_res 129 (Άνθρωποι 3, χωρίς equivalent) → null + ονομαστικό warning', () => {
    const { entity, warning } = tekObjectToEntity(obj(129), 'mm');
    expect(entity).toBeNull();
    expect(warning).toContain('Άνθρωποι 3');
    expect(warning).toContain('129');
  });

  it('άγνωστος type_res (εκτός καταλόγου) → null + warning με τον αριθμό', () => {
    const { entity, warning } = tekObjectToEntity(obj(9999), 'mm');
    expect(entity).toBeNull();
    expect(warning).toContain('9999');
  });
});
