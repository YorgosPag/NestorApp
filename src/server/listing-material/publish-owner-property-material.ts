import 'server-only';

/**
 * @fileoverview 🏆 **ΤΟ ΥΠΟΚΕΙΜΕΝΟ ΤΟΥ ΙΔΙΟΚΤΗΤΗ ΣΤΗ ΔΗΜΟΣΙΕΥΣΗ ΥΛΙΚΟΥ** — ο φάκελος του ακινήτου (ADR-920 Β4.3 · ADR-866).
 * @related ./publish-listing-material (ο ΕΝΑΣ κινητήρας) · app/api/properties/[id]/_shared/publish-property-material
 *   (το αδελφό εταιρικό υποκείμενο) · app/api/owner-properties/[ownerPropertyId]/terrain/route (η πόρτα)
 * @module server/listing-material/publish-owner-property-material
 *
 * ```
 * κηδεμονία (mayAdminister ⇒ αλλιώς 404) → προσωπική + φάκελος του ΙΔΙΟΥ ανθρώπου (αλλιώς ονομασμένη άρνηση)
 *   → [κινητήρας: ανάγνωση → εγγραφή στο files_personal → διαδοχή → δήλωση] → ΕΠΑΝΑΠΡΟΒΟΛΗ της αγγελίας ιδιοκτήτη
 * ```
 *
 * 🔑 **ΤΟ ΥΛΙΚΟ ΖΕΙ ΣΤΟΝ ΦΑΚΕΛΟ** (`property_dossier`, `files_personal`): εκεί ζουν ήδη οι φωτογραφίες και το ΠΕΑ
 * της αγγελίας, και από εκεί τα διαβάζει ο αναγνώστης της δημοσίευσης (`readDossierMedia`). Ένα δεύτερο δοχείο
 * για το έδαφος θα σήμαινε δεύτερο αναγνώστη — και δεύτερη απάντηση στο *«τι έχει αυτή η αγγελία;»*.
 *
 * 🔒 **Η ΕΞΟΥΣΙΑ ΕΙΝΑΙ Η ΙΔΙΟΚΤΗΣΙΑ** (Google Drive): κανένας ρόλος, κανένα `permissions` — ο δράστης είναι ο
 * `personalContainerActorOf`, και ο φάκελος πρέπει να ανήκει στον **ίδιο** άνθρωπο με την αγγελία. Ένας
 * φάκελος άλλου που θα έφτανε εδώ από `dossierId` δεν δέχεται υλικό — ούτε γράφει, ούτε διαδέχεται.
 *
 * ⚠️ **Τα σχέδια της σκηνής είναι πάντα κενά** (`readSourceRevisions → []`): ο ιδιοκτήτης δεν έχει εταιρικά σχέδια
 * DXF. Η προέλευση ενός υλικού του είναι το αρχείο που ανέβασε, όχι κάποια αναθεώρηση σχεδίου.
 */

import type { NextRequest } from 'next/server';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { ApiError } from '@/lib/api/ApiErrorHandler';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { listingActorOf, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import type { ModelSourceRevision } from '@/lib/listings/model-source-revisions';
import { custodyOf, mayAdminister } from '@/lib/owner-property/listing-custody';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import { propertyDossierFromDocument } from '@/lib/property-dossier/property-dossier-from-document';
import { personalContainerActorOf } from '@/services/iso19650/container-transitions';
import { refreshOwnerListingAfterMediaChange } from '@/services/listings/listing-media-refresh';
import type { OwnerProperty } from '@/types/owner-property';
import type { PropertyDossier } from '@/types/property-dossier';

import { findSupersededDossierMaterial } from './material-source-lookup';
import {
  publishListingMaterial,
  type ListingMaterialDoor,
  type ListingMaterialPublication,
  type ListingMaterialSubject,
} from './publish-listing-material';

/** Ό,τι ξέρει ο κινητήρας όταν ρωτά την πόρτα — αγγελία **και** φάκελος, ήδη κριμένα ως του ίδιου ανθρώπου. */
export interface OwnerMaterialDoorEnv {
  readonly adminDb: AdminFirestore;
  readonly ownerPropertyId: string;
  /** Ο κάτοχος της αγγελίας **και** του φακέλου — ο ίδιος άνθρωπος, ελεγμένο. */
  readonly userId: string;
  readonly property: OwnerProperty;
  readonly dossier: PropertyDossier;
}

/** Ό,τι δίνει το υποκείμενο στον κατασκευαστή της εγγραφής — και ούτε πεδίο παραπάνω. */
export interface OwnerMaterialBirth {
  readonly userId: string;
  readonly dossierId: string;
  readonly createdBy: string;
  readonly sourceRevisions: readonly ModelSourceRevision[];
}

/** **Η πόρτα του ιδιοκτήτη** = η πόρτα του κινητήρα + ο κωδικός της αγγελίας που δεν έχει φάκελο. */
export interface OwnerMaterialPublicationDoor<TParsed, TDeclared = undefined>
  extends ListingMaterialDoor<TParsed, TDeclared, OwnerMaterialDoorEnv, OwnerMaterialBirth> {
  readonly codes: { readonly noDossier: string; readonly uploadFailed: string };
}

/** Ξένη ή ανύπαρκτη αγγελία ⇒ 404, ποτέ «υπάρχει» — ίδιος φράχτης με κάθε άλλη πόρτα της αγγελίας ιδιοκτήτη. */
const NOT_FOUND = 'NOT_FOUND';

/**
 * **Κηδεμονία και φάκελος — πριν διαβαστεί το σώμα.**
 *
 * 🔑 Αγγελία σε χώρο γραφείου, χωρίς φάκελο, ή με φάκελο **άλλου** ανθρώπου ⇒ η **ίδια** ονομασμένη άρνηση: σε
 * καμία από τις τρεις δεν υπάρχει δοχείο του ιδιοκτήτη όπου το υλικό θα μπορούσε να ζήσει.
 */
async function enterOwnerDoor(
  ownerPropertyId: string,
  actor: ApiActor,
  door: Pick<OwnerMaterialPublicationDoor<unknown>, 'codes'>,
): Promise<OwnerMaterialDoorEnv> {
  if (ownerPropertyId === '') throw new ApiError(404, NOT_FOUND);
  const adminDb = getAdminFirestore();
  const snap = await adminDb.collection(COLLECTIONS.OWNER_PROPERTIES).doc(ownerPropertyId).get();
  const property = ownerPropertyFromDocument(snap.data(), ownerPropertyId);
  if (property === null || !mayAdminister(custodyOf(property), listingActorOf(actor))) {
    throw new ApiError(404, NOT_FOUND);
  }

  const custody = custodyOf(property);
  const dossierId = property.dossierId ?? null;
  if (custody.kind !== 'personal' || dossierId === null) throw new ApiError(409, door.codes.noDossier);

  const dossierSnap = await adminDb.collection(COLLECTIONS.PROPERTY_DOSSIERS).doc(dossierId).get();
  const dossier = propertyDossierFromDocument(dossierSnap.data(), dossierId);
  if (dossier === null || dossier.userId !== custody.userId) throw new ApiError(409, door.codes.noDossier);

  return { adminDb, ownerPropertyId, userId: custody.userId, property, dossier };
}

/** **Ο φάκελος ως υποκείμενο** — γέννηση με `userId`, προκάτοχοι στο `files_personal`, επαναπροβολή του ιδιοκτήτη. */
function ownerPropertySubject(env: OwnerMaterialDoorEnv): ListingMaterialSubject<OwnerMaterialDoorEnv, OwnerMaterialBirth> {
  const { adminDb, ownerPropertyId, userId, dossier } = env;
  // Ο δημιουργός είναι ο ΔΡΑΣΤΗΣ (όπως `ctx.uid` στον κινητήρα της εταιρείας), όχι δεύτερη συναρμολόγηση.
  const actor = personalContainerActorOf(userId);
  return {
    adminDb,
    listingId: ownerPropertyId,
    actor,
    env,
    birthOf: (sourceRevisions) => ({ userId, dossierId: dossier.id, createdBy: actor.uid, sourceRevisions }),
    readSourceRevisions: async () => [],
    findPredecessors: (category, newcomer) =>
      findSupersededDossierMaterial(adminDb, userId, dossier.id, category, newcomer),
    refresh: () => refreshOwnerListingAfterMediaChange(adminDb, ownerPropertyId, userId),
  };
}

/**
 * 🏆 **Η ΔΗΜΟΣΙΕΥΣΗ ΣΕ ΑΓΓΕΛΙΑ ΙΔΙΟΚΤΗΤΗ** — κηδεμονία, φάκελος, και ο **ΕΝΑΣ** κινητήρας.
 *
 * 🔑 Η πόρτα κρίνεται **πριν** διαβαστεί το σώμα (`request.formData()`): ξένη αγγελία δεν πληρώνει ποτέ την
 * ανάγνωση megabytes. Η επαναπροβολή είναι **μέσα** — δηλωμένος βοηθός στο CHECK 3.76 (`REFRESH_HELPERS`).
 */
export async function publishOwnerPropertyMaterial<TParsed, TDeclared = undefined>(
  request: NextRequest,
  actor: ApiActor,
  ownerPropertyId: string,
  door: OwnerMaterialPublicationDoor<TParsed, TDeclared>,
): Promise<ListingMaterialPublication<TParsed, TDeclared>> {
  const env = await enterOwnerDoor(ownerPropertyId, actor, door);
  return publishListingMaterial(await request.formData(), ownerPropertySubject(env), door);
}
