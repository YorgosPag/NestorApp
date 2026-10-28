/**
 * GET /api/catalog/discounts — η όψη `discounts`: ομάδες έκπτωσης · ομάδες πελατών · αναθέσεις · συνθήκες
 * (ADR-923 §5.11 «3δ» Ζ — οι τιμές διαβάζονται ΜΟΝΟ από τον διακομιστή).
 * Auth: `catalog:pricing:view` · Rate: high (ανάγνωση· ξαναζητείται με σήμα όψης, ADR-905).
 */

import 'server-only';

import { readDiscountsView } from '@/server/catalog/pricing-views.server';
import { catalogReadRoute } from '../_shared/catalog-route';

export const GET = catalogReadRoute({ category: 'HIGH', authority: 'pricingView' }, (auth) => readDiscountsView(auth));
