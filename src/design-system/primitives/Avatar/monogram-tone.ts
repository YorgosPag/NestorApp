/**
 * 🎨 **MONOGRAM TONES** — the stable colour of an avatar that has no image (ADR-190 §Display).
 *
 * Hue identity comes from the categorical chart palette (`--chart-1..8`, ADR-710): the one palette in the
 * repo already gated for CVD separation and theme pairing. It is NOT used raw: white text on those fills
 * measures **3.5–4.4 : 1** (below WCAG 1.4.3's 4.5 for ~14px initials — the same gap Google Contacts
 * accepts). Each tone is instead a **soft tile + deep ink of the same hue**, mixed in OKLab against the
 * theme's own `--card` / `--foreground`, so it adapts to light and dark with no second table:
 *
 *   background = color-mix(in oklab, chart-N 20%, card)
 *   ink        = color-mix(in oklab, chart-N 60%, foreground)
 *
 * Worst case measured over 8 hues × 2 themes: **5.10 : 1**. The anchor test recomputes it from
 * `globals.css` — change a percentage or a palette value and it re-judges.
 *
 * ⚠️ Class strings stay literal: Tailwind's JIT only sees what is written out in source.
 */

export const MONOGRAM_TONES = [
  'bg-[color-mix(in_oklab,hsl(var(--chart-1))_20%,hsl(var(--card)))] text-[color-mix(in_oklab,hsl(var(--chart-1))_60%,hsl(var(--foreground)))]',
  'bg-[color-mix(in_oklab,hsl(var(--chart-2))_20%,hsl(var(--card)))] text-[color-mix(in_oklab,hsl(var(--chart-2))_60%,hsl(var(--foreground)))]',
  'bg-[color-mix(in_oklab,hsl(var(--chart-3))_20%,hsl(var(--card)))] text-[color-mix(in_oklab,hsl(var(--chart-3))_60%,hsl(var(--foreground)))]',
  'bg-[color-mix(in_oklab,hsl(var(--chart-4))_20%,hsl(var(--card)))] text-[color-mix(in_oklab,hsl(var(--chart-4))_60%,hsl(var(--foreground)))]',
  'bg-[color-mix(in_oklab,hsl(var(--chart-5))_20%,hsl(var(--card)))] text-[color-mix(in_oklab,hsl(var(--chart-5))_60%,hsl(var(--foreground)))]',
  'bg-[color-mix(in_oklab,hsl(var(--chart-6))_20%,hsl(var(--card)))] text-[color-mix(in_oklab,hsl(var(--chart-6))_60%,hsl(var(--foreground)))]',
  'bg-[color-mix(in_oklab,hsl(var(--chart-7))_20%,hsl(var(--card)))] text-[color-mix(in_oklab,hsl(var(--chart-7))_60%,hsl(var(--foreground)))]',
  'bg-[color-mix(in_oklab,hsl(var(--chart-8))_20%,hsl(var(--card)))] text-[color-mix(in_oklab,hsl(var(--chart-8))_60%,hsl(var(--foreground)))]',
] as const;

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * FNV-1a (32-bit) over the UTF-16 code units. Order-sensitive — unlike a char-code **sum**, which gives
 * every anagram (and every id differing by a swap) the same colour.
 */
export function stableHash(seed: string): number {
  let hash = FNV_OFFSET;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/** The tone for an identity — same seed, same colour, on every screen and every session. */
export function monogramToneClass(seed: string): string {
  return MONOGRAM_TONES[stableHash(seed) % MONOGRAM_TONES.length];
}
