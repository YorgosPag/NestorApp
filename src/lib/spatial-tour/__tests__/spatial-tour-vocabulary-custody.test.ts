/**
 * ⚓ ADR-884 Φ0.1/Φ0.6 — λεξιλόγιο κάτοψης, διαμερίσματα, και η συμφωνία με το μητρώο συλλογών.
 */

import { COLLECTIONS, SUBCOLLECTION_PARENTS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import {
  FLOOR_PLAN_SOURCES,
  floorPlanMeasurability,
  floorPlanTier,
  isFloorPlanUpgrade,
} from '@/constants/spatial-tour-vocabulary';

import { SPATIAL_TOUR_COLLECTION } from '../spatial-tour-custody';

describe('ιεραρχία αξιοπιστίας κάτοψης (§12 Δ5)', () => {
  it('η βαθμίδα ΠΑΡΑΓΕΤΑΙ από τη σειρά — engineer = 1, none = 5', () => {
    expect(FLOOR_PLAN_SOURCES.map(floorPlanTier)).toEqual([1, 2, 3, 4, 5]);
  });

  it('η δυνατότητα μέτρησης παράγεται από την πηγή', () => {
    expect(FLOOR_PLAN_SOURCES.map(floorPlanMeasurability)).toEqual(['exact', 'exact', 'indicative', 'indicative', 'none']);
  });

  it('αναβάθμιση μόνο προς ανώτερη βαθμίδα — ποτέ σιωπηλή υποβάθμιση', () => {
    expect(isFloorPlanUpgrade('user-sketch', 'engineer')).toBe(true);
    expect(isFloorPlanUpgrade('engineer', 'photo-estimate')).toBe(false);
    expect(isFloorPlanUpgrade('engineer', 'engineer')).toBe(false);
  });
});

describe('διαμερίσματα περιήγησης', () => {
  it('κάθε κλάδος του SPATIAL_TOUR_COLLECTION είναι δηλωμένη συλλογή', () => {
    for (const key of Object.values(SPATIAL_TOUR_COLLECTION)) expect(COLLECTIONS[key]).toBeTruthy();
  });

  it.each(['TOUR_CAPTURES', 'TOUR_ACCESS_REQUESTS', 'TOUR_CAPTURE_GRANTS'] as const)(
    '%s: γονείς στο backup ≡ τα διαμερίσματα (αλλιώς το ένα βιβλίο ΔΕΝ μπαίνει στο αντίγραφο ασφαλείας)',
    (subKey) => {
      expect(SUBCOLLECTIONS[subKey]).toMatch(/^tour_/);
      expect(SUBCOLLECTION_PARENTS[subKey]).toEqual(Object.values(SPATIAL_TOUR_COLLECTION));
    },
  );
});
