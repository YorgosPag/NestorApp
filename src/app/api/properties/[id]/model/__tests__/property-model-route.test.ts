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

/**
 * 🔴 **ADR-862 Φ0 Β10 — Ο ΕΝΑΣ ΓΡΑΦΕΑΣ, ΣΤΟ ΣΥΝΟΡΟ ΤΟΥ.** Χωρίς αυτό το mock η αρχειοθέτηση των
 * προκατόχων έτρεχε πάνω σε ψεύτικο χωρίς `runTransaction`, έσκαγε μέσα στο δικό της `catch` και
 * το Κ6 έμενε **πράσινο και τυφλό**. Η κρίση του γραφέα έχει **δική της** άγκυρα
 * (`container-supersession-anchor`)· εδώ ρωτάμε μόνο αν η πόρτα τον **καλεί σωστά**.
 */
const transitionContainer = jest.fn(async (request: { fileId: string }): Promise<unknown> => ({
  kind: 'transitioned', fileId: request.fileId, act: 'supersede', from: 'pre-cde', to: 'SUPERSEDED', revision: 0,
}));
jest.mock('@/services/iso19650/container-transitions', () => ({
  containerActorOf: (ctx: { uid: string; companyId: string }) => ({ uid: ctx.uid, custody: { companyId: ctx.companyId } }),
  transitionContainer: (request: { fileId: string }) => transitionContainer(request),
}));

/** Η σειρά των πράξεων καταγράφεται — το «πότε» είναι μέρος του κριτηρίου (Κ5). */
const trace: string[] = [];
const setDoc = jest.fn(async () => { trace.push('set'); });
const updateDoc = jest.fn(async () => { trace.push('update'); });

/**
 * 🔴 **ADR-845 Ο-27 — ΤΑ ΑΔΕΛΦΙΑ ΠΟΥ ΒΡΙΣΚΕΙ Η ΠΟΡΤΑ.** Το ερώτημα των προκατόχων είναι
 * **αλυσίδα `where()`**: κάθε κρίκος επιστρέφει τον εαυτό του, και ο τελευταίος τα έγγραφα.
 * ⚠️ Δηλωμένο ως **μεταβλητή** ώστε κάθε δοκιμή να ορίζει τι κάθεται ήδη στη βάση — αλλιώς η
 * άγκυρα του `supersedes` θα δοκίμαζε **πάντα** το κενό, δηλαδή θα ήταν πράσινη και τυφλή.
 */
let siblings: readonly Record<string, unknown>[] = [];
const queryGet = jest.fn(async () => {
  trace.push('query');
  return { docs: siblings.map((data) => ({ id: data.id as string, data: () => data })) };
});

/**
 * 🔴 **ADR-845 Ο-25 — ΤΑ ΣΧΕΔΙΑ ΠΟΥ ΔΙΑΒΑΖΕΙ Η ΠΟΡΤΑ.** Το `getAll` **πρέπει** να υπάρχει στο
 * ψεύτικο: χωρίς αυτό, η ανάγνωση των revisions πετά και πέφτει στο δικό της `catch` — και
 * το σκέλος θα ήταν **πράσινο πάνω σε νεκρό δρόμο**, ακριβώς το μάθημα του Ο-13.
 *
 * ⚠️ **Επιστρέφει snapshots με `companyId`**, γιατί η ανάγνωση **ελέγχει κηδεμονία**: τα
 * ταυτοποιητικά τα έδωσε ο πελάτης, και ένα ψεύτικο χωρίς μισθωτή θα δοκίμαζε άλλη διαδρομή
 * από την πραγματική.
 */
let sceneFiles: Readonly<Record<string, Record<string, unknown>>> = {};
const getAll = jest.fn(async (...refs: readonly { id: string }[]) => {
  trace.push('getAll');
  return refs.map((ref) => ({
    id: ref.id,
    data: () => sceneFiles[ref.id],
  }));
});

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => {
    const chain = { where: () => chain, get: queryGet };
    return {
      collection: () => ({
        doc: (id: string) => ({ id, set: setDoc, update: updateDoc }),
        where: chain.where,
      }),
      getAll: (...refs: readonly { id: string }[]) => getAll(...refs),
    };
  },
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
    // ADR-845 Ο-27 — το εύρος ταξιδεύει με τα bytes· χωρίς αυτό η δήλωση ΔΕΝ είναι δήλωση.
    scope: 'active-floor',
    signatory: { name: 'Μ. Παπαδόπουλος', discipline: 'πολιτικός μηχανικός', studiedAt: '2026-03-01' },
    geometry: {
      meshCount: 1, triangleCount: 12, materialCount: 1, textureCount: 0, fingerprint: null,
    },
    ...over,
  });
}

function request(file: File, declared: string, sceneFileIds?: readonly string[]): unknown {
  const body = new FormData();
  body.append('file', file);
  body.append('declaration', declared);
  // ADR-845 Ο-25 — ξεχωριστό πεδίο: τα `file_…` είναι ιδιωτικά και ΔΕΝ ψήνονται στο artifact.
  if (sceneFileIds) body.append('sceneFileIds', JSON.stringify(sceneFileIds));
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
    // ⚠️ **Καμία διαρροή αδελφών ανάμεσα σε δοκιμές** — αλλιώς το Κ7 θα κληρονομούσε τη βάση
    //    του Κ6 και θα ήταν πράσινο για λόγο δικό του (ADR-845 Ο-27).
    siblings = [];
    sceneFiles = {};
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
    //
    // 🔴 **ΚΑΙ ΤΟ `query` ΠΡΟΗΓΕΙΤΑΙ, ΕΠΙΤΗΔΕΣ** *(ADR-845 Ο-27)*: οι προκάτοχοι ρωτιούνται
    //    **πριν** γραφτεί το νέο έγγραφο. Μετά την εγγραφή, ο νεοφερμένος θα ήταν μέσα στο
    //    αποτέλεσμα και θα έπρεπε να **εξαιρεθεί** — δηλαδή θα υπήρχε μια γραμμή που, αν
    //    ξεχαστεί, κάνει το μοντέλο να **διαδεχθεί τον εαυτό του** και να πέσει στον κάδο την
    //    ίδια στιγμή που δημοσιεύεται.
    expect(trace).toEqual(['query', 'set', 'upload', 'update']);
  });

  it('🏆 Κ6 — Ο-27: η πόρτα ΛΕΕΙ ποιους διαδέχεται, και ΠΟΤΕ τον εαυτό της', async () => {
    // Το ζωντανό γεγονός της 2026-09-09: ένα **ενεργό** μοντέλο ίδιας ταυτότητας κάθεται ήδη.
    siblings = [{
      id: 'file_51f3bb6d-b3a4-46ca-b541-cd1b80b941f0',
      publicationIdentity: 'model/measured/active-floor/as-built',
    }];

    const response = await POST(
      request(glb(), declaration()) as never, undefined as never, undefined as never,
    );
    const payload = await (response as unknown as Response).json();

    expect(payload.data.supersedes).toEqual(['file_51f3bb6d-b3a4-46ca-b541-cd1b80b941f0']);
    expect(payload.data.supersedes).not.toContain(payload.data.fileId);

    // 🔑 ADR-862 Φ0 Β10 — **Ο διακομιστής ΚΡΙΝΕΙ ΚΑΙ ΠΡΑΤΤΕΙ**: ο ΕΝΑΣ γραφέας καλείται από την
    //    ίδια την πόρτα, με διάδοχο τη νέα δημοσίευση, **μετά** την εγγραφή της.
    expect(transitionContainer).toHaveBeenCalledWith(expect.objectContaining({
      fileId: 'file_51f3bb6d-b3a4-46ca-b541-cd1b80b941f0',
      act: 'supersede',
      supersededByFileId: payload.data.fileId,
      actor: expect.objectContaining({ uid: 'user_1', custody: { companyId: 'comp_alfa' } }),
    }));
    expect(payload.data.archived).toEqual(['file_51f3bb6d-b3a4-46ca-b541-cd1b80b941f0']);
  });

  it('🔑 Κ6β — Β10: άρνηση του γραφέα ΔΕΝ ρίχνει τη δημοσίευση — απλώς δεν ανακοινώνεται αρχειοθέτηση', async () => {
    siblings = [{ id: 'file_old', publicationIdentity: 'model/measured/active-floor/as-built' }];
    transitionContainer.mockImplementationOnce(async (request) => ({
      kind: 'refused', fileId: request.fileId, act: 'supersede', why: 'not-capable',
    }));

    const response = await POST(
      request(glb(), declaration()) as never, undefined as never, undefined as never,
    );
    const payload = await (response as unknown as Response).json();

    expect(payload.data.fileId).toEqual(expect.any(String));
    expect(payload.data.supersedes).toEqual(['file_old']);
    expect(payload.data.archived).toEqual([]);
  });

  it('🏆 Κ8 — Ο-25: η πόρτα ΓΡΑΦΕΙ σε ποιο revision ήταν τα σχέδια', async () => {
    const scene = 'file_7cd206cc-9751-463b-b1dd-70fd1ffb8deb';
    sceneFiles = { [scene]: { companyId: 'comp_alfa', revision: 5 } };

    await POST(
      request(glb(), declaration(), [scene]) as never, undefined as never, undefined as never,
    );

    // 🔴 **Η ΡΑΦΗ**: ο πελάτης έστειλε **μόνο** το ταυτοποιητικό· το `revision: 5` το διάβασε
    //    ο διακομιστής από το ίδιο το έγγραφο. Ένα revision από τον πελάτη θα ήταν
    //    **ισχυρισμός του καλούντος** — ίδιος κανόνας με το `at` του δημόσιου σχήματος.
    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ sourceRevisions: [{ fileId: scene, revision: 5 }] }),
    );
  });

  it('🔑 Κ9 — Ο-25: ΞΕΝΟ αρχείο ΔΕΝ καταγράφεται — η κηδεμονία ελέγχεται', async () => {
    const foreign = 'file_ffff0000-1111-4222-8333-444455556666';
    sceneFiles = { [foreign]: { companyId: 'comp_ΑΛΛΗ_ΕΤΑΙΡΕΙΑ', revision: 9 } };

    await POST(
      request(glb(), declaration(), [foreign]) as never, undefined as never, undefined as never,
    );

    // ⚠️ Τα ταυτοποιητικά τα έδωσε ο **πελάτης**: χωρίς τον έλεγχο, ένα κατασκευασμένο σώμα
    //    θα διάβαζε `revision` αρχείου ξένης εταιρείας. Μικρή διαρροή, αλλά **διαρροή**.
    expect(setDoc).toHaveBeenCalledWith(
      expect.not.objectContaining({ sourceRevisions: expect.anything() }),
    );
  });

  it('⚠️ Κ10 — Ο-25: ΧΩΡΙΣ κατάλογο σχεδίων το μοντέλο ΔΗΜΟΣΙΕΥΕΤΑΙ — απλώς χωρίς προέλευση', async () => {
    // Η καταγραφή δεν επιτρέπεται να ακυρώσει την πράξη. Ίδιος κανόνας με την ιστορία της
    // διαδοχής (Ο-27): η αγγελία είναι σωστή ούτως ή άλλως· χάνεται μόνο το «ισχύει ακόμα;».
    const response = await POST(
      request(glb(), declaration()) as never, undefined as never, undefined as never,
    );
    const payload = await (response as unknown as Response).json();

    expect(payload.data.fileId).toEqual(expect.any(String));
    expect(getAll).not.toHaveBeenCalled();
  });

  it('🔑 Κ7 — Ο-27: ΑΛΛΗ ταυτότητα ΔΕΝ διαδέχεται — ο πληθυντικός επιβιώνει', async () => {
    // `proposal` δίπλα σε `as-built` είναι το γραμμένο «σήμερα vs μετά την ανακαίνιση» (Α11):
    // **παραλλαγές**, όχι εκδοχές. Μια συγχώνευσή τους θα σκότωνε το χαρακτηριστικό.
    siblings = [{
      id: 'file_51f3bb6d-b3a4-46ca-b541-cd1b80b941f0',
      publicationIdentity: 'model/measured/active-floor/proposal',
    }];

    const response = await POST(
      request(glb(), declaration()) as never, undefined as never, undefined as never,
    );
    const payload = await (response as unknown as Response).json();

    expect(payload.data.supersedes).toEqual([]);
  });
});
