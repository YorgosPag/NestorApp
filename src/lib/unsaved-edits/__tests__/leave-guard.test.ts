/**
 * Άγκυρες της ερώτησης εξόδου (ADR-912 §12.12, Εύρημα 11).
 * Κάθε μία απαντά σε ΕΝΑ ερώτημα: «θα έφευγε ο άνθρωπος χωρίς να ρωτηθεί;» ή «θα ρωτιόταν χωρίς λόγο;».
 */
import {
  clearUnsavedEdits,
  confirmLeave,
  declareUnsavedEditsSaver,
  guardLeave,
  guardSelectionChange,
  installLeavePrompt,
  leaveNeedsAnswer,
  markUnsavedEdits,
  resetLeaveGuardForTests,
  settledLeave,
  type LeaveDecision,
  type LeavePromptRequest,
} from '../leave-guard';

type Answer = (request: LeavePromptRequest) => Promise<LeaveDecision> | LeaveDecision;

function installPrompt(answer: Answer) {
  const asked: LeavePromptRequest[] = [];
  installLeavePrompt(async (request) => {
    asked.push(request);
    return answer(request);
  });
  return asked;
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => resetLeaveGuardForTests());

describe('leave-guard', () => {
  it('Φ1 — χωρίς αλλαγές η έξοδος εκτελείται ΣΥΓΧΡΟΝΑ και κανείς δεν ρωτιέται', () => {
    const asked = installPrompt(() => 'stay');
    const proceed = jest.fn();

    guardLeave(proceed);

    expect(proceed).toHaveBeenCalledTimes(1);
    expect(asked).toHaveLength(0);
  });

  it('Φ2 — με αλλαγές η έξοδος ΠΕΡΙΜΕΝΕΙ την απάντηση· «Συνέχεια επεξεργασίας» την ακυρώνει', async () => {
    const asked = installPrompt(() => 'stay');
    const proceed = jest.fn();
    markUnsavedEdits('form');

    guardLeave(proceed);
    expect(proceed).not.toHaveBeenCalled();
    await flush();

    expect(asked).toHaveLength(1);
    expect(proceed).not.toHaveBeenCalled();
  });

  it('Φ3 — «Απόρριψη» εκτελεί την έξοδο, και ό,τι φυλαγμένο τρέξει μέσα της ΔΕΝ ξαναρωτά', async () => {
    const asked = installPrompt(() => 'proceed');
    const inner = jest.fn();
    markUnsavedEdits('form');

    guardLeave(() => guardLeave(inner));
    await flush();

    expect(inner).toHaveBeenCalledTimes(1);
    expect(asked).toHaveLength(1);
  });

  it('Φ4 — η «Αποθήκευση» προσφέρεται ΜΟΝΟ όταν κάθε φόρμα με αλλαγές δήλωσε πώς αποθηκεύει', async () => {
    const asked = installPrompt(() => 'stay');
    markUnsavedEdits('with-saver');
    markUnsavedEdits('without-saver');
    declareUnsavedEditsSaver('saver-1', async () => true);

    await confirmLeave();
    declareUnsavedEditsSaver('saver-2', async () => true);
    await confirmLeave();

    expect(asked.map((request) => request.canSave)).toEqual([false, true]);
  });

  it('Φ5 — αποθήκευση που επιστρέφει `false` (ή πετά) ΔΕΝ είναι επιτυχία', async () => {
    const outcomes: boolean[] = [];
    installPrompt(async (request) => {
      outcomes.push(await request.save());
      return 'stay';
    });
    markUnsavedEdits('form');

    declareUnsavedEditsSaver('saver', async () => false);
    await confirmLeave();
    declareUnsavedEditsSaver('saver', async () => {
      throw new Error('server refused');
    });
    await confirmLeave();

    expect(outcomes).toEqual([false, false]);
  });

  it('Φ6 — αποθήκευση ΧΩΡΙΣ έκβαση κρίνεται από το αν η φόρμα έπαψε να έχει αλλαγές', async () => {
    jest.useFakeTimers();
    try {
      const outcomes: boolean[] = [];
      installPrompt(async (request) => {
        outcomes.push(await request.save());
        return 'stay';
      });
      markUnsavedEdits('form');

      // Πέτυχε: η φόρμα δηλώνει «καθαρή» ένα render μετά.
      declareUnsavedEditsSaver('saver', async () => {
        setTimeout(() => clearUnsavedEdits('form'), 50);
      });
      const succeeded = confirmLeave();
      await jest.advanceTimersByTimeAsync(60);
      await succeeded;

      // Απέτυχε σιωπηλά (π.χ. επικύρωση): η φόρμα μένει με αλλαγές ⇒ μετά το όριο, ΟΧΙ επιτυχία.
      markUnsavedEdits('form');
      declareUnsavedEditsSaver('saver', async () => undefined);
      const failed = confirmLeave();
      await jest.advanceTimersByTimeAsync(1100);
      await failed;

      expect(outcomes).toEqual([true, false]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('Φ7 — `settledLeave`: αλλαγή που ΔΕΝ είναι έξοδος δεν ρωτά, ακόμη κι αν η φόρμα δεν δήλωσε ακόμη «καθαρή»', () => {
    const asked = installPrompt(() => 'stay');
    const proceed = jest.fn();
    markUnsavedEdits('form');

    settledLeave(() => guardLeave(proceed));
    guardLeave(jest.fn());

    expect(proceed).toHaveBeenCalledTimes(1);
    // Η εξαίρεση δεν «κολλάει»: η επόμενη έξοδος ρωτά κανονικά.
    expect(asked).toHaveLength(1);
  });

  it('Φ8 — `force`: όποιος ΔΕΝ ξέρει αν υπάρχουν αλλαγές ρωτά, και χωρίς αποθήκευση να προσφέρει', async () => {
    const asked = installPrompt(() => 'proceed');

    await expect(confirmLeave({ force: true })).resolves.toBe(true);

    expect(asked.map((request) => request.canSave)).toEqual([false]);
  });

  it('Φ9 — δεύτερη έξοδος όσο η ερώτηση είναι ανοιχτή ΔΕΝ περνά και ΔΕΝ ανοίγει δεύτερο διάλογο', async () => {
    let answer: (decision: LeaveDecision) => void = () => undefined;
    const asked = installPrompt(() => new Promise<LeaveDecision>((resolve) => { answer = resolve; }));
    markUnsavedEdits('form');

    const first = confirmLeave();
    await flush();
    await expect(confirmLeave()).resolves.toBe(false);
    answer('proceed');

    await expect(first).resolves.toBe(true);
    expect(asked).toHaveLength(1);
  });

  it('Φ10 — αλλαγή επιλογής: έξοδος είναι ΜΟΝΟ η αλλαγή ταυτότητας (`null` και `undefined` είναι η ίδια «καμία»)', async () => {
    const asked = installPrompt(() => 'stay');
    const same = jest.fn();
    const none = jest.fn();
    const other = jest.fn();
    markUnsavedEdits('form');

    guardSelectionChange('a', 'a', same);
    guardSelectionChange(null, undefined, none);
    guardSelectionChange('a', 'b', other);
    guardSelectionChange('a', null, other);
    await flush();

    expect(same).toHaveBeenCalledTimes(1);
    expect(none).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
    // Η δεύτερη έξοδος βρήκε την ερώτηση ανοιχτή (Φ9) ⇒ ένας διάλογος.
    expect(asked).toHaveLength(1);
  });

  it('Φ11 — `leaveNeedsAnswer` λέει ΣΥΓΧΡΟΝΑ ό,τι θα έκανε το `guardLeave`', () => {
    expect(leaveNeedsAnswer()).toBe(false); // κανένας διάλογος
    installPrompt(() => 'stay');
    expect(leaveNeedsAnswer()).toBe(false); // καμία αλλαγή
    expect(leaveNeedsAnswer({ force: true })).toBe(true);
    markUnsavedEdits('form');
    expect(leaveNeedsAnswer()).toBe(true);
    expect(settledLeave(() => leaveNeedsAnswer())).toBe(false);
  });
});
