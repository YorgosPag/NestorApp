/**
 * «Μου ανήκει ΑΥΤΟ το PO;» — η δήλωση του πόρου `purchase-order`
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΟΙ ΔΥΟ ΑΠΟ ΤΙΣ ΤΡΕΙΣ ΔΙΑΔΡΟΜΕΣ ΗΤΑΝ **ΑΟΡΑΤΕΣ** (ADR-742 §7undecies)
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο πόρος είχε **τρεις** διαδρομές με την ίδια χειρόγραφη σύγκριση:
 *
 * | διαδρομή | γραφή |
 * |---|---|
 * | `[poId]/pdf` | `!po \|\| po.companyId !== **ctx**.companyId` |
 * | `[poId]/email` | `!po \|\| po.companyId !== **auth**.companyId` |
 * | `[poId]/share` | `!po \|\| po.companyId !== **auth**.companyId` |
 *
 * Ο κατάλογος της Ομάδας 6 περιείχε **μόνο την πρώτη**. Οι άλλες δύο περνούν
 * από το `defineRoute` (ADR-603), που ονομάζει τον καλούντα `auth` αντί για
 * `ctx` — και ο ανιχνευτής του anchor απαιτούσε **κυριολεκτικά** `ctx.companyId`.
 * Μια μετονομασία μεταβλητής σε **άλλο** ADR έκρυψε δύο σημεία ασφαλείας από
 * τρεις διαδοχικές σαρώσεις. *Το grep μετρά τη ΜΟΡΦΗ που έψαξες* (μάθημα #1).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΗΤΑΝ ΗΔΗ ΣΩΣΤΟ — ΚΑΙ ΤΙ ΟΧΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * ✅ Το «όχι» ήταν **ήδη ενωμένο**: και τα δύο σκέλη (`!po` και ξένο) έβγαζαν
 * `404 'PO not found'`. Ο πόρος **δεν** είχε μαντείο ύπαρξης — σπάνιο, και ο
 * λόγος που η μετανάστευση εδώ **δεν αλλάζει** το σύρμα.
 *
 * ❌ Η σύγκριση ήταν σκέτο `!==` ⇒ **παγίδα του κενού** (§4): PO με
 * `companyId: ''` και καλών με χαλασμένο token «ταίριαζαν». Ο τύπος
 * `PurchaseOrder` **υπόσχεται** `companyId: string`, η βάση δεν το εγγυάται.
 *
 * ⚠️ **Δηλωμένη διεύρυνση**: ο bypass ρόλος αποκτά πρόσβαση (ADR-232). Καμία
 * από τις τρεις δεν είχε κλάδο bypass· η εναλλακτική θα έκανε το `purchase-order`
 * τη **μοναδική** εξαίρεση απέναντι στις έξι `require*InTenant`, στα μηνύματα
 * (§7decies) και στις συνομιλίες. Παραμένει **γνωστό χρέος, όχι λύση**
 * (§7ter.3): το standing cross-tenant προνόμιο **είναι** το anti-pattern, και
 * γι' αυτό η απόφαση είναι **ονομασμένη κατάσταση** σε ένα σημείο.
 *
 * @module app/api/procurement/_shared/po-ownership
 * @see @/lib/api/owned-resource-http — μία υλοποίηση, N δηλώσεις
 * @see ADR-742 §4, §7ter.3, §7undecies
 */

import 'server-only';

import { COLLECTIONS } from '@/config/firestore-collections';
import { defineOwnedResource } from '@/lib/api/owned-resource-http';
import type { ResourceAccessCaller } from '@/lib/auth/resource-ownership-guard';
import type { MaybeTenantOwned } from '@/lib/auth/tenant-ownership';

/**
 * ⚠️ Το κείμενο είναι **ακριβώς** αυτό που έγραφαν και οι τρεις διαδρομές.
 *
 * Το `collection` δηλώνεται αν και οι σημερινές διαδρομές φορτώνουν μέσω
 * `getPO()` (υπηρεσία): είναι η **αλήθεια** για τον πόρο, και η επόμενη διαδρομή
 * που θα θέλει `load()` δεν πρέπει να την ξαναβρεί μόνη της.
 */
export const poResource = defineOwnedResource({
  collection: COLLECTIONS.PURCHASE_ORDERS,
  resourceLabel: 'PurchaseOrder',
  idLogField: 'poId',
  notFoundMessage: 'PO not found',
});

export interface OwnedPoQuery<T extends MaybeTenantOwned> {
  /** Ό,τι γύρισε το `getPO()` — **ποτέ** στενεμένο πριν τον φύλακα (§7.5). */
  readonly po: T | null | undefined;
  readonly caller: ResourceAccessCaller;
  readonly poId: string;
  /** Ποιο μονοπάτι ρώτησε: `'pdf'`, `'email'`, `'share'`. */
  readonly action: string;
}

/**
 * Το PO **αν είναι διαθέσιμο** — αλλιώς `null`, για **δύο** αιτίες με **μία**
 * απάντηση.
 *
 * 🔑 **Γιατί `T | null` και όχι boolean «δεν είναι διαθέσιμο»**: με boolean, το
 * `po` μένει `PurchaseOrder | null` μετά τον έλεγχο και ο επόμενος συντάκτης
 * ζορίζεται να το ξεστενέψει — τυπικά με `!` ή `as`, δηλαδή με **ψέμα**
 * (μάθημα #8). Επιστρέφοντας την τιμή, το `if (!po) notFound(…)` στενεύει
 * **μόνο του** και σωστά. Ίδιο σχήμα με τη σιωπηλή πολιτική
 * `tenant-ownership.ownedOrNull`.
 *
 * ⚠️ Οι **δύο** αιτίες — «δεν υπάρχει» και «δεν είναι δικό σου» — ενώνονται
 * **εδώ, επίτηδες**: για τον καλούντα οφείλουν να είναι αδιάκριτες (§7.1). Έτσι
 * η ταυτότητα γίνεται δομική αντί να επαναλαμβάνεται ως `!po || …` σε τρία
 * αρχεία, όπου το ένα αντίγραφο μπορεί να αποκλίνει.
 *
 * Η διάκριση των **τριών** καταστάσεων δεν χάνεται: ζει στο
 * {@link poResource}`.check`, που καταγράφει την παραβίαση και κρατά ζωντανό το
 * σημείο εισόδου του μελλοντικού JIT.
 */
export function ownedPO<T extends MaybeTenantOwned>(query: OwnedPoQuery<T>): T | null {
  const { po, caller, poId, action } = query;

  if (!po) return null;

  return poResource.check({ data: po, caller, resourceId: poId, action }) === 'denied'
    ? null
    : po;
}
