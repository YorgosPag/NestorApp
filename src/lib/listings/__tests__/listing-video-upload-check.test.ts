/**
 * @fileoverview **Ο έλεγχος του βίντεο στο ανέβασμα** (ADR-907 §10.9) — αληθινός αναγνώστης κουτιών, συνθετικά MP4.
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Υ1: ο έλεγχος απλώνεται σε κάδο που δεν δημοσιεύει βίντεο αγγελίας (ή λείπει από αυτόν που δημοσιεύει).
 * - Υ2: δεκτό MP4 κρίνεται ως άρνηση, ή άρνηση του αναγνώστη χάνει το όνομά της.
 * - Υ3: αληθινό MP4 με άλλο δηλωμένο MIME περνά ως δημοσιεύσιμο (ο κριτής της δημοσίευσης θα το έκοβε σιωπηλά).
 * - Υ4: το όριο «μπλοκάρεται / ανεβαίνει με προειδοποίηση» φεύγει από τα 50 MB της γενικής πόρτας του κανόνα.
 * - Υ5: μια άρνηση μένει χωρίς μήνυμα σε κάποια γλώσσα, ή το μήνυμα γράφει αριθμό αντί για παράμετρο της πολιτικής.
 */

import { ENTITY_TYPES, FILE_CATEGORIES } from '@/config/domain-constants';
import { UPLOAD_LIMITS } from '@/config/file-upload-config';
import { NOTIFICATION_KEYS } from '@/config/notification-keys';
import el from '@/i18n/locales/el/files.json';
import en from '@/i18n/locales/en/files.json';
import { buildMp4 } from '@/lib/media/__tests__/mp4-fixture';
import type { Mp4Refusal } from '@/lib/media/mp4-boxes';

import { LISTING_VIDEO_CONTENT_TYPE, LISTING_VIDEO_LIMITS } from '../listing-video-policy';
import { blobByteSource, isListingVideoSlot, judgeListingVideoUpload } from '../listing-video-upload-check';

function mp4File(bytes: Uint8Array, type: string = LISTING_VIDEO_CONTENT_TYPE): Blob {
  return new Blob([bytes], { type });
}

/** Το ίδιο αρχείο, με **δηλωμένο** μέγεθος άλλο από το πραγματικό — ώστε να κριθούν 60 MB χωρίς να δεσμευτούν. */
function sized(blob: Blob, size: number): Blob {
  return Object.defineProperty(blob.slice(0, blob.size, blob.type), 'size', { value: size });
}

const REASON_KEYS = NOTIFICATION_KEYS.files.upload.listingVideo.reasons;
const REFUSALS = Object.keys(REASON_KEYS) as readonly Mp4Refusal[];

function localeText(locale: unknown, key: string): string | undefined {
  const path = key.split(':')[1].split('.');
  // Το τελευταίο τμήμα μπορεί να έχει παύλα, ποτέ τελεία — το μονοπάτι σπάει καθαρά στις τελείες.
  return path.reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], locale) as string | undefined;
}

describe('isListingVideoSlot', () => {
  it('🔴 Υ1 μόνο ο κάδος βίντεο μιας ΜΟΝΑΔΑΣ — ίδια τομή με τον κανόνα αποθήκευσης και τον κριτή δημοσίευσης', () => {
    expect(isListingVideoSlot(ENTITY_TYPES.PROPERTY, FILE_CATEGORIES.VIDEOS)).toBe(true);
    expect(isListingVideoSlot(ENTITY_TYPES.PROPERTY, FILE_CATEGORIES.PHOTOS)).toBe(false);
    expect(isListingVideoSlot(ENTITY_TYPES.BUILDING, FILE_CATEGORIES.VIDEOS)).toBe(false);
    expect(isListingVideoSlot(ENTITY_TYPES.PROJECT, FILE_CATEGORIES.VIDEOS)).toBe(false);
  });
});

describe('blobByteSource', () => {
  it('διαβάζει ΜΟΝΟ το κομμάτι που ζητήθηκε, και λιγότερα στο τέλος του αρχείου', async () => {
    const source = blobByteSource(new Blob([Uint8Array.from([1, 2, 3, 4, 5])]));

    expect(source.size).toBe(5);
    expect([...(await source.read(1, 3))]).toEqual([2, 3, 4]);
    expect([...(await source.read(3, 10))]).toEqual([4, 5]);
  });
});

describe('judgeListingVideoUpload', () => {
  it('🔴 Υ2 H.264 + AAC μέσα στα όρια ⇒ δημοσιεύσιμο', async () => {
    expect(await judgeListingVideoUpload(mp4File(buildMp4()))).toEqual({ kind: 'publishable' });
  });

  it.each([
    ['hevc-codec', buildMp4({ videoFormat: 'hvc1' })],
    ['quicktime-container', buildMp4({ brand: 'qt  ' })],
    ['too-long', buildMp4({ durationSec: LISTING_VIDEO_LIMITS.maxDurationSec + 1 })],
    // Χαρακτηρισμός της ζωντανής συμπεριφοράς: bytes χωρίς δομή κουτιών ο αναγνώστης τα λέει «κατεστραμμένο», όχι «όχι MP4».
    ['malformed', Buffer.from('δεν είναι βίντεο, είναι κείμενο που κάποιος ονόμασε .mp4')],
  ] as const)('🔴 Υ2 άρνηση «%s» φτάνει με το ΟΝΟΜΑ της — μικρό αρχείο ⇒ ανεβαίνει με προειδοποίηση', async (refusal, bytes) => {
    expect(await judgeListingVideoUpload(mp4File(bytes))).toEqual({ kind: 'unpublishable', refusal });
  });

  it('🔴 Υ3 αληθινό MP4 που ο browser δήλωσε αλλιώς ΔΕΝ είναι δημοσιεύσιμο — ο κριτής της δημοσίευσης ζητά `video/mp4`', async () => {
    expect(await judgeListingVideoUpload(mp4File(buildMp4(), 'video/quicktime'))).toEqual({
      kind: 'unpublishable',
      refusal: 'not-mp4',
    });
  });

  it('🔴 Υ4 το όριο είναι ΑΚΡΙΒΩΣ η γενική πόρτα του κανόνα (`size < 50 MB`)', async () => {
    const hevc = mp4File(buildMp4({ videoFormat: 'hvc1' }));

    expect((await judgeListingVideoUpload(sized(hevc, UPLOAD_LIMITS.MAX_FILE_SIZE - 1))).kind).toBe('unpublishable');
    expect((await judgeListingVideoUpload(sized(hevc, UPLOAD_LIMITS.MAX_FILE_SIZE))).kind).toBe('blocked');
  });

  it('🔴 Υ4 πάνω από το όριο της αγγελίας ⇒ δεν ανεβαίνει, χωρίς να διαβαστεί ούτε byte', async () => {
    const huge = sized(mp4File(buildMp4()), LISTING_VIDEO_LIMITS.maxBytes + 1);

    expect(await judgeListingVideoUpload(huge)).toEqual({ kind: 'blocked', refusal: 'too-large' });
  });
});

describe('τα μηνύματα των αρνήσεων', () => {
  it('το μητρώο κλειδιών καλύπτει και τις ΕΝΤΕΚΑ αρνήσεις του αναγνώστη', () => {
    expect(REFUSALS).toHaveLength(11);
  });

  it.each(REFUSALS)('🔴 Υ5 «%s» έχει πρόταση σε ελληνικά ΚΑΙ αγγλικά, που λέει τι να αλλάξει', (refusal) => {
    for (const locale of [el, en]) {
      const text = localeText(locale, REASON_KEYS[refusal]);

      expect(typeof text).toBe('string');
      expect((text as string).length).toBeGreaterThan(40);
    }
  });

  it('🔴 Υ5 οι αριθμοί της πολιτικής είναι ΠΑΡΑΜΕΤΡΟΙ — κανένα «100» ή «120» γραμμένο μέσα στο κείμενο', () => {
    for (const locale of [el, en]) {
      expect(localeText(locale, REASON_KEYS['too-large'])).toContain('{maxMb}');
      expect(localeText(locale, REASON_KEYS['too-long'])).toContain('{maxSeconds}');
      expect(localeText(locale, REASON_KEYS['too-large'])).not.toMatch(/\d/);
      expect(localeText(locale, REASON_KEYS['too-long'])).not.toMatch(/\d/);
    }
  });

  it('τα δύο περιβλήματα παίρνουν όνομα αρχείου και λόγο', () => {
    const { blocked, unpublishable } = NOTIFICATION_KEYS.files.upload.listingVideo;

    for (const locale of [el, en]) {
      for (const key of [blocked, unpublishable]) {
        expect(localeText(locale, key)).toEqual(expect.stringContaining('{name}'));
        expect(localeText(locale, key)).toEqual(expect.stringContaining('{reason}'));
      }
    }
  });
});
