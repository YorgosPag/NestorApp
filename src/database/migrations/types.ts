/**
 * Enterprise Database Migration Framework
 * Type definitions for database migrations
 */

export interface MigrationResult {
  success: boolean;
  migrationId: string;
  executedAt: Date;
  affectedRecords: number;
  rollbackData?: any;
  errors?: string[];
  warnings?: string[];
  executionTimeMs: number;
}

export interface MigrationStep {
  stepId: string;
  description: string;
  execute: () => Promise<any>;
  rollback?: () => Promise<any>;
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

export interface ValidationRule {
  name: string;
  description: string;
  validate: (data: any) => Promise<{ valid: boolean; message?: string }>;
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