/**
 * @fileoverview **Οι δηλώσεις της αντικειμενικής στη δημόσια αγγελία** (ADR-898 Φ3β) — η πρόσοψη ως ορατό
 * χαρακτηριστικό, και τα στοιχεία υπολογισμού **μόνο** όσο ο αγγελιοδότης δεν έχει επιλέξει απόκρυψη.
 * @related `lib/objective-value/objective-value-declarations.ts` (ο ΕΝΑΣ αναγνώστης) · `public-listing-attributes.ts`
 *   (η πρόσοψη μπαίνει στα χαρακτηριστικά) · `public-listing-projection.ts` (οι δηλώσεις μπαίνουν στο σχήμα)
 * @module services/listings/public-listing-objective-value
 *
 * 🔑 **Ιδιώτης και εταιρεία από τον ΙΔΙΟ δρόμο**: και τα δύο έγγραφα φτάνουν εδώ ως `ProjectableProperty`, και η
 * ερμηνεία του ωμού πεδίου είναι **μία** (`readObjectiveValueDeclarations`) — ίδιο δικαίωμα απόκρυψης για όλους.
 *
 * 🔑 **Πρόσοψη μόνο σε κατοικία**: το ποια είδη αποτιμώνται με το έντυπο 1 το λέει ο **ένας** πίνακας
 * `OBJECTIVE_VALUE_FORM_OF_TYPE` — καμία δεύτερη λίστα ειδών εδώ.
 *
 * 🔑 **Κρυμμένη ⇒ ούτε τα στοιχεία υπολογισμού** (ελαχιστοποίηση δεδομένων): το ποσό δεν πρέπει να ξαναβγαίνει από το
 * JSON της αγγελίας. Η πρόσοψη μένει, γιατί είναι χαρακτηριστικό του ακινήτου, όχι του υπολογισμού.
 */

import { objectiveValueFormOf } from '@/lib/objective-value/objective-value-form-of-type';
import {
  listingObjectiveValueDeclarationsOf,
  readObjectiveValueDeclarations,
  type ListingObjectiveValueDeclarations,
  type ObjectiveValueDeclarations,
} from '@/lib/objective-value/objective-value-declarations';
import type { ListingAttributeFields, PublicListing } from '@/types/public-listing';

import type { ProjectableProperty } from './public-listing-projection-types';

function isResidence(property: ProjectableProperty): boolean {
  return objectiveValueFormOf(property.type) === 'residence';
}

/** Η πρόσοψη ως χαρακτηριστικό της αγγελίας — `null` αν δεν δηλώθηκε ή αν το είδος δεν είναι κατοικία. */
export function projectFrontage(property: ProjectableProperty): Pick<ListingAttributeFields, 'frontage'> {
  if (!isResidence(property)) return { frontage: null };
  return { frontage: readObjectiveValueDeclarations(property.objectiveValueDeclarations).frontage };
}

/** Τα στοιχεία υπολογισμού της αντικειμενικής — ή μόνο η απόκρυψη. */
export function projectObjectiveValueDeclarations(property: ProjectableProperty): ListingObjectiveValueDeclarations {
  return listingObjectiveValueDeclarationsOf(readObjectiveValueDeclarations(property.objectiveValueDeclarations));
}

/**
 * **Η αγγελία με ΑΛΛΕΣ δηλώσεις** — ό,τι θα έβγαζε η προβολή αν το έγγραφο είχε αυτές τις δηλώσεις (ADR-898 Φ3β-3).
 *
 * 🔑 Η οθόνη «Βελτίωσε την αγγελία σου» παίρνει τη βάση από τον server (σχήμα + γεγονότα δημοσίευσης) και απλώνει από
 * πάνω την **αισιόδοξη** κατάσταση των δηλώσεων. Τα δύο πεδία που εξαρτώνται από τις δηλώσεις τα παράγουν οι **ίδιες**
 * συναρτήσεις με την προβολή — καμία δεύτερη αντιστοίχιση. Καθαρή, ιδιοδύναμη.
 */
export function withObjectiveValueDeclarations(listing: PublicListing, declarations: ObjectiveValueDeclarations): PublicListing {
  const source: ProjectableProperty = { id: listing.id, type: listing.type, objectiveValueDeclarations: declarations };
  return {
    ...listing,
    ...projectFrontage(source),
    objectiveValueDeclarations: projectObjectiveValueDeclarations(source),
  };
}
