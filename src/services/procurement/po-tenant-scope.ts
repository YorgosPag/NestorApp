/**
 * «Μου ανήκει ΑΥΤΗ η παραγγελία;» — η **μία** πόρτα ανάγνωσης PO με φράχτη εταιρείας
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ (ADR-923 κύμα 3, Λ5)
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `getPurchaseOrder(poId)` διαβάζει **χωρίς** εταιρεία. Το `GET/PATCH/DELETE
 * /api/procurement/[poId]` και οι οκτώ υπηρεσίες πίσω τους (έγκριση, παραγγελία,
 * κλείσιμο, ακύρωση, παραλαβή, επεξεργασία, διαγραφή, αντιγραφή) το καλούσαν και
 * **δεν ρωτούσαν ποτέ** ποιανού είναι το έγγραφο ⇒ χρήστης ξένης εταιρείας που
 * ήξερε ένα `poId` διάβαζε, ενέκρινε, ακύρωνε ή έσβηνε την παραγγελία. Μόνο τα
 * `pdf` / `email` / `share` είχαν φύλακα — **στο route**, όπου το επόμενο route
 * μπορεί να τον ξεχάσει.
 *
 * ⇒ Ο έλεγχος ζει πλέον **στην υπηρεσία** (πρότυπο Stripe/GitHub): κάθε πράξη
 * πάνω σε PO φορτώνει μέσω αυτού του module, και η «ξένη» παραγγελία είναι
 * **αδιάκριτη** από την ανύπαρκτη — ίδιο σφάλμα, ίδιο μήνυμα, ίδιο 404 (ADR-742
 * §7.1). Ένα 403 θα μαρτυρούσε ότι το id υπάρχει.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΑΝΑΓΝΩΣΗ ΚΑΙ ΕΓΓΡΑΦΗ — ΔΥΟ ΠΡΟΘΕΣΕΙΣ, ΜΙΑ ΑΠΟΦΑΣΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η απόφαση είναι η **κοινή** `createOwnershipDecision` (ADR-742 §7octies) — δεν
 * γράφεται εδώ καμία σύγκριση. Η πρόθεση αλλάζει **μόνο** τι κάνουμε με την
 * τρίτη ετυμηγορία (`cross-tenant-bypass`):
 *
 * | πρόθεση | `owned` | `cross-tenant-bypass` | `denied` |
 * |---|---|---|---|
 * | `read`    | ✅ | ✅ (καταγράφεται — ADR-232· σήμερα μόνο GET και pdf) | 404 |
 * | `write`   | ✅ | **404** (+ warn «denied») | 404 |
 * | `compose` | ✅ | — (δεν ρωτάται ρόλος) | `null` |
 *
 * `write` = κάθε πράξη με **παρενέργεια**, όχι μόνο μεταβολή της PO: email στον προμηθευτή,
 * δημιουργία/ανάκληση συνδέσμου κοινοποίησης (Λ5β Μ1). Διαγραμμένη PO = ανύπαρκτη σε `read`/`write`.
 *
 * Γιατί η εγγραφή δεν δέχεται bypass: κάθε μεταβολή γράφει ίχνος με
 * `companyId: ctx.companyId` — δηλαδή στο ημερολόγιο της **λάθος** εταιρείας — και
 * οι υπηρεσίες προμηθειών δεν είχαν ποτέ κλάδο bypass σε μεταβολή (ADR-742
 * §7ter.3, zero standing privilege).
 *
 * `compose` = η παραγγελία **τροφοδοτεί κάτι μέσα στην εταιρεία του καλούντος** (πρόταση
 * επιμερισμού παραστατικού, απάντηση του πράκτορα AI). Εκεί μια ξένη PO δεν έχει θέση ούτε για
 * τον υπερδιαχειριστή, και ο καλών συχνά **δεν έχει** ρόλο (κανάλι AI) — άρα αρκεί η εταιρεία,
 * μέσω της σιωπηλής πολιτικής του SSoT (`ownedOrNull`, ADR-742 §3).
 *
 * @module services/procurement/po-tenant-scope
 * @see lib/auth/resource-ownership-guard — η μία απόφαση «ανήκει;»
 * @see ADR-742 §7.1, §7ter.3 · ADR-923 (κύμα 3, Λ5)
 */

import { createOwnershipDecision, type ResourceAccessCaller } from '@/lib/auth/resource-ownership-guard';
import { ownedOrNull } from '@/lib/auth/tenant-ownership';
import { PurchaseOrderNotFoundError } from '@/subapps/procurement/services/procurement-rule-error';
import type { PurchaseOrder } from '@/types/procurement';
import { createModuleLogger } from '@/lib/telemetry';
import { getPurchaseOrder } from './procurement-repository';

const logger = createModuleLogger('PurchaseOrderTenantScope');

/** Ίδια ετικέτα/πεδίο log με τον παλιό φύλακα του route, ώστε τα ερωτήματα παρατηρησιμότητας να μη σπάσουν. */
const PO_RESOURCE_LABEL = 'PurchaseOrder';
const decidePurchaseOrderAccess = createOwnershipDecision(PO_RESOURCE_LABEL, 'poId');

interface POAccessBase {
  readonly poId: string;
  /** Για τα logs: ποιο μονοπάτι ρώτησε (`'view'`, `'approve'`, `'pdf'` …). */
  readonly action: string;
}

/** Πράξη **χρήστη** πάνω στην παραγγελία — η πρόθεση καθορίζει αν περνά ο bypass ρόλος. */
interface POUserAccessQuery extends POAccessBase {
  /** Κάθε `AuthContext` το ικανοποιεί. */
  readonly caller: ResourceAccessCaller;
  readonly intent: 'read' | 'write';
}

/** Η παραγγελία τροφοδοτεί κάτι **μέσα** στην εταιρεία του καλούντος — μόνο η εταιρεία μετρά. */
interface POComposeQuery extends POAccessBase {
  readonly caller: { readonly companyId: string };
  readonly intent: 'compose';
}

type POAccessQuery = POUserAccessQuery | POComposeQuery;

/** Η απόφαση για παραγγελία που **υπάρχει** — ένα σημείο, για όλες τις προθέσεις. */
function admits(po: PurchaseOrder, query: POAccessQuery): boolean {
  const { poId, action } = query;
  if (query.intent === 'compose') {
    return ownedOrNull(po, query.caller.companyId, { resource: PO_RESOURCE_LABEL, resourceId: poId, path: action }) !== null;
  }
  const verdict = decidePurchaseOrderAccess({ data: po, caller: query.caller, resourceId: poId, action });
  if (verdict === 'owned') return true;
  if (verdict === 'cross-tenant-bypass' && query.intent === 'read') return true;
  if (verdict === 'cross-tenant-bypass') {
    // Η απόφαση μόλις έγραψε info «Cross-tenant access» — μόνο του διαβάζεται ως «πέρασε». Δεν πέρασε.
    logger.warn('Cross-tenant purchase order WRITE denied for bypass role', {
      action, poId, uid: query.caller.uid ?? null, callerCompanyId: query.caller.companyId,
    });
  }
  return false;
}

/**
 * Διαγραμμένη PO (`isDeleted`) **δεν υπάρχει** για τον χρήστη — ούτε για ανάγνωση ούτε για πράξη
 * (Λ5β Μ6: πριν, έγκριση/ακύρωση/email/σύνδεσμος δούλευαν πάνω σε σβησμένη παραγγελία). Μόνο το
 * `compose` τη βλέπει: ο καταναλωτής του αποφασίζει μόνος (το `cost-allocations` ονομάζει με τον αριθμό
 * της μια ήδη αποθηκευμένη γραμμή επιμερισμού· την πρόταση και ο πράκτορας AI την αρνούνται ρητά).
 */
function isGoneFor(po: PurchaseOrder, query: POAccessQuery): boolean {
  return po.isDeleted === true && query.intent !== 'compose';
}

/**
 * Η παραγγελία **αν ο καλών δικαιούται** να την αγγίξει — αλλιώς `null`, για τρεις
 * αιτίες («δεν υπάρχει», «σβήστηκε», «δεν είναι δική σου») με **μία** απάντηση.
 */
export async function findOwnedPO(query: POAccessQuery): Promise<PurchaseOrder | null> {
  const po = await getPurchaseOrder(query.poId);
  if (!po || isGoneFor(po, query)) return null;
  return admits(po, query) ? po : null;
}

/**
 * Όπως η {@link findOwnedPO}, αλλά ρίχνει {@link PurchaseOrderNotFoundError} — το
 * **ίδιο** σφάλμα με τη γνήσια απουσία, ώστε το σύνορο HTTP να απαντά 404 χωρίς
 * να μπορεί να τα ξεχωρίσει.
 */
export async function requireOwnedPO(query: POAccessQuery): Promise<PurchaseOrder> {
  const po = await findOwnedPO(query);
  if (!po) throw new PurchaseOrderNotFoundError();
  return po;
}
