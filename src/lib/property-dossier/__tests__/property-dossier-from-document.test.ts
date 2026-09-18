/**
 * @fileoverview 🏆 **ΑΓΚΥΡΑ Α36.7 του ADR-866 Φ1.1** — το σύνορο ανάγνωσης του φακέλου.
 * @related lib/property-dossier/property-dossier-from-document.ts · CHECK 3.74
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | `raw as PropertyDossier` (ισχυρισμός αντί ανάγνωσης) | «χωρίς κάτοχο ⇒ null» ⇒ 🔴 |
 * | ταυτότητα από το περιεχόμενο αντί από έξω | «η ταυτότητα του εγγράφου νικά» ⇒ 🔴 |
 * | άγνωστο είδος ⇒ `null` φάκελος | «άγνωστο είδος ⇒ type null, ο φάκελος μένει» ⇒ 🔴 |
 */

import { propertyDossierFromDocument } from '@/lib/property-dossier/property-dossier-from-document';

const STORED = {
  id: 'pdos_written-inside',
  userId: 'citizen-1',
  label: 'Διαμέρισμα',
  type: 'apartment',
  lifecycle: 'active',
  createdAt: '2026-09-18T10:00:00.000Z',
  updatedAt: '2026-09-18T10:00:00.000Z',
};

describe('🏆 Α36.7 — `propertyDossierFromDocument`', () => {
  it('πλήρες έγγραφο ⇒ φάκελος, με την ταυτότητα του ΕΓΓΡΑΦΟΥ (όχι του περιεχομένου)', () => {
    expect(propertyDossierFromDocument(STORED, 'pdos_document-id')).toEqual({ ...STORED, id: 'pdos_document-id' });
  });

  it.each([
    ['χωρίς κάτοχο', { ...STORED, userId: undefined }],
    ['κάτοχος στο λεξιλόγιο της αγγελίας (`authorUserId`)', { ...STORED, userId: undefined, authorUserId: 'citizen-1' }],
    ['κενό όνομα', { ...STORED, label: '  ' }],
    ['άγνωστος κύκλος ζωής', { ...STORED, lifecycle: 'transferred' }],
    ['χωρίς χρόνο γέννησης', { ...STORED, createdAt: undefined }],
  ])('%s ⇒ `null` («δεν είναι φάκελος»)', (_case, raw) => {
    expect(propertyDossierFromDocument(raw, 'pdos_x')).toBeNull();
  });

  it.each([[null], [undefined], ['text'], [[STORED]]])('μη αντικείμενο (%p) ⇒ `null`', (raw) => {
    expect(propertyDossierFromDocument(raw, 'pdos_x')).toBeNull();
  });

  it('άγνωστο είδος ⇒ `type: null` — ο φάκελος ΔΕΝ εξαφανίζεται επειδή άλλαξε ένας κατάλογος', () => {
    expect(propertyDossierFromDocument({ ...STORED, type: 'castle' }, 'pdos_x')).toEqual(
      expect.objectContaining({ type: null, label: 'Διαμέρισμα' }),
    );
  });
});
