/**
 * MODIFIER KEY TRACKER FACTORY — ADR-363 (SSoT, jscpd de-dup t258/t241).
 *
 * Shared lifecycle for the vanilla singleton modifier-key trackers
 * ({@link CtrlKeyTracker}, {@link ShiftKeyTracker}, {@link QKeyTracker}).
 * All three are SSR-safe singletons installed once at module load, listen
 * to `window` `keydown` / `keyup` / `blur` in the capture phase, and expose
 * `getSnapshot()` for commit-time reads without a React subscription (see
 * each tracker's own header for its specific consumer rationale — this
 * factory only owns the identical plumbing, not the "why").
 *
 * Only two things vary per tracker:
 * - `match(e)` — which physical/logical key(s) this tracker watches.
 * - `onKeyDownExtra(e)` — optional side-effect run after a matching keydown
 *   (used by {@link QKeyTracker} to swallow the Arc-tool shortcut while a
 *   grip drag is active).
 *
 * @see keyboard/CtrlKeyTracker.ts
 * @see keyboard/ShiftKeyTracker.ts
 * @see keyboard/QKeyTracker.ts
 * @see stores/createExternalStore.ts — underlying pub/sub primitive
 */

import { createExternalStore } from '../stores/createExternalStore';

type Listener = () => void;

export interface ModifierKeyTracker {
  /** Live pressed state. Cheap read for commit-time consumers. */
  getSnapshot: () => boolean;
  subscribe: (listener: Listener) => () => void;
  /** Idempotent install — safe to call from multiple module loads. */
  install: () => void;
  /** Test-only teardown. Production code should never need this. */
  uninstall: () => void;
  /** Test-only direct setter. */
  _setForTest: (pressed: boolean) => void;
}

export interface CreateModifierKeyTrackerOptions {
  /** Predicate deciding whether a `keydown`/`keyup` event is this tracker's key. */
  match: (e: KeyboardEvent) => boolean;
  /** Optional side-effect run after a matching `keydown` sets pressed=true. */
  onKeyDownExtra?: (e: KeyboardEvent) => void;
  /**
   * Ονόματα **αληθινών modifiers** (κατά `KeyboardEvent.getModifierState`) που
   * αντιστοιχούν σε αυτόν τον tracker — π.χ. `['Control','Meta']`.
   *
   * 🔑 **ΑΥΤΟ ΕΙΝΑΙ Η ΑΥΤΟ-ΙΑΣΗ.** Όταν δίνεται, η κατάσταση **ξαναδιαβάζεται** από
   * **κάθε** συμβάν που ο tracker ήδη παρατηρεί, αντί να χτίζεται μόνο από μεταβάσεις
   * `keydown`/`keyup`. Μια κατάσταση χτισμένη από μεταβάσεις μπορεί να **κολλήσει**
   * (χάθηκε το `keyup` επειδή το παράθυρο δεν είχε εστίαση)· μια κατάσταση που
   * ξαναδιαβάζεται **δεν μπορεί να διαφωνήσει** με συμβάν που είδε.
   *
   * ⚠️ **ΠΑΡΑΛΕΙΠΕΤΑΙ για μη-modifier πλήκτρα** (`QKeyTracker`): το
   * `getModifierState('q')` δεν έχει νόημα — εκεί η μετάβαση **είναι** η μόνη αλήθεια.
   */
  modifierNames?: readonly string[];
}

/** Builds a vanilla singleton-shaped modifier-key tracker sharing the SSoT lifecycle. */
export function createModifierKeyTracker(
  options: CreateModifierKeyTrackerOptions
): ModifierKeyTracker {
  const { match, onKeyDownExtra, modifierNames } = options;
  const store = createExternalStore<boolean>(false, { equals: Object.is });
  let installed = false;

  const setPressed = (next: boolean): void => {
    store.set(next);
  };

  /**
   * Ξαναδιαβάζει την αλήθεια από το ίδιο το συμβάν. Επιστρέφει `true` αν απάντησε.
   *
   * Κάθε `KeyboardEvent`/`PointerEvent` κουβαλά **φρέσκια** κατάσταση modifiers· το
   * `getModifierState` είναι η τυποποιημένη ερώτηση. Άρα ο tracker δεν χρειάζεται να
   * **θυμάται** — αρκεί να **ρωτά**.
   */
  const resyncFrom = (e: KeyboardEvent | MouseEvent): boolean => {
    if (!modifierNames || modifierNames.length === 0) return false;
    setPressed(modifierNames.some((name) => e.getModifierState(name)));
    return true;
  };

  // 🔑 **Η ΜΕΤΑΒΑΣΗ ΕΙΝΑΙ Η ΑΥΘΕΝΤΙΑ· Ο ΣΥΓΧΡΟΝΙΣΜΟΣ ΜΟΝΟ ΘΕΡΑΠΕΥΕΙ.**
  //
  // Η αντίστροφη σειρά δοκιμάστηκε και απορρίφθηκε: με τον συγχρονισμό να **παρακάμπτει**
  // τη μετάβαση, ένα συνθετικό `keydown` με `key:'Control'` αλλά **χωρίς** `ctrlKey:true`
  // θα απαντιόταν «δεν πατήθηκε». Σε πραγματικό φυλλομετρητή αυτό δεν συμβαίνει ποτέ —
  // αλλά συμβαίνει σε **κάθε** άγκυρα που στέλνει το συμβάν με το χέρι, και μια αλλαγή που
  // σπάει τις άγκυρες χωρίς να αλλάζει τη ζωντανή συμπεριφορά είναι καθαρή ζημιά.
  //
  // Έτσι η αλλαγή είναι **αυστηρά προσθετική**: το πλήκτρο που παρακολουθούμε συμπεριφέρεται
  // ακριβώς όπως πριν· **κάθε άλλο** συμβάν γίνεται ευκαιρία να διορθωθεί κατάσταση που
  // κόλλησε (χάθηκε το `keyup` όσο το παράθυρο δεν είχε εστίαση).
  const onKeyDown = (e: KeyboardEvent): void => {
    if (match(e)) {
      setPressed(true);
      onKeyDownExtra?.(e);
      return;
    }
    resyncFrom(e);
  };

  const onKeyUp = (e: KeyboardEvent): void => {
    if (match(e)) {
      setPressed(false);
      return;
    }
    resyncFrom(e);
  };

  /**
   * 🔴 **ΚΑΙ ΤΟ ΠΟΝΤΙΚΙ ΛΕΕΙ ΤΗΝ ΑΛΗΘΕΙΑ — ΤΟ ΑΠΕΔΕΙΞΕ ΑΓΚΥΡΑ, ΟΧΙ ΣΚΕΨΗ.**
   *
   * Η πρώτη γραφή άκουγε **μόνο** `mousedown` («η στιγμή που ο άνθρωπος πάει να δράσει»)
   * και δήλωνε ρητά ότι το `mousemove` αποκλείεται ως κόστος στο μονοπάτι των 60fps.
   * Η άγκυρα «`Shift` αφημένο ΠΡΙΝ την απόθεση» το διέψευσε:
   *
   *   · η κατάσταση του modifier μπορεί να **στηθεί από κίνηση ποντικιού** — ο άνθρωπος
   *     κρατά `Shift` ενώ η εστίαση είναι αλλού, γυρίζει, και σέρνει·
   *   · τότε ο tracker **δεν είδε ποτέ** `keydown`, άρα κρατά `false`·
   *   · το επακόλουθο `keyup` γράφει `false` πάνω σε `false` ⇒ **καμία αλλαγή** ⇒ κανένας
   *     συνδρομητής δεν ειδοποιείται ⇒ η προεπισκόπηση μένει **μπαγιάτικη**.
   *
   * Δηλαδή ακριβώς η οικογένεια σφάλματος που αυτός ο συγχρονισμός ήρθε να κλείσει, σε
   * νέα θέση. Το **VS Code** ακούει ήδη `mousedown`/`mouseup`/`mousemove` σε capture για
   * συγγενή λόγο.
   *
   * ⚠️ Το κόστος μετρήθηκε ξανά και είναι **πληρωτέο**: ο handler δεν κάνει `match`, μόνο
   * `getModifierState` + `Object.is`. Χωρίς **πραγματική** αλλαγή δεν ειδοποιείται κανείς,
   * άρα **καμία** επανασχεδίαση — το ακριβώς αντίθετο από το σχήμα που φυλάει το ADR-040.
   *
   * ⚠️ `mousemove` και **όχι** `pointermove`: η κίνηση φτάνει εδώ και από τους δύο σε
   * πραγματικό φυλλομετρητή, αλλά ο συνθετικός κόσμος των αγκυρών στέλνει `mousemove` —
   * ένας φρουρός που δεν μπορεί να ασκηθεί δεν αποδεικνύει τίποτα.
   */
  const onMouseSync = (e: MouseEvent): void => {
    resyncFrom(e);
  };

  const onBlur = (): void => {
    // Lose modifier state if window loses focus (e.g. Alt+Tab).
    setPressed(false);
  };

  /**
   * 🔴 **ΤΟ `blur` ΔΕΝ ΑΡΚΕΙ, ΚΑΙ ΤΟ ΛΕΕΙ Η ΒΙΟΜΗΧΑΝΙΑ.** Το VS Code
   * (`ModifierKeyEmitter`) επαναφέρει **μόνο** στο `blur` — καλύπτει την **αναχώρηση**,
   * όχι κάθε **επιστροφή**: ελαχιστοποίηση παραθύρου και εναλλαγή καρτέλας είναι
   * μετρημένες διαδρομές όπου το `blur` δεν φτάνει αξιόπιστα. Η επιστροφή είναι το
   * σημείο όπου η κατάσταση **οφείλει** να ξαναχτιστεί από το μηδέν: ό,τι κρατιέται
   * όντως, θα το ξαναπεί το πρώτο συμβάν μέσω `resyncFrom`.
   */
  const onFocus = (): void => {
    setPressed(false);
  };

  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') setPressed(false);
  };

  const install = (): void => {
    if (installed) return;
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    window.addEventListener('mousedown', onMouseSync, { capture: true, passive: true });
    window.addEventListener('mousemove', onMouseSync, { capture: true, passive: true });
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    installed = true;
  };

  const uninstall = (): void => {
    if (!installed) return;
    if (typeof window === 'undefined') return;
    window.removeEventListener('keydown', onKeyDown, { capture: true });
    window.removeEventListener('keyup', onKeyUp, { capture: true });
    window.removeEventListener('mousedown', onMouseSync, { capture: true });
    window.removeEventListener('mousemove', onMouseSync, { capture: true });
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    installed = false;
    setPressed(false);
  };

  return {
    getSnapshot: () => store.get(),
    subscribe: (listener: Listener) => store.subscribe(listener),
    install,
    uninstall,
    _setForTest: (pressed: boolean) => setPressed(pressed),
  };
}
