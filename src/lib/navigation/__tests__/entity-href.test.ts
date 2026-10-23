/**
 * ADR-242 Βήμα 5 — `getEntityHref`: ο ΕΝΑΣ resolver «σελίδα οντότητας ανά τύπο».
 * Ζητά από το κεντρικό μητρώο· δεν γράφει διευθύνσεις, ούτε δείχνει σε redirect.
 */

import {
  LINKABLE_ENTITY_TYPES,
  getEntityHref,
  isLinkableEntityType,
  type LinkableEntityType,
} from '@/lib/navigation/entity-href';
import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
import { getProjectUrl } from '@/lib/navigation/project-urls';

const ID = 'ent_1';

const EXPECTED: Readonly<Record<LinkableEntityType, string>> = {
  contact: ENTITY_ROUTES.contacts.withId(ID),
  project: getProjectUrl(ID),
  building: ENTITY_ROUTES.buildings.withId(ID),
  property: ENTITY_ROUTES.properties.withId(ID),
  parking: ENTITY_ROUTES.spaces.parking(ID),
  storage: ENTITY_ROUTES.spaces.storage(ID),
  purchase_order: ENTITY_ROUTES.procurement.purchaseOrder(ID),
  crm_task: ENTITY_ROUTES.crm.task(ID),
};

describe('getEntityHref — κάθε τύπος → η διεύθυνση του SSoT', () => {
  it.each(LINKABLE_ENTITY_TYPES)('%s', (type) => {
    expect(getEntityHref(type, ID)).toBe(EXPECTED[type]);
  });

  it('κάθε τύπος έχει διεύθυνση που περιέχει το id', () => {
    for (const type of LINKABLE_ENTITY_TYPES) {
      expect(getEntityHref(type, ID)).toContain(ID);
    }
  });

  it.each(['/projects/', '/contacts/', '/buildings/', '/parking/', '/storage/'])(
    'κανένας τύπος δεν δείχνει σε διεύθυνση-redirect `%s:id`',
    (redirectPrefix) => {
      for (const type of LINKABLE_ENTITY_TYPES) {
        expect(getEntityHref(type, ID)).not.toContain(`${redirectPrefix}${ID}`);
      }
    },
  );
});

describe('isLinkableEntityType', () => {
  it('δέχεται μόνο τους δηλωμένους τύπους', () => {
    expect(isLinkableEntityType('project')).toBe(true);
    expect(isLinkableEntityType('invoice')).toBe(false);
    expect(isLinkableEntityType('')).toBe(false);
  });
});
