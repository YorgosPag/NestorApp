/**
 * @fileoverview Τα φίλτρα των λιστών της λογιστικής από το query — ΕΝΑ σημείο για τη σελίδα και τη σύνοψή της.
 * @module api/accounting/_shared/list-filters
 *
 * 🔑 Η σελίδα (`GET /api/accounting/<λίστα>`) και οι κάρτες (`GET /api/accounting/<λίστα>/summary`) πρέπει να κρίνουν
 *    το ΙΔΙΟ σύνολο εγγράφων: δύο αντίγραφα της ανάγνωσης φίλτρων θα απέκλιναν στην πρώτη νέα παράμετρο.
 *    Οι επιτρεπτοί **συνδυασμοί** κρίνονται αλλού, μία φορά: `AccountingListSpec.shapes` (`accounting-list-specs.ts`).
 * @see ADR-ACC-010 §2.1.1 (Φάση 3β λίστες · κάρτες σύνοψης)
 */

import 'server-only';

import {
  ASSET_CATEGORIES,
  ASSET_STATUSES,
  ENTRY_TYPES,
  INVOICE_PAYMENT_STATUSES,
  INVOICE_TYPES,
  MATCH_STATUSES,
  TRANSACTION_DIRECTIONS,
} from '@/subapps/accounting/types';
import type {
  BankTransactionFilters,
  FixedAssetFilters,
  InvoiceFilters,
  JournalEntryFilters,
} from '@/subapps/accounting/types';

import { MAX_FISCAL_YEAR, MIN_FISCAL_YEAR } from './fiscal-year-param';
import {
  optionalEnumParam,
  optionalFiscalYearParam,
  optionalIdParam,
  optionalIntParam,
  optionalQuarterParam,
} from './list-request-context';

export function invoiceFiltersOf(searchParams: URLSearchParams): InvoiceFilters {
  return {
    type: optionalEnumParam(searchParams, 'type', INVOICE_TYPES),
    paymentStatus: optionalEnumParam(searchParams, 'paymentStatus', INVOICE_PAYMENT_STATUSES),
    fiscalYear: optionalFiscalYearParam(searchParams),
    propertyId: optionalIdParam(searchParams, 'propertyId'),
  };
}

export function journalEntryFiltersOf(searchParams: URLSearchParams): JournalEntryFilters {
  return {
    type: optionalEnumParam(searchParams, 'type', ENTRY_TYPES),
    fiscalYear: optionalFiscalYearParam(searchParams),
    quarter: optionalQuarterParam(searchParams),
    contactId: optionalIdParam(searchParams, 'contactId'),
  };
}

export function bankTransactionFiltersOf(searchParams: URLSearchParams): BankTransactionFilters {
  return {
    accountId: optionalIdParam(searchParams, 'accountId'),
    direction: optionalEnumParam(searchParams, 'direction', TRANSACTION_DIRECTIONS),
    matchStatus: optionalEnumParam(searchParams, 'matchStatus', MATCH_STATUSES),
  };
}

export function fixedAssetFiltersOf(searchParams: URLSearchParams): FixedAssetFilters {
  return {
    category: optionalEnumParam(searchParams, 'category', ASSET_CATEGORIES),
    status: optionalEnumParam(searchParams, 'status', ASSET_STATUSES),
    acquisitionYear: optionalIntParam(searchParams, 'acquisitionYear', MIN_FISCAL_YEAR, MAX_FISCAL_YEAR),
  };
}
