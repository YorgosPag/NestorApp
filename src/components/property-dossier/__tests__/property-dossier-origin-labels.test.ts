/**
 * @fileoverview 🔴 ΑΓΚΥΡΑ Ο22 — **ΚΑΘΕ ΚΑΤΑΣΤΑΣΗ ΠΑΡΑΔΟΣΗΣ ΕΧΕΙ ΛΟΓΙΑ ΣΤΟΝ ΦΑΚΕΛΟ ΤΟΥ ΑΓΟΡΑΣΤΗ** — σε ΔΥΟ γλώσσες.
 * @related ADR-916 §8 Ο22 · `property-dossier-origin-labels.ts` · `test-utils/real-i18n` · N.11
 *
 * 🔴 **Γιατί γεννήθηκε**: η Φ-Δ.5 πρόσθεσε την `withdrawn` στο `PROPERTY_HANDOVER_LIFECYCLES` και στους πίνακες κλειδιών,
 * όχι στα locale. Ο τύπος ήταν ικανοποιημένος (ο πίνακας ήταν πλήρης) και η γκαλερί πράσινη (το mock του `t()` επιστρέφει το
 * κλειδί) — ο αγοραστής ανακλημένης παράδοσης θα έβλεπε `property-market:dossier.origin.lifecycle.withdrawn` **ωμό**.
 * Οι **πραγματικοί** loaders και το **πραγματικό** `exists` κλείνουν την άλλη άκρη, για **κάθε** επόμενη κατάσταση.
 */

import { createRealI18n } from '@/test-utils/real-i18n';
import { PROPERTY_HANDOVER_LIFECYCLES } from '@/types/property-handover';

import { DOSSIER_ORIGIN_EXPLAIN_KEY, DOSSIER_ORIGIN_LIFECYCLE_KEY } from '../property-dossier-origin-labels';

const TABLES = [
  ['σήμα', DOSSIER_ORIGIN_LIFECYCLE_KEY],
  ['εξήγηση', DOSSIER_ORIGIN_EXPLAIN_KEY],
] as const;

describe.each(['el', 'en'])('Ο22 — λόγια προέλευσης φακέλου (%s)', (lng) => {
  it.each(TABLES)('%s: κάθε κατάσταση παράδοσης έχει πραγματικό κείμενο', async (_name, table) => {
    const i18n = await createRealI18n(['property-market'], lng);
    const gaps = PROPERTY_HANDOVER_LIFECYCLES.filter((lifecycle) => {
      const key = table[lifecycle];
      const words = i18n.t(key);
      return !i18n.exists(key) || typeof words !== 'string' || words.trim() === '' || words === key;
    });
    expect(gaps).toEqual([]);
  });
});
