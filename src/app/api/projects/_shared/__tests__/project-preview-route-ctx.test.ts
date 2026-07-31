/**
 * Ο εκτελεστής παραδίδει τον **σωστό καλούντα** — ADR-742 §7.8 / §7sexies
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΜΟΝΑΔΙΚΗ ΔΟΥΛΕΙΑ ΑΥΤΗΣ ΤΗΣ ΣΟΥΙΤΑΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Όλη η απόφαση ιδιοκτησίας των **έξι** διαδρομών προεπισκόπησης κρέμεται από
 * **μία** μεταβλητή: το `ctx` που ο εκτελεστής παραδίδει στον φύλακα. Ένα
 * καρφωμένο `'super_admin'` — ή ένα καρφωμένο `companyId` — σε αυτό το σημείο
 * θα άνοιγε το μαντείο ύπαρξης για έξι διαδρομές μαζί, και **κάθε άλλο test θα
 * έμενε πράσινο**: τα υπόλοιπα ελέγχουν τον *φύλακα*, όχι ποιος του δίνει τον
 * καλούντα.
 *
 * Ελέγχει επίσης τη **σειρά** των βημάτων: ο φύλακας πρέπει να τρέχει **πριν**
 * τον υπολογισμό της προεπισκόπησης, γιατί εκείνος διαβάζει σχέσεις ολόκληρου
 * του έργου. Σειρά αντεστραμμένη διαρρέει *περιεχόμενο*, όχι απλώς ύπαρξη.
 *
 * Ίδιο σχήμα με το `rfq-id-route-ctx.test.ts` της Ομάδας 2.
 */

jest.mock('next/server', () => {
  class MockNextResponse {
    static json(body: unknown, init?: { status?: number }) {
      return { status: init?.status ?? 200, json: async () => body };
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

/** Ο ρόλος που φοράει ο «συνδεδεμένος» χρήστης σε κάθε test. */
var currentRole = 'company_admin';
/** Ο tenant του καλούντα — ξεχωριστά, ώστε να πιάνεται και καρφωμένο `companyId`. */
var currentCompanyId = 'co_alpha';

jest.mock('@/lib/auth', () => ({
  withAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown) =>
      callback(
        request,
        { uid: 'u_1', email: 'a@alpha.gr', companyId: currentCompanyId, globalRole: currentRole },
        { cache: true },
      ),
}));

/** Ο ρυθμιστής ρυθμού καταγράφεται αντί να εκτελεστεί — μας ενδιαφέρει ΟΤΙ μπήκε. */
var rateLimited: unknown[] = [];
jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withStandardRateLimit: (handler: unknown) => {
    rateLimited.push(handler);
    return handler;
  },
}));

/** Τι «υπάρχει» στη βάση σε κάθε test. */
var storedProject: { companyId?: string | null } | null = null;

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

import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { ApiError } from '@/lib/api/api-error-types';
import { projectPreviewRoute } from '../project-preview-route';
import { projectNotFound } from '../project-ownership';
import type { ProjectMutationImpactPreview } from '@/types/project-mutation-impact';

const seg = { params: Promise.resolve({ projectId: 'prj_42' }) };
const req = { json: async () => ({ ok: true }) } as unknown as NextRequest;

const PREVIEW = { warnings: [], blocking: [] } as unknown as ProjectMutationImpactPreview;

/** Καταγράφει αν και με τι κλήθηκε το επιχειρησιακό βήμα. */
var previewCalls: Array<{ projectId: string; callerCompanyId: string }> = [];

const route = projectPreviewRoute({
  schema: z.object({ ok: z.boolean() }),
  action: 'test-preview',
  preview: async ({ projectId, ctx }) => {
    previewCalls.push({ projectId, callerCompanyId: ctx.companyId });
    return PREVIEW;
  },
});

/** Το σχήμα που ο πελάτης μπορεί να συγκρίνει. */
const wireShapeOf = (err: ApiError) => ({
  status: err.statusCode,
  message: err.message,
  errorCode: err.errorCode,
  name: err.name,
});

/** Τρέχει τη διαδρομή και επιστρέφει ό,τι έριξε — ή `null` αν πέτυχε. */
async function refusalOf(): Promise<ApiError | null> {
  try {
    await route(req, seg);
    return null;
  } catch (e) {
    return e as ApiError;
  }
}

beforeEach(() => {
  currentRole = 'company_admin';
  currentCompanyId = 'co_alpha';
  storedProject = { companyId: 'co_alpha' };
  previewCalls = [];
});

// ============================================================================
describe('projectPreviewRoute — ο πραγματικός καλών φτάνει στον φύλακα', () => {
  it('ίδιος tenant → η προεπισκόπηση εκτελείται', async () => {
    expect(await refusalOf()).toBeNull();
    expect(previewCalls).toEqual([{ projectId: 'prj_42', callerCompanyId: 'co_alpha' }]);
  });

  it('🔴 ξένο έργο, κανονικός ρόλος → μεταμφιεσμένο 404 (ΟΧΙ καρφωμένος bypass)', async () => {
    storedProject = { companyId: 'co_beta' };
    const refusal = await refusalOf();
    expect(refusal).toBeInstanceOf(ApiError);
    expect(refusal!.statusCode).toBe(404);
  });

  it('🔴 ξένο έργο, bypass ρόλος → ΠΕΡΝΑ (παλινδρόμηση αν αρνηθεί) — §7ter.2', async () => {
    storedProject = { companyId: 'co_beta' };
    currentRole = 'super_admin';
    expect(await refusalOf()).toBeNull();
    expect(previewCalls).toHaveLength(1);
  });

  it('🔴 ο ΙΔΙΟΣ εκτελεστής δίνει ΔΙΑΦΟΡΕΤΙΚΟ αποτέλεσμα ανά ρόλο — άρα δεν είναι καρφωμένος', async () => {
    storedProject = { companyId: 'co_beta' };

    currentRole = 'viewer';
    const asViewer = await refusalOf();

    currentRole = 'super_admin';
    const asBypass = await refusalOf();

    expect(asViewer).not.toBeNull();
    expect(asBypass).toBeNull();
  });

  it('🔴 ο ΙΔΙΟΣ εκτελεστής δίνει ΔΙΑΦΟΡΕΤΙΚΟ αποτέλεσμα ανά tenant — άρα ούτε το `companyId` είναι καρφωμένο', async () => {
    storedProject = { companyId: 'co_beta' };

    currentCompanyId = 'co_alpha';
    const asAlpha = await refusalOf();

    currentCompanyId = 'co_beta';
    const asBeta = await refusalOf();

    expect(asAlpha).not.toBeNull();
    expect(asBeta).toBeNull();
  });
});

// ============================================================================
describe('🔴 Η ΣΕΙΡΑ — ο φύλακας τρέχει ΠΡΙΝ το επιχειρησιακό βήμα', () => {
  it('άρνηση ιδιοκτησίας → η προεπισκόπηση ΔΕΝ υπολογίζεται καθόλου', async () => {
    storedProject = { companyId: 'co_beta' };
    await refusalOf();
    expect(previewCalls).toEqual([]);
  });

  it('ανύπαρκτο έργο → η προεπισκόπηση ΔΕΝ υπολογίζεται καθόλου', async () => {
    storedProject = null;
    await refusalOf();
    expect(previewCalls).toEqual([]);
  });

  it('🔴 ΥΠΕΡΓΡΑΦΕΙΟ + ανύπαρκτο έργο → 404, ΟΧΙ φάντασμα έργου', async () => {
    // Ο έλεγχος ύπαρξης **δεν** είναι πλεονασμός του φύλακα ιδιοκτησίας.
    // Για μη-bypass καλούντα τα δύο συμπίπτουν (έγγραφο χωρίς `companyId` δεν
    // ανήκει σε κανέναν ⇒ άρνηση). Για τον **υπεργραφέα** όμως ο φύλακας λέει
    // «πέρνα» — οπότε χωρίς τον έλεγχο ύπαρξης θα κατέβαινε στο επιχειρησιακό
    // βήμα ένα έργο με `data: undefined`. Η μετάλλαξη που αφαιρεί τον έλεγχο
    // ύπαρξης επιβίωνε ΜΟΝΟ επειδή έλειπε αυτό το test.
    storedProject = null;
    currentRole = 'super_admin';

    const refusal = await refusalOf();
    expect(refusal).toBeInstanceOf(ApiError);
    expect(refusal!.statusCode).toBe(404);
    expect(previewCalls).toEqual([]);
  });
});

// ============================================================================
describe('🔴 Η ΤΑΥΤΟΤΗΤΑ — «δεν υπάρχει» και «δεν είναι δικό σου» είναι ΙΣΑ', () => {
  it('ολόκληρο το σχήμα του σύρματος ταυτίζεται, και με το εργοστάσιο', async () => {
    storedProject = null;
    const genuine = await refusalOf();

    storedProject = { companyId: 'co_beta' };
    const disguised = await refusalOf();

    expect(genuine).toBeInstanceOf(ApiError);
    expect(disguised).toBeInstanceOf(ApiError);
    expect(wireShapeOf(disguised!)).toEqual(wireShapeOf(genuine!));
    expect(wireShapeOf(genuine!)).toEqual(wireShapeOf(projectNotFound()));
  });

  it('🔴 έργο ΧΩΡΙΣ companyId είναι επίσης «δεν βρέθηκε», όχι σφάλμα (§4)', async () => {
    storedProject = {};
    const refusal = await refusalOf();
    expect(wireShapeOf(refusal!)).toEqual(wireShapeOf(projectNotFound()));
  });
});

// ============================================================================
describe('ό,τι επιβάλλεται στο σύνορο επιβάλλεται ΜΕΣΑ στον εκτελεστή', () => {
  it('🔴 ο ρυθμιστής ρυθμού τυλίγει κάθε διαδρομή — δεν μπορεί να ξεχαστεί', () => {
    expect(rateLimited).toContain(
      // ο εκτελεστής επιστρέφει ό,τι του γύρισε ο ρυθμιστής
      route as unknown,
    );
  });

  it('άκυρο σώμα → 400 πριν καν διαβαστεί το έργο', async () => {
    const bad = { json: async () => ({ ok: 'όχι-boolean' }) } as unknown as NextRequest;
    let thrown: ApiError | null = null;
    try {
      await route(bad, seg);
    } catch (e) {
      thrown = e as ApiError;
    }
    expect(thrown?.statusCode).toBe(400);
    expect(previewCalls).toEqual([]);
  });
});
