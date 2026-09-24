/**
 * ⚓ ADR-881 §4.5 — **ο κριτής αναγνωσιμότητας του ήρωα**.
 *
 * 🔴 Κ1 είναι η άγκυρα SSoT: οι στάσεις του στρώματος στον κριτή ΠΡΕΠΕΙ να είναι οι αριθμοί των
 *    κλάσεων που αποδίδει ο ήρωας. Αλλάζει το gradient χωρίς τον κριτή ⇒ ο κριτής θα έκρινε άλλη
 *    εικόνα από αυτή που βλέπει ο επισκέπτης — πράσινο που λέει ψέματα.
 */

import {
  HERO_SCRIM_CLASS,
  HERO_SCRIM_DUSK_CLASS,
  HERO_SCRIM_DUSK_FORCED_CLASS,
} from '@/components/shared/landing-hero/LandingHero';

import {
  contrastOnWhite,
  coverSourceRect,
  HERO_SCRIM_STOPS,
  judgeHeroLegibility,
  relativeLuminance,
  scrimAlphaAt,
  verdictFor,
} from '../hero-legibility';

jest.mock('next/image', () => ({ __esModule: true, default: () => null }));

function stopsFrom(classes: string, prefix: string): number[] {
  return ['from', 'via', 'to'].map((stop) => {
    const match = classes.match(new RegExp(`(?:^|\\s)${prefix}${stop}-(?:black/(\\d+)|(transparent))(?:\\s|$)`));
    if (match === null) throw new Error(`λείπει η στάση ${prefix}${stop}`);
    return match[2] === 'transparent' ? 0 : Number(match[1]) / 100;
  });
}

describe('Κ1 — οι στάσεις του κριτή ΕΙΝΑΙ οι κλάσεις του ήρωα', () => {
  it('μέρα', () => expect(stopsFrom(HERO_SCRIM_CLASS, '')).toEqual([...HERO_SCRIM_STOPS.day]));
  it('σούρουπο', () => expect(stopsFrom(HERO_SCRIM_DUSK_CLASS, 'dark:')).toEqual([...HERO_SCRIM_STOPS.dusk]));
  it('σούρουπο της προσομοίωσης = σούρουπο του ήρωα', () =>
    expect(stopsFrom(HERO_SCRIM_DUSK_FORCED_CLASS, '')).toEqual([...HERO_SCRIM_STOPS.dusk]));
});

describe('Κ2 — αριθμητική WCAG', () => {
  it('λευκό σε μαύρο = 21:1, λευκό σε λευκό = 1:1', () => {
    expect(contrastOnWhite(relativeLuminance(0, 0, 0))).toBeCloseTo(21, 5);
    expect(contrastOnWhite(relativeLuminance(255, 255, 255))).toBeCloseTo(1, 5);
  });

  it('το στρώμα παρεμβάλλεται γραμμικά ανάμεσα στις στάσεις', () => {
    expect(scrimAlphaAt('day', 0)).toBeCloseTo(0.75);
    expect(scrimAlphaAt('day', 0.25)).toBeCloseTo(0.6);
    expect(scrimAlphaAt('day', 1)).toBeCloseTo(0.1);
    expect(scrimAlphaAt('dusk', 1)).toBeCloseTo(0);
  });

  it('κατώφλια: 4,5 περνά · 3 μόνο για μεγάλο κείμενο · κάτω από 3 αποτυγχάνει', () => {
    expect(verdictFor(4.5)).toBe('pass');
    expect(verdictFor(3.2)).toBe('large-only');
    expect(verdictFor(2.9)).toBe('fail');
  });
});

describe('Κ3 — το κάδρο κόβει όπως ο browser', () => {
  it('φαρδύ κάδρο πάνω σε 2:1: κόβει ύψος, και το `y` διαλέγει ποιο κομμάτι', () => {
    const top = coverSourceRect({ width: 2000, height: 1000 }, { width: 3000, height: 1000 }, { x: 0.5, y: 0 });
    const bottom = coverSourceRect({ width: 2000, height: 1000 }, { width: 3000, height: 1000 }, { x: 0.5, y: 1 });
    expect(top).toEqual({ sx: 0, sy: 0, sw: 2000, sh: 2000 / 3 });
    expect(bottom.sy).toBeCloseTo(1000 - 2000 / 3);
  });

  it('στενό κάδρο (κινητό): κόβει πλάτος, και το `x=1` κρατά το δεξί άκρο', () => {
    const rect = coverSourceRect({ width: 2000, height: 1000 }, { width: 400, height: 600 }, { x: 1, y: 0.5 });
    expect(rect.sx + rect.sw).toBeCloseTo(2000);
    expect(rect.sh).toBeCloseTo(1000);
  });
});

describe('Κ4 — η κρίση κοιτά το ΧΕΙΡΟΤΕΡΟ 5%, όχι τον μέσο όρο', () => {
  function frame(fill: (x: number, y: number) => number, width = 100, height = 50) {
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const v = fill(x, y);
        rgba.set([v, v, v, 255], (y * width + x) * 4);
      }
    }
    return rgba;
  }

  it('σκούρα εικόνα ⇒ περνά', () => {
    expect(judgeHeroLegibility(frame(() => 40), 100, 50, 'day').verdict).toBe('pass');
  });

  it('🔴 σκούρα εικόνα με ΦΩΤΕΙΝΗ ΚΗΛΙΔΑ (>5% της ζώνης) στη ζώνη κειμένου ⇒ ΔΕΝ περνά', () => {
    // Ο μέσος όρος θα έλεγε «σκούρο»· η λέξη που πέφτει πάνω στην κηλίδα δεν διαβάζεται.
    const spot = frame((x, y) => (x >= 40 && x < 60 && y >= 10 && y < 22 ? 255 : 40));
    expect(judgeHeroLegibility(spot, 100, 50, 'dusk').verdict).not.toBe('pass');
  });

  it('λευκή εικόνα στο σούρουπο (ελαφρύτερο στρώμα) ⇒ αποτυγχάνει', () => {
    expect(judgeHeroLegibility(frame(() => 255), 100, 50, 'dusk').verdict).toBe('fail');
  });
});
