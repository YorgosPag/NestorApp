/**
 * Άγκυρες του κριτή του κλικ (ADR-777 §8.76) — `lib/maps/map-pick.ts`.
 */

import {
  clusterTargetZoom,
  resolveMapPick,
  zoomCanSeparate,
  type PickHit,
} from '../map-pick';
import { CLUSTER_RADIUS_PX } from '../listing-clusters';
import { lngLatToWorldPixel } from '../metric-size';

const hit = (layerId: string, properties: Record<string, unknown>): PickHit => ({ layerId, properties });

describe('resolveMapPick — τι εννοούσε ο άνθρωπος', () => {
  it('τίποτα κάτω από τον δείκτη ⇒ none (ακύρωση)', () => {
    expect(resolveMapPick([])).toEqual({ kind: 'none' });
  });

  it('μία πινέζα (με δακτύλιο ⇒ δύο σχήματα, ΜΙΑ αγγελία) ⇒ listing', () => {
    const pick = resolveMapPick([hit('listing-pin-ring', { id: 'a' }), hit('listing-pin', { id: 'a' })]);
    expect(pick).toEqual({ kind: 'listing', id: 'a' });
  });

  it('δύο πινέζες η μία πάνω στην άλλη ⇒ stack, με τη σειρά του χάρτη', () => {
    const pick = resolveMapPick([hit('listing-pin', { id: 'b' }), hit('listing-pin', { id: 'a' })]);
    expect(pick).toEqual({ kind: 'stack', ids: ['b', 'a'] });
  });

  it('πινέζα μέσα σε κύκλο πόλης ΑΛΛΗΣ αγγελίας ⇒ η πινέζα (ιεραρχία ακρίβειας)', () => {
    const pick = resolveMapPick([hit('listing-pin', { id: 'a' }), hit('listing-city', { id: 'b' })]);
    expect(pick).toEqual({ kind: 'listing', id: 'a' });
  });

  it('δύο κύκλοι πόλης στο ίδιο κέντρο ⇒ stack (γνήσια αμφισημία)', () => {
    const pick = resolveMapPick([hit('listing-city', { id: 'a' }), hit('listing-city', { id: 'b' })]);
    expect(pick).toEqual({ kind: 'stack', ids: ['a', 'b'] });
  });

  it('ομάδα ⇒ cluster, και προηγείται (κάθεται από πάνω)', () => {
    const pick = resolveMapPick([
      hit('listing-cluster-count', { cluster: true, cluster_id: 7, point_count: 3 }),
      hit('listing-city', { id: 'b' }),
    ]);
    expect(pick).toEqual({ kind: 'cluster', clusterId: 7, pointCount: 3 });
  });

  it('ομάδα χωρίς cluster_id (παραμορφωμένα δεδομένα) ⇒ πέφτει στα επόμενα επίπεδα', () => {
    const pick = resolveMapPick([hit('listing-cluster', {}), hit('listing-pin', { id: 'a' })]);
    expect(pick).toEqual({ kind: 'listing', id: 'a' });
  });

  it('άγνωστο επίπεδο αγνοείται', () => {
    expect(resolveMapPick([hit('basemap-road', { id: 'x' })])).toEqual({ kind: 'none' });
  });
});

describe('zoomCanSeparate — θα χωρίσει το ζουμ αυτά τα σημεία;', () => {
  it('ταυτιζόμενα σημεία ⇒ ΟΧΙ, σε κάθε ζουμ', () => {
    expect(zoomCanSeparate([[22.94, 40.64], [22.94, 40.64]], 15)).toBe(false);
    expect(zoomCanSeparate([[22.94, 40.64], [22.94, 40.64]], 22)).toBe(false);
  });

  it('το όριο είναι ακριβώς το CLUSTER_RADIUS_PX («ένα δάχτυλο»)', () => {
    // Δύο σημεία σε οριζόντια απόσταση ΑΚΡΙΒΩΣ ίση με το όριο στο ζουμ 15.
    const [x0] = lngLatToWorldPixel(0, 0, 15);
    const degPerPx = 360 / (512 * 2 ** 15);
    const at = (px: number) => [0 + px * degPerPx, 0] as const;
    expect(x0).toBeCloseTo(512 * 2 ** 15 / 2);
    expect(zoomCanSeparate([[0, 0], at(CLUSTER_RADIUS_PX)], 15)).toBe(true);
    expect(zoomCanSeparate([[0, 0], at(CLUSTER_RADIUS_PX - 1)], 15)).toBe(false);
  });

  it('δύο γειτονιές της Θεσσαλονίκης (~1 χλμ) ⇒ ΝΑΙ στο 15', () => {
    expect(zoomCanSeparate([[22.94, 40.64], [22.955, 40.63]], 15)).toBe(true);
  });

  it('λιγότερα από δύο σημεία ⇒ δεν υπάρχει τίποτα να χωριστεί', () => {
    expect(zoomCanSeparate([[22.94, 40.64]], 15)).toBe(true);
  });
});

describe('clusterTargetZoom — προχωρά πάντα, χωρά όσα χωρούν, ποτέ πάνω από το ταβάνι', () => {
  it('το κάδρο των μελών ζητά λιγότερο από τη διάσπαση ⇒ διάσπαση (Mapbox: προχωρά)', () => {
    expect(clusterTargetZoom(9, 11, 15)).toBe(11);
  });
  it('το κάδρο ζητά περισσότερο ⇒ κάδρο (Google: όλα μέσα, και χωρισμένα)', () => {
    expect(clusterTargetZoom(13, 11, 15)).toBe(13);
  });
  it('ποτέ πάνω από το ταβάνι ειλικρίνειας', () => {
    expect(clusterTargetZoom(19, 11, 15)).toBe(15);
  });
  it('χωρίς κάδρο (δεν χωρά) ⇒ διάσπαση', () => {
    expect(clusterTargetZoom(null, 12, 15)).toBe(12);
  });
});

describe('lngLatToWorldPixel — Web Mercator 512', () => {
  it('(0,0) στο ζουμ 0 = κέντρο του κόσμου', () => {
    const [x, y] = lngLatToWorldPixel(0, 0, 0);
    expect(x).toBeCloseTo(256);
    expect(y).toBeCloseTo(256);
  });
  it('το βόρειο όριο της προβολής = πάνω άκρη', () => {
    expect(lngLatToWorldPixel(0, 89, 0)[1]).toBeCloseTo(0, 3);
  });
});
