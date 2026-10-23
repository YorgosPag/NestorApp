/**
 * @module lib/navigation/entity-href
 *
 * SSoT for «the canonical page of ONE entity, by type» — the question every cross-entity link asks
 * (audit timeline, report builder rows). It does NOT write addresses: it asks `ENTITY_ROUTES` / `getProjectUrl`,
 * so each type goes straight to its canonical form (never to a redirect such as `/projects/:id`).
 *
 * 🔑 A type is here only if a detail page exists that a URL can open. Entities whose details are local screen
 *   state (e.g. invoices: `viewInvoiceId` inside the list) are NOT linkable — callers declare that, with a reason.
 *
 * @see ADR-242 Βήμα 5 (report table → entity link) · ADR-268 (report builder)
 */

import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
import { getProjectUrl } from '@/lib/navigation/project-urls';

export const LINKABLE_ENTITY_TYPES = [
  'contact',
  'project',
  'building',
  'property',
  'parking',
  'storage',
  'purchase_order',
  'crm_task',
] as const;

export type LinkableEntityType = (typeof LINKABLE_ENTITY_TYPES)[number];

export function isLinkableEntityType(type: string): type is LinkableEntityType {
  return (LINKABLE_ENTITY_TYPES as readonly string[]).includes(type);
}

/** The canonical page of one entity — the exact href shapes `ENTITY_ROUTES` / `getProjectUrl` build. */
export type EntityHref = ReturnType<typeof getEntityHref>;

export function getEntityHref(type: LinkableEntityType, id: string) {
  switch (type) {
    case 'contact':
      return ENTITY_ROUTES.contacts.withId(id);
    case 'project':
      return getProjectUrl(id);
    case 'building':
      return ENTITY_ROUTES.buildings.withId(id);
    case 'property':
      return ENTITY_ROUTES.properties.withId(id);
    case 'parking':
      return ENTITY_ROUTES.spaces.parking(id);
    case 'storage':
      return ENTITY_ROUTES.spaces.storage(id);
    case 'purchase_order':
      return ENTITY_ROUTES.procurement.purchaseOrder(id);
    case 'crm_task':
      return ENTITY_ROUTES.crm.task(id);
  }
}
