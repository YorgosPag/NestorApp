const post = jest.fn();
jest.mock('@/lib/api/enterprise-api-client', () => ({ apiClient: { post: (...args: unknown[]) => post(...args) } }));

/* eslint-disable import/first */
import type { PriceListVersionWire } from '@/subapps/catalog/types/pricing-views';
import { seedUntilDone } from '../catalog-pricing-api.client';
/* eslint-enable import/first */

const version = (copied: number, cursor: string | null, done: boolean) =>
  ({ id: 'cplv_1', derived: { linesRevision: 0, seed: { fromVersionId: 'cplv_0', copied, cursor, done } } }) as unknown as PriceListVersionWire;

beforeEach(() => post.mockReset());

describe('seedUntilDone — η σπορά ως το τέλος, ποτέ ατέρμονη', () => {
  it('τμήματα σειριακά ως `done`, με πρόοδο σε κάθε τμήμα', async () => {
    post.mockResolvedValueOnce(version(400, 'l400', false)).mockResolvedValueOnce(version(650, null, true));
    const progress: number[] = [];
    const result = await seedUntilDone(version(0, null, false), (v) => progress.push(v.derived.seed?.copied ?? -1));
    expect(progress).toEqual([400, 650]);
    expect(result.derived.seed?.done).toBe(true);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('τμήμα που ΔΕΝ προχώρησε (ίδιος δρομέας, ίδιο πλήθος) ⇒ σταματά και επιστρέφει «σε εξέλιξη», όχι βρόχος', async () => {
    post.mockResolvedValue(version(400, 'l400', false));
    const result = await seedUntilDone(version(400, 'l400', false), () => undefined);
    expect(post).toHaveBeenCalledTimes(1);
    expect(result.derived.seed?.done).toBe(false);
  });

  it('ο δρομέας προχωρά πάνω από διαγραμμένες γραμμές της πηγής (ίδιο πλήθος) ⇒ ΣΥΝΕΧΙΖΕΙ', async () => {
    post.mockResolvedValueOnce(version(400, 'l800', false)).mockResolvedValueOnce(version(400, null, true));
    await seedUntilDone(version(400, 'l400', false), () => undefined);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('ακύρωση (η οθόνη έκλεισε) ⇒ κανένα νέο τμήμα · ήδη ολοκληρωμένη ⇒ κανένα αίτημα', async () => {
    await seedUntilDone(version(0, null, false), () => undefined, () => true);
    await seedUntilDone(version(10, null, true), () => undefined);
    expect(post).not.toHaveBeenCalled();
  });
});
