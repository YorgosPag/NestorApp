/**
 * @jest-environment node
 *
 * @fileoverview **ΤΟ ΣΚΕΛΟΣ ΕΠΙΒΕΒΑΙΩΣΗΣ ΠΕΡΙΓΡΑΜΜΑΤΟΣ ΤΗΣ ΠΟΡΤΑΣ ΕΔΑΦΟΥΣ** — ADR-920 §14.11 Ζ3 (`PUT`).
 * @related app/api/owner-properties/[ownerPropertyId]/terrain/route.ts ·
 *   server/listing-terrain/plot-outline-confirmation.server.ts · server/listing-terrain/plot-drawing-upload.server.ts
 *
 * 🔴 Τι φυλάει:
 *   - ο browser ονομάζει **υποψήφιο**· ο δακτύλιος βγαίνει από ό,τι βρήκε ο **server** στα bytes (DXF **και** PDF)·
 *   - Π6: περίγραμμα χωρίς κοινή επιφάνεια με το ανάγλυφο ⇒ ονομασμένη άρνηση, **καμία** εγγραφή·
 *   - το σχέδιο γεννιέται στον φάκελο ως **έγγραφο του ανθρώπου** (καρτέλα «Τοπογραφικό»), ιδιωτικό, με το περίγραμμα
 *     ως μετρημένο πεδίο — και **πριν** από την επαναδημοσίευση («σχέδιο πρώτα»)·
 *   - με ανάγλυφο: η πηγή ξαναδημοσιεύεται από τον ΙΔΙΟ κινητήρα με το περίγραμμα· χωρίς: μόνο το σχέδιο·
 *   - DWG / άγνωστο είδος / DXF χωρίς μονάδα ⇒ ονομασμένες αρνήσεις· ξένη αγγελία ⇒ 404 πριν διαβαστεί το σώμα.
 *
 * 🔑 Πραγματικά: ο πυρήνας του Ζ1 (DXF + πίνακας PDF), ο κριτής εδάφους, ο κινητήρας, οι κατασκευαστές εγγραφών.
 * Ψεύτικα: ταυτότητα, βάση, κάδοι, ανάγνωση PDF (pdf.js), επαναπροβολή, ιστορικό.
 *
 * | Μετάλλαξη | Κοκκινίζει |
 * |---|---|
 * | ο server παίρνει τον δακτύλιο από τον browser αντί για το υποψήφιο | Ε1 · Ε4 |
 * | ο έλεγχος Π6 αφαιρείται | Ε3 |
 * | η επαναδημοσίευση τρέχει πριν από το σχέδιο | Ε1 |
 * | το σχέδιο γεννιέται δημόσιο ή χωρίς ταυτότητα | Ε1 |
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

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withHeavyRateLimit: <T>(h: T) => h,
  withStandardRateLimit: <T>(h: T) => h,
}));

const OWNER = 'user_9';
let callerUid = OWNER;
jest.mock('@/lib/auth/personal-scope-middleware', () => ({
  withPersonalOrOrgAuth:
    (handler: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown, context: unknown) => handler(request, { ctx: { uid: callerUid }, scope: 'personal' }, context),
  listingActorOf: (actor: { ctx: { uid: string } }) => ({ uid: actor.ctx.uid, companyId: null }),
}));

let ownerProperty: Record<string, unknown> | undefined;
let dossier: Record<string, unknown> | undefined;
jest.mock('@/lib/owner-property/owner-property-from-document', () => ({
  ownerPropertyFromDocument: (raw: unknown, id: string) => (raw === undefined ? null : { ...(raw as object), id }),
}));
jest.mock('@/lib/property-dossier/property-dossier-from-document', () => ({
  propertyDossierFromDocument: (raw: unknown, id: string) => (raw === undefined ? null : { ...(raw as object), id }),
}));

jest.mock('@/services/iso19650/container-transitions', () => ({
  personalContainerActorOf: (uid: string) => ({ uid, custody: { userId: uid } }),
  transitionContainer: async (request: { fileId: string }) => ({
    kind: 'transitioned', fileId: request.fileId, act: 'supersede', from: 'pre-cde', to: 'SUPERSEDED', revision: 0,
  }),
}));

const trace: string[] = [];
const setDoc = jest.fn(async (_data: Record<string, unknown>) => { trace.push('set'); });
const updateDoc = jest.fn(async () => { trace.push('update'); });
let siblings: readonly Record<string, unknown>[] = [];

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: (name: string) => {
      const chain = {
        where: () => chain,
        get: async () => {
          trace.push('query');
          return { docs: siblings.map((data) => ({ id: data.id as string, data: () => data })) };
        },
      };
      return {
        doc: (id: string) => ({
          id,
          set: setDoc,
          update: updateDoc,
          get: async () => ({ data: () => (name === 'owner_properties' ? ownerProperty : name === 'property_dossiers' ? dossier : undefined) }),
        }),
        where: chain.where,
      };
    },
    getAll: async () => [],
  }),
  FieldValue: { serverTimestamp: () => 'ts' },
}));

const uploads: { storagePath: string; buffer: Buffer; contentType: string }[] = [];
jest.mock('@/services/storage-admin/public-upload.service', () => ({
  uploadPublicFile: async (params: { storagePath: string; buffer: Buffer; contentType: string }) => {
    uploads.push(params);
    trace.push('upload');
    return { url: '/api/storage/file/x', storagePath: params.storagePath, bucket: 'b', fileId: 'f' };
  },
}));

/** Η πηγή που είναι ήδη δημοσιευμένη στον φάκελο — ο κάδος της εγγραφής τη δίνει μαζί με τη δήλωση Δ2. */
let storedSourceBytes = '';
let storedDeclaration = '';
jest.mock('@/server/files/file-record-bucket', () => ({
  fileRecordBucket: () => ({
    file: () => ({
      getMetadata: async () => [{ metadata: { nestorTerrainDeclaration: storedDeclaration } }],
      download: async () => [Buffer.from(storedSourceBytes, 'utf8')],
    }),
  }),
}));

/** Το PDF ανοίγει με pdf.js στον server — εδώ δίνεται κατευθείαν η σελίδα με τον πίνακα συντεταγμένων. */
const pdfPages = jest.fn();
jest.mock('@/services/pdf/pdf-positioned-text.service', () => ({
  readPdfPositionedPages: (...args: unknown[]) => pdfPages(...args),
}));

const refreshOwner = jest.fn(async (..._args: unknown[]): Promise<string> => {
  trace.push('refresh');
  return 'published';
});
jest.mock('@/services/listings/listing-media-refresh', () => ({
  refreshOwnerListingAfterMediaChange: (...args: unknown[]) => refreshOwner(...args),
}));

const recordChange = jest.fn(async (_entry: Record<string, unknown>) => {
  trace.push('audit');
  return 'eaud_1';
});
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: (entry: Record<string, unknown>) => recordChange(entry) },
}));

import type { PdfPositionedPage, PdfTextItem } from '@/lib/pdf/pdf-page-text';
import { encodeTerrainSurveyDeclaration } from '@/lib/terrain/publication/terrain-survey-declaration';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GET, PUT, PATCH } = require('../route') as typeof import('../route');

const LISTING = 'oprop_a0000009-7777-4aaa-8aaa-000000000031';
const DOSSIER = 'pdos_a0000009-7777-4aaa-8aaa-000000000032';
/** Η αρχή του αναγλύφου σε ΕΓΣΑ, μέτρα — το ανάγλυφο είναι ένα τετράγωνο 20 × 20 m. */
const E0_M = 400_000;
const N0_M = 4_200_000;

function reliefPoints(): number[][] {
  const points: number[][] = [];
  for (let x = 0; x <= 20_000; x += 5_000) {
    for (let y = 0; y <= 20_000; y += 5_000) points.push([E0_M * 1000 + x, N0_M * 1000 + y, 120_000 + 0.1 * x]);
  }
  return points;
}

const RELIEF_SOURCE = { version: 2, points: reliefPoints(), breaklines: [], boundary: null, envelope: null, plotOutline: null };
const RELIEF_FILE = {
  id: 'file_terrain_old',
  publicationIdentity: 'terrain/measured',
  contentType: 'application/json',
  classification: 'public',
  entityType: 'property_dossier',
  status: 'ready',
  storagePath: 'people/x/terrain.json',
  category: 'drawings',
  createdAt: '2026-11-01T10:00:00.000Z',
};

// ── Το σχέδιο: ένα DXF χωρίς $INSUNITS (μέτρα από τον άνθρωπο), ή ένα PDF με πίνακα συντεταγμένων ──

const dxf = (...pairs: (string | number)[]): string =>
  ['0', 'SECTION', '2', 'ENTITIES', ...pairs, '0', 'ENDSEC', '0', 'EOF'].map(String).join('\n');
const lw = (handle: string, layer: string, coords: readonly (readonly [number, number])[]): (string | number)[] =>
  ['0', 'LWPOLYLINE', '5', handle, '8', layer, '90', coords.length, '70', 1, ...coords.flatMap(([x, y]) => ['10', x, '20', y])];

/** Τετράγωνο 10 × 10 m, μετατοπισμένο κατά (dx, dy) m από την αρχή του αναγλύφου. */
const square = (dx: number, dy: number): (readonly [number, number])[] => [
  [E0_M + dx, N0_M + dy], [E0_M + dx + 10, N0_M + dy], [E0_M + dx + 10, N0_M + dy + 10], [E0_M + dx, N0_M + dy + 10],
];

const PLOT_INSIDE = dxf(...lw('P', 'ΟΡΙΟ', square(5, 5)), ...lw('H', 'ΚΤΙΡΙΑ', square(7, 7).map(([x, y]) => [x - 1, y - 1] as const)));
const PLOT_FAR_AWAY = dxf(...lw('P', 'ΟΡΙΟ', square(5_000, 5_000)));

const line = (y: number, cells: readonly (readonly [string, number])[]): PdfTextItem[] =>
  cells.map(([s, x]) => ({ s, x, y, w: s.length * 5, h: 8 }));
const PDF_PAGE: PdfPositionedPage = {
  page: 1,
  width: 595,
  height: 842,
  items: [
    line(40, [['ΤΟΠΟΓΡΑΦΙΚΟ ΔΙΑΓΡΑΜΜΑ ΟΙΚΟΠΕΔΟΥ ΙΔΙΟΚΤΗΣΙΑΣ', 50]]),
    line(60, [['ΠΙΝΑΚΑΣ ΣΥΝΤΕΤΑΓΜΕΝΩΝ ΚΟΡΥΦΩΝ ΕΓΣΑ 87', 50]]),
    ...square(5, 5).map(([e, n], i) => line(100 + 10 * i, [['ΑΒΓΔ'[i], 50], [e.toFixed(2), 80], [n.toFixed(2), 160]])),
  ].flat(),
};

interface Sent {
  readonly drawing?: File;
  readonly choice?: string;
  readonly unit?: string;
}

let sent: Sent = {};
const formData = jest.fn(async () => {
  const body = new FormData();
  if (sent.drawing !== undefined) body.append('drawing', sent.drawing);
  if (sent.choice !== undefined) body.append('plotOutline', sent.choice);
  if (sent.unit !== undefined) body.append('drawingUnit', sent.unit);
  return body;
});

const dxfFile = (text: string): File => new File([text], 'diagramma.dxf', { type: '' });
const choose = (candidateId: string, showInListing = true): string => JSON.stringify({ candidateId, showInListing });

const put = () => PUT(
  { url: `https://x/api/owner-properties/${LISTING}/terrain`, nextUrl: { pathname: '/x' }, formData } as never,
  { params: Promise.resolve({ ownerPropertyId: LISTING }) } as never,
);

/** Τα δεδομένα της πρώτης εγγραφής που γράφτηκε — το σχέδιο, αν η σειρά είναι σωστή. */
const firstWritten = (): Record<string, unknown> => setDoc.mock.calls[0][0];

describe('ADR-920 §14.11 Ζ3 — επιβεβαίωση περιγράμματος (PUT)', () => {
  beforeEach(() => {
    trace.length = 0;
    uploads.length = 0;
    siblings = [];
    callerUid = OWNER;
    ownerProperty = { authorUserId: OWNER, authorCompanyId: null, dossierId: DOSSIER, type: 'plot', title: 'Οικόπεδο Σούνιο' };
    dossier = { userId: OWNER, label: 'Οικόπεδο', type: 'plot' };
    storedSourceBytes = JSON.stringify(RELIEF_SOURCE);
    storedDeclaration = encodeTerrainSurveyDeclaration({ surveyorName: 'Α. Τοπογράφος', surveyedOn: '2026-03-14', rightsAffirmed: true });
    sent = { drawing: dxfFile(PLOT_INSIDE), choice: choose('dxf:P'), unit: 'm' };
    jest.clearAllMocks();
  });

  it('Ε1 — 🏆 με ανάγλυφο: σχέδιο στον φάκελο (ιδιωτικό, «Τοπογραφικό») ΠΡΩΤΑ, μετά επαναδημοσίευση με το περίγραμμα', async () => {
    siblings = [RELIEF_FILE];
    const response = await put();
    const { data } = await (response as unknown as Response).json() as { data: { drawingFileId: string; terrain: unknown } };

    expect(firstWritten()).toMatchObject({
      userId: OWNER,
      entityType: 'property_dossier',
      entityId: DOSSIER,
      domain: 'admin',
      category: 'documents',
      purpose: 'study-topographic',
      publicationIdentity: 'terrain/plot-drawing',
      plotOutline: { candidateId: 'dxf:P', showInListing: true, drawingUnit: 'm', origin: { source: 'dxf', layer: 'ΟΡΙΟ' } },
    });
    expect(firstWritten()).not.toHaveProperty('classification');
    expect(firstWritten()).not.toHaveProperty('companyId');
    expect(uploads[0].contentType).toBe('image/vnd.dxf');

    // Η επαναδημοσίευση: η ΝΕΑ πηγή φέρει τον δακτύλιο του server (mm), και η αγγελία ξαναπροβάλλεται.
    const republished = JSON.parse(uploads[1].buffer.toString('utf8')) as { plotOutline: { ring: number[][]; showInListing: boolean } };
    expect(republished.plotOutline.showInListing).toBe(true);
    expect(republished.plotOutline.ring[0]).toEqual([(E0_M + 5) * 1000, (N0_M + 5) * 1000]);
    expect(trace.indexOf('set')).toBeLessThan(trace.indexOf('refresh'));
    expect(data.terrain).not.toBeNull();
    expect(recordChange).toHaveBeenCalledWith(expect.objectContaining({
      changes: [{ field: 'plotOutline', oldValue: null, newValue: data.drawingFileId }],
    }));
  });

  it('Ε2 — χωρίς ανάγλυφο: φυλάγεται ΜΟΝΟ το σχέδιο· καμία δημοσίευση, καμία επαναπροβολή', async () => {
    const response = await put();
    const { data } = await (response as unknown as Response).json() as { data: { terrain: unknown } };
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(refreshOwner).not.toHaveBeenCalled();
    expect(data.terrain).toBeNull();
  });

  it('Ε3 — 🔴 Π6: περίγραμμα χωρίς ΚΑΜΙΑ κοινή επιφάνεια με το ανάγλυφο ⇒ 422, καμία εγγραφή, ποτέ μετατόπιση', async () => {
    siblings = [RELIEF_FILE];
    sent = { ...sent, drawing: dxfFile(PLOT_FAR_AWAY) };
    await expect(put()).rejects.toMatchObject({ statusCode: 422, message: 'TERRAIN_PLOT_OUTLINE_DISJOINT' });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('Ε4 — 🔴 υποψήφιο που ο server ΔΕΝ βρήκε στο σχέδιο ⇒ 422, ό,τι κι αν λέει ο browser', async () => {
    sent = { ...sent, choice: choose('dxf:ΑΛΛΟ') };
    await expect(put()).rejects.toMatchObject({ statusCode: 422, message: 'TERRAIN_PLOT_OUTLINE_NOT_IN_DRAWING' });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('Ε5 — PDF: ο πίνακας συντεταγμένων ξαναδιαβάζεται στον server — ίδιος πυρήνας με τη συσκευή', async () => {
    pdfPages.mockResolvedValue([PDF_PAGE]);
    sent = { drawing: new File(['%PDF-1.7\n%…'], 'diagramma.pdf', { type: '' }), choice: choose('pdf:1:0') };
    await put();
    expect(firstWritten()).toMatchObject({
      publicationIdentity: 'terrain/plot-drawing',
      plotOutline: { candidateId: 'pdf:1:0', drawingUnit: null, origin: { source: 'pdf-table', page: 1 } },
    });
    expect(uploads[0].contentType).toBe('application/pdf');
  });

  it.each([
    ['DWG', { drawing: new File([new Uint8Array([65, 67, 49, 48, 51, 50, 0, 0])], 'x.dwg') }, 415, 'TERRAIN_DRAWING_DWG'],
    ['άγνωστο είδος', { drawing: new File(['just some text'], 'x.txt') }, 415, 'TERRAIN_DRAWING_TYPE_UNSUPPORTED'],
    ['DXF χωρίς μονάδα', { unit: undefined }, 422, 'TERRAIN_DRAWING_UNIT_REQUIRED'],
    ['χωρίς σχέδιο', { drawing: undefined }, 400, 'TERRAIN_DRAWING_REQUIRED'],
    ['χωρίς επιλογή', { choice: undefined }, 400, 'TERRAIN_PLOT_OUTLINE_INVALID'],
    ['DXF χωρίς κλειστή πολυγραμμή', { drawing: dxfFile(dxf()) }, 422, 'TERRAIN_DRAWING_UNREADABLE'],
  ] as const)('Ε6 — %s ⇒ ονομασμένη άρνηση, καμία εγγραφή', async (_label, override, statusCode, message) => {
    sent = { ...sent, ...override };
    await expect(put()).rejects.toMatchObject({ statusCode, message });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('Ε7 — 🔒 ξένη αγγελία ⇒ 404 και το σχέδιο ΔΕΝ διαβάζεται', async () => {
    callerUid = 'user_stranger';
    await expect(put()).rejects.toMatchObject({ statusCode: 404 });
    expect(formData).not.toHaveBeenCalled();
  });

  it('Ε8 — νέο σχέδιο ΔΙΑΔΕΧΕΤΑΙ το προηγούμενο σχέδιο — όχι την πηγή εδάφους', async () => {
    siblings = [{ id: 'file_old_drawing', publicationIdentity: 'terrain/plot-drawing', category: 'documents', status: 'ready' }];
    const response = await put();
    const { data } = await (response as unknown as Response).json() as { data: { supersedes: string[] } };
    expect(data.supersedes).toEqual(['file_old_drawing']);
  });
});

describe('ADR-920 §14.11 Ζ3c — αλλαγή περιγράμματος χωρίς νέο σχέδιο (PATCH)', () => {
  /** Ο δακτύλιος του τετραγώνου (5,5) σε canonical mm — ό,τι κουβαλά ήδη η δημοσιευμένη πηγή. */
  const RING_MM = square(5, 5).map(([e, n]) => [e * 1000, n * 1000]);
  let body: unknown = null;
  const json = jest.fn(async () => body);
  const patch = () => PATCH(
    { url: `https://x/api/owner-properties/${LISTING}/terrain`, nextUrl: { pathname: '/x' }, json } as never,
    { params: Promise.resolve({ ownerPropertyId: LISTING }) } as never,
  );
  const publishedWith = (plotOutline: unknown): void => {
    storedSourceBytes = JSON.stringify({ ...RELIEF_SOURCE, plotOutline });
  };
  const republished = (): { plotOutline: unknown } => JSON.parse(uploads[uploads.length - 1].buffer.toString('utf8'));

  beforeEach(() => {
    trace.length = 0;
    uploads.length = 0;
    siblings = [RELIEF_FILE];
    callerUid = OWNER;
    ownerProperty = { authorUserId: OWNER, authorCompanyId: null, dossierId: DOSSIER, type: 'plot', title: 'Οικόπεδο Σούνιο' };
    dossier = { userId: OWNER, label: 'Οικόπεδο', type: 'plot' };
    publishedWith({ ring: RING_MM, showInListing: true });
    storedDeclaration = encodeTerrainSurveyDeclaration({ surveyorName: 'Α. Τοπογράφος', surveyedOn: '2026-03-14', rightsAffirmed: true });
    body = { kind: 'visibility', showInListing: false };
    jest.clearAllMocks();
  });

  it('Π1 — 🏆 Π9: «όχι στην αγγελία» ⇒ νέα πηγή με ΙΔΙΟ δακτύλιο, διαδοχή της τρέχουσας, επαναπροβολή, ιστορικό', async () => {
    const response = await patch();
    const { data } = await (response as unknown as Response).json() as {
      data: { changed: boolean; outline: unknown; terrain: { fileId: string; supersedes: string[] } };
    };
    expect(republished().plotOutline).toEqual({ ring: RING_MM, showInListing: false });
    expect(data).toMatchObject({ changed: true, outline: { showInListing: false } });
    expect(data.terrain.supersedes).toEqual([RELIEF_FILE.id]);
    expect(refreshOwner).toHaveBeenCalledTimes(1);
    expect(recordChange).toHaveBeenCalledWith(expect.objectContaining({
      changes: [{ field: 'plotOutline', oldValue: RELIEF_FILE.id, newValue: data.terrain.fileId }],
    }));
  });

  it('Π2 — 🏆 ρητή αφαίρεση ⇒ νέα πηγή ΧΩΡΙΣ περίγραμμα· το σχέδιο δεν αγγίζεται', async () => {
    body = { kind: 'remove' };
    await patch();
    expect(republished().plotOutline).toBeNull();
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][0]).toMatchObject({ publicationIdentity: 'terrain/measured' });
  });

  it.each([
    ['ίδια Π9', { kind: 'visibility', showInListing: true }, true],
    ['αφαίρεση χωρίς περίγραμμα', { kind: 'remove' }, null],
  ] as const)('Π3 — ταυτοδύναμο: %s ⇒ changed:false, καμία εγγραφή, καμία επαναπροβολή', async (_label, sentBody, storedShown) => {
    body = sentBody;
    publishedWith(storedShown === null ? null : { ring: RING_MM, showInListing: storedShown });
    const response = await patch();
    const { data } = await (response as unknown as Response).json() as { data: { changed: boolean } };
    expect(data.changed).toBe(false);
    expect(setDoc).not.toHaveBeenCalled();
    expect(refreshOwner).not.toHaveBeenCalled();
    expect(recordChange).not.toHaveBeenCalled();
  });

  it('Π4 — 🔴 σχέδιο ΝΕΟΤΕΡΟ από την πηγή (έπεσε η επαναδημοσίευση): η αφαίρεση ΓΡΑΦΕΙΤΑΙ — αλλιώς θα την ξανάφερνε το επόμενο POST', async () => {
    publishedWith(null);
    siblings = [RELIEF_FILE, {
      id: 'file_drawing', publicationIdentity: 'terrain/plot-drawing', entityType: 'property_dossier', status: 'ready',
      storagePath: 'people/x/drawing.dxf', contentType: 'image/vnd.dxf', createdAt: '2026-11-20T10:00:00.000Z',
      plotOutline: {
        version: 1, ring: square(5, 5).map(([e, n]) => ({ x: e * 1000, y: n * 1000 })), showInListing: true, areaM2: 100,
        candidateId: 'dxf:P', origin: { source: 'dxf', handle: 'P', layer: 'ΟΡΙΟ', closure: 'flag' }, drawingUnit: 'm',
        drawingSha256: 'a'.repeat(64),
      },
    }];
    body = { kind: 'remove' };
    const response = await patch();
    const { data } = await (response as unknown as Response).json() as { data: { changed: boolean } };
    expect(data.changed).toBe(true);
    expect(republished().plotOutline).toBeNull();
  });

  it('Π5 — χωρίς ανάγλυφο ⇒ 409 TERRAIN_PLOT_OUTLINE_NO_RELIEF, καμία εγγραφή', async () => {
    siblings = [];
    await expect(patch()).rejects.toMatchObject({ statusCode: 409, message: 'TERRAIN_PLOT_OUTLINE_NO_RELIEF' });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('Π6 — Π9 σε ανάγλυφο ΧΩΡΙΣ περίγραμμα ⇒ 409 TERRAIN_PLOT_OUTLINE_NONE', async () => {
    publishedWith(null);
    await expect(patch()).rejects.toMatchObject({ statusCode: 409, message: 'TERRAIN_PLOT_OUTLINE_NONE' });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it.each([
    ['κενό σώμα', null],
    ['άγνωστο είδος', { kind: 'move' }],
    ['δακτύλιος από τον browser', { kind: 'visibility', showInListing: true, ring: [[0, 0]] }],
    ['Π9 χωρίς τιμή', { kind: 'visibility' }],
  ] as const)('Π7 — %s ⇒ 400 TERRAIN_PLOT_OUTLINE_AMENDMENT_INVALID', async (_label, sentBody) => {
    body = sentBody;
    await expect(patch()).rejects.toMatchObject({ statusCode: 400, message: 'TERRAIN_PLOT_OUTLINE_AMENDMENT_INVALID' });
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('Π8 — 🔒 ξένη αγγελία ⇒ 404 και το σώμα ΔΕΝ διαβάζεται', async () => {
    callerUid = 'user_stranger';
    await expect(patch()).rejects.toMatchObject({ statusCode: 404 });
    expect(json).not.toHaveBeenCalled();
  });
});

describe('ADR-920 §14.11 Ζ4 — κατάσταση περιγράμματος (GET)', () => {
  const RING_MM = square(5, 5).map(([e, n]) => [e * 1000, n * 1000]);
  const OTHER_RING_MM = square(2, 2).map(([e, n]) => [e * 1000, n * 1000]);
  /** Το σχέδιο του φακέλου με επιβεβαιωμένο το τετράγωνο (5,5) — `createdAt` και κάδος ανά σενάριο. */
  const drawingFile = (createdAt: string, trashed = false): Record<string, unknown> => ({
    id: 'file_drawing', publicationIdentity: 'terrain/plot-drawing', entityType: 'property_dossier', status: 'ready',
    storagePath: 'people/x/drawing.dxf', contentType: 'image/vnd.dxf', createdAt,
    displayName: 'Τοπογραφικό Σούνιο', originalFilename: 'diagramma.dxf',
    ...(trashed ? { isDeleted: true, lifecycleState: 'trashed' } : {}),
    plotOutline: {
      version: 1, ring: square(5, 5).map(([e, n]) => ({ x: e * 1000, y: n * 1000 })), showInListing: true, areaM2: 100,
      candidateId: 'dxf:P', origin: { source: 'dxf', handle: 'P', layer: 'ΟΡΙΟ', closure: 'flag' }, drawingUnit: 'm',
      drawingSha256: 'a'.repeat(64),
    },
  });
  const publishedWith = (plotOutline: unknown): void => {
    storedSourceBytes = JSON.stringify({ ...RELIEF_SOURCE, plotOutline });
  };
  interface Status {
    hasRelief: boolean;
    outline: { showInListing: boolean; areaM2: number; authority: string } | null;
    drawing: { fileId: string; fileName: string; place: string; isOutlineSource: boolean; origin: unknown } | null;
  }
  const status = async (): Promise<Status> => {
    const response = await GET(
      { url: `https://x/api/owner-properties/${LISTING}/terrain`, nextUrl: { pathname: '/x' } } as never,
      { params: Promise.resolve({ ownerPropertyId: LISTING }) } as never,
    );
    return (await (response as unknown as Response).json() as { data: Status }).data;
  };

  beforeEach(() => {
    trace.length = 0;
    siblings = [];
    callerUid = OWNER;
    ownerProperty = { authorUserId: OWNER, authorCompanyId: null, dossierId: DOSSIER, type: 'plot', title: 'Οικόπεδο Σούνιο' };
    dossier = { userId: OWNER, label: 'Οικόπεδο', type: 'plot' };
    publishedWith(null);
    storedDeclaration = encodeTerrainSurveyDeclaration({ surveyorName: 'Α. Τοπογράφος', surveyedOn: '2026-03-14', rightsAffirmed: true });
    jest.clearAllMocks();
  });

  it('Κ1 — άδειος φάκελος ⇒ τίποτα, και καμία εγγραφή', async () => {
    expect(await status()).toEqual({ hasRelief: false, outline: null, drawing: null });
    expect(setDoc).not.toHaveBeenCalled();
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('Κ2 — μόνο σχέδιο (Π2): το περίγραμμα περιμένει το πρώτο ανάγλυφο, αρχή = σχέδιο', async () => {
    siblings = [drawingFile('2026-11-20T10:00:00.000Z')];
    const data = await status();
    expect(data.hasRelief).toBe(false);
    expect(data.outline).toMatchObject({ showInListing: true, authority: 'drawing' });
    expect(data.outline?.areaM2).toBeCloseTo(100, 6);
    expect(data.drawing).toMatchObject({
      fileId: 'file_drawing', fileName: 'Τοπογραφικό Σούνιο', place: 'active', isOutlineSource: true,
      origin: { source: 'dxf', handle: 'P', layer: 'ΟΡΙΟ', closure: 'flag' },
    });
  });

  it('Κ3 — πηγή νεότερη από το σχέδιο: νικά η πηγή (το Π9 ΤΗΣ), και το σχέδιο μένει η προέλευση', async () => {
    siblings = [RELIEF_FILE, drawingFile('2026-10-01T10:00:00.000Z')];
    publishedWith({ ring: RING_MM, showInListing: false });
    const data = await status();
    expect(data.hasRelief).toBe(true);
    expect(data.outline).toMatchObject({ showInListing: false, authority: 'relief' });
    expect(data.drawing).toMatchObject({ place: 'active', isOutlineSource: true });
  });

  it('Κ4 — 🏆 σχέδιο ΣΤΟΝ ΚΑΔΟ: το περίγραμμα μένει (copy semantics) και το σχέδιο αναφέρεται ως «στον κάδο»', async () => {
    siblings = [RELIEF_FILE, drawingFile('2026-11-20T10:00:00.000Z', true)];
    publishedWith({ ring: RING_MM, showInListing: true });
    const data = await status();
    expect(data.outline).toMatchObject({ authority: 'relief', showInListing: true });
    expect(data.drawing).toMatchObject({ fileId: 'file_drawing', place: 'trash', isOutlineSource: true });
  });

  it('Κ5 — 🔴 η πηγή κουβαλά ΑΛΛΟ περίγραμμα από του σχεδίου ⇒ isOutlineSource:false (ποτέ ψεύτικη προέλευση)', async () => {
    siblings = [RELIEF_FILE, drawingFile('2026-10-01T10:00:00.000Z')];
    publishedWith({ ring: OTHER_RING_MM, showInListing: true });
    expect((await status()).drawing).toMatchObject({ isOutlineSource: false });
  });

  it('Κ6 — ρητή αφαίρεση στην πηγή (νεότερη): κανένα περίγραμμα, το σχέδιο δεν είναι πηγή κανενός', async () => {
    siblings = [RELIEF_FILE, drawingFile('2026-10-01T10:00:00.000Z')];
    const data = await status();
    expect(data.outline).toBeNull();
    expect(data.drawing).toMatchObject({ place: 'active', isOutlineSource: false });
  });

  it('Κ7 — 🔒 ξένη αγγελία ⇒ 404', async () => {
    callerUid = 'user_stranger';
    await expect(status()).rejects.toMatchObject({ statusCode: 404 });
  });
});
