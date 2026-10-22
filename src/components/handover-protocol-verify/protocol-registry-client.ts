/**
 * @fileoverview **Η ΕΡΩΤΗΣΗ ΣΤΟ ΜΗΤΡΩΟ** — η μία κλήση της σελίδας επαλήθευσης (ADR-916 Φ-Γ2 Σ6).
 * @module components/handover-protocol-verify/protocol-registry-client
 *
 * 🔑 `PUBLIC_REQUEST`: ο τρίτος δεν έχει λογαριασμό — η πόρτα είναι δημόσια. Η απάντηση περνά από τον **πραγματικό**
 *    αποκωδικοποιητή (`registryAnswerFromResponse`): σώμα που δεν καταλαβαίνουμε ⇒ «μη διαθέσιμο», ποτέ «επαληθευμένο».
 */

import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { ApiClientError, PUBLIC_REQUEST } from '@/lib/api/api-client-types';
import {
  registryAnswerFromResponse,
  type HandoverProtocolRegistryAnswer,
} from '@/lib/property-handover/handover-protocol-verification';

export type ProtocolRegistryUnavailable = 'rate-limited' | 'unreachable';

export type ProtocolRegistryOutcome =
  | { readonly kind: 'answer'; readonly registry: HandoverProtocolRegistryAnswer }
  | { readonly kind: 'unavailable'; readonly reason: ProtocolRegistryUnavailable };

const RATE_LIMITED = 429;

/** **Ρωτά το μητρώο** — με το sha256 του αρχείου, ή χωρίς (σελίδα από χαρτί/QR). */
export async function askProtocolRegistry(protocolId: string, pdfSha256: string | null): Promise<ProtocolRegistryOutcome> {
  try {
    const raw = await apiClient.get<unknown>(API_ROUTES.HANDOVER_PROTOCOLS.VERIFICATION(protocolId), {
      ...PUBLIC_REQUEST,
      params: pdfSha256 === null ? {} : { sha256: pdfSha256 },
    });
    const registry = registryAnswerFromResponse(raw);
    return registry === null ? { kind: 'unavailable', reason: 'unreachable' } : { kind: 'answer', registry };
  } catch (error) {
    const limited = error instanceof ApiClientError && error.statusCode === RATE_LIMITED;
    return { kind: 'unavailable', reason: limited ? 'rate-limited' : 'unreachable' };
  }
}
