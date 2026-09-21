/**
 * **`/messages/{threadId}` — μία συνομιλία** (ADR-867 Β9γ).
 *
 * Λεπτή σελίδα: όλη η ουσία ζει στο {@link NetworkThreadScreen} — ένα component δοκιμάζεται· ένα
 * `page.tsx` του App Router όχι. Ίδιο ιδίωμα με το αδελφό `messages/page.tsx`.
 *
 * 🔑 **ΓΙΑΤΙ ΑΠΕΚΤΗΣΕ ΔΙΕΥΘΥΝΣΗ ΤΟ ΝΗΜΑ**: μέχρι το Β9β η συνομιλία ζούσε **μόνο** μέσα στη σελίδα
 * της πράξης της. Για αγγελία **ιδιώτη** με εντολή σε γραφείο, εκείνη η σελίδα **δεν υπάρχει στο
 * γραφείο** (`isPersonalCustody ⇒ not-yours`) ⇒ ο κατάλογος έδειχνε γραμμή που δεν άνοιγε. Ο πλήρης
 * λόγος και οι πηγές ζουν στο `lib/network-messaging/network-messaging-routes.ts`.
 *
 * ⚠️ Το κέλυφος (ταυτότητα + `noindex` + κεφαλίδα) το δίνει το `(me)/layout.tsx` — **ποτέ** φρουρός
 * μέσα στη σελίδα (CHECK 3.52). Το τμήμα `messages` είναι δηλωμένο **εκτός** χώρου
 * (`OUTSIDE_WORKSPACE`, CHECK 3.60)· αυτή η σελίδα είναι **παιδί** του, άρα ισχύει η ίδια δήλωση.
 *
 * ⚠️ **Καμία `useSearchParams`** ⇒ καμία ανάγκη ορίου `<Suspense>` (CHECK 3.55): η ταυτότητα του
 * νήματος ζει στη **διαδρομή**, όχι σε ερώτημα. Το `params` είναι `Promise` (Next 15) και διαβάζεται
 * με `await` — συγχρονισμένη ανάγνωση θα ήταν σφάλμα χρόνου εκτέλεσης.
 *
 * 🔒 Ο **φρουρός δεν είναι εδώ**: ποιος διαβάζει το νήμα το κρίνει η **γραμμή ακροατηρίου**, στον
 * διακομιστή (`/api/network/threads/{threadId}`). Ξένο και ανύπαρκτο νήμα δίνουν την **ίδια** οθόνη
 * «δεν βρέθηκε» (ADR-742) — η σελίδα δεν επιτρέπεται να πει «υπάρχει, αλλά δεν σου ανήκει».
 *
 * @module app/(me)/messages/[threadId]/page
 */

import { NetworkThreadScreen } from '@/components/network-messaging/NetworkThreadScreen';

interface ThreadPageProps {
  readonly params: Promise<{ readonly threadId: string }>;
}

export default async function MyMessageThreadPage({ params }: ThreadPageProps) {
  const { threadId } = await params;
  return <NetworkThreadScreen threadId={threadId} />;
}
