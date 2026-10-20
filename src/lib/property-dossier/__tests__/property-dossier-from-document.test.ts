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
    expect(propertyDossierFromDocument(STORED, 'pdos_document-id')).toEqual({ ...STORED, id: 'pdos_document-id', origin: null });
  });

  // ADR-916 Φ-Β — η προέλευση «από παράδοση πώλησης».
  const ORIGIN = {
    kind: 'handover', handoverId: 'phov_1', issuerCompanyId: 'comp_1', issuerName: 'Κατασκευαστική Α.Ε.',
    acceptedAt: '2026-10-19T10:00:00.000Z', handoverLifecycle: 'awaiting-completion',
  };

  it('φάκελος από παράδοση ⇒ η προέλευση διαβάζεται ολόκληρη (Φ-Β: χωρίς πρόοδο αντιγραφής ⇒ `null`)', () => {
    expect(propertyDossierFromDocument({ ...STORED, origin: ORIGIN }, 'pdos_x')?.origin)
      .toEqual({ ...ORIGIN, fileDelivery: null, appurtenanceOf: null });
  });

  it('Φ-Γ1 — η πρόοδος αντιγραφής και ο κύριος φάκελος παρακολουθήματος διαβάζονται· αλλοιωμένη πρόοδος ⇒ `null`', () => {
    const delivered = { ...ORIGIN, fileDelivery: { state: 'delivering', delivered: 3, total: 5 }, appurtenanceOf: 'pdos_main' };
    expect(propertyDossierFromDocument({ ...STORED, origin: delivered }, 'pdos_x')?.origin).toEqual(delivered);
    const corrupt = { ...ORIGIN, fileDelivery: { state: 'teleported', delivered: -1, total: 5 } };
    expect(propertyDossierFromDocument({ ...STORED, origin: corrupt }, 'pdos_x')?.origin?.fileDelivery).toBeNull();
  });

  it.each([
    ['άγνωστο είδος προέλευσης', { ...ORIGIN, kind: 'gift' }],
    ['άγνωστος κύκλος ζωής παράδοσης', { ...ORIGIN, handoverLifecycle: 'delivered-maybe' }],
    ['χωρίς εκδότη', { ...ORIGIN, issuerCompanyId: '' }],
  ])('%s ⇒ `origin: null` — ο φάκελος ΜΕΝΕΙ, χάνεται μόνο το σήμα', (_case, origin) => {
    const dossier = propertyDossierFromDocument({ ...STORED, origin }, 'pdos_x');
    expect(dossier).not.toBeNull();
    expect(dossier?.origin).toBeNull();
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
