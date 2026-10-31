/**
 * ENTERPRISE ID — οι συναρτήσεις ευκολίας του **καταλόγου προμηθευτή** (ADR-923 §5.9 · §5.10 · §5.11).
 * Χωριστό αρχείο (N.7.1: το `enterprise-id-convenience.ts` έφτασε τις 494 γραμμές) — το κοινό αρχείο
 * τις **επανεξάγει**, ώστε κάθε υπάρχων εισαγωγέας να μένει ως έχει.
 * @module services/enterprise-id-convenience-catalog
 */

import { enterpriseIdService } from './enterprise-id-singleton';

// Σχήμα (ADR-923 §5.9): ντετερμινιστικά από (χώρος, κωδικός)
export const generateDeterministicCatalogAttributeId = (companyId: string, code: string) =>
  enterpriseIdService.generateDeterministicCatalogAttributeId(companyId, code);
export const generateDeterministicCatalogAttributeGroupId = (companyId: string, code: string) =>
  enterpriseIdService.generateDeterministicCatalogAttributeGroupId(companyId, code);
export const generateDeterministicCatalogMeasurementFamilyId = (companyId: string, code: string) =>
  enterpriseIdService.generateDeterministicCatalogMeasurementFamilyId(companyId, code);
export const generateDeterministicCatalogCategoryId = (companyId: string, code: string) =>
  enterpriseIdService.generateDeterministicCatalogCategoryId(companyId, code);
export const generateDeterministicCatalogFamilyId = (companyId: string, code: string) =>
  enterpriseIdService.generateDeterministicCatalogFamilyId(companyId, code);

// Δεδομένα (ADR-923 §5.10)
export const generateDeterministicCatalogProductModelId = (companyId: string, code: string) =>
  enterpriseIdService.generateDeterministicCatalogProductModelId(companyId, code);
export const generateCatalogProductId = () => enterpriseIdService.generateCatalogProductId();
export const generateDeterministicCatalogAssetId = (companyId: string, code: string) =>
  enterpriseIdService.generateDeterministicCatalogAssetId(companyId, code);
export const generateDeterministicCatalogSettingsId = (companyId: string) =>
  enterpriseIdService.generateDeterministicCatalogSettingsId(companyId);
export const generateDeterministicCatalogUniqueValueId = (companyId: string, attributeId: string, uniqueKey: string) =>
  enterpriseIdService.generateDeterministicCatalogUniqueValueId(companyId, attributeId, uniqueKey);

// Τιμοκατάλογοι (ADR-923 §5.11): ντετερμινιστικά από κωδικό ή φυσικό κλειδί· η συνθήκη τυχαία
export const generateDeterministicCatalogPriceListId = (companyId: string, code: string) =>
  enterpriseIdService.generateDeterministicCatalogPriceListId(companyId, code);
export const generateDeterministicCatalogPriceListVersionId = (companyId: string, versionKey: string) =>
  enterpriseIdService.generateDeterministicCatalogPriceListVersionId(companyId, versionKey);
export const generateDeterministicCatalogPriceListLineId = (companyId: string, lineKey: string) =>
  enterpriseIdService.generateDeterministicCatalogPriceListLineId(companyId, lineKey);
export const generateDeterministicCatalogDiscountGroupId = (companyId: string, code: string) =>
  enterpriseIdService.generateDeterministicCatalogDiscountGroupId(companyId, code);
export const generateDeterministicCatalogCustomerGroupId = (companyId: string, code: string) =>
  enterpriseIdService.generateDeterministicCatalogCustomerGroupId(companyId, code);
export const generateDeterministicCatalogCustomerAssignmentId = (companyId: string, partyKey: string) =>
  enterpriseIdService.generateDeterministicCatalogCustomerAssignmentId(companyId, partyKey);
export const generateDeterministicCatalogPublicationRecipeId = (companyId: string, code: string) =>
  enterpriseIdService.generateDeterministicCatalogPublicationRecipeId(companyId, code);
export const generateDeterministicCatalogPublicationRunId = (companyId: string, inputHash: string) =>
  enterpriseIdService.generateDeterministicCatalogPublicationRunId(companyId, inputHash);
export const generateCatalogDiscountConditionId = () => enterpriseIdService.generateCatalogDiscountConditionId();
export const generateDeterministicCatalogPricingSlotId = (companyId: string, slotKey: string) =>
  enterpriseIdService.generateDeterministicCatalogPricingSlotId(companyId, slotKey);
export const generateDeterministicCatalogPricingViewSignalId = (companyId: string, viewKey: string) =>
  enterpriseIdService.generateDeterministicCatalogPricingViewSignalId(companyId, viewKey);

// Εισαγωγή (ADR-923 §5.5.1): ντετερμινιστικά από φυσικό κλειδί
export const generateDeterministicCatalogImportProfileId = (companyId: string, code: string) =>
  enterpriseIdService.generateDeterministicCatalogImportProfileId(companyId, code);
export const generateDeterministicCatalogImportBatchId = (companyId: string, batchKey: string) =>
  enterpriseIdService.generateDeterministicCatalogImportBatchId(companyId, batchKey);
export const generateDeterministicCatalogImportProposalId = (companyId: string, proposalKey: string) =>
  enterpriseIdService.generateDeterministicCatalogImportProposalId(companyId, proposalKey);
