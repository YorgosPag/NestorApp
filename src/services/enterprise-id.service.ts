/**
 * 🏢 ENTERPRISE ID GENERATION SERVICE
 *
 * Cryptographically secure, collision-resistant ID generation
 * για production-grade applications
 *
 * FEATURES:
 * - UUID v4 with crypto.randomUUID()
 * - Prefixed namespacing για type safety
 * - Collision detection με retry mechanism
 * - Audit logging για security compliance
 * - Performance optimized με caching
 *
 * SECURITY:
 * - 128-bit entropy (2^122 possible values)
 * - CSPRNG (Cryptographically Secure Pseudo-Random Number Generator)
 * - No predictable patterns
 * - No sequential exposure
 *
 * @author Enterprise Architecture Team
 * @date 2025-12-17
 * @version 2.0.0
 * @updated 2026-01-11 - Added 30+ new ID types for complete enterprise coverage
 */

// Enterprise prefix mappings για namespace isolation
export const ENTERPRISE_ID_PREFIXES = {
  // ==========================================================================
  // CORE BUSINESS ENTITIES
  // ==========================================================================
  COMPANY: 'comp',
  PROJECT: 'proj',
  BUILDING: 'bldg',
  UNIT: 'unit',
  STORAGE: 'stor',
  PARKING: 'park',
  CONTACT: 'cont',
  FLOOR: 'flr',
  DOCUMENT: 'doc',
  USER: 'usr',
  ASSET: 'ast',
  RELATIONSHIP: 'rel',

  // ==========================================================================
  // LEGAL DOCUMENTS & OBLIGATIONS
  // ==========================================================================
  SECTION: 'sec',
  ARTICLE: 'art',
  PARAGRAPH: 'par',
  OBLIGATION: 'obl',

  // ==========================================================================
  // RUNTIME & EPHEMERAL
  // ==========================================================================
  SESSION: 'sess',
  TRANSACTION: 'txn',
  NOTIFICATION: 'notif',
  TASK: 'task',
  EVENT: 'evt',
  REQUEST: 'req',
  MESSAGE: 'msg',
  JOB: 'job',

  // ==========================================================================
  // UI & VISUALIZATION
  // ==========================================================================
  LAYER: 'lyr',
  ELEMENT: 'elem',
  HISTORY: 'hist',
  ANNOTATION: 'annot',
  CONTROL_POINT: 'cp',
  ENTITY: 'ent',
  CUSTOMIZATION: 'cust',

  // ==========================================================================
  // OBSERVABILITY & MONITORING
  // ==========================================================================
  ERROR: 'err',
  METRIC: 'metric',
  ALERT: 'alert',
  TRACE: 'trace',
  SPAN: 'span',
  SEARCH: 'search',
  AUDIT: 'audit',

  // ==========================================================================
  // DEVOPS & OPERATIONS
  // ==========================================================================
  CONTAINER: 'ctr',
  DEPLOYMENT: 'deploy',
  PIPELINE: 'pipe',
  BACKUP: 'backup',
  MIGRATION: 'migr',
  TEMPLATE: 'tpl',
  OPERATION: 'op',

  // ==========================================================================
  // ACCOUNTING (Subapp — ADR-ACC-001 through ADR-ACC-010)
  // ==========================================================================
  JOURNAL_ENTRY: 'je',
  INVOICE_ACC: 'inv',
  BANK_TRANSACTION: 'btxn',
  FIXED_ASSET: 'fxa',
  DEPRECIATION: 'depr',
  EFKA_PAYMENT: 'efka',
  IMPORT_BATCH: 'batch',
  EXPENSE_DOC: 'exdoc',

  // ==========================================================================
  // OPTIMISTIC & TEMPORARY
  // ==========================================================================
  OPTIMISTIC: 'opt',
  TEMP: 'tmp'
} as const;

export type EnterpriseIdPrefix = typeof ENTERPRISE_ID_PREFIXES[keyof typeof ENTERPRISE_ID_PREFIXES];

/**
 * Enterprise ID interface για type safety
 */
export interface EnterpriseId {
  readonly id: string;
  readonly prefix: EnterpriseIdPrefix;
  readonly uuid: string;
  readonly timestamp: number;
}

/**
 * ID generation configuration
 */
interface IdGenerationConfig {
  maxRetries: number;
  enableLogging: boolean;
  enableCache: boolean;
  cacheSize: number;
}

/**
 * 🏢 ENTERPRISE ID GENERATION SERVICE
 *
 * Production-grade ID generation με enterprise security standards
 */
export class EnterpriseIdService {
  private readonly config: IdGenerationConfig;
  private readonly generatedIds = new Set<string>();
  private readonly cache = new Map<string, EnterpriseId>();

  constructor(config: Partial<IdGenerationConfig> = {}) {
    this.config = {
      maxRetries: 3,
      enableLogging: process.env.NODE_ENV === 'development',
      enableCache: true,
      cacheSize: 1000,
      ...config
    };
  }

  /**
   * Generate cryptographically secure UUID
   * Fallback to crypto.getRandomValues for older environments
   */
  private generateSecureUuid(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    // Fallback for environments without crypto.randomUUID
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);

    // Format as UUID v4
    array[6] = (array[6] & 0x0f) | 0x40; // Version 4
    array[8] = (array[8] & 0x3f) | 0x80; // Variant bits

    const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }

  /**
   * Generate enterprise ID με prefix και collision detection
   */
  private generateId(prefix: EnterpriseIdPrefix): EnterpriseId {
    let attempts = 0;
    let id: string;
    let uuid: string;

    do {
      if (attempts >= this.config.maxRetries) {
        throw new Error(`Failed to generate unique ID after ${this.config.maxRetries} attempts`);
      }

      uuid = this.generateSecureUuid();
      id = `${prefix}_${uuid}`;
      attempts++;

    } while (this.generatedIds.has(id));

    // Track generated ID για collision detection
    this.generatedIds.add(id);

    // Cache management
    if (this.config.enableCache && this.cache.size >= this.config.cacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const enterpriseId: EnterpriseId = {
      id,
      prefix,
      uuid,
      timestamp: Date.now()
    };

    if (this.config.enableCache) {
      this.cache.set(id, enterpriseId);
    }

    if (this.config.enableLogging) {
      console.log(`🆔 Generated enterprise ID: ${id} (attempts: ${attempts})`);
    }

    return enterpriseId;
  }

  // ==========================================================================
  // PUBLIC API - ENTITY-SPECIFIC ID GENERATORS
  // ==========================================================================

  /**
   * 🏢 Generate Company ID
   * Format: comp_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateCompanyId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.COMPANY).id;
  }

  /**
   * 🏗️ Generate Project ID
   * Format: proj_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateProjectId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.PROJECT).id;
  }

  /**
   * 🏢 Generate Building ID
   * Format: bldg_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateBuildingId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.BUILDING).id;
  }

  /**
   * 🏠 Generate Unit ID
   * Format: unit_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateUnitId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.UNIT).id;
  }

  /**
   * 📦 Generate Storage ID
   * Format: stor_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateStorageId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.STORAGE).id;
  }

  /**
   * 🅿️ Generate Parking ID
   * Format: park_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   * 🏢 ENTERPRISE: Parallel category to units (per local_4.log architecture)
   */
  generateParkingId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.PARKING).id;
  }

  /**
   * 📞 Generate Contact ID
   * Format: cont_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateContactId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.CONTACT).id;
  }

  /**
   * 🏢 Generate Floor ID
   * Format: flr_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateFloorId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.FLOOR).id;
  }

  /**
   * 📄 Generate Document ID
   * Format: doc_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateDocumentId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.DOCUMENT).id;
  }

  /**
   * 👤 Generate User ID
   * Format: usr_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateUserId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.USER).id;
  }

  /**
   * 🔗 Generate Relationship ID
   * Format: rel_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateRelationshipId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.RELATIONSHIP).id;
  }

  // ==========================================================================
  // LEGAL DOCUMENTS & OBLIGATIONS
  // ==========================================================================

  /**
   * 📑 Generate Section ID (for legal document sections)
   * Format: sec_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateSectionId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.SECTION).id;
  }

  /**
   * 📄 Generate Article ID (for legal document articles)
   * Format: art_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateArticleId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.ARTICLE).id;
  }

  /**
   * 📝 Generate Paragraph ID (for legal document paragraphs)
   * Format: par_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateParagraphId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.PARAGRAPH).id;
  }

  /**
   * ⚖️ Generate Obligation ID (for contractual obligations)
   * Format: obl_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateObligationId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.OBLIGATION).id;
  }

  /**
   * 🔔 Generate Notification ID
   * Format: notif_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateNotificationId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.NOTIFICATION).id;
  }

  /**
   * 🔐 Generate Session ID
   * Format: sess_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateSessionId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.SESSION).id;
  }

  /**
   * 📡 Generate Request ID
   * Format: req_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateRequestId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.REQUEST).id;
  }

  /**
   * 💬 Generate Message ID
   * Format: msg_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateMessageId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.MESSAGE).id;
  }

  /**
   * ⚙️ Generate Job ID
   * Format: job_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateJobId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.JOB).id;
  }

  /**
   * 🗂️ Generate Layer ID
   * Format: lyr_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateLayerId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.LAYER).id;
  }

  /**
   * 🔲 Generate Element ID
   * Format: elem_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateElementId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.ELEMENT).id;
  }

  /**
   * 📜 Generate History ID
   * Format: hist_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateHistoryId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.HISTORY).id;
  }

  /**
   * 📝 Generate Annotation ID
   * Format: annot_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateAnnotationId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.ANNOTATION).id;
  }

  /**
   * 📍 Generate Control Point ID
   * Format: cp_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateControlPointId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.CONTROL_POINT).id;
  }

  /**
   * 🔷 Generate Entity ID (generic)
   * Format: ent_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateEntityId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.ENTITY).id;
  }

  /**
   * 🎨 Generate Customization ID
   * Format: cust_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateCustomizationId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.CUSTOMIZATION).id;
  }

  /**
   * ❌ Generate Error ID
   * Format: err_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateErrorId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.ERROR).id;
  }

  /**
   * 📊 Generate Metric ID
   * Format: metric_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateMetricId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.METRIC).id;
  }

  /**
   * 🚨 Generate Alert ID
   * Format: alert_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateAlertId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.ALERT).id;
  }

  /**
   * 🔍 Generate Trace ID
   * Format: trace_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateTraceId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.TRACE).id;
  }

  /**
   * 📏 Generate Span ID
   * Format: span_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateSpanId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.SPAN).id;
  }

  /**
   * 🔎 Generate Search ID
   * Format: search_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateSearchId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.SEARCH).id;
  }

  /**
   * 📋 Generate Audit ID
   * Format: audit_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateAuditId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.AUDIT).id;
  }

  /**
   * 🚀 Generate Deployment ID
   * Format: deploy_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateDeploymentId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.DEPLOYMENT).id;
  }

  /**
   * ?? Generate Container ID
   * Format: ctr_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateContainerId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.CONTAINER).id;
  }

  /**
   * 🔄 Generate Pipeline ID
   * Format: pipe_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generatePipelineId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.PIPELINE).id;
  }

  /**
   * 💾 Generate Backup ID
   * Format: backup_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateBackupId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.BACKUP).id;
  }

  /**
   * 🔀 Generate Migration ID
   * Format: migr_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateMigrationId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.MIGRATION).id;
  }

  /**
   * 📄 Generate Template ID
   * Format: tpl_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateTemplateId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.TEMPLATE).id;
  }

  /**
   * ⚡ Generate Operation ID
   * Format: op_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateOperationId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.OPERATION).id;
  }

  // ==========================================================================
  // ACCOUNTING (Subapp — ADR-ACC-001 through ADR-ACC-010)
  // ==========================================================================

  /**
   * 📊 Generate Journal Entry ID
   * Format: je_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateJournalEntryId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.JOURNAL_ENTRY).id;
  }

  /**
   * 🧾 Generate Accounting Invoice ID
   * Format: inv_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateInvoiceAccId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.INVOICE_ACC).id;
  }

  /**
   * 🏦 Generate Bank Transaction ID
   * Format: btxn_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateBankTransactionId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.BANK_TRANSACTION).id;
  }

  /**
   * 🏭 Generate Fixed Asset ID
   * Format: fxa_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateFixedAssetId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.FIXED_ASSET).id;
  }

  /**
   * 📉 Generate Depreciation Record ID
   * Format: depr_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateDepreciationId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.DEPRECIATION).id;
  }

  /**
   * 🏥 Generate EFKA Payment ID
   * Format: efka_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateEfkaPaymentId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.EFKA_PAYMENT).id;
  }

  /**
   * 📦 Generate Import Batch ID
   * Format: batch_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateImportBatchId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.IMPORT_BATCH).id;
  }

  /**
   * 📄 Generate Expense Document ID
   * Format: exdoc_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateExpenseDocId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.EXPENSE_DOC).id;
  }

  /**
   * 🔮 Generate Optimistic ID (for optimistic updates)
   * Format: opt_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateOptimisticId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.OPTIMISTIC).id;
  }

  /**
   * ⏱️ Generate Temp ID (for ephemeral/temporary use)
   * Format: tmp_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   *
   * Use this for IDs that don't need persistence but require uniqueness
   */
  generateTempId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.TEMP).id;
  }

  /**
   * 📅 Generate Event ID
   * Format: evt_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateEventId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.EVENT).id;
  }

  /**
   * 📋 Generate Task ID
   * Format: task_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateTaskId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.TASK).id;
  }

  /**
   * 💰 Generate Transaction ID
   * Format: txn_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateTransactionId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.TRANSACTION).id;
  }

  /**
   * 🏷️ Generate Asset ID
   * Format: ast_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  generateAssetId(): string {
    return this.generateId(ENTERPRISE_ID_PREFIXES.ASSET).id;
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Parse enterprise ID και extract components
   */
  parseId(enterpriseId: string): Partial<EnterpriseId> | null {
    const parts = enterpriseId.split('_');
    if (parts.length !== 2) return null;

    const [prefix, uuid] = parts;
    if (!Object.values(ENTERPRISE_ID_PREFIXES).includes(prefix as EnterpriseIdPrefix)) {
      return null;
    }

    return {
      id: enterpriseId,
      prefix: prefix as EnterpriseIdPrefix,
      uuid
    };
  }

  /**
   * Validate enterprise ID format
   */
  validateId(id: string): boolean {
    const parsed = this.parseId(id);
    if (!parsed) return false;

    // UUID v4 validation regex
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(parsed.uuid || '');
  }

  /**
   * Get ID type from prefix
   */
  getIdType(id: string): string | null {
    const parsed = this.parseId(id);
    return parsed?.prefix || null;
  }

  /**
   * Check if ID is legacy format (non-UUID)
   */
  isLegacyId(id: string): boolean {
    return !this.validateId(id);
  }

  /**
   * Get generation statistics
   */
  getStats(): {
    totalGenerated: number;
    cacheSize: number;
    config: IdGenerationConfig;
  } {
    return {
      totalGenerated: this.generatedIds.size,
      cacheSize: this.cache.size,
      config: this.config
    };
  }

  /**
   * Clear internal caches (για testing)
   */
  clearCaches(): void {
    this.generatedIds.clear();
    this.cache.clear();
  }
}

// =============================================================================
// SINGLETON INSTANCE & EXPORTS
// =============================================================================

/**
 * Global enterprise ID service instance
 */
export const enterpriseIdService = new EnterpriseIdService({
  enableLogging: process.env.NODE_ENV === 'development',
  enableCache: true,
  maxRetries: 5
});

// =============================================================================
// CONVENIENCE FUNCTIONS για DIRECT USAGE
// =============================================================================

/**
 * Quick access functions για common ID generation
 *
 * 🏢 ENTERPRISE: Organized by category for easy discovery
 */

// =============================================================================
// CORE BUSINESS ENTITIES
// =============================================================================
export const generateCompanyId = () => enterpriseIdService.generateCompanyId();
export const generateProjectId = () => enterpriseIdService.generateProjectId();
export const generateBuildingId = () => enterpriseIdService.generateBuildingId();
export const generateUnitId = () => enterpriseIdService.generateUnitId();
export const generateStorageId = () => enterpriseIdService.generateStorageId();
export const generateParkingId = () => enterpriseIdService.generateParkingId();
export const generateContactId = () => enterpriseIdService.generateContactId();
export const generateFloorId = () => enterpriseIdService.generateFloorId();
export const generateDocumentId = () => enterpriseIdService.generateDocumentId();
export const generateUserId = () => enterpriseIdService.generateUserId();
export const generateAssetId = () => enterpriseIdService.generateAssetId();
export const generateRelationshipId = () => enterpriseIdService.generateRelationshipId();

// =============================================================================
// LEGAL DOCUMENTS & OBLIGATIONS
// =============================================================================
export const generateSectionId = () => enterpriseIdService.generateSectionId();
export const generateArticleId = () => enterpriseIdService.generateArticleId();
export const generateParagraphId = () => enterpriseIdService.generateParagraphId();
export const generateObligationId = () => enterpriseIdService.generateObligationId();

// =============================================================================
// RUNTIME & EPHEMERAL
// =============================================================================
export const generateSessionId = () => enterpriseIdService.generateSessionId();
export const generateTransactionId = () => enterpriseIdService.generateTransactionId();
export const generateNotificationId = () => enterpriseIdService.generateNotificationId();
export const generateTaskId = () => enterpriseIdService.generateTaskId();
export const generateEventId = () => enterpriseIdService.generateEventId();
export const generateRequestId = () => enterpriseIdService.generateRequestId();
export const generateMessageId = () => enterpriseIdService.generateMessageId();
export const generateJobId = () => enterpriseIdService.generateJobId();

// =============================================================================
// UI & VISUALIZATION
// =============================================================================
export const generateLayerId = () => enterpriseIdService.generateLayerId();
export const generateElementId = () => enterpriseIdService.generateElementId();
export const generateHistoryId = () => enterpriseIdService.generateHistoryId();
export const generateAnnotationId = () => enterpriseIdService.generateAnnotationId();
export const generateControlPointId = () => enterpriseIdService.generateControlPointId();
export const generateEntityId = () => enterpriseIdService.generateEntityId();
export const generateCustomizationId = () => enterpriseIdService.generateCustomizationId();

// =============================================================================
// OBSERVABILITY & MONITORING
// =============================================================================
export const generateErrorId = () => enterpriseIdService.generateErrorId();
export const generateMetricId = () => enterpriseIdService.generateMetricId();
export const generateAlertId = () => enterpriseIdService.generateAlertId();
export const generateTraceId = () => enterpriseIdService.generateTraceId();
export const generateSpanId = () => enterpriseIdService.generateSpanId();
export const generateSearchId = () => enterpriseIdService.generateSearchId();
export const generateAuditId = () => enterpriseIdService.generateAuditId();

// =============================================================================
// DEVOPS & OPERATIONS
// =============================================================================
export const generateDeploymentId = () => enterpriseIdService.generateDeploymentId();
export const generateContainerId = () => enterpriseIdService.generateContainerId();
export const generatePipelineId = () => enterpriseIdService.generatePipelineId();
export const generateBackupId = () => enterpriseIdService.generateBackupId();
export const generateMigrationId = () => enterpriseIdService.generateMigrationId();
export const generateTemplateId = () => enterpriseIdService.generateTemplateId();
export const generateOperationId = () => enterpriseIdService.generateOperationId();

// =============================================================================
// ACCOUNTING (Subapp — ADR-ACC-001 through ADR-ACC-010)
// =============================================================================
export const generateJournalEntryId = () => enterpriseIdService.generateJournalEntryId();
export const generateInvoiceAccId = () => enterpriseIdService.generateInvoiceAccId();
export const generateBankTransactionId = () => enterpriseIdService.generateBankTransactionId();
export const generateFixedAssetId = () => enterpriseIdService.generateFixedAssetId();
export const generateDepreciationId = () => enterpriseIdService.generateDepreciationId();
export const generateEfkaPaymentId = () => enterpriseIdService.generateEfkaPaymentId();
export const generateImportBatchId = () => enterpriseIdService.generateImportBatchId();
export const generateExpenseDocId = () => enterpriseIdService.generateExpenseDocId();

// =============================================================================
// OPTIMISTIC & TEMPORARY
// =============================================================================
export const generateOptimisticId = () => enterpriseIdService.generateOptimisticId();
export const generateTempId = () => enterpriseIdService.generateTempId();

/**
 * Validation και utility functions
 */
export const validateEnterpriseId = (id: string) => enterpriseIdService.validateId(id);
export const parseEnterpriseId = (id: string) => enterpriseIdService.parseId(id);
export const getIdType = (id: string) => enterpriseIdService.getIdType(id);
export const isLegacyId = (id: string) => enterpriseIdService.isLegacyId(id);

// Types already exported inline above

/**
 * Default export for convenience
 */
export default enterpriseIdService;
