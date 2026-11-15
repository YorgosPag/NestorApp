/**
 * ΑΓΚΥΡΑ — **η διεύθυνση του τόπου ενός ακινήτου** (ADR-915 §45.10 · Π-7 «η ακριβής διεύθυνση μετά την έγκριση»).
 *
 * Κρίνεται ό,τι είναι δικό του: σειρά πηγών (κτίριο → έργο → παλιά επίπεδα πεδία), κριτής μισθωτή σε **κάθε** έγγραφο
 * (ξένο ≡ ανύπαρκτο), και αποτυχία ⇒ `null`, ποτέ σφάλμα.
 */

/* global describe, it, expect, jest */

import type { Firestore } from 'firebase-admin/firestore';

import { readPropertySiteAddress } from '../property-site-address.server';

jest.mock('server-only', () => ({}));

type Docs = Record<string, Record<string, Record<string, unknown> | undefined>>;

function fakeDb(docs: Docs, failing = false): Firestore {
  const collection = (name: string) => ({
    doc: (id: string) => ({
      get: async () => {
        if (failing) throw new Error('unavailable');
        return { data: () => docs[name]?.[id] };
      },
    }),
  });
  return { collection } as unknown as Firestore;
}

const ADDRESS = (street: string, isPrimary = true) => ({
  id: `addr_${street}`, street, number: '12', postalCode: '54622', city: 'Θεσσαλονίκη', isPrimary, type: 'site',
});

const PROPERTY = { companyId: 'co_a', buildingId: 'bld_1', projectId: 'proj_1' };

describe('readPropertySiteAddress', () => {
  it('Δ1 — η κύρια διεύθυνση του κτιρίου προηγείται του έργου', async () => {
    const db = fakeDb({
      properties: { prop_1: PROPERTY },
      buildings: { bld_1: { companyId: 'co_a', addresses: [ADDRESS('Κτιρίου')] } },
      projects: { proj_1: { companyId: 'co_a', addresses: [ADDRESS('Έργου')] } },
    });
    await expect(readPropertySiteAddress(db, 'co_a', 'prop_1')).resolves.toContain('Κτιρίου 12');
  });

  it('Δ2 — κτίριο χωρίς διεύθυνση ⇒ η κύρια του έργου· έργο μόνο με παλιά πεδία ⇒ αυτά', async () => {
    const withProject = fakeDb({
      properties: { prop_1: PROPERTY },
      buildings: { bld_1: { companyId: 'co_a' } },
      projects: { proj_1: { companyId: 'co_a', addresses: [ADDRESS('Δευτερεύουσα', false), ADDRESS('Έργου')] } },
    });
    await expect(readPropertySiteAddress(withProject, 'co_a', 'prop_1')).resolves.toContain('Έργου 12');

    const legacy = fakeDb({
      properties: { prop_1: PROPERTY },
      projects: { proj_1: { companyId: 'co_a', address: 'Τσιμισκή 5', city: 'Θεσσαλονίκη' } },
    });
    await expect(readPropertySiteAddress(legacy, 'co_a', 'prop_1')).resolves.toContain('Τσιμισκή 5');
  });

  it('Δ3 — ξένο ακίνητο ή ξένο κτίριο ≡ ανύπαρκτο (κριτής μισθωτή σε κάθε έγγραφο)', async () => {
    const foreignProperty = fakeDb({ properties: { prop_1: { ...PROPERTY, companyId: 'co_b' } } });
    await expect(readPropertySiteAddress(foreignProperty, 'co_a', 'prop_1')).resolves.toBeNull();

    const foreignBuilding = fakeDb({
      properties: { prop_1: PROPERTY },
      buildings: { bld_1: { companyId: 'co_b', addresses: [ADDRESS('Ξένου')] } },
      projects: { proj_1: { companyId: 'co_a', addresses: [ADDRESS('Έργου')] } },
    });
    await expect(readPropertySiteAddress(foreignBuilding, 'co_a', 'prop_1')).resolves.toContain('Έργου 12');
  });

  it('Δ4 — καμία δηλωμένη διεύθυνση ή αποτυχία ανάγνωσης ⇒ null, ποτέ σφάλμα', async () => {
    const none = fakeDb({ properties: { prop_1: PROPERTY }, buildings: { bld_1: { companyId: 'co_a' } }, projects: { proj_1: { companyId: 'co_a' } } });
    await expect(readPropertySiteAddress(none, 'co_a', 'prop_1')).resolves.toBeNull();
    await expect(readPropertySiteAddress(fakeDb({}, true), 'co_a', 'prop_1')).resolves.toBeNull();
  });
});
