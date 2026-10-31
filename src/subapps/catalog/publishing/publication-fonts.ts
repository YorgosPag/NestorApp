/**
 * Οι **γραμματοσειρές του εκδότη** (ADR-923 §5.6 «Θέμα» · CHECK 3.69 / ADR-805). Κλειστό σύνολο: ο κώδικας μιας
 * συνταγής δείχνει εδώ, ποτέ σε ελεύθερο όνομα. Έτσι ο έλεγχος άδειας **προηγείται** της απόδοσης: κάθε αρχείο της λίστας
 * είναι δηλωμένο στο `.font-assets.json` με επιτρεπόμενη άδεια, και αυτό το κλειδώνει η άγκυρα
 * `publication-fonts.test.ts` διαβάζοντας το μητρώο.
 *
 * ⚠️ Το Typst διαβάζει TTF/OTF, όχι WOFF2 ⇒ το Roboto του `public/fonts/roboto/` **δεν** μπαίνει εδώ. Γραμματοσειρά που
 * ανεβάζει ο ίδιος ο προμηθευτής = ανοιχτή ραφή: θέλει έλεγχο `fsType` + άδειας στο ανέβασμα (§5.6.1).
 * @module subapps/catalog/publishing/publication-fonts
 */

export interface PublicationFont {
  /** Το όνομα οικογένειας όπως το γράφει το ίδιο το αρχείο — αυτό ζητά το πρότυπο. */
  readonly family: string;
  /** Διαδρομές από τη ρίζα του έργου, όπως στο `.font-assets.json`. */
  readonly files: readonly string[];
}

export const PUBLICATION_FONTS = {
  liberationSans: {
    family: 'Liberation Sans',
    files: [
      'public/fonts/LiberationSans-Regular.ttf',
      'public/fonts/LiberationSans-Bold.ttf',
      'public/fonts/LiberationSans-Italic.ttf',
      'public/fonts/LiberationSans-BoldItalic.ttf',
    ],
  },
} as const satisfies Readonly<Record<string, PublicationFont>>;

export type PublicationFontCode = keyof typeof PUBLICATION_FONTS;

export const PUBLICATION_FONT_CODES = Object.keys(PUBLICATION_FONTS) as readonly PublicationFontCode[];

export const DEFAULT_PUBLICATION_FONT: PublicationFontCode = 'liberationSans';

export function isPublicationFontCode(value: unknown): value is PublicationFontCode {
  return (PUBLICATION_FONT_CODES as readonly unknown[]).includes(value);
}
