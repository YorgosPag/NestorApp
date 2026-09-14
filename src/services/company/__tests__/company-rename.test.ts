/**
 * @jest-environment node
 *
 * @fileoverview Άγκυρες της **διάδοσης μετονομασίας** — ADR-841 §7 Α23 (Φ2 · Φ3.1).
 * @related services/company/company-rename.service.ts
 *
 * 🔑 Το ερώτημα είναι **ποιος ζητά ανανέωση και με ποια σειρά** — οι γραφείς έχουν δικές τους άγκυρες
 * (`company-legal-identity`, `agency-name-refresh`, `showcase-legal-identity`).
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

jest.mock('@/services/company-document.service', () => ({ repairCompanyDocument: jest.fn() }));
jest.mock('@/services/listings/agency-name-refresh', () => ({ refreshAgencyNameOnListings: jest.fn() }));
jest.mock('@/services/mandate/showcase-legal-identity-custody', () => ({ refreshShowcaseLegalIdentity: jest.fn() }));

import { repairCompanyDocument } from '@/services/company-document.service';
import { refreshAgencyNameOnListings } from '@/services/listings/agency-name-refresh';
import { refreshShowcaseLegalIdentity } from '@/services/mandate/showcase-legal-identity-custody';
import {
  propagateCompanyRename,
  reconcileShowcaseLegalIdentity,
} from '@/services/company/company-rename.service';

const repair = repairCompanyDocument as jest.MockedFunction<typeof repairCompanyDocument>;
const refresh = refreshAgencyNameOnListings as jest.MockedFunction<typeof refreshAgencyNameOnListings>;
const showcase = refreshShowcaseLegalIdentity as jest.MockedFunction<typeof refreshShowcaseLegalIdentity>;
const DB = {} as AdminFirestore;

beforeEach(() => {
  repair.mockReset();
  refresh.mockReset();
  showcase.mockReset();
  refresh.mockResolvedValue(null);
  showcase.mockResolvedValue({ kind: 'not-applicable' });
});

describe('Μ — η μετονομασία κατέχει τη συνέπειά της', () => {
  it('Μ1 — το όνομα άλλαξε ⇒ επισκευή, βιτρίνα ΚΑΙ ανανέωση αγγελιών με αιτία company-renamed', async () => {
    repair.mockResolvedValue({ name: 'ΝΕΟ ΟΝΟΜΑ ΑΕ', wasRepaired: true });

    const outcome = await propagateCompanyRename(DB, 'comp_a', 'uid_a');

    expect(repair).toHaveBeenCalledWith('comp_a', 'uid_a');
    expect(showcase).toHaveBeenCalledWith(DB, 'comp_a');
    expect(refresh).toHaveBeenCalledWith(DB, 'comp_a', 'company-renamed');
    expect(outcome).toEqual({
      name: 'ΝΕΟ ΟΝΟΜΑ ΑΕ',
      wasRepaired: true,
      showcase: { kind: 'not-applicable' },
      republished: null,
    });
  });

  it('Μ2 — 🔴 ίδιο όνομα παντού ⇒ ΚΑΜΙΑ επανασύνθεση αγγελιών (κάθε αποθήκευση προφίλ θα τις ξανάγραφε)', async () => {
    repair.mockResolvedValue({ name: 'ΙΔΙΟ ΑΕ', wasRepaired: false });
    showcase.mockResolvedValue({ kind: 'refreshed', publicNameChanged: false });

    await propagateCompanyRename(DB, 'comp_a', 'uid_a');

    expect(refresh).not.toHaveBeenCalled();
  });

  it('Μ3 — 🔴 το παράγωγο ήταν ήδη σωστό ΑΛΛΑ άλλαξε το όνομα της ΒΙΤΡΙΝΑΣ ⇒ αγγελίες μία φορά', async () => {
    repair.mockResolvedValue({ name: 'ΙΔΙΟ ΑΕ', wasRepaired: false });
    showcase.mockResolvedValue({ kind: 'refreshed', publicNameChanged: true });

    await propagateCompanyRename(DB, 'comp_a', 'uid_a');

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('Μ4 — 🔑 ΠΡΩΤΑ η βιτρίνα, ΜΕΤΑ οι αγγελίες: ο επιλυτής ονόματος ρωτά πρώτα τη βιτρίνα', async () => {
    repair.mockResolvedValue({ name: 'ΝΕΟ ΑΕ', wasRepaired: true });

    await propagateCompanyRename(DB, 'comp_a', 'uid_a');

    expect(showcase.mock.invocationCallOrder[0]).toBeLessThan(refresh.mock.invocationCallOrder[0]);
  });
});

describe('Ρ — αλλαγή εισόδου της νομικής ταυτότητας ΧΩΡΙΣ μετονομασία', () => {
  it('Ρ1 — το όνομα της βιτρίνας άλλαξε ⇒ αγγελίες με αιτία legal-identity-refreshed', async () => {
    showcase.mockResolvedValue({ kind: 'refreshed', publicNameChanged: true });

    await expect(reconcileShowcaseLegalIdentity(DB, 'comp_a')).resolves.toEqual({
      kind: 'refreshed',
      publicNameChanged: true,
    });
    expect(refresh).toHaveBeenCalledWith(DB, 'comp_a', 'legal-identity-refreshed');
    expect(repair).not.toHaveBeenCalled();
  });

  it.each([
    [{ kind: 'refreshed', publicNameChanged: false }],
    [{ kind: 'withheld', reason: 'agency-profile-name-missing' }],
    [{ kind: 'not-applicable' }],
    [{ kind: 'failed' }],
  ] as const)('Ρ2 — %j ⇒ ΚΑΜΙΑ ανανέωση αγγελιών', async (result) => {
    showcase.mockResolvedValue(result);

    await reconcileShowcaseLegalIdentity(DB, 'comp_a');

    expect(refresh).not.toHaveBeenCalled();
  });
});
