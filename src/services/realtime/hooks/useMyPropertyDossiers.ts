'use client';

/**
 * @fileoverview **Οι φάκελοί ΜΟΥ** — ο φάκελος ακινήτου πάνω στη **μία** ζωντανή ανάγνωση.
 * @related ADR-866 Φ1.2 · §2.8.7 Δ3 (Ε-Φ1.1-3) · §2.9.1 Α1 · useOwnedDocuments.ts · useMyOwnerProperties.ts
 * @module services/realtime/hooks/useMyPropertyDossiers
 *
 * 🔑 **Ο ΤΡΙΤΟΣ καταναλωτής της ίδιας μηχανής, όχι νέα μηχανή.** Αγγελία (`useMyOwnerProperties`), ζήτηση
 * (`useMyDemands`) και φάκελος ρωτούν το ίδιο *«τα δικά μου, ζωντανά»*· ό,τι διαφέρει ζει εδώ — η συλλογή, το
 * πεδίο κατόχου και το σύνορο ανάγνωσης. **Καμία** API `GET` (Δ3): ο κανόνας δίνει `read` **μόνο** στον κάτοχο.
 *
 * ⚠️ **Πεδίο κατόχου `userId`, όχι `authorUserId`** (Ε-Φ1.1-1): ο κάτοχος φακέλου είναι **ρόλος** που θα αλλάξει
 * με τη μεταβίβαση (Φ4) — δεν είναι «ποιος έγραψε». Το ερώτημα ζει **εδώ** ώστε οι CHECK 3.10/3.35 να βλέπουν
 * στατικά και τις δύο αυθεντίες (`COLLECTIONS.PROPERTY_DOSSIERS` · `FIELDS.USER_ID`).
 *
 * ⚠️ **Καμία ταξινόμηση στο ερώτημα**: ένα `orderBy` θα ζητούσε σύνθετο δείκτη (CHECK 3.15) για λίστα που ένας
 * άνθρωπος μετρά σε μονάδες. Η σειρά είναι απόφαση **παρουσίασης** (`property-dossier-view.ts`).
 */

import { collection, query, where } from 'firebase/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { db } from '@/lib/firebase';
import { propertyDossierFromDocument } from '@/lib/property-dossier/property-dossier-from-document';
import type { PropertyDossier } from '@/types/property-dossier';

import {
  useOwnedDocument,
  useOwnedList,
  type OwnedCollectionSpec,
  type OwnedDocumentState,
  type OwnedListState,
} from './useOwnedDocuments';

/**
 * Πού ζει «ο φάκελός μου» — **σταθερά επιπέδου module**: οι αναφορές `buildQuery`/`fromDocument` μπαίνουν σε
 * εξαρτήσεις `useEffect`, και μια νέα συνάρτηση ανά render θα ξαναέγραφε τη συνδρομή σε βρόχο.
 */
const PROPERTY_DOSSIERS: OwnedCollectionSpec<PropertyDossier> = {
  collectionName: COLLECTIONS.PROPERTY_DOSSIERS,
  buildQuery: (userId) =>
    query(collection(db, COLLECTIONS.PROPERTY_DOSSIERS), where(FIELDS.USER_ID, '==', userId)),
  label: 'οι φάκελοί μου',
  fromDocument: propertyDossierFromDocument,
};

/** **Οι φάκελοί μου**, ζωντανά — ενεργοί **και** αρχειοθετημένοι (το φίλτρο είναι της οθόνης). */
export function useMyPropertyDossiers(userId: string | null): OwnedListState<PropertyDossier> {
  return useOwnedList<PropertyDossier>(PROPERTY_DOSSIERS, userId);
}

/** Ο **ένας** φάκελος, ζωντανά — ξένος ή ανύπαρκτος ⇒ `absent` (ο κανόνας αρνείται, η μηχανή δεν επιβεβαιώνει). */
export function useMyPropertyDossier(
  dossierId: string,
  userId: string | null,
): OwnedDocumentState<PropertyDossier> {
  return useOwnedDocument<PropertyDossier>(PROPERTY_DOSSIERS, dossierId, userId);
}
