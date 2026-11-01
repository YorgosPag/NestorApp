/**
 * ΑΓΚΥΡΑ — **η λευκή λίστα του κτιρίου και ο στόχος του δεσμού προς έργο** (ADR-829 §7.1).
 *
 * Καθαρές συναρτήσεις με την πραγματική κρίση ιδιοκτησίας: κανένα mock που θα μπορούσε να πει ψέματα.
 * Το Σ3 είναι η απόδειξη κενού ζεύγους του `app/api/buildings/_shared/building-ownership.ts` (άγκυρα ADR-742).
 */

import { ApiError } from '@/lib/api/api-error-types';
import { POLICY_ERROR_CODES } from '@/lib/policy/policy-error-codes';
import { requireProjectInBuildingTenant } from '../_shared/building-ownership';
import { assertBuildingFieldsWritable, unwritableBuildingFields } from '../_shared/building-write-fields';

describe('λευκή λίστα πεδίων', () => {
  it('Λ1 — ό,τι στέλνει η φόρμα γενικών στοιχείων περνά', () => {
    const form = { name: 'Α', description: '', startDate: '', completionDate: '', address: '', city: '', category: 'residential' };
    expect(unwritableBuildingFields(form)).toEqual([]);
  });

  it('Λ2 — ό,τι στέλνει η γέννηση περνά, μαζί με το `companyId` που αγνοεί ο γραφέας', () => {
    expect(unwritableBuildingFields({ name: 'Α', code: 'Κτ-1', companyId: 'co', status: 'planning', projectId: 'p' })).toEqual([]);
  });

  it('Λ3 — πεδία συστήματος απορρίπτονται με το όνομά τους, ποτέ σιωπηλά', () => {
    expect(unwritableBuildingFields({ name: 'Α', createdBy: 'x', _v: 9, progress: 100 })).toEqual(['_v', 'createdBy', 'progress']);
    expect(() => assertBuildingFieldsWritable({ createdBy: 'x' })).toThrow('Fields not writable: createdBy');
  });

  it('Λ4 — ο κάδος δεν κατακτάται με αλλαγή `status`: εκεί οδηγεί μόνο το DELETE', () => {
    expect(() => assertBuildingFieldsWritable({ status: 'deleted' })).toThrow('Use DELETE');
    expect(() => assertBuildingFieldsWritable({ status: 'active' })).not.toThrow();
  });
});

describe('ο στόχος του δεσμού κτιρίου → έργου', () => {
  const refusal = (project: { companyId?: string | null } | null, owner: unknown): ApiError => {
    try {
      requireProjectInBuildingTenant(project, owner);
    } catch (error) {
      return error as ApiError;
    }
    throw new Error('δεν αρνήθηκε');
  };

  it('Σ1 — έργο του ίδιου χώρου περνά', () => {
    expect(() => requireProjectInBuildingTenant({ companyId: 'co_a' }, 'co_a')).not.toThrow();
  });

  it('Σ2 — 🔴 ξένο έργο απαντά ΑΚΡΙΒΩΣ ό,τι και το ανύπαρκτο', () => {
    const foreign = refusal({ companyId: 'co_b' }, 'co_a');
    const missing = refusal(null, 'co_a');
    expect(foreign.message).toBe(missing.message);
    expect(foreign.statusCode).toBe(400);
    expect(foreign.errorCode).toBe(POLICY_ERROR_CODES.PROJECT_NOT_FOUND);
  });

  it('Σ3 — έργο χωρίς ενοικιαστή δεν ανήκει σε κανέναν', () => {
    expect(refusal({ companyId: null }, 'co_a').statusCode).toBe(400);
    expect(refusal({ companyId: '' }, 'co_a').statusCode).toBe(400);
  });

  it('Σ4 — κτίριο χωρίς ενοικιαστή (ADR-232, μόνο bypass) δεν έχει χώρο να φυλαχτεί', () => {
    expect(() => requireProjectInBuildingTenant({ companyId: 'co_b' }, null)).not.toThrow();
  });
});
