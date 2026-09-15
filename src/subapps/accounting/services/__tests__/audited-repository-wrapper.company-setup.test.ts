/**
 * @fileoverview **Η αποθήκευση προφίλ αφήνει ίχνος ΜΕΣΑ στη συναλλαγή** — audited wrapper
 *   (ADR-440 · ADR-841 §7 Α23 Φ3.2 Γ2 → Γ3).
 * @related subapps/accounting/services/audited-repository-wrapper.ts
 *
 * 🔴 Ως τη Γ3 ο wrapper διάβαζε το «πριν» χωριστά και έγραφε το ίχνος **μετά** και **έξω** από τη γραφή.
 * Εδώ: ο wrapper **συνθέτει** τα ίχνη από το «πριν/μετά» που του δίνει η συναλλαγή (`auditOf`) —
 * καμία δεύτερη ανάγνωση, καμία ξεχωριστή εγγραφή, κανένα ίχνος για τιμή που η μάσκα δεν έγραψε.
 *
 * ⚠️ Το repository είναι Proxy: κάθε μέθοδος είναι `jest.fn` — ο wrapper κάνει `bind` σε **όλες**,
 * και ένας χειρόγραφος πίνακας μεθόδων θα έσπαγε σε κάθε νέα μέθοδο του interface.
 */

import type { CompanySetupSaveOptions, IAccountingRepository } from '../../types/interfaces';
import type { AccountingAuditEntry } from '../../types/accounting-audit';
import type { CompanyProfile, CompanySetupInput } from '../../types/company';
import { createAuditedRepository } from '../audited-repository-wrapper';

type FakeRepository = IAccountingRepository & Record<string, jest.Mock>;

interface Transaction {
  readonly before: Partial<CompanyProfile> | null;
  /** Ό,τι έγραψε η συναλλαγή μετά τη μάσκα — αν λείπει, το `data` όπως ήρθε. */
  readonly after?: Partial<CompanyProfile>;
}

function fakeRepository(transaction: Transaction): { repo: FakeRepository; traced: AccountingAuditEntry[] } {
  const methods = new Map<string, jest.Mock>();
  const repo = new Proxy({} as FakeRepository, {
    get: (_target, key: string | symbol) => {
      // ⚠️ `then` ΔΕΝ είναι μέθοδος: αλλιώς το `await repo` το βλέπει thenable και δεν επιλύεται ποτέ.
      if (typeof key !== 'string' || key === 'then') return undefined;
      if (!methods.has(key)) methods.set(key, jest.fn(async () => undefined));
      return methods.get(key);
    },
  });
  const traced: AccountingAuditEntry[] = [];
  repo.saveCompanySetup.mockImplementation(async (data: CompanySetupInput, options?: CompanySetupSaveOptions) => {
    const before = transaction.before as CompanyProfile | null;
    const after = (transaction.after ?? data) as CompanyProfile;
    traced.push(...(options?.auditOf?.(before, after) ?? []));
    return { before, after };
  });
  return { repo, traced };
}

const profile = (businessName: string, extra: Record<string, unknown> = {}) =>
  ({ entityType: 'sole_proprietor', businessName, ...extra }) as unknown as CompanyProfile;
const input = (businessName: string) => profile(businessName) as unknown as CompanySetupInput;

async function save(transaction: Transaction, next: CompanySetupInput, options?: CompanySetupSaveOptions) {
  const faked = fakeRepository(transaction);
  const result = await createAuditedRepository(faked.repo, 'user_admin', 'comp_1').saveCompanySetup(next, options);
  return { ...faked, result };
}

describe('saveCompanySetup — ίχνος μέσα στη συναλλαγή (ADR-841 Α23 Γ3)', () => {
  it('🔴 Ο1 — μετονομασία από το προφίλ ⇒ `COMPANY_LEGAL_NAME_CHANGED` από/προς, πηγή `profile`', async () => {
    const { traced } = await save({ before: profile('Παλιά Επωνυμία') }, input('Νέα Επωνυμία'));

    expect(traced).toEqual([
      expect.objectContaining({
        eventType: 'COMPANY_LEGAL_NAME_CHANGED',
        entityType: 'company_profile',
        entityId: 'comp_1',
        userId: 'user_admin',
        metadata: expect.objectContaining({ previousLegalName: 'Παλιά Επωνυμία', legalName: 'Νέα Επωνυμία', source: 'profile' }),
      }),
    ]);
  });

  it('🔑 Ο2 — ίδια επωνυμία (αλλαγή σε άλλο πεδίο) ⇒ ΚΑΝΕΝΑ ίχνος', async () => {
    const { traced } = await save({ before: profile('Ίδια') }, input('Ίδια'));
    expect(traced).toHaveLength(0);
  });

  it('🔑 Ο3 — πρώτη ρύθμιση (χωρίς προφίλ) ⇒ καταγράφεται η αρχική επωνυμία, από `null`', async () => {
    const { traced } = await save({ before: null }, input('Πρώτη Επωνυμία'));
    expect(traced[0]?.metadata).toMatchObject({ previousLegalName: null, legalName: 'Πρώτη Επωνυμία' });
  });

  it('🔴 Ο4 — ΚΑΜΙΑ δεύτερη ανάγνωση, ΚΑΜΙΑ ξεχωριστή εγγραφή ίχνους · η μάσκα φτάνει στο repository', async () => {
    const { repo } = await save({ before: profile('Α') }, input('Β'), { fields: ['businessName'] });

    expect(repo.getCompanySetup).not.toHaveBeenCalled();
    expect(repo.createAuditEntry).not.toHaveBeenCalled();
    expect(repo.saveCompanySetup).toHaveBeenCalledWith(input('Β'), expect.objectContaining({ fields: ['businessName'] }));
  });

  it('🔴 Ο5 — μπαγιάτικη οθόνη: η φόρμα λέει «Παλιά», η συναλλαγή ΔΕΝ την έγραψε ⇒ ΚΑΝΕΝΑ ψευδές ίχνος', async () => {
    const { traced } = await save({ before: profile('Νέα'), after: profile('Νέα') }, input('Παλιά'));
    expect(traced).toHaveLength(0);
  });

  it('🔑 Ο6 — αλλαγή μετόχων ⇒ `COMPANY_PROFILE_UPDATED` · το `auditOf` του καλούντα ΣΥΝΘΕΤΕΤΑΙ, δεν αντικαθίσταται', async () => {
    const caller = { auditId: 'alog_caller' } as AccountingAuditEntry;
    const before = profile('Α', { entityType: 'ae', shareholders: [] });
    const after = profile('Α', { entityType: 'ae', shareholders: [{ shareholderId: 's1', fullName: 'Γ', dividendSharePercent: 100 }] });

    const { traced, result } = await save({ before, after }, input('Α'), { auditOf: () => [caller] });

    expect(traced.map((entry) => entry.eventType ?? entry.auditId)).toEqual(['alog_caller', 'COMPANY_PROFILE_UPDATED']);
    expect(result).toEqual({ before, after });
  });
});
