/**
 * «Ανήκει ΑΥΤΟ το στυλ διαστάσεων;» — η δήλωση του πόρου `dxf-dimension-style`
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΥΠΗΡΧΕ ΠΡΙΝ (μετρημένο 2026-08-01, ADR-742 §7undecies)
 * ─────────────────────────────────────────────────────────────────────────────
 * **Δύο** σημεία απόφασης στο ίδιο αρχείο (`update` γρ. 182, `delete` γρ. 334),
 * αντιγραμμένα λέξη προς λέξη:
 *
 * ```ts
 * if (!styleDoc.exists) → 404 'DXF dimension style not found'
 * if (styleData?.companyId !== ctx.companyId && ctx.globalRole !== 'super_admin')
 *                       → 403 'Unauthorized'
 * ```
 *
 * Τρία ξεχωριστά ελαττώματα σε δύο γραμμές:
 *
 * 1. **Μαντείο ύπαρξης** — ο καλών ξεχωρίζει «δεν υπάρχει» από «δεν είναι
 *    δικό σου» και **μαθαίνει ότι το id υπάρχει** (§3.3).
 * 2. **Η παγίδα του κενού** — σκέτο `!==`: έγγραφο με `companyId: ''` και
 *    καλών με χαλασμένο token (`companyId: ''`) «ταίριαζαν». Το κενό δεν είναι
 *    tenant, είναι **απουσία** tenant (§4).
 * 3. **Bypass με σύγκριση συμβολοσειράς** — `ctx.globalRole !== 'super_admin'`
 *    αντί για `isRoleBypass`: ένας δεύτερος bypass ρόλος θα έχανε πρόσβαση στα
 *    στυλ **της δικής του** εταιρείας, από κώδικα που διαβάζεται σωστός (§7.4).
 *
 * Και τα τρία φεύγουν **δομικά** με τη δήλωση: η απόφαση ζει στο
 * `createOwnershipDecision`, η σειρά στο `loadOwnedDocOrRefusal`.
 *
 * @module app/api/dxf-dimension-styles/_shared/dxf-dim-style-ownership
 * @see @/lib/api/owned-resource-http — μία υλοποίηση, N δηλώσεις
 * @see ADR-742 §3.3, §7.1, §7undecies
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { defineOwnedResource } from '@/lib/api/owned-resource-http';

/**
 * ⚠️ Το `notFoundMessage` είναι **ακριβώς** η τιμή που έγραφε ο γνήσιος κλάδος
 * και των δύο σημείων. Το σύρμα του γνήσιου «δεν βρέθηκε» **δεν αλλάζει** —
 * αλλιώς το ίδιο το κείμενο γίνεται μαντείο. Αυτό που αλλάζει είναι ότι πλέον
 * **και η άρνηση ιδιοκτησίας** το χρησιμοποιεί.
 *
 * Το `resourceLabel` είναι μονολεκτικό επίτηδες: μπαίνει σε ονόματα logger και
 * σε πεδία log (`dimstyleCompanyId`), όχι στο σύρμα.
 */
export const dimStyleResource = defineOwnedResource({
  collection: COLLECTIONS.DXF_DIMENSION_STYLES,
  resourceLabel: 'DimStyle',
  idLogField: 'styleId',
  notFoundMessage: 'DXF dimension style not found',
});
