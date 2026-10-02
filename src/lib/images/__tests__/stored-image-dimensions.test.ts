/**
 * @fileoverview **Ο πυρήνας του γραφέα διαστάσεων** (ADR-899 §3.7) — χωρίς κάδο, χωρίς `sharp`.
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Π1: η εφεδρεία «ολόκληρο αρχείο» λείπει (JPEG με μεγάλο EXIF ⇒ ποτέ διαστάσεις) ή τρέχει πάντα (κατεβάζει 50 MB
 *   για κάθε φωτογραφία) ή αγνοεί το όριο μεγέθους.
 * - Π2: σφάλμα του αναγνώστη μεταδεδομένων ανεβαίνει (ένα κατεστραμμένο αρχείο ρίχνει τον trigger σε retry-loop).
 * - Π3: η εγγραφή γράφεται για **άλλο** αντικείμενο (συνοδευτικό με παρόμοιο όνομα) ή ξαναγράφεται με ίδια τιμή.
 * - Π4: ο προσανατολισμός χάνεται στη διαδρομή κεφαλίδα → διαστάσεις.
 */

import {
  IMAGE_HEADER_PROBE_BYTES,
  IMAGE_PROBE_MAX_BYTES,
  dimensionsRecordVerdict,
  probeImageDimensions,
  type ImageMetadataReader,
  type StoredImageReader,
} from '../stored-image-dimensions';

const FULL_HEADER = new Uint8Array(IMAGE_HEADER_PROBE_BYTES);
const WHOLE = new Uint8Array(IMAGE_HEADER_PROBE_BYTES + 10);

function reader(overrides: Partial<StoredImageReader> = {}): StoredImageReader & { readWhole: jest.Mock; readHeader: jest.Mock } {
  return {
    size: 5_000_000,
    readHeader: jest.fn(async () => FULL_HEADER),
    readWhole: jest.fn(async () => WHOLE),
    ...overrides,
  } as StoredImageReader & { readWhole: jest.Mock; readHeader: jest.Mock };
}

/** Αναγνώστης που «βλέπει» διαστάσεις μόνο στα bytes που του δίνουμε. */
function metadataOnlyIn(bytes: Uint8Array, metadata = { width: 4000, height: 3000, orientation: 6 }): ImageMetadataReader {
  return async (input) => {
    if (input !== bytes) throw new Error('Premature end of JPEG');
    return metadata;
  };
}

describe('probeImageDimensions', () => {
  it('🔴 Π4 κεφαλίδα αρκεί ⇒ διαστάσεις ΘΕΑΤΗ, καμία δεύτερη ανάγνωση', async () => {
    const object = reader();
    expect(await probeImageDimensions(object, metadataOnlyIn(FULL_HEADER))).toEqual({ width: 3000, height: 4000 });
    expect(object.readHeader).toHaveBeenCalledWith(IMAGE_HEADER_PROBE_BYTES);
    expect(object.readWhole).not.toHaveBeenCalled();
  });

  it('🔴 Π1 κεφαλίδα δεν αρκεί ⇒ ολόκληρο (μόνο τότε)', async () => {
    const object = reader();
    expect(await probeImageDimensions(object, metadataOnlyIn(WHOLE))).toEqual({ width: 3000, height: 4000 });
    expect(object.readWhole).toHaveBeenCalledTimes(1);
  });

  it('🔴 Π1 η κεφαλίδα ήταν όλο το αρχείο ⇒ καμία δεύτερη ανάγνωση', async () => {
    const short = new Uint8Array(100);
    const object = reader({ readHeader: jest.fn(async () => short) });
    expect(await probeImageDimensions(object, metadataOnlyIn(WHOLE))).toBeNull();
    expect(object.readWhole).not.toHaveBeenCalled();
  });

  it('🔴 Π1 πάνω από το όριο ή άγνωστο μέγεθος ⇒ ΠΟΤΕ ολόκληρο', async () => {
    for (const size of [IMAGE_PROBE_MAX_BYTES + 1, null]) {
      const object = reader({ size });
      expect(await probeImageDimensions(object, metadataOnlyIn(WHOLE))).toBeNull();
      expect(object.readWhole).not.toHaveBeenCalled();
    }
  });

  it('🔴 Π2 σφάλμα αναγνώστη / χαμένο αντικείμενο ⇒ null, ποτέ εξαίρεση', async () => {
    const broken: ImageMetadataReader = async () => {
      throw new Error('unsupported image format');
    };
    await expect(probeImageDimensions(reader(), broken)).resolves.toBeNull();
    await expect(probeImageDimensions(reader({ readHeader: jest.fn(async () => null) }), broken)).resolves.toBeNull();
    await expect(
      probeImageDimensions(reader({ readWhole: jest.fn(async () => null) }), metadataOnlyIn(WHOLE)),
    ).resolves.toBeNull();
  });
});

describe('dimensionsRecordVerdict', () => {
  const NAME = 'companies/c/entities/property/p/domains/d/categories/photos/files/file_a.jpg';
  const MEASURED = { width: 1200, height: 1600 };

  it('🔴 Π3 μόνο η εγγραφή που δείχνει ΑΥΤΟ το αντικείμενο', () => {
    expect(dimensionsRecordVerdict({ storagePath: NAME }, NAME, MEASURED)).toBe('write');
    expect(dimensionsRecordVerdict({ storagePath: `${NAME}_thumb.png` }, NAME, MEASURED)).toBe('not-this-object');
    expect(dimensionsRecordVerdict({}, NAME, MEASURED)).toBe('not-this-object');
    expect(dimensionsRecordVerdict(null, NAME, MEASURED)).toBe('no-record');
  });

  it('🔴 Π3 ιδεμποτία: ίδια τιμή ⇒ καμία γραφή · διαφορετική ⇒ διόρθωση', () => {
    expect(dimensionsRecordVerdict({ storagePath: NAME, imageDimensions: MEASURED }, NAME, MEASURED)).toBe('already-recorded');
    expect(dimensionsRecordVerdict({ storagePath: NAME, imageDimensions: { width: 1600, height: 1200 } }, NAME, MEASURED)).toBe('write');
    expect(dimensionsRecordVerdict({ storagePath: NAME, imageDimensions: { width: 1200, height: 1700 } }, NAME, MEASURED)).toBe('write');
  });
});
