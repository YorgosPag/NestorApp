/**
 * =============================================================================
 * Ο ΑΝΑΛΥΤΗΣ ΠΡΟΣΚΛΗΣΗΣ — σύνδεσμος + σκοπός → πρόσκληση ή ΟΝΟΜΑΣΜΕΝΗ άρνηση (ADR-876 §5)
 * =============================================================================
 *
 * 🔴 **Γιατί υπάρχει (Ε5 · Σ4 · Σ5)**: η αλυσίδα «άνοιξε την πρόσκληση» ήταν γραμμένη **τρεις**
 * φορές — `api/…/open-invite.ts`, η σελίδα, το `decline/route.ts` — και είχαν αποκλίνει: η σελίδα
 * δεν κοιτούσε ανάκληση, το decline δεχόταν **ληγμένη** πρόσκληση, και η άρνηση του ίδιου του
 * προμηθευτή εμφανιζόταν ως «ανακλήθηκε». Κάθε νέα κατάσταση θα γραφόταν στο ένα αντίγραφο και θα
 * ξεχνιόταν στα άλλα, με το ξεχασμένο να **δέχεται** ό,τι τα άλλα αρνούνται.
 *
 * Τώρα η ερώτηση απαντιέται **εδώ, μία φορά**, με τον **σκοπό** ως παράμετρο:
 *
 * | σκοπός   | ληγμένος σύνδεσμος | υποβεβλημένη          | αρνημένη          |
 * |----------|--------------------|-----------------------|-------------------|
 * | `read`   | άρνηση             | δεκτή (προβολή/edit)  | άρνηση            |
 * | `submit` | άρνηση             | μόνο με ανοιχτό παράθυρο | άρνηση         |
 * | `decline`| άρνηση             | άρνηση (409)          | άρνηση (ιδεμποτ.) |
 * | `renew`  | **δεκτός**         | άρνηση                | άρνηση            |
 *
 * Ανακλημένος σύνδεσμος ή ανακλημένη πρόσκληση ⇒ **πάντα** άρνηση, για **κάθε** σκοπό.
 *
 * @module subapps/procurement/services/vendor-invite-resolver
 * @enterprise ADR-876 §5 · ADR-327 §11
 */

import 'server-only';

import { COLLECTIONS } from '@/config/firestore-collections';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { checkVendorCredential } from '@/services/vendor-portal/vendor-invite-credential-store';

import type { VendorInvite } from '../types/vendor-invite';
import type { VendorInviteCredential, VendorInviteRefusal } from '../types/vendor-invite-credential';
import { normalizeInviteStatus } from '../utils/vendor-invite-status';

export type { VendorInviteRefusal };

export type VendorInvitePurpose = 'read' | 'submit' | 'decline' | 'renew';

export type VendorInviteResolution =
  | {
      readonly ok: true;
      readonly invite: VendorInvite;
      readonly credential: VendorInviteCredential;
      readonly linkExpired: boolean;
    }
  | { readonly ok: false; readonly reason: VendorInviteRefusal };

function refuse(reason: VendorInviteRefusal): VendorInviteResolution {
  return { ok: false, reason };
}

async function loadInvite(credential: VendorInviteCredential): Promise<VendorInvite | null> {
  const snap = await getAdminFirestore().collection(COLLECTIONS.VENDOR_INVITES).doc(credential.inviteId).get();
  if (!snap.exists) return null;
  // Φράχτης μισθωτή: διαπιστευτήριο και πρόσκληση πρέπει να λένε την ΙΔΙΑ, ΜΗ ΚΕΝΗ εταιρεία
  // (ωμό έγγραφο βάσης ⇒ ο φύλακας payload — ADR-876 §5 Σ15).
  if (!isPayloadOwnedByCompany(snap.data(), credential.companyId)) return null;
  const invite = { id: snap.id, ...snap.data() } as VendorInvite;
  return { ...invite, status: normalizeInviteStatus(invite.status) };
}

/**
 * **Ανακλημένος σύνδεσμος: ΓΙΑΤΙ;** (ADR-876 §5 Σ21). Η ανάκληση πρόσκλησης ανακαλεί και ΟΛΟΥΣ τους
 * συνδέσμους της — χωρίς αυτή την ερώτηση ο προμηθευτής διάβαζε «ο σύνδεσμος ανακλήθηκε» αντί για
 * «η πρόσκληση αποσύρθηκε» (επαληθευμένο στον browser). Πηγή αλήθειας = η κατάσταση της πρόσκλησης·
 * καμία δεύτερη σημαία στο διαπιστευτήριο. Μία ανάγνωση, μόνο σε αυθεντικό (υπογεγραμμένο + hash) σύνδεσμο.
 */
async function revokedLinkReason(credential: VendorInviteCredential): Promise<VendorInviteRefusal> {
  const invite = await loadInvite(credential);
  return invite?.status === 'revoked' ? 'invite_revoked' : 'link_revoked';
}

function isEditWindowOpen(invite: VendorInvite, nowMs: number): boolean {
  return !!invite.editWindowExpiresAt && invite.editWindowExpiresAt.toMillis() > nowMs;
}

/** Η πολιτική του πίνακα της κεφαλίδας — καθαρή, χωρίς βάση (δοκιμάζεται μόνη της). */
export function judgeVendorInvite(
  invite: VendorInvite,
  linkExpired: boolean,
  purpose: VendorInvitePurpose,
  nowMs: number,
): VendorInviteRefusal | null {
  if (invite.status === 'revoked') return 'invite_revoked';
  if (invite.status === 'declined') return 'invite_declined';
  if (linkExpired && purpose !== 'renew') return 'link_expired';
  if (invite.status !== 'submitted') return null;
  if (purpose === 'read') return null;
  if (purpose === 'submit') return isEditWindowOpen(invite, nowMs) ? null : 'edit_window_closed';
  return 'already_submitted';
}

/** Τα ρήματα που η πύλη **προσφέρει** — ό,τι δεν επιτρέπεται εδώ, δεν εμφανίζεται ως κουμπί. */
export interface VendorInvitePermits {
  readonly submit: boolean;
  readonly decline: boolean;
}

/**
 * **Τι μπορεί να κάνει ο προμηθευτής ΤΩΡΑ**, από τον ΙΔΙΟ πίνακα που κρίνει το αίτημα (ADR-876 §5 Σ16).
 * Ο client δεν ξαναγράφει την πολιτική: έδειχνε «Άρνηση» σε υποβεβλημένη προσφορά, που ο server
 * απέρριπτε με `already_submitted`. Καλείται ΜΟΝΟ για ανοιγμένη πρόσκληση (ζωντανός σύνδεσμος).
 */
export function vendorInvitePermits(invite: VendorInvite, nowMs: number): VendorInvitePermits {
  return {
    submit: judgeVendorInvite(invite, false, 'submit', nowMs) === null,
    decline: judgeVendorInvite(invite, false, 'decline', nowMs) === null,
  };
}

/**
 * **Σύνδεσμος → πρόσκληση**, για συγκεκριμένο σκοπό. Υπογραφή πρώτα (πλαστό = μηδέν βάση),
 * μετά διαπιστευτήριο, μετά πρόσκληση, μετά πολιτική.
 */
export async function resolveVendorInvite(
  token: string,
  purpose: VendorInvitePurpose,
  nowMs: number = Date.now(),
): Promise<VendorInviteResolution> {
  const check = await checkVendorCredential(token, nowMs);
  if (!check.ok) return refuse(check.reason === 'link_revoked' ? await revokedLinkReason(check.credential) : check.reason);
  const invite = await loadInvite(check.credential);
  if (!invite) return refuse('link_not_found');
  const refusal = judgeVendorInvite(invite, check.expired, purpose, nowMs);
  if (refusal) return refuse(refusal);
  return { ok: true, invite, credential: check.credential, linkExpired: check.expired };
}
