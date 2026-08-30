/**
 * ADR-833 Φάση 3 — **το όνομα της καρτέλας**: πότε είναι δεδομένο χρήστη και πότε παρουσίαση.
 *
 * Η άγκυρα που μετράει είναι η **ζωντανή γλώσσα**. Ο καμβάς είναι imperative και δεν έχει
 * `useTranslation`· η απάντηση του module είναι «διάβασε το singleton **τη στιγμή της
 * κλήσης**». Ένα test που ρωτούσε μία φορά θα περνούσε το ίδιο και με τιμή **παγωμένη** σε
 * σταθερά module-level — δηλαδή θα ήταν σχόλιο. Γι' αυτό εδώ η «γλώσσα» αλλάζει **ανάμεσα σε
 * δύο κλήσεις** και ελέγχεται ότι η απάντηση την ακολούθησε.
 */

const translate = jest.fn();

jest.mock('@/i18n', () => ({
  i18n: { t: (...args: unknown[]) => translate(...args) },
}));

import { worksheetDisplayName } from '../table-worksheet-name';
import { tableWorksheetId } from '../../../types/table-worksheet';
import type { TableWorksheet } from '../../../types/table-worksheet';

const MODEL = { columns: [], rows: [], cells: [], merges: [] };

function sheet(name?: string): TableWorksheet {
  return name === undefined
    ? { id: tableWorksheetId('ws0'), model: MODEL }
    : { id: tableWorksheetId('ws0'), model: MODEL, name };
}

beforeEach(() => {
  translate.mockReset();
});

describe('ADR-833 Φ3 — απόν όνομα ⇒ η παρουσίαση αποφασίζει', () => {
  it('ρωτά το ΕΝΑ κλειδί, στο σωστό namespace, με αρίθμηση από το 1', () => {
    translate.mockReturnValue('Φύλλο3');
    expect(worksheetDisplayName(sheet(), 2)).toBe('Φύλλο3');
    expect(translate).toHaveBeenCalledWith('table.worksheet.defaultName', {
      ns: 'dxf-viewer-shell',
      index: 3,
    });
  });

  it('🔴 ΖΩΝΤΑΝΗ ΓΛΩΣΣΑ: η ίδια κλήση, μετά από αλλαγή γλώσσας, δίνει ΑΛΛΟ όνομα', () => {
    const anonymous = sheet();
    translate.mockReturnValue('Φύλλο1');
    expect(worksheetDisplayName(anonymous, 0)).toBe('Φύλλο1');
    // «Ο χρήστης άλλαξε γλώσσα.» Καμία επανακατασκευή, καμία ακύρωση μνήμης.
    translate.mockReturnValue('Sheet1');
    expect(worksheetDisplayName(anonymous, 0)).toBe('Sheet1');
  });

  it('όνομα από ΚΕΝΑ διαβάζεται ως απόν — μια καρτέλα χωρίς ετικέτα λέει ψέματα', () => {
    translate.mockReturnValue('Φύλλο1');
    expect(worksheetDisplayName(sheet('   '), 0)).toBe('Φύλλο1');
  });
});

describe('🔴 ADR-833 Φ3 — παρόν όνομα = ΔΕΔΟΜΕΝΟ ΧΡΗΣΤΗ', () => {
  it('ταξιδεύει αυτούσιο και ΔΕΝ ρωτά καθόλου τη μετάφραση', () => {
    expect(worksheetDisplayName(sheet('Κοστολόγηση'), 4)).toBe('Κοστολόγηση');
    expect(translate).not.toHaveBeenCalled();
  });

  it('🔴 ΔΕΝ αλλάζει όταν αλλάξει η γλώσσα — ποτέ', () => {
    const named = sheet('Κοστολόγηση');
    translate.mockReturnValue('Sheet5');
    expect(worksheetDisplayName(named, 4)).toBe('Κοστολόγηση');
    translate.mockReturnValue('Φύλλο5');
    expect(worksheetDisplayName(named, 4)).toBe('Κοστολόγηση');
    expect(translate).not.toHaveBeenCalled();
  });

  it('όνομα με περιθώρια καθαρίζεται, δεν απορρίπτεται', () => {
    expect(worksheetDisplayName(sheet('  Έσοδα  '), 0)).toBe('Έσοδα');
  });
});
