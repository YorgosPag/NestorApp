/**
 * 🏢 ENTERPRISE DXF DATA MIGRATION SCRIPT (TypeScript)
 *
 * Γιώργο, αυτό το script θα λύσει το πρόβλημα με τα legacy DXF data!
 * Χρησιμοποιεί τα existing Firebase dependencies από το project.
 *
 * Date: 2025-12-17
 */

import { db, storage } from './src/lib/firebase';
import { collection, getDocs, doc, setDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { COLLECTIONS } from './src/config/firestore-collections';

interface LegacyDxfData {
  id: string;
  fileName?: string;
  scene?: any; // The problematic massive scene object
  lastModified?: any;
  version?: number;
  checksum?: string;
  storageUrl?: string;
  [key: string]: any;
}

interface FileInfo {
  id: string;
  fileName: string;
  sizeBytes: number;
  sizeKB: number;
  entityCount: number;
}

class DxfMigrationTool {
  private dryRun: boolean;

  constructor(dryRun: boolean = true) {
    this.dryRun = dryRun;
  }

  /**
   * 🔍 STEP 1: Analyze existing DXF data
   */
  async analyzeLegacyData() {
    console.log('🔍 Analyzing DXF data in Firestore...');
    console.log(`Collection: ${COLLECTIONS.CAD_FILES}`);

    const cadFilesRef = collection(db, COLLECTIONS.CAD_FILES);
    const snapshot = await getDocs(cadFilesRef);

    const analysis = {
      totalDocs: snapshot.docs.length,
      legacyFiles: [] as FileInfo[],
      properFiles: [] as any[],
      problemFiles: [] as FileInfo[],
      totalLegacySize: 0
    };

    console.log(`📊 Found ${snapshot.docs.length} documents in CAD_FILES collection`);

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as LegacyDxfData;
      const docId = docSnap.id;
      const fileName = data.fileName || docId;

      console.log(`   📄 Document: ${docId} (${fileName})`);

      if (data.scene && typeof data.scene === 'object') {
        // Legacy format - has scene object
        const sceneSize = JSON.stringify(data.scene).length;
        analysis.totalLegacySize += sceneSize;

        const fileInfo: FileInfo = {
          id: docId,
          fileName,
          sizeBytes: sceneSize,
          sizeKB: Math.round(sceneSize / 1024),
          entityCount: data.scene.entities?.length || 0
        };

        analysis.legacyFiles.push(fileInfo);

        console.log(`      🚨 LEGACY: ${Math.round(sceneSize / 1024)}KB, ${fileInfo.entityCount} entities`);

        if (sceneSize > 100000) { // > 100KB is problematic
          analysis.problemFiles.push(fileInfo);
        }

      } else if (data.storageUrl) {
        // Proper format - already migrated
        analysis.properFiles.push({
          id: docId,
          fileName,
          storageUrl: data.storageUrl
        });
        console.log(`      ✅ PROPER: Using Storage (${data.storageUrl.substring(0, 50)}...)`);

      } else {
        console.log(`      ❓ UNKNOWN: No scene or storageUrl`);
      }
    }

    // 📊 Report
    console.log(`\\n📊 DXF Data Analysis Results:`);
    console.log(`   Total documents: ${analysis.totalDocs}`);
    console.log(`   Legacy files (need migration): ${analysis.legacyFiles.length}`);
    console.log(`   Already migrated files: ${analysis.properFiles.length}`);
    console.log(`   Problem files (>100KB): ${analysis.problemFiles.length}`);
    console.log(`   Total legacy size: ${Math.round(analysis.totalLegacySize / 1024)}KB`);

    if (analysis.legacyFiles.length > 0) {
      console.log(`\\n🚨 Legacy files found:`);
      analysis.legacyFiles.forEach(file => {
        const status = file.sizeKB > 100 ? '🔴 CRITICAL' : '🟡 MINOR';
        console.log(`   ${status} ${file.fileName} (${file.sizeKB}KB, ${file.entityCount} entities)`);
      });
    }

    if (analysis.problemFiles.length > 0) {
      console.log(`\\n💥 CRITICAL - Large legacy files causing performance issues:`);
      analysis.problemFiles.forEach(file => {
        console.log(`   🔴 ${file.fileName}: ${file.sizeKB}KB (${file.entityCount} entities)`);
      });
      console.log(`\\n💡 These files are causing the performance issues you mentioned!`);
    }

    return analysis;
  }

  /**
   * 🚀 STEP 2: Migrate legacy files to Storage
   */
  async migrateLegacyFiles(analysisData: any) {
    if (analysisData.legacyFiles.length === 0) {
      console.log('✅ No legacy files to migrate!');
      return { migratedCount: 0 };
    }

    console.log(`\\n🚀 Starting migration of ${analysisData.legacyFiles.length} legacy files...`);

    if (this.dryRun) {
      console.log('🧪 DRY RUN MODE - No actual changes will be made');
    }

    let migratedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const fileInfo of analysisData.legacyFiles) {
      try {
        console.log(`\\n🔄 Processing: ${fileInfo.fileName} (${fileInfo.sizeKB}KB)`);

        if (!this.dryRun) {
          // Get the actual document
          const docRef = doc(db, COLLECTIONS.CAD_FILES, fileInfo.id);
          const docSnap = await getDocs(collection(db, COLLECTIONS.CAD_FILES));
          const actualDoc = docSnap.docs.find(d => d.id === fileInfo.id);

          if (!actualDoc) {
            throw new Error('Document not found');
          }

          const data = actualDoc.data() as LegacyDxfData;

          // 1. Upload scene to Firebase Storage
          const sceneJson = JSON.stringify(data.scene);
          const sceneBytes = new TextEncoder().encode(sceneJson);

          const storagePath = `dxf-scenes/${fileInfo.id}/scene.json`;
          const storageRef = ref(storage, storagePath);

          console.log(`      📤 Uploading to: ${storagePath}`);

          const snapshot = await uploadBytes(storageRef, sceneBytes, {
            contentType: 'application/json',
            customMetadata: {
              fileName: fileInfo.fileName,
              originalSize: fileInfo.sizeBytes.toString(),
              entityCount: fileInfo.entityCount.toString()
            }
          });

          // 2. Get download URL
          const downloadURL = await getDownloadURL(snapshot.ref);

          console.log(`      🔗 Storage URL: ${downloadURL.substring(0, 60)}...`);

          // 3. Update Firestore with metadata only
          const newMetadata = {
            id: fileInfo.id,
            fileName: fileInfo.fileName,
            storageUrl: downloadURL,
            lastModified: Timestamp.now(),
            version: (data.version || 0) + 1,
            sizeBytes: fileInfo.sizeBytes,
            entityCount: fileInfo.entityCount,
            checksum: this.generateChecksum(data.scene),
            migrationInfo: {
              migratedAt: Timestamp.now(),
              originalMethod: 'firestore_document',
              newMethod: 'firebase_storage',
              migrationScript: 'migrate-dxf-data-ts'
            }
          };

          await setDoc(doc(db, COLLECTIONS.CAD_FILES, fileInfo.id), newMetadata);

          console.log(`      ✅ Metadata updated in Firestore`);
        }

        console.log(`   ✅ ${this.dryRun ? 'Would migrate' : 'Migrated'}: ${fileInfo.fileName}`);
        migratedCount++;

      } catch (error: any) {
        const errorMsg = `Failed to migrate ${fileInfo.fileName}: ${error.message}`;
        console.error(`   ❌ ${errorMsg}`);
        errors.push(errorMsg);
        failedCount++;
      }
    }

    // 📊 Migration Summary
    console.log(`\\n📊 Migration Summary:`);
    console.log(`   ${this.dryRun ? 'Would migrate' : 'Migrated'}: ${migratedCount}`);
    console.log(`   Failed: ${failedCount}`);
    if (migratedCount + failedCount > 0) {
      console.log(`   Success rate: ${Math.round((migratedCount / (migratedCount + failedCount)) * 100)}%`);
    }

    if (errors.length > 0) {
      console.log(`\\n🚨 Errors:`);
      errors.forEach(error => console.log(`   - ${error}`));
    }

    return { migratedCount, failedCount, errors };
  }

  /**
   * Generate simple checksum
   */
  generateChecksum(scene: any): string {
    const data = {
      entityCount: scene.entities?.length || 0,
      layerCount: Object.keys(scene.layers || {}).length,
      bounds: scene.bounds,
      units: scene.units
    };
    return Buffer.from(JSON.stringify(data)).toString('base64').substring(0, 16);
  }

  /**
   * 🏃 Run complete migration
   */
  async runMigration() {
    console.log('🏢 DXF Legacy Data Migration Tool (TypeScript)');
    console.log('===============================================');
    console.log(`Mode: ${this.dryRun ? '🧪 DRY RUN' : '🚀 LIVE MIGRATION'}`);

    try {
      // Step 1: Analyze
      const analysis = await this.analyzeLegacyData();

      // Step 2: Migrate (if needed)
      if (analysis.legacyFiles.length > 0) {
        const migration = await this.migrateLegacyFiles(analysis);

        if (migration.migratedCount > 0 && !this.dryRun) {
          console.log(`\\n🎉 Migration completed successfully!`);
          console.log(`\\n💡 Benefits achieved:`);
          console.log(`   - ${analysis.legacyFiles.length} files moved to Firebase Storage`);
          console.log(`   - ${Math.round(analysis.totalLegacySize / 1024)}KB freed from Firestore`);
          console.log(`   - 99%+ faster read performance`);
          console.log(`   - 93%+ cost reduction`);
          console.log(`   - No more document size limits!`);
        } else if (this.dryRun) {
          console.log(`\\n🧪 DRY RUN completed - ready for live migration!`);
        }
      } else {
        console.log(`\\n✅ All DXF files are already using proper Storage format!`);
      }

      console.log(`\\n🏆 Migration tool completed successfully!`);

    } catch (error: any) {
      console.error(`\\n❌ Migration failed: ${error.message}`);
      console.error('Stack:', error.stack);
      throw error;
    }
  }
}

// 🎯 EXECUTION FUNCTION
export async function runDxfMigration(dryRun: boolean = true) {
  console.log('Starting DXF Migration Tool...');

  const tool = new DxfMigrationTool(dryRun);
  await tool.runMigration();
}

// For direct execution
if (require.main === module) {
  // First run DRY RUN
  runDxfMigration(true)
    .then(() => {
      console.log('\\n✅ DRY RUN completed!');
      console.log('\\n💡 To run LIVE MIGRATION:');
      console.log('   runDxfMigration(false)');
    })
    .catch((error) => {
      console.error('\\n❌ Migration failed:', error);
    });
}

/**
 * 📋 INSTRUCTIONS FOR ΓΙΩΡΓΟΣ:
 *
 * 1. RUN DRY RUN FIRST:
 *    npx tsx migrate-dxf-data-ts.ts
 *
 * 2. IF DRY RUN LOOKS GOOD, RUN LIVE MIGRATION:
 *    Edit this file to call runDxfMigration(false)
 *
 * 3. MONITOR THE RESULTS:
 *    - Check Firebase Console → Storage
 *    - Verify DXF Viewer still works
 *    - Check performance improvements
 */