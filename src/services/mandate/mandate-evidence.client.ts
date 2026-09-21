'use client';

/**
 * @fileoverview **Ο ΠΕΛΑΤΗΣ ΛΗΨΗΣ ΠΑΓΩΜΕΝΟΥ ΑΠΟΔΕΙΚΤΙΚΟΥ** — δύο πόρτες, μία έκβαση (ADR-864 §19 · Α33).
 * @related app/api/owner-properties/_shared/evidence-download-response.ts · components/mandate/MandateEvidenceList.tsx
 * @module services/mandate/mandate-evidence.client
 *
 * 🔑 **Ο διακομιστής δίνει υπογεγραμμένο URL· ο φυλλομετρητής πλοηγείται σε αυτό.** Το URL φέρει ήδη
 * `Content-Disposition: attachment` με το ανθρώπινο όνομα, οπότε η σελίδα **μένει** και το αρχείο κατεβαίνει.
 * Κανένα blob στη μνήμη, κανένα CORS προς το bucket.
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { navigateDocument } from '@/lib/browser/document-navigation';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('mandate-evidence.client');

/** Από πού ζητείται — ο λογαριασμός με Bearer, ο σύνδεσμος με το token του. */
export type EvidenceSource =
  | { readonly kind: 'account'; readonly ownerPropertyId: string }
  | { readonly kind: 'link'; readonly token: string };

export type EvidenceOpenOutcome = 'opened' | 'unavailable';

interface SignedBody {
  readonly kind?: unknown;
  readonly url?: unknown;
}

function urlOf(body: SignedBody | null): string | null {
  return body !== null && body.kind === 'signed' && typeof body.url === 'string' ? body.url : null;
}

async function signedUrlFor(source: EvidenceSource, evidenceId: string): Promise<string | null> {
  const id = encodeURIComponent(evidenceId);
  if (source.kind === 'account') {
    return urlOf(await apiClient.get<SignedBody>(`/api/owner-properties/${encodeURIComponent(source.ownerPropertyId)}/mandate-evidence/${id}`));
  }
  const response = await fetch(`/api/mandate/${encodeURIComponent(source.token)}/evidence/${id}`, { cache: 'no-store' });
  return response.ok ? urlOf((await response.json().catch(() => null)) as SignedBody | null) : null;
}

/** Ζήτα άδεια λήψης και άνοιξέ την. `unavailable` = ανύπαρκτο, ξένο, ληγμένος σύνδεσμος ή αποτυχία — ο άνθρωπος κάνει το ίδιο. */
export async function downloadMandateEvidence(source: EvidenceSource, evidenceId: string): Promise<EvidenceOpenOutcome> {
  try {
    const url = await signedUrlFor(source, evidenceId);
    if (url === null) return 'unavailable';
    navigateDocument(url);
    return 'opened';
  } catch (cause) {
    logger.error('Η λήψη αποδεικτικού απέτυχε', { data: { evidenceId }, error: cause instanceof Error ? cause.message : String(cause) });
    return 'unavailable';
  }
}
