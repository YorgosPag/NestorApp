/**
 * @module reports/sections/contacts
 * @enterprise ADR-265 Phase 9 — Contacts & Customers section components
 */

export { ContactsKPIs } from './ContactsKPIs';
export { ContactDistributionChart } from './ContactDistributionChart';
export { PersonaDistributionChart } from './PersonaDistributionChart';
export { GeographicDistributionChart } from './GeographicDistributionChart';
export { TopBuyersTable } from './TopBuyersTable';

export type {
  ContactsReportPayload,
  CityDistributionItem,
} from './types';
