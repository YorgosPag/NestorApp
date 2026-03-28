/**
 * @module reports/sections/contacts/types
 * @enterprise ADR-265 Phase 9 — Contacts & Customers view-model types
 */

import type { TopBuyerItem } from '@/services/report-engine';

export interface ContactsReportPayload {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byPersona: Record<string, number>;
  byCity: Record<string, number>;
  newInPeriod: number;
  topBuyers: TopBuyerItem[];
  completenessRate: number;
  generatedAt: string;
}

export interface CityDistributionItem {
  city: string;
  count: number;
}

export { type TopBuyerItem };
