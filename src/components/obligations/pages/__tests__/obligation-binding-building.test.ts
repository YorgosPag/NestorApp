/**
 * ΑΓΚΥΡΑ — **έργο που δεν υπάρχει πια δεν αδειάζει τις φάσεις της υποχρέωσης** (ADR-829 §7.1).
 *
 * Το `GET /api/buildings?projectId=` απαντά πλέον 404 σε έργο που λείπει. Χωρίς χειρισμό, το 404 θα ακύρωνε τη δεύτερη
 * προσπάθεια στα κτίρια του χώρου και η φόρμα θα έμενε χωρίς φάσεις και ορόσημα.
 */

/* global describe, it, expect, beforeEach, jest */

import { ApiClientError, apiClient } from '@/lib/api/enterprise-api-client';
import { resolveBindingBuildingId } from '../obligation-binding-building';

jest.mock('@/lib/api/enterprise-api-client', () => {
  const { ApiClientError: RealError } = jest.requireActual('@/lib/api/api-client-types');
  return { ApiClientError: RealError, apiClient: { get: jest.fn() } };
});

const get = apiClient.get as jest.Mock;
const SCOPED = '/api/buildings?projectId=prj_1';
const ALL = '/api/buildings';

function answers(table: Record<string, unknown>): void {
  get.mockImplementation(async (url: string) => {
    const answer = table[url];
    if (answer instanceof Error) throw answer;
    return answer;
  });
}

beforeEach(() => get.mockReset());

describe('resolveBindingBuildingId', () => {
  it('κτίριο του έργου ⇒ αυτό, χωρίς δεύτερη κλήση', async () => {
    answers({ [SCOPED]: { buildings: [{ id: 'bld_1' }] } });

    await expect(resolveBindingBuildingId('prj_1')).resolves.toBe('bld_1');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('έργο χωρίς κτίρια ⇒ το πρώτο του χώρου', async () => {
    answers({ [SCOPED]: { buildings: [] }, [ALL]: { buildings: [{ id: 'bld_9' }] } });

    await expect(resolveBindingBuildingId('prj_1')).resolves.toBe('bld_9');
  });

  it('🔴 έργο που δεν υπάρχει πια (404) ⇒ το πρώτο του χώρου', async () => {
    answers({ [SCOPED]: new ApiClientError('Project not found', 404, 'NOT_FOUND'), [ALL]: { buildings: [{ id: 'bld_9' }] } });

    await expect(resolveBindingBuildingId('prj_1')).resolves.toBe('bld_9');
  });

  it('κάθε άλλο σφάλμα ανεβαίνει: το 500 δεν γίνεται «δεν υπάρχει»', async () => {
    answers({ [SCOPED]: new ApiClientError('Boom', 500, 'SERVER_ERROR') });

    await expect(resolveBindingBuildingId('prj_1')).rejects.toThrow('Boom');
  });

  it('χωρίς έργο ⇒ κατευθείαν τα κτίρια του χώρου', async () => {
    answers({ [ALL]: { buildings: [{ id: 'bld_9' }] } });

    await expect(resolveBindingBuildingId(null)).resolves.toBe('bld_9');
    expect(get).toHaveBeenCalledTimes(1);
  });
});
