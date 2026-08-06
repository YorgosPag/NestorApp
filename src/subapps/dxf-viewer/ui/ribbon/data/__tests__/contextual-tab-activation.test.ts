/**
 * 🔴 ADR-345 §5.4 / ADR-739 §52 — **ΠΟΙΑ ΚΑΡΤΕΛΑ ΓΙΝΕΤΑΙ ΕΝΕΡΓΗ**, και πότε δεν αγγίζεται.
 *
 * Ο κανόνας είναι η μόνη απάντηση στο «γιατί δεν άνοιξε η καρτέλα μου;» — ερώτημα που
 * εμφανίστηκε **δύο** φορές: στο ADR-408 Φ7 («Edit Circuit») και στο §52 («Μορφοποίηση»). Και
 * τις δύο φορές το σύμπτωμα ήταν το ίδιο: η καρτέλα **εμφανιζόταν** σωστά και απλώς δεν
 * γινόταν ενεργή, δηλαδή τίποτα δεν έσπαγε — ο χρήστης απλώς έβλεπε λάθος περιεχόμενο.
 *
 * @see ui/ribbon/data/contextual-tab-activation.ts
 */

import {
  contextualTabsKey,
  resolveContextualTabActivation,
  RIBBON_HOME_TAB_ID,
} from '../contextual-tab-activation';
import type { RibbonTab } from '../../types/ribbon-types';

const tab = (id: string, autoActivateOnAppear?: true): RibbonTab => ({
  id,
  labelKey: `ribbon.tabs.${id}`,
  isContextual: true,
  contextualTrigger: id,
  autoActivateOnAppear,
  panels: [],
});

const TABLE = tab('table-properties');
const FORMAT = tab('table-format', true);
const WALL = tab('wall');
const CIRCUIT = tab('mep-circuit');
const PERSISTENT = ['home', 'view', 'insert'];

const resolve = (
  previousKey: string,
  visible: readonly RibbonTab[],
  activeTabId: string,
): string | null =>
  resolveContextualTabActivation({
    previousKey,
    visibleContextualTabs: visible,
    activeTabId,
    persistentTabIds: PERSISTENT,
  });

describe('contextualTabsKey — μία γλώσσα για σύγκριση και απόφαση', () => {
  it('κενό σύνολο ⇒ κενή συμβολοσειρά', () => {
    expect(contextualTabsKey([])).toBe('');
  });

  it('η **σειρά** μετράει: άλλη σειρά = άλλο σύνολο', () => {
    // Η σειρά είναι σημασιολογική (πρώτο token = προεπιλεγμένα ενεργό), άρα μια αντιμετάθεση
    // ΕΙΝΑΙ αλλαγή και οφείλει να ξαναπεράσει από τον κανόνα.
    expect(contextualTabsKey([TABLE, FORMAT])).not.toBe(contextualTabsKey([FORMAT, TABLE]));
  });
});

describe('1. Το σύνολο ΔΕΝ άλλαξε ⇒ σεβασμός της χειροκίνητης επιλογής', () => {
  it('ίδιο κλειδί ⇒ `null`, ακόμη κι αν η ενεργή είναι μόνιμη καρτέλα', () => {
    // Ο χρήστης πάτησε «Προβολή» ενώ ήταν επιλεγμένος τοίχος. Κάθε επόμενο render περνά από
    // εδώ· χωρίς αυτόν τον κλάδο η κορδέλα θα τον πετούσε πίσω στον τοίχο, συνεχώς.
    expect(resolve(contextualTabsKey([WALL]), [WALL], 'view')).toBeNull();
  });

  it('🔴 μετακίνηση δρομέα μέσα στον πίνακα ΔΕΝ αλλάζει το σύνολο ⇒ `null`', () => {
    const key = contextualTabsKey([TABLE, FORMAT]);
    expect(resolve(key, [TABLE, FORMAT], 'table-properties')).toBeNull();
    expect(resolve(key, [TABLE, FORMAT], 'table-format')).toBeNull();
  });
});

describe('🔴 2. ADR-739 §52 — ΤΟ ΣΥΝΟΛΟ ΜΕΓΑΛΩΣΕ, δεν αντικαταστάθηκε', () => {
  it('η «Μορφοποίηση» γίνεται ενεργή ΑΚΟΜΗ ΚΙ ΑΝ η ενεργή είναι ήδη contextual', () => {
    // Αυτό ακριβώς ΔΕΝ έκανε ο κοινός κανόνας: η «Ιδιότητες Πίνακα» είναι ήδη ορατή **και**
    // ενεργή, οπότε το `!visible.some(id === active)` ήταν `false` και η νέα δεν ενεργοποιούνταν
    // ποτέ — ό,τι σειρά κι αν είχαν τα tokens.
    expect(resolve(contextualTabsKey([TABLE]), [TABLE, FORMAT], 'table-properties'))
      .toBe('table-format');
  });

  it('η σειρά των κανόνων ΕΙΝΑΙ ο μηχανισμός: η ρητή δήλωση προηγείται του «πρώτου ορατού»', () => {
    // Με τον κοινό κανόνα πρώτο, εδώ θα επέστρεφε `table-properties` (το πρώτο ορατό).
    expect(resolve('', [TABLE, FORMAT], 'home')).toBe('table-format');
  });

  it('🔴 καρτέλα που ΗΤΑΝ ΗΔΗ ορατή δεν ξανα-αρπάζει την εστίαση', () => {
    // Ο χρήστης γύρισε χειροκίνητα στην «Ιδιότητες Πίνακα» ενώ η «Μορφοποίηση» ήταν ανοιχτή,
    // και μετά εμφανίστηκε **τρίτη** καρτέλα. Χωρίς τον έλεγχο «δεν ήταν ήδη εκεί», η
    // «Μορφοποίηση» θα του έκλεβε πάλι την εστίαση, σιωπηλά.
    const previous = contextualTabsKey([TABLE, FORMAT]);
    expect(resolve(previous, [TABLE, FORMAT, CIRCUIT], 'table-properties')).toBeNull();
  });

  it('χωρίς ρητή δήλωση, μια δεύτερη καρτέλα δίπλα σε ενεργή ΔΕΝ αλλάζει τίποτα', () => {
    // Η υπάρχουσα συμπεριφορά των ~50 άλλων contextual μένει ακέραιη (ADR-566 πολλαπλή
    // επιλογή: per-kind πρώτο, multi-selection δίπλα, καμία μετακίνηση εστίασης).
    expect(resolve(contextualTabsKey([WALL]), [WALL, CIRCUIT], 'wall')).toBeNull();
  });
});

describe('3. Η ενεργή δεν είναι πια ορατή ⇒ η πρώτη του νέου συνόλου', () => {
  it('persistent → contextual (επιλογή οντότητας)', () => {
    expect(resolve('', [WALL], 'home')).toBe('wall');
  });

  it('contextual → ΑΛΛΟ contextual (ADR-408 Φ7 «Edit Circuit»)', () => {
    expect(resolve(contextualTabsKey([WALL]), [CIRCUIT], 'wall')).toBe('mep-circuit');
  });
});

describe('4. Άδειασαν τα contextual', () => {
  it('η ενεργή ήταν contextual που χάθηκε ⇒ «Αρχική»', () => {
    expect(resolve(contextualTabsKey([TABLE, FORMAT]), [], 'table-format'))
      .toBe(RIBBON_HOME_TAB_ID);
  });

  it('🔴 η ενεργή ήταν ΜΟΝΙΜΗ ⇒ `null` — ο χρήστης δεν πετάγεται από την «Προβολή»', () => {
    expect(resolve(contextualTabsKey([WALL]), [], 'view')).toBeNull();
  });

  it('από κενό σε κενό ⇒ `null` (καμία αλλαγή, κανένας κλάδος)', () => {
    expect(resolve('', [], 'view')).toBeNull();
  });
});

describe('🔴 Το σενάριο του πίνακα, από άκρη σε άκρη', () => {
  it('επιλογή → είσοδος σε κελί → Esc → αποεπιλογή', () => {
    // Κάθε βήμα τροφοδοτεί το επόμενο με το κλειδί του προηγούμενου — ακριβώς όπως ο ref
    // μέσα στο effect. Είναι η μόνη μορφή που πιάνει σφάλμα **ακολουθίας**, όχι μεμονωμένου
    // κλάδου: το §52 ήταν σφάλμα ακολουθίας.
    let key = '';
    let active = 'home';

    const step = (visible: readonly RibbonTab[]): void => {
      const next = resolve(key, visible, active);
      key = contextualTabsKey(visible);
      if (next) active = next;
    };

    step([TABLE]);                 // επιλογή πίνακα
    expect(active).toBe('table-properties');

    step([TABLE, FORMAT]);         // διπλό κλικ σε κελί
    expect(active).toBe('table-format');

    step([TABLE]);                 // Esc — ο δρομέας έκλεισε
    expect(active).toBe('table-properties');

    step([]);                      // αποεπιλογή
    expect(active).toBe(RIBBON_HOME_TAB_ID);
  });
});
