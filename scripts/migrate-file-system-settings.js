#!/usr/bin/env node

/**
 * 📁 FILE SYSTEM SETTINGS MIGRATION SCRIPT
 *
 * Μεταφέρει τα hardcoded file system settings στη Firebase για internationalization.
 *
 * Usage:
 *   node scripts/migrate-file-system-settings.js [--tenant=TENANT_ID] [--environment=ENV] [--locales=LOCALES] [--force]
 *
 * Examples:
 *   node scripts/migrate-file-system-settings.js
 *   node scripts/migrate-file-system-settings.js --tenant=company-a --environment=production
 *   node scripts/migrate-file-system-settings.js --locales=en,el,de,fr --force
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

// Firestore collection για configuration (same as COLLECTIONS.CONFIG)
const CONFIG_COLLECTION = process.env.NEXT_PUBLIC_CONFIG_COLLECTION || 'config';

// Parse command line arguments
const args = process.argv.slice(2);
const tenantId = args.find(arg => arg.startsWith('--tenant='))?.split('=')[1];
const environment = args.find(arg => arg.startsWith('--environment='))?.split('=')[1] || 'production';
const locales = args.find(arg => arg.startsWith('--locales='))?.split('=')[1]?.split(',') || ['en', 'el', 'de', 'fr'];
const force = args.includes('--force');

console.log('📁 File System Settings Migration Script');
console.log(`📄 Target Collection: ${CONFIG_COLLECTION}`);
console.log(`🏢 Tenant ID: ${tenantId || 'default'}`);
console.log(`🌍 Environment: ${environment}`);
console.log(`🌐 Locales: ${locales.join(', ')}`);
console.log(`💪 Force Mode: ${force ? 'enabled' : 'disabled'}`);

// ============================================================================
// FILE SYSTEM CONFIGURATION DATA
// ============================================================================

/**
 * File size units για different locales
 */
const FILE_SIZE_UNITS_BY_LOCALE = {
  en: [
    { key: 'bytes', label: 'Bytes', labelShort: 'Bytes', factor: 1, order: 0 },
    { key: 'kb', label: 'Kilobytes', labelShort: 'KB', factor: 1024, order: 1 },
    { key: 'mb', label: 'Megabytes', labelShort: 'MB', factor: 1024 * 1024, order: 2 },
    { key: 'gb', label: 'Gigabytes', labelShort: 'GB', factor: 1024 * 1024 * 1024, order: 3 },
    { key: 'tb', label: 'Terabytes', labelShort: 'TB', factor: 1024 * 1024 * 1024 * 1024, order: 4 }
  ],
  el: [ // Greek
    { key: 'bytes', label: 'Ψηφιολέξεις', labelShort: 'Bytes', factor: 1, order: 0 },
    { key: 'kb', label: 'Κιλοψηφιολέξεις', labelShort: 'KB', factor: 1024, order: 1 },
    { key: 'mb', label: 'Μεγαψηφιολέξεις', labelShort: 'MB', factor: 1024 * 1024, order: 2 },
    { key: 'gb', label: 'Γιγαψηφιολέξεις', labelShort: 'GB', factor: 1024 * 1024 * 1024, order: 3 },
    { key: 'tb', label: 'Τεραψηφιολέξεις', labelShort: 'TB', factor: 1024 * 1024 * 1024 * 1024, order: 4 }
  ],
  de: [ // German
    { key: 'bytes', label: 'Bytes', labelShort: 'Bytes', factor: 1, order: 0 },
    { key: 'kb', label: 'Kilobytes', labelShort: 'KB', factor: 1024, order: 1 },
    { key: 'mb', label: 'Megabytes', labelShort: 'MB', factor: 1024 * 1024, order: 2 },
    { key: 'gb', label: 'Gigabytes', labelShort: 'GB', factor: 1024 * 1024 * 1024, order: 3 },
    { key: 'tb', label: 'Terabytes', labelShort: 'TB', factor: 1024 * 1024 * 1024 * 1024, order: 4 }
  ],
  fr: [ // French
    { key: 'bytes', label: 'Octets', labelShort: 'octets', factor: 1, order: 0 },
    { key: 'kb', label: 'Kilooctets', labelShort: 'Ko', factor: 1024, order: 1 },
    { key: 'mb', label: 'Mégaoctets', labelShort: 'Mo', factor: 1024 * 1024, order: 2 },
    { key: 'gb', label: 'Gigaoctets', labelShort: 'Go', factor: 1024 * 1024 * 1024, order: 3 },
    { key: 'tb', label: 'Téraoctets', labelShort: 'To', factor: 1024 * 1024 * 1024 * 1024, order: 4 }
  ],
  es: [ // Spanish
    { key: 'bytes', label: 'Bytes', labelShort: 'Bytes', factor: 1, order: 0 },
    { key: 'kb', label: 'Kilobytes', labelShort: 'KB', factor: 1024, order: 1 },
    { key: 'mb', label: 'Megabytes', labelShort: 'MB', factor: 1024 * 1024, order: 2 },
    { key: 'gb', label: 'Gigabytes', labelShort: 'GB', factor: 1024 * 1024 * 1024, order: 3 },
    { key: 'tb', label: 'Terabytes', labelShort: 'TB', factor: 1024 * 1024 * 1024 * 1024, order: 4 }
  ],
  it: [ // Italian
    { key: 'bytes', label: 'Byte', labelShort: 'Byte', factor: 1, order: 0 },
    { key: 'kb', label: 'Kilobyte', labelShort: 'KB', factor: 1024, order: 1 },
    { key: 'mb', label: 'Megabyte', labelShort: 'MB', factor: 1024 * 1024, order: 2 },
    { key: 'gb', label: 'Gigabyte', labelShort: 'GB', factor: 1024 * 1024 * 1024, order: 3 },
    { key: 'tb', label: 'Terabyte', labelShort: 'TB', factor: 1024 * 1024 * 1024 * 1024, order: 4 }
  ]
};

/**
 * Validation messages για different locales
 */
const VALIDATION_MESSAGES_BY_LOCALE = {
  en: {
    fileTooLarge: 'File size exceeds the maximum allowed limit',
    invalidFileType: 'File type is not allowed',
    invalidExtension: 'File extension is not allowed',
    uploadFailed: 'File upload failed',
    processingFailed: 'File processing failed',
    virusDetected: 'Virus detected in file',
    suspiciousFile: 'Suspicious file detected'
  },
  el: {
    fileTooLarge: 'Το μέγεθος του αρχείου υπερβαίνει το επιτρεπόμενο όριο',
    invalidFileType: 'Ο τύπος αρχείου δεν επιτρέπεται',
    invalidExtension: 'Η επέκταση αρχείου δεν επιτρέπεται',
    uploadFailed: 'Η μεταφόρτωση του αρχείου απέτυχε',
    processingFailed: 'Η επεξεργασία του αρχείου απέτυχε',
    virusDetected: 'Εντοπίστηκε ιός στο αρχείο',
    suspiciousFile: 'Εντοπίστηκε ύποπτο αρχείο'
  },
  de: {
    fileTooLarge: 'Dateigröße überschreitet das maximal zulässige Limit',
    invalidFileType: 'Dateityp ist nicht erlaubt',
    invalidExtension: 'Dateierweiterung ist nicht erlaubt',
    uploadFailed: 'Datei-Upload fehlgeschlagen',
    processingFailed: 'Dateiverarbeitung fehlgeschlagen',
    virusDetected: 'Virus in Datei erkannt',
    suspiciousFile: 'Verdächtige Datei erkannt'
  },
  fr: {
    fileTooLarge: 'La taille du fichier dépasse la limite autorisée',
    invalidFileType: 'Type de fichier non autorisé',
    invalidExtension: 'Extension de fichier non autorisée',
    uploadFailed: 'Échec du téléchargement de fichier',
    processingFailed: 'Échec du traitement de fichier',
    virusDetected: 'Virus détecté dans le fichier',
    suspiciousFile: 'Fichier suspect détecté'
  }
};

/**
 * File type validations (environment-specific)
 */
function getFileTypeValidations(env) {
  const baseSizes = {
    development: {
      image: 10 * 1024 * 1024,    // 10MB για dev testing
      document: 20 * 1024 * 1024, // 20MB για dev testing
      video: 200 * 1024 * 1024,   // 200MB για dev testing
      any: 100 * 1024 * 1024      // 100MB για dev testing
    },
    production: {
      image: 5 * 1024 * 1024,     // 5MB για production
      document: 10 * 1024 * 1024, // 10MB για production
      video: 100 * 1024 * 1024,   // 100MB για production
      any: 50 * 1024 * 1024       // 50MB για production
    }
  };

  const sizes = baseSizes[env] || baseSizes.production;

  return [
    {
      fileType: 'image',
      maxSize: sizes.image,
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'],
      allowedMimeTypes: [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'image/svg+xml', 'image/bmp'
      ],
      errorMessage: 'Please select a valid image file (JPG, PNG, GIF, WebP, SVG, BMP)',
      isEnabled: true
    },
    {
      fileType: 'document',
      maxSize: sizes.document,
      allowedExtensions: ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.xls', '.xlsx'],
      allowedMimeTypes: [
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain', 'text/rtf', 'application/vnd.oasis.opendocument.text',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ],
      errorMessage: 'Please select a valid document file (PDF, DOC, DOCX, TXT, RTF, ODT, XLS, XLSX)',
      isEnabled: true
    },
    {
      fileType: 'video',
      maxSize: sizes.video,
      allowedExtensions: ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv'],
      allowedMimeTypes: [
        'video/mp4', 'video/quicktime', 'video/x-msvideo',
        'video/x-matroska', 'video/webm', 'video/x-flv', 'video/x-ms-wmv'
      ],
      errorMessage: 'Please select a valid video file (MP4, MOV, AVI, MKV, WebM, FLV, WMV)',
      isEnabled: true
    },
    {
      fileType: 'audio',
      maxSize: 25 * 1024 * 1024, // 25MB
      allowedExtensions: ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'],
      allowedMimeTypes: [
        'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac',
        'audio/aac', 'audio/x-m4a'
      ],
      errorMessage: 'Please select a valid audio file (MP3, WAV, OGG, FLAC, AAC, M4A)',
      isEnabled: true
    },
    {
      fileType: 'archive',
      maxSize: sizes.document,
      allowedExtensions: ['.zip', '.rar', '.7z', '.tar', '.gz'],
      allowedMimeTypes: [
        'application/zip', 'application/x-rar-compressed',
        'application/x-7z-compressed', 'application/x-tar', 'application/gzip'
      ],
      errorMessage: 'Please select a valid archive file (ZIP, RAR, 7Z, TAR, GZ)',
      isEnabled: env === 'development' // Only enable in development
    },
    {
      fileType: 'any',
      maxSize: sizes.any,
      allowedExtensions: [],
      allowedMimeTypes: [],
      errorMessage: 'File too large or invalid format',
      isEnabled: true
    }
  ];
}

/**
 * Upload settings (environment-specific)
 */
function getUploadSettings(env) {
  return {
    maxConcurrentUploads: env === 'development' ? 5 : 3,
    chunkSize: env === 'development' ? 2 * 1024 * 1024 : 1024 * 1024, // 2MB για dev, 1MB για prod
    retryAttempts: 3,
    timeoutSeconds: env === 'development' ? 600 : 300, // 10min για dev, 5min για prod
    enableProgressTracking: true,
    enableThumbnailGeneration: true,
    thumbnailSizes: env === 'development' ? [100, 200, 400, 800] : [150, 300, 500],
    compressionEnabled: env === 'production', // Enable compression only in production
    compressionQuality: 0.8
  };
}

/**
 * Security settings (environment-specific)
 */
function getSecuritySettings(env) {
  return {
    enableVirusScanning: env === 'production',
    quarantineDirectory: env === 'development' ? '/dev-quarantine' : '/quarantine',
    allowExecutableFiles: env === 'development', // Only allow in development
    blockSuspiciousExtensions: env === 'production',
    enableContentTypeValidation: true,
    maxFileNameLength: env === 'development' ? 500 : 255,
    allowSpecialCharacters: env === 'development'
  };
}

/**
 * Generate file system configurations για all locales
 */
function generateFileSystemConfigurations() {
  const configurations = [];

  locales.forEach(locale => {
    const configId = `fs-config-${locale}-${tenantId || 'default'}-${environment}`;

    configurations.push({
      id: configId,
      type: 'file-system-config',
      tenantId: tenantId || 'default',
      locale: locale,
      environment: environment,
      configuration: {
        sizeUnits: FILE_SIZE_UNITS_BY_LOCALE[locale] || FILE_SIZE_UNITS_BY_LOCALE['en'],
        fileTypeValidations: getFileTypeValidations(environment),
        uploadSettings: getUploadSettings(environment),
        securitySettings: getSecuritySettings(environment),
        validationMessages: VALIDATION_MESSAGES_BY_LOCALE[locale] || VALIDATION_MESSAGES_BY_LOCALE['en'],
        customSettings: {
          enableDragDrop: true,
          enablePasteUpload: environment !== 'production', // Disable paste in production για security
          showFilePreview: true,
          autoDeleteTemporary: environment === 'production',
          temporaryRetentionHours: environment === 'development' ? 48 : 24
        }
      },
      isEnabled: true,
      priority: 1,
      metadata: {
        displayName: `File System Config για ${locale} locale`,
        description: `File system configuration για ${locale} locale and ${environment} environment`,
        version: '1.0.0',
        lastSyncedAt: new Date(),
        createdBy: 'migration-script',
        migrationDate: new Date().toISOString()
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  return configurations;
}

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================

/**
 * Initialize Firebase Admin
 */
function initializeFirebase() {
  try {
    // Try to initialize Firebase Admin
    let app;

    // Check if service account key exists
    const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');

    try {
      const serviceAccount = require(serviceAccountPath);
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      console.log('✅ Firebase Admin initialized with service account');
    } catch (error) {
      // Fallback to environment variables
      app = initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      });
      console.log('✅ Firebase Admin initialized with environment variables');
    }

    return getFirestore(app);
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    process.exit(1);
  }
}

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

/**
 * Migrate file system configurations to Firebase
 */
async function migrateFileSystemSettings(db) {
  console.log('\n📁 Starting file system settings migration...');

  const configurations = generateFileSystemConfigurations();
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const config of configurations) {
    try {
      // Check if document already exists
      const docRef = db.collection(CONFIG_COLLECTION).doc(config.id);
      const existingDoc = await docRef.get();

      if (existingDoc.exists() && !force) {
        console.log(`⏩ Skipping ${config.id}: Already exists (use --force to override)`);
        skippedCount++;
        continue;
      }

      // Write to Firestore
      await docRef.set(config, { merge: !force });

      console.log(`✅ Migrated: ${config.id} (${config.locale} - ${config.environment})`);
      successCount++;

    } catch (error) {
      console.error(`❌ Failed to migrate ${config.id}:`, error);
      errorCount++;
    }
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ⏩ Skipped: ${skippedCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📋 Total: ${configurations.length}`);

  return { successCount, errorCount, skippedCount };
}

/**
 * Verify migration by reading back configuration
 */
async function verifyMigration(db) {
  console.log('\n🔍 Verifying migration...');

  try {
    // Check file system configurations
    const snapshot = await db.collection(CONFIG_COLLECTION)
      .where('type', '==', 'file-system-config')
      .get();

    if (snapshot.empty) {
      console.log('⚠️ No file system configuration documents found');
      return false;
    }

    console.log(`✅ Found ${snapshot.size} file system configurations:`);

    const configsByLocale = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      const locale = data.locale || 'unknown';
      if (!configsByLocale[locale]) configsByLocale[locale] = [];
      configsByLocale[locale].push(`${data.environment || 'unknown'}`);
    });

    Object.entries(configsByLocale).forEach(([locale, envs]) => {
      console.log(`   📁 ${locale}: ${envs.join(', ')}`);
    });

    // Verify configuration completeness
    const testDoc = snapshot.docs[0];
    const testConfig = testDoc.data();

    console.log(`\n📋 Configuration completeness check (${testDoc.id}):`);
    console.log(`   📏 Size units: ${testConfig.configuration.sizeUnits?.length || 0}`);
    console.log(`   📋 File types: ${testConfig.configuration.fileTypeValidations?.length || 0}`);
    console.log(`   💬 Messages: ${Object.keys(testConfig.configuration.validationMessages || {}).length}`);

    return true;
  } catch (error) {
    console.error('❌ Verification failed:', error);
    return false;
  }
}

/**
 * Clean up existing file system configuration (optional)
 */
async function cleanupExistingConfig(db) {
  console.log('\n🧹 Cleaning up existing file system configuration...');

  try {
    const snapshot = await db.collection(CONFIG_COLLECTION)
      .where('type', '==', 'file-system-config')
      .get();

    if (snapshot.empty) {
      console.log('📋 No existing file system configuration to clean');
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`✅ Cleaned ${snapshot.size} existing file system configuration documents`);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  try {
    console.log('\n🚀 Initializing Firebase...');
    const db = initializeFirebase();

    // Optional: Clean existing configuration
    if (args.includes('--clean')) {
      await cleanupExistingConfig(db);
    }

    // Migrate configuration
    const { successCount, errorCount, skippedCount } = await migrateFileSystemSettings(db);

    // Verify migration
    const verified = await verifyMigration(db);

    // Final summary
    console.log('\n🎉 File System Settings Migration completed!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Update your application to use EnterpriseFileSystemService');
    console.log('   2. Test file validation with the new configuration');
    console.log('   3. Configure locale-specific file size units');
    console.log('   4. Set up tenant-specific file handling rules');
    console.log('   5. Update file-validation.ts to use database-driven settings');
    console.log('\n📚 Documentation:');
    console.log('   - Service: src/services/filesystem/EnterpriseFileSystemService.ts');
    console.log('   - Usage: src/utils/file-validation.ts');
    console.log('\n🌟 Additional Commands:');
    console.log('   - Clean & migrate: node scripts/migrate-file-system-settings.js --clean --force');
    console.log('   - Specific locales: node scripts/migrate-file-system-settings.js --locales=en,el');
    console.log('   - Tenant-specific: node scripts/migrate-file-system-settings.js --tenant=company-a');

    if (successCount > 0 && verified) {
      console.log('\n✅ File system settings migrated successfully!');
      console.log(`📊 Migrated ${successCount} configurations across ${locales.length} locales`);
      process.exit(0);
    } else {
      console.log('\n⚠️ Migration completed with some issues. Please review the logs above.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Make sure Firebase credentials are configured');
    console.log('   2. Verify COLLECTIONS.CONFIG is properly set');
    console.log('   3. Check Firestore security rules allow writes');
    console.log('   4. Ensure all required locales are valid');
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  migrateFileSystemSettings,
  verifyMigration,
  FILE_SIZE_UNITS_BY_LOCALE,
  VALIDATION_MESSAGES_BY_LOCALE
};