#!/usr/bin/env node

/**
 * ============================================================================
 * 🔄 ENTERPRISE BACKGROUND CENTRALIZATION ROLLBACK SYSTEM
 * ============================================================================
 *
 * AGENT_D Emergency Rollback Protocol
 *
 * Purpose: Safe rollback capability for background centralization changes
 * Usage: node scripts/background-rollback.js [backup-id]
 * Safety: Creates backups before any rollback operation
 *
 * Enterprise Standard: Fortune 500 change management protocols
 *
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================================
// 🔒 ROLLBACK CONFIGURATION
// ============================================================================

const ROLLBACK_CONFIG = {
  // Backup directory
  backupDir: 'background-migration-backups',

  // Critical files that require backup before migration
  criticalFiles: [
    'src/hooks/useSemanticColors.ts',
    'src/app/globals.css',
    'src/styles/design-tokens.ts',
    'src/hooks/useBorderTokens.ts'
  ],

  // Component directories that may be affected
  componentDirs: [
    'src/components',
    'src/subapps',
    'src/features',
    'packages/core'
  ],

  // Git safety requirements
  gitSafety: {
    requireCleanWorkingDirectory: true,
    createBackupBranch: true,
    branchPrefix: 'backup/background-migration'
  }
};

// ============================================================================
// 🛡️ SAFETY VALIDATION FUNCTIONS
// ============================================================================

/**
 * Check if git working directory is clean
 */
function validateGitStatus() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });

    if (status.trim() && ROLLBACK_CONFIG.gitSafety.requireCleanWorkingDirectory) {
      throw new Error(`
        🚨 Git working directory is not clean!

        Uncommitted changes detected:
        ${status}

        Please commit or stash changes before proceeding with rollback.

        Enterprise Safety Protocol: Rollback requires clean git state.
      `);
    }

    console.log('✅ Git working directory is clean');
    return true;
  } catch (error) {
    if (error.message.includes('not a git repository')) {
      console.warn('⚠️ Not a git repository - proceeding with file-only backup');
      return true;
    }
    throw error;
  }
}

/**
 * Create backup branch for rollback safety
 */
function createBackupBranch() {
  try {
    const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupBranch = `${ROLLBACK_CONFIG.gitSafety.branchPrefix}-${timestamp}`;

    execSync(`git checkout -b ${backupBranch}`);
    console.log(`✅ Created backup branch: ${backupBranch}`);

    // Switch back to original branch
    execSync(`git checkout ${currentBranch}`);
    console.log(`✅ Returned to original branch: ${currentBranch}`);

    return backupBranch;
  } catch (error) {
    console.warn('⚠️ Could not create git backup branch:', error.message);
    return null;
  }
}

/**
 * Create file system backups
 */
function createFileBackups() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(ROLLBACK_CONFIG.backupDir, `backup-${timestamp}`);

  // Ensure backup directory exists
  fs.mkdirSync(backupPath, { recursive: true });

  console.log(`📁 Creating file backups in: ${backupPath}`);

  const backupManifest = {
    timestamp,
    backupPath,
    files: [],
    directories: []
  };

  // Backup critical files
  ROLLBACK_CONFIG.criticalFiles.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      const backupFilePath = path.join(backupPath, filePath);
      const backupDir = path.dirname(backupFilePath);

      fs.mkdirSync(backupDir, { recursive: true });
      fs.copyFileSync(filePath, backupFilePath);

      backupManifest.files.push({
        original: filePath,
        backup: backupFilePath,
        size: fs.statSync(filePath).size
      });

      console.log(`   📄 Backed up: ${filePath}`);
    } else {
      console.warn(`   ⚠️ File not found: ${filePath}`);
    }
  });

  // Backup component directories (selective)
  ROLLBACK_CONFIG.componentDirs.forEach(dirPath => {
    if (fs.existsSync(dirPath)) {
      const backupDirPath = path.join(backupPath, dirPath);

      // Only backup files that might contain background patterns
      const filesToBackup = findFilesWithBackgrounds(dirPath);

      filesToBackup.forEach(file => {
        const relativePath = path.relative(dirPath, file);
        const backupFilePath = path.join(backupDirPath, relativePath);
        const backupFileDir = path.dirname(backupFilePath);

        fs.mkdirSync(backupFileDir, { recursive: true });
        fs.copyFileSync(file, backupFilePath);

        backupManifest.files.push({
          original: file,
          backup: backupFilePath,
          size: fs.statSync(file).size
        });
      });

      backupManifest.directories.push({
        original: dirPath,
        backup: backupDirPath,
        fileCount: filesToBackup.length
      });

      console.log(`   📁 Backed up directory: ${dirPath} (${filesToBackup.length} files)`);
    }
  });

  // Save backup manifest
  const manifestPath = path.join(backupPath, 'backup-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(backupManifest, null, 2));

  console.log(`✅ Backup completed successfully`);
  console.log(`📋 Manifest saved: ${manifestPath}`);

  return backupManifest;
}

/**
 * Find files that might contain background patterns
 */
function findFilesWithBackgrounds(dirPath) {
  const files = [];

  function scanDirectory(dir) {
    try {
      const items = fs.readdirSync(dir);

      items.forEach(item => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          scanDirectory(fullPath);
        } else if (stat.isFile() && /\.(tsx?|jsx?)$/.test(item)) {
          // Check if file contains background-related patterns
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('bg-') || content.includes('background') || content.includes('useSemanticColors')) {
              files.push(fullPath);
            }
          } catch (error) {
            console.warn(`   ⚠️ Could not read file: ${fullPath}`);
          }
        }
      });
    } catch (error) {
      console.warn(`   ⚠️ Could not scan directory: ${dir}`);
    }
  }

  scanDirectory(dirPath);
  return files;
}

// ============================================================================
// 🔄 ROLLBACK EXECUTION FUNCTIONS
// ============================================================================

/**
 * List available backups
 */
function listAvailableBackups() {
  if (!fs.existsSync(ROLLBACK_CONFIG.backupDir)) {
    console.log('📭 No backups available');
    return [];
  }

  const backups = fs.readdirSync(ROLLBACK_CONFIG.backupDir)
    .filter(item => {
      const itemPath = path.join(ROLLBACK_CONFIG.backupDir, item);
      return fs.statSync(itemPath).isDirectory() && item.startsWith('backup-');
    })
    .map(backupDir => {
      const backupPath = path.join(ROLLBACK_CONFIG.backupDir, backupDir);
      const manifestPath = path.join(backupPath, 'backup-manifest.json');

      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        return {
          id: backupDir,
          ...manifest
        };
      }

      return {
        id: backupDir,
        timestamp: 'unknown',
        backupPath
      };
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  console.log('📚 Available backups:');
  backups.forEach((backup, index) => {
    console.log(`   ${index + 1}. ${backup.id} (${backup.timestamp})`);
    if (backup.files) {
      console.log(`      📄 Files: ${backup.files.length}`);
    }
  });

  return backups;
}

/**
 * Restore from backup
 */
function restoreFromBackup(backupId) {
  const backupPath = path.join(ROLLBACK_CONFIG.backupDir, backupId);
  const manifestPath = path.join(backupPath, 'backup-manifest.json');

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`❌ Backup manifest not found: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  console.log(`🔄 Restoring from backup: ${backupId}`);
  console.log(`📅 Backup created: ${manifest.timestamp}`);

  // Restore files
  manifest.files.forEach(file => {
    try {
      // Ensure target directory exists
      const targetDir = path.dirname(file.original);
      fs.mkdirSync(targetDir, { recursive: true });

      // Restore file
      fs.copyFileSync(file.backup, file.original);
      console.log(`   ✅ Restored: ${file.original}`);
    } catch (error) {
      console.error(`   ❌ Failed to restore: ${file.original}`, error.message);
    }
  });

  console.log(`✅ Rollback completed successfully`);
  console.log(`📊 Files restored: ${manifest.files.length}`);

  return manifest;
}

// ============================================================================
// 🎯 MAIN ROLLBACK FUNCTIONS
// ============================================================================

/**
 * Create backup before migration
 */
async function createPreMigrationBackup() {
  console.log('🛡️ ENTERPRISE BACKGROUND MIGRATION - PRE-MIGRATION BACKUP');
  console.log('='.repeat(60));

  // Step 1: Validate git status
  validateGitStatus();

  // Step 2: Create git backup branch
  const backupBranch = createBackupBranch();

  // Step 3: Create file system backups
  const backupManifest = createFileBackups();

  console.log('');
  console.log('✅ PRE-MIGRATION BACKUP COMPLETED');
  console.log(`🔒 Backup ID: ${backupManifest.timestamp}`);
  if (backupBranch) {
    console.log(`🌿 Git Branch: ${backupBranch}`);
  }
  console.log(`📁 Backup Path: ${backupManifest.backupPath}`);

  return backupManifest;
}

/**
 * Execute rollback
 */
async function executeRollback(backupId) {
  console.log('🔄 ENTERPRISE BACKGROUND MIGRATION - EMERGENCY ROLLBACK');
  console.log('='.repeat(60));

  if (!backupId) {
    const availableBackups = listAvailableBackups();
    if (availableBackups.length === 0) {
      throw new Error('❌ No backups available for rollback');
    }

    console.log('');
    console.log('Please specify a backup ID from the list above');
    console.log('Usage: node scripts/background-rollback.js <backup-id>');
    return;
  }

  // Step 1: Validate git status
  validateGitStatus();

  // Step 2: Create rollback backup (backup of current state before rollback)
  console.log('🔒 Creating rollback safety backup...');
  const rollbackBackup = createFileBackups();

  // Step 3: Execute restoration
  const restoredManifest = restoreFromBackup(backupId);

  console.log('');
  console.log('✅ EMERGENCY ROLLBACK COMPLETED');
  console.log(`🔄 Restored from: ${backupId}`);
  console.log(`🔒 Safety backup: ${rollbackBackup.timestamp}`);
  console.log('');
  console.log('⚠️ IMPORTANT: Please verify the application works correctly');
  console.log('⚠️ Run: npm run build && npm run test');

  return {
    rolledBackFrom: backupId,
    safetyBackup: rollbackBackup.timestamp,
    restoredFiles: restoredManifest.files.length
  };
}

// ============================================================================
// 🚀 SCRIPT EXECUTION
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const backupId = args[1];

  try {
    switch (command) {
      case 'backup':
      case 'create':
        await createPreMigrationBackup();
        break;

      case 'list':
        listAvailableBackups();
        break;

      case 'rollback':
      case 'restore':
        await executeRollback(backupId);
        break;

      default:
        if (command) {
          // Assume command is a backup ID for rollback
          await executeRollback(command);
        } else {
          console.log('🔄 ENTERPRISE BACKGROUND ROLLBACK SYSTEM');
          console.log('');
          console.log('Usage:');
          console.log('  node scripts/background-rollback.js backup     # Create pre-migration backup');
          console.log('  node scripts/background-rollback.js list       # List available backups');
          console.log('  node scripts/background-rollback.js <backup>   # Rollback to specific backup');
          console.log('');
          listAvailableBackups();
        }
        break;
    }
  } catch (error) {
    console.error('❌ Rollback operation failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  createPreMigrationBackup,
  executeRollback,
  listAvailableBackups,
  validateGitStatus,
  createBackupBranch,
  createFileBackups,
  ROLLBACK_CONFIG
};