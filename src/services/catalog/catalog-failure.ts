/**
 * @fileoverview **Τι σημαίνει μια άρνηση του γραφέα καταλόγου, για την οθόνη** (ADR-923 §5.9).
 * @related server/catalog/catalog-write-error.ts (το κλειστό σύνολο ειδών, `errorCode = catalog.<είδος>`) ·
 *   lib/api/api-client-types.ts (`apiErrorBodyOf` — ο ΕΝΑΣ κριτής του σώματος άρνησης)
 * @module services/catalog/catalog-failure
 *
 * 🔑 **Ρητή ένωση, ποτέ εξαίρεση προς τα πάνω**: η οθόνη κάνει `switch` στο `kind` — «άλλαξε από άλλον» (409 CAS) ·
 *    «ευρήματα» (422, με κωδικούς και διαδρομές για το πεδίο) · «χρησιμοποιείται» · «δεν βρέθηκε» · «δεν επιτρέπεται» ·
 *    «δίκτυο» (δεν ξέρουμε αν έφτασε). Τα ευρήματα έρχονται ως **κωδικοί** — μεταφράζονται στην οθόνη (N.11).
 * ⚠️ Το σώμα έρχεται από το δίκτυο ⇒ κάθε εύρημα **ελέγχεται** απέναντι στο `CATALOG_ISSUE_CODES` πριν γίνει δεκτό.
 * 🔑 **Φράχτης δημοσίευσης** (ADR-923 §5.11 «3δ» Γ3): το 409 `confirmationRequired` κουβαλά το **φρέσκο** αποτύπωμα της
 *    φραγμένης διαφοράς — χωρίς αυτό η οθόνη δεν θα μπορούσε να ξαναδείξει ό,τι ζητά ο διακομιστής να επιβεβαιωθεί.
 */

import { ApiClientError, apiErrorBodyOf } from '@/lib/api/enterprise-api-client';
import { CATALOG_ISSUE_CODES, type CatalogIssue, type CatalogIssueCode } from '@/subapps/catalog/schema/catalog-issues';
import { CATALOG_WRITE_ERROR_KIND_NAMES, type CatalogWriteErrorKind } from '@/subapps/catalog/schema/catalog-write-kinds';

/** Τα είδη άρνησης του γραφέα — **ο ίδιος** πίνακας με τον διακομιστή (`catalog-write-kinds`), όχι αντίγραφο. */
const WRITER_KINDS = CATALOG_WRITE_ERROR_KIND_NAMES;
type WriterKind = CatalogWriteErrorKind;

export const CATALOG_FAILURE_KINDS = [...WRITER_KINDS, 'forbidden', 'network', 'unknown'] as const;
export type CatalogFailureKind = (typeof CATALOG_FAILURE_KINDS)[number];

export interface CatalogFailure {
  readonly kind: CatalogFailureKind;
  readonly issues: readonly CatalogIssue[];
  /** Μόνο στο `revisionMismatch`: η αναθεώρηση που έχει **τώρα** ο διακομιστής. */
  readonly currentRevision: number | null;
  /** Μόνο στο `confirmationRequired`: τι ζητά ο διακομιστής να επιβεβαιωθεί **τώρα**. */
  readonly fence: CatalogFenceDemand | null;
}

/** Η φραγμένη διαφορά όπως τη μέτρησε ο διακομιστής τη στιγμή της άρνησης. */
export interface CatalogFenceDemand {
  readonly diffDigest: string;
  readonly fencedCount: number;
}

const ERROR_CODE_PREFIX = 'catalog.';

function isIssueCode(value: unknown): value is CatalogIssueCode {
  return (CATALOG_ISSUE_CODES as readonly unknown[]).includes(value);
}

function issuesOf(raw: unknown): CatalogIssue[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): CatalogIssue[] => {
    if (item === null || typeof item !== 'object') return [];
    const { code, path, params } = item as Record<string, unknown>;
    if (!isIssueCode(code) || typeof path !== 'string') return [];
    const safeParams = params !== null && typeof params === 'object' ? (params as Record<string, string | number>) : undefined;
    return [safeParams ? { code, path, params: safeParams } : { code, path }];
  });
}

function isWriterKind(value: string): value is WriterKind {
  return (WRITER_KINDS as readonly string[]).includes(value);
}

function writerKindOf(errorCode: unknown): WriterKind | null {
  if (typeof errorCode !== 'string' || !errorCode.startsWith(ERROR_CODE_PREFIX)) return null;
  const kind = errorCode.slice(ERROR_CODE_PREFIX.length);
  return isWriterKind(kind) ? kind : null;
}

/** Το αποτύπωμα fnv1a64 του φράχτη (ίδιο σχήμα με το `diffDigestSchema` του συνόρου). */
const DIFF_DIGEST = /^[0-9a-f]{16}$/;

function fenceOf(body: Record<string, unknown> | null): CatalogFenceDemand | null {
  const diffDigest = body?.diffDigest;
  const fencedCount = body?.fencedCount;
  if (typeof diffDigest !== 'string' || !DIFF_DIGEST.test(diffDigest)) return null;
  if (typeof fencedCount !== 'number' || !Number.isInteger(fencedCount) || fencedCount < 0) return null;
  return { diffDigest, fencedCount };
}

function writerFailure(kind: WriterKind, body: Record<string, unknown> | null): CatalogFailure {
  const revision = body?.currentRevision;
  return {
    kind,
    issues: issuesOf(body?.issues),
    currentRevision: typeof revision === 'number' ? revision : null,
    fence: kind === 'confirmationRequired' ? fenceOf(body) : null,
  };
}

/** **Η μία ερμηνεία** μιας αποτυχημένης εγγραφής καταλόγου. */
export function catalogFailureOf(cause: unknown): CatalogFailure {
  const none = { issues: [], currentRevision: null, fence: null } as const;
  if (!ApiClientError.isApiClientError(cause)) return { kind: 'network', ...none };
  const body = apiErrorBodyOf(cause);
  const kind = writerKindOf(body?.errorCode ?? cause.errorCode);
  if (kind) return writerFailure(kind, body);
  if (cause.statusCode === 401 || cause.statusCode === 403) return { kind: 'forbidden', ...none };
  if (cause.statusCode === 0) return { kind: 'network', ...none };
  return { kind: 'unknown', ...none };
}
