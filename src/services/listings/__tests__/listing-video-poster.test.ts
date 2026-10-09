/**
 * @fileoverview **Το εξώφυλλο του βίντεο στο raster ράφι** — κρίση (καθαρή) και καλωδίωση (`writeWithShelf`), ADR-907 §10.8.
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Ε1: η διαδρομή του εξωφύλλου διαβάζεται από αλλού αντί να **παράγεται** από τη διαδρομή του βίντεο (μητρώο συνοδευτικών).
 * - Ε2: ζητείται εξώφυλλο για βίντεο που **δεν** δημοσιεύτηκε ⇒ ορφανό καρέ στον δημόσιο κάδο.
 * - Ε3: το εξώφυλλο κληρονομεί `storagePlacement` του πρωτοτύπου, ενώ το μητρώο το δηλώνει `client-default`.
 * - Ε4: το εξώφυλλο φτάνει στη συλλογή φωτογραφιών (ή ρίχνει τη δημοσίευση στον φρουρό του `withPublishedGallery`).
 * - Ε5: το δέσιμο γίνεται με **θέση** στον πίνακα αντί για ταυτότητα πηγής.
 * - Ε6: τα εξώφυλλα πάνε σε **δεύτερη** συμφιλίωση του raster ραφιού ⇒ οι φωτογραφίες σβήνονται ως «εκτός συνόλου».
 * - Ε7: χωρίς καρέ στο ράφι το `poster` γίνεται κάτι άλλο από `null`.
 *
 * Προστέθηκαν μετά το πέρασμα μεταλλάξεων (ADR-907 §10.11) — ό,τι επέζησε τότε:
 * - Ε1β: χειρόγραφο `.replace(/\.mp4$/, …)` αντί για το μητρώο (με πηγή `.mp4` έδινε την ίδια συμβολοσειρά).
 * - Ε8: `durationSec` / `width` / `height` του βίντεο χάνονται ή αντικαθίστανται από του εξωφύλλου στο γραμμένο έγγραφο.
 */

import { fileCompanionPath } from '@/lib/files/file-companion-objects';
import type { ListingMaterial } from '@/lib/listings/listing-material';
import type { PublicShelfSource } from '@/services/upload/utils/storage-path-public-shelf';
import type { PublicListing } from '@/types/public-listing';

import { splitVideoPosters, videoPosterSources } from '../listing-video-poster';

type ShelfCall = [kind: unknown, subjectId: string, sources: readonly PublicShelfSource<ListingMaterial>[]];

const reconcilePublicShelf = jest.fn<Promise<unknown>, ShelfCall>();
const reconcilePublicModelShelf = jest.fn<Promise<unknown>, ShelfCall>();
const reconcilePublicVideoShelf = jest.fn<Promise<unknown>, ShelfCall>();

jest.mock('../public-shelf.service', () => ({
  reconcilePublicShelf: (...args: ShelfCall) => reconcilePublicShelf(...args),
}));
jest.mock('../public-shelf-model.service', () => ({
  reconcilePublicModelShelf: (...args: ShelfCall) => reconcilePublicModelShelf(...args),
}));
jest.mock('../public-shelf-video.service', () => ({
  reconcilePublicVideoShelf: (...args: ShelfCall) => reconcilePublicVideoShelf(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { writeWithShelf } = require('../publish-public-listing-shelf') as typeof import('../publish-public-listing-shelf');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildPublicListing } = require('../public-listing-projection') as typeof import('../public-listing-projection');

const LISTING = 'prop_77aa21bc';
const DIR = 'companies/comp_1/entities/property/prop_77aa21bc/domains/sales/categories/videos/files/';
const VIDEO_PATH = `${DIR}file_v1.mp4`;
const SECOND_PATH = `${DIR}file_v2.mp4`;
const POSTER_PATH = `${DIR}file_v1_poster.webp`;

const VIDEO: ListingMaterial = { kind: 'video' };
const PHOTO: ListingMaterial = { kind: 'photo' };

function videoSource(path: string, sourceFileId?: string): PublicShelfSource<ListingMaterial> {
  return { privateStoragePath: path, material: VIDEO, sourceFileId, storagePlacement: 'eu-originals' };
}

function publishedVideo(sourceFileId: string | null, tag = 'aa') {
  return {
    key: `listings/${LISTING}/${tag}.mp4`,
    url: `https://shelf/${tag}.mp4`,
    at: '2026-10-09T08:00:00.000Z',
    sourceFileId,
    durationSec: 9.2,
    width: 1024,
    height: 464,
  };
}

function shelfImage(material: ListingMaterial, sourceFileId: string | null, tag: string) {
  const variant = (width: number) => ({ key: `k-${tag}-${width}`, url: `https://shelf/${tag}-${width}.webp`, width, height: width / 2 });
  return {
    canonical: variant(1024),
    variants: [variant(640), variant(1024)],
    material,
    focalPoint: null,
    declaredFocalPoint: null,
    sourceFileId,
    declaredCaptureSpot: null,
    declaredNorthRad: null,
  };
}

function report(published: readonly unknown[], rejected = 0) {
  return { outcome: 'reconciled', published, removed: 0, rejected };
}

function listing(): PublicListing {
  const built = buildPublicListing(
    { id: LISTING, name: 'Διαμέρισμα 80 τ.μ.', type: 'apartment', commercialStatus: 'for-sale', areas: { gross: 80 }, commercial: { askingPrice: 150000 } },
    { candidates: [], ref: null },
    '2026-10-09T10:00:00.000Z',
  );
  if (built === null) throw new Error('το fixture όφειλε να δημοσιεύεται');
  return built;
}

async function write(sources: readonly PublicShelfSource<ListingMaterial>[]): Promise<Record<string, unknown>> {
  const written: Record<string, unknown>[] = [];
  const ref = { set: jest.fn(async (doc: Record<string, unknown>) => void written.push(doc)) };
  await writeWithShelf(ref as never, LISTING, listing(), sources);
  expect(ref.set).toHaveBeenCalledTimes(1);
  return written[0];
}

beforeEach(() => {
  jest.clearAllMocks();
  reconcilePublicShelf.mockResolvedValue(report([]));
  reconcilePublicModelShelf.mockResolvedValue(report([]));
  reconcilePublicVideoShelf.mockResolvedValue(report([]));
});

describe('videoPosterSources — ποια πηγή εξωφύλλου αντιστοιχεί σε κάθε ΔΗΜΟΣΙΕΥΜΕΝΟ βίντεο', () => {
  it('🔴 Ε1 η διαδρομή ΠΑΡΑΓΕΤΑΙ από τη διαδρομή του βίντεο, μέσω του μητρώου συνοδευτικών', () => {
    const [poster] = videoPosterSources([publishedVideo('file_v1')], [videoSource(VIDEO_PATH, 'file_v1')]);

    expect(poster.privateStoragePath).toBe(POSTER_PATH);
    expect(poster.privateStoragePath).toBe(fileCompanionPath(VIDEO_PATH, 'videoPoster'));
    expect(poster.material).toEqual(VIDEO);
    expect(poster.sourceFileId).toBe('file_v1');
  });

  // 🔴 Με πηγή `.mp4` ένα χειρόγραφο `.replace(/\.mp4$/, '_poster.webp')` δίνει την ΙΔΙΑ συμβολοσειρά με το μητρώο —
  // η Ε1 περνούσε χωρίς να αποδεικνύει «μέσω του μητρώου» (μετάλλαξη §10.11). Το μητρώο κόβει την ΤΕΛΕΥΤΑΙΑ κατάληξη,
  // όποια κι αν είναι, και δεν αγγίζει τελεία φακέλου· το χειρόγραφο όχι.
  it.each([
    [`${DIR}file_v3.m4v`, `${DIR}file_v3_poster.webp`],
    [`${DIR}file_v4.MP4`, `${DIR}file_v4_poster.webp`],
    ['companies/comp_1/v1.2/files/file_v5.mp4', 'companies/comp_1/v1.2/files/file_v5_poster.webp'],
  ])('🔴 Ε1β η κατάληξη της πηγής δεν είναι υπόθεση αυτού του module (%s)', (videoPath, posterPath) => {
    const [poster] = videoPosterSources([publishedVideo('file_x')], [videoSource(videoPath, 'file_x')]);

    expect(poster.privateStoragePath).toBe(posterPath);
  });

  it('🔴 Ε2 βίντεο που ΔΕΝ δημοσιεύτηκε δεν αποκτά εξώφυλλο — ούτε βίντεο χωρίς ταυτότητα πηγής', () => {
    const sources = [videoSource(VIDEO_PATH, 'file_v1'), videoSource(SECOND_PATH, 'file_v2')];

    expect(videoPosterSources([], sources)).toEqual([]);
    expect(videoPosterSources([publishedVideo('file_v2')], sources).map((s) => s.sourceFileId)).toEqual(['file_v2']);
    expect(videoPosterSources([publishedVideo(null)], sources)).toEqual([]);
    expect(videoPosterSources([publishedVideo('file_ghost')], sources)).toEqual([]);
  });

  it('🔴 Ε3 το εξώφυλλο ζει στον ΚΑΝΟΝΙΚΟ κάδο — δεν κληρονομεί τη θέση του πρωτοτύπου', () => {
    const [poster] = videoPosterSources([publishedVideo('file_v1')], [videoSource(VIDEO_PATH, 'file_v1')]);

    expect(poster).not.toHaveProperty('storagePlacement');
  });
});

describe('splitVideoPosters — «εξώφυλλο ή συλλογή;» σε ΕΝΑ πέρασμα', () => {
  it('🔴 Ε4 κάθε εικόνα σε ΑΚΡΙΒΩΣ ένα από τα δύο — καμία δεν χάνεται, καμία δεν διπλογράφεται', () => {
    const photo = shelfImage(PHOTO, 'file_p1', 'p');
    const plan = shelfImage({ kind: 'floorplan', at: '2026-01-01T00:00:00.000Z', provenance: 'declared' }, 'file_f1', 'f');
    const poster = shelfImage(VIDEO, 'file_v1', 'v');

    const { gallery, posterByVideo } = splitVideoPosters([photo, poster, plan]);

    expect(gallery).toEqual([photo, plan]);
    expect([...posterByVideo.entries()]).toEqual([['file_v1', poster]]);
  });

  it('εξώφυλλο χωρίς ταυτότητα δεν δένεται πουθενά — και ΔΕΝ πέφτει στη συλλογή', () => {
    const { gallery, posterByVideo } = splitVideoPosters([shelfImage(VIDEO, null, 'v')]);

    expect(gallery).toEqual([]);
    expect(posterByVideo.size).toBe(0);
  });
});

describe('writeWithShelf — η καλωδίωση του εξωφύλλου', () => {
  const sources = [
    { privateStoragePath: `${DIR}file_p1.jpg`, material: PHOTO, sourceFileId: 'file_p1' },
    videoSource(VIDEO_PATH, 'file_v1'),
  ];

  it('🔴 Ε6 ΜΙΑ συμφιλίωση του raster ραφιού: φωτογραφίες ΚΑΙ εξώφυλλο στο ίδιο επιθυμητό σύνολο', async () => {
    reconcilePublicVideoShelf.mockResolvedValue(report([publishedVideo('file_v1')]));

    await write(sources);

    expect(reconcilePublicShelf).toHaveBeenCalledTimes(1);
    expect(reconcilePublicShelf.mock.calls[0][2].map((s) => s.privateStoragePath)).toEqual([`${DIR}file_p1.jpg`, POSTER_PATH]);
  });

  it('🔴 Ε2 (καλωδίωση) βίντεο που ο ψήστης αρνήθηκε ⇒ το raster ράφι ΔΕΝ μαθαίνει ποτέ για το καρέ του', async () => {
    reconcilePublicVideoShelf.mockResolvedValue(report([], 1));

    const doc = await write(sources);

    expect(reconcilePublicShelf.mock.calls[0][2].map((s) => s.material.kind)).toEqual(['photo']);
    expect(doc.videos).toEqual([]);
  });

  it('🔴 Ε4 + Ε5 το εξώφυλλο δένεται στο ΔΙΚΟ του βίντεο με την ταυτότητα — και δεν μπαίνει στη συλλογή', async () => {
    reconcilePublicVideoShelf.mockResolvedValue(report([publishedVideo('file_v1', 'aa'), publishedVideo('file_v2', 'bb')]));
    // Το ράφι επιστρέφει πρώτο το εξώφυλλο του ΔΕΥΤΕΡΟΥ βίντεο: δέσιμο με θέση θα το έδινε στο πρώτο.
    reconcilePublicShelf.mockResolvedValue(
      report([shelfImage(PHOTO, 'file_p1', 'p'), shelfImage(VIDEO, 'file_v2', 'v2'), shelfImage(VIDEO, 'file_v1', 'v1')]),
    );

    const doc = await write([...sources, videoSource(SECOND_PATH, 'file_v2')]);
    const videos = doc.videos as PublicListing['videos'];
    const gallery = doc.gallery as PublicListing['gallery'];

    expect(videos.map((video) => video.value.poster?.url)).toEqual(['https://shelf/v1-1024.webp', 'https://shelf/v2-1024.webp']);
    expect(gallery.map((image) => image.url)).toEqual(['https://shelf/p-1024.webp']);
    // Και ΚΑΘΕ δημοσιευμένο βίντεο ζήτησε το δικό του καρέ: το ψεύτικο ράφι απαντά ό,τι του πουν, άρα «ζητήθηκε μόνο
    // του πρώτου» δεν φαινόταν από το έγγραφο.
    expect(reconcilePublicShelf.mock.calls[0][2].filter((s) => s.material.kind === 'video').map((s) => s.privateStoragePath)).toEqual([
      POSTER_PATH,
      `${DIR}file_v2_poster.webp`,
    ]);
  });

  it('το εξώφυλλο είναι πλήρες `ListingImage`: διαστάσεις, παράγωγα κατά αύξον πλάτος, `altKey` του βίντεο', async () => {
    reconcilePublicVideoShelf.mockResolvedValue(report([publishedVideo('file_v1')]));
    reconcilePublicShelf.mockResolvedValue(report([shelfImage(VIDEO, 'file_v1', 'v1')]));

    const [video] = (await write(sources)).videos as PublicListing['videos'];

    expect(video.value.poster).toEqual({
      url: 'https://shelf/v1-1024.webp',
      width: 1024,
      height: 512,
      altKey: video.value.altKey,
      sources: [
        { url: 'https://shelf/v1-640.webp', width: 640 },
        { url: 'https://shelf/v1-1024.webp', width: 1024 },
      ],
    });
  });

  it('🔴 Ε7 το ράφι δεν δημοσίευσε καρέ (παλιό βίντεο, browser χωρίς αποκωδικοποιητή) ⇒ `poster: null`, το βίντεο ΜΕΝΕΙ', async () => {
    reconcilePublicVideoShelf.mockResolvedValue(report([publishedVideo('file_v1')]));
    reconcilePublicShelf.mockResolvedValue(report([shelfImage(PHOTO, 'file_p1', 'p')], 1));

    const [video] = (await write(sources)).videos as PublicListing['videos'];

    expect(video.value.url).toBe('https://shelf/aa.mp4');
    expect(video.value.poster).toBeNull();
  });

  // Η σκηνή κρατά το κουτί της από `width`/`height` και λέει τη διάρκεια ΠΡΙΝ το πάτημα — και τα τρία έρχονται από εδώ.
  // Καμία άγκυρα αυτής της σουίτας δεν τα διάβαζε πίσω από το γραμμένο έγγραφο (μετάλλαξη §10.11).
  it('🔴 Ε8 οι ΜΕΤΡΗΜΕΝΕΣ διαστάσεις και η διάρκεια του ραφιού φτάνουν αυτούσιες στο έγγραφο — με ή χωρίς εξώφυλλο', async () => {
    // Κατακόρυφο κλιπ κινητού, με διαστάσεις που ΔΙΑΦΕΡΟΥΝ από του εξωφύλλου του fixture (1024×512) σε κάθε άξονα.
    const vertical = { ...publishedVideo('file_v1'), width: 576, height: 1024, durationSec: 9.15 };
    reconcilePublicVideoShelf.mockResolvedValue(report([vertical]));
    reconcilePublicShelf.mockResolvedValue(report([shelfImage(VIDEO, 'file_v1', 'v1')]));

    const [video] = (await write(sources)).videos as PublicListing['videos'];

    expect(video.value.durationSec).toBe(9.15);
    expect(video.value.width).toBe(576);
    expect(video.value.height).toBe(1024);
    // Το εξώφυλλο κρατά τις ΔΙΚΕΣ του διαστάσεις: δεν αντικαθιστούν του βίντεο, ούτε το αντίστροφο.
    expect([video.value.poster?.width, video.value.poster?.height]).toEqual([1024, 512]);
  });
});
