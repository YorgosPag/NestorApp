import 'server-only';

/**
 * @fileoverview **ΦΑΣΗ 1 ΤΗΣ ΑΠΟΔΟΧΗΣ — Η ΕΤΟΙΜΑΣΙΑ**: μόνο αναγνώσεις, όλα ακυρώσιμα.
 * @related services/mandate/mandate-acceptance.service.ts (η ΣΥΝΑΛΛΑΓΗ που ακολουθεί)
 * @module services/mandate/mandate-acceptance-prepare
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΧΩΡΙΣΤΑ ΑΠΟ ΤΗ ΣΥΝΑΛΛΑΓΗ — ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΤΟ ΟΡΙΟ ΤΩΝ 500 ΓΡΑΜΜΩΝ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Εδώ μέσα **τίποτα δεν γράφεται**. Κάθε συνάρτηση απαντά *«μπορεί ακόμη;»* και
 * επιστρέφει **άρνηση** ή **άγνωστο** — ποτέ τα δύο μαζί (N.12). Ό,τι αποφασιστεί εδώ
 * είναι **ακυρώσιμο**: αν κάτι κοκκινίσει, το σύστημα μένει **ακριβώς** όπως ήταν.
 *
 * ⚠️ **ΚΑΙ Η ΕΤΟΙΜΑΣΙΑ ΔΕΝ ΔΕΣΜΕΥΕΙ ΤΗ ΣΥΝΑΛΛΑΓΗ.** Ό,τι διαβάστηκε εδώ μπορεί να
 * έχει αλλάξει μέχρι το `commit` — γι' αυτό η φάση 2 **ξαναδιαβάζει με CAS**. Αυτό το
 * αρχείο είναι ο **γρήγορος δρόμος της άρνησης**, όχι η απόδειξη της αποδοχής.
 *
 * ⛔ **ΜΗΝ βάλεις γραφή εδώ.** Η ταυτότητα της επαφής γεννιέται (`generateContactId`)
 * αλλά **δεν γράφεται**: το έγγραφο ταξιδεύει έτοιμο στη συναλλαγή, που είναι ο
 * **μόνος** γραφέας. Μια γραφή εδώ θα ήταν παρενέργεια σε φάση που **ακυρώνεται**.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { buildContactDocument } from '@/services/ai-pipeline/shared/contact-document-builder';
import { findContactByEmail } from '@/services/ai-pipeline/shared/contact-lookup-search';
import { generateContactId } from '@/services/enterprise-id-convenience';
import {
  readOwnerIdentity,
  type OwnerIdentity,
} from '@/services/mandate/mandate-owner-identity';
import type { MandateRequest } from '@/types/mandate-request';
import type { OwnerProperty } from '@/types/owner-property';
import {
  mandatesOf,
  mandateWriteVerdict,
  OWNER_CONSENT,
  type BrokeredListingMandate,
} from '@/types/owner-property-mandate';

import type {
  AcceptanceInput,
  AcceptanceOutcome,
  Refusal,
} from '@/services/mandate/mandate-acceptance-types';

const logger = createModuleLogger('mandate-acceptance-prepare');


export interface Prepared {
  readonly kind: 'ready';
  readonly property: OwnerProperty;
  readonly mandate: BrokeredListingMandate;
  /**
   * ⛔ **ΔΕΝ ταξιδεύουν οι υπάρχουσες εντολές, και είναι ΤΟ ΔΙΟΡΘΩΜΕΝΟ ΛΑΘΟΣ.** Το
   * πεδίο υπήρχε με σχόλιο *«όπως διαβάστηκαν από τη συναλλαγή»* — **ψευδές**: η
   * φάση 1 διαβάζει με σκέτο `.get()`, **έξω** από κάθε συναλλαγή. Ο γραφέας που τις
   * εμπιστευόταν έχτιζε τον νέο πίνακα πάνω σε **μπαγιάτικο** αντίγραφο και
   * **έσβηνε** ό,τι είχε γραφτεί στο ενδιάμεσο. Ο γραφέας διαβάζει πλέον το
   * `propertySnap` της **δικής του** συναλλαγής (`mandate-acceptance.service.ts`).
   */
  readonly clientContactId: string;
  /** `null` όταν η επαφή **υπάρχει ήδη** — τότε δεν γράφεται τίποτα. */
  readonly contactDoc: Record<string, unknown> | null;
  readonly contactName: string;
}

export async function prepare(
  adminDb: AdminFirestore,
  input: AcceptanceInput,
): Promise<Prepared | Exclude<AcceptanceOutcome, { kind: 'accepted' }>> {
  const property = await readListing(adminDb, input.request.ownerPropertyId);
  if ('kind' in property) return property;

  const identity = await ownerIdentityFor(adminDb, input.request.requestedByUserId);
  if ('kind' in identity) return identity;

  const contact = await resolveClientContact(adminDb, input, identity);
  if ('kind' in contact) return contact;

  const mandate = brokeredMandateFrom(input.request, contact.contactId);

  // 🔑 **Ο ΙΔΙΟΣ ΚΡΙΤΗΣ ΜΕ ΤΗ ΔΕΥΤΕΡΗ ΠΟΡΤΑ** (`setOwnerPropertyMandate`), εξηγμένος
  //    ώστε να καλείται και από εδώ. ⛔ **ΜΗΝ γράψεις δεύτερο**: ένα όριο διάρκειας
  //    που ισχύει στη μία από τις δύο διαδρομές είναι αδρανής φρουρός (ADR-749 §5).
  const verdict = mandateWriteVerdict(mandate, mandatesOf(property), input.nowISO);
  if (verdict.violations.length > 0) {
    return { kind: 'refused', reason: 'mandate-invalid', violations: verdict.violations };
  }

  return {
    kind: 'ready',
    property,
    mandate,
    clientContactId: contact.contactId,
    contactDoc: contact.doc,
    contactName: contact.displayName,
  };
}

/**
 * **Η αγγελία, αν μπορεί ακόμη να ανατεθεί.**
 *
 * ⚠️ Οι **ίδιοι** τρεις έλεγχοι με τον γραφέα του Σ1 (`loadOwnListing`) — και σκόπιμα:
 * ανάμεσα στην υποβολή και στην αποδοχή μεσολαβεί χρόνος όπου ο ιδιοκτήτης μπορεί να
 * αποσύρει ή να αναθέσει αλλού. Η κρίση της **στιγμής της υποβολής** δεν δεσμεύει τη
 * **στιγμή της αποδοχής**.
 */
async function readListing(
  adminDb: AdminFirestore,
  ownerPropertyId: string,
): Promise<OwnerProperty | Refusal> {
  try {
    const snapshot = await adminDb
      .collection(COLLECTIONS.OWNER_PROPERTIES)
      .doc(ownerPropertyId)
      .get();

    const property = snapshot.data() as OwnerProperty | undefined;
    if (property === undefined) return { kind: 'refused', reason: 'listing-withdrawn' };
    if (property.lifecycle !== 'listed') {
      return { kind: 'refused', reason: 'listing-withdrawn' };
    }
    // 🔴 **Ο ΕΛΕΓΧΟΣ ΕΓΙΝΕ ΚΡΙΤΗΣ ΣΥΓΚΡΟΥΣΗΣ** (ADR-832). Έγραφε
    //    `mandate.kind !== 'self'` — απέρριπτε κάθε δεύτερη ανάθεση χωρίς να ρωτήσει
    //    το είδος, δηλαδή απαγόρευε και την **απλή** εντολή που υπάρχει ακριβώς για
    //    να επιτρέπεται. Ο πραγματικός κριτής τρέχει στο `mandateWriteVerdict`, με
    //    τους όρους στο χέρι — και ο φρουρός εδώ θα ήταν πλέον **δεύτερη απάντηση**
    //    στο ίδιο ερώτημα (ADR-749).
    return { ...property, id: ownerPropertyId };
  } catch (error) {
    logger.error('[MANDATE-ACCEPT] Η ανάγνωση της αγγελίας απέτυχε — άγνωστο, όχι κενό', {
      ownerPropertyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'unavailable' };
  }
}

/**
 * **Η ταυτότητα του ιδιώτη, τη ΣΤΙΓΜΗ της αποδοχής** — ο ΕΝΑΣ κριτής, μεταφρασμένος
 * στο λεξιλόγιο **αυτής** της πόρτας.
 *
 * 🔴 **Ο ΚΡΙΤΗΣ ΕΦΥΓΕ ΑΠΟ ΕΔΩ ΚΑΙ ΕΓΙΝΕ SSoT** (ADR-834 §6.2,
 * {@link ../../services/mandate/mandate-owner-identity}) — γιατί έτρεχε **μόνο εδώ**,
 * δηλαδή μόνο στη μεριά του **γραφείου**, ενώ ο άνθρωπος που μπορεί να διορθώσει
 * περνά από **άλλη** πόρτα. Ήταν ο **αδρανής φρουρός** που το αρχείο αυτό
 * προειδοποιεί δέκα γραμμές πιο κάτω να μη γεννηθεί.
 *
 * ⚠️ **Ο έλεγχος ΕΔΩ ΜΕΝΕΙ, και είναι η ΑΜΥΝΑ.** Ό,τι κρίθηκε στην υποβολή μπορεί να
 * έχει αλλάξει· εδώ κρίνονται τα **φρέσκα** δεδομένα, τη στιγμή που γεννιέται το
 * νομικό κείμενο. Μετακινήθηκε η **γνώση**, ποτέ η άμυνα (N.7.2 #4).
 *
 * 🔑 **Και η μετάφραση γίνεται εδώ, όχι στον κριτή**: το `identity-incomplete` αυτής
 * της πόρτας είναι `MandateDecisionRefusal`· της άλλης είναι `MandateRequestRejection`.
 * Ίδιο όνομα, **δύο** κλειστά σύνολα — ένας κριτής που γεννούσε άρνηση θα ανάγκαζε το
 * ένα λεξιλόγιο να γνωρίζει το άλλο.
 */
async function ownerIdentityFor(
  adminDb: AdminFirestore,
  uid: string,
): Promise<OwnerIdentity | Refusal> {
  const reading = await readOwnerIdentity(adminDb, uid);
  switch (reading.kind) {
    case 'complete':
      return reading.identity;
    case 'incomplete':
      return { kind: 'refused', reason: 'identity-incomplete' };
    case 'unavailable':
      return { kind: 'unavailable' };
  }
}

interface ResolvedContact {
  readonly contactId: string;
  readonly doc: Record<string, unknown> | null;
  readonly displayName: string;
}

/**
 * **Υπάρχουσα καρτέλα, ή καινούρια** — ποτέ δεύτερη για τον ίδιο άνθρωπο (§8.4).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Ο ΚΡΙΤΗΣ ΕΙΝΑΙ ΤΟ `findContactByEmail`, ΟΧΙ ΤΟ `checkContactDuplicates`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το ADR §8.4 ονομάζει το `DuplicatePreventionService`. **Μετρήθηκε ότι ο δείκτης
 * είναι λάθος**: εκείνο εισάγει `firebase/firestore` + `@/lib/firebase` — είναι
 * **πελατικό** και δεν μπορεί να κληθεί από διακομιστή.
 *
 * ⛔ **Και ο προφανής αντικαταστάτης, το `checkContactDuplicates`, είναι ΕΠΙΚΙΝΔΥΝΟΣ
 * εδώ**: κάνει **ασαφή ταύτιση ονόματος** όταν δεν βρει email/τηλέφωνο. Σε αυτή τη
 * διαδρομή μια «κοντινή» ταύτιση θα κόλλαγε το ΑΦΜ ενός ανθρώπου στην καρτέλα
 * **άλλου** — σε **νομικό** κείμενο.
 *
 * 🔑 Εδώ η ερώτηση είναι **ακριβής, όχι πιθανολογική**: ο ιδιώτης έχει λογαριασμό, με
 * **πιστοποιημένο** email. *«Είναι αυτό το email ήδη επαφή ΜΟΥ;»* έχει μία σωστή
 * απάντηση, και το `findContactByEmail` τη δίνει με το `companyId` του γραφείου.
 */
async function resolveClientContact(
  adminDb: AdminFirestore,
  input: AcceptanceInput,
  identity: OwnerIdentity,
): Promise<ResolvedContact | Refusal> {
  try {
    const existing = await findContactByEmail(identity.email, input.agencyCompanyId);
    if (existing !== null) {
      return { contactId: existing.contactId, doc: null, displayName: existing.name };
    }
  } catch (error) {
    logger.error('[MANDATE-ACCEPT] Ο έλεγχος διπλότυπης επαφής απέτυχε', {
      agencyCompanyId: input.agencyCompanyId,
      error: error instanceof Error ? error.message : String(error),
    });
    // 🔴 **ΑΡΝΗΣΗ, ΟΧΙ «ΓΡΑΨΕ ΚΑΙΝΟΥΡΙΑ»**: μια αποτυχία εδώ διαβασμένη ως «δεν
    //    υπάρχει» παράγει **δεύτερη καρτέλα για τον ίδιο άνθρωπο** — και μαζί δεύτερο
    //    αντίγραφο προσωπικών δεδομένων, που το §8.4 απαγορεύει ονομαστικά.
    return { kind: 'unavailable' };
  }

  // 🔴 `setDoc` + γεννήτορας του `enterprise-id` (N.6) — **ΠΟΤΕ** `addDoc`. Η ταυτότητα
  //    γεννιέται **εδώ**, ώστε η συναλλαγή να ξέρει σε ποιο έγγραφο γράφει.
  const built = buildContactDocument({
    firstName: identity.givenName,
    lastName: identity.familyName,
    email: identity.email,
    phone: null,
    type: 'individual',
    companyId: input.agencyCompanyId,
    createdBy: input.deciderUid,
    // ⚠️ Ο έλεγχος διπλότυπου έγινε **ήδη**, με το σωστό ερώτημα. Ένας δεύτερος μέσα
    //    στον δομητή δεν υπάρχει — αυτός είναι καθαρός — αλλά η σημαία δηλώνεται ρητά
    //    ώστε η πρόθεση να διαβάζεται.
    skipDuplicateCheck: true,
    vatNumber: identity.vatNumber,
  });

  return { contactId: generateContactId(), doc: built.doc, displayName: built.displayName };
}

/**
 * **Η εντολή που γεννιέται** — και γιατί **δεν** έχει σύνδεσμο συγκατάθεσης.
 *
 * 🏆 **ΕΔΩ ΕΙΝΑΙ Η ΔΟΜΙΚΗ ΔΙΑΦΟΡΑ ΑΠΟ ΤΗ ΦΑΣΗ Α, ΚΑΙ ΕΙΝΑΙ ΥΠΕΡ ΤΟΥ ΙΔΙΩΤΗ.** Όταν το
 * **γραφείο** καταχωρεί για λογαριασμό πελάτη, η συγκατάθεση **λείπει** και πρέπει να
 * ζητηθεί: γεννιέται `consentNonce`, φεύγει email, η εντολή μένει `pending`. Εδώ ο
 * ιδιώτης **ξεκίνησε ο ίδιος** — η συγκατάθεση **είναι το ίδιο το αίτημα** (§8.4):
 * πράξη του υποκειμένου, ρητή, χρονοσημασμένη, με τους όρους **ορατούς πριν** την
 * υποβολή.
 *
 * ⇒ `confirmation: 'confirmed'` · `consentNonce: null` · `proof: OWNER_CONSENT`.
 *
 * ⛔ **ΜΗΝ «διορθώσεις» σε `pending` με σύνδεσμο.** Θα ζητούσε από τον άνθρωπο να
 * επιβεβαιώσει **δεύτερη φορά** αυτό που μόλις ζήτησε — και η σιωπή του θα διαβαζόταν
 * ως άρνηση σε δική του πρωτοβουλία.
 *
 * ⚠️ **Το `decidedAt` είναι το `requestedAt`, ΟΧΙ η στιγμή της αποδοχής.** Το πεδίο
 * ρωτά *«πότε μίλησε ο άνθρωπος;»* — και ο άνθρωπος μίλησε όταν έστειλε. Η στιγμή του
 * γραφείου ζει στο `decidedAt` του **αιτήματος**, που είναι άλλο έγγραφο και άλλος
 * δράστης.
 *
 * ⚠️ **`notifiedAt: null` και είναι η αλήθεια**: ο ιδιώτης δεν το ξέρει ακόμη. Ο
 * ταξινομητής το διαβάζει ως `UNANNOUNCED_LIVE` — *«η εντολή ζει, ο πελάτης δεν το
 * ξέρει»* — μέχρι να φύγει η ειδοποίηση.
 */
function brokeredMandateFrom(
  request: MandateRequest,
  clientContactId: string,
): BrokeredListingMandate {
  return {
    kind: 'brokered',
    clientContactId,
    confirmation: 'confirmed',
    confirmedByUserId: request.requestedByUserId,
    proof: { via: OWNER_CONSENT },
    // ⚠️ Οι όροι έρχονται **αυτούσιοι** από το αίτημα — καμία προεπιλογή εδώ. Ένα
    //    `?? DEFAULT_LISTING_AGREEMENT` θα δέσμευε τον ιδιοκτήτη σε όρο που κανείς δεν
    //    του έδειξε (ADR-827 Α4/Α5, το μάθημα των $418M).
    agreement: request.terms.agreement,
    compensation: request.terms.compensation,
    decidedAt: request.requestedAt,
    notifiedAt: null,
    viewedAt: null,
    consentNonce: null,
    expiresAt: request.terms.expiresAt,
    agencyRevokedAt: null,
    // ── ADR-832: η κατάληψη ────────────────────────────────────────────────
    // ⚠️ Και τα τρία **αυτούσια από το αίτημα**, με τον ίδιο λόγο: είναι όροι που ο
    //    ιδιοκτήτης **είδε και ενέκρινε**. Παραγόμενο `scope` από τις διαθέσεις της
    //    αγγελίας θα έδινε στο γραφείο πράξη που δεν του ανατέθηκε.
    agencyCompanyId: request.agencyCompanyId,
    startsAt: request.terms.startsAt,
    scope: request.terms.scope,
  };
}
