/**
 * @jest-environment node
 *
 * @fileoverview **Η ΑΓΚΥΡΑ ΤΗΣ ΠΡΑΞΗΣ ΣΕΙΡΑΣ ΤΟΥ ΓΡΑΦΕΙΟΥ** (ADR-841 §7 Α14.7 · Ο-16).
 * @related services/listings/agency-media-publication · lib/ordering/declared-order
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΡΩΤΑ ΑΥΤΗ Η ΣΟΥΙΤΑ ΠΟΥ ΚΑΜΙΑ ΑΛΛΗ ΔΕΝ ΡΩΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   **Έφτασε η ΠΡΑΞΗ ΤΟΥ ΑΝΘΡΩΠΟΥ από το `properties/{id}` ως το δημόσιο ράφι —
 *    και ΜΟΝΟ η σειρά, ποτέ η συμμετοχή;**
 *
 * Η αδελφή σουίτα (`agency-gallery-wiring`) φυλά ότι **τιμή** περνά το σύνορο· εδώ το
 * ερώτημα είναι στενότερο και πιο επικίνδυνο: το `publishedMediaOrder` είναι
 * **προαιρετικό** πεδίο σε ωμό έγγραφο, δηλαδή ο μεταγλωττιστής είναι **δομικά ανίκανος**
 * να δει ότι κανείς δεν το διαβάζει. Ίδιο σχήμα με τα τρία μετρημένα περιστατικά του ADR:
 *
 *   > **Ο φρουρός των υποχρεωτικών πεδίων είναι ο τύπος.**
 *   > **Ο φρουρός των ΠΡΟΑΙΡΕΤΙΚΩΝ είναι μόνο άγκυρα που περνά ΤΙΜΗ από το σύνορο.**
 *
 * 🔴 **ΚΑΙ Η ΔΕΥΤΕΡΗ ΕΡΩΤΗΣΗ ΕΙΝΑΙ ΤΟ ΑΣΦΑΛΕΣ ΣΚΕΛΟΣ**: *μπορεί η δήλωση να δημοσιεύσει;*
 * Αν μπορούσε, θα ήταν **δεύτερη πόρτα** δίπλα στους δύο φρουρούς της Α14.2 — δηλαδή
 * ένας πίνακας συμβολοσειρών σε έγγραφο ακινήτου θα παρέκαμπτε την **ανθρώπινη πράξη
 * εξουσιοδότησης**. Το Κ2 το κρατά κλειστό.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, sep } from 'path';

import { COLLECTIONS } from '@/config/firestore-collections';
import { PUBLISHED_MEDIA_LIMIT } from '@/services/upload/utils/storage-path-public-shelf';
import { promoteToFront, withDeclaredFirst } from '@/lib/ordering/declared-order';
import { withOwnerMediaFirst } from '@/lib/owner-property/owner-media-publication';
import type { OwnerPropertyMedia } from '@/types/owner-property';
import type { PublicShelfReport } from '../public-shelf.service';
import type { AgencyMediaCandidate } from '../agency-media-publication';

const reconcilePublicShelf = jest.fn<Promise<PublicShelfReport>, [string, readonly unknown[]]>();

jest.mock('../public-shelf.service', () => ({
  reconcilePublicShelf: (...args: [string, readonly unknown[]]) => reconcilePublicShelf(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { republishListing } = require('../publish-public-listing') as
  typeof import('../publish-public-listing');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  publishedAgencyMediaSources,
  orderedPublishableAgencyMedia,
  declaredMediaOrder,
  compareAgencyMediaForPublication,
} = require('../agency-media-publication') as typeof import('../agency-media-publication');

const LISTING = 'prop_a0000003-7777-4aaa-8aaa-000000000003';
const COMPANY = 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..');

/** Το ωμό `properties/{id}` — η δήλωση μπαίνει ανά δοκιμή. */
function property(over: Record<string, unknown> = {}) {
  return {
    id: LISTING,
    companyId: COMPANY,
    name: 'ΔΟΚΙΜΗ ΣΕΙΡΑΣ',
    type: 'apartment',
    commercialStatus: 'for-sale',
    areas: { gross: 70 },
    commercial: { askingPrice: 150000 },
    ...over,
  } as never;
}

function fileDoc(over: Partial<AgencyMediaCandidate> & { id: string }): AgencyMediaCandidate {
  return {
    entityType: 'property',
    storagePath: `companies/${COMPANY}/entities/property/${LISTING}/photos/${over.id}.jpg`,
    category: 'photos',
    classification: 'public',
    contentType: 'image/jpeg',
    status: 'ready',
    createdAt: '2026-08-20T10:00:00.000Z',
    lifecycleState: 'active',
    isDeleted: false,
    ...over,
  };
}

/** Τρία δημοσιεύσιμα, με **ρητά αύξοντα** χρόνο ⇒ η σειρά χωρίς δήλωση είναι a · b · c. */
const FILE_A = fileDoc({ id: 'file_a', createdAt: '2026-08-01T10:00:00.000Z' });
const FILE_B = fileDoc({ id: 'file_b', createdAt: '2026-08-02T10:00:00.000Z' });
const FILE_C = fileDoc({ id: 'file_c', createdAt: '2026-08-03T10:00:00.000Z' });

let filesInCollection: AgencyMediaCandidate[] = [];

const listingRef = { set: jest.fn(async () => undefined), delete: jest.fn(async () => undefined) };

function filesQuery() {
  const query = {
    where: () => query,
    get: async () => ({ docs: filesInCollection.map((f) => ({ id: f.id, data: () => f })) }),
  };
  return query;
}

const adminDb = {
  collection: (name: string) =>
    name === COLLECTIONS.FILES ? filesQuery() : { doc: () => listingRef },
} as never;

const resolveAgency = async () => ({ id: COMPANY, name: 'ΠΑΓΩΝΗΣ Α.Ε.' });

/** Τα **ονόματα αρχείων** που έφτασαν στο ράφι, στη σειρά που έφτασαν. */
function shelfIds(): string[] {
  const call = reconcilePublicShelf.mock.calls[0];
  return ((call?.[1] ?? []) as { privateStoragePath: string }[]).map((source) =>
    source.privateStoragePath.split('/').slice(-1)[0].replace('.jpg', ''),
  );
}

function ids(sources: readonly { privateStoragePath: string }[]): string[] {
  return sources.map((s) => s.privateStoragePath.split('/').slice(-1)[0].replace('.jpg', ''));
}

beforeEach(() => {
  filesInCollection = [];
  listingRef.set.mockClear();
  listingRef.delete.mockClear();
  reconcilePublicShelf.mockReset();
  reconcilePublicShelf.mockResolvedValue({
    outcome: 'reconciled',
    published: [],
    removed: 0,
    rejected: 0,
  });
});

// ============================================================================
// Κ1 — Η ΠΡΑΞΗ ΤΑΞΙΔΕΥΕΙ: `properties/{id}` → γραφέας → ράφι
// ============================================================================

describe('Κ1 — Η ΠΡΑΞΗ ΤΟΥ ΑΝΘΡΩΠΟΥ ΦΤΑΝΕΙ ΣΤΟ ΡΑΦΙ', () => {
  it('🔴 δηλωμένη φωτογραφία φεύγει ΠΡΩΤΗ, παρότι είναι η ΝΕΟΤΕΡΗ', async () => {
    filesInCollection = [FILE_A, FILE_B, FILE_C];

    const outcome = await republishListing(
      adminDb,
      LISTING,
      property({ publishedMediaOrder: ['file_c'] }),
      resolveAgency,
    );

    expect(outcome).toBe('published');
    // ⚠️ Χωρίς τη δήλωση η σειρά θα ήταν a · b · c (χρόνος). Η πράξη την ανατρέπει.
    expect(shelfIds()).toEqual(['file_c', 'file_a', 'file_b']);
  });

  it('🔴 ΧΩΡΙΣ δήλωση, η σειρά είναι ΑΚΡΙΒΩΣ η προηγούμενη συμπεριφορά (χρόνος)', async () => {
    filesInCollection = [FILE_C, FILE_A, FILE_B];

    await republishListing(adminDb, LISTING, property(), resolveAgency);

    expect(shelfIds()).toEqual(['file_a', 'file_b', 'file_c']);
  });

  it('🔴 δήλωση ΠΟΛΛΩΝ ⇒ φεύγουν ΣΤΗ ΣΕΙΡΑ ΤΗΣ ΔΗΛΩΣΗΣ, ουρά από πίσω', async () => {
    filesInCollection = [FILE_A, FILE_B, FILE_C];

    await republishListing(
      adminDb,
      LISTING,
      property({ publishedMediaOrder: ['file_c', 'file_b'] }),
      resolveAgency,
    );

    expect(shelfIds()).toEqual(['file_c', 'file_b', 'file_a']);
  });
});

// ============================================================================
// Κ2 — Η ΔΗΛΩΣΗ ΔΕΝ ΕΙΝΑΙ ΣΥΜΜΕΤΟΧΗ (το ασφαλές σκέλος)
// ============================================================================

describe('Κ2 — Η ΔΗΛΩΣΗ ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΔΗΜΟΣΙΕΥΣΕΙ ΤΙΠΟΤΑ', () => {
  it('🔴 δηλωμένο αρχείο που ΔΕΝ είναι `public` ΔΕΝ φεύγει — ο φρουρός #1 δεν παρακάμπτεται', async () => {
    const secret = fileDoc({ id: 'file_secret', classification: 'internal' });
    filesInCollection = [FILE_A, secret];

    await republishListing(
      adminDb,
      LISTING,
      property({ publishedMediaOrder: ['file_secret'] }),
      resolveAgency,
    );

    expect(shelfIds()).toEqual(['file_a']);
  });

  it('🔴 δηλωμένη ΚΑΤΟΨΗ (`floorplans`) ΔΕΝ φεύγει — ο φρουρός #2 δεν παρακάμπτεται', async () => {
    const plan = fileDoc({ id: 'file_plan', category: 'floorplans' });
    filesInCollection = [FILE_A, plan];

    await republishListing(
      adminDb,
      LISTING,
      property({ publishedMediaOrder: ['file_plan', 'file_a'] }),
      resolveAgency,
    );

    expect(shelfIds()).toEqual(['file_a']);
  });

  it('🔴 δηλωμένο αρχείο στα ΣΚΟΥΠΙΔΙΑ ΔΕΝ φεύγει', async () => {
    const trashed = fileDoc({ id: 'file_trash', isDeleted: true });
    filesInCollection = [FILE_A, trashed];

    await republishListing(
      adminDb,
      LISTING,
      property({ publishedMediaOrder: ['file_trash'] }),
      resolveAgency,
    );

    expect(shelfIds()).toEqual(['file_a']);
  });
});

// ============================================================================
// Κ3 — ΝΤΕΤΕΡΜΙΝΙΣΜΟΣ ΣΕ ΚΑΘΕ ΕΙΣΟΔΟ (ο σκληρός περιορισμός της Α14.7.3)
// ============================================================================

describe('Κ3 — Η ΣΕΙΡΑ ΜΕΝΕΙ ΟΛΙΚΗ ΚΑΙ ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΗ', () => {
  const FILES = [FILE_A, FILE_B, FILE_C];

  it('🔴 ΑΓΝΩΣΤΗ ταυτότητα αγνοείται — καμία τρύπα, ουρά ανέπαφη', () => {
    expect(ids(publishedAgencyMediaSources(FILES, ['file_ghost', 'file_b']))).toEqual([
      'file_b',
      'file_a',
      'file_c',
    ]);
  });

  it('🔴 ΔΙΠΛΟΤΥΠΗ ταυτότητα μετρά ΜΙΑ φορά', () => {
    expect(ids(publishedAgencyMediaSources(FILES, ['file_c', 'file_c', 'file_a']))).toEqual([
      'file_c',
      'file_a',
      'file_b',
    ]);
  });

  it('🔴 δύο κλήσεις με την ΙΔΙΑ είσοδο δίνουν ΤΟ ΙΔΙΟ αποτέλεσμα', () => {
    const once = ids(publishedAgencyMediaSources(FILES, ['file_b']));
    const twice = ids(publishedAgencyMediaSources(FILES, ['file_b']));
    expect(once).toEqual(twice);
  });

  it('🔴 η ΕΙΣΟΔΟΣ δεν μεταβάλλεται — ο καλών δεν χάνει τη σειρά του', () => {
    const input = [FILE_C, FILE_A, FILE_B];
    const before = input.map((f) => f.id);
    publishedAgencyMediaSources(input, ['file_b']);
    expect(input.map((f) => f.id)).toEqual(before);
  });

  it('🔴 ΙΣΟΠΑΛΙΑ ΧΡΟΝΟΥ λύνεται στο `id`, και ΜΕΤΑ τη δήλωση', () => {
    const same = '2026-08-05T10:00:00.000Z';
    const x = fileDoc({ id: 'file_x', createdAt: same });
    const y = fileDoc({ id: 'file_y', createdAt: same });

    expect(ids(publishedAgencyMediaSources([y, x], []))).toEqual(['file_x', 'file_y']);
    expect(ids(publishedAgencyMediaSources([y, x], ['file_y']))).toEqual(['file_y', 'file_x']);
  });
});

// ============================================================================
// Κ4 — ΤΟ ΟΡΙΟ ΚΟΒΕΙ **ΜΕΤΑ** ΤΗ ΣΕΙΡΑ, ΚΑΙ ΜΕΝΕΙ **ΕΝΑ**
// ============================================================================

describe('Κ4 — ΤΟ ΟΡΙΟ', () => {
  /** `PUBLISHED_MEDIA_LIMIT + 6` δημοσιεύσιμα, ο τελευταίος είναι ο **νεότερος**. */
  const MANY = Array.from({ length: PUBLISHED_MEDIA_LIMIT + 6 }, (_, i) =>
    fileDoc({
      id: `file_${String(i).padStart(3, '0')}`,
      createdAt: `2026-08-${String(1 + i).padStart(2, '0')}T10:00:00.000Z`,
    }),
  );
  const LAST = MANY[MANY.length - 1].id;

  it('🔴 δηλωμένο αρχείο ΕΚΤΟΣ ορίου χρονικά ΦΕΥΓΕΙ, και είναι ΠΡΩΤΟ', () => {
    const out = ids(publishedAgencyMediaSources(MANY, [LAST]));
    expect(out[0]).toBe(LAST);
    expect(out).toHaveLength(PUBLISHED_MEDIA_LIMIT);
  });

  it('🔴 ΧΩΡΙΣ δήλωση, το ίδιο αρχείο ΔΕΝ φεύγει καθόλου — άρα το κόψιμο είναι ΜΕΤΑ', () => {
    expect(ids(publishedAgencyMediaSources(MANY, []))).not.toContain(LAST);
  });

  it('🔴 ΚΑΝΕΝΑ δεύτερο όριο: δήλωση μεγαλύτερη του ορίου δεν μεγαλώνει το ράφι', () => {
    const all = MANY.map((f) => f.id);
    expect(ids(publishedAgencyMediaSources(MANY, all))).toHaveLength(PUBLISHED_MEDIA_LIMIT);
  });
});

// ============================================================================
// Κ5 — Η ΟΘΟΝΗ ΚΑΙ ΤΟ ΡΑΦΙ ΛΕΝΕ ΤΟ ΙΔΙΟ ΠΡΑΓΜΑ
// ============================================================================

describe('Κ5 — Η ΟΘΟΝΗ ΔΕΙΧΝΕΙ ΑΚΡΙΒΩΣ Ο,ΤΙ ΦΕΥΓΕΙ', () => {
  it('🔴 `orderedPublishableAgencyMedia` και `publishedAgencyMediaSources` συμφωνούν πάντα', () => {
    const mixed = [
      FILE_C,
      fileDoc({ id: 'file_internal', classification: 'internal' }),
      FILE_A,
      fileDoc({ id: 'file_plan', category: 'floorplans' }),
      FILE_B,
    ];
    const declared = ['file_b', 'file_plan'];

    const screen = orderedPublishableAgencyMedia(mixed, declared).map((f) => f.id);
    const shelf = ids(publishedAgencyMediaSources(mixed, declared));

    expect(screen).toEqual(shelf);
    expect(screen).toEqual(['file_b', 'file_a', 'file_c']);
  });
});

// ============================================================================
// Κ6 — Η ΑΝΑΓΝΩΣΗ ΤΟΥ ΩΜΟΥ ΠΕΔΙΟΥ (`.passthrough()`, Α14.7.5)
// ============================================================================

describe('Κ6 — `declaredMediaOrder` ΔΕΝ ΕΜΠΙΣΤΕΥΕΤΑΙ ΤΟΝ ΔΙΣΚΟ', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['αριθμός', 42],
    ['συμβολοσειρά', 'file_a'],
    ['αντικείμενο', { 0: 'file_a' }],
  ])('🔴 %s ⇒ καμία δήλωση', (_label, value) => {
    expect(declaredMediaOrder(value)).toEqual([]);
  });

  it('🔴 κρατά ΜΟΝΟ μη-κενές συμβολοσειρές, στη σειρά τους', () => {
    expect(declaredMediaOrder(['file_a', 7, '', '   ', null, 'file_b'])).toEqual([
      'file_a',
      'file_b',
    ]);
  });

  it('🔴 σκουπίδι στο πεδίο ΔΕΝ ρίχνει τη δημοσίευση της αγγελίας', async () => {
    filesInCollection = [FILE_A];

    const outcome = await republishListing(
      adminDb,
      LISTING,
      property({ publishedMediaOrder: { nonsense: true } }),
      resolveAgency,
    );

    expect(outcome).toBe('published');
    expect(shelfIds()).toEqual(['file_a']);
  });
});

// ============================================================================
// Κ7 — Η ΠΡΑΞΗ, ΚΑΙ ΟΙ ΔΥΟ ΠΟΛΙΤΙΚΕΣ ΓΙΑ ΤΟ ΑΠΟΝ
// ============================================================================

describe('Κ7 — «ΝΑ ΜΠΕΙ ΠΡΩΤΗ»', () => {
  it('🔴 ΑΠΟΝ κλειδί ⇒ ΜΠΑΙΝΕΙ ΜΠΡΟΣΤΑ (η δήλωση είναι αραιή — αυτή ΕΙΝΑΙ η πράξη)', () => {
    expect(withDeclaredFirst([], 'file_c')).toEqual(['file_c']);
    expect(withDeclaredFirst(['file_a'], 'file_c')).toEqual(['file_c', 'file_a']);
  });

  it('🔴 ΠΑΡΟΝ κλειδί ⇒ ΜΕΤΑΘΕΣΗ, όχι διπλότυπο', () => {
    expect(withDeclaredFirst(['file_a', 'file_b', 'file_c'], 'file_c')).toEqual([
      'file_c',
      'file_a',
      'file_b',
    ]);
  });

  it('🔴 ΙΔΕΜΠΟΤΕΝΤ: δεύτερη κλήση δεν αλλάζει τίποτα', () => {
    const once = withDeclaredFirst(['file_a', 'file_b'], 'file_b');
    expect(withDeclaredFirst(once, 'file_b')).toEqual(once);
  });

  it('🔴 ΤΑ ΥΠΟΛΟΙΠΑ ΚΡΑΤΟΥΝ ΤΗ ΣΧΕΤΙΚΗ ΤΟΥΣ ΣΕΙΡΑ — μετάθεση, ποτέ φιλτράρισμα', () => {
    expect(promoteToFront(['a', 'b', 'c', 'd'], (x) => x, 'c')).toEqual(['c', 'a', 'b', 'd']);
  });

  it('🔴 Ο ΙΔΙΩΤΗΣ ΔΕΝ ΑΛΛΑΞΕ: άγνωστο μονοπάτι ⇒ Ο ΙΔΙΟΣ πίνακας (καμία σιωπηλή προσθήκη)', () => {
    const media = [
      { storagePath: 'owner/one.jpg', published: true },
      { storagePath: 'owner/two.jpg', published: true },
    ] as unknown as OwnerPropertyMedia[];

    expect(withOwnerMediaFirst(media, 'owner/nope.jpg')).toBe(media);
    expect(withOwnerMediaFirst(media, 'owner/two.jpg').map((m) => m.storagePath)).toEqual([
      'owner/two.jpg',
      'owner/one.jpg',
    ]);
  });
});

// ============================================================================
// Κ8 — ΚΛΕΙΣΤΟΤΗΤΑ: ΚΑΝΕΝΑΣ ΔΕΥΤΕΡΟΣ ΔΡΟΜΟΣ ΠΟΥ ΧΑΝΕΙ ΤΗΝ ΠΡΑΞΗ
// ============================================================================

/**
 * 🔴 **ΤΟ ΜΑΘΗΜΑ ΤΗΣ Α18.14, ΕΦΑΡΜΟΣΜΕΝΟ**: κριτήριο που ρωτά *«βρήκα αρκετά;»* μπορεί να
 * γεννηθεί **τυφλό**. Η θεραπεία είναι **κλειστότητα** — *«**κάθε** καλών περνά τη
 * δήλωση»* — όχι πλήθος.
 *
 * ⚠️ Χωρίς αυτό, ένας δεύτερος γραφέας αγγελίας *(π.χ. μια μελλοντική μαζική
 * επανασύνθεση που φτιάχνει τον δικό της επιλυτή)* θα δημοσίευε **αγνοώντας** την πράξη
 * του ανθρώπου, και **καμία** από τις παραπάνω ομάδες δεν θα το έβλεπε.
 */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe('Κ8 — ΚΛΕΙΣΤΟΤΗΤΑ ΤΩΝ ΚΑΛΟΥΝΤΩΝ', () => {
  const FILES = sourceFiles(join(REPO_ROOT, 'src'));

  /** «Πόσα αρχεία κοιτάχτηκαν;» — ο **παρονομαστής**, ώστε το πράσινο να μη σημαίνει «κανείς δεν κοίταξε». */
  it('🔴 ΠΑΡΟΝΟΜΑΣΤΗΣ: η σάρωση βλέπει ολόκληρο το `src/`', () => {
    expect(FILES.length).toBeGreaterThan(5000);
    expect(FILES.some((f) => f.split(sep).join('/').endsWith('src/services/listings/publish-public-listing.ts'))).toBe(true);
  });

  it('🔴 ΚΑΘΕ καλών του κανόνα δίνει δήλωση σειράς — ή είναι ο ΙΔΙΟΣ ο κανόνας', () => {
    const offenders: string[] = [];

    for (const file of FILES) {
      const rel = file.split(sep).join('/').split('src/')[1];
      if (rel === 'services/listings/agency-media-publication.ts') continue;

      const text = readFileSync(file, 'utf8');
      for (const call of ['publishedAgencyMediaSources(', 'orderedPublishableAgencyMedia(']) {
        let at = text.indexOf(call);
        while (at !== -1) {
          // Ένα πέρασμα ισορροπίας παρενθέσεων — αρκεί, γιατί τα ορίσματα εδώ δεν
          // περιέχουν ποτέ παρένθεση μέσα σε συμβολοσειρά.
          let depth = 0;
          let end = at + call.length - 1;
          for (; end < text.length; end += 1) {
            if (text[end] === '(') depth += 1;
            else if (text[end] === ')') {
              depth -= 1;
              if (depth === 0) break;
            }
          }
          const args = text.slice(at + call.length, end);
          if (!args.includes(',')) offenders.push(`${rel}: ${call}…)`);
          at = text.indexOf(call, end);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('🔴 ΚΑΘΕ επιλυτής φωτογραφιών δέχεται ΤΡΙΑ ορίσματα — καμία σιωπηλή απώλεια', () => {
    const reader = readFileSync(
      join(REPO_ROOT, 'src', 'services', 'listings', 'agency-media.reader.ts'),
      'utf8',
    );
    expect(reader).toContain('declaredOrder: AgencyMediaOrderDeclaration');

    const writer = readFileSync(
      join(REPO_ROOT, 'src', 'services', 'listings', 'publish-public-listing.ts'),
      'utf8',
    );
    expect(writer).toContain('declaredMediaOrder(property.publishedMediaOrder)');
  });
});

// ============================================================================
// Κ9 — Ο ΣΥΓΚΡΙΤΗΣ ΤΗΣ Α14.3 ΖΕΙ ΑΚΟΜΗ (δεν διαγράφηκε «τώρα που υπάρχει η δήλωση»)
// ============================================================================

/**
 * 🔴 **ΑΥΤΗ Η ΟΜΑΔΑ ΓΡΑΦΤΗΚΕ ΔΥΟ ΦΟΡΕΣ, ΚΑΙ Η ΠΡΩΤΗ ΗΤΑΝ ΤΥΦΛΗ** *(μετρημένο, Μ11)*.
 *
 * Η αρχική εκδοχή έκρινε μόνο ζεύγη όπου η **ταυτότητα** συμφωνούσε με τον **χρόνο**
 * *(`file_a` παλιότερο **και** αλφαβητικά πρώτο)*. Μετάλλαξη που έσβηνε **ολόκληρο** τον
 * χρόνο *(`const byInstant = 0`)* **ΕΠΕΖΗΣΕ**: το tie-break στο `id` έδινε **την ίδια**
 * απάντηση, οπότε κανένα κριτήριο δεν μπορούσε να δει τη διαφορά.
 *
 * 🔑 **Η θεραπεία είναι ζεύγος όπου τα δύο κλειδιά ΔΙΑΦΩΝΟΥΝ.** Ένα κριτήριο σειράς που
 * δεν έχει τέτοιο ζεύγος **δεν δοκιμάζει το πρωτεύον κλειδί** — δοκιμάζει το δευτερεύον
 * και το λέει «σειρά».
 */
describe('Κ9 — Η ΟΥΡΑ ΕΧΕΙ ΑΚΟΜΗ ΤΟΝ ΔΙΚΟ ΤΗΣ ΚΑΝΟΝΑ', () => {
  /** Ο χρόνος λέει «πρώτο το ωμέγα»· η ταυτότητα λέει «πρώτο το άλφα». Διαφωνούν. */
  const OLD_OMEGA = fileDoc({ id: 'file_zzz', createdAt: '2026-08-01T10:00:00.000Z' });
  const NEW_ALPHA = fileDoc({ id: 'file_aaa', createdAt: '2026-08-09T10:00:00.000Z' });

  it('🔴 ΤΟ ΠΡΩΤΕΥΟΝ ΚΛΕΙΔΙ ΕΙΝΑΙ Ο ΧΡΟΝΟΣ — και το ζεύγος το ΞΕΧΩΡΙΖΕΙ από την ταυτότητα', () => {
    expect(compareAgencyMediaForPublication(OLD_OMEGA, NEW_ALPHA)).toBeLessThan(0);
    expect(compareAgencyMediaForPublication(NEW_ALPHA, OLD_OMEGA)).toBeGreaterThan(0);
  });

  it('🔴 ΚΑΙ ΤΟ ΙΔΙΟ ΖΕΥΓΟΣ ΤΑΞΙΔΕΥΕΙ ΩΣ ΤΟ ΡΑΦΙ', async () => {
    filesInCollection = [NEW_ALPHA, OLD_OMEGA];
    await republishListing(adminDb, LISTING, property(), resolveAgency);
    expect(shelfIds()).toEqual(['file_zzz', 'file_aaa']);
  });

  it('🔴 Η ΤΑΥΤΟΤΗΤΑ ΕΙΝΑΙ ΜΟΝΟ ΤΕΡΜΑΤΙΣΜΟΣ — μιλά ΜΟΝΟ σε ισοπαλία χρόνου', () => {
    const same = '2026-08-05T10:00:00.000Z';
    const x = fileDoc({ id: 'file_x', createdAt: same });
    const y = fileDoc({ id: 'file_y', createdAt: same });
    expect(compareAgencyMediaForPublication(x, y)).toBeLessThan(0);
    expect(compareAgencyMediaForPublication(x, x)).toBe(0);
  });

  it('🔴 ΚΑΙ Η ΔΗΛΩΣΗ ΝΙΚΑ ΚΑΙ ΤΑ ΔΥΟ ΚΛΕΙΔΙΑ', () => {
    expect(ids(publishedAgencyMediaSources([OLD_OMEGA, NEW_ALPHA], ['file_aaa']))).toEqual([
      'file_aaa',
      'file_zzz',
    ]);
  });
});
