/**
 * 🏢 ENTERPRISE DOMAIN CARDS - Main Barrel Export
 *
 * Central export for all domain-specific card components.
 * These are Organisms in Atomic Design - composed from design-system molecules.
 *
 * @fileoverview Main barrel export for domain cards.
 * @enterprise Fortune 500 compliant - Single source of truth
 * @author Enterprise Architecture Team
 * @since 2026-01-08
 */

// =============================================================================
// 🅿️ PARKING
// =============================================================================

export { ParkingListCard, type ParkingListCardProps } from './parking';
export { ParkingGridCard, type ParkingGridCardProps } from './parking';

// =============================================================================
// 🏠 PROPERTY (formerly Unit)
// =============================================================================

export { PropertyListCard, type PropertyListCardProps } from './property';
export { PropertyGridCard, type PropertyGridCardProps } from './property';

// =============================================================================
// 📦 STORAGE
// =============================================================================

export { StorageListCard, type StorageListCardProps } from './storage';
export { StorageGridCard, type StorageGridCardProps } from './storage';

// =============================================================================
// 🏢 BUILDING
// =============================================================================

export { BuildingListCard, type BuildingListCardProps } from './building';
export { BuildingGridCard, type BuildingGridCardProps } from './building';

// =============================================================================
// 👤 CONTACT
// =============================================================================

export { ContactListCard, type ContactListCardProps } from './contact';
export { ContactGridCard, type ContactGridCardProps } from './contact';

// =============================================================================
// 📋 PROJECT
// =============================================================================

export { ProjectListCard, type ProjectListCardProps } from './project';
export { ProjectGridCard, type ProjectGridCardProps } from './project';


// =============================================================================
// 🗺️ OVERLAY (DXF Viewer Regions/Areas)
// =============================================================================

export { OverlayListCard, type OverlayListCardProps } from './overlay';

// =============================================================================
// 🏢 LEVEL (DXF Viewer Floor Levels)
// =============================================================================

export { LevelListCard, type LevelListCardProps } from './level';

// =============================================================================
// 💬 CONVERSATION (CRM Communications)
// =============================================================================

export { ConversationListCard, type ConversationListCardProps } from './conversation';
