/**
 * @jest-environment node
 *
 * ⚓ ADR-777 §8.94 — η ράμπα της ενεργειακής κλίμακας **ξαναμετριέται από το ίδιο το stylesheet**.
 *
 * Το `globals.css` γράφει «μετρημένο ≥ 3:1 απέναντι στην κάρτα και στα δύο θέματα». Ένα σχόλιο που λέει «μετρημένο»
 * χωρίς άγκυρα είναι ισχυρισμός (ADR-710: η προηγούμενη παλέτα «ασφαλής για αχρωματοψία» δεν είχε μετρηθεί ποτέ).
 * Εδώ οι εννέα τιμές διαβάζονται από το αρχείο και κρίνονται με την **ίδια** μηχανή χρώματος που κρίνει τα γραφήματα.
 */

import fs from 'fs';
import path from 'path';

import { ENERGY_CLASSES } from '@/constants/energy-classes';

import { ENERGY_CLASS_BAR_CLASS, ENERGY_CLASS_BAR_WIDTH_CLASS } from '../energy-class-palette';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { hslToRgb, contrast } = require('../../../../../scripts/lib/contrast/cvd') as {
  hslToRgb: (h: number, s: number, l: number) => readonly number[];
  contrast: (a: readonly number[], b: readonly number[]) => number;
};

const CSS = fs.readFileSync(path.join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8');
const NON_TEXT_CONTRAST = 3;

/**
 * Όλες οι δηλώσεις `--name: H S% L%;` του αρχείου, με τη σειρά τους (φωτεινό θέμα πρώτα, σκοτεινό μετά).
 *
 * ⚠️ Μόνο δήλωση **στην αρχή γραμμής**: το stylesheet αναφέρει τιμές και μέσα σε σχόλια (`--card: 217 33% 17%`), και
 * μια αναφορά μετρημένη ως δήλωση θα έκανε την άγκυρα να κρίνει λάθος επιφάνεια.
 */
function declarationsOf(name: string): readonly (readonly number[])[] {
  const pattern = new RegExp(`^\\s*--${name}:\\s*(-?[\\d.]+)\\s+(-?[\\d.]+)%\\s+(-?[\\d.]+)%`, 'gm');
  return [...CSS.matchAll(pattern)].map((match) => hslToRgb(Number(match[1]), Number(match[2]), Number(match[3])));
}

describe('η ράμπα `--energy-class-1..9`', () => {
  const surfaces = declarationsOf('card');

  it('η κάρτα δηλώνεται δύο φορές (ένα θέμα η καθεμία) — αλλιώς η μέτρηση από κάτω δεν μετρά ό,τι λέει', () => {
    expect(surfaces).toHaveLength(2);
  });

  it.each(ENERGY_CLASSES.map((energyClass, index) => [energyClass, index + 1] as const))(
    '%s (βαθμίδα %i): δηλωμένη και στα δύο θέματα, ≥ 3:1 απέναντι στην κάρτα του καθενός',
    (_energyClass, step) => {
      const tones = declarationsOf(`energy-class-${step}`);
      expect(tones).toHaveLength(2);
      tones.forEach((tone, theme) => {
        expect(contrast(tone, surfaces[theme])).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST);
      });
    },
  );

  it('δεν υπάρχει δέκατη βαθμίδα στο stylesheet — η κλίμακα και η ράμπα έχουν το ίδιο μήκος', () => {
    expect(declarationsOf(`energy-class-${ENERGY_CLASSES.length + 1}`)).toHaveLength(0);
  });
});

describe('οι πίνακες κλάσεων', () => {
  // ⚠️ Καμία κλάση δεν γράφεται εδώ με παρεμβολή: ο σαρωτής του Tailwind διαβάζει και τα tests, και σχήμα κλάσης με
  //    παρεμβολή μέσα του γίνεται άκυρο CSS (ADR-907 §11). Διαβάζουμε μόνο τα ψηφία.
  const digitsOf = (className: string): number => Number.parseInt(className.replace(/\D/g, ''), 10);

  it('κάθε βαθμίδα δείχνει στη ΔΙΚΗ της θέση της ράμπας, με τη σειρά της κλίμακας', () => {
    ENERGY_CLASSES.forEach((energyClass, index) => {
      expect(ENERGY_CLASS_BAR_CLASS[energyClass]).toContain('--energy-class-');
      expect(digitsOf(ENERGY_CLASS_BAR_CLASS[energyClass])).toBe(index + 1);
    });
  });

  it('♿ το μήκος της μπάρας μεγαλώνει γνησίως με τη βαθμίδα — το κανάλι που δεν είναι χρώμα', () => {
    const widths = ENERGY_CLASSES.map((energyClass) => {
      const width = digitsOf(ENERGY_CLASS_BAR_WIDTH_CLASS[energyClass]);
      return Number.isNaN(width) ? 100 : width;
    });
    widths.slice(1).forEach((width, index) => expect(width).toBeGreaterThan(widths[index]));
  });
});
