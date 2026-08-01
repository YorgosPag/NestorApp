/**
 * «Ανήκει ΑΥΤΟ το επίπεδο;» — η δήλωση του πόρου `dxf-level`
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΥΠΗΡΧΕ ΠΡΙΝ (μετρημένο 2026-08-01, ADR-742 §7undecies)
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο πόρος είχε **ήδη** κάνει το μισό βήμα: ο `loadOwnedLevelRef` ένωνε φόρτωση
 * και κρίση σε μία πράξη — αλλά ήταν **τοπικός**, και το `dxf-dimension-styles`
 * δίπλα του κρατούσε το **ίδιο** σχήμα αντιγραμμένο δύο φορές. Δύο αδελφικοί
 * πόροι, τρία αντίγραφα της ίδιας αλυσίδας, κανένα κοινό σημείο.
 *
 * 🔴 Το `jscpd` τα έβρισκε **καθαρά**: `levelData` και `styleData` είναι
 * διαφορετικά tokens (μάθημα #4). Ένας φύλακας που «φαίνεται μοναδικός» επειδή
 * μετονομάστηκε συνεπώς είναι ο πιο ακριβός κλώνος — μια διόρθωση δόγματος
 * μπαίνει στον έναν και ξεχνιέται στον άλλο.
 *
 * Ό,τι διορθώνεται εδώ (ίδια τριάδα με το `dxf-dimension-style`):
 * **μαντείο ύπαρξης** (403 vs 404) · **παγίδα του κενού** (σκέτο `!==`) ·
 * **bypass με σύγκριση συμβολοσειράς** αντί για `isRoleBypass`.
 *
 * @module app/api/dxf-levels/_shared/dxf-level-ownership
 * @see @/lib/api/owned-resource-http — μία υλοποίηση, N δηλώσεις
 * @see ../../dxf-dimension-styles/_shared/dxf-dim-style-ownership — ο αδελφικός πόρος
 * @see ADR-742 §3.3, §7.1, §7undecies
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { defineOwnedResource } from '@/lib/api/owned-resource-http';

/**
 * ⚠️ Το `notFoundMessage` είναι **ακριβώς** η τιμή που έγραφε ο γνήσιος κλάδος
 * του `loadOwnedLevelRef` — το σύρμα του γνήσιου «δεν βρέθηκε» δεν αλλάζει.
 */
export const dxfLevelResource = defineOwnedResource({
  collection: COLLECTIONS.DXF_VIEWER_LEVELS,
  resourceLabel: 'DxfLevel',
  idLogField: 'levelId',
  notFoundMessage: 'DXF level not found',
});
