/**
 * POST /api/catalog/assets — νέο μέσο καταλόγου (κωδικός, ρόλος, είδος, δικαιώματα IPTC· τα bytes στην 2γ).
 * Auth: `catalog:products:manage` · Rate: standard · ιδεμποτία μέσω `withAuth` · ADR-923 §5.10 Δ9.
 */

import 'server-only';

import { createCatalogAsset } from '@/server/catalog/asset-writer.server';
import { createAssetBodySchema } from '@/subapps/catalog/schema/zod/asset.schema';
import { catalogCreateRoute } from '../_shared/catalog-route';

export const POST = catalogCreateRoute({ category: 'STANDARD', authority: 'products' }, createAssetBodySchema, (auth, body) => createCatalogAsset(auth, body.definition));
