/**
 * «Ανήκει ΑΥΤΗ η συνομιλία;» — η ερώτηση και η **μία** απάντηση του πεδίου ορισμού
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΥΠΗΡΧΕ ΠΡΙΝ (μετρημένο 2026-08-01, ADR-742 §7decies)
 * ─────────────────────────────────────────────────────────────────────────────
 * Δύο σημεία, **ίδιο** σχήμα σύρματος, μηδέν μεταμφίεση:
 *
 * | Σημείο | γνήσιο «λείπει» | ξένο |
 * |---|---|---|
 * | `[conversationId]/messages:178` | `404 'Conversation {id} not found'` | **`403 'Unauthorized: You can only access conversations from your company'`** |
 * | `[conversationId]/send:250` | `404 'Conversation {id} not found'` | **`403 'Unauthorized: You can only send messages to conversations from your company'`** |
 *
 * 🔴 Το δεύτερο μήνυμα **περιγράφει τον λόγο της άρνησης**: λέει στον καλούντα
 * ότι η συνομιλία **υπάρχει** και ανήκει σε άλλη εταιρεία. Είναι το ίδιο
 * μαντείο με το `'Project not found or access denied'` του §7octies.4 — απλώς
 * πιο ευγενικό.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΤΟ ΕΡΓΟΣΤΑΣΙΟ ΔΕΧΕΤΑΙ `conversationId` — ΕΝΩ ΤΩΝ ΑΛΛΩΝ ΠΟΡΩΝ ΟΧΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο **γνήσιος** κλάδος αυτών των διαδρομών γράφει το id **μέσα** στο μήνυμα:
 * `` `Conversation ${conversationId} not found` ``. Μεταμφίεση με σκέτο
 * `'Conversation not found'` θα ξεχώριζε από το γνήσιο **στο ίδιο το κείμενο**,
 * δηλαδή θα μαρτυρούσε ακριβώς αυτό που υποτίθεται ότι κρύβει.
 *
 * ⚠️ Το id **δεν** είναι διαρροή: ο καλών το έγραψε ο ίδιος στη διαδρομή. Είναι
 * η ίδια διάκριση με το `requireTenantScope` (§7septies.3) — άρνηση
 * **παραμέτρου** δεν αποκαλύπτει τίποτα που δεν ήξερε ήδη ο ερωτών. Ό,τι
 * κρύβεται είναι **αν υπάρχει**, όχι **τι ρωτήθηκε**.
 *
 * ⇒ Το εργοστάσιο παίρνει το id ώστε τα **δύο** «όχι» να παράγονται από την
 * **ίδια** έκφραση· δεν υπάρχει τρόπος να αποκλίνουν χωρίς να αλλάξει αυτό το
 * αρχείο (ADR-742 §7.1).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΔΗΛΩΜΕΝΗ ΔΙΕΥΡΥΝΣΗ: Ο ΥΠΕΡΓΡΑΦΕΑΣ ΑΠΟΚΤΑ ΠΡΟΣΒΑΣΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Κανένα από τα δύο σημεία δεν είχε κλάδο bypass. Η ενοποίηση γίνεται **με**
 * bypass, για ευθυγράμμιση με το υπάρχον δόγμα (ADR-232 · §7septies · §7octies.3),
 * και παραμένει **γνωστό χρέος**: το *standing* cross-tenant προνόμιο είναι το
 * anti-pattern· η μετάβαση σε JIT αλλάζει **μία** συνάρτηση.
 *
 * @module app/api/conversations/_shared/conversation-ownership
 * @see @/lib/auth/resource-ownership-guard — η απόφαση (μην την ξαναγράψεις)
 * @see ../../messages/_shared/message-ownership — ο αδελφός πόρος (§7decies)
 * @see ADR-742 §3.3 · §3.4 · §7.1 · §7decies
 */

import { ApiError } from '@/lib/api/api-error-types';
import type { MaybeTenantOwned } from '@/lib/auth/tenant-ownership';
import {
  createOwnershipDecision,
  type ResourceAccessCaller,
  type ResourceAccessVerdict,
} from '@/lib/auth/resource-ownership-guard';

/**
 * ⚠️ **Μην ξαναγράψεις εδώ τη λογική** (bypass → owned → denied): ζει στο
 * `lib/auth/resource-ownership-guard.ts` (§7octies.2γ).
 */
const decide = createOwnershipDecision('Conversation', 'conversationId');

/**
 * Το κείμενο του «δεν βρέθηκε» — **SSoT**, με το id **μέσα** του επειδή έτσι το
 * έγραφε ο γνήσιος κλάδος και των δύο διαδρομών.
 */
export function conversationNotFoundMessage(conversationId: string): string {
  return `Conversation ${conversationId} not found`;
}

/**
 * Εργοστάσιο «δεν βρέθηκε» — **ένα** για τους δύο κλάδους (γνήσια απουσία και
 * άρνηση ιδιοκτησίας).
 */
export function conversationNotFound(conversationId: string): ApiError {
  return new ApiError(404, conversationNotFoundMessage(conversationId));
}

/** Κάθε `AuthContext` το ικανοποιεί. */
export type ConversationAccessCaller = ResourceAccessCaller;

export interface ConversationAccessSpec {
  /** Το φορτίο **όπως βγήκε από τη βάση**. Ποτέ `as Conversation` — βλ. §7.5. */
  readonly conversationData: MaybeTenantOwned | null | undefined;
  readonly caller: ConversationAccessCaller;
  readonly conversationId: string;
  /** Ποιο μονοπάτι ρώτησε, π.χ. `'list-messages'`, `'send'`. */
  readonly action: string;
}

/** **Τρεις ονομασμένες καταστάσεις, όχι boolean** (§3.2). */
export type ConversationAccessVerdict = ResourceAccessVerdict;

/** **Η απόφαση (PDP)** — ολική, χωρίς ρίψη (§7ter.4). */
export function checkConversationAccess(
  spec: ConversationAccessSpec,
): ConversationAccessVerdict {
  return decide({
    data: spec.conversationData,
    caller: spec.caller,
    resourceId: spec.conversationId,
    action: spec.action,
  });
}

/**
 * **Η επιβολή (PEP)** — ρίχνει το μεταμφιεσμένο «δεν βρέθηκε», παραγμένο από
 * τον **ίδιο** constructor με τα **ίδια** ορίσματα που δίνει ο γνήσιος κλάδος.
 */
export function requireConversationAccess(spec: ConversationAccessSpec): void {
  if (checkConversationAccess(spec) === 'denied') {
    throw conversationNotFound(spec.conversationId);
  }
}
