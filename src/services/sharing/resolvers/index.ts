/**
 * =============================================================================
 * SHARE RESOLVERS — Auto-registration barrel (ADR-315)
 * =============================================================================
 *
 * Importing this file registers all entity resolvers with
 * `ShareEntityRegistry`. Must be imported once, early, at app bootstrap
 * (and by the public share route + the unified share dialog host).
 *
 * `vendor_rfq_invite` is deliberately absent: it carries a pre-generated HMAC
 * URL and never passes through the share-token lifecycle. The exhaustiveness
 * anchor pins that exclusion so it stays a decision, not an omission.
 *
 * @module services/sharing/resolvers
 * @see adrs/ADR-699-share-resolver-declarations.md
 */

import { ShareEntityRegistry } from '@/services/sharing/share-entity-registry';
import { fileShareResolver } from './file.resolver';
import { contactShareResolver } from './contact.resolver';
import {
  buildingShowcaseShareResolver,
  parkingShowcaseShareResolver,
  projectShowcaseShareResolver,
  propertyShowcaseShareResolver,
  storageShowcaseShareResolver,
} from './showcase-surfaces.resolvers';

let registered = false;

export function registerShareResolvers(): void {
  if (registered) return;
  ShareEntityRegistry.register('file', fileShareResolver);
  ShareEntityRegistry.register('contact', contactShareResolver);
  ShareEntityRegistry.register('property_showcase', propertyShowcaseShareResolver);
  ShareEntityRegistry.register('project_showcase', projectShowcaseShareResolver);
  ShareEntityRegistry.register('building_showcase', buildingShowcaseShareResolver);
  ShareEntityRegistry.register('storage_showcase', storageShowcaseShareResolver);
  ShareEntityRegistry.register('parking_showcase', parkingShowcaseShareResolver);
  registered = true;
}

// Auto-register on module import — resolvers are idempotent side-effects.
registerShareResolvers();

export {
  fileShareResolver,
  contactShareResolver,
  propertyShowcaseShareResolver,
  projectShowcaseShareResolver,
  buildingShowcaseShareResolver,
  storageShowcaseShareResolver,
  parkingShowcaseShareResolver,
};
export type { FileShareResolvedData } from './file.resolver';
export type { ContactShareResolvedData } from './contact.resolver';
export type {
  PropertyShowcaseResolvedData,
  ProjectShowcaseResolvedData,
  BuildingShowcaseResolvedData,
  StorageShowcaseResolvedData,
  ParkingShowcaseResolvedData,
} from './showcase-surfaces.resolvers';
