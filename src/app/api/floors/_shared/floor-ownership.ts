/**
 * «Ανήκει ΑΥΤΟΣ ο όροφος;» — η δήλωση του πόρου `floor`
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΥΠΗΡΧΕ ΠΡΙΝ (μετρημένο 2026-08-01, ADR-742 §7undecies)
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο `loadFloorInTenant` ήταν **το πιο προχωρημένο** από τα εναπομείναντα σημεία
 * και γι' αυτό το πιο διδακτικό: το ADR-702 είχε ήδη ενώσει τα δύο αντίγραφά
 * του (update + delete) **και** είχε αντικαταστήσει τη σύγκριση συμβολοσειράς
 * με `isRoleBypass`. Ό,τι έμενε ήταν ακριβώς τα δύο που **δεν φαίνονται**:
 *
 * 1. **Το μαντείο ύπαρξης** — ανύπαρκτος όροφος `404 'Floor not found'`, ξένος
 *    όροφος `403 'Unauthorized'`. Ο καλών ξεχώριζε τα δύο και μάθαινε ότι το id
 *    υπάρχει (§3.3).
 * 2. **Η παγίδα του κενού** — `data.companyId !== ctx.companyId` σκέτο. Όροφος
 *    χωρίς `companyId` και καλών με χαλασμένο token «ταίριαζαν» (§4).
 *
 * ⚠️ Το ότι ένα σημείο έχει **ήδη** καθαριστεί μία φορά δεν σημαίνει ότι είναι
 * καθαρό: το ADR-702 απάντησε σε **άλλη ερώτηση** (ποιος ρόλος παρακάμπτει) και
 * άφησε ανέγγιχτη τη διαφορά 403/404.
 *
 * @module app/api/floors/_shared/floor-ownership
 * @see @/lib/api/owned-resource-http — μία υλοποίηση, N δηλώσεις
 * @see ADR-742 §3.3, §4, §7undecies · ADR-702 (ο ρόλος, όχι ο κωδικός)
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { defineOwnedResource } from '@/lib/api/owned-resource-http';

/**
 * ⚠️ Το κείμενο είναι **ακριβώς** αυτό που έγραφε ο γνήσιος κλάδος — και το
 * ίδιο που χρησιμοποιεί ήδη ο φύλακας **γονέα** (`Floor not found` στο
 * `entity-creation.service`). Μια απόκλιση εδώ θα έκανε το κείμενο μαντείο.
 */
export const floorResource = defineOwnedResource({
  collection: COLLECTIONS.FLOORS,
  resourceLabel: 'Floor',
  idLogField: 'floorId',
  notFoundMessage: 'Floor not found',
});
