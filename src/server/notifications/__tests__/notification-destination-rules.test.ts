/**
 * @jest-environment node
 *
 * Άγκυρα — **ΟΙ ΚΑΝΟΝΕΣ ΤΟΥ ΑΝΙΧΝΕΥΤΗ = ΟΙ ΚΑΝΟΝΕΣ ΤΟΥ ΠΑΡΑΓΩΓΟΥ** (ADR-849 §6δ Β2)
 *
 * 🔑 Η Firestore είναι η **ψεύτικη** του repo (`FakeFirestore`) — οι κανόνες τρέχουν
 * **αληθινοί**: ο εντοπισμός, η θεματοφυλακή, οι βοηθοί διαδρομών των παραγωγών.
 *
 * | # | ισχυρισμός | η μετάλλαξη που το σπάει |
 * |---|---|---|
 * | Ζ | η πόρτα της ζήτησης βγαίνει από τη ΣΥΛΛΟΓΗ | πρόθεμα `prop_` ⇒ ή πόρτα ή χώρος λάθος |
 * | Ε | ο χώρος της εντολής = η θεματοφυλακή | `tenantId` ⇒ δεύτερη ερμηνεία |
 * | Λ | τύπος χωρίς κανόνα λέγεται, δεν μαντεύεται | προεπιλογή «ο χώρος του παραλήπτη» |
 */

jest.mock('server-only', () => ({}));
jest.mock('@/server/notifications/notification-orchestrator', () => ({ dispatchNotification: jest.fn() }));

import { COLLECTIONS } from '@/config/firestore-collections';
import { listingDetailHref } from '@/lib/listings/listing-routes';
import { mandateDetailHref } from '@/lib/mandate/mandate-routes';
import { offerDetailHref } from '@/lib/owner-property/owner-property-routes';
import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
import type { StoredNotification } from '@/server/notifications/notification-destination-drift';
import {
  expectedDestinationOf,
  RULED_EVENT_TYPES,
} from '@/server/notifications/notification-destination-rules';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

/** Ελάχιστη αγγελία ιδιώτη — τα πεδία που διαβάζει το σύνορο (`ownerPropertyFromDocument`). */
function ownerListing(authorUserId: string, authorCompanyId: string | null): Record<string, unknown> {
  return {
    authorUserId,
    authorCompanyId,
    type: 'apartment',
    title: 'Δοκιμαστικό',
    areaSqm: 80,
    bedrooms: 2,
    floor: 1,
    offers: null,
    mandate: { kind: 'owner' },
    place: { kind: 'declined' },
  };
}

function notification(eventType: string, entityId: string | null, userId = 'u1'): StoredNotification {
  return { id: 'n_1', userId, eventType, entityId, url: '/x', workspace: null };
}

function world(): AdminFirestore {
  const fake = new FakeFirestore();
  fake.seed(COLLECTIONS.OWNER_PROPERTIES, 'ownp_1', ownerListing('u1', null));
  fake.seed(COLLECTIONS.OWNER_PROPERTIES, 'ownp_brokered', ownerListing('u_agent', 'comp_agency'));
  fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', { companyId: 'comp_9c7c', name: 'Διαμέρισμα' });
  fake.seed(COLLECTIONS.PROPERTIES, 'prop_orphan', { name: 'Χωρίς εταιρεία' });
  return fake as unknown as AdminFirestore;
}

describe('🔴 Ζ — ζήτηση: η πόρτα και ο χώρος από τη ΣΥΛΛΟΓΗ', () => {
  it('Ζ1 🔑 — ακίνητο ΓΡΑΦΕΙΟΥ ⇒ `/properties/…` στον χώρο της εταιρείας του', async () => {
    expect(await expectedDestinationOf(world(), notification('properties.demandInterest', 'prop_1'))).toEqual({
      kind: 'expected',
      destination: {
        actions: [{ id: 'view', label: 'view', url: ENTITY_ROUTES.properties.withId('prop_1') }],
        workspace: { kind: 'org', companyId: 'comp_9c7c' },
      },
    });
  });

  it('Ζ2 — ακίνητο ΙΔΙΩΤΗ ⇒ `/offers/…` στον ιδιωτικό χώρο του κατόχου', async () => {
    expect(await expectedDestinationOf(world(), notification('properties.demandInterest', 'ownp_1'))).toEqual({
      kind: 'expected',
      destination: {
        actions: [{ id: 'view', label: 'view', url: offerDetailHref('ownp_1') }],
        workspace: { kind: 'personal', userId: 'u1' },
      },
    });
  });

  it.each([
    ['prop_orphan', 'unscoped'],
    ['prop_gone', 'entity-absent'],
  ])('Ζ3 — %s ⇒ %s (ονομασμένο, καμία πόρτα)', async (entityId, reason) => {
    expect(await expectedDestinationOf(world(), notification('properties.demandInterest', entityId))).toEqual({
      kind: 'unresolvable',
      reason,
    });
  });
});

describe('Ε — εντολές', () => {
  it('Ε1 🔑 — απόφαση εντολής ⇒ ο χώρος της ΘΕΜΑΤΟΦΥΛΑΚΗΣ (το γραφείο που διαχειρίζεται)', async () => {
    expect(
      await expectedDestinationOf(world(), notification('properties.mandateDecided', 'ownp_brokered', 'u_agent')),
    ).toEqual({
      kind: 'expected',
      destination: {
        actions: [{ id: 'view', label: 'view', url: mandateDetailHref('ownp_brokered') }],
        workspace: { kind: 'org', companyId: 'comp_agency' },
      },
    });
  });

  it('Ε2 — απάντηση σε αίτημα ⇒ η καταχώρηση, στον ιδιωτικό χώρο του παραλήπτη', async () => {
    expect(
      await expectedDestinationOf(world(), notification('properties.mandateRequestAnswered', 'ownp_1')),
    ).toMatchObject({
      destination: { actions: [{ url: offerDetailHref('ownp_1') }], workspace: { kind: 'personal', userId: 'u1' } },
    });
  });

  it('🔴 Ε4 — email κάρτας επέστρεψε (Α21.20) ⇒ η κάρτα, στον χώρο του ΓΡΑΦΕΙΟΥ-οντότητας (ο κανόνας ΕΚΤΕΛΕΙΤΑΙ, όχι μόνο μετριέται)', async () => {
    expect(await expectedDestinationOf(world(), notification('properties.cardEmailReturned', 'comp_9c7c'))).toEqual({
      kind: 'expected',
      destination: {
        actions: [{ id: 'view', label: 'view', url: '/settings/agency-profile/card' }],
        workspace: { kind: 'org', companyId: 'comp_9c7c' },
      },
    });
  });

  it('Ε3 — απόφαση για αγγελία που δεν υπάρχει πια ⇒ entity-absent', async () => {
    expect(await expectedDestinationOf(world(), notification('properties.mandateDecided', 'ownp_gone'))).toEqual({
      kind: 'unresolvable',
      reason: 'entity-absent',
    });
  });
});

describe('Λ — ό,τι δεν ξέρουμε, λέγεται', () => {
  it('Λ1 — ταίριασμα αγγελίας ⇒ η δημόσια αγγελία, με χώρο-προέλευση τον ζητούντα', async () => {
    expect(
      await expectedDestinationOf(world(), notification('properties.demandListingMatch', 'prop_1', 'u_seeker')),
    ).toMatchObject({
      destination: { actions: [{ url: listingDetailHref('prop_1') }], workspace: { kind: 'personal', userId: 'u_seeker' } },
    });
  });

  it.each([
    ['procurement.poApproved', 'po_1', 'no-rule'],
    ['no.such.type', 'x', 'no-rule'],
    ['properties.demandInterest', null, 'no-entity'],
  ])('Λ2 🔴 — %s ⇒ %s, ΠΟΤΕ μαντεψιά', async (eventType, entityId, reason) => {
    expect(await expectedDestinationOf(world(), notification(eventType, entityId))).toEqual({
      kind: 'unresolvable',
      reason,
    });
  });

  it('Λ3 — οι τέσσερις τύποι της βάσης (μετρημένοι 2026-09-11) + η επιστροφή email κάρτας (Α21.20) έχουν κανόνα', () => {
    expect([...RULED_EVENT_TYPES].sort()).toEqual([
      'properties.cardEmailReturned',
      'properties.demandInterest',
      'properties.demandListingMatch',
      'properties.mandateDecided',
      'properties.mandateRequestAnswered',
    ]);
  });
});
