/**
 * @fileoverview **ΟΙ ΔΥΟ ΠΡΑΞΕΙΣ ΤΟΥ ΓΡΑΦΕΙΟΥ** — ξαναστέλνω τον σύνδεσμο, ανακαλώ τον σύνδεσμο.
 * @related ADR-777 §8.34 · lib/mandate/mandate-actions.ts · services/mandate/mandate-invitation.service.ts
 * @module services/mandate/mandate-actions.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΜΙΑ ΝΕΑ ΚΑΤΑΣΤΑΣΗ — ΟΙ ΔΥΟ ΠΡΑΞΕΙΣ ΓΡΑΦΟΥΝ ΤΟ **ΙΔΙΟ** ΠΕΔΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Και οι δύο αλλάζουν **μόνο** το {@link BrokeredListingMandate.consentNonce}:
 * *ξαναστέλνω* γράφει **νέο**, *ανακαλώ* γράφει **`null`**. Δεν προστέθηκε ούτε πεδίο
 * «ακυρώθηκε», ούτε συλλογή ακυρωμένων συνδέσμων, ούτε κατάσταση κύκλου ζωής — γιατί
 * ο τύπος το είχε ήδη αποφασίσει: *«η **κατάσταση που αποφασίζει** είναι η κατάσταση
 * που **απαντά**… καμία απόκλιση δυνατή, γιατί δεν υπάρχει δεύτερο βιβλίο»* (ADR-749).
 *
 * ⚠️ Η πύλη προμηθευτή του ίδιου έργου κάνει το αντίθετο (δεύτερη συλλογή
 * `vendor_invite_tokens`). Εδώ **δεν** αντιγράφηκε, και το γιατί είναι γραμμένο στον
 * τύπο, όχι εδώ.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ «ΕΠΙΤΡΕΠΕΤΑΙ;» ΔΕΝ ΚΡΙΝΕΤΑΙ ΕΔΩ — ΚΑΙ ΕΙΝΑΙ ΤΟ ΚΥΡΙΟ ΣΧΕΔΙΑΣΤΙΚΟ ΣΗΜΕΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η οθόνη πρέπει να ξέρει **ποια κουμπιά να ζωγραφίσει**· ο διακομιστής πρέπει να
 * **επιβάλει** το ίδιο. Δύο υλοποιήσεις θα απέκλιναν, και οι δύο μορφές της απόκλισης
 * είναι σιωπηλές (κουμπί που αποτυγχάνει · κουμπί που λείπει). Άρα ο κριτής ζει σε
 * **καθαρό leaf** ({@link verdictFor}) και εδώ γίνεται μόνο **μετάφραση** της άρνησης
 * σε κωδικό δικτύου.
 *
 * ⚠️ **Ό,τι η κατάσταση ΔΕΝ αρκεί να απαντήσει μένει εδώ**: *«είναι του γραφείου
 * σου;»* και *«έχει η επαφή email;»*. Αυτά δεν προκύπτουν από την εντολή.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΠΟΙΟΣ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΤΙΣ ΚΑΝΕΙ — **ΤΟ ΓΡΑΦΕΙΟ**, ΟΧΙ Ο ΥΠΑΛΛΗΛΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η εξουσιοδότηση είναι `authorCompanyId === companyId`, **όχι** `authorUserId === uid`
 * — και είναι ο **κανόνας της αγοράς**, ήδη γραμμένος στο
 * `app/(app)/listings/mandates/new/page.tsx`: *«listings belong to the **broker**, not
 * the agent»*. Ένας έλεγχος uid εδώ θα σήμαινε ότι όταν ο υπάλληλος πάει διακοπές,
 * **κανείς** στο γραφείο δεν μπορεί να ξαναστείλει τον σύνδεσμο στον πελάτη — και το
 * μοντέλο έχει `authorCompanyId` ακριβώς ώστε *«ο κατάλογος του γραφείου να επιβιώνει
 * όταν ο υπάλληλος φύγει»*.
 *
 * ⚠️ **Το `companyId` έρχεται από το `ctx`, ΠΟΤΕ από το σώμα** — αλλιώς η
 * εξουσιοδότηση θα ήταν πεδίο που στέλνει ο φρουρούμενος.
 *
 * ⚠️ **`absent` και «ξένο γραφείο» δίνουν ΤΗΝ ΙΔΙΑ απάντηση**, σκόπιμα: μια ξεχωριστή
 * «δεν σου ανήκει» θα **επιβεβαίωνε** την ύπαρξη ξένου εγγράφου. Ίδιο σκεπτικό με το
 * 404 του `respondToWrite`.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import {
  verdictFor,
  type MandateAction,
  type MandateActionRejection,
} from '@/lib/mandate/mandate-actions';
import { mandateStandingOf } from '@/lib/mandate/mandate-standing';
import { issueMandateConsentLink } from '@/services/mandate/mandate-consent.service';
import {
  sendMandateInvitation,
  type NotifyOutcome,
} from '@/services/mandate/mandate-invitation.service';
import { setOwnerPropertyMandate } from '@/services/owner-property/owner-property-write.service';
import type { OwnerProperty } from '@/types/owner-property';
import {
  AGENCY_ATTESTATION,
  type BrokeredListingMandate,
} from '@/types/owner-property-mandate';

/**
 * ⚠️ **Επανεξάγονται επίτηδες.** Ο διακομιστής είναι το σημείο που *επιβάλλει* τις
 * πράξεις, οπότε ο καλών της διαδρομής δεν πρέπει να ξέρει σε ποιο leaf module ζει το
 * λεξιλόγιο. Η **μία** δήλωση είναι στο `lib/mandate/mandate-actions.ts`.
 */
export {
  MANDATE_ACTIONS,
  isMandateAction,
  type MandateAction,
  type MandateActionRejection,
} from '@/lib/mandate/mandate-actions';

export type MandateActionOutcome =
  | { readonly ok: true; readonly action: 'resend'; readonly notify: NotifyOutcome }
  | { readonly ok: true; readonly action: 'revoke' }
  | { readonly ok: false; readonly reason: MandateActionRejection };

/** Ό,τι κοινό κάνουν οι δύο πράξεις **πριν** αγγίξουν οτιδήποτε. */
type Prepared =
  | { readonly ok: true; readonly property: OwnerProperty; readonly mandate: BrokeredListingMandate }
  | { readonly ok: false; readonly reason: MandateActionRejection };

/**
 * **Βρες την αγγελία του γραφείου και κρίνε αν η κατάσταση δέχεται την πράξη.**
 *
 * 🔑 Εξήχθη γιατί οι δύο πράξεις κάνουν **ακριβώς** τα ίδια τρία βήματα (ανάγνωση ·
 * εξουσιοδότηση · ετυμηγορία κατάστασης) — γραμμένα δύο φορές θα ήταν αδελφός κλώνος
 * (N.18 / CHECK 3.28) και, χειρότερα, η μία θα ξεχνούσε τον έλεγχο εταιρείας.
 */
async function prepare(
  adminDb: AdminFirestore,
  ownerPropertyId: string,
  companyId: string,
  action: MandateAction,
  nowISOValue: string,
): Promise<Prepared> {
  const snapshot = await adminDb
    .collection(COLLECTIONS.OWNER_PROPERTIES)
    .doc(ownerPropertyId)
    .get();

  const stored = snapshot.data() as OwnerProperty | undefined;
  if (stored === undefined || stored.authorCompanyId !== companyId) {
    return { ok: false, reason: 'absent' };
  }
  if (stored.mandate.kind !== 'brokered') return { ok: false, reason: 'not-brokered' };

  const mandate: BrokeredListingMandate = stored.mandate;
  const verdict = verdictFor(action, mandateStandingOf(mandate, nowISOValue));
  if (!verdict.allowed) return { ok: false, reason: verdict.refusal };

  return { ok: true, property: { ...stored, id: snapshot.id }, mandate };
}

/**
 * **Ξαναστέλνει τον σύνδεσμο** — νέα ταυτότητα πρόσκλησης, νέο μήνυμα.
 *
 * 🔑 **Το είδος του μηνύματος ακολουθεί τη ΠΡΟΕΛΕΥΣΗ, όχι την πράξη.** Στη βεβαίωση
 * γραφείου φεύγει **ειδοποίηση αντίρρησης**, όχι αίτημα έγκρισης — γιατί η εντολή
 * είναι ήδη `confirmed` και ένα «εγκρίνετε;» θα έλεγε ψέματα για το τι ζητάμε.
 */
export async function resendMandateInvitation(
  adminDb: AdminFirestore,
  ownerPropertyId: string,
  companyId: string,
  agencyName: string,
  nowISOValue: string,
): Promise<MandateActionOutcome> {
  const prepared = await prepare(adminDb, ownerPropertyId, companyId, 'resend', nowISOValue);
  if (!prepared.ok) return { ok: false, reason: prepared.reason };

  const { property, mandate } = prepared;
  const link = issueMandateConsentLink(ownerPropertyId, mandate.clientContactId);

  const notify = await sendMandateInvitation(
    adminDb,
    mandate.proof.via === AGENCY_ATTESTATION ? 'attestation-notice' : 'consent-request',
    {
      clientContactId: mandate.clientContactId,
      agencyName,
      listingTitle: property.title,
      expiresAt: mandate.expiresAt,
      token: link.token,
      idempotencyKey: `mandate-consent:${link.nonce}`,
    },
  );

  // 🔴 **Ο ΝΕΟΣ ΣΥΝΔΕΣΜΟΣ ΓΡΑΦΕΤΑΙ ΜΟΝΟ ΑΝ ΤΟ ΜΗΝΥΜΑ ΕΦΥΓΕ — ΚΑΙ ΕΙΝΑΙ ΤΟ ΚΡΙΣΙΜΟ
  // ΣΗΜΕΙΟ ΟΛΗΣ ΤΗΣ ΠΡΑΞΗΣ.** Η νέα ταυτότητα **ακυρώνει** την προηγούμενη: αν τη
  // γράφαμε πριν βεβαιωθούμε ότι έφυγε μήνυμα, μια αποτυχία αποστολής θα σκότωνε τον
  // σύνδεσμο που ο Κώστας **κρατά ήδη στα χέρια του**, χωρίς να του δώσει νέο. Το
  // «ξαναστείλε» θα κατέστρεφε ακριβώς αυτό που υπόσχεται να επισκευάσει.
  //
  // ⚠️ **Οι δύο αποτυχίες ΔΕΝ είναι μία.** «Δεν έχει email» είναι κατάσταση του
  // κόσμου με **συγκεκριμένη θεραπεία**· «δεν μπήκε στην ουρά» είναι δικό μας
  // πρόβλημα με θεραπεία «ξαναδοκίμασε». Ένας κοινός κωδικός θα έστελνε τον μεσίτη να
  // πατά το κουμπί ξανά και ξανά για επαφή που **δεν έχει πού να λάβει**.
  if (notify.kind === 'no-address') return { ok: false, reason: 'no-address' };
  if (notify.kind !== 'sent') return { ok: false, reason: 'write-failed' };

  const written = await setOwnerPropertyMandate(adminDb, ownerPropertyId, {
    ...mandate,
    consentNonce: link.nonce,
    notifiedAt: nowISO(),
    // ⚠️ **Το `viewedAt` μηδενίζεται, και είναι σωστό**: το «το είδε» αφορούσε την
    // **προηγούμενη** πρόσκληση, που μόλις έπαψε να ισχύει. Κρατώντας το, ο κατάλογος
    // θα έλεγε «το διάβασε και σιωπά» για μήνυμα που **μόλις** στάλθηκε.
    viewedAt: null,
  });

  return written.kind === 'saved'
    ? { ok: true, action: 'resend', notify }
    : { ok: false, reason: 'write-failed' };
}

/**
 * **Ανακαλεί τον σύνδεσμο** — η πρόσκληση παύει να ισχύει.
 *
 * 🔑 **Η ανάκληση ΔΕΝ κατεβάζει την αγγελία, γιατί δεν χρειάζεται**: μια εκκρεμής
 * εντολή **δεν έχει καμία διάθεση στην αγορά** ήδη ({@link mandateAllowsPublication}) —
 * δεν υπάρχει τίποτα δημόσιο να σβηστεί. Ένα δεύτερο «κατέβασέ την» εδώ θα ήταν
 * δεύτερος κριτής δημοσίευσης.
 */
export async function revokeMandateInvitation(
  adminDb: AdminFirestore,
  ownerPropertyId: string,
  companyId: string,
  nowISOValue: string,
): Promise<MandateActionOutcome> {
  const prepared = await prepare(adminDb, ownerPropertyId, companyId, 'revoke', nowISOValue);
  if (!prepared.ok) return { ok: false, reason: prepared.reason };

  const written = await setOwnerPropertyMandate(adminDb, ownerPropertyId, {
    ...prepared.mandate,
    consentNonce: null,
  });

  return written.kind === 'saved'
    ? { ok: true, action: 'revoke' }
    : { ok: false, reason: 'write-failed' };
}
