/**
 * `GET /api/catalog/imports/[id]/assets` — η ουρά μέσων της παρτίδας: κάθε διεύθυνση που ζητούν οι ζωντανές προτάσεις, με την
 * κατάσταση της λήψης της (ADR-934 §5.2.2 Μ-β4). Auth: `catalog:products:manage` (παρτίδα τιμών: και τιμολόγηση) · Rate: high.
 *
 * `POST /api/catalog/imports/[id]/assets` `{ uri, retry? }` — κατεβάζει **μία** διεύθυνση της παρτίδας σε καραντίνα. Ιδεμπότητη
 * ανά διεύθυνση (έτοιμη ⇒ ως έχει· σε εξέλιξη ⇒ καμία δεύτερη λήψη) και μέσω `withAuth` (CHECK 3.92). Auth: `catalog:products:manage`
 * · Rate: standard — εξερχόμενη λήψη χωρίς πληρωμένη κλήση· η ουρά του πελάτη κρατά ≤ 3 ταυτόχρονες και σέβεται το `Retry-After`.
 */

import 'server-only';

import { fetchImportAsset, listImportAssets } from '@/server/catalog/import-asset-fetch.server';
import { fetchImportAssetBodySchema } from '@/subapps/catalog/schema/zod/catalog-import.schema';
import { catalogEntityRoute, catalogReadRoute } from '../../../_shared/catalog-route';

/** Μία λήψη ως το όριο του είδους (BIM 500 MiB) πάνω από αργό CDN: ο φρουρός κόβει νωρίτερα σε σιωπή ή λήξη χρόνου. */
export const maxDuration = 300;

export const GET = catalogReadRoute<Awaited<ReturnType<typeof listImportAssets>>, { id: string }>({ category: 'HIGH', authority: 'products' }, (auth, params) =>
  listImportAssets(auth, params.id),
);

export const POST = catalogEntityRoute({ category: 'STANDARD', authority: 'products' }, fetchImportAssetBodySchema, (auth, id, body) =>
  fetchImportAsset(auth, id, body),
);
