/**
 * ENTERPRISE ID GENERATION SERVICE — PUBLIC FACADE
 *
 * Cryptographically secure, collision-resistant ID generation. This file is a
 * pure re-export facade over the SRP-split internal modules:
 *
 *   - `./enterprise-id-prefixes`  — prefix constants + types (leaf module)
 *   - `./enterprise-id-class`     — `EnterpriseIdService` class definition
 *   - `./enterprise-id-singleton` — canonical `enterpriseIdService` instance
 *   - `./enterprise-id-convenience` — quick-access named generator functions
 *
 * 2026-05-06 cycle-break:
 *   The previous shape co-located the class, the singleton, AND a re-export
 *   of `./enterprise-id-convenience` in this single file. Because convenience
 *   imports the singleton from here, webpack saw a tight cycle that
 *   sometimes evaluated `const P = ENTERPRISE_ID_PREFIXES` after a generator
 *   method tried to read `P` — surfacing as a runtime
 *   `Cannot access 'P' before initialization` TDZ on `/contacts`.
 *   Class + singleton now live in dedicated leaf modules, so this facade no
 *   longer participates in any cycle. Public API is unchanged.
 *
 * @module services/enterprise-id.service
 * @version 2.1.0 (2026-05-06 cycle-break)
 */

export {
  ENTERPRISE_ID_PREFIXES,
  type EnterpriseIdPrefix,
  type EnterpriseId,
  type IdGenerationConfig,
} from './enterprise-id-prefixes';

export { EnterpriseIdService } from './enterprise-id-class';

export { enterpriseIdService } from './enterprise-id-singleton';

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
  generateContainerId, generatePipelineId, generateBackupId, generateRestoreId, generateMigrationId,
  generateTemplateId, generateOperationId, generateBoqItemId, generateBoqCategoryId,
  generateBoqPriceListId, generateBoqTemplateId, generateJournalEntryId,
  generateInvoiceAccId, generateBankTransactionId, generateFixedAssetId,
  generateDepreciationId, generateEfkaPaymentId, generateImportBatchId,
  generateMatchGroupId, generateMatchingRuleId, generateExpenseDocId,
  generateApyCertificateId, generateServicePresetId, generateCustomCategoryId, generateCustomerBalanceId,
  generateFiscalPeriodId, generateAccountingAuditLogId, generateFeedbackId,
  generatePipelineAuditId, generateEntityAuditId, generateContractId,
  generatePipelineQueueId, generateVoiceCommandId, generateBrokerageId,
  generateCommissionId, generatePaymentPlanId, generatePlanGroupId,
  generatePaymentRecordId, generateLoanId, generateChequeId, generatePhotoId,
  generateAttachmentId, generateFileId, generateShareId, generateDispatchId, generatePendingId,
  generateSubscriptionId, generateMilestoneId, generateWebhookId,
  generateLearnedPatternId, generateConstructionPhaseId, generateConstructionTaskId,
  generateConstructionBaselineId, generateConstructionResourceAssignmentId,
  generateAttendanceQrTokenId, generateAttendanceEventId,
  generateAddressCorrectionLogId,
  generateEmploymentRecordId, generateAppointmentId,
  generateOrgStructureId, generateOrgDepartmentId, generateOrgMemberId,
  generateFloorplanBackgroundId,
  generateFolderId,
  generateCommentId, generateApprovalId, generateBankAccountId,
  generateDebtMaturityId, generateBudgetVarianceId, generateQueryStrategyDocId,
  generateChatHistoryDocId, generateOwnershipTableId, generateOwnershipRevisionId,
  generateUserPreferencesId,
  generatePurchaseOrderId, generatePOItemId,
  generatePOAttachmentId, generateSavedReportId, generateRecurringPaymentId,
  generateQuoteId, generateRfqId, generateVendorInviteId, generateTradeId,
  generateVendorLogoFileId,
  generateSourcingEventId, generateRfqLineId,
  generateMaterialId,
  generateFrameworkAgreementId,
  generateOptimisticId, generateTempId, generateOpaqueToken, validateEnterpriseId, parseEnterpriseId,
  getIdType, isLegacyId, generateNotificationDedupeId,
} from './enterprise-id-convenience';

import { enterpriseIdService } from './enterprise-id-singleton';

export default enterpriseIdService;
