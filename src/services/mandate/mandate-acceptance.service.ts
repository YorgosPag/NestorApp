import 'server-only';

/**
 * @fileoverview **Η ΑΤΟΜΙΚΗ ΑΠΟΔΟΧΗ** — Σ3, η καρδιά της Φάσης Β (ADR-827 §9.21).
 * @related types/mandate-request.ts · services/ai-pipeline/shared/contact-document-builder.ts
 * @module services/mandate/mandate-acceptance.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΕΙΣ ΓΡΑΦΕΣ, ΜΙΑ ΠΡΑΞΗ — ΚΑΙ ΤΟ CAS ΕΙΝΑΙ ΠΟΥ ΤΗ ΣΦΡΑΓΙΖΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η αποδοχή γεννά **επαφή**, γράφει **εντολή** και κλείνει το **αίτημα**. Μισή
 * εκτέλεση είναι η χειρότερη δυνατή κατάσταση του συστήματος:
 *
 * | Αν έσπαγε στη μέση | Τι θα σήμαινε |
 * |---|---|
 * | επαφή ✅ · εντολή ❌ | το γραφείο **έλαβε προσωπικά δεδομένα** για συμφωνία που δεν έγινε — παράβαση του §8.4 |
 * | εντολή ✅ · αίτημα ❌ | η αγγελία δεσμεύτηκε, το αίτημα φαίνεται ακόμη **εκκρεμές**, και δεύτερος υπάλληλος το ξαναδέχεται |
 *
 * 🏆 **ΤΟ CAS ΚΑΝΕΙ ΤΗ ΔΙΠΛΗ ΑΠΟΔΟΧΗ ΔΟΜΙΚΑ ΑΔΥΝΑΤΗ, ΟΧΙ ΑΠΑΓΟΡΕΥΜΕΝΗ.** Μέσα στη
 * συναλλαγή το αίτημα **ξαναδιαβάζεται** και η γραφή γίνεται **μόνο** αν είναι ακόμη
 * `pending`. Δύο υπάλληλοι που πατούν το ίδιο δευτερόλεπτο: ο ένας δεσμεύεται, του
 * άλλου η `transaction.set` της επαφής **δεν προσγειώνεται ποτέ**. Δεν γεννιούνται δύο
 * επαφές — όχι επειδή κάποιος έλεγχος τις εμπόδισε, αλλά επειδή **δεν υπάρχει
 * εκτέλεση** που να τις γράφει. *(Ίδιο σχήμα με το ADR-769: γραφή σε λάθος στόχο =
 * αδύνατη, όχι απαγορευμένη.)*
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴🔴 ΟΙ ΑΝΑΓΝΩΣΕΙΣ ΕΞΩ · ΟΙ ΓΡΑΦΕΣ ΜΕΣΑ · ΟΙ ΠΑΡΕΝΕΡΓΕΙΕΣ **ΜΕΤΑ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ⛔ **ΤΟ ΣΩΜΑ ΜΙΑΣ ΣΥΝΑΛΛΑΓΗΣ FIRESTORE ΞΑΝΑΕΚΤΕΛΕΙΤΑΙ ΣΕ ΣΥΓΚΡΟΥΣΗ.** Ό,τι δεν είναι
 * συναλλακτικό και μπει μέσα, **φεύγει πολλές φορές**: το `EntityAuditService` θα
 * έγραφε διπλό ίχνος ελέγχου, η ειδοποίηση θα έφευγε δύο φορές, η δημόσια προβολή θα
 * ξαναγραφόταν άσκοπα. Είναι η **ίδια** κλάση βλάβης που το `eventId` του §8.34
 * πάλεψε να κλείσει, από την ανάποδη.
 *
 * ⇒ Ο κύκλος έχει **τρεις** φάσεις, και η σειρά τους είναι το συμβόλαιο:
 *
 * 1. **ΕΤΟΙΜΑΣΙΑ** *(εκτός)* — αγγελία, ταυτότητα ιδιώτη, υπάρχουσα επαφή, ο κριτής
 *    της εντολής. Όλα **αναγνώσεις**, όλα ακυρώσιμα χωρίς κόστος.
 * 2. **ΣΥΝΑΛΛΑΓΗ** — ξαναδιάβασμα με CAS, και **μόνο** οι τρεις γραφές.
 * 3. **ΠΑΡΕΝΕΡΓΕΙΕΣ** *(μετά το commit)* — δημόσια προβολή, ίχνος ελέγχου. Καθεμία
 *    ξέρει να αποτυγχάνει χωρίς να ακυρώνει τη συμφωνία που **έχει ήδη γραφτεί**.
 *
 * 🔑 **Η αναζήτηση διπλότυπης επαφής στη φάση 1 ΔΕΝ είναι κούρσα**, και ο λόγος είναι
 * ακριβώς το CAS: μόνο **μία** εκτέλεση φτάνει να δεσμεύσει το αίτημα, άρα μόνο μία
 * γράφει επαφή. Μια ανάγνωση που «παλιώνει» δεν μπορεί να παράγει δεύτερη καρτέλα,
 * γιατί η εκτέλεση που την κρατά **δεν κάνει commit**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΑΦΜ ΕΙΝΑΙ ΠΡΟΫΠΟΘΕΣΗ, ΚΑΙ Η ΑΡΝΗΣΗ ΕΙΝΑΙ FAIL-CLOSED
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο μεσίτης ακινήτων είναι **υπόχρεο πρόσωπο** του Ν.4557/2018 (ΚΞΧ): το **άρθρο 30
 * §3** τον υποχρεώνει να **φυλάει** στοιχεία δέουσας επιμέλειας — δηλαδή να τα έχει
 * **συλλέξει** πριν συνάψει επιχειρηματική σχέση. Επαφή χωρίς ΑΦΜ σημαίνει σύμβαση με
 * ελλιπές νομικό στοιχείο, **με πράσινη όψη**.
 *
 * ⇒ `identity-incomplete`, και **το αίτημα μένει `pending`**: τίποτα δεν χάνεται, ο
 * ιδιώτης συμπληρώνει τα φορολογικά του και το γραφείο ξαναπατά «Αποδοχή».
 *
 * 🔶 **ΔΗΛΩΜΕΝΟ ΑΝΟΙΧΤΟ**: η άρνηση αυτή είναι **θεραπεύσιμη μόνο από τον ιδιώτη**,
 * που δεν τη βλέπει. Ο σωστός τόπος του ελέγχου είναι το **Σ1** — να μη γεννιέται
 * αίτημα χωρίς ΑΦΜ (§9.20 β: *just-in-time*). Δεν έγινε εδώ επειδή αγγίζει τη φόρμα
 * του ιδιώτη, εκτός εμβέλειας αυτής της κίνησης. **Αυτός εδώ ο έλεγχος μένει
 * ούτως ή άλλως**: είναι το δίχτυ (N.7.2 #4), όχι ο κύριος δρόμος.
 */

import type {
  Firestore as AdminFirestore,
  Transaction,
} from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  mandateWriteVerdict,
  nextMandateExpiry,
} from '@/types/owner-property-mandate';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityAuditService } from '@/services/entity-audit.service';
import { republishOwnerProperty } from '@/services/owner-property/owner-property-publication.service';
import type { MandateRequest } from '@/types/mandate-request';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import type { OwnerProperty } from '@/types/owner-property';
import type { BrokeredListingMandate } from '@/types/owner-property-mandate';

import { mandateActSeed } from '@/lib/network-edge/edge-sources';
import {
  effectiveActTeam,
  readActTeam,
  writeActTeamBirth,
} from '@/services/network-messaging/act-team-writer';
import {
  readActThreadSlot,
  writeActThread,
} from '@/services/network-messaging/thread-writer';
import { prepare, type Prepared } from '@/services/mandate/mandate-acceptance-prepare';
import { privateMarketingViolationsAdded } from '@/lib/mandate/private-marketing-standing';
import type {
  AcceptanceInput,
  AcceptanceOutcome,
  Refusal,
} from '@/services/mandate/mandate-acceptance-types';

/**
 * 🔑 **Η ΔΗΜΟΣΙΑ ΕΠΙΦΑΝΕΙΑ ΜΕΝΕΙ ΕΔΩ, ΚΑΙ ΕΙΝΑΙ ΣΚΟΠΙΜΟ.** Οι τύποι μετακόμισαν σε
 * `mandate-acceptance-types.ts` για να σπάσει ο κύκλος με την ετοιμασία — αλλά ο
 * καλών (`mandate-decision.service.ts`) ρωτά **έναν** ενορχηστρωτή. Χωρίς αυτό το
 * re-export, ένα καθαρά **εσωτερικό** σπάσιμο θα ζητούσε από κάθε καταναλωτή να
 * μάθει τη νέα διεύθυνση — δηλαδή θα διέρρεε στην επιφάνεια.
 */
export type { AcceptanceInput, AcceptanceOutcome } from '@/services/mandate/mandate-acceptance-types';

const logger = createModuleLogger('mandate-acceptance.service');

// =============================================================================
// 1. Η ΠΡΑΞΗ
// =============================================================================

/**
 * **Το γραφείο δέχεται** — και η αγγελία αλλάζει χέρια σε μία ατομική πράξη.
 */
export async function acceptMandateRequest(
  adminDb: AdminFirestore,
  input: AcceptanceInput,
): Promise<AcceptanceOutcome> {
  const prepared = await prepare(adminDb, input);
  if (prepared.kind !== 'ready') return prepared;

  const committed = await commit(adminDb, input, prepared);
  if (committed.kind !== 'accepted') return committed;

  // ── ΦΑΣΗ 3: παρενέργειες, ΕΞΩ από τη συναλλαγή ────────────────────────────
  await announceToTheWorld(adminDb, prepared.property, prepared.mandate);
  if (committed.contactCreated) {
    await recordContactBirth(input, prepared);
  }

  return committed;
}

// =============================================================================
// 2. ΦΑΣΗ 2 — Η ΣΥΝΑΛΛΑΓΗ: ξαναδιάβασμα με CAS, και ΜΟΝΟ οι τρεις γραφές
// =============================================================================

/**
 * **Οι τρεις γραφές, ή καμία.**
 *
 * 🔴 **ΤΑ ΔΥΟ `get` ΕΙΝΑΙ ΤΟ CAS, ΟΧΙ ΑΜΥΝΤΙΚΟΤΗΤΑ.** Ό,τι διαβάστηκε στη φάση 1 μπορεί
 * να έχει αλλάξει: το Firestore εγγυάται ότι, αν κάποιο από τα δύο έγγραφα γραφτεί από
 * αλλού πριν το commit, η **ολόκληρη** συναλλαγή ξαναεκτελείται — και τότε ο έλεγχος
 * θα δει τη **νέα** κατάσταση και θα σταματήσει.
 *
 * ⚠️ **ΟΛΑ ΤΑ `get` ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΓΡΑΦΗ** — απαίτηση του Firestore, όχι στυλ.
 *
 * ⛔ **ΤΙΠΟΤΑ ΜΗ ΣΥΝΑΛΛΑΚΤΙΚΟ ΕΔΩ ΜΕΣΑ**: ούτε ίχνος ελέγχου, ούτε ειδοποίηση, ούτε
 * δημόσια προβολή. Το σώμα **ξαναεκτελείται** — δες την κεφαλίδα.
 */
async function commit(
  adminDb: AdminFirestore,
  input: AcceptanceInput,
  prepared: Prepared,
): Promise<AcceptanceOutcome> {
  const requestRef = adminDb.collection(COLLECTIONS.MANDATE_REQUESTS).doc(input.request.id);
  const propertyRef = adminDb
    .collection(COLLECTIONS.OWNER_PROPERTIES)
    .doc(prepared.property.id);

  try {
    return await adminDb.runTransaction(async (transaction: Transaction) => {
      // 🔑 **ADR-867 Β3 — η ΤΡΙΤΗ ανάγνωση είναι η ΟΜΑΔΑ ΤΗΣ ΠΡΑΞΗΣ**, και ζει εδώ πάνω
      //    για τον ίδιο λόγο με τις άλλες δύο: **όλα τα `get` πριν από κάθε γραφή**.
      //    Η ομάδα γεννιέται στην **ίδια** συναλλαγή με την εντολή — αλλιώς υπάρχει
      //    στιγμή όπου η πράξη υπάρχει και **κανείς δεν είναι υπεύθυνος** γι' αυτήν.
      // 🔑 **ADR-867 Β4 — η ΤΕΤΑΡΤΗ ανάγνωση είναι το ΝΗΜΑ ΤΗΣ ΠΡΑΞΗΣ**, και ζει εδώ για
      //    τον ίδιο λόγο με τις άλλες τρεις. Η αποδοχή είναι η **μόνη** στιγμή όπου η
      //    ακμή γεννιέται **με πρόσωπο** και στις δύο πλευρές (`confirmedByUserId` =
      //    `requestedByUserId`) — δηλαδή η μόνη όπου μπορεί να γεννηθεί νήμα (§8 #1).
      const actSeed = mandateActSeed(prepared.property.id, prepared.mandate.agencyCompanyId);
      const [requestSnap, propertySnap, teamSlot, threadSlot] = await Promise.all([
        transaction.get(requestRef),
        transaction.get(propertyRef),
        readActTeam(transaction, adminDb, actSeed),
        readActThreadSlot(transaction, adminDb, actSeed),
      ]);

      // 🔴 **ΤΟ ΣΥΝΟΡΟ ΠΡΙΝ ΤΟΝ ΚΡΙΤΗ** (ADR-842 §7.6.12). Η **απουσία εγγράφου** δεν
      //    είναι παραβίαση CAS — είναι αποτυχία **ανάγνωσης**, και ανήκει εδώ. Η
      //    έκβαση μένει **ταυτόσημη** (`listing-withdrawn`)· άλλαξε μόνο ποιος τη λέει.
      const freshProperty = ownerPropertyFromDocument(propertySnap.data(), propertyRef.id);
      if (freshProperty === null) {
        return { kind: 'refused', reason: 'listing-withdrawn' };
      }

      const stale = casViolation(requestSnap.data(), freshProperty, input.agencyCompanyId);
      if (stale !== null) return stale;

      // 🔴 **ΟΙ ΚΑΤΑΛΗΨΕΙΣ ΔΙΑΒΑΖΟΝΤΑΙ ΑΠΟ ΤΟ ΦΡΕΣΚΟ ΕΓΓΡΑΦΟ ΤΗΣ ΣΥΝΑΛΛΑΓΗΣ.**
      //    Ως τις 2026-08-30 η γραφή χτιζόταν πάνω στο `prepared.existingMandates`,
      //    που έρχεται από τη **φάση 1** — δηλαδή από `.get()` **έξω** από τη
      //    συναλλαγή. Το σχόλιο εδώ ισχυριζόταν ότι «διαβάστηκε από αυτή τη
      //    συναλλαγή»· το `propertySnap` υπήρχε και **απορριπτόταν**.
      //
      // 🔴 Το κόστος **δεν ήταν μόνο** μια σύγκρουση που ξεφεύγει: ήταν **ΑΠΩΛΕΙΑ
      //    ΔΕΔΟΜΕΝΩΝ**. Εντολή που γράφτηκε από τρίτο γραφείο στο ενδιάμεσο
      //    **εξαφανιζόταν** από τον πίνακα, γιατί η γραφή έστελνε ολόκληρο τον
      //    **παλιό** πίνακα συν τη νέα. Μια άγκυρα το μέτρησε (Α2).
      const occupations = freshProperty.mandates;

      // 🔑 **Ο ΙΔΙΟΣ ΚΡΙΤΗΣ, ΞΑΝΑ, ΜΕ ΤΑ ΦΡΕΣΚΑ** — όχι δεύτερος. Η φάση 1 απαντά
      //    *«αξίζει να προσπαθήσουμε;»*· **αυτή** είναι η μόνη που δεσμεύει, γιατί
      //    είναι η μόνη μέσα στο παράθυρο του CAS.
      // 🔴 **ΠΡΟΣΘΗΚΗ ΣΤΟΝ ΠΙΝΑΚΑ, ΜΕ ΑΝΤΙΚΑΤΑΣΤΑΣΗ ΑΝΑ ΓΡΑΦΕΙΟ** (ADR-832) — ίδια
      //    σημασιολογία με τον `setOwnerPropertyMandate`. Η **δική** μας εντολή
      //    αντικαθίσταται (ανανέωση όρων)· κάθε **ξένη** μένει ανέπαφη.
      const mandates = [
        ...occupations.filter((m) => m.agencyCompanyId !== prepared.mandate.agencyCompanyId),
        prepared.mandate,
      ];

      // 🔴 ADR-864 Α7α — ο **ίδιος** κριτής κλειστής διάθεσης με κάθε άλλον γραφέα, στο φρέσκο έγγραφο.
      const verdict = mandateWriteVerdict(prepared.mandate, occupations, input.nowISO);
      const violations = [
        ...verdict.violations,
        ...privateMarketingViolationsAdded(freshProperty, { ...freshProperty, mandates }, input.nowISO),
      ];
      if (violations.length > 0) {
        return { kind: 'refused', reason: 'mandate-invalid', violations };
      }

      if (prepared.contactDoc !== null) {
        transaction.set(
          adminDb.collection(COLLECTIONS.CONTACTS).doc(prepared.clientContactId),
          prepared.contactDoc,
        );
      }

      transaction.update(propertyRef, {
        mandates,
        // ⚠️ **Το ευρετήριο γράφεται ΜΑΖΙ**, ποτέ σε δεύτερη πράξη — αλλιώς υπάρχει
        //    στιγμή όπου ο σαρωτής λήξης δεν βλέπει την εντολή που μόλις γεννήθηκε.
        mandatesExpireAt: nextMandateExpiry(mandates),
        updatedAt: input.nowISO,
      });

      transaction.update(requestRef, {
        status: 'accepted',
        decidedAt: input.nowISO,
        clientContactId: prepared.clientContactId,
      });

      // 🔴 **ADR-867 §4.3 — Ο ΑΝΘΡΩΠΟΣ ΠΟΥ ΑΝΕΛΑΒΕ, ΓΡΑΜΜΕΝΟΣ ΕΠΙΤΕΛΟΥΣ ΚΑΠΟΥ.**
      //    Ως σήμερα ο `deciderUid` ζούσε **μόνο** στο ίχνος ελέγχου (§2.3): το γραφείο
      //    ήξερε ότι κάποιος δέχτηκε, και **δεν μπορούσε να πει ποιος απαντά**. Χωρίς
      //    ομάδα, το «ποιος διαβάζει;» θα το απαντούσε το `belongsToCompany` — δηλαδή
      //    **όλο** το γραφείο (αντίκειται στο ADR-834 (γ) ①).
      // ⚠️ **Σιωπηλά ιδεμποτής**: ανανέωση όρων στο ίδιο γραφείο βρίσκει την ομάδα και
      //    **δεν** την ξαναγράφει — μια μεταβίβαση ευθύνης δεν ακυρώνεται από ανανέωση.
      const birth = {
        actKind: 'mandate',
        actSeed,
        hostCompanyId: prepared.mandate.agencyCompanyId,
        responsibleUid: input.deciderUid,
      } as const;
      writeActTeamBirth(transaction, teamSlot, birth, input.nowISO);

      // 🔴 **ADR-867 Β4 — ΤΟ ΝΗΜΑ ΓΕΝΝΙΕΤΑΙ ΜΕ ΤΗΝ ΑΚΜΗ, ΟΧΙ ΜΕ ΤΟ ΠΡΩΤΟ ΜΗΝΥΜΑ.** Αν
      //    περίμενε το πρώτο «γεια σας», τότε **ο πελάτης** θα αποφάσιζε ποιος του
      //    απαντά — και το ακροατήριο θα γραφόταν με την ομάδα **εκείνης** της στιγμής,
      //    όχι με την ομάδα που ανέλαβε την πράξη.
      // ⚠️ **Η ομάδα έρχεται από το `effectiveActTeam`, ΠΟΤΕ από τη γέννηση**: σε
      //    **ανανέωση όρων** η αποθηκευμένη ομάδα μπορεί να έχει άλλον υπεύθυνο
      //    (μεταβίβαση) και περισσότερα μέλη. Το ακροατήριο είναι **προβολή** της
      //    ομάδας (§4.3) — μια δεύτερη λίστα εδώ θα την ακύρωνε σιωπηλά.
      writeActThread(transaction, threadSlot, {
        birth: {
          kind: 'act',
          actKind: 'mandate',
          actSeed,
          hostCompanyId: prepared.mandate.agencyCompanyId,
          counterpartUid: input.request.requestedByUserId,
        },
        team: effectiveActTeam(teamSlot, birth),
        newcomerReason: 'creator',
        addedBy: input.deciderUid,
        nowISO: input.nowISO,
      });

      return {
        kind: 'accepted',
        clientContactId: prepared.clientContactId,
        contactCreated: prepared.contactDoc !== null,
      } as const;
    });
  } catch (error) {
    logger.error('[MANDATE-ACCEPT] Η συναλλαγή απέτυχε — ΤΙΠΟΤΑ δεν γράφτηκε', {
      requestId: input.request.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'failed' };
  }
}

/**
 * **Άλλαξε ο κόσμος από τότε που κοιτάξαμε;** — `null` σημαίνει «προχώρα».
 *
 * 🔑 Οι **ίδιες** ερωτήσεις με τη φάση 1, με τα **φρέσκα** έγγραφα. Δεν είναι
 * επανάληψη από φόβο: η φάση 1 απαντά *«αξίζει να προσπαθήσουμε;»* και δίνει στον
 * άνθρωπο **ονομαστικό** λόγο· αυτή εδώ απαντά *«ισχύει ακόμη τη στιγμή που
 * γράφουμε;»* και είναι η **μόνη** που δεσμεύει.
 */
function casViolation(
  request: unknown,
  property: OwnerProperty,
  agencyCompanyId: string,
): Refusal | null {
  const fresh = request as MandateRequest | undefined;
  if (fresh === undefined || fresh.agencyCompanyId !== agencyCompanyId) {
    return { kind: 'refused', reason: 'request-absent' };
  }
  // 🔴 **ΤΟ CAS**: ο,τιδήποτε άλλο από `pending` σημαίνει ότι κάποιος πρόλαβε.
  if (fresh.status !== 'pending') {
    return { kind: 'refused', reason: 'request-not-pending' };
  }

  if (property.lifecycle !== 'listed') {
    return { kind: 'refused', reason: 'listing-withdrawn' };
  }
  // 🔴 **Ο ΕΛΕΓΧΟΣ ΤΗΣ ΣΥΓΚΡΟΥΣΗΣ ΕΓΙΝΕ ΣΤΟ `mandateWriteVerdict`** (ADR-832), με τους
  //    όρους στο χέρι. Ένα `mandates.length > 0` εδώ θα ήταν το παλιό λάθος με νέα
  //    ρούχα: θα απέρριπτε τη **δεύτερη απλή** εντολή, που είναι νόμιμη.

  return null;
}

// =============================================================================
// 3. ΦΑΣΗ 3 — ΟΙ ΠΑΡΕΝΕΡΓΕΙΕΣ: μετά το commit, καμία δεν ακυρώνει τη συμφωνία
// =============================================================================

/**
 * **Η αγγελία λέει πλέον ότι έχει γραφείο** — και ο κόσμος πρέπει να το δει.
 *
 * ⚠️ **Ο ΥΠΑΡΧΩΝ γραφέας της προβολής**, ο ίδιος που καλεί το `persist` και ο σαρωτής
 * του γραφείου. Δεύτερη σύνθεση εδώ θα ήταν δεύτερη μηχανή για το **ίδιο** δημόσιο
 * έγγραφο (ADR-749).
 *
 * ⚠️ **Δεν πετά και δεν ακυρώνει τίποτα**: η συμφωνία **έχει ήδη γραφτεί**. Μια
 * αποτυχία εδώ αφήνει την αγγελία **μπαγιάτικη στον χάρτη**, όχι την εντολή άκυρη —
 * και το αποτύπωμα δημοσίευσης το καταγράφει ώστε η επανασύνθεση να τη βρει.
 */
async function announceToTheWorld(
  adminDb: AdminFirestore,
  property: OwnerProperty,
  mandate: BrokeredListingMandate,
): Promise<void> {
  await republishOwnerProperty(adminDb, { ...property, mandate });
}

/**
 * **Το ίχνος ελέγχου της νέας επαφής** (ADR-195, CHECK 3.17).
 *
 * 🔑 Γράφεται **μόνο** για επαφή που όντως γεννήθηκε: μια υπάρχουσα καρτέλα δεν
 * «δημιουργήθηκε» επειδή την αναγνωρίσαμε, και ένα `created` πάνω της θα έλεγε ψέματα
 * στο ιστορικό της.
 *
 * ⚠️ **Δεν πετά** — ίδιο συμβόλαιο με κάθε παρενέργεια αυτής της φάσης.
 */
async function recordContactBirth(
  input: AcceptanceInput,
  prepared: Prepared,
): Promise<void> {
  try {
    await EntityAuditService.recordChange({
      entityType: ENTITY_TYPES.CONTACT,
      entityId: prepared.clientContactId,
      entityName: prepared.contactName,
      action: 'created',
      changes: [
        {
          field: 'displayName',
          oldValue: null,
          newValue: prepared.contactName,
          label: 'Όνομα',
        },
        {
          field: 'mandateRequestId',
          oldValue: null,
          newValue: input.request.id,
          label: 'Αίτημα ανάθεσης',
        },
      ],
      performedBy: input.deciderUid,
      performedByName: input.deciderUid,
      companyId: input.agencyCompanyId,
    });
  } catch (error) {
    logger.error('[MANDATE-ACCEPT] Το ίχνος ελέγχου της επαφής δεν γράφτηκε', {
      contactId: prepared.clientContactId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
