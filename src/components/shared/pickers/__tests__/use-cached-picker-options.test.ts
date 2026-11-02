/**
 * `useCachedPickerOptions` — μία φόρτωση, κοινό αποτέλεσμα, επανάληψη μετά από αποτυχία.
 */

import { renderHook } from '@testing-library/react';
import { useCachedPickerOptions } from '../use-cached-picker-options';

describe('useCachedPickerOptions', () => {
  it('φορτώνει μία φορά και κρατά το αποτέλεσμα', async () => {
    const load = jest.fn(async () => ['a']);
    const { result } = renderHook(() => useCachedPickerOptions(load));

    await expect(result.current()).resolves.toEqual(['a']);
    await expect(result.current()).resolves.toEqual(['a']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('δεύτερη αναζήτηση όσο τρέχει η πρώτη παίρνει το ίδιο αποτέλεσμα, όχι κενή λίστα', async () => {
    const load = jest.fn(async () => ['a']);
    const { result } = renderHook(() => useCachedPickerOptions(load));

    const [first, second] = await Promise.all([result.current(), result.current()]);
    expect(first).toEqual(['a']);
    expect(second).toEqual(['a']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('μετά από αποτυχία δίνει κενή λίστα και η επόμενη αναζήτηση ξαναδοκιμάζει', async () => {
    const load = jest
      .fn<Promise<readonly string[]>, []>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(['a']);
    const { result } = renderHook(() => useCachedPickerOptions(load));

    await expect(result.current()).resolves.toEqual([]);
    await expect(result.current()).resolves.toEqual(['a']);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
