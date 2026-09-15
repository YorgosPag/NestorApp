/**
 * @fileoverview **Η αποθήκευση προφίλ αφήνει ίχνος** — audited wrapper (ADR-440 · ADR-841 §7 Α23 Φ3.2 Γ2).
 * @related subapps/accounting/services/audited-repository-wrapper.ts
 *
 * 🔴 Ο wrapper **δεν είχε καμία άγκυρα**, και η αλλαγή επωνυμίας μέσω `PUT /api/accounting/setup` δεν
 * καταγραφόταν πουθενά. Εδώ: ποια γεγονότα φεύγουν για ποια αλλαγή — **μόνο** τη διαφορά.
 *
 * ⚠️ Το repository είναι Proxy: κάθε μέθοδος είναι `jest.fn` — ο wrapper κάνει `bind` σε **όλες**,
 * και ένας χειρόγραφος πίνακας μεθόδων θα έσπαγε σε κάθε νέα μέθοδο του interface.
 */

import type { IAccountingRepository } from '../../types/interfaces';
import type { AccountingAuditEntry } from '../../types/accounting-audit';
import type { CompanyProfile, CompanySetupInput } from '../../types/company';
import { createAuditedRepository } from '../audited-repository-wrapper';

type FakeRepository = IAccountingRepository & Record<string, jest.Mock>;

function fakeRepository(before: Partial<CompanyProfile> | null): FakeRepository {
  const methods = new Map<string, jest.Mock>();
  const repo = new Proxy({} as FakeRepository, {
    get: (_target, key: string | symbol) => {
      // ⚠️ `then` ΔΕΝ είναι μέθοδος: αλλιώς το `await repo` το βλέπει thenable και δεν επιλύεται ποτέ.
      if (typeof key !== 'string' || key === 'then') return undefined;
      if (!methods.has(key)) methods.set(key, jest.fn(async () => undefined));
      return methods.get(key);
    },
  });
  repo.getCompanySetup.mockResolvedValue(before);
  return repo;
}

function entries(repo: FakeRepository): AccountingAuditEntry[] {
  return repo.createAuditEntry.mock.calls.map(([entry]) => entry as AccountingAuditEntry);
}

function input(businessName: string): CompanySetupInput {
  return { entityType: 'sole_proprietor', businessName } as unknown as CompanySetupInput;
}

async function save(before: Partial<CompanyProfile> | null, next: CompanySetupInput): Promise<FakeRepository> {
  const repo = fakeRepository(before);
  await createAuditedRepository(repo, 'user_admin', 'comp_1').saveCompanySetup(next);
  return repo;
}

describe('saveCompanySetup — ίχνος αλλαγής επωνυμίας (ADR-841 Α23)', () => {
  it('🔴 Ο1 — μετονομασία από το προφίλ ⇒ `COMPANY_LEGAL_NAME_CHANGED` από/προς, πηγή `profile`', async () => {
    const repo = await save({ entityType: 'sole_proprietor', businessName: 'Παλιά Επωνυμία' }, input('Νέα Επωνυμία'));

    expect(repo.saveCompanySetup).toHaveBeenCalledTimes(1);
    expect(entries(repo)).toEqual([
      expect.objectContaining({
        eventType: 'COMPANY_LEGAL_NAME_CHANGED',
        entityType: 'company_profile',
        entityId: 'comp_1',
        userId: 'user_admin',
        metadata: expect.objectContaining({
          previousLegalName: 'Παλιά Επωνυμία',
          legalName: 'Νέα Επωνυμία',
          source: 'profile',
        }),
      }),
    ]);
  });

  it('🔑 Ο2 — ίδια επωνυμία (αλλαγή σε άλλο πεδίο) ⇒ ΚΑΝΕΝΑ ίχνος επωνυμίας', async () => {
    const repo = await save({ entityType: 'sole_proprietor', businessName: 'Ίδια' }, input('Ίδια'));

    expect(entries(repo)).toHaveLength(0);
  });

  it('🔑 Ο3 — πρώτη ρύθμιση (χωρίς προφίλ) ⇒ καταγράφεται η αρχική επωνυμία, από `null`', async () => {
    const repo = await save(null, input('Πρώτη Επωνυμία'));

    expect(entries(repo)[0]?.metadata).toMatchObject({ previousLegalName: null, legalName: 'Πρώτη Επωνυμία' });
  });

  it('🔴 Ο4 — το ίχνος γράφεται ΜΕΤΑ την αποθήκευση (αποτυχημένη αποθήκευση ⇒ κανένα ψευδές ίχνος)', async () => {
    const repo = fakeRepository({ entityType: 'sole_proprietor', businessName: 'Α' });
    repo.saveCompanySetup.mockRejectedValue(new Error('WRITE_FAILED'));

    await expect(
      createAuditedRepository(repo, 'user_admin', 'comp_1').saveCompanySetup(input('Β')),
    ).rejects.toThrow('WRITE_FAILED');
    expect(entries(repo)).toHaveLength(0);
  });
});
