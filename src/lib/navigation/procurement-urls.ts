/**
 * @module lib/navigation/procurement-urls
 * @enterprise ADR-330 — Procurement Hub Scoped Split (Phase 1 / Session S1)
 *
 * SSoT for project-scoped procurement detail URLs. Every call-site (lists,
 * detail panels, contact tabs) MUST go through this module. Inline string
 * templating of `/projects/{projectId}/procurement/...` is forbidden by
 * `.ssot-registry.json` (added in S1).
 */

export function getPoDetailUrl(projectId: string, poId: string): string {
  return `/projects/${projectId}/procurement/po/${poId}`;
}

export function getQuoteDetailUrl(
  projectId: string,
  quoteId: string,
  opts?: { review?: boolean },
): string {
  const base = `/projects/${projectId}/procurement/quote/${quoteId}`;
  return opts?.review ? `${base}/review` : base;
}

export function getRfqDetailUrl(projectId: string, rfqId: string): string {
  return `/projects/${projectId}/procurement/rfq/${rfqId}`;
}
