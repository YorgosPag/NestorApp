/**
 * @jest-environment node
 *
 * ⚓ ADR-190 §Display — the monogram tone is STABLE per identity and its initials are READABLE in both themes.
 *
 * "5.10 : 1 measured" in `monogram-tone.ts` is a claim until something re-measures it: here every tone's
 * `color-mix(in oklab, …)` is recomputed from the SAME `globals.css` values (`:root` + `.dark`) with the same
 * WCAG engine the contrast gates use. Change a percentage, a chart hue or `--card` and this re-judges.
 */

import { MONOGRAM_TONES, monogramToneClass, stableHash } from '../monogram-tone';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readThemes } = require('../../../../../scripts/lib/contrast/css-token-themes') as {
  readThemes: () => { light: ReadonlyMap<string, string>; dark: ReadonlyMap<string, string> };
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseHslToken, hslToRgb, contrastRatio } = require('../../../../../scripts/lib/contrast/wcag-contrast') as {
  parseHslToken: (value: string) => { h: number; s: number; l: number } | null;
  hslToRgb: (hsl: { h: number; s: number; l: number }) => readonly number[];
  contrastRatio: (a: readonly number[], b: readonly number[]) => number;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { mixInOklab } = require('../../../../../scripts/lib/contrast/oklab-mix') as {
  mixInOklab: (a: readonly number[], b: readonly number[], weightA: number) => readonly number[];
};

/** WCAG 1.4.3 — initials are 12–16px semibold: normal text, not "large". */
const TEXT_CONTRAST = 4.5;

const MIX = /(bg|text)-\[color-mix\(in_oklab,hsl\(var\((--chart-\d)\)\)_(\d+)%,hsl\(var\((--[a-z-]+)\)\)\)\]/g;

interface ParsedMix { readonly chart: string; readonly weight: number; readonly base: string }

function parseTone(tone: string): { readonly bg: ParsedMix; readonly ink: ParsedMix } {
  const parts = new Map<string, ParsedMix>();
  for (const m of tone.matchAll(MIX)) parts.set(m[1], { chart: m[2], weight: Number(m[3]) / 100, base: m[4] });
  const bg = parts.get('bg');
  const ink = parts.get('text');
  if (!bg || !ink) throw new Error(`tone is not a bg+text color-mix pair: ${tone}`);
  return { bg, ink };
}

function rgbOf(theme: ReadonlyMap<string, string>, token: string): readonly number[] {
  const hsl = parseHslToken(theme.get(token) ?? '');
  if (hsl === null) throw new Error(`${token}: no literal HSL value in globals.css`);
  return hslToRgb(hsl);
}

const resolve = (theme: ReadonlyMap<string, string>, mix: ParsedMix) =>
  mixInOklab(rgbOf(theme, mix.chart), rgbOf(theme, mix.base), mix.weight);

describe('monogram tones — readable in both themes', () => {
  const themes = readThemes();

  it.each(MONOGRAM_TONES.map((tone, i) => [i + 1, tone] as const))('tone %i: initials ≥ 4.5:1 on its tile, light AND dark', (_n, tone) => {
    const { bg, ink } = parseTone(tone);
    expect(ink.chart).toBe(bg.chart); // one hue per tone — ink and tile never drift apart
    for (const theme of [themes.light, themes.dark]) {
      expect(contrastRatio(resolve(theme, ink), resolve(theme, bg))).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    }
  });

  it('every chart hue is used exactly once — the palette, not a subset of it', () => {
    const hues = MONOGRAM_TONES.map((tone) => parseTone(tone).bg.chart);
    expect(new Set(hues).size).toBe(MONOGRAM_TONES.length);
  });
});

describe('monogram tones — stable per identity', () => {
  it('same seed ⇒ same tone, every call', () => {
    expect(monogramToneClass('cont_945a7fcf')).toBe(monogramToneClass('cont_945a7fcf'));
  });

  it('order-sensitive: a swap is a different identity (a char-code SUM would collide)', () => {
    expect(stableHash('ab')).not.toBe(stableHash('ba'));
  });

  it('spreads real-shaped ids over the whole palette', () => {
    const seen = new Set(Array.from({ length: 400 }, (_, i) => monogramToneClass(`cont_${i.toString(16).padStart(8, '0')}`)));
    expect(seen.size).toBe(MONOGRAM_TONES.length);
  });
});
