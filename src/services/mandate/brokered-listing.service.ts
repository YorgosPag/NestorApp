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

import { COLLECTIONS } from '@/config/firestore-collections';
import { primaryEmailOf } from '@/lib/contacts/primary-email';
import { nowISO } from '@/lib/date-local';
import { formatDate } from '@/lib/intl-formatting';
import { createModuleLogger } from '@/lib/telemetry';
import { enqueueMessage } from '@/server/comms/orchestrator';
import { MESSAGE_PRIORITIES } from '@/types/communications';
import { mandateTextsFor, type MandateMessageKind } from '@/services/mandate/mandate-email-texts';
import { issueMandateConsentLink } from '@/services/mandate/mandate-consent.service';
import {
  createOwnerProperty,
  setOwnerPropertyMandate,
  type OwnerPropertyWriteResult,
} from '@/services/owner-property/owner-property-write.service';
import type { OwnerPropertyDraft } from '@/types/owner-property';
import {
  AGENCY_ATTESTATION,
  initialConfirmationFor,
  OWNER_CONSENT,
  type BrokeredListingMandate,
  type MandateProof,
} from '@/types/owner-property-mandate';

const logger = createModuleLogger('brokered-listing.service');

/**
 * ⚠️ **Η προεπιλογή ΔΕΝ είναι το νεκρό `nestor-app.vercel.app`** που κουβαλούν πέντε
 * άλλες διαδρομές του έργου. Το CLAUDE.md δηλώνει ρητά ότι εκείνο το URL είναι
 * *«dead/legacy»* και η παραγωγή ζει στο **nestorconstruct.gr** (Netcup). Ένας
 * σύνδεσμος συγκατάθεσης προς νεκρό τομέα είναι χειρότερος από κανέναν: ο ιδιοκτήτης
 * νομίζει ότι απάντησε.
 */
function consentUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nestorconstruct.gr';
  return `${base.replace(/\/+$/, '')}/mandate/${encodeURIComponent(token)}`;
}

// =============================================================================
// 1. ΤΟ ΑΙΤΗΜΑ ΤΟΥ ΜΕΣΙΤΗ
// =============================================================================

/** Ό,τι δηλώνει ο μεσίτης **πέρα** από το ακίνητο. */
export interface BrokeredMandateRequest {
  readonly clientContactId: string;
  readonly expiresAt: string;
  readonly proof: MandateProof;
}

/** Πώς πήγε η αποστολή — **ρητά**, γιατί το γραφείο πρέπει να το μάθει. */
export type NotifyOutcome =
  | { readonly kind: 'sent'; readonly to: string }
  /** Η επαφή **δεν έχει email**. Δεν είναι σφάλμα — είναι κατάσταση του κόσμου. */
  | { readonly kind: 'no-address' }
  | { readonly kind: 'failed' };

export interface BrokeredCreateResult {
  readonly write: OwnerPropertyWriteResult;
  readonly notify: NotifyOutcome;
}

// =============================================================================
// 2. Η ΕΙΔΟΠΟΙΗΣΗ
// =============================================================================

/** Η διεύθυνση και η γλώσσα του πελάτη, από την **επαφή** του γραφείου. */
async function readClientChannel(
  adminDb: AdminFirestore,
  clientContactId: string,
): Promise<{ email: string | null; language: unknown }> {
  const snapshot = await adminDb
    .collection(COLLECTIONS.CONTACTS)
    .doc(clientContactId)
    .get();

  const data = snapshot.data() as
    | { emails?: unknown; preferredLanguage?: unknown }
    | undefined;

  return {
    email: primaryEmailOf(data?.emails as never),
    language: data?.preferredLanguage,
  };
}

/**
 * **Στέλνει το μήνυμα** — και δεν πετά ποτέ.
 *
 * ⚠️ **Η αποτυχία της ειδοποίησης ΔΕΝ ακυρώνει την καταχώρηση**, ίδιο συμβόλαιο με
 * τον γραφέα της δημόσιας προβολής: η δουλειά του μεσίτη έγινε. Ό,τι έγινε λέγεται
 * **ονομαστικά** στο αποτέλεσμα, ώστε η οθόνη να μπορεί να πει «στάλθηκε στον Χ» ή
 * «η επαφή δεν έχει email» — δύο πολύ διαφορετικά πράγματα για το γραφείο.
 */
async function notifyClient(
  adminDb: AdminFirestore,
  kind: MandateMessageKind,
  params: {
    readonly clientContactId: string;
    readonly agencyName: string;
    readonly listingTitle: string;
    readonly expiresAt: string;
    readonly token: string;
    readonly idempotencyKey: string;
  },
): Promise<NotifyOutcome> {
  const channel = await readClientChannel(adminDb, params.clientContactId);
  if (channel.email === null) return { kind: 'no-address' };

  const wording = mandateTextsFor(kind, channel.language);
  const url = consentUrl(params.token);

  try {
    const result = await enqueueMessage({
      channels: ['email'],
      to: channel.email,
      subject: wording.subject(params.agencyName, params.listingTitle),
      content: wording.body(
        params.agencyName,
        params.listingTitle,
        formatDate(params.expiresAt),
        url,
      ),
      priority: MESSAGE_PRIORITIES.HIGH,
      // 🔑 **Ντετερμινιστικό κλειδί** — ο ίδιος αντι-spam φρουρός που χρησιμοποιεί ο
      // αγγελιοφόρος της ζήτησης: δύο κλήσεις για την **ίδια** πρόσκληση δεν
      // γεννούν δύο email. Δεν γράφτηκε καμία ουρά, κανένα «last notified at».
      idempotencyKey: params.idempotencyKey,
    });

    return result.success ? { kind: 'sent', to: channel.email } : { kind: 'failed' };
  } catch (error) {
    logger.error('Το μήνυμα προς τον ιδιοκτήτη δεν μπήκε στην ουρά', {
      data: { clientContactId: params.clientContactId },
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'failed' };
  }
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
  identity: {
    readonly id: string;
    readonly authorUserId: string;
    readonly authorCompanyId: string;
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
    decidedAt: null,
    notifiedAt: null,
    consentNonce: link.nonce,
    expiresAt: request.expiresAt,
  };

  const write = await createOwnerProperty(
    adminDb,
    {
      id: identity.id,
      authorUserId: identity.authorUserId,
      authorCompanyId: identity.authorCompanyId,
      mandate,
    },
    draft,
  );

  if (write.kind !== 'saved') return { write, notify: { kind: 'failed' } };

  const notify = await notifyClient(
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
