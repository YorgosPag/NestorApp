/**
 * Ο πελάτης της νησίδας τιμής αγοραστή (ADR-923 §5.13 Σ6): `GET /api/catalog/showcase-prices`, `private, no-store`.
 * Το route κρίνει ποιος ρωτά από τη σύνδεση· εδώ στέλνεται μόνο **ποιο δημόσιο μοντέλο**.
 *
 * @module services/public-catalog/public-catalog-prices.client
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { CATALOG_API } from '@/subapps/catalog/catalog-routes';
import type { ShowcaseModelPrices } from '@/subapps/catalog/public/showcase-price';

export interface BuyerShowcasePricesWire {
  readonly prices: ShowcaseModelPrices;
}

export function fetchBuyerShowcasePrices(supplierCompanyId: string, modelId: string): Promise<BuyerShowcasePricesWire> {
  return apiClient.get<BuyerShowcasePricesWire>(CATALOG_API.showcasePrices(supplierCompanyId, modelId));
}
