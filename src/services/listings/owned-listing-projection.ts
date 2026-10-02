/**
 * @fileoverview **ΤΟ ΑΚΙΝΗΤΟ ΤΟΥ ΑΙΤΟΥΝΤΟΣ, ΟΠΩΣ ΘΑ ΤΟ ΔΕΙ Ο ΑΓΟΡΑΣΤΗΣ** — εντοπισμός με θεματοφυλακή, για ιδιώτη ΚΑΙ
 * γραφείο, και η εφήμερη προβολή του (ADR-777 Α14 · ADR-898 Φ3β-3).
 * @related `services/demand/place-interest.service.ts` (το δόλωμα — πρώτος καταναλωτής) ·
 *   `app/api/listings/preview/route.ts` (η προεπισκόπηση της οθόνης «Βελτίωσε την αγγελία σου») ·
 *   `publish-public-listing.ts` (ο ΕΝΑΣ γραφέας — ίδια γνώση τόπου, ίδια γεγονότα δημοσίευσης)
 * @module services/listings/owned-listing-projection
 *
 * 🔑 **Εξήχθη από το `place-interest.service`** (ADR-898 Φ3β-3, N.0.2): το «ποιος δικαιούται να δει το εφήμερο σχήμα
 * αγγελίας ενός ακινήτου» είναι ερώτημα **αγγελίας**, όχι ζήτησης — και απέκτησε δεύτερο καταναλωτή. Η συμπεριφορά
 * του δολώματος **δεν άλλαξε**.
 *
 * 🔑 **Ο άνθρωπος πρώτα**: `ownp_*` ⇄ `prop_*` είναι ξένα προθέματα· αν ποτέ συγκρουστούν, νικά η **προσωπική**
 * κατοχή — το να δείξεις σε υπάλληλο εταιρείας δεδομένα ιδιώτη είναι η χειρότερη από τις δύο αστοχίες.
 * 🔴 **«Δεν υπάρχει» και «δεν είναι δικό σου» απαντώνται ΤΟ ΙΔΙΟ** (`absent`): ξεχωριστή άρνηση θα επέτρεπε απογραφή
 * ξένου χαρτοφυλακίου με μαντεψιά ταυτοτήτων.
 * ⛔ **Το αποτέλεσμα ΔΕΝ γράφεται πουθενά.** `projectListingShape` (χωρίς την πύλη δημοσίευσης) ⇒ εφήμερο, μόνο για
 * τον θεματοφύλακα.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { PlaceSource } from '@/constants/place-sources';
import { nowISO } from '@/lib/date-local';
import { custodyOf, mayAdminister } from '@/lib/owner-property/listing-custody';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import {
  placeKnowledgeFromOwnerProperty,
  projectableFromOwnerProperty,
} from '@/lib/owner-property/owner-property-projection';
import type { OwnerProperty } from '@/types/owner-property';
import type { PublicListing } from '@/types/public-listing';

import { resolvePublicationFacts, withPublicationFacts } from './listing-publication-facts';
import { projectLevelAreas } from './public-listing-objective-value';
import { projectListingShape, type PlaceKnowledge, type ProjectableProperty } from './public-listing-projection';
import { collectPlaceKnowledge } from './publish-public-listing';

/** Ό,τι χρειάζεται η προβολή: το ακίνητο, ο τόπος του, και **μία** στιγμή για όλο το πέρασμα. */
export interface OwnedProjectionInput {
  readonly property: ProjectableProperty;
  readonly place: PlaceKnowledge;
  readonly at: string;
}

export type OwnedProjectionLookup =
  | ({ readonly kind: 'found'; readonly source: PlaceSource } & OwnedProjectionInput)
  | { readonly kind: 'absent' };

/** Ακίνητο γραφείου, όπως κάθεται στο έγγραφο — όσα χρειάζεται η αλυσίδα κτίριο → έργο. */
export type CompanyProjectableProperty = ProjectableProperty & {
  readonly buildingId?: string | null;
  readonly projectId?: string | null;
};

const ABSENT: OwnedProjectionLookup = { kind: 'absent' };

/**
 * **Ακίνητο ιδιώτη → είσοδος προβολής.** Η δήλωσή του **είναι** η γνώση του τόπου (Α14) — καμία ανάγνωση.
 * ⚠️ Χωρίς επωνυμία επίτηδες: η υπογραφή γραφείου δεν κρίνει ούτε ταίριασμα ούτε αντικειμενική.
 */
export function ownerPropertyProjectionOf(property: OwnerProperty, at: string): OwnedProjectionInput {
  return {
    property: { ...projectableFromOwnerProperty(property, at), id: property.id },
    place: placeKnowledgeFromOwnerProperty(property, at),
    at,
  };
}

/** **Ακίνητο γραφείου → είσοδος προβολής.** Ο τόπος κληρονομείται ανεβαίνοντας κτίριο → έργο (πραγματική ανάγνωση). */
export async function companyPropertyProjectionOf(
  db: AdminFirestore,
  property: CompanyProjectableProperty,
  at: string,
): Promise<OwnedProjectionInput> {
  return { property, place: await collectPlaceKnowledge(db, property, at), at };
}

/** Το ακίνητο του **ιδιώτη** — θεματοφυλακή από τη ΜΙΑ αρχή (`mayAdminister`, CHECK 3.56). */
async function readOwnerProjection(
  db: AdminFirestore,
  propertyId: string,
  actor: { readonly uid: string; readonly companyId: string | null },
): Promise<OwnedProjectionInput | null> {
  const snap = await db.collection(COLLECTIONS.OWNER_PROPERTIES).doc(propertyId).get();
  // 🔴 ΤΟ ΣΥΝΟΡΟ (ADR-842 §7.6.12): η ταυτότητα δένεται μία φορά, στον αναγνώστη.
  const property = ownerPropertyFromDocument(snap.data(), propertyId);
  // Ο ιδιωτικός χώρος ΔΕΝ διευρύνεται (`personal` ⇒ `userId === uid`)· ο εταιρικός κλάδος απαιτεί μισθωτή και στις δύο πλευρές.
  if (property === null || !mayAdminister(custodyOf(property), actor)) return null;
  return ownerPropertyProjectionOf(property, nowISO());
}

/** Το ακίνητο του **γραφείου** — έλεγχος μισθωτή σε ανάγνωση εγγράφου (καμία πύλη ερωτήματος δεν τον επιβάλλει εδώ). */
async function readCompanyProjection(
  db: AdminFirestore,
  propertyId: string,
  companyId: string,
): Promise<OwnedProjectionInput | null> {
  const snap = await db.collection(COLLECTIONS.PROPERTIES).doc(propertyId).get();
  const property = snap.data() as (CompanyProjectableProperty & { companyId?: string | null }) | undefined;
  if (property === undefined || property.companyId !== companyId) return null;
  return companyPropertyProjectionOf(db, { ...property, id: propertyId }, nowISO());
}

/**
 * **Βρες το ακίνητο που ο αιτών δικαιούται, και ετοίμασε την προβολή του.**
 *
 * ⚠️ **Χωρίς εταιρεία, η δεύτερη ανάγνωση ΔΕΝ γίνεται**: το `readCompanyProjection` φιλτράρει κατά μισθωτή, και μια κλήση
 * με κενό `companyId` θα ήταν το ερώτημα «δώσε μου ό,τι δεν ανήκει σε κανέναν» (CHECK 3.35).
 */
export async function lookupOwnedProjection(
  db: AdminFirestore,
  propertyId: string,
  uid: string,
  companyId: string | null,
): Promise<OwnedProjectionLookup> {
  const personal = await readOwnerProjection(db, propertyId, { uid, companyId });
  if (personal !== null) return { kind: 'found', source: 'owner-property', ...personal };
  if (companyId === null) return ABSENT;
  const company = await readCompanyProjection(db, propertyId, companyId);
  return company === null ? ABSENT : { kind: 'found', source: 'company-property', ...company };
}

/**
 * **Η αγγελία όπως θα τη δει ο αγοραστής** — σχήμα **και** γεγονότα δημοσίευσης (έτος κατασκευής · διοικητική περιοχή),
 * δεμένα από τον **ίδιο** δέτη με τον γραφέα. `null` = απούσα ή ξένη.
 *
 * 🔴 **Γιατί όχι σκέτο `projectListingShape` στον browser** (ADR-898 Φ3β-3): η καθαρή προβολή γράφει `constructionYear:
 * null` — το δένει μόνο ο γραφέας. Μια οθόνη που προβάλλει μόνη της θα έχανε την προσέγγιση της άδειας από το έτος
 * και θα έδειχνε «τι λείπει» εκεί όπου η δημόσια αγγελία δείχνει εύρος. Και για το γραφείο ο τόπος θέλει αναγνώσεις.
 *
 * 🔑 **Το μικτό ανά όροφο ΧΩΡΙΣ την πύλη απόκρυψης** (ADR-898 Φ3β-3β): αυτή είναι η ιδιωτική ματιά του **κατόχου**
 * (`private, no-store`), που βελτιώνει την ενότητα και όταν την κρύβει. Ο browser ξαναπερνά την πύλη
 * (`withObjectiveValueDeclarations`) για ό,τι θα δει ο αγοραστής.
 */
export async function readOwnedListingPreview(
  db: AdminFirestore,
  propertyId: string,
  uid: string,
  companyId: string | null,
): Promise<PublicListing | null> {
  const owned = await lookupOwnedProjection(db, propertyId, uid, companyId);
  if (owned.kind === 'absent') return null;
  const listing = ownedListingShape(owned);
  return withPublicationFacts(listing, await resolvePublicationFacts(db, listing, owned.place));
}

/**
 * **Το εφήμερο σχήμα του κατόχου** — η προβολή **με** το μικτό ανά όροφο **χωρίς** πύλη απόκρυψης, πριν από τα
 * γεγονότα δημοσίευσης. Σύγχρονο επίτηδες: ο πίνακας του εργολάβου (ADR-898 Φ4) προβάλλει Ν μονάδες και λύνει τα
 * γεγονότα **μία φορά ανά θέση**, όχι Ν φορές. Ένα σημείο για τη μορφή — δύο καλούντες.
 */
export function ownedListingShape(owned: OwnedProjectionInput): PublicListing {
  const shape = projectListingShape(owned.property, owned.place, owned.at);
  return { ...shape, levelAreas: projectLevelAreas(owned.property, shape.areaSqm) };
}
