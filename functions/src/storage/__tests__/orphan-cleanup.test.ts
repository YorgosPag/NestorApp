/**
 * ADR-694 Α1 — ο **αρχιτεκτονικός** έλεγχος: το real-time μονοπάτι (`onStorageFinalize`)
 * δεν επιτρέπεται να διαγράψει αρχείο, ποτέ, για κανέναν λόγο.
 *
 * Γιατί source-level guard και όχι μόνο behavioural test: η προηγούμενη έκδοση ήταν
 * *σωστά γραμμένη* — απλώς απαντούσε σε λάθος ερώτηση, και το λάθος ήταν **μία γραμμή**
 * (`await bucket.file(filePath).delete()`). Ένα behavioural test θα το έπιανε μόνο αν
 * κάποιος θυμόταν να γράψει το σενάριο. Αυτό εδώ το πιάνει ό,τι κι αν συμβεί, γιατί
 * κλειδώνει την **ιδιότητα**: σε αυτό το αρχείο δεν υπάρχει δρόμος προς διαγραφή Storage.
 *
 * Ο μόνος επιτρεπτός destructive δρόμος ζει στο `orphan-sweeper.ts`, με 4 φράγματα.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const CLEANUP_SOURCE = readFileSync(join(__dirname, '..', 'orphan-cleanup.ts'), 'utf8');

/**
 * ADR-895 Φ2: το real-time μονοπάτι έχει πλέον ΚΑΙ gen2 bindings + έναν προσαρμογέα — ο ίδιος φρουρός
 * τα καλύπτει, αλλιώς ένα `delete` θα γλιστρούσε στο αρχείο των bindings αντί στο σώμα.
 */
const REALTIME_SOURCES: ReadonlyArray<readonly [string, string]> = [
  'orphan-cleanup.ts',
  'regional-storage-triggers.ts',
  'finalized-object.ts',
  'finalize-runtime.ts',
].map((f) => [f, readFileSync(join(__dirname, '..', f), 'utf8')] as const);

const LEGACY = 'legacy-default' as const;

/** Οι κώδικες που διαγράφουν αντικείμενο Storage μέσω Admin SDK. */
const STORAGE_DELETE_PATTERNS: readonly RegExp[] = [
  /bucket\s*\(\s*\)\s*\.\s*file\s*\(/,
  /\.\s*file\s*\([^)]*\)\s*\.\s*delete\s*\(/,
  /admin\s*\.\s*storage\s*\(/,
];

describe('orphan-cleanup — μηδέν διαγραφή Storage στο real-time μονοπάτι (ADR-694 Α1)', () => {
  it.each(STORAGE_DELETE_PATTERNS.map((p) => [p.source, p] as const))(
    '🔴 ΔΕΝ περιέχει δρόμο διαγραφής Storage: /%s/',
    (_label, pattern) => {
      // Αφαιρούμε τα σχόλια: το header ΠΕΡΙΓΡΑΦΕΙ την παλιά συμπεριφορά, δεν την εκτελεί.
      const code = CLEANUP_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code).not.toMatch(pattern);
    },
  );

  it.each(REALTIME_SOURCES.flatMap(([file, src]) => STORAGE_DELETE_PATTERNS.map((p) => [file, p.source, src, p] as const)))(
    '🔴 %s: ΔΕΝ περιέχει δρόμο διαγραφής Storage /%s/',
    (_file, _label, src, pattern) => {
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code).not.toMatch(pattern);
    },
  );

  it('δεν εισάγει καν το storage handle του Admin SDK', () => {
    const code = CLEANUP_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/const\s+storage\s*=/);
  });

  it('περνά από το custody SSoT — δεν ξανα-υλοποιεί ownership λογική', () => {
    expect(CLEANUP_SOURCE).toMatch(/from\s+'\.\/storage-path-custody'/);
  });
});

describe('candidateDocId — σταθερό, idempotent, έγκυρο ως Firestore doc id', () => {
  // Το import γίνεται εδώ ώστε τα mocks να είναι ενεργά πριν αποτιμηθεί το module scope.
  const load = (): typeof import('../orphan-cleanup') => {
    jest.doMock('firebase-functions/v1', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
      runWith: () => ({ storage: { object: () => ({ onFinalize: (f: unknown) => f }) } }),
    }));
    jest.doMock('firebase-admin', () => ({ firestore: () => ({}) }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    return require('../orphan-cleanup');
  };

  const PATH = 'companies/c1/bim-material-textures/bmat_34929e3b/albedo.jpg';

  it('ποτέ δεν παράγει «/» (απαγορευμένο σε doc id)', () => {
    expect(load().candidateDocId(PATH, LEGACY)).not.toContain('/');
  });

  it('ίδιο path → ίδιο id (idempotent — το re-upload ενημερώνει, δεν πολλαπλασιάζει)', () => {
    const { candidateDocId } = load();
    expect(candidateDocId(PATH, LEGACY)).toBe(candidateDocId(PATH, LEGACY));
  });

  it('διαφορετικά paths → διαφορετικά ids', () => {
    const { candidateDocId } = load();
    expect(candidateDocId(PATH, LEGACY)).not.toBe(candidateDocId(`${PATH}x`, LEGACY));
  });

  it('τα δύο κανάλια του ΙΔΙΟΥ υλικού είναι ξεχωριστοί υποψήφιοι', () => {
    const { candidateDocId } = load();
    const albedo = 'companies/c1/bim-material-textures/bmat_1/albedo.jpg';
    const normal = 'companies/c1/bim-material-textures/bmat_1/normal.png';
    expect(candidateDocId(albedo, LEGACY)).not.toBe(candidateDocId(normal, LEGACY));
  });

  it('🔴 legacy: το κλειδί είναι ΑΥΤΟΛΕΞΕΙ το προ-ADR-895 (κάθε υπάρχον σημάδι μένει έγκυρο)', () => {
    // Ανεξάρτητο μαντείο: το base64url του Node (χωρίς padding, `-`/`_`) = ο παλιός αλγόριθμος.
    expect(load().candidateDocId(PATH, LEGACY)).toBe(Buffer.from(PATH, 'utf8').toString('base64url'));
  });

  it('🔴 Ρ14: το ΙΔΙΟ path σε δύο κάδους ⇒ ΔΥΟ υποψήφιοι (όχι ένα έγγραφο που συγχωνεύει τους κάδους)', () => {
    const { candidateDocId } = load();
    expect(candidateDocId(PATH, 'eu-originals')).not.toBe(candidateDocId(PATH, LEGACY));
    expect(candidateDocId(PATH, 'eu-originals')).not.toContain('/');
  });
});

describe('onStorageFinalize — καταγράφει τον κάδο του αντικειμένου στο σημάδι (ADR-895 Α7)', () => {
  const PATH = 'companies/c1/bim-material-textures/bmat_1/albedo.jpg';
  const docIds: string[] = [];
  beforeEach(() => {
    docIds.length = 0;
  });

  /** Φρέσκο module κάθε φορά — διαφορετικό `resolveCustody` ανά test. */
  function loadWithMocks(opts: {
    custody: unknown;
    setSpy: jest.Mock;
    resolveCustodySpy: jest.Mock;
  }): (object: { name: string; bucket: string; contentType?: string; size?: string }) => Promise<void> {
    jest.resetModules();
    jest.doMock('firebase-functions/v1', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
      runWith: () => ({ storage: { object: () => ({ onFinalize: (f: unknown) => f }) } }),
    }));
    jest.doMock('firebase-admin', () => ({
      firestore: Object.assign(
        () => ({
          collection: () => ({
            doc: (id: string) => {
              docIds.push(id);
              return { get: async () => ({ exists: false }), set: opts.setSpy, delete: jest.fn() };
            },
          }),
        }),
        { FieldValue: { serverTimestamp: () => '__ts' } },
      ),
    }));
    jest.doMock('../file-record-bucket', () => ({
      fileStorageBucketNames: () => ({ 'legacy-default': 'default-bucket', 'eu-originals': 'eu-bucket' }),
    }));
    jest.doMock('../storage-path-custody', () => ({
      resolveCustody: (...args: unknown[]) => opts.resolveCustodySpy(...args),
    }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    return require('../orphan-cleanup').onStorageFinalize;
  }

  it('γράφει `bucket: object.bucket` στο σημάδι (ώστε ο sweeper να ξέρει ΠΟΥ να σβήσει)', async () => {
    const setSpy = jest.fn();
    const resolveCustodySpy = jest.fn().mockResolvedValue({ kind: 'unknown', reason: 'no-custody-rule' });
    const onFinalize = loadWithMocks({ custody: undefined, setSpy, resolveCustodySpy });

    await onFinalize({ name: PATH, bucket: 'eu-bucket', contentType: 'image/jpeg', size: '10' });

    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: 'eu-bucket', storagePath: PATH }),
      { merge: true },
    );
  });

  it('🔴 Ρ14: ίδιο path στον κανονικό ΚΑΙ στον ΕΕ ⇒ δύο διαφορετικά έγγραφα υποψηφίων', async () => {
    const resolveCustodySpy = jest.fn().mockResolvedValue({ kind: 'unknown', reason: 'no-custody-rule' });
    const onFinalize = loadWithMocks({ custody: undefined, setSpy: jest.fn(), resolveCustodySpy });

    await onFinalize({ name: PATH, bucket: 'default-bucket' });
    await onFinalize({ name: PATH, bucket: 'eu-bucket' });

    expect(docIds).toHaveLength(2);
    expect(docIds[0]).toBe(Buffer.from(PATH, 'utf8').toString('base64url'));
    expect(docIds[1]).not.toBe(docIds[0]);
  });

  it('⛔ γεγονός από αδήλωτο κάδο ⇒ ΚΑΝΕΝΑ σημάδι, καμία κρίση (fail-closed)', async () => {
    const setSpy = jest.fn();
    const resolveCustodySpy = jest.fn();
    const onFinalize = loadWithMocks({ custody: undefined, setSpy, resolveCustodySpy });

    await onFinalize({ name: PATH, bucket: 'stranger-bucket' });

    expect(resolveCustodySpy).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('size: η συμβολοσειρά του gen1 γράφεται ως ΑΡΙΘΜΟΣ (ένα σχήμα ανεξάρτητα από γενιά)', async () => {
    const setSpy = jest.fn();
    const resolveCustodySpy = jest.fn().mockResolvedValue({ kind: 'unknown', reason: 'no-custody-rule' });
    const onFinalize = loadWithMocks({ custody: undefined, setSpy, resolveCustodySpy });

    await onFinalize({ name: PATH, bucket: 'default-bucket', size: '10' });

    expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({ size: 10 }), { merge: true });
  });

  it('περνά το `object.bucket` στο `resolveCustody` ως bucketContext (bucket-aware επανέλεγχος)', async () => {
    const resolveCustodySpy = jest.fn().mockResolvedValue({ kind: 'unknown', reason: 'no-custody-rule' });
    const onFinalize = loadWithMocks({ custody: undefined, setSpy: jest.fn(), resolveCustodySpy });

    await onFinalize({ name: PATH, bucket: 'eu-bucket' });

    expect(resolveCustodySpy).toHaveBeenCalledWith(
      expect.anything(),
      PATH,
      { bucketName: 'eu-bucket', bucketNames: { 'legacy-default': 'default-bucket', 'eu-originals': 'eu-bucket' } },
    );
  });
});
