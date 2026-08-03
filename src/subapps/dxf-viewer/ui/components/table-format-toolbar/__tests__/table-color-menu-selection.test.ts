/**
 * ADR-739 Φ.Ε/Φ4β — **η τρίτη κατάσταση**: ποια γραμμή του μενού χρώματος είναι ενεργή.
 *
 * 🔴 Το κρίσιμο test αυτού του αρχείου είναι ένα και μόνο ένα: ότι «**ρητά κανένα γέμισμα**»
 * και «**κληρονομεί, και κληρονομεί κενό**» δίνουν **διαφορετική** απάντηση, παρότι έχουν
 * ολόιδιο `current: undefined` και ζωγραφίζουν ολόιδια στην οθόνη. Αν αυτά τα δύο συγχυστούν,
 * το μενού λέει στον χρήστη ότι πήρε μια απόφαση που δεν πήρε — και το «Επαναφορά στο στυλ»
 * φαίνεται να μην κάνει τίποτα.
 *
 * Τα υπόλοιπα φυλάνε τη σειρά των ελέγχων, που **είναι** η σημασιολογία.
 */

import {
  resolveColorMenuSelection,
  selectedSwatchHex,
  type TableAxisColorState,
} from '../table-color-menu-selection';

function state(patch: Partial<TableAxisColorState> = {}): TableAxisColorState {
  return {
    current: undefined,
    mixed: false,
    explicit: false,
    inheritedColor: undefined, inheritedMixed: false,
    drawingColors: [],
    ...patch,
  };
}

describe('🔴 ΤΟ ΚΡΙΣΙΜΟ: δύο καταστάσεις που ζωγραφίζουν ΟΛΟΙΔΙΑ, με άλλη σημασία', () => {
  it('ρητά «κανένα γέμισμα» ⇒ `none` — ο χρήστης το ζήτησε', () => {
    // Στο μοντέλο: `fillColorHex: null`. Το `resolveAxisFormat` το βλέπει ως overridden,
    // και το `clearable` σταματά τον κατήφορο ⇒ επιλυμένη τιμή `undefined`.
    expect(resolveColorMenuSelection(state({ explicit: true, current: undefined })))
      .toEqual({ kind: 'none' });
  });

  it('κληρονομεί, και κληρονομεί κενό ⇒ `automatic` — κανείς δεν το ζήτησε', () => {
    // Στο μοντέλο: το πεδίο **λείπει**, και το στυλ δεν βάφει αυτή τη γραμμή. Ίδιο `current`,
    // ίδιο άδειο κελί στην οθόνη — άλλη απάντηση.
    expect(resolveColorMenuSelection(state({ explicit: false, current: undefined })))
      .toEqual({ kind: 'automatic' });
  });

  it('🔴 και ΔΕΝ είναι το ίδιο — η μόνη διαφορά τους είναι το `explicit`', () => {
    const asNone = state({ explicit: true });
    const asAutomatic = state({ explicit: false });
    expect(asNone.current).toBe(asAutomatic.current);
    expect(resolveColorMenuSelection(asNone))
      .not.toEqual(resolveColorMenuSelection(asAutomatic));
  });
});

describe('η σειρά των ελέγχων ΕΙΝΑΙ η σημασιολογία', () => {
  it('το `mixed` επισκιάζει τα πάντα — ακόμη και ρητή δήλωση', () => {
    // Σε μεικτή σειρά καμία απάντηση για «τι ισχύει» δεν είναι αληθινή, ούτε καν «κανένα».
    expect(resolveColorMenuSelection(state({ mixed: true, explicit: true })))
      .toEqual({ kind: 'mixed' });
    expect(resolveColorMenuSelection(state({ mixed: true, explicit: true, current: '#ff0000' })))
      .toEqual({ kind: 'mixed' });
  });

  it('ρητό χρώμα ⇒ `color` με ΑΚΡΙΒΩΣ αυτό το hex', () => {
    expect(resolveColorMenuSelection(state({ explicit: true, current: '#ededed' })))
      .toEqual({ kind: 'color', hex: '#ededed' });
  });

  it('🔴 κληρονομούμενο χρώμα ⇒ `automatic`, ΟΧΙ `color` — το δείγμα δεν φοράει πλαίσιο', () => {
    // Αλλιώς μια στήλη που απλώς ακολουθεί το στυλ θα φαινόταν «καρφωμένη» σε εκείνο το χρώμα,
    // και ο χρήστης δεν θα είχε τρόπο να δει ότι δεν έχει αγγίξει τίποτα.
    const selection = resolveColorMenuSelection(
      state({ explicit: false, current: '#111111', inheritedColor: '#111111' }),
    );
    expect(selection).toEqual({ kind: 'automatic' });
    expect(selectedSwatchHex(selection)).toBeUndefined();
  });
});

describe('selectedSwatchHex — ΕΝΑ σημείο για δύο καταναλωτές', () => {
  it('δίνει hex μόνο σε ρητό χρώμα', () => {
    expect(selectedSwatchHex({ kind: 'color', hex: '#ff0000' })).toBe('#ff0000');
  });

  it('δίνει `undefined` σε καθεμία από τις άλλες τρεις καταστάσεις', () => {
    // Το πλέγμα και η ζώνη εγγράφου ρωτούν το ίδιο πράγμα· δύο αντίγραφα της συνθήκης θα ήταν
    // δύο ευκαιρίες να αποκλίνουν.
    expect(selectedSwatchHex({ kind: 'mixed' })).toBeUndefined();
    expect(selectedSwatchHex({ kind: 'automatic' })).toBeUndefined();
    expect(selectedSwatchHex({ kind: 'none' })).toBeUndefined();
  });
});
