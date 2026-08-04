/**
 * ADR-750 Φ6 — **ο κατάλογος στυλ του listbox**, μετρημένος αντί να δηλώνεται.
 *
 * Δύο πράγματα αποδεικνύονται εδώ, και το δεύτερο είναι ο λόγος ύπαρξης του αρχείου:
 *
 * 1. **Το σχήμα**: 14 θέσεις σε πλέγμα 2×7, μοναδικές ταυτότητες, η πρώτη «Καμία».
 * 2. **Ότι ο κατάλογος ΔΕΝ εφηύρε τίποτα**: κάθε `linetypeName` υπάρχει πράγματι στον
 *    `LINETYPE_CATALOG_NAMES` και κάθε `widthMm` είναι πραγματική πένα του ISO 128-20. Ένα
 *    test που έλεγχε μόνο «η συνάρτηση επέστρεψε αντικείμενο» θα άφηνε ένα `'Dotted'` (τύπος
 *    που δεν υπάρχει) να περάσει, και ο χρήστης θα έβλεπε **συνεχή** γραμμή σιωπηλά.
 */

import {
  TABLE_BORDER_STYLES,
  TABLE_BORDER_STYLE_GRID,
  tableBorderStylePencil,
  tableBorderStylePreset,
  type TableBorderStyleId,
} from '../table-border-style-catalog';
import { HIDDEN_TABLE_EDGE } from '../table-edge-model';
import { resolveTableBorderPencil, tableBorderDoubleGapMm } from '../table-border-pencil';
import { BUILTIN_TABLE_STYLE_IDS, BUILTIN_TABLE_STYLES } from '../table-style-presets';
import type { TableStyle } from '../table-style';
import { LINEWEIGHT_CONCRETE_MM_VALUES } from '../../../config/lineweight-iso-catalog';
import { LINETYPE_CATALOG_NAMES } from '../../../config/linetype-iso-catalog';

const STANDARD: TableStyle = (() => {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD);
  if (!style) throw new Error('missing preset: standard');
  return style;
})();

/** Το «Αυτόματο» (Α20) — ό,τι ισχύει για κάθε πεδίο που το στυλ δεν παρακάμπτει. */
const AUTO = resolveTableBorderPencil(STANDARD);

/** Οι 13 ζωγραφίσιμες, δηλαδή όλες εκτός από το «Καμία». */
const DRAWABLE = TABLE_BORDER_STYLES.filter((preset) => preset.pen !== undefined);

describe('ADR-750 Φ6 — το σχήμα του listbox', () => {
  it('έχει 14 θέσεις: 13 ζωγραφίσιμα στυλ + το «Καμία»', () => {
    expect(TABLE_BORDER_STYLES).toHaveLength(14);
    expect(DRAWABLE).toHaveLength(13);
  });

  it('το πλέγμα 2×7 χωρά ακριβώς τις θέσεις — καμία κενή, καμία περισσευούμενη', () => {
    expect(TABLE_BORDER_STYLE_GRID.columns * TABLE_BORDER_STYLE_GRID.rows).toBe(
      TABLE_BORDER_STYLES.length,
    );
  });

  it('η πρώτη θέση είναι το «Καμία» (μετρημένο στιγμιότυπο Excel)', () => {
    expect(TABLE_BORDER_STYLES[0].id).toBe('none');
    expect(TABLE_BORDER_STYLES[0].pen).toBeUndefined();
  });

  it('«Καμία» υπάρχει ΜΟΝΟ μία φορά — μολύβι έχουν όλες οι υπόλοιπες', () => {
    const penless = TABLE_BORDER_STYLES.filter((preset) => preset.pen === undefined);
    expect(penless.map((preset) => preset.id)).toEqual(['none']);
  });

  it('οι ταυτότητες είναι μοναδικές', () => {
    const ids = TABLE_BORDER_STYLES.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('η σειρά είναι ΚΑΤΑ ΣΤΗΛΗ — η δεύτερη στήλη ξεκινά στη θέση 8', () => {
    // Το Excel γεμίζει πρώτα ολόκληρη την αριστερή στήλη. Η 8η θέση (δείκτης 7) είναι η
    // κορυφή της δεξιάς: «παύλα-τελεία-τελεία μεσαία».
    expect(TABLE_BORDER_STYLES[TABLE_BORDER_STYLE_GRID.rows].id).toBe('mediumDashDotDot');
    expect(TABLE_BORDER_STYLES[TABLE_BORDER_STYLE_GRID.rows - 1].id).toBe('thinSolid');
  });

  it('η αναζήτηση ανά ταυτότητα βρίσκει κάθε εγγραφή', () => {
    for (const preset of TABLE_BORDER_STYLES) {
      expect(tableBorderStylePreset(preset.id)).toBe(preset);
    }
  });
});

describe('ADR-750 Φ6 — ο κατάλογος δεν εφευρίσκει ούτε τύπο γραμμής ούτε πένα', () => {
  it.each(DRAWABLE.map((preset) => [preset.id, preset.pen?.linetypeName] as const))(
    '«%s» δείχνει σε υπαρκτό τύπο γραμμής (%s)',
    (_id, linetypeName) => {
      expect(LINETYPE_CATALOG_NAMES).toContain(linetypeName);
    },
  );

  it.each(DRAWABLE.map((preset) => [preset.id, preset.pen?.widthMm] as const))(
    '«%s» χρησιμοποιεί πραγματική πένα ISO 128-20 (%s mm)',
    (_id, widthMm) => {
      expect(LINEWEIGHT_CONCRETE_MM_VALUES).toContain(widthMm);
    },
  );

  it('οι τέσσερις βαθμίδες είναι διαδοχικά ζεύγη 1:2 του ISO — 0,13 → 0,25 → 0,50 → 1,00', () => {
    const ladder = [...new Set(DRAWABLE.map((preset) => preset.pen?.widthMm))].sort(
      (a = 0, b = 0) => a - b,
    );
    expect(ladder).toEqual([0.13, 0.25, 0.5, 1]);
  });
});

describe('ADR-750 Φ6 — το μολύβι κάθε στυλ', () => {
  it('το «Καμία» δίνει το κανονικό αόρατο μολύβι (Α14), όχι λεπτότερη γραμμή', () => {
    expect(tableBorderStylePencil('none', STANDARD, [])).toBe(HIDDEN_TABLE_EDGE);
  });

  it('και τα 13 δίνουν έγκυρο, ΟΡΑΤΟ μολύβι με πένα του καταλόγου', () => {
    for (const preset of DRAWABLE) {
      const spec = tableBorderStylePencil(preset.id, STANDARD, []);
      expect(spec.visible).toBe(true);
      expect(spec.colorHex).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(LINEWEIGHT_CONCRETE_MM_VALUES).toContain(spec.widthMm);
      expect(spec.widthMm).toBe(preset.pen?.widthMm);
    }
  });

  it('χωρίς χρώμα ⇒ ισχύει το «Από το στυλ» (Α20/Α23), δεν εφευρίσκεται μαύρο', () => {
    expect(tableBorderStylePencil('thinSolid', STANDARD, []).colorHex).toBe(AUTO.colorHex);
  });

  it('με χρώμα ⇒ το χειριστήριο του χρήστη νικά — και μόνο αυτό το πεδίο', () => {
    const spec = tableBorderStylePencil('thickSolid', STANDARD, [], '#ff00ff');
    expect(spec.colorHex).toBe('#ff00ff');
    expect(spec.widthMm).toBe(1);
  });

  it('κενό μοτίβο ⇒ ΚΑΝΕΝΑ πεδίο `dashMm` — «συνεχής» δεν είναι «άδεια λίστα» στο αρχείο', () => {
    const spec = tableBorderStylePencil('mediumSolid', STANDARD, []);
    expect('dashMm' in spec).toBe(false);
  });

  it('μοτίβο ⇒ περνά αυτούσιο, με τη σύμβαση προσήμου του DXF', () => {
    const spec = tableBorderStylePencil('hairlineDotted', STANDARD, [0, -6.35]);
    expect(spec.dashMm).toEqual([0, -6.35]);
    expect(spec.widthMm).toBe(0.13);
  });

  it('η «διπλή» παράγει απόσταση ΑΠΟ ΤΗΝ ΠΕΝΑ (Α24), όχι σταθερό χιλιοστό', () => {
    const spec = tableBorderStylePencil('double', STANDARD, []);
    expect(spec.doubleGapMm).toBe(tableBorderDoubleGapMm(spec.widthMm));
  });

  it('μόνο η «διπλή» είναι διπλή — καμία άλλη δεν κουβαλά απόσταση κατά λάθος', () => {
    const doubled = TABLE_BORDER_STYLES.filter(
      (preset) => tableBorderStylePencil(preset.id, STANDARD, []).doubleGapMm !== undefined,
    );
    expect(doubled.map((preset) => preset.id)).toEqual(['double']);
  });

  it('άγνωστη ταυτότητα ⇒ αόρατο μολύβι, ποτέ τυχαία γραμμή', () => {
    const unknown = 'styleThatNeverExisted' as TableBorderStyleId;
    expect(tableBorderStylePencil(unknown, STANDARD, [])).toBe(HIDDEN_TABLE_EDGE);
  });
});

/**
 * 🔴 Η ΑΓΚΥΡΑ ΠΟΥ ΕΛΕΙΠΕ — ο κατάλογος και οι ετικέτες του είναι **δύο** λίστες.
 *
 * Ο κατάλογος γράφτηκε σε `.ts`, οι ετικέτες σε δύο `.json`. Καμία πύλη δεν τις συγκρίνει:
 * το CHECK 3.8 ρωτά «υπάρχει το κλειδί που καλεί ο κώδικας;» — αλλά ο κώδικας τα συνθέτει
 * δυναμικά (`lineStyles.${id}`), οπότε **δεν υπάρχει γραμμή να σαρωθεί**.
 *
 * Και όντως απέκλιναν: όταν γράφτηκαν παράλληλα, **13 από τα 14** ids δεν ταίριαζαν
 * (μόνο το `double` έπεφτε πάνω). Ο χρήστης θα έβλεπε 13 ωμά κλειδιά σε ένα listbox με
 * ΟΛΕΣ τις άλλες πύλες πράσινες — ακριβώς το σχήμα που γέννησε το CHECK 3.36 (ADR-752).
 *
 * 🔑 Ο έλεγχος είναι στην **ταυτότητα και τη σειρά**, όχι στο πλήθος: δύο λίστες των 14 με
 * ένα ζευγάρι ανταλλαγμένο δίνουν λάθος ετικέτα σε δύο στυλ — *φαίνεται* σωστό, και είναι
 * η χειρότερη από τις τρεις καταστάσεις (`wrong-target` του ADR-752).
 */
describe('ADR-750 Φ6 — ο κατάλογος και οι ετικέτες του δεν αποκλίνουν', () => {
  const LOCALES = ['el', 'en'] as const;

  it.each(LOCALES)('%s: κάθε στυλ του καταλόγου έχει ετικέτα, με την ΙΔΙΑ σειρά', (lang) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const bundle = require(`@/i18n/locales/${lang}/dxf-viewer.json`) as {
      table: { borders: { dialog: { lineStyles: Record<string, string> } } };
    };
    const labels = bundle.table.borders.dialog.lineStyles;

    expect(Object.keys(labels)).toEqual(TABLE_BORDER_STYLES.map((preset) => preset.id));
    // Καμία ετικέτα κενή: ένα `""` περνά κάθε έλεγχο ύπαρξης και βάφει **τίποτα**.
    for (const id of Object.keys(labels)) expect(labels[id].trim().length).toBeGreaterThan(0);
  });
});
