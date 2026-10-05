/**
 * Άγκυρα — κατάλογοι τιμών ιστορικού δηλωμένοι **ανά οντότητα** (ADR-195 · ADR-852).
 *
 * Το `status` ως όνομα πεδίου το κρατά ο κατάλογος του έργου. Το ακίνητο έχει άλλο λεξιλόγιο, άρα
 * χωρίς δήλωση στον περιγραφέα του η γραμμή έγραφε «Κατάσταση: — → unavailable» (ζωντανό εύρημα
 * 2026-10-05). Το test κρατά το δέσιμο και τη λέξη· την ισοτιμία el/en την κρατά η πύλη 3.14.
 */

import { AUDIT_VALUE_CATALOGS } from '@/config/audit-value-catalogs';
import { PROPERTY_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import el from '@/i18n/locales/el/properties-enums.json';
import en from '@/i18n/locales/en/properties-enums.json';

describe('κατάλογος τιμών του `status` του ακινήτου', () => {
  it('ο περιγραφέας δείχνει στη ΜΙΑ εγγραφή του μητρώου, όχι σε δικό του {ns, path}', () => {
    expect(AUDIT_VALUE_CATALOGS.propertyStatus).toEqual({ ns: 'properties-enums', path: 'status' });
    expect(PROPERTY_TRACKED_FIELDS.status.enumCatalog).toBe(AUDIT_VALUE_CATALOGS.propertyStatus);
  });

  it('το `status` ανά όνομα πεδίου μένει του έργου — το ακίνητο δεν το αντικαθιστά', () => {
    expect(AUDIT_VALUE_CATALOGS.status).toEqual({ ns: 'projects', path: 'status' });
  });

  it.each([
    ['el', el.status],
    ['en', en.status],
  ])('%s: η τιμή με την οποία γεννιέται ένα ακίνητο έχει λέξη', (_locale, catalog) => {
    expect(catalog.unavailable.trim()).not.toBe('');
  });

  it('η δήλωση δεν χαλά την ετικέτα του πεδίου', () => {
    expect(PROPERTY_TRACKED_FIELDS.status.label).toBe('status');
  });
});
