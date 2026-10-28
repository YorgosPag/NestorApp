/**
 * @fileoverview Ζωντανές αλλαγές RFQ — καθαρή λογική (ADR-328 §5.J.5).
 *
 * Κ1 «ποιος» = `updatedBy` (τελευταίος που έγραψε), ΠΟΤΕ `createdBy` — και στις δύο κατευθύνσεις του παλιού σφάλματος ·
 * Κ2 άγνωστος ενεργός / άγνωστος τρέχων χρήστης / παλιά αλλαγή ⇒ σιωπή, ποτέ λάθος ειδοποίηση ·
 * Κ3 νέα προσφορά (και από την πύλη) · αλλαγή κατάστασης μόνο για τις χαρτογραφημένες ·
 * Κ4 η ανάθεση απορροφά επιβεβαίωση + απορρίψεις του ίδιου ενεργού (και ως ηχώ σε επόμενη ριπή) ·
 * Κ5 ομαδοποίηση: ≥3 ίδιου ενεργού ⇒ ένα· ≥3 νέες προσφορές ⇒ ένα· διαφορετικοί ενεργοί δεν συγχωνεύονται.
 */

import type { Quote, QuoteStatus } from '../../types/quote';
import {
  LIVE_CHANGE_FRESH_WINDOW_MS,
  coalesceLiveChanges,
  diffQuoteChanges,
  liveToastActorId,
  type LiveChangeEvent,
} from '../live-change-events';

const NOW = 1_800_000_000_000;
const ME = 'uid_me';
const MARIA = 'uid_maria';

const ts = (ms: number) => ({ toMillis: () => ms }) as unknown as Quote['updatedAt'];

function quote(id: string, partial: Partial<Quote> = {}): Quote {
  return {
    id,
    displayNumber: `QT-${id}`,
    status: 'submitted' as QuoteStatus,
    vendorContactId: '',
    vendorSnapshot: { name: `Vendor ${id}`, email: null, inviteId: 'vi_1' },
    extractedData: null,
    totals: { total: 100 },
    createdBy: ME,
    updatedBy: MARIA,
    updatedAt: ts(NOW - 1_000),
    ...partial,
  } as unknown as Quote;
}

const mapOf = (...quotes: Quote[]) => new Map(quotes.map((q) => [q.id, q]));
const ctx = { currentUserId: ME, nowMs: NOW };

function event(type: LiveChangeEvent['type'], quoteId: string, actorId = MARIA): LiveChangeEvent {
  return { type, quoteId, quoteNumber: `QT-${quoteId}`, vendor: null, total: 100, actorId };
}

describe('diffQuoteChanges', () => {
  it('Κ1 — προσφορά που ΕΓΩ δημιούργησα, την άλλαξε άλλος ⇒ ειδοποίηση με ενεργό τον αλλάξαντα', () => {
    const events = diffQuoteChanges(mapOf(quote('1')), [quote('1', { status: 'accepted' })], ctx);
    expect(events).toEqual([expect.objectContaining({ type: 'quote_awarded', quoteId: '1', actorId: MARIA })]);
  });

  it('Κ1 — προσφορά που δημιούργησε άλλος, την άλλαξα ΕΓΩ ⇒ σιωπή', () => {
    const mine = quote('1', { createdBy: MARIA, updatedBy: ME, status: 'rejected' });
    expect(diffQuoteChanges(mapOf(quote('1', { createdBy: MARIA })), [mine], ctx)).toEqual([]);
  });

  it('Κ2 — παλιό έγγραφο χωρίς updatedBy ⇒ σιωπή (ακόμη κι αν createdBy είναι άλλος)', () => {
    const legacy = quote('1', { createdBy: MARIA, updatedBy: undefined, status: 'accepted' });
    expect(diffQuoteChanges(mapOf(quote('1')), [legacy], ctx)).toEqual([]);
  });

  it('Κ2 — άγνωστος τρέχων χρήστης (σύνδεση φορτώνει) ⇒ σιωπή', () => {
    const next = [quote('1', { status: 'accepted' })];
    expect(diffQuoteChanges(mapOf(quote('1')), next, { currentUserId: null, nowMs: NOW })).toEqual([]);
  });

  it('Κ2 — αλλαγή παλαιότερη του παραθύρου ⇒ σιωπή', () => {
    const stale = quote('1', { status: 'accepted', updatedAt: ts(NOW - LIVE_CHANGE_FRESH_WINDOW_MS - 1) });
    expect(diffQuoteChanges(mapOf(quote('1')), [stale], ctx)).toEqual([]);
  });

  it('Κ3 — νέα προσφορά από την πύλη (`vendor:…`) ⇒ quote_added με το όνομα του προμηθευτή', () => {
    const events = diffQuoteChanges(new Map(), [quote('9', { updatedBy: 'vendor:cont_1' })], ctx);
    expect(events).toEqual([
      expect.objectContaining({ type: 'quote_added', actorId: 'vendor:cont_1', vendor: 'Vendor 9', quoteNumber: 'QT-9' }),
    ]);
  });

  it('Κ3 — ίδια κατάσταση ή μη χαρτογραφημένη (submitted/draft) ⇒ κανένα γεγονός', () => {
    const prev = mapOf(quote('1'), quote('2', { status: 'draft' }));
    expect(diffQuoteChanges(prev, [quote('1'), quote('2', { status: 'submitted' })], ctx)).toEqual([]);
  });

  it('Κ3 — under_review / rejected ⇒ confirmed / rejected', () => {
    const prev = mapOf(quote('1'), quote('2'));
    const types = diffQuoteChanges(prev, [quote('1', { status: 'under_review' }), quote('2', { status: 'rejected' })], ctx)
      .map((e) => e.type);
    expect(types).toEqual(['quote_confirmed', 'quote_rejected']);
  });
});

describe('coalesceLiveChanges', () => {
  it('Κ4 — η ανάθεση απορροφά επιβεβαίωση νικητή + απορρίψεις χαμένων του ίδιου ενεργού', () => {
    const toasts = coalesceLiveChanges([
      event('quote_confirmed', 'w'), event('quote_awarded', 'w'), event('quote_rejected', 'l1'), event('quote_rejected', 'l2'),
    ]);
    expect(toasts).toEqual([{ kind: 'single', event: event('quote_awarded', 'w') }]);
  });

  it('Κ4 — απορρίψεις σε επόμενη ριπή, μέσα στην ηχώ της ανάθεσης ⇒ σιωπή· άλλος ενεργός ⇒ κανονικά', () => {
    const toasts = coalesceLiveChanges(
      [event('quote_rejected', 'l1'), event('quote_rejected', 'l2', 'uid_giannis')],
      new Set([MARIA]),
    );
    expect(toasts).toEqual([{ kind: 'single', event: event('quote_rejected', 'l2', 'uid_giannis') }]);
  });

  it('Κ5 — ≥3 αλλαγές ίδιου ενεργού ⇒ ένα συγκεντρωτικό με εστίαση στην τελευταία', () => {
    const toasts = coalesceLiveChanges([event('quote_rejected', '1'), event('quote_rejected', '2'), event('quote_confirmed', '3')]);
    expect(toasts).toEqual([{ kind: 'actorBurst', actorId: MARIA, count: 3, focus: event('quote_confirmed', '3') }]);
  });

  it('Κ5 — διαφορετικοί ενεργοί δεν συγχωνεύονται (κανείς δεν «κλέβει» τις αλλαγές άλλου)', () => {
    const toasts = coalesceLiveChanges([
      event('quote_rejected', '1'), event('quote_rejected', '2'), event('quote_rejected', '3', 'uid_giannis'),
    ]);
    expect(toasts.map(liveToastActorId)).toEqual([MARIA, MARIA, 'uid_giannis']);
  });

  it('Κ5 — ≥3 νέες προσφορές ⇒ ένα «N νέες προσφορές»· 2 ⇒ χωριστά', () => {
    const three = coalesceLiveChanges([
      event('quote_added', '1', 'vendor:a'), event('quote_added', '2', 'vendor:b'), event('quote_added', '3', 'vendor:c'),
    ]);
    expect(three).toEqual([{ kind: 'newQuotes', count: 3, focus: event('quote_added', '3', 'vendor:c') }]);
    expect(coalesceLiveChanges([event('quote_added', '1', 'vendor:a'), event('quote_added', '2', 'vendor:b')])).toHaveLength(2);
  });

  it('liveToastActorId — νέα προσφορά δεν ονομάζει ενεργό (ούτε αναζητείται)', () => {
    expect(liveToastActorId({ kind: 'single', event: event('quote_added', '1', 'vendor:a') })).toBeNull();
    expect(liveToastActorId({ kind: 'newQuotes', count: 3, focus: event('quote_added', '1') })).toBeNull();
  });
});
