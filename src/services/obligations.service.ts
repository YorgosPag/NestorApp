// This file now acts as a barrel file to re-export the service from its new location,
// ensuring that no other part of the application needs to change its import paths.
// This maintains the public API and avoids breaking changes.
export { obligationsService } from './obligations';
