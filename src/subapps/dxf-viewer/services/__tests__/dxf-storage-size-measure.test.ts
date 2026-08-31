/**
 * Άγκυρα για τη ΜΕΤΡΗΣΗ ΜΕΓΕΘΟΥΣ της διαδρομής αποθήκευσης — ADR-833 Φάση 5Α.
 *
 * Η ερώτηση: **«το όριο των 25 MB επιβάλλεται πάνω στα bytes που όντως ανεβαίνουν;»**
 *
 * 🔴 Μέχρι τις 2026-08-31 η απάντηση ήταν **όχι**. Το `validateForSaveImpl` μετρούσε με
 * `JSON.stringify(scene).length` — **μονάδες UTF-16** — ενώ το ίδιο αρχείο κωδικοποιούσε
 * τα πραγματικά bytes για το ανέβασμα λίγες γραμμές πιο κάτω. Στα ελληνικά η απόκλιση
 * είναι ×1,45 και **πάντα προς τα κάτω**: το όριο δεν μπλόκαρε ποτέ όταν έπρεπε.
 *
 * Δεν υπήρχε **καμία** άγκυρα σε αυτή τη συνάρτηση, και είναι το **μόνο** σημείο που
 * επιβάλλει το ταβάνι της σκηνής.
 *
 * @see lib/serialized-size — η μία αρχή του «πόσα bytes UTF-8»
 * @see bim/table/table-document-cost — ο καταναλωτής του ίδιου ταβανιού από την πλευρά του πίνακα
 */

jest.mock('../../../../lib/firebase', () => ({ storage: {} }));
jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
  getBytes: jest.fn(),
}));
jest.mock('@/services/firestore/firestore-query.service', () => ({
  firestoreQueryService: { getById: jest.fn() },
}));
jest.mock('@/services/cad-file-mutation-gateway', () => ({ upsertCadFileWithPolicy: jest.fn() }));
jest.mock('@/services/enterprise-id.service', () => ({ generateFileId: () => 'file_anchor' }));

import { validateForSaveImpl } from '../dxf-firestore-storage.impl';
import { DxfSecurityValidator, ENTERPRISE_LIMITS } from '../../security/DxfSecurityValidator';
import type { SceneModel } from '../../types/scene';

/**
 * Το μέγεθος **όπως δόθηκε στον επικυρωτή** — εκεί ακριβώς ζει η απόφαση.
 *
 * Ο ίδιος ο επικυρωτής δεν επιστρέφει το νούμερο όταν η σκηνή είναι έγκυρη (το γράφει
 * μόνο στο μήνυμα αποτυχίας), οπότε η άγκυρα το διαβάζει στην **παράμετρο**. Η
 * εναλλακτική θα ήταν σκηνή 25 MB μέσα σε test — δηλαδή να χτιστεί το πρόβλημα αντί να
 * παρατηρηθεί η μέτρηση.
 */
function measuredSizeOf(scene: SceneModel, precomputed?: number): Promise<number> {
  const spy = jest.spyOn(DxfSecurityValidator, 'validateDxfUpload');
  return validateForSaveImpl('κάτοψη.dxf', scene, precomputed).then(() => {
    const size = spy.mock.calls[0][0].fileSize;
    spy.mockRestore();
    return size;
  });
}

/** Ελάχιστη σκηνή με **ελληνικό** περιεχόμενο — εκεί ακριβώς όπου το `.length` έλεγε ψέματα. */
function sceneWithLabel(label: string): SceneModel {
  return {
    entities: [{ id: 'ent_1', type: 'text', layerId: 'lyr_a', text: label }],
    layersById: {},
    bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
    units: 'mm',
  } as unknown as SceneModel;
}

describe('🔴 Η ΜΕΤΡΗΣΗ ΠΟΥ ΕΠΙΒΑΛΛΕΙ ΤΟ ΤΑΒΑΝΙ', () => {
  it('μετρά ΤΑ ΙΔΙΑ bytes που κωδικοποιεί το ανέβασμα — όχι μονάδες UTF-16', async () => {
    const scene = sceneWithLabel('Υποστύλωμα Κ12 — οπλισμός 4Ø20');
    const asUploaded = new TextEncoder().encode(JSON.stringify(scene, null, 0)).length;
    const asUtf16 = JSON.stringify(scene, null, 0).length;

    // Η προϋπόθεση της άγκυρας: οι δύο μετρήσεις ΔΙΑΦΕΡΟΥΝ σε αυτό το δείγμα. Χωρίς
    // αυτόν τον έλεγχο η άγκυρα θα ήταν πράσινη επειδή δεν ρώτησε τίποτα.
    expect(asUploaded).toBeGreaterThan(asUtf16);

    expect(await measuredSizeOf(scene)).toBe(asUploaded);
    expect(await measuredSizeOf(scene)).not.toBe(asUtf16);
  });

  it('όταν ο καλών έχει ΗΔΗ κωδικοποιήσει, χρησιμοποιείται το δικό του νούμερο', async () => {
    // Η διαδρομή που όντως τρέχει στο `saveToStorageImpl`: τα bytes κωδικοποιούνται μία
    // φορά για το ανέβασμα και δίνονται εδώ, ώστε να μη γίνει δεύτερο `stringify` ~950 KB.
    expect(await measuredSizeOf(sceneWithLabel('Δοκός'), 4242)).toBe(4242);
  });

  it('σκηνή πάνω από το ταβάνι ΑΠΟΡΡΙΠΤΕΤΑΙ — το όριο είναι ζωντανό, όχι διακοσμητικό', async () => {
    const oversize = ENTERPRISE_LIMITS.MAX_FILE_SIZE_BYTES + 1;
    const result = await validateForSaveImpl('τεράστιο.dxf', sceneWithLabel('x'), oversize);
    expect(result.isValid).toBe(false);
  });

  it('σκηνή ΑΚΡΙΒΩΣ στο ταβάνι γίνεται δεκτή', async () => {
    const result = await validateForSaveImpl(
      'οριακό.dxf',
      sceneWithLabel('x'),
      ENTERPRISE_LIMITS.MAX_FILE_SIZE_BYTES,
    );
    expect(result.isValid).toBe(true);
  });
});
