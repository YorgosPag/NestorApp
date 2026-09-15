/**
 * =============================================================================
 * ΑΓΚΥΡΕΣ ΤΟΥ ΚΑΘΟΛΟΓΙΟΥ — ΔΥΟ ΓΕΝΙΕΣ ΚΛΕΙΔΙΩΝ, ΜΙΑ ΑΠΑΝΤΗΣΗ (ADR-777 §8.69.12)
 * =============================================================================
 *
 * 🔴 **Γιατί υπάρχει**: η ταυτότητα έγινε θέμα (παραλήπτης, αγγελία), αλλά τα ήδη γραμμένα
 * έγγραφα έχουν κλειδί **ανά ζήτηση**. Αν το καθολόγιο κοιτούσε μόνο το νέο κλειδί, **κάθε**
 * παλιό ταίριασμα και **κάθε** φρέσκια μείωση θα ξαναστελνόταν μία φορά — στη ζωντανή βάση
 * αυτό είναι η μείωση 170.000 του `prop_ef2eaebd` σε δύο ζητήσεις.
 *
 * Η Firestore είναι ψεύτικη (`getAll` πάνω σε χάρτη)· τα **αναγνωριστικά** βγαίνουν από το
 * πραγματικό `generateNotificationDedupeId` — αυτό ακριβώς ελέγχεται.
 */

import { NOTIFICATION_EVENT_TYPES } from '@/config/notification-events';
import {
  demandListingMatchEventId,
  demandPriceDropEventId,
  recipientListingMatchEventId,
  recipientPriceDropEventId,
} from '@/lib/demand/demand-announcement';
import { generateNotificationDedupeId } from '@/services/enterprise-id.service';

import { MATCH_LEDGER_BATCH, readRecipientLedger } from '../demand-match-ledger';

const RECIPIENT = 'usr_x';
const REDUCTION = { to: 170_000, since: '2026-09-15T10:09:48.485Z' };
const T1 = new Date('2026-09-01T10:00:00.000Z');
const T2 = new Date('2026-09-05T10:00:00.000Z');

const matchDoc = (eventId: string): string =>
  generateNotificationDedupeId(NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_LISTING_MATCH, RECIPIENT, eventId);
const dropDoc = (eventId: string): string =>
  generateNotificationDedupeId(NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_PRICE_DROP, RECIPIENT, eventId);

function fakeDb(docs: Readonly<Record<string, Date | null>>) {
  const getAll = jest.fn(async (...refs: Array<{ id: string }>) =>
    refs.map((ref) => ({
      exists: Object.prototype.hasOwnProperty.call(docs, ref.id),
      get: (field: string) => (field === 'createdAt' ? docs[ref.id] : undefined),
    })),
  );
  const db = { collection: () => ({ doc: (id: string) => ({ id }) }), getAll };
  return { db: db as never, getAll };
}

const TOPIC = { listingId: 'l1', demandIds: ['d1', 'd2'], reduction: null };

describe('Κ — το καθολόγιο αναγνωρίζει ΚΑΙ τα νέα ΚΑΙ τα παλιά κλειδιά', () => {
  it('Κ1 — νέο κλειδί θέματος ⇒ ανακοινωμένο, με τη στιγμή του', async () => {
    const { db } = fakeDb({ [matchDoc(recipientListingMatchEventId('l1'))]: T2 });

    const ledger = await readRecipientLedger(db, RECIPIENT, [TOPIC]);

    expect(ledger.get('l1')).toEqual({ match: { kind: 'announced', atMs: T2.getTime() }, priceDropKnown: false });
  });

  it('🔴 Σ3 — ΜΟΝΟ το παλιό κλειδί της d2 ⇒ το θέμα είναι ΓΝΩΣΤΟ (καμία ξανα-ανακοίνωση)', async () => {
    const { db } = fakeDb({ [matchDoc(demandListingMatchEventId('d2', 'l1'))]: T1 });

    const ledger = await readRecipientLedger(db, RECIPIENT, [TOPIC]);

    expect(ledger.get('l1')?.match).toEqual({ kind: 'announced', atMs: T1.getTime() });
  });

  it('🔴 Κ3 — πολλές ανακοινώσεις ⇒ η ΠΡΩΤΗ στιγμή (από τότε ξέρει την τιμή)', async () => {
    const { db } = fakeDb({
      [matchDoc(demandListingMatchEventId('d1', 'l1'))]: T2,
      [matchDoc(demandListingMatchEventId('d2', 'l1'))]: T1,
    });

    const ledger = await readRecipientLedger(db, RECIPIENT, [TOPIC]);

    expect(ledger.get('l1')?.match).toEqual({ kind: 'announced', atMs: T1.getTime() });
  });

  it('Κ4 — ανακοίνωση χωρίς αναγνώσιμη στιγμή ⇒ `atMs: null` (η κρίση πάει προς τη σιωπή)', async () => {
    const { db } = fakeDb({
      [matchDoc(demandListingMatchEventId('d1', 'l1'))]: T1,
      [matchDoc(demandListingMatchEventId('d2', 'l1'))]: null,
    });

    const ledger = await readRecipientLedger(db, RECIPIENT, [TOPIC]);

    expect(ledger.get('l1')?.match).toEqual({ kind: 'announced', atMs: null });
  });

  it('Κ5 — τίποτα γραμμένο ⇒ «δεν ανακοινώθηκε ποτέ», και το θέμα ΥΠΑΡΧΕΙ στον χάρτη', async () => {
    const { db } = fakeDb({});

    const ledger = await readRecipientLedger(db, RECIPIENT, [TOPIC]);

    expect(ledger.get('l1')).toEqual({ match: { kind: 'never-announced' }, priceDropKnown: false });
  });
});

describe('Μ — η τρέχουσα μείωση, με νέο ή παλιό κλειδί', () => {
  const WITH_DROP = { ...TOPIC, reduction: REDUCTION };

  it('🔴 Σ4 — μείωση γραμμένη με το ΠΑΛΙΟ κλειδί της d1 ⇒ `priceDropKnown`', async () => {
    const { db } = fakeDb({ [dropDoc(demandPriceDropEventId('d1', 'l1', REDUCTION))]: T2 });

    const ledger = await readRecipientLedger(db, RECIPIENT, [WITH_DROP]);

    expect(ledger.get('l1')?.priceDropKnown).toBe(true);
  });

  it('Μ2 — μείωση γραμμένη με το ΝΕΟ κλειδί ⇒ `priceDropKnown`', async () => {
    const { db } = fakeDb({ [dropDoc(recipientPriceDropEventId('l1', REDUCTION))]: T2 });

    const ledger = await readRecipientLedger(db, RECIPIENT, [WITH_DROP]);

    expect(ledger.get('l1')?.priceDropKnown).toBe(true);
  });

  it('Μ3 — ΑΛΛΗ (παλιότερη) μείωση γραμμένη ⇒ η τρέχουσα ΔΕΝ είναι γνωστή', async () => {
    const older = { to: 177_000, since: '2026-09-01T10:00:00.000Z' };
    const { db } = fakeDb({ [dropDoc(recipientPriceDropEventId('l1', older))]: T1 });

    const ledger = await readRecipientLedger(db, RECIPIENT, [WITH_DROP]);

    expect(ledger.get('l1')?.priceDropKnown).toBe(false);
  });

  it('Μ4 — θέμα χωρίς μείωση ΔΕΝ ανιχνεύει έγγραφα μείωσης', async () => {
    const { db, getAll } = fakeDb({});

    await readRecipientLedger(db, RECIPIENT, [TOPIC]);

    // νέο κλειδί + 2 παλιά = 3 ανιχνεύσεις, μόνο ταιριάσματος.
    expect(getAll.mock.calls.flat()).toHaveLength(3);
  });
});

describe('Δ — δέσμες', () => {
  it('Δ1 — κενή λίστα θεμάτων ⇒ καμία ανάγνωση', async () => {
    const { db, getAll } = fakeDb({});

    const ledger = await readRecipientLedger(db, RECIPIENT, []);

    expect(getAll).not.toHaveBeenCalled();
    expect(ledger.size).toBe(0);
  });

  it('Δ2 — πάνω από μία δέσμη ανιχνεύσεων ⇒ πολλές κλήσεις, καμία χαμένη απάντηση', async () => {
    const topics = Array.from({ length: MATCH_LEDGER_BATCH }, (_, i) => ({ listingId: `l${i}`, demandIds: ['d1'], reduction: null }));
    const last = `l${MATCH_LEDGER_BATCH - 1}`;
    const { db, getAll } = fakeDb({ [matchDoc(demandListingMatchEventId('d1', last))]: T1 });

    const ledger = await readRecipientLedger(db, RECIPIENT, topics);

    expect(getAll).toHaveBeenCalledTimes(2);
    expect(ledger.get(last)?.match).toEqual({ kind: 'announced', atMs: T1.getTime() });
    expect(ledger.get('l0')?.match).toEqual({ kind: 'never-announced' });
  });
});
