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
 * JSON της αγγελίας. Η πρόσοψη μένει, γιατί είναι χαρακτηριστικό του ακινήτου, όχι του υπολογισμού. Το ίδιο ισχύει για
 * το μικτό ανά όροφο (`levelAreas`, Φ3β-3β): **μία** πύλη ({@link disclosedLevelAreas}) για προβολή **και** επικάλυψη.
 */

import { objectiveValueFormOf } from '@/lib/objective-value/objective-value-form-of-type';
import {
  listingObjectiveValueDeclarationsOf,
  readObjectiveValueDeclarations,
  type ListingObjectiveValueDeclarations,
  type ObjectiveValueDeclarations,
} from '@/lib/objective-value/objective-value-declarations';
import { readLevelAreas, type LevelArea } from '@/lib/properties/level-areas';
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
 * **Το μικτό ανά όροφο** πολυεπίπεδης κατοικίας, **χωρίς** την πύλη απόκρυψης — όλα ή τίποτα (`readLevelAreas`).
 * `areaSqm` = το συνολικό μικτό **όπως το δημοσιεύει η αγγελία**, ώστε βάση και εμφανές εμβαδόν να μη διαφωνούν.
 */
export function projectLevelAreas(property: ProjectableProperty, areaSqm: number | null): readonly LevelArea[] | null {
  if (!isResidence(property)) return null;
  const declared = property.layout?.levels;
  return readLevelAreas({
    levels: property.levels,
    levelData: property.levelData,
    declaredCount: typeof declared === 'number' ? declared : null,
    totalGross: areaSqm,
  });
}

/** **Η μία πύλη**: κρυμμένη αντικειμενική ⇒ κανένα εμβαδόν ανά όροφο στο JSON. */
export function disclosedLevelAreas(
  declarations: ListingObjectiveValueDeclarations,
  levelAreas: readonly LevelArea[] | null,
): readonly LevelArea[] | null {
  return declarations.display === 'hidden' ? null : levelAreas;
}

/** Ό,τι μπαίνει στη δημόσια αγγελία για τον υπολογισμό: οι δηλώσεις **και** το μικτό ανά όροφο, πίσω από την πύλη. */
export function projectObjectiveValueBasis(
  property: ProjectableProperty,
  areaSqm: number | null,
): Pick<PublicListing, 'objectiveValueDeclarations' | 'levelAreas'> {
  const objectiveValueDeclarations = projectObjectiveValueDeclarations(property);
  return { objectiveValueDeclarations, levelAreas: disclosedLevelAreas(objectiveValueDeclarations, projectLevelAreas(property, areaSqm)) };
}

/**
 * **Η αγγελία με ΑΛΛΕΣ δηλώσεις** — ό,τι θα έβγαζε η προβολή αν το έγγραφο είχε αυτές τις δηλώσεις (ADR-898 Φ3β-3).
 *
 * 🔑 Η οθόνη «Βελτίωσε την αγγελία σου» παίρνει τη βάση από τον server (σχήμα + γεγονότα δημοσίευσης) και απλώνει από
 * πάνω την **αισιόδοξη** κατάσταση των δηλώσεων. Τα τρία πεδία που εξαρτώνται από τις δηλώσεις τα παράγουν οι **ίδιες**
 * συναρτήσεις με την προβολή — καμία δεύτερη αντιστοίχιση. Καθαρή, ιδιοδύναμη.
 */
export function withObjectiveValueDeclarations(listing: PublicListing, declarations: ObjectiveValueDeclarations): PublicListing {
  const source: ProjectableProperty = { id: listing.id, type: listing.type, objectiveValueDeclarations: declarations };
  const objectiveValueDeclarations = projectObjectiveValueDeclarations(source);
  return {
    ...listing,
    ...projectFrontage(source),
    objectiveValueDeclarations,
    levelAreas: disclosedLevelAreas(objectiveValueDeclarations, listing.levelAreas),
  };
}
