/**
 * @fileoverview Μητρώο λήξεων — τα ακίνητα ΙΔΙΩΤΩΝ που διαχειρίζεται το γραφείο (ADR-915 Φ4δ · Ε10 · Δ2).
 * @related services/mandate/mandate-catalog.service.ts (`readOfficeMandates` — το ιδίωμα) · lib/owner-property/listing-custody.ts
 * @module services/document-registry/registry-owner-properties.server
 *
 * 🏆 **Πρακτική Street**: το λογισμικό του μεσίτη παρακολουθεί το ΠΕΑ **και** των ακινήτων ιδιοκτητών που διαχειρίζεται —
 *    η αγγελία βγαίνει με το όνομα του γραφείου, και η ευθύνη της αναγραφής είναι δική του. Μέχρι τη Φ4δ το μητρώο ήταν
 *    **κενό** για γραφείο που δουλεύει μόνο με εντολές.
 *
 * 🔒 **Μόνο από τα υπάρχοντα σύνορα — κανένα νέο δικαίωμα**:
 *  - ερώτημα `authorCompanyId == ctx.companyId` (ιδίωμα του καταλόγου εντολών)·
 *  - κάθε έγγραφο περνά από το `ownerPropertyFromDocument` (CHECK 3.74)·
 *  - «διαχειρίζεται;» = `custodyOf(...)` (CHECK 3.56) — **ποτέ** δεύτερος κριτής θεματοφυλακής.
 * 🔒 **Κανένα `files_personal`**: σε θεματοφυλακή γραφείου το δοχείο αρχείων του ΠΕΑ είναι κενό εξ ορισμού
 *    (`ownerPeaFileScope` ⇒ `entityId: null`). Το έγγραφο είναι η **δήλωση** του μπλοκ `energy` (Δ1).
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { mandatedPropertyOwners } from '@/lib/document-validity/registry-owners';
import { custodyOf, custodyWorkspace, mayAdminister, type ListingActor } from '@/lib/owner-property/listing-custody';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import { trimmedStringOrNull } from '@/lib/type-guards';
import { custodyScopeOf, type CustodyScope } from '@/lib/workspace/custody-scope';
import type { GeoPoint } from '@/types/geo/coordinates';
import type { OwnerProperty, OwnerPropertyPlace } from '@/types/owner-property';
import type { RegistryProperty } from './registry-properties.server';

interface OfficeOwnerProperties {
  readonly properties: readonly RegistryProperty[];
  readonly truncated: boolean;
}

/** Το γραφείο είναι θεματοφύλακας; — η ΜΙΑ απάντηση (`custodyOf`), όχι σύγκριση πεδίου εδώ. */
function inOfficeCustody(property: OwnerProperty, companyId: string): boolean {
  const custody = custodyOf(property);
  return custody.kind === 'company' && custody.companyId === companyId;
}

/**
 * Το δηλωμένο σημείο — ή `null`. ⚠️ Ο αναγνώστης (`ownerPropertyFromDocument`) περνά το `place` **ωμό**: έγγραφο πριν
 * την Α5 (θέση = υποχρεωτικό ερώτημα) δεν το έχει, ό,τι κι αν λέει ο τύπος — άρα φράχτης εδώ, όχι σφάλμα στο μητρώο.
 */
function declaredPointOf(place: OwnerPropertyPlace | undefined): GeoPoint | null {
  return place !== undefined && place.kind === 'declared' ? place.point : null;
}

function registryOwnerPropertyOf(property: OwnerProperty, data: Readonly<Record<string, unknown>>): RegistryProperty {
  return {
    id: property.id,
    scope: 'owner-property',
    name: trimmedStringOrNull(property.title),
    certificate: property.energy,
    declaredPoint: declaredPointOf(property.place),
    mandateClientContactIds: mandatedPropertyOwners(property.mandates),
    data,
  };
}

/** Τα ακίνητα ιδιωτών υπό θεματοφυλακή **αυτού** του γραφείου — με ή χωρίς εντολή σε ισχύ. */
export async function readOfficeOwnerProperties(
  db: AdminFirestore,
  companyId: string,
  cap: number,
): Promise<OfficeOwnerProperties> {
  // tenant-scope-exempt: ίδιο σκεπτικό με το `readOfficeMandates` — το `owner_properties` δηλώνεται `mode: 'userId'`
  // για τον ιδιώτη, ενώ εδώ το ερώτημα είναι σκόπιμα δια-χρηστικό μέσα σε ΜΙΑ εταιρεία (ο κατάλογος του γραφείου
  // επιβιώνει όταν φύγει ο υπάλληλος). Το `companyId` έρχεται από το `ctx` του `withAuth`, ποτέ από το αίτημα.
  const snapshot = await db
    .collection(COLLECTIONS.OWNER_PROPERTIES)
    .where(FIELDS.AUTHOR_COMPANY_ID, '==', companyId)
    .limit(cap + 1)
    .get();
  const properties = snapshot.docs.slice(0, cap).flatMap((doc) => {
    const property = ownerPropertyFromDocument(doc.data(), doc.id);
    return property !== null && inOfficeCustody(property, companyId) ? [registryOwnerPropertyOf(property, doc.data())] : [];
  });
  return { properties, truncated: snapshot.size > cap };
}

/** Ένα ακίνητο ιδιώτη που ο δρων **διαχειρίζεται**, μαζί με το βιβλίο του χώρου του (§37). */
export interface AdministeredOwnerProperty {
  readonly property: RegistryProperty;
  /** Ο χώρος που το διαχειρίζεται — εκεί ζουν οι αποφάσεις του και το ιστορικό τους. */
  readonly owner: CustodyScope;
}

/**
 * ADR-915 §36 · §37 — **ένα** ακίνητο ιδιώτη, μόνο αν ο δρων **διαχειρίζεται** τον χώρο του· αλλιώς `null` (ξένο ≡
 * ανύπαρκτο). Ο ΙΔΙΟΣ αναγνώστης (`ownerPropertyFromDocument`) και ο ΕΝΑΣ κριτής θεματοφυλακής (`mayAdminister`,
 * CHECK 3.56): θεματοφυλακή γραφείου ⇒ μόνο το γραφείο· προσωπική ⇒ μόνο ο ιδιοκτήτης (ποτέ το γραφείο του υπαλλήλου).
 */
export async function readAdministeredOwnerProperty(
  db: AdminFirestore,
  actor: ListingActor,
  propertyId: string,
): Promise<AdministeredOwnerProperty | null> {
  const snapshot = await db.collection(COLLECTIONS.OWNER_PROPERTIES).doc(propertyId).get();
  const data = snapshot.data();
  const property = data === undefined ? null : ownerPropertyFromDocument(data, snapshot.id);
  if (property === null) return null;
  const custody = custodyOf(property);
  if (!mayAdminister(custody, actor)) return null;
  return { property: registryOwnerPropertyOf(property, data ?? {}), owner: custodyScopeOf(custodyWorkspace(custody)) };
}
