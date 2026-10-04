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

/** Οι τέσσερις όψεις της ενότητας προμηθειών ενός έργου (ADR-330 §5.1 S2). */
export type ProjectProcurementSection = 'overview' | 'rfq' | 'quote' | 'po';

/** Η ενότητα προμηθειών ενός έργου — προεπιλογή η επισκόπηση, όπου προσγειώνεται η καρτέλα του έργου. */
export function getProjectProcurementUrl(
  projectId: string,
  section: ProjectProcurementSection = 'overview',
) {
  return typedHref(`/projects/${projectId}/procurement/${section}`);
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
