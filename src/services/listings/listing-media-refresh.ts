/**
 * @fileoverview **«ΑΛΛΑΞΕ ΥΛΙΚΟ ΤΗΣ ΑΓΓΕΛΙΑΣ ⇒ ΞΑΝΑΠΡΟΒΑΛΕ»** — η κλήση που έλειπε από τη ΔΕΥΤΕΡΗ πηγή.
 * @related ADR-845 §7.16 (Ο-35) · ADR-777 Α3/Α5 · services/listings/publish-public-listing
 * @module services/listings/listing-media-refresh
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΠΡΟΒΟΛΗ ΕΧΕΙ **ΔΥΟ** ΠΗΓΕΣ, ΚΑΙ ΤΗΝ ΠΥΡΟΔΟΤΟΥΣΕ ΜΟΝΟ Η ΜΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `public_listings/{id}` παράγεται από το **έγγραφο του ακινήτου** *και* από τα **αρχεία του**
 * *(`readPublishedAgencyMedia`)*. Κάθε γραφή στο πρώτο ξαναπροβάλλει *(PATCH, κύκλος ζωής, έργο)*·
 * **καμία** γραφή στο δεύτερο δεν το έκανε.
 *
 * Μετρημένο ζωντανά 2026-10-08: `POST …/model` → **200**, αρχείο `ready` · `public` · `active`, και
 * η αγγελία έμεινε με `models: []` και `projectedAt` **μιας εβδομάδας πριν**. Το §7.10 του ADR-845
 * είχε «επαληθεύσει» την αλυσίδα επειδή ο κρίκος 3 ήταν ένα **χειροκίνητο** PATCH του ακινήτου —
 * δηλαδή η δημοσίευση δούλευε όσο κάποιος τύχαινε να αγγίξει το ακίνητο αμέσως μετά.
 *
 * 🔑 **Δεν είναι νέος γραφέας.** Διαβάζει το έγγραφο του ακινήτου και καλεί τον **ΕΝΑ**
 * {@link republishListing}. Ό,τι αποφασίζει εκείνος *(δημοσιεύεται; αποσύρεται; τι ψήνεται;)*
 * μένει εκεί — εδώ ζει μόνο το *«ποιο ακίνητο, και είναι όντως δικό του;»*.
 *
 * ⚠️ **Το έγγραφο διαβάζεται ΤΩΡΑ, από τη βάση** — ποτέ από τον καλούντα: η πόρτα ενός αρχείου
 * δεν κρατά το ακίνητο στα χέρια της, και ένα στιγμιότυπο που θα ταξίδευε ως όρισμα θα μπορούσε
 * να ξαναγράψει την αγγελία με **παλιά** τιμή, σκεπάζοντας ένα PATCH που έτρεξε ανάμεσα.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';

import { AGENCY_ENTITY_TYPE } from './agency-media-publication';
import {
  hasFloorPlateDeclaration,
  readFloorsShowingUnit,
  type FloorPlateUnitRef,
} from './floor-plate.reader';
import {
  createListingPass,
  republishListingsInScope,
  type ListingPass,
} from './listing-scope-republish';
import {
  republishListing,
  reportProjectionFailure,
  type ListingSourceProperty,
  type PublishOutcome,
} from './publish-public-listing';

const logger = createModuleLogger('listing-media-refresh');

/**
 * Τι έγινε — η έκβαση του γραφέα, ή **`absent`** όταν δεν υπήρχε ακίνητο να προβληθεί.
 *
 * 🔑 Το `absent` είναι **δηλωμένη** απάντηση και όχι `failed`: ακίνητο που δεν υπάρχει ή ανήκει
 * σε άλλον μισθωτή δεν είναι «εκκρεμής προβολή» που θα διορθώσει η επανασύνθεση.
 */
export type ListingMediaRefreshOutcome = PublishOutcome | 'absent';

/**
 * **Ξαναπρόβαλε την αγγελία ενός ακινήτου, επειδή άλλαξε αρχείο του.**
 *
 * ⚠️ **Awaited από τον καλούντα, ΟΧΙ fire-and-forget** — ίδια διάκριση με το
 * `republishPublicProjection` (N.7.2 #6): αυτό είναι **τι βλέπει ο κόσμος**. Όποιος πάτησε
 * «Δημοσίευση» και είδε επιτυχία δικαιούται η αγγελία να έχει ήδη αλλάξει.
 *
 * 🔑 **Δεν πετά ποτέ**: η αλλαγή του αρχείου **έγινε** ήδη. Η αποτυχία ονομάζεται
 * *(`failed`)* και την κλείνει η επανασύνθεση.
 *
 * 🔐 **Η κηδεμονία ξαναρωτιέται ΕΔΩ**, όχι μόνο στην πόρτα: το `companyId` είναι ο μισθωτής του
 * **αρχείου** που άλλαξε, και ακίνητο άλλου μισθωτή **δεν** ξαναπροβάλλεται εξαιτίας του.
 */
export async function refreshListingAfterMediaChange(
  adminDb: AdminFirestore,
  propertyId: string,
  companyId: string,
): Promise<ListingMediaRefreshOutcome> {
  try {
    const snapshot = await adminDb.collection(COLLECTIONS.PROPERTIES).doc(propertyId).get();
    const data = snapshot.data() as ListingSourceProperty | undefined;

    if (data === undefined || data.companyId !== companyId) {
      logger.warn('Υλικό άλλαξε, αλλά δεν υπάρχει ακίνητο αυτού του μισθωτή να προβληθεί', { propertyId });
      return 'absent';
    }

    // Το `id` δεν ζει μέσα στο έγγραφο — η προβολή το θέλει ως ταυτότητα της αγγελίας.
    return await republishListing(adminDb, propertyId, { ...data, id: propertyId });
  } catch (error) {
    return reportProjectionFailure(propertyId, error);
  }
}

/**
 * Ό,τι χρειάζεται από ένα αρχείο που **άλλαξε** για να βρεθεί η αγγελία του — τα πεδία κατόχου,
 * **όπως βγήκαν από τη βάση** *(γι' αυτό `unknown`: η πόρτα δεν τα έχει στενέψει, και δεν οφείλει)*.
 */
export interface ChangedListingFile {
  readonly entityType?: unknown;
  readonly entityId?: unknown;
  readonly companyId?: unknown;
}

/** Τι έγινε στην αγγελία **ενός** ακινήτου, μετά από αλλαγή αρχείων του. */
export interface ListingRefreshReport {
  readonly propertyId: string;
  readonly outcome: ListingMediaRefreshOutcome;
}

/**
 * **Ποιους κατόχους ενός είδους αγγίζει αυτή η δέσμη αρχείων** — ένας ανά κάτοχο, με τον μισθωτή του αρχείου.
 * Δύο είδη έχουν αγγελίες πίσω τους: το **ακίνητο** *(τα αρχεία του)* και ο **όροφος** *(η κάτοψή του, ADR-907 §11.8)*.
 *
 * ⚠️ **Καμία στένωση σε «δημοσιεύσιμο κάδο» εδώ, επίτηδες.** Το *«τι φεύγει;»* το απαντά **μόνο**
 * το `agencyMediaMaterial`· ένα δεύτερο φίλτρο κάδων σε αυτό το σημείο θα ήταν ακριβώς ο φρουρός
 * που **έκοβε πρώτος** στο Ο-21 *(Α17.7.1)*. Το κόστος είναι φραγμένο: **μία** επαναπροβολή ανά
 * ακίνητο, και μόνο όταν **άλλαξε** αρχείο του.
 */
function ownersOf(files: readonly ChangedListingFile[], entityType: string): ReadonlyMap<string, string> {
  const owners = new Map<string, string>();

  for (const file of files) {
    if (file.entityType !== entityType) continue;
    if (typeof file.entityId !== 'string' || file.entityId.trim() === '') continue;
    if (typeof file.companyId !== 'string' || file.companyId.trim() === '') continue;
    if (!owners.has(file.entityId)) owners.set(file.entityId, file.companyId);
  }

  return owners;
}

/**
 * 🏆 **Η ΜΙΑ ΚΛΗΣΗ ΚΑΘΕ ΠΟΡΤΑΣ ΑΡΧΕΙΟΥ** *(ADR-845 §7.17 — κλείσιμο της κλάσης Ο-35)*.
 *
 * Η πόρτα δίνει τα αρχεία που **μόλις άλλαξε** *(ταξινόμηση · κάδος · αρχειοθέτηση · πράξη CDE ·
 * διαγραφή)* και παίρνει την έκβαση **ανά ακίνητο**. Αρχεία που δεν ανήκουν σε ακίνητο ή όροφο
 * *(επαφή, έργο, προσφορά)* **δεν** είναι υλικό αγγελίας και παραλείπονται σιωπηλά — κενή απάντηση
 * σημαίνει *«καμία αγγελία δεν αφορούσε»*, όχι αποτυχία.
 *
 * 🏢 **Αρχείο ΟΡΟΦΟΥ είναι υλικό ΚΑΘΕ αγγελίας του** *(ADR-907 §11.8)*: ως το §11.7 παραλειπόταν εδώ σιωπηλά, και
 * μια εικόνα ορόφου που γύριζε `internal` ή έπεφτε στον κάδο έμενε δημόσια ως τη βραδινή συμφιλίωση. Περνά από τον
 * **ίδιο** δρόμο με την αλλαγή μονάδας ({@link refreshDeclaredFloors}): όροφος χωρίς δήλωση κοστίζει μία ανάγνωση.
 *
 * 🔑 **Μία επαναπροβολή ανά ακίνητο, όχι ανά αρχείο**: η μαζική σήμανση 30 φωτογραφιών του ίδιου
 * ακινήτου θα έψηνε την ίδια αγγελία 30 φορές — και η τελευταία θα ήταν η μόνη που μετράει.
 *
 * ⚠️ **Σειριακά, και δεν πετά ποτέ** — ίδιο συμβόλαιο με την {@link refreshListingAfterMediaChange}.
 * Awaited από τον καλούντα: είναι **τι βλέπει ο κόσμος**.
 */
export async function refreshListingsAfterFileChanges(
  adminDb: AdminFirestore,
  files: readonly ChangedListingFile[],
): Promise<readonly ListingRefreshReport[]> {
  const reports: ListingRefreshReport[] = [];

  for (const [propertyId, companyId] of ownersOf(files, AGENCY_ENTITY_TYPE)) {
    reports.push({
      propertyId,
      outcome: await refreshListingAfterMediaChange(adminDb, propertyId, companyId),
    });
  }

  const floors = [...ownersOf(files, ENTITY_TYPES.FLOOR)].map(([floorId, companyId]) => ({ floorId, companyId }));
  reports.push(...(await refreshDeclaredFloors(adminDb, floors)));

  return reports;
}

/**
 * 🏢 **«ΑΛΛΑΞΕ Η ΔΗΛΩΣΗ ΤΟΥ ΟΡΟΦΟΥ ⇒ ΞΑΝΑΠΡΟΒΑΛΕ ΤΙΣ ΑΓΓΕΛΙΕΣ ΤΟΥ»** *(ADR-907 §11.7)*.
 *
 * Η κάτοψη ορόφου είναι υλικό **κάθε** αγγελίας του ορόφου, και η πόρτα της γράφει στον **όροφο** — κανένα ακίνητο δεν
 * αγγίζεται, άρα καμία υπάρχουσα πόρτα δεν θα ξαναπρόβαλλε. Εδώ: όσα ακίνητα του ορόφου **δημοσιεύονται**, με τον ΕΝΑ
 * {@link republishListing}.
 *
 * 🔑 **Δεν έχει δικό της βρόχο** *(ADR-907 §11.8)*: είναι η εμβέλεια `floor` του ΕΝΟΣ βρόχου
 * ({@link republishListingsInScope}). Εκείνος κρατά **έναν** επιλυτή για όλο το πέρασμα *(τα τεκμήρια του ορόφου
 * διαβάζονται μία φορά, όχι ανά αδελφή)*, παραλείπει ό,τι **δεν** δημοσιεύεται και ξαναψήνει **μόνο** όσες αγγελίες
 * διαφωνούν με το τρέχον υλικό τους.
 *
 * ⚠️ Η απάντηση απαριθμεί όσες **ξαναπροβλήθηκαν** — αγγελία που ήδη συμφωνούσε λείπει, και αυτό είναι το σωστό.
 * ⚠️ **Δεν πετά ποτέ** — ίδιο συμβόλαιο με την {@link refreshListingsAfterFileChanges}.
 */
export async function refreshListingsOfFloor(
  adminDb: AdminFirestore,
  floorId: string,
  companyId: string,
  pass?: ListingPass,
): Promise<readonly ListingRefreshReport[]> {
  try {
    return await republishListingsInScope(adminDb, { kind: 'floor', floorId, companyId }, pass);
  } catch (error) {
    logger.error('Οι αγγελίες του ορόφου δεν ξαναπροβλήθηκαν — τις κλείνει η βραδινή συμφιλίωση', {
      floorId, error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

// ---------------------------------------------------------------------------
// 🏢 Η ΦΡΕΣΚΑΔΑ ΤΩΝ ΑΔΕΛΦΩΝ ΑΓΓΕΛΙΩΝ (ADR-907 §11.8) — Ο ΕΝΑΣ ΤΟΠΟΣ
// ---------------------------------------------------------------------------
//
// Η κάτοψη ορόφου μιας αγγελίας δείχνει **και τις άλλες μονάδες**: την κατάστασή τους και, αν δημοσιεύονται, τον
// σύνδεσμο προς τη δική τους αγγελία. Άρα το δημόσιο έγγραφο ενός ακινήτου αλλάζει όταν αλλάζει **άλλο** έγγραφο —
// γείτονας που πουλήθηκε, θέση στάθμευσης που κρατήθηκε, εικόνα ορόφου που αποσύρθηκε. Καμία πόρτα εκείνων δεν
// κρατά τις αδελφές στα χέρια της· τις βρίσκει **αυτός** ο τόπος, και καμία πόρτα δεν γράφει δικό της κριτήριο.
//
// ⛔ **Οι τρεις συναρτήσεις εδώ ΔΕΝ είναι βοηθοί επαναπροβολής της πύλης 3.76** (`REFRESH_HELPERS`) και δεν
//    επιτρέπεται να γίνουν: εκεί «πέρασα από βοηθό» σημαίνει *«ξαναπρόβαλα το ακίνητο του αρχείου που άλλαξα»*. Πόρτα
//    αρχείου που θα καλούσε μόνο τη φρεσκάδα των γειτόνων θα μετρούσε ως καλυμμένη χωρίς να είναι.

/** Ένας όροφος με τον χώρο του — η ταυτότητα μιας κάτοψης ορόφου. */
interface FloorRef {
  readonly floorId: string;
  readonly companyId: string;
}

/**
 * Μια μονάδα που **άλλαξε**: ποιο περίγραμμα τη δείχνει, και σε ποιον χώρο.
 *
 * ⚠️ Το `companyId` είναι `unknown` επίτηδες: στις πόρτες ακινήτου έρχεται από έγγραφο του δίσκου. Ό,τι δεν είναι
 * μη κενή συμβολοσειρά δεν ξυπνά κανέναν όροφο.
 */
interface ChangedUnit extends FloorPlateUnitRef {
  readonly companyId: unknown;
}

/**
 * **Όσοι από αυτούς τους ορόφους έχουν ΔΗΛΩΣΗ ⇒ οι αγγελίες τους συμφωνούν ξανά με το υλικό τους.**
 *
 * 🔑 **Δύο φρένα κόστους, κανένα δεύτερο κριτήριο**: όροφος χωρίς δήλωση σταματά σε **μία** ανάγνωση· σε όροφο με
 * δήλωση ξαναψήνεται **μόνο** ό,τι διαφωνεί *(το αποτύπωμα μέσων περιέχει ήδη τις καταστάσεις των γειτόνων — §11.5)*.
 * ⚠️ **Δεν πετά ποτέ**: η αλλαγή που το προκάλεσε **έγινε** ήδη· το δίχτυ είναι η βραδινή συμφιλίωση.
 */
async function refreshDeclaredFloors(
  adminDb: AdminFirestore,
  floors: readonly FloorRef[],
  pass?: ListingPass,
): Promise<readonly ListingRefreshReport[]> {
  const reports: ListingRefreshReport[] = [];

  for (const { floorId, companyId } of floors) {
    try {
      if (!(await hasFloorPlateDeclaration(adminDb, companyId, floorId))) continue;
      reports.push(...(await refreshListingsOfFloor(adminDb, floorId, companyId, pass)));
    } catch (error) {
      logger.error('Η δήλωση του ορόφου δεν διαβάστηκε — τις αγγελίες του τις κλείνει η βραδινή συμφιλίωση', {
        floorId, error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return reports;
}

/**
 * Με ποιο κλειδί δένει το περίγραμμα έναν **χώρο** — οι δύο πόρτες χώρων (PATCH · συναλλαγή) μιλούν σε είδη
 * (`parking` · `storage`), τα περιγράμματα σε κλειδιά. Εξαντλητικό: τρίτο είδος χώρου **δεν μεταγλωττίζεται** χωρίς γραμμή.
 */
export const SPACE_OVERLAY_LINK = {
  parking: 'parkingId',
  storage: 'storageId',
} as const satisfies Record<'parking' | 'storage', FloorPlateUnitRef['link']>;

/** Οι όροφοι όπου **φαίνονται** αυτές οι μονάδες — ένας ανά όροφο, όσες μονάδες του κι αν άλλαξαν μαζί. */
async function floorsShowing(adminDb: AdminFirestore, units: readonly ChangedUnit[]): Promise<readonly FloorRef[]> {
  const floors = new Map<string, FloorRef>();

  for (const unit of units) {
    const { companyId } = unit;
    if (typeof companyId !== 'string' || companyId.trim() === '') continue;
    for (const floorId of await readFloorsShowingUnit(adminDb, companyId, unit)) {
      floors.set(`${companyId}/${floorId}`, { floorId, companyId });
    }
  }

  return [...floors.values()];
}

/**
 * 🏆 **«ΑΛΛΑΞΕ ΜΟΝΑΔΑ ⇒ ΟΙ ΑΓΓΕΛΙΕΣ ΤΩΝ ΟΡΟΦΩΝ ΟΠΟΥ ΦΑΙΝΕΤΑΙ ΣΥΜΦΩΝΟΥΝ ΞΑΝΑ»** — η μία κλήση κάθε πόρτας που γράφει
 * **κατάσταση** μονάδας χωρίς δική της αγγελία *(θέση στάθμευσης, αποθήκη)*. Το ακίνητο περνά από την
 * {@link republishListingOfChangedUnit}, που καλεί **αυτήν**.
 *
 * 🔑 Οι όροφοι βρίσκονται από τα **περιγράμματα**, όχι από το `floorId` της μονάδας — δες `readFloorsShowingUnit`.
 * ⚠️ **Awaited από τον καλούντα και δεν πετά ποτέ** — ίδιο συμβόλαιο με κάθε άλλη επαναπροβολή αυτού του αρχείου.
 */
export async function refreshFloorPlateNeighbours(
  adminDb: AdminFirestore,
  units: readonly ChangedUnit[],
  pass?: ListingPass,
): Promise<readonly ListingRefreshReport[]> {
  try {
    return await refreshDeclaredFloors(adminDb, await floorsShowing(adminDb, units), pass);
  } catch (error) {
    logger.error('Οι όροφοι της μονάδας δεν βρέθηκαν — τις αδελφές αγγελίες τις κλείνει η βραδινή συμφιλίωση', {
      units: units.map((unit) => unit.unitId), error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * 🏆 **«ΑΛΛΑΞΕ ΤΟ ΑΚΙΝΗΤΟ ⇒ Η ΑΓΓΕΛΙΑ ΤΟΥ, ΚΑΙ ΜΕΤΑ ΟΙ ΑΔΕΛΦΕΣ»** — η ΜΙΑ κλήση κάθε πόρτας της **πρώτης** πηγής
 * *(PATCH · κύκλος ζωής · δημιουργία)*. Καμία από αυτές δεν καλεί πια τον γραφέα απευθείας *(άγκυρα ΦΑ-5)*.
 *
 * 🔑 **Η δική του αγγελία ΠΡΩΤΗ, και χωρίς όρους**: άλλαξε τιμή, περιγραφή, δήλωση — πράγματα που δεν ζουν σε κανένα
 * αποτύπωμα. Οι αδελφές μετά, και μόνο όσες διαφωνούν. Η δική του ξαναπερνά από τον κριτή του ορόφου και βρίσκεται
 * σε συμφωνία — δεν ψήνεται δεύτερη φορά.
 * 🔑 **Ένα πέρασμα**: ο ίδιος επιλυτής για τη δική του αγγελία και για τις αδελφές ⇒ τα τεκμήρια του ορόφου
 * διαβάζονται **μία** φορά στην αίτηση.
 * ⛔ **Χωρίς αναδρομή**: οι αδελφές ξαναπροβάλλονται από τον βρόχο με εμβέλεια, που καλεί τον **γραφέα** — ποτέ αυτήν.
 */
export async function republishListingOfChangedUnit(
  adminDb: AdminFirestore,
  propertyId: string,
  property: ListingSourceProperty,
): Promise<PublishOutcome> {
  const pass = createListingPass(adminDb);
  const outcome = await republishListing(adminDb, propertyId, property, pass.resolveAgency, pass.resolveMedia);

  const self: ChangedUnit = { link: 'propertyId', unitId: propertyId, companyId: property.companyId };
  await refreshFloorPlateNeighbours(adminDb, [self], pass);

  return outcome;
}
