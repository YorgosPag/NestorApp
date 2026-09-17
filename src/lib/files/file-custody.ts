/**
 * 🗂️ **ΣΕ ΠΟΙΟ ΔΙΑΜΕΡΙΣΜΑ ΖΕΙ ΕΝΑ ΑΡΧΕΙΟ** — ADR-866 §5.2 · §2.6.8
 *
 * Το «σε ποιον ανήκει» **δεν** ζει εδώ: η ένωση `{ companyId } | { userId }`, το σύνορο ανάγνωσης
 * και ο φρουρός γραφής είναι **κοινά** με το ιστορικό, στο `lib/workspace/custody-scope.ts`.
 * Εδώ μένει **μόνο** ό,τι είναι των αρχείων: **πού** ζει κάθε διαμέρισμα.
 *
 * 🔴 **ΓΡΑΨΕ `FILE_COLLECTION[kind]` ΣΤΟ ΣΗΜΕΙΟ ΚΛΗΣΗΣ — ΟΧΙ ΣΥΝΑΡΤΗΣΗ-ΠΕΡΙΤΥΛΙΓΜΑ.** Οι πύλες
 * 3.15 (δείκτες) · 3.35 (μισθωτής) · 3.87 (CDE) διαβάζουν το `X[kind]` κάθε διαμερίσματος με
 * `satisfies CustodyPartition` και ελέγχουν **έναν κλάδο ανά κάτοχο** (2β.1). Ένα
 * `fileCollectionOf(kind)` θα τις ξανάκανε **τυφλές**: ελλείπων δείκτης `files_personal` = πράσινο
 * στην πύλη, `FAILED_PRECONDITION` στην παραγωγή.
 *
 * 🔑 **Το είδος το ΑΠΟΔΕΙΚΝΥΕΙ το έγγραφο, δεν το μαντεύει η οθόνη** ({@link fileCustodyKindOf}):
 * πράξη πάνω σε υπάρχον αρχείο (κάδος, μετονομασία, σύνδεση) παίρνει το διαμέρισμα από τα **δικά
 * του** πεδία κατόχου. ⛔ **Ποτέ** «δοκίμασε και τις δύο συλλογές» (§2.6.8 Γ).
 *
 * **Layering**: leaf — κανένα `server-only`, καμία ανάγνωση. Το εισάγουν διακομιστής και πελάτης.
 *
 * @module lib/files/file-custody
 * @see lib/audit/audit-ledger — το ίδιο ιδίωμα για το ιστορικό
 * @see services/iso19650/container-custody — ⚠️ ΑΛΛΟ «custody»: σφράγιση δοχείου CDE, όχι κάτοχος
 */

import {
  custodyKindOfScope,
  custodyScopeFromData,
  type CustodyKind,
  type CustodyPartition,
  type CustodyScope,
} from '@/lib/workspace/custody-scope';

/** Ο κάτοχος ενός αρχείου — **ακριβώς ένας**: εταιρεία `{ companyId }` ή άνθρωπος `{ userId }`. */
export type FileCustody = CustodyScope;

/**
 * **Πού ζει κάθε διαμέρισμα αρχείων** — η **μία** δήλωση. Γέννηση, λίστα, κάδος και εκκαθάριση
 * ρωτούν **εδώ**· κανείς δεν διαλέγει συλλογή αρχείων με το χέρι.
 */
export const FILE_COLLECTION = {
  company: 'FILES',
  personal: 'FILES_PERSONAL',
} as const satisfies CustodyPartition;

/** Τα πεδία κατόχου όπως τα φέρει είσοδος ή έγγραφο — τιμές **αδιάβαστες** ως να κριθούν. */
interface FileOwnerFields {
  readonly companyId?: unknown;
  readonly userId?: unknown;
}

/**
 * **Ο κάτοχος για γέννηση αρχείου — ακριβώς ένας, αλλιώς σφάλμα.**
 *
 * 🔴 Ο τύπος εγγυάται **σχήμα**, όχι **τιμή**: `{ userId: '' }` μεταγλωττίζεται και θα γεννούσε
 * αρχείο που **κανείς** δεν διαβάζει. Επιστρέφει **μόνο** το πεδίο κατόχου (ποτέ τα υπόλοιπα της
 * εισόδου), ώστε να απλώνεται με ασφάλεια σε διαδρομή Storage και εγγραφή.
 */
export function requireFileCustody(owner: FileOwnerFields): FileCustody {
  const custody = custodyScopeFromData({ companyId: owner.companyId, userId: owner.userId });
  if (custody === null) {
    throw new Error('Exactly one owner (companyId XOR userId) is REQUIRED for a FileRecord');
  }
  return custody;
}

/**
 * **Εταιρικός κάτοχος αναγνώστη που ίσως δεν έχει φορτώσει ακόμη εταιρεία** — `undefined` όταν λείπει.
 *
 * ⚠️ **Μόνο για ΑΝΑΓΝΩΣΤΕΣ**: απουσία κατόχου σε αναγνώστη σημαίνει «εταιρικό διαμέρισμα με το
 * φίλτρο μισθωτή της υπηρεσίας» (ADR-866 §2.6.8 Β5). Ένας **γραφέας** δεν δέχεται ποτέ απουσία —
 * ζητά {@link requireFileCustody}. ΕΝΑ σημείο αντί για τον ίδιο τριαδικό τελεστή σε κάθε καλούντα.
 */
export function companyReadCustodyOf(companyId: string | null | undefined): FileCustody | undefined {
  return companyId ? { companyId } : undefined;
}

/**
 * **Κλειδί ταυτότητας κατόχου** για κρυφές μνήμες/λίστες — `company:<id>` ή `personal:<uid>`.
 *
 * 🔴 Το σκέτο id **δεν** αρκεί: η κρυφή μνήμη του κάδου ενός χρήστη και μιας εταιρείας δεν
 * επιτρέπεται ποτέ να συγκρουστούν, ακόμη κι αν δύο ids έτυχε να συμπίπτουν.
 */
export function fileCustodyKey(custody: FileCustody): string {
  return custody.userId !== undefined ? `personal:${custody.userId}` : `company:${custody.companyId}`;
}

/**
 * **Σε ποιο διαμέρισμα ανήκει αυτό το αποθηκευμένο αρχείο;** — από τα **δικά του** πεδία.
 *
 * 🔴 `null` όταν δεν έχει **ακριβώς έναν** κάτοχο: ο καλών **αρνείται** την πράξη — δεν διαλέγει
 * διαμέρισμα στην τύχη.
 */
export function fileCustodyKindOf(record: FileOwnerFields): CustodyKind | null {
  const scope = custodyScopeFromData({ companyId: record.companyId, userId: record.userId });
  return scope === null ? null : custodyKindOfScope(scope);
}

/**
 * **Το ΚΟΙΝΟ διαμέρισμα πολλών αρχείων** — για πράξη που στέλνει **ένα** αίτημα (π.χ. ZIP).
 *
 * 🔴 `null` όταν η λίστα είναι κενή, όταν κάποιο αρχείο δεν έχει ακριβώς έναν κάτοχο, **ή** όταν
 * ανακατεύονται διαμερίσματα: ο καλών **αρνείται** — ποτέ «το είδος του πρώτου» (ADR-866 §2.6.9 Β9).
 */
export function sharedFileCustodyKindOf(records: readonly FileOwnerFields[]): CustodyKind | null {
  const kinds = new Set(records.map(fileCustodyKindOf));
  const [only] = kinds;
  return kinds.size === 1 ? (only ?? null) : null;
}

/**
 * **Η παράμετρος σύρματος του διαμερίσματος** — `?custody=company|personal` (ADR-866 §2.6.9 Β1).
 *
 * 🔑 Ταξιδεύει **μόνο το είδος**, ποτέ ο `userId`: τον κάτοχο τον βάζει ο διακομιστής από τη **δική
 * του** ταυτότητα. Ο διακομιστής τη διαβάζει με `custodyKindFromParam` (απουσία ⇒ εταιρεία,
 * άγνωστη τιμή ⇒ άρνηση) — ίδιο ιδίωμα με το `?ledger=` του ιστορικού.
 */
export const FILE_CUSTODY_PARAM = 'custody';
