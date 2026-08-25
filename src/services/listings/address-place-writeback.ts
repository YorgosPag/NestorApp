/**
 * **Ο ΤΟΠΟΣ ΤΟΥ ΕΡΓΟΥ, ΑΠΟ ΤΗ ΜΕΡΙΑ ΤΟΥ PATCH** — λύσε τη θέση, μετά ξαναπρόβαλε.
 *
 * @module api/projects/[projectId]/project-place-projection
 * @related ADR-777 Α1/Α5 · lib/geocoding/address-position.ts · services/listings/publish-public-listing.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ — μετρημένο 2026-08-25
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η θέση μιας αγγελίας εταιρείας **ζει στο έργο** (Α1): ο προβολέας ανεβαίνει
 * *ακίνητο → κτίριο → έργο* και διαβάζει `project.addresses[].coordinates`. Το
 * `republishListingsForProject` γράφτηκε **ακριβώς** γι' αυτό, και το λέει στο ίδιο
 * του το σχόλιο:
 *
 *     «αλλιώς μια διόρθωση διεύθυνσης θα άφηνε **κάθε** αγγελία του έργου με παλιά
 *      θέση, **σιωπηλά**»
 *
 * **Κανείς δεν το καλούσε.** Μετρημένο με παρονομαστή:
 *
 *     grep -rn "republish" src/app/api/projects/ src/components/projects/  → 0 ευρήματα
 *     (μάρτυρας: το ίδιο grep στο property-publish-projection.ts → 4)
 *
 * ⇒ Οι επτά δημόσιες αγγελίες είχαν προβληθεί στις **2026-08-09** και έμεναν εκεί.
 * Ένας μηχανισμός γραμμένος για να αποτρέψει ακριβώς αυτό το ελάττωμα, **αδρανής**
 * πάνω στο ζωντανό στιγμιότυπό του (ADR-749 §5).
 *
 * ⚠️ **ΔΥΟ πράξεις, ΜΙΑ αιτία, και η σειρά είναι συμβόλαιο:** πρώτα λύνεται η θέση
 * (αλλιώς η επαναπροβολή θα διάβαζε την **παλιά** διεύθυνση), μετά γράφεται το έργο,
 * και **μόνο τότε** ξαναπροβάλλονται οι αγγελίες.
 */

import { geocodeWithVerdict } from '@/app/api/geocoding/geocoding-engine';
import { createModuleLogger } from '@/lib/telemetry';
import {
  resolveAddressPositions,
  type AddressGeocoder,
  type AddressLike,
  type AddressPositionTally,
} from '@/lib/geocoding/address-position';
import { republishListingsForProject } from '@/services/listings/publish-public-listing';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

const logger = createModuleLogger('ProjectPlaceProjection');

/** Μια διεύθυνση έργου, όπως τη βλέπει αυτό το αρχείο — **δομικά**, ίδιο ιδίωμα με τον προβολέα. */
export type ProjectAddressLike = AddressLike & { readonly id?: string };

/**
 * Ο πραγματικός γεωκωδικοποιητής, προσαρμοσμένος στο συμβόλαιο των **τριών** εκβάσεων.
 *
 * 🔑 **Η εξαίρεση ΕΙΝΑΙ η πληροφορία.** Το `AddressGeocoder` δηλώνει `null` = *«ρώτησα,
 * δεν υπάρχει»* και **εξαίρεση** = *«δεν μπόρεσα να ρωτήσω»*, γιατί οι δύο οδηγούν σε
 * **αντίθετες** πράξεις πάνω στα αποθηκευμένα δεδομένα. Η μηχανή τις ξεχωρίζει από τα
 * `attempts` της· εδώ απλώς **δεν χάνονται στη μεταφορά**.
 */
const geocodeAddress: AddressGeocoder = async (query) => {
  const verdict = await geocodeWithVerdict({ ...query, country: query.country ?? 'Greece' });

  switch (verdict.kind) {
    case 'hit':
      return {
        lat: verdict.result.lat,
        lng: verdict.result.lng,
        accuracy: verdict.result.accuracy,
        confidence: verdict.result.confidence,
        variantUsed: verdict.result.source?.variantUsed,
        osmType: verdict.result.source?.osmType,
      };
    case 'absent':
      return null;
    case 'unavailable':
      // ⚠️ **Άγνοια, όχι γνώση.** Ο γραφέας θέσης κρατά ό,τι ήδη ξέραμε.
      throw new Error('geocoder-unavailable');
  }
};

/**
 * Λύνει τη θέση **κάθε** διεύθυνσης του έργου πριν τη γραφή.
 *
 * ⚠️ **Ρωτά ΜΟΝΟ όσες άλλαξαν.** Ο κανόνας ζει στον γραφέα θέσης και είναι αυτός που
 * κρατά τη συμμόρφωση με το *«an absolute maximum of 1 request per second»* του
 * Nominatim: μια αποθήκευση που αγγίζει την ετικέτα ή τη σειρά **δεν ρωτά κανέναν**.
 */
export async function resolveProjectAddressPositions<T extends ProjectAddressLike>(
  storedAddresses: readonly T[],
  incomingAddresses: readonly T[],
  now: number,
): Promise<{ readonly addresses: readonly T[]; readonly tally: AddressPositionTally }> {
  return resolveAddressPositions(storedAddresses, incomingAddresses, geocodeAddress, now);
}

/**
 * Ξαναγράφει τις δημόσιες προβολές **όλων** των ακινήτων του έργου.
 *
 * ⚠️ **Awaited, ΟΧΙ fire-and-forget** — ίδια απόφαση και ίδιος λόγος με το
 * `property-publish-projection.ts` (N.7.2 #6): ένας επαγγελματίας που πάτησε
 * «αποθήκευση» και είδε επιτυχία δικαιούται ο χάρτης να έχει **ήδη** αλλάξει όταν του
 * απαντήσουμε. Οι ειδοποιήσεις είναι παρενέργειες· αυτό είναι **τι βλέπει ο κόσμος**.
 *
 * 🔑 **Δεν πετά ποτέ.** Η αποτυχία της δημόσιας προβολής δεν ακυρώνει τη γραφή του
 * έργου — εκείνη **έγινε** ήδη. Το δίχτυ είναι η επανασύνθεση
 * (`/api/admin/rebuild-public-listings`), και η διαφορά ανάμεσα σε «*σιωπηλά
 * μπαγιάτικο*» και «*γνωστά εκκρεμές*» είναι αυτή η γραμμή στο ημερολόγιο.
 */
export async function republishProjectListings(
  adminDb: AdminFirestore,
  projectId: string,
): Promise<void> {
  try {
    const tally = await republishListingsForProject(adminDb, projectId);
    logger.info('Οι αγγελίες του έργου ξαναπροβλήθηκαν', { projectId, ...tally });
  } catch (error) {
    logger.warn('Επαναπροβολή αγγελιών εκκρεμής — θα διορθωθεί από την επανασύνθεση', {
      projectId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
