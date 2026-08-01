/**
 * «Ανήκει ΑΥΤΟ το μήνυμα;» — η ερώτηση και η **μία** απάντηση του πεδίου ορισμού
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΥΠΗΡΧΕ ΠΡΙΝ (μετρημένο 2026-08-01, ADR-742 §7decies)
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο πόρος `message` είχε **πέντε** σημεία απόφασης σε **τέσσερα** αρχεία, όλα
 * με τη **γυμνή** σύγκριση `messageData?.companyId !== ctx.companyId` — καμία
 * μεταμφίεση, ούτε καν μισογραμμένη:
 *
 * | Σημείο | γνήσιο «λείπει» | ξένο |
 * |---|---|---|
 * | `edit/route.ts:103` | `404 'Message not found'` | **`403 'Access denied'`** |
 * | `pin/route.ts:104` | `404 'Message not found'` | **`403 'Access denied'`** |
 * | `[messageId]/reactions:190` (POST) | `404 'Message not found'` | **`403 'Access denied'`** |
 * | `[messageId]/reactions:328` (GET) | `404 'Message not found'` | **`403 'Access denied'`** |
 * | `delete/route.ts:129` | `reason: 'Message not found'` | **`reason: 'Unauthorized - message belongs to different company'`** |
 *
 * Τα τέσσερα πρώτα είναι το κλασικό μαντείο ύπαρξης: ο καλών ξεχωρίζει «δεν
 * υπάρχει» από «δεν είναι δικό σου» και **μαθαίνει ότι το id υπάρχει**. Το
 * πέμπτο το λέει **αυτολεξεί** στο σώμα της απάντησης.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΜΑΖΙΚΟ `delete` ΕΙΝΑΙ ΙΔΙΟΜΟΡΦΟ — ΚΑΙ Η ΜΕΤΑΜΦΙΕΣΗ ΑΚΟΛΟΥΘΕΙ **ΕΚΕΙΝΟ**
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `POST /api/messages/delete` απαντά **200** με `{ deleted, failed, errors[] }`:
 * το «όχι» εκεί είναι **στοιχείο πίνακα**, όχι σφάλμα HTTP. Μετατροπή του σε
 * `404` θα άλλαζε το συμβόλαιο του μαζικού endpoint — και θα σταματούσε τη
 * διαγραφή **των υπόλοιπων** μηνυμάτων της παρτίδας.
 *
 * ⇒ Γι' αυτό ο πόρος εκθέτει **και** τη σκέτη ετυμηγορία
 * ({@link checkMessageAccess}) πέρα από την επιβολή ({@link requireMessageAccess}):
 * PDP και PEP είναι χωριστά (§7ter.4) ακριβώς για να μπορεί μια διαδρομή να
 * επιβάλει την **ίδια** απόφαση με **δικό της** σχήμα σύρματος. Το κείμενο
 * παραμένει το ίδιο ({@link MESSAGE_NOT_FOUND_MESSAGE}), οπότε το ξένο μήνυμα
 * γίνεται δυσδιάκριτο από το ανύπαρκτο **μέσα στο σχήμα που ήδη υπάρχει**.
 *
 * ⚠️ Το ίχνος ελέγχου **κρατά την αλήθεια**: η διαδρομή διαγραφής συνεχίζει να
 * καταγράφει `warn` με τον πραγματικό λόγο. Η μεταμφίεση αφορά **μόνο** το
 * σύρμα (§3.4).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΔΗΛΩΜΕΝΗ ΔΙΕΥΡΥΝΣΗ: Ο ΥΠΕΡΓΡΑΦΕΑΣ ΑΠΟΚΤΑ ΠΡΟΣΒΑΣΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Κανένα από τα πέντε σημεία δεν είχε κλάδο bypass. Η ενοποίηση γίνεται **με**
 * bypass — ευθυγράμμιση με `requireDocInTenant` (§7septies, έξι οντότητες),
 * `checkProjectAccess`, `checkContactAccess` και `softDelete`. Η εναλλακτική θα
 * έκανε τα μηνύματα τη **μοναδική** εξαίρεση στο δόγμα ADR-232.
 *
 * 🔴 Παραμένει **γνωστό χρέος, όχι λύση** (§7ter.3 · §7octies.3): η βιομηχανία
 * είναι ομόφωνη ότι το *standing* cross-tenant προνόμιο **είναι** το
 * anti-pattern (Google zero standing privilege + Access Approval· Atlassian
 * TCS· *«never grant standing cross-tenant access»*). Ο κώδικας εδώ **δεν**
 * υλοποιεί JIT — το καθιστά **εφικτό**: η bypass απόφαση είναι **ονομασμένη
 * κατάσταση** σε **ένα** σημείο.
 *
 * @module app/api/messages/_shared/message-ownership
 * @see @/lib/auth/resource-ownership-guard — η απόφαση (μην την ξαναγράψεις)
 * @see ../../contacts/_shared/contact-ownership — το πρότυπο (§7octies)
 * @see ADR-742 §3.3 (κανόνας αποκάλυψης) · §3.4 · §7ter.5 · §7decies
 */

import { ApiError } from '@/lib/api/api-error-types';
import type { MaybeTenantOwned } from '@/lib/auth/tenant-ownership';
import {
  createOwnershipDecision,
  type ResourceAccessCaller,
  type ResourceAccessVerdict,
} from '@/lib/auth/resource-ownership-guard';

/**
 * Η διαδικασία απόφασης, δεμένη στο λεξιλόγιο των μηνυμάτων.
 *
 * ⚠️ **Μην ξαναγράψεις εδώ τη λογική** (bypass → owned → denied): ζει στο
 * `lib/auth/resource-ownership-guard.ts`. Τρία αντίγραφά της υπήρξαν και το
 * `jscpd` τα βρήκε **καθαρά**, επειδή τα ονόματα διέφεραν (§7octies.2γ).
 */
const decide = createOwnershipDecision('Message', 'messageId');

/**
 * Το κείμενο του «δεν βρέθηκε» — **SSoT**.
 *
 * ⚠️ Είναι **ακριβώς** η τιμή που έγραφε ο γνήσιος κλάδος και των πέντε σημείων
 * (`404 'Message not found'` στα τέσσερα, `reason: 'Message not found'` στο
 * μαζικό). Το σύρμα του γνήσιου «δεν βρέθηκε» **δεν αλλάζει** — αλλιώς το ίδιο
 * το κείμενο γίνεται μαντείο.
 */
export const MESSAGE_NOT_FOUND_MESSAGE = 'Message not found';

/**
 * Εργοστάσιο «δεν βρέθηκε».
 *
 * Μηδέν ορίσματα **επίτηδες**: δεν υπάρχει τιμή που θα μπορούσε να διαφέρει
 * ανάμεσα στον γνήσιο κλάδο (`!doc.exists`) και στην άρνηση ιδιοκτησίας, άρα
 * δεν υπάρχει τρόπος να αποκλίνουν χωρίς να αλλάξει **αυτό** το αρχείο
 * (ADR-742 §7.1).
 */
export function messageNotFound(): ApiError {
  return new ApiError(404, MESSAGE_NOT_FOUND_MESSAGE);
}

/** Κάθε `AuthContext` το ικανοποιεί — δηλώνεται δομικά ώστε το module να μένει καθαρό. */
export type MessageAccessCaller = ResourceAccessCaller;

export interface MessageAccessSpec {
  /** Το φορτίο **όπως βγήκε από τη βάση**. Ποτέ `as Message` — βλ. §7.5. */
  readonly messageData: MaybeTenantOwned | null | undefined;
  readonly caller: MessageAccessCaller;
  readonly messageId: string;
  /** Ποιο μονοπάτι ρώτησε, π.χ. `'edit'`, `'pin'`, `'reactions'`, `'bulk-delete'`. */
  readonly action: string;
}

/**
 * **Τρεις ονομασμένες καταστάσεις, όχι boolean** — μια boolean σε κλήση
 * ασφαλείας είναι αυτό που ρυθμίζεται λάθος στο review (§3.2). Η μεσαία είναι
 * το σημείο εισόδου του μελλοντικού JIT.
 */
export type MessageAccessVerdict = ResourceAccessVerdict;

/**
 * **Η απόφαση (PDP)** — ολική, **χωρίς ρίψη**, ώστε κάθε διαδρομή να την
 * επιβάλλει με το δικό της σχήμα σύρματος (PEP· §7ter.4).
 *
 * Το μαζικό `delete` είναι ο λόγος που αυτή η μορφή είναι **δημόσια**: εκεί η
 * άρνηση δεν είναι σφάλμα HTTP αλλά στοιχείο πίνακα.
 */
export function checkMessageAccess(spec: MessageAccessSpec): MessageAccessVerdict {
  return decide({
    data: spec.messageData,
    caller: spec.caller,
    resourceId: spec.messageId,
    action: spec.action,
  });
}

/**
 * **Η επιβολή (PEP)** για τις διαδρομές που ρίχνουν — το μεταμφιεσμένο «δεν
 * βρέθηκε» παράγεται από τον **ίδιο constructor με τα ίδια ορίσματα** που
 * χρησιμοποιεί ο γνήσιος κλάδος.
 */
export function requireMessageAccess(spec: MessageAccessSpec): void {
  if (checkMessageAccess(spec) === 'denied') {
    throw messageNotFound();
  }
}
