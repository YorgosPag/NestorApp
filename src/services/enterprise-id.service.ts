/**
 * ENTERPRISE ID GENERATION SERVICE
 * Cryptographically secure, collision-resistant ID generation.
 * Split per ADR-065 SRP pattern: prefixes → enterprise-id-prefixes.ts,
 * convenience exports → enterprise-id-convenience.ts.
 *
 * @version 2.0.0
 */

// Re-export prefixes, types, and convenience functions for consumer compatibility
export {
  ENTERPRISE_ID_PREFIXES,
  type EnterpriseIdPrefix,
  type EnterpriseId,
  type IdGenerationConfig,
} from './enterprise-id-prefixes';

export {
  generateCompanyId, generateProjectId, generateBuildingId, generatePropertyId,
  generateStorageId, generateParkingId, generateContactId, generateFloorId,
  generateNavigationId, generateRouteConfigId, generateDocumentId, generateUserId,
  generateAssetId, generateRelationshipId, generateMemberId, generateWorkspaceId,
  generateAddressId, generateOpportunityId, generateLandownerId,
  generateSectionId, generateArticleId, generateParagraphId, generateObligationId,
  generateTransmittalId, generateSessionId, generateTransactionId,
  generateNotificationId, generateTaskId, generateEventId, generateRequestId,
  generateMessageId, generateJobId, generateOverlayId, generateLevelId,
  generateLayerId, generateElementId, generateHistoryId, generateAnnotationId,
  generateControlPointId, generateEntityId, generateCustomizationId,
  generateErrorId, generateMetricId, generateAlertId, generateTraceId,
  generateSpanId, generateSearchId, generateAuditId, generateDeploymentId,
  generateContainerId, generatePipelineId, generateBackupId, generateMigrationId,
  generateTemplateId, generateOperationId, generateBoqItemId, generateBoqCategoryId,
  generateBoqPriceListId, generateBoqTemplateId, generateJournalEntryId,
  generateInvoiceAccId, generateBankTransactionId, generateFixedAssetId,
  generateDepreciationId, generateEfkaPaymentId, generateImportBatchId,
  generateMatchGroupId, generateMatchingRuleId, generateExpenseDocId,
  generateApyCertificateId, generateCustomCategoryId, generateCustomerBalanceId,
  generateFiscalPeriodId, generateAccountingAuditLogId, generateFeedbackId,
  generatePipelineAuditId, generateEntityAuditId, generateContractId,
  generatePipelineQueueId, generateVoiceCommandId, generateBrokerageId,
  generateCommissionId, generatePaymentPlanId, generatePlanGroupId,
  generatePaymentRecordId, generateLoanId, generateChequeId, generatePhotoId,
  generateAttachmentId, generateFileId, generateShareId, generatePendingId,
  generateSubscriptionId, generateMilestoneId, generateWebhookId,
  generateLearnedPatternId, generateConstructionPhaseId, generateConstructionTaskId,
  generateConstructionBaselineId, generateConstructionResourceAssignmentId,
  generateAttendanceQrTokenId, generateAttendanceEventId,
  generateEmploymentRecordId, generateAppointmentId, generateFolderId,
  generateCommentId, generateApprovalId, generateBankAccountId,
  generateDebtMaturityId, generateBudgetVarianceId, generateQueryStrategyDocId,
  generateChatHistoryDocId, generatePurchaseOrderId, generatePOItemId,
  generatePOAttachmentId, generateSavedReportId, generateRecurringPaymentId,
  generateOptimisticId, generateTempId, validateEnterpriseId, parseEnterpriseId,
  getIdType, isLegacyId,
} from './enterprise-id-convenience';

import {
  ENTERPRISE_ID_PREFIXES,
  type EnterpriseIdPrefix,
  type EnterpriseId,
  type IdGenerationConfig,
} from './enterprise-id-prefixes';

// Alias for compact generator methods
const P = ENTERPRISE_ID_PREFIXES;

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
      ...config,
    };
  }

  // --- Core Engine ---

  private generateSecureUuid(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    array[6] = (array[6] & 0x0f) | 0x40;
    array[8] = (array[8] & 0x3f) | 0x80;

    const hex = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }

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

    this.generatedIds.add(id);

    if (this.config.enableCache && this.cache.size >= this.config.cacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    const enterpriseId: EnterpriseId = { id, prefix, uuid, timestamp: Date.now() };

    if (this.config.enableCache) this.cache.set(id, enterpriseId);
    if (this.config.enableLogging) console.debug(`Generated enterprise ID: ${id} (attempts: ${attempts})`);

    return enterpriseId;
  }

  // --- Entity-Specific Generators ---

  // Core Business Entities
  generateCompanyId(): string { return this.generateId(P.COMPANY).id; }
  generateProjectId(): string { return this.generateId(P.PROJECT).id; }
  generateBuildingId(): string { return this.generateId(P.BUILDING).id; }
  generatePropertyId(): string { return this.generateId(P.PROPERTY).id; }
  generateStorageId(): string { return this.generateId(P.STORAGE).id; }
  generateParkingId(): string { return this.generateId(P.PARKING).id; }
  generateContactId(): string { return this.generateId(P.CONTACT).id; }
  generateFloorId(): string { return this.generateId(P.FLOOR).id; }
  generateNavigationId(): string { return this.generateId(P.NAVIGATION).id; }
  generateRouteConfigId(): string { return this.generateId(P.ROUTE_CONFIG).id; }
  generateDocumentId(): string { return this.generateId(P.DOCUMENT).id; }
  generateUserId(): string { return this.generateId(P.USER).id; }
  generateAssetId(): string { return this.generateId(P.ASSET).id; }
  generateRelationshipId(): string { return this.generateId(P.RELATIONSHIP).id; }
  generateMemberId(): string { return this.generateId(P.MEMBER).id; }
  generateWorkspaceId(): string { return this.generateId(P.WORKSPACE).id; }
  generateAddressId(): string { return this.generateId(P.ADDRESS).id; }
  generateOpportunityId(): string { return this.generateId(P.OPPORTUNITY).id; }
  generateLandownerId(): string { return this.generateId(P.LANDOWNER).id; }

  // Legal Documents & Obligations
  generateSectionId(): string { return this.generateId(P.SECTION).id; }
  generateArticleId(): string { return this.generateId(P.ARTICLE).id; }
  generateParagraphId(): string { return this.generateId(P.PARAGRAPH).id; }
  generateObligationId(): string { return this.generateId(P.OBLIGATION).id; }
  generateTransmittalId(): string { return this.generateId(P.TRANSMITTAL).id; }

  // Runtime & Ephemeral
  generateSessionId(): string { return this.generateId(P.SESSION).id; }
  generateTransactionId(): string { return this.generateId(P.TRANSACTION).id; }
  generateNotificationId(): string { return this.generateId(P.NOTIFICATION).id; }
  generateTaskId(): string { return this.generateId(P.TASK).id; }
  generateEventId(): string { return this.generateId(P.EVENT).id; }
  generateRequestId(): string { return this.generateId(P.REQUEST).id; }
  generateMessageId(): string { return this.generateId(P.MESSAGE).id; }
  generateJobId(): string { return this.generateId(P.JOB).id; }

  // DXF / CAD Viewer
  generateOverlayId(): string { return this.generateId(P.OVERLAY).id; }
  generateLevelId(): string { return this.generateId(P.LEVEL).id; }

  // UI & Visualization
  generateLayerId(): string { return this.generateId(P.LAYER).id; }
  generateElementId(): string { return this.generateId(P.ELEMENT).id; }
  generateHistoryId(): string { return this.generateId(P.HISTORY).id; }
  generateAnnotationId(): string { return this.generateId(P.ANNOTATION).id; }
  generateControlPointId(): string { return this.generateId(P.CONTROL_POINT).id; }
  generateEntityId(): string { return this.generateId(P.ENTITY).id; }
  generateCustomizationId(): string { return this.generateId(P.CUSTOMIZATION).id; }

  // Observability & Monitoring
  generateErrorId(): string { return this.generateId(P.ERROR).id; }
  generateMetricId(): string { return this.generateId(P.METRIC).id; }
  generateAlertId(): string { return this.generateId(P.ALERT).id; }
  generateTraceId(): string { return this.generateId(P.TRACE).id; }
  generateSpanId(): string { return this.generateId(P.SPAN).id; }
  generateSearchId(): string { return this.generateId(P.SEARCH).id; }
  generateAuditId(): string { return this.generateId(P.AUDIT).id; }

  // DevOps & Operations
  generateDeploymentId(): string { return this.generateId(P.DEPLOYMENT).id; }
  generateContainerId(): string { return this.generateId(P.CONTAINER).id; }
  generatePipelineId(): string { return this.generateId(P.PIPELINE).id; }
  generateBackupId(): string { return this.generateId(P.BACKUP).id; }
  generateMigrationId(): string { return this.generateId(P.MIGRATION).id; }
  generateTemplateId(): string { return this.generateId(P.TEMPLATE).id; }
  generateOperationId(): string { return this.generateId(P.OPERATION).id; }

  // BOQ (ADR-175)
  generateBoqItemId(): string { return this.generateId(P.BOQ_ITEM).id; }
  generateBoqCategoryId(): string { return this.generateId(P.BOQ_CATEGORY).id; }
  generateBoqPriceListId(): string { return this.generateId(P.BOQ_PRICE_LIST).id; }
  generateBoqTemplateId(): string { return this.generateId(P.BOQ_TEMPLATE).id; }

  // Accounting (ADR-ACC)
  generateJournalEntryId(): string { return this.generateId(P.JOURNAL_ENTRY).id; }
  generateInvoiceAccId(): string { return this.generateId(P.INVOICE_ACC).id; }
  generateBankTransactionId(): string { return this.generateId(P.BANK_TRANSACTION).id; }
  generateApyCertificateId(): string { return this.generateId(P.APY_CERTIFICATE).id; }
  generateCustomCategoryId(): string { return this.generateId(P.CUSTOM_CATEGORY).id; }
  generateCustomerBalanceId(): string { return this.generateId(P.CUSTOMER_BALANCE).id; }
  generateFiscalPeriodId(): string { return this.generateId(P.FISCAL_PERIOD).id; }
  generateAccountingAuditLogId(): string { return this.generateId(P.ACCOUNTING_AUDIT_LOG).id; }
  generateFixedAssetId(): string { return this.generateId(P.FIXED_ASSET).id; }
  generateDepreciationId(): string { return this.generateId(P.DEPRECIATION).id; }
  generateEfkaPaymentId(): string { return this.generateId(P.EFKA_PAYMENT).id; }
  generateImportBatchId(): string { return this.generateId(P.IMPORT_BATCH).id; }
  generateMatchGroupId(): string { return this.generateId(P.MATCH_GROUP).id; }
  generateMatchingRuleId(): string { return this.generateId(P.MATCHING_RULE).id; }
  generateExpenseDocId(): string { return this.generateId(P.EXPENSE_DOC).id; }
  generateChequeId(): string { return this.generateId(P.CHEQUE).id; }

  // Construction & Building
  generateMilestoneId(): string { return this.generateId(P.MILESTONE).id; }
  generateConstructionPhaseId(): string { return this.generateId(P.CONSTRUCTION_PHASE).id; }
  generateConstructionTaskId(): string { return this.generateId(P.CONSTRUCTION_TASK).id; }
  generateConstructionBaselineId(): string { return this.generateId(P.CONSTRUCTION_BASELINE).id; }
  generateConstructionResourceAssignmentId(): string { return this.generateId(P.CONSTRUCTION_RESOURCE_ASSIGNMENT).id; }

  // Attendance (ADR-170)
  generateAttendanceQrTokenId(): string { return this.generateId(P.ATTENDANCE_QR_TOKEN).id; }
  generateAttendanceEventId(): string { return this.generateId(P.ATTENDANCE_EVENT).id; }

  // HR & Employment
  generateEmploymentRecordId(): string { return this.generateId(P.EMPLOYMENT_RECORD).id; }
  generateAppointmentId(): string { return this.generateId(P.APPOINTMENT).id; }

  // Integrations & AI
  generateWebhookId(): string { return this.generateId(P.WEBHOOK).id; }
  generateLearnedPatternId(): string { return this.generateId(P.LEARNED_PATTERN).id; }
  generateVoiceCommandId(): string { return this.generateId(P.VOICE_COMMAND).id; }

  // File & Media
  generatePhotoId(): string { return this.generateId(P.PHOTO).id; }
  generateAttachmentId(): string { return this.generateId(P.ATTACHMENT).id; }
  generateFileId(): string { return this.generateId(P.FILE).id; }
  generateShareId(): string { return this.generateId(P.SHARE).id; }
  generatePendingId(): string { return this.generateId(P.PENDING).id; }
  generateSubscriptionId(): string { return this.generateId(P.SUBSCRIPTION).id; }
  generateFolderId(): string { return this.generateId(P.FOLDER).id; }
  generateCommentId(): string { return this.generateId(P.COMMENT).id; }
  generateApprovalId(): string { return this.generateId(P.APPROVAL).id; }
  generateBankAccountId(): string { return this.generateId(P.BANK_ACCOUNT).id; }
  generateOptimisticId(): string { return this.generateId(P.OPTIMISTIC).id; }
  generateTempId(): string { return this.generateId(P.TEMP).id; }

  // AI Pipeline & Audit
  generateFeedbackId(): string { return this.generateId(P.FEEDBACK).id; }
  generatePipelineAuditId(): string { return this.generateId(P.PIPELINE_AUDIT).id; }
  generateEntityAuditId(): string { return this.generateId(P.ENTITY_AUDIT).id; }
  generateContractId(): string { return this.generateId(P.CONTRACT).id; }
  generatePipelineQueueId(): string { return this.generateId(P.PIPELINE_QUEUE).id; }
  generateBrokerageId(): string { return this.generateId(P.BROKERAGE).id; }
  generateCommissionId(): string { return this.generateId(P.COMMISSION).id; }

  // Payment & Financial
  generatePaymentPlanId(): string { return this.generateId(P.PAYMENT_PLAN).id; }
  generatePlanGroupId(): string { return this.generateId(P.PLAN_GROUP).id; }
  generatePaymentRecordId(): string { return this.generateId(P.PAYMENT_RECORD).id; }
  generateLoanId(): string { return this.generateId(P.LOAN).id; }
  generateDebtMaturityId(): string { return this.generateId(P.DEBT_MATURITY).id; }
  generateBudgetVarianceId(): string { return this.generateId(P.BUDGET_VARIANCE).id; }

  // Procurement (ADR-267)
  generatePurchaseOrderId(): string { return this.generateId(P.PURCHASE_ORDER).id; }
  generatePOItemId(): string { return this.generateId(P.PO_ITEM).id; }
  generatePOAttachmentId(): string { return this.generateId(P.PO_ATTACHMENT).id; }

  // Reports & Cash Flow (ADR-268)
  generateSavedReportId(): string { return this.generateId(P.SAVED_REPORT).id; }
  generateRecurringPaymentId(): string { return this.generateId(P.RECURRING_PAYMENT).id; }

  // --- Deterministic Composite Key Generators ---

  generateAiUsageDocId(channel: string, userId: string, month: string): string {
    return `${P.AI_USAGE}_${channel}_${userId}_${month}`;
  }

  generateQueryStrategyDocId(collection: string, failedFilters: string[]): string {
    const filterKey = [...failedFilters].sort().join('_');
    return `${P.QUERY_STRATEGY}_${collection}_${filterKey}`;
  }

  generateChatHistoryDocId(channel: string, senderId: string): string {
    return `${P.AI_CHAT_HISTORY}_${channel}_${senderId}`;
  }

  // --- Utility Methods ---

  parseId(enterpriseId: string): Partial<EnterpriseId> | null {
    const parts = enterpriseId.split('_');
    if (parts.length !== 2) return null;

    const [prefix, uuid] = parts;
    if (!Object.values(ENTERPRISE_ID_PREFIXES).includes(prefix as EnterpriseIdPrefix)) {
      return null;
    }

    return { id: enterpriseId, prefix: prefix as EnterpriseIdPrefix, uuid };
  }

  validateId(id: string): boolean {
    const parsed = this.parseId(id);
    if (!parsed) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(parsed.uuid || '');
  }

  getIdType(id: string): string | null {
    const parsed = this.parseId(id);
    return parsed?.prefix || null;
  }

  isLegacyId(id: string): boolean {
    return !this.validateId(id);
  }

  getStats(): { totalGenerated: number; cacheSize: number; config: IdGenerationConfig } {
    return {
      totalGenerated: this.generatedIds.size,
      cacheSize: this.cache.size,
      config: this.config,
    };
  }

  clearCaches(): void {
    this.generatedIds.clear();
    this.cache.clear();
  }
}

// Singleton instance
export const enterpriseIdService = new EnterpriseIdService({
  enableLogging: process.env.NODE_ENV === 'development',
  enableCache: true,
  maxRetries: 5,
});

export default enterpriseIdService;
