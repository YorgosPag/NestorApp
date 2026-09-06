/**
 * @fileoverview **ΟΙ ΑΓΚΥΡΕΣ ΤΟΥ ΕΝΟΣ REVEAL** — ADR-777 Α3 · WCAG 2.3.3.
 *
 * ⚠️ Κάθε άγκυρα εδώ φυλάει μια απόφαση που **καμία οθόνη ανάπτυξης δεν δείχνει**: ο
 * προγραμματιστής χωρίς ενεργοποιημένο «λιγότερη κίνηση» βλέπει το σωστό πράγμα ό,τι κι
 * αν γράψει ο κώδικας. Γι' αυτό επέζησε το ελάττωμα σε **23 αρχεία**.
 */

import {
  revealInScroll,
  visibilityWithinScroller,
} from '../reveal-in-scroll';
import { motionSafeScrollBehavior, prefersReducedMotion } from '../reduced-motion';

/** Ο περιηγητής απαντά «ναι/όχι» στο ερώτημα της μειωμένης κίνησης. */
function mockReducedMotion(reduce: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? reduce : false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

function elementWithSpy(): { el: Element; calls: ScrollIntoViewOptions[] } {
  const calls: ScrollIntoViewOptions[] = [];
  const el = document.createElement('div');
  el.scrollIntoView = ((options?: boolean | ScrollIntoViewOptions) => {
    calls.push((options ?? {}) as ScrollIntoViewOptions);
  }) as Element['scrollIntoView'];
  return { el, calls };
}

describe('revealInScroll — ΚΑΝΟΝΑΣ 1: όσο λιγότερη κίνηση γίνεται', () => {
  beforeEach(() => mockReducedMotion(false));

  /**
   * **Α1 — Η ΠΡΟΕΠΙΛΟΓΗ ΕΙΝΑΙ `nearest`, ΚΑΙ ΕΙΝΑΙ ΟΛΟΚΛΗΡΗ Η ΑΠΟΦΑΣΗ.**
   *
   * Το `center` κουνά την οθόνη **ακόμη κι όταν το στοιχείο είναι ήδη ορατό** — το
   * πήδημα που η Figma μέτρησε και απέσυρε από το Layers panel.
   */
  it('Α1: χωρίς ρητό block, κυλά μόνο όσο χρειάζεται (nearest)', () => {
    const { el, calls } = elementWithSpy();
    revealInScroll(el);
    expect(calls).toHaveLength(1);
    expect(calls[0].block).toBe('nearest');
  });

  /** **Α2** — το ρητό `block` περνά **αυτούσιο**: η μετανάστευση δεν άλλαξε συμπεριφορά. */
  it('Α2: το ρητό block και inline διατηρούνται ακριβώς', () => {
    const { el, calls } = elementWithSpy();
    revealInScroll(el, { block: 'center', inline: 'center' });
    expect(calls[0].block).toBe('center');
    expect(calls[0].inline).toBe('center');
  });

  /** **Α3** — χωρίς `inline` δεν στέλνεται `inline`: καμία σιωπηλή προεπιλογή. */
  it('Α3: το inline απουσιάζει όταν δεν ζητήθηκε', () => {
    const { el, calls } = elementWithSpy();
    revealInScroll(el);
    expect('inline' in calls[0]).toBe(false);
  });
});

describe('revealInScroll — ΚΑΝΟΝΑΣ 2: η κίνηση ρωτά τον άνθρωπο', () => {
  /**
   * 🔴 **Α4 — Η ΑΓΚΥΡΑ ΤΗΣ ΠΡΟΣΒΑΣΙΜΟΤΗΤΑΣ.** Ήταν **0 στα 29** call sites.
   *
   * Για κάποιον με αιθουσαία διαταραχή, μια σελίδα που γλιστρά μόνη της είναι ναυτία,
   * ζάλη ή ημικρανία — όχι ενόχληση (WCAG 2.3.3).
   */
  it('Α4: με prefers-reduced-motion, ακόμη και η ζητούμενη κύλιση γίνεται ακαριαία', () => {
    mockReducedMotion(true);
    const { el, calls } = elementWithSpy();
    revealInScroll(el, { urgency: 'requested' });
    expect(calls[0].behavior).toBe('auto');
  });

  it('Α5: χωρίς τη ρύθμιση, η ζητούμενη κύλιση είναι ομαλή', () => {
    mockReducedMotion(false);
    const { el, calls } = elementWithSpy();
    revealInScroll(el, { urgency: 'requested' });
    expect(calls[0].behavior).toBe('smooth');
  });

  /**
   * **Α6 — ΤΟ `incidental` ΕΙΝΑΙ ΑΚΑΡΙΑΙΟ ΑΝΕΞΑΡΤΗΤΑ ΑΠΟ ΤΗ ΡΥΘΜΙΣΗ.**
   *
   * Δεν είναι διπλή προστασία: δέκα πατήματα βέλους με ομαλή κύλιση δίνουν **δέκα
   * επικαλυπτόμενες** κινήσεις που καταλήγουν στο λάθος σημείο. Είναι ορθότητα, όχι
   * προσβασιμότητα — γι' αυτό δεν κρέμεται από τη ρύθμιση.
   */
  it('Α6: η παρεμπίπτουσα κύλιση είναι πάντα ακαριαία, ακόμη και χωρίς τη ρύθμιση', () => {
    mockReducedMotion(false);
    const { el, calls } = elementWithSpy();
    revealInScroll(el, { urgency: 'incidental' });
    expect(calls[0].behavior).toBe('auto');
  });

  it('Α7: το motionSafeScrollBehavior συμφωνεί με το prefersReducedMotion', () => {
    mockReducedMotion(true);
    expect(prefersReducedMotion()).toBe(true);
    expect(motionSafeScrollBehavior()).toBe('auto');
    mockReducedMotion(false);
    expect(prefersReducedMotion()).toBe(false);
    expect(motionSafeScrollBehavior()).toBe('smooth');
  });

  /** **Α8** — `matchMedia` που πετά (jsdom, ιδιωτική περιήγηση) δεν ρίχνει τη σελίδα. */
  it('Α8: αν το matchMedia πετάξει, η απάντηση είναι «όχι μειωμένη», όχι σφάλμα', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: () => { throw new Error('not implemented'); },
    });
    expect(() => prefersReducedMotion()).not.toThrow();
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('revealInScroll — ΚΑΝΟΝΑΣ 3: δεν ρίχνει ποτέ τον καλούντα', () => {
  beforeEach(() => mockReducedMotion(false));

  it('Α9: null / undefined στοιχείο δεν κάνει τίποτα και δεν πετά', () => {
    expect(() => revealInScroll(null)).not.toThrow();
    expect(() => revealInScroll(undefined)).not.toThrow();
  });

  /**
   * **Α10 — ΤΟ jsdom ΔΕΝ ΥΛΟΠΟΙΕΙ `scrollIntoView`.** Χωρίς το `?.` μέσα στο SSoT, κάθε
   * δοκιμή που περνά από αυτή τη διαδρομή θα έπεφτε — δηλαδή η **προσβασιμότητα** θα
   * γινόταν λόγος να μη γράφονται δοκιμές.
   */
  it('Α10: στοιχείο χωρίς scrollIntoView (jsdom) δεν πετά', () => {
    const bare = document.createElement('div');
    // @ts-expect-error — αναπαράγουμε ακριβώς το κενό του jsdom.
    delete bare.scrollIntoView;
    expect(() => revealInScroll(bare)).not.toThrow();
  });
});

describe('visibilityWithinScroller — η είσοδος του δείκτη άκρης', () => {
  function rect(top: number, bottom: number): DOMRect {
    return { top, bottom, height: bottom - top, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
  }

  function node(top: number, bottom: number): Element {
    const el = document.createElement('div');
    el.getBoundingClientRect = () => rect(top, bottom);
    return el;
  }

  const frame = () => node(100, 500);

  it('Α11: εντελώς πάνω από το κάδρο → above', () => {
    expect(visibilityWithinScroller(node(10, 40), frame())).toBe('above');
  });

  it('Α12: εντελώς κάτω από το κάδρο → below', () => {
    expect(visibilityWithinScroller(node(600, 660), frame())).toBe('below');
  });

  it('Α13: μέσα στο κάδρο → visible', () => {
    expect(visibilityWithinScroller(node(200, 260), frame())).toBe('visible');
  });

  /**
   * 🔴 **Α14 — Η ΜΕΡΙΚΗ ΟΡΑΤΟΤΗΤΑ ΕΙΝΑΙ ΟΡΑΤΟΤΗΤΑ.**
   *
   * Η αυστηρή εκδοχή («φαίνεται ολόκληρο;») θα έκανε τον δείκτη άκρης να **αναβοσβήνει
   * σε κάθε ξύσιμο του τροχού** — και θα έσπρωχνε τον άνθρωπο για να «τελειοποιήσει»
   * κάτι που ήδη βλέπει.
   */
  it('Α14: κομμένο στη μέση από την πάνω άκρη → visible, ΟΧΙ above', () => {
    expect(visibilityWithinScroller(node(60, 140), frame())).toBe('visible');
  });

  it('Α15: χωρίς στοιχείο ή χωρίς δοχείο → unknown', () => {
    expect(visibilityWithinScroller(null, frame())).toBe('unknown');
    expect(visibilityWithinScroller(node(0, 10), null)).toBe('unknown');
  });

  /**
   * **Α16 — ΚΑΔΡΟ ΜΗΔΕΝΙΚΟΥ ΥΨΟΥΣ = `unknown`, ΠΟΤΕ ΑΠΑΝΤΗΣΗ.**
   *
   * Στο jsdom **κάθε** ορθογώνιο είναι μηδενικό. Μια «ειλικρινής» αριθμητική εκεί θα
   * απαντούσε πάντα κάτι συγκεκριμένο — απάντηση που *μοιάζει* σωστή και **δεν κοίταξε
   * ποτέ**. Είναι το ίδιο σχήμα με το «`0` σημαίνει κανείς δεν κοίταξε».
   */
  it('Α16: κάδρο μηδενικού ύψους δεν παράγει ψεύτικη βεβαιότητα', () => {
    expect(visibilityWithinScroller(node(0, 10), node(0, 0))).toBe('unknown');
  });
});
