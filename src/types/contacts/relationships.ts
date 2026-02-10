// ============================================================================
// ⚠️ DEPRECATED - ENTERPRISE RELATIONSHIP TYPES REDIRECT
// ============================================================================
//
// 🚨 This monolithic file has been REPLACED with modular Enterprise architecture
//
// OLD STRUCTURE (❌ Deprecated):
// - 698 lines of mixed types in single file
// - Poor maintainability and reusability
// - Monolithic "God Object" anti-pattern
//
// NEW STRUCTURE (✅ Enterprise):
// - Modular architecture with focused modules
// - Clean separation of concerns
// - Better tree-shaking and performance
// - Enhanced developer experience
//
// ============================================================================

// ============================================================================
// 🔄 MIGRATION GUIDE
// ============================================================================

/*

BEFORE (Old imports):
import type { ContactRelationship, RelationshipType } from './relationships';

AFTER (New imports):
import type { ContactRelationship, RelationshipType } from './relationships';

No import changes needed! Backward compatibility maintained.

ADVANCED IMPORTS (for better tree-shaking):
import type { RelationshipType } from './relationships/core';
import type { ContactRelationship } from './relationships/interfaces';
import type { OrganizationTree } from './relationships/structures';
import { isEmploymentRelationship } from './relationships/utils';

*/

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================================================

// All exports from the new modular structure
export * from './relationships';

// ============================================================================
// DEPRECATION WARNING
// ============================================================================

// NOTE: Deprecation warning removed as part of enterprise logger migration.
// This file is kept for backward compatibility - see relationships/ directory for modular imports.

// Note: This file provides full backward compatibility while encouraging migration to the new modular structure

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================================================

// Re-export everything from the new modular structure
export * from './relationships/index';