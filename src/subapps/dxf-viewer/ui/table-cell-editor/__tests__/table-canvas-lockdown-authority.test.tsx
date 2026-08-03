/**
 * 🔴 ADR-739 §29.12 — **ΤΟ ΚΛΕΙΔΩΜΑ ΕΙΝΑΙ ΜΙΑ ΑΥΘΕΝΤΙΑ ΜΕ ΔΥΟ ΤΡΟΠΟΥΣ ΑΝΑΓΝΩΣΗΣ.**
 *
 * Μέχρι το §29 το κλείδωμα ήταν σκέτος module-level μετρητής με **έναν** αναγνώστη
 * (`isCanvasLockedByTableSession()`), και σωστά: τον ρωτούν χειριστές **εκτός React** στον
 * hot path (~60 φορές το δευτερόλεπτο), όπου ο ADR-040 απαγορεύει συνδρομή.
 *
 * Το Δ3 (οι λαβές) απαίτησε **δεύτερο** τρόπο ανάγνωσης, και δύο πράγματα που ο μετρητής δεν
 * μπορούσε να δώσει:
 *
 *  1. 🔴 **ΚΑΡΕ.** Ο ζωγράφος ξαναβάφει **μόνο** όταν του το ζητήσουν (ADR-040 / ADR-119). Η
 *     αλλαγή ιδιοκτησίας γίνεται σε `useEffect` — **μετά** την τελευταία ζωγραφιά. Χωρίς ρητό
 *     αίτημα καρέ, οι λαβές θα έσβηναν «κάποια στιγμή αργότερα», όταν κάτι **άλλο** τύχαινε να
 *     ζητήσει επαναβαφή: σφάλμα που εμφανίζεται διαλείπουσα και δεν αναπαράγεται ποτέ όταν το
 *     ψάχνεις. Ίδιο μοτίβο με το `table-cell-cursor-store` («ένα περιττό repaint κοστίζει
 *     μηδέν· ένα χαμένο repaint αφήνει λάθος εικόνα στην οθόνη»).
 *  2. **ΣΥΝΔΡΟΜΗ** για το μητρώο λαβών: ό,τι δεν ζωγραφίζεται δεν επιτρέπεται να **πιάνεται**
 *     (ADR-559 §big-player, «visible ≡ editable is sacred»), και το μητρώο ζει στη React.
 *
 * ⚠️ Η αυθεντία παραμένει **ΜΙΑ**: ο ίδιος μετρητής, δύο τρόποι ανάγνωσης. Δεύτερη σημαία «για
 * τη React» θα ήταν ακριβώς ο δεύτερος κύκλος ζωής που το §29 απαγορεύει ονομαστικά.
 *
 * @see ui/table-cell-editor/use-table-canvas-lockdown.ts
 */

import React, { useRef } from 'react';
import { act, render } from '@testing-library/react';
import { buildTableEntity } from '../../../bim/table/build-table-entity';
import { TABLE_TEST_VIEW } from './table-screen-point';
import { markSystemsDirty } from '../../../rendering/core/frame-scheduler-api';
import {
  __resetTableCanvasLockdownForTests,
  isCanvasLockedByTableSession,
  subscribeCanvasLockedByTableSession,
  useTableCanvasLockdown,
} from '../use-table-canvas-lockdown';
import type { TableEntity } from '../../../types/table-entity';
import type { ViewTransform } from '../../../rendering/types/Types';

jest.mock('../../../rendering/core/frame-scheduler-api', () => ({
  markSystemsDirty: jest.fn(),
}));

const markDirtyMock = markSystemsDirty as jest.MockedFunction<typeof markSystemsDirty>;
const { transform: TRANSFORM } = TABLE_TEST_VIEW;

interface HarnessProps {
  /**
   * 🔴 §29.15 — ο **μοναδικός** διακόπτης. Το `active` έπαψε να είναι παράμετρος: «κλειδωμένο
   * χωρίς οντότητα» δεν είναι πλέον εκφράσιμο, ούτε καν σε test.
   */
  readonly entity: TableEntity | null;
}

function LockdownHarness(props: HarnessProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const transformRef = useRef<ViewTransform>(TRANSFORM);
  useTableCanvasLockdown({ ...props, containerRef, transformRef });
  return <div ref={containerRef} />;
}

describe('🔴 ADR-739 §29.12 — το κλείδωμα ζητά καρέ όταν αλλάζει η ιδιοκτησία', () => {
  let entity: TableEntity;

  beforeEach(() => {
    __resetTableCanvasLockdownForTests();
    markDirtyMock.mockClear();
    entity = buildTableEntity({ x: 0, y: 0 }, {}, 'table-1', 'layer-0');
  });

  afterEach(() => {
    __resetTableCanvasLockdownForTests();
  });

  it('βάση: χωρίς ενεργή λειτουργία πίνακα ο καμβάς δεν είναι κλειδωμένος και δεν ζητιέται καρέ', () => {
    // Χωρίς αυτό, ένα «ζήτα καρέ πάντα» θα ήταν πράσινο σε όλα τα υπόλοιπα.
    const view = render(<LockdownHarness entity={null} />);
    expect(isCanvasLockedByTableSession()).toBe(false);
    expect(markDirtyMock).not.toHaveBeenCalled();
    view.unmount();
  });

  it('🔴 Δ3 — το ΚΛΕΙΔΩΜΑ ζητά καρέ: αλλιώς οι λαβές μένουν ζωγραφισμένες', () => {
    const view = render(<LockdownHarness entity={entity} />);
    expect(isCanvasLockedByTableSession()).toBe(true);
    expect(markDirtyMock).toHaveBeenCalledWith(['dxf-canvas']);
    view.unmount();
  });

  it('🔴 και το ΞΕΚΛΕΙΔΩΜΑ ζητά καρέ: αλλιώς οι λαβές δεν ξαναγυρίζουν στην έξοδο', () => {
    const view = render(<LockdownHarness entity={entity} />);
    markDirtyMock.mockClear();
    act(() => { view.unmount(); });
    expect(isCanvasLockedByTableSession()).toBe(false);
    expect(markDirtyMock).toHaveBeenCalledWith(['dxf-canvas']);
  });

  it('η φωλιασμένη ενεργοποίηση ΔΕΝ ξαναζητά καρέ — η ιδιοκτησία δεν άλλαξε', () => {
    // Δύο ταυτόχρονοι φύλακες (π.χ. remount μέσα σε μετάβαση): το βάθος πάει 1→2, αλλά η
    // απάντηση «κατέχει ο πίνακας τον καμβά;» μένει ίδια. Ένα καρέ ανά **αλλαγή**, όχι ανά set.
    const first = render(<LockdownHarness entity={entity} />);
    markDirtyMock.mockClear();
    const second = render(<LockdownHarness entity={entity} />);
    expect(markDirtyMock).not.toHaveBeenCalled();
    expect(isCanvasLockedByTableSession()).toBe(true);
    act(() => { second.unmount(); });
    // Ο ΕΝΑΣ φύλακας που μένει κρατά την ιδιοκτησία — άρα ούτε εδώ αλλάζει τίποτα.
    expect(isCanvasLockedByTableSession()).toBe(true);
    expect(markDirtyMock).not.toHaveBeenCalled();
    act(() => { first.unmount(); });
    expect(isCanvasLockedByTableSession()).toBe(false);
    expect(markDirtyMock).toHaveBeenCalledWith(['dxf-canvas']);
  });

  /**
   * 🔴 §29.15 — **Η ΤΑΥΤΟΤΗΤΑ ΤΗΣ ΟΝΤΟΤΗΤΑΣ ΔΕΝ ΕΙΝΑΙ ΑΛΛΑΓΗ ΙΔΙΟΚΤΗΣΙΑΣ.**
   *
   * Η οντότητα είναι **νέο αντικείμενο** σε κάθε αλλαγή σκηνής — δηλαδή σε κάθε δέσμευση
   * κελιού, δηλαδή σε κάθε πάτημα πλήκτρου. Όσο το βάθος ήταν δεμένο στην ταυτότητά της, ο
   * ίδιος effect έκανε `cleanup → setup` ⇒ `1 → 0 → 1` ⇒ **δύο** αλλαγές ιδιοκτησίας ⇒ **δύο
   * περιττές επαναβαφές ολόκληρου του `dxf-canvas` ανά πλήκτρο**, ενώ στην οθόνη δεν άλλαζε
   * τίποτα.
   *
   * Το §29.12 το είχε γράψει ρητά («το αίτημα μπαίνει **μόνο στην αλλαγή της απάντησης**»)
   * και η σύζευξη με την οντότητα το παραβίαζε **σιωπηλά** — καμία δοκιμή δεν το ρωτούσε.
   * Τώρα το ρωτά αυτή.
   */
  it('🔴 νέα ΤΑΥΤΟΤΗΤΑ ίδιας οντότητας (κάθε πάτημα πλήκτρου) ΔΕΝ ξαναζητά καρέ', () => {
    const view = render(<LockdownHarness entity={entity} />);
    expect(markDirtyMock).toHaveBeenCalledTimes(1);
    markDirtyMock.mockClear();

    // Ό,τι κάνει ένα commit κελιού: ίδιος πίνακας, **άλλο** αντικείμενο.
    act(() => { view.rerender(<LockdownHarness entity={{ ...entity }} />); });

    expect(isCanvasLockedByTableSession()).toBe(true);
    expect(markDirtyMock).not.toHaveBeenCalled();
    view.unmount();
  });

  it('🔴 οι συνδρομητές ειδοποιούνται — το μητρώο λαβών ζει στη React και πρέπει να μάθει', () => {
    const seen: boolean[] = [];
    const unsubscribe = subscribeCanvasLockedByTableSession(() => {
      seen.push(isCanvasLockedByTableSession());
    });
    const view = render(<LockdownHarness entity={entity} />);
    act(() => { view.unmount(); });
    unsubscribe();
    expect(seen).toEqual([true, false]);
  });
});
