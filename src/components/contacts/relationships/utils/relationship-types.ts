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

/**
 * 🏗️ Relationship Type Configuration Interface
 * Defines the structure for relationship type configurations
 */
export interface RelationshipTypeConfig {
  icon: React.ComponentType<any>;
  label: string;
  color: string;
  allowedFor: ContactType[];
}

/**
 * 🎯 Relationship Types Configuration
 * Complete configuration for all supported relationship types
 */
export const RELATIONSHIP_TYPES_CONFIG = {
  employee: {
    icon: User,
    label: 'Εργαζόμενος',
    color: 'bg-blue-100 text-blue-800',
    allowedFor: ['company', 'service'] as ContactType[]
  },
  manager: {
    icon: Crown,
    label: 'Διευθυντής',
    color: 'bg-purple-100 text-purple-800',
    allowedFor: ['company', 'service'] as ContactType[]
  },
  shareholder: {
    icon: Briefcase,
    label: 'Μέτοχος',
    color: 'bg-green-100 text-green-800',
    allowedFor: ['company'] as ContactType[]
  },
  board_member: {
    icon: Users,
    label: 'Μέλος Διοικητικού Συμβουλίου',
    color: 'bg-orange-100 text-orange-800',
    allowedFor: ['company'] as ContactType[]
  },
  civil_servant: {
    icon: UserCheck,
    label: 'Δημόσιος Υπάλληλος',
    color: 'bg-indigo-100 text-indigo-800',
    allowedFor: ['service'] as ContactType[]
  },
  department_head: {
    icon: Crown,
    label: 'Προϊστάμενος Τμήματος',
    color: 'bg-red-100 text-red-800',
    allowedFor: ['service'] as ContactType[]
  },
  consultant: {
    icon: User,
    label: 'Σύμβουλος',
    color: 'bg-teal-100 text-teal-800',
    allowedFor: ['company', 'service'] as ContactType[]
  },
  colleague: {
    icon: Users,
    label: 'Συνάδελφος',
    color: 'bg-yellow-100 text-yellow-800',
    allowedFor: ['individual'] as ContactType[]
  },
  friend: {
    icon: User,
    label: 'Φίλος',
    color: 'bg-pink-100 text-pink-800',
    allowedFor: ['individual'] as ContactType[]
  },
  family: {
    icon: Users,
    label: 'Οικογένεια',
    color: 'bg-violet-100 text-violet-800',
    allowedFor: ['individual'] as ContactType[]
  },
  business_contact: {
    icon: Briefcase,
    label: 'Επαγγελματική Επαφή',
    color: 'bg-slate-100 text-slate-800',
    allowedFor: ['individual'] as ContactType[]
  }
} as const;

/**
 * 🔍 Helper function to get relationship type configuration
 *
 * @param type - The relationship type
 * @returns Configuration object or undefined
 */
export const getRelationshipTypeConfig = (type: string): RelationshipTypeConfig | undefined => {
  return RELATIONSHIP_TYPES_CONFIG[type as keyof typeof RELATIONSHIP_TYPES_CONFIG];
};

/**
 * 📋 Get available relationship types for contact type
 *
 * @param contactType - The contact type to filter for
 * @returns Array of allowed relationship type keys
 */
export const getAvailableRelationshipTypes = (contactType: ContactType): string[] => {
  return Object.entries(RELATIONSHIP_TYPES_CONFIG)
    .filter(([_, config]) => config.allowedFor.includes(contactType))
    .map(([key, _]) => key);
};

/**
 * 🎨 Get relationship type display properties
 *
 * @param type - The relationship type
 * @returns Display properties (icon, label, color)
 */
export const getRelationshipDisplayProps = (type: string) => {
  const config = getRelationshipTypeConfig(type);
  if (!config) {
    return {
      icon: User,
      label: 'Άλλο',
      color: 'bg-gray-100 text-gray-800'
    };
  }

  return config;
};

/**
 * ✅ Validate if relationship type is allowed for contact type
 *
 * @param relationshipType - The relationship type to validate
 * @param contactType - The contact type to validate against
 * @returns True if allowed, false otherwise
 */
export const isRelationshipTypeAllowed = (
  relationshipType: string,
  contactType: ContactType
): boolean => {
  const config = getRelationshipTypeConfig(relationshipType);
  return config ? config.allowedFor.includes(contactType) : false;
};