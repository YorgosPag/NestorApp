/**
 * @module config/report-builder/domain-defs-buyers
 * @enterprise ADR-268 Phase 4b — B3 Buyers (Transaction-Based)
 *
 * Buyer = unit with owners[] (ADR-244: transaction-based, not persona).
 * Collection: units WHERE commercial.ownerContactIds != null (Q94: schema discipline).
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { DomainDefinition } from './report-builder-types';

// Reuse enums from domain-definitions (units domain)
const LEGAL_PHASES = [
  'initial', 'deedPrep', 'documentReview', 'signaturePending', 'completed', 'cancelled',
] as const;

// ============================================================================
// B3 — Buyers (Αγοραστές)
// ============================================================================

export const BUYERS_DEFINITION: DomainDefinition = {
  id: 'buyers',
  collection: COLLECTIONS.PROPERTIES,
  group: 'people',
  labelKey: 'domains.buyers.label',
  descriptionKey: 'domains.buyers.description',
  entityLinkPath: '/properties/{id}',
  defaultSortField: 'commercial.ownerContactIds',
  defaultSortDirection: 'asc',
  preFilters: [
    { fieldPath: 'commercial.ownerContactIds', opStr: '!=', value: null },
  ],
  fields: [
    // Buyer info — ADR-244: derived from owners[] SSoT
    {
      key: 'commercial.ownerContactIds',
      labelKey: 'domains.buyers.fields.buyerName',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    // Unit identity
    {
      key: 'name',
      labelKey: 'domains.buyers.fields.unitName',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      key: 'code',
      labelKey: 'domains.buyers.fields.unitCode',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    // Hierarchy
    {
      key: 'buildingId',
      labelKey: 'domains.buyers.fields.building',
      type: 'text',
      filterable: true,
      sortable: false,
      defaultVisible: true,
      refDomain: 'buildings',
      refDisplayField: 'name',
    },
    {
      key: 'project',
      labelKey: 'domains.buyers.fields.project',
      type: 'text',
      filterable: true,
      sortable: false,
      defaultVisible: false,
      refDomain: 'projects',
      refDisplayField: 'name',
    },
    // Financial
    {
      key: 'commercial.askingPrice',
      labelKey: 'domains.buyers.fields.askingPrice',
      type: 'currency',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'currency',
    },
    {
      key: 'commercial.finalPrice',
      labelKey: 'domains.buyers.fields.finalPrice',
      type: 'currency',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      format: 'currency',
    },
    // Legal
    {
      key: 'commercial.legalPhase',
      labelKey: 'domains.buyers.fields.legalPhase',
      type: 'enum',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      enumValues: LEGAL_PHASES,
      enumLabelPrefix: 'domains.buyers.enums.legalPhase',
    },
    // Dates
    {
      key: 'commercial.saleDate',
      labelKey: 'domains.buyers.fields.saleDate',
      type: 'date',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      format: 'date',
    },
  ],
};
