/**
 * =============================================================================
 * Η ΚΡΙΣΗ ΤΑΥΤΟΤΗΤΑΣ ΜΙΑΣ ΛΗΨΗΣ — ΝΕΟ · ΙΔΙΟ ΠΕΡΙΕΧΟΜΕΝΟ · ΑΜΕΤΑΒΛΗΤΟ · ΝΕΑ ΕΚΔΟΣΗ (ADR-934 §5.2 Μ5 · §5.2.2 Μ-β3)
 * =============================================================================
 *
 * Καθαρό: ό,τι ήξερε η διεύθυνση πριν + ό,τι έφερε τώρα ⇒ η κρίση και η νέα κατάσταση της διεύθυνσης. Ο γραφέας
 * (`server/catalog/media-source.server`) το καλεί **μέσα** στη συναλλαγή, πάνω στην ξαναδιαβασμένη κατάσταση.
 *
 * 🔑 **Δύο ταυτότητες, όχι μία**: η «νέα έκδοση» είναι ιδιότητα της **διεύθυνσης** (ίδιο URI, άλλο sha256)· το «ίδιο
 *   περιεχόμενο» είναι ιδιότητα των **bytes** (άλλο URI, ίδιο sha256). Ένας Stibo με ταυτότητα μόνο το URL δεν βλέπει το
 *   δεύτερο· ένα σύστημα μόνο με sha256 δεν βλέπει το πρώτο.
 *
 * @module subapps/catalog/import/media-source-identity
 */

import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import type { OutboundTransport } from '@/lib/security/outbound-fetch';

import { MEDIA_SOURCE_HISTORY_LIMIT, type CatalogMediaSourceDefinition, type MediaSourceVerdict } from '../types/catalog-media';

/** Ό,τι έφερε μια λήψη 200 για μια διεύθυνση. */
export interface ObservedMediaContent {
  readonly companyId: string;
  readonly uri: string;
  readonly etag: string | null;
  readonly lastModified: string | null;
  readonly contentSha256: string;
  readonly contentFileId: string;
  readonly transport: OutboundTransport;
  readonly checkedAt: string;
  /** Το αρχείο καραντίνας **υπήρχε ήδη** πριν από αυτή τη λήψη (από άλλη διεύθυνση ή παρτίδα). */
  readonly contentAlreadyKept: boolean;
}

const SHA256_HEX = /^[0-9a-f]{64}$/;
const isTransport = (value: unknown): value is OutboundTransport => value === 'secure' || value === 'insecure';

const textOrNull = (value: unknown): string | null | undefined =>
  value === null ? null : typeof value === 'string' ? value : undefined;

/**
 * **Ο αναγνώστης του αποθηκευμένου εγγράφου** — ποτέ cast. Έγγραφο άλλου χώρου, άλλης διεύθυνσης ή με αλλοιωμένο πεδίο ⇒
 * `null` (= «άγνωστη διεύθυνση»): η επόμενη λήψη γίνεται χωρίς validators, ποτέ με ψεύτικα.
 */
export function mediaSourceFromDocument(
  data: Readonly<Record<string, unknown>> | undefined,
  expected: { readonly companyId: string; readonly uri: string },
): CatalogMediaSourceDefinition | null {
  if (data === undefined || data.uri !== expected.uri) return null;
  const owner = typeof data.companyId === 'string' ? data.companyId : null;
  if (!isPayloadOwnedByCompany({ companyId: owner }, expected.companyId)) return null;
  const etag = textOrNull(data.etag);
  const lastModified = textOrNull(data.lastModified);
  const { contentSha256, contentFileId, transport, checkedAt, previousSha256 } = data;
  if (etag === undefined || lastModified === undefined) return null;
  if (typeof contentSha256 !== 'string' || !SHA256_HEX.test(contentSha256)) return null;
  if (typeof contentFileId !== 'string' || contentFileId === '' || typeof checkedAt !== 'string') return null;
  if (!isTransport(transport) || !Array.isArray(previousSha256)) return null;
  const history = previousSha256.filter((sha): sha is string => typeof sha === 'string' && SHA256_HEX.test(sha));
  return {
    companyId: expected.companyId, uri: expected.uri, etag, lastModified, contentSha256, contentFileId,
    transport, checkedAt, previousSha256: history.slice(0, MEDIA_SOURCE_HISTORY_LIMIT),
  };
}

/** **Η κρίση** — από την προηγούμενη κατάσταση της διεύθυνσης και το περιεχόμενο που ήρθε. */
export function mediaSourceVerdictOf(
  previous: Pick<CatalogMediaSourceDefinition, 'contentSha256'> | null,
  contentSha256: string,
  contentAlreadyKept: boolean,
): MediaSourceVerdict {
  if (previous !== null) return previous.contentSha256 === contentSha256 ? 'unchanged' : 'newVersion';
  return contentAlreadyKept ? 'sameContent' : 'new';
}

/** Το ιστορικό μετά από αλλαγή περιεχομένου: το παλιό sha256 μπαίνει πρώτο, χωρίς διπλότυπο, ως το όριο. */
function historyAfter(previous: CatalogMediaSourceDefinition, contentSha256: string): readonly string[] {
  if (previous.contentSha256 === contentSha256) return previous.previousSha256;
  const older = previous.previousSha256.filter((sha) => sha !== previous.contentSha256 && sha !== contentSha256);
  return [previous.contentSha256, ...older].slice(0, MEDIA_SOURCE_HISTORY_LIMIT);
}

/** **Η νέα κατάσταση της διεύθυνσης** μετά από απάντηση 200 — και η κρίση της. */
export function nextMediaSource(
  previous: CatalogMediaSourceDefinition | null,
  observed: ObservedMediaContent,
): { readonly source: CatalogMediaSourceDefinition; readonly verdict: MediaSourceVerdict } {
  const source: CatalogMediaSourceDefinition = {
    companyId: observed.companyId,
    uri: observed.uri,
    etag: observed.etag,
    lastModified: observed.lastModified,
    contentSha256: observed.contentSha256,
    contentFileId: observed.contentFileId,
    transport: observed.transport,
    checkedAt: observed.checkedAt,
    previousSha256: previous === null ? [] : historyAfter(previous, observed.contentSha256),
  };
  return { source, verdict: mediaSourceVerdictOf(previous, observed.contentSha256, observed.contentAlreadyKept) };
}

/**
 * **Η κατάσταση μετά από 304** — τίποτα δεν κατέβηκε, το περιεχόμενο είναι ό,τι ήξερε η διεύθυνση. Αλλάζουν μόνο ο χρόνος
 * ελέγχου και, αν ο server έστειλε νέα, τα validators (RFC 9110 §15.4.5: ο 304 μπορεί να ανανεώσει το ETag).
 */
export function revalidatedMediaSource(
  previous: CatalogMediaSourceDefinition,
  revalidated: { readonly etag: string | null; readonly lastModified: string | null; readonly transport: OutboundTransport; readonly checkedAt: string },
): CatalogMediaSourceDefinition {
  return {
    ...previous,
    etag: revalidated.etag ?? previous.etag,
    lastModified: revalidated.lastModified ?? previous.lastModified,
    transport: revalidated.transport,
    checkedAt: revalidated.checkedAt,
  };
}
