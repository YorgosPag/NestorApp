/**
 * ADR-549 Φ4 — `renderTickFrame` anchors: ΠΟΙΟ `RedrawLevel` οδηγεί σε ΠΟΙΑ διαδρομή render.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: το `scene-redraw-level.test.ts` κατοχυρώνει τη ΣΗΜΑΣΙΑ των επιπέδων και το
 * `scene-dirty-state.test.ts` ότι ανοίγουν το gate — αλλά κανένα από τα δύο δεν αποδεικνύει ότι το
 * καρέ **σχεδιάζεται στη σωστή διαδρομή**. Αυτό ήταν ακριβώς το κενό του incident (2026-07-26):
 * κάθε κρίκος σωστός, η σύνδεσή τους ανέλεγκτη. Εδώ κλείνει ο κύκλος gate → επίπεδο → διαδρομή.
 */

import { RedrawLevel, allDirtyRedrawLevels } from '../scene-redraw-level';

jest.mock('../scene-render-frame', () => ({
  renderSceneFrame: jest.fn(),
  renderHoverOnlyFrame: jest.fn(() => true),
}));
jest.mock('../bim3d-perf-diag', () => ({ recordRender: jest.fn() }));

import { renderTickFrame } from '../scene-manager-tick';
import { renderSceneFrame, renderHoverOnlyFrame } from '../scene-render-frame';
import { recordRender } from '../bim3d-perf-diag';

const full = renderSceneFrame as jest.Mock;
const overlay = renderHoverOnlyFrame as jest.Mock;

// Τα δύο ορίσματα είναι αδιαφανή για τη λογική διαδρομής — περνούν αυτούσια στους mocks.
const CTX = { marker: 'frame-context' } as never;
const SAMPLE = { marker: 'diag-sample' } as never;

beforeEach(() => {
  full.mockClear();
  overlay.mockClear();
  (recordRender as jest.Mock).mockClear();
  overlay.mockReturnValue(true);
});

describe('renderTickFrame — επίπεδο → διαδρομή', () => {
  it('OVERLAY με έγκυρο cache → ΜΟΝΟ η φθηνή διαδρομή (κανένα beauty render)', () => {
    renderTickFrame(CTX, RedrawLevel.OVERLAY, 1000, 16, SAMPLE);
    expect(overlay).toHaveBeenCalledTimes(1);
    expect(full).not.toHaveBeenCalled();
  });

  it('FULL → πλήρες beauty render· ΠΟΤΕ blit (θα έδειχνε παλιό beauty)', () => {
    renderTickFrame(CTX, RedrawLevel.FULL, 1000, 16, SAMPLE);
    expect(overlay).not.toHaveBeenCalled();
    expect(full).toHaveBeenCalledTimes(1);
  });

  /**
   * ΤΟ ΑΓΚΙΣΤΡΟ ΤΗΣ ΑΝΘΕΚΤΙΚΟΤΗΤΑΣ: σε cache miss το `renderHoverOnlyFrame` επιστρέφει `false` —
   * ΔΕΝ πετάει. Χωρίς το fallback, ένα hover πάνω σε άδειο cache θα άφηνε το καρέ **ΑΣΧΕΔΙΑΣΤΟ**
   * (μαύρη/παλιά εικόνα), δηλαδή θα ανακύκλωνε το ίδιο το σύμπτωμα του incident από άλλη πόρτα.
   */
  it('OVERLAY σε cache MISS → πέφτει στο πλήρες render (καμία χαμένη εικόνα)', () => {
    overlay.mockReturnValue(false);
    renderTickFrame(CTX, RedrawLevel.OVERLAY, 1000, 16, SAMPLE);
    expect(overlay).toHaveBeenCalledTimes(1);
    expect(full).toHaveBeenCalledTimes(1);
  });

  /**
   * EXHAUSTIVE ANCHOR — κάθε επίπεδο που ανοίγει το gate ΠΡΕΠΕΙ να καταλήγει σε σχεδιασμένο καρέ,
   * από τη μία διαδρομή ή την άλλη. Νέο `RedrawLevel` που θα ξεχαστεί εδώ (ούτε overlay ούτε full)
   * κοκκινίζει αυτόματα — αντί να γίνει σιωπηλά νεκρός κώδικας, όπως το `_hoverDirty` του Φ3.
   */
  it.each(allDirtyRedrawLevels())('επίπεδο %i σχεδιάζει ΠΑΝΤΑ κάτι', (level) => {
    renderTickFrame(CTX, level, 1000, 16, SAMPLE);
    expect(overlay.mock.calls.length + full.mock.calls.length).toBeGreaterThan(0);
  });

  it('περνά frameContext/timing αυτούσια στο beauty render', () => {
    renderTickFrame(CTX, RedrawLevel.FULL, 1234, 16, SAMPLE);
    expect(full).toHaveBeenCalledWith(CTX, 1234, 16);
  });

  it('χρεώνει το diag ΜΟΝΟ όταν έτρεξε beauty render (το blit δεν είναι render)', () => {
    renderTickFrame(CTX, RedrawLevel.OVERLAY, 1000, 16, SAMPLE);
    expect(recordRender).not.toHaveBeenCalled();
    renderTickFrame(CTX, RedrawLevel.FULL, 1000, 16, SAMPLE);
    expect(recordRender).toHaveBeenCalledTimes(1);
    expect((recordRender as jest.Mock).mock.calls[0][1]).toBe(SAMPLE);
  });
});
