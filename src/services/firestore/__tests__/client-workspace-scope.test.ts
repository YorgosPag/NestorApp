/**
 * @fileoverview **ΑΓΚΥΡΕΣ: «ΠΟΙΟΝ ΧΩΡΟ ΖΗΤΑ Ο ΠΕΛΑΤΗΣ;» — ΜΙΑ ΑΠΑΝΤΗΣΗ** (ADR-849 Β1 · ADR-787 §5.3 ζ).
 * @related services/firestore/super-admin-active-company · lib/api/workspace-scope-source
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
import { requestedWorkspaceScope } from '@/lib/api/workspace-scope-source';
import { serializeRequestedWorkspace } from '@/lib/workspace/requested-workspace-wire';
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
    expect(requestedWorkspaceScope()).toEqual({ kind: 'default' });
    setSuperAdminActiveCompanyId(B);
    expect(requestedWorkspaceScope()).toEqual({ kind: 'org', companyId: B });
    setUrlWorkspaceScope(orgWorkspace(A));
    expect(requestedWorkspaceScope()).toEqual({ kind: 'org', companyId: A });
  });

  /**
   * 🔴 Η ΑΓΚΥΡΑ ΤΟΥ ΟΡΙΟΥ (1) — ADR-787 §5.3 ζ, 2026-09-12.
   *
   * Μέχρι σήμερα η υποδοχή επέστρεφε `string | null`, άρα ο **ιδιωτικός** χώρος και το
   * «η διεύθυνση δεν ονομάζει χώρο» έδιναν **την ίδια** τιμή (`null`) ⇒ καμία κεφαλίδα ⇒
   * ο διακομιστής έδινε καθολική όψη στον super-admin μέσα στο `/o/me`.
   *
   * ⚠️ Η μετάλλαξη που σκοτώνει: `requestedWorkspace()` να επιστρέφει `{kind:'default'}`
   * για τον ιδιωτικό χώρο — τότε το σύρμα λέει `default` και ο διακομιστής **δεν** αρνείται.
   */
  it('Κ2 🔴 ο ιδιωτικός χώρος είναι ΡΗΤΗ δήλωση στο σύρμα, ΠΟΤΕ σιωπή', () => {
    setSuperAdminActiveCompanyId(B);
    setUrlWorkspaceScope(personalWorkspace('uid_1'));

    expect(requestedWorkspaceScope()).toEqual({ kind: 'personal' });
    expect(serializeRequestedWorkspace(requestedWorkspaceScope())).toBe('personal');
  });

  it('Κ3: κάθε κατάσταση φεύγει στο σύρμα με τη ΜΙΑ γραμματική', () => {
    expect(serializeRequestedWorkspace(requestedWorkspaceScope())).toBe('default');
    setUrlWorkspaceScope(orgWorkspace(A));
    expect(serializeRequestedWorkspace(requestedWorkspaceScope())).toBe(`org:${A}`);
  });
});
