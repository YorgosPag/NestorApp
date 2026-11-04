/**
 * @module lib/navigation/procurement-urls
 * @enterprise ADR-330 — Procurement Hub Scoped Split (Phase 1 / Session S1)
 *
 * SSoT for project-scoped procurement detail URLs. Every call-site (lists,
 * detail panels, contact tabs) MUST go through this module. Inline string
 * templating of `/projects/{projectId}/procurement/...` is forbidden by
 * `.ssot-registry.json` (added in S1).
 */

import { typedHref, withQuery } from '@/lib/workspace/route-worlds';
import { serializeFilterArray } from '@/lib/url-filters/multi-value';
import type { CatalogSkuAddress } from '@/subapps/procurement/types/rfq-line';

/** Οι όψεις της ενότητας προμηθειών ενός έργου (ADR-330 §5.1 S2 · `coverage` = Buyout, S3.2 · `subcontracts` = ADR-928 Φ3α-2). */
export type ProjectProcurementSection = 'overview' | 'rfq' | 'quote' | 'po' | 'coverage' | 'subcontracts';

/** Νέο αίτημα προσφοράς του έργου — με εργασίες επιμέτρησης, προσυμπληρωμένο από αυτές (ADR-327 P5-BOQ). */
export function getNewRfqUrl(projectId: string, boqItemIds: readonly string[] = []) {
  const query = new URLSearchParams({ projectId });
  const boqItems = serializeFilterArray(boqItemIds);
  if (boqItems !== undefined) query.set('boqItems', boqItems);
  return withQuery('/procurement/rfqs/new', query.toString());
}

/** Η παράμετρος του πρόχειρου «Ζητήστε προσφορά» (ADR-923 §5.13 Ε6ε): ΕΝΑ όνομα για γραφέα, σελίδα και `from-catalog`. */
export const RFQ_CATALOG_PARAM = 'catalog';

/** Χαρακτήρες ταυτότητας (enterprise id ή id του Firestore). Ό,τι άλλο, π.χ. `/` ή `.`, δεν είναι διεύθυνση SKU. */
const SKU_ADDRESS_PART = /^[A-Za-z0-9_-]{1,128}$/;
const SKU_ADDRESS_SEPARATOR = '.';

/**
 * **Το πρόχειρο «Ζητήστε προσφορά» για ένα SKU της βιτρίνας** (ADR-923 §5.13 Ε6ε): το απρόθετο
 * `/procurement/rfqs/new?catalog=<προμηθευτής>.<μοντέλο>.<παραλλαγή>`.
 * 🔑 Ο σύνδεσμος είναι ο φορέας: επιβιώνει σε ανανέωση, νέα καρτέλα, σύνδεση ή εγγραφή (`loginHref`) και εναλλαγή χώρου,
 *    γιατί τον χώρο τον βάζει το δίχτυ `[...unprefixed]`.
 */
export function quoteDraftHref(address: CatalogSkuAddress) {
  return withQuery('/procurement/rfqs/new', quoteDraftQuery(address));
}

/** Το ερώτημα `catalog=…` ως κείμενο: ΕΝΑ σημείο για τη σελίδα του πρόχειρου και για το `GET /api/rfqs/from-catalog`. */
export function quoteDraftQuery(address: CatalogSkuAddress): string {
  const value = [address.supplierCompanyId, address.modelId, address.variantId].join(SKU_ADDRESS_SEPARATOR);
  return new URLSearchParams({ [RFQ_CATALOG_PARAM]: value }).toString();
}

/**
 * Η διεύθυνση, **μόνο αν** επιβιώνει ταξίδι μέσω του URL (γραφέας → αναλυτής). Ένα id με `.` ή `/` θα έδινε πρόχειρο που ο
 * αναλυτής απορρίπτει, δηλαδή κουμπί που οδηγεί σε άρνηση: τέτοιο κουμπί δεν αποδίδεται.
 */
export function quotableSkuAddress(address: CatalogSkuAddress): CatalogSkuAddress | null {
  return parseQuoteDraftParam(new URLSearchParams(quoteDraftQuery(address)).get(RFQ_CATALOG_PARAM));
}

/** Η αντίστροφη του {@link quoteDraftHref}. Οτιδήποτε άλλο από τρία καθαρά τμήματα ⇒ `null`, ποτέ μισή διεύθυνση. */
export function parseQuoteDraftParam(raw: string | null | undefined): CatalogSkuAddress | null {
  const parts = (raw ?? '').split(SKU_ADDRESS_SEPARATOR);
  if (parts.length !== 3 || !parts.every((part) => SKU_ADDRESS_PART.test(part))) return null;
  const [supplierCompanyId, modelId, variantId] = parts;
  return { supplierCompanyId, modelId, variantId };
}

/**
 * Το κλειδί ερωτήματος του φίλτρου κατάστασης στις λίστες του έργου — ΕΝΑ όνομα για γραφέα (κάρτες
 * επισκόπησης) και αναγνώστη (λίστες). Ίδιο με το `?status=` του ADR-331 Phase F στο hub.
 */
export const PROCUREMENT_STATUS_PARAM = 'status';

/** Φίλτρο που κουβαλά ένας σύνδεσμος drill-down (ADR-330 §5.1 S3.1) — ίδιο σχήμα για έργο **και** hub. */
export interface ProjectProcurementFilter {
  readonly status?: readonly string[];
}

/** Το ερώτημα ενός φίλτρου drill-down· `undefined` όταν δεν φιλτράρει τίποτα (καθαρή διεύθυνση, όχι `?status=`). */
function drillQuery(filter: ProjectProcurementFilter | undefined): string | undefined {
  const status = serializeFilterArray(filter?.status);
  if (status === undefined) return undefined;
  return new URLSearchParams({ [PROCUREMENT_STATUS_PARAM]: status }).toString();
}

/** Η ενότητα προμηθειών ενός έργου — προεπιλογή η επισκόπηση, όπου προσγειώνεται η καρτέλα του έργου. */
export function getProjectProcurementUrl(
  projectId: string,
  section: ProjectProcurementSection = 'overview',
  filter?: ProjectProcurementFilter,
) {
  const query = drillQuery(filter);
  if (query === undefined) return typedHref(`/projects/${projectId}/procurement/${section}`);
  return typedHref(`/projects/${projectId}/procurement/${section}?${query}`);
}

/** Οι λίστες του hub προμηθειών όλης της εταιρείας (ADR-330 §5.1 S3.4). */
export type ProcurementHubSection = 'rfqs' | 'quotes' | 'purchase-orders' | 'vendors' | 'materials' | 'agreements';

/**
 * Μια λίστα του hub, προαιρετικά **ήδη φιλτραρισμένη** σε ό,τι μέτρησε η κάρτα που οδήγησε εκεί
 * (ADR-330 §5.1 S3.4). Ο αναγνώστης είναι το `useStatusDrillParam` της λίστας — ΕΝΑ κλειδί `?status=`.
 */
export function getProcurementHubUrl(section: ProcurementHubSection, filter?: ProjectProcurementFilter) {
  const query = drillQuery(filter);
  if (query === undefined) return typedHref(`/procurement/${section}`);
  return typedHref(`/procurement/${section}?${query}`);
}

export function getPoDetailUrl(projectId: string, poId: string) {
  return typedHref(`/projects/${projectId}/procurement/po/${poId}`);
}

export function getQuoteDetailUrl(
  projectId: string,
  quoteId: string,
  opts?: { review?: boolean },
) {
  const base = `/projects/${projectId}/procurement/quote/${quoteId}` as const;
  if (opts?.review) return typedHref(`${base}/review`);
  return typedHref(base);
}

/**
 * Η σελίδα ενός συμφωνητικού υπεργολαβίας (ADR-928 Φ3γ): επεξεργαστής όσο είναι πρόχειρο, έγγραφο + αποκλίσεις +
 * αναθέσεις μετά. Κύρια σύμβαση ανοίγει μέσα από **οποιοδήποτε** έργο έχει εντολή εργασίας — το `projectId` είναι το
 * έργο του πλαισίου πλοήγησης, όχι ιδιότητα του εγγράφου.
 */
export function getSubcontractAgreementUrl(projectId: string, agreementId: string) {
  return typedHref(`/projects/${projectId}/procurement/subcontracts/${agreementId}`);
}

/** Η βιβλιοθήκη ρητρών και προτύπων υπεργολαβίας — **της εταιρείας**, όχι έργου (ADR-928 Φ3γ-0). */
export function getSubcontractLibraryUrl() {
  return typedHref('/procurement/subcontracts/library');
}

export function getRfqDetailUrl(projectId: string, rfqId: string) {
  return typedHref(`/projects/${projectId}/procurement/rfq/${rfqId}`);
}
