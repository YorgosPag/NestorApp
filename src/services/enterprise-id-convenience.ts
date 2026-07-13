/**
 * ENTERPRISE ID — CONVENIENCE EXPORT FUNCTIONS
 * Quick-access named functions for common ID generation.
 * Extracted from enterprise-id.service.ts (ADR-065 SRP split).
 */

import { enterpriseIdService } from './enterprise-id-singleton';

// Core Business Entities
export const generateCompanyId = () => enterpriseIdService.generateCompanyId();
export const generateProjectId = () => enterpriseIdService.generateProjectId();
export const generateBuildingId = () => enterpriseIdService.generateBuildingId();
export const generatePropertyId = () => enterpriseIdService.generatePropertyId();
export const generateStorageId = () => enterpriseIdService.generateStorageId();
export const generateParkingId = () => enterpriseIdService.generateParkingId();
export const generateContactId = () => enterpriseIdService.generateContactId();
export const generateFloorId = () => enterpriseIdService.generateFloorId();
export const generateNavigationId = () => enterpriseIdService.generateNavigationId();
export const generateRouteConfigId = () => enterpriseIdService.generateRouteConfigId();
export const generateDocumentId = () => enterpriseIdService.generateDocumentId();
export const generateUserId = () => enterpriseIdService.generateUserId();
export const generateAssetId = () => enterpriseIdService.generateAssetId();
export const generateRelationshipId = () => enterpriseIdService.generateRelationshipId();
export const generateMemberId = () => enterpriseIdService.generateMemberId();
export const generateWorkspaceId = () => enterpriseIdService.generateWorkspaceId();
export const generateAddressId = () => enterpriseIdService.generateAddressId();
export const generateOpportunityId = () => enterpriseIdService.generateOpportunityId();
export const generateLandownerId = () => enterpriseIdService.generateLandownerId();

// Legal Documents & Obligations
export const generateSectionId = () => enterpriseIdService.generateSectionId();
export const generateArticleId = () => enterpriseIdService.generateArticleId();
export const generateParagraphId = () => enterpriseIdService.generateParagraphId();
export const generateObligationId = () => enterpriseIdService.generateObligationId();
export const generateTransmittalId = () => enterpriseIdService.generateTransmittalId();

// Runtime & Ephemeral
export const generateSessionId = () => enterpriseIdService.generateSessionId();
export const generateTransactionId = () => enterpriseIdService.generateTransactionId();
export const generateNotificationId = () => enterpriseIdService.generateNotificationId();
/** Deterministic notification ID for idempotent writes — same inputs = same doc ID, no duplicates. */
export const generateNotificationDedupeId = (
  eventType: string,
  recipientId: string,
  eventId: string,
): string => `${eventType}:${recipientId}:${eventId}`;
export const generateTaskId = () => enterpriseIdService.generateTaskId();
export const generateEventId = () => enterpriseIdService.generateEventId();
export const generateRequestId = () => enterpriseIdService.generateRequestId();
export const generateMessageId = () => enterpriseIdService.generateMessageId();
export const generateJobId = () => enterpriseIdService.generateJobId();

// DXF / CAD Viewer
export const generateOverlayId = () => enterpriseIdService.generateOverlayId();
export const generateLevelId = () => enterpriseIdService.generateLevelId();
/** ADR-375 Phase B.3 — BIM View Template (drawingScale + viewRange + objectStyles preset). */
export const generateViewTemplateId = () => enterpriseIdService.generateViewTemplateId();

// Floorplan Background System (ADR-340)
export const generateFloorplanBackgroundId = () => enterpriseIdService.generateFloorplanBackgroundId();

// UI & Visualization
export const generateLayerId = () => enterpriseIdService.generateLayerId();
export const generateElementId = () => enterpriseIdService.generateElementId();
export const generateHistoryId = () => enterpriseIdService.generateHistoryId();
export const generateAnnotationId = () => enterpriseIdService.generateAnnotationId();
export const generateControlPointId = () => enterpriseIdService.generateControlPointId();
export const generateEntityId = () => enterpriseIdService.generateEntityId();
export const generateCustomizationId = () => enterpriseIdService.generateCustomizationId();

// Observability & Monitoring
export const generateErrorId = () => enterpriseIdService.generateErrorId();
export const generateMetricId = () => enterpriseIdService.generateMetricId();
export const generateAlertId = () => enterpriseIdService.generateAlertId();
export const generateTraceId = () => enterpriseIdService.generateTraceId();
export const generateSpanId = () => enterpriseIdService.generateSpanId();
export const generateSearchId = () => enterpriseIdService.generateSearchId();
export const generateAuditId = () => enterpriseIdService.generateAuditId();

// DevOps & Operations
export const generateDeploymentId = () => enterpriseIdService.generateDeploymentId();
export const generateContainerId = () => enterpriseIdService.generateContainerId();
export const generatePipelineId = () => enterpriseIdService.generatePipelineId();
export const generateBackupId = () => enterpriseIdService.generateBackupId();
export const generateRestoreId = () => enterpriseIdService.generateRestoreId();
export const generateMigrationId = () => enterpriseIdService.generateMigrationId();
export const generateTemplateId = () => enterpriseIdService.generateTemplateId();
export const generateOperationId = () => enterpriseIdService.generateOperationId();

// BOQ / Quantity Surveying (ADR-175)
export const generateBoqItemId = () => enterpriseIdService.generateBoqItemId();
export const generateBoqCategoryId = () => enterpriseIdService.generateBoqCategoryId();
export const generateBoqPriceListId = () => enterpriseIdService.generateBoqPriceListId();
export const generateBoqTemplateId = () => enterpriseIdService.generateBoqTemplateId();

// Accounting (Subapp — ADR-ACC-001 through ADR-ACC-010)
export const generateJournalEntryId = () => enterpriseIdService.generateJournalEntryId();
export const generateInvoiceAccId = () => enterpriseIdService.generateInvoiceAccId();
export const generateBankTransactionId = () => enterpriseIdService.generateBankTransactionId();
export const generateFixedAssetId = () => enterpriseIdService.generateFixedAssetId();
export const generateDepreciationId = () => enterpriseIdService.generateDepreciationId();
export const generateEfkaPaymentId = () => enterpriseIdService.generateEfkaPaymentId();
export const generateImportBatchId = () => enterpriseIdService.generateImportBatchId();
export const generateMatchGroupId = () => enterpriseIdService.generateMatchGroupId();
export const generateMatchingRuleId = () => enterpriseIdService.generateMatchingRuleId();
export const generateExpenseDocId = () => enterpriseIdService.generateExpenseDocId();
export const generateApyCertificateId = () => enterpriseIdService.generateApyCertificateId();
export const generateServicePresetId = () => enterpriseIdService.generateServicePresetId();
export const generateCustomCategoryId = () => enterpriseIdService.generateCustomCategoryId();
export const generateCustomerBalanceId = () => enterpriseIdService.generateCustomerBalanceId();
export const generateFiscalPeriodId = () => enterpriseIdService.generateFiscalPeriodId();
export const generateAccountingAuditLogId = () => enterpriseIdService.generateAccountingAuditLogId();

// AI Pipeline & Audit
export const generateFeedbackId = () => enterpriseIdService.generateFeedbackId();
export const generatePipelineAuditId = () => enterpriseIdService.generatePipelineAuditId();
export const generateEntityAuditId = () => enterpriseIdService.generateEntityAuditId();
export const generateContractId = () => enterpriseIdService.generateContractId();
export const generatePipelineQueueId = () => enterpriseIdService.generatePipelineQueueId();
export const generateVoiceCommandId = () => enterpriseIdService.generateVoiceCommandId();
export const generateBrokerageId = () => enterpriseIdService.generateBrokerageId();
export const generateCommissionId = () => enterpriseIdService.generateCommissionId();

// Payment Plan & Installments (ADR-234)
export const generatePaymentPlanId = () => enterpriseIdService.generatePaymentPlanId();
export const generatePlanGroupId = () => enterpriseIdService.generatePlanGroupId();
export const generatePaymentRecordId = () => enterpriseIdService.generatePaymentRecordId();
export const generateLoanId = () => enterpriseIdService.generateLoanId();
export const generateChequeId = () => enterpriseIdService.generateChequeId();

// File & Media Operations
export const generatePhotoId = () => enterpriseIdService.generatePhotoId();
export const generateAttachmentId = () => enterpriseIdService.generateAttachmentId();
export const generateFileId = () => enterpriseIdService.generateFileId();
export const generateShareId = () => enterpriseIdService.generateShareId();
export const generateDispatchId = () => enterpriseIdService.generateDispatchId();
export const generatePendingId = () => enterpriseIdService.generatePendingId();
export const generateSubscriptionId = () => enterpriseIdService.generateSubscriptionId();

// Construction & Misc
export const generateMilestoneId = () => enterpriseIdService.generateMilestoneId();
export const generateWebhookId = () => enterpriseIdService.generateWebhookId();
export const generateLearnedPatternId = () => enterpriseIdService.generateLearnedPatternId();
export const generateConstructionPhaseId = () => enterpriseIdService.generateConstructionPhaseId();
export const generateConstructionTaskId = () => enterpriseIdService.generateConstructionTaskId();
export const generateConstructionBaselineId = () => enterpriseIdService.generateConstructionBaselineId();
export const generateConstructionResourceAssignmentId = () => enterpriseIdService.generateConstructionResourceAssignmentId();
export const generateConstructionAlertId = () => enterpriseIdService.generateConstructionAlertId();
export const generateAttendanceQrTokenId = () => enterpriseIdService.generateAttendanceQrTokenId();
export const generateAttendanceEventId = () => enterpriseIdService.generateAttendanceEventId();
export const generateAddressCorrectionLogId = () => enterpriseIdService.generateAddressCorrectionLogId();
export const generateEmploymentRecordId = () => enterpriseIdService.generateEmploymentRecordId();
export const generateAppointmentId = () => enterpriseIdService.generateAppointmentId();
export const generateFolderId = () => enterpriseIdService.generateFolderId();
export const generateCommentId = () => enterpriseIdService.generateCommentId();
export const generateApprovalId = () => enterpriseIdService.generateApprovalId();
export const generateBankAccountId = () => enterpriseIdService.generateBankAccountId();

// Financial Intelligence (SPEC-242C)
export const generateDebtMaturityId = () => enterpriseIdService.generateDebtMaturityId();
export const generateBudgetVarianceId = () => enterpriseIdService.generateBudgetVarianceId();

// AI Deterministic Composite Keys
export const generateQueryStrategyDocId = (collection: string, failedFilters: string[]) =>
  enterpriseIdService.generateQueryStrategyDocId(collection, failedFilters);
export const generateChatHistoryDocId = (channel: string, senderId: string) =>
  enterpriseIdService.generateChatHistoryDocId(channel, senderId);

// Ownership Tables — Deterministic Composite Keys (ADR-235)
export const generateOwnershipTableId = (projectId: string) =>
  enterpriseIdService.generateOwnershipTableId(projectId);
export const generateOwnershipRevisionId = (version: number) =>
  enterpriseIdService.generateOwnershipRevisionId(version);

// UserSettings — Deterministic Composite Key (per-user-per-tenant SSoT)
export const generateUserPreferencesId = (userId: string, companyId: string) =>
  enterpriseIdService.generateUserPreferencesId(userId, companyId);

// Procurement (ADR-267)
export const generatePurchaseOrderId = () => enterpriseIdService.generatePurchaseOrderId();
export const generatePOItemId = () => enterpriseIdService.generatePOItemId();
export const generatePOAttachmentId = () => enterpriseIdService.generatePOAttachmentId();

// Quotes & RFQ (ADR-327)
export const generateQuoteId = () => enterpriseIdService.generateQuoteId();
export const generateRfqId = () => enterpriseIdService.generateRfqId();
export const generateVendorInviteId = () => enterpriseIdService.generateVendorInviteId();
export const generateTradeId = () => enterpriseIdService.generateTradeId();
export const generateVendorLogoFileId = (quoteId: string) =>
  enterpriseIdService.generateVendorLogoFileId(quoteId);

// Multi-Vendor extension (ADR-327 §17 Q28-Q31, 2026-04-29)
export const generateSourcingEventId = () => enterpriseIdService.generateSourcingEventId();
export const generateRfqLineId = () => enterpriseIdService.generateRfqLineId();

// Material Catalog (ADR-330 Phase 4)
export const generateMaterialId = () => enterpriseIdService.generateMaterialId();

// Framework Agreements (ADR-330 Phase 5)
export const generateFrameworkAgreementId = () => enterpriseIdService.generateFrameworkAgreementId();

// Reports & Cash Flow (ADR-268)
export const generateSavedReportId = () => enterpriseIdService.generateSavedReportId();
export const generateRecurringPaymentId = () => enterpriseIdService.generateRecurringPaymentId();

// Org Structure (ADR-326)
export const generateOrgStructureId = () => enterpriseIdService.generateOrgStructureId();
export const generateOrgDepartmentId = () => enterpriseIdService.generateOrgDepartmentId();
export const generateOrgMemberId = () => enterpriseIdService.generateOrgMemberId();

// DXF Text Engine (ADR-344)
export const generateTextTemplateId = () => enterpriseIdService.generateTextTemplateId();
export const generateDrawingRevisionId = () => enterpriseIdService.generateDrawingRevisionId();
/** ADR-651 Φάση Η — idempotent αναθεώρηση: ίδιο (έργο, αποτύπωμα) ⇒ ίδιο doc id ⇒ καμία διπλή εγγραφή. */
export const generateDeterministicDrawingRevisionId = (seed: string) =>
  enterpriseIdService.generateDeterministicDrawingRevisionId(seed);
export const generateCompanyFontId = () => enterpriseIdService.generateCompanyFontId();
export const generateDictEntryId = () => enterpriseIdService.generateDictEntryId();

// DXF Stair Tool (ADR-358)
export const generateStairId = () => enterpriseIdService.generateStairId();
export const generateStairPresetId = () => enterpriseIdService.generateStairPresetId();

// DXF Layer Filters Builder (ADR-358 §5.7.bis Q11 — Phase 11)
export const generateLayerFilterGroupId = () => enterpriseIdService.generateLayerFilterGroupId();
export const generateLayerFilterPropertyId = () => enterpriseIdService.generateLayerFilterPropertyId();

// DXF Layer States Manager (ADR-358 §5.9 Q12 — Phase 12)
export const generateLayerStateId = () => enterpriseIdService.generateLayerStateId();

// DXF Layer State Templates (ADR-358 §5.9 Q12 — Phase 13B)
export const generateLayerStateTemplateId = () => enterpriseIdService.generateLayerStateTemplateId();
export const generateDxfTemplateCategoryId = () => enterpriseIdService.generateDxfTemplateCategoryId();

// DXF Enterprise Dimension System (ADR-362)
export const generateDimensionId = () => enterpriseIdService.generateDimensionId();
export const generateDimStyleId = () => enterpriseIdService.generateDimStyleId();
export const generateLineStyleId = () => enterpriseIdService.generateLineStyleId(); // ADR-570
export const generateCenterMarkId = () => enterpriseIdService.generateCenterMarkId();
export const generateCenterLineId = () => enterpriseIdService.generateCenterLineId();

// DXF 3D BIM Viewer — Performance Diagnostics (ADR-366 §B.5)
export const generatePerformanceDiagnosticId = () => enterpriseIdService.generatePerformanceDiagnosticId();

// DXF 3D BIM Viewer — Render Outputs (ADR-366 §B.4 / Phase 6)
export const generateBimRenderId = () => enterpriseIdService.generateBimRenderId();

// DXF 3D BIM Viewer — User Preferences (ADR-366 Phase 4.3)
export const generateBim3DPrefId = (userId: string) => enterpriseIdService.generateBim3DPrefId(userId);

// DXF 3D BIM Viewer — Manual 3D Dimensions (ADR-366 Phase 9 / C.3)
export const generateBim3DDimensionId = () => enterpriseIdService.generateBim3DDimensionId();

// DXF 3D BIM Viewer — Comments / Markup (ADR-366 Phase 9 / C.2)
export const generateBimCommentId = () => enterpriseIdService.generateBimCommentId();
export const generateBimCommentReplyId = () => enterpriseIdService.generateBimCommentReplyId();

// DXF 3D BIM Viewer — Anonymous Telemetry (ADR-366 §C.7.Q3)
export const generateBimTelemetryId = () => enterpriseIdService.generateBimTelemetryId();

// DXF 3D BIM Viewer — Animations (ADR-366 Phase 9 / C.1.a)
export const generateBimAnimationId = () => enterpriseIdService.generateBimAnimationId();
export const generateBimRenderJobId = () => enterpriseIdService.generateBimRenderJobId();

// DXF 3D BIM Viewer — Custom HDRI Environments (ADR-366 Group B)
export const generateBimEnvironmentId = () => enterpriseIdService.generateBimEnvironmentId();

// ISO 19650 Cost Log (ADR-373 P2.5)
export const generateIso19650CostLogId = () => enterpriseIdService.generateIso19650CostLogId();

// DXF BIM Drawing Mode (ADR-363)
export const generateWallId = () => enterpriseIdService.generateWallId();
export const generateOpeningId = () => enterpriseIdService.generateOpeningId();
export const generateSlabId = () => enterpriseIdService.generateSlabId();
export const generateRoofId = () => enterpriseIdService.generateRoofId();
export const generateFloorFinishId = () => enterpriseIdService.generateFloorFinishId();
export const generateWallCoveringId = () => enterpriseIdService.generateWallCoveringId();
export const generateHatchId = () => enterpriseIdService.generateHatchId();
export const generateThermalSpaceId = () => enterpriseIdService.generateThermalSpaceId();
export const generateSpaceSeparatorId = () => enterpriseIdService.generateSpaceSeparatorId();
export const generateSlabOpeningId = () => enterpriseIdService.generateSlabOpeningId();
// ADR-632 Φ5 — deterministic slab-opening id (σταθερό ανά seed· auto stairwell opening).
export const generateDeterministicSlabOpeningId = (seed: string) =>
  enterpriseIdService.generateDeterministicSlabOpeningId(seed);
export const generateBimStackGroupId = () => enterpriseIdService.generateBimStackGroupId();
export const generateColumnId = () => enterpriseIdService.generateColumnId();
export const generateBeamId = () => enterpriseIdService.generateBeamId();
export const generateFoundationId = () => enterpriseIdService.generateFoundationId();
export const generateGridGuideDocId = () => enterpriseIdService.generateGridGuideDocId();
export const generateMepFixtureId = () => enterpriseIdService.generateMepFixtureId();
export const generateMepSystemId = () => enterpriseIdService.generateMepSystemId();
export const generateElectricalPanelId = () => enterpriseIdService.generateElectricalPanelId();
export const generateMepSegmentId = () => enterpriseIdService.generateMepSegmentId();
export const generateMepFittingId = () => enterpriseIdService.generateMepFittingId();
export const generateMepManifoldId = () => enterpriseIdService.generateMepManifoldId();
export const generateMepRadiatorId = () => enterpriseIdService.generateMepRadiatorId();
export const generateMepBoilerId = () => enterpriseIdService.generateMepBoilerId();
export const generateMepWaterHeaterId = () => enterpriseIdService.generateMepWaterHeaterId();
export const generateMepUnderfloorId = () => enterpriseIdService.generateMepUnderfloorId();
export const generateRailingId = () => enterpriseIdService.generateRailingId();
export const generateFurnitureId = () => enterpriseIdService.generateFurnitureId();
export const generateFloorplanSymbolId = () => enterpriseIdService.generateFloorplanSymbolId();
export const generateBimPresetId = () => enterpriseIdService.generateBimPresetId();
export const generateBimMaterialId = () => enterpriseIdService.generateBimMaterialId();
export const generateBlockLibraryItemId = () => enterpriseIdService.generateBlockLibraryItemId();
export const generateBimSettingsId = () => enterpriseIdService.generateBimSettingsId();
export const generateBimFamilyTypeId = () => enterpriseIdService.generateBimFamilyTypeId();

// Optimistic & Temporary
export const generateOptimisticId = () => enterpriseIdService.generateOptimisticId();
export const generateTempId = () => enterpriseIdService.generateTempId();

// IFC4 GlobalId (ADR-369 §9 Q8) — 22-char compressed UUID για BIM entities
export { generateIfcGuid, encodeIfcGuidFromBytes, IFC_GUID_ALPHABET } from './ifc-guid.service';

// Opaque tokens (Firebase download tokens, nonces, etc) — see CLAUDE.md N.6
export const generateOpaqueToken = () => enterpriseIdService.generateOpaqueToken();

// Validation & Utility
export const validateEnterpriseId = (id: string) => enterpriseIdService.validateId(id);
export const parseEnterpriseId = (id: string) => enterpriseIdService.parseId(id);
export const getIdType = (id: string) => enterpriseIdService.getIdType(id);
export const isLegacyId = (id: string) => enterpriseIdService.isLegacyId(id);
