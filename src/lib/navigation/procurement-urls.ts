/**
 * @module lib/navigation/procurement-urls
 * @enterprise ADR-330 — Procurement Hub Scoped Split (Phase 1 / Session S1)
 *
 * SSoT for project-scoped procurement detail URLs. Every call-site (lists,
 * detail panels, contact tabs) MUST go through this module. Inline string
 * templating of `/projects/{projectId}/procurement/...` is forbidden by
 * `.ssot-registry.json` (added in S1).
 */

import { typedHref } from '@/lib/workspace/route-worlds';
import { serializeFilterArray } from '@/lib/url-filters/multi-value';

/** Οι τέσσερις όψεις της ενότητας προμηθειών ενός έργου (ADR-330 §5.1 S2). */
export type ProjectProcurementSection = 'overview' | 'rfq' | 'quote' | 'po';

/**
 * Το κλειδί ερωτήματος του φίλτρου κατάστασης στις λίστες του έργου — ΕΝΑ όνομα για γραφέα (κάρτες
 * επισκόπησης) και αναγνώστη (λίστες). Ίδιο με το `?status=` του ADR-331 Phase F στο hub.
 */
export const PROCUREMENT_STATUS_PARAM = 'status';

/** Φίλτρο που κουβαλά ένας σύνδεσμος drill-down (ADR-330 §5.1 S3.1). */
export interface ProjectProcurementFilter {
  readonly status?: readonly string[];
}

/** Η ενότητα προμηθειών ενός έργου — προεπιλογή η επισκόπηση, όπου προσγειώνεται η καρτέλα του έργου. */
export function getProjectProcurementUrl(
  projectId: string,
  section: ProjectProcurementSection = 'overview',
  filter?: ProjectProcurementFilter,
) {
  const status = serializeFilterArray(filter?.status);
  if (status === undefined) return typedHref(`/projects/${projectId}/procurement/${section}`);
  const query = new URLSearchParams({ [PROCUREMENT_STATUS_PARAM]: status });
  return typedHref(`/projects/${projectId}/procurement/${section}?${query.toString()}`);
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

export function getRfqDetailUrl(projectId: string, rfqId: string) {
  return typedHref(`/projects/${projectId}/procurement/rfq/${rfqId}`);
}
