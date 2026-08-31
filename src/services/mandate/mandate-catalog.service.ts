/**
 * @fileoverview **Ο ΚΑΤΑΛΟΓΟΣ ΕΝΤΟΛΩΝ** — τι περιμένει το γραφείο, και από ποιον.
 * @related ADR-777 §8.34 · lib/mandate/mandate-standing.ts · CHECK 3.35
 * @module services/mandate/mandate-catalog.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΙΑΚΟΜΙΣΤΗΣ ΚΑΙ ΟΧΙ ΖΩΝΤΑΝΗ ΑΝΑΓΝΩΣΗ ΑΠΟ ΤΟΝ ΠΕΛΑΤΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κατάλογος ρωτά **«ποιες εντολές ανήκουν σε ΑΥΤΟ το γραφείο;»** — δηλαδή διαβάζει
 * κατά `authorCompanyId`. Και το `authorCompanyId` **δεν είναι πεδίο απομόνωσης**: το
 * `services/firestore/tenant-config.ts` το απαγορεύει **ονομαστικά** (*«δύο άξονες
 * απομόνωσης για ένα έγγραφο σημαίνει **δύο απαντήσεις** στο “ποιος το βλέπει;”»*), και
 * ο κανόνας του `owner_properties` στο `firestore.rules` έχει **γραμμένο σχόλιο** που
 * απαγορεύει σκέλος πάνω του.
 *
 * ⇒ Ένα δεύτερο σκέλος στους κανόνες θα ήταν η **εύκολη** λύση και η **λάθος**: θα
 * έδινε στον πελάτη δικαίωμα ανάγνωσης σε έγγραφα που **δεν είναι δικά του**, με τη
 * μοναδική εγγύηση να ζει σε μια συμβολοσειρά κανόνα. Εδώ η ταυτότητα του γραφείου
 * έρχεται από το `ctx.companyId`, **ποτέ από το σώμα** — ίδια κίνηση με την πόρτα
 * καταχώρησης (`api/owner-properties/brokered/route.ts`).
 *
 * ⚠️ **CHECK 3.35**: το ερώτημα ονομάζει στατικά και τη συλλογή και το πεδίο, οπότε ο
 * σαρωτής μπορεί να το κρίνει. **Κανένα `tenantOverride: 'skip'`.**
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΤΑΞΙΝΟΜΗΣΗ ΣΤΗ ΜΝΗΜΗ ΚΑΙ ΟΧΙ `orderBy` — ΔΕΝ ΕΙΝΑΙ ΣΥΜΒΙΒΑΣΜΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η σειρά του καταλόγου είναι **επείγον**, όχι ημερομηνία: πρώτα η εντολή που κανείς
 * δεν ειδοποίησε, τελευταία εκείνη που δεν χρειάζεται τίποτα. Το «επείγον» είναι
 * **υπολογισμένο** ({@link mandateStandingOf}) από τέσσερα πεδία και τον χρόνο — δηλαδή
 * **δεν είναι πεδίο**, άρα καμία Firestore `orderBy` δεν μπορεί να το εκφράσει, με ή
 * χωρίς ευρετήριο. Η ταξινόμηση στη μνήμη είναι η **μόνη** υλοποιήσιμη, όχι η φθηνή.
 *
 * 🔑 **Και γι' αυτό δεν προστέθηκε σύνθετο ευρετήριο**: ένα ευρετήριο για `orderBy`
 * που κανείς δεν εκτελεί θα ήταν **αδρανής φρουρός** (ADR-749 §5). Το `where` σε ένα
 * πεδίο εξυπηρετείται από το αυτόματο ευρετήριο ενός πεδίου.
 *
 * ⚠️ **ΤΟ ΟΡΙΟ ΛΕΓΕΤΑΙ, ΔΕΝ ΚΡΥΒΕΤΑΙ** ({@link MANDATE_CATALOG_CAP}). Ένας σιωπηλός
 * αποκεφαλισμός θα διάβαζε «αυτές είναι όλες» ενώ θα ήταν «οι πρώτες όσες χώρεσαν» —
 * και σε οθόνη **τριάζ** αυτό σημαίνει «δεν υπάρχει τίποτα επείγον» για γραφείο που
 * έχει.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { createModuleLogger } from '@/lib/telemetry';
import {
  daysUntilExpiry,
  groupOfStanding,
  MANDATE_STANDINGS,
  mandateStandingOf,
  type MandateStanding,
  type MandateStandingGroup,
} from '@/lib/mandate/mandate-standing';
import {
  clientNameFrom,
  CLIENT_NAME_IS_MISSING,
  CLIENT_NAME_KNOWN,
  type MandateClientName,
} from '@/lib/mandate/mandate-client-name';
import type { Contact } from '@/types/contacts/contracts';
import { getContactDisplayName } from '@/types/contacts/helpers';
import { isOwnerPropertyOnTheMarket, type OwnerProperty } from '@/types/owner-property';
import type {
  BrokeredListingMandate,
  MandateNotifyOutcome,
} from '@/types/owner-property-mandate';
import { mandatesOf, notifyOutcomeOf } from '@/types/owner-property-mandate';

const logger = createModuleLogger('mandate-catalog.service');

/**
 * **Πόσες γραμμές το πολύ.** Βαλβίδα ασφαλείας, όχι σελιδοποίηση.
 *
 * Μετρημένο: η συλλογή έχει σήμερα **1** έγγραφο συνολικά και **καμία** εντολή
 * γραφείου· ένα μεσιτικό γραφείο μεσαίου μεγέθους κρατά δεκάδες ενεργές εντολές. Το
 * όριο υπάρχει ώστε ένα παθολογικό σύνολο να μην κατεβάσει ολόκληρη τη συλλογή σε μία
 * απόκριση — και **αναφέρεται** στο σώμα ({@link MandateCatalog.truncated}).
 */
export const MANDATE_CATALOG_CAP = 500;

/** Μία γραμμή του καταλόγου — ό,τι χρειάζεται η οθόνη, τίποτα παραπάνω. */
export interface MandateCatalogRow {
  readonly ownerPropertyId: string;
  readonly listingTitle: string;
  /**
   * Το όνομα του πελάτη — ή **ποια από τις δύο άγνοιες** ισχύει (ADR-834 §6.5.δ).
   *
   * 🔴 **Ήταν `string | null`, και το `null` κουβαλούσε ΔΥΟ κόσμους**: «η επαφή
   * διαγράφηκε» και «η επαφή υπάρχει χωρίς όνομα». Η οθόνη τύπωνε *«Η επαφή δεν
   * βρέθηκε»* και για τα δύο — δηλαδή έστελνε τον μεσίτη να ψάξει διαγραμμένη επαφή
   * που **δεν** διαγράφηκε. Δες {@link MandateClientName} για τις δύο θεραπείες.
   */
  readonly clientName: MandateClientName;
  readonly clientContactId: string;
  readonly standing: MandateStanding;
  readonly group: MandateStandingGroup;
  /** `null` όταν έχει ήδη λήξει ή η λήξη δεν διαβάζεται — η κατάσταση το λέει. */
  readonly daysLeft: number | null;
  readonly expiresAt: string;
  readonly notifiedAt: string | null;
  /**
   * 🔴 **ΓΙΑΤΙ ΔΕΝ ΕΦΤΑΣΕ ΤΟ ΜΗΝΥΜΑ** — `null` = καμία καταγεγραμμένη απόπειρα.
   *
   * Ταξιδεύει **δίπλα** στο {@link notifiedAt} και ποτέ αντί για αυτό: εκείνο απαντά
   * *«πότε»*, αυτό *«πώς πήγε»*. Χωρίς αυτό, η γραμμή «Δεν στάλθηκε ποτέ» έπρεπε να
   * **μαντέψει** την αιτία από ένα bit (ADR-834 §6.5.δ).
   */
  readonly notifyOutcome: MandateNotifyOutcome | null;
  readonly viewedAt: string | null;
  readonly decidedAt: string | null;
  /** `owner-consent` ⇄ `agency-attestation` — **η προέλευση, ποτέ κρυμμένη**. */
  readonly proofVia: BrokeredListingMandate['proof']['via'];
  /** Είναι **αυτή τη στιγμή** ορατή στον κόσμο; Παράγωγο, όχι δεύτερος κριτής. */
  readonly onTheMarket: boolean;
}

/** Ό,τι επιστρέφει ο κατάλογος, **μαζί με τη λογιστική του**. */
export interface MandateCatalog {
  readonly rows: readonly MandateCatalogRow[];
  /** Πόσες σε κάθε κατάσταση — **όλες οι καταστάσεις, ακόμη και οι μηδενικές**. */
  readonly tally: Readonly<Record<MandateStanding, number>>;
  /** `true` όταν χτυπήθηκε το {@link MANDATE_CATALOG_CAP}. **Ποτέ σιωπηλό.** */
  readonly truncated: boolean;
}

/**
 * Άδειος πίνακας μετρήσεων με **όλες** τις καταστάσεις στο μηδέν.
 *
 * 🔑 **Οι μηδενικές τυπώνονται κι αυτές, και είναι σκόπιμο.** Ένα «0 εντολές που δεν
 * ειδοποιήθηκαν» λέει *«κοίταξα και δεν υπάρχουν»*· η **απουσία** της γραμμής λέει
 * *«δεν υπάρχει τέτοιος έλεγχος»* — και οι δύο διαβάζονται ίδια από άνθρωπο που
 * βιάζεται. Ίδιο ιδίωμα με τους μπλοκάροντες κάδους της CHECK 3.48.
 */
function emptyTally(): Record<MandateStanding, number> {
  const tally = {} as Record<MandateStanding, number>;
  for (const standing of MANDATE_STANDINGS) tally[standing] = 0;
  return tally;
}

/** Η θέση κάθε κατάστασης στη σειρά επείγοντος — **από τον ίδιο** τον πίνακα. */
const URGENCY_RANK = new Map<MandateStanding, number>(
  MANDATE_STANDINGS.map((standing, index) => [standing, index]),
);

/**
 * **Τα ονόματα των πελατών**, σε μία ομαδική ανάγνωση.
 *
 * ⚠️ **Ποτέ μία ανάγνωση ανά γραμμή.** Ένας κατάλογος 80 εντολών θα έκανε 80 διαδοχικά
 * ταξίδια στη βάση — και το `getAll` του Admin SDK υπάρχει ακριβώς γι' αυτό (ίδιο
 * ιδίωμα με το `api/spaces/batch-resolve`).
 *
 * ⚠️ **Το όνομα βγαίνει από το {@link getContactDisplayName}**, τον έναν τόπο που ξέρει
 * ότι μια επαφή μπορεί να είναι άνθρωπος, εταιρεία ή υπηρεσία. Ένα χειρόγραφο
 * `firstName + lastName` εδώ θα έγραφε **κενό** για κάθε εταιρικό πελάτη.
 *
 * 🔴 **ΤΟ `continue` ΗΤΑΝ Η ΡΙΖΑ ΤΟΥ ΨΕΜΑΤΟΣ** (ADR-834 §6.5.δ). Έβγαζε από τον χάρτη
 * **και** την ανύπαρκτη επαφή **και** την ανώνυμη, οπότε ο καλών έβλεπε την ίδια
 * απουσία και τύπωνε *«Η επαφή δεν βρέθηκε»* για επαφή που **βρέθηκε**. Πλέον ο
 * χάρτης κρατά **ονομασμένη κατάσταση** για κάθε ταυτότητα που ζητήθηκε — η άγνοια
 * **ταξιδεύει**, δεν εξαφανίζεται.
 */
async function readClientNames(
  adminDb: AdminFirestore,
  contactIds: readonly string[],
): Promise<Map<string, MandateClientName>> {
  const names = new Map<string, MandateClientName>();
  if (contactIds.length === 0) return names;

  const refs = contactIds.map((id) => adminDb.collection(COLLECTIONS.CONTACTS).doc(id));
  const snapshots = await adminDb.getAll(...refs);

  for (const snapshot of snapshots) {
    // 🔑 **«Δεν υπάρχει έγγραφο» ΕΙΝΑΙ απάντηση, και γράφεται.** Το `getAll` επιστρέφει
    //    στιγμιότυπο για **κάθε** αναφορά, υπαρκτή ή όχι — άρα εδώ γεμίζει ο χάρτης με
    //    όλες τις ταυτότητες που ζητήθηκαν, και η απουσία από τον χάρτη παύει να είναι
    //    φορέας νοήματος.
    if (!snapshot.exists) {
      names.set(snapshot.id, CLIENT_NAME_IS_MISSING);
      continue;
    }
    const contact = { ...(snapshot.data() as object), id: snapshot.id } as Contact;

    // 🔴 **Ο ΕΛΕΓΧΟΣ ΤΥΠΟΥ ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΟΣ, ΚΑΙ ΤΟ ΕΠΙΑΣΕ ΑΓΚΥΡΑ.** Το
    // {@link getContactDisplayName} δηλώνει `: string` και το τηρεί για **καλά
    // σχηματισμένη** `Contact` — αλλά εδώ το `as Contact` πέφτει πάνω σε **ωμό έγγραφο
    // βάσης**, όπου ο διακριτής `type` μπορεί να λείπει ή να έχει άγνωστη τιμή. Τότε
    // επιστρέφει `undefined` και ένα σκέτο `.trim()` **ρίχνει ολόκληρο τον κατάλογο**
    // για μία χαλασμένη επαφή.
    //
    // ⚠️ Η άμυνα ζει **εδώ και όχι στη συνάρτηση**: εκείνη έχει 92 καταναλωτές και
    // είναι σωστή για τον τύπο που δηλώνει· **εμείς** είμαστε αυτοί που της δίνουμε
    // κάτι που δεν το επαλήθευσε κανείς. Ο ισχυρισμός τύπου είναι δικός μας, άρα και
    // η ευθύνη.
    //
    // ⚠️ **Ο ΕΛΕΓΧΟΣ ΜΕΝΕΙ ΑΚΕΡΑΙΟΣ — αλλάζει ΜΟΝΟ τι επιστρέφεται** (ADR-834 §6.5.δ):
    //    ήταν `continue` (η επαφή γινόταν «δεν βρέθηκε»), τώρα είναι **τρίτη
    //    ονομασμένη κατάσταση**, ακριβώς όπως λύθηκε η γραμμή κατάληψης με το
    //    `occupancyScopeUnknown`. Ο κριτής ζει στο `clientNameFrom`, ώστε το «τι
    //    μετράει ως όνομα» να απαντιέται σε **ένα** σημείο.
    const named = clientNameFrom(getContactDisplayName(contact));
    if (named.kind !== CLIENT_NAME_KNOWN) {
      logger.warn('Επαφή εντολής χωρίς αναγνώσιμο όνομα', {
        data: { clientContactId: snapshot.id },
      });
    }
    names.set(snapshot.id, named);
  }

  return names;
}

/** Ό,τι διάβασε η μία σάρωση: οι εντολές του γραφείου, και αν κόπηκαν. */
interface OfficeMandates {
  readonly properties: readonly OwnerProperty[];
  readonly truncated: boolean;
}

/**
 * **Η μία σάρωση** — και ο μοναδικός τόπος όπου ονομάζεται η εμβέλεια.
 *
 * 🔑 Εξήχθη **κατά ευθύνη** (N.7.1): εδώ ζει το *«ποια έγγραφα με αφορούν;»*. Η κρίση
 * («πού στέκεται;») και η σύνθεση («τι δείχνει η γραμμή;») είναι άλλα δύο ερωτήματα,
 * και ζουν χωριστά.
 */
async function readOfficeMandates(
  adminDb: AdminFirestore,
  companyId: string,
): Promise<OfficeMandates> {
  // tenant-scope-exempt: το ερώτημα ΕΙΝΑΙ περιορισμένο — απλώς όχι στο δηλωμένο πεδίο
  // απομόνωσης. Το `tenant-config.ts` ορίζει το `owner_properties` ως `mode: 'userId'`
  // (`authorUserId`), άρα η CHECK 3.35 ζητά **εκείνο**· εδώ όμως το ερώτημα είναι
  // σκόπιμα **δια-χρηστικό μέσα σε ΜΙΑ εταιρεία**: ο κατάλογος του γραφείου οφείλει να
  // δείχνει και τις εντολές συναδέλφου που έφυγε — αυτός είναι ολόκληρος ο λόγος
  // ύπαρξης του `authorCompanyId` («ο κατάλογος επιβιώνει όταν ο υπάλληλος φύγει»).
  //
  // ⚠️ **ΔΕΝ προστέθηκε δεύτερο πεδίο απομόνωσης**, και δεν επιτρέπεται: το
  // `tenant-config.ts` το απαγορεύει **ονομαστικά** («δύο άξονες = δύο απαντήσεις στο
  // “ποιος το βλέπει;”») και ο κανόνας Firestore του `owner_properties` έχει γραμμένο
  // σχόλιο που απαγορεύει σκέλος πάνω στο `authorCompanyId`.
  //
  // 🔑 Ο φρουρός εδώ είναι **η προέλευση της τιμής**: το `companyId` έρχεται από το
  // `ctx.companyId` του `withAuth`, **ποτέ** από το σώμα του αιτήματος — άρα κανένας
  // δεν μπορεί να ζητήσει τον κατάλογο ξένου γραφείου, γιατί δεν υπάρχει πεδίο να τον
  // ζητήσει. Άγκυρα: `mandate-catalog.test.ts` ομάδα **Τ**.
  const snapshot = await adminDb
    .collection(COLLECTIONS.OWNER_PROPERTIES)
    .where(FIELDS.AUTHOR_COMPANY_ID, '==', companyId)
    .limit(MANDATE_CATALOG_CAP + 1)
    .get();

  const truncated = snapshot.size > MANDATE_CATALOG_CAP;
  if (truncated) {
    logger.warn('Ο κατάλογος εντολών χτύπησε το όριο ανάγνωσης', {
      data: { companyId, cap: MANDATE_CATALOG_CAP },
    });
  }

  const properties = snapshot.docs
    .slice(0, MANDATE_CATALOG_CAP)
    .map((doc) => ({ ...(doc.data() as OwnerProperty), id: doc.id }))
    // ⚠️ Το φίλτρο είναι **απαραίτητο, όχι αμυντικό**: το `authorCompanyId` υπάρχει και
    // σε αγγελίες που δεν είναι εντολές (θα ήταν `null` για ιδιώτη, αλλά ένα μελλοντικό
    // εταιρικό `self` θα περνούσε). Ο κατάλογος μιλά **μόνο** για εντολές.
    .filter((property) => mandatesOf(property).length > 0);

  return { properties, truncated };
}

/** **Μία γραμμή** — η σύνθεση, χωρίς καμία απόφαση δικής της. */
function toCatalogRow(
  property: OwnerProperty,
  clientNames: ReadonlyMap<string, MandateClientName>,
  nowISOValue: string,
): MandateCatalogRow {
  // ⚠️ **Η ΠΡΩΤΗ εντολή του καταλόγου, και ο κατάλογος είναι ΤΟΥ ΓΡΑΦΕΙΟΥ** — το
  //    ερώτημα φιλτράρει ήδη σε `authorCompanyId`, οπότε εδώ φτάνουν αγγελίες που
  //    το γραφείο κατέγραψε. Το `as` έφυγε: ο τύπος είναι πλέον σωστός εξ αρχής.
  const mandate = mandatesOf(property)[0];
  if (mandate === undefined) return null;
  const standing = mandateStandingOf(mandate, nowISOValue);

  return {
    ownerPropertyId: property.id,
    listingTitle: property.title,
    // ⚠️ **Το `??` ΔΕΝ είναι σιωπηλή προεπιλογή**: ο χάρτης γεμίζει από `getAll`, που
    //    επιστρέφει στιγμιότυπο για **κάθε** ταυτότητα που ζητήθηκε — άρα η μόνη
    //    διαδρομή που φτάνει εδώ χωρίς εγγραφή είναι ταυτότητα που **δεν ζητήθηκε
    //    καθόλου**, και για εκείνη «δεν βρέθηκε επαφή» είναι **η ίδια** απάντηση.
    clientName: clientNames.get(mandate.clientContactId) ?? CLIENT_NAME_IS_MISSING,
    clientContactId: mandate.clientContactId,
    standing,
    group: groupOfStanding(standing),
    daysLeft: daysUntilExpiry(mandate, nowISOValue),
    expiresAt: mandate.expiresAt,
    notifiedAt: mandate.notifiedAt,
    // 🔑 **Μέσω του SSoT αναγνώστη, ΠΟΤΕ σκέτο `mandate.notifyOutcome`**: το πεδίο
    //    λείπει από κάθε εντολή γραμμένη πριν από το §6.5.δ, και ένα `undefined` σε
    //    `Record` ευρετηρίαση θα τύπωνε **κενό** — η άγνοια θα ξαναγινόταν αόρατη.
    notifyOutcome: mandate.notifyOutcome,
    viewedAt: mandate.viewedAt,
    decidedAt: mandate.decidedAt,
    proofVia: mandate.proof.via,
    // 🔴 **Ο ΕΝΑΣ ΚΡΙΤΗΣ, ΠΟΤΕ ΔΕΥΤΕΡΟΣ.** Η πρώτη γραφή αυτού του πεδίου ήταν
    // `lifecycle === 'listed' && confirmation === 'confirmed' && !έληξε` — δηλαδή
    // **ξαναγραμμένος στο χέρι** ο κανόνας που ζει ήδη ολόκληρος στο
    // {@link isOwnerPropertyOnTheMarket}. Θα «δούλευε» σήμερα και θα απέκλινε στην
    // πρώτη αλλαγή του κύκλου ζωής, λέγοντας στο γραφείο «είναι στον χάρτη» για
    // αγγελία που δεν είναι (ADR-749, κατά γράμμα).
    onTheMarket: isOwnerPropertyOnTheMarket(property, nowISOValue),
  };
}

/**
 * **Η σειρά επείγοντος** — και μέσα στην ίδια κατάσταση, ό,τι λήγει πρώτο.
 *
 * ⚠️ Οι ληγμένες (`daysLeft === null`) πάνε **τέλος** μέσα στην ομάδα τους: δεν έχουν
 * αντίστροφη μέτρηση να συγκριθεί, και μια σύγκριση `null` θα έδινε **αυθαίρετη** σειρά.
 */
function byUrgencyThenExpiry(left: MandateCatalogRow, right: MandateCatalogRow): number {
  const byUrgency =
    (URGENCY_RANK.get(left.standing) ?? 0) - (URGENCY_RANK.get(right.standing) ?? 0);
  if (byUrgency !== 0) return byUrgency;
  if (left.daysLeft === null) return right.daysLeft === null ? 0 : 1;
  if (right.daysLeft === null) return -1;
  return left.daysLeft - right.daysLeft;
}

/**
 * **Ο κατάλογος εντολών του γραφείου**, ταξινομημένος κατά επείγον.
 *
 * @param companyId — **από το `ctx.companyId`**, ποτέ από το σώμα του αιτήματος
 * @param nowISOValue — **ένα** ρολόι για όλες τις γραμμές (δες `mandateStandingOf`)
 */
export async function readMandateCatalog(
  adminDb: AdminFirestore,
  companyId: string,
  nowISOValue: string,
): Promise<MandateCatalog> {
  const { properties, truncated } = await readOfficeMandates(adminDb, companyId);

  const clientNames = await readClientNames(adminDb, [
    ...new Set(
      properties.flatMap((p) => p.mandates.map((m) => m.clientContactId)),
    ),
  ]);

  const tally = emptyTally();
  const rows = properties.map((property) => {
    const row = toCatalogRow(property, clientNames, nowISOValue);
    tally[row.standing] += 1;
    return row;
  });

  rows.sort(byUrgencyThenExpiry);

  return { rows, tally, truncated };
}
