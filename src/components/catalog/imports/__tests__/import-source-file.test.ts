/**
 * Οι καθαροί βοηθοί της οθόνης εισαγωγής (ADR-923 §5.5.1): είδος αρχείου, πρώτη πρόταση στηλών, ποιες σελίδες μένουν.
 */

import { ANY_SLOT } from '@/subapps/catalog/types/product';
import { IGNORE_ROLE, proposeColumns, roleOfTarget, sourceKindOf, targetOfRole } from '../import-source-file';
import { pagesToRead } from '../use-import-batch';

jest.mock('@/services/catalog/catalog-import-api.client', () => ({}));

describe('είδος αρχείου', () => {
  it.each([
    ['κατάλογος.PDF', 'pdf'],
    ['τιμές.xlsx', 'spreadsheet'],
    ['τιμές.csv', 'delimited'],
    ['τιμές.txt', 'delimited'],
    ['παλιό.xls', null],
  ])('%s → %s', (name, kind) => {
    expect(sourceKindOf(name)).toBe(kind);
  });
});

describe('πρώτη πρόταση στηλών', () => {
  const attributes = [{ id: 'cattr_1', label: 'Ψυκτική ισχύς' }];

  it('ιδιότητες: η ετικέτα του αρχείου ταιριάζει την ετικέτα της ιδιότητας, ό,τι άγνωστο μένει αγνοημένο', () => {
    const columns = proposeColumns({ headers: ['Μοντέλο', 'Ψυκτική ισχύς (kW)', 'Σχόλια'], rows: [] }, 'attributes', attributes);
    expect(columns.map((column) => column.target)).toEqual([
      { kind: 'modelCode' },
      { kind: 'attribute', attributeId: 'cattr_1', channel: ANY_SLOT, locale: ANY_SLOT },
      null,
    ]);
  });

  it('τιμές: κωδικός και τιμή από τις λέξεις του ελληνικού τιμοκαταλόγου', () => {
    const columns = proposeColumns({ headers: ['Κωδικός είδους', 'Τιμή (€)', 'Μονάδα'], rows: [] }, 'priceLines', []);
    expect(columns.map((column) => column.target)).toEqual([{ kind: 'skuIdentifier' }, { kind: 'price', field: 'netPrice' }, { kind: 'price', field: 'unitCode' }]);
  });

  it('χωρίς επικεφαλίδα: μία στήλη ανά θέση, όλες αγνοημένες ώσπου να διαλέξει ο άνθρωπος', () => {
    const columns = proposeColumns({ headers: [], rows: [['a', 'b']] }, 'attributes', attributes);
    expect(columns).toEqual([
      { header: '', position: 0, target: null, unitCode: null },
      { header: '', position: 1, target: null, unitCode: null },
    ]);
  });

  it.each(['modelCode', 'skuIdentifier', 'attribute:cattr_1', 'price:netPrice', IGNORE_ROLE])('ο ρόλος %s επιστρέφει ίδιος', (role) => {
    expect(roleOfTarget(targetOfRole(role))).toBe(role);
  });
});

describe('ποιες σελίδες μένουν', () => {
  const pages = { from: 60, to: 63, done: [60], failed: [62] };

  it('η αποτυχημένη δεν ξαναπληρώνεται χωρίς ρητή εντολή', () => {
    expect(pagesToRead(pages, false)).toEqual([61, 63]);
  });

  it('η ρητή επανάληψη την ξαναδιαβάζει, ποτέ όμως τη διαβασμένη', () => {
    expect(pagesToRead(pages, true)).toEqual([61, 62, 63]);
  });
});
