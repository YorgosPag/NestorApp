import 'server-only';

/**
 * @fileoverview **ΤΑ ΔΙΟΙΚΗΤΙΚΑ ΑΠΟΤΥΠΩΜΑΤΑ, ΔΙΑΒΑΣΜΕΝΑ ΑΠΟ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ** — η
 * απόδειξη ότι ένα ακίνητο βρίσκεται μέσα σε μια περιοχή δεν έρχεται ποτέ από το σύρμα.
 * @related lib/geo/admin-footprints.ts (**ο ίδιος αναλυτής**, άλλη πηγή bytes) ·
 *   services/places/administrative-hierarchy.reader.ts (ο αδελφός του) ·
 *   services/mandate/showcase-presence.service.ts (ο μόνος καλών) · ADR-846 §9 #13
 * @module services/places/admin-footprints.reader
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ — ΚΑΙ ΗΤΑΝ **ΑΟΡΑΤΟ**
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ο γραφέας του `presence` *(`refreshShowcasePresence`)* είναι `server-only`. Ο μόνος
 * αναγνώστης αποτυπωμάτων που υπήρχε *(`ADMIN_FOOTPRINTS_SOURCE`)* κατεβάζει το αρχείο
 * με **`fetch('/data/admin-footprints.json')`** — **σχετικό URL, που στο Node δεν
 * επιλύεται**. Και επειδή ο μηχανισμός του περιηγητή **καταπίνει** την αποτυχία
 * *(σωστά, για τη δική του πλευρά: «δεν φόρτωσε» ⇒ «δεν ξέρω» ⇒ κανείς δεν κόβεται)*,
 * ο γραφέας θα έπαιρνε **κενό στιγμιότυπο**, θα ανέλυε **κάθε** κύκλο σε `null`, και θα
 * έγραφε **«καμία απόδειξη» για ΟΛΟΥΣ** — με **όλα τα σήματα πράσινα**.
 *
 * 🔑 **Το σχήμα είναι το ίδιο που κυνηγά όλο το `CLAUDE.md`**: *«το `0` δεν σημαίνει
 * “καθαρό”, σημαίνει “κανείς δεν κοίταξε”»* — και εδώ θα το είχε γράψει σε **δημόσιο
 * έγγραφο**, για λογαριασμό τρίτου.
 *
 * ⇒ Γι' αυτό το `null` αυτού του αναγνώστη σημαίνει **«δεν μπόρεσα να ρωτήσω»** και ο
 * καλών **δεν γράφει καθόλου** το πεδίο — δες `showcase-presence.service.ts`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔒 ΓΙΑΤΙ **ΔΕΝ** ΕΙΝΑΙ ΚΛΩΝΟΣ ΤΟΥ `lib/geo/admin-footprints.ts`
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Η **ανάλυση** είναι **μία**: το {@link buildFootprintSnapshot} — ο ίδιος έλεγχος
 * σχήματος, ο ίδιος `outerKm >= innerKm`, ο ίδιος φρουρός εγκλεισμού των δίσκων.
 * Διαφέρει **μόνο** η πηγή των bytes, και αυτή ζει στο `lib/data/server-json-file.ts`,
 * κοινή με τον αδελφό αναγνώστη της ιεραρχίας. **Ένας αναλυτής, ένας μηχανισμός, δύο
 * πηγές** — τίποτα δεν γράφτηκε δεύτερη φορά.
 */

import { createServerJsonFile } from '@/lib/data/server-json-file';
import { buildFootprintSnapshot, type FootprintSnapshot } from '@/lib/geo/admin-footprints';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('admin-footprints.reader');

const FOOTPRINTS_FILE = createServerJsonFile<FootprintSnapshot>({
  publicPath: ['data', 'admin-footprints.json'],
  build: buildFootprintSnapshot,
  onFailure: (error) => {
    // ⚠️ `error`, όχι `warn`: ο γραφέας **παραλείπει** μια πράξη εξαιτίας του, δηλαδή
    //    είναι βλάβη **δική μας** — όχι κατάσταση του κόσμου.
    logger.error('Δεν διαβάστηκαν τα διοικητικά αποτυπώματα', {
      error: error instanceof Error ? error.message : String(error),
    });
  },
});

/**
 * **Τα αποτυπώματα, από τη μεριά του διακομιστή.**
 *
 * @returns `null` **μόνο** όταν το αρχείο δεν διαβάστηκε — βλάβη **δική μας**. Ποτέ
 *   κενός χάρτης: *«δεν ρώτησα»* και *«ρώτησα και δεν βρήκα»* είναι **διαφορετικά**
 *   γεγονότα, και μόνο το δεύτερο επιτρέπεται να γραφτεί.
 */
export function readAdminFootprints(): Promise<FootprintSnapshot | null> {
  return FOOTPRINTS_FILE.read();
}
