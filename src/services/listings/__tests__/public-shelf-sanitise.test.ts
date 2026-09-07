/**
 * @jest-environment node
 *
 * @fileoverview **Η ΑΓΚΥΡΑ ΤΟΥ ΚΑΘΑΡΙΣΤΗ** — το GPS δεν φεύγει ποτέ στον κόσμο (ADR-841 §7 Α12.7).
 * @related ADR-841 §7 Α12.5 · Α12.7 · Α5 (`locationDisclosure`) · public-shelf-sanitise.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΑΥΤΗ Η ΣΟΥΙΤΑ ΔΕΝ ΕΛΕΓΧΕΙ ΜΟΡΦΟΠΟΙΗΣΗ — ΕΛΕΓΧΕΙ ΤΗΝ Α5
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κάτοχος που δηλώνει `locationDisclosure: 'declined'` λέει *«δεν θέλω να ξέρουν πού
 * είναι το σπίτι μου»*. Μια φωτογραφία κινητού δημοσιευμένη **ωμή** το λέει με ακρίβεια
 * μέτρων — δηλαδή **η πλατφόρμα αποκαλύπτει ό,τι ο άνθρωπος αρνήθηκε**. Δεν είναι
 * θεωρητικό: υπάρχουν καταγεγραμμένες διαρρήξεις σε ακίνητα εντοπισμένα έτσι.
 *
 * ⚠️ **Η εικόνα-δείγμα κατασκευάζεται ΜΕ ΑΛΗΘΙΝΕΣ ΣΥΝΤΕΤΑΓΜΕΝΕΣ και επαληθεύεται ότι
 * τις έχει ΠΡΙΝ τον καθαρισμό.** Χωρίς αυτό το πρώτο βήμα, μια σουίτα που «δεν βρίσκει
 * GPS στην έξοδο» θα ήταν **πράσινη επειδή κανείς δεν κοίταξε** — το ακριβές σχήμα που
 * το CLAUDE.md ονομάζει σε τέσσερις διαφορετικές πύλες.
 *
 * ⚠️ **`@jest-environment node` ΥΠΟΧΡΕΩΤΙΚΟ, και το βρήκε η εκτέλεση**: στο προεπιλεγμένο
 * jsdom το `exifr.parse(Buffer)` πετά **`Invalid input argument`** — ο έλεγχος τύπου του
 * βλέπει `Uint8Array` **άλλου realm** και δεν το αναγνωρίζει. Χωρίς τη γραμμή αυτή η
 * σουίτα δεν θα ήταν λάθος· θα ήταν **ανίκανη να ρωτήσει**.
 */

import exifr from 'exifr';
import sharp from 'sharp';

import {
  ShelfSanitiseError,
  sanitiseImageVariants,
} from '../public-shelf-sanitise';
import {
  LISTING_SHELF,
  PUBLIC_SHELF_KINDS,
  SHOWCASE_SHELF,
  type ShelfEncoding,
} from '@/services/upload/utils/public-shelf-kinds';

/** Το κανονικό (μεγαλύτερο) πλάτος της γκαλερί — ό,τι ήταν το `PUBLIC_SHELF_MAX_EDGE_PX`. */
const LISTING_MAX_EDGE_PX = Math.max(...LISTING_SHELF.encoding.widths);

/** Ακρόπολη — αναγνωρίσιμες συντεταγμένες, ώστε η αποτυχία να είναι ευανάγνωστη. */
const LAT_DMS = '37/1 58/1 3000/100';
const LON_DMS = '23/1 43/1 2000/100';

/** Μια φωτογραφία σαν αυτές που ανεβάζει άνθρωπος: EXIF, GPS, ενσωματωμένη ταυτότητα. */
async function photoWithGps(width = 120, height = 90): Promise<Buffer> {
  const plain = await sharp({
    create: { width, height, channels: 3, background: { r: 12, g: 130, b: 210 } },
  })
    .jpeg()
    .toBuffer();

  return sharp(plain)
    .withExif({
      IFD0: { Make: 'NestorTestCamera', Model: 'IdiotikiSyskeui-1' },
      IFD3: {
        GPSLatitudeRef: 'N',
        GPSLatitude: LAT_DMS,
        GPSLongitudeRef: 'E',
        GPSLongitude: LON_DMS,
      },
    })
    .jpeg()
    .toBuffer();
}

describe('Κ0 — ΤΟ ΔΕΙΓΜΑ ΟΝΤΩΣ ΚΟΥΒΑΛΑΕΙ ΑΥΤΟ ΠΟΥ ΨΑΧΝΟΥΜΕ', () => {
  it('η ωμή φωτογραφία έχει GPS ΚΑΙ ταυτότητα συσκευής πριν τον καθαρισμό', async () => {
    const raw = await photoWithGps();
    const before = await exifr.parse(raw, true);

    // Πραγματικές συντεταγμένες, λυμένες σε δεκαδικές μοίρες — όχι απλώς «κάποιο πεδίο».
    expect(before?.latitude).toBeCloseTo(37.975, 3);
    expect(before?.longitude).toBeCloseTo(23.7222, 3);
    expect(before?.GPSLatitudeRef).toBe('N');
    expect(before?.Make).toBe('NestorTestCamera');

    // Και υπάρχει πραγματικό EXIF block, όχι απλώς πεδία που φαντάστηκε ο parser.
    expect((await sharp(raw).metadata()).exif?.length).toBeGreaterThan(0);
  });
});

/**
 * **Το ΚΑΝΟΝΙΚΟ παράγωγο** — το μεγαλύτερο, αυτό που γίνεται ο στόχος του `src`.
 *
 * 🔴 **Η σουίτα δείχνει στη ΖΩΝΤΑΝΗ είσοδο, όχι σε δίδυμο** (2026-09-01): μέχρι σήμερα
 * καλούσε έναν καθαριστή **μονού πλάτους** που, μετά τη Φ3, **δεν τον καλούσε κανείς
 * στην παραγωγή** — δηλαδή οι άγκυρες του EXIF θα φύλαγαν κώδικα που δεν τρέχει.
 * Ο μονός καθαριστής **διαγράφηκε**· εδώ ρωτιέται ο πραγματικός.
 */
async function sanitiseCanonical(
  input: Buffer,
  encoding: ShelfEncoding = LISTING_SHELF.encoding,
) {
  const variants = await sanitiseImageVariants(input, encoding);
  return variants[variants.length - 1];
}

describe('Κ1 — ο καθαριστής αφαιρεί ΚΑΘΕ μεταδεδομένο, όχι μόνο το GPS', () => {
  it('η έξοδος δεν έχει ΚΑΝΕΝΑ EXIF block', async () => {
    const clean = await sanitiseCanonical(await photoWithGps());

    // 🔑 Ισχυρότερο από «δεν βρήκα GPS»: δεν υπάρχει ΠΟΥ να κρυφτεί GPS.
    expect((await sharp(clean.bytes).metadata()).exif).toBeUndefined();
  });

  it('το GPS και η ταυτότητα της συσκευής ΕΞΑΦΑΝΙΖΟΝΤΑΙ', async () => {
    const clean = await sanitiseCanonical(await photoWithGps());

    // 🔑 **Η ΙΣΧΥΡΟΤΕΡΗ ΔΥΝΑΤΗ ΑΠΟΔΕΙΞΗ, και είναι η εξαίρεση**: το `exifr` πετά
    //    «Unknown file format» επειδή στο καθαρό WebP δεν υπάρχει **κανένα δοχείο**
    //    μεταδεδομένων να ανοίξει — όχι «άδειο GPS», αλλά **πουθενά να μπει GPS**.
    //    Μετρημένο: στην ωμή είσοδο το ίδιο `exifr.parse` λύνει 37.975 / 23.722 (Κ0).
    const readBack = await exifr.parse(clean.bytes, true).then(
      (parsed: unknown) => ({ ok: true as const, parsed }),
      (error: Error) => ({ ok: false as const, message: error.message }),
    );

    if (readBack.ok) {
      const after = readBack.parsed as Record<string, unknown> | undefined;
      expect(after?.GPSLatitude).toBeUndefined();
      expect(after?.GPSLongitude).toBeUndefined();
      expect(after?.latitude).toBeUndefined();
      expect(after?.Make).toBeUndefined();
      expect(after?.Model).toBeUndefined();
    } else {
      expect(readBack.message).toMatch(/Unknown file format/i);
    }
  });

  it('ούτε ως ωμά bytes δεν επιβιώνει η υπογραφή της συσκευής', async () => {
    const clean = await sanitiseCanonical(await photoWithGps());
    expect(clean.bytes.includes(Buffer.from('NestorTestCamera'))).toBe(false);
  });
});

describe('Κ2 — ο καθαρισμός δεν ΚΑΤΑΣΤΡΕΦΕΙ αυτό που προστατεύει', () => {
  it('παράγει WebP με δηλωμένο τύπο και πραγματικές διαστάσεις', async () => {
    const clean = await sanitiseCanonical(await photoWithGps(120, 90));

    expect(clean.ext).toBe('webp');
    expect(clean.contentType).toBe('image/webp');
    expect(clean.width).toBe(120);
    expect(clean.height).toBe(90);
    expect((await sharp(clean.bytes).metadata()).format).toBe('webp');
  });

  it('φράσσει τη ΜΕΓΑΛΗ πλευρά χωρίς να μεγεθύνει τη μικρή', async () => {
    const wide = await sanitiseCanonical(
      await sharp({
        create: {
          width: LISTING_MAX_EDGE_PX + 800,
          height: 400,
          channels: 3,
          background: { r: 1, g: 2, b: 3 },
        },
      })
        .jpeg()
        .toBuffer(),
    );

    expect(wide.width).toBe(LISTING_MAX_EDGE_PX);
    expect(wide.height).toBeLessThan(400);
  });

  it('🔑 ΕΦΑΡΜΟΖΕΙ τον προσανατολισμό EXIF πριν τον πετάξει', async () => {
    // Χωρίς `.rotate()`, η αφαίρεση του EXIF θα άφηνε τη φωτογραφία ΓΥΡΙΣΜΕΝΗ ΣΤΟ
    // ΠΛΑΪ — ο καθαρισμός θα κατέστρεφε ό,τι υποτίθεται ότι προστατεύει.
    // Orientation 6 = «γύρισέ τη 90°» ⇒ 100×50 πρέπει να βγει 50×100.
    const rotated = await sharp({
      create: { width: 100, height: 50, channels: 3, background: { r: 9, g: 9, b: 9 } },
    })
      .jpeg()
      .toBuffer();

    const tagged = await sharp(rotated).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    expect((await sharp(tagged).metadata()).orientation).toBe(6); // το δείγμα όντως το λέει

    const clean = await sanitiseCanonical(tagged);

    expect({ w: clean.width, h: clean.height }).toEqual({ w: 50, h: 100 });
  });
});

describe('Κ3 — ό,τι δεν είναι εικόνα ΔΕΝ αποκτά διεύθυνση', () => {
  it('απορρίπτει κενά bytes με ονομασμένη αιτία', async () => {
    await expect(sanitiseImageVariants(Buffer.alloc(0), LISTING_SHELF.encoding)).rejects.toBeInstanceOf(ShelfSanitiseError);
    await expect(sanitiseImageVariants(Buffer.alloc(0), LISTING_SHELF.encoding)).rejects.toMatchObject({
      failure: 'empty',
    });
  });

  it('απορρίπτει εκτελέσιμο μεταμφιεσμένο σε φωτογραφία', async () => {
    // 🔴 Χωρίς διεύθυνση δεν υπάρχει δημοσίευση (Α12.7): ένα PE header δεν μπορεί να
    // φτάσει ποτέ στο ράφι, γιατί δεν βγαίνει κλειδί για κάτι που δεν καθαρίστηκε.
    const fake = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(2048, 0x41)]);
    await expect(sanitiseImageVariants(fake, LISTING_SHELF.encoding)).rejects.toMatchObject({ failure: 'undecodable' });
  });
});

describe('Κ4 — Η ΕΓΓΥΗΣΗ ΙΣΧΥΕΙ ΓΙΑ ΚΑΘΕ ΠΑΡΑΓΩΓΟ, ΟΧΙ ΜΟΝΟ ΓΙΑ ΤΟ ΚΑΝΟΝΙΚΟ', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 🔴 ΠΑΡΑΜΕΤΡΟΠΟΙΗΜΕΝΟ ΣΤΟΝ ΠΙΝΑΚΑ ΕΙΔΩΝ, ΚΑΙ ΕΙΝΑΙ Η ΨΥΧΗ ΤΟΥ ΣΤΑΔΙΟΥ 2.
  //
  // Ως την Α21 αυτή η άγκυρα έλεγε «κανένα από τα **τρία** πλάτη» — καρφωμένη στη
  // **μοναδική** κωδικοποίηση που υπήρχε. Τη στιγμή που η κλίμακα έγινε παράμετρος, μια
  // καρφωμένη άγκυρα θα συνέχιζε να **περνά** ελέγχοντας μόνο τη γκαλερί: η κλίμακα του
  // **σήματος** θα δημοσιευόταν **αφύλακτη**.
  //
  // ⚠️ Και το διακύβευμα εκεί είναι ΜΕΓΑΛΥΤΕΡΟ, όχι μικρότερο: το `portrait` είναι
  //    **φυσικό πρόσωπο** — η selfie του υδραυλικού κουβαλά **GPS του σπιτιού του**.
  // ──────────────────────────────────────────────────────────────────────────
  it.each(PUBLIC_SHELF_KINDS.map((kind) => [kind.root, kind.encoding] as const))(
    '🔴 στο είδος «%s» ΚΑΝΕΝΑ πλάτος δεν κουβαλά EXIF ή υπογραφή συσκευής',
    async (_root, encoding) => {
      // Χωρίς αυτό, ένα μικρότερο παράγωγο θα μπορούσε να γεννηθεί από **άλλη** διαδρομή
      // που ξέχασε τον καθαρισμό — και θα δημοσιευόταν με GPS, ακυρώνοντας το
      // `locationDisclosure: 'declined'` της Α5 (ADR-841 §7 Α12.7).
      const variants = await sanitiseImageVariants(await photoWithGps(3000, 2000), encoding);

      expect(variants).toHaveLength(encoding.widths.length);
      for (const variant of variants) {
        expect((await sharp(variant.bytes).metadata()).exif).toBeUndefined();
        expect(variant.bytes.includes(Buffer.from('NestorTestCamera'))).toBe(false);
        expect(variant.contentType).toBe('image/webp');
      }
      expect(variants.map((variant) => variant.width)).toEqual([...encoding.widths]);
    },
  );

  it('η γκαλερί εξακολουθεί να δίνει ΑΚΡΙΒΩΣ τα τρία μετρημένα πλάτη', async () => {
    // Το παραμετροποιημένο από πάνω ρωτά «συμφωνεί με τη ρύθμισή του;» — αληθές ακόμη
    // κι αν η ρύθμιση γίνει λάθος. Αυτό εδώ κρατά τις **τιμές** της Α2.2 δεμένες.
    const variants = await sanitiseImageVariants(
      await photoWithGps(3000, 2000),
      LISTING_SHELF.encoding,
    );
    expect(variants.map((variant) => variant.width)).toEqual([640, 1280, LISTING_MAX_EDGE_PX]);
  });

  it('🏆 το ΣΗΜΑ βγαίνει lossless — και τα bytes το αποδεικνύουν, όχι η ρύθμιση', async () => {
    // Το `lossless` δεν είναι γούστο: λογότυπο = επίπεδες περιοχές + αιχμηρές ακμές,
    // δηλαδή ΜΟΝΟ οι μεταβάσεις που θολώνει η lossy συμπίεση. Η απόδειξη είναι το ίδιο
    // το αρχείο: το WebP δηλώνει lossless με το chunk `VP8L`, το lossy με `VP8 `.
    const [mark] = await sanitiseImageVariants(await photoWithGps(400, 400), SHOWCASE_SHELF.encoding);
    const [photo] = await sanitiseImageVariants(await photoWithGps(400, 400), LISTING_SHELF.encoding);

    expect(mark.bytes.includes(Buffer.from('VP8L'))).toBe(true);
    expect(photo.bytes.includes(Buffer.from('VP8L'))).toBe(false);
  });

  it('🔑 και η ΔΙΑΦΑΝΕΙΑ επιβιώνει — αλλιώς κάθε λογότυπο θα έπαιρνε μαύρο φόντο', async () => {
    // Ψημένη πλάκα φόντου θα ήταν απόφαση για ΕΝΑ θέμα και λάθος στο άλλο (ADR-777
    // §8.57.3 α). Το WebP κρατά το κανάλι alpha, και αυτό το μετρά — δεν το υποθέτει.
    const transparent = await sharp({
      create: { width: 300, height: 300, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 0 } },
    })
      .png()
      .toBuffer();

    const [mark] = await sanitiseImageVariants(transparent, SHOWCASE_SHELF.encoding);
    expect((await sharp(mark.bytes).metadata()).hasAlpha).toBe(true);
  });

  it('🔑 ο προσανατολισμός EXIF εφαρμόζεται ΜΙΑ φορά και τον κληρονομούν ΟΛΑ', async () => {
    const upright = await sharp({
      create: { width: 2000, height: 1000, channels: 3, background: { r: 9, g: 9, b: 9 } },
    })
      .jpeg()
      .toBuffer();
    const tagged = await sharp(upright).withMetadata({ orientation: 6 }).jpeg().toBuffer();

    const variants = await sanitiseImageVariants(tagged, LISTING_SHELF.encoding);

    // Orientation 6 ⇒ 2000×1000 γίνεται 1000×2000: **κάθε** παράγωγο είναι όρθιο.
    for (const variant of variants) {
      expect(variant.height).toBeGreaterThan(variant.width);
    }
  });
});
