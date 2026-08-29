import 'server-only';

/**
 * @fileoverview **Η ΑΠΟΦΑΣΗ ΤΟΥ ΓΡΑΦΕΙΟΥ** — Σ3 (ADR-827 §9.21).
 * @related services/mandate/mandate-acceptance.service.ts · mandate-decision-vocabulary.ts
 * @module services/mandate/mandate-decision.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΕΙΣ ΑΠΟΦΑΣΕΙΣ, ΔΥΟ ΔΙΑΔΡΟΜΕΣ — ΚΑΙ Η ΑΣΥΜΜΕΤΡΙΑ ΕΙΝΑΙ ΤΟ ΝΟΗΜΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Απόφαση | Τι γράφεται | Γεννιέται επαφή; |
 * |---|---|---|
 * | `accepted` | επαφή **+** εντολή **+** αίτημα, σε **μία** συναλλαγή | **ναι** |
 * | `declined-revisable` | **μόνο** το αίτημα | **όχι** |
 * | `declined-final` | **μόνο** το αίτημα | **όχι** |
 *
 * 🏆 **ΚΑΙ ΓΙ' ΑΥΤΟ ΤΟ ΕΡΩΤΗΜΑ «ΠΟΣΟ ΚΡΑΤΑ ΤΑ ΣΤΟΙΧΕΙΑ ΤΟ ΓΡΑΦΕΙΟ ΠΟΥ ΑΡΝΗΘΗΚΕ;» ΔΕΝ
 * ΓΕΝΝΙΕΤΑΙ** (§8.4). Η αγορά το απαντά με **πολιτική διατήρησης** — δηλαδή με
 * υπόσχεση. Εδώ **δεν έλαβε ποτέ** στοιχεία: καμία πολιτική, κανένας χρονοδιακόπτης,
 * κανένα cron που μπορεί να μην τρέξει.
 *
 * ⚠️ **Η άρνηση δεν είναι «φθηνή αποδοχή» — είναι ΑΛΛΗ ΠΡΑΞΗ.** Δεν διαβάζει αγγελία,
 * δεν διαβάζει ταυτότητα, δεν ρωτά για διπλότυπα. Ένας κοινός δρόμος με σημαία
 * `if (accepted)` θα έκανε την άρνηση να **εξαρτάται** από πράγματα που δεν την
 * αφορούν: γραφείο που θέλει να πει «όχι» δεν πρέπει να εμποδίζεται επειδή ο ιδιώτης
 * δεν έχει συμπληρώσει το ΑΦΜ του.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΙ Η ΑΡΝΗΣΗ ΕΧΕΙ CAS — ΓΙΑ ΤΟΝ ΑΝΤΙΘΕΤΟ ΛΟΓΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Στην αποδοχή το CAS εμποδίζει **δύο δεσμεύσεις**. Στην άρνηση εμποδίζει κάτι
 * χειρότερο: να γραφτεί «όχι» πάνω σε αίτημα που ο **συνάδελφος μόλις δέχτηκε** —
 * δηλαδή αγγελία με εντολή `brokered` και αίτημα που λέει `declined-final`. Το
 * αμετάβλητο `request-contact-inconsistent` θα κοκκίνιζε για πάντα, σε έγγραφο που
 * **κανείς δεν μπορεί να διαβάσει** (`read: false`) για να το διορθώσει.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { readCompanyPublicName } from '@/services/company/company-public-name.reader';
import {
  acceptMandateRequest,
  type AcceptanceOutcome,
} from '@/services/mandate/mandate-acceptance.service';
import type { MandateDecisionRefusal } from '@/services/mandate/mandate-decision-vocabulary';
import { announceMandateRequestAnswer } from '@/services/mandate/mandate-request-notifier.service';
import {
  isRequestActionable,
  mandateRequestFromStored,
  readStoredRequestStatus,
  type MandateRequest,
  type MandateRequestDecision,
  type MandateRequestDocument,
} from '@/types/mandate-request';
import type { MandateInvariant } from '@/types/owner-property-mandate';

const logger = createModuleLogger('mandate-decision.service');

/** Τι απέγινε η απόφαση — κλειστό σύνολο, ποτέ `boolean` + μήνυμα. */
export type MandateDecisionOutcome =
  | {
      readonly kind: 'decided';
      readonly decision: MandateRequestDecision;
      /** Μόνο στην αποδοχή. `null` σε κάθε άρνηση — **και είναι το §8.4**. */
      readonly clientContactId: string | null;
    }
  | {
      readonly kind: 'refused';
      readonly reason: MandateDecisionRefusal;
      readonly violations?: readonly MandateInvariant[];
    }
  /** 🔴 **Δεν μάθαμε** — ποτέ ίδιο με άρνηση (N.12). */
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'failed' };

export interface MandateDecisionInput {
  readonly requestId: string;
  /** **Από την απόδειξη**, ποτέ από το σώμα του αιτήματος. */
  readonly agencyCompanyId: string;
  readonly deciderUid: string;
  readonly decision: MandateRequestDecision;
  readonly nowISO: string;
}

// =============================================================================
// 1. Η ΠΡΑΞΗ
// =============================================================================

/**
 * **Το γραφείο αποφασίζει.**
 *
 * ⚠️ **Η σειρά των φρουρών ΔΕΝ είναι αυθαίρετη**: πρώτα *«είναι δικό σου;»*, μετά
 * *«μπορεί ακόμη να κριθεί;»*, και **μόνο τότε** ξεχωρίζουν οι δύο διαδρομές. Ό,τι
 * είναι κοινό κρίνεται **μία** φορά.
 */
export async function decideMandateRequest(
  adminDb: AdminFirestore,
  input: MandateDecisionInput,
): Promise<MandateDecisionOutcome> {
  const request = await loadOwnRequest(adminDb, input);
  if ('kind' in request) return request;

  // 🔴 **ΤΟ ΡΟΛΟΪ ΚΡΙΝΕΙ ΚΑΙ ΤΙΣ ΤΡΕΙΣ ΑΠΟΦΑΣΕΙΣ, ΚΑΙ ΕΙΝΑΙ ΣΩΣΤΟ ΓΙΑ ΤΗΝ ΑΡΝΗΣΗ.**
  //    Θα ήταν εύκολο να επιτρέψουμε άρνηση σε ληγμένο αίτημα *«αφού δεν πειράζει
  //    κανέναν»*. Θα σήμαινε όμως ότι το γραφείο **κρίνει** κάτι που δεν μπορούσε να
  //    δεχτεί — και το `declined-final` θα έκλεινε την πόρτα για αγγελία που κανείς
  //    δεν αξιολόγησε ποτέ. Το ληγμένο αίτημα δεν αρνείται· **σβήνει μόνο του**.
  if (!isRequestActionable(request, input.nowISO)) {
    return {
      kind: 'refused',
      reason: request.status === 'pending' ? 'request-lapsed' : 'request-not-pending',
    };
  }

  const outcome =
    input.decision === 'accepted'
      ? translate(
          await acceptMandateRequest(adminDb, {
            request,
            agencyCompanyId: input.agencyCompanyId,
            deciderUid: input.deciderUid,
            nowISO: input.nowISO,
          }),
        )
      : await recordDecline(adminDb, input, request);

  // ── Φ5: ο ιδιώτης μαθαίνει — **ΜΕΤΑ** τη γραφή, και μόνο αν κάτι γράφτηκε ────
  //
  // 🔑 **Ο φρουρός είναι το `kind`, όχι χρονόμετρο**: ειδοποιούμε **μόνο** όταν η
  //    απόφαση πράγματι προσγειώθηκε. Δεύτερο πάτημα του ίδιου κουμπιού γυρίζει
  //    `request-not-pending` (το CAS) ⇒ **καμία** δεύτερη ειδοποίηση. Η ιδεμποτησία
  //    δεν χρειάστηκε δικό της βιβλίο: την κληρονομεί από τη γραφή (άγκυρα Ε).
  if (outcome.kind === 'decided') {
    await notifyRequester(adminDb, input, request, outcome.decision);
  }

  return outcome;
}

/**
 * **Ο ιδιώτης μαθαίνει τι απαντήθηκε.**
 *
 * ⚠️ **Δεν πετά και δεν αλλάζει την έκβαση.** Η απόφαση είναι **ήδη γραμμένη**· μια
 * αποτυχία εδώ δεν επιτρέπεται να γυρίσει σφάλμα στον μεσίτη που μόλις δεσμεύτηκε.
 *
 * ⚠️ **Η επωνυμία διαβάζεται ΕΔΩ και περνιέται** — ο αγωγός δεν ξέρει από εταιρείες,
 * ίδια κίνηση με τις δύο πόρτες της Φάσης Α. Κενό `''` σημαίνει «δεν βρέθηκε» και
 * **δεν** ακυρώνει το μήνυμα: ο άνθρωπος πρέπει να μάθει την απάντηση ακόμη κι αν το
 * όνομα λείπει.
 */
async function notifyRequester(
  adminDb: AdminFirestore,
  input: MandateDecisionInput,
  request: MandateRequest,
  decision: MandateRequestDecision,
): Promise<void> {
  const agencyName = (await readCompanyPublicName(adminDb, input.agencyCompanyId)) ?? '';

  await announceMandateRequestAnswer(adminDb, {
    requestId: request.id,
    ownerPropertyId: request.ownerPropertyId,
    // 🔴 **Ο ΑΝΤΙΣΤΡΟΦΟΣ ΑΓΩΓΟΣ**: παραλήπτης ο **αιτών**, ποτέ ο κρίνων. Ένα
    //    `input.deciderUid` εδώ θα έστελνε στον μεσίτη μήνυμα για την πράξη που μόλις
    //    έκανε ο ίδιος — και ο ιδιώτης δεν θα μάθαινε ποτέ τίποτα.
    recipientUserId: request.requestedByUserId,
    agencyName,
    decision,
  });
}

// =============================================================================
// 2. Ο ΚΟΙΝΟΣ ΦΡΟΥΡΟΣ
// =============================================================================

/**
 * **Το αίτημα, αν ανήκει σε αυτό το γραφείο** — αλλιώς η έτοιμη άρνηση.
 *
 * ⚠️ **«Δεν υπάρχει» και «δεν είναι δικό σου» απαντούν ΤΑΥΤΟΣΗΜΑ** (§9.4). Ίδιο ιδίωμα
 * με το `readAgencyRequest` και με το `loadOwnListing` του Σ1.
 */
async function loadOwnRequest(
  adminDb: AdminFirestore,
  input: MandateDecisionInput,
): Promise<MandateRequest | Exclude<MandateDecisionOutcome, { kind: 'decided' }>> {
  try {
    const snapshot = await adminDb
      .collection(COLLECTIONS.MANDATE_REQUESTS)
      .doc(input.requestId)
      .get();

    const data = snapshot.data();
    if (data === undefined) return { kind: 'refused', reason: 'request-absent' };

    const stored = data as MandateRequestDocument;
    if (readStoredRequestStatus(stored.status).repaired === 'unreadable') {
      logger.error('[MANDATE-DECISION] Αίτημα με ΜΗ ΑΝΑΓΝΩΣΙΜΗ κατάσταση — κρίνεται ως τελικό όχι', {
        requestId: input.requestId,
        storedStatus: String(stored.status),
      });
    }

    const request = mandateRequestFromStored(stored);
    if (request.agencyCompanyId !== input.agencyCompanyId) {
      return { kind: 'refused', reason: 'request-absent' };
    }
    return request;
  } catch (error) {
    logger.error('[MANDATE-DECISION] Η ανάγνωση του αιτήματος απέτυχε — άγνωστο, όχι κενό', {
      requestId: input.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'unavailable' };
  }
}

// =============================================================================
// 3. Η ΑΡΝΗΣΗ — μία γραφή, με CAS
// =============================================================================

/**
 * **«Όχι»** — και **καμία επαφή δεν γεννιέται** (§8.4).
 *
 * 🔑 **Η συναλλαγή έχει ΜΙΑ γραφή, και δεν είναι υπερβολή.** Χωρίς αυτήν, δύο
 * υπάλληλοι που πατούν ταυτόχρονα «Αποδοχή» και «Οριστικό όχι» θα άφηναν αγγελία με
 * εντολή `brokered` και αίτημα `declined-final` — έγγραφο που παραβιάζει μόνιμα το
 * `request-contact-inconsistent` και που **κανείς δεν μπορεί να διαβάσει** για να το
 * διορθώσει (`read: false`).
 *
 * ⚠️ **Το `clientContactId` ΔΕΝ αγγίζεται**: είναι ήδη `null` και οφείλει να μείνει.
 * Ένα ρητό `clientContactId: null` εδώ θα ήταν γραφή που **δεν αλλάζει τίποτα**, και
 * θα διαβαζόταν από τον επόμενο ως *«εδώ κάτι σβήνεται»* — ενώ τίποτα δεν υπήρξε.
 */
async function recordDecline(
  adminDb: AdminFirestore,
  input: MandateDecisionInput,
  request: MandateRequest,
): Promise<MandateDecisionOutcome> {
  const ref = adminDb.collection(COLLECTIONS.MANDATE_REQUESTS).doc(request.id);

  try {
    return await adminDb.runTransaction(async (transaction) => {
      const fresh = (await transaction.get(ref)).data() as MandateRequest | undefined;

      if (fresh === undefined || fresh.agencyCompanyId !== input.agencyCompanyId) {
        return { kind: 'refused', reason: 'request-absent' } as const;
      }
      if (fresh.status !== 'pending') {
        return { kind: 'refused', reason: 'request-not-pending' } as const;
      }

      transaction.update(ref, { status: input.decision, decidedAt: input.nowISO });

      return {
        kind: 'decided',
        decision: input.decision,
        clientContactId: null,
      } as const;
    });
  } catch (error) {
    logger.error('[MANDATE-DECISION] Η άρνηση δεν γράφτηκε — ΤΙΠΟΤΑ δεν άλλαξε', {
      requestId: request.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'failed' };
  }
}

// =============================================================================
// 4. Η ΜΕΤΑΦΡΑΣΗ — δύο λεξιλόγια, ένα σύνορο
// =============================================================================

/**
 * **Η έκβαση της αποδοχής, στο λεξιλόγιο της απόφασης.**
 *
 * 🔑 Η υπηρεσία αποδοχής έχει **δικό της** σχήμα επιτυχίας (ξέρει αν γεννήθηκε επαφή —
 * πληροφορία που χρειάζεται **μόνο** το ίχνος ελέγχου). Η μετάφραση γίνεται **εδώ, μία
 * φορά**, ώστε ο καλών να βλέπει **ένα** λεξιλόγιο για τις τρεις αποφάσεις.
 *
 * ⚠️ **Κλειστό σύνολο, χωρίς `default`**: νέα έκβαση της αποδοχής **δεν
 * μεταγλωττίζεται** μέχρι κάποιος να πει τι σημαίνει εδώ.
 */
function translate(outcome: AcceptanceOutcome): MandateDecisionOutcome {
  switch (outcome.kind) {
    case 'accepted':
      return {
        kind: 'decided',
        decision: 'accepted',
        clientContactId: outcome.clientContactId,
      };
    case 'refused':
      return { kind: 'refused', reason: outcome.reason, violations: outcome.violations };
    case 'unavailable':
      return { kind: 'unavailable' };
    case 'failed':
      return { kind: 'failed' };
  }
}
