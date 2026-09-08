/**
 * @jest-environment node
 *
 * @fileoverview **Η ΠΟΡΤΑ ΤΟΥ ΜΟΝΤΕΛΟΥ** — ADR-845 §7.5 (Φ4.2β/Βήμα Γ) · §8.
 * @related app/api/properties/[id]/model/route.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ ΠΟΥ ΚΑΜΙΑ ΑΛΛΗ ΣΟΥΙΤΑ ΔΕΝ ΦΥΛΑΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   **Φεύγουν τα bytes και η δήλωση σε ΜΙΑ εγγραφή;**
 *
 * Δύο κλήσεις θα άνοιγαν παράθυρο όπου τα bytes υπάρχουν **χωρίς** δήλωση — και ο ψήστης
 * απορρίπτει ονομαστικά ό,τι δεν έχει *(`'missing-declaration'`)*. Το αποτέλεσμα θα ήταν
 * αρχείο που **υπάρχει** και **δεν δημοσιεύεται ποτέ**, χωρίς κανείς να μπορεί να πει γιατί.
 * Καμία άλλη σουίτα δεν βλέπει τη στιγμή της εγγραφής.
 *
 * 🔑 **Ο επικυρωτής της δήλωσης είναι ΠΡΑΓΜΑΤΙΚΟΣ** (`decodeModelDeclaration`/`hasSignatory`
 * δεν είναι mock): δοκιμή που μιμείται τον κριτή επιβεβαιώνει **τον εαυτό της**. Ψεύτικα
 * είναι μόνο η **ταυτότητα**, η **βάση** και ο **κάδος**.
 */

jest.mock('next/server', () => {
  class MockNextResponse {
    readonly status: number;
    private readonly body: unknown;
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
    }
    async json(): Promise<unknown> { return this.body; }
    static json(body: unknown, init?: { status?: number }): MockNextResponse {
      return new MockNextResponse(body, init);
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

jest.mock('@/lib/middleware/with-rate-limit', () => ({ withHeavyRateLimit: <T>(h: T) => h }));

const authContext = { uid: 'user_1', companyId: 'comp_alfa', isAuthenticated: true as const };
jest.mock('@/lib/auth/middleware', () => ({
  withAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown) => callback(request, authContext),
}));

jest.mock('@/lib/auth/tenant-isolation', () => ({
  requirePropertyInTenantScope: async () => undefined,
}));

/** Η σειρά των πράξεων καταγράφεται — το «πότε» είναι μέρος του κριτηρίου (Κ5). */
const trace: string[] = [];
const setDoc = jest.fn(async () => { trace.push('set'); });
const updateDoc = jest.fn(async () => { trace.push('update'); });

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: () => ({ doc: () => ({ set: setDoc, update: updateDoc }) }),
  }),
  FieldValue: { serverTimestamp: () => 'ts' },
}));

const uploadPublicFile = jest.fn(async () => {
  trace.push('upload');
  return { url: '/api/storage/file/x', storagePath: 'p', bucket: 'b', fileId: 'f' };
});
jest.mock('@/services/storage-admin/public-upload.service', () => ({
  uploadPublicFile: (...args: unknown[]) => uploadPublicFile(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require('../route') as typeof import('../route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { MODEL_DECLARATION_METADATA_KEY, decodeModelDeclaration } =
  require('@/lib/listings/model-declaration-metadata') as
    typeof import('@/lib/listings/model-declaration-metadata');

const PROPERTY = 'prop_a0000009-7777-4aaa-8aaa-000000000009';

function declaration(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    state: 'as-built',
    signatory: { name: 'Μ. Παπαδόπουλος', discipline: 'πολιτικός μηχανικός', studiedAt: '2026-03-01' },
    geometry: {
      meshCount: 1, triangleCount: 12, materialCount: 1, textureCount: 0, fingerprint: null,
    },
    ...over,
  });
}

function request(file: File, declared: string): unknown {
  const body = new FormData();
  body.append('file', file);
  body.append('declaration', declared);
  return {
    url: `https://x/api/properties/${PROPERTY}/model`,
    nextUrl: { pathname: `/api/properties/${PROPERTY}/model` },
    formData: async () => body,
  };
}

function glb(): File {
  return new File([new Uint8Array([1, 2, 3, 4])], 'model.glb', { type: 'model/gltf-binary' });
}

describe('ADR-845 Βήμα Γ — η πόρτα του μοντέλου', () => {
  beforeEach(() => {
    trace.length = 0;
    jest.clearAllMocks();
  });

  it('Κ1 — 🏆 τα bytes ΚΑΙ η δήλωση φεύγουν σε ΜΙΑ εγγραφή', async () => {
    await POST(request(glb(), declaration()) as never, undefined as never, undefined as never);

    expect(uploadPublicFile).toHaveBeenCalledTimes(1);
    const params = uploadPublicFile.mock.calls[0][0] as { customMetadata?: Record<string, string> };
    const carried = decodeModelDeclaration(params.customMetadata?.[MODEL_DECLARATION_METADATA_KEY]);

    // ⚠️ Αποκωδικοποιείται με τον **πραγματικό** αναγνώστη του διακομιστή: μια σύγκριση
    //    συμβολοσειρών θα περνούσε ακόμη κι αν το αποθηκευμένο δεν ήταν καν δήλωση.
    expect(carried).not.toBeNull();
    expect(carried?.state).toBe('as-built');
    expect(carried?.geometry.triangleCount).toBe(12);
  });

  it('Κ2 — δήλωση ΧΩΡΙΣ υπογράφοντα ⇒ ονομαστική άρνηση, και ΤΙΠΟΤΑ δεν ανεβαίνει', async () => {
    const noSignatory = declaration({
      signatory: { name: '   ', discipline: '', studiedAt: '2026-03-01' },
    });

    await expect(
      POST(request(glb(), noSignatory) as never, undefined as never, undefined as never),
    ).rejects.toMatchObject({ statusCode: 400, message: 'MODEL_SIGNATORY_REQUIRED' });

    expect(uploadPublicFile).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('Κ3 — άγνωστη σήμανση κατάστασης ⇒ δεν είναι καν δήλωση', async () => {
    await expect(
      POST(request(glb(), declaration({ state: 'renovated' })) as never, undefined as never, undefined as never),
    ).rejects.toMatchObject({ statusCode: 400, message: 'MODEL_DECLARATION_INVALID' });

    expect(uploadPublicFile).not.toHaveBeenCalled();
  });

  it('Κ4 — ό,τι δεν είναι GLB δεν μπαίνει καν στον κάδο των μοντέλων', async () => {
    const pdf = new File([new Uint8Array([1])], 'x.pdf', { type: 'application/pdf' });

    await expect(
      POST(request(pdf, declaration()) as never, undefined as never, undefined as never),
    ).rejects.toMatchObject({ statusCode: 415 });

    expect(uploadPublicFile).not.toHaveBeenCalled();
  });

  it('Κ5 — το έγγραφο γεννιέται ΠΡΙΝ τα bytes και οριστικοποιείται ΜΕΤΑ', async () => {
    await POST(request(glb(), declaration()) as never, undefined as never, undefined as never);

    // 🔑 Ο αναγνώστης της δημοσίευσης φιλτράρει `status === READY`: ένα ημιτελές ανέβασμα
    //    οφείλει να είναι **αόρατο**, όχι επικίνδυνο. Η σειρά **είναι** ο μηχανισμός.
    expect(trace).toEqual(['set', 'upload', 'update']);
  });
});
