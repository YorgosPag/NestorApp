// This file now acts as a barrel file to re-export from the new structure,
// ensuring that no other part of the application needs to change its import paths.
// This maintains the public API and avoids breaking changes.

export * from './obligations/contracts';
export * from './obligations/factories';
export * from './obligations/numbering';
export * from './obligations/toc';
export * from './obligations/structure';
export * from './obligations/dnd';

export * from './obligations/transmittals';
