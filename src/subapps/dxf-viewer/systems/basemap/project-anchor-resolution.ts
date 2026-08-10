/**
 * «Δίνει η **δηλωμένη διεύθυνση** αυτού του έργου θέση αρκετά αξιόπιστη ώστε να καθίσει χάρτης
 * κάτω από το κτίριο — και αν όχι, **γιατί**;»
 *
 * ## Η πρακτική των μεγάλων, και πού την ξεπερνάμε
 * Το **Revit** (`Manage ▸ Project Location ▸ Location`) και το **ArchiCAD**
 * (`Options ▸ Project Preferences ▸ Project Location`) έχουν **ακριβώς** αυτόν τον διαχωρισμό:
 * μια «τοποθεσία» που προκύπτει από διεύθυνση/χάρτη και είναι ρητά **κατά προσέγγιση** (τη
 * χρησιμοποιούν για ηλιασμό και κλίμα), και ένα **Survey Point** που είναι η ακριβής πρόσδεση στο
 * έδαφος. Ποτέ δεν συγχωνεύονται. Η δική μας `BasemapAvailability` είναι η ίδια διάκριση.
 *
 * Τρία πράγματα κάνουμε **διαφορετικά**, και τα τρία μετρήθηκαν πριν γραφτούν:
 *
 * 1. **Η προέλευση ταξιδεύει με την τιμή.** Εκείνα δείχνουν γεωγραφικό πλάτος· δεν λένε ποτέ αν
 *    το βρήκε ο γεωκωδικοποιητής στην πόρτα ή αν το κάρφωσε άνθρωπος πέρσι. Εδώ η απάντηση
 *    κουβαλά {@link ApproximateAnchorOrigin} και φτάνει στην οθόνη.
 * 2. **Η άρνηση είναι απάντηση, όχι σιωπή.** Πέντε ονομασμένοι λόγοι, ο καθένας με **δική του
 *    θεραπεία** — αντί για έναν σβηστό διακόπτη που ο χρήστης διαβάζει ως «χάλασε».
 * 3. **Υπάρχει κατώφλι ποιότητας.** Και τα δύο προγράμματα δέχονται ό,τι επιστρέψει η υπηρεσία
 *    χαρτών. Εμείς απορρίπτουμε την απάντηση «κέντρο οικισμού» — δες `too-coarse` παρακάτω.
 *
 * ## ⚠️ Καμία αυτόματη κλήση δικτύου — και είναι **απόφαση**, όχι παράλειψη
 * Ο μηχανισμός γεωκωδικοποίησης (`@/lib/geocoding`) **δεν** καλείται από εδώ. Τα ζευγάρια
 * συντεταγμένων που χρειαζόμαστε είναι **ήδη αποθηκευμένα** στο `ProjectAddress.coordinates`, τα
 * γράφει ο επεξεργαστής διευθύνσεων (ADR-332) μαζί με παγωμένα μεταδεδομένα ποιότητας, και τα
 * ξαναζητούσαμε θα σήμαινε: κλήση δικτύου σε **κάθε** άνοιγμα του viewer, έκθεση στα όρια ρυθμού
 * του Nominatim, και μια **δεύτερη** απάντηση για την ίδια διεύθυνση που μπορεί να διαφωνεί με
 * την αποθηκευμένη. Το Revit κάνει το ίδιο: η γεωκωδικοποίηση είναι **πράξη του χρήστη** μέσα σε
 * διάλογο, ποτέ παρενέργεια του ανοίγματος αρχείου.
 *
 * Όταν λοιπόν λείπουν συντεταγμένες, η απάντηση είναι `no-coordinates` — που **κατονομάζει** τη
 * θεραπεία (επίλυση στην καρτέλα τοποθεσιών) αντί να την εκτελέσει στα κρυφά.
 *
 * ## ⚠️ ΜΗΝ γράψεις εδώ δεύτερο αριθμό εμπιστοσύνης
 * Το κατώφλι είναι **ένα**, στο `@/lib/geocoding/geocoding-thresholds` (ADR-332 §3.4). Ένα τοπικό
 * `0.7` θα ήταν δεύτερη αλήθεια που αποκλίνει αθόρυβα: και οι δύο αριθμοί «δουλεύουν».
 *
 * @see ./basemap-availability.ts — το store που κρατά την απάντηση (ο μόνος γραφέας: ProjectAnchorHost)
 * @see ADR-782 §21
 */

import {
  POINT_LEVEL_ACCURACIES,
  SUGGESTION_DEFAULTS,
} from '@/lib/geocoding/geocoding-thresholds';
import { getPrimaryAddress } from '@/types/project/address-helpers';
import type { ProjectAddress } from '@/types/project/addresses';
import type {
  ApproximateAnchorOrigin,
  ProjectAnchorResolution,
} from './basemap-availability';

/**
 * Απόσταση από το `(0, 0)` κάτω από την οποία ένα ζεύγος θεωρείται **σεντόνι**, όχι θέση.
 *
 * Το «Null Island» είναι το κλασικό αποτύπωμα ενός πεδίου που αρχικοποιήθηκε και ποτέ δεν
 * συμπληρώθηκε. Βρίσκεται στον Ατλαντικό — δηλαδή **ακριβώς** η βλάβη που περιγράφει η
 * επικεφαλίδα του `basemap-availability`, φτασμένη από την άλλη πόρτα.
 */
const NULL_ISLAND_EPSILON_DEG = 1e-6;

/** Έγκυρο σημείο της Γης, και όχι το σεντόνι της αρχικοποίησης. */
function isPlausibleWgs84(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return false;
  return Math.abs(lat) > NULL_ISLAND_EPSILON_DEG || Math.abs(lon) > NULL_ISLAND_EPSILON_DEG;
}

/**
 * Η κρίση ποιότητας για μια **γεωκωδικοποιημένη** διεύθυνση.
 *
 * Η σειρά είναι συμβόλαιο: η **ακρίβεια** κρίνεται πριν την **εμπιστοσύνη**, γιατί ένα
 * `'center'` με βαθμό 0,95 είναι η χειρότερη περίπτωση που υπάρχει — απόλυτα σίγουρο, και
 * χιλιόμετρα λάθος. Αν κρινόταν πρώτα η εμπιστοσύνη, αυτή ακριβώς η περίπτωση θα περνούσε.
 */
function judgeGeocoded(
  metadata: NonNullable<ProjectAddress['geocodingMetadata']>,
): ProjectAnchorResolution | null {
  if (!POINT_LEVEL_ACCURACIES.has(metadata.accuracy)) {
    return { kind: 'refused', reason: 'too-coarse' };
  }
  if (metadata.confidence < SUGGESTION_DEFAULTS.lowConfidenceThreshold) {
    return { kind: 'refused', reason: 'low-confidence' };
  }
  return null;
}

/**
 * Από πού προήλθε η αποθηκευμένη θέση.
 *
 * ⚠️ Η **ανθρώπινη πρόθεση κρίνεται πρώτη και δεν σταθμίζεται**: όταν κάποιος έσυρε την πινέζα
 * στον χάρτη, η όποια παλιότερη κρίση του γεωκωδικοποιητή είναι **ξεπερασμένη** — ο άνθρωπος την
 * είδε και τη διόρθωσε. Κρίνοντάς την, θα απορρίπταμε τη διόρθωση επικαλούμενοι το σφάλμα που
 * διόρθωσε.
 */
function originOf(address: ProjectAddress): ApproximateAnchorOrigin {
  if (address.source === 'dragged') return 'projectAddressPinned';
  return address.geocodingMetadata ? 'projectAddressGeocoded' : 'projectAddressStored';
}

/**
 * Η **μία** απάντηση για ένα έργο. Καθαρή συνάρτηση: καμία ανάγνωση store, κανένα I/O.
 *
 * @param addresses - Οι διευθύνσεις του έργου· η κύρια επιλέγεται από το SSoT `getPrimaryAddress`.
 */
export function resolveProjectAnchor(
  addresses: readonly ProjectAddress[] | undefined,
): ProjectAnchorResolution {
  const address = getPrimaryAddress(addresses ? [...addresses] : undefined);
  if (!address) return { kind: 'refused', reason: 'no-address' };

  const coordinates = address.coordinates;
  if (!coordinates) return { kind: 'refused', reason: 'no-coordinates' };
  if (!isPlausibleWgs84(coordinates.lat, coordinates.lng)) {
    return { kind: 'refused', reason: 'invalid-coordinates' };
  }

  const originKey = originOf(address);
  if (originKey === 'projectAddressGeocoded' && address.geocodingMetadata) {
    const refusal = judgeGeocoded(address.geocodingMetadata);
    if (refusal) return refusal;
  }

  return {
    kind: 'anchored',
    anchor: { lat: coordinates.lat, lon: coordinates.lng, originKey },
  };
}
