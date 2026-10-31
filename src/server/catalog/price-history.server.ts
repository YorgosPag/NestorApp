import 'server-only';

/**
 * **Το ιστορικό τιμής ενός SKU σε μία λίστα** (ADR-923 §5.11 «3δ» Τμήμα 3).
 *
 * 🔑 **Κανένα ερώτημα, κανένας δείκτης**: η γραμμή έχει ντετερμινιστικό id ανά (έκδοση, υποκείμενο), και οι εκδόσεις της
 *    λίστας είναι ήδη γνωστές ⇒ **μία** `getAll`. Ο δείκτης «ιστορικό τιμής SKU» που περίμενε το ερώτημά του (Γ4) δεν
 *    χρειάζεται: το ερώτημα θα έκανε ίδιες αναγνώσεις (μία γραμμή ανά έκδοση) με ένα επιπλέον βήμα ανάπτυξης.
 * 🔑 **Μία συναλλαγή ανάγνωσης** ⇒ εκδόσεις και γραμμές από το ίδιο στιγμιότυπο. Οι δημοσιευμένες γραμμές είναι αμετάβλητες.
 *
 * @module server/catalog/price-history.server
 */

import type { AuthContext } from '@/lib/auth';
import { buildPriceHistory } from '@/subapps/catalog/pricing/price-history';
import { priceLineSubjectKey } from '@/subapps/catalog/pricing/price-line-subject';
import { priceListLineKey } from '@/subapps/catalog/pricing/pricing-keys';
import { publishedTimeline } from '@/subapps/catalog/pricing/version-timeline';
import type { PriceHistoryRequest, PriceHistoryResult } from '@/subapps/catalog/types/price-list-requests';
import type { PriceListDefinition, StoredPriceListLineDefinition } from '@/subapps/catalog/types/price-list';
import { readActiveByIds } from './catalog-library-reads.server';
import { naturalKeyId, readOwned, runCatalogTransaction } from './catalog-store.server';
import { readListVersions, versionRefOf } from './price-version-reads.server';

export function readPriceHistory(ctx: AuthContext, request: PriceHistoryRequest): Promise<PriceHistoryResult> {
  return runCatalogTransaction(ctx, async (scope) => {
    const list = await readOwned<PriceListDefinition>(scope, 'priceList', request.priceListId);
    const versions = (await readListVersions(scope, list.id)).map(versionRefOf);
    const subjectKey = priceLineSubjectKey(request.subject);
    const lineIdOf = (versionId: string) => naturalKeyId(scope, 'priceListLine', priceListLineKey(versionId, subjectKey));
    const lineIds = publishedTimeline(versions).map(({ version }) => lineIdOf(version.id));
    const lines = await readActiveByIds<StoredPriceListLineDefinition>(scope, 'priceListLine', lineIds);
    return { priceListId: list.id, points: buildPriceHistory(versions, (versionId) => lines.get(lineIdOf(versionId)) ?? null) };
  });
}
