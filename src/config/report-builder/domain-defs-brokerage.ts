/**
 * @module config/report-builder/domain-defs-brokerage
 * @enterprise ADR-268 Phase 5 — Brokerage Domain Definitions
 *
 * C5: Brokerage Agreements (top-level collection)
 * C6: Commission Records (top-level collection)
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { DomainDefinition } from './report-builder-types';

// ============================================================================
// Enum Constants (SSoT)
// ============================================================================

// --- C5: Brokerage Agreements ---
const BROKERAGE_SCOPES = ['project', 'property'] as const;
const EXCLUSIVITY_TYPES = ['exclusive', 'non_exclusive', 'semi_exclusive'] as const;
const COMMISSION_TYPES = ['percentage', 'fixed', 'tiered'] as const;
const BROKERAGE_STATUSES = ['active', 'expired', 'terminated'] as const;

// --- C6: Commission Records ---
const COMMISSION_PAYMENT_STATUSES = ['pending', 'paid', 'cancelled'] as const;

// ============================================================================
// C5: Brokerage Agreements
// ============================================================================

export const BROKERAGE_DEFINITION: DomainDefinition = {
  id: 'brokerageAgreements',
  collection: COLLECTIONS.BROKERAGE_AGREEMENTS,
  group: 'financial',
  // eslint-disable-next-line custom/no-hardcoded-strings
  labelKey: 'domains.brokerageAgreements.label',
  descriptionKey: 'domains.brokerageAgreements.description',
  // eslint-disable-next-line custom/no-hardcoded-strings
  entityLinkPath: '/brokerage/{id}',
  defaultSortField: 'startDate',
  defaultSortDirection: 'desc',
  fields: [
    // Identity
    { key: 'agentName', labelKey: 'domains.brokerageAgreements.fields.agentName', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'scope', labelKey: 'domains.brokerageAgreements.fields.scope', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: BROKERAGE_SCOPES, enumLabelPrefix: 'domains.brokerageAgreements.enums.scope' },
    { key: 'exclusivity', labelKey: 'domains.brokerageAgreements.fields.exclusivity', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: EXCLUSIVITY_TYPES, enumLabelPrefix: 'domains.brokerageAgreements.enums.exclusivity' },
    { key: 'status', labelKey: 'domains.brokerageAgreements.fields.status', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: BROKERAGE_STATUSES, enumLabelPrefix: 'domains.brokerageAgreements.enums.status' },
    // Commission
    { key: 'commissionType', labelKey: 'domains.brokerageAgreements.fields.commissionType', type: 'enum', filterable: true, sortable: false, defaultVisible: true, enumValues: COMMISSION_TYPES, enumLabelPrefix: 'domains.brokerageAgreements.enums.commissionType' },
    { key: 'commissionPercentage', labelKey: 'domains.brokerageAgreements.fields.commissionPercentage', type: 'percentage', filterable: true, sortable: true, defaultVisible: true, format: 'percentage' },
    { key: 'commissionFixedAmount', labelKey: 'domains.brokerageAgreements.fields.commissionFixedAmount', type: 'currency', filterable: true, sortable: true, defaultVisible: false, format: 'currency' },
    // Dates
    { key: 'startDate', labelKey: 'domains.brokerageAgreements.fields.startDate', type: 'date', filterable: true, sortable: true, defaultVisible: true, format: 'date' },
    { key: 'endDate', labelKey: 'domains.brokerageAgreements.fields.endDate', type: 'date', filterable: true, sortable: true, defaultVisible: true, format: 'date' },
    // Refs
    { key: 'agentContactId', labelKey: 'domains.brokerageAgreements.fields.agent', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'agents', refDisplayField: 'firstName' },
    { key: 'projectId', labelKey: 'domains.brokerageAgreements.fields.project', type: 'text', filterable: true, sortable: false, defaultVisible: true, refDomain: 'projects', refDisplayField: 'name' },
    { key: 'propertyId', labelKey: 'domains.brokerageAgreements.fields.property', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'properties', refDisplayField: 'name' },
    // Audit
    { key: 'createdAt', labelKey: 'domains.brokerageAgreements.fields.createdAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    { key: 'updatedAt', labelKey: 'domains.brokerageAgreements.fields.updatedAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
  ],
};

// ============================================================================
// C6: Commission Records
// ============================================================================

export const COMMISSIONS_DEFINITION: DomainDefinition = {
  id: 'commissionRecords',
  collection: COLLECTIONS.COMMISSION_RECORDS,
  group: 'financial',
  // eslint-disable-next-line custom/no-hardcoded-strings
  labelKey: 'domains.commissionRecords.label',
  descriptionKey: 'domains.commissionRecords.description',
  // eslint-disable-next-line custom/no-hardcoded-strings
  entityLinkPath: '/brokerage/{brokerageAgreementId}',
  defaultSortField: 'createdAt',
  defaultSortDirection: 'desc',
  fields: [
    // Identity
    { key: 'agentName', labelKey: 'domains.commissionRecords.fields.agentName', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    // Financial
    { key: 'salePrice', labelKey: 'domains.commissionRecords.fields.salePrice', type: 'currency', filterable: true, sortable: true, defaultVisible: true, format: 'currency' },
    { key: 'commissionAmount', labelKey: 'domains.commissionRecords.fields.commissionAmount', type: 'currency', filterable: true, sortable: true, defaultVisible: true, format: 'currency' },
    { key: 'commissionType', labelKey: 'domains.commissionRecords.fields.commissionType', type: 'enum', filterable: true, sortable: false, defaultVisible: false, enumValues: COMMISSION_TYPES, enumLabelPrefix: 'domains.commissionRecords.enums.commissionType' },
    { key: 'commissionPercentage', labelKey: 'domains.commissionRecords.fields.commissionPercentage', type: 'percentage', filterable: true, sortable: true, defaultVisible: true, format: 'percentage' },
    { key: 'paymentStatus', labelKey: 'domains.commissionRecords.fields.paymentStatus', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: COMMISSION_PAYMENT_STATUSES, enumLabelPrefix: 'domains.commissionRecords.enums.paymentStatus' },
    { key: 'paidAt', labelKey: 'domains.commissionRecords.fields.paidAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    // Refs
    { key: 'brokerageAgreementId', labelKey: 'domains.commissionRecords.fields.agreement', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'brokerageAgreements', refDisplayField: 'agentName' },
    { key: 'propertyId', labelKey: 'domains.commissionRecords.fields.property', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'properties', refDisplayField: 'name' },
    { key: 'projectId', labelKey: 'domains.commissionRecords.fields.project', type: 'text', filterable: true, sortable: false, defaultVisible: true, refDomain: 'projects', refDisplayField: 'name' },
    { key: 'primaryBuyerContactId', labelKey: 'domains.commissionRecords.fields.buyer', type: 'text', filterable: false, sortable: false, defaultVisible: false, refDomain: 'individuals', refDisplayField: 'firstName' },
    // Audit
    { key: 'createdAt', labelKey: 'domains.commissionRecords.fields.createdAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    { key: 'updatedAt', labelKey: 'domains.commissionRecords.fields.updatedAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
  ],
};
