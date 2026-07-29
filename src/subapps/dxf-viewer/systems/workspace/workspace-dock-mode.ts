/**
 * ADR-724 Φ2/Φ3 — Η **κατάσταση αγκύρωσης** της κύριας παλέτας, ως καθαρός τύπος + επικυρωτής.
 *
 * Μηδέν React, μηδέν DOM, μηδέν localStorage — καθρέφτης του `workspace-dock-geometry.ts`
 * (εκεί ζουν οι αριθμοί, εδώ η απαρίθμηση). Πλήρως ελέγξιμο με jest χωρίς jsdom.
 *
 * ── ΓΙΑΤΙ ΔΥΟ ΕΝΩΣΕΙΣ ΚΑΙ ΟΧΙ ΜΙΑ (Φ3) ──
 *
 * Η **πλευρά** και η **κατάσταση** είναι διαφορετικά ερωτήματα, και τα μπέρδεψε ήδη μία φορά ο
 * κώδικας. Το `'floating'` δεν έχει πλευρά· όμως το «σε ποια πλευρά θα επιστρέψει όταν
 * ξανα-αγκυρωθεί» **πρέπει** να έχει απάντηση (συμπεριφορά Revit: επιστρέφει εκεί που ήταν).
 * Άρα υπάρχουν δύο τύποι: {@link WorkspaceDockedSide} (πάντα μια πλευρά) και
 * {@link WorkspaceDockMode} (πλευρά **ή** αιώρηση). Ο δεύτερος περιέχει τον πρώτο.
 *
 * Με έναν ενιαίο τύπο, το πεδίο «τελευταία πλευρά» θα μπορούσε να πάρει τιμή `'floating'` —
 * δηλαδή «επίστρεψε στην αιώρηση όταν φύγεις από την αιώρηση». Ο τύπος το κάνει **αδύνατο**.
 *
 * ── 🔴 ΓΙΑΤΙ ΔΕΝ ΥΠΑΡΧΕΙ ΠΛΕΟΝ `isDockedRight` ──
 *
 * Μέχρι τη Φ2 η διάταξη ρωτούσε `isDockedRight(mode) ? [καμβάς, δ, παλέτα] : [παλέτα, δ, καμβάς]`.
 * Ένα **δυαδικό** predicate πάνω σε ένωση που έγινε **τριμερής** δεν σπάει τη μεταγλώττιση: το
 * `'floating'` απλώς πέφτει σιωπηλά στον κλάδο `else` ⇒ η αιωρούμενη παλέτα θα αποδιδόταν
 * **αγκυρωμένη αριστερά**. Κανένα test δεν το έπιανε, γιατί δεν υπήρχε τίποτα λάθος να πιαστεί —
 * ο κώδικας ήταν *έγκυρος*, απλώς απαντούσε σε λάθος ερώτηση.
 *
 * Η θεραπεία **δεν** είναι ένα δεύτερο predicate δίπλα στο πρώτο (τότε η επόμενη τιμή ξεχνιέται
 * ξανά): είναι το {@link resolveWorkspaceLayout}, ένα **εξαντλητικό** `switch` με φύλακα `never`.
 * Μια τέταρτη τιμή στην ένωση γίνεται **σφάλμα μεταγλώττισης**, όχι σιωπηλή παλινδρόμηση.
 *
 * ── ΓΙΑΤΙ ΟΝΟΜΑΤΑ `docked-left` / `docked-right` ΚΑΙ ΟΧΙ `left` / `right` ──
 *
 * Το πρόθεμα κρατά το σχήμα ανοιχτό: με το `'floating'` παρόν, η ένωση διαβάζεται ως «κατάσταση
 * αγκύρωσης», όχι ως «κατεύθυνση». Χωρίς το πρόθεμα, το `'left' | 'right' | 'floating'`
 * διαβάζεται σαν τρεις άσχετες έννοιες.
 */

/** Η **πλευρά** στην οποία κάθεται μια αγκυρωμένη παλέτα. Ποτέ `'floating'` — δες την κεφαλίδα. */
export type WorkspaceDockedSide = 'docked-left' | 'docked-right';

/** Η κατάσταση αγκύρωσης της κύριας παλέτας: μια πλευρά, ή αιωρούμενη (Φ3). */
export type WorkspaceDockMode = WorkspaceDockedSide | 'floating';

/**
 * Οι πλευρές, στη σειρά που εμφανίζονται στο μενού.
 *
 * Ξεχωριστά από το {@link DOCK_MODES} επειδή ο επικυρωτής της «τελευταίας πλευράς»
 * ({@link parseDockedSide}) **οφείλει** να απορρίπτει το `'floating'`.
 */
export const DOCKED_SIDES: readonly WorkspaceDockedSide[] = ['docked-left', 'docked-right'] as const;

/**
 * Όλες οι έγκυρες καταστάσεις, στη σειρά που εμφανίζονται στο μενού.
 *
 * Πηγή **και** για τον επικυρωτή **και** για το UI: μια νέα τιμή προστίθεται σε έναν τόπο και
 * εμφανίζεται αυτόματα στο μενού, αντί να ξεχαστεί στη μία από τις δύο λίστες.
 */
export const DOCK_MODES: readonly WorkspaceDockMode[] = [...DOCKED_SIDES, 'floating'] as const;

/**
 * Η προεπιλογή είναι η **σημερινή** συμπεριφορά ⇒ μηδενική οπτική αλλαγή για όποιον δεν
 * άγγιξε ποτέ το μενού (ίδιο σκεπτικό με το `WIDTH_DEFAULT: 384`).
 */
export const DOCK_MODE_DEFAULT: WorkspaceDockMode = 'docked-left';

/**
 * Πού επιστρέφει η παλέτα όταν ξανα-αγκυρωθεί χωρίς να έχει αγκυρωθεί ποτέ πριν.
 *
 * Ίδια τιμή με το {@link DOCK_MODE_DEFAULT} **σκόπιμα**, αλλά **άλλη σταθερά**: εκφράζουν
 * διαφορετικά πράγματα («πού ξεκινά ο χρήστης» vs «πού επιστρέφει από την αιώρηση») και μια
 * μελλοντική αλλαγή του ενός δεν πρέπει να σύρει το άλλο.
 */
export const DOCKED_SIDE_DEFAULT: WorkspaceDockedSide = 'docked-left';

/**
 * Type guard για την ωμή αποθηκευμένη **κατάσταση**.
 *
 * Η αποθηκευμένη τιμή είναι **ιστορικό, όχι αλήθεια**: μπορεί να γράφτηκε από άλλη έκδοση του
 * app ή να έχει αλλοιωθεί χειροκίνητα. Ποτέ δεν χρησιμοποιείται ωμή — ίδια σύμβαση με το
 * `parseDockWidth`.
 *
 * ⛔ **ΜΗΝ το αφαιρέσεις τώρα που το `'floating'` είναι έγκυρο.** Ο φύλακας δουλεύει και
 * **προς τα πίσω**: μια επαναφορά έκδοσης (rollback) θα διάβαζε `'floating'` ως άγνωστο και θα
 * έπεφτε στην προεπιλογή, αντί να ζωγραφίσει κατάσταση που δεν υπάρχει στον κώδικά της.
 *
 * @returns η τιμή αν είναι γνωστή, αλλιώς `null` (ο καλών αποφασίζει το fallback)
 */
export function parseDockMode(raw: unknown): WorkspaceDockMode | null {
  return typeof raw === 'string' && (DOCK_MODES as readonly string[]).includes(raw)
    ? (raw as WorkspaceDockMode)
    : null;
}

/**
 * Type guard για την ωμή αποθηκευμένη **πλευρά**.
 *
 * Στενότερος από το {@link parseDockMode}: απορρίπτει το `'floating'`. Αν δεχόταν, η «τελευταία
 * πλευρά» θα μπορούσε να γίνει `'floating'` και η έξοδος από την αιώρηση θα οδηγούσε ξανά στην
 * αιώρηση — βρόχος που ο χρήστης θα έβλεπε ως «το διπλό κλικ δεν κάνει τίποτα».
 */
export function parseDockedSide(raw: unknown): WorkspaceDockedSide | null {
  return typeof raw === 'string' && (DOCKED_SIDES as readonly string[]).includes(raw)
    ? (raw as WorkspaceDockedSide)
    : null;
}

/** Αιωρείται η παλέτα; Η **μία** ερώτηση κατάστασης που επιτρέπεται εκτός διάταξης. */
export function isFloating(mode: WorkspaceDockMode): boolean {
  return mode === 'floating';
}

/**
 * Στενεύει μια κατάσταση σε πλευρά — `null` όταν αιωρείται.
 *
 * Χρήσιμο σε όποιον πρέπει να θυμηθεί «πού ήταν»: το `setDockMode` καταγράφει την τελευταία
 * πλευρά μόνο όταν αυτή υπάρχει.
 */
export function toDockedSide(mode: WorkspaceDockMode): WorkspaceDockedSide | null {
  return isFloating(mode) ? null : (mode as WorkspaceDockedSide);
}

/**
 * Πώς διατάσσεται ο χώρος εργασίας για μια κατάσταση.
 *
 * - `sidebar-first` → `[παλέτα, διαχωριστικό, καμβάς]`
 * - `canvas-first`  → `[καμβάς, διαχωριστικό, παλέτα]`
 * - `floating`      → κανένα διαχωριστικό· ο καμβάς παίρνει όλο τον χώρο και η παλέτα επιπλέει
 */
export type WorkspaceLayoutKind = 'sidebar-first' | 'canvas-first' | 'floating';

/**
 * Η **ΜΟΝΗ** ερώτηση διάταξης που επιτρέπεται — και είναι **ολική**.
 *
 * Κάθε άλλο σημείο του app (καμβάς, hit-test, αγκύρωση σχεδίου) είναι σκόπιμα **αγνωστικό
 * πλευράς**: το `anchorTransformOnResize` μετρά την πραγματική αριστερή ακμή του container,
 * ώστε να μην υπάρχει `if (mode === …)` πουθενά στο μονοπάτι απόδοσης (ADR-724 §4.1).
 *
 * ⚠️ Ο κλάδος `default` **δεν** είναι αμυντικός κώδικας για τον χρόνο εκτέλεσης — είναι
 * απόδειξη **μεταγλώττισης**. Αν προστεθεί τέταρτη τιμή στο {@link WorkspaceDockMode} χωρίς
 * `case`, η ανάθεση σε `never` αποτυγχάνει και ο compiler δείχνει **αυτή** τη γραμμή. Αυτό
 * ακριβώς που δεν έκανε το παλιό `isDockedRight`.
 */
export function resolveWorkspaceLayout(mode: WorkspaceDockMode): WorkspaceLayoutKind {
  switch (mode) {
    case 'docked-left':
      return 'sidebar-first';
    case 'docked-right':
      return 'canvas-first';
    case 'floating':
      return 'floating';
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}
