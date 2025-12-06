// This barrel file re-exports everything from its sibling modules,
// ensuring that the public API of this directory remains consistent
// and that imports from '@/types/contacts' continue to work seamlessly.

export * from './contracts';
export * from './helpers';
export * from './relationships'; // 🏢 ENTERPRISE: Contact Relationship Management Types
