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
  const result = await readRegistryOwners(DB, 'comp_alfa', { wanted: new Set(['ownp_1']), subjects, cases: [], partyContactIds: [], vatContactIds: [] });
  expect(result.owners.size).toBe(0);
  expect(result.people).toEqual({});
  expect(warn).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(warn.mock.calls)).not.toContain('cont_secret');
});

it('🔴 §45.15 (1β-γ-2) — ΑΦΜ ταξιδεύει ΜΟΝΟ για όσες επαφές ζητά ρητά η ερώτηση (5(1)(γ))· οι άλλες: μόνο όνομα', async () => {
  const snapshot = (id: string, data: Record<string, unknown>) => ({ id, data: () => ({ companyId: 'comp_alfa', ...data }) });
  getAll.mockResolvedValue([
    snapshot('cont_a', { firstName: 'Άλφα', vatNumber: '090000045' }),
    snapshot('cont_b', { firstName: 'Βήτα', vatNumber: '123456783' }),
    snapshot('cont_c', { firstName: 'Γάμμα' }),
  ]);
  const result = await readRegistryOwners(DB, 'comp_alfa', {
    wanted: new Set(), subjects: new Map(), cases: [], partyContactIds: ['cont_a', 'cont_b', 'cont_c'], vatContactIds: ['cont_a', 'cont_c'],
  });
  expect(result.people.cont_a).toEqual({ name: 'Άλφα', vatNumber: '090000045' });
  expect(result.people.cont_b).toEqual({ name: 'Βήτα' });
  // Ζητήθηκε, αλλά η επαφή δεν έχει ΑΦΜ ⇒ απόν (όχι κενό).
  expect(result.people.cont_c).toEqual({ name: 'Γάμμα' });
  expect(JSON.stringify(result.people)).not.toContain('123456783');
});

it('κανένα ζητούμενο ακίνητο ⇒ ΚΑΜΙΑ ανάγνωση', async () => {
  const subjects = new Map([['ownp_1', mandated('ownp_1', ['cont_a'])]]);
  const result = await readRegistryOwners(DB, 'comp_alfa', { wanted: new Set(), subjects, cases: [], partyContactIds: [], vatContactIds: [] });
  expect(result.owners.size).toBe(0);
  expect(getAll).not.toHaveBeenCalled();
});
