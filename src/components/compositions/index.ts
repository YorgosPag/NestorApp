// Domain-specific compositions using core components

// Card Compositions (using BaseCard)
export * from './BuildingCard';
export * from './ProjectCard';
export * from './ContactCard';
export * from './NotificationCard';
export * from './StorageCard';
export * from './PropertyCard';
export * from './TaskCard';
export * from './UserCard';

// Toolbar Compositions (using BaseToolbar)
export * from './BuildingToolbar';

// Re-export external toolbars that have been migrated to BaseToolbar
export { BuildingToolbar as BuildingManagementToolbar } from '@/components/building-management/BuildingToolbar';
export { ProjectToolbar } from '@/components/projects/ProjectToolbar';
export { ContactsToolbar } from '@/components/contacts/toolbar/ContactsToolbar';

// Showcase Components
export * from './ComponentShowcase';
export * from './ToolbarShowcase';

// Future compositions will be added here:
// export * from './ReportCard';
// export * from './CRMToolbar';
// export * from './PropertyToolbar';