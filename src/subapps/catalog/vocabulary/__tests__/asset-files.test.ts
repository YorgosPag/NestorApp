/**
 * @fileoverview **Είδος μέσου ↔ τύπος αρχείου** (ADR-923 §5.10.3) — η ΜΙΑ κρίση, πάνω στο μητρώο τύπων.
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Α1: το MIME αποφασίζει πάνω από την κατάληξη ⇒ ένα `.rfa` από browser (`application/octet-stream`) απορρίπτεται.
 * - Α2: κατάληξη και MIME διαφωνούν (PDF μετονομασμένο σε `.jpg`) και το αρχείο περνά.
 * - Α3: ένα είδος δέχεται κατηγορία άλλου (PDF ως φωτογραφία · εικόνα ως BIM).
 * - Α4: ρόλος χωρίς στόχο ανεβάσματος, ή στόχος εκτός τομέα `catalog`.
 */

import { FILE_DOMAINS } from '@/config/domain-constants';

import { assetAcceptAttribute, assetKindAcceptsFile, CATALOG_ASSET_UPLOAD_TARGET } from '../asset-files';
import { ASSET_ROLE_KINDS, CATALOG_ASSET_ROLES } from '../asset-roles';

describe('assetKindAcceptsFile', () => {
  it('🔴 Α1 η κατάληξη αποφασίζει όταν το MIME σωπαίνει (BIM από browser)', () => {
    for (const contentType of ['', 'application/octet-stream', undefined]) {
      expect(assetKindAcceptsFile('bim', { ext: 'rfa', contentType })).toBe('accepted');
      expect(assetKindAcceptsFile('bim', { ext: 'ifc', contentType })).toBe('accepted');
    }
    expect(assetKindAcceptsFile('bim', { ext: 'ifc', contentType: 'application/x-step' })).toBe('accepted');
  });

  it('🔴 Α2 κατάληξη και MIME σε ΔΙΑΦΟΡΕΤΙΚΗ κατηγορία ⇒ typeConflict', () => {
    expect(assetKindAcceptsFile('image', { ext: 'jpg', contentType: 'application/pdf' })).toBe('typeConflict');
    expect(assetKindAcceptsFile('document', { ext: 'pdf', contentType: 'image/jpeg' })).toBe('typeConflict');
    // Ίδια κατηγορία, άλλος υποτύπος (png δηλωμένο ως jpeg) — δεν είναι ψέμα για το ΕΙΔΟΣ.
    expect(assetKindAcceptsFile('image', { ext: 'png', contentType: 'image/jpeg' })).toBe('accepted');
  });

  it('🔴 Α3 κάθε είδος μόνο τη δική του κατηγορία', () => {
    expect(assetKindAcceptsFile('image', { ext: 'jpg', contentType: 'image/jpeg' })).toBe('accepted');
    expect(assetKindAcceptsFile('image', { ext: 'pdf', contentType: 'application/pdf' })).toBe('kindMismatch');
    expect(assetKindAcceptsFile('document', { ext: 'pdf', contentType: 'application/pdf' })).toBe('accepted');
    expect(assetKindAcceptsFile('document', { ext: 'docx', contentType: '' })).toBe('kindMismatch');
    expect(assetKindAcceptsFile('bim', { ext: 'jpg', contentType: 'image/jpeg' })).toBe('kindMismatch');
    expect(assetKindAcceptsFile('video', { ext: 'mp4', contentType: 'video/mp4' })).toBe('accepted');
    expect(assetKindAcceptsFile('video', { ext: 'mov', contentType: 'video/quicktime' })).toBe('accepted');
    expect(assetKindAcceptsFile('image', { ext: 'exe', contentType: '' })).toBe('kindMismatch');
    expect(assetKindAcceptsFile('image', {})).toBe('kindMismatch');
  });

  it('το MIME με παραμέτρους/κεφαλαία διαβάζεται ως MIME', () => {
    expect(assetKindAcceptsFile('image', { ext: 'jpg', contentType: 'image/JPEG; charset=binary' })).toBe('accepted');
  });
});

describe('CATALOG_ASSET_UPLOAD_TARGET', () => {
  it('🔴 Α4 κάθε ρόλος ανεβαίνει στον τομέα `catalog`', () => {
    for (const role of CATALOG_ASSET_ROLES) {
      expect(CATALOG_ASSET_UPLOAD_TARGET[role].domain).toBe(FILE_DOMAINS.CATALOG);
      expect(ASSET_ROLE_KINDS[role].length).toBeGreaterThan(0);
    }
  });
});

// ADR-923 §5.10.4 — ο επιλογέας προτείνει ακριβώς ό,τι θα δεχτεί η κρίση.
describe('assetAcceptAttribute', () => {
  it('παράγεται από το μητρώο: TIFF, IFC/RFA, video/*, PDF — όχι ό,τι δεν δέχεται κανένα είδος', () => {
    const accept = assetAcceptAttribute(['image', 'document', 'bim', 'video']).split(',');
    expect(accept).toEqual(expect.arrayContaining(['.jpg', '.tif', '.tiff', '.pdf', '.ifc', '.rfa', 'video/*']));
    expect(accept).not.toContain('.zip');
    expect(assetAcceptAttribute(['document'])).toBe('.pdf');
  });
});
