/**
 * =============================================================================
 * CRON LEASE — αποκλεισμός επικαλυπτόμενων εκτελέσεων
 * =============================================================================
 *
 * Το ζητούμενο δεν είναι «γράφτηκε το έγγραφο» — είναι **ποιος κερδίζει** όταν δύο
 * ticks επικαλύπτονται, και **πότε ελευθερώνεται** το κλειδί.
 *
 * Ένα lease που δεν λήγει είναι χειρότερο από καθόλου lease: ένας container που πέθανε
 * στη μέση θα κλείδωνε την εργασία **για πάντα**, δηλαδή θα την έκανε σιωπηλά νεκρή —
 * ακριβώς η αστοχία που γέννησε το ADR-739, με άλλο πρόσωπο.
 *
 * @see ADR-739
 */

import { Timestamp } from 'firebase-admin/firestore';

import { FakeFirestore } from '@/lib/oauth/__tests__/fake-firestore';

const fake = new FakeFirestore();

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => fake,
}));

// eslint-disable-next-line import/first -- το mock πρέπει να δηλωθεί πριν το import
import {
  acquireCronLease,
  readCronJobState,
  releaseCronLeaseAfterFailure,
  releaseCronLeaseAfterSuccess,
} from '@/lib/cron/cron-lease';

const SLUG = 'backup';

/** Γράφει απευθείας κατάσταση, παρακάμπτοντας τον υπό δοκιμή κώδικα. */
async function seed(data: Record<string, unknown>): Promise<void> {
  await fake.collection('cron_job_state').doc(SLUG).set(data, { merge: true });
}

beforeEach(async () => {
  await fake.collection('cron_job_state').doc(SLUG).set({}, { merge: false });
});

describe('acquireCronLease', () => {
  it('το παίρνει όταν δεν υπάρχει καθόλου κατάσταση', async () => {
    const result = await acquireCronLease(SLUG, 30, 'owner-a');
    expect(result.acquired).toBe(true);
  });

  it('ΔΕΝ το παίρνει όσο κρατείται από άλλον', async () => {
    await acquireCronLease(SLUG, 30, 'owner-a');
    const second = await acquireCronLease(SLUG, 30, 'owner-b');

    expect(second.acquired).toBe(false);
    if (!second.acquired) expect(second.heldUntil).toBeTruthy();
  });

  it('το παίρνει όταν το προηγούμενο lease έχει ΛΗΞΕΙ', async () => {
    // Κάτοχος που πέθανε στη μέση. Χωρίς λήξη, η εργασία θα έμενε κλειδωμένη
    // επ' αόριστον — σιωπηλά νεκρή.
    await seed({
      leaseExpiresAt: Timestamp.fromMillis(Date.now() - 60_000),
      leaseOwner: 'zombie',
    });

    const result = await acquireCronLease(SLUG, 30, 'owner-b');
    expect(result.acquired).toBe(true);
  });

  it('η διάρκεια που δηλώνεται καθορίζει πράγματι τη λήξη', async () => {
    const before = Date.now();
    const result = await acquireCronLease(SLUG, 10, 'owner-a');

    expect(result.acquired).toBe(true);
    if (!result.acquired) return;

    const expiresMs = Date.parse(result.state.leaseExpiresAt as string);
    // Ανοχή 5s για τον χρόνο εκτέλεσης του ίδιου του test.
    expect(expiresMs).toBeGreaterThanOrEqual(before + 10 * 60_000 - 5_000);
    expect(expiresMs).toBeLessThanOrEqual(before + 10 * 60_000 + 5_000);
  });

  it('διατηρεί το lastSuccessAt προηγούμενης εκτέλεσης', async () => {
    // Το `lastSuccessAt` οδηγεί το catch-up. Αν η απόκτηση lease το έσβηνε, κάθε
    // εκτέλεση θα φαινόταν «ποτέ δεν πέτυχε» και το catch-up θα έτρεχε αενάως.
    const previous = Timestamp.fromMillis(Date.parse('2026-07-14T01:00:00.000Z'));
    await seed({ lastSuccessAt: previous });

    const result = await acquireCronLease(SLUG, 30, 'owner-a');
    expect(result.acquired).toBe(true);
    if (result.acquired) {
      expect(result.state.lastSuccessAt).toBe('2026-07-14T01:00:00.000Z');
    }
  });
});

describe('απελευθέρωση', () => {
  it('η επιτυχία ελευθερώνει το lease και μηδενίζει τις αποτυχίες', async () => {
    await seed({ consecutiveFailures: 4, lastError: 'παλιό σφάλμα' });
    await acquireCronLease(SLUG, 30, 'owner-a');
    await releaseCronLeaseAfterSuccess(SLUG);

    const state = await readCronJobState(SLUG);
    expect(state.leaseExpiresAt).toBeNull();
    expect(state.leaseOwner).toBeNull();
    expect(state.consecutiveFailures).toBe(0);
    expect(state.lastError).toBeNull();
  });

  it('η επιτυχία ΓΡΑΦΕΙ πράγματι το lastSuccessAt', async () => {
    // Ελέγχεται στο ωμό έγγραφο και όχι μέσω `readCronJobState`: η τιμή είναι sentinel
    // `serverTimestamp()` που το fake δεν επιλύει, οπότε η ανάγνωση θα έδινε `null`
    // είτε γράφτηκε είτε όχι. Χωρίς αυτόν τον έλεγχο, μια αλλαγή σε `lastSuccessAt:
    // null` θα περνούσε αθόρυβα — και το catch-up θα ξανάτρεχε κάθε εργασία αενάως.
    await acquireCronLease(SLUG, 30, 'owner-a');
    await releaseCronLeaseAfterSuccess(SLUG);

    const raw = fake.dump('cron_job_state').get(SLUG);
    expect(raw?.lastSuccessAt).toBeDefined();
    expect(raw?.lastSuccessAt).not.toBeNull();
  });

  it('η αποτυχία ΔΕΝ γράφει lastSuccessAt στο ωμό έγγραφο', async () => {
    await acquireCronLease(SLUG, 30, 'owner-a');
    await releaseCronLeaseAfterFailure(SLUG, 'boom');

    const raw = fake.dump('cron_job_state').get(SLUG);
    expect(raw?.lastSuccessAt).toBeUndefined();
  });

  it('μετά την επιτυχία, ένας άλλος μπορεί να πάρει το lease', async () => {
    await acquireCronLease(SLUG, 30, 'owner-a');
    await releaseCronLeaseAfterSuccess(SLUG);

    const next = await acquireCronLease(SLUG, 30, 'owner-b');
    expect(next.acquired).toBe(true);
  });

  it('η αποτυχία ελευθερώνει επίσης το lease', async () => {
    // Αλλιώς μια εργασία που έσκασε στο πρώτο δευτερόλεπτο θα έμενε κλειδωμένη για
    // όσο διαρκεί το lease — π.χ. μια ώρα για το backup.
    await acquireCronLease(SLUG, 30, 'owner-a');
    await releaseCronLeaseAfterFailure(SLUG, 'κάτι έσπασε');

    const state = await readCronJobState(SLUG);
    expect(state.leaseExpiresAt).toBeNull();
    expect(state.lastError).toContain('κάτι έσπασε');
  });

  it('η αποτυχία ΔΕΝ αγγίζει το lastSuccessAt', async () => {
    // Κρίσιμο για το catch-up: μια αποτυχία πρέπει να αφήνει την εργασία οφειλόμενη,
    // ώστε να ξαναδοκιμαστεί στο επόμενο tick αντί να περιμένει την επόμενη μέρα.
    const previous = Timestamp.fromMillis(Date.parse('2026-07-14T01:00:00.000Z'));
    await seed({ lastSuccessAt: previous });

    await acquireCronLease(SLUG, 30, 'owner-a');
    await releaseCronLeaseAfterFailure(SLUG, 'boom');

    const state = await readCronJobState(SLUG);
    expect(state.lastSuccessAt).toBe('2026-07-14T01:00:00.000Z');
  });

  it('το μήνυμα σφάλματος κόβεται ώστε να μη φουσκώσει το έγγραφο', async () => {
    await releaseCronLeaseAfterFailure(SLUG, 'x'.repeat(5_000));
    const state = await readCronJobState(SLUG);
    expect((state.lastError as string).length).toBeLessThanOrEqual(500);
  });
});

describe('readCronJobState', () => {
  it('επιστρέφει ασφαλή προεπιλογή για εργασία που δεν έτρεξε ποτέ', async () => {
    const state = await readCronJobState('ουδέποτε-εκτελεσθείσα');
    expect(state).toEqual({
      slug: 'ουδέποτε-εκτελεσθείσα',
      lastSuccessAt: null,
      lastAttemptAt: null,
      leaseExpiresAt: null,
      leaseOwner: null,
      consecutiveFailures: 0,
      lastError: null,
    });
  });
});
