/**
 * 🚀 ENTERPRISE ID MIGRATION STRATEGY
 *
 * Zero-downtime migration από legacy IDs σε enterprise UUID system
 *
 * MIGRATION PHASES:
 * Phase 1: New entities → Enterprise IDs (IMMEDIATE)
 * Phase 2: Dual-ID support για existing entities (GRADUAL)
 * Phase 3: Legacy ID deprecation (PLANNED)
 * Phase 4: Legacy cleanup (FINAL)
 *
 * BUSINESS CONTINUITY:
 * - Zero application downtime
 * - Backward compatibility maintained
 * - Gradual user adoption
 * - Rollback capability
 *
 * @author Enterprise Migration Team
 * @date 2025-12-17
 */

import { enterpriseIdService, isLegacyId, validateEnterpriseId } from './enterprise-id.service';

/**
 * Migration phase definitions
 */
export enum MigrationPhase {
  LEGACY_ONLY = 'legacy_only',           // Pre-migration: Only legacy IDs
  DUAL_SUPPORT = 'dual_support',         // Migration: Both legacy & enterprise IDs
  ENTERPRISE_PREFERRED = 'enterprise_preferred', // Late migration: Enterprise IDs preferred
  ENTERPRISE_ONLY = 'enterprise_only'    // Post-migration: Only enterprise IDs
}

/**
 * Migration configuration
 */
interface MigrationConfig {
  currentPhase: MigrationPhase;
  enableLegacySupport: boolean;
  enableEnterpriseIds: boolean;
  migrationDeadline?: Date;
  rollbackEnabled: boolean;
}

/**
 * ID mapping entry για dual-support phase
 */
interface IdMappingEntry {
  legacyId: string;
  enterpriseId: string;
  entityType: string;
  createdAt: Date;
  migratedAt?: Date;
  verified: boolean;
}

/**
 * Migration statistics
 */
interface MigrationStats {
  totalEntities: number;
  migratedEntities: number;
  pendingMigration: number;
  migrationProgress: number;
  lastMigrationDate?: Date;
}

/**
 * 🚀 ENTERPRISE ID MIGRATION SERVICE
 *
 * Handles safe transition από legacy IDs σε enterprise UUID system
 */
export class EnterpriseIdMigrationService {
  private config: MigrationConfig;
  private readonly idMappings = new Map<string, IdMappingEntry>();

  constructor(config: Partial<MigrationConfig> = {}) {
    // Default configuration για safe migration
    this.config = {
      currentPhase: MigrationPhase.DUAL_SUPPORT,
      enableLegacySupport: true,
      enableEnterpriseIds: true,
      rollbackEnabled: true,
      ...config
    };
  }

  // ==========================================================================
  // MIGRATION PHASE MANAGEMENT
  // ==========================================================================

  /**
   * Set migration phase με validation
   */
  setMigrationPhase(phase: MigrationPhase): void {
    // Allow idempotent operations (setting same phase)
    if (this.config.currentPhase === phase) {
      console.log(`✅ Migration phase already set to: ${phase}`);
      return;
    }

    // Validate phase transition for actual changes
    if (!this.isValidPhaseTransition(this.config.currentPhase, phase)) {
      throw new Error(`Invalid phase transition from ${this.config.currentPhase} to ${phase}`);
    }

    const previousPhase = this.config.currentPhase;
    this.config.currentPhase = phase;

    // Update configuration based on phase
    this.updateConfigForPhase(phase);

    console.log(`🚀 Migration phase changed: ${previousPhase} → ${phase}`);
  }

  /**
   * Check if phase transition is valid
   */
  private isValidPhaseTransition(from: MigrationPhase, to: MigrationPhase): boolean {
    const validTransitions: Record<MigrationPhase, MigrationPhase[]> = {
      [MigrationPhase.LEGACY_ONLY]: [MigrationPhase.DUAL_SUPPORT],
      [MigrationPhase.DUAL_SUPPORT]: [MigrationPhase.ENTERPRISE_PREFERRED, MigrationPhase.LEGACY_ONLY],
      [MigrationPhase.ENTERPRISE_PREFERRED]: [MigrationPhase.ENTERPRISE_ONLY, MigrationPhase.DUAL_SUPPORT],
      [MigrationPhase.ENTERPRISE_ONLY]: [MigrationPhase.ENTERPRISE_PREFERRED] // Emergency rollback only
    };

    return validTransitions[from]?.includes(to) || false;
  }

  /**
   * Update configuration based on migration phase
   */
  private updateConfigForPhase(phase: MigrationPhase): void {
    switch (phase) {
      case MigrationPhase.LEGACY_ONLY:
        this.config.enableLegacySupport = true;
        this.config.enableEnterpriseIds = false;
        break;

      case MigrationPhase.DUAL_SUPPORT:
        this.config.enableLegacySupport = true;
        this.config.enableEnterpriseIds = true;
        break;

      case MigrationPhase.ENTERPRISE_PREFERRED:
        this.config.enableLegacySupport = true; // For backward compatibility
        this.config.enableEnterpriseIds = true;
        break;

      case MigrationPhase.ENTERPRISE_ONLY:
        this.config.enableLegacySupport = false;
        this.config.enableEnterpriseIds = true;
        this.config.rollbackEnabled = false;
        break;
    }
  }

  // ==========================================================================
  // ID RESOLUTION & MAPPING
  // ==========================================================================

  /**
   * Resolve ID to enterprise format
   * Handles both legacy και enterprise IDs transparently
   */
  resolveId(id: string, entityType: string): string {
    // Already enterprise ID
    if (validateEnterpriseId(id)) {
      return id;
    }

    // Legacy ID - check if mapping exists
    const mapping = this.idMappings.get(id);
    if (mapping) {
      return mapping.enterpriseId;
    }

    // Phase-dependent behavior
    switch (this.config.currentPhase) {
      case MigrationPhase.LEGACY_ONLY:
        return id; // Keep legacy ID

      case MigrationPhase.DUAL_SUPPORT:
      case MigrationPhase.ENTERPRISE_PREFERRED:
        // Create mapping για legacy ID
        return this.createIdMapping(id, entityType);

      case MigrationPhase.ENTERPRISE_ONLY:
        throw new Error(`Legacy ID ${id} not supported in enterprise-only phase`);

      default:
        throw new Error(`Unknown migration phase: ${this.config.currentPhase}`);
    }
  }

  /**
   * Create ID mapping for legacy → enterprise transition
   */
  private createIdMapping(legacyId: string, entityType: string): string {
    // Generate enterprise ID based on entity type
    const enterpriseId = this.generateEnterpriseIdByType(entityType);

    const mapping: IdMappingEntry = {
      legacyId,
      enterpriseId,
      entityType,
      createdAt: new Date(),
      verified: false
    };

    this.idMappings.set(legacyId, mapping);

    console.log(`🔄 Created ID mapping: ${legacyId} → ${enterpriseId}`);

    return enterpriseId;
  }

  /**
   * Generate enterprise ID based on entity type
   */
  private generateEnterpriseIdByType(entityType: string): string {
    switch (entityType.toLowerCase()) {
      case 'company':
        return enterpriseIdService.generateCompanyId();
      case 'project':
        return enterpriseIdService.generateProjectId();
      case 'building':
        return enterpriseIdService.generateBuildingId();
      case 'unit':
        return enterpriseIdService.generateUnitId();
      case 'contact':
        return enterpriseIdService.generateContactId();
      case 'floor':
        return enterpriseIdService.generateFloorId();
      case 'document':
        return enterpriseIdService.generateDocumentId();
      case 'user':
        return enterpriseIdService.generateUserId();
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  // ==========================================================================
  // MIGRATION UTILITIES
  // ==========================================================================

  /**
   * Check if ID should use enterprise format
   */
  shouldUseEnterpriseId(): boolean {
    return this.config.enableEnterpriseIds &&
           this.config.currentPhase !== MigrationPhase.LEGACY_ONLY;
  }

  /**
   * Check if legacy ID support is enabled
   */
  supportsLegacyIds(): boolean {
    return this.config.enableLegacySupport;
  }

  /**
   * Get migration statistics
   */
  getMigrationStats(): MigrationStats {
    const totalMappings = this.idMappings.size;
    const verifiedMappings = Array.from(this.idMappings.values())
      .filter(mapping => mapping.verified).length;

    return {
      totalEntities: totalMappings,
      migratedEntities: verifiedMappings,
      pendingMigration: totalMappings - verifiedMappings,
      migrationProgress: totalMappings > 0 ? (verifiedMappings / totalMappings) * 100 : 0,
      lastMigrationDate: this.getLastMigrationDate()
    };
  }

  /**
   * Get last migration date
   */
  private getLastMigrationDate(): Date | undefined {
    const migrations = Array.from(this.idMappings.values())
      .filter(mapping => mapping.migratedAt)
      .sort((a, b) => (b.migratedAt?.getTime() || 0) - (a.migratedAt?.getTime() || 0));

    return migrations[0]?.migratedAt;
  }

  /**
   * Export ID mappings για backup
   */
  exportMappings(): IdMappingEntry[] {
    return Array.from(this.idMappings.values());
  }

  /**
   * Import ID mappings from backup
   */
  importMappings(mappings: IdMappingEntry[]): void {
    mappings.forEach(mapping => {
      this.idMappings.set(mapping.legacyId, mapping);
    });

    console.log(`🔄 Imported ${mappings.length} ID mappings`);
  }

  /**
   * Get current configuration
   */
  getConfig(): MigrationConfig {
    return { ...this.config };
  }
}

// =============================================================================
// MIGRATION HELPERS για COMMON OPERATIONS
// =============================================================================

/**
 * Helper function για legacy ID detection
 */
export function isLegacyIdFormat(id: string): boolean {
  return isLegacyId(id);
}

/**
 * Helper function για safe ID resolution
 */
export function resolveSafeId(id: string, entityType: string, migrationService: EnterpriseIdMigrationService): string {
  try {
    return migrationService.resolveId(id, entityType);
  } catch (error) {
    console.warn(`⚠️ ID resolution failed for ${id}, using original ID`);
    return id;
  }
}

/**
 * Helper function για migration readiness check
 */
export function isMigrationReady(migrationService: EnterpriseIdMigrationService): boolean {
  const stats = migrationService.getMigrationStats();
  return stats.migrationProgress >= 95; // 95% threshold για enterprise standards
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

/**
 * Global migration service instance με safe defaults
 */
export const enterpriseIdMigrationService = new EnterpriseIdMigrationService({
  currentPhase: MigrationPhase.DUAL_SUPPORT,
  enableLegacySupport: true,
  enableEnterpriseIds: true,
  rollbackEnabled: true
});

/**
 * Export types για TypeScript integration
 */
export type { MigrationConfig, IdMappingEntry, MigrationStats };

/**
 * Default export
 */
export default enterpriseIdMigrationService;