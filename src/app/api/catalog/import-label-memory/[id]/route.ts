/**
 * DELETE /api/catalog/import-label-memory/[id]?expectedRevision=N — μια ετικέτα ξεχνιέται (ADR-923 §5.5.2 Β5.2): soft delete με CAS·
 * η επόμενη έγκριση την ξαναγεννά. Auth: `catalog:products:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { deleteLabelMemory } from '@/server/catalog/import-label-memory.server';
import { catalogDeleteRoute } from '../../_shared/catalog-route';

export const DELETE = catalogDeleteRoute({ category: 'STANDARD', authority: 'products' }, (auth, id, expectedRevision) =>
  deleteLabelMemory(auth, id, expectedRevision),
);
