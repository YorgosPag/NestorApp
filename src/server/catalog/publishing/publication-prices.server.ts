import 'server-only';

/**
 * =============================================================================
 * ΟΙ ΤΙΜΕΣ ΜΙΑΣ ΕΚΔΟΣΗΣ — μόνο από τον επιλυτή του διακομιστή (ADR-923 §5.6 · §12 🔒)
 * =============================================================================
 *
 * Ίδια μηχανή με την «τιμή σαν τον Χ» (`viewerOf` · `resolveCatalogPrice`), μαζικά: οι γραμμές της έκδοσης διαβάζονται
 * μία φορά και κάθε SKU λύνεται χωρίς νέα ανάγνωση.
 *
 * 🔒 **Το φράγμα του §12**, πριν από κάθε τιμή:
 *   - μόνο λίστα **πώλησης** (ποτέ `cost`, το εσωτερικό κόστος του χώρου)·
 *   - μόνο **δημοσιευμένη** έκδοση (αμετάβλητη, αποδείξιμη)·
 *   - το κοινό της έκδοσης πρέπει να **καλύπτεται** από το κοινό της λίστας: συνταγή «λιανική» πάνω σε λίστα «χονδρική» θα
 *     τύπωνε τις τιμές ενός κοινού για άλλο κοινό.
 * 🔑 Στιγμή επίλυσης = η **ισχύς της έκδοσης**, όχι το «τώρα»: ίδιες είσοδοι ⇒ ίδια αρχείο, και το υποσέλιδο λέει την αλήθεια.
 * 🔑 Ασάφεια συνθηκών ⇒ η έκδοση **αποτυγχάνει** (`priceAmbiguous`), ποτέ «η πρώτη» (§5.11).
 * @module server/catalog/publishing/publication-prices.server
 */

import { normalizeToMillisOrNull } from '@/lib/date-local';
import { audienceIdentity } from '@/subapps/catalog/pricing/price-audience';
import { priceLineSubjectKey } from '@/subapps/catalog/pricing/price-line-subject';
import { resolveCatalogPrice, type PricedRecord } from '@/subapps/catalog/pricing/resolve-catalog-price';
import { formatPublicationPrice } from '@/subapps/catalog/publishing/layout-text';
import { publicationListMayServe, publicationVersionPrintable } from '@/subapps/catalog/publishing/publication-price-fence';
import type { DataVersionRef } from '@/subapps/catalog/publishing/publication-input-hash';
import type { PublicationPriceLookup } from '@/subapps/catalog/publishing/publication-entries';
import type { HumanLanguage } from '@/i18n/languages';
import type { PriceListDefinition, PriceListLineDefinition, StoredPriceListVersionDefinition } from '@/subapps/catalog/types/price-list';
import type { PublicationFailure, PublicationPricing } from '@/subapps/catalog/types/publication';
import { readOwned, type CatalogTx } from '../catalog-store.server';
import { assertNoIssues } from '../catalog-write-error';
import { readActiveConditionRecords, viewerOf } from '../price-quote.server';
import { readListVersions, readVersionLines, versionRefOf } from '../price-version-reads.server';

/** Μια έκδοση που δεν μπορεί να βγει, με ονομασμένη αιτία (ποτέ ελεύθερο κείμενο προς τον άνθρωπο). */
export class PublicationRunError extends Error {
  constructor(readonly failure: PublicationFailure) {
    super(failure);
    this.name = 'PublicationRunError';
  }
}

export interface PublicationPriceSheet {
  readonly priceOf: PublicationPriceLookup | null;
  readonly refs: readonly DataVersionRef[];
  readonly audienceKey: string;
  /** Για το υποσέλιδο: αριθμός έκδοσης + ισχύς. `null` = τεχνικός κατάλογος. */
  readonly edition: { readonly versionNumber: number; readonly validFrom: string } | null;
}

const NO_PRICES: PublicationPriceSheet = { priceOf: null, refs: [], audienceKey: 'none', edition: null };

type PricedPricing = Extract<PublicationPricing, { kind: 'priced' }>;

async function readPublishedVersion(scope: CatalogTx, pricing: PricedPricing) {
  const version = await readOwned<StoredPriceListVersionDefinition>(scope, 'priceListVersion', pricing.priceListVersionId);
  if (version.priceListId !== pricing.priceListId) throw new PublicationRunError('priceVersionUnpublished');
  if (!publicationVersionPrintable(version) || version.validFrom === null || version.seal === null) throw new PublicationRunError('priceVersionUnpublished');
  return { ...version, validFrom: version.validFrom, seal: version.seal };
}

function assertListMayServe(list: PriceListDefinition, viewer: Awaited<ReturnType<typeof viewerOf>>): void {
  assertNoIssues(publicationListMayServe(list, viewer) ? [] : [{ code: 'publicationAudienceNotCovered', path: 'pricing.audience' }]);
}

/** Το φράγμα χωρίς τις γραμμές: ό,τι κρίνει ο γραφέας συνταγής μέσα στη συναλλαγή του. */
export async function assertPublicationPricing(scope: CatalogTx, pricing: PublicationPricing): Promise<void> {
  if (pricing.kind === 'none') return;
  assertListMayServe(await readOwned<PriceListDefinition>(scope, 'priceList', pricing.priceListId), await viewerOf(scope, pricing.audience));
  await readPublishedVersion(scope, pricing);
}

/** Το φύλλο τιμών ενός κοινού. Πετά `PublicationRunError` ή `CatalogWriteError`, ποτέ δεν επιστρέφει μισές τιμές. */
export async function readPublicationPriceSheet(scope: CatalogTx, pricing: PublicationPricing, language: HumanLanguage): Promise<PublicationPriceSheet> {
  if (pricing.kind === 'none') return NO_PRICES;
  const viewer = await viewerOf(scope, pricing.audience);
  const list = await readOwned<PriceListDefinition>(scope, 'priceList', pricing.priceListId);
  assertListMayServe(list, viewer);
  const version = await readPublishedVersion(scope, pricing);
  const versions = (await readListVersions(scope, list.id)).map(versionRefOf);
  const conditions = await readActiveConditionRecords(scope);
  const lines = await readVersionLines(scope.db, scope.ctx.companyId, version.id);
  const lineBySubject = new Map(lines.map((line) => [priceLineSubjectKey(line.subject), line]));
  const atMs = normalizeToMillisOrNull(version.validFrom) ?? 0;
  const priceRecord: PricedRecord<PriceListDefinition> = { id: list.id, definition: list };
  const priceOf: PublicationPriceLookup = (variantId) => {
    const subject = { kind: 'variant' as const, variantId };
    const line = lineBySubject.get(priceLineSubjectKey(subject));
    if (!line) return null;
    const resolution = resolveCatalogPrice({
      priceList: priceRecord,
      versions,
      lineFor: (versionId): PricedRecord<PriceListLineDefinition> | null => (versionId === line.versionId ? { id: line.id, definition: line } : null),
      conditions: conditions.map(({ record }) => record),
      viewer,
      subject,
      quantity: line.priceQuantity,
      atMs,
    });
    if (resolution.kind === 'ambiguousDiscount') throw new PublicationRunError('priceAmbiguous');
    return resolution.kind === 'priced' ? formatPublicationPrice(resolution.quote.netAmount, language) : null;
  };
  return {
    priceOf,
    audienceKey: audienceIdentity(pricing.audience),
    edition: { versionNumber: version.number, validFrom: version.validFrom },
    refs: [
      { key: `priceList:${list.id}`, revision: list.revision },
      { key: `priceVersion:${version.id}:${version.seal.linesHash}`, revision: version.revision },
      ...conditions.map(({ record, revision }) => ({ key: `discountCondition:${record.id}`, revision })),
    ],
  };
}
