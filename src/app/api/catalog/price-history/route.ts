/**
 * POST /api/catalog/price-history — η τιμή ενός υποκειμένου μέσα από τις δημοσιευμένες εκδόσεις μιας λίστας
 * (ADR-923 §5.11 «3δ» Τμήμα 3). POST που **δεν** γράφει: το υποκείμενο είναι δομημένο, ίδιο σώμα με την `price-quote`.
 * Auth: `catalog:pricing:view` · Rate: standard.
 */

import 'server-only';

import { readPriceHistory } from '@/server/catalog/price-history.server';
import { priceHistoryBodySchema } from '@/subapps/catalog/schema/zod/price-list-requests.schema';
import { catalogActionRoute } from '../_shared/catalog-route';

export const POST = catalogActionRoute({ category: 'STANDARD', authority: 'pricingView' }, priceHistoryBodySchema, (auth, body) =>
  readPriceHistory(auth, body),
);
