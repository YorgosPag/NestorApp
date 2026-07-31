/**
 * Οι **μεταβολές** έργου περνούν από τον ίδιο φύλακα — ADR-742 §7sexies
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΑΠΟΔΕΙΚΝΥΕΤΑΙ ΕΔΩ ΚΑΙ ΠΟΥΘΕΝΑ ΑΛΛΟΥ
 * ─────────────────────────────────────────────────────────────────────────────
 * Στις αναγνώσεις, φύλακας που τρέχει «λίγο αργότερα» διαρρέει πληροφορία.
 * Στις **μεταβολές** αλλάζει **ξένα δεδομένα** — και μετά η άρνηση δεν
 * αναιρείται. Γι' αυτό η σειρά ελέγχεται ρητά: όταν η απόφαση είναι άρνηση,
 * **καμία** εγγραφή, **κανένα** ίχνος ελέγχου, **καμία** ακύρωση λανθάνουσας
 * μνήμης δεν πρέπει να έχει συμβεί.
 *
 * Η `handleUpdateProject` ήταν **το μόνο** από τα δέκα σημεία που ρωτούσε ήδη
 * σωστά το κενό `companyId` (`!projectData?.companyId || …`). Τα υπόλοιπα εννιά
 * όχι — εδώ κατοχυρώνεται ότι πλέον ρωτούν **όλα** το ίδιο (§4).
 */

jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

var storedProject: { companyId?: string | null; name?: string } | null = null;

/** Κάθε παρενέργεια που ΔΕΝ πρέπει να συμβεί σε άρνηση. */
var sideEffects: string[] = [];

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: () => ({
      doc: () => ({
        get: async () => ({
          exists: storedProject !== null,
          id: 'prj_42',
          data: () => storedProject ?? undefined,
        }),
      }),
    }),
  }),
}));

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'ts' },
}));

jest.mock('@/lib/auth', () => ({
  logAuditEvent: async () => {
    sideEffects.push('logAuditEvent');
  },
}));

jest.mock('@/lib/firestore/version-check', () => ({
  withVersionCheck: async () => {
    sideEffects.push('write');
    return { newVersion: 2 };
  },
  ConflictError: class ConflictError extends Error {},
}));

jest.mock('@/lib/firestore/soft-delete-engine', () => ({
  softDelete: async () => {
    sideEffects.push('softDelete');
  },
}));

jest.mock('@/lib/firestore/deletion-guard', () => ({
  checkDeletionDependencies: async () => {
    sideEffects.push('checkDeletionDependencies');
    return { allowed: true, dependencies: [] };
  },
}));

jest.mock('@/lib/firestore/entity-linking.service', () => ({
  linkEntity: async () => undefined,
}));

jest.mock('@/lib/cache/enterprise-api-cache', () => ({
  EnterpriseAPICache: {
    getInstance: () => ({
      delete: () => {
        sideEffects.push('cacheInvalidate');
      },
    }),
  },
}));

jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: {
    diffFieldsWithResolution: async () => [],
    recordChange: async () => {
      sideEffects.push('entityAudit');
    },
  },
  resolveUserDisplayName: async () => 'Χρήστης',
}));

import type { NextRequest } from 'next/server';
import type { AuthContext } from '@/lib/auth/types';
import { ApiError } from '@/lib/api/api-error-types';
import { handleUpdateProject, handleDeleteProject } from '../project-mutations.service';
import { projectNotFound, PROJECT_NOT_FOUND_MESSAGE } from '../../_shared/project-ownership';

const caller = (overrides: Partial<AuthContext> = {}): AuthContext =>
  ({
    uid: 'u_1',
    email: 'a@alpha.gr',
    companyId: 'co_alpha',
    globalRole: 'company_admin',
    mfaEnrolled: true,
    isAuthenticated: true,
    ...overrides,
  }) as AuthContext;

const body = (payload: unknown = { name: 'Νέο όνομα' }) =>
  ({ json: async () => payload }) as unknown as NextRequest;

const wire = (e: ApiError) => ({
  status: e.statusCode,
  message: e.message,
  errorCode: e.errorCode,
});

/** Τρέχει μια μεταβολή και επιστρέφει ό,τι έριξε, ή `null`. */
async function refusalOf(run: () => Promise<unknown>): Promise<ApiError | null> {
  try {
    await run();
    return null;
  } catch (e) {
    return e as ApiError;
  }
}

beforeEach(() => {
  storedProject = { companyId: 'co_alpha', name: 'Έργο Α' };
  sideEffects = [];
});

// ============================================================================
describe.each([
  {
    label: 'handleUpdateProject',
    run: (ctx: AuthContext) => handleUpdateProject(body(), ctx, 'prj_42'),
    writeEffect: 'write',
  },
  {
    label: 'handleDeleteProject',
    run: (ctx: AuthContext) => handleDeleteProject(body(), ctx, 'prj_42'),
    writeEffect: 'softDelete',
  },
])('$label — ο φύλακας ιδιοκτησίας', ({ run, writeEffect }) => {
  it('ίδιος tenant → η μεταβολή εκτελείται', async () => {
    expect(await refusalOf(() => run(caller()))).toBeNull();
    expect(sideEffects).toContain(writeEffect);
  });

  it('🔴 ξένο έργο → μεταμφιεσμένο 404, ΙΣΟ με το γνήσιο «δεν βρέθηκε»', async () => {
    storedProject = null;
    const genuine = await refusalOf(() => run(caller()));

    storedProject = { companyId: 'co_beta' };
    const disguised = await refusalOf(() => run(caller()));

    expect(genuine).toBeInstanceOf(ApiError);
    expect(disguised).toBeInstanceOf(ApiError);
    expect(wire(disguised!)).toEqual(wire(genuine!));
    expect(wire(genuine!)).toEqual(wire(projectNotFound()));
  });

  it('🔴 το παλιό `403 Access denied - Project not found` δεν επιστρέφεται πια', async () => {
    storedProject = { companyId: 'co_beta' };
    const e = (await refusalOf(() => run(caller())))!;
    expect(e.statusCode).toBe(404);
    expect(e.message).toBe(PROJECT_NOT_FOUND_MESSAGE);
  });

  it('🔴 Η ΣΕΙΡΑ: άρνηση → ΚΑΜΙΑ παρενέργεια (ούτε εγγραφή, ούτε ίχνος, ούτε cache)', async () => {
    storedProject = { companyId: 'co_beta' };
    await refusalOf(() => run(caller()));
    expect(sideEffects).toEqual([]);
  });

  it('🔴 bypass ρόλος σε ξένο έργο → η μεταβολή εκτελείται (παλινδρόμηση αν αρνηθεί)', async () => {
    storedProject = { companyId: 'co_beta' };
    expect(await refusalOf(() => run(caller({ globalRole: 'super_admin' })))).toBeNull();
    expect(sideEffects).toContain(writeEffect);
  });

  it('🔴 bypass ρόλος σε ΑΝΥΠΑΡΚΤΟ έργο → 404, καμία εγγραφή σε φάντασμα', async () => {
    // Ο έλεγχος ύπαρξης δεν είναι πλεονασμός: ο φύλακας ιδιοκτησίας λέει
    // «πέρνα» στον υπεργραφέα, οπότε **μόνο** ο έλεγχος ύπαρξης τον σταματά.
    storedProject = null;
    const e = (await refusalOf(() => run(caller({ globalRole: 'super_admin' }))))!;
    expect(e.statusCode).toBe(404);
    expect(sideEffects).toEqual([]);
  });

  describe('🔴 η παγίδα του κενού — §4', () => {
    it('έργο ΧΩΡΙΣ companyId → άρνηση, χωρίς παρενέργειες', async () => {
      storedProject = {};
      const e = (await refusalOf(() => run(caller())))!;
      expect(e.statusCode).toBe(404);
      expect(sideEffects).toEqual([]);
    });

    it('χαλασμένο token (κενό companyId) πάνω σε έργο με κενό companyId → άρνηση', async () => {
      storedProject = { companyId: '' };
      const e = (await refusalOf(() => run(caller({ companyId: '' })))) as ApiError;
      expect(e).toBeInstanceOf(ApiError);
      expect(e.statusCode).toBe(404);
      expect(sideEffects).toEqual([]);
    });
  });
});

// ============================================================================
describe('handleUpdateProject — η επικύρωση προηγείται της ανάγνωσης', () => {
  it('κενό σώμα → 400, χωρίς παρενέργειες', async () => {
    const e = (await refusalOf(() => handleUpdateProject(body({}), caller(), 'prj_42')))!;
    expect(e.statusCode).toBe(400);
    expect(sideEffects).toEqual([]);
  });
});
