/**
 * @fileoverview **Ψεύτικος κάδος GCS για tests** — αντικείμενα με crc32c/μέγεθος/γενιά, rewrite με καρφωμένη γενιά.
 * @module test-utils/fake-gcs/fake-gcs-bucket
 *
 * 🔑 **Ένας**, όχι ένας ανά σουίτα: τον μοιράζονται οι αγκύρες της κατοικίας δεδομένων (ADR-895 — πλακίδια, πρωτότυπα)
 * και της παράδοσης αρχείων στον αγοραστή (ADR-916 Φ-Γ1). Ζούσε ως δίδυμο σε δύο σουίτες με μικρές αποκλίσεις
 * (εξαγωγή Boy Scout, ADR-916 Φ-Γ1).
 *
 * Μιμείται **μόνο** όσα αγγίζει το `server/storage/placement-copy`: `file(name, { generation })` · `metadata` ·
 * `copy(dest, options)` (rewrite: με σώμα `metadata` αντικαθιστά τα custom metadata, αλλιώς τα κρατά) · `getFiles({ prefix })`.
 */

export interface FakeGcsObject {
  crc32c: string;
  size: number;
  generation?: number;
  /** Τα **custom** metadata (π.χ. `firebaseStorageDownloadTokens`). */
  metadata?: Record<string, string>;
}

export type FakeGcsStore = Map<string, FakeGcsObject>;

export interface FakeGcsCopyCall {
  readonly from: string;
  readonly to: string;
  /** Η γενιά που **καρφώθηκε** στην πηγή — `undefined` ⇒ αντιγράφηκε η τρέχουσα. */
  readonly generation: number | undefined;
  readonly options: Record<string, unknown>;
}

export interface FakeGcsBucketOptions {
  /** Κάθε rewrite, **μετά** την εγγραφή του προορισμού — για καταγραφή ή για «αλλαγή του κόσμου στο μεταξύ». */
  readonly onCopy?: (call: FakeGcsCopyCall) => void;
  /** Πηγή που λείπει: `throw` (το πραγματικό GCS — 404) ή `skip` (σουίτες που μετρούν μόνο το «τι ζητήθηκε»). */
  readonly missingSource?: 'throw' | 'skip';
}

export interface FakeGcsFile {
  readonly name: string;
  readonly bucket: FakeGcsBucket;
  readonly store: FakeGcsStore;
  readonly metadata: FakeGcsObject | Record<string, never>;
  copy(dest: { readonly name: string; readonly store: FakeGcsStore }, options?: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
}

export interface FakeGcsBucket {
  readonly name: string;
  readonly store: FakeGcsStore;
  file(path: string, opts?: { readonly generation?: number }): FakeGcsFile;
  getFiles(query: { readonly prefix: string }): Promise<[FakeGcsFile[]]>;
  deleteFiles(query: { readonly prefix: string }): Promise<void>;
}

/** Η γενιά του αντιγράφου — **νέα** (το GCS δίνει πάντα νέα γενιά στον προορισμό), ποτέ ίδια με της πηγής. */
const copiedGeneration = (generation: number | undefined): number | undefined => (generation === undefined ? undefined : generation + 100);

export function fakeGcsBucket(store: FakeGcsStore, name: string, options: FakeGcsBucketOptions = {}): FakeGcsBucket {
  const bucket: FakeGcsBucket = {
    name,
    store,
    file: (path, opts) => ({
      name: path,
      bucket,
      store,
      get metadata() { return store.get(path) ?? {}; },
      copy: async (dest, copyOptions = {}) => {
        const object = store.get(path);
        const call: FakeGcsCopyCall = { from: path, to: dest.name, generation: opts?.generation, options: copyOptions };
        if (object === undefined) {
          if (options.missingSource !== 'skip') throw new Error(`404 ${path}`);
          options.onCopy?.(call); // η κλήση **έγινε** — απλώς δεν μετέφερε τίποτα
          return;
        }
        if (opts?.generation !== undefined && opts.generation !== object.generation) throw new Error(`412 generation ${path}`);
        const metadata = 'metadata' in copyOptions ? (copyOptions.metadata as Record<string, string>) : object.metadata;
        dest.store.set(dest.name, { ...object, generation: copiedGeneration(object.generation), ...(metadata ? { metadata } : {}) });
        options.onCopy?.(call);
      },
      delete: async () => { store.delete(path); },
    }),
    getFiles: async ({ prefix }) => [[...store.keys()].filter((key) => key.startsWith(prefix)).map((key) => bucket.file(key))],
    deleteFiles: async ({ prefix }) => {
      for (const key of [...store.keys()]) if (key.startsWith(prefix)) store.delete(key);
    },
  };
  return bucket;
}
