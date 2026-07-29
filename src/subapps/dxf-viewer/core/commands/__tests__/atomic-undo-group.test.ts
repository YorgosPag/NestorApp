/**
 * ADR-729 — ΑΤΟΜΙΚΟΤΗΤΑ ΑΝΑΙΡΕΣΗΣ: **ΜΙΑ ενέργεια χρήστη = ΜΙΑ εγγραφή ιστορικού**.
 *
 * ## Γιατί υπάρχει αυτό το αρχείο
 * Το σφάλμα μετρήθηκε **ζωντανά** (2026-07-29): ένα ψήσιμο 186 τοπογραφικών ετικετών έγραψε
 * **187 εγγραφές** σε ιστορικό με ταβάνι `maxHistorySize: 100`. Δύο συνέπειες, και η δεύτερη
 * είναι η σοβαρή:
 *   1. η εντολή **δεν ξεκανόταν** — 100 αναιρέσεις άφηναν 86 ορφανές ετικέτες·
 *   2. η παρτίδα **σάρωνε ΟΛΟ το προηγούμενο ιστορικό της συνεδρίας**, δηλαδή ο χρήστης έχανε
 *      τη δυνατότητα να ξεκάνει **άσχετη** δουλειά που είχε κάνει πριν.
 *
 * **Κανένα από τα 21 tests της περιοχής δεν το έπιασε**, επειδή όλα επαληθεύουν το *αποτέλεσμα*
 * των εντολών στη σκηνή — **ποτέ το πλήθος εγγραφών ιστορικού**, ποτέ το ταβάνι. Η κοκκομετρία
 * της αναίρεσης δεν ήταν ιδιότητα που κοίταξε κανείς: ίδιο σχήμα με το «0 = κανείς δεν κοίταξε»
 * των N.11 / N.12. Αυτό το αρχείο κάνει την κοκκομετρία **μετρήσιμη ιδιότητα**, ώστε ο επόμενος
 * παραγωγός παρτίδας να μη γεννηθεί με το ίδιο σφάλμα.
 *
 * Το `should count ACTIONS, not entities` είναι ο **πυρήνας**: αποτυγχάνει ακριβώς όταν
 * αφαιρεθεί η διόρθωση (mutation-verified).
 */

import { CommandHistory } from '../CommandHistory';
import { CompositeCommand } from '../CompositeCommand';
import type { ICommand, SerializedCommand } from '../interfaces';

function fakeCmd(id: string, log: string[], timestamp = 0): ICommand {
  return {
    id,
    name: id,
    type: 'fake',
    timestamp,
    execute: () => log.push(`exec:${id}`),
    undo: () => log.push(`undo:${id}`),
    redo: () => log.push(`redo:${id}`),
    getDescription: () => id,
    getAffectedEntityIds: () => [id],
    serialize: (): SerializedCommand => ({ type: 'fake', id, name: id, timestamp, data: {}, version: 1 }),
  };
}

/** Command που σκάει στο execute — για τον έλεγχο rollback. */
function explodingCmd(id: string, log: string[]): ICommand {
  return {
    ...fakeCmd(id, log),
    execute: () => {
      log.push(`exec:${id}`);
      throw new Error(`boom:${id}`);
    },
  };
}

describe('ADR-729 — runAsSingleUndo: μια παρτίδα N οντοτήτων = ΑΚΡΙΒΩΣ 1 εγγραφή', () => {
  it('N εντολές μέσα στην εμβέλεια → ΜΙΑ εγγραφή ιστορικού', () => {
    const log: string[] = [];
    const h = new CommandHistory();

    h.runAsSingleUndo('bake', () => {
      for (let i = 0; i < 186; i++) h.execute(fakeCmd(`e${i}`, log));
    });

    expect(h.size()).toBe(1); // ΟΧΙ 186
    expect(log).toHaveLength(186); // …αλλά ΟΛΕΣ εκτελέστηκαν πραγματικά
  });

  it('ΜΙΑ αναίρεση ξεκάνει ΟΛΗ την παρτίδα, σε αντίστροφη σειρά', () => {
    const log: string[] = [];
    const h = new CommandHistory();

    h.runAsSingleUndo('bake', () => {
      h.execute(fakeCmd('a', log));
      h.execute(fakeCmd('b', log));
      h.execute(fakeCmd('c', log));
    });
    log.length = 0;

    expect(h.undo()).toBe(true);
    expect(log).toEqual(['undo:c', 'undo:b', 'undo:a']); // nested transaction unwind
    expect(h.canUndo()).toBe(false); // τίποτα δεν έμεινε ορφανό
  });

  it('redo επανεφαρμόζει ΟΛΗ την παρτίδα, μπροστά', () => {
    const log: string[] = [];
    const h = new CommandHistory();

    h.runAsSingleUndo('bake', () => {
      h.execute(fakeCmd('a', log));
      h.execute(fakeCmd('b', log));
    });
    h.undo();
    log.length = 0;

    expect(h.redo()).toBe(true);
    expect(log).toEqual(['redo:a', 'redo:b']);
    expect(h.size()).toBe(1);
  });

  /**
   * 🔴 Ο ΠΥΡΗΝΑΣ — το ταβάνι μετρά **ΕΝΕΡΓΕΙΕΣ**, όχι οντότητες.
   *
   * Χωρίς τη διόρθωση, μια παρτίδα μεγαλύτερη από το `maxHistorySize` (α) καταναλώνει ΟΛΟ το
   * ιστορικό και (β) **πετάει έξω άσχετη προηγούμενη δουλειά του χρήστη**. Αυτό το test σκάει
   * και στα δύο σκέλη αν αφαιρεθεί η εμβέλεια.
   */
  it('το ταβάνι μετρά ΕΝΕΡΓΕΙΕΣ: παρτίδα > maxHistorySize δεν σαρώνει το προηγούμενο ιστορικό', () => {
    const log: string[] = [];
    const h = new CommandHistory({ maxHistorySize: 5 });

    h.execute(fakeCmd('προηγούμενη-άσχετη-δουλειά', log));
    h.runAsSingleUndo('bake', () => {
      for (let i = 0; i < 20; i++) h.execute(fakeCmd(`e${i}`, log)); // 20 > 5 = ταβάνι
    });

    expect(h.size()).toBe(2); // η άσχετη δουλειά + η παρτίδα — ΟΧΙ 5 (κορεσμός)
    log.length = 0;

    h.undo(); // 1η αναίρεση: όλη η παρτίδα
    expect(log).toHaveLength(20);
    log.length = 0;

    // 🔴 …και η άσχετη δουλειά είναι ΑΚΟΜΑ αναστρέψιμη. Αυτό ήταν το πραγματικό κόστος.
    expect(h.undo()).toBe(true);
    expect(log).toEqual(['undo:προηγούμενη-άσχετη-δουλειά']);
  });

  it('ένθετη εμβέλεια ενώνεται με την εξωτερική (Revit assimilation) — ΜΙΑ εγγραφή', () => {
    const log: string[] = [];
    const h = new CommandHistory();

    h.runAsSingleUndo('outer', () => {
      h.execute(fakeCmd('delete-old', log));
      h.runAsSingleUndo('inner', () => {
        h.execute(fakeCmd('create-1', log));
        h.execute(fakeCmd('create-2', log));
      });
    });

    expect(h.size()).toBe(1);
    log.length = 0;
    h.undo();
    expect(log).toEqual(['undo:create-2', 'undo:create-1', 'undo:delete-old']);
  });

  it('σφάλμα στη μέση ⇒ rollback των εκτελεσμένων ΚΑΙ καμία εγγραφή στο ιστορικό', () => {
    const log: string[] = [];
    const h = new CommandHistory();

    expect(() =>
      h.runAsSingleUndo('bake', () => {
        h.execute(fakeCmd('a', log));
        h.execute(fakeCmd('b', log));
        h.execute(explodingCmd('c', log));
      }),
    ).toThrow('boom:c');

    // τα δύο επιτυχημένα ξετυλίχθηκαν αντίστροφα — ο χρήστης δεν μένει με μισή παρτίδα
    expect(log).toEqual(['exec:a', 'exec:b', 'exec:c', 'undo:b', 'undo:a']);
    expect(h.size()).toBe(0);
    expect(h.canUndo()).toBe(false);
    expect(h.isGrouping()).toBe(false); // η εμβέλεια έκλεισε ακόμη και στο σφάλμα
  });

  it('άδεια εμβέλεια ⇒ καμία εγγραφή-φάντασμα', () => {
    const h = new CommandHistory();
    h.runAsSingleUndo('nothing', () => undefined);
    expect(h.size()).toBe(0);
    expect(h.canUndo()).toBe(false);
  });

  it('ΕΝΑ command ⇒ σκέτη εγγραφή, μηδέν composite overhead (ίδια συμπεριφορά με σήμερα)', () => {
    const log: string[] = [];
    const h = new CommandHistory();
    h.runAsSingleUndo('single', () => h.execute(fakeCmd('solo', log)));
    expect(h.getLastCommand()).not.toBeInstanceOf(CompositeCommand);
    expect(h.getLastCommand()?.id).toBe('solo');
  });

  it('η εμβέλεια επιστρέφει την τιμή του work() (διαφανής στον καλούντα)', () => {
    const h = new CommandHistory();
    expect(h.runAsSingleUndo('x', () => 42)).toBe(42);
  });

  it('η παρτίδα ειδοποιεί τους ακροατές ΜΙΑ φορά, όχι N (60fps churn)', () => {
    const log: string[] = [];
    const h = new CommandHistory();
    const listener = jest.fn();
    h.subscribe(listener);

    h.runAsSingleUndo('bake', () => {
      for (let i = 0; i < 50; i++) h.execute(fakeCmd(`e${i}`, log));
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('δομική αντίδραση (appendToLast) μέσα σε παρτίδα δεν σπάει την εγγύηση «ΜΙΑ»', () => {
    const log: string[] = [];
    const h = new CommandHistory();

    h.runAsSingleUndo('bake', () => {
      h.execute(fakeCmd('user', log));
      h.appendToLast(fakeCmd('derived', log)); // π.χ. auto-foundation re-derive
    });

    expect(h.size()).toBe(1);
    log.length = 0;
    h.undo();
    expect(log).toEqual(['undo:derived', 'undo:user']);
  });

  it('η redo στοίβα καθαρίζεται όταν κλείσει μια νέα παρτίδα', () => {
    const log: string[] = [];
    const h = new CommandHistory();
    h.execute(fakeCmd('old', log));
    h.undo();
    expect(h.canRedo()).toBe(true);

    h.runAsSingleUndo('bake', () => h.execute(fakeCmd('new', log)));
    expect(h.canRedo()).toBe(false); // νέα ενέργεια ακυρώνει το redo, όπως το σκέτο execute
  });
});

describe('ADR-729 — CompositeCommand: ονομασμένη ομάδα', () => {
  it('ονομασμένη ομάδα δίνει ΦΡΑΓΜΕΝΗ περιγραφή (186 παιδιά ≠ 186 όροι στο UI)', () => {
    const log: string[] = [];
    const children = Array.from({ length: 186 }, (_, i) => fakeCmd(`e${i}`, log));
    expect(new CompositeCommand(children, 'topo-point-labels').getDescription())
      .toBe('topo-point-labels (186 operations)');
  });

  it('ΑΝΩΝΥΜΗ ομάδα διατηρεί ΑΚΡΙΒΩΣ την ιστορική συμπεριφορά (appendToLast, BIM/3D)', () => {
    const log: string[] = [];
    const c = new CompositeCommand([fakeCmd('a', log), fakeCmd('b', log)]);
    expect(c.name).toBe('Composite');
    expect(c.getDescription()).toBe('a + b');
  });
});
