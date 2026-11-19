/**
 * @fileoverview 🏆 **Βαθμίδα 1: το κτίριο από τα πλακίδια της οθόνης** (ADR-777 §8.104 · ADR-937).
 *
 * | Άγκυρα | Μετάλλαξη που πιάνει |
 * |---|---|
 * | Ο1 κτίριο με μετρημένο id ⇒ αναφορά way + πηγή τονισμού | ταυτότητα από αλλού (π.χ. ιδιότητα) |
 * | Ο2 πολλά κάτω από το pixel ⇒ νικά το ΜΙΚΡΟΤΕΡΟ | το πάνω/πρώτο ως «ταυτότητα» (απόκλιση από τον διακομιστή) |
 * | Ο3 raster (καμία στρώση κτιρίων) ⇒ `null`, κανένα ερώτημα | εξαίρεση / ψεύτικο «δεν υπάρχει» |
 * | Ο4 id εκτός μετρημένης ζώνης ⇒ `null` (⇒ ο καλών ρωτά τον διακομιστή) | μαντεψιά node/relation |
 */
import { renderedBuildingPickAt, renderedBuildingSourceOf, type RenderedMap } from '../rendered-buildings';

const WAY = (wayId: number): number => 2 ** 45 + wayId;
const square = (size: number) => ({
  type: 'Polygon' as const,
  coordinates: [[[23, 40], [23 + size, 40], [23 + size, 40 + size], [23, 40 + size], [23, 40]]],
});

function fakeMap(features: readonly { id?: number; geometry: ReturnType<typeof square> }[], vector = true) {
  const queryRenderedFeatures = jest.fn(() => features);
  const map = {
    getLayer: () => (vector ? { source: 'protomaps', sourceLayer: 'buildings' } : undefined),
    queryRenderedFeatures,
  } as unknown as RenderedMap;
  return { map, queryRenderedFeatures };
}

describe('renderedBuildingPickAt', () => {
  it('🔴 Ο1 — μετρημένο id ⇒ way + πηγή τονισμού', () => {
    const { map } = fakeMap([{ id: WAY(980875811), geometry: square(0.001) }]);
    expect(renderedBuildingPickAt(map, { x: 5, y: 5 })).toEqual({
      ref: { elementType: 'way', elementId: '980875811' },
      featureId: WAY(980875811),
      source: { source: 'protomaps', sourceLayer: 'buildings' },
    });
  });

  it('🔴 Ο2 — κτίριο + building_part ⇒ νικά το μικρότερο (ίδιος κανόνας με τον διακομιστή)', () => {
    const { map } = fakeMap([
      { id: WAY(1), geometry: square(0.002) },
      { id: WAY(2), geometry: square(0.0005) },
    ]);
    expect(renderedBuildingPickAt(map, { x: 5, y: 5 })?.ref.elementId).toBe('2');
  });

  it('🔴 Ο3 — raster: καμία στρώση ⇒ null, κανένα ερώτημα στον χάρτη', () => {
    const { map, queryRenderedFeatures } = fakeMap([{ id: WAY(1), geometry: square(0.001) }], false);
    expect(renderedBuildingSourceOf(map)).toBeNull();
    expect(renderedBuildingPickAt(map, { x: 5, y: 5 })).toBeNull();
    expect(queryRenderedFeatures).not.toHaveBeenCalled();
  });

  it.each([
    ['χωρίς id', undefined],
    ['κωδικοποίηση εκτός ζώνης', 3 * 2 ** 44 + 7],
  ])('🔴 Ο4 — %s ⇒ null', (_label, id) => {
    const { map } = fakeMap([{ id, geometry: square(0.001) }]);
    expect(renderedBuildingPickAt(map, { x: 5, y: 5 })).toBeNull();
  });
});
