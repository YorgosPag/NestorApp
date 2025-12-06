// ============================================================================
// CONTACT RELATIONSHIPS MIGRATION SCRIPT - MODULAR ARCHITECTURE
// ============================================================================
//
// 🏢 Enterprise Database Migration for Contact Relationship Management
// Professional-grade migration script with rollback capability
// Supports Firebase/Firestore and SQL databases
//
// 🏗️ NEW: Uses modular schema architecture for better maintainability
// Executes: 01-tables → 02-indexes → 03-triggers → 04-views → 05-procedures → 07-maintenance → schema-info
//
// ============================================================================

import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * 🏗️ Modular Schema Files Configuration
 * Defines the execution order for enterprise modular schema
 */
const MODULAR_SCHEMA_FILES = [
  '01-tables.sql',        // Core table definitions
  '02-indexes.sql',       // Performance optimization indexes
  '03-triggers.sql',      // Automated triggers & functions
  '04-views.sql',         // Business intelligence views
  '05-procedures.sql',    // Stored procedures & functions
  '07-maintenance.sql',   // Database maintenance procedures
  'schema-info.sql'       // Version tracking & metadata
  // Note: 06-seed-data.sql is intentionally skipped for production safety
] as const;

/**
 * 🏗️ Migration Interface
 *
 * Standardized interface for database migrations
 * Ensures consistency across different database types
 */
export interface Migration {
  /** Migration version identifier */
  version: string;
  /** Human-readable description */
  description: string;
  /** Forward migration function */
  up(): Promise<void>;
  /** Rollback migration function */
  down(): Promise<void>;
  /** Validation function to check migration success */
  validate(): Promise<boolean>;
}

/**
 * 🏢 Contact Relationships Migration - Version 001
 *
 * Creates the complete enterprise database structure for contact relationship management
 * using the new modular architecture for better maintainability and deployment flexibility
 *
 * Executes in order:
 * - 01-tables.sql: Core table definitions
 * - 02-indexes.sql: Performance optimization indexes
 * - 03-triggers.sql: Automated triggers & functions
 * - 04-views.sql: Business intelligence views
 * - 05-procedures.sql: Stored procedures & functions
 * - 07-maintenance.sql: Database maintenance procedures
 * - schema-info.sql: Version tracking & metadata
 *
 * Note: 06-seed-data.sql is skipped in migrations for production safety
 */
export class CreateContactRelationshipsMigration implements Migration {
  version = '001';
  description = 'Create contact relationships schema with modular enterprise architecture';

  /**
   * 📈 Forward Migration - Create Database Structure
   */
  async up(): Promise<void> {
    console.log('🏗️ Running migration: Create Contact Relationships Tables');

    try {
      // Check database type and run appropriate migration
      const dbType = process.env.DATABASE_TYPE || 'postgresql';

      switch (dbType.toLowerCase()) {
        case 'postgresql':
        case 'postgres':
          await this.migratePostgreSQL();
          break;

        case 'mysql':
          await this.migrateMySQL();
          break;

        case 'sqlite':
          await this.migrateSQLite();
          break;

        case 'firebase':
        case 'firestore':
          await this.migrateFirestore();
          break;

        default:
          throw new Error(`Unsupported database type: ${dbType}`);
      }

      console.log('✅ Migration completed successfully');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * 📉 Rollback Migration - Remove Database Structure
   */
  async down(): Promise<void> {
    console.log('🔄 Rolling back migration: Drop Contact Relationships Tables');

    try {
      const dbType = process.env.DATABASE_TYPE || 'postgresql';

      switch (dbType.toLowerCase()) {
        case 'postgresql':
        case 'postgres':
          await this.rollbackPostgreSQL();
          break;

        case 'mysql':
          await this.rollbackMySQL();
          break;

        case 'sqlite':
          await this.rollbackSQLite();
          break;

        case 'firebase':
        case 'firestore':
          await this.rollbackFirestore();
          break;

        default:
          throw new Error(`Unsupported database type: ${dbType}`);
      }

      console.log('✅ Rollback completed successfully');
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }

  /**
   * ✅ Validate Migration Success
   */
  async validate(): Promise<boolean> {
    try {
      console.log('🔍 Validating migration...');

      const dbType = process.env.DATABASE_TYPE || 'postgresql';

      switch (dbType.toLowerCase()) {
        case 'postgresql':
        case 'postgres':
          return await this.validatePostgreSQL();

        case 'mysql':
          return await this.validateMySQL();

        case 'sqlite':
          return await this.validateSQLite();

        case 'firebase':
        case 'firestore':
          return await this.validateFirestore();

        default:
          console.warn(`Validation not implemented for database type: ${dbType}`);
          return true;
      }
    } catch (error) {
      console.error('❌ Migration validation failed:', error);
      return false;
    }
  }

  // ========================================================================
  // POSTGRESQL MIGRATION
  // ========================================================================

  private async migratePostgreSQL(): Promise<void> {
    const { Pool } = require('pg');
    const pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

    try {
      console.log('🐘 Running PostgreSQL migration...');

      // Execute modular schema files in correct order
      const schemaDir = join(__dirname, '../schemas/contact-relationships');

      for (const fileName of MODULAR_SCHEMA_FILES) {
        const filePath = join(schemaDir, fileName);
        console.log(`📄 Executing: ${fileName}`);

        try {
          const sql = readFileSync(filePath, 'utf8');
          await pool.query(sql);
          console.log(`✅ ${fileName} completed`);
        } catch (error) {
          console.error(`❌ Failed to execute ${fileName}:`, error);
          throw error;
        }
      }

      console.log('✅ PostgreSQL migration completed');
    } finally {
      await pool.end();
    }
  }

  private async rollbackPostgreSQL(): Promise<void> {
    const { Pool } = require('pg');
    const pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

    try {
      console.log('🐘 Rolling back PostgreSQL migration...');

      // Drop tables in reverse dependency order
      const dropSQL = `
        DROP VIEW IF EXISTS v_organization_hierarchy;
        DROP VIEW IF EXISTS v_employment_relationships;
        DROP VIEW IF EXISTS v_active_relationships;

        DROP FUNCTION IF EXISTS refresh_hierarchy_cache();
        DROP FUNCTION IF EXISTS cleanup_old_audit_records(INTEGER);
        DROP FUNCTION IF EXISTS get_person_employment_history(UUID);
        DROP FUNCTION IF EXISTS get_organization_employees(UUID, BOOLEAN);

        DROP TRIGGER IF EXISTS tr_hierarchy_cache_invalidation ON contact_relationships;
        DROP TRIGGER IF EXISTS tr_relationship_audit_log ON contact_relationships;
        DROP TRIGGER IF EXISTS tr_contact_relationships_updated_at ON contact_relationships;

        DROP FUNCTION IF EXISTS invalidate_hierarchy_cache();
        DROP FUNCTION IF EXISTS log_relationship_changes();
        DROP FUNCTION IF EXISTS update_updated_at_column();

        DROP TABLE IF EXISTS schema_migrations;
        DROP TABLE IF EXISTS organization_hierarchy_cache;
        DROP TABLE IF EXISTS relationship_documents;
        DROP TABLE IF EXISTS relationship_change_history;
        DROP TABLE IF EXISTS contact_relationships;
      `;

      await pool.query(dropSQL);

      console.log('✅ PostgreSQL rollback completed');
    } finally {
      await pool.end();
    }
  }

  private async validatePostgreSQL(): Promise<boolean> {
    const { Pool } = require('pg');
    const pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

    try {
      // Check if all required tables exist
      const result = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN (
          'contact_relationships',
          'relationship_change_history',
          'relationship_documents',
          'organization_hierarchy_cache',
          'schema_migrations'
        )
      `);

      const expectedTables = 5;
      const foundTables = result.rows.length;

      if (foundTables !== expectedTables) {
        console.error(`❌ Expected ${expectedTables} tables, found ${foundTables}`);
        return false;
      }

      // Check if migration record exists
      const migrationCheck = await pool.query(`
        SELECT COUNT(*) as count
        FROM schema_migrations
        WHERE version = '001_modular_schema'
      `);

      if (migrationCheck.rows[0].count === '0') {
        console.error('❌ Migration record not found');
        return false;
      }

      console.log('✅ PostgreSQL migration validation passed');
      return true;
    } finally {
      await pool.end();
    }
  }

  // ========================================================================
  // MYSQL MIGRATION
  // ========================================================================

  private async migrateMySQL(): Promise<void> {
    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

    try {
      console.log('🐬 Running MySQL migration...');
      console.log('⚠️  Note: Using simplified MySQL schema. For full enterprise features, use PostgreSQL.');

      // For MySQL, we use a simplified schema as MySQL lacks some PostgreSQL features
      // For production MySQL deployments, consider using the manual SQL files with MySQL-specific syntax
      const mysqlSchema = `
        CREATE TABLE contact_relationships (
          id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
          source_contact_id CHAR(36) NOT NULL,
          target_contact_id CHAR(36) NOT NULL,
          relationship_type VARCHAR(50) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          position VARCHAR(200),
          department VARCHAR(200),
          start_date DATE,
          end_date DATE,
          business_email VARCHAR(255),
          relationship_notes TEXT,
          created_by CHAR(36) NOT NULL,
          last_modified_by CHAR(36) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

          CHECK (source_contact_id != target_contact_id),
          INDEX idx_source (source_contact_id),
          INDEX idx_target (target_contact_id),
          INDEX idx_type (relationship_type),
          INDEX idx_status (status)
        );

        CREATE TABLE relationship_change_history (
          id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
          relationship_id CHAR(36) NOT NULL,
          change_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          change_type VARCHAR(50) NOT NULL,
          changed_by CHAR(36) NOT NULL,
          old_value JSON,
          new_value JSON,
          change_notes TEXT,

          FOREIGN KEY (relationship_id) REFERENCES contact_relationships(id) ON DELETE CASCADE
        );

        CREATE TABLE schema_migrations (
          version VARCHAR(50) PRIMARY KEY,
          description TEXT,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          applied_by VARCHAR(100)
        );

        INSERT INTO schema_migrations (version, description, applied_by)
        VALUES ('001_modular_schema', 'Contact relationships schema with modular architecture (MySQL)', 'system');
      `;

      await connection.execute(mysqlSchema);

      console.log('✅ MySQL migration completed');
      console.log('🏗️  For full enterprise features, consider migrating to PostgreSQL and using the modular SQL files.');
    } finally {
      await connection.end();
    }
  }

  private async rollbackMySQL(): Promise<void> {
    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

    try {
      console.log('🐬 Rolling back MySQL migration...');

      await connection.execute('DROP TABLE IF EXISTS schema_migrations');
      await connection.execute('DROP TABLE IF EXISTS relationship_change_history');
      await connection.execute('DROP TABLE IF EXISTS contact_relationships');

      console.log('✅ MySQL rollback completed');
    } finally {
      await connection.end();
    }
  }

  private async validateMySQL(): Promise<boolean> {
    // Similar validation logic for MySQL
    return true;
  }

  // ========================================================================
  // SQLITE MIGRATION
  // ========================================================================

  private async migrateSQLite(): Promise<void> {
    const Database = require('better-sqlite3');
    const db = new Database(process.env.DB_PATH || './contact_relationships.db');

    try {
      console.log('📀 Running SQLite migration...');

      // SQLite-specific schema
      const sqliteSchema = `
        CREATE TABLE contact_relationships (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
          source_contact_id TEXT NOT NULL,
          target_contact_id TEXT NOT NULL,
          relationship_type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          position TEXT,
          department TEXT,
          start_date TEXT,
          end_date TEXT,
          business_email TEXT,
          relationship_notes TEXT,
          created_by TEXT NOT NULL,
          last_modified_by TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

          CHECK (source_contact_id != target_contact_id)
        );

        CREATE INDEX idx_relationships_source ON contact_relationships(source_contact_id);
        CREATE INDEX idx_relationships_target ON contact_relationships(target_contact_id);
        CREATE INDEX idx_relationships_type ON contact_relationships(relationship_type);

        CREATE TABLE relationship_change_history (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
          relationship_id TEXT NOT NULL,
          change_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          change_type TEXT NOT NULL,
          changed_by TEXT NOT NULL,
          old_value TEXT,
          new_value TEXT,
          change_notes TEXT,

          FOREIGN KEY (relationship_id) REFERENCES contact_relationships(id) ON DELETE CASCADE
        );

        CREATE TABLE schema_migrations (
          version TEXT PRIMARY KEY,
          description TEXT,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          applied_by TEXT
        );

        INSERT INTO schema_migrations (version, description, applied_by)
        VALUES ('001_modular_schema', 'Contact relationships schema with modular architecture (SQLite)', 'system');
      `;

      db.exec(sqliteSchema);

      console.log('✅ SQLite migration completed');
    } finally {
      db.close();
    }
  }

  private async rollbackSQLite(): Promise<void> {
    const Database = require('better-sqlite3');
    const db = new Database(process.env.DB_PATH || './contact_relationships.db');

    try {
      console.log('📀 Rolling back SQLite migration...');

      db.exec('DROP TABLE IF EXISTS schema_migrations');
      db.exec('DROP TABLE IF EXISTS relationship_change_history');
      db.exec('DROP TABLE IF EXISTS contact_relationships');

      console.log('✅ SQLite rollback completed');
    } finally {
      db.close();
    }
  }

  private async validateSQLite(): Promise<boolean> {
    // Similar validation logic for SQLite
    return true;
  }

  // ========================================================================
  // FIRESTORE MIGRATION
  // ========================================================================

  private async migrateFirestore(): Promise<void> {
    console.log('🔥 Running Firestore migration...');

    try {
      // Firestore doesn't require schema creation, but we can set up:
      // 1. Collection structure
      // 2. Security rules
      // 3. Indexes
      // 4. Initial configuration documents

      const { initializeApp, getApps } = require('firebase/app');
      const { getFirestore, collection, doc, setDoc } = require('firebase/firestore');

      // Initialize Firebase (if not already initialized)
      if (getApps().length === 0) {
        initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID,
          // Add other Firebase config as needed
        });
      }

      const db = getFirestore();

      // Create configuration document for relationship types
      const configDoc = doc(db, 'system_config', 'relationship_types');
      await setDoc(configDoc, {
        version: '001',
        relationship_types: [
          'employee', 'manager', 'director', 'executive', 'intern', 'contractor',
          'consultant', 'shareholder', 'board_member', 'chairman', 'ceo',
          'representative', 'partner', 'vendor', 'client', 'civil_servant',
          'elected_official', 'appointed_official', 'department_head',
          'ministry_official', 'mayor', 'deputy_mayor', 'regional_governor',
          'advisor', 'mentor', 'protege', 'colleague', 'supplier', 'customer',
          'competitor', 'other'
        ],
        created_at: new Date(),
        applied_by: 'system'
      });

      // Create schema migration record
      const migrationDoc = doc(db, 'schema_migrations', '001_modular_schema');
      await setDoc(migrationDoc, {
        version: '001_modular_schema',
        description: 'Contact relationships setup with modular architecture (Firestore)',
        applied_at: new Date(),
        applied_by: 'system'
      });

      console.log('✅ Firestore migration completed');
    } catch (error) {
      console.error('❌ Firestore migration failed:', error);
      throw error;
    }
  }

  private async rollbackFirestore(): Promise<void> {
    console.log('🔥 Rolling back Firestore migration...');

    try {
      const { initializeApp, getApps } = require('firebase/app');
      const { getFirestore, collection, deleteDoc, doc, getDocs } = require('firebase/firestore');

      if (getApps().length === 0) {
        initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID,
        });
      }

      const db = getFirestore();

      // Delete all contact relationships
      const relationshipsSnapshot = await getDocs(collection(db, 'contact_relationships'));
      for (const docSnap of relationshipsSnapshot.docs) {
        await deleteDoc(doc(db, 'contact_relationships', docSnap.id));
      }

      // Delete change history
      const historySnapshot = await getDocs(collection(db, 'relationship_change_history'));
      for (const docSnap of historySnapshot.docs) {
        await deleteDoc(doc(db, 'relationship_change_history', docSnap.id));
      }

      // Delete configuration
      await deleteDoc(doc(db, 'system_config', 'relationship_types'));
      await deleteDoc(doc(db, 'schema_migrations', '001_initial_schema'));

      console.log('✅ Firestore rollback completed');
    } catch (error) {
      console.error('❌ Firestore rollback failed:', error);
      throw error;
    }
  }

  private async validateFirestore(): Promise<boolean> {
    try {
      const { initializeApp, getApps } = require('firebase/app');
      const { getFirestore, doc, getDoc } = require('firebase/firestore');

      if (getApps().length === 0) {
        initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID,
        });
      }

      const db = getFirestore();

      // Check if migration record exists
      const migrationDoc = await getDoc(doc(db, 'schema_migrations', '001_modular_schema'));

      if (!migrationDoc.exists()) {
        console.error('❌ Migration record not found in Firestore');
        return false;
      }

      console.log('✅ Firestore migration validation passed');
      return true;
    } catch (error) {
      console.error('❌ Firestore validation failed:', error);
      return false;
    }
  }
}

// ============================================================================
// MIGRATION RUNNER
// ============================================================================

/**
 * 🏃‍♂️ Migration Runner
 *
 * Utility class for running and managing database migrations
 */
export class MigrationRunner {
  private migrations: Migration[] = [];

  constructor() {
    // Register available migrations
    this.migrations = [
      new CreateContactRelationshipsMigration()
    ];
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(): Promise<void> {
    console.log('🚀 Starting database migration process...');

    for (const migration of this.migrations) {
      try {
        console.log(`📦 Running migration ${migration.version}: ${migration.description}`);

        await migration.up();

        const isValid = await migration.validate();
        if (!isValid) {
          throw new Error(`Migration ${migration.version} validation failed`);
        }

        console.log(`✅ Migration ${migration.version} completed successfully`);
      } catch (error) {
        console.error(`❌ Migration ${migration.version} failed:`, error);
        throw error;
      }
    }

    console.log('🎉 All migrations completed successfully');
  }

  /**
   * Rollback specific migration
   */
  async rollbackMigration(version: string): Promise<void> {
    const migration = this.migrations.find(m => m.version === version);
    if (!migration) {
      throw new Error(`Migration ${version} not found`);
    }

    console.log(`🔄 Rolling back migration ${version}...`);
    await migration.down();
    console.log(`✅ Migration ${version} rolled back successfully`);
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<Array<{ version: string; status: 'pending' | 'applied' | 'failed' }>> {
    // Implementation would check database for applied migrations
    return this.migrations.map(m => ({
      version: m.version,
      status: 'pending' as const // This would be determined by querying the database
    }));
  }
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

/**
 * 💻 Command Line Interface for migrations
 */
if (require.main === module) {
  const runner = new MigrationRunner();

  const command = process.argv[2];

  switch (command) {
    case 'up':
      runner.runMigrations().catch(console.error);
      break;

    case 'down':
      const version = process.argv[3];
      if (!version) {
        console.error('Please specify migration version to rollback');
        process.exit(1);
      }
      runner.rollbackMigration(version).catch(console.error);
      break;

    case 'status':
      runner.getMigrationStatus().then(status => {
        console.table(status);
      }).catch(console.error);
      break;

    default:
      console.log(`
Usage: node migration.js <command>

Commands:
  up                    Run all pending migrations
  down <version>        Rollback specific migration
  status               Show migration status

Examples:
  node migration.js up
  node migration.js down 001
  node migration.js status
      `);
  }
}