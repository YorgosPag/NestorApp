/**
 * ADR-736 Φ4 — τα αρχεία που **πρόσφερε ο χρήστης** για την επίλυση συνημμένων. Μηδέν React.
 *
 * ## Γιατί store και όχι prop
 *
 * Ο χρήστης δίνει τα συνοδευτικά τη στιγμή που διαλέγει το `.dxf` (στο `DxfImportModal`), αλλά η
 * επίλυση μπορεί να γίνει **μόνο αφού** υπάρξει σκηνή — δηλαδή μετά από έναν ασύγχρονο κύκλο
 * parse/commit που περνά από πέντε στρώματα (`handleFileImportWithEncoding` → `useDxfImport` →
 * `commitImportedScene` → levels → σκηνή). Να περάσει ένας πίνακας `File[]` prop-to-prop μέσα από
 * όλη αυτή την αλυσίδα θα σήμαινε να αλλάξουν **πέντε υπογραφές** για ένα δεδομένο που καμία από
 * αυτές δεν διαβάζει. Ο ΝΕΣΤΩΡ λύνει ήδη ακριβώς αυτή την κατηγορία με vanilla store (ADR-040:
 * `HoverStore`, `ImmediatePositionStore`, `LayerManagerPaletteStore`) — ίδιο μοτίβο εδώ.
 *
 * ## Είναι **προσφορά**, όχι κατάσταση
 *
 * Τα αρχεία **καταναλώνονται μία φορά** ({@link takeExternalReferenceCandidates}) και ο κατάλογος
 * αδειάζει. Έτσι η επόμενη εισαγωγή δεν κληρονομεί ποτέ τα υπόβαθρα της προηγούμενης — που θα ήταν
 * σιωπηλά λάθος: ταύτιση διαστάσεων με αρχεία **άλλου έργου** μπορεί κάλλιστα να «πετύχει».
 *
 * ⚠️ Κρατά ζωντανά `File` handles (δείκτες στον δίσκο, όχι bytes στη μνήμη), αλλά και πάλι
 * αδειάζει μόλις χρησιμοποιηθούν — ένα ξεχασμένο 200άρι πλήθος `File` εμποδίζει τον browser να
 * απελευθερώσει τα υποκείμενα blobs.
 *
 * @see ../components/DxfImportModal — ο παραγωγός (επιλογή συνοδευτικών / zip / φακέλου)
 * @see ../hooks/useExternalReferenceResolution — ο καταναλωτής (αυτόματη επίλυση)
 */

import { createExternalStore } from './createExternalStore';

const EMPTY: readonly File[] = [];

const store = createExternalStore<readonly File[]>(EMPTY);

/** Καταχωρεί τα αρχεία που πρόσφερε ο χρήστης. Κενή λίστα ⇒ καθαρίζει τον κατάλογο. */
export function offerExternalReferenceCandidates(files: readonly File[]): void {
  store.set(files.length > 0 ? [...files] : EMPTY);
}

/** Επιστρέφει **και αδειάζει** τον κατάλογο. Δεύτερη κλήση δίνει κενό — by design. */
export function takeExternalReferenceCandidates(): readonly File[] {
  const current = store.get();
  if (current.length > 0) store.set(EMPTY);
  return current;
}

/** Ανάγνωση χωρίς κατανάλωση — για ένδειξη στο UI («3 αρχεία σε αναμονή»). */
export const peekExternalReferenceCandidates = store.get;

export const subscribeExternalReferenceCandidates = store.subscribe;
