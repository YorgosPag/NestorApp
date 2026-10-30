/**
 * ADR-195 (η) — URL αντικειμένου αποθήκευσης στο Ιστορικό: **κάθε** σχήμα, ένα αναγνωριστικό.
 *
 * 🔴 Μετρημένο ζωντανά (MACON ATEE, 29/10): το λογότυπο γράφτηκε ως same-origin `/api/storage/file/…` και το Ιστορικό
 * το έδειχνε ως ωμή διαδρομή, επειδή τρία σημεία ρωτούσαν `includes("firebasestorage.googleapis.com")` — ένα από τα
 * τέσσερα σχήματα. Τα σχήματα τα ξέρει ο ΕΝΑΣ αναγνώστης (`storageObjectFromUrl`).
 */

import { formatFieldAwareValue, formatStorageUrl, isStorageObjectUrl, type AuditValueFormat } from '../activity-tab-helpers';

const PHOTO = 'Φωτογραφία';

const MACON_LOGO =
  '/api/storage/file/companies/comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757/entities/quote/qt_0b2eb5a6-1196-4e14-84b8-2aed09cd5819/domains/sales/categories/documents/files/vlogo_qt_0b2eb5a6-1196-4e14-84b8-2aed09cd5819.png';
const FIREBASE =
  'https://firebasestorage.googleapis.com/v0/b/pagonis-87766.appspot.com/o/contacts%2Fphotos%2Ffile_f76a661d-8667-4199-8d8a-2a8cc7e9c37f.png?alt=media&token=abc';
const GCS_PUBLIC = 'https://storage.googleapis.com/pagonis-87766.appspot.com/contacts/logo_1a2b3c4d-1111-2222-3333-444455556666.jpg';

describe('isStorageObjectUrl — κάθε σχήμα URL αποθήκευσης', () => {
  it.each([MACON_LOGO, FIREBASE, GCS_PUBLIC])('αναγνωρίζει %s', (url) => {
    expect(isStorageObjectUrl(url)).toBe(true);
  });

  it.each(['Απόλλωνος 12', 'https://macon.gr', '', '/api/other/file.png'])('δεν μπερδεύει «%s»', (value) => {
    expect(isStorageObjectUrl(value)).toBe(false);
  });
});

describe('formatStorageUrl — σύντομο αναγνωριστικό από το όνομα αρχείου', () => {
  it('same-origin λογότυπο της MACON', () => {
    expect(formatStorageUrl(MACON_LOGO, PHOTO)).toBe('Φωτογραφία (0b2eb5a6.png)');
  });

  it('Firebase download URL (κωδικοποιημένο μονοπάτι + token)', () => {
    expect(formatStorageUrl(FIREBASE, PHOTO)).toBe('Φωτογραφία (f76a661d.png)');
  });

  it('δημόσιο GCS', () => {
    expect(formatStorageUrl(GCS_PUBLIC, PHOTO)).toBe('Φωτογραφία (1a2b3c4d.jpg)');
  });

  it('χωρίς UUID ⇒ μόνο η κατάληξη', () => {
    expect(formatStorageUrl('/api/storage/file/companies/c1/logo.webp', PHOTO)).toBe('Φωτογραφία (.webp)');
  });
});

describe('η τιμή του πεδίου στο Ιστορικό', () => {
  const format: AuditValueFormat = {
    word: (w) => (w === 'photo' ? PHOTO : w),
    catalogWord: () => undefined,
  };

  it('το λογότυπο της MACON δεν βγαίνει ως ωμή διαδρομή', () => {
    expect(formatFieldAwareValue('logoURL', MACON_LOGO, format)).toBe('Φωτογραφία (0b2eb5a6.png)');
  });
});
