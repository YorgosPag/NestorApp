/**
 * @jest-environment node
 *
 * =============================================================================
 * ΜΙΑ ΓΛΩΣΣΑ ΓΙΑ ΔΥΟ ΜΕΤΑΦΟΡΕΣ — ADR-809 · ADR-787 §5.3 ζ (όριο 1)
 * =============================================================================
 *
 * Ο ιδιωτικός χώρος είναι **σχεδιασμένη κατάσταση**, όχι βλάβη. Στον δρόμο της **Firestore**
 * την λέει το `MissingTenantError` και οι καταναλωτές δείχνουν κενό **χωρίς κόκκινη γραμμή**.
 * Από 2026-09-12 την ίδια κατάσταση απαντά και το **HTTP** (403 `MISSING_TENANT`).
 *
 * 🔴 **Αν το HTTP έλεγε άλλη λέξη**, κάθε ένας από τους ~166 καταναλωτές του `apiClient` θα
 * χρειαζόταν **δεύτερο** κριτή για την **ίδια** κατάσταση — και ο δεύτερος θα ξεχνιόταν σε
 * μισούς: το μετρημένο σχήμα του ADR-798 §21, όπου **1 στους 5** ρωτούσε τον κριτή.
 */

import { ApiClientError } from '../api-client-types';
import { MISSING_TENANT_ERROR_CODE } from '@/lib/workspace/requested-workspace-wire';
import { isMissingTenantError } from '@/services/firestore/auth-context';

/** Το σώμα που στέλνει ο `api-denial.ts` για τον δηλωμένο ιδιωτικό χώρο. */
const DENIAL_BODY = {
  error: 'This route requires an organization workspace',
  code: MISSING_TENANT_ERROR_CODE,
  details: { reason: 'workspace_personal' },
};

function errorFrom(status: number, body: unknown): ApiClientError {
  return new ApiClientError('Forbidden', status, `HTTP_${status}`, undefined, 'req_1', undefined, body);
}

describe('Κ — το σφάλμα HTTP φοράει το ΙΔΙΟ brand με τον δρόμο της Firestore', () => {
  it('Κ1 🔴 ο κριτής του ADR-809 αναγνωρίζει την άρνηση του API — χωρίς νέο λεξιλόγιο', () => {
    const error = errorFrom(403, DENIAL_BODY);

    expect(error.isMissingTenant).toBe(true);
    // ⚠️ ΑΥΤΗ είναι η γραμμή που κάνει τη δουλειά: ο **υπάρχων** κριτής, χωρίς αλλαγή.
    expect(isMissingTenantError(error)).toBe(true);
  });

  it('Κ2 — ΠΑΡΟΝΟΜΑΣΤΗΣ: κάθε άλλη άρνηση μένει βλάβη (αλλιώς θα σιωπούσαμε σφάλματα)', () => {
    const permissionDenied = errorFrom(403, {
      error: 'Permission denied',
      code: 'FORBIDDEN',
      details: { requiredPermission: 'projects:projects:view' },
    });

    expect(permissionDenied.isMissingTenant).toBe(false);
    expect(isMissingTenantError(permissionDenied)).toBe(false);
  });

  it('Κ3 — η ΛΕΞΗ αποφασίζει, όχι το status: ίδιος κωδικός σε άλλο status μετράει', () => {
    // Το status είναι **μεταφορά**· η λέξη είναι **σημασία**. Ένας έλεγχος `status === 403`
    // θα έσπαγε σιωπηλά αν η άρνηση άλλαζε μεταφορά, και θα χαρακτήριζε σχεδιασμένο κενό
    // **κάθε** 403 — δηλαδή θα έκρυβε τις αρνήσεις δικαιωμάτων.
    expect(errorFrom(409, DENIAL_BODY).isMissingTenant).toBe(true);
    expect(errorFrom(403, { error: 'x' }).isMissingTenant).toBe(false);
  });

  it('Κ4 — σώμα που δεν είναι αντικείμενο δεν ρίχνει τον φρουρό', () => {
    expect(errorFrom(502, '<html>proxy</html>').isMissingTenant).toBe(false);
    expect(errorFrom(500, undefined).isMissingTenant).toBe(false);
    expect(errorFrom(500, null).isMissingTenant).toBe(false);
  });
});
