/**
 * @jest-environment node
 *
 * @fileoverview ADR-915 §25 — ο αναγνώστης ιδιοκτητών: **αποτυχία ⇒ το μητρώο ζει**, και ό,τι δεν θα δειχτεί δεν
 *   διαβάζεται. Τα υπόλοιπα (κυριότητα · ονόματα · μισθωτής) ελέγχονται από άκρη σε άκρη στο `document-registry.service.test`.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { readRegistryOwners } from '@/services/document-registry/registry-owners.server';
import type { RegistryProperty } from '@/services/document-registry/registry-properties.server';

const warn = jest.fn();
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: (...args: unknown[]) => warn(...args), error: jest.fn(), debug: jest.fn() }),
}));

const getAll = jest.fn();
const DB = { collection: () => ({ doc: (id: string) => ({ id }) }), getAll } as unknown as AdminFirestore;

function mandated(id: string, clients: readonly string[]): RegistryProperty {
  return {
    id, scope: 'owner-property', name: null, declaredPoint: null, mandateClientContactIds: clients, data: {},
    certificate: { kind: 'none' } as unknown as RegistryProperty['certificate'],
  };
}

beforeEach(() => jest.clearAllMocks());

it('η ανάγνωση επαφών αποτυγχάνει ⇒ ΚΑΝΕΝΑΣ ιδιοκτήτης («δεν ξέρω», όχι «κανείς») και `warn` χωρίς όνομα', async () => {
  getAll.mockRejectedValue(new Error('unavailable'));
  const subjects = new Map([['ownp_1', mandated('ownp_1', ['cont_secret'])]]);
  const result = await readRegistryOwners(DB, 'comp_alfa', { wanted: new Set(['ownp_1']), subjects, cases: [], partyContactIds: [] });
  expect(result.owners.size).toBe(0);
  expect(result.people).toEqual({});
  expect(warn).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(warn.mock.calls)).not.toContain('cont_secret');
});

it('κανένα ζητούμενο ακίνητο ⇒ ΚΑΜΙΑ ανάγνωση', async () => {
  const subjects = new Map([['ownp_1', mandated('ownp_1', ['cont_a'])]]);
  const result = await readRegistryOwners(DB, 'comp_alfa', { wanted: new Set(), subjects, cases: [], partyContactIds: [] });
  expect(result.owners.size).toBe(0);
  expect(getAll).not.toHaveBeenCalled();
});
