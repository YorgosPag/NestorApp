/**
 * GET /api/catalog/publications — οι συνταγές και οι πρόσφατες εκδόσεις του χώρου (ADR-923 §5.6).
 * Auth: `catalog:pricing:view` (μια έκδοση μπορεί να περιέχει τιμές) · Rate: standard. Οι συλλογές είναι `read: false`.
 */

import 'server-only';

import { readPublicationsView } from '@/server/catalog/publishing/publication-views.server';
import { catalogReadRoute } from '../_shared/catalog-route';

export const GET = catalogReadRoute({ category: 'STANDARD', authority: 'pricingView' }, (auth) => readPublicationsView(auth));
