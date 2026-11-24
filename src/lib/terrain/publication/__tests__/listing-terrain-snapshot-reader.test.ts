/**
 * ADR-920 Β6.4 — ο αναγνώστης του δημοσιευμένου στιγμιοτύπου.
 *
 * Το κρίσιμο test είναι το πρώτο: ό,τι γράφει ο ΑΛΗΘΙΝΟΣ builder, μετά από JSON (όπως φτάνει από το ράφι), διαβάζεται
 * αυτούσιο. Χωρίς αυτό, ένας αυστηρός αναγνώστης μπορεί να αρνείται σιωπηλά κάθε πραγματική αγγελία.
 */

import { LISTING_TERRAIN_MAX_TRIANGLES } from '../listing-terrain-config';
import { readListingTerrainSnapshot } from '../listing-terrain-snapshot-reader';
import type { ListingTerrainSnapshot } from '../listing-terrain-types';
import { REAL_PLANE } from './fixtures/terrain-3d-fixtures';

/** Ό,τι φτάνει στον browser: JSON κείμενο, ξαναδιαβασμένο. */
function overTheWire(snapshot: unknown): unknown {
  return JSON.parse(JSON.stringify(snapshot));
}

/** Αντίγραφο του αληθινού στιγμιοτύπου με αλλοιωμένο ένα κομμάτι του. */
function corrupted(mutate: (copy: Record<string, unknown> & { mesh: Record<string, number[]> }) => void): unknown {
  const copy = overTheWire(REAL_PLANE()) as Record<string, unknown> & { mesh: Record<string, number[]> };
  mutate(copy);
  return copy;
}

describe('readListingTerrainSnapshot', () => {
  it('διαβάζει αυτούσιο ό,τι παράγει ο αληθινός builder, μετά από JSON', () => {
    const snapshot = REAL_PLANE();
    const read = readListingTerrainSnapshot(overTheWire(snapshot));
    expect(read).toEqual({ ok: true, snapshot });
  });

  it.each<[string, unknown]>([
    ['null', null],
    ['πίνακας', []],
    ['χωρίς contours', corrupted((c) => { delete c.contours; })],
    ['stats χωρίς minElevationM', corrupted((c) => { delete (c.stats as Record<string, unknown>).minElevationM; })],
    ['ισοϋψής με μονό πλήθος συντεταγμένων', corrupted((c) => { (c.contours as { points: number[] }[])[0].points.push(1); })],
    ['τρίγωνα όχι σε τριάδες', corrupted((c) => { c.mesh.triangles.push(0); })],
  ])('malformed: %s', (_label, raw) => {
    expect(readListingTerrainSnapshot(raw)).toEqual({ ok: false, reason: 'malformed' });
  });

  it('άγνωστη έκδοση ⇒ unknown-version (όχι «malformed»: ο αναγνώστης είναι παλιός, όχι το αρχείο χαλασμένο)', () => {
    expect(readListingTerrainSnapshot(corrupted((c) => { c.version = 4; }))).toEqual({ ok: false, reason: 'unknown-version' });
    expect(readListingTerrainSnapshot(corrupted((c) => { c.version = '3'; }))).toEqual({ ok: false, reason: 'unknown-version' });
  });

  it('positions όχι σε τριάδες ⇒ positions-not-triples', () => {
    const raw = corrupted((c) => { c.mesh.positions.push(0); });
    expect(readListingTerrainSnapshot(raw)).toEqual({ ok: false, reason: 'positions-not-triples' });
  });

  it('δείκτης τριγώνου = πλήθος κορυφών ⇒ index-out-of-range', () => {
    const raw = corrupted((c) => { c.mesh.triangles[0] = c.mesh.positions.length / 3; });
    expect(readListingTerrainSnapshot(raw)).toEqual({ ok: false, reason: 'index-out-of-range' });
  });

  it('μη ακέραιος δείκτης ⇒ index-out-of-range', () => {
    const raw = corrupted((c) => { c.mesh.triangles[0] = 0.5; });
    expect(readListingTerrainSnapshot(raw)).toEqual({ ok: false, reason: 'index-out-of-range' });
  });

  it('μία κλάση κλίσης λιγότερη ⇒ slope-class-mismatch', () => {
    const raw = corrupted((c) => { c.mesh.slopeClass.pop(); });
    expect(readListingTerrainSnapshot(raw)).toEqual({ ok: false, reason: 'slope-class-mismatch' });
  });

  it('κλάση κλίσης εκτός ζωνών ⇒ slope-class-mismatch', () => {
    const raw = corrupted((c) => { c.mesh.slopeClass[0] = 4; });
    expect(readListingTerrainSnapshot(raw)).toEqual({ ok: false, reason: 'slope-class-mismatch' });
  });

  it('κενό mesh ⇒ empty-mesh', () => {
    const raw = corrupted((c) => { c.mesh.triangles = []; c.mesh.slopeClass = []; });
    expect(readListingTerrainSnapshot(raw)).toEqual({ ok: false, reason: 'empty-mesh' });
  });

  it('περισσότερα τρίγωνα από το όριο ⇒ too-dense', () => {
    const count = LISTING_TERRAIN_MAX_TRIANGLES + 1;
    const raw = corrupted((c) => {
      c.mesh.triangles = Array.from({ length: count * 3 }, (_, i) => i % 3);
      c.mesh.slopeClass = Array.from({ length: count }, () => 0);
    });
    expect(readListingTerrainSnapshot(raw)).toEqual({ ok: false, reason: 'too-dense' });
  });

  it('άπειρο υψόμετρο ⇒ non-finite', () => {
    const snapshot = REAL_PLANE();
    const positions = [...snapshot.mesh.positions];
    positions[2] = Infinity;
    const raw: ListingTerrainSnapshot = { ...snapshot, mesh: { ...snapshot.mesh, positions } };
    expect(readListingTerrainSnapshot(raw)).toEqual({ ok: false, reason: 'non-finite' });
  });

  it('min > max ⇒ inconsistent-stats', () => {
    const raw = corrupted((c) => {
      const stats = c.stats as { minElevationM: number; maxElevationM: number };
      [stats.minElevationM, stats.maxElevationM] = [stats.maxElevationM, stats.minElevationM];
    });
    expect(readListingTerrainSnapshot(raw)).toEqual({ ok: false, reason: 'inconsistent-stats' });
  });

  it('control: η ίδια διαδρομή αλλοίωσης χωρίς αλλοίωση ⇒ ok', () => {
    expect(readListingTerrainSnapshot(corrupted(() => undefined)).ok).toBe(true);
  });
});

describe('readListingTerrainSnapshot — ADR-920 §14.11 Ζ2 (περίγραμμα οικοπέδου, v1 → v2)', () => {
  const OUTLINE = { ring: [-8, -8, 8, -8, 8, 8, -8, 8], areaM2: 256, coverage: 'covered', coveredFraction: 1 } as const;

  it('ένα δημοσιευμένο v1 (χωρίς τα πεδία) διαβάζεται ως v2 ΧΩΡΙΣ περίγραμμα — μιλά η έκδοση, όχι προεπιλογή', () => {
    const v1 = corrupted((c) => {
      c.version = 1;
      delete c.plotOutline; delete c.plotOutlineOmission; delete c.georeference; delete c.georeferenceOmission;
    });
    expect(readListingTerrainSnapshot(v1)).toEqual({ ok: true, snapshot: REAL_PLANE() });
  });

  it('v2 χωρίς τα πεδία του περιγράμματος ⇒ malformed (το κενό ΔΕΝ γεμίζει)', () => {
    const raw = corrupted((c) => { delete c.plotOutline; });
    expect(readListingTerrainSnapshot(raw)).toEqual({ ok: false, reason: 'malformed' });
  });

  it('v2 με περίγραμμα διαβάζεται αυτούσιο μετά από JSON', () => {
    const snapshot: ListingTerrainSnapshot = { ...REAL_PLANE(), plotOutline: OUTLINE, plotOutlineOmission: null };
    expect(readListingTerrainSnapshot(overTheWire(snapshot))).toEqual({ ok: true, snapshot });
  });

  it.each<[string, (c: Record<string, unknown>) => void]>([
    ['δακτύλιος δύο κορυφών', (c) => { c.plotOutline = { ...OUTLINE, ring: [0, 0, 1, 1] }; }],
    ['ποσοστό κάλυψης > 1', (c) => { c.plotOutline = { ...OUTLINE, coveredFraction: 1.2 }; }],
    ['άγνωστη κάλυψη', (c) => { c.plotOutline = { ...OUTLINE, coverage: 'disjoint' }; }],
    ['άγνωστη αιτία παράλειψης', (c) => { c.plotOutlineOmission = 'hidden'; }],
  ])('malformed: %s', (_label, mutate) => {
    expect(readListingTerrainSnapshot(corrupted(mutate))).toEqual({ ok: false, reason: 'malformed' });
  });

  it('άπειρη συντεταγμένη στο περίγραμμα ⇒ non-finite', () => {
    const ring = [...OUTLINE.ring];
    ring[0] = Infinity;
    const raw: ListingTerrainSnapshot = { ...REAL_PLANE(), plotOutline: { ...OUTLINE, ring }, plotOutlineOmission: null };
    expect(readListingTerrainSnapshot(raw)).toEqual({ ok: false, reason: 'non-finite' });
  });
});

describe('readListingTerrainSnapshot — ADR-920 §14.12 Α (γεωαναφορά, v2 → v3)', () => {
  const GEOREFERENCE = { centre: { lat: 37.9755, lng: 23.7348 }, gridConvergenceDeg: -0.1632 } as const;

  it('ένα δημοσιευμένο v2 (χωρίς τα πεδία) διαβάζεται ως v3 ΧΩΡΙΣ θέση — και το περίγραμμά του μένει', () => {
    const OUTLINE = { ring: [-8, -8, 8, -8, 8, 8, -8, 8], areaM2: 256, coverage: 'covered', coveredFraction: 1 } as const;
    const v2 = corrupted((c) => { c.version = 2; c.plotOutline = OUTLINE; delete c.georeference; delete c.georeferenceOmission; });
    expect(readListingTerrainSnapshot(v2)).toEqual({ ok: true, snapshot: { ...REAL_PLANE(), plotOutline: OUTLINE } });
  });

  it('v3 χωρίς τα πεδία της γεωαναφοράς ⇒ malformed (το κενό ΔΕΝ γεμίζει)', () => {
    expect(readListingTerrainSnapshot(corrupted((c) => { delete c.georeference; }))).toEqual({ ok: false, reason: 'malformed' });
    expect(readListingTerrainSnapshot(corrupted((c) => { delete c.georeferenceOmission; }))).toEqual({ ok: false, reason: 'malformed' });
  });

  it('v3 με γεωαναφορά διαβάζεται αυτούσιο μετά από JSON', () => {
    const snapshot: ListingTerrainSnapshot = { ...REAL_PLANE(), georeference: GEOREFERENCE, georeferenceOmission: null };
    expect(readListingTerrainSnapshot(overTheWire(snapshot))).toEqual({ ok: true, snapshot });
  });

  it.each<[string, (c: Record<string, unknown>) => void]>([
    ['πλάτος έξω από τη γη', (c) => { c.georeference = { ...GEOREFERENCE, centre: { lat: 400, lng: 23 } }; }],
    ['μήκος έξω από τη γη', (c) => { c.georeference = { ...GEOREFERENCE, centre: { lat: 38, lng: 200 } }; }],
    ['κέντρο χωρίς μήκος', (c) => { c.georeference = { ...GEOREFERENCE, centre: { lat: 38 } }; }],
    ['χωρίς στροφή πλέγματος', (c) => { c.georeference = { centre: GEOREFERENCE.centre }; }],
    ['άγνωστη αιτία παράλειψης', (c) => { c.georeferenceOmission = 'hidden-by-owner'; }],
  ])('malformed: %s', (_label, mutate) => {
    expect(readListingTerrainSnapshot(corrupted(mutate))).toEqual({ ok: false, reason: 'malformed' });
  });
});
