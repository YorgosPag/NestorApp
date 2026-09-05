import 'server-only';

/**
 * @fileoverview **Η ΣΥΝΑΝΤΗΣΗ ΤΩΝ ΤΡΙΩΝ** — απόδειξη → ταυτότητα → πράξη.
 * @related ADR-844 · first-contact-invitation.service.ts · server/auth/citizen-identity.ts
 * @module services/contact/first-contact-guest.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙ ΚΑΝΕΙ: **ΤΙΠΟΤΑ ΔΙΚΟ ΤΟΥ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Είναι **ακολουθία**, όχι κρίση. Τρία υπάρχοντα, με τη σειρά:
 *
 * 1. **Η απόδειξη** — `first-contact-invitation.service` *(μία χρήση, δύο πόρτες)*
 * 2. **Η ταυτότητα** — `server/auth/citizen-identity` *(ρόλος χωρίς οργανισμό)*
 * 3. **Η πράξη** — `openFirstContact`, ο **ΕΝΑΣ** γραφέας
 *
 * ⛔ **ΔΕΝ ξαναρωτά «γίνεσαι δεκτός;»**. Το `admitFirstContact` τρέχει **μέσα** στον
 * γραφέα, όπως για **κάθε** άλλον άνθρωπο. Ένας δεύτερος έλεγχος εδώ θα ήταν δεύτερη
 * αυθεντία (ADR-749) — και θα απέκλινε την ημέρα που αλλάξει ο κανόνας.
 *
 * ⇒ Γι' αυτό ισχύουν **αυτούσια** και χωρίς καμία γραμμή εδώ: η **ιδεμποτησία**, η
 * **χωρητικότητα των 10** (ΠΕ5/Κ5/Κ9), το *«δεν πλησιάζεις τη δική σου αγγελία»*, και
 * η κρίση της **ζήτησης**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ: Η ΠΡΑΞΗ ΓΡΑΦΕΤΑΙ **ΠΡΙΝ** ΦΥΓΕΙ ΤΟ ΚΛΕΙΔΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο άνθρωπος ακούει *«πάτησε τον σύνδεσμο και φεύγει το μήνυμά σου»*. Αν γράφαμε την
 * πράξη **μετά** τη σύνδεση στον φυλλομετρητή, τότε ένα σφάλμα στη σύνδεση *(ο
 * μίνι-browser του Gmail, μια κλειστή καρτέλα)* θα σήμαινε **υπόσχεση που αθετήθηκε
 * σιωπηλά**: ο άνθρωπος πάτησε, δεν είδε λάθος, και το μήνυμα δεν έφυγε ποτέ.
 *
 * ⇒ Η πράξη γράφεται **εδώ, στον διακομιστή**. Η σύνδεση είναι **δώρο**, όχι
 * προϋπόθεση: αν αποτύχει, ο άνθρωπος έχασε την άνεση — **όχι** την επαφή.
 *
 * **Layering**: service — Admin SDK. Καμία γνώση HTTP· τη μετάφραση προς δίκτυο την
 * κάνουν οι δύο διαδρομές.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { nowISO as clockNowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import {
  ensureCitizenIdentity,
  type CitizenIdentityRefusal,
} from '@/server/auth/citizen-identity';
import {
  claimInvitationByCode,
  claimInvitationByLink,
  type InvitationClaim,
} from '@/services/contact/first-contact-invitation.service';
import { openFirstContact } from '@/services/contact/first-contact.service';
import type { FirstContactRejection } from '@/services/contact/first-contact-vocabulary';
import type { FirstContactForSeeker, FirstContactInvariant } from '@/types/first-contact';
import type {
  FirstContactInvitation,
  FirstContactInvitationRefusal,
} from '@/types/first-contact-invitation';

const logger = createModuleLogger('first-contact-guest.service');

// =============================================================================
// 1. Η ΕΚΒΑΣΗ — κάθε λόγος ονομαστικά
// =============================================================================

/**
 * 🔑 **Πέντε είδη άρνησης, γιατί στέλνουν σε πέντε διαφορετικές ενέργειες**, και ο
 * άνθρωπος στέκεται σε δημόσια σελίδα χωρίς κανέναν να ρωτήσει:
 *
 * - `link` — *«ο σύνδεσμος έληξε»* ⇒ ξαναζήτα
 * - `contact` — *«ο ιδιοκτήτης γέμισε»* ⇒ η πράξη δεν χωρά, **όχι** δικό σου λάθος
 * - `invalid` — *«λείπει το όνομά σου»* ⇒ **εσύ** το διορθώνεις
 * - `identity` — *«ο λογαριασμός είναι κλειστός»* ⇒ επικοινώνησε μαζί μας
 * - `unavailable` — *«δεν μάθαμε»* ⇒ **ποτέ** ίδιο με άρνηση (N.12)
 */
export type GuestContactOutcome =
  | {
      readonly kind: 'contacted';
      readonly contact: FirstContactForSeeker;
      readonly created: boolean;
      /** Το εφήμερο κλειδί για `signInWithCustomToken`. **Άνεση, όχι προϋπόθεση.** */
      readonly customToken: string;
    }
  | { readonly kind: 'link-refused'; readonly reason: FirstContactInvitationRefusal }
  | { readonly kind: 'contact-refused'; readonly reason: FirstContactRejection }
  | { readonly kind: 'invalid'; readonly violations: readonly FirstContactInvariant[] }
  | { readonly kind: 'identity-refused'; readonly reason: CitizenIdentityRefusal }
  | { readonly kind: 'unavailable' };

// =============================================================================
// 2. ΟΙ ΔΥΟ ΕΙΣΟΔΟΙ
// =============================================================================

/** **Πόρτα Α** — ο άνθρωπος πάτησε τον σύνδεσμο στο email του. */
export async function redeemGuestContactByLink(
  adminDb: AdminFirestore,
  token: string,
  at: string = clockNowISO(),
): Promise<GuestContactOutcome> {
  return finish(adminDb, await claimInvitationByLink(adminDb, token, at), at);
}

/** **Πόρτα Β** — ο άνθρωπος έγραψε τον εξαψήφιο κωδικό στην ανοιχτή του καρτέλα. */
export async function redeemGuestContactByCode(
  adminDb: AdminFirestore,
  invitationId: string,
  code: string,
  at: string = clockNowISO(),
): Promise<GuestContactOutcome> {
  return finish(adminDb, await claimInvitationByCode(adminDb, invitationId, code, at), at);
}

// =============================================================================
// 3. Η ΑΚΟΛΟΥΘΙΑ
// =============================================================================

async function finish(
  adminDb: AdminFirestore,
  claim: InvitationClaim,
  at: string,
): Promise<GuestContactOutcome> {
  if (claim.kind === 'refused') {
    return { kind: 'link-refused', reason: claim.reason };
  }

  const identity = await ensureCitizenIdentity({
    // 🔑 **Το ΕΠΑΛΗΘΕΥΜΕΝΟ κανάλι, όχι ό,τι πληκτρολογήθηκε.** Δες {@link provenDeclaration}.
    email: claim.invitation.channelEmail,
    displayName: claim.invitation.declaration.disclosure.displayName,
  });
  if (identity.kind === 'refused') {
    return { kind: 'identity-refused', reason: identity.reason };
  }

  return writeAct(adminDb, claim.invitation, identity.uid, identity.customToken, at);
}

/**
 * **Η δήλωση, με το κανάλι που ΑΠΟΔΕΙΧΘΗΚΕ.**
 *
 * 🔴 **ΑΝΤΙΚΑΘΙΣΤΑ ΤΟ `email` ΤΗΣ ΔΗΛΩΣΗΣ, ΚΑΙ ΕΙΝΑΙ Η ΑΠΟΦΑΣΗ #3 ΤΟΥ Giorgio.**
 * Η δήλωση παρκάρησε με ό,τι πληκτρολογήθηκε *(κεφαλαία, κενά, τυπογραφικά)*· εκείνο
 * που **αποδείχθηκε** είναι το `channelEmail` — η διεύθυνση όπου έφτασε ο σύνδεσμος
 * και από όπου γύρισε η απόδειξη.
 *
 * ⚠️ Χωρίς αυτή τη γραμμή, ο προσφέρων θα έβλεπε τη μορφή που **πληκτρολογήθηκε** ενώ
 * εμείς επαληθεύσαμε την **κανονικοποιημένη** — δύο συμβολοσειρές για την ίδια
 * διεύθυνση, με μόνο τη μία αποδεδειγμένη. Ο Κώστας πρέπει να βλέπει **αυτήν**.
 *
 * ⚠️ Το `phone` μένει **αυτούσιο και ανεπαλήθευτο** επίτηδες: είναι **προαιρετικό
 * πρόσθετο** που δίνει ο άνθρωπος οικειοθελώς (απόφαση #5). Η επαλήθευσή του θα
 * απαιτούσε SMS — δηλωμένο ως ξεχωριστό έργο, **όχι** σιωπηλό κενό.
 */
function provenDeclaration(invitation: FirstContactInvitation) {
  return {
    ...invitation.declaration,
    disclosure: {
      ...invitation.declaration.disclosure,
      email: invitation.channelEmail,
    },
  };
}

async function writeAct(
  adminDb: AdminFirestore,
  invitation: FirstContactInvitation,
  uid: string,
  customToken: string,
  at: string,
): Promise<GuestContactOutcome> {
  // ⚠️ **`companyId: null`, και δεν είναι παράλειψη**: ο πολίτης **δεν έχει**
  //    οργανισμό — αυτό ακριβώς τον κάνει ιδιώτη για το `listing-custody` (CHECK 3.56),
  //    που δηλώνει `companyId: string | null` με γραμμένη αιτιολογία. ⛔ ΠΟΤΕ `?? ''`.
  const result = await openFirstContact(
    adminDb,
    { uid, companyId: null },
    provenDeclaration(invitation),
    at,
  );

  switch (result.kind) {
    case 'created':
    case 'unchanged':
      return {
        kind: 'contacted',
        contact: result.contact,
        created: result.kind === 'created',
        customToken,
      };
    case 'rejected':
      return { kind: 'contact-refused', reason: result.reason };
    case 'invalid':
      return { kind: 'invalid', violations: result.violations };
    case 'unavailable':
    case 'failed':
      // 🔴 **Η ΠΡΟΣΚΛΗΣΗ ΕΧΕΙ ΗΔΗ ΣΦΡΑΓΙΣΤΕΙ ΩΣ ΧΡΗΣΙΜΟΠΟΙΗΜΕΝΗ, ΚΑΙ ΤΟ ΞΕΡΟΥΜΕ.**
      //    Δηλαδή ο άνθρωπος **δεν** μπορεί να ξαναπατήσει τον ίδιο σύνδεσμο.
      //    ⚠️ Είναι **επιλογή, όχι αβλεψία**: η εναλλακτική —ξεσφράγισμα σε αποτυχία—
      //    απαιτεί δεύτερη γραφή που μπορεί **και αυτή** να αποτύχει, και αφήνει
      //    παράθυρο όπου δύο ταυτόχρονα πατήματα γεννούν **δύο** πράξεις. Το «μία
      //    χρήση» παύει να είναι εγγύηση.
      //    ⇒ Ο άνθρωπος ξαναπατά **«Αποστολή»** στη σελίδα (νέα πρόσκληση, η παλιά
      //    γίνεται `superseded`) — δρόμος που **υπάρχει ήδη** και δεν κοστίζει καμία
      //    εγγύηση. Η οθόνη οφείλει να του το πει, γι' αυτό η έκβαση είναι ονομαστική.
      logger.error('Η πράξη δεν γράφτηκε μετά από έγκυρη απόδειξη', {
        invitationId: invitation.id,
        kind: result.kind,
      });
      return { kind: 'unavailable' };
  }
}
