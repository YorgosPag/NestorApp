/**
 * =============================================================================
 * SSoT: **ΠΟΙΑ ΕΓΓΡΑΦΗ ΖΗΤΗΣΕ Η ΔΙΕΥΘΥΝΣΗ, ΚΑΙ ΤΙ ΒΡΗΚΑΜΕ** — ADR-777 §8.31
 * =============================================================================
 *
 * Καθαρή συνάρτηση, **καμία σιωπηλή κατάσταση**. Απαντά το ερώτημα που το
 * `useEntityPageState` (ADR-203) απαντούσε με μια `useEffect` και **τρεις**
 * σιωπηλές αστοχίες.
 *
 * ## Γιατί υπάρχει — το ελάττωμα που θεραπεύει
 *
 * Το `useEntityPageState` επέλεγε εγγραφή από τη διεύθυνση έτσι:
 *
 * ```
 * if (!items.length) return;                      // (1)
 * const found = items.find(i => i.id === idFromUrl);
 * if (found) { select(found); return; }
 * if (autoSelectFirstItem && !selected) select(items[0]);   // (2)
 * ```
 *
 * | # | Τι σήμαινε | Τι έβλεπε ο άνθρωπος |
 * |---|---|---|
 * | **1** | Άδεια λίστα = **ταυτόχρονα** «δεν φόρτωσε ακόμη» **και** «δεν υπάρχει» | Το σχήμα «**0 = κανείς δεν κοίταξε**» (μάθημα Μ-Α, §8.30) |
 * | **2** | Δεν βρήκα αυτό που ζήτησες ⇒ **σου δίνω το πρώτο** | 🔴 Ζητάς το κτίριο Α, βλέπεις **με σιγουριά** το Β |
 * | **3** | Καμία εφεδρεία εκτός λίστας | Σύνδεσμος σε αρχειοθετημένη εγγραφή ⇒ **τίποτα, σιωπηλά** |
 *
 * Η **(2)** είναι η χειρότερη: δεν αποτυγχάνει, **λέει ψέματα με βεβαιότητα**.
 *
 * ## Πού ξεπερνάμε την πρακτική της αγοράς
 *
 * Η σιωπηλή αστοχία σε deep link προς αρχειοθετημένο είναι **αναγνωρισμένο**
 * ελάττωμα (`openai/codex#18216`: *«fail silently instead of resolving or
 * offering recovery»*), και η σωστή απάντηση είναι **ανάκτηση** — GitLab δείχνει
 * την εγγραφή με πανό επαναφοράς· ίδιο πρότυπο Google Drive / Outlook.
 *
 * 🏆 Και οι τρεις όμως το υλοποιούν **ανά οθόνη**. Εδώ είναι **συμβόλαιο ενός
 * κοινού εξαρτήματος**: κάθε λίστα της εφαρμογής το κληρονομεί, και **καμία** δεν
 * μπορεί να ξεχάσει τη σημαία που την προστατεύει — γιατί **δεν υπάρχει σημαία**.
 *
 * **Layering**: leaf module — καμία εξάρτηση από React, components ή services.
 *
 * @module hooks/entity-selection-state
 * @enterprise ADR-777 §8.31
 */

/** Ό,τι μπορεί να ζητηθεί από τη διεύθυνση οφείλει να έχει ταυτότητα. */
export interface SelectableEntity {
  readonly id: string;
}

/**
 * **Οι πέντε καταστάσεις. Καμία άλλη, και καμία σιωπηλή.**
 *
 * ⚠️ Το `not-found` **δεν ξεχωρίζει** «διαγράφηκε» από «ανήκει σε άλλη εταιρεία»
 * — ίδιο συμβόλαιο με το §8.30. Η διάκριση θα επέτρεπε σε κάποιον να **απαριθμεί
 * ξένες ταυτότητες** ρωτώντας τη μία μετά την άλλη.
 */
export type EntitySelection<T extends SelectableEntity> =
  /** Η διεύθυνση δεν ζήτησε τίποτα — ελεύθερη περιήγηση στη λίστα. */
  | { readonly kind: 'none' }
  /** Ζητήθηκε ταυτότητα· **δεν ξέρουμε ακόμη**. ΠΟΤΕ δεν δείχνεται «δεν βρέθηκε». */
  | { readonly kind: 'resolving'; readonly requestedId: string }
  /** Βρέθηκε ακριβώς αυτό που ζητήθηκε. */
  | { readonly kind: 'selected'; readonly item: T }
  /** Βρέθηκε, αλλά είναι στον κάδο ⇒ δείξ' το **με πανό επαναφοράς**, όχι κενό. */
  | { readonly kind: 'archived'; readonly item: T }
  /** Ρωτήθηκαν **όλες** οι πηγές και απάντησαν. Δεν υπάρχει. */
  | { readonly kind: 'not-found'; readonly requestedId: string };

/**
 * Η κατάσταση της **εφεδρικής** αναζήτησης (για ταυτότητα εκτός φορτωμένης λίστας).
 *
 * - `unavailable` — δεν έχει ρυθμιστεί εφεδρεία· δεν περιμένουμε κανέναν.
 * - `pending` — τρέχει **τώρα**· «δεν βρέθηκε» θα ήταν **πρόωρο**.
 * - `settled` — απάντησε· το `item` είναι η απάντηση (`null` = δεν υπάρχει).
 */
export type FallbackPhase = 'unavailable' | 'pending' | 'settled';

export interface EntitySelectionFallback<T extends SelectableEntity> {
  readonly phase: FallbackPhase;
  readonly item: T | null;
}

export interface EntitySelectionInput<T extends SelectableEntity> {
  /** Η ταυτότητα που ζητά η διεύθυνση (`null` = δεν ζητήθηκε καμία). */
  readonly requestedId: string | null;
  /**
   * 🔴 **Απάντησε η πηγή της λίστας;** — ΟΧΙ «σταμάτησε να φορτώνει».
   * Χωρίς αυτό, άδεια λίστα διαβάζεται ως «δεν υπάρχει» (μάθημα Μ-Α).
   */
  readonly hasAnswered: boolean;
  /** Η **ενεργή** λίστα (χωρίς τα αρχειοθετημένα). */
  readonly items: readonly T[];
  /** Τα αρχειοθετημένα, **αν** η οθόνη τα έχει ήδη φορτωμένα. */
  readonly archivedItems?: readonly T[];
  /** Η εφεδρική αναζήτηση, αν υπάρχει. */
  readonly fallback?: EntitySelectionFallback<T>;
  /**
   * Πότε μια εγγραφή θεωρείται αρχειοθετημένη **από την ίδια της τη μορφή**
   * (π.χ. `deletedAt`). Απαραίτητο για ό,τι επιστρέφει η **εφεδρεία**, που δεν
   * ξέρει σε ποια λίστα ανήκει.
   */
  readonly isArchived?: (item: T) => boolean;
}

const byId = <T extends SelectableEntity>(
  items: readonly T[] | undefined,
  id: string,
): T | undefined => items?.find((item) => item.id === id);

/**
 * Κατατάσσει μια **ευρεθείσα** εγγραφή: αρχειοθετημένη ή ενεργή.
 *
 * `archivedByOrigin` = τη βρήκαμε στη λίστα του κάδου, άρα είναι αρχειοθετημένη
 * **ανεξάρτητα** από το τι λέει το κατηγόρημα (μπορεί να μην έχει δοθεί).
 */
function classify<T extends SelectableEntity>(
  item: T,
  archivedByOrigin: boolean,
  isArchived: ((item: T) => boolean) | undefined,
): EntitySelection<T> {
  const archived = archivedByOrigin || isArchived?.(item) === true;
  return archived ? { kind: 'archived', item } : { kind: 'selected', item };
}

/**
 * **Η σειρά των ελέγχων ΕΙΝΑΙ το συμβόλαιο.**
 *
 * 1. Καμία ταυτότητα ⇒ `none` — η λίστα είναι ελεύθερη να κάνει ό,τι θέλει.
 * 2. Η πηγή **δεν απάντησε** ⇒ `resolving`. Πριν από αυτό, κάθε «δεν βρέθηκε»
 *    είναι **ψέμα** (μάθημα Μ-Α: «δεν φορτώνω» ≠ «κοίταξα»).
 * 3. Ενεργή λίστα · 4. Κάδος · 5. Εφεδρεία **εν εξελίξει** ⇒ ακόμη `resolving`.
 * 6. Απάντηση εφεδρείας · 7. Τέλος: `not-found`.
 *
 * ⚠️ Το βήμα **5** δεν είναι πλεονασμός: χωρίς αυτό, το καρέ ανάμεσα στο «η λίστα
 * απάντησε» και «η εφεδρεία απάντησε» θα ανακοίνωνε **διαγραφή** για εγγραφή που
 * υπάρχει — ακριβώς το ελάττωμα Α του §8.30, μια στάση πιο μέσα.
 */
export function deriveEntitySelection<T extends SelectableEntity>(
  input: EntitySelectionInput<T>,
): EntitySelection<T> {
  const { requestedId, hasAnswered, items, archivedItems, fallback, isArchived } = input;

  if (!requestedId) return { kind: 'none' };
  if (!hasAnswered) return { kind: 'resolving', requestedId };

  const active = byId(items, requestedId);
  if (active) return classify(active, false, isArchived);

  const archived = byId(archivedItems, requestedId);
  if (archived) return classify(archived, true, isArchived);

  if (fallback?.phase === 'pending') return { kind: 'resolving', requestedId };
  if (fallback?.item) return classify(fallback.item, false, isArchived);

  return { kind: 'not-found', requestedId };
}

/**
 * **Επιτρέπεται η λίστα να διαλέξει μόνη της την πρώτη εγγραφή;**
 *
 * 🔴 **Ο ΚΑΝΟΝΑΣ ΠΟΥ ΚΑΝΕΙ ΤΟ ΨΕΜΑ ΔΟΜΙΚΑ ΑΔΥΝΑΤΟ.** Όταν η διεύθυνση ζητά ρητή
 * ταυτότητα, η αυτόματη επιλογή **δεν εφαρμόζεται ποτέ** — ούτε όταν η εγγραφή
 * δεν βρέθηκε, ούτε όσο ψάχνουμε.
 *
 * ⚠️ Μέχρι το §8.31 η προστασία αυτή ήταν **τύχη**: τρεις από τους τέσσερις
 * καταναλωτές περνούσαν `autoSelectFirstItem: false`, και τα **κτίρια** δεν το
 * έγραψαν καθόλου ⇒ προεπιλογή `true` ⇒ λάθος κτίριο. *Μια προστασία που
 * εξαρτάται από το αν ο επόμενος θα θυμηθεί μια σημαία δεν είναι προστασία.*
 */
export function mayAutoSelectFirst<T extends SelectableEntity>(
  selection: EntitySelection<T>,
  autoSelectFirstItem: boolean,
): boolean {
  return autoSelectFirstItem && selection.kind === 'none';
}

/**
 * **Πρέπει να σβήσει ό,τι δείχνει τώρα η οθόνη;**
 *
 * 🔴 **ΤΟ ΒΡΗΚΕ ΖΩΝΤΑΝΗ ΜΕΤΡΗΣΗ, ΜΕ 24 ΑΓΚΥΡΕΣ ΚΑΙ 13 ΠΥΛΕΣ ΠΡΑΣΙΝΕΣ**
 * (στιγμιότυπο 2026-08-20): το πανό «*ο σύνδεσμος δεν οδηγεί σε εγγραφή*»
 * εμφανιζόταν σωστά — **και από κάτω συνέχιζε να φαίνεται το προηγούμενο
 * κτίριο**. Δηλαδή το ψέμα δεν σταμάτησε· απέκτησε από πάνω του μια
 * προειδοποίηση, που είναι **χειρότερο**: δύο αντιφατικές δηλώσεις μαζί.
 *
 * Αιτία: αλλαγή **μόνο** του ερωτήματος της διεύθυνσης είναι πλοήγηση **χωρίς
 * επαναστήσιμο** του component ⇒ η προηγούμενη επιλογή **επιβιώνει**. Ο φρουρός
 * του {@link mayAutoSelectFirst} εμποδίζει να επιλεγεί **νέα** εγγραφή, αλλά δεν
 * είχε λόγο για την **παλιά** — μια απόφαση που κανείς δεν είχε γράψει, γιατί σε
 * καθαρή φόρτωση δεν υπάρχει παλιά επιλογή και το ελάττωμα είναι **αόρατο**.
 *
 * Ο κανόνας: *αν η διεύθυνση ζητά ταυτότητα και δείχνουμε **άλλη**, σβήσ' την.*
 * Ταυτόσημη ταυτότητα ⇒ **δεν** σβήνει — αλλιώς κάθε ανανέωση δεδομένων θα
 * έκανε την καρτέλα να αναβοσβήνει.
 */
export function shouldClearStaleSelection<T extends SelectableEntity>(
  selection: EntitySelection<T>,
  selectedId: string | null | undefined,
): boolean {
  if (!selectedId) return false;
  if (selection.kind !== 'resolving' && selection.kind !== 'not-found') return false;
  return selectedId !== selection.requestedId;
}
