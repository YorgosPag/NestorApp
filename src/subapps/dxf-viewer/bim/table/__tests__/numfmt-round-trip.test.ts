/**
 * ADR-833 Φάση 6 — **η αναλλοίωτη της μορφής**: ό,τι γράφουμε στο `.xlsx`, το ξαναδιαβάζουμε.
 *
 * 🔑 **Ιδιότητα, όχι δείγμα.** Το ερώτημα δεν είναι «δουλεύει για το `0.00`;» αλλά «υπάρχει
 * **έστω μία** πρόθεση που, γραμμένη και ξαναδιαβασμένη, γυρίζει αλλιωμένη;» — γι' αυτό ο
 * κατάλογος διατρέχει **κάθε** είδος, με ακρίβειες `0`/`2`/`3`, ομαδοποίηση on/off, και τα
 * έξι ύφη ημερομηνίας, σε **δύο** locale με αντίθετη σειρά ημέρας/μήνα.
 *
 * ⚠️ Το μάθημα του §5.6.6 εφαρμοσμένο: μια άγκυρα με ανοχή («περίπου ίδιο») θα κατάπινε
 * ακριβώς τη διαφορά που ψάχνουμε.
 *
 * @see bim/table/export/table-format-to-numfmt.ts
 * @see bim/table/import/numfmt-to-table-format.ts
 */

import { xlsxNumFmtForCellFormat } from '../export/table-format-to-numfmt';
import { tableCellFormatForNumFmt } from '../import/numfmt-to-table-format';
import { cellDisplayText } from '../table-cell-format';
import type { TableCellFormat, TableDateStyle } from '../../../types/table-cell-format';
import type { Precision } from '../../../config/number-format-config';

const PRECISIONS: readonly Precision[] = [0, 2, 3];
const DATE_STYLES: readonly TableDateStyle[] = ['short', 'medium', 'long', 'iso', 'monthYear', 'year'];

/** Κάθε πρόθεση που ο ΝΕΣΤΩΡ ξέρει να εκφράσει, σε όλες τις παραλλαγές της. */
function everyFormat(locale: 'el-GR' | 'en-US'): TableCellFormat[] {
  const formats: TableCellFormat[] = [
    { kind: 'general', locale },
    { kind: 'text', locale },
    { kind: 'whole', grouping: true, locale },
    { kind: 'whole', grouping: false, locale },
  ];
  for (const decimals of PRECISIONS) {
    formats.push({ kind: 'decimal', decimals, grouping: true, locale });
    formats.push({ kind: 'decimal', decimals, grouping: false, locale });
    formats.push({ kind: 'percent', decimals, locale });
    formats.push({ kind: 'currency', decimals, currency: 'EUR', grouping: true, locale });
    formats.push({ kind: 'currency', decimals, currency: 'USD', grouping: false, locale });
    formats.push({ kind: 'angle', decimals, locale });
  }
  for (const style of DATE_STYLES) formats.push({ kind: 'date', style, locale });
  return formats;
}

/** Ο αναγνωριστής δεν επιστρέφει `locale` — είναι ρύθμιση του σχεδίου, όχι του μοτίβου. */
function withoutLocale(format: TableCellFormat): Omit<TableCellFormat, 'locale'> {
  const { locale: _ignored, ...rest } = format;
  return rest;
}

/**
 * ⚠️ **Η ΜΙΑ δηλωμένη ισοδυναμία**: το Excel δεν έχει δύο μοτίβα για «ακέραιος», οπότε
 * `decimal(0)` και `whole` γράφονται ταυτόσημα και επιστρέφουν ως `whole`. Η αναλλοίωτη
 * ισχύει **modulo αυτήν**, και η επόμενη άγκυρα αποδεικνύει ότι είναι αβλαβής.
 */
function canonical(format: TableCellFormat): Omit<TableCellFormat, 'locale'> {
  const bare = withoutLocale(format);
  return bare.kind === 'decimal' && bare.decimals === 0
    ? { kind: 'whole', grouping: bare.grouping }
    : bare;
}

describe.each(['el-GR', 'en-US'] as const)('ADR-833 Φ6 — μορφή → numFmt → μορφή (%s)', (locale) => {
  it.each(everyFormat(locale).map((format) => [`${format.kind}:${JSON.stringify(withoutLocale(format))}`, format] as const))(
    'επιβιώνει ακέραιη: %s',
    (_label, format) => {
      const numFmt = xlsxNumFmtForCellFormat(format);
      // `general` είναι η μόνη πρόθεση που ΔΕΝ γράφει μοτίβο — και σωστά: το «καμία μορφή»
      // του Excel εκφράζεται με την απουσία, όχι με μοτίβο που λέει «τίποτα».
      if (format.kind === 'general') {
        expect(numFmt).toBeUndefined();
        return;
      }
      expect(numFmt).toBeDefined();
      expect(tableCellFormatForNumFmt(numFmt as string)).toEqual(canonical(format));
    },
  );
});

describe('ADR-833 Φ6 — η ισοδυναμία `decimal(0)` ≡ `whole` είναι ΤΟΥ EXCEL, και είναι αβλαβής', () => {
  it.each([true, false])('γράφουν ΤΟ ΙΔΙΟ μοτίβο (grouping=%s)', (grouping) => {
    expect(xlsxNumFmtForCellFormat({ kind: 'decimal', decimals: 0, grouping })).toBe(
      xlsxNumFmtForCellFormat({ kind: 'whole', grouping }),
    );
  });

  it('🔴 …και ΔΕΙΧΝΟΥΝ το ίδιο, άρα η σύμπτωση δεν κοστίζει τίποτα στον χρήστη', () => {
    const value = 1234.567;
    const asDecimal = cellDisplayText({ kind: 'text', value }, { kind: 'decimal', decimals: 0, grouping: true, locale: 'el-GR' });
    const asWhole = cellDisplayText({ kind: 'text', value }, { kind: 'whole', grouping: true, locale: 'el-GR' });
    expect(asDecimal).toBe(asWhole);
  });
});

describe('ADR-833 §5.7.3 — το ΜΟΤΙΒΟ που φεύγει: το CLDR αποφασίζει, όχι εμείς', () => {
  // 🔴 Αυτή η ομάδα γεννήθηκε από **τρεις πράσινες μεταλλάξεις** (M20/M21/M22): ο κύκλος
  // «γράψε → ξαναδιάβασε» είναι **τυφλός στη θέση** του συμβόλου, γιατί ο αναγνωριστής
  // αφαιρεί το `[$XXX]` όπου κι αν βρίσκεται. Δηλαδή το νόμισμα μπορούσε να φεύγει με το `€`
  // στη λάθος πλευρά και **κάθε** test να μένει πράσινο.
  it('🔴 ελληνικά: το σύμβολο ΜΕΤΑ τον αριθμό, με κενό — `1.200,50 €`', () => {
    expect(
      xlsxNumFmtForCellFormat({ kind: 'currency', decimals: 2, currency: 'EUR', grouping: true, locale: 'el-GR' }),
    ).toBe('#,##0.00" "[$EUR]');
  });

  it('🔴 αγγλικά: το σύμβολο ΠΡΙΝ τον αριθμό, χωρίς κενό — `€1,200.50`', () => {
    expect(
      xlsxNumFmtForCellFormat({ kind: 'currency', decimals: 2, currency: 'EUR', grouping: true, locale: 'en-US' }),
    ).toBe('[$EUR]#,##0.00');
  });

  it('🔴 …και οι δύο διαφέρουν — αλλιώς δεν αποφασίζει κανείς', () => {
    const el = xlsxNumFmtForCellFormat({ kind: 'currency', decimals: 2, currency: 'EUR', locale: 'el-GR' });
    const en = xlsxNumFmtForCellFormat({ kind: 'currency', decimals: 2, currency: 'EUR', locale: 'en-US' });
    expect(el).not.toBe(en);
  });

  it('🔴 η ημερομηνία παίρνει τη ΣΕΙΡΑ του locale, με τον διαχωριστή σε εισαγωγικά', () => {
    expect(xlsxNumFmtForCellFormat({ kind: 'date', style: 'short', locale: 'el-GR' })).toBe('dd"/"mm"/"yyyy');
    expect(xlsxNumFmtForCellFormat({ kind: 'date', style: 'short', locale: 'en-US' })).toBe('mm"/"dd"/"yyyy');
  });
});

describe('ADR-833 Φ6 — ο αναγνωριστής ΑΡΝΕΙΤΑΙ ό,τι δεν είναι βέβαιο', () => {
  it.each([
    ['υπό συνθήκη χρώμα + τρεις ενότητες', '[Red][<-100]0.0;;"—"'],
    ['κλάσμα', '# ?/?'],
    ['επιστημονική', '0.00E+00'],
    ['ώρα', 'h:mm:ss'],
    ['λογιστική με στοίχιση', '_-* #,##0.00_-;-* #,##0.00_-;_-* "-"??_-;_-@_-'],
  ].map(([label, pattern]) => [label, pattern] as const))(
    'δεν μαντεύει: %s',
    (_label, pattern) => {
      expect(tableCellFormatForNumFmt(pattern)).toBeUndefined();
    },
  );

  it('🔴 το `General` ΕΙΝΑΙ απάντηση, όχι άρνηση — το Excel το δηλώνει ρητά', () => {
    expect(tableCellFormatForNumFmt('General')).toEqual({ kind: 'general' });
    expect(tableCellFormatForNumFmt('general')).toEqual({ kind: 'general' });
  });

  it('αναγνωρίζει την ενσωματωμένη ημερομηνία του Excel (`mm-dd-yy`)', () => {
    expect(tableCellFormatForNumFmt('mm-dd-yy')).toEqual({ kind: 'date', style: 'short' });
  });

  it('🔴 ΞΕΝΟ ISO χωρίς εισαγωγικά αναγνωρίζεται — η ΣΕΙΡΑ είναι η υπογραφή, όχι τα σημάδια', () => {
    // Γεννήθηκε από την πράσινη μετάλλαξη M33: η παλιά απαίτηση `pattern.includes('"-"')`
    // αναγνώριζε ISO **μόνο σε μοτίβα δικής μας γραφής**.
    expect(tableCellFormatForNumFmt('yyyy-mm-dd')).toEqual({ kind: 'date', style: 'iso' });
    expect(tableCellFormatForNumFmt('yy.m.d')).toEqual({ kind: 'date', style: 'iso' });
  });

  it('🔴 ΞΕΝΟΣ κωδικός νομίσματος με πεζά κανονικοποιείται — ISO 4217 είναι κεφαλαία', () => {
    // Γεννήθηκε από την πράσινη μετάλλαξη M35: τα δικά μας μοτίβα γράφουν ήδη κεφαλαία, οπότε
    // ο κύκλος δεν μπορούσε ποτέ να δει πεζά. Ένα ξένο αρχείο μπορεί.
    expect(tableCellFormatForNumFmt('[$eur]#,##0.00')).toMatchObject({ currency: 'EUR' });
  });
});
