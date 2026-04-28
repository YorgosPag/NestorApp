/**
 * 🏢 ENTERPRISE DOMAIN - Main Barrel Export
 *
 * Central export for all domain-specific components.
 *
 * @fileoverview Main barrel export for domain layer.
 * @enterprise Fortune 500 compliant
 * @author Enterprise Architecture Team
 * @since 2026-01-08
 */

// =============================================================================
// 🎴 CARDS - LIST VIEW (Horizontal Layout)
// =============================================================================

export {
  // Parking
  ParkingListCard,
  type ParkingListCardProps,
  // Property (formerly Unit)
  // Storage
  StorageListCard,
  type StorageListCardProps,
  // Building
  BuildingListCard,
  type BuildingListCardProps,
  // Contact
  ContactListCard,
  type ContactListCardProps,
  // Project
  ProjectListCard,
  type ProjectListCardProps,
  // Property
  PropertyListCard,
  type PropertyListCardProps,
  // Conversation
  ConversationListCard,
  type ConversationListCardProps,
  // Purchase Order (Procurement)
  PurchaseOrderListCard,
  type PurchaseOrderListCardProps,
  // Quote (Procurement)
  QuoteListCard,
  type QuoteListCardProps,
} from './cards';

// =============================================================================
// 🎴 CARDS - GRID VIEW (Vertical Layout) - Added 2026-01-24
// =============================================================================

export {
  // Property (formerly Unit)
  PropertyGridCard,
  type PropertyGridCardProps,
  // Building
  BuildingGridCard,
  type BuildingGridCardProps,
  // Contact
  ContactGridCard,
  type ContactGridCardProps,
  // Project
  ProjectGridCard,
  type ProjectGridCardProps,
  // Storage - Added 2026-01-24
  StorageGridCard,
  type StorageGridCardProps,
  // Parking - Added 2026-01-24
  ParkingGridCard,
  type ParkingGridCardProps,
} from './cards';
