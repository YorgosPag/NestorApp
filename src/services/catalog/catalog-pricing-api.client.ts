/**
 * @fileoverview **Οι τιμές όπως τις διαβάζει και τις αλλάζει η οθόνη** — όψεις του διακομιστή + πράξεις έκδοσης
 *   (ADR-923 §5.11 «3δ»). Μεταφορά, όχι κρίση: διαδρομή, ρήμα, σώμα — ένα σημείο ανά πράξη.
 * @related services/catalog/catalog-api.client.ts (οι **ορισμοί** της τιμολόγησης: λίστα · ομάδες · αναθέσεις · συνθήκες) ·
 *   app/api/catalog/price-lists/** · price-list-versions/** · discounts (ο αυθεντικός γραφέας/αναγνώστης)
 * @module services/catalog/catalog-pricing-api.client
 *
 * 🔑 **Οι τιμές διαβάζονται ΜΟΝΟ από εδώ** (απόφαση Ζ): οι 8 συλλογές είναι `read: false` και ο κριτής `pricingView` ζει
 *    στον διακομιστή. Καμία Firestore για τιμές στον πελάτη — μόνο το σήμα της όψης (`pricing-view-signal.client-ref`).
 * 🔑 **`apiClient`, όχι `fetch`**: `Idempotency-Key` (CHECK 3.92), χώρος, σώμα άρνησης για τα ευρήματα (`catalogFailureOf`).
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { CATALOG_API, COST_RATES_PROJECT_PARAM, CURSOR_PARAM } from '@/subapps/catalog/catalog-routes';
import { chunkPriceLineChanges, sendPriceLineChunks, type PriceLineSaveOutcome } from '@/subapps/catalog/pricing/price-line-batches';
import type { PriceLineSubject } from '@/subapps/catalog/types/price-list';
import type {
  CreatePriceVersionRequest,
  PriceLineBatch,
  PriceLineBatchResult,
  PriceHistoryRequest,
  PriceHistoryResult,
  PriceLineInput,
  PricePublicationPreview,
  PriceQuoteRequest,
  PriceQuoteResult,
  PublishPriceVersionRequest,
} from '@/subapps/catalog/types/price-list-requests';
import type { CostRateBook } from '@/subapps/catalog/types/cost-rate';
import type { DiscountsView, PriceLinesPageView, PriceListsView, PriceListVersionWire } from '@/subapps/catalog/types/pricing-views';

// ── Όψεις (GET, κριτής `pricingView`) ────────────────────────────────────────

/** Οι τιμοκατάλογοι του χώρου + όλες οι ενεργές εκδόσεις τους (χρονογραμμή). */
export function fetchPriceListsView(): Promise<PriceListsView> {
  return apiClient.get<PriceListsView>(CATALOG_API.priceLists.collection);
}

/** Μία σελίδα γραμμών μιας έκδοσης· `cursor: null` ⇒ η πρώτη. */
export function fetchPriceLinesPage(versionId: string, cursor: string | null): Promise<PriceLinesPageView> {
  const base = CATALOG_API.priceListVersions.lines(versionId);
  return apiClient.get<PriceLinesPageView>(cursor === null ? base : `${base}?${new URLSearchParams({ [CURSOR_PARAM]: cursor }).toString()}`);
}

/** Πόσες φορές ξαναρχίζει η ανάγνωση όλων των σελίδων αν αλλάξουν οι γραμμές ανάμεσα σε δύο σελίδες. */
const ALL_PAGES_ATTEMPTS = 3;

/** Δύο σελίδες ανήκουν στο **ίδιο** στιγμιότυπο γραμμών; (`linesRevision` ανεβαίνει σε κάθε εγγραφή γραμμής.) */
const samePriceLines = (a: PriceLinesPageView, b: PriceLinesPageView): boolean =>
  a.version.id === b.version.id && a.version.derived.linesRevision === b.version.derived.linesRevision;

async function readPagesOnce(versionId: string): Promise<PriceLinesPageView | null> {
  const first = await fetchPriceLinesPage(versionId, null);
  const lines = [...first.lines];
  const skuIdentifiers: Record<string, string> = { ...first.skuIdentifiers };
  for (let cursor = first.nextCursor; cursor !== null; ) {
    const page = await fetchPriceLinesPage(versionId, cursor);
    if (!samePriceLines(first, page)) return null;
    lines.push(...page.lines);
    Object.assign(skuIdentifiers, page.skuIdentifiers);
    cursor = page.nextCursor;
  }
  return { ...first, lines, skuIdentifiers, nextCursor: null };
}

/**
 * **Όλες** οι γραμμές μιας έκδοσης, ως **ένα** συνεπές στιγμιότυπο: αν κάποιος γράψει γραμμές ανάμεσα σε δύο σελίδες
 * (άλλο `linesRevision`), η ανάγνωση ξαναρχίζει — ποτέ μίγμα «μισές παλιές, μισές νέες» στο πλέγμα. Η φρεσκάδα είναι της
 * **πρώτης** σελίδας (η παλαιότερη), ώστε ένα σήμα στο μεταξύ να φέρει πάντα νέα ανάγνωση.
 */
export async function fetchAllPriceLines(versionId: string): Promise<PriceLinesPageView> {
  for (let attempt = 1; attempt <= ALL_PAGES_ATTEMPTS; attempt++) {
    const view = await readPagesOnce(versionId);
    if (view !== null) return view;
  }
  throw new Error(`price lines of ${versionId} kept changing during ${ALL_PAGES_ATTEMPTS} full reads`);
}

/** Ομάδες έκπτωσης · ομάδες πελατών · αναθέσεις · συνθήκες. */
export function fetchDiscountsView(): Promise<DiscountsView> {
  return apiClient.get<DiscountsView>(CATALOG_API.discounts);
}

/** «Δες την τιμή σαν τον Χ» — ένα αίτημα ανά θεατή· η σύγκριση κοινών = παράλληλα αιτήματα, ποτέ δεύτερη μηχανή. */
export function fetchPriceQuote(request: PriceQuoteRequest): Promise<PriceQuoteResult> {
  return apiClient.post<PriceQuoteResult>(CATALOG_API.priceQuote, request);
}

/** Το βιβλίο τιμών κόστους του έργου: ό,τι ισχύει τώρα και ό,τι έρχεται (ADR-923 «3ε»). */
export function fetchCostRateBook(projectId: string): Promise<CostRateBook> {
  return apiClient.get<CostRateBook>(`${CATALOG_API.costRates}?${new URLSearchParams({ [COST_RATES_PROJECT_PARAM]: projectId })}`);
}

/** Η τιμή ενός υποκειμένου μέσα από τις δημοσιευμένες εκδόσεις μιας λίστας. */
export function fetchPriceHistory(request: PriceHistoryRequest): Promise<PriceHistoryResult> {
  return apiClient.post<PriceHistoryResult>(CATALOG_API.priceHistory, request);
}

// ── Πράξεις έκδοσης (κριτής `pricing` · η δημοσίευση `pricingPublish`) ─────────

/** Νέα πρόχειρη έκδοση — κενή ή «από την τρέχουσα» (τότε η σπορά συνεχίζεται με {@link continueSeeding}). */
export function createPriceListVersion(priceListId: string, request: CreatePriceVersionRequest): Promise<PriceListVersionWire> {
  return apiClient.post<PriceListVersionWire>(CATALOG_API.priceLists.versions(priceListId), request);
}

/** Μόνο σε πρόχειρη: από πότε ισχύει (CAS στην αναθεώρηση της έκδοσης). */
export function setVersionValidFrom(versionId: string, expectedRevision: number, validFrom: string | null): Promise<PriceListVersionWire> {
  return apiClient.put<PriceListVersionWire>(CATALOG_API.priceListVersions.item(versionId), { expectedRevision, validFrom });
}

/** **Μία** δέσμη γραμμών, μία συναλλαγή (CAS στο `linesRevision`). */
export function savePriceLineBatch(versionId: string, batch: PriceLineBatch): Promise<PriceLineBatchResult> {
  return apiClient.put<PriceLineBatchResult>(CATALOG_API.priceListVersions.lines(versionId), batch);
}

/**
 * Οσεσδήποτε γραμμές: δέσμες ≤ όριο, **σειριακά**, με αλυσίδα CAS από το `linesRevision` που διάβασε ο άνθρωπος.
 * Επιστρέφει «αποθηκεύτηκαν N από M» αν μια δέσμη αρνηθεί — ποτέ σιωπηλή επιτυχία (`price-line-batches`).
 */
export function savePriceLines(
  versionId: string,
  expectedLinesRevision: number,
  changes: { readonly upserts: readonly PriceLineInput[]; readonly deletes: readonly PriceLineSubject[] },
): Promise<PriceLineSaveOutcome> {
  const send = (batch: PriceLineBatch) => savePriceLineBatch(versionId, batch);
  return sendPriceLineChunks(send, expectedLinesRevision, chunkPriceLineChanges(changes.upserts, changes.deletes));
}

/** Ένα τμήμα της σποράς (ιδεμπότητο) — ο καλών συνεχίζει ως `derived.seed.done`. */
export function continueSeeding(versionId: string): Promise<PriceListVersionWire> {
  return apiClient.post<PriceListVersionWire>(CATALOG_API.priceListVersions.seed(versionId), {});
}

/**
 * Η σπορά ως το τέλος: τμήματα **σειριακά** (ιδεμπότητα — ο δρομέας ζει στον διακομιστή), με πρόοδο «N αντιγράφηκαν».
 * Σταματά αν ένα τμήμα **δεν προχωρήσει** (καμία ατέρμονη επανάληψη πάνω σε κολλημένο δρομέα) ή αν ο καλών ακυρώσει, και
 * επιστρέφει την έκδοση **όπως είναι** (`done: false`)· σε αποτυχία δικτύου/γραφέα πετά. Και στις δύο περιπτώσεις η έκδοση
 * μένει «σπορά σε εξέλιξη» και ο άνθρωπος βλέπει «Συνέχιση» — ποτέ ψευδές «ολοκληρώθηκε».
 */
export async function seedUntilDone(
  version: PriceListVersionWire,
  onProgress: (version: PriceListVersionWire) => void,
  isCancelled: () => boolean = () => false,
): Promise<PriceListVersionWire> {
  let current = version;
  while (current.derived.seed !== null && !current.derived.seed.done && !isCancelled()) {
    const before = current.derived.seed;
    current = await continueSeeding(current.id);
    onProgress(current);
    const after = current.derived.seed;
    // Πρόοδος = νέος δρομέας ή περισσότερες γραμμές (ο δρομέας προχωρά και πάνω από διαγραμμένες γραμμές της πηγής).
    if (after !== null && !after.done && after.cursor === before.cursor && after.copied === before.copied) break;
  }
  return current;
}

/** Η διαφορά από την τρέχουσα δημοσιευμένη + το αποτύπωμα του φράχτη (POST που **δεν** γράφει). */
export function previewPublication(versionId: string): Promise<PricePublicationPreview> {
  return apiClient.post<PricePublicationPreview>(CATALOG_API.priceListVersions.diff(versionId), {});
}

/** Δημοσίευση με CAS στην έκδοση **και** στις γραμμές, και επιβεβαίωση **ό,τι είδε** ο άνθρωπος. */
export function publishVersion(versionId: string, request: PublishPriceVersionRequest): Promise<PriceListVersionWire> {
  return apiClient.post<PriceListVersionWire>(CATALOG_API.priceListVersions.publish(versionId), request);
}

/** Απόρριψη πρόχειρης έκδοσης (CAS). */
export function discardVersion(versionId: string, expectedRevision: number): Promise<PriceListVersionWire> {
  return apiClient.post<PriceListVersionWire>(CATALOG_API.priceListVersions.discard(versionId), { expectedRevision });
}
