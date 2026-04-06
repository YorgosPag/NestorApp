/**
 * ============================================================================
 * 🔄 HARDCODED VALUES MIGRATION — OPERATIONS
 * ============================================================================
 *
 * Standalone migration operations: company, system, projects, validation, backup.
 * Extracted from hardcoded-values-migration.ts (ADR-065 SRP compliance).
 *
 * ============================================================================
 */

import { getErrorMessage } from '@/lib/error-utils';
import {
  doc,
  setDoc,
  getDoc,
  collection,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import {
  CompanyConfiguration,
  SystemConfiguration,
  ProjectTemplateConfiguration,
  EnterpriseConfigurationManager,
  DEFAULT_SYSTEM_CONFIG
} from './enterprise-config-management';
import {
  DETECTED_COMPANY_DATA,
  DETECTED_SYSTEM_DATA,
  DETECTED_PROJECT_DATA,
  BRANDING_DEFAULTS
} from './hardcoded-values-migration-types';

const logger = createModuleLogger('hardcoded-values-migration');

// ============================================================================
// 📊 SPECIFIC MIGRATION OPERATIONS
// ============================================================================

/**
 * Migrate company data από hardcoded values
 */
export async function migrateCompanyData(dryRun: boolean): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const companyConfig: CompanyConfiguration = {
      id: process.env.NEXT_PUBLIC_COMPANY_ID || 'pagonis-company',
      name: DETECTED_COMPANY_DATA.name,
      legalName: DETECTED_COMPANY_DATA.legalName,
      email: DETECTED_COMPANY_DATA.email,
      phone: DETECTED_COMPANY_DATA.phone,
      website: DETECTED_COMPANY_DATA.website,
      address: {
        ...DETECTED_COMPANY_DATA.address,
        country: 'Greece'
      },
      branding: BRANDING_DEFAULTS,
      tax: {
        ...DETECTED_COMPANY_DATA.tax,
        taxOffice: process.env.NEXT_PUBLIC_DEFAULT_TAX_OFFICE || 'ΔΟΥ Θεσσαλονίκης'
      }
    };

    if (!dryRun) {
      await setDoc(doc(db, COLLECTIONS.SYSTEM, 'company'), companyConfig);
    }

    logger.info('Company data migrated successfully');
    return { success: true };

  } catch (error) {
    const errorMessage = getErrorMessage(error, 'Company migration failed');
    logger.error('Company migration error', { error });
    return { success: false, error: errorMessage };
  }
}

/**
 * Migrate system configuration από hardcoded URLs
 */
export async function migrateSystemData(dryRun: boolean): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const environment =
      (process.env.NODE_ENV as SystemConfiguration['app']['environment'] | undefined) ??
      DEFAULT_SYSTEM_CONFIG.app.environment;
    const systemConfig: SystemConfiguration = {
      ...DEFAULT_SYSTEM_CONFIG,
      app: {
        ...DEFAULT_SYSTEM_CONFIG.app,
        environment,
        baseUrl: environment === 'production'
          ? DETECTED_SYSTEM_DATA.productionUrl
          : DETECTED_SYSTEM_DATA.developmentUrl,
        apiUrl: environment === 'production'
          ? `${DETECTED_SYSTEM_DATA.productionUrl}/api`
          : `${DETECTED_SYSTEM_DATA.developmentUrl}/api`
      },
      integrations: {
        ...DEFAULT_SYSTEM_CONFIG.integrations,
        webhooks: {
          telegram: DETECTED_SYSTEM_DATA.integrations.telegram.webhookUrl,
          slack: DETECTED_SYSTEM_DATA.integrations.slack.webhookUrl,
          email: DETECTED_SYSTEM_DATA.apiEndpoints.notifications
        },
        apis: {
          maps: DETECTED_SYSTEM_DATA.apiEndpoints.overpassApi[0],
          weather: DEFAULT_SYSTEM_CONFIG.integrations.apis.weather,
          notifications: DETECTED_SYSTEM_DATA.apiEndpoints.notifications
        }
      }
    };

    if (!dryRun) {
      await setDoc(doc(db, COLLECTIONS.SYSTEM, 'settings'), systemConfig);
    }

    logger.info('System data migrated successfully');
    return { success: true };

  } catch (error) {
    const errorMessage = getErrorMessage(error, 'System migration failed');
    logger.error('System migration error', { error });
    return { success: false, error: errorMessage };
  }
}

/**
 * Migrate project templates από hardcoded project data
 */
export async function migrateProjectTemplates(dryRun: boolean): Promise<{
  itemsMigrated: number;
  itemsFailed: number;
  errors: string[];
}> {
  let itemsMigrated = 0;
  let itemsFailed = 0;
  const errors: string[] = [];

  try {
    const batch = writeBatch(db);

    for (const projectData of DETECTED_PROJECT_DATA) {
      try {
        const template: ProjectTemplateConfiguration = {
          id: projectData.projectId,
          name: projectData.name,
          category: projectData.category,
          defaultValues: {
            status: projectData.defaultValues.status as string,
            currency: 'EUR',
            taxRate: 0.24, // 24% ΦΠΑ
            paymentTerms: 30
          },
          requiredFields: ['name', 'companyId', 'totalValue', 'startDate'],
          optionalFields: ['description', 'completionDate', 'notes']
        };

        if (!dryRun) {
          const docRef = doc(collection(db, COLLECTIONS.SYSTEM, 'project-templates'), template.id);
          batch.set(docRef, template);
        }

        itemsMigrated++;
        logger.info(`Project template '${template.name}' prepared for migration`);

      } catch (error) {
        itemsFailed++;
        const errorMessage = `Failed to migrate project ${projectData.name}: ${error}`;
        errors.push(errorMessage);
        logger.error(errorMessage);
      }
    }

    if (!dryRun && itemsMigrated > 0) {
      await batch.commit();
    }

    logger.info(`Project templates migration completed: ${itemsMigrated} succeeded, ${itemsFailed} failed`);

  } catch (error) {
    const errorMessage = getErrorMessage(error, 'Project templates migration failed');
    errors.push(errorMessage);
    logger.error('Project templates batch error', { error });
  }

  return { itemsMigrated, itemsFailed, errors };
}

// ============================================================================
// 🛡️ VALIDATION & SAFETY
// ============================================================================

/**
 * Validate environment πριν migration
 */
export async function validateEnvironment(): Promise<void> {
  try {
    // Check Firebase connection
    await getDoc(doc(db, COLLECTIONS.SYSTEM, 'health-check'));
    logger.info('Firebase connection validated');

    // Check permissions
    const testWrite = doc(db, COLLECTIONS.SYSTEM, 'migration-test');
    await setDoc(testWrite, { test: true, timestamp: Timestamp.now() });
    logger.info('Write permissions validated');

    // Cleanup test
    await setDoc(testWrite, { deleted: true });

  } catch (error) {
    throw new Error(`Environment validation failed: ${error}`);
  }
}

/**
 * Validate migrated data integrity
 */
export async function validateMigratedData(): Promise<{ success: boolean; error?: string }> {
  try {
    const configManager = EnterpriseConfigurationManager.getInstance();

    const company = await configManager.getCompanyConfig();
    if (!company.email || !company.name) {
      return { success: false, error: 'Company configuration incomplete' };
    }

    const system = await configManager.getSystemConfig();
    if (!system.app.baseUrl || !system.app.name) {
      return { success: false, error: 'System configuration incomplete' };
    }

    const templates = await configManager.getProjectTemplates();
    if (templates.length === 0) {
      return { success: false, error: 'No project templates found after migration' };
    }

    logger.info('Migrated data validation passed');
    return { success: true };

  } catch (error) {
    const errorMessage = getErrorMessage(error, 'Validation failed');
    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// 💾 BACKUP & LOGGING
// ============================================================================

/**
 * Create comprehensive backup πριν migration
 */
export async function createMigrationBackup(migrationId: string, backupId: string): Promise<string> {
  try {
    const backupDoc = {
      id: backupId,
      timestamp: Timestamp.now(),
      migrationId,
      originalData: {
        company: DETECTED_COMPANY_DATA,
        system: DETECTED_SYSTEM_DATA,
        projects: DETECTED_PROJECT_DATA
      },
      metadata: {
        environment: process.env.NODE_ENV,
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Server',
        version: '1.0.0'
      }
    };

    await setDoc(doc(db, COLLECTIONS.SYSTEM, 'migration-backups', backupId), backupDoc);

    logger.info(`Backup created successfully: ${backupId}`);
    return backupId;

  } catch (error) {
    throw new Error(`Backup creation failed: ${error}`);
  }
}

/**
 * Log migration result for audit trail
 */
export async function logMigrationResult(
  migrationId: string,
  result: { success: boolean; itemsMigrated: number; itemsFailed: number; errors: readonly string[]; duration: number; backupId: string },
  dryRun: boolean
): Promise<void> {
  try {
    const logDoc = {
      migrationId,
      timestamp: Timestamp.now(),
      dryRun,
      result,
      environment: process.env.NODE_ENV,
      version: '1.0.0'
    };

    await setDoc(doc(db, COLLECTIONS.SYSTEM, 'migration-logs', migrationId), logDoc);
    logger.info(`Migration result logged: ${migrationId}`);

  } catch (error) {
    logger.error('Failed to log migration result', { error });
  }
}

/**
 * Calculate total items for progress tracking
 */
export function calculateTotalItems(): number {
  return 2 + DETECTED_PROJECT_DATA.length; // Company + System + Projects
}
