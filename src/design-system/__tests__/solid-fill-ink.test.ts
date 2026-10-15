/**
 * @jest-environment node
 *
 * ⚓ ADR-854 §3 · ADR-915 §11.4 — **κάθε συμπαγές γέμισμα κατάστασης έχει μελάνι που διαβάζεται, και στα δύο θέματα.**
 *
 * Ο πίνακας `SOLID_FILL_INK` λέει «μετρημένο». Ένα σχόλιο που λέει «μετρημένο» χωρίς άγκυρα είναι ισχυρισμός: εδώ τα
 * `--status-*` διαβάζονται από το ΙΔΙΟ το `globals.css` (`:root` + `.dark`) και κρίνονται με την ίδια μηχανή WCAG
 * που κρίνει τις πύλες αντίθεσης. Και το `Badge` — ο κύριος καταναλωτής — ελέγχεται ότι **ρωτά** τον πίνακα.
 *
 * Ιστορικό: ως τις 2026-10-15 το `Badge` έγραφε `text-white` σε success/warning ⇒ 2,30:1 / 3,16:1 σε σήμα 12px
 * (μετρημένο σε browser στη σελίδα «Λήξεις εγγράφων»). Το `IconCountBadge` είχε ήδη τη σωστή απάντηση, μόνο του.
 */

import { COLOR_BRIDGE, SOLID_FILL_INK, type SolidFillKey } from '@/design-system/color-bridge';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Badge, staticBadgeVariants } from '@/components/ui/badge';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readThemes } = require('../../../scripts/lib/contrast/css-token-themes') as {
  readThemes: () => { light: ReadonlyMap<string, string>; dark: ReadonlyMap<string, string> };
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseHslToken, hslToRgb, contrastRatio } = require('../../../scripts/lib/contrast/wcag-contrast') as {
  parseHslToken: (value: string) => { h: number; s: number; l: number } | null;
  hslToRgb: (hsl: { h: number; s: number; l: number }) => readonly number[];
  contrastRatio: (a: readonly number[], b: readonly number[]) => number;
};

/** WCAG 1.4.3 — κανονικό κείμενο (το σήμα είναι `text-xs`, 12px). */
const TEXT_CONTRAST = 4.5;

/** Το χρώμα που ζωγραφίζει κάθε κλάση μελανιού. Άγνωστη κλάση ⇒ η άγκυρα αποτυγχάνει, δεν μαντεύει. */
const INK_RGB: Readonly<Record<string, readonly number[]>> = {
  'text-white': [255, 255, 255],
  'text-black': [0, 0, 0],
};

const FILLS = Object.keys(SOLID_FILL_INK) as SolidFillKey[];

/** `bg-[hsl(var(--status-success))]` → `--status-success`. */
function tokenOfFill(fill: SolidFillKey): string {
  const match = /var\((--[a-z-]+)\)/.exec(COLOR_BRIDGE.bg[fill]);
  if (match === null) throw new Error(`${fill}: το γέμισμα δεν είναι token (${COLOR_BRIDGE.bg[fill]})`);
  return match[1];
}

function fillRgb(theme: ReadonlyMap<string, string>, fill: SolidFillKey): readonly number[] {
  const token = tokenOfFill(fill);
  const value = theme.get(token);
  const hsl = value === undefined ? null : parseHslToken(value);
  if (hsl === null) throw new Error(`${token}: δεν βρέθηκε κυριολεκτική τιμή HSL στο globals.css`);
  return hslToRgb(hsl);
}

function inkRgb(fill: SolidFillKey): readonly number[] {
  const ink = COLOR_BRIDGE.text[SOLID_FILL_INK[fill]];
  const rgb = INK_RGB[ink];
  if (rgb === undefined) throw new Error(`${fill}: άγνωστο μελάνι «${ink}»`);
  return rgb;
}

describe('SOLID_FILL_INK — το μελάνι κάθε συμπαγούς γεμίσματος', () => {
  const themes = readThemes();

  it.each(FILLS.flatMap((fill) => (['light', 'dark'] as const).map((theme) => [fill, theme] as const)))(
    '%s στο %s θέμα ≥ 4,5:1',
    (fill, theme) => {
      const ratio = contrastRatio(inkRgb(fill), fillRgb(themes[theme], fill));
      expect(ratio).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    },
  );

  it('το λευκό ΔΕΝ αρκεί για success/warning — αλλιώς ο πίνακας δεν χρειαζόταν (μάρτυρας ευαισθησίας)', () => {
    const white = INK_RGB['text-white'];
    expect(contrastRatio(white, fillRgb(themes.light, 'successSolid'))).toBeLessThan(TEXT_CONTRAST);
    expect(contrastRatio(white, fillRgb(themes.light, 'warningSolid'))).toBeLessThan(TEXT_CONTRAST);
  });
});

describe('Badge — τα συμπαγή variants ρωτούν τον πίνακα', () => {
  const VARIANT_FILL = {
    success: 'successSolid',
    warning: 'warningSolid',
    info: 'infoSolid',
    error: 'errorSolid',
    destructive: 'errorSolid',
    purple: 'purpleSolid',
  } as const satisfies Record<string, SolidFillKey>;

  const CASES = (Object.keys(VARIANT_FILL) as (keyof typeof VARIANT_FILL)[]).map((variant) => [variant, VARIANT_FILL[variant]] as const);

  it.each(CASES)('στατικό %s = γέμισμα + μετρημένο μελάνι', (variant, fill) => {
    const classes = staticBadgeVariants({ variant }).split(/\s+/);
    expect(classes).toContain(COLOR_BRIDGE.bg[fill]);
    expect(classes).toContain(COLOR_BRIDGE.text[SOLID_FILL_INK[fill]]);
  });

  it.each(CASES)('αποδοσμένο <Badge variant="%s"> = γέμισμα + μετρημένο μελάνι', (variant, fill) => {
    const html = renderToStaticMarkup(createElement(Badge, { variant }, 'x'));
    const classes = (/class="([^"]*)"/.exec(html)?.[1] ?? '').split(/\s+/);
    expect(classes).toContain(COLOR_BRIDGE.bg[fill]);
    expect(classes).toContain(COLOR_BRIDGE.text[SOLID_FILL_INK[fill]]);
  });
});
