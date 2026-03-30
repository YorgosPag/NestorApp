/**
 * @module config/report-builder/domain-defs-ownership
 * @enterprise ADR-268 Phase 5 — Ownership Domain Definitions
 *
 * C7a: Ownership Summary (table-level grain — 1 row = 1 ownership table)
 * C7b: Ownership Detail (row-level grain — 1 row = 1 OwnershipTableRow, via rowExpansionField)
 *
 * Both domains query the same Firestore collection (ownership_tables).
 * C7b uses rowExpansionField: 'rows' to flatten the embedded rows[] array.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { DomainDefinition } from './report-builder-types';

// ============================================================================
// Enum Constants (SSoT)
// ============================================================================

const CALCULATION_METHODS = ['area', 'value', 'volume'] as const;
const OWNERSHIP_TABLE_STATUSES = ['draft', 'finalized', 'registered'] as const;
const PROPERTY_CATEGORIES = ['main', 'auxiliary', 'air_rights'] as const;
const OWNER_PARTIES = ['contractor', 'landowner', 'buyer', 'unassigned'] as const;

// ============================================================================
// C7a: Ownership Summary (table-level grain)
// ============================================================================

export const OWNERSHIP_SUMMARY_DEFINITION: DomainDefinition = {
  id: 'ownershipSummary',
  collection: COLLECTIONS.OWNERSHIP_TABLES,
  group: 'realestate',
  // eslint-disable-next-line custom/no-hardcoded-strings
  labelKey: 'domains.ownershipSummary.label',
  descriptionKey: 'domains.ownershipSummary.description',
  // eslint-disable-next-line custom/no-hardcoded-strings
  entityLinkPath: '/ownership/{id}',
  defaultSortField: 'updatedAt',
  defaultSortDirection: 'desc',
  fields: [
    // Identity
    { key: 'status', labelKey: 'domains.ownershipSummary.fields.status', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: OWNERSHIP_TABLE_STATUSES, enumLabelPrefix: 'domains.ownershipSummary.enums.status' },
    { key: 'calculationMethod', labelKey: 'domains.ownershipSummary.fields.calculationMethod', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: CALCULATION_METHODS, enumLabelPrefix: 'domains.ownershipSummary.enums.calculationMethod' },
    { key: 'version', labelKey: 'domains.ownershipSummary.fields.version', type: 'number', filterable: true, sortable: true, defaultVisible: true, format: 'number' },
    // Property data
    { key: 'zonePrice', labelKey: 'domains.ownershipSummary.fields.zonePrice', type: 'currency', filterable: true, sortable: true, defaultVisible: true, format: 'currency' },
    { key: 'commercialityCoefficient', labelKey: 'domains.ownershipSummary.fields.commercialityCoefficient', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number' },
    { key: 'totalShares', labelKey: 'domains.ownershipSummary.fields.totalShares', type: 'number', filterable: true, sortable: true, defaultVisible: true, format: 'number' },
    // Legal
    { key: 'deedNumber', labelKey: 'domains.ownershipSummary.fields.deedNumber', type: 'text', filterable: true, sortable: true, defaultVisible: false },
    { key: 'notary', labelKey: 'domains.ownershipSummary.fields.notary', type: 'text', filterable: true, sortable: true, defaultVisible: false },
    // Refs
    { key: 'projectId', labelKey: 'domains.ownershipSummary.fields.project', type: 'text', filterable: true, sortable: false, defaultVisible: true, refDomain: 'projects', refDisplayField: 'name' },
    // Dates
    { key: 'createdAt', labelKey: 'domains.ownershipSummary.fields.createdAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    { key: 'updatedAt', labelKey: 'domains.ownershipSummary.fields.updatedAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
  ],
};

// ============================================================================
// C7b: Ownership Detail (row-level grain — flattened from rows[])
// ============================================================================

export const OWNERSHIP_DETAIL_DEFINITION: DomainDefinition = {
  id: 'ownershipDetail',
  collection: COLLECTIONS.OWNERSHIP_TABLES,
  group: 'realestate',
  rowExpansionField: 'rows',
  // eslint-disable-next-line custom/no-hardcoded-strings
  labelKey: 'domains.ownershipDetail.label',
  descriptionKey: 'domains.ownershipDetail.description',
  // eslint-disable-next-line custom/no-hardcoded-strings
  entityLinkPath: '/ownership/{_parentId}',
  defaultSortField: 'ordinal',
  defaultSortDirection: 'asc',
  fields: [
    // Row-level fields (from rows[] elements after expansion)
    { key: 'ordinal', labelKey: 'domains.ownershipDetail.fields.ordinal', type: 'number', filterable: true, sortable: true, defaultVisible: true, format: 'number' },
    { key: 'entityCode', labelKey: 'domains.ownershipDetail.fields.entityCode', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'description', labelKey: 'domains.ownershipDetail.fields.description', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'category', labelKey: 'domains.ownershipDetail.fields.category', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: PROPERTY_CATEGORIES, enumLabelPrefix: 'domains.ownershipDetail.enums.category' },
    { key: 'floor', labelKey: 'domains.ownershipDetail.fields.floor', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'areaNetSqm', labelKey: 'domains.ownershipDetail.fields.areaNetSqm', type: 'number', filterable: true, sortable: true, defaultVisible: true, format: 'number' },
    { key: 'areaSqm', labelKey: 'domains.ownershipDetail.fields.areaSqm', type: 'number', filterable: true, sortable: true, defaultVisible: true, format: 'number' },
    { key: 'millesimalShares', labelKey: 'domains.ownershipDetail.fields.millesimalShares', type: 'number', filterable: true, sortable: true, defaultVisible: true, format: 'number' },
    { key: 'ownerParty', labelKey: 'domains.ownershipDetail.fields.ownerParty', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: OWNER_PARTIES, enumLabelPrefix: 'domains.ownershipDetail.enums.ownerParty' },
    { key: 'buyerName', labelKey: 'domains.ownershipDetail.fields.buyerName', type: 'text', filterable: true, sortable: true, defaultVisible: false },
    // Parent-level fields (from the ownership table document)
    { key: 'status', labelKey: 'domains.ownershipDetail.fields.tableStatus', type: 'enum', filterable: true, sortable: true, defaultVisible: false, enumValues: OWNERSHIP_TABLE_STATUSES, enumLabelPrefix: 'domains.ownershipDetail.enums.status' },
    // Refs (parent-level)
    { key: 'projectId', labelKey: 'domains.ownershipDetail.fields.project', type: 'text', filterable: true, sortable: false, defaultVisible: true, refDomain: 'projects', refDisplayField: 'name' },
    { key: 'buildingId', labelKey: 'domains.ownershipDetail.fields.building', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'buildings', refDisplayField: 'name' },
  ],
};
