import 'server-only';

/**
 * **Το ένα σημείο σύνδεσης της επιβεβαίωσης προμηθευτή με τη βιτρίνα** (ADR-923 §5.13 Δ6).
 *
 * 🔑 Ο αναγνώστης με τις τρεις εκβάσεις είναι ο ίδιος που κρίνει τη δημοσίευση της βιτρίνας ({@link readSupplierStandingOutcome}):
 *    μία κρίση, άρα σελίδα προμηθευτή και προβολή μοντέλων δεν μπορούν να διαφωνήσουν.
 * 🔒 Διαβάζει μόνο Firestore (αίτηση, δήλωση, αποθηκευμένη αναφορά μητρώου). Καμία κλήση σε ΓΕΜΗ: η σάρωση τον ρωτά κάθε λίγα λεπτά.
 * 🔑 Βλάβη ⇒ `unknown` ⇒ τίποτα δεν δημοσιεύεται και τίποτα δεν σβήνεται.
 *
 * @module server/catalog/public/public-standing.server
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import type { SupplierStandingReader } from '@/subapps/catalog/public/public-publication-condition';
import { readSupplierStandingOutcome } from '../supplier-review.server';

export const readLiveSupplierStanding: SupplierStandingReader = (companyId) => readSupplierStandingOutcome(getAdminFirestore(), companyId);
