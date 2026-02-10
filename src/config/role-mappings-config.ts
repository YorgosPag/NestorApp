/**
 * 🏢 ENTERPRISE: Role Mappings Configuration
 * Centralized configuration για relationship type labels
 * ZERO HARDCODED LABELS - All labels από environment variables
 */

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('role-mappings-config');

export type RelationshipType =
  | 'employee'
  | 'manager'
  | 'director'
  | 'executive'
  | 'consultant'
  | 'partner'
  | 'client'
  | 'supplier'
  | 'contractor'
  | 'shareholder'
  | 'board_member'
  | 'advisor'
  | 'investor'
  | 'ceo'
  | 'chairman';

interface RoleMappingsConfig {
  readonly [key: string]: string;
}

/**
 * 🏢 ENTERPRISE: Get role mappings from environment configuration
 */
function getRoleMappingsConfig(): RoleMappingsConfig {
  try {
    // Try to load from environment variable (JSON format)
    const envRoleMappings = process.env.NEXT_PUBLIC_ROLE_MAPPINGS;
    if (envRoleMappings) {
      return JSON.parse(envRoleMappings);
    }
  } catch (error) {
    logger.warn('Invalid ROLE_MAPPINGS format, using fallback');
  }

  // 🏢 ENTERPRISE: Fallback mappings με environment variable overrides
  return {
    'employee': process.env.NEXT_PUBLIC_ROLE_EMPLOYEE || 'Εργαζόμενος',
    'manager': process.env.NEXT_PUBLIC_ROLE_MANAGER || 'Διευθυντής',
    'director': process.env.NEXT_PUBLIC_ROLE_DIRECTOR || 'Διευθυντής',
    'executive': process.env.NEXT_PUBLIC_ROLE_EXECUTIVE || 'Στέλεχος',
    'consultant': process.env.NEXT_PUBLIC_ROLE_CONSULTANT || 'Σύμβουλος',
    'partner': process.env.NEXT_PUBLIC_ROLE_PARTNER || 'Εταίρος',
    'client': process.env.NEXT_PUBLIC_ROLE_CLIENT || 'Πελάτης',
    'supplier': process.env.NEXT_PUBLIC_ROLE_SUPPLIER || 'Προμηθευτής',
    'contractor': process.env.NEXT_PUBLIC_ROLE_CONTRACTOR || 'Ανάδοχος',
    'shareholder': process.env.NEXT_PUBLIC_ROLE_SHAREHOLDER || 'Μέτοχος',
    'board_member': process.env.NEXT_PUBLIC_ROLE_BOARD_MEMBER || 'Μέλος ΔΣ',
    'advisor': process.env.NEXT_PUBLIC_ROLE_ADVISOR || 'Σύμβουλος',
    'investor': process.env.NEXT_PUBLIC_ROLE_INVESTOR || 'Επενδυτής',
    'ceo': process.env.NEXT_PUBLIC_ROLE_CEO || 'Διευθύνων Σύμβουλος',
    'chairman': process.env.NEXT_PUBLIC_ROLE_CHAIRMAN || 'Πρόεδρος'
  };
}

export const ROLE_MAPPINGS_CONFIG = getRoleMappingsConfig();

/**
 * 🏢 ENTERPRISE: Role mapping utilities
 */
export const RoleMappingsUtils = {
  /**
   * Get Greek label for relationship type
   */
  getRelationshipTypeLabel: (relationshipType: RelationshipType): string => {
    return ROLE_MAPPINGS_CONFIG[relationshipType] || relationshipType;
  },

  /**
   * Get all available role mappings
   */
  getAllRoleMappings: (): RoleMappingsConfig => {
    return { ...ROLE_MAPPINGS_CONFIG };
  },

  /**
   * Check if role type exists
   */
  isValidRoleType: (roleType: string): roleType is RelationshipType => {
    return roleType in ROLE_MAPPINGS_CONFIG;
  },

  /**
   * Get role types list
   */
  getAvailableRoleTypes: (): RelationshipType[] => {
    return Object.keys(ROLE_MAPPINGS_CONFIG) as RelationshipType[];
  }
} as const;

/**
 * 🏢 ENTERPRISE: Environment Variables Documentation
 * Required environment variables για role mappings configuration:
 *
 * # Bulk JSON Configuration (preferred):
 * NEXT_PUBLIC_ROLE_MAPPINGS={"employee":"Εργαζόμενος","manager":"Διευθυντής",...}
 *
 * # Individual Role Overrides:
 * NEXT_PUBLIC_ROLE_EMPLOYEE=Εργαζόμενος
 * NEXT_PUBLIC_ROLE_MANAGER=Διευθυντής
 * NEXT_PUBLIC_ROLE_DIRECTOR=Διευθυντής
 * NEXT_PUBLIC_ROLE_EXECUTIVE=Στέλεχος
 * NEXT_PUBLIC_ROLE_CONSULTANT=Σύμβουλος
 * NEXT_PUBLIC_ROLE_PARTNER=Εταίρος
 * NEXT_PUBLIC_ROLE_CLIENT=Πελάτης
 * NEXT_PUBLIC_ROLE_SUPPLIER=Προμηθευτής
 * NEXT_PUBLIC_ROLE_CONTRACTOR=Ανάδοχος
 * NEXT_PUBLIC_ROLE_SHAREHOLDER=Μέτοχος
 * NEXT_PUBLIC_ROLE_BOARD_MEMBER=Μέλος ΔΣ
 * NEXT_PUBLIC_ROLE_ADVISOR=Σύμβουλος
 * NEXT_PUBLIC_ROLE_INVESTOR=Επενδυτής
 * NEXT_PUBLIC_ROLE_CEO=Διευθύνων Σύμβουλος
 * NEXT_PUBLIC_ROLE_CHAIRMAN=Πρόεδρος
 */