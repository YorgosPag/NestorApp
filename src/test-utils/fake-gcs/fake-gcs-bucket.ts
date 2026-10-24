/**
 * @fileoverview **Ψεύτικος κάδος GCS για tests** — αντικείμενα με crc32c/μέγεθος/γενιά, rewrite με καρφωμένη γενιά.
 * @module test-utils/fake-gcs/fake-gcs-bucket
 *
 * 🔑 **Ένας**, όχι ένας ανά σουίτα: τον μοιράζονται οι αγκύρες της κατοικίας δεδομένων (ADR-895 — πλακίδια, πρωτότυπα)
 * και της παράδοσης αρχείων στον αγοραστή (ADR-916 Φ-Γ1). Ζούσε ως δίδυμο σε δύο σουίτες με μικρές αποκλίσεις
 * (εξαγωγή Boy Scout, ADR-916 Φ-Γ1).
 *
 * Μιμείται **μόνο** όσα αγγίζει το `server/storage/placement-copy`: `file(name, { generation })` · `metadata` ·
 * `copy(dest, options)` (rewrite: με σώμα `metadata` αντικαθιστά τα custom metadata, αλλιώς τα κρατά) · `getFiles({ prefix })` —
 * και το `server/storage/object-sha256` (ADR-916 Φ-Γ2 Σ2): `createReadStream()` σε **κομμάτια**, με καρφωμένη γενιά που
 * λείπει ⇒ σφάλμα `code: 404`, όπως το πραγματικό GCS.
 * 📜 ADR-916 Φ-Δ.6 — **`temporaryHold`** (`setMetadata`): αντικείμενο σε δέσμευση **δεν** σβήνεται (`delete` · `deleteFiles`)
 * ούτε αντικαθίσταται (`save` · `copy` προς αυτό) ⇒ `code: 403`, όπως το πραγματικό GCS· το rewrite **δεν** μεταφέρει τη
 * δέσμευση στον προορισμό.
 */

import { createHash } from 'crypto';
import { Readable } from 'stream';

export interface FakeGcsObject {
  crc32c: string;
  size: number;
  generation?: number;
  /** Τα **custom** metadata (π.χ. `firebaseStorageDownloadTokens`). */
  metadata?: Record<string, string>;
  /** Τα bytes — μόνο για σουίτες που τα **διαβάζουν** (`createReadStream`)· το rewrite τα μεταφέρει αυτολεξεί. */
  bytes?: Uint8Array;
  /** GCS `temporaryHold` — ούτε διαγραφή ούτε αντικατάσταση. */
  temporaryHold?: boolean;
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
  /** Κάθε ανάγνωση, **πριν** κριθεί η γενιά — για καταγραφή ή για «ο κόσμος άλλαξε ανάμεσα σε μέτρηση και ανάγνωση». */
  readonly onRead?: (call: { readonly path: string; readonly generation: number | undefined }) => void;
  /**
   * Τι απαντά το `save` με `ifGenerationMatch: 0` πάνω σε **δεσμευμένο** αντικείμενο. Η GCS δεν τεκμηριώνει τη σειρά
   * (προϋπόθεση ή δέσμευση πρώτα)· οι σουίτες δοκιμάζουν **και τις δύο**. Προεπιλογή `403` (η δέσμευση νικά).
   */
  readonly heldSaveCode?: 403 | 412;
}

/** Μέγεθος κομματιού της ψεύτικης ροής — μικρό επίτηδες, ώστε κάθε αρχείο να φτάνει σε **πολλά** κομμάτια. */
const FAKE_READ_CHUNK = 64;

export interface FakeGcsFile {
  readonly name: string;
  readonly bucket: FakeGcsBucket;
  readonly store: FakeGcsStore;
  readonly metadata: FakeGcsObject | Record<string, never>;
  copy(dest: { readonly name: string; readonly store: FakeGcsStore }, options?: Record<string, unknown>): Promise<void>;
  /** ADR-916 Σ4 — ανέβασμα· `preconditionOpts.ifGenerationMatch: 0` σε υπάρχον ⇒ σφάλμα `code: 412`, όπως το πραγματικό GCS. */
  save(data: Uint8Array, options?: { readonly preconditionOpts?: { readonly ifGenerationMatch?: number }; readonly contentType?: string }): Promise<void>;
  createReadStream(): Readable;
  delete(): Promise<void>;
  /** ADR-916 Φ-Δ.6 — μόνο το `temporaryHold`· αντικείμενο που λείπει ⇒ `code: 404`. */
  setMetadata(patch: { readonly temporaryHold: boolean }): Promise<void>;
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

/** Ψεύτικο crc32c — ντετερμινιστικό από τα bytes (ίδια bytes ⇒ ίδιο «crc32c»), αρκετό για το `sameObject`. */
const fakeCrc32cOf = (bytes: Uint8Array): string => `crc_${createHash('sha256').update(bytes).digest('hex').slice(0, 12)}`;

const heldError = (path: string): Error => Object.assign(new Error(`403 object under temporary hold ${path}`), { code: 403 });
const isHeld = (store: FakeGcsStore, path: string): boolean => store.get(path)?.temporaryHold === true;

export function fakeGcsBucket(store: FakeGcsStore, name: string, options: FakeGcsBucketOptions = {}): FakeGcsBucket {
  let nextGeneration = 1000;
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
        if (isHeld(dest.store, dest.name)) throw heldError(dest.name);
        const metadata = 'metadata' in copyOptions ? (copyOptions.metadata as Record<string, string>) : object.metadata;
        const { temporaryHold: _notCopied, ...carried } = object;
        dest.store.set(dest.name, { ...carried, generation: copiedGeneration(object.generation), ...(metadata ? { metadata } : {}) });
        options.onCopy?.(call);
      },
      save: async (data, saveOptions = {}) => {
        const preconditionFails = saveOptions.preconditionOpts?.ifGenerationMatch === 0 && store.has(path);
        if (isHeld(store, path) && !(preconditionFails && options.heldSaveCode === 412)) throw heldError(path);
        if (preconditionFails) throw Object.assign(new Error(`412 precondition ${path}`), { code: 412 });
        const bytes = new Uint8Array(data);
        nextGeneration += 1;
        store.set(path, { crc32c: fakeCrc32cOf(bytes), size: bytes.length, generation: nextGeneration, bytes });
      },
      createReadStream: () => {
        options.onRead?.({ path, generation: opts?.generation });
        const object = store.get(path);
        if (object === undefined || (opts?.generation !== undefined && opts.generation !== object.generation)) {
          return new Readable({ read() { this.destroy(Object.assign(new Error(`404 ${path}`), { code: 404 })); } });
        }
        if (object.bytes === undefined) throw new Error(`fake object ${path} has no bytes`);
        const { bytes } = object;
        const chunks = Array.from({ length: Math.ceil(bytes.length / FAKE_READ_CHUNK) }, (_, i) => Buffer.from(bytes.subarray(i * FAKE_READ_CHUNK, (i + 1) * FAKE_READ_CHUNK)));
        return Readable.from(chunks);
      },
      delete: async () => {
        if (isHeld(store, path)) throw heldError(path);
        store.delete(path);
      },
      setMetadata: async (patch) => {
        const object = store.get(path);
        if (object === undefined) throw Object.assign(new Error(`404 ${path}`), { code: 404 });
        store.set(path, { ...object, temporaryHold: patch.temporaryHold });
      },
    }),
    getFiles: async ({ prefix }) => [[...store.keys()].filter((key) => key.startsWith(prefix)).map((key) => bucket.file(key))],
    deleteFiles: async ({ prefix }) => {
      // Το πραγματικό `deleteFiles({ force: true })` προσπερνά ό,τι αρνείται η πλατφόρμα — ο δεσμευμένος μένει.
      for (const key of [...store.keys()]) if (key.startsWith(prefix) && !isHeld(store, key)) store.delete(key);
    },
  };
  return bucket;
}
