/**
 * Ο φύλακας ιδιοκτησίας έργου — ADR-742 §7sexies
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΑΠΟΔΕΙΚΝΥΕΙ ΑΥΤΗ Η ΣΟΥΙΤΑ (και τι ΔΕΝ αρκεί να αποδειχθεί αλλού)
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Η **ταυτότητα** γνήσιου και μεταμφιεσμένου «δεν βρέθηκε» — με `toEqual`
 *    πάνω σε **ολόκληρο** το ζεύγος `{status, message, errorCode, name}`, όχι
 *    «μοιάζει». Η μισογραμμένη μεταμφίεση που αντικαταστάθηκε είχε **σωστό
 *    κείμενο και λάθος κωδικό**: ένα test που κοίταζε μόνο το μήνυμα θα ήταν
 *    πράσινο πάνω από το σφάλμα.
 * 2. Ότι ο **bypass ρόλος δεν παλινδρομεί** — η αφελής αντικατάσταση με
 *    `assertOwnedByCompany` θα του έδινε άρνηση (ADR-742 §7ter.2).
 * 3. Ότι το **κενό `companyId` δεν είναι tenant** (§4) — η παλιά σύγκριση
 *    `'' !== ''` απαντούσε «ανήκει».
 */

/** `var` επίτηδες: το `jest.mock` ανεβαίνει πάνω από κάθε `const`/`let`. */
var logInfo: jest.Mock;
var logWarn: jest.Mock;

jest.mock('@/lib/telemetry', () => {
  logInfo = jest.fn();
  logWarn = jest.fn();
  return {
    createModuleLogger: () => ({
      info: logInfo,
      warn: logWarn,
      error: jest.fn(),
      debug: jest.fn(),
    }),
  };
});

import {
  checkProjectAccess,
  requireProjectAccess,
  projectNotFound,
  PROJECT_NOT_FOUND_MESSAGE,
  type ProjectAccessCaller,
} from '../project-ownership';
import { ApiError } from '@/lib/api/api-error-types';

const CALLER: ProjectAccessCaller = {
  companyId: 'co_alpha',
  globalRole: 'company_admin',
  uid: 'u_1',
  email: 'a@alpha.gr',
};
const BYPASS: ProjectAccessCaller = { ...CALLER, globalRole: 'super_admin' };

const check = (
  projectData: { companyId?: string | null } | null | undefined,
  caller: ProjectAccessCaller = CALLER,
) => checkProjectAccess({ projectData, caller, projectId: 'prj_42', action: 'view' });

/** Το σχήμα που φτάνει στο σύρμα — ό,τι ο πελάτης μπορεί να συγκρίνει. */
const wireShapeOf = (err: ApiError) => ({
  status: err.statusCode,
  message: err.message,
  errorCode: err.errorCode,
  name: err.name,
});

beforeEach(() => {
  logInfo.mockClear();
  logWarn.mockClear();
});

// ============================================================================
describe('checkProjectAccess — η απόφαση (PDP)', () => {
  it('ίδιος tenant → owned', () => {
    expect(check({ companyId: 'co_alpha' })).toBe('owned');
  });

  it('🔴 ξένος tenant, κανονικός ρόλος → denied', () => {
    expect(check({ companyId: 'co_beta' })).toBe('denied');
  });

  it('🔴 ξένος tenant, bypass ρόλος → cross-tenant-bypass (ΟΧΙ denied) — §7ter.2', () => {
    expect(check({ companyId: 'co_beta' }, BYPASS)).toBe('cross-tenant-bypass');
  });

  it('ίδιος tenant, bypass ρόλος → owned (δεν καταγράφεται ως cross-tenant)', () => {
    expect(check({ companyId: 'co_alpha' }, BYPASS)).toBe('owned');
    expect(logInfo).not.toHaveBeenCalled();
  });

  describe('🔴 η παγίδα του κενού — §4', () => {
    it('έργο ΧΩΡΙΣ companyId δεν ανήκει σε κανέναν', () => {
      expect(check({})).toBe('denied');
      expect(check({ companyId: null })).toBe('denied');
      expect(check(undefined)).toBe('denied');
      expect(check(null)).toBe('denied');
    });

    it('🔴 κενό === κενό ΔΕΝ είναι ταίριασμα (η παλιά σύγκριση έλεγε «ανήκει»)', () => {
      const brokenToken: ProjectAccessCaller = { ...CALLER, companyId: '' };
      expect(checkProjectAccess({
        projectData: { companyId: '' },
        caller: brokenToken,
        projectId: 'prj_42',
        action: 'view',
      })).toBe('denied');
    });

    it('έργο ADR-232 (companyId: null) είναι ορατό ΜΟΝΟ στον bypass', () => {
      expect(check({ companyId: null })).toBe('denied');
      expect(check({ companyId: null }, BYPASS)).toBe('cross-tenant-bypass');
    });
  });

  describe('η καταγραφή είναι σήμα ασφαλείας, όχι διακόσμηση', () => {
    it('άρνηση → warn με ταυτότητα καλούντα, έργου και μονοπατιού', () => {
      checkProjectAccess({
        projectData: { companyId: 'co_beta' },
        caller: CALLER,
        projectId: 'prj_42',
        action: 'delete',
      });
      expect(logWarn).toHaveBeenCalledTimes(1);
      expect(logWarn.mock.calls[0][1]).toEqual({
        action: 'delete',
        projectId: 'prj_42',
        uid: 'u_1',
        userCompanyId: 'co_alpha',
        projectCompanyId: 'co_beta',
      });
    });

    it('🔴 cross-tenant θέαση υπεργραφείου → info (ο απορροφημένος log-only κλάδος)', () => {
      check({ companyId: 'co_beta' }, BYPASS);
      expect(logInfo).toHaveBeenCalledTimes(1);
      expect(logInfo.mock.calls[0][1]).toEqual({
        action: 'view',
        projectId: 'prj_42',
        email: 'a@alpha.gr',
        projectCompanyId: 'co_beta',
      });
      expect(logWarn).not.toHaveBeenCalled();
    });

    it('η καταγραφή γίνεται ΠΡΙΝ φτάσει η άρνηση στον καλούντα', () => {
      expect(() =>
        requireProjectAccess({
          projectData: { companyId: 'co_beta' },
          caller: CALLER,
          projectId: 'prj_42',
          action: 'update',
        }),
      ).toThrow();
      expect(logWarn).toHaveBeenCalledTimes(1);
    });
  });
});

// ============================================================================
describe('requireProjectAccess — η επιβολή (PEP)', () => {
  it('owned → σιωπηλή επιστροφή', () => {
    expect(() =>
      requireProjectAccess({
        projectData: { companyId: 'co_alpha' },
        caller: CALLER,
        projectId: 'prj_42',
        action: 'view',
      }),
    ).not.toThrow();
  });

  it('🔴 bypass σε ξένο έργο → ΔΕΝ ρίχνει (παλινδρόμηση αν ρίξει) — §7ter.2', () => {
    expect(() =>
      requireProjectAccess({
        projectData: { companyId: 'co_beta' },
        caller: BYPASS,
        projectId: 'prj_42',
        action: 'view',
      }),
    ).not.toThrow();
  });

  it('denied → ρίχνει ApiError', () => {
    let thrown: unknown;
    try {
      requireProjectAccess({
        projectData: { companyId: 'co_beta' },
        caller: CALLER,
        projectId: 'prj_42',
        action: 'view',
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ApiError);
  });
});

// ============================================================================
describe('🔴 Η ΤΑΥΤΟΤΗΤΑ — γνήσιο και μεταμφιεσμένο είναι ΙΣΑ, όχι «μοιάζουν»', () => {
  /** Ό,τι θα έριχνε ο κλάδος `!doc.exists`. */
  const genuine = projectNotFound();

  /** Ό,τι ρίχνει η άρνηση ιδιοκτησίας. */
  const disguised = (() => {
    try {
      requireProjectAccess({
        projectData: { companyId: 'co_beta' },
        caller: CALLER,
        projectId: 'prj_42',
        action: 'view',
      });
    } catch (e) {
      return e as ApiError;
    }
    throw new Error('η άρνηση δεν έριξε — το test δεν μετρά τίποτα');
  })();

  it('ολόκληρο το σχήμα του σύρματος είναι ΙΣΟ (status + μήνυμα + κωδικός + name)', () => {
    expect(wireShapeOf(disguised)).toEqual(wireShapeOf(genuine));
  });

  it('🔴 ο κωδικός είναι 404 — ΟΧΙ 403 (το σφάλμα που αντικαταστάθηκε)', () => {
    expect(disguised.statusCode).toBe(404);
  });

  it('🔴 το μήνυμα ΔΕΝ φέρει πρόθεμα «Access denied» (το δεύτερο σκέλος του ίδιου σφάλματος)', () => {
    expect(disguised.message).toBe(PROJECT_NOT_FOUND_MESSAGE);
    expect(disguised.message).not.toMatch(/access denied/i);
  });

  it('το εργοστάσιο δεν δέχεται ορίσματα — δεν υπάρχει τιμή που να μπορεί να αποκλίνει', () => {
    expect(projectNotFound.length).toBe(0);
    expect(wireShapeOf(projectNotFound())).toEqual(wireShapeOf(projectNotFound()));
  });
});
