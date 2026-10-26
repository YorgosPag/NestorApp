/**
 * POST /api/catalog/assets/[id]/file — δένει αρχείο (ή νέα έκδοσή του) στο μέσο: μέτρηση από τον κάδο → αποδόσεις
 * web/εκτύπωσης → συναλλαγή με CAS. Ιδεμπότητο: ίδιο `fileId` ⇒ καμία νέα αναθεώρηση.
 * Auth: `catalog:products:manage` · ADR-923 §5.10.3.
 * Βαθμίδα `SENSITIVE`: κάθε κλήση μπορεί να αποκωδικοποιήσει εικόνα εκτύπωσης εκατοντάδων MB.
 */

import 'server-only';

import { attachFileToCatalogAsset } from '@/server/catalog/asset-file-attach.server';
import { attachAssetFileBodySchema } from '@/subapps/catalog/schema/zod/asset.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const POST = catalogEntityRoute({ category: 'SENSITIVE', authority: 'products' }, attachAssetFileBodySchema, (auth, id, body) =>
  attachFileToCatalogAsset(auth, id, body),
);
