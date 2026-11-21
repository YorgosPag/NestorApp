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
import type { Contact } from '../../contracts';
import type { ContactRelationship } from '../interfaces/relationship';

/**
 * 🏢 Grouping key for members WITHOUT a department (ADR-372 §Β3).
 *
 * The domain never produces a UI label (it used to emit the English literal
 * `'Unknown'`, which reached the screen untranslated). It emits this stable
 * sentinel; the UI translates it via `resolveDepartmentLabel()`.
 */
export const UNASSIGNED_DEPARTMENT_KEY = '__unassigned__';

/** Normalizes a stored department into its grouping key (blank → sentinel). */
export function departmentGroupKey(department: string | null | undefined): string {
  const trimmed = department?.trim();
  return trimmed ? trimmed : UNASSIGNED_DEPARTMENT_KEY;
}

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
    /** Stored department value (preset key or free text); `null` = no department. */
    name: string | null;
    size: number;
    budget?: number;
  };

  /** ?? Direct reports count */
  directReportCount?: number;

  /** ?? Tenure duration in months */
  tenureMonths?: number;
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