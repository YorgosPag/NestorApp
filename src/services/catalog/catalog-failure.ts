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

import { currentRevisionOf, TRANSPORT_REFUSAL_KINDS, writerRefusalOf } from '@/lib/api/writer-refusal';
import { CATALOG_ISSUE_CODES, type CatalogIssue, type CatalogIssueCode } from '@/subapps/catalog/schema/catalog-issues';
import { CATALOG_WRITE_ERROR_KIND_NAMES, type CatalogWriteErrorKind } from '@/subapps/catalog/schema/catalog-write-kinds';

/** Τα είδη άρνησης του γραφέα — **ο ίδιος** πίνακας με τον διακομιστή (`catalog-write-kinds`), όχι αντίγραφο. */
const WRITER_KINDS = CATALOG_WRITE_ERROR_KIND_NAMES;
type WriterKind = CatalogWriteErrorKind;

export const CATALOG_FAILURE_KINDS = [...WRITER_KINDS, ...TRANSPORT_REFUSAL_KINDS] as const;
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

function isIssueCode(value: unknown): value is CatalogIssueCode {
  return (CATALOG_ISSUE_CODES as readonly unknown[]).includes(value);
}

/** Ένα εύρημα από το σύρμα — με τις παραμέτρους ICU του, όταν υπάρχουν. */
function issueOf(raw: Readonly<Record<string, unknown>>): CatalogIssue | null {
  const { code, path, params } = raw;
  if (!isIssueCode(code) || typeof path !== 'string') return null;
  const safeParams = params !== null && typeof params === 'object' ? (params as Record<string, string | number>) : undefined;
  return safeParams ? { code, path, params: safeParams } : { code, path };
}

/** Η κοινή ερμηνεία (`writer-refusal`, ADR-928 Φ3α-2 — ως τότε ζούσε εδώ) με το λεξιλόγιο του καταλόγου. */
const CATALOG_REFUSAL = { errorCodePrefix: 'catalog.', kinds: WRITER_KINDS, issueOf } as const;

function isWriterKind(kind: CatalogFailureKind): kind is WriterKind {
  return (WRITER_KINDS as readonly string[]).includes(kind);
}

/** Το αποτύπωμα fnv1a64 του φράχτη (ίδιο σχήμα με το `diffDigestSchema` του συνόρου). */
const DIFF_DIGEST = /^[0-9a-f]{16}$/;

function fenceOf(body: Readonly<Record<string, unknown>> | null): CatalogFenceDemand | null {
  const diffDigest = body?.diffDigest;
  const fencedCount = body?.fencedCount;
  if (typeof diffDigest !== 'string' || !DIFF_DIGEST.test(diffDigest)) return null;
  if (typeof fencedCount !== 'number' || !Number.isInteger(fencedCount) || fencedCount < 0) return null;
  return { diffDigest, fencedCount };
}

/** **Η μία ερμηνεία** μιας αποτυχημένης εγγραφής καταλόγου. */
export function catalogFailureOf(cause: unknown): CatalogFailure {
  const { kind, issues, body } = writerRefusalOf(cause, CATALOG_REFUSAL);
  if (!isWriterKind(kind)) return { kind, issues: [], currentRevision: null, fence: null };
  return {
    kind,
    issues,
    currentRevision: currentRevisionOf(body),
    fence: kind === 'confirmationRequired' ? fenceOf(body) : null,
  };
}
