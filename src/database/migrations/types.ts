/**
 * Enterprise Database Migration Framework
 * Type definitions for database migrations
 */

// 🏢 ENTERPRISE: Type-safe migration data structures
export interface MigrationStepResult {
  affectedRecords?: number;
  data?: Record<string, unknown>;
  message?: string;
}

export interface MigrationBackupData {
  backupId: string;
  timestamp: Date;
  tables?: string[];
  snapshotData?: Record<string, unknown>;
}

export interface MigrationResult {
  success: boolean;
  migrationId: string;
  executedAt: Date;
  affectedRecords: number;
  rollbackData?: MigrationBackupData;
  errors?: string[];
  warnings?: string[];
  executionTimeMs: number;
}

export interface MigrationStep {
  stepId: string;
  description: string;
  execute: () => Promise<MigrationStepResult | void>;
  rollback?: () => Promise<MigrationStepResult | void>;
  validate?: () => Promise<boolean>;
}

export interface Migration {
  id: string;
  version: string;
  name: string;
  description: string;
  author: string;
  createdAt: Date;
  dependencies?: string[];
  steps: MigrationStep[];
  dryRun?: boolean;
}

export interface MigrationContext {
  environment: 'development' | 'staging' | 'production';
  timestamp: Date;
  userAgent: string;
  backupRequired: boolean;
}

// 🏢 ENTERPRISE: Validation result structure
export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export interface ValidationRule {
  name: string;
  description: string;
  validate: (data: unknown) => Promise<ValidationResult>;
}

export interface DataIntegrityCheck {
  tableName: string;
  rules: ValidationRule[];
}

export interface MigrationConfig {
  maxRetries: number;
  timeoutMs: number;
  batchSize: number;
  enableRollback: boolean;
  enableBackup: boolean;
  validateBeforeExecute: boolean;
  validateAfterExecute: boolean;
}

export const DEFAULT_MIGRATION_CONFIG: MigrationConfig = {
  maxRetries: 3,
  timeoutMs: 300000, // 5 minutes
  batchSize: 100,
  enableRollback: true,
  enableBackup: true,
  validateBeforeExecute: true,
  validateAfterExecute: true
};