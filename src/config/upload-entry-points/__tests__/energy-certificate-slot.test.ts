/**
 * ⚓ ADR-777 §8.96 — η εισαγωγή ΠΕΑ ανεβάζει με την ταυτότητα του ΚΑΤΑΛΟΓΟΥ: αν χαθεί η γραμμή, το κουμπί σβήνει.
 */

import { PROPERTY_DOSSIER_VIEW } from '../entries-property-dossier';
import { ENERGY_CERTIFICATE_ENTRY_ID, energyCertificateSlot } from '../energy-certificate-slot';

describe('energyCertificateSlot', () => {
  it('διαβάζεται από τη γραμμή `study-energy-certificate` του καταλόγου μελετών', () => {
    expect(energyCertificateSlot()).toEqual({ domain: 'construction', category: 'documents', purpose: 'study-energy-cert' });
  });

  it('🔴 ο φάκελος του ιδιώτη προσφέρει τον ΙΔΙΟ τύπο στα «Έγγραφα» — αλλιώς το αρχείο θα ζούσε σε θέση που η καρτέλα δεν διαβάζει', () => {
    expect(PROPERTY_DOSSIER_VIEW.documents.map((entry) => entry.id)).toContain(ENERGY_CERTIFICATE_ENTRY_ID);
  });
});
