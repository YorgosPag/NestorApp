/**
 * @jest-environment node
 *
 * ADR-890 §14.3 — τοπολογική απλοποίηση: κάθε κοινή ακμή απλοποιείται ΜΙΑ φορά ⇒ οι γείτονες κρατούν
 * τις ΙΔΙΕΣ κορυφές (καμία σχισμή), σε οποιαδήποτε σειρά εισόδου.
 */

import { openChainKeepMask } from '../../src/lib/geometry/douglas-peucker';
import { distanceToSegment } from '../../src/lib/geometry/planar-polygon';
import { simplifySharedArcs, type TopologyFeature } from '../lib/admin-boundaries/shared-arc-simplify';

type Position = GeoJSON.Position;

/**
 * Θορυβώδες σύνορο από (0,0) έως (0,0.1) με 200 κορυφές — ίδιο για τους δύο γείτονες (τοπολογικά καθαρή πηγή).
 * ⚠️ Ο θόρυβος είναι **μη συμμετρικός και μεγαλύτερος από την ανοχή** (±~55 m έναντι 50 m): μόνο τότε ο DP κρατά
 * εσωτερικές κορυφές που **εξαρτώνται από τη φορά** — με μικρό θόρυβο και οι δύο φορές κρατούν μόνο τα άκρα, και
 * το test δεν θα μπορούσε ποτέ να κοκκινίσει (μετρημένο: μετάλλαξη «χωρίς κανονική φορά» επέζησε).
 */
const BORDER: Position[] = Array.from({ length: 201 }, (_, i) => [(((i * 7919) % 13) - 6) * 0.0001, i * 0.0005]);

/** Δύο γειτονικά τετράγωνα που μοιράζονται το `BORDER`, σε ΑΝΤΙΘΕΤΗ φορά (όπως στην πηγή). */
function neighbours(): TopologyFeature[] {
  const west: Position[] = [...BORDER, [-0.1, 0.1], [-0.1, 0], BORDER[0]];
  const east: Position[] = [...[...BORDER].reverse(), [0.1, 0], [0.1, 0.1], BORDER[BORDER.length - 1]];
  return [
    { id: 'west', geometry: { type: 'MultiPolygon', coordinates: [[west]] } },
    { id: 'east', geometry: { type: 'MultiPolygon', coordinates: [[east]] } },
  ];
}

const key = (p: Position): string => `${p[0]},${p[1]}`;

/** Οι κορυφές ενός δακτυλίου που βρίσκονται πάνω στο κοινό σύνορο (x ≈ 0). */
function borderVertices(geometry: GeoJSON.MultiPolygon | null | undefined): Set<string> {
  const ring = geometry?.coordinates[0][0] ?? [];
  return new Set(ring.filter((p) => Math.abs(p[0]) < 0.001).map(key));
}

describe('shared-arc-simplify', () => {
  it('η κοινή ακμή μένει ΚΟΙΝΗ: ίδιες κορυφές και στους δύο γείτονες', () => {
    const { geometries } = simplifySharedArcs(neighbours(), 50, 6);
    const west = borderVertices(geometries.get('west'));
    const east = borderVertices(geometries.get('east'));
    expect(west.size).toBeGreaterThan(2); // κράτησε εσωτερικές κορυφές — αλλιώς το test δεν ελέγχει τίποτα
    expect(west.size).toBeLessThan(BORDER.length); // απλοποιήθηκε
    expect([...west].sort()).toEqual([...east].sort());
  });

  it('κάθε κοινή ακμή απλοποιείται ΜΙΑ φορά: 3 τόξα (κοινό σύνορο + δύο εξωτερικά), όχι 4', () => {
    // Χωρίς κανονική φορά το κοινό σύνορο θα απλοποιούνταν δύο φορές (μία ανά δακτύλιο) και θα κρατούσε την
    // ΕΝΩΣΗ δύο αποτελεσμάτων — σωστό (καμία σχισμή, το κοινό σύνολο το εγγυάται) αλλά με περιττές κορυφές.
    // Μετρημένο με μετάλλαξη: η ισότητα κορυφών ΔΕΝ το πιάνει, αυτό το πιάνει.
    expect(simplifySharedArcs(neighbours(), 50, 6).stats.arcs).toBe(3);
  });

  it('ντετερμινιστικό σε ΑΝΤΙΣΤΡΟΦΗ σειρά εισόδου', () => {
    const forward = simplifySharedArcs(neighbours(), 50, 6).geometries;
    const reversed = simplifySharedArcs([...neighbours()].reverse(), 50, 6).geometries;
    expect(JSON.stringify(reversed.get('west'))).toBe(JSON.stringify(forward.get('west')));
    expect(JSON.stringify(reversed.get('east'))).toBe(JSON.stringify(forward.get('east')));
  });

  it('οι κόμβοι (γωνίες όπου αλλάζει ο γείτονας) μένουν πάντα', () => {
    const { geometries } = simplifySharedArcs(neighbours(), 10_000, 6);
    const west = borderVertices(geometries.get('west'));
    const rounded = (p: Position): Position => [Number(p[0].toFixed(6)), Number(p[1].toFixed(6))];
    expect(west).toEqual(new Set([key(rounded(BORDER[0])), key(rounded(BORDER[BORDER.length - 1]))]));
  });

  it('περιοχή μικρότερη από την ανοχή ⇒ null (ο καλών αποφασίζει)', () => {
    const tiny: TopologyFeature = {
      id: 'tiny',
      geometry: { type: 'MultiPolygon', coordinates: [[[[0, 0], [0.00001, 0], [0.00001, 0.00001], [0, 0]]]] },
    };
    expect(simplifySharedArcs([tiny], 50, 6).geometries.get('tiny')).toBeNull();
  });
});

describe('openChainKeepMask', () => {
  const chain = Array.from({ length: 50 }, (_, i) => ({ x: i, y: i % 2 === 0 ? 0 : 0.3 }));

  it('τα άκρα μένουν πάντα', () => {
    const keep = openChainKeepMask(chain, 1);
    expect(keep[0]).toBe(true);
    expect(keep[chain.length - 1]).toBe(true);
    expect(keep.filter(Boolean)).toHaveLength(2);
  });

  it('ΕΓΓΥΗΣΗ: κάθε κορυφή που φεύγει απέχει ≤ ανοχή από την απλοποιημένη γραμμή', () => {
    const keep = openChainKeepMask(chain, 0.1);
    const kept = chain.filter((_, i) => keep[i]);
    for (const point of chain) {
      const nearest = Math.min(...kept.slice(1).map((b, i) => distanceToSegment(point, kept[i], b)));
      expect(nearest).toBeLessThanOrEqual(0.1 + 1e-12);
    }
  });
});
