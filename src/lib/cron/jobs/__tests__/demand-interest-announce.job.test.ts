/**
 * =============================================================================
 * ΑΓΚΥΡΕΣ ΤΗΣ ΣΚΑΝΔΑΛΗΣ — ADR-777 §8.23
 * =============================================================================
 *
 * **Το ερώτημα αυτού του αρχείου δεν είναι «στέλνει σωστά;» — είναι «ΤΟΝ ΚΑΛΕΙ
 * ΚΑΝΕΙΣ;».**
 *
 * Ο ειδοποιητής είχε **233 πράσινα tests** και **μηδέν καταναλωτές**. Καμία από
 * εκείνες τις άγκυρες δεν μπορούσε να κοκκινίσει, γιατί όλες ρωτούσαν τη *μηχανή*
 * και το ελάττωμα ήταν στη *σύνδεση*. Ένας μηχανισμός που κανείς δεν ξυπνά είναι
 * αδρανής φρουρός (ADR-749 §5) — και ένα πράσινο test πάνω του είναι ακριβώς το
 * σχήμα «0 = κανείς δεν κοίταξε» που κυνηγά όλο το έργο.
 *
 * ⚠️ **Η Μ0 ρωτά ΠΡΑΓΜΑΤΙΚΟ ΙΣΤΟΡΙΚΟ ΚΩΔΙΚΑ**, όχι fixture: το ελάττωμα ήταν η
 * *απουσία* μιας γραμμής, και η απουσία δεν κατασκευάζεται πειστικά.
 *
 * @see ADR-777 §8.23
 * @see ADR-740 — το πρόγραμμα ζει στο src/config/cron-schedule.ts
 */

import { execFileSync } from 'node:child_process';

const announceInterestToOwners = jest.fn();
const getAdminFirestore = jest.fn(() => ({ __brand: 'admin-db' }));

jest.mock('@/services/demand/interest-notifier.service', () => ({
  announceInterestToOwners: (...args: unknown[]) => announceInterestToOwners(...args),
}));
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => getAdminFirestore(),
}));

// Τα υπόλοιπα job modules παρακάμπτονται: το ζητούμενο είναι η **σύνδεση** αυτής της
// εργασίας, όχι το να συρθεί ολόκληρο το πρόγραμμα με firebase-admin μέσα σε unit test.
jest.mock('@/lib/cron/jobs/ai-learning.job', () => ({ runAiLearning: jest.fn() }));
jest.mock('@/lib/cron/jobs/backup.job', () => ({ runBackup: jest.fn() }));
jest.mock('@/lib/cron/jobs/email-ingestion.job', () => ({ runEmailIngestion: jest.fn() }));
jest.mock('@/lib/cron/jobs/file-purge.job', () => ({ runFilePurge: jest.fn() }));
jest.mock('@/lib/cron/jobs/oauth-cleanup.job', () => ({ runOAuthCleanup: jest.fn() }));
jest.mock('@/lib/cron/jobs/onboarding-reminder.job', () => ({ runOnboardingReminder: jest.fn() }));
jest.mock('@/lib/cron/jobs/overdue-alerts.job', () => ({ runOverdueAlerts: jest.fn() }));
jest.mock('@/lib/cron/jobs/purge-deleted-entities.job', () => ({
  runPurgeDeletedEntities: jest.fn(),
}));
jest.mock('@/lib/cron/jobs/outbound-email-flush.job', () => ({
  runOutboundEmailFlush: jest.fn(),
}));

// eslint-disable-next-line import/first -- τα mocks πρέπει να δηλωθούν πριν τα imports
import { CRON_SCHEDULE, findCronJob } from '@/config/cron-schedule';
// eslint-disable-next-line import/first
import { runDemandInterestAnnounce } from '@/lib/cron/jobs/demand-interest-announce.job';
// eslint-disable-next-line import/first
import { isEnabledCronJob } from '@/types/cron-schedule';
// eslint-disable-next-line import/first
import type { AnnouncementReport } from '@/services/demand/interest-notifier.service';

const SLUG = 'demand-interest-announce';

/**
 * Το commit **πριν** τη σκανδάλη.
 *
 * ⚠️ **Καρφωμένο, ΠΟΤΕ `HEAD`.** Το `HEAD` μετακινείται — και μάλιστα από **άλλον
 * agent στο ίδιο working tree** — οπότε μια άγκυρα δεμένη σε αυτό θα αυτοακυρωνόταν
 * σιωπηλά την επόμενη φορά που κάποιος έκανε commit.
 */
const BEFORE_TRIGGER_COMMIT = 'e5d78a0b';

/** `git show <ref>:<path>` με **ρητή αποτυχία** σε κενή απάντηση. */
function gitShowAt(ref: string, pathInRepo: string): string {
  const out = execFileSync('git', ['show', `${ref}:${pathInRepo}`], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (out.trim().length === 0) {
    throw new Error(
      `gitShowAt: κενή απάντηση για ${ref}:${pathInRepo} — ` +
        'η άγκυρα θα περνούσε ΧΩΡΙΣ να κοιτάξει τίποτα.',
    );
  }
  return out;
}

/** Ο κώδικας **πριν** τη σκανδάλη — από καρφωμένο commit. */
function gitShow(pathInRepo: string): string {
  return gitShowAt(BEFORE_TRIGGER_COMMIT, pathInRepo);
}

/**
 * Ο κώδικας όπως θα μπει στο **επόμενο** commit — από το **ευρετήριο** του git.
 *
 * ⚠️ **Χρειάζεται ξεχωριστή αυθεντία, και ο λόγος είναι μετρημένος**: ο ειδοποιητής
 * γράφτηκε στις 2026-08-12 και είναι **σταδιοποιημένος χωρίς commit** — υπάρχει στο
 * ευρετήριο, **όχι** στο `e5d78a0b`. Ένα `git show <commit>:` πάνω του απαντά *«exists
 * on disk, but not in <commit>»*, και μια άγκυρα που «διορθωνόταν» πιάνοντας εκείνο το
 * σφάλμα θα γινόταν σιωπηλά πράσινη — το ακριβές σχήμα που το ADR-771 πλήρωσε.
 *
 * Το ευρετήριο είναι η **ίδια** αυθεντία που διάλεξε το CHECK 3.49 και για τον ίδιο
 * λόγο: είναι «ό,τι θα περιέχει το commit», ενώ ο δίσκος βλέπει και ό,τι δεν θα μπει.
 */
function gitShowIndex(pathInRepo: string): string {
  return gitShowAt('', pathInRepo);
}

function report(overrides: Partial<AnnouncementReport> = {}): AnnouncementReport {
  return {
    announced: 0,
    alreadyKnown: 0,
    noNews: 0,
    optedOut: 0,
    considered: 0,
    truncated: false,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  getAdminFirestore.mockReturnValue({ __brand: 'admin-db' });
});

// =============================================================================
// Μ0 — Η ΒΑΘΜΟΝΟΜΗΣΗ: Ο ΕΙΔΟΠΟΙΗΤΗΣ ΗΤΑΝ ΠΡΑΓΜΑΤΙΚΑ ΑΣΥΝΔΕΤΟΣ
// =============================================================================

describe('🔴 Μ0 — πριν το §8.23 κανείς δεν τραβούσε τη σκανδάλη', () => {
  it('το πρόγραμμα του καρφωμένου commit ΔΕΝ δηλώνει την εργασία', () => {
    expect(gitShow('src/config/cron-schedule.ts')).not.toContain(SLUG);
  });

  it('🔑 και ο ίδιος ο ειδοποιητής ΥΠΗΡΧΕ ήδη — το κενό ήταν η σύνδεση, όχι η μηχανή', () => {
    // Αν έλειπε και η μηχανή, η δουλειά θα ήταν «γράψε ειδοποιητή». Δεν ήταν: ήταν
    // γραμμένη, δοκιμασμένη και **ασύνδετη**. Διαβάζεται από το ευρετήριο, γιατί εκεί
    // ζει — δες `gitShowIndex`.
    const notifier = gitShowIndex('src/services/demand/interest-notifier.service.ts');
    expect(notifier).toContain('export async function announceInterestToOwners');
  });

  it('⚠️ και ο μηχανισμός εκτέλεσης ΥΠΗΡΧΕ ήδη — γι΄ αυτό δεν χτίστηκε trigger', () => {
    // Η επιλογή «cron αντί για Firestore trigger» στηρίζεται σε αυτό ακριβώς: ο
    // dispatcher, το lease και ο monitor ήταν ήδη σε παραγωγή πριν αγγιχτεί τίποτα.
    const schedule = gitShow('src/config/cron-schedule.ts');
    expect(schedule).toContain('CRON_SCHEDULE');
    expect(schedule).toContain("slug: 'backup'");
  });
});

// =============================================================================
// Κ — Η ΣΥΝΔΕΣΗ: ΤΟ ΠΡΟΓΡΑΜΜΑ ΟΝΤΩΣ ΦΤΑΝΕΙ ΣΤΟΝ ΕΙΔΟΠΟΙΗΤΗ
// =============================================================================

describe('Κ — η σκανδάλη είναι δεμένη, και η απόδειξη είναι ΕΚΤΕΛΕΣΗ', () => {
  it('Κ1 — η εργασία είναι δηλωμένη ΚΑΙ ενεργή', () => {
    const job = findCronJob(SLUG);
    expect(job).toBeDefined();
    expect(job && isEnabledCronJob(job)).toBe(true);
  });

  it('Κ2 🔑 — το `run` του ΠΡΟΓΡΑΜΜΑΤΟΣ καλεί τον ειδοποιητή', async () => {
    // ⚠️ Η κρίσιμη άγκυρα: δεν καλείται η `runDemandInterestAnnounce` απευθείας αλλά
    // **ό,τι κρατά το μητρώο**. Μια εργασία που υπάρχει ως αρχείο αλλά είναι δεμένη σε
    // λάθος συνάρτηση θα περνούσε κάθε άλλο test — και δεν θα έστελνε ποτέ τίποτα.
    const job = findCronJob(SLUG);
    if (!job || !isEnabledCronJob(job)) throw new Error('Κ2: η εργασία δεν είναι ενεργή');

    announceInterestToOwners.mockResolvedValue(report({ announced: 2, considered: 2 }));
    await job.run();

    expect(announceInterestToOwners).toHaveBeenCalledTimes(1);
  });

  it('Κ3 — ο ειδοποιητής παίρνει τη ΒΑΣΗ ΔΙΑΧΕΙΡΙΣΤΗ, όχι πελάτη', async () => {
    // Ο πελάτης δομικά δεν επιτρέπεται να γράψει ειδοποίηση σε ξένο χρήστη· αυτός
    // ήταν ο ένας από τους δύο λόγους που η σκανδάλη δεν μπορούσε να ζει στον πελάτη.
    announceInterestToOwners.mockResolvedValue(report());
    await runDemandInterestAnnounce();

    expect(getAdminFirestore).toHaveBeenCalledTimes(1);
    expect(announceInterestToOwners).toHaveBeenCalledWith({ __brand: 'admin-db' });
  });

  it('Κ4 — υπάρχει ΑΚΡΙΒΩΣ ΜΙΑ εγγραφή για αυτόν τον ειδοποιητή', () => {
    // Δεύτερη εγγραφή = διπλή σάρωση. Δεν θα έστελνε διπλό email (το `dedupeKey` το
    // σταματά), αλλά θα διπλασίαζε τις αναγνώσεις και θα έκρυβε ποια από τις δύο έτρεξε.
    expect(CRON_SCHEDULE.filter((job) => job.slug === SLUG)).toHaveLength(1);
  });
});

// =============================================================================
// Λ — ΛΟΓΙΣΤΙΚΗ: ΚΑΘΕ ΚΑΔΟΣ ΕΚΠΕΜΠΕΤΑΙ, ΚΑΙ ΣΤΟ ΜΗΔΕΝ
// =============================================================================

describe('Λ — τα metrics δεν κρύβουν κάδο', () => {
  it('Λ1 🔴 — και οι έξι κάδοι υπάρχουν όταν ΟΛΑ είναι μηδέν', async () => {
    // ⚠️ Αυτό είναι η Π2 στη γραμμή του log: ένα `announced` που **λείπει** διαβάζεται
    // ως «δεν στάλθηκε τίποτα», αλλά διαβάζεται **εξίσου** ως «δεν μέτρησε κανείς».
    announceInterestToOwners.mockResolvedValue(report());
    const result = await runDemandInterestAnnounce();

    expect(Object.keys(result.metrics ?? {}).sort()).toEqual([
      'alreadyKnown',
      'announced',
      'considered',
      'noNews',
      'optedOut',
      'truncated',
    ]);
    expect(result.metrics?.announced).toBe(0);
  });

  it('Λ2 — το `truncated` ταξιδεύει ως αριθμός, γιατί το συμβόλαιο είναι αριθμητικό', async () => {
    // Ένα boolean εδώ θα πεταγόταν σιωπηλά από το `Record<string, number>` — δηλαδή
    // ακριβώς η περίπτωση «ιδιοκτήτες που δεν εξετάστηκαν ποτέ» θα ήταν αόρατη.
    announceInterestToOwners.mockResolvedValue(report({ truncated: true, considered: 500 }));
    const result = await runDemandInterestAnnounce();

    expect(result.metrics?.truncated).toBe(1);
    expect(result.summary).toContain('TRUNCATED');
  });

  it('Λ3 — η περίληψη ονομάζει και τους τέσσερις κάδους', async () => {
    announceInterestToOwners.mockResolvedValue(
      report({ announced: 1, alreadyKnown: 2, noNews: 3, optedOut: 4, considered: 10 }),
    );
    const result = await runDemandInterestAnnounce();

    expect(result.summary).toContain('announced 1');
    expect(result.summary).toContain('already-known 2');
    expect(result.summary).toContain('no-news 3');
    expect(result.summary).toContain('opted-out 4');
  });

  it('Λ4 🔴 — η αποτυχία ΔΕΝ καταπίνεται', async () => {
    // Το `announceInterestToOwners` πετά επίτηδες όταν δεν κλείνει η λογιστική του. Ένα
    // `try/catch` εδώ θα έκανε μια σπασμένη σάρωση να φαίνεται επιτυχημένη — και ο
    // dispatcher δεν θα κατέγραφε ποτέ αποτυχία στο Sentry monitor.
    announceInterestToOwners.mockRejectedValue(new Error('ασυνεπής λογιστική'));

    await expect(runDemandInterestAnnounce()).rejects.toThrow('ασυνεπής λογιστική');
  });
});
