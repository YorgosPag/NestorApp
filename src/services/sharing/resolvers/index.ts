/**
 * =============================================================================
 * SHARE RESOLVERS — Auto-registration barrel (ADR-315)
 * =============================================================================
 *
 * Importing this file registers all entity resolvers with
 * `ShareEntityRegistry`. Must be imported once, early, at app bootstrap
 * (and by the public share route + the unified share dialog host).
 *
 * @module services/sharing/resolvers
 */

import { ShareEntityRegistry } from '@/services/sharing/share-entity-registry';
import { fileShareResolver } from './file.resolver';
import { contactShareResolver } from './contact.resolver';
import { propertyShowcaseShareResolver } from './property-showcase.resolver';
import { projectShowcaseShareResolver } from './project-showcase.resolver';
import { buildingShowcaseShareResolver } from './building-showcase.resolver';
import { storageShowcaseShareResolver } from './storage-showcase.resolver';

let registered = false;

export function registerShareResolvers(): void {
  if (registered) return;
  ShareEntityRegistry.register('file', fileShareResolver);
  ShareEntityRegistry.register('contact', contactShareResolver);
  ShareEntityRegistry.register('property_showcase', propertyShowcaseShareResolver);
  ShareEntityRegistry.register('project_showcase', projectShowcaseShareResolver);
  ShareEntityRegistry.register('building_showcase', buildingShowcaseShareResolver);
  ShareEntityRegistry.register('storage_showcase', storageShowcaseShareResolver);
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
};
export type { FileShareResolvedData } from './file.resolver';
export type { ContactShareResolvedData } from './contact.resolver';
export type { PropertyShowcaseResolvedData } from './property-showcase.resolver';
export type { ProjectShowcaseResolvedData } from './project-showcase.resolver';
export type { BuildingShowcaseResolvedData } from './building-showcase.resolver';
export type { StorageShowcaseResolvedData } from './storage-showcase.resolver';
