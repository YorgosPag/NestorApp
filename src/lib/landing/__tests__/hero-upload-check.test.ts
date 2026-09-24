/**
 * ⚓ ADR-881 §4.6 — **ο ένας κριτής του ανεβάσματος**. Τα όρια είναι τα μετρημένα σχήματα των
 * εργαλείων AI: 1536×1024 (ChatGPT, 3:2) και 2:1 (Midjourney) **περνούν**· ό,τι σπάει το κάδρο όχι.
 */

import {
  checkHeroDimensions,
  checkHeroFile,
  checkHeroPair,
  hasBlockingIssue,
} from '../hero-upload-check';

describe('αρχείο', () => {
  it('δέχεται JPEG/PNG/WebP κάτω από το όριο', () => {
    expect(checkHeroFile({ type: 'image/jpeg', size: 2_000_000 })).toEqual([]);
    expect(checkHeroFile({ type: 'image/webp', size: 2_000_000 })).toEqual([]);
  });

  it('απορρίπτει SVG/GIF και αρχείο > 20 MB', () => {
    expect(checkHeroFile({ type: 'image/svg+xml', size: 10 })).toEqual(['type-not-accepted']);
    expect(checkHeroFile({ type: 'image/png', size: 21 * 1024 * 1024 })).toEqual(['too-large']);
  });
});

describe('διαστάσεις', () => {
  it('2400×1200 ⇒ κανένα ζήτημα', () => {
    expect(checkHeroDimensions({ width: 2400, height: 1200 })).toEqual([]);
  });

  it('η σημερινή ενσωματωμένη 1774×887 ⇒ μόνο προειδοποίηση πλάτους', () => {
    const issues = checkHeroDimensions({ width: 1774, height: 887 });
    expect(issues).toEqual(['below-target-width']);
    expect(hasBlockingIssue(issues)).toBe(false);
  });

  it('🔑 το 1536×1024 του ChatGPT ΠΕΡΝΑ — με προειδοποιήσεις, όχι μπλοκ', () => {
    const issues = checkHeroDimensions({ width: 1536, height: 1024 });
    expect(issues).toEqual(['aspect-not-target', 'below-target-width']);
    expect(hasBlockingIssue(issues)).toBe(false);
  });

  it('τετράγωνη ή πολύ στενή/φαρδιά ⇒ μπλοκ', () => {
    expect(hasBlockingIssue(checkHeroDimensions({ width: 2048, height: 2048 }))).toBe(true);
    expect(hasBlockingIssue(checkHeroDimensions({ width: 3000, height: 1000 }))).toBe(true);
  });

  it('μικρή ⇒ μπλοκ', () => {
    expect(checkHeroDimensions({ width: 1024, height: 512 })).toContain('too-small');
  });

  it('εκφυλισμένες διαστάσεις ⇒ μπλοκ, όχι NaN που περνά σιωπηλά', () => {
    expect(hasBlockingIssue(checkHeroDimensions({ width: 2400, height: 0 }))).toBe(true);
  });
});

describe('ζεύγος', () => {
  it('ίδιος λόγος σε άλλη ανάλυση ⇒ αθώο', () => {
    expect(checkHeroPair({ width: 2400, height: 1200 }, { width: 1774, height: 887 })).toEqual([]);
  });

  it('άλλος λόγος ⇒ η εναλλαγή θέματος θα μετακινούσε τη σκηνή', () => {
    expect(checkHeroPair({ width: 2400, height: 1200 }, { width: 1536, height: 1024 })).toEqual(['pair-size-mismatch']);
  });
});
