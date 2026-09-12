/**
 * Υ — **Το κουμπί λέει την αλήθεια όσο η πράξη τρέχει** (ADR-332 D27 Ζ5).
 *
 * 🔴 **Μετρημένο ζωντανά**: η «Αποθήκευση» της επαφής κρατούσε **61,4″** με το κουμπί **ενεργό** και
 * **καμία** ένδειξη — ο άνθρωπος μπορούσε να ξαναπατήσει, και ξαναπατούσε.
 *
 * ── ΓΙΑΤΙ ΚΟΙΝΟ HOOK ΚΑΙ ΟΧΙ ΑΚΟΜΗ ΕΝΑ `useState(false)` ──
 * Η σωστή συμπεριφορά **υπήρχε ήδη** — στη φόρμα **δημιουργίας** (`useContactSubmission`: σημαία +
 * φραγμός επανεισόδου + `finally`). Έλειπε από τη διαδρομή **επεξεργασίας**, και δεν υπήρχε πουθενά
 * κοινός μηχανισμός: κάθε hook έγραφε δικό του ζευγάρι `loading`/`setLoading`. Αντί για έκτο αντίγραφο,
 * **μία** αρχή — και ο φραγμός είναι μέρος της, όχι κάτι που θυμάται ο καθένας.
 *
 * ⚠️ **Ο φραγμός δεν είναι κοσμητικός**: χωρίς αυτόν δύο πατήματα = **δύο εγγραφές** στο ίδιο έγγραφο.
 * Το W3C (ARIA25) το λέει ρητά για την «απασχολημένη» περιοχή: *«Forgetting to also disable interactive
 * controls inside the busy region is a common mistake — sighted users still see and can click them»*.
 */

/* global describe, it, expect, jest */

import { act, renderHook } from '@testing-library/react';
import { useInFlightAction } from '../useInFlightAction';

/** Πράξη που κρατιέται ανοιχτή ώσπου να την αφήσουμε — έτσι το «όσο τρέχει» είναι μετρήσιμο. */
function deferred(): { promise: Promise<void>; resolve: () => void; reject: (e: Error) => void } {
  let resolve: () => void = () => undefined;
  let reject: (e: Error) => void = () => undefined;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('Υ — ενέργεια σε εξέλιξη', () => {
  it('Υ1 — δεύτερο πάτημα ΟΣΟ τρέχει: αγνοείται (μία μόνο εκτέλεση)', async () => {
    const gate = deferred();
    const action = jest.fn(() => gate.promise);
    const { result } = renderHook(() => useInFlightAction());

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.run(action);
    });
    expect(result.current.isRunning).toBe(true);

    // Το δεύτερο πάτημα, όσο το πρώτο τρέχει.
    await act(async () => {
      await result.current.run(action);
    });
    expect(action).toHaveBeenCalledTimes(1);

    await act(async () => {
      gate.resolve();
      await first;
    });
    expect(result.current.isRunning).toBe(false);
  });

  it('Υ2 — μετά την ολοκλήρωση, το κουμπί ξαναζωντανεύει', async () => {
    const { result } = renderHook(() => useInFlightAction());

    await act(async () => {
      await result.current.run(async () => undefined);
    });

    expect(result.current.isRunning).toBe(false);
    // Και δέχεται νέα πράξη — ο φραγμός ήταν για τη διάρκεια, όχι για πάντα.
    const again = jest.fn(async () => undefined);
    await act(async () => {
      await result.current.run(again);
    });
    expect(again).toHaveBeenCalledTimes(1);
  });

  it('Υ3 — ΣΕ ΣΦΑΛΜΑ η κατάσταση καθαρίζει ΚΑΙ το σφάλμα φτάνει στον καλούντα', async () => {
    // Χωρίς `finally`, μια αποτυχία θα άφηνε το κουμπί **μόνιμα** απενεργοποιημένο: ο άνθρωπος
    // θα έβλεπε «Αποθήκευση...» για πάντα, χωρίς τρόπο να ξαναδοκιμάσει.
    const { result } = renderHook(() => useInFlightAction());
    const boom = new Error('η αποθήκευση απέτυχε');

    await act(async () => {
      await expect(result.current.run(async () => {
        throw boom;
      })).rejects.toBe(boom);
    });

    expect(result.current.isRunning).toBe(false);
  });

  it('Υ3β — το σφάλμα ΔΕΝ καταπίνεται σιωπηλά', async () => {
    // Ο παρονομαστής της Υ3: αν το hook κατάπινε το σφάλμα, ο καλών θα νόμιζε ότι αποθηκεύτηκε.
    const { result } = renderHook(() => useInFlightAction());
    let seen: unknown = null;

    await act(async () => {
      try {
        await result.current.run(async () => {
          throw new Error('βλάβη');
        });
      } catch (error) {
        seen = error;
      }
    });

    expect(seen).toBeInstanceOf(Error);
  });
});
