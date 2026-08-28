/**
 * @fileoverview **Η ΚΑΤΑΧΩΡΗΣΗ ΓΙΑ ΛΟΓΑΡΙΑΣΜΟ ΠΕΛΑΤΗ** — η πράξη του μεσίτη, ολόκληρη.
 * @related ADR-777 §8.33 · services/owner-property/owner-property-write.service.ts
 * @module services/mandate/brokered-listing.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΕΣΣΕΡΑ ΒΗΜΑΤΑ, ΚΑΙ Η ΣΕΙΡΑ ΤΟΥΣ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **Ο σύνδεσμος εκδίδεται πρώτος** — καθαρή πράξη, καμία γραφή. Έτσι το `nonce`
 *    υπάρχει **μέσα** στην εντολή τη στιγμή που γεννιέται το έγγραφο· ένας σύνδεσμος
 *    που εκδιδόταν μετά θα άφηνε παράθυρο όπου το μήνυμα έχει φύγει και η εντολή
 *    δεν τον αναγνωρίζει.
 * 2. **Το έγγραφο γράφεται** (μαζί με τη δημόσια προβολή, στην ίδια πράξη).
 * 3. **Το μήνυμα φεύγει.**
 * 4. **Το `notifiedAt` γράφεται ΜΟΝΟ αν το μήνυμα μπήκε στην ουρά.**
 *
 * ⚠️ **Το βήμα 4 είναι ξεχωριστή γραφή, και είναι σκόπιμο.** Ένα `notifiedAt`
 * γραμμένο μαζί με το έγγραφο θα ισχυριζόταν *«τον ειδοποιήσαμε»* **πριν** φύγει
 * οτιδήποτε — και θα το ισχυριζόταν **με ημερομηνία**, δηλαδή πειστικά. Η επιλογή
 * είναι να **υποτιμούμε** ποτέ να υπερτιμούμε: αν το βήμα 4 αποτύχει, το πεδίο μένει
 * `null` και το γραφείο βλέπει «δεν ειδοποιήθηκε», που είναι η ασφαλής αναλήθεια.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΚΑΜΙΑ ΝΕΑ ΜΗΧΑΝΗ — ΤΕΣΣΕΡΑ ΥΠΑΡΧΟΝΤΑ SSoT
 * ────────────────────────────────────────────────────────────────────────────
 *
 * γραφή+δημοσίευση `owner-property-write.service` · υπογραφή `lib/tokens/signed-token` ·
 * αποστολή `server/comms/orchestrator` (Resend → Mailgun, με ουρά και idempotency) ·
 * λόγια ανά γλώσσα `mandate-email-texts` (πρότυπο §8.29).
 *
 * **Layering**: service — Admin SDK + orchestrator. Η **κρίση** ζει στους τύπους.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { nowISO } from '@/lib/date-local';
import { issueMandateConsentLink } from '@/services/mandate/mandate-consent.service';
import {
  sendMandateInvitation,
  type NotifyOutcome,
} from '@/services/mandate/mandate-invitation.service';
import {
  createOwnerProperty,
  setOwnerPropertyMandate,
  type OwnerPropertyWriteResult,
} from '@/services/owner-property/owner-property-write.service';
import type { BrokerageAuthority } from '@/lib/auth/brokerage-authority';
import type { ListingAgreement } from '@/types/listing-agreement';
import type { OwnerPropertyDraft } from '@/types/owner-property';
import {
  AGENCY_ATTESTATION,
  initialConfirmationFor,
  OWNER_CONSENT,
  type BrokeredListingMandate,
  type MandateCompensation,
  type MandateProof,
} from '@/types/owner-property-mandate';

// =============================================================================
// 1. ΤΟ ΑΙΤΗΜΑ ΤΟΥ ΜΕΣΙΤΗ
// =============================================================================

/** Ό,τι δηλώνει ο μεσίτης **πέρα** από το ακίνητο. */
export interface BrokeredMandateRequest {
  readonly clientContactId: string;
  readonly expiresAt: string;
  readonly proof: MandateProof;
  /** Τι είδους εντολή — RESO `ListingAgreement` (ADR-827 §3.1). */
  readonly agreement: ListingAgreement;
  /** Οι όροι αμοιβής. **Ιδιωτικοί** — ποτέ στη δημόσια προβολή (ADR-827 §3.4). */
  readonly compensation: MandateCompensation;
}

/**
 * ⚠️ **Επανεξάγεται εδώ επίτηδες.** Το αποτέλεσμα της αποστολής είναι μέρος του
 * **συμβολαίου της καταχώρησης** ({@link BrokeredCreateResult}), οπότε ο καλών της
 * πόρτας δεν πρέπει να ξέρει ότι η μηχανή αποστολής μετακόμισε. Η **μία** υλοποίηση
 * ζει στο `mandate-invitation.service.ts` — αυτό εδώ είναι όνομα, όχι δεύτερος τύπος.
 */
export type { NotifyOutcome };

export interface BrokeredCreateResult {
  readonly write: OwnerPropertyWriteResult;
  readonly notify: NotifyOutcome;
}

// =============================================================================
// 3. Η ΠΡΑΞΗ
// =============================================================================

/**
 * **Ο μεσίτης καταχωρεί για τον πελάτη του.**
 *
 * 🔑 **Η αρχική κατάσταση της έγκρισης ΔΕΝ δηλώνεται από τον αιτούντα** — παράγεται
 * από τον **δρόμο απόδειξης** ({@link initialConfirmationFor}). Ένα `confirmation`
 * περασμένο από το σώμα του αιτήματος θα σήμαινε ότι κάθε μεσίτης μπορεί να γράψει
 * «εγκεκριμένο», δηλαδή ο φρουρός θα ήταν πεδίο που στέλνει ο φρουρούμενος.
 */
export async function createBrokeredListing(
  adminDb: AdminFirestore,
  /**
   * 🔴 **Η ΑΠΟΔΕΙΞΗ, ΟΧΙ Η ΤΑΥΤΟΤΗΤΑ (ADR-824 §6).**
   *
   * Αυτή η παράμετρος **ΗΤΑΝ** `authorCompanyId: string` μέσα στο `identity`. Δηλαδή
   * ο γραφέας δεχόταν *«ποιο γραφείο»* και **ποτέ** *«επιτρέπεται;»* — και η μόνη
   * άμυνα ήταν να **θυμηθεί** ο καλών να ρωτήσει. Μέχρι τις 2026-08-27 δεν ρωτούσε
   * κανείς: η πόρτα ήταν σκέτο `withAuth`, άρα **οποιοδήποτε** γραφείο δημοσίευε
   * αγγελία για ξένο ακίνητο.
   *
   * 🔑 **Τώρα η παράλειψη ΔΕΝ ΜΕΤΑΓΛΩΤΤΙΖΕΤΑΙ.** Ο τύπος
   * {@link BrokerageAuthority} έχει `unique symbol` που **δεν εξάγεται**: μόνο ο
   * {@link requireBrokerageCapability} τον κατασκευάζει. Η Stripe —το πρότυπο του
   * κύκλου ζωής— αφήνει τον έλεγχο στον χρόνο εκτέλεσης και **παραδέχεται** ότι
   * *«sandboxes might not enforce some capabilities»*· εδώ ο φρουρός **έπαψε να
   * είναι έλεγχος και έγινε ΤΥΠΟΣ**.
   *
   * ⚠️ **Και το `authorCompanyId` διαβάζεται ΑΠΟ ΤΗΝ ΑΠΟΔΕΙΞΗ**, όχι από το
   * `identity`: έτσι είναι **αδύνατο** να κριθεί ο ένας οργανισμός και να γραφτεί ο
   * άλλος.
   */
  authority: BrokerageAuthority,
  identity: {
    readonly id: string;
    readonly authorUserId: string;
    readonly agencyName: string;
  },
  draft: OwnerPropertyDraft,
  request: BrokeredMandateRequest,
): Promise<BrokeredCreateResult> {
  const link = issueMandateConsentLink(identity.id, request.clientContactId);

  const mandate: BrokeredListingMandate = {
    kind: 'brokered',
    clientContactId: request.clientContactId,
    confirmation: initialConfirmationFor(request.proof.via),
    confirmedByUserId: null,
    proof: request.proof,
    // ⚠️ Οι δύο όροι της σύμβασης έρχονται **αυτούσιοι** από το αίτημα — καμία
    //    προεπιλογή εδώ. Ένα `?? DEFAULT_LISTING_AGREEMENT` σε αυτή τη γραμμή θα
    //    δέσμευε τον ιδιοκτήτη σε όρο που **κανείς δεν του έδειξε** (ADR-827 Α4/Α5).
    agreement: request.agreement,
    compensation: request.compensation,
    decidedAt: null,
    notifiedAt: null,
    viewedAt: null,
    consentNonce: link.nonce,
    expiresAt: request.expiresAt,
    // Το γραφείο μόλις κρίθηκε ενεργό από τον φρουρό — δες `authority`.
    agencyRevokedAt: null,
  };

  const write = await createOwnerProperty(
    adminDb,
    {
      id: identity.id,
      authorUserId: identity.authorUserId,
      authorCompanyId: authority.companyId,
      mandate,
    },
    draft,
  );

  if (write.kind !== 'saved') return { write, notify: { kind: 'failed' } };

  const notify = await sendMandateInvitation(
    adminDb,
    request.proof.via === AGENCY_ATTESTATION ? 'attestation-notice' : 'consent-request',
    {
      clientContactId: request.clientContactId,
      agencyName: identity.agencyName,
      listingTitle: draft.title,
      expiresAt: request.expiresAt,
      token: link.token,
      // ⚠️ Το `nonce` **είναι** η ταυτότητα αυτής της πρόσκλησης — άρα νέα πρόσκληση
      // δίνει νέο κλειδί και **επιτρέπεται** να ξαναστείλει, ενώ επανάληψη της ίδιας
      // δεν διπλασιάζει το μήνυμα.
      idempotencyKey: `mandate-consent:${link.nonce}`,
    },
  );

  if (notify.kind !== 'sent') return { write, notify };

  // Βήμα 4: **μόνο τώρα** λέμε ότι τον ειδοποιήσαμε.
  const stamped = await setOwnerPropertyMandate(adminDb, identity.id, {
    ...mandate,
    notifiedAt: nowISO(),
  });

  return { write: stamped.kind === 'saved' ? stamped : write, notify };
}

/**
 * Ό,τι χρειάζεται ο δρόμος της **βεβαίωσης**, ώστε ο καλών να μη συνθέτει `proof`
 * με το χέρι και να ξεχάσει το `attestedAt`.
 */
export function agencyAttestation(
  attestedByUserId: string,
  documentPath: string | null = null,
): MandateProof {
  return {
    via: AGENCY_ATTESTATION,
    attestedByUserId,
    attestedAt: nowISO(),
    documentPath,
  };
}

/** Ο δρόμος της **συγκατάθεσης** — ρητός, ώστε ο καλών να μην περνά ωμή συμβολοσειρά. */
export const OWNER_CONSENT_PROOF: MandateProof = { via: OWNER_CONSENT };
