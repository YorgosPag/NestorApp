/**
 * =============================================================================
 * ΤΟ ΔΙΑΠΙΣΤΕΥΤΗΡΙΟ ΤΗΣ ΠΥΛΗΣ ΠΡΟΜΗΘΕΥΤΗ — γραμματική, χωρίς βάση (ADR-876 §5)
 * =============================================================================
 *
 * Σύνδεσμος = `encodeSignedToken(VENDOR_PORTAL_SECRET, [credentialId, nonce, expiryMs])` —
 * **η ίδια γραμματική με τις προσκλήσεις χώρου** (`server/auth/workspace-invitation.ts`):
 *
 *   1. **υπογραφή πρώτα** — πλαστό token = μηδέν ανάγνωση βάσης (ADR-327 §11)·
 *   2. `get` με ID — **κανένα ερώτημα, κανένας δείκτης**·
 *   3. `equalsInConstantTime(sha256(nonce), nonceHash)`.
 *
 * 🔑 **Γιατί και τα δύο (υπογραφή + nonceHash)**: η υπογραφή κόβει τα σκουπίδια φθηνά· το
 * hash δένει τον σύνδεσμο με **έκδοση που έγινε πράγματι**. Αν ποτέ διαρρεύσει το μυστικό,
 * ένα πλαστό token με νέο nonce **δεν ταιριάζει σε κανένα** έγγραφο — δεύτερος φραγμός που
 * το παλιό μοντέλο (ωμό token στο `vendor_invites`) δεν είχε.
 *
 * 🔑 **ΜΙΑ γραμματική** (ADR-876 §5 Φ7): η παλιά μορφή 4 πεδίων (rfqId · vendorContactId · nonce ·
 * expiryMs) αποσύρθηκε — τίποτα άλλο πέρα από 3 πεδία με πρόθεμα `vic_` δεν είναι σύνδεσμος. Ένα
 * token παλιάς μορφής, **ακόμη και σωστά υπογεγραμμένο**, απαντά `invalid_link` πριν από κάθε βάση.
 *
 * @module services/vendor-portal/vendor-invite-credential
 * @enterprise ADR-876 §5 · ADR-327 §11
 */

import 'server-only';

import {
  decodeSignedToken,
  encodeSignedToken,
  equalsInConstantTime,
  newTokenNonce,
  requireTokenSecret,
} from '@/lib/tokens/signed-token';
import { sha256HexOfText } from '@/lib/hash/sha256';
import { generateVendorInviteCredentialId } from '@/services/enterprise-id.service';
import type {
  VendorCredentialOrigin,
  VendorInviteCredential,
} from '@/subapps/procurement/types/vendor-invite-credential';

/** Το μυστικό υπογραφής της πύλης προμηθευτή. */
export const VENDOR_PORTAL_SECRET_ENV = 'VENDOR_PORTAL_SECRET';

/**
 * Διάρκεια ζωής συνδέσμου — **ένας** αριθμός. Ζούσε τρεις φορές
 * (`vendor-portal-token-service` · `vendor-invite-service` · `rfq-service`).
 */
export const VENDOR_LINK_LIFETIME_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Πρόθεμα ID διαπιστευτηρίου — δεύτερος έλεγχος μορφής μετά την υπογραφή (όχι «μαντεψιά» τύπου). */
const CREDENTIAL_ID_PREFIX = 'vic_';

/** Πεδία συνδέσμου: `[credentialId, nonce, expiryMs]` — ΜΙΑ γραμματική (Φ7). */
const LINK_FIELD_COUNT = 3;

export function vendorLinkExpiryMs(nowMs: number, days: number = VENDOR_LINK_LIFETIME_DAYS): number {
  return nowMs + days * DAY_MS;
}

// =============================================================================
// ΕΚΔΟΣΗ
// =============================================================================

export interface MintVendorCredentialInput {
  readonly inviteId: string;
  readonly rfqId: string;
  readonly companyId: string;
  readonly issuedVia: VendorCredentialOrigin;
  readonly issuedBy: string | null;
  readonly nowIso: string;
  readonly expiresAtMs: number;
  readonly requesterIpHash?: string | null;
}

export interface MintedVendorCredential {
  /** Το έγγραφο προς εγγραφή — ο **καλών** γράφει, ώστε να μπει στο ίδιο batch/transaction. */
  readonly credential: VendorInviteCredential;
  /** Ο σύνδεσμος. Ζει μόνο στη μνήμη αυτής της κλήσης — **ποτέ** σε βάση ή log. */
  readonly token: string;
}

/**
 * **Νέος σύνδεσμος** για μια πρόσκληση. Καθαρή συνάρτηση (πλην τυχαιότητας): ο καλών αποφασίζει
 * πού και μαζί με τι γράφεται το έγγραφο.
 */
export async function mintVendorInviteCredential(
  input: MintVendorCredentialInput,
): Promise<MintedVendorCredential> {
  const id = generateVendorInviteCredentialId();
  const nonce = newTokenNonce();
  const token = encodeSignedToken(requireTokenSecret(VENDOR_PORTAL_SECRET_ENV), [
    id,
    nonce,
    // ΧΙΛΙΟΣΤΑ, ποτέ ISO — το ISO κουβαλά `:`, τον διαχωριστή πεδίων (ADR-327 §8.33).
    String(input.expiresAtMs),
  ]);
  const credential: VendorInviteCredential = {
    id,
    inviteId: input.inviteId,
    rfqId: input.rfqId,
    companyId: input.companyId,
    nonceHash: await sha256HexOfText(nonce),
    issuedVia: input.issuedVia,
    issuedBy: input.issuedBy,
    issuedAt: input.nowIso,
    expiresAt: new Date(input.expiresAtMs).toISOString(),
    lastUsedAt: null,
    revokedAt: null,
    revokedBy: null,
    requesterIpHash: input.requesterIpHash ?? null,
  };
  return { credential, token };
}

// =============================================================================
// ΑΝΑΓΝΩΣΗ ΣΥΝΔΕΣΜΟΥ (χωρίς βάση)
// =============================================================================

/** Τι λέει ο σύνδεσμος **πριν** αγγίξουμε τη βάση. */
export type ParsedVendorLink =
  | { readonly ok: true; readonly credentialId: string; readonly nonceHash: string }
  | { readonly ok: false; readonly reason: 'invalid_link' | 'server_config_error' };

/**
 * Υπογραφή → ID εγγράφου + hash του nonce. **Καμία** επαφή με βάση.
 *
 * ⚠️ Η λήξη **δεν** κρίνεται εδώ: αυθεντία είναι το `expiresAt` του εγγράφου (η αυτοεξυπηρέτηση
 * χρειάζεται να αναγνωρίσει και ληγμένο σύνδεσμο). Το πεδίο λήξης του συνδέσμου ελέγχεται μόνο
 * ως προς τη μορφή του.
 */
export async function parseVendorLink(token: string): Promise<ParsedVendorLink> {
  let secret: string;
  try {
    secret = requireTokenSecret(VENDOR_PORTAL_SECRET_ENV);
  } catch {
    return { ok: false, reason: 'server_config_error' };
  }
  const verdict = decodeSignedToken(secret, token, LINK_FIELD_COUNT);
  if (!verdict.ok) {
    return { ok: false, reason: verdict.reason === 'server-config' ? 'server_config_error' : 'invalid_link' };
  }
  // ⚠️ Το `decodeSignedToken` κρίνει «τουλάχιστον N» — η γραμματική εδώ είναι «ΑΚΡΙΒΩΣ N».
  if (verdict.fields.length !== LINK_FIELD_COUNT) return { ok: false, reason: 'invalid_link' };
  const [credentialId, nonce, expiryMs] = verdict.fields;
  if (!credentialId.startsWith(CREDENTIAL_ID_PREFIX) || !Number.isFinite(Number(expiryMs))) {
    return { ok: false, reason: 'invalid_link' };
  }
  return { ok: true, credentialId, nonceHash: await sha256HexOfText(nonce) };
}

/** Ταιριάζει το nonce του συνδέσμου με την έκδοση; — **σταθερός χρόνος**, πάντα. */
export function credentialMatches(credential: Pick<VendorInviteCredential, 'nonceHash'>, nonceHash: string): boolean {
  return equalsInConstantTime(nonceHash, credential.nonceHash);
}

/** Έληξε ο σύνδεσμος; Αυθεντία = το έγγραφο, όχι ο σύνδεσμος. */
export function isCredentialExpired(credential: Pick<VendorInviteCredential, 'expiresAt'>, nowMs: number): boolean {
  return Date.parse(credential.expiresAt) <= nowMs;
}
