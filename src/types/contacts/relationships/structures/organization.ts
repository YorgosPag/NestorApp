// ============================================================================
// ORGANIZATIONAL STRUCTURES - ENTERPRISE MODULE
// ============================================================================
//
// 🌳 Complex organizational hierarchy data structures
// Enterprise-grade org chart and hierarchy representations
// Part of modular Enterprise relationship types architecture
//
// ============================================================================

// Import related types
import type { Contact, ContactType } from '../../contracts';
import type { ContactRelationship } from '../interfaces/relationship';

/**
 * 📊 Organizational Hierarchy Node
 *
 * Represents a single node in an organizational hierarchy tree
 * Used for building org charts and reporting structures
 */
export interface OrganizationHierarchyNode {
  /** 👤 Contact information */
  contact: Contact;

  /** 🔗 Relationship to organization */
  relationship: ContactRelationship;

  /** 👥 Direct subordinates */
  subordinates: OrganizationHierarchyNode[];

  /** 👨‍💼 Direct manager */
  manager?: OrganizationHierarchyNode;

  /** 📊 Hierarchy level (0 = top) */
  level: number;

  /** 🏢 Department/division info */
  departmentInfo?: {
    name: string;
    size: number;
    budget?: number;
  };
}

/**
 * 🌳 Organization Tree Structure
 *
 * Complete organizational hierarchy representation
 * Enterprise-grade org chart data structure
 */
export interface OrganizationTree {
  /** 🏢 Organization (root contact) */
  organization: Contact;

  /** 👑 Top-level executives/leadership */
  topLevel: OrganizationHierarchyNode[];

  /** 📊 Organization statistics */
  statistics: {
    totalEmployees: number;
    totalDepartments: number;
    averageTeamSize: number;
    hierarchyDepth: number;
    departmentCount?: number; // Backward compatibility
  };

  /** 🏗️ Department breakdown */
  departments: {
    [departmentName: string]: {
      head: OrganizationHierarchyNode;
      employees: OrganizationHierarchyNode[];
      subDepartments?: string[];
    };
  };

  /** 📅 Last updated */
  lastUpdated: string;

  // Additional fields for backward compatibility
  /** 👥 All children/employees (flat list) */
  children?: Array<{
    id: string;
    position?: string;
    relationshipType?: string;
  }>;

  /** 📅 Created timestamp */
  createdAt?: string;

  /** 📅 Updated timestamp */
  updatedAt?: string;
}