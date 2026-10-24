import 'server-only';

/**
 * @fileoverview 🏆 **ΤΟ ΕΤΑΙΡΙΚΟ ΥΠΟΚΕΙΜΕΝΟ ΤΗΣ ΔΗΜΟΣΙΕΥΣΗΣ ΥΛΙΚΟΥ** (ADR-909 Β1 · ADR-845 §7.17 · ADR-920 Β4.3).
 * @related ../model/route · ../floorplan/route · ../terrain/route (οι πόρτες) ·
 *   server/listing-material/publish-listing-material (ο ΕΝΑΣ κινητήρας)
 * @module app/api/properties/[id]/_shared/publish-property-material
 *
 * ```
 * κηδεμονία (ο φρουρός ΤΗΣ ΠΟΡΤΑΣ) → δικαίωμα δημοσίευσης → [κινητήρας: ανάγνωση → … → διαδοχή → δήλωση] → ΕΠΑΝΑΠΡΟΒΟΛΗ
 * ```
 *
 * 🔑 **Η ΣΕΙΡΑ ΖΕΙ ΣΤΟΝ ΚΙΝΗΤΗΡΑ, ΟΧΙ ΕΔΩ** *(ADR-920 Β4.3)*: όταν η αγγελία του ιδιοκτήτη χρειάστηκε την ίδια
 * δημοσίευση πάνω στα αρχεία του **φακέλου** της, ο κορμός έγινε κινητήρας με **θύρα υποκειμένου**. Εδώ μένει
 * ό,τι είναι **του γραφείου**: ο φρουρός κηδεμονίας του μισθωτή, το δικαίωμα `mayChangePublication`, η γέννηση
 * με `companyId`, τα σχέδια της εταιρείας και η επαναπροβολή της εταιρικής αγγελίας. Η υπογραφή
 * `publishPropertyMaterial(request, ctx, door)` **δεν άλλαξε** ⇒ καμία πόρτα δεν άγγιξε τη ροή της.
 *
 * 🔑 **Η επαναπροβολή είναι ΜΕΣΑ**, όπως στο `runFileBatch`: πόρτα που περνά από εδώ **δεν μπορεί** να
 * την ξεχάσει. Γι' αυτό είναι δηλωμένος βοηθός επαναπροβολής στο CHECK 3.76 (`REFRESH_HELPERS`) — και μια
 * πόρτα **δεν** την καλεί δεύτερη φορά.
 *
 * 🔒 **Η ΚΛΗΣΗ ΤΟΥ ΦΡΟΥΡΟΥ ΚΗΔΕΜΟΝΙΑΣ ΓΡΑΦΕΤΑΙ ΣΤΗΝ ΠΟΡΤΑ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ** *(CHECK 3.100, ADR-281)*: η πύλη
 * διαβάζει το κυριολεκτικό `intent: 'write'` **στο `route.ts`**, όχι σε βοηθό. Γι' αυτό κάθε πόρτα δίνει τον
 * φρουρό της ως **υποχρεωτικό** σκέλος (`judgeProperty`)· ο κορμός αποφασίζει **πότε** τρέχει — πρώτος.
 *
 * ⛔ **Ο κορμός δεν ξέρει τι υλικό δημοσιεύει.** Το *«τι έγγραφο γεννιέται;»* το απαντά ο
 * κατασκευαστής **κάθε** πόρτας (`recordOf`) — ποτέ σημαία εδώ.
 */

import type { NextRequest } from 'next/server';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import type { AuthContext } from '@/lib/auth';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { propertyIdOfRequest } from '@/app/api/properties/_shared/property-id-of-request';
import type { TenantProperty } from '@/lib/auth/tenant-isolation';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import type { ModelSourceRevision } from '@/lib/listings/model-source-revisions';
import { mayChangePublication } from '@/services/file-record/file-classification.service';
import { containerActorOf } from '@/services/iso19650/container-transitions';
import { refreshListingAfterMediaChange } from '@/services/listings/listing-media-refresh';
import {
  publishListingMaterial,
  type ListingMaterialDoor,
  type ListingMaterialPublication,
  type ListingMaterialSubject,
} from '@/server/listing-material/publish-listing-material';
import { findSupersededMaterial, readSourceRevisions } from '@/server/listing-material/material-source-lookup';

/** Ό,τι χρειάζεται ο φρουρός κηδεμονίας — η πόρτα προσθέτει **μόνο** την πρόθεση. */
interface PropertyCustodyQuery {
  readonly ctx: AuthContext;
  readonly propertyId: string;
  readonly path: string;
}

/** Ό,τι ξέρει ο κορμός όταν ρωτά την πόρτα — το ακίνητο είναι **ήδη** κριμένο ως του μισθωτή. */
export interface MaterialDoorEnv {
  readonly adminDb: AdminFirestore;
  readonly ctx: AuthContext;
  readonly propertyId: string;
  /** Το ωμό έγγραφο του ακινήτου, όπως το διάβασε ο φρουρός κηδεμονίας — **μία** ανάγνωση για όλη την αίτηση. */
  readonly property: Readonly<Record<string, unknown>>;
}

/** Ό,τι δίνει ο κορμός στον κατασκευαστή της εγγραφής — και ούτε πεδίο παραπάνω. */
export interface MaterialBirth {
  readonly companyId: string;
  readonly propertyId: string;
  readonly createdBy: string;
  /** Διαβασμένα από τον **διακομιστή**, ποτέ από τον πελάτη (ADR-845 Ο-25). */
  readonly sourceRevisions: readonly ModelSourceRevision[];
}

/**
 * **Η εταιρική πόρτα** = η πόρτα του κινητήρα + ο φρουρός κηδεμονίας του μισθωτή + ο κωδικός άρνησης δικαιώματος.
 *
 * ⚠️ Κάθε άρνηση της πόρτας είναι `ApiError` με **δικό της** κωδικό: ο άνθρωπος στην άλλη άκρη πρέπει
 * να μάθει *τι* να διορθώσει (ADR-844 §1).
 */
export interface MaterialPublicationDoor<TParsed, TDeclared = undefined>
  extends ListingMaterialDoor<TParsed, TDeclared, MaterialDoorEnv, MaterialBirth> {
  /**
   * 🔒 **Ο φρουρός κηδεμονίας, με την πρόθεση γραμμένη από την πόρτα**: `requirePropertyInTenantScope({ …query,
   * intent: 'write' })`. Ξένο ή ανύπαρκτο ακίνητο ⇒ 404· αποσυρμένο ⇒ 409 — πριν από οτιδήποτε άλλο.
   */
  readonly judgeProperty: (query: PropertyCustodyQuery) => Promise<TenantProperty>;
  readonly codes: { readonly notCapable: string; readonly uploadFailed: string };
}

/** Η δημοσίευση όπως τη βλέπει η εταιρική πόρτα — το ακίνητο λέγεται `propertyId`. */
type MaterialPublication<TParsed, TDeclared> =
  Omit<ListingMaterialPublication<TParsed, TDeclared>, 'listingId'> & { readonly propertyId: string };

/**
 * **Κηδεμονία και δικαίωμα — πριν διαβαστεί το σώμα.**
 *
 * 🔒 Το ανέβασμα **είναι** δημοσίευση *(ADR-845 §7.17 Α3β)*: το αρχείο γεννιέται δημόσιο και
 * αρχειοθετεί τον δημοσιευμένο προκάτοχό του. Ρωτιέται ο **ΕΝΑΣ** τόπος, και **πριν** γραφτεί οτιδήποτε
 * — αλλιώς το νέο υλικό θα γραφόταν και η διαδοχή θα αρνιόταν ⇒ δύο δημόσια αρχεία της ίδιας ταυτότητας.
 */
async function enterDoor(
  request: NextRequest,
  ctx: AuthContext,
  door: Pick<MaterialPublicationDoor<unknown>, 'judgeProperty' | 'codes'>,
): Promise<MaterialDoorEnv> {
  const propertyId = propertyIdOfRequest(request, ctx);
  const property = await door.judgeProperty({ ctx, propertyId, path: request.nextUrl.pathname });

  const subject = { globalRole: ctx.globalRole, permissions: ctx.permissions, companyId: ctx.companyId };
  if (!mayChangePublication(subject)) throw new ApiError(403, door.codes.notCapable);

  return { adminDb: getAdminFirestore(), ctx, propertyId, property: { ...property } };
}

/** **Το εταιρικό ακίνητο ως υποκείμενο** — γέννηση με `companyId`, σχέδια και προκάτοχοι στο `files` του μισθωτή. */
function companyPropertySubject(env: MaterialDoorEnv): ListingMaterialSubject<MaterialDoorEnv, MaterialBirth> {
  const { adminDb, ctx, propertyId } = env;
  return {
    adminDb,
    listingId: propertyId,
    actor: containerActorOf(ctx),
    env,
    birthOf: (sourceRevisions) => ({ companyId: ctx.companyId, propertyId, createdBy: ctx.uid, sourceRevisions }),
    readSourceRevisions: (sceneFileIds) => readSourceRevisions(adminDb, ctx.companyId, sceneFileIds),
    findPredecessors: (category, newcomer) =>
      findSupersededMaterial(adminDb, ctx.companyId, propertyId, category, newcomer),
    refresh: () => refreshListingAfterMediaChange(adminDb, propertyId, ctx.companyId),
  };
}

/**
 * 🏆 **Η ΔΗΜΟΣΙΕΥΣΗ ΣΕ ΕΤΑΙΡΙΚΟ ΑΚΙΝΗΤΟ** — κηδεμονία, δικαίωμα, και ο **ΕΝΑΣ** κινητήρας.
 *
 * 🔑 Η πόρτα κρίνεται **πριν** διαβαστεί το σώμα (`request.formData()`): ξένο ακίνητο δεν πληρώνει ποτέ την
 * ανάγνωση megabytes.
 */
export async function publishPropertyMaterial<TParsed, TDeclared = undefined>(
  request: NextRequest,
  ctx: AuthContext,
  door: MaterialPublicationDoor<TParsed, TDeclared>,
): Promise<MaterialPublication<TParsed, TDeclared>> {
  const env = await enterDoor(request, ctx, door);
  const { listingId, ...published } = await publishListingMaterial(
    await request.formData(), companyPropertySubject(env), door,
  );
  return { ...published, propertyId: listingId };
}
