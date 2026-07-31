/**
 * Οι λανθάνουσες μνήμες του πόρου «έργο» — **ένας** κατάλογος, **μία** ακύρωση
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ (N.0.2 Boy Scout · N.18 / CHECK 3.28 · μετρημένο 2026-08-01)
 * ─────────────────────────────────────────────────────────────────────────────
 * Η ίδια ακύρωση ήταν γραμμένη σε **τέσσερα** σημεία, και το πρόθεμα
 * `'api:projects:list'` δηλωνόταν ως literal σε **πέντε**:
 *
 * | Σημείο | Πρόθεμα |
 * |---|---|
 * | `list/project-create.handler` | δική του δήλωση `CACHE_KEY_PREFIX` |
 * | `[projectId]/project-mutations.service` (ενημέρωση) | από `project-mutations.types` |
 * | `[projectId]/project-mutations.service` (διαγραφή) | από `project-mutations.types` |
 * | `trash/…/permanent-delete` | 🔴 **χειρόγραφο literal** |
 *
 * ⚠️ **ΤΙ ΔΕΝ ΗΤΑΝ ΤΟ ΠΡΟΒΛΗΜΑ** — καταγράφεται επειδή παραλίγο να γραφτεί εδώ
 * ως «εύρημα»: μια πρώτη μέτρηση έδειξε ότι δύο σημεία σβήνουν **3** κλειδιά
 * αντί για 4. **Ήταν αστοχία του grep**, όχι του κώδικα: το μοτίβο αναζήτησης
 * δεν περιλάμβανε το `bootstrap:tenant`, οπότε η τέταρτη γραμμή δεν εμφανιζόταν.
 * Και τα τέσσερα σημεία σβήνουν **και τα τέσσερα** κλειδιά. *Το grep μετρά τη
 * μορφή που έψαξες, όχι το φαινόμενο* (ADR-742 §7quinquies.1).
 *
 * 🔴 **Αυτό που όντως αποκλίνει είναι το πρόθεμα**: δηλώνεται ως literal σε
 * **τρία** σημεία και γράφεται **χειρόγραφα** σε ένα τέταρτο. Απόκλιση εκεί δεν
 * σπάει τίποτα ορατό — απλώς αφήνει μια μπαγιάτικη λίστα να επιβιώνει μετά τη
 * γραφή, και ο χρήστης βλέπει έργο που έσβησε να «επιστρέφει» μέχρι να λήξει το
 * TTL. Κανένα σφάλμα, καμία καταγραφή.
 *
 * ⚠️ Η τετράδα είναι **αδιαίρετη**: κάθε γραφή σε έργο αγγίζει τη λίστα του
 * tenant, τη λίστα `all` και **και τις δύο** εκκινήσεις. Γι' αυτό εκτίθεται
 * **συνάρτηση**, όχι τέσσερις σταθερές να τις συνθέτει ο καθένας — ο καλών που
 * θυμάται τρία στα τέσσερα αφήνει ακριβώς μία μπαγιάτικη όψη.
 *
 * ⚠️ **Το `bootstrap:admin` πέφτει ΠΑΝΤΑ**, ακόμη κι όταν τη μεταβολή την κάνει
 * κανονικός χρήστης: η λίστα του υπεργραφείου περιέχει **όλα** τα έργα, άρα
 * επηρεάζεται από κάθε tenant.
 *
 * 🔗 **Σιωπηλή σύζευξη που πρέπει να ξέρεις**: το `EnterpriseAPICache` διαλέγει
 * TTL με `key.includes('api:projects:list')`
 * (`lib/cache/enterprise-api-cache.ts`). Αλλαγή του {@link PROJECT_LIST_CACHE_PREFIX}
 * **χωρίς** αλλαγή εκεί ρίχνει σιωπηλά τη λίστα στο γενικό TTL. Δεν εισάγεται
 * από εδώ επίτηδες: το `lib/` δεν επιτρέπεται να εξαρτηθεί από το `app/`.
 *
 * @module app/api/projects/_shared/project-cache
 */

import { EnterpriseAPICache } from '@/lib/cache/enterprise-api-cache';

/**
 * Το πρόθεμα της λίστας έργων — **SSoT**. Βλ. τη σιωπηλή σύζευξη με το TTL
 * στο docblock του module.
 */
export const PROJECT_LIST_CACHE_PREFIX = 'api:projects:list';

/**
 * @param slot `companyId`, `'all'`, ή το slot εύρους του υπεργραφείου (ADR-356).
 */
export function projectListCacheKey(slot: string): string {
  return `${PROJECT_LIST_CACHE_PREFIX}:${slot}`;
}

/**
 * Ακυρώνει **ό,τι** δείχνει λίστα έργων μετά από γραφή — δημιουργία, ενημέρωση,
 * λογική διαγραφή, οριστική διαγραφή.
 *
 * @param companyId Ο tenant του **καλούντα** — το ίδιο κλειδί με το οποίο γράφτηκε η λίστα.
 */
export function invalidateProjectCaches(companyId: string): void {
  const cache = EnterpriseAPICache.getInstance();
  cache.delete(projectListCacheKey(companyId));
  cache.delete(projectListCacheKey('all'));
  cache.delete('api:projects:bootstrap:admin');
  cache.delete(`api:projects:bootstrap:tenant:${companyId}`);
}
