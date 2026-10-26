/**
 * @fileoverview **Ο πυρήνας του γραφέα διαστάσεων και χρώματος** (ADR-899 §3.7 · ADR-923 §5.10.3) — χωρίς κάδο, χωρίς `sharp`.
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Π1: η εφεδρεία «ολόκληρο αρχείο» λείπει (JPEG με μεγάλο EXIF ⇒ ποτέ διαστάσεις) ή τρέχει πάντα (κατεβάζει 50 MB
 *   για κάθε φωτογραφία) ή αγνοεί το όριο μεγέθους.
 * - Π2: σφάλμα του αναγνώστη μεταδεδομένων ανεβαίνει (ένα κατεστραμμένο αρχείο ρίχνει τον trigger σε retry-loop).
 * - Π3: η εγγραφή γράφεται για **άλλο** αντικείμενο (συνοδευτικό με παρόμοιο όνομα) ή ξαναγράφεται με ίδια τιμή.
 * - Π4: ο προσανατολισμός χάνεται στη διαδρομή κεφαλίδα → διαστάσεις.
 * - Π5: το χρώμα διαβάζεται από **δεύτερη** ανάγνωση, ή η ετυμηγορία το αγνοεί (εγγραφή χωρίς χρώμα μένει για πάντα
 *   «already-recorded»), ή χρώμα που **δεν** μετρήθηκε σβήνει/ξαναγράφει ό,τι υπάρχει.
 */

import {
  IMAGE_HEADER_PROBE_BYTES,
  IMAGE_PROBE_MAX_BYTES,
  dimensionsRecordVerdict,
  imageDimensionsIn,
  imageFactsRecordUpdate,
  probeImageRaster,
  type ImageMetadataReader,
  type ImageRasterFacts,
  type RawImageMetadata,
  type StoredImageReader,
} from '../stored-image-dimensions';

const FULL_HEADER = new Uint8Array(IMAGE_HEADER_PROBE_BYTES);
const WHOLE = new Uint8Array(IMAGE_HEADER_PROBE_BYTES + 10);

const CMYK_METADATA: RawImageMetadata = {
  width: 4000,
  height: 3000,
  orientation: 6,
  space: 'cmyk',
  channels: 4,
  depth: 'uchar',
  density: 300,
  hasAlpha: false,
  hasProfile: true,
};

function reader(overrides: Partial<StoredImageReader> = {}): StoredImageReader & { readWhole: jest.Mock; readHeader: jest.Mock } {
  return {
    size: 5_000_000,
    readHeader: jest.fn(async () => FULL_HEADER),
    readWhole: jest.fn(async () => WHOLE),
    ...overrides,
  } as StoredImageReader & { readWhole: jest.Mock; readHeader: jest.Mock };
}

/** Αναγνώστης που «βλέπει» μεταδεδομένα μόνο στα bytes που του δίνουμε (όπως το CMYK με προφίλ 960 KB). */
function metadataOnlyIn(bytes: Uint8Array, metadata: RawImageMetadata = { width: 4000, height: 3000, orientation: 6 }): ImageMetadataReader {
  return async (input) => {
    if (input !== bytes) throw new Error('Premature end of JPEG');
    return metadata;
  };
}

describe('probeImageRaster', () => {
  it('🔴 Π4 κεφαλίδα αρκεί ⇒ διαστάσεις ΘΕΑΤΗ, καμία δεύτερη ανάγνωση', async () => {
    const object = reader();
    expect((await probeImageRaster(object, metadataOnlyIn(FULL_HEADER)))?.dimensions).toEqual({ width: 3000, height: 4000 });
    expect(object.readHeader).toHaveBeenCalledWith(IMAGE_HEADER_PROBE_BYTES);
    expect(object.readWhole).not.toHaveBeenCalled();
  });

  it('🔴 Π1 κεφαλίδα δεν αρκεί ⇒ ολόκληρο (μόνο τότε)', async () => {
    const object = reader();
    expect((await probeImageRaster(object, metadataOnlyIn(WHOLE)))?.dimensions).toEqual({ width: 3000, height: 4000 });
    expect(object.readWhole).toHaveBeenCalledTimes(1);
  });

  it('🔴 Π1 η κεφαλίδα ήταν όλο το αρχείο ⇒ καμία δεύτερη ανάγνωση', async () => {
    const short = new Uint8Array(100);
    const object = reader({ readHeader: jest.fn(async () => short) });
    expect(await probeImageRaster(object, metadataOnlyIn(WHOLE))).toBeNull();
    expect(object.readWhole).not.toHaveBeenCalled();
  });

  it('🔴 Π1 πάνω από το όριο ή άγνωστο μέγεθος ⇒ ΠΟΤΕ ολόκληρο', async () => {
    for (const size of [IMAGE_PROBE_MAX_BYTES + 1, null]) {
      const object = reader({ size });
      expect(await probeImageRaster(object, metadataOnlyIn(WHOLE))).toBeNull();
      expect(object.readWhole).not.toHaveBeenCalled();
    }
  });

  it('🔴 Π2 σφάλμα αναγνώστη / χαμένο αντικείμενο ⇒ null, ποτέ εξαίρεση', async () => {
    const broken: ImageMetadataReader = async () => {
      throw new Error('unsupported image format');
    };
    await expect(probeImageRaster(reader(), broken)).resolves.toBeNull();
    await expect(probeImageRaster(reader({ readHeader: jest.fn(async () => null) }), broken)).resolves.toBeNull();
    await expect(probeImageRaster(reader({ readWhole: jest.fn(async () => null) }), metadataOnlyIn(WHOLE))).resolves.toBeNull();
  });

  it('🔴 Π5 CMYK με προφίλ: η κεφαλίδα ΑΠΟΤΥΓΧΑΝΕΙ (μετρημένο) ⇒ ολόκληρο, και ΕΝΑ metadata δίνει διαστάσεις + χρώμα', async () => {
    const object = reader();
    const read = jest.fn(metadataOnlyIn(WHOLE, CMYK_METADATA));
    const facts = await probeImageRaster(object, read);
    expect(facts).toEqual({
      dimensions: { width: 3000, height: 4000 },
      colour: { model: 'cmyk', channels: 4, hasAlpha: false, bitsPerSample: 8, density: 300, profile: { name: null } },
    });
    // Κεφαλίδα + ολόκληρο — ΠΟΤΕ τρίτη ανάγνωση «για το χρώμα».
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('το `imageDimensionsIn` δίνει την ίδια απάντηση με τον πλήρη αναγνώστη', async () => {
    expect(await imageDimensionsIn(FULL_HEADER, metadataOnlyIn(FULL_HEADER, CMYK_METADATA))).toEqual({ width: 3000, height: 4000 });
  });
});

describe('dimensionsRecordVerdict', () => {
  const NAME = 'companies/c/entities/property/p/domains/d/categories/photos/files/file_a.jpg';
  const DIMENSIONS = { width: 1200, height: 1600 };
  const COLOUR = { model: 'rgb', channels: 3, hasAlpha: false, bitsPerSample: 8, density: 72, profile: { name: 'sRGB' } } as const;
  const MEASURED: ImageRasterFacts = { dimensions: DIMENSIONS, colour: COLOUR };
  const NO_COLOUR: ImageRasterFacts = { dimensions: DIMENSIONS, colour: null };

  it('🔴 Π3 μόνο η εγγραφή που δείχνει ΑΥΤΟ το αντικείμενο', () => {
    expect(dimensionsRecordVerdict({ storagePath: NAME }, NAME, MEASURED)).toBe('write');
    expect(dimensionsRecordVerdict({ storagePath: `${NAME}_thumb.png` }, NAME, MEASURED)).toBe('not-this-object');
    expect(dimensionsRecordVerdict({}, NAME, MEASURED)).toBe('not-this-object');
    expect(dimensionsRecordVerdict(null, NAME, MEASURED)).toBe('no-record');
  });

  it('🔴 Π3 ιδεμποτία: ίδια τιμή ⇒ καμία γραφή · διαφορετική ⇒ διόρθωση', () => {
    const recorded = { storagePath: NAME, imageDimensions: DIMENSIONS, imageColour: COLOUR };
    expect(dimensionsRecordVerdict(recorded, NAME, MEASURED)).toBe('already-recorded');
    expect(dimensionsRecordVerdict({ ...recorded, imageDimensions: { width: 1600, height: 1200 } }, NAME, MEASURED)).toBe('write');
    expect(dimensionsRecordVerdict({ ...recorded, imageDimensions: { width: 1200, height: 1700 } }, NAME, MEASURED)).toBe('write');
  });

  it('🔴 Π5 εγγραφή με διαστάσεις αλλά ΧΩΡΙΣ χρώμα (πριν τη 2γ) ⇒ write, όχι «already-recorded»', () => {
    expect(dimensionsRecordVerdict({ storagePath: NAME, imageDimensions: DIMENSIONS }, NAME, MEASURED)).toBe('write');
    const otherProfile = { ...COLOUR, profile: { name: 'Display P3' } };
    expect(dimensionsRecordVerdict({ storagePath: NAME, imageDimensions: DIMENSIONS, imageColour: otherProfile }, NAME, MEASURED)).toBe('write');
  });

  it('🔴 Π5 χρώμα που ΔΕΝ μετρήθηκε δεν «διαφωνεί» και δεν γράφεται', () => {
    expect(dimensionsRecordVerdict({ storagePath: NAME, imageDimensions: DIMENSIONS }, NAME, NO_COLOUR)).toBe('already-recorded');
    expect(imageFactsRecordUpdate(NO_COLOUR)).toEqual({ imageDimensions: DIMENSIONS });
    expect(imageFactsRecordUpdate(MEASURED)).toEqual({ imageDimensions: DIMENSIONS, imageColour: COLOUR });
  });
});
