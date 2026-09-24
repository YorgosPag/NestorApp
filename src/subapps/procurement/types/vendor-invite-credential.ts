/**
 * =============================================================================
 * VENDOR INVITE CREDENTIAL — «ένας σύνδεσμος = ένα διαπιστευτήριο» (ADR-876 §5)
 * =============================================================================
 *
 * Κάθε σύνδεσμος πύλης που εκδίδεται για μια πρόσκληση (email πρόσκλησης · αντιγραφή ·
 * επαναποστολή · αυτοεξυπηρέτηση λήξης) είναι **ξεχωριστό** έγγραφο στη server-only
 * συλλογή `vendor_invite_credentials` (κανόνες: `read/write: if false`).
 *
 * 🔑 **Ποτέ το μυστικό** — μόνο `nonceHash` (sha256 του nonce του συνδέσμου). Ο σύνδεσμος
 * **δεν αποκαλύπτεται ξανά** μετά την έκδοση (DocuSign · GitHub): όποιος χρειάζεται
 * σύνδεσμο παίρνει **νέο**, με δικό του `issuedVia` και δική του ανάκληση (W3C TAG,
 * *Good Practices for Capability URLs* — στοχευμένη ανάκληση ανά σύνδεσμο).
 *
 * @module subapps/procurement/types/vendor-invite-credential
 * @enterprise ADR-876 §5 · ADR-327 §7/§11
 */

/**
 * **Από πού γεννήθηκε ο σύνδεσμος** — κλειστό σύνολο, γιατί ο PM ανακαλεί **έναν** και
 * πρέπει να ξέρει ποιον.
 *
 * ⚠️ Δεν υπάρχει προέλευση «παλιός σύνδεσμος»: η παλιά μορφή (4 πεδία, ωμό token στο
 * `vendor_invites`) αποσύρθηκε ολόκληρη στη Φ7 του ADR-876 §5 — μία γραμματική συνδέσμου.
 */
export const VENDOR_CREDENTIAL_ORIGINS = [
  'invite_email',
  'rfq_fanout',
  'copy_link',
  'email_resend',
  'self_service',
] as const;

export type VendorCredentialOrigin = (typeof VENDOR_CREDENTIAL_ORIGINS)[number];

/** Το έγγραφο στη βάση — **server-only**. Χρόνοι σε ISO (όπως `workspace_invitations`). */
export interface VendorInviteCredential {
  id: string;
  inviteId: string;
  rfqId: string;
  /** Φράχτης μισθωτή — κάθε ανάγνωση ανά πρόσκληση φιλτράρει ΠΡΩΤΑ με αυτό. */
  companyId: string;
  /** sha256(nonce) σε hex· συγκρίνεται **σε σταθερό χρόνο** (`equalsInConstantTime`). */
  nonceHash: string;
  issuedVia: VendorCredentialOrigin;
  /** uid μέλους· `null` όταν ο σύνδεσμος ζητήθηκε από τον ίδιο τον προμηθευτή. */
  issuedBy: string | null;
  issuedAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  /** Μόνο για `self_service`: αποτύπωμα IP του αιτούντος (ποτέ η ίδια η IP). */
  requesterIpHash: string | null;
}

/**
 * Ό,τι βλέπει το γραφείο για έναν σύνδεσμο — **χωρίς** hash, χωρίς κανένα υλικό που
 * φτιάχνει σύνδεσμο. Η λίστα απαντά «ποιοι σύνδεσμοι υπάρχουν, από πού, ζουν;».
 */
export interface VendorInviteCredentialSummary {
  id: string;
  issuedVia: VendorCredentialOrigin;
  issuedBy: string | null;
  issuedAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/**
 * **Γιατί δεν άνοιξε η πύλη** — ΕΝΑ λεξιλόγιο για κωδικό απάντησης API **και** λόγο οθόνης
 * (`VendorPortalErrorState`). Ζει εδώ (ασφαλές για client) και το καταναλώνει ο αναλυτής του server.
 */
export const VENDOR_INVITE_REFUSALS = [
  'invalid_link',
  'server_config_error',
  'link_not_found',
  'link_revoked',
  'link_expired',
  'invite_revoked',
  'invite_declined',
  'already_submitted',
  'edit_window_closed',
] as const;

export type VendorInviteRefusal = (typeof VENDOR_INVITE_REFUSALS)[number];

/** Κωδικός σφάλματος από το API → γνωστή άρνηση, ή `null` (ποτέ τυφλό cast σε άγνωστο κείμενο). */
export function asVendorInviteRefusal(value: unknown): VendorInviteRefusal | null {
  return VENDOR_INVITE_REFUSALS.find((known) => known === value) ?? null;
}
