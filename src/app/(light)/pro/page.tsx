/**
 * `/pro` — **ο δημόσιος κατάλογος γραφείων** (ADR-827 §9.6 #1).
 *
 * Ζει στο route group `(light)` μαζί με τις τρεις οθόνες ακινήτων: ο επισκέπτης είναι
 * **ανώνυμος** — χωρίς sidebar, χωρίς λογαριασμό. Το δημόσιο κέλυφος αποκτά **τέταρτο**
 * καταναλωτή αντί να γεννηθεί πέμπτο (N.0.2).
 *
 * ⚠️ **ΓΙΑΤΙ ΟΧΙ `/o/<ψευδώνυμο>`, ΠΟΥ ΕΓΡΑΦΕ ΤΟ §9.6**: το πρόθεμα `/o/` είναι ο χώρος
 * **μελών** — το `o/[workspace]/layout.tsx` κάνει `redirect(login)` σε ανώνυμο και
 * `notFound()` σε μη-μέλος, και το ADR-787 §5.3 γ γράφει αυτολεξεί ότι *«οι δημόσιες
 * οθόνες ζουν ΕΚΤΟΣ προθέματος»*. Πλήρες σκεπτικό **και** το αντι-παράδειγμα του Houzz:
 * `lib/workspace/workspace-scope.ts`, εγγραφή `pro`.
 *
 * ⚠️ **Καμία `useSearchParams`** ⇒ καμία ανάγκη ορίου `<Suspense>` (CHECK 3.55). Ο
 * κατάλογος δεν έχει φίλτρα **επίτηδες**: ένας επιλογέας ταξινόμησης είναι η υποδοχή
 * που περιμένει το εμπορικό κριτήριο (§9.9 α).
 *
 * @module app/(light)/pro/page
 */

import { AgencyDirectoryContent } from '@/components/mandate/AgencyDirectoryContent';

export default function AgencyDirectoryPage() {
  return <AgencyDirectoryContent />;
}
