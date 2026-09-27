/**
 * @fileoverview **ΤΟ ΒΕΛΑΚΙ ΣΤΟ ΠΑΤΩΜΑ** (ADR-884 Φ2στ · §4.12) — η κατεύθυνση μετριέται από δύο προβολές.
 */

import { FLOOR_ARROW_AHEAD_PITCH, FLOOR_ARROW_PITCH, floorArrowTurnDeg } from '../tour-floor-arrow';

describe('floorArrowTurnDeg', () => {
  it.each([
    ['ευθεία μπροστά (το μακρινό σημείο πιο ψηλά)', { x: 100, y: 80 }, 0],
    ['δεξιά', { x: 140, y: 100 }, 90],
    ['αριστερά', { x: 60, y: 100 }, -90],
    ['μπροστά-δεξιά (προοπτική προς το σημείο φυγής)', { x: 120, y: 80 }, 45],
  ])('%s', (_label, ahead, expected) => {
    expect(floorArrowTurnDeg({ x: 100, y: 100 }, ahead)).toBeCloseTo(expected, 9);
  });

  it('χωρίς δεύτερο σημείο ή με ταύτιση ⇒ 0 (μπροστά)', () => {
    expect(floorArrowTurnDeg({ x: 1, y: 1 }, null)).toBe(0);
    expect(floorArrowTurnDeg({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
  });

  it('το «μπροστά» είναι πιο κοντά στον ορίζοντα από το βελάκι — αλλιώς η κατεύθυνση αντιστρέφεται', () => {
    expect(FLOOR_ARROW_AHEAD_PITCH).toBeGreaterThan(FLOOR_ARROW_PITCH);
    expect(FLOOR_ARROW_AHEAD_PITCH).toBeLessThan(0);
  });
});
