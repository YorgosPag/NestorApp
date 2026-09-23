/**
 * @fileoverview **Η ΑΛΥΣΙΔΑ ΠΟΥ ΑΝΟΙΓΕΙ ΤΗΝ ΠΡΟΣΚΛΗΣΗ** — μία φορά, για τα δύο ρήματα.
 * @related ADR-327 §11 · api/vendor/quote/[token]/route.ts · ./parsing.ts
 * @module app/api/vendor/quote/[token]/open-invite
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ΤΟ `GET` ΚΑΙ ΤΟ `POST` ΕΓΡΑΦΑΝ ΤΗΝ ΙΔΙΑ ΑΛΥΣΙΔΑ, ΔΥΟ ΦΟΡΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Και τα δύο ρήματα κάνουν **τα ίδια πέντε βήματα** πριν αγγίξουν τη δουλειά τους:
 * υπάρχει context · αποκωδικοποίησε το token · επικύρωσέ το · βρες την πρόσκληση ·
 * απόρριψε ανακληθείσα ή ληγμένη. Μετρημένο από το CHECK 3.28 (ADR-583) ως **κλώνος
 * 9 γραμμών / 63 tokens μέσα στο ίδιο αρχείο**.
 *
 * 🔑 **Ο ΔΙΔΥΜΟΣ ΚΩΔΙΚΑΣ ΔΕΝ ΕΙΝΑΙ ΑΙΣΘΗΤΙΚΟ ΠΡΟΒΛΗΜΑ ΕΔΩ — ΕΙΝΑΙ ΦΡΟΥΡΟΣ.** Η
 * αλυσίδα είναι το **σύνορο ασφαλείας** της δημόσιας πύλης (καμία ταυτότητα Firebase·
 * ο προμηθευτής **είναι** το token). Δύο αντίγραφα σημαίνει ότι η επόμενη αλλαγή —
 * ένα νέο `status` που πρέπει να απορρίπτεται — θα γραφτεί στο ένα και θα ξεχαστεί
 * στο άλλο, σιωπηλά, με το ρήμα που ξεχάστηκε να **δέχεται** ό,τι το άλλο αρνείται.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΙ ΜΕΝΕΙ ΠΑΡΑΜΕΤΡΟΣ, ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΕΝΩΝΕΤΑΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * · **Η επικύρωση.** Το `GET` ελέγχει **μόνο υπογραφή** (`…TokenSignature`), το `POST`
 *   κάνει **πλήρη** επικύρωση (`validateVendorPortalToken`, nonce κ.λπ.). Είναι
 *   **σκόπιμα διαφορετικά**: η ανάγνωση δεν επιτρέπεται να καίει nonce. Μια ενιαία
 *   «πιο αυστηρή» επικύρωση θα έσπαγε το άνοιγμα του συνδέσμου· μια «πιο χαλαρή» θα
 *   άνοιγε την υποβολή. Γι' αυτό περνιέται, δεν αποφασίζεται εδώ.
 *
 * · **Το σώμα του `declined`.** Το `GET` επιστρέφει `{ status: 'declined' }` ώστε η
 *   οθόνη να δείξει **γιατί**· το `POST` επιστρέφει σκέτο 410. Διατηρείται όπως ήταν
 *   — η ενοποίηση αφορά τη **ροή**, όχι το λεξιλόγιο των απαντήσεων.
 */

import 'server-only';

import type { NextResponse } from 'next/server';

import { decodeRouteParam } from '@/lib/routes/route-param';

import type { VendorPortalTokenValidation } from '@/services/vendor-portal/vendor-portal-token-service';
import { getVendorInviteByToken } from '@/subapps/procurement/services/vendor-invite-service';

import { jsonError } from './parsing';

/**
 * Η πρόσκληση όπως τη δίνει το SSoT — **παραγόμενος** τύπος, ποτέ ξαναγραμμένος.
 * Δεύτερη δήλωση εδώ θα ήταν αντίγραφο που παλιώνει χωρίς να το πει κανείς.
 */
export type VendorInviteDoc = NonNullable<Awaited<ReturnType<typeof getVendorInviteByToken>>>;

/** Η επικύρωση, **περασμένη**: το κάθε ρήμα φέρνει τη δική του αυστηρότητα. */
export type VendorTokenValidator = (
  token: string,
) => VendorPortalTokenValidation | Promise<VendorPortalTokenValidation>;

/**
 * **Ανοιχτή πρόσκληση, ή η άρνηση με το όνομά της.** Διακριτή ένωση και όχι
 * `invite | null`: το `null` θα ισοπέδωνε **τέσσερις** διαφορετικές αρνήσεις
 * (κακό token · δεν βρέθηκε · ανακλήθηκε · έληξε) σε μία σιωπή.
 */
export type OpenInviteOutcome =
  | { readonly ok: true; readonly token: string; readonly invite: VendorInviteDoc }
  | { readonly ok: false; readonly response: NextResponse };

/**
 * **Άνοιξε την πρόσκληση αυτού του συνδέσμου** — ή πες γιατί όχι.
 *
 * @param context — το `params` της διαδρομής· `undefined` σημαίνει ότι το Next δεν
 *   έδωσε συμφραζόμενα, δηλαδή **δικό μας** σφάλμα (500), όχι του καλούντα.
 * @param validate — η επικύρωση του ρήματος. Δες την κεφαλίδα για το γιατί.
 * @param declinedExtra — προαιρετικό σώμα για την ανακληθείσα πρόσκληση.
 */
export async function openVendorInvite(
  context: { params: Promise<{ token: string }> } | undefined,
  validate: VendorTokenValidator,
  declinedExtra?: Readonly<Record<string, string>>,
): Promise<OpenInviteOutcome> {
  if (!context) return { ok: false, response: jsonError('missing_context', 500) };

  const { token: rawToken } = await context.params;
  // ADR-876 — SSoT: ωμό `decodeURIComponent` πετά σε κακό `%` ⇒ 500 αντί για «άκυρος σύνδεσμος».
  const token = decodeRouteParam(rawToken);

  // 🔴 **ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΑΝΑΓΝΩΣΗ FIRESTORE** (ADR-327 §11): πλαστό token δεν
  //    πληρώνει ποτέ διαδρομή βάσης.
  const verdict = await validate(token);
  if (!verdict.valid) return { ok: false, response: jsonError(verdict.reason, 400) };

  const invite = await getVendorInviteByToken(token);
  if (!invite) return { ok: false, response: jsonError('invite_not_found', 404) };
  if (invite.status === 'declined') {
    return { ok: false, response: jsonError('token_revoked', 410, declinedExtra) };
  }
  if (invite.status === 'expired') {
    return { ok: false, response: jsonError('token_expired', 410) };
  }

  return { ok: true, token, invite };
}
