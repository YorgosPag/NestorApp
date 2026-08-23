import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error-utils';

/**
 * Η ροή «επιβεβαιωμένη διαγραφή με ανατροφοδότηση» μιας σελίδας-hub.
 *
 * Το `agreements` και το `materials` έγραφαν **γράμμα προς γράμμα** το ίδιο
 * `try` / `toast.success` / `catch` / `toast.error` / `finally` μπλοκ — 10 γραμμές
 * που το CHECK 3.28 μετρούσε ως κλώνο. Διέφεραν μόνο στη συνάρτηση διαγραφής,
 * στο κλειδί i18n και στο αν έπρεπε να αποεπιλεγεί το τρέχον στοιχείο.
 *
 * 🔑 **Καταναλώνει το υπάρχον SSoT σφαλμάτων** (`getErrorMessage` του
 * `@/lib/error-utils`) αντί για το ωμό `err instanceof Error ? err.message :
 * String(err)`. Το ωμό ιδίωμα ζει σε **77** σημεία του δέντρου· είναι δική του
 * εκστρατεία, αλλά **εδώ** δεν αναπαράγεται.
 *
 * ⚠️ Το `String(err)` περνιέται ως **fallback** και δεν είναι διακοσμητικό: το
 * `getErrorMessage` επιστρέφει `'Unknown error'` για τιμές που δεν είναι string,
 * `Error`, ούτε αντικείμενο με `.message`/`.error` — π.χ. ένα σκέτο `throw 42`.
 * Ο κώδικας που αντικαθίσταται έδειχνε `"42"`. Χωρίς το fallback αυτή θα ήταν
 * **σιωπηλή αλλαγή συμπεριφοράς** μέσα σε αλλαγή που αφαιρεί μόνο διπλοτυπία.
 *
 * ⚠️ **Ζει στο `components/procurement/hub/` και όχι στο `src/lib/`**, γιατί το
 * `src/lib` είναι **καθαρό λογικό στρώμα** — μηδέν αρχεία του εισάγουν `sonner`.
 * Ένας βοηθός που ζωγραφίζει toast δεν ανήκει εκεί. Αν τον χρειαστεί δεύτερος
 * τομέας, **τότε** ανεβαίνει σε κοινό επίπεδο UI — όχι προληπτικά.
 *
 * ⚠️ Το `onSettled` τρέχει σε `finally`: ο καθαρισμός του στόχου διαγραφής
 * πρέπει να γίνει **και όταν αποτύχει**, αλλιώς ο διάλογος μένει ανοιχτός πάνω
 * σε στοιχείο που δεν διαγράφηκε.
 *
 * @module components/procurement/hub/hub-delete
 */
export async function runHubDelete(params: {
  /** Η ίδια η διαγραφή. */
  readonly remove: () => Promise<unknown>;
  /** Μήνυμα επιτυχίας — **ήδη μεταφρασμένο** από τον καλούντα. */
  readonly successMessage: string;
  /** Τρέχει μόνο σε επιτυχία (π.χ. αποεπιλογή του διαγραμμένου). */
  readonly onSuccess?: () => void;
  /** Τρέχει **πάντα** — επιτυχία ή αποτυχία. */
  readonly onSettled: () => void;
}): Promise<void> {
  try {
    await params.remove();
    toast.success(params.successMessage);
    params.onSuccess?.();
  } catch (err) {
    toast.error(getErrorMessage(err, String(err)));
  } finally {
    params.onSettled();
  }
}
