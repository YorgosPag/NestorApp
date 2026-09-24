/**
 * =============================================================================
 * MIGRATION: ωμό `vendor_invites.token` → διαπιστευτήριο `legacy` (ADR-876 §5 Φ6) — ο ΣΧΕΔΙΑΣΤΗΣ
 * =============================================================================
 *
 * Καθαρή απόφαση ανά πρόσκληση, χωρίς βάση (το I/O ζει στο
 * `scripts/migrations/migrate-vendor-invite-credentials.ts`). Ανά έγγραφο:
 *
 *  · έχει `token` με έγκυρη υπογραφή παλιάς μορφής (4 πεδία) ⇒ διαπιστευτήριο `legacy` με
 *    **ντετερμινιστικό** ID από το sha256(nonce) — ο ίδιος υπολογισμός με τον αναγνώστη
 *    (`parseVendorLink`), άρα ο σύνδεσμος που κρατά ο προμηθευτής **συνεχίζει να ανοίγει**·
 *  · ανάκληση: από τη λίστα `vendor_invite_tokens` (κατά nonce) **ή** από `status: 'expired'`
 *    (ο μόνος γραφέας του ήταν η ανάκληση) ⇒ `revokedAt` στο διαπιστευτήριο + `status: 'revoked'`·
 *  · `token` που δεν επαληθεύεται (άλλο περιβάλλον / αλλοιωμένο) ⇒ **σβήνεται** χωρίς διαπιστευτήριο:
 *    δεν ανοίγει ούτως ή άλλως, και ένα ωμό μυστικό δεν μένει σε έγγραφο που διαβάζει κάθε μέλος.
 *
 * 🔑 **Ιδεμποτία**: ID ντετερμινιστικό + μετά την εγγραφή το έγγραφο δεν έχει `token` ούτε `'expired'`
 * ⇒ δεύτερο τρέξιμο = `noop`. Η αναφορά λέει τη **μέγιστη λήξη** ζωντανού παλιού συνδέσμου — από
 * εκείνη την ημέρα και μετά αποσύρεται ο κλάδος legacy (Φ7).
 *
 * @module services/vendor-portal/vendor-invite-credential-migration
 * @enterprise ADR-876 §5
 */

import 'server-only';

import { sha256HexOfText } from '@/lib/hash/sha256';
import { decodeSignedToken } from '@/lib/tokens/signed-token';
import { generateLegacyVendorInviteCredentialId } from '@/services/enterprise-id.service';
import type { VendorInviteCredential } from '@/subapps/procurement/types/vendor-invite-credential';

/** Ό,τι διαβάζει ο σχεδιαστής από ένα έγγραφο `vendor_invites` (ωμά, πριν από κάθε κανονικοποίηση). */
export interface LegacyInviteRecord {
  readonly id: string;
  readonly rfqId: string;
  readonly companyId: string;
  readonly status: string;
  readonly token?: unknown;
  readonly createdAtIso: string | null;
}

export type LegacyInvitePlan =
  | { readonly kind: 'noop' }
  | { readonly kind: 'status_only' }
  | { readonly kind: 'strip_unverifiable'; readonly revoke: boolean }
  | {
      readonly kind: 'migrate';
      readonly credential: VendorInviteCredential;
      readonly revoke: boolean;
    };

export interface MigrationContext {
  readonly secret: string;
  readonly nowIso: string;
  /** Τα nonces που η λίστα ανάκλησης `vendor_invite_tokens` σημειώνει `revoked`. */
  readonly revokedNonces: ReadonlySet<string>;
}

const LEGACY_FIELDS = 4;

export async function planLegacyInvite(record: LegacyInviteRecord, ctx: MigrationContext): Promise<LegacyInvitePlan> {
  const revokedByStatus = record.status === 'expired';
  if (typeof record.token !== 'string' || record.token.length === 0) {
    return revokedByStatus ? { kind: 'status_only' } : { kind: 'noop' };
  }

  const verdict = decodeSignedToken(ctx.secret, record.token, LEGACY_FIELDS);
  if (!verdict.ok || verdict.fields.length !== LEGACY_FIELDS) {
    return { kind: 'strip_unverifiable', revoke: revokedByStatus };
  }
  const [, , nonce, expiryMs] = verdict.fields;
  const expiry = Number(expiryMs);
  if (!Number.isFinite(expiry)) return { kind: 'strip_unverifiable', revoke: revokedByStatus };

  const nonceHash = await sha256HexOfText(nonce);
  const revoke = revokedByStatus || ctx.revokedNonces.has(nonce);
  const credential: VendorInviteCredential = {
    id: generateLegacyVendorInviteCredentialId(nonceHash),
    inviteId: record.id,
    rfqId: record.rfqId,
    companyId: record.companyId,
    nonceHash,
    issuedVia: 'legacy',
    issuedBy: null,
    issuedAt: record.createdAtIso ?? ctx.nowIso,
    expiresAt: new Date(expiry).toISOString(),
    lastUsedAt: null,
    revokedAt: revoke ? ctx.nowIso : null,
    revokedBy: null,
    requesterIpHash: null,
  };
  return { kind: 'migrate', credential, revoke };
}

export interface MigrationReport {
  readonly total: number;
  readonly migrate: number;
  readonly statusOnly: number;
  readonly stripped: number;
  readonly noop: number;
  /** Η μέγιστη λήξη **ζωντανού** παλιού συνδέσμου — η ημερομηνία απόσυρσης του κλάδου legacy. */
  readonly maxLiveLegacyExpiry: string | null;
}

export function summarizeMigration(plans: readonly LegacyInvitePlan[], nowIso: string): MigrationReport {
  let maxLive: string | null = null;
  for (const plan of plans) {
    if (plan.kind !== 'migrate' || plan.revoke || plan.credential.expiresAt <= nowIso) continue;
    if (maxLive === null || plan.credential.expiresAt > maxLive) maxLive = plan.credential.expiresAt;
  }
  const count = (kind: LegacyInvitePlan['kind']) => plans.filter((p) => p.kind === kind).length;
  return {
    total: plans.length,
    migrate: count('migrate'),
    statusOnly: count('status_only'),
    stripped: count('strip_unverifiable'),
    noop: count('noop'),
    maxLiveLegacyExpiry: maxLive,
  };
}
