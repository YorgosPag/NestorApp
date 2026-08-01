/**
 * Τα σχόλια μιας προσφοράς — **πού ζουν** και **ποιος τα φτάνει**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ (ADR-742 §7undecies · N.18 · CHECK 3.28)
 * ─────────────────────────────────────────────────────────────────────────────
 * Οι δύο διαδρομές σχολίων (`comments/` και `comments/[commentId]/`) έγραφαν η
 * καθεμιά **μόνη της** τη διαδρομή της υποσυλλογής:
 *
 * ```ts
 * db.collection(COLLECTIONS.QUOTES).doc(quoteId)
 *   .collection(SUBCOLLECTIONS.QUOTE_COMMENTS)
 * ```
 *
 * — τρεις φορές συνολικά, και το `jscpd` χτύπησε στο **προοίμιο imports** τους
 * τη στιγμή που η Ομάδα 6 άγγιξε και τα δύο (μάθημα #3: *η κεντρικοποίηση
 * γεννάει τον κλώνο*). Η σωστή απάντηση σε χτύπημα προοιμίου είναι **πραγματική
 * μείωση ευθύνης**, όχι χαλάρωση του gate.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΙ ΥΠΗΡΧΕ ΔΕΥΤΕΡΟ, ΒΑΡΥΤΕΡΟ ΕΥΡΗΜΑ: **ΔΥΟ ΔΟΓΜΑΤΑ**
 * ─────────────────────────────────────────────────────────────────────────────
 * | διαδρομή | τι ρωτούσε |
 * |---|---|
 * | `comments/` (GET, POST) | ανήκει **η προσφορά** στον καλούντα; |
 * | `comments/[commentId]/` (PATCH, DELETE) | ανήκει **το σχόλιο**; |
 *
 * Το δεύτερο **δεν είναι το πρώτο**: ένα σχόλιο με σωστό `companyId` κάτω από
 * **ξένη** προσφορά περνούσε — και ο καλών μάθαινε ότι η προσφορά υπάρχει. Η
 * ερώτηση «ανήκει ο **γονέας**;» είναι πλέον **η ίδια** και για τις τέσσερις
 * μεθόδους, γραμμένη εδώ μία φορά.
 *
 * @module app/api/quotes/_shared/quote-comments
 * @see ./quote-ownership — η δήλωση του πόρου + το «δεν βρέθηκε»
 * @see ADR-742 §7.1, §7septies (ομοιομορφία ανά πόρο), §7undecies
 */

import 'server-only';

import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { NextResponse } from 'next/server';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import type { ResourceAccessCaller } from '@/lib/auth/resource-ownership-guard';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { quoteNotFoundResponse, quoteResource } from './quote-ownership';

/**
 * Η **μία** γνώση «πού ζουν τα σχόλια μιας προσφοράς».
 *
 * Γραμμένη τρεις φορές πριν· μια αλλαγή σχήματος αποθήκευσης έπρεπε να τις βρει
 * και τις τρεις.
 */
export function quoteCommentsCollection(
  quoteId: string,
  db?: Firestore,
): FirebaseFirestore.CollectionReference {
  return (db ?? getAdminFirestore())
    .collection(COLLECTIONS.QUOTES)
    .doc(quoteId)
    .collection(SUBCOLLECTIONS.QUOTE_COMMENTS);
}

/**
 * Η **μία** πύλη και των τεσσάρων μεθόδων: υπάρχει η προσφορά **και** είναι δική
 * μου;
 *
 * 🔄 ADR-742 §7undecies — ήταν `verifyQuoteOwnership()` με σκέτο `=== companyId`
 * πάνω σε `as { companyId?: string }`: **ο τύπος υπόσχεται, η βάση δεν εγγυάται**
 * (μάθημα #8). Προσφορά με κενό `companyId` και καλών με χαλασμένο token
 * «ταίριαζαν» — το κενό δεν είναι tenant, είναι **απουσία** tenant (§4).
 *
 * Το σύρμα **δεν αλλάζει**: `404 { error: 'Not found' }` και για τις δύο αιτίες,
 * όπως και πριν.
 *
 * @returns `null` όταν επιτρέπεται, αλλιώς η απάντηση που πρέπει να φύγει
 */
export async function refuseUnlessOwnedQuote(
  quoteId: string,
  caller: ResourceAccessCaller,
  action: string,
): Promise<NextResponse | null> {
  const owned = await quoteResource.load({
    docId: quoteId,
    caller,
    action,
    refusal: quoteNotFoundResponse,
  });

  return owned.refusal ?? null;
}

/** Το σχόλιο **όπως βγήκε από τη βάση** — ο τύπος υπόσχεται, η βάση δεν εγγυάται (§7.5). */
export interface StoredComment {
  companyId: string;
  authorId: string;
  deletedAt: null | { seconds: number };
}

export type OwnedCommentOutcome =
  | {
      readonly comment: {
        readonly ref: FirebaseFirestore.DocumentReference;
        readonly data: StoredComment;
      };
      readonly refusal?: undefined;
    }
  | { readonly comment?: undefined; readonly refusal: NextResponse };

/**
 * «Το σχόλιο — αν το φτάνω»: **τρία** «όχι» με **μία** απάντηση.
 *
 * 🔴 **Ο έλεγχος του ΓΟΝΕΑ έλειπε** (ADR-742 §7undecies). Το παλιό
 * `resolveComment` ρωτούσε **μόνο** «ανήκει το σχόλιο στην εταιρεία μου;» — όχι
 * «ανήκει **η προσφορά**;». Οι αδελφικές διαδρομές (`comments/` GET+POST)
 * ρωτούσαν το αντίθετο. **Δύο δόγματα για τον ίδιο πόρο**, ακριβώς το σχήμα που
 * κλείνει η §7septies.
 *
 * Η σειρά είναι το συμβόλαιο:
 *
 * 1. **προσφορά δική μου;** — αλλιώς ο καλών δεν δικαιούται να μάθει τίποτα,
 *    ούτε καν ότι υπάρχει σχόλιο
 * 2. **υπάρχει το σχόλιο;**
 * 3. **ανήκει το σχόλιο;** — με {@link isPayloadOwnedByCompany}, όχι σκέτο
 *    `!==` πάνω σε `as` (§4, μάθημα #8)
 *
 * Και τα τρία «όχι» βγαίνουν από το **ίδιο** {@link quoteNotFoundResponse}: το
 * σύρμα (`404 { error: 'Not found' }`) **δεν αλλάζει**.
 */
export async function loadOwnedComment(spec: {
  readonly quoteId: string;
  readonly commentId: string;
  readonly caller: ResourceAccessCaller;
  readonly action: string;
}): Promise<OwnedCommentOutcome> {
  const { quoteId, commentId, caller, action } = spec;

  const parentRefusal = await refuseUnlessOwnedQuote(quoteId, caller, action);
  if (parentRefusal) return { refusal: parentRefusal };

  const ref = quoteCommentsCollection(quoteId).doc(commentId);
  const snap = await ref.get();
  if (!snap.exists) return { refusal: quoteNotFoundResponse() };

  const data = snap.data() as StoredComment;
  if (!isPayloadOwnedByCompany(data, caller.companyId)) {
    return { refusal: quoteNotFoundResponse() };
  }

  return { comment: { ref, data } };
}

// ============================================================================
// ΟΙ ΠΡΑΞΕΙΣ — «πώς γράφεται ένα σχόλιο» ανήκει στον πόρο, όχι στη διαδρομή
// ============================================================================
//
// Τρεις **ρητές** συναρτήσεις αντί για μία με σημαία: η διαφορά ήπιας και
// οριστικής διαγραφής είναι απόφαση πολιτικής (ποιος επιτρέπεται να σβήσει τι)
// και οφείλει να διαβάζεται στο σημείο κλήσης, όχι να κρύβεται πίσω από
// `{ hard: true }`.

/** Επεξεργασία κειμένου — σφραγίζει `editedAt`, ώστε το UI να δείχνει «επεξεργάστηκε». */
export function editComment(
  ref: FirebaseFirestore.DocumentReference,
  text: string,
): Promise<FirebaseFirestore.WriteResult> {
  return ref.update({ text, editedAt: FieldValue.serverTimestamp() });
}

/** Ήπια διαγραφή — το σχόλιο μένει, τα φίλτρα λίστας το κρύβουν (`deletedAt !== null`). */
export function softDeleteComment(
  ref: FirebaseFirestore.DocumentReference,
): Promise<FirebaseFirestore.WriteResult> {
  return ref.update({ deletedAt: FieldValue.serverTimestamp() });
}

/** Οριστική διαγραφή — μόνο για bypass ρόλο σε ξένο σχόλιο. */
export function purgeComment(
  ref: FirebaseFirestore.DocumentReference,
): Promise<FirebaseFirestore.WriteResult> {
  return ref.delete();
}
