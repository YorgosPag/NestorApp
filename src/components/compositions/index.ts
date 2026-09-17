// Domain-specific compositions using core components

// Card Compositions (using BaseCard)
export * from './ContactCard';
export * from './NotificationCard';
// StorageCard removed 2026-09-17 (ADR-777 §8.60.13): zero importers, and it printed the
// flat `price` as «…/μήνα» — a monthly unit invented for a figure nobody declared monthly.
// PropertyCard removed 2026-08-09 (ADR-777 Α6): dead duplicate of the live
// features/property-grid card — zero importers, and it read the @deprecated
// flat `price` field. The live card resolves via lib/properties/price-resolver.
export * from './TaskCard';
export * from './UserCard';

// 🔧 TODO: Create BuildingCard composition
// export * from './BuildingCard';

// Toolbar Compositions (using BaseToolbar)
export * from './BuildingToolbar';

// Re-export external toolbars that have been migrated to BaseToolbar
export { BuildingToolbar as BuildingManagementToolbar } from '@/components/building-management/BuildingToolbar';
export { ProjectToolbar } from '@/components/projects/ProjectToolbar';
export { ContactsToolbar } from '@/components/contacts/toolbar/ContactsToolbar';

// Showcase Components
// 🔧 NOTE: ComponentShowcase imports from this index, would create circular dependency
// export * from './ComponentShowcase';
export * from './ToolbarShowcase';

// Future compositions will be added here:
// export * from './ReportCard';
// export * from './CRMToolbar';
// export * from './PropertyToolbar';