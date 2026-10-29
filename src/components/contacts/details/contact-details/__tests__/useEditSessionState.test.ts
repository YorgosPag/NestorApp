/**
 * Άγκυρα του **hook**: ο setter της συνεδρίας επεξεργασίας ΠΕΡΝΑ από τη διαφορά με τη βάση
 * (ADR-323 · ADR-327 §8.5.4). Η καθαρή λογική έχει τις δικές της άγκυρες (`edit-session-diff.test.ts`)·
 * εδώ φυλάγεται ότι ο controller δεν μπορεί να ξαναγίνει σκέτο `useState` χωρίς να κοκκινίσει κάτι.
 */

import { renderHook, act } from '@testing-library/react';
import { useEditSessionState } from '../useEditSessionState';

interface FormShape {
  companyName: string;
  activityType: string;
  phones: Array<{ number: string; type: string }>;
}

const baseline: FormShape = {
  companyName: 'MACON ATEE',
  activityType: 'main',
  phones: [{ number: '2310428900', type: 'mobile' }],
};

describe('useEditSessionState', () => {
  it('Η1: ολόκληρη φόρμα με ΜΙΑ αλλαγή ⇒ η κατάσταση κρατά μόνο αυτή', () => {
    const { result } = renderHook(() => useEditSessionState(baseline));
    act(() => {
      result.current[1]({ ...baseline, phones: [{ number: '2310428900', type: 'main' }] });
    });
    expect(Object.keys(result.current[0])).toEqual(['phones']);
  });

  it('Η2: ο updater βλέπει τη συγχωνευμένη προβολή· επαναφορά ⇒ καθαρή συνεδρία', () => {
    const { result } = renderHook(() => useEditSessionState(baseline));
    act(() => {
      result.current[1]((prev) => ({ ...prev, activityType: 'secondary' }));
    });
    expect(result.current[0]).toEqual({ activityType: 'secondary' });
    act(() => {
      result.current[1]((prev) => {
        expect(prev.companyName).toBe('MACON ATEE');
        return { ...prev, activityType: 'main' };
      });
    });
    expect(result.current[0]).toEqual({});
  });
});
