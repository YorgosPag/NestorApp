/**
 * @fileoverview **ΑΓΚΥΡΕΣ: «ΠΟΙΟΝ ΧΩΡΟ ΖΗΤΑ Ο ΠΕΛΑΤΗΣ;» — ΜΙΑ ΑΠΑΝΤΗΣΗ** (ADR-849 Β1 · ADR-787 §5.3 ζ).
 * @related services/firestore/super-admin-active-company · lib/api/company-scope-source
 *
 * 🔴 Η ζωντανή βλάβη: σύνδεσμος email προς `/o/<ΠΑΓΩΝΗΣ>/properties/<id>` έδειξε «δεν
 * βρέθηκε», γιατί ο πελάτης ρωτούσε τον **επιλογέα** (`localStorage`) και όχι τη διεύθυνση.
 * Αυτές οι άγκυρες κλειδώνουν τη **σειρά** της απάντησης και ότι η κεφαλίδα HTTP ρωτά την
 * **ίδια** απάντηση, όχι αντίγραφο.
 */

import {
  getClientWorkspaceScope,
  onSuperAdminActiveCompanyChange,
  requestedCompanyId,
  requestedWorkspace,
  requestedWorkspaceKey,
  setSuperAdminActiveCompanyId,
  setUrlWorkspaceScope,
} from '../super-admin-active-company';
import { requestedCompanyScope } from '@/lib/api/company-scope-source';
import { orgWorkspace, personalWorkspace } from '@/types/workspace-membership';

const A = 'comp_aaaa';
const B = 'comp_bbbb';

beforeEach(() => {
  setUrlWorkspaceScope(null);
  setSuperAdminActiveCompanyId(null);
});

describe('requestedWorkspace — η σειρά: διεύθυνση ▸ επιλογέας ▸ τίποτα', () => {
  it('Σ1: τίποτα ⇒ default', () => {
    expect(requestedWorkspace()).toEqual({ kind: 'default' });
  });

  it('Σ2: μόνο επιλογέας (εκτός `/o/`) ⇒ αυτή η εταιρεία', () => {
    setSuperAdminActiveCompanyId(B);
    expect(requestedWorkspace()).toEqual({ kind: 'org', companyId: B });
  });

  it('Σ3 🔴 διεύθυνση + διαφορετικός επιλογέας ⇒ ΝΙΚΑ Η ΔΙΕΥΘΥΝΣΗ (η βλάβη του Β1)', () => {
    setSuperAdminActiveCompanyId(B);
    setUrlWorkspaceScope(orgWorkspace(A));
    expect(requestedWorkspace()).toEqual({ kind: 'org', companyId: A });
  });

  it('Σ4 🔴 ιδιωτικός χώρος ⇒ personal, ΑΚΟΜΑ ΚΑΙ με επιλογέα (ποτέ καθολική όψη)', () => {
    setSuperAdminActiveCompanyId(B);
    setUrlWorkspaceScope(personalWorkspace('uid_1'));
    expect(requestedWorkspace()).toEqual({ kind: 'personal' });
    expect(requestedCompanyId()).toBeNull();
  });

  it('Σ5: έξοδος από τον χώρο ⇒ ξανά ο επιλογέας', () => {
    setSuperAdminActiveCompanyId(B);
    setUrlWorkspaceScope(orgWorkspace(A));
    setUrlWorkspaceScope(null);
    expect(requestedWorkspace()).toEqual({ kind: 'org', companyId: B });
  });

  it('Σ6: κλειδί — πρωτογενές, ένα ανά κατάσταση', () => {
    expect(requestedWorkspaceKey()).toBe('default');
    setUrlWorkspaceScope(orgWorkspace(A));
    expect(requestedWorkspaceKey()).toBe(`org:${A}`);
    setUrlWorkspaceScope(personalWorkspace('uid_1'));
    expect(requestedWorkspaceKey()).toBe('personal');
  });
});

describe('το store — ισότητα κατά τιμή, σταθερό στιγμιότυπο', () => {
  it('Ι1: ίδιος χώρος με ΝΕΟ αντικείμενο ⇒ καμία ειδοποίηση (αλλιώς κάθε απόδοση του φύλακα ξαναστήνει κάθε ακροατή)', () => {
    setUrlWorkspaceScope(orgWorkspace(A));
    const listener = jest.fn();
    const unsubscribe = onSuperAdminActiveCompanyChange(listener);
    setUrlWorkspaceScope(orgWorkspace(A));
    expect(listener).not.toHaveBeenCalled();
    setUrlWorkspaceScope(orgWorkspace(B));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('Ι2: το στιγμιότυπο κρατά την ίδια αναφορά μέχρι να αλλάξει (ασφαλές `getSnapshot`)', () => {
    setUrlWorkspaceScope(orgWorkspace(A));
    const first = getClientWorkspaceScope();
    setUrlWorkspaceScope(orgWorkspace(A));
    expect(getClientWorkspaceScope()).toBe(first);
  });
});

describe('η κεφαλίδα HTTP ρωτά την ΙΔΙΑ απάντηση', () => {
  it('Κ1: η υποδοχή του client επιστρέφει ό,τι λέει το `requestedWorkspace`', () => {
    expect(requestedCompanyScope()).toBeNull();
    setSuperAdminActiveCompanyId(B);
    expect(requestedCompanyScope()).toBe(B);
    setUrlWorkspaceScope(orgWorkspace(A));
    expect(requestedCompanyScope()).toBe(A);
    setUrlWorkspaceScope(personalWorkspace('uid_1'));
    expect(requestedCompanyScope()).toBeNull();
  });
});
