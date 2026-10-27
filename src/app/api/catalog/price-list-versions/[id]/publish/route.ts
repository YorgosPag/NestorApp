/**
 * POST /api/catalog/price-list-versions/[id]/publish — δημοσίευση: CAS στην έκδοση και στις γραμμές, φράχτης με
 * επιβεβαίωση του αποτυπώματος, σφραγίδα, η προηγούμενη → `superseded` (ADR-923 §5.11 «3β» απόφαση Γ).
 * Auth: `catalog:pricing:publish` (≠ συντήρηση — SAP αποδέσμευση) · Rate: **sensitive** (αλλάζει τι πληρώνει ο πελάτης).
 */

import 'server-only';

import { publishPriceListVersion } from '@/server/catalog/price-publication.server';
import { publishPriceVersionBodySchema } from '@/subapps/catalog/schema/zod/price-list-requests.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const POST = catalogEntityRoute(
  { category: 'SENSITIVE', authority: 'pricingPublish' },
  publishPriceVersionBodySchema,
  (auth, id, body) => publishPriceListVersion(auth, id, body),
);
