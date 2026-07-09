/**
 * ADR-608 — round-trip test: δικό μας annotation-symbol → export type-7 `<object>` →
 * parse → import mapper → **ίδιο `symbolId`** (+ θέση/περιστροφή). Επικυρώνει ότι ο
 * αμφίδρομος χάρτης `type_res` (export `tekSymbolTypeRes` ↔ import `tekSymbolFromTypeRes`)
 * είναι πραγματικά αντιστρέψιμος — η ουσία της «πλήρους ταυτοποίησης» με τον Τέκτονα.
 */

import { collectTekObjects } from '../../../export/core/tek/dxf-to-tek';
import { parseTekScene } from '../tek-scene-extract';
import { tekObjectToEntity } from '../tek-object-to-scene';
import type { Entity } from '../../../types/entities';

/** mm → μέτρα (ίδιο με sceneUnitsToMeters('mm')) — κάνει τη θέση αντιστρέψιμη με units='mm'. */
const F = 0.001;

function annSymbol(
  kind: string, symbolId: string, position: { x: number; y: number }, rotation = 0,
): Entity {
  return {
    id: `sym-${symbolId}`, type: 'annotation-symbol', layerId: 'lyr_a',
    kind, symbolId, position, rotation,
  } as unknown as Entity;
}

/** Τυλίγει τα exported `<object>` records σε ελάχιστο έγκυρο `.tek` scene. */
function wrapScene(objectsXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><tekton><head><numfloors>1</numfloors></head>`
    + `<body><building><floor><object>${objectsXml}</object></floor></building></body></tekton>`;
}

describe('ADR-608 — round-trip annotation-symbol → .tek → annotation-symbol', () => {
  it.each([
    ['north-arrow', 'northArrowSimple'],
    ['north-arrow', 'northArrowStar'],
    ['north-arrow', 'northArrowCircledN'],
    ['north-arrow', 'northArrowCompass'],
    ['section-mark', 'sectionMarkArrow'],
    ['elevation-mark', 'elevationLevel'],
    ['elevation-mark', 'elevationTag'],
  ])('%s / %s ταυτοποιείται πίσω στο ίδιο σύμβολο', (kind, symbolId) => {
    const { objectsXml } = collectTekObjects([annSymbol(kind, symbolId, { x: 0, y: 0 })], F);
    const parsed = parseTekScene(wrapScene(objectsXml));
    expect(parsed.objects).toHaveLength(1);
    const { entity, warning } = tekObjectToEntity(parsed.objects[0], 'mm');
    expect(warning).toBeNull();
    expect(entity!.symbolId).toBe(symbolId);
    expect(entity!.kind).toBe(kind);
  });

  it('θέση + περιστροφή round-trip (6000,8000) mm @45° → ίδια τιμή', () => {
    const { objectsXml } = collectTekObjects(
      [annSymbol('north-arrow', 'northArrowSimple', { x: 6000, y: 8000 }, 45)], F,
    );
    const parsed = parseTekScene(wrapScene(objectsXml));
    const { entity } = tekObjectToEntity(parsed.objects[0], 'mm');
    expect(entity!.position.x).toBeCloseTo(6000);
    expect(entity!.position.y).toBeCloseTo(8000);
    expect(entity!.rotation).toBeCloseTo(45);
  });
});
