/**
 * **Η ΔΙΑΦΟΡΑ ΕΝΟΣ FEED** — ADR-835 §22.
 *
 * Οι τρεις ερωτήσεις που η αγορά **δεν** κάνει: *είναι ιδιοδύναμο;* · *αναγνωρίζω την
 * ίδια κράτηση με άλλο `UID`;* · *πόσες αναγνώσεις χρειάζονται για να ΑΝΟΙΞΩ νύχτα;*
 */

import type { IcalEvent } from '@/lib/ical/ical-read';
import type { StayBlock } from '@/types/stay-calendar';
import { reconcileStayChannelFeed, type StayChannelReconcileInput } from '../stay-channel-reconcile';
import { STAY_ICAL_UID_DOMAIN } from '../stay-channel-export';
import { blockEntry, FEED, PROPERTY } from './stay-rules-fixtures';

const NOW = '2026-09-17T09:00:00.000Z';
const TODAY = '2026-09-17';

const blockOf = (id: string, from: string, to: string, uid: string): StayBlock => {
  const entry = blockEntry(id, from, to, 'external', FEED);
  if (entry.kind !== 'block') throw new Error('fixture');
  return { ...entry.block, channel: { feedId: FEED, externalUid: uid }, propertyId: PROPERTY };
};

const event = (uid: string, from: string, to: string): IcalEvent => ({ uid, from, to, summary: 'Reserved' });

const reconcile = (over: Partial<StayChannelReconcileInput>) =>
  reconcileStayChannelFeed({
    feedId: FEED,
    events: [],
    existing: [],
    pendingRemovals: {},
    today: TODAY,
    now: NOW,
    blockIdOf: (feedId, uid) => `sblk_det_${feedId}_${uid}`,
    ...over,
  });

describe('reconcileStayChannelFeed — ταυτότητα', () => {
  it('νέο γεγονός ⇒ δημιουργία με ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΗ ταυτότητα', () => {
    const result = reconcile({ events: [event('abc@airbnb.com', '2026-10-10', '2026-10-14')] });
    expect(result.plan).toEqual([
      { kind: 'create', id: `sblk_det_${FEED}_abc@airbnb.com`, uid: 'abc@airbnb.com', from: '2026-10-10', to: '2026-10-14' },
    ]);
  });

  it('ίδια ανάγνωση δεύτερη φορά ⇒ ΚΑΜΙΑ πράξη (ιδιοδύναμο)', () => {
    const existing = [blockOf('sblk_1', '2026-10-10', '2026-10-14', 'abc@airbnb.com')];
    const result = reconcile({ existing, events: [event('abc@airbnb.com', '2026-10-10', '2026-10-14')] });
    expect(result.plan).toEqual([]);
    expect(result.pendingRemovals).toEqual({});
  });

  it('ίδιο UID με άλλες ημερομηνίες ⇒ ενημέρωση του ΙΔΙΟΥ εγγράφου', () => {
    const existing = [blockOf('sblk_1', '2026-10-10', '2026-10-14', 'abc@airbnb.com')];
    const result = reconcile({ existing, events: [event('abc@airbnb.com', '2026-10-11', '2026-10-15')] });
    expect(result.plan).toEqual([
      { kind: 'update', id: 'sblk_1', uid: 'abc@airbnb.com', from: '2026-10-11', to: '2026-10-15' },
    ]);
  });

  it('🏆 Booking.com: ΝΕΟ UID + μετακινημένο DTSTART με ΙΔΙΑ αναχώρηση ⇒ το ίδιο έγγραφο', () => {
    const existing = [blockOf('sblk_1', '2026-09-15', '2026-09-20', 'TRU-9LZDAN')];
    const result = reconcile({ existing, events: [event('TRU-2BASUD', '2026-09-16', '2026-09-20')] });
    expect(result.plan).toEqual([
      { kind: 'update', id: 'sblk_1', uid: 'TRU-2BASUD', from: '2026-09-16', to: '2026-09-20' },
    ]);
    // 🔴 Χωρίς την επανα-ταύτιση θα ήταν «σβήσε + γράψε», κάθε πρωί, για κάθε κράτηση.
    expect(result.pendingRemovals).toEqual({});
  });

  it('νέο UID με ΑΛΛΗ αναχώρηση ΔΕΝ είναι το ίδιο γεγονός', () => {
    const existing = [blockOf('sblk_1', '2026-09-15', '2026-09-20', 'TRU-9LZDAN')];
    const result = reconcile({ existing, events: [event('TRU-OTHER', '2026-09-16', '2026-09-21')] });
    expect(result.plan).toEqual([
      { kind: 'create', id: `sblk_det_${FEED}_TRU-OTHER`, uid: 'TRU-OTHER', from: '2026-09-16', to: '2026-09-21' },
    ]);
    expect(result.pendingRemovals).toEqual({ sblk_1: NOW });
  });

  it('ασπίδα echo: γεγονός με ΤΟ ΔΙΚΟ ΜΑΣ domain αγνοείται', () => {
    const result = reconcile({ events: [event(`stay_1@${STAY_ICAL_UID_DOMAIN}`, '2026-10-10', '2026-10-14')] });
    expect(result.plan).toEqual([]);
    expect(result.eventCount).toBe(0);
  });

  it('δύο γεγονότα με ΙΔΙΟ UID ⇒ ΕΝΑ, στο ΕΥΡΥΤΕΡΟ διάστημα (fail-closed)', () => {
    const result = reconcile({
      events: [event('dup@x', '2026-10-10', '2026-10-12'), event('dup@x', '2026-10-11', '2026-10-20')],
    });
    expect(result.plan).toEqual([
      { kind: 'create', id: `sblk_det_${FEED}_dup@x`, uid: 'dup@x', from: '2026-10-10', to: '2026-10-20' },
    ]);
  });
});

describe('reconcileStayChannelFeed — η διαγραφή ανοίγει νύχτες, άρα θέλει ΔΥΟ αναγνώσεις', () => {
  const existing = [blockOf('sblk_1', '2026-10-10', '2026-10-14', 'abc@airbnb.com')];

  it('πρώτη ανάγνωση χωρίς το γεγονός ⇒ ΚΑΜΙΑ διαγραφή, μόνο καταγραφή', () => {
    const result = reconcile({ existing, events: [] });
    expect(result.plan).toEqual([]);
    expect(result.pendingRemovals).toEqual({ sblk_1: NOW });
  });

  it('δεύτερη συνεχόμενη ανάγνωση χωρίς το γεγονός ⇒ διαγραφή', () => {
    const result = reconcile({ existing, events: [], pendingRemovals: { sblk_1: '2026-09-17T08:30:00.000Z' } });
    expect(result.plan).toEqual([{ kind: 'delete', id: 'sblk_1' }]);
    expect(result.pendingRemovals).toEqual({});
  });

  it('γεγονός που ΕΠΑΝΕΜΦΑΝΙΣΤΗΚΕ καθαρίζει την εκκρεμότητα', () => {
    const result = reconcile({
      existing,
      events: [event('abc@airbnb.com', '2026-10-10', '2026-10-14')],
      pendingRemovals: { sblk_1: '2026-09-17T08:30:00.000Z' },
    });
    expect(result.plan).toEqual([]);
    expect(result.pendingRemovals).toEqual({});
  });

  it('ΠΑΡΕΛΘΟΝΤΙΚΟ block που έλειψε σβήνεται ΑΜΕΣΩΣ (καμία νύχτα δεν ανοίγει προς τα πίσω)', () => {
    const past = [blockOf('sblk_old', '2026-08-01', '2026-08-05', 'old@airbnb.com')];
    expect(reconcile({ existing: past, events: [] }).plan).toEqual([{ kind: 'delete', id: 'sblk_old' }]);
  });
});
