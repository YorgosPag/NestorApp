/**
 * Άγκυρα — **ΑΝΙΧΝΕΥΤΗΣ ΑΠΟΚΛΙΣΗΣ ΠΡΟΟΡΙΣΜΩΝ: Η ΚΡΙΣΗ** (ADR-849 §6δ Β2)
 *
 * Οι περιπτώσεις είναι **τα πραγματικά σχήματα** της βάσης (μετρημένα 2026-09-11):
 * `/offers/prop_*` χωρίς χώρο (5 έγγραφα) · σωστή πόρτα χωρίς χώρο (22) · πλήρες (μετά).
 *
 * | # | ισχυρισμός | η μετάλλαξη που το σπάει |
 * |---|---|---|
 * | Α | η λάθος πόρτα ΚΑΙ ο χώρος που λείπει φαίνονται | σύγκριση μόνο της πόρτας |
 * | Β | το patch αγγίζει ΜΟΝΟ ό,τι αποκλίνει | πάντα ολόκληρο ⇒ ξαναγράφει σωστά έγγραφα |
 * | Γ | ιδεμποτές: μετά το patch ⇒ `aligned` | patch που δεν φέρνει στον στόχο |
 */

import { placeDestination } from '@/lib/places/place-detail-route';
import {
  destinationDrift,
  storedNotificationOf,
  type ExpectedDestination,
  type StoredNotification,
} from '@/server/notifications/notification-destination-drift';

const PROP = 'prop_2d612992-32fd-4ec3-b459-38c9882f7017';

/** Το πραγματικό σχήμα ενός από τα 5 ελαττωματικά έγγραφα. */
const LEGACY_WRONG_DOOR = {
  userId: 'WKBW',
  tenantId: 'comp_9c7c',
  actions: [{ id: 'view', label: 'view', url: `/offers/${PROP}` }],
  meta: { eventType: 'properties.demandInterest', entityId: PROP, entityType: null },
};

const TODAY: ExpectedDestination = {
  kind: 'expected',
  destination: placeDestination('company-property', PROP, 'comp_9c7c'),
};

function stored(data: unknown = LEGACY_WRONG_DOOR): StoredNotification {
  const parsed = storedNotificationOf('n_1', data);
  if (parsed === null) throw new Error('αναμενόταν ειδοποίηση με προορισμό');
  return parsed;
}

describe('storedNotificationOf — ό,τι κρίνεται', () => {
  it('διαβάζει παραλήπτη, τύπο, οντότητα, πόρτα και (ξανακριμένο) χώρο', () => {
    expect(stored()).toEqual({
      id: 'n_1',
      userId: 'WKBW',
      eventType: 'properties.demandInterest',
      entityId: PROP,
      url: `/offers/${PROP}`,
      workspace: null,
    });
  });

  it('χωρίς σύνδεσμο ⇒ null: δεν υπάρχει πόρτα να αποκλίνει', () => {
    const { actions: _actions, ...withoutActions } = LEGACY_WRONG_DOOR;
    expect(storedNotificationOf('n_1', withoutActions)).toBeNull();
    expect(storedNotificationOf('n_1', { ...LEGACY_WRONG_DOOR, userId: '' })).toBeNull();
  });
});

describe('🔴 Α — η λάθος πόρτα και ο χώρος που λείπει', () => {
  it('Α1 🔑 — `/offers/prop_*` χωρίς χώρο ⇒ ΚΑΙ τα δύο αποκλίνουν', () => {
    const verdict = destinationDrift(stored(), TODAY);

    expect(verdict).toMatchObject({
      kind: 'drift',
      url: { stored: `/offers/${PROP}`, expected: `/properties/${PROP}` },
      workspace: { stored: null, expected: { kind: 'org', companyId: 'comp_9c7c' } },
    });
  });

  it('Α2 — σωστή πόρτα, χώρος που λείπει ⇒ μόνο ο χώρος', () => {
    const data = { ...LEGACY_WRONG_DOOR, actions: [{ id: 'view', label: 'view', url: `/properties/${PROP}` }] };
    const verdict = destinationDrift(stored(data), TODAY);

    expect(verdict).toMatchObject({ kind: 'drift', url: null });
    expect(verdict.kind === 'drift' && verdict.patch).toEqual({
      'meta.workspace': { kind: 'org', companyId: 'comp_9c7c' },
    });
  });

  it('Α3 🔴 — χώρος ΑΛΛΟΥ γραφείου ⇒ απόκλιση (όχι «υπάρχει κάποιος, άρα εντάξει»)', () => {
    const data = {
      ...LEGACY_WRONG_DOOR,
      actions: [{ id: 'view', label: 'view', url: `/properties/${PROP}` }],
      meta: { ...LEGACY_WRONG_DOOR.meta, workspace: { kind: 'org', companyId: 'comp_other' } },
    };
    expect(destinationDrift(stored(data), TODAY)).toMatchObject({
      kind: 'drift',
      workspace: { stored: { kind: 'org', companyId: 'comp_other' } },
    });
  });

  it('Α4 — ο κανόνας δεν ξέρει ⇒ ο λόγος περνά ΟΝΟΜΑΣΤΙΚΑ, κανένα patch', () => {
    expect(destinationDrift(stored(), { kind: 'unresolvable', reason: 'unscoped' })).toEqual({
      kind: 'unresolvable',
      reason: 'unscoped',
    });
  });
});

describe('Β/Γ — το patch: ελάχιστο και ιδεμποτές', () => {
  it('Β1 — η λάθος πόρτα αντικαθίσταται με τις ενέργειες ΤΟΥ ΠΑΡΑΓΩΓΟΥ', () => {
    const verdict = destinationDrift(stored(), TODAY);
    expect(verdict.kind === 'drift' && verdict.patch.actions).toEqual([
      { id: 'view', label: 'view', url: `/properties/${PROP}` },
    ]);
  });

  it('Γ1 🔑 — μετά το patch, το ίδιο έγγραφο είναι `aligned` (δεύτερο πέρασμα ⇒ 0 εγγραφές)', () => {
    const verdict = destinationDrift(stored(), TODAY);
    if (verdict.kind !== 'drift') throw new Error('αναμενόταν απόκλιση');

    const healed = {
      ...LEGACY_WRONG_DOOR,
      actions: verdict.patch.actions,
      meta: { ...LEGACY_WRONG_DOOR.meta, workspace: verdict.patch['meta.workspace'] },
    };
    expect(destinationDrift(stored(healed), TODAY)).toEqual({ kind: 'aligned' });
  });
});
