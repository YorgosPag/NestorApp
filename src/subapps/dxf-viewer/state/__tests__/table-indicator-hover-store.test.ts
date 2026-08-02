/**
 * 🔴 ADR-739 §30 — **ΤΟ ΚΑΡΕ ΖΗΤΙΕΤΑΙ ΜΟΝΟ ΟΤΑΝ ΑΛΛΑΖΕΙ Η ΥΠΟΔΙΑΙΡΕΣΗ.**
 *
 * Αυτή η σουίτα δεν δοκιμάζει «κρατά ό,τι του δίνεις» — αυτό είναι το εύκολο μισό και το
 * κάνει κάθε store. Δοκιμάζει το **μόνο** πράγμα που μπορεί να καταστρέψει την επίδοση: ο
 * γραφέας τρέχει σε `mousemove`, δηλαδή ~60 φορές το δευτερόλεπτο όσο ο πίνακας είναι
 * ανοιχτός, ενώ η απάντηση αλλάζει μερικές φορές ανά σύρσιμο χεριού. Ένα άνευ όρων
 * `markSystemsDirty` θα ξανάβαφε ολόκληρο τον καμβά σε κάθε pixel — και **κανένα test
 * κατάστασης δεν θα το έβλεπε**, γιατί η κατάσταση θα ήταν σωστή.
 *
 * ⚠️ Η επικίνδυνη περίπτωση είναι η **δεύτερη γραφή με ίδια τιμή**: το
 * `tableIndicatorHitAtFrame` παράγει **νέο** αντικείμενο σε κάθε κλήση, οπότε μια σύγκριση
 * αναφοράς θα περνούσε από κάθε test ισότητας και θα απέτυχε ακριβώς εδώ.
 *
 * @see state/table-indicator-hover-store.ts — η κεφαλίδα με ολόκληρο το σκεπτικό
 */

import {
  __resetTableIndicatorHoverForTests,
  clearTableIndicatorHover,
  getTableIndicatorHover,
  setTableIndicatorHover,
} from '../table-indicator-hover-store';
import { markSystemsDirty } from '../../rendering/core/frame-scheduler-api';

jest.mock('../../rendering/core/frame-scheduler-api', () => ({
  markSystemsDirty: jest.fn(),
}));

const repaints = markSystemsDirty as jest.MockedFunction<typeof markSystemsDirty>;

beforeEach(() => {
  __resetTableIndicatorHoverForTests();
  repaints.mockClear();
});

/** Νέο αντικείμενο κάθε φορά — ακριβώς όπως το παράγει το hit-test. */
function overColumn(colId: string, entityId = 'tbl-1') {
  return { entityId, hit: { axis: 'column', colId, index: 0 } } as const;
}

function overRow(rowId: string, entityId = 'tbl-1') {
  return { entityId, hit: { axis: 'row', rowId, index: 0 } } as const;
}

describe('table-indicator-hover-store', () => {
  it('κρατά την υποδιαίρεση και ζητά ΕΝΑ καρέ', () => {
    setTableIndicatorHover(overColumn('c2'));
    expect(getTableIndicatorHover()?.hit).toMatchObject({ axis: 'column', colId: 'c2' });
    expect(repaints).toHaveBeenCalledTimes(1);
    expect(repaints).toHaveBeenCalledWith(['dxf-canvas']);
  });

  it('🔴 ΙΔΙΑ υποδιαίρεση, ΝΕΟ αντικείμενο ⇒ ΚΑΝΕΝΑ δεύτερο καρέ', () => {
    setTableIndicatorHover(overColumn('c2'));
    repaints.mockClear();
    // Δέκα κινήσεις ποντικιού μέσα στο ίδιο γράμμα — αυτό είναι το ρεαλιστικό σενάριο.
    for (let i = 0; i < 10; i++) setTableIndicatorHover(overColumn('c2'));
    expect(repaints).not.toHaveBeenCalled();
  });

  it('διάσχιση ορίου στήλης ⇒ ακριβώς ένα καρέ', () => {
    setTableIndicatorHover(overColumn('c2'));
    repaints.mockClear();
    setTableIndicatorHover(overColumn('c3'));
    expect(repaints).toHaveBeenCalledTimes(1);
  });

  /**
   * Ο ίδιος αριθμός σε γραμμή και το ίδιο αλφαριθμητικό σε στήλη δεν είναι το ίδιο πράγμα:
   * χωρίς σύγκριση άξονα, μια κίνηση από τη γωνία προς την αριστερή λωρίδα θα φαινόταν
   * «τίποτα δεν άλλαξε» και η οθόνη θα έμενε στο λάθος γράμμα.
   */
  it('ίδια ταυτότητα σε ΑΛΛΟΝ άξονα ⇒ αλλαγή', () => {
    setTableIndicatorHover(overColumn('x1'));
    repaints.mockClear();
    setTableIndicatorHover(overRow('x1'));
    expect(getTableIndicatorHover()?.hit.axis).toBe('row');
    expect(repaints).toHaveBeenCalledTimes(1);
  });

  it('ίδια ταυτότητα σε ΑΛΛΟΝ πίνακα ⇒ αλλαγή (δύο πίνακες, μία σκηνή)', () => {
    setTableIndicatorHover(overColumn('c1', 'tbl-1'));
    repaints.mockClear();
    setTableIndicatorHover(overColumn('c1', 'tbl-2'));
    expect(getTableIndicatorHover()?.entityId).toBe('tbl-2');
    expect(repaints).toHaveBeenCalledTimes(1);
  });

  it('το σβήσιμο είναι ιδεμποτές — δεύτερη κλήση δεν ζητά καρέ', () => {
    setTableIndicatorHover(overColumn('c2'));
    repaints.mockClear();
    clearTableIndicatorHover();
    clearTableIndicatorHover();
    expect(getTableIndicatorHover()).toBeNull();
    expect(repaints).toHaveBeenCalledTimes(1);
  });

  it('σβήσιμο σε άδειο store ⇒ κανένα καρέ (mouseleave χωρίς προηγούμενο hover)', () => {
    clearTableIndicatorHover();
    expect(repaints).not.toHaveBeenCalled();
  });
});
