// ============================================================================
// ENTERPRISE RELATIONSHIP TYPES CONFIGURATION
// ============================================================================
//
// 🏢 Centralized configuration for relationship types with UI and business rules
// Extracted from ContactRelationshipManager for better maintainability
//
// ============================================================================

import type { ContactType } from '@/types/contacts';
import {
  User,
  Crown,
  Briefcase,
  Users,
  UserCheck
} from 'lucide-react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { hardcodedColorValues } from '@/design-system/tokens/colors';

/**
 * 🏗️ Relationship Type Configuration Interface
 * Defines the structure for relationship type configurations
 */
export interface RelationshipTypeConfig {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  allowedFor: ContactType[];
}

/**
 * 🎨 Enterprise Color Mapping Function
 * Centralized color mapping for relationship types
 */
const getRelationshipColors = (colors?: ReturnType<typeof useSemanticColors>) => {
  if (!colors) {
    // Enterprise fallback for non-React contexts
    return {
      employee: 'bg-blue-100 text-blue-800',
      manager: 'bg-purple-100 text-purple-800',
      shareholder: 'bg-green-100 text-green-800',
      board_member: 'bg-orange-100 text-orange-800',
      civil_servant: 'bg-indigo-100 text-indigo-800',
      department_head: 'bg-red-100 text-red-800',
      consultant: 'bg-teal-100 text-teal-800',
      colleague: 'bg-yellow-100 text-yellow-800',
      friend: 'bg-pink-100 text-pink-800',
      family: 'bg-violet-100 text-violet-800',
      business_contact: `${hardcodedColorValues.background.gray[100]} text-slate-800`,
      default: `${hardcodedColorValues.background.gray[100]} text-slate-800`
    };
  }

  // Enterprise semantic color mapping
  return {
    employee: `${colors.bg.infoSubtle} ${colors.text.info}`,
    manager: `${colors.bg.accentSubtle} ${colors.text.accent}`,
    shareholder: `${colors.bg.successSubtle} ${colors.text.success}`,
    board_member: `${colors.bg.warningSubtle} ${colors.text.warning}`,
    civil_servant: `${colors.bg.accentSubtle} ${colors.text.accent}`,
    department_head: `${colors.bg.errorSubtle} ${colors.text.error}`,
    consultant: `${colors.bg.infoSubtle} ${colors.text.info}`,
    colleague: `${colors.bg.warningSubtle} ${colors.text.warning}`,
    friend: `${colors.bg.accentSubtle} ${colors.text.accent}`,
    family: `${colors.bg.accentSubtle} ${colors.text.accent}`,
    business_contact: `${colors.bg.muted} ${colors.text.muted}`,
    default: `${colors.bg.muted} ${colors.text.muted}`
  };
};

/**
 * 🎯 Relationship Types Configuration
 * Complete configuration for all supported relationship types
 */
export const getRelationshipTypesConfig = (colors?: ReturnType<typeof useSemanticColors>) => {
  const colorMap = getRelationshipColors(colors);

  // 🏢 ENTERPRISE: i18n keys for multilingual support
  return {
  employee: {
    icon: User,
    label: 'relationships.types.employee',
    color: colorMap.employee,
    allowedFor: ['company', 'service'] as ContactType[]
  },
  manager: {
    icon: Crown,
    label: 'relationships.types.manager',
    color: colorMap.manager,
    allowedFor: ['company', 'service'] as ContactType[]
  },
  shareholder: {
    icon: Briefcase,
    label: 'relationships.types.shareholder',
    color: colorMap.shareholder,
    allowedFor: ['company'] as ContactType[]
  },
  board_member: {
    icon: Users,
    label: 'relationships.types.boardMember',
    color: colorMap.board_member,
    allowedFor: ['company'] as ContactType[]
  },
  civil_servant: {
    icon: UserCheck,
    label: 'relationships.types.civilServant',
    color: colorMap.civil_servant,
    allowedFor: ['service'] as ContactType[]
  },
  department_head: {
    icon: Crown,
    label: 'relationships.types.departmentHead',
    color: colorMap.department_head,
    allowedFor: ['service'] as ContactType[]
  },
  consultant: {
    icon: User,
    label: 'relationships.types.consultant',
    color: colorMap.consultant,
    allowedFor: ['company', 'service'] as ContactType[]
  },
  colleague: {
    icon: Users,
    label: 'relationships.types.colleague',
    color: colorMap.colleague,
    allowedFor: ['individual'] as ContactType[]
  },
  friend: {
    icon: User,
    label: 'relationships.types.friend',
    color: colorMap.friend,
    allowedFor: ['individual'] as ContactType[]
  },
  family: {
    icon: Users,
    label: 'relationships.types.family',
    color: colorMap.family,
    allowedFor: ['individual'] as ContactType[]
  },
  business_contact: {
    icon: Briefcase,
    label: 'relationships.types.businessContact',
    color: colorMap.business_contact,
    allowedFor: ['individual'] as ContactType[]
  }
  } as const;
};

// Legacy export for backward compatibility
export const RELATIONSHIP_TYPES_CONFIG = getRelationshipTypesConfig();

/**
 * 🔍 Helper function to get relationship type configuration
 *
 * @param type - The relationship type
 * @param colors - Optional semantic colors for dynamic theming
 * @returns Configuration object or undefined
 */
export const getRelationshipTypeConfig = (type: string, colors?: ReturnType<typeof useSemanticColors>): RelationshipTypeConfig | undefined => {
  const config = getRelationshipTypesConfig(colors);
  return config[type as keyof typeof config];
};

/**
 * 📋 Get available relationship types for contact type
 *
 * @param contactType - The contact type to filter for
 * @param colors - Optional semantic colors for dynamic theming
 * @returns Array of allowed relationship type keys
 */
export const getAvailableRelationshipTypes = (contactType: ContactType, colors?: ReturnType<typeof useSemanticColors>): string[] => {
  const config = getRelationshipTypesConfig(colors);
  return Object.entries(config)
    .filter(([_, configItem]) => configItem.allowedFor.includes(contactType))
    .map(([key, _]) => key);
};

/**
 * 🎨 Get relationship type display properties
 *
 * @param type - The relationship type
 * @param colors - Optional semantic colors for dynamic theming
 * @returns Display properties (icon, label, color)
 */
export const getRelationshipDisplayProps = (type: string, colors?: ReturnType<typeof useSemanticColors>) => {
  const config = getRelationshipTypeConfig(type, colors);
  if (!config) {
    const colorMap = getRelationshipColors(colors);
    return {
      icon: User,
      label: 'relationships.types.other',  // 🏢 ENTERPRISE: i18n key
      color: colorMap.default
    };
  }

  return config;
};

/**
 * ✅ Validate if relationship type is allowed for contact type
 *
 * @param relationshipType - The relationship type to validate
 * @param contactType - The contact type to validate against
 * @param colors - Optional semantic colors for dynamic theming
 * @returns True if allowed, false otherwise
 */
export const isRelationshipTypeAllowed = (
  relationshipType: string,
  contactType: ContactType,
  colors?: ReturnType<typeof useSemanticColors>
): boolean => {
  const config = getRelationshipTypeConfig(relationshipType, colors);
  return config ? config.allowedFor.includes(contactType) : false;
};
