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
 * 🧷 ADR-916 Φ-Δ.7β — **soft delete** (`server/storage/soft-deleted-object.server`): κάθε `delete` κρατά τη γενιά στο
 * `softDeleted` (ο κάδος έχει soft delete, όπως οι πραγματικοί μας)· `get({ softDeleted, generation })` δίνει **μόνο**
 * μεταδεδομένα (ή `404`)· `restore({ generation, ifGenerationMatch: 0 })` ⇒ **νέα** γενιά + `timeCreated`, `412` σε ζωντανό,
 * `404` σε ανύπαρκτη· `delete({ ifGenerationMatch })` ⇒ `412` σε άλλη γενιά, `404` σε απούσα.
 */

import { createHash } from 'crypto';
import { Readable } from 'stream';
import { nowISO } from '@/lib/date-local';

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
  /** Φ-Δ.7β — πότε γεννήθηκε **αυτή** η γενιά (το `restore` τη θέτει στη στιγμή της επαναφοράς, όπως το GCS). */
  timeCreated?: string;
}

export type FakeGcsStore = Map<string, FakeGcsObject>;

/** Φ-Δ.7β — οι soft-deleted γενιές ανά όνομα (παλαιότερη πρώτη). */
export type FakeGcsSoftDeletedStore = Map<string, FakeGcsObject[]>;

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
  /** Φ-Δ.7β — κάθε επαναφορά, **μετά** τη γέννηση της νέας γενιάς (για «κρασάρισμα» ή καταγραφή). */
  readonly onRestore?: (call: { readonly path: string; readonly generation: number; readonly restoredGeneration: number }) => void;
}

/** Φ-Δ.7β — αυτό που δίνει το `get({ softDeleted: true })`: όνομα + μεταδεδομένα της soft-deleted γενιάς, τίποτα άλλο. */
export interface FakeGcsSoftDeletedFile {
  readonly name: string;
  readonly metadata: FakeGcsObject;
}

interface FakeGcsPreconditions {
  readonly ifGenerationMatch?: number;
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
  delete(options?: FakeGcsPreconditions): Promise<void>;
  /** ADR-916 Φ-Δ.6 — μόνο το `temporaryHold`· αντικείμενο που λείπει ⇒ `code: 404`. */
  setMetadata(patch: { readonly temporaryHold: boolean }): Promise<void>;
  /** Φ-Δ.7β — μόνο `{ softDeleted: true, generation }` (τα μεταδεδομένα της soft-deleted γενιάς). */
  get(options: { readonly softDeleted: true; readonly generation: number }): Promise<[FakeGcsSoftDeletedFile]>;
  restore(options: { readonly generation: number } & FakeGcsPreconditions): Promise<FakeGcsObject>;
}

export interface FakeGcsBucket {
  readonly name: string;
  readonly store: FakeGcsStore;
  /** Φ-Δ.7β — ό,τι σβήστηκε, ανά όνομα. */
  readonly softDeleted: FakeGcsSoftDeletedStore;
  file(path: string, opts?: { readonly generation?: number }): FakeGcsFile;
  getFiles(query: { readonly prefix: string }): Promise<[FakeGcsFile[]]>;
  deleteFiles(query: { readonly prefix: string }): Promise<void>;
}

/** Η γενιά του αντιγράφου — **νέα** (το GCS δίνει πάντα νέα γενιά στον προορισμό), ποτέ ίδια με της πηγής. */
const copiedGeneration = (generation: number | undefined): number | undefined => (generation === undefined ? undefined : generation + 100);

/** Ψεύτικο crc32c — ντετερμινιστικό από τα bytes (ίδια bytes ⇒ ίδιο «crc32c»), αρκετό για το `sameObject`. */
const fakeCrc32cOf = (bytes: Uint8Array): string => `crc_${createHash('sha256').update(bytes).digest('hex').slice(0, 12)}`;

const heldError = (path: string): Error => Object.assign(new Error(`403 object under temporary hold ${path}`), { code: 403 });
const coded = (code: 404 | 412, message: string): Error => Object.assign(new Error(`${code} ${message}`), { code });
const isHeld = (store: FakeGcsStore, path: string): boolean => store.get(path)?.temporaryHold === true;

/** Η soft-deleted γενιά ενός ονόματος — `undefined` αν δεν υπάρχει. */
const softDeletedOf = (softDeleted: FakeGcsSoftDeletedStore, path: string, generation: number): FakeGcsObject | undefined =>
  softDeleted.get(path)?.find((object) => object.generation === generation);

export function fakeGcsBucket(store: FakeGcsStore, name: string, options: FakeGcsBucketOptions = {}): FakeGcsBucket {
  let nextGeneration = 1000;
  const softDeleted: FakeGcsSoftDeletedStore = new Map();
  /** Σβήνει το ζωντανό **και** το κρατά soft-deleted (όπως οι κάδοι μας, 7 ημέρες). */
  const softDelete = (path: string): void => {
    const object = store.get(path);
    if (object === undefined) return;
    store.delete(path);
    softDeleted.set(path, [...(softDeleted.get(path) ?? []), object]);
  };
  const bucket: FakeGcsBucket = {
    name,
    store,
    softDeleted,
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
      delete: async (deleteOptions = {}) => {
        const expected = deleteOptions.ifGenerationMatch;
        if (expected !== undefined && !store.has(path)) throw coded(404, path);
        if (expected !== undefined && store.get(path)?.generation !== expected) throw coded(412, `generation ${path}`);
        if (isHeld(store, path)) throw heldError(path);
        softDelete(path);
      },
      setMetadata: async (patch) => {
        const object = store.get(path);
        if (object === undefined) throw coded(404, path);
        store.set(path, { ...object, temporaryHold: patch.temporaryHold });
      },
      get: async ({ generation }) => {
        const object = softDeletedOf(softDeleted, path, generation);
        if (object === undefined) throw coded(404, `soft-deleted ${path}#${generation}`);
        return [{ name: path, metadata: object }];
      },
      restore: async ({ generation, ifGenerationMatch }) => {
        if (ifGenerationMatch === 0 && store.has(path)) throw coded(412, `live ${path}`);
        const object = softDeletedOf(softDeleted, path, generation);
        if (object === undefined) throw coded(404, `soft-deleted ${path}#${generation}`);
        nextGeneration += 1;
        const { temporaryHold: _notRestored, ...carried } = object;
        const restored: FakeGcsObject = { ...carried, generation: nextGeneration, timeCreated: nowISO() };
        store.set(path, restored);
        options.onRestore?.({ path, generation, restoredGeneration: nextGeneration });
        return restored;
      },
    }),
    getFiles: async ({ prefix }) => [[...store.keys()].filter((key) => key.startsWith(prefix)).map((key) => bucket.file(key))],
    deleteFiles: async ({ prefix }) => {
      // Το πραγματικό `deleteFiles({ force: true })` προσπερνά ό,τι αρνείται η πλατφόρμα — ο δεσμευμένος μένει.
      for (const key of [...store.keys()]) if (key.startsWith(prefix) && !isHeld(store, key)) softDelete(key);
    },
  };
  return bucket;
}
