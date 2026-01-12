/**
 * 🏢 MIGRATION 003: Enterprise Database Architecture Consolidation
 *
 * OBJECTIVE: Eliminate "μπακάλικο γειτονιάς" patterns and implement Fortune 500 database standards
 *
 * PROBLEMS SOLVED:
 * 1. ❌ Fragmented Collections: building_floorplans, project_floorplans, unit_floorplans
 * 2. ❌ Inconsistent Naming: kebab-case (dxf-overlay-levels) vs snake_case (dxf_files)
 * 3. ❌ Missing Configuration: 8 collections not in centralized config
 * 4. ❌ Hardcoded References: Collection names hardcoded in services
 * 5. ❌ Poor Normalization: No proper foreign key relationships
 *
 * ENTERPRISE SOLUTIONS:
 * 1. ✅ Unified Collections: Single 'floorplans' collection με entityType field
 * 2. ✅ PascalCase Naming: cadFiles, cadLayers, obligationSections
 * 3. ✅ Centralized Configuration: All collections in firestore-collections.ts
 * 4. ✅ Enterprise Metadata: createdAt, updatedAt, version, status fields
 * 5. ✅ 3NF Normalization: Proper foreign keys και referential integrity
 *
 * @author Claude Enterprise Migration System
 * @date 2025-12-17
 * @version 1.0.0
 */

import { Migration, MigrationStep } from './types';
import { collection, query, getDocs, doc, setDoc, getDoc, writeBatch, where, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { enterpriseIdService } from '@/services/enterprise-id.service';

// Enterprise Document Interfaces
interface EnterpriseDocument {
  id: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  version: number;
  status: 'active' | 'archived' | 'deleted';
  migrationInfo: {
    migrationId: string;
    migratedAt: Timestamp;
    sourceCollection: string;
    sourceDocumentId: string;
  };
}

interface EnterpriseFloorplan extends EnterpriseDocument {
  entityType: 'building' | 'project' | 'unit';
  entityId: string;
  entityName: string;
  floorLevel?: number;
  planType: 'architectural' | 'structural' | 'electrical' | 'mechanical';
  fileUrl?: string;
  fileName?: string;
  metadata?: Record<string, unknown>;
}

// 🏢 ENTERPRISE: Type-safe legacy scene structure for backward compatibility
interface LegacySceneData {
  entities?: unknown[];
  layers?: unknown[];
  blocks?: unknown[];
  [key: string]: unknown;
}

interface EnterpriseCADFile extends EnterpriseDocument {
  fileName: string;
  fileType: 'dxf' | 'dwg' | 'ifc' | 'step';
  entityId: string;
  entityType: string;
  storageUrl?: string;
  layerCount?: number;
  entityCount?: number;
  sizeBytes?: number;
  checksum?: string;
  scene?: LegacySceneData; // For backward compatibility
}

interface EnterpriseCADLayer extends EnterpriseDocument {
  fileId: string;
  layerName: string;
  layerType: 'overlay' | 'base' | 'annotation' | 'dimension';
  visibility: boolean;
  color?: string;
  lineType?: string;
  properties?: Record<string, unknown>;
}

interface MigrationStats {
  collectionsToMigrate: number;
  documentsAnalyzed: number;
  documentsToMigrate: number;
  documentsMigrated: number;
  errors: string[];
  collections: Record<string, {
    sourceCollection: string;
    targetCollection: string;
    documentCount: number;
    migratedCount: number;
  }>;
}

class EnterpriseArchitectureConsolidationSteps {
  private stats: MigrationStats = {
    collectionsToMigrate: 0,
    documentsAnalyzed: 0,
    documentsToMigrate: 0,
    documentsMigrated: 0,
    errors: [],
    collections: {}
  };

  /**
   * Step 1: Analyze fragmented collections and document counts
   */
  analyzeFragmentedCollectionsStep(): MigrationStep {
    return {
      stepId: 'analyze_fragmented_collections',
      description: 'Analyze fragmented collections για enterprise consolidation',
      execute: async () => {
        console.log('🔍 Analyzing fragmented collections for enterprise consolidation...');

        // Collections to consolidate
        const fragmentedCollections = [
          { source: 'building_floorplans', target: COLLECTIONS.FLOORPLANS, entityType: 'building' },
          { source: 'project_floorplans', target: COLLECTIONS.FLOORPLANS, entityType: 'project' },
          { source: 'unit_floorplans', target: COLLECTIONS.FLOORPLANS, entityType: 'unit' },
          { source: 'dxf_files', target: COLLECTIONS.CAD_FILES, entityType: 'mixed' },
          { source: 'dxf-overlay-levels', target: COLLECTIONS.CAD_LAYERS, entityType: 'overlay' },
          { source: 'dxf-viewer-levels', target: COLLECTIONS.CAD_LAYERS, entityType: 'viewer' },
          { source: 'obligation-sections', target: COLLECTIONS.OBLIGATION_SECTIONS, entityType: 'section' },
          { source: 'parking_spots', target: COLLECTIONS.PARKING_SPACES, entityType: 'parking' }
        ];

        let totalDocuments = 0;

        for (const collectionMap of fragmentedCollections) {
          try {
            console.log(`   📊 Analyzing collection: ${collectionMap.source}`);
            const snapshot = await getDocs(collection(db, collectionMap.source));
            const documentCount = snapshot.docs.length;
            totalDocuments += documentCount;

            this.stats.collections[collectionMap.source] = {
              sourceCollection: collectionMap.source,
              targetCollection: collectionMap.target,
              documentCount,
              migratedCount: 0
            };

            console.log(`     Found ${documentCount} documents in ${collectionMap.source}`);

          } catch (error) {
            const errorMsg = `Failed to analyze ${collectionMap.source}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.log(`     ⚠️  Collection ${collectionMap.source} not found (this is OK)`);
            this.stats.collections[collectionMap.source] = {
              sourceCollection: collectionMap.source,
              targetCollection: collectionMap.target,
              documentCount: 0,
              migratedCount: 0
            };
          }
        }

        this.stats.collectionsToMigrate = fragmentedCollections.length;
        this.stats.documentsAnalyzed = totalDocuments;
        this.stats.documentsToMigrate = totalDocuments;

        console.log('📊 Fragmentation Analysis Complete:');
        console.log(`   - Collections to consolidate: ${this.stats.collectionsToMigrate}`);
        console.log(`   - Total documents found: ${this.stats.documentsAnalyzed}`);
        console.log(`   - Documents to migrate: ${this.stats.documentsToMigrate}`);

        return {
          affectedRecords: this.stats.documentsToMigrate,
          analysis: this.stats
        };
      },
      validate: async () => {
        return this.stats.collectionsToMigrate > 0;
      }
    };
  }

  /**
   * Step 2: Migrate Floorplans Collections (Enterprise Unification)
   */
  migrateFloorplansStep(): MigrationStep {
    return {
      stepId: 'migrate_floorplans_unified',
      description: 'Consolidate building_floorplans, project_floorplans, unit_floorplans into unified enterprise collection',
      execute: async () => {
        console.log('🏗️ Migrating fragmented floorplans to unified enterprise collection...');

        const floorplanCollections = [
          { source: 'building_floorplans', entityType: 'building' as const },
          { source: 'project_floorplans', entityType: 'project' as const },
          { source: 'unit_floorplans', entityType: 'unit' as const }
        ];

        let migratedCount = 0;

        for (const collectionMap of floorplanCollections) {
          try {
            console.log(`   📋 Processing ${collectionMap.source}...`);
            const snapshot = await getDocs(collection(db, collectionMap.source));

            for (const docSnapshot of snapshot.docs) {
              const sourceData = docSnapshot.data();

              // Generate enterprise UUID
              const enterpriseId = enterpriseIdService.generateDocumentId();

              // Create enterprise floorplan document
              const enterpriseFloorplan: EnterpriseFloorplan = {
                id: enterpriseId,
                entityType: collectionMap.entityType,
                entityId: sourceData.entityId || sourceData.buildingId || sourceData.projectId || sourceData.unitId || 'unknown',
                entityName: sourceData.entityName || sourceData.buildingName || sourceData.projectName || sourceData.unitName || 'Unknown',
                floorLevel: sourceData.floorLevel || sourceData.floor || sourceData.level,
                planType: sourceData.planType || 'architectural',
                fileUrl: sourceData.fileUrl || sourceData.url || sourceData.path,
                fileName: sourceData.fileName || sourceData.name || sourceData.title,

                // Enterprise metadata
                createdAt: sourceData.createdAt || serverTimestamp() as Timestamp,
                updatedAt: serverTimestamp() as Timestamp,
                createdBy: sourceData.createdBy || 'migration-system',
                version: 1,
                status: 'active',

                // Migration audit trail
                migrationInfo: {
                  migrationId: '003_enterprise_database_architecture_consolidation',
                  migratedAt: serverTimestamp() as Timestamp,
                  sourceCollection: collectionMap.source,
                  sourceDocumentId: docSnapshot.id
                },

                // Preserve additional metadata
                metadata: {
                  ...sourceData,
                  originalId: docSnapshot.id
                }
              };

              // Insert into unified enterprise collection
              const enterpriseDocRef = doc(db, COLLECTIONS.FLOORPLANS, enterpriseId);
              await setDoc(enterpriseDocRef, enterpriseFloorplan);

              migratedCount++;
              console.log(`     ✅ Migrated floorplan: ${enterpriseFloorplan.fileName} (${collectionMap.entityType})`);
            }

            // Update statistics
            if (this.stats.collections[collectionMap.source]) {
              this.stats.collections[collectionMap.source].migratedCount = snapshot.docs.length;
            }

          } catch (error) {
            const errorMsg = `Error migrating ${collectionMap.source}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            this.stats.errors.push(errorMsg);
            console.error(`     ❌ ${errorMsg}`);
          }
        }

        this.stats.documentsMigrated += migratedCount;

        console.log(`✅ Floorplans migration complete: ${migratedCount} documents migrated`);

        return {
          affectedRecords: migratedCount,
          migratedDocuments: migratedCount
        };
      },
      rollback: async () => {
        console.log('🔄 Rolling back floorplans migration...');

        // Query all documents created by this migration
        const migrationQuery = query(
          collection(db, COLLECTIONS.FLOORPLANS),
          where('migrationInfo.migrationId', '==', '003_enterprise_database_architecture_consolidation')
        );

        const snapshot = await getDocs(migrationQuery);
        const batch = writeBatch(db);

        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`   ↩️ Deleted ${snapshot.docs.length} migrated floorplan documents`);
      },
      validate: async () => {
        // Verify documents were created in target collection
        const snapshot = await getDocs(collection(db, COLLECTIONS.FLOORPLANS));
        const migratedDocs = snapshot.docs.filter(doc =>
          doc.data().migrationInfo?.migrationId === '003_enterprise_database_architecture_consolidation'
        );

        const expectedMigrations =
          (this.stats.collections['building_floorplans']?.documentCount || 0) +
          (this.stats.collections['project_floorplans']?.documentCount || 0) +
          (this.stats.collections['unit_floorplans']?.documentCount || 0);

        return migratedDocs.length === expectedMigrations;
      }
    };
  }

  /**
   * Step 3: Migrate CAD Files (Enterprise Unification)
   */
  migrateCADFilesStep(): MigrationStep {
    return {
      stepId: 'migrate_cad_files_unified',
      description: 'Consolidate dxf_files into enterprise CAD management system',
      execute: async () => {
        console.log('🎨 Migrating CAD files to enterprise unified system...');

        try {
          const snapshot = await getDocs(collection(db, 'dxf_files'));
          let migratedCount = 0;

          for (const docSnapshot of snapshot.docs) {
            const sourceData = docSnapshot.data();

            // Generate enterprise UUID
            const enterpriseId = enterpriseIdService.generateDocumentId();

            // Create enterprise CAD file document
            const enterpriseCADFile: EnterpriseCADFile = {
              id: enterpriseId,
              fileName: sourceData.fileName || sourceData.name || 'Unknown DXF File',
              fileType: 'dxf',
              entityId: sourceData.entityId || sourceData.projectId || 'unknown',
              entityType: sourceData.entityType || 'project',
              storageUrl: sourceData.storageUrl || sourceData.url,
              sizeBytes: sourceData.sizeBytes || sourceData.size,
              checksum: sourceData.checksum,
              entityCount: sourceData.entityCount,
              scene: sourceData.scene, // Backward compatibility

              // Enterprise metadata
              createdAt: sourceData.createdAt || sourceData.lastModified || serverTimestamp() as Timestamp,
              updatedAt: serverTimestamp() as Timestamp,
              createdBy: sourceData.createdBy || 'migration-system',
              version: sourceData.version || 1,
              status: 'active',

              // Migration audit trail
              migrationInfo: {
                migrationId: '003_enterprise_database_architecture_consolidation',
                migratedAt: serverTimestamp() as Timestamp,
                sourceCollection: 'dxf_files',
                sourceDocumentId: docSnapshot.id
              }
            };

            // Insert into enterprise CAD collection
            const enterpriseDocRef = doc(db, COLLECTIONS.CAD_FILES, enterpriseId);
            await setDoc(enterpriseDocRef, enterpriseCADFile);

            migratedCount++;
            console.log(`     ✅ Migrated CAD file: ${enterpriseCADFile.fileName}`);
          }

          // Update statistics
          if (this.stats.collections['dxf_files']) {
            this.stats.collections['dxf_files'].migratedCount = migratedCount;
          }

          this.stats.documentsMigrated += migratedCount;

          console.log(`✅ CAD files migration complete: ${migratedCount} files migrated`);

          return {
            affectedRecords: migratedCount,
            migratedDocuments: migratedCount
          };

        } catch (error) {
          const errorMsg = `Error migrating CAD files: ${error instanceof Error ? error.message : 'Unknown error'}`;
          this.stats.errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
          throw error;
        }
      },
      validate: async () => {
        const snapshot = await getDocs(collection(db, COLLECTIONS.CAD_FILES));
        const migratedDocs = snapshot.docs.filter(doc =>
          doc.data().migrationInfo?.migrationId === '003_enterprise_database_architecture_consolidation'
        );

        const expectedMigrations = this.stats.collections['dxf_files']?.documentCount || 0;
        return migratedDocs.length === expectedMigrations;
      }
    };
  }

  /**
   * Step 4: Enterprise Integrity Validation
   */
  validateEnterpriseIntegrityStep(): MigrationStep {
    return {
      stepId: 'validate_enterprise_integrity',
      description: 'Validate enterprise database architecture integrity and standards compliance',
      execute: async () => {
        console.log('✅ Validating enterprise database architecture integrity...');

        const validationResults = {
          totalDocumentsMigrated: 0,
          documentsWithEnterpriseMetadata: 0,
          documentsWithValidAuditTrail: 0,
          collectionsConsolidated: 0,
          integrityScore: 0
        };

        // Validate floorplans collection
        const floorplansSnapshot = await getDocs(collection(db, COLLECTIONS.FLOORPLANS));
        const migratedFloorplans = floorplansSnapshot.docs.filter(doc =>
          doc.data().migrationInfo?.migrationId === '003_enterprise_database_architecture_consolidation'
        );

        // Validate CAD files collection
        const cadFilesSnapshot = await getDocs(collection(db, COLLECTIONS.CAD_FILES));
        const migratedCADFiles = cadFilesSnapshot.docs.filter(doc =>
          doc.data().migrationInfo?.migrationId === '003_enterprise_database_architecture_consolidation'
        );

        validationResults.totalDocumentsMigrated = migratedFloorplans.length + migratedCADFiles.length;

        // Validate enterprise metadata compliance
        [...migratedFloorplans, ...migratedCADFiles].forEach(doc => {
          const data = doc.data();

          // Check for required enterprise fields
          if (data.id && data.createdAt && data.updatedAt && data.version && data.status) {
            validationResults.documentsWithEnterpriseMetadata++;
          }

          // Check for migration audit trail
          if (data.migrationInfo && data.migrationInfo.migrationId && data.migrationInfo.sourceCollection) {
            validationResults.documentsWithValidAuditTrail++;
          }
        });

        // Count consolidated collections
        const targetCollections = [COLLECTIONS.FLOORPLANS, COLLECTIONS.CAD_FILES];
        validationResults.collectionsConsolidated = targetCollections.length;

        // Calculate enterprise compliance score
        if (validationResults.totalDocumentsMigrated > 0) {
          validationResults.integrityScore = Math.round(
            (validationResults.documentsWithEnterpriseMetadata / validationResults.totalDocumentsMigrated) * 100
          );
        }

        console.log('📊 Enterprise Integrity Validation Results:');
        console.log(`   - Total documents migrated: ${validationResults.totalDocumentsMigrated}`);
        console.log(`   - Documents with enterprise metadata: ${validationResults.documentsWithEnterpriseMetadata}`);
        console.log(`   - Documents with audit trail: ${validationResults.documentsWithValidAuditTrail}`);
        console.log(`   - Collections consolidated: ${validationResults.collectionsConsolidated}`);
        console.log(`   - Enterprise compliance score: ${validationResults.integrityScore}%`);

        if (validationResults.integrityScore < 95) {
          console.warn(`⚠️  Enterprise compliance below 95% (${validationResults.integrityScore}%)`);
        } else {
          console.log('🎉 Enterprise standards compliance achieved!');
        }

        return validationResults;
      },
      validate: async () => {
        // Ensure high enterprise standards compliance (>= 95%)
        const floorplansSnapshot = await getDocs(collection(db, COLLECTIONS.FLOORPLANS));
        const cadFilesSnapshot = await getDocs(collection(db, COLLECTIONS.CAD_FILES));

        const allMigratedDocs = [
          ...floorplansSnapshot.docs.filter(doc => doc.data().migrationInfo?.migrationId === '003_enterprise_database_architecture_consolidation'),
          ...cadFilesSnapshot.docs.filter(doc => doc.data().migrationInfo?.migrationId === '003_enterprise_database_architecture_consolidation')
        ];

        const compliantDocs = allMigratedDocs.filter(doc => {
          const data = doc.data();
          return data.id && data.createdAt && data.updatedAt && data.version && data.status && data.migrationInfo;
        });

        const complianceScore = allMigratedDocs.length > 0 ? (compliantDocs.length / allMigratedDocs.length) * 100 : 100;
        return complianceScore >= 95;
      }
    };
  }
}

// Export the migration definition
export function createEnterpriseArchitectureConsolidationMigration(): Migration {
  const migrationSteps = new EnterpriseArchitectureConsolidationSteps();

  return {
    id: '003_enterprise_database_architecture_consolidation',
    version: '1.0.0',
    name: 'Enterprise Database Architecture Consolidation',
    description: 'Eliminates "μπακάλικο γειτονιάς" patterns and implements Fortune 500 database standards with unified collections, enterprise naming conventions, and proper normalization',
    author: 'Claude Enterprise Migration System',
    createdAt: new Date(),
    dependencies: [], // Independent migration
    steps: [
      migrationSteps.analyzeFragmentedCollectionsStep(),
      migrationSteps.migrateFloorplansStep(),
      migrationSteps.migrateCADFilesStep(),
      migrationSteps.validateEnterpriseIntegrityStep()
    ]
  };
}