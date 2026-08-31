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
 * 4. **Η έκβαση σφραγίζεται — πάντα. Το `notifiedAt` μπαίνει ΜΟΝΟ αν έφυγε μήνυμα.**
 *
 * ⚠️ **Δύο πεδία, μία γραφή** (ADR-834 §6.5.δ). Ως τις 2026-08-31 το βήμα 4 έτρεχε
 * **μόνο** σε `sent`, άρα οι δύο αποτυχίες δεν άφηναν **κανένα** ίχνος: στη βάση
 * έμενε ένα `notifiedAt: null` που σήμαινε ταυτόχρονα *«δεν έχει email»*, *«ο γραφέας
 * απέτυχε»* και *«δεν προσπαθήσαμε ποτέ»* — και η οθόνη διάλεγε τον έναν από τους
 * τρεις κόσμους. Τώρα το `notifyOutcome` απαντά **ονομαστικά** στο *«πώς πήγε;»*,
 * ενώ το `notifiedAt` κρατά αυτούσιο το *«πότε»*.
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
} from '@/services/owner-property/owner-property-write.service';
import type { OwnerPropertyWriteResult } from '@/services/owner-property/owner-property-write-result';
import type { BrokerageAuthority } from '@/lib/auth/brokerage-authority';
import type { ListingAgreement } from '@/types/listing-agreement';
import type { OwnerPropertyDraft } from '@/types/owner-property';
import type { OfferKind } from '@/types/property-offers';
import {
  AGENCY_ATTESTATION,
  initialConfirmationFor,
  NOTIFY_SENT,
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
  /** ISO — από πότε ισχύει (ADR-832). Δες `BrokeredListingMandate.startsAt`. */
  readonly startsAt: string;
  /** Για ποιες πράξεις (ADR-832) — το «περιεχόμενο» του άρθρου 200 §4. */
  readonly scope: readonly OfferKind[];
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
    // 🔑 **`null` = «καμία απόπειρα δεν έχει καταγραφεί ΑΚΟΜΗ»** (ADR-834 §6.5.δ), και
    //    είναι η αλήθεια σε αυτή τη γραμμή: το βήμα 3 δεν έχει τρέξει. Θα σφραγιστεί
    //    στο βήμα 4 — **στην ίδια γραφή** με το `notifiedAt`, όποια κι αν είναι η
    //    έκβαση. Μια προεπιλογή `NOTIFY_FAILED` εδώ θα ονόμαζε αποτυχία **πριν** από
    //    την προσπάθεια.
    notifyOutcome: null,
    viewedAt: null,
    consentNonce: link.nonce,
    expiresAt: request.expiresAt,
    // Το γραφείο μόλις κρίθηκε ενεργό από τον φρουρό — δες `authority`.
    agencyRevokedAt: null,
    // ── ADR-832: η κατάληψη ────────────────────────────────────────────────
    // ⚠️ **Το γραφείο διαβάζεται ΑΠΟ ΤΗΝ ΑΠΟΔΕΙΞΗ**, ίδιο δόγμα με το
    //    `authorCompanyId` παρακάτω: έτσι είναι αδύνατο να κριθεί ο ένας
    //    οργανισμός και να καταλάβει τον πόρο ο άλλος.
    agencyCompanyId: authority.companyId,
    startsAt: request.startsAt,
    scope: request.scope,
  };

  const write = await createOwnerProperty(
    adminDb,
    {
      id: identity.id,
      authorUserId: identity.authorUserId,
      authorCompanyId: authority.companyId,
      mandates: [mandate],
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

  // ────────────────────────────────────────────────────────────────────────────
  // 🔴 ΒΗΜΑ 4 — Η ΣΦΡΑΓΙΔΑ, ΚΑΙ ΠΛΕΟΝ ΓΡΑΦΕΤΑΙ **ΠΑΝΤΑ** (ADR-834 §6.5.δ)
  // ────────────────────────────────────────────────────────────────────────────
  //
  // Ως σήμερα αυτή η γραμμή ήταν `if (notify.kind !== 'sent') return …` — δηλαδή σε
  // **δύο από τις τρεις** εκβάσεις δεν γραφόταν **τίποτα**, και το μόνο ίχνος τους
  // στη βάση ήταν το `notifiedAt: null` που είχε ήδη γραφτεί στη γέννηση. **Ένα bit
  // για τρεις κόσμους**: «δεν έχει email», «ο γραφέας απέτυχε», «δεν προσπαθήσαμε».
  // Ο κατάλογος **υποχρεωνόταν** να μαντέψει και μάντεψε τον έναν — και έστελνε τον
  // μεσίτη να συμπληρώσει email που **υπήρχε** (μετρημένο ζωντανά, §6.5.α #14).
  //
  // 🔑 **ΚΑΜΙΑ ΔΕΥΤΕΡΗ ΓΡΑΦΗ, ΚΑΜΙΑ ΝΕΑ ΣΥΛΛΟΓΗ** — ίδιο δόγμα με το `consentNonce`:
  //    *«η κατάσταση που αποφασίζει είναι η κατάσταση που απαντά»*. Η **ίδια** γραφή
  //    που έβαζε το `notifiedAt` βάζει τώρα και την έκβαση.
  //
  // ⚠️ **Το βήμα 4 δεν έγινε πιο επικίνδυνο.** Το `notifiedAt` εξακολουθεί να μπαίνει
  //    **μόνο** σε `sent` — η αρχή *«υποτιμούμε, ποτέ υπερτιμούμε»* του §1 μένει
  //    ακέραιη. Αυτό που άλλαξε είναι ότι η **αποτυχία** παύει να είναι σιωπηλή. Και
  //    αν αυτή η γραφή αποτύχει, ο καλών παίρνει ό,τι έπαιρνε και πριν: την αρχική
  //    επιτυχή γραφή και την έκβαση **στη μνήμη** (`notify`), που είναι η απάντηση
  //    της στιγμής προς την οθόνη.
  const stamped = await setOwnerPropertyMandate(adminDb, identity.id, {
    ...mandate,
    notifiedAt: notify.kind === NOTIFY_SENT ? nowISO() : null,
    notifyOutcome: notify.kind,
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
