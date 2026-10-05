/**
 * ADR-711 §3.3 · ADR-241 — **Ποιος κρατούσε το focus, και μπορεί να το ξαναπάρει;**
 *
 * Το ίδιο ερώτημα το κάνουν **δύο** επιφάνειες: οι διάλογοι (`useDialogFocusRestore`) και η πλήρης οθόνη
 * (`FullscreenOverlay`). Ζει εδώ μία φορά — δύο αντίγραφα της ίδιας κρίσης θα απέκλιναν την ημέρα που θα άλλαζε η μία
 * (π.χ. αν το `body` σημαίνει «κανείς»).
 *
 * Framework-free: μόνο DOM, SSR-safe.
 */

/**
 * Το στοιχείο που κρατά τώρα το focus, ως υποψήφιος «opener» μιας επιφάνειας που ανοίγει.
 *
 * `null` όταν δεν υπάρχει DOM ή όταν το focus είναι στο `body`: το `body` σημαίνει «κανείς δεν κρατούσε το focus»
 * (π.χ. προγραμματικό άνοιγμα χωρίς κλικ) — επαναφορά εκεί δεν προσφέρει τίποτα.
 */
export function captureFocusOpener(): HTMLElement | null {
  if (typeof document === 'undefined' || typeof HTMLElement === 'undefined') return null;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return null;
  return active === document.body ? null : active;
}

/**
 * `true` όταν ο opener υπάρχει ακόμη στο DOM — **μόνο** τότε αξίζει να διεκδικήσει κανείς την επαναφορά. Αν χάθηκε
 * (π.χ. ο διάλογος διέγραψε τη γραμμή που τον άνοιξε), ο καλών αφήνει την προεπιλεγμένη διαδρομή να αποφασίσει.
 *
 * ⚠️ **«Υπάρχει» ≠ «παίρνει focus»** — δες {@link returnFocus}: ένα `disabled` κουμπί είναι συνδεδεμένο και αρνείται.
 */
export function canRestoreFocusTo(opener: HTMLElement | null): opener is HTMLElement {
  return opener !== null && opener.isConnected;
}

/**
 * **Πού γυρίζει το focus** — ο opener, και η **περιοχή** όπου ζούσε, για την ώρα που ο opener δεν θα μπορεί.
 *
 * 🔴 **ΜΕΤΡΗΜΕΝΟ ΖΩΝΤΑΝΑ (2026-10-05, κάρτα «Επαλήθευση ιδιοκτησίας»)**: ο διάλογος επιβεβαίωσης έκλεινε τη στιγμή
 * που το κουμπί που τον άνοιξε γινόταν `disabled` (η πράξη τρέχει). `isConnected === true` ⇒ διεκδικούσαμε την
 * επαναφορά, `disabled.focus()` = **no-op** ⇒ `activeElement === BODY`, και έμενε εκεί όταν το κουμπί έφευγε. Το ίδιο
 * σχήμα έχει **κάθε** επιβεβαίωση που απενεργοποιεί ή αφαιρεί αυτό που την άνοιξε.
 *
 * 🏆 WAI-ARIA APG (Dialog Modal): *«focus returns to the element that invoked the dialog, **unless** it no longer
 * exists — then to another element that provides **logical work flow**»*. Η περιοχή του opener είναι αυτό το
 * στοιχείο: ο αναγνώστης οθόνης μένει **εκεί όπου έγινε η πράξη**, και το επόμενο Tab συνεχίζει μέσα της.
 */
export interface FocusReturnTarget {
  readonly opener: HTMLElement | null;
  readonly region: HTMLElement | null;
}

/**
 * **Τι μετρά ως «περιοχή»** — ό,τι έχει δικό του νόημα για τον αναγνώστη οθόνης.
 *
 * ⚠️ **Όχι `main`/`nav`, επίτηδες**: «όλη η σελίδα» δεν είναι πιο χρήσιμη από το `body`, και το περίγραμμα εστίασης
 * γύρω από ολόκληρο το `main` θα ήταν θόρυβος. ⚠️ **Και οι διάλογοι μέσα**: επιβεβαίωση που ανοίγει **μέσα** από
 * διάλογο πρέπει να γυρίσει **σε αυτόν**, ποτέ στο αδρανές περιεχόμενο πίσω του.
 */
const FOCUS_REGION_SELECTOR = [
  'section',
  'article',
  'aside',
  'form',
  '[role="region"]',
  '[role="group"]',
  '[role="tabpanel"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
].join(', ');

const NO_FOCUS_RETURN: FocusReturnTarget = { opener: null, region: null };

/** Ο opener **και** η περιοχή του, τη στιγμή που ανοίγει η επιφάνεια — μετά μπορεί να μην υπάρχει πρόγονος να ρωτήσεις. */
export function captureFocusReturnTarget(): FocusReturnTarget {
  const opener = captureFocusOpener();
  if (opener === null) return NO_FOCUS_RETURN;
  return { opener, region: opener.parentElement?.closest<HTMLElement>(FOCUS_REGION_SELECTOR) ?? null };
}

/**
 * Εστίαση σε στοιχείο που **δεν** είναι στη σειρά Tab — δανεικό `tabindex="-1"`, που επιστρέφεται στο `blur`.
 * Ό,τι είχε ήδη `tabindex` δεν αγγίζεται.
 */
function focusRegion(region: HTMLElement): boolean {
  if (!region.hasAttribute('tabindex')) {
    region.setAttribute('tabindex', '-1');
    region.addEventListener('blur', () => region.removeAttribute('tabindex'), { once: true });
  }
  region.focus({ preventScroll: true });
  return document.activeElement === region;
}

/**
 * **Γύρνα το focus** — στον opener αν το **πάρει**, αλλιώς στην περιοχή του. Επιστρέφει ό,τι εστίασε, ή `null`
 * («δεν είχα πού» — ο καλών αφήνει την προεπιλεγμένη διαδρομή να αποφασίσει).
 *
 * 🔑 Η κρίση είναι το **αποτέλεσμα** (`activeElement`), όχι μια πρόβλεψη («είναι `disabled`;»): `inert` πρόγονος,
 * `display: none`, `disabled` `fieldset` αρνούνται το focus με **διαφορετικό** τρόπο, και ο browser τα ξέρει όλα.
 */
export function returnFocus(target: FocusReturnTarget, options?: FocusOptions): HTMLElement | null {
  const { opener, region } = target;
  if (canRestoreFocusTo(opener)) {
    opener.focus(options);
    if (document.activeElement === opener) return opener;
  }
  if (canRestoreFocusTo(region) && focusRegion(region)) return region;
  return null;
}
