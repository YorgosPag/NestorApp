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
  FRAMING_AS_GIVEN,
  FRAMING_INK_TIGHT,
  LISTING_SHELF,
  PUBLIC_SHELF_KINDS,
  SHOWCASE_SHELF,
  isRasterShelfKind,
  type RasterShelfEncoding,
} from '@/services/upload/utils/public-shelf-kinds';

/**
 * 🔴 **ΟΙ ΓΡΑΜΜΕΣ ΠΟΥ ΦΤΑΝΟΥΝ ΣΤΟΝ ΚΑΘΑΡΙΣΤΗ ΕΙΚΟΝΩΝ — ΔΙΑΜΕΡΙΣΗ, ΟΧΙ ΟΛΟΣ Ο ΠΙΝΑΚΑΣ**
 * *(ADR-845 Φ4.2)*.
 *
 * Ως τη Φ4.1 η άγκυρα του Κ4 διέτρεχε **ολόκληρο** τον `PUBLIC_SHELF_KINDS` — σωστό όσο
 * κάθε γραμμή ήταν εικόνα. Με τη γραμμή του **μοντέλου** το ίδιο `it.each` θα τάιζε τον
 * `sanitiseImageVariants` με κωδικοποίηση **χωρίς `widths`**, δηλαδή θα έσκαγε σε
 * `undefined.length` — και το μήνυμα δεν θα έλεγε τίποτα για την αιτία.
 *
 * ⚠️ **Το φίλτρο ΔΕΝ αδυνατίζει την άγκυρα, γιατί το πλήθος ελέγχεται**: δες το test
 * *«ο πίνακας ΟΝΤΩΣ έχει γραμμές εικόνας»* παρακάτω. Ένα σιωπηλό `.filter()` που κάποτε
 * γύριζε **κενό** θα άφηνε το `it.each` να μη ρωτήσει **τίποτα** — και το `it.each` με
 * κενό πίνακα είναι πράσινο. Ακριβώς το *«0 = κανείς δεν κοίταξε»*.
 */
const RASTER_SHELF_KINDS = PUBLIC_SHELF_KINDS.filter(isRasterShelfKind);

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
  encoding: RasterShelfEncoding = LISTING_SHELF.encoding,
) {
  const variants = await sanitiseImageVariants(input, encoding, FRAMING_AS_GIVEN);
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
    await expect(sanitiseImageVariants(Buffer.alloc(0), LISTING_SHELF.encoding, FRAMING_AS_GIVEN)).rejects.toBeInstanceOf(ShelfSanitiseError);
    await expect(sanitiseImageVariants(Buffer.alloc(0), LISTING_SHELF.encoding, FRAMING_AS_GIVEN)).rejects.toMatchObject({
      failure: 'empty',
    });
  });

  it('απορρίπτει εκτελέσιμο μεταμφιεσμένο σε φωτογραφία', async () => {
    // 🔴 Χωρίς διεύθυνση δεν υπάρχει δημοσίευση (Α12.7): ένα PE header δεν μπορεί να
    // φτάσει ποτέ στο ράφι, γιατί δεν βγαίνει κλειδί για κάτι που δεν καθαρίστηκε.
    const fake = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(2048, 0x41)]);
    await expect(sanitiseImageVariants(fake, LISTING_SHELF.encoding, FRAMING_AS_GIVEN)).rejects.toMatchObject({ failure: 'undecodable' });
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
  it('🔴 ο πίνακας ΟΝΤΩΣ έχει γραμμές εικόνας — αλλιώς το `it.each` από κάτω δεν ρωτά τίποτα', () => {
    // Ένα `it.each([])` είναι **πράσινο**. Χωρίς αυτή τη γραμμή, μια μελλοντική αλλαγή που
    // άδειαζε το φίλτρο θα εξαφάνιζε σιωπηλά τη σημαντικότερη άγκυρα του καθαρισμού.
    expect(RASTER_SHELF_KINDS.length).toBeGreaterThanOrEqual(2);
  });

  it.each(RASTER_SHELF_KINDS.map((kind) => [kind.root, kind.encoding] as const))(
    '🔴 στο είδος «%s» ΚΑΝΕΝΑ πλάτος δεν κουβαλά EXIF ή υπογραφή συσκευής',
    async (_root, encoding) => {
      // Χωρίς αυτό, ένα μικρότερο παράγωγο θα μπορούσε να γεννηθεί από **άλλη** διαδρομή
      // που ξέχασε τον καθαρισμό — και θα δημοσιευόταν με GPS, ακυρώνοντας το
      // `locationDisclosure: 'declined'` της Α5 (ADR-841 §7 Α12.7).
      const variants = await sanitiseImageVariants(await photoWithGps(3000, 2000), encoding, FRAMING_AS_GIVEN);

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
      FRAMING_AS_GIVEN,
    );
    expect(variants.map((variant) => variant.width)).toEqual([640, 1280, LISTING_MAX_EDGE_PX]);
  });

  it('🏆 το ΣΗΜΑ βγαίνει lossless — και τα bytes το αποδεικνύουν, όχι η ρύθμιση', async () => {
    // Το `lossless` δεν είναι γούστο: λογότυπο = επίπεδες περιοχές + αιχμηρές ακμές,
    // δηλαδή ΜΟΝΟ οι μεταβάσεις που θολώνει η lossy συμπίεση. Η απόδειξη είναι το ίδιο
    // το αρχείο: το WebP δηλώνει lossless με το chunk `VP8L`, το lossy με `VP8 `.
    const [mark] = await sanitiseImageVariants(await photoWithGps(400, 400), SHOWCASE_SHELF.encoding, FRAMING_AS_GIVEN);
    const [photo] = await sanitiseImageVariants(await photoWithGps(400, 400), LISTING_SHELF.encoding, FRAMING_AS_GIVEN);

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

    const [mark] = await sanitiseImageVariants(transparent, SHOWCASE_SHELF.encoding, FRAMING_AS_GIVEN);
    expect((await sharp(mark.bytes).metadata()).hasAlpha).toBe(true);
  });

  it('🔑 ο προσανατολισμός EXIF εφαρμόζεται ΜΙΑ φορά και τον κληρονομούν ΟΛΑ', async () => {
    const upright = await sharp({
      create: { width: 2000, height: 1000, channels: 3, background: { r: 9, g: 9, b: 9 } },
    })
      .jpeg()
      .toBuffer();
    const tagged = await sharp(upright).withMetadata({ orientation: 6 }).jpeg().toBuffer();

    const variants = await sanitiseImageVariants(tagged, LISTING_SHELF.encoding, FRAMING_AS_GIVEN);

    // Orientation 6 ⇒ 2000×1000 γίνεται 1000×2000: **κάθε** παράγωγο είναι όρθιο.
    for (const variant of variants) {
      expect(variant.height).toBeGreaterThan(variant.width);
    }
  });
});

// ---------------------------------------------------------------------------
// Κ5 — ΤΟ ΠΛΑΙΣΙΩΜΑ (ADR-841 §7 Α21.10)
// ---------------------------------------------------------------------------

/**
 * **Το ίδιο μελάνι, σε καμβά ίδιας αναλογίας, με ΔΙΑΦΟΡΕΤΙΚΟ περιθώριο.**
 *
 * 🔑 Η αναλογία κρατιέται **σταθερή επίτηδες**: αν άλλαζε, το κουτί της Α21.9 θα άλλαζε
 * μαζί της και η άγκυρα θα μπορούσε να περάσει για λάθος λόγο. Έτσι η **μόνη** μεταβλητή
 * είναι το περιθώριο — δηλαδή ακριβώς αυτό που η Φάση Β υπάρχει για να εξαλείψει.
 */
async function markWithMargin(marginFraction: number, background = { r: 0, g: 0, b: 0, alpha: 0 }) {
  const CANVAS_W = 800;
  const CANVAS_H = 200;
  const inkW = Math.round(CANVAS_W * (1 - 2 * marginFraction));
  const inkH = Math.round(CANVAS_H * (1 - 2 * marginFraction));

  const ink = await sharp({
    create: { width: inkW, height: inkH, channels: 4, background: { r: 20, g: 60, b: 190, alpha: 1 } },
  })
    .png()
    .toBuffer();

  return sharp({ create: { width: CANVAS_W, height: CANVAS_H, channels: 4, background } })
    .composite([
      {
        input: ink,
        left: Math.round((CANVAS_W - inkW) / 2),
        top: Math.round((CANVAS_H - inkH) / 2),
      },
    ])
    .png()
    .toBuffer();
}

const canonicalOf = async (input: Buffer, framing: Parameters<typeof sanitiseImageVariants>[2]) => {
  const variants = await sanitiseImageVariants(input, SHOWCASE_SHELF.encoding, framing);
  return variants[variants.length - 1];
};

describe('🏆 Κ5 — ΔΥΟ ΣΗΜΑΤΑ ΜΕ ΑΛΛΟ ΠΕΡΙΘΩΡΙΟ ΚΑΤΑΛΗΓΟΥΝ ΤΑΥΤΟΣΗΜΑ', () => {
  it('🔴 ΤΟ ΔΕΙΓΜΑ ΟΝΤΩΣ ΚΟΥΒΑΛΑΕΙ ΤΟ ΠΡΟΒΛΗΜΑ — χωρίς πλαισίωμα ΔΙΑΦΕΡΟΥΝ', async () => {
    // Ο παρονομαστής: αν αυτό γινόταν ποτέ πράσινο, η επόμενη άγκυρα θα ήταν κενή.
    const tight = await canonicalOf(await markWithMargin(0.02), FRAMING_AS_GIVEN);
    const padded = await canonicalOf(await markWithMargin(0.3), FRAMING_AS_GIVEN);

    expect(tight.width).toBe(padded.width); // ίδιος καμβάς ⇒ ίδιες διαστάσεις παραγώγου
    // …και όμως το μελάνι μέσα τους διαφέρει κατά ~2× — αυτό ακριβώς είναι το πρόβλημα
    // που καμία μέτρηση διαστάσεων δεν βλέπει, και που το `object-contain` σέβεται.
    expect(tight.bytes.equals(padded.bytes)).toBe(false);
  });

  it('🏆 ΜΕ πλαισίωμα, ΚΑΙ ΤΑ ΔΥΟ γεμίζουν ΠΛΗΡΩΣ — άρα ίδιο οπτικό βάρος', async () => {
    const tight = await canonicalOf(await markWithMargin(0.02), FRAMING_INK_TIGHT);
    const padded = await canonicalOf(await markWithMargin(0.3), FRAMING_INK_TIGHT);

    // Ίδια αναλογία ⇒ **ίδιο κουτί** (Α21.9). Και επειδή κανένα από τα δύο δεν έχει πια
    // περιθώριο, το `object-contain` τα ζωγραφίζει **ταυτόσημα** — που είναι όλο το
    // ζητούμενο της Φάσης Β.
    expect(padded.width / padded.height).toBeCloseTo(tight.width / tight.height, 2);

    // 🔑 **Η ΑΠΟΔΕΙΞΗ ΤΟΥ «ΓΕΜΙΖΟΥΝ ΠΛΗΡΩΣ», ΜΕΤΡΗΜΕΝΗ**: ένα δεύτερο τρίμμα πάνω στην
    //    έξοδο δεν βρίσκει **τίποτα** να αφαιρέσει. Μια σύγκριση διαστάσεων μεταξύ τους
    //    δεν θα το έλεγε αυτό — θα μπορούσαν να είναι και τα δύο εξίσου γεμάτα κενό.
    for (const asset of [tight, padded]) {
      const again = await sharp(asset.bytes)
        .trim({ threshold: 25 })
        .toBuffer({ resolveWithObject: true });

      expect({ w: again.info.width, h: again.info.height }).toEqual({
        w: asset.width,
        h: asset.height,
      });
    }
  });

  it('⚠️ …αλλά ΟΧΙ ίδιες διαστάσεις, και είναι ΣΩΣΤΟ — ανάλυση ≠ βάρος', async () => {
    // 🔴 Η Φάση Β **αποκαλύπτει** διαφορά που πριν ήταν κρυμμένη: το σήμα με το μεγάλο
    //    περιθώριο είχε πάντα λιγότερο **πραγματικό** μελάνι (320×80 έναντι 768×192).
    //    Ο καθαριστής **δεν μεγεθύνει** (`withoutEnlargement`) — η εφεύρεση
    //    εικονοστοιχείων θα ήταν ψέμα. Άρα δημοσιεύεται σε **χαμηλότερη ανάλυση**, ενώ
    //    ζωγραφίζεται στο **ίδιο** μέγεθος.
    // ⚠️ Και αυτό είναι ακριβώς το **δηλωμένο κενό #1 της Α21.10**: ο κριτής εισόδου
    //    μετρά το **αρχείο**, ενώ το ράφι δημοσιεύει το **μελάνι**.
    const tight = await canonicalOf(await markWithMargin(0.02), FRAMING_INK_TIGHT);
    const padded = await canonicalOf(await markWithMargin(0.3), FRAMING_INK_TIGHT);

    expect(padded.width).toBeLessThan(tight.width);
  });

  it('🔑 και το ΛΕΥΚΟ φόντο δίνει το ΙΔΙΟ αποτέλεσμα με το διάφανο', async () => {
    // Αλλιώς η κανονικοποίηση θα εξαρτιόταν από τη μορφή που έτυχε να εξάγει ο άνθρωπος.
    const onWhite = await markWithMargin(0.3, { r: 255, g: 255, b: 255, alpha: 1 });
    const onAlpha = await markWithMargin(0.3);

    const white = await canonicalOf(onWhite, FRAMING_INK_TIGHT);
    const alpha = await canonicalOf(onAlpha, FRAMING_INK_TIGHT);

    expect({ w: white.width, h: white.height }).toEqual({ w: alpha.width, h: alpha.height });
  });

  it('🔑 η ΑΝΑΛΟΓΙΑ που γράφεται γίνεται του ΜΕΛΑΝΙΟΥ, όχι του καμβά', async () => {
    // Το εύρημα που ξεπερνά το αρχικό αίτημα: το `marksBand()` της Α21.9 ρωτά αυτόν
    // ακριβώς τον αριθμό. Wordmark σε ΤΕΤΡΑΓΩΝΟ αρχείο έπαιρνε τετράγωνο κουτί με 16px
    // μελάνι — τώρα παίρνει ζώνη, χωρίς να αλλάξει τίποτα στην οθόνη.
    const CANVAS = 400;
    const ink = await sharp({
      create: { width: 360, height: 90, channels: 4, background: { r: 20, g: 60, b: 190, alpha: 1 } },
    })
      .png()
      .toBuffer();
    const squareCanvas = await sharp({
      create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: ink, left: 20, top: 155 }])
      .png()
      .toBuffer();

    const asGiven = await canonicalOf(squareCanvas, FRAMING_AS_GIVEN);
    const inkTight = await canonicalOf(squareCanvas, FRAMING_INK_TIGHT);

    expect(asGiven.width / asGiven.height).toBeCloseTo(1, 2); // ο καμβάς λέει «τετράγωνο»
    expect(inkTight.width / inkTight.height).toBeCloseTo(4, 1); // το μελάνι λέει «4:1»
  });
});

describe('🔴 Κ6 — ΤΟ ΠΛΑΙΣΙΩΜΑ ΔΕΝ ΚΑΤΑΣΤΡΕΦΕΙ ΠΟΤΕ, ΚΑΙ ΔΕΝ ΠΕΤΑ ΠΟΤΕ', () => {
  it('🔴 app-icon με ΧΡΩΜΑΤΙΣΤΟ σώμα μένει ΑΘΙΚΤΟ', async () => {
    // Η μετρημένη καταστροφή που γέννησε τον κριτή: σκέτο `trim` έδινε 400×200 → 120×120,
    // δηλαδή έτρωγε το πλακίδιο και άφηνε μόνο το σύμβολο, αλλάζοντας και την αναλογία.
    const appIcon = await sharp({
      create: { width: 400, height: 200, channels: 4, background: { r: 29, g: 78, b: 216, alpha: 1 } },
    })
      .composite([
        {
          input: await sharp({
            create: { width: 80, height: 80, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
          })
            .png()
            .toBuffer(),
          left: 160,
          top: 60,
        },
      ])
      .png()
      .toBuffer();

    const framed = await canonicalOf(appIcon, FRAMING_INK_TIGHT);
    const asGiven = await canonicalOf(appIcon, FRAMING_AS_GIVEN);

    expect({ w: framed.width, h: framed.height }).toEqual({ w: asGiven.width, h: asGiven.height });
    expect(framed.width / framed.height).toBeCloseTo(2, 1); // η αναλογία ΔΕΝ άλλαξε
  });

  it('ΟΜΟΙΟΧΡΩΜΗ εικόνα δεν εξαφανίζεται — το τρίμμα είναι no-op, όχι σφάλμα', async () => {
    const blank = await sharp({
      create: { width: 300, height: 150, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    })
      .png()
      .toBuffer();

    const framed = await canonicalOf(blank, FRAMING_INK_TIGHT);
    expect(framed.width / framed.height).toBeCloseTo(2, 1);
  });

  it('🔴 εικόνα κάτω από 3×3 ΔΕΝ μπλοκάρει τη δημοσίευση', async () => {
    // Το libvips πετά «Image to trim must be at least 3x3 pixels». Χωρίς φρουρό, η
    // εξαίρεση θα ταξίδευε ως `undecodable` και ΟΛΟΚΛΗΡΗ η βιτρίνα δεν θα δημοσιευόταν
    // εξαιτίας ενός σήματος 2×2.
    const tiny = await sharp({
      create: { width: 2, height: 2, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 1 } },
    })
      .png()
      .toBuffer();

    await expect(canonicalOf(tiny, FRAMING_INK_TIGHT)).resolves.toMatchObject({ width: 2 });
  });

  it('🔑 ΙΔΕΜΠΟΤΕΝΤΙΚΟ — δεύτερο πέρασμα δεν αφαιρεί τίποτα άλλο', async () => {
    // Χωρίς αυτό, μια επαναδημοσίευση θα μίκραινε το σήμα κάθε φορά.
    const once = await canonicalOf(await markWithMargin(0.3), FRAMING_INK_TIGHT);
    const twice = await canonicalOf(once.bytes, FRAMING_INK_TIGHT);

    expect({ w: twice.width, h: twice.height }).toEqual({ w: once.width, h: once.height });
  });
});
