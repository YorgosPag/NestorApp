// ============================================================================
// CONTACT RELATIONSHIP SERVICE - MODULAR ARCHITECTURE ENTRY POINT
// ============================================================================
//
// 🎯 Modern modular entry point για contact relationship management
// Re-exports the new modular ContactRelationshipService για backward compatibility
//
// Architecture Migration: Monolithic → Modular Services
// Maintains backward compatibility με existing imports
//
// ============================================================================

// Import the new modular service
export { ContactRelationshipService } from './contact-relationships/ContactRelationshipService';

// Export as default για backward compatibility
export { ContactRelationshipService as default } from './contact-relationships/ContactRelationshipService';

// Re-export specialized services για direct access
export { RelationshipCRUDService } from './contact-relationships/core/RelationshipCRUDService';
export { RelationshipValidationService } from './contact-relationships/core/RelationshipValidationService';
export { FirestoreRelationshipAdapter } from './contact-relationships/adapters/FirestoreRelationshipAdapter';

// Re-export validation errors
export {
  RelationshipValidationError,
  DuplicateRelationshipError,
  InvalidRelationshipError
} from './contact-relationships/core/RelationshipValidationService';

// ============================================================================
// MIGRATION DOCUMENTATION
// ============================================================================

/*
🏗️ MODULAR ARCHITECTURE MIGRATION

Original monolithic service (1,186 lines) διασπάστηκε σε:

📁 src/services/contact-relationships/
├── ContactRelationshipService.ts (Main Orchestrator - 200 lines)
├── core/
│   ├── RelationshipCRUDService.ts (CRUD Operations - 300 lines)
│   └── RelationshipValidationService.ts (Validation Logic - 250 lines)
├── adapters/
│   └── FirestoreRelationshipAdapter.ts (Database Layer - 280 lines)
├── search/ (Future implementation)
├── hierarchy/ (Future implementation)
└── bulk/ (Future implementation)

🔄 BACKWARD COMPATIBILITY:
All existing imports continue to work:
- import { ContactRelationshipService } from '@/services/contact-relationships.service'
- ContactRelationshipService.createRelationship(...)
- ContactRelationshipService.getContactRelationships(...)

✅ BENEFITS:
- Single Responsibility Principle
- Better testability
- Improved maintainability
- Team collaboration friendly
- Enterprise scalability

📋 NEXT STEPS:
1. Implement RelationshipSearchService
2. Implement OrganizationHierarchyService
3. Implement BulkRelationshipService
4. Add comprehensive unit tests
5. Performance optimization
*/