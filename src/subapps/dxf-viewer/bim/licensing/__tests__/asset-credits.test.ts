/**
 * Tests — third-party asset credits aggregator (ADR-409 §B-θετικό.2).
 */

import { collectAssetCredits } from '../asset-credits';

describe('collectAssetCredits', () => {
  const credits = collectAssetCredits();

  it('returns a non-empty list', () => {
    expect(credits.length).toBeGreaterThan(0);
  });

  it('lists every CC-BY asset BEFORE any CC0 group (legal attribution first)', () => {
    const firstCc0 = credits.findIndex((c) => c.license === 'CC0');
    if (firstCc0 === -1) return; // no CC0 — trivially ordered
    const before = credits.slice(0, firstCc0);
    const after = credits.slice(firstCc0);
    expect(before.every((c) => c.license === 'CC-BY')).toBe(true);
    expect(after.every((c) => c.license === 'CC0')).toBe(true);
  });

  it('includes the CC-BY shower cabin with parsed author + url', () => {
    const shower = credits.find((c) => c.author === 'Heliona');
    expect(shower).toBeDefined();
    expect(shower?.license).toBe('CC-BY');
    expect(shower?.title).toBe('Shower Cabin');
    expect(shower?.url).toBeTruthy();
  });

  it('aggregates CC0 Poly Haven assets into a single counted group', () => {
    const polyHaven = credits.find((c) => c.license === 'CC0' && c.author === 'Poly Haven');
    expect(polyHaven).toBeDefined();
    // Furniture (CC0) + textures (8) + HDRIs (8) all collapse to one row.
    expect(polyHaven?.count ?? 0).toBeGreaterThan(1);
  });

  it('parses the furniture CC-BY source strings (title by author)', () => {
    const sofa = credits.find((c) => c.author === 'Tom Seddon');
    expect(sofa?.license).toBe('CC-BY');
    expect(sofa?.title.toLowerCase()).toContain('sofa');
  });
});
