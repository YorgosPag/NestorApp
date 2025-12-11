// ============================================================================
// 🏢 ENTERPRISE COMMUNICATION TYPES - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ TYPES
// ============================================================================
//
// 📍 EXTRACTED FROM: UniversalCommunicationManager.tsx
// 🎯 PURPOSE: Centralized type definitions για όλα τα communication systems
// 🔗 USED BY: Communication components, configs, hooks, utils
//
// ============================================================================

import type { LucideIcon } from 'lucide-react';

// ============================================================================
// CORE COMMUNICATION TYPES
// ============================================================================

/**
 * 🏷️ Communication Type Enum
 *
 * Supported communication types στο enterprise system
 */
export type CommunicationType =
  | 'phone'
  | 'email'
  | 'website'
  | 'social'
  | 'identity'
  | 'professional'
  | 'address';

/**
 * 📝 Communication Item Interface
 *
 * Universal data structure που υποστηρίζει όλους τους τύπους επικοινωνίας
 * με flexible schema για maximum extensibility
 */
export interface CommunicationItem {
  // Common fields για όλους τους τύπους
  type: string;
  label?: string;
  isPrimary?: boolean;

  // Specific fields ανάλογα με τον τύπο
  number?: string; // phones, identity
  countryCode?: string; // phones
  email?: string; // emails
  url?: string; // websites, social
  username?: string; // social
  platform?: string; // social
  value?: string; // professional, general purpose
  address?: string; // addresses
}

/**
 * 🎛️ Type Option Interface
 *
 * Configuration για dropdown options (π.χ. mobile, home, work)
 */
export interface TypeOption {
  value: string;
  label: string;
}

/**
 * ⚙️ Communication Configuration Interface
 *
 * Complete configuration object που περιγράφει πώς να render-ει
 * κάθε communication type με consistency across the system
 */
export interface CommunicationConfig {
  type: CommunicationType;
  title: string;
  icon: LucideIcon;
  fields: {
    primary: string; // main field name (number, email, url, username)
    secondary?: string; // optional secondary field
  };
  types: TypeOption[];
  platformTypes?: TypeOption[]; // Optional: Ξεχωριστές πλατφόρμες για social media
  defaultType: string;
  placeholder: string;
  labelPlaceholder: string; // Placeholder για το label field
  supportsPrimary: boolean; // phones & emails support isPrimary
  emptyStateText: string;
  addButtonText: string; // Text για το add button
}

/**
 * 🎨 Component Props Interface
 *
 * Props για το main UniversalCommunicationManager component
 */
export interface UniversalCommunicationManagerProps {
  config: CommunicationConfig;
  items: CommunicationItem[];
  disabled?: boolean;
  onChange: (items: CommunicationItem[]) => void;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * 📋 Communication Config Record
 *
 * Type helper για το COMMUNICATION_CONFIGS object
 */
export type CommunicationConfigRecord = Record<CommunicationType, CommunicationConfig>;

/**
 * 🔧 Communication Item Partial
 *
 * Partial type για creating new communication items
 */
export type PartialCommunicationItem = Partial<CommunicationItem> & {
  type: string; // type is required
};

// ============================================================================
// LEGACY TYPE ALIASES (για backward compatibility)
// ============================================================================

/**
 * @deprecated Use CommunicationItem instead
 */
export type LegacyCommunicationItem = CommunicationItem;

/**
 * @deprecated Use CommunicationConfig instead
 */
export type LegacyCommunicationConfig = CommunicationConfig;