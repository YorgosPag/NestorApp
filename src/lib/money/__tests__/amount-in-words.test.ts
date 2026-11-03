/**
 * ⚓ Ποσό ολογράφως (ADR-928 §5.10) — γένος, «εκατό/εκατόν», χίλια/χιλιάδες, κλίμακες, λεπτά, όρια.
 */

import { amountInWords, AMOUNT_WORDS_LANGUAGES } from '../amount-in-words/amount-in-words';
import { minorFromMajor } from '../money';

const el = (minor: number) => amountInWords(minor, 'el');
const en = (minor: number) => amountInWords(minor, 'en');
const euros = (major: number) => (major * 100);

describe('amountInWords — ελληνικά', () => {
  it.each([
    [320, 'τρία ευρώ και είκοσι λεπτά'],
    [100, 'ένα ευρώ'],
    [101, 'ένα ευρώ και ένα λεπτό'],
    [1, 'ένα λεπτό'],
    [99, 'ενενήντα εννέα λεπτά'],
    [0, 'μηδέν ευρώ'],
    [euros(4), 'τέσσερα ευρώ'],
    [euros(13), 'δεκατρία ευρώ'],
    [euros(14), 'δεκατέσσερα ευρώ'],
    [euros(17), 'δεκαεπτά ευρώ'],
    [euros(21), 'είκοσι ένα ευρώ'],
    [euros(90), 'ενενήντα ευρώ'],
  ])('μονάδες και δεκάδες σε ουδέτερο: %i → %s', (minor, words) => {
    expect(el(minor)).toBe(words);
  });

  it.each([
    [euros(100), 'εκατό ευρώ'],
    [euros(101), 'εκατόν ένα ευρώ'],
    [euros(120), 'εκατόν είκοσι ευρώ'],
    [euros(200), 'διακόσια ευρώ'],
    [euros(900), 'εννιακόσια ευρώ'],
    [euros(999), 'εννιακόσια ενενήντα εννέα ευρώ'],
  ])('εκατοντάδες: «εκατό» μόνο του, «εκατόν» με συνέχεια: %i → %s', (minor, words) => {
    expect(el(minor)).toBe(words);
  });

  it.each([
    [euros(1_000), 'χίλια ευρώ'],
    [euros(1_001), 'χίλια ένα ευρώ'],
    [euros(2_000), 'δύο χιλιάδες ευρώ'],
    [euros(3_200), 'τρεις χιλιάδες διακόσια ευρώ'],
    [euros(4_000), 'τέσσερις χιλιάδες ευρώ'],
    [euros(13_000), 'δεκατρείς χιλιάδες ευρώ'],
    [euros(14_000), 'δεκατέσσερις χιλιάδες ευρώ'],
    [euros(21_000), 'είκοσι μία χιλιάδες ευρώ'],
    [euros(100_000), 'εκατό χιλιάδες ευρώ'],
    [euros(101_000), 'εκατόν μία χιλιάδες ευρώ'],
    [euros(200_000), 'διακόσιες χιλιάδες ευρώ'],
    [euros(304_000), 'τριακόσιες τέσσερις χιλιάδες ευρώ'],
  ])('χιλιάδες σε θηλυκό, το 1.000 = «χίλια»: %i → %s', (minor, words) => {
    expect(el(minor)).toBe(words);
  });

  it.each([
    [euros(1_000_000), 'ένα εκατομμύριο ευρώ'],
    [euros(3_000_000), 'τρία εκατομμύρια ευρώ'],
    [euros(1_001_000), 'ένα εκατομμύριο χίλια ευρώ'],
    [euros(2_300_000), 'δύο εκατομμύρια τριακόσιες χιλιάδες ευρώ'],
    [euros(200_000_000), 'διακόσια εκατομμύρια ευρώ'],
    [euros(1_000_000_000), 'ένα δισεκατομμύριο ευρώ'],
    [euros(4_000_000_000_000), 'τέσσερα τρισεκατομμύρια ευρώ'],
  ])('εκατομμύρια και πάνω σε ουδέτερο: %i → %s', (minor, words) => {
    expect(el(minor)).toBe(words);
  });

  it('πλήρες ποσό συμφωνητικού', () => {
    expect(el(1_234_567_89)).toBe(
      'ένα εκατομμύριο διακόσιες τριάντα τέσσερις χιλιάδες πεντακόσια εξήντα επτά ευρώ και ογδόντα εννέα λεπτά',
    );
  });
});

describe('amountInWords — English', () => {
  it.each([
    [320, 'three euros and twenty cents'],
    [100, 'one euro'],
    [101, 'one euro and one cent'],
    [1, 'one cent'],
    [0, 'zero euros'],
    [euros(21), 'twenty-one euros'],
    [euros(120), 'one hundred twenty euros'],
    [euros(1_000), 'one thousand euros'],
    [euros(3_200), 'three thousand two hundred euros'],
    [euros(1_000_000), 'one million euros'],
    [euros(2_000_000_005), 'two billion five euros'],
  ])('%i → %s', (minor, words) => {
    expect(en(minor)).toBe(words);
  });
});

describe('amountInWords — σύνορο', () => {
  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'κλειστή αποτυχία για μη έγκυρο ποσό: %p',
    (minor) => {
      for (const language of AMOUNT_WORDS_LANGUAGES) expect(amountInWords(minor, language)).toBeNull();
    },
  );

  it('ο μέγιστος ασφαλής ακέραιος λεπτών συλλαβίζεται σε κάθε γλώσσα (τρισεκατομμύρια)', () => {
    for (const language of AMOUNT_WORDS_LANGUAGES) {
      expect(amountInWords(Number.MAX_SAFE_INTEGER, language)).toMatch(/\S/);
    }
    expect(el(Number.MAX_SAFE_INTEGER)).toMatch(/^ενενήντα τρισεκατομμύρια /);
  });

  it('το 3,20 € από ευρώ περνά από το minorFromMajor, όχι από * 100 — καμία απώλεια κινητής υποδιαστολής', () => {
    const minor = minorFromMajor(3.2);
    expect(minor).toBe(320);
    expect(minor === null ? null : el(minor)).toBe('τρία ευρώ και είκοσι λεπτά');
  });
});
