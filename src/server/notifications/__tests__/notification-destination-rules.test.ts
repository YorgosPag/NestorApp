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
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
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

  it('Λ3 — οι τέσσερις τύποι της βάσης (μετρημένοι 2026-09-11) + η επιστροφή email κάρτας (Α21.20) + η ερώτηση αργιών (Α21.21) έχουν κανόνα', () => {
    expect([...RULED_EVENT_TYPES].sort()).toEqual([
      // ADR-867 Β7 · §8 #9 — νέο μήνυμα (η πλευρά από το θέμα) · είσοδος στην ομάδα (η εντολή, στο νήμα).
      'network.teamJoined',
      'network.threadMessage',
      'properties.cardEmailReturned',
      // ADR-901 Φ4.4 — νέο έγγραφο (transmittal): ΙΔΙΟΙ προορισμοί με το ζεύγος της συμμετοχής.
      'properties.caseDocumentEngaged',
      'properties.caseDocumentHost',
      // ADR-901 Φ4.5 — «Ζήτησε έγγραφο»: ΙΔΙΟΙ προορισμοί με το ζεύγος της συμμετοχής.
      'properties.caseDocumentRequestEngaged',
      'properties.caseDocumentRequestHost',
      // ADR-901 Φ2 — ο οικοδεσπότης στο ακίνητο (χώρος = μισθωτής του ακινήτου) · ο επαγγελματίας στη
      // σελίδα της υπόθεσης, στον ΔΙΚΟ του χώρο (καμία ανάγνωση).
      'properties.caseEngagementAnswered',
      'properties.caseEngagementChanged',
      // ADR-901 Φ4 — λήξεις δικαιολογητικών: ΙΔΙΟΙ προορισμοί με το ζεύγος της συμμετοχής.
      'properties.caseExpiryEngaged',
      'properties.caseExpiryHost',
      'properties.demandInterest',
      'properties.demandListingMatch',
      // ADR-777 §8.69 — η μείωση οδηγεί στην ίδια δημόσια αγγελία, με τον ίδιο κανόνα.
      'properties.demandPriceDrop',
      // ADR-843 §10.20 — «νέο ενδιαφέρον»: τα εισερχόμενα επαφών, στον ιδιωτικό χώρο του παραλήπτη.
      'properties.firstContactReceived',
      // ADR-841 §7 Α21.21 Φάση Β — η ερώτηση αργιών οδηγεί στην κάρτα του γραφείου.
      'properties.holidayHoursQuestion',
      'properties.mandateDecided',
      'properties.mandateRequestAnswered',
      // ADR-900 §8 #2 Β3 — απόφαση κατοχής: η σελίδα της αγγελίας, στον χώρο της θεματοφυλακής (ίδιος κανόνας για τα δύο).
      'properties.ownershipVerificationDecided',
      // ADR-835 §23.6 (Στάδιο Δ) — ο οικοδεσπότης στο ημερολόγιο (χώρος = θεματοφυλακή),
      // ο επισκέπτης στη δημόσια αγγελία (ίδιος κανόνας με την αντιστοίχιση ζήτησης).
      'properties.stayRequestAnswered',
      'properties.stayRequestReceived',
      // ADR-884 Κ3β — ο υπεύθυνος στο πάνελ περιήγησης (χώρος = θεματοφυλακή της ρίζας), ο αιτών στη σελίδα θέασης.
      'properties.tourAccessAnswered',
      'properties.tourAccessRequested',
      // ADR-884 §9.1 Α3′ — το άνοιγμα προσωπικού συνδέσμου οδηγεί στο ΙΔΙΟ πάνελ, με τον ΙΔΙΟ κανόνα.
      'properties.tourLinkOpened',
      'security.ownershipLost',
    ]);
  });
});

describe('ADR-901 §15 (Γ1) — ο επαγγελματίας προσγειώνεται στον χώρο για λογαριασμό του οποίου ανέλαβε', () => {
  const ENGAGED_TYPES = [
    'properties.caseEngagementChanged',
    'properties.caseExpiryEngaged',
    'properties.caseDocumentEngaged',
    'properties.caseDocumentRequestEngaged',
  ] as const;

  /** Μία συμμετοχή του `u_lawyer`, όπως τη γράφει ο ΕΝΑΣ γραφέας. */
  function withEngagement(actingFor?: Record<string, unknown>): AdminFirestore {
    const fake = new FakeFirestore();
    fake.seed('companies/comp_host/projects/proj_1/engagements', 'eng_1', {
      id: 'eng_1', hostCompanyId: 'comp_host', projectId: 'proj_1', uid: 'u_lawyer', email: 'l@x.gr', template: 'legal',
      role: 'buyer_lawyer', subject: { kind: 'conveyance_case', caseId: 'cvc_1' }, scopes: ['conveyance:case:view'],
      state: 'active', expiresAt: '2027-10-05T10:00:00.000Z', origin: { kind: 'professional_appointment', contactId: 'cont_1' },
      consents: [], offeredBy: 'u_host', offeredAt: '2026-10-04T10:00:00.000Z', respondedAt: '2026-10-05T10:00:00.000Z',
      revokedBy: null, closedAt: null, updatedAt: '2026-10-05T10:00:00.000Z',
      ...(actingFor ? { actingFor } : {}),
    });
    return fake as unknown as AdminFirestore;
  }

  const workspaceOf = async (db: AdminFirestore, eventType: string, userId = 'u_lawyer') => {
    const expected = await expectedDestinationOf(db, notification(eventType, 'eng_1', userId));
    return expected.kind === 'expected' ? expected.destination.workspace : expected.reason;
  };

  it.each(ENGAGED_TYPES)('%s — ανέλαβε για ΓΡΑΦΕΙΟ ⇒ ο χώρος του γραφείου (όχι σταθερά ο προσωπικός)', async (eventType) => {
    // Μετάλλαξη: ο παραγωγός γράφει ξανά σταθερά `personalWorkspace(uid)` ⇒ ο ανιχνευτής «διορθώνει» προς τα πίσω.
    expect(await workspaceOf(withEngagement({ kind: 'org', companyId: 'comp_law' }), eventType)).toEqual({ kind: 'org', companyId: 'comp_law' });
  });

  it('Α48 — συμμετοχή ΧΩΡΙΣ `actingFor` (οι υπάρχουσες) ⇒ ο προσωπικός χώρος του ίδιου, όπως πριν', async () => {
    expect(await workspaceOf(withEngagement(), 'properties.caseEngagementChanged')).toEqual({ kind: 'personal', userId: 'u_lawyer' });
  });

  it('συμμετοχή ΑΛΛΟΥ ανθρώπου (ή ανύπαρκτη) ⇒ `entity-absent` — καμία διόρθωση, καμία μαντεψιά', async () => {
    const db = withEngagement({ kind: 'org', companyId: 'comp_law' });
    expect(await workspaceOf(db, 'properties.caseEngagementChanged', 'u_other')).toBe('entity-absent');
  });
});
