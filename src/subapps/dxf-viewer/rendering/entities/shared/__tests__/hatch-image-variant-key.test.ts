/**
 * ADR-653 Φ8 — variant key SSoT tests.
 *
 * Το κρίσιμο invariant: χωρίς tint το κλειδί ΕΙΝΑΙ το assetId (ADR-643 backward compat)·
 * με tint κάθε χρωματική εκδοχή του ίδιου υλικού παίρνει ξεχωριστό κλειδί (αλλιώς οι δύο
 * εκδοχές θα μοιράζονταν cache slot → λάθος χρώμα).
 */

import { imageFillVariantKey } from '../hatch-image-variant-key';
import type { HatchImageFill } from '../../../../types/entities';

const base: HatchImageFill = { assetId: 'matimg-ceramic-tile', tileWidth: 600, tileHeight: 600 };

describe('imageFillVariantKey (ADR-653 Φ8)', () => {
  it('returns exactly the assetId when there is no tint (ADR-643 compatible)', () => {
    expect(imageFillVariantKey(base)).toBe('matimg-ceramic-tile');
  });

  it('is unaffected by tile size / angle / grout (only material + colour matter)', () => {
    const varied: HatchImageFill = {
      ...base, tileWidth: 900, tileHeight: 300, angle: 45, grout: { color: '#fff', widthMm: 5 },
    };
    expect(imageFillVariantKey(varied)).toBe('matimg-ceramic-tile');
  });

  it('produces a distinct key once a tint is present', () => {
    const tinted: HatchImageFill = { ...base, tint: { colorA: '#000000', colorB: '#ffffff', strength: 1 } };
    const key = imageFillVariantKey(tinted);
    expect(key).not.toBe('matimg-ceramic-tile');
    expect(key.startsWith('matimg-ceramic-tile|')).toBe(true);
  });

  it('gives two different tints of the same material two different keys', () => {
    const bw: HatchImageFill = { ...base, tint: { colorA: '#000000', colorB: '#ffffff', strength: 1 } };
    const sepia: HatchImageFill = { ...base, tint: { colorA: '#2b1d0e', colorB: '#f5e9d0', strength: 1 } };
    expect(imageFillVariantKey(bw)).not.toBe(imageFillVariantKey(sepia));
  });

  it('is deterministic — same fill twice yields the same key', () => {
    const tinted: HatchImageFill = { ...base, tint: { colorA: '#000000', colorB: '#ffffff', strength: 0.5 } };
    expect(imageFillVariantKey(tinted)).toBe(imageFillVariantKey({ ...tinted }));
  });

  it('a change in strength alone changes the key', () => {
    const a: HatchImageFill = { ...base, tint: { colorA: '#000', colorB: '#fff', strength: 1 } };
    const b: HatchImageFill = { ...base, tint: { colorA: '#000', colorB: '#fff', strength: 0.4 } };
    expect(imageFillVariantKey(a)).not.toBe(imageFillVariantKey(b));
  });

  describe('procedural (ADR-653 Φ9)', () => {
    const proc: HatchImageFill = {
      assetId: 'proc:checker', tileWidth: 600, tileHeight: 600,
      procedural: { generator: 'checker', colors: ['#000000', '#ffffff'] },
    };

    it('keys on generator + colours (ignores raw assetId string collisions)', () => {
      const key = imageFillVariantKey(proc);
      expect(key.startsWith('proc:checker|')).toBe(true);
      expect(key).toContain('#000000,#ffffff');
    });

    it('a colour change yields a different key', () => {
      const other: HatchImageFill = { ...proc, procedural: { generator: 'checker', colors: ['#111111', '#ffffff'] } };
      expect(imageFillVariantKey(other)).not.toBe(imageFillVariantKey(proc));
    });

    it('tile-size change yields a different key (joint px depends on it)', () => {
      const bigger: HatchImageFill = { ...proc, tileWidth: 900 };
      expect(imageFillVariantKey(bigger)).not.toBe(imageFillVariantKey(proc));
    });

    it('procedural takes precedence over tint (tint ignored on procedural)', () => {
      const withTint: HatchImageFill = { ...proc, tint: { colorA: '#000', colorB: '#fff', strength: 1 } };
      expect(imageFillVariantKey(withTint)).toBe(imageFillVariantKey(proc));
    });
  });
});
