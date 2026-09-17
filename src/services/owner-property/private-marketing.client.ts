'use client';

/**
 * @fileoverview **Ο ΠΕΛΑΤΗΣ ΤΗΣ ΚΛΕΙΣΤΗΣ ΔΙΑΘΕΣΗΣ** — μία ανάγνωση, τέσσερις πράξεις, ονομασμένες εκβάσεις.
 * @related ADR-864 §17.6 · §18.4 · app/api/owner-properties/[ownerPropertyId]/route.ts (PATCH `privateMarketing`) ·
 *   app/api/owner-properties/[ownerPropertyId]/private-marketing/route.ts (GET)
 * @module services/owner-property/private-marketing.client
 *
 * 🔑 **Ο λόγος άρνησης φτάνει ΜΕ ΟΝΟΜΑ** (Α21): κάθε κωδικός περνά από κλειστό σύνολο (`refusalOf`) και γίνεται
 * κλειδί i18n· ό,τι δεν αναγνωρίζεται λέγεται `failed`, ποτέ ωμό κλειδί.
 *
 * ⚠️ Ζει **χωριστά** από το `owner-property.service.ts`: εκείνο είναι ο πελάτης της **αγγελίας** (και κοντά στο
 * όριο των 500 γραμμών)· αυτό είναι ο πελάτης της **συναίνεσης**, με δικό του λεξιλόγιο εκβάσεων.
 */

import { apiClient, apiErrorBodyOf } from '@/lib/api/enterprise-api-client';
import { refusalOf } from '@/lib/http/response-refusal';
import type { ConsentSubmission } from '@/lib/mandate/private-marketing-consent-text';
import type { PrivateMarketingPanels } from '@/lib/mandate/private-marketing-panel';
import { createModuleLogger } from '@/lib/telemetry';
import {
  PRIVATE_MARKETING_REFUSALS,
  type ClosedMarketingAudience,
  type PrivateMarketingRefusal,
  type PrivateMarketingRevocationOutcome,
} from '@/types/private-marketing-consent';

const logger = createModuleLogger('private-marketing.client');

const API_BASE = '/api/owner-properties';

/** Κωδικοί που φτάνουν ως `reason` ή ως παραβίαση εντολής — ένα λεξιλόγιο για την οθόνη. */
const PRIVATE_MARKETING_SCREEN_REASONS = [...PRIVATE_MARKETING_REFUSALS, 'private-marketing-consent-missing'] as const;
type PrivateMarketingScreenReason = PrivateMarketingRefusal | 'private-marketing-consent-missing';

const NOTIFY_KINDS = ['sent', 'no-address', 'failed'] as const;
type PrivateMarketingNotify = (typeof NOTIFY_KINDS)[number];

/** Η έκβαση κάθε πράξης — γραφείου **και** ιδιοκτήτη. */
export type PrivateMarketingActionOutcome =
  | { readonly kind: 'saved' }
  | { readonly kind: 'refused'; readonly reason: PrivateMarketingScreenReason }
  | { readonly kind: 'failed' };

/**
 * Η έκβαση του **αιτήματος** — η μόνη πράξη που ειδοποιεί, και μόνο του γραφείου.
 * ⚠️ Χωριστός τύπος επίτηδες: τα κείμενα `agency.notify.*` ζουν μόνο στην οθόνη που μπορεί να τα δει·
 * αλλιώς η κοινή απόδοση τα σέρνει και στη σελίδα του ιδιοκτήτη (CHECK 3.34, ADR-864 §19).
 */
export type PrivateMarketingRequestOutcome =
  | PrivateMarketingActionOutcome
  | { readonly kind: 'requested'; readonly notify: PrivateMarketingNotify };

interface PatchResponse {
  readonly requested?: boolean;
  readonly notify?: unknown;
}

const SAVED: PrivateMarketingActionOutcome = { kind: 'saved' };

export type PrivateMarketingPanelsLoad =
  | { readonly kind: 'found'; readonly panels: PrivateMarketingPanels }
  | { readonly kind: 'absent' }
  | { readonly kind: 'failed' };

/** Μία συναίνεση της οθόνης προς ένα γραφείο. */
interface ConsentToAgency {
  readonly agencyCompanyId: string;
  readonly requestId: string | null;
  readonly submission: ConsentSubmission;
}

const urlOf = (ownerPropertyId: string): string => `${API_BASE}/${encodeURIComponent(ownerPropertyId)}`;

/** Το 422 → **όνομα**: `reason` της υπηρεσίας, ή η **πρώτη** γνωστή παραβίαση εντολής. */
function refusedOf(cause: unknown): PrivateMarketingActionOutcome | null {
  const body = apiErrorBodyOf(cause);
  const reason = refusalOf(body, PRIVATE_MARKETING_SCREEN_REASONS);
  if (reason !== null) return { kind: 'refused', reason };
  const violations = body !== null && Array.isArray(body.violations) ? body.violations : [];
  return violations.includes('private-marketing-consent-missing')
    ? { kind: 'refused', reason: 'private-marketing-consent-missing' }
    : null;
}

function requestedOf(body: PatchResponse): PrivateMarketingRequestOutcome {
  if (body.requested !== true) return SAVED;
  return { kind: 'requested', notify: NOTIFY_KINDS.find((kind) => kind === body.notify) ?? 'failed' };
}

async function act<T extends PrivateMarketingRequestOutcome>(
  ownerPropertyId: string,
  privateMarketing: Record<string, unknown>,
  settled: (body: PatchResponse) => T,
): Promise<T | PrivateMarketingActionOutcome> {
  try {
    return settled(await apiClient.patch<PatchResponse>(urlOf(ownerPropertyId), { privateMarketing }));
  } catch (cause) {
    const refused = refusedOf(cause);
    if (refused !== null) return refused;
    logger.error('Η πράξη κλειστής διάθεσης απέτυχε', { data: { ownerPropertyId }, error: cause instanceof Error ? cause.message : String(cause) });
    return { kind: 'failed' };
  }
}

export async function fetchPrivateMarketingPanels(ownerPropertyId: string): Promise<PrivateMarketingPanelsLoad> {
  try {
    return { kind: 'found', panels: await apiClient.get<PrivateMarketingPanels>(`${urlOf(ownerPropertyId)}/private-marketing`) };
  } catch (cause) {
    if (apiErrorBodyOf(cause)?.kind === 'absent') return { kind: 'absent' };
    logger.error('Η κατάσταση κλειστής διάθεσης δεν φορτώθηκε', { data: { ownerPropertyId }, error: cause instanceof Error ? cause.message : String(cause) });
    return { kind: 'failed' };
  }
}

/** Το γραφείο **ζητά** (Ε-11). */
export const requestPrivateMarketing = (ownerPropertyId: string, audience: ClosedMarketingAudience): Promise<PrivateMarketingRequestOutcome> =>
  act(ownerPropertyId, { action: 'request', audience }, requestedOf);

const saved = (): PrivateMarketingActionOutcome => SAVED;

/** Ο ιδιοκτήτης **συναινεί** προς όλα τα γραφεία μαζί (Δ3). */
export const grantPrivateMarketing = (ownerPropertyId: string, audience: ClosedMarketingAudience | null, consents: readonly ConsentToAgency[]): Promise<PrivateMarketingActionOutcome> =>
  act(ownerPropertyId, { action: 'grant', audience, consents }, saved);

/** Το γραφείο **βεβαιώνει** με υπογεγραμμένο έντυπο (Ε-12 · Δ1). */
export const attestPrivateMarketing = (
  ownerPropertyId: string,
  input: { readonly audience: ClosedMarketingAudience; readonly requestId: string | null; readonly submission: ConsentSubmission; readonly documentFileId: string },
): Promise<PrivateMarketingActionOutcome> => act(ownerPropertyId, { action: 'attest', ...input }, saved);

/** Ο ιδιοκτήτης **ανακαλεί** (Ε-13). */
export const revokePrivateMarketing = (ownerPropertyId: string, agencyCompanyId: string, outcome: PrivateMarketingRevocationOutcome): Promise<PrivateMarketingActionOutcome> =>
  act(ownerPropertyId, { action: 'revoke', agencyCompanyId, outcome }, saved);
