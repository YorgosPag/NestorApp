/**
 * @jest-environment node
 *
 * @fileoverview 🏆 **Η ΑΓΚΥΡΑ ΤΗΣ ΜΑΖΙΚΗΣ ΑΝΑΠΑΡΑΓΩΓΗΣ** — η βελτίωση φτάνει σε όλους
 *   (ADR-841 §7 Α21.12).
 * @related services/mandate/rebuild-showcase-marks.service · showcase-mark-source
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ, ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΑΡΚΕΙ ΝΑ «ΤΡΕΞΕΙ ΧΩΡΙΣ ΣΦΑΛΜΑ»
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η επικίνδυνη αστοχία εδώ **δεν** είναι η εξαίρεση — είναι η **σιωπηλή παράλειψη**:
 * μια σάρωση που αναφέρει «ok» ενώ δεν άγγιξε κανένα σήμα. Γι' αυτό κάθε άγκυρα ρωτά
 * **αριθμό** *(πόσα;)* και **αποτέλεσμα στον κάδο** *(άλλαξε όντως;)*, ποτέ απλώς ότι
 * η κλήση επέστρεψε.
 *
 * 🔴 **ΚΑΙ Η ΚΡΙΣΙΜΗ ΕΙΝΑΙ Η Κ3**: ότι η σάρωση **ξαναπερνά από τον φρουρό κατοχής**.
 * Μια υλοποίηση που «εμπιστεύεται» τη σημείωση —*«εμείς τη γράψαμε, άρα είναι σωστή»*—
 * θα δημοσίευε **ξένο αρχείο ως δικό σου** αν η σημείωση αλλοιωνόταν ποτέ. Η σημείωση
 * είναι **υπόμνηση, ποτέ διαπιστευτήριο**.
 */

import sharp from 'sharp';

import { FakeShelfBucket } from '@/services/upload/__fixtures__/fake-shelf-bucket';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';

const shelf = new FakeShelfBucket();
const privateBucket = new FakeShelfBucket();
const db = new FakeFirestore();

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminStorage: () => ({ bucket: () => shelf }),
  getAdminBucket: () => privateBucket,
  getAdminFirestore: () => db,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { rebuildAllShowcaseMarks } = require('../rebuild-showcase-marks.service') as
  typeof import('../rebuild-showcase-marks.service');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { publishShowcaseMark } = require('../showcase-mark-publication') as
  typeof import('../showcase-mark-publication');

const SOURCES = 'showcase_mark_sources';
const A = 'comp_aaaa1111';
const B = 'comp_bbbb2222';

function privatePath(companyId: string, fileId = 'file_mark'): string {
  return `companies/${companyId}/entities/company/${companyId}/domains/admin/categories/photos/files/${fileId}.png`;
}

async function putPrivateImage(companyId: string, fileId = 'file_mark'): Promise<string> {
  const bytes = await sharp({
    create: { width: 400, height: 400, channels: 3, background: { r: 20, g: 60, b: 190 } },
  })
    .png()
    .toBuffer();

  const path = privatePath(companyId, fileId);
  privateBucket.put(path, bytes);
  return path;
}

/** Δημοσιεύει κανονικά — δηλαδή αφήνει **και** τη σημείωση, όπως στην παραγωγή. */
async function publishFor(companyId: string): Promise<void> {
  const path = await putPrivateImage(companyId);
  const outcome = await publishShowcaseMark(companyId, { kind: 'logo', privateStoragePath: path });
  if (outcome.kind !== 'published') throw new Error(`περίμενα δημοσίευση για ${companyId}`);
}

const asAdmin = (fake: FakeFirestore) =>
  fake as unknown as Parameters<typeof rebuildAllShowcaseMarks>[0];

beforeEach(() => {
  shelf.reset();
  privateBucket.reset();
  db.reset();
});

// ===========================================================================

describe('Κ1 — Η ΣΤΕΓΝΗ ΕΚΤΕΛΕΣΗ ΜΕΤΡΑ ΚΑΙ ΔΕΝ ΓΡΑΦΕΙ', () => {
  it('🔴 αναφέρει ΠΟΣΕΣ προελεύσεις ξέρουμε, χωρίς καμία εγγραφή', async () => {
    await publishFor(A);
    await publishFor(B);
    const before = shelf.keys().length;

    const report = await rebuildAllShowcaseMarks(asAdmin(db), true);

    expect(report).toMatchObject({ found: 2, republished: 0, refused: 0, dryRun: true });
    expect(shelf.keys().length).toBe(before);
  });

  it('🔑 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ — χωρίς σημειώσεις, το εργαλείο λέει ΜΗΔΕΝ, όχι «ok»', async () => {
    // Χωρίς αυτό, μια σάρωση που δεν βρίσκει τίποτα θα ήταν αδιάκριτη από επιτυχία.
    const report = await rebuildAllShowcaseMarks(asAdmin(db), true);
    expect(report.found).toBe(0);
  });
});

describe('🏆 Κ2 — Η ΕΚΤΕΛΕΣΗ ΞΑΝΑΔΗΜΟΣΙΕΥΕΙ ΚΑΘΕ ΣΗΜΑ ΠΟΥ ΞΕΡΟΥΜΕ', () => {
  it('🔴 δύο οργανισμοί ⇒ δύο επαναδημοσιεύσεις', async () => {
    await publishFor(A);
    await publishFor(B);

    const report = await rebuildAllShowcaseMarks(asAdmin(db), false);

    expect(report).toMatchObject({ found: 2, republished: 2, refused: 0, dryRun: false });
  });

  it('🔑 ΙΔΕΜΠΟΤΕΝΤΙΚΟ — δεύτερη εκτέλεση δεν αλλάζει ούτε ένα κλειδί', async () => {
    // Το ράφι είναι content-addressed: ίδια bytes ⇒ ίδιο sha256 ⇒ **καμία** εγγραφή.
    // Αν αυτό κοκκινίσει, η σάρωση **γεννά σκουπίδια** σε κάθε εκτέλεση.
    await publishFor(A);
    await rebuildAllShowcaseMarks(asAdmin(db), false);
    const first = [...shelf.keys()].sort();

    await rebuildAllShowcaseMarks(asAdmin(db), false);

    expect([...shelf.keys()].sort()).toEqual(first);
  });

  it('🔴 σβησμένο πρωτότυπο ⇒ ΟΝΟΜΑΣΜΕΝΗ άρνηση, και η σάρωση ΣΥΝΕΧΙΖΕΙ', async () => {
    // 🔑 **Μία αποτυχία δεν επιτρέπεται να αφήσει τα υπόλοιπα σήματα στην παλιά
    //    ποιότητα** — γι' αυτό ο βρόχος μετρά και προχωρά αντί να πετάξει.
    // ⚠️ Το «σβησμένο πρωτότυπο» στήνεται ως **σημείωση χωρίς αρχείο** αντί για διαγραφή
    //    από τον κάδο: είναι η **ίδια** κατάσταση —ο γραφέας δεν βρίσκει τα bytes— και
    //    δεν απαιτεί να μεγαλώσει το κοινό fixture για ένα μόνο test (N.18).
    await publishFor(B);

    db.seed(SOURCES, A, {
      companyId: A,
      kind: 'logo',
      privateStoragePath: privatePath(A, 'file_pou_svistike'),
      recordedAt: '2026-09-08T08:00:00.000Z',
    });

    const report = await rebuildAllShowcaseMarks(asAdmin(db), false);

    expect(report).toMatchObject({ found: 2, republished: 1, refused: 1 });
  });
});

describe('🔴 Κ3 — Η ΣΗΜΕΙΩΣΗ ΕΙΝΑΙ ΥΠΟΜΝΗΣΗ, ΠΟΤΕ ΔΙΑΠΙΣΤΕΥΤΗΡΙΟ', () => {
  it('🔴 αλλοιωμένη σημείωση που δείχνει σε ΞΕΝΟ χώρο ΔΕΝ δημοσιεύεται', async () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: κάνε τη σάρωση να γράφει κατευθείαν στο ράφι αντί να καλεί το
    //    `publishShowcaseMark` ⇒ ο `markSourceForCompany` παρακάμπτεται και **ξένο
    //    αρχείο γίνεται δημόσιο σήμα**. Αυτό είναι το σενάριο που ο κανόνας
    //    `showcase_mark_sources` κλείνει και από τη μεριά της **γραφής**.
    await putPrivateImage(B, 'file_xeno');

    db.seed(SOURCES, A, {
      companyId: A,
      kind: 'logo',
      // ⚠️ Μονοπάτι του **B**, καταγεγραμμένο ως προέλευση του **A**.
      privateStoragePath: privatePath(B, 'file_xeno'),
      recordedAt: '2026-09-08T08:00:00.000Z',
    });

    const report = await rebuildAllShowcaseMarks(asAdmin(db), false);

    expect(report).toMatchObject({ found: 1, republished: 0, refused: 1 });
    expect(shelf.keys()).toHaveLength(0);
  });

  it('🔑 σημείωση με ΑΓΝΩΣΤΟ είδος πετιέται πριν καν φτάσει στον γραφέα', async () => {
    db.seed(SOURCES, A, {
      companyId: A,
      kind: 'wordmark',
      privateStoragePath: privatePath(A),
      recordedAt: '2026-09-08T08:00:00.000Z',
    });

    expect((await rebuildAllShowcaseMarks(asAdmin(db), true)).found).toBe(0);
  });
});
