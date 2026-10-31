import 'server-only';

/**
 * **Το βιβλίο τιμών κόστους** — ο αναγνώστης του master (ADR-923 §5.11 «3ε» · ADR-175 §4.1.3).
 *
 * 🔑 **Κανένας νέος δείκτης**: λίστες με `kind` · εκδόσεις με `priceListId` · γραμμές με `versionId` έχουν ήδη δείκτη.
 * 🔑 Λίστες και εκδόσεις διαβάζονται σε **μία** συναλλαγή, άρα κρίνονται από ένα στιγμιότυπο. Οι γραμμές διαβάζονται
 *    εκτός συναλλαγής σε σελίδες, και αυτό είναι ασφαλές: η δημοσιευμένη έκδοση είναι αμετάβλητη.
 * 🔑 Ζωντανό με το σήμα `lists`: κάθε δημοσίευση αγγίζει την έκδοση. Το `freshUntil` καλύπτει την έκδοση που **αρχίζει**
 *    να ισχύει χωρίς να γίνει εγγραφή.
 *
 * @module server/catalog/cost-rates.server
 */

import type { AuthContext } from '@/lib/auth';
import { pricingFreshUntil } from '@/subapps/catalog/pricing/pricing-view-freshness';
import { publishedTimeline, versionAt } from '@/subapps/catalog/pricing/version-timeline';
import type { CostRate, CostRateBook } from '@/subapps/catalog/types/cost-rate';
import { effectiveFenceBp, isPublishedStatus } from '@/subapps/catalog/vocabulary/pricing';
import { readPricingViewRevisionInTx } from './pricing-view-signal.server';
import { runCatalogTransaction, type CatalogTx } from './catalog-store.server';
import type { StoredPriceLine, StoredPriceVersion } from './price-version-aggregate.server';
import { readActivePriceLists, readListVersions, readVersionLines, versionRefOf, type StoredPriceList } from './price-version-reads.server';

interface ListVersions {
  readonly list: StoredPriceList;
  readonly current: StoredPriceVersion | null;
  readonly next: StoredPriceVersion | null;
}

async function readCostLists(scope: CatalogTx, projectId: string | null): Promise<StoredPriceList[]> {
  const lists = await readActivePriceLists(scope, 'cost');
  return lists.filter((list) => (list.projectId ?? null) === null || list.projectId === projectId);
}

/** Η έκδοση που ισχύει και η αμέσως επόμενη δημοσιευμένη, με τη χρονογραμμή της **μίας** αρχής. */
function versionsOf(list: StoredPriceList, versions: readonly StoredPriceVersion[], nowMs: number): ListVersions {
  const byId = new Map(versions.map((version) => [version.id, version]));
  const refs = versions.map(versionRefOf);
  const currentId = versionAt(refs, nowMs)?.id ?? null;
  const nextRef = publishedTimeline(refs).find(({ window }) => window.fromMs !== null && window.fromMs > nowMs)?.version ?? null;
  return { list, current: currentId === null ? null : byId.get(currentId) ?? null, next: nextRef === null ? null : byId.get(nextRef.id) ?? null };
}

function rateOf(list: StoredPriceList, version: StoredPriceVersion, line: StoredPriceLine): CostRate | null {
  if (line.subject.kind !== 'costItem' || line.breakdown === null || version.validFrom === null) return null;
  return {
    priceListId: list.id,
    priceListCode: list.code,
    priceListLabels: list.labels,
    projectId: list.projectId ?? null,
    versionId: version.id,
    versionNumber: version.number,
    validFrom: version.validFrom,
    lineId: line.id,
    subjectKey: line.derived.subjectKey,
    atoeCode: line.subject.atoeCode,
    region: line.subject.region,
    unitCode: line.unitCode,
    priceQuantity: line.priceQuantity,
    netPrice: line.netPrice,
    breakdown: line.breakdown,
    fenceBp: effectiveFenceBp(list.changeFenceBp),
  };
}

export function readCostRateBook(ctx: AuthContext, projectId: string | null, nowMs = Date.now()): Promise<CostRateBook> {
  return runCatalogTransaction(ctx, async (scope) => {
    const revision = await readPricingViewRevisionInTx(scope.tx, scope.db, ctx.companyId, { kind: 'lists' });
    const lists = await readCostLists(scope, projectId);
    const versions = await Promise.all(lists.map((list) => readListVersions(scope, list.id)));
    const picks = lists.map((list, index) => versionsOf(list, versions[index], nowMs));
    const ratesOf = async (list: StoredPriceList, version: StoredPriceVersion | null): Promise<CostRate[]> => {
      if (version === null) return [];
      const lines = await readVersionLines(scope.db, ctx.companyId, version.id);
      return lines.flatMap((line) => rateOf(list, version, line) ?? []);
    };
    const current = await Promise.all(picks.map(({ list, current: version }) => ratesOf(list, version)));
    const upcoming = await Promise.all(picks.map(({ list, next }) => ratesOf(list, next)));
    const starts = versions.flat().filter((version) => isPublishedStatus(version.status)).map((version) => version.validFrom);
    return {
      freshness: { revision, freshUntil: pricingFreshUntil(nowMs, starts) },
      asOf: new Date(nowMs).toISOString(),
      priceListIds: lists.map((list) => list.id),
      current: current.flat(),
      upcoming: upcoming.flat(),
    };
  });
}
