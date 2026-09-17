/**
 * @jest-environment node
 *
 * ADR-835 §20 (Στάδιο Α) — **οι άγκυρες του ημερολογίου καταλύματος.**
 *
 * Εκτελούν την **πραγματική** υπηρεσία πάνω στην πλαστή Firestore με σημασιολογία
 * συναλλαγής (επανάληψη όταν αλλάξει κάτι που διαβάστηκε). Η Σ1 είναι ο λόγος ύπαρξης
 * της κεφαλής: χωρίς την αύξηση του `version`, δύο παράλληλα «κλείσε» περνούν και τα δύο.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { ListingActor } from '@/lib/owner-property/listing-custody';
import type { StayCalendarCommand } from '@/lib/stay/stay-calendar-command';
import { offerOf, validOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { readStayCalendarView } from '@/services/stay-calendar/stay-calendar-read.service';
import { executeStayCalendarCommand } from '@/services/stay-calendar/stay-calendar-write.service';
import { STAY_RULES_NONE } from '@/types/stay-rules';

const mockRecordChange = jest.fn();
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: (...args: unknown[]) => mockRecordChange(...args) },
}));

let sequence = 0;
jest.mock('@/services/enterprise-id.service', () => ({
  enterpriseIdService: {
    generateStayBlockId: () => `sblk_${++sequence}`,
    generateStayBookingId: () => `stay_${++sequence}`,
    generateDeterministicStayCalendarMonthId: (propertyId: string, month: string) => `scmo_${propertyId}_${month}`,
  },
}));

const PROPERTY = 'ownp_a';
const OWNER: ListingActor = { uid: 'user-1', companyId: null };
const STRANGER: ListingActor = { uid: 'user-2', companyId: null };

const db = new FakeFirestore();
const adminDb = db as unknown as AdminFirestore;

function givenStay(offers = [offerOf('leaseShort', 65)]): void {
  db.seed(COLLECTIONS.OWNER_PROPERTIES, PROPERTY, { ...validOwnerProperty({ offers }) });
}

const run = (command: StayCalendarCommand, actor: ListingActor = OWNER) =>
  executeStayCalendarCommand(adminDb, PROPERTY, command, actor);

const block = (from: string, to: string): StayCalendarCommand => ({ action: 'block', from, to, note: null });
const book = (checkIn: string, checkOut: string): StayCalendarCommand => ({
  action: 'book', checkIn, checkOut, guests: 2, guestLabel: 'κ. Παπαδόπουλος', acknowledgedWarnings: [],
});

beforeEach(() => {
  db.reset();
  sequence = 0;
  mockRecordChange.mockReset();
});

describe('Κ — κατοχή και είδος', () => {
  it('Κ1. τρίτος ⇒ absent, και η άρνηση ΔΕΝ γράφει τίποτα', async () => {
    givenStay();
    expect(await run(block('2027-10-10', '2027-10-14'), STRANGER)).toEqual({ kind: 'absent' });
    expect(db.all(COLLECTIONS.STAY_BLOCKS)).toHaveLength(0);
    expect(db.all(COLLECTIONS.STAY_CALENDARS)).toHaveLength(0);
  });

  it('Κ2. ακίνητο χωρίς βραχυχρόνια διάθεση ⇒ not-a-stay για νέα κατάληψη', async () => {
    givenStay([offerOf('sell', 210_000)]);
    expect(await run(block('2027-10-10', '2027-10-14'))).toEqual({ kind: 'not-a-stay' });
  });
});

describe('Χ — ο κριτής μέσα στη συναλλαγή', () => {
  it('Χ1. block + κράτηση που ξεκινά τη μέρα λήξης του ⇒ ΚΑΘΑΡΟ (ημι-ανοιχτό)', async () => {
    givenStay();
    expect((await run(block('2027-10-10', '2027-10-14'))).kind).toBe('ok');
    const booked = await run(book('2027-10-14', '2027-10-18'));
    expect(booked).toMatchObject({ kind: 'ok', entryId: 'stay_2', version: 2 });
  });

  it('Χ2. κράτηση πάνω σε κλεισμένες νύχτες ⇒ conflict ΜΕ ΟΝΟΜΑ, χωρίς όνομα επισκέπτη', async () => {
    givenStay();
    await run(block('2027-10-10', '2027-10-14'));
    expect(await run(book('2027-10-12', '2027-10-15'))).toEqual({
      kind: 'conflict',
      conflicts: [{ entryKind: 'block', entryId: 'sblk_1', from: '2027-10-10', to: '2027-10-14' }],
    });
    expect(db.all(COLLECTIONS.STAY_BOOKINGS)).toHaveLength(0);
  });

  it('Χ3. ακυρωμένη κράτηση ΔΕΝ κλείνει νύχτες — το φίλτρο ζει στον κριτή, όχι στον καλούντα', async () => {
    givenStay();
    await run(book('2027-10-10', '2027-10-14'));
    expect((await run({ action: 'cancel', bookingId: 'stay_1' })).kind).toBe('ok');
    expect((await run(block('2027-10-10', '2027-10-14'))).kind).toBe('ok');
  });

  it('Χ4. αδιάβαστη εγγραφή ⇒ unreadable, ΠΟΤΕ «έγραψα με ό,τι βρήκα»', async () => {
    givenStay();
    db.seed(COLLECTIONS.STAY_BLOCKS, 'sblk_broken', { propertyId: PROPERTY, from: 'κάποτε' });
    expect(await run(block('2027-11-01', '2027-11-03'))).toEqual({ kind: 'unreadable' });
  });
});

describe('Σ — σειριοποίηση από την κεφαλή (phantom insert)', () => {
  it('🏆 Σ1. ανταγωνιστής δεσμεύει τις ΙΔΙΕΣ νύχτες ανάμεσα σε ανάγνωση και commit ⇒ conflict', async () => {
    givenStay();
    db.interfere = () => {
      db.write(COLLECTIONS.STAY_BLOCKS, 'sblk_rival', {
        propertyId: PROPERTY, authorUserId: 'user-1', covers: [{ propertyId: PROPERTY, spaceId: null }],
        from: '2027-10-10', to: '2027-10-14', source: 'owner', note: null, createdBy: 'user-1',
        createdAt: '2027-01-01T00:00:00.000Z', updatedAt: '2027-01-01T00:00:00.000Z',
      });
      db.write(COLLECTIONS.STAY_CALENDARS, PROPERTY, {
        propertyId: PROPERTY, authorUserId: 'user-1', declaredAt: null, version: 1,
        timezone: 'Europe/Athens', createdAt: '2027-01-01T00:00:00.000Z', updatedAt: '2027-01-01T00:00:00.000Z',
      });
    };
    const result = await run(book('2027-10-12', '2027-10-16'));
    expect(result.kind).toBe('conflict');
    expect(db.all(COLLECTIONS.STAY_BOOKINGS)).toHaveLength(0);
  });

  it('🔴 Σ1′. Ο ΙΔΙΟΣ ανταγωνιστής ΧΩΡΙΣ κεφαλή ⇒ η διπλοκράτηση ΠΕΡΝΑ — η απόδειξη ότι το Σ1 κρίνει την κεφαλή', async () => {
    // Το ερώτημα που επέστρεψε «κανένα block» δεν καταγράφει τίποτα προς έλεγχο — όπως
    // στη Firestore, όπου το εύρος ερωτήματος ΔΕΝ κλειδώνεται (phantom insert). Αν αυτό
    // κοκκινίσει, το πλαστό έπαψε να μοντελοποιεί το phantom και το Σ1 δεν αποδεικνύει
    // τίποτα. ⚠️ Ταυτόχρονο `Promise.all` δύο πράξεων ΔΕΝ είναι έγκυρη άγκυρα εδώ: το
    // πλαστό κάνει έλεγχο-και-commit ΜΗ ατομικά (μετρημένο 2026-09-17: και οι δύο `ok`
    // ΑΚΟΜΗ ΚΑΙ με κεφαλή), ενώ η Firestore κλειδώνει ό,τι διάβασε, και τα ανύπαρκτα.
    givenStay();
    db.interfere = () => {
      db.write(COLLECTIONS.STAY_BLOCKS, 'sblk_rival', {
        propertyId: PROPERTY, authorUserId: 'user-1', covers: [{ propertyId: PROPERTY, spaceId: null }],
        from: '2027-10-10', to: '2027-10-14', source: 'owner', note: null, createdBy: 'user-1',
        createdAt: '2027-01-01T00:00:00.000Z', updatedAt: '2027-01-01T00:00:00.000Z',
      });
    };
    expect((await run(book('2027-10-12', '2027-10-16'))).kind).toBe('ok');
    expect(db.all(COLLECTIONS.STAY_BOOKINGS)).toHaveLength(1);
  });

  it('Σ2. κάθε δεσμευμένη πράξη αυξάνει το version κατά ΕΝΑ· η άρνηση δεν το αγγίζει', async () => {
    givenStay();
    await run(block('2027-10-10', '2027-10-14'));
    await run(book('2027-10-11', '2027-10-12'));
    const view = await readStayCalendarView(adminDb, PROPERTY, OWNER, { from: '2027-10-01', to: '2027-11-01' });
    expect(view).toMatchObject({ kind: 'readable', version: 1 });
  });
});

describe('Δ — δήλωση, άνοιγμα, ίχνος', () => {
  it('Δ1. η δήλωση κρατιέται όταν ακολουθούν άλλες πράξεις', async () => {
    givenStay();
    await run({ action: 'declare', declared: true });
    await run(block('2027-10-10', '2027-10-14'));
    const view = await readStayCalendarView(adminDb, PROPERTY, OWNER, { from: '2027-10-01', to: '2027-11-01' });
    expect(view).toMatchObject({ kind: 'readable', version: 2 });
    expect(view.kind === 'readable' && view.declaredAt).toBeTruthy();
  });

  it('Δ2. εξωτερικό block δεν ανοίγει από εδώ — το ανοίγει η πηγή του', async () => {
    givenStay();
    db.seed(COLLECTIONS.STAY_BLOCKS, 'sblk_ical', {
      propertyId: PROPERTY, authorUserId: 'user-1', covers: [{ propertyId: PROPERTY, spaceId: null }],
      from: '2027-10-10', to: '2027-10-14', source: 'external', note: null, createdBy: 'user-1',
      createdAt: '2027-01-01T00:00:00.000Z', updatedAt: '2027-01-01T00:00:00.000Z',
    });
    expect(await run({ action: 'unblock', blockId: 'sblk_ical' })).toEqual({
      kind: 'not-changeable', reason: 'external-source',
    });
  });

  it('Δ3. ίχνος ΜΟΝΟ για δεσμευμένη πράξη, στο βιβλίο της αγγελίας, χωρίς όνομα επισκέπτη', async () => {
    givenStay();
    await run(book('2027-10-10', '2027-10-14'));
    await run(book('2027-10-11', '2027-10-12'));
    expect(mockRecordChange).toHaveBeenCalledTimes(1);
    const [entry] = mockRecordChange.mock.calls[0] as [{ entityType: string; changes: unknown[] }];
    expect(entry.entityType).toBe('owner_property');
    expect(JSON.stringify(entry.changes)).not.toContain('Παπαδόπουλος');
  });
});

// =============================================================================
// Ρ — ΚΑΝΟΝΕΣ (ADR-835 §21, Στάδιο Β)
// =============================================================================

const WINDOW = { from: '2027-10-01', to: '2027-11-01' };
const restrict = (from: string, to: string, set: object, clear: string[] = []) =>
  ({ action: 'restrict', from, to, set, clear }) as StayCalendarCommand;

describe('Ρ — κανόνες βάσης και ανά ημερομηνία', () => {
  it('Ρ1. οι κανόνες βάσης γράφονται στην κεφαλή με version+1 και επιστρέφουν στην οθόνη', async () => {
    givenStay();
    const rules = { ...STAY_RULES_NONE, maxNights: 14, preparationNights: 1 as const };
    expect(await run({ action: 'rules', rules })).toMatchObject({ kind: 'ok', version: 1 });
    const view = await readStayCalendarView(adminDb, PROPERTY, OWNER, WINDOW);
    expect(view).toMatchObject({ kind: 'readable', version: 1, rules });
  });

  it('Ρ2. ρύθμιση ημερών γράφει ΕΝΑ έγγραφο ανά μήνα· το «καθάρισε» σβήνει τον άδειο μήνα', async () => {
    givenStay();
    await run(restrict('2027-10-30', '2027-11-02', { nightlyRateMinor: 12000, closedToArrival: true }));
    expect(db.all(COLLECTIONS.STAY_CALENDAR_MONTHS)).toHaveLength(2);
    await run(restrict('2027-11-01', '2027-11-02', {}, ['nightlyRateMinor', 'closedToArrival']));
    expect(db.all(COLLECTIONS.STAY_CALENDAR_MONTHS)).toHaveLength(1);
    const view = await readStayCalendarView(adminDb, PROPERTY, OWNER, WINDOW);
    expect(view.kind === 'readable' && view.days).toEqual({
      '2027-10-30': { closedToArrival: true, nightlyRateMinor: 12000 },
      '2027-10-31': { closedToArrival: true, nightlyRateMinor: 12000 },
    });
  });

  it('Ρ3. αντίφαση (ελάχιστες > μέγιστες) ⇒ contradictory-rules, ΤΙΠΟΤΑ δεν γράφεται', async () => {
    givenStay();
    await run(restrict('2027-10-10', '2027-10-12', { maxNights: 2 }));
    expect(await run(restrict('2027-10-11', '2027-10-13', { minNights: 5 }))).toEqual({
      kind: 'contradictory-rules', date: '2027-10-11',
    });
    const view = await readStayCalendarView(adminDb, PROPERTY, OWNER, WINDOW);
    expect(view).toMatchObject({ kind: 'readable', version: 1 });
  });

  it('Ρ4. ακίνητο χωρίς βραχυχρόνια ⇒ not-a-stay και για κανόνες', async () => {
    givenStay([offerOf('sell', 210_000)]);
    expect(await run(restrict('2027-10-10', '2027-10-12', { minNights: 2 }))).toEqual({ kind: 'not-a-stay' });
    expect(await run({ action: 'rules', rules: STAY_RULES_NONE })).toEqual({ kind: 'not-a-stay' });
  });

  it('Ρ5. αδιάβαστος μήνας ⇒ unreadable, ΠΟΤΕ «κανένας κανόνας»', async () => {
    givenStay();
    db.seed(COLLECTIONS.STAY_CALENDAR_MONTHS, 'scmo_broken', {
      propertyId: PROPERTY, authorUserId: 'user-1', month: '2027-10', days: { '2027-10-10': { minNights: 0 } },
      updatedAt: '2027-01-01T00:00:00.000Z',
    });
    expect(await run(block('2027-11-01', '2027-11-03'))).toEqual({ kind: 'unreadable' });
  });
});

describe('Π — η χειροκίνητη κράτηση προειδοποιεί, ΔΕΝ σιωπά', () => {
  it('🏆 Π1. κάτω από τις ελάχιστες της ημέρας ⇒ rules-unacknowledged, και με αποδοχή περνά (στο ίχνος)', async () => {
    givenStay();
    await run(restrict('2027-10-10', '2027-10-11', { minNights: 3 }));
    expect(await run(book('2027-10-10', '2027-10-12'))).toEqual({
      kind: 'rules-unacknowledged', warnings: ['below-min-nights'],
    });
    expect(db.all(COLLECTIONS.STAY_BOOKINGS)).toHaveLength(0);
    const accepted = { ...book('2027-10-10', '2027-10-12'), acknowledgedWarnings: ['below-min-nights'] } as StayCalendarCommand;
    expect((await run(accepted)).kind).toBe('ok');
    expect(JSON.stringify(mockRecordChange.mock.calls.at(-1))).toContain('acknowledged: below-min-nights');
  });

  it('🔴 Π2. νύχτα προετοιμασίας ⇒ προειδοποίηση· ΕΠΙΚΑΛΥΨΗ ⇒ σκληρή άρνηση ακόμη και με αποδοχή', async () => {
    givenStay();
    await run({ action: 'rules', rules: { ...STAY_RULES_NONE, preparationNights: 1 } });
    await run(book('2027-10-10', '2027-10-14'));
    expect(await run(book('2027-10-14', '2027-10-16'))).toEqual({
      kind: 'rules-unacknowledged', warnings: ['preparation'],
    });
    const overlap = { ...book('2027-10-12', '2027-10-16'), acknowledgedWarnings: ['preparation'] } as StayCalendarCommand;
    expect((await run(overlap)).kind).toBe('conflict');
  });

  it('🔴 Π3. χωρίς κανόνες καμία προειδοποίηση — ο παρονομαστής', async () => {
    givenStay();
    expect((await run(book('2027-10-10', '2027-10-11'))).kind).toBe('ok');
  });
});
