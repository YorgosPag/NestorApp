/**
 * @jest-environment node
 *
 * @fileoverview Άγκυρες της **διάδοσης μετονομασίας** — ADR-841 §7 Α23 (Φ2).
 * @related services/company/company-rename.service.ts
 *
 * 🔑 Το ερώτημα είναι **ποιος ζητά ανανέωση αγγελιών και πότε όχι** — οι δύο γραφείς έχουν
 * δικές τους άγκυρες (`company-legal-identity`, `agency-name-refresh`).
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

jest.mock('@/services/company-document.service', () => ({ repairCompanyDocument: jest.fn() }));
jest.mock('@/services/listings/agency-name-refresh', () => ({ refreshAgencyNameOnListings: jest.fn() }));

import { repairCompanyDocument } from '@/services/company-document.service';
import { refreshAgencyNameOnListings } from '@/services/listings/agency-name-refresh';
import { propagateCompanyRename } from '@/services/company/company-rename.service';

const repair = repairCompanyDocument as jest.MockedFunction<typeof repairCompanyDocument>;
const refresh = refreshAgencyNameOnListings as jest.MockedFunction<typeof refreshAgencyNameOnListings>;
const DB = {} as AdminFirestore;

beforeEach(() => {
  repair.mockReset();
  refresh.mockReset();
});

describe('Μ — η μετονομασία κατέχει τη συνέπειά της', () => {
  it('Μ1 — το όνομα άλλαξε ⇒ επισκευή ΚΑΙ ανανέωση αγγελιών με αιτία company-renamed', async () => {
    repair.mockResolvedValue({ name: 'ΝΕΟ ΟΝΟΜΑ ΑΕ', wasRepaired: true });
    refresh.mockResolvedValue(null);

    const outcome = await propagateCompanyRename(DB, 'comp_a', 'uid_a');

    expect(repair).toHaveBeenCalledWith('comp_a', 'uid_a');
    expect(refresh).toHaveBeenCalledWith(DB, 'comp_a', 'company-renamed');
    expect(outcome).toEqual({ name: 'ΝΕΟ ΟΝΟΜΑ ΑΕ', wasRepaired: true, republished: null });
  });

  it('Μ2 — 🔴 ίδιο όνομα ⇒ ΚΑΜΙΑ επανασύνθεση αγγελιών (κάθε αποθήκευση προφίλ θα τις ξανάγραφε)', async () => {
    repair.mockResolvedValue({ name: 'ΙΔΙΟ ΑΕ', wasRepaired: false });

    await propagateCompanyRename(DB, 'comp_a', 'uid_a');

    expect(refresh).not.toHaveBeenCalled();
  });
});
