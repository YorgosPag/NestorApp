/**
 * PROPERTY STATUSES ENTERPRISE — BARREL FILE
 *
 * This file was split into domain-specific files per Google SRP principle.
 * All 72+ consumers continue importing from this path — zero breaking changes.
 *
 * Domain files:
 * @see ./domains/property-status-core.ts    — Property status types, labels, colors, utility functions
 * @see ./domains/filter-labels.ts           — Filter labels for toolbars and list views
 * @see ./domains/communication-labels.ts    — Communication type labels (phone, email, social, etc.)
 * @see ./domains/dxf-labels.ts              — DXF viewer tool and settings labels
 * @see ./domains/form-field-labels.ts       — Form field labels (individual, company, service)
 * @see ./domains/dropdown-misc-labels.ts    — Dropdown placeholders, unit/storage/parking, generic labels
 * @see ./domains/project-building-persona-labels.ts — Project tabs, building toolbar, persona system
 */

// Core property status system (types, labels, colors, functions)
export * from './domains/property-status-core';

// Filter labels (common, property, storage, parking, unified)
export * from './domains/filter-labels';

// Communication type labels (individual, company, service)
export * from './domains/communication-labels';

// DXF viewer tool and settings labels
export * from './domains/dxf-labels';

// Form field labels (individual, company, service config)
export * from './domains/form-field-labels';

// Dropdown placeholders, unit/storage/parking, generic labels
export * from './domains/dropdown-misc-labels';

// Project tabs, building toolbar, persona labels
export * from './domains/project-building-persona-labels';

// Default export (property status core)
export { default } from './domains/property-status-core';
