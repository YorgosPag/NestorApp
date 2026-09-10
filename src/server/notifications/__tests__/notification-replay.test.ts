/**
 * ADR-849 Α4 — η επανάληψη ειδοποίησης: ίδιος παραλήπτης, ίδιο περιεχόμενο, ιδεμποτής,
 * κανένας υποχρεωτικός τύπος.
 */

import { EVENT_CATEGORY_MAP, getCurrentEnvironment } from '@/config/notification-events';
import {
  isReplayTag,
  parseReplaySource,
  replayEventId,
  replayRecipientOf,
  toReplayRequest,
  type ReplaySource,
} from '@/server/notifications/notification-replay';

/** Το σχήμα ενός πραγματικού εγγράφου `notifications` (ταίριασμα ζήτησης, 9/9). */
const LISTING_MATCH_DOC = {
  tenantId: 'user_1',
  userId: 'user_1',
  severity: 'info',
  title: 'Νέα αγγελία ταιριάζει στη ζήτησή σας: «Διαμέρισμα 80 τ.μ.»',
  body: null,
  channel: 'inapp',
  source: { service: 'crm', feature: 'demand-listing-match', env: 'prod' },
  actions: [{ id: 'view', label: 'view', url: '/listing/prop_1' }],
  titleKey: 'demandListingMatch.notificationTitle',
  titleParams: { title: 'Διαμέρισμα 80 τ.μ.' },
  meta: {
    dedupeKey: 'properties.demandListingMatch:user_1:dmnd_1:listing:prop_1',
    eventType: 'properties.demandListingMatch',
    eventId: 'dmnd_1:listing:prop_1',
    entityId: 'prop_1',
    entityType: null,
  },
};

function parsedSource(data: unknown = LISTING_MATCH_DOC, id = 'n_1'): ReplaySource {
  const parsed = parseReplaySource(id, data);
  if (!parsed.ok) throw new Error(`αναμενόταν έγκυρη πηγή, ήρθε ${parsed.reason}`);
  return parsed.source;
}

describe('parseReplaySource — ίδιο περιεχόμενο, ίδιος παραλήπτης', () => {
  it('κρατά παραλήπτη, μισθωτή, τίτλο, κλειδί i18n και ενέργειες του πρωτοτύπου', () => {
    const { request, recipientId } = parsedSource();
    expect(recipientId).toBe('user_1');
    expect(request).toEqual({
      eventType: 'properties.demandListingMatch',
      recipientId: 'user_1',
      tenantId: 'user_1',
      title: LISTING_MATCH_DOC.title,
      severity: 'info',
      entityId: 'prop_1',
      actions: [{ id: 'view', label: 'view', url: '/listing/prop_1' }],
      titleKey: 'demandListingMatch.notificationTitle',
      titleParams: { title: 'Διαμέρισμα 80 τ.μ.' },
      source: { service: 'crm', feature: 'demand-listing-match', env: getCurrentEnvironment() },
    });
  });

  it('δεν γράφει undefined/null: κενό σώμα και άγνωστη οντότητα απλώς λείπουν', () => {
    const { request } = parsedSource();
    expect('body' in request).toBe(false);
    expect('entityType' in request).toBe(false);
  });

  it.each([
    ['missing-recipient', { ...LISTING_MATCH_DOC, userId: '' }],
    ['unknown-event-type', { ...LISTING_MATCH_DOC, meta: { ...LISTING_MATCH_DOC.meta, eventType: 'no.such' } }],
    ['missing-tenant', { ...LISTING_MATCH_DOC, tenantId: undefined }],
    ['missing-title', { ...LISTING_MATCH_DOC, title: '' }],
    ['missing-event-id', { ...LISTING_MATCH_DOC, meta: { ...LISTING_MATCH_DOC.meta, eventId: 7 } }],
    ['invalid-source', { ...LISTING_MATCH_DOC, source: { service: 'marketing' } }],
  ])('αρνείται: %s', (reason, data) => {
    expect(parseReplaySource('n_1', data)).toEqual({ ok: false, notificationId: 'n_1', reason });
  });

  it('αρνείται ΚΑΘΕ υποχρεωτικό τύπο — ποτέ ψεύτικος συναγερμός ασφαλείας', () => {
    const mandatory = Object.entries(EVENT_CATEGORY_MAP).filter(([, mapping]) => mapping.isMandatory);
    expect(mandatory.length).toBeGreaterThan(0);
    for (const [eventType] of mandatory) {
      const data = { ...LISTING_MATCH_DOC, meta: { ...LISTING_MATCH_DOC.meta, eventType } };
      expect(parseReplaySource('n_1', data)).toMatchObject({ ok: false, reason: 'mandatory-type' });
    }
  });
});

describe('toReplayRequest — ιδεμποτής ταυτότητα', () => {
  it('ίδια ετικέτα ⇒ ίδιο eventId (το ατομικό create() το κάνει «διπλότυπο»)', () => {
    const source = parsedSource();
    expect(toReplayRequest(source, 'adr849-a4').eventId).toBe('dmnd_1:listing:prop_1:replay:adr849-a4');
    expect(toReplayRequest(source, 'adr849-a4')).toEqual(toReplayRequest(source, 'adr849-a4'));
  });

  it('διαφορετική ετικέτα ⇒ διαφορετικό eventId, ίδιος παραλήπτης', () => {
    const source = parsedSource();
    const first = toReplayRequest(source, 'run-1');
    const second = toReplayRequest(source, 'run-2');
    expect(first.eventId).not.toBe(second.eventId);
    expect(second.recipientId).toBe(first.recipientId);
  });

  it.each(['', 'Κεφαλαία', 'A-upper', 'with space', 'x'.repeat(41), '-leading'])(
    'άκυρη ετικέτα «%s» ρίχνει, δεν γίνεται ταυτότητα',
    (tag) => {
      expect(isReplayTag(tag)).toBe(false);
      expect(() => replayEventId('evt', tag)).toThrow();
    },
  );
});

describe('replayRecipientOf — ένας παραλήπτης ή κανένας', () => {
  it('ίδιος παραλήπτης σε όλες τις πηγές ⇒ αυτός', () => {
    expect(replayRecipientOf([parsedSource(), parsedSource(undefined, 'n_2')])).toBe('user_1');
  });

  it('δύο παραλήπτες ⇒ null (το script αρνείται)', () => {
    const other = parsedSource({ ...LISTING_MATCH_DOC, userId: 'user_2' }, 'n_2');
    expect(replayRecipientOf([parsedSource(), other])).toBeNull();
  });

  it('καμία πηγή ⇒ null', () => {
    expect(replayRecipientOf([])).toBeNull();
  });
});
