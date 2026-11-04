/**
 * Το σύνορο αποκάλυψης των προμηθειών — ADR-742 Ομάδα 2
 *
 * 🔴 Ο **πυρήνας** αυτής της σουίτας είναι ένας και μόνο ισχυρισμός: ό,τι
 * φεύγει στο σύρμα για «ανήκει αλλού» πρέπει να είναι **ίσο** με ό,τι φεύγει
 * για «δεν υπάρχει» — `toEqual`, όχι «μοιάζει» (ADR-742 §3.4, §7.1).
 *
 * Τα υπόλοιπα tests υπάρχουν για να μη γίνει αυτός ο ισχυρισμός πράσινος για
 * λάθος λόγο: αν η μεταμφίεση ίσχυε για **όλους**, η ταυτότητα θα κρατούσε
 * αλλά ο bypass ρόλος θα έχανε τη διάγνωσή του· αν δεν ίσχυε για κανέναν, θα
 * κρατούσε επίσης — και το μαντείο θα ήταν ορθάνοιχτο.
 */

import { ProcurementRuleError } from '@/subapps/procurement/services/procurement-rule-error';
import { resolveProcurementErrorOutcome } from '../procurement-error-outcome';
import {
  PROCUREMENT_RESOURCE,
  ProcurementCrossTenantError,
  procurementNotFound,
} from '@/subapps/procurement/services/procurement-ownership';
import {
  FRAMEWORK_AGREEMENT_AMBIGUOUS_CODE,
  FRAMEWORK_AGREEMENT_NUMBER_TAKEN_CODE,
  FrameworkAgreementNumberConflictError,
  FrameworkAgreementValidationError,
} from '@/subapps/procurement/types/framework-agreement';
import { MATERIAL_CODE_TAKEN_CODE, MaterialCodeConflictError } from '@/subapps/procurement/types/material';

const SUBJECT = {
  resource: PROCUREMENT_RESOURCE.MATERIAL,
  resourceId: 'mat_abc123',
} as const;

const BYPASS_ROLE = 'super_admin';
const NORMAL_ROLE = 'company_admin';

const BASE = {
  fallbackError: 'Failed to update material',
  conflictName: 'MaterialCodeConflictError',
  validationName: 'MaterialValidationError',
  mode: 'mutation',
} as const;

function outcomeFor(error: unknown, callerGlobalRole: string) {
  return resolveProcurementErrorOutcome(error, { ...BASE, callerGlobalRole });
}

describe('δηλωμένος κωδικός σφάλματος (ADR-923 §5.11 «3γ» Βήμα 2)', () => {
  it('το σφάλμα που τον δηλώνει τον φτάνει στο σύρμα, για να τον μεταφράσει η φόρμα', () => {
    const ambiguous = new FrameworkAgreementValidationError('scope', 'Ambiguous', FRAMEWORK_AGREEMENT_AMBIGUOUS_CODE);
    expect(outcomeFor(ambiguous, NORMAL_ROLE).errorCode).toBe(FRAMEWORK_AGREEMENT_AMBIGUOUS_CODE);
    expect(outcomeFor(new MaterialCodeConflictError('M1', 'mat_1'), NORMAL_ROLE).errorCode).toBe(MATERIAL_CODE_TAKEN_CODE);
    expect(
      outcomeFor(new FrameworkAgreementNumberConflictError('F1', 'fwa_1'), NORMAL_ROLE).errorCode,
    ).toBe(FRAMEWORK_AGREEMENT_NUMBER_TAKEN_CODE);
  });

  it('σφάλμα χωρίς κωδικό ⇒ κανένα πεδίο, όχι `undefined`', () => {
    expect(outcomeFor(new Error('kaboom'), NORMAL_ROLE)).not.toHaveProperty('errorCode');
    expect(outcomeFor(new FrameworkAgreementValidationError('title', 'Title is required'), NORMAL_ROLE)).not.toHaveProperty('errorCode');
  });

  it('η μεταμφίεση δεν αποκτά κωδικό που θα τη διέκρινε από το γνήσιο 404', () => {
    const concealed = outcomeFor(
      new ProcurementCrossTenantError({ ...SUBJECT, expectedCompanyId: 'co1', actualCompanyId: 'co2' }),
      NORMAL_ROLE,
    );
    expect(concealed).not.toHaveProperty('errorCode');
  });
});

/** Ό,τι βλέπει ο έξω κόσμος — και **μόνο** αυτό. */
function wire(outcome: { status: number; message: string }) {
  return { status: outcome.status, message: outcome.message };
}

const crossTenant = () =>
  new ProcurementCrossTenantError({
    ...SUBJECT,
    expectedCompanyId: 'co1',
    actualCompanyId: 'co2',
  });

// ============================================================================
// 🔴 Ο ΠΥΡΗΝΑΣ
// ============================================================================

describe('η ταυτότητα γνήσιου και μεταμφιεσμένου', () => {
  it('🔴 κανονικός χρήστης: «ανήκει αλλού» είναι ΙΣΟ με «δεν υπάρχει»', () => {
    const genuine = outcomeFor(procurementNotFound(SUBJECT), NORMAL_ROLE);
    const disguised = outcomeFor(crossTenant(), NORMAL_ROLE);

    expect(wire(disguised)).toEqual(wire(genuine));
    expect(wire(disguised)).toEqual({ status: 404, message: 'Material mat_abc123 not found' });
  });

  it('η ταυτότητα κρατά και για άλλον πόρο — δεν είναι καρφωμένη σε ένα κείμενο', () => {
    const subject = { resource: PROCUREMENT_RESOURCE.RFQ, resourceId: 'rfq_9' } as const;
    const genuine = outcomeFor(procurementNotFound(subject), NORMAL_ROLE);
    const disguised = outcomeFor(
      new ProcurementCrossTenantError({
        ...subject,
        expectedCompanyId: 'co1',
        actualCompanyId: 'co2',
      }),
      NORMAL_ROLE,
    );

    expect(wire(disguised)).toEqual(wire(genuine));
    expect(disguised.message).toBe('RFQ rfq_9 not found');
  });

  it('η λέξη «Forbidden» δεν φεύγει ποτέ στο σύρμα για κανονικό χρήστη', () => {
    expect(outcomeFor(crossTenant(), NORMAL_ROLE).message).not.toContain('Forbidden');
  });
});

// ============================================================================
// Ο ΚΑΝΟΝΑΣ ΑΠΟΚΑΛΥΨΗΣ
// ============================================================================

describe('ο κανόνας αποκάλυψης — ο ρόλος αλλάζει τι λέμε, όχι τι δίνουμε', () => {
  it('bypass ρόλος: ειλικρινές 403 (έχει ήδη cross-tenant ορατότητα)', () => {
    expect(wire(outcomeFor(crossTenant(), BYPASS_ROLE))).toEqual({
      status: 403,
      message: 'Forbidden',
    });
  });

  it('κανονικός ρόλος: μεταμφιεσμένο 404', () => {
    expect(outcomeFor(crossTenant(), NORMAL_ROLE).status).toBe(404);
  });

  it.each(['company_admin', 'project_manager', 'viewer', '', 'unknown_role'])(
    'μη-bypass ρόλος «%s» δεν παίρνει ποτέ 403',
    (role) => {
      expect(outcomeFor(crossTenant(), role).status).toBe(404);
    },
  );

  it('🔴 και στους δύο κλάδους ο πόρος ΔΕΝ παραδίδεται — αλλάζει μόνο η διατύπωση', () => {
    // Η ίδια η υπηρεσία έχει ήδη αρνηθεί· το σύνορο δεν έχει έγγραφο να δώσει.
    for (const role of [BYPASS_ROLE, NORMAL_ROLE]) {
      expect(outcomeFor(crossTenant(), role).status).toBeGreaterThanOrEqual(400);
    }
  });
});

// ============================================================================
// ΤΟ LOG ΚΡΑΤΑ ΤΗΝ ΑΛΗΘΕΙΑ
// ============================================================================

describe('το log δεν μεταμφιέζεται', () => {
  it('η μεταμφίεση αφορά μόνο το σύρμα — το log λέει ποιος ζήτησε τι', () => {
    const outcome = outcomeFor(crossTenant(), NORMAL_ROLE);
    expect(outcome.logMessage).toContain('Cross-tenant access blocked');
    expect(outcome.logMessage).toContain('mat_abc123');
    expect(outcome.logMessage).toContain('co1');
    expect(outcome.logMessage).toContain('co2');
    // ...και δεν είναι το ίδιο με ό,τι είδε ο καλών.
    expect(outcome.logMessage).not.toBe(outcome.message);
  });

  it('ο bypass ρόλος παίρνει την ίδια αλήθεια στο log', () => {
    expect(outcomeFor(crossTenant(), BYPASS_ROLE).logMessage).toBe(
      outcomeFor(crossTenant(), NORMAL_ROLE).logMessage,
    );
  });

  it('έγγραφο χωρίς tenant καταγράφεται ως `<none>`, όχι ως κενό', () => {
    const denial = new ProcurementCrossTenantError({
      ...SUBJECT,
      expectedCompanyId: 'co1',
      actualCompanyId: '',
    });
    expect(outcomeFor(denial, NORMAL_ROLE).logMessage).toContain('owner=<none>');
  });
});

// ============================================================================
// ΟΙ ΥΠΟΛΟΙΠΟΙ ΚΛΑΔΟΙ — να μη σπάσει ό,τι δούλευε
// ============================================================================

describe('οι κληρονομημένοι κλάδοι', () => {
  it('τυποποιημένο «δεν βρέθηκε» → 404 με το δικό του μήνυμα', () => {
    expect(wire(outcomeFor(procurementNotFound(SUBJECT), NORMAL_ROLE))).toEqual({
      status: 404,
      message: 'Material mat_abc123 not found',
    });
  });

  it('ονομασμένο σφάλμα σύγκρουσης → 409', () => {
    const conflict = new Error('duplicate code');
    conflict.name = 'MaterialCodeConflictError';
    expect(outcomeFor(conflict, NORMAL_ROLE).status).toBe(409);
  });

  it('ονομασμένο σφάλμα επικύρωσης → 400', () => {
    const invalid = new Error('bad field');
    invalid.name = 'MaterialValidationError';
    expect(outcomeFor(invalid, NORMAL_ROLE).status).toBe(400);
  });

  it('άγνωστο σφάλμα → 400 σε mutation, με το fallbackError — ΟΧΙ το ωμό μήνυμα (ADR-603 §Ασπίδα)', () => {
    const outcome = outcomeFor(new Error('boom'), NORMAL_ROLE);
    expect(wire(outcome)).toEqual({ status: 400, message: 'Failed to update material' });
    expect(outcome.logMessage).toBe('boom');
  });

  it('`ProcurementRuleError` → 400 σε mutation, με το μήνυμά του (γραμμένο για τον πελάτη)', () => {
    expect(wire(outcomeFor(new ProcurementRuleError('Cannot edit PO in status: ordered'), NORMAL_ROLE))).toEqual({
      status: 400,
      message: 'Cannot edit PO in status: ordered',
    });
  });

  it('άγνωστο σφάλμα → 500 σε create', () => {
    const outcome = resolveProcurementErrorOutcome(new Error('boom'), {
      ...BASE,
      mode: 'create',
      callerGlobalRole: NORMAL_ROLE,
    });
    expect(outcome.status).toBe(500);
  });

  it('σφάλμα χωρίς μήνυμα → το fallback του route', () => {
    expect(outcomeFor({ nope: true }, NORMAL_ROLE).message).toBe('Failed to update material');
  });

  it('🔴 η ιδιοκτησία κρίνεται ΠΡΙΝ τη λειτουργία create — αλλιώς σιωπηλό 500', () => {
    const outcome = resolveProcurementErrorOutcome(crossTenant(), {
      ...BASE,
      mode: 'create',
      callerGlobalRole: NORMAL_ROLE,
    });
    expect(outcome.status).toBe(404);
  });
});
