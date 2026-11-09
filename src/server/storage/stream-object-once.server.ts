import 'server-only';

/**
 * @fileoverview **ΡΟΗ → ΑΝΤΙΚΕΙΜΕΝΟ ΜΕ ΚΛΕΙΔΙ ΑΠΟ ΤΟ ΠΕΡΙΕΧΟΜΕΝΟ, ΜΙΑ ΦΟΡΑ** — χωρίς ποτέ ολόκληρο το αρχείο στη μνήμη
 *               (ADR-934 §5.2.2 Μ-β3).
 * @related server/storage/create-object-once.server.ts (ο αδελφός για bytes στη μνήμη· η ΙΔΙΑ κρίση «υπάρχει ήδη») ·
 *          lib/storage/sha256-pass-through.ts (ο ΕΝΑΣ μετρητής ροής) · server/storage/placement-copy.ts (καρφωμένη γενιά · απόδειξη)
 * @module server/storage/stream-object-once.server
 *
 * 🔑 **Γιατί δύο βήματα**: το τελικό κλειδί **εξαρτάται** από το sha256 (ίδιο περιεχόμενο ⇒ ίδιο αρχείο), και το sha256
 *    υπάρχει μόνο **όταν τελειώσει** η ροή. Άρα: ροή → **προσωρινό** αντικείμενο (μέτρηση sha256 + μεγέθους στο πέρασμα) →
 *    **αντιγραφή** στο τελικό κλειδί με `ifGenerationMatch: 0` → διαγραφή του προσωρινού. Ίδιο σχήμα με το ανέβασμα blob
 *    ενός OCI registry (`uploads/` → `blobs/sha256:…`) και την καραντίνα του tour-capture. Μέσα στον ίδιο κάδο η αντιγραφή
 *    είναι rewrite μεταδεδομένων, όχι δεύτερη μεταφορά bytes.
 * 🔑 **Ατομικό από τον πάροχο**: ένα simple upload **δεν υπάρχει** στον κάδο αν η ροή σπάσει στη μέση — κανένα μισό αρχείο.
 * 🔑 **Το όριο είναι μέσα στη ροή** (`maxBytes`): η υπέρβαση σπάει τη ροή με `STREAM_TOO_LARGE`, όχι μετά.
 * 🔑 **Ο καλών αποφασίζει το κλειδί από ό,τι μετρήθηκε** (`destinationOf`): `null` ⇒ δεν προάγεται τίποτα — π.χ. το μετρημένο
 *    μέγεθος δεν περνά την κρίση ⇒ κανένα ορφανό αντικείμενο στο τελικό κλειδί.
 * 🔴 Τελικό κλειδί που **υπάρχει** ήδη με **άλλα** bytes (crc32c · μέγεθος) ⇒ σφάλμα: κλειδί από περιεχόμενο που δεν
 *    ταιριάζει με το περιεχόμενο είναι βλάβη του καλούντος, ποτέ «υιοθέτηση».
 */

import type { Bucket, File } from '@google-cloud/storage';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

import { sha256PassThrough } from '@/lib/storage/sha256-pass-through';
import { createModuleLogger } from '@/lib/telemetry';

import { isCreateOnceRefusal } from './create-object-once.server';
import { pinnedToGeneration, sameObject, statObjects } from './placement-copy';

const logger = createModuleLogger('StreamObjectOnce');

/** Ό,τι μετρήθηκε στο πέρασμα της ροής. */
export interface MeasuredStream {
  /** 64 χαρακτήρες lowercase hex. */
  readonly sha256: string;
  readonly size: number;
}

export interface StreamObjectOnceInput {
  readonly bucket: Bucket;
  /** Μοναδικό ανά προσπάθεια· ζει μόνο όσο κρατά η πράξη (καθαρίζεται εδώ, με δίχτυ τον κύκλο ζωής του καλούντος). */
  readonly stagingPath: string;
  readonly body: ReadableStream<Uint8Array>;
  readonly contentType: string;
  readonly maxBytes: number;
  /** Το τελικό κλειδί από τη μέτρηση — `null` ⇒ δεν προάγεται. */
  readonly destinationOf: (measured: MeasuredStream) => string | null;
}

export type StreamObjectOutcome =
  /** Γράφτηκε **τώρα** στο τελικό κλειδί. */
  | { readonly kind: 'created'; readonly file: File; readonly measured: MeasuredStream }
  /** Το τελικό κλειδί είχε ήδη **τα ίδια** bytes — τίποτα δεν γράφτηκε. */
  | { readonly kind: 'exists'; readonly file: File; readonly measured: MeasuredStream }
  /** Ο καλών αρνήθηκε την προαγωγή μετά τη μέτρηση. */
  | { readonly kind: 'declined'; readonly measured: MeasuredStream };

/** Τα κομμάτια της Web ροής για Node· διακοπή πριν το τέλος ⇒ ακύρωση της πηγής (κλείνει τη σύνδεση). */
async function* chunksOf(body: ReadableStream<Uint8Array>): AsyncGenerator<Uint8Array> {
  const reader = body.getReader();
  let finished = false;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) {
        finished = true;
        return;
      }
      yield next.value;
    }
  } finally {
    if (!finished) await reader.cancel().catch(() => undefined);
  }
}

async function streamToStaging(staging: File, input: StreamObjectOnceInput): Promise<MeasuredStream> {
  const hash = sha256PassThrough(input.maxBytes);
  const sink = staging.createWriteStream({
    resumable: false,
    contentType: input.contentType,
    validation: 'crc32c',
    preconditionOpts: { ifGenerationMatch: 0 },
  });
  await pipeline(Readable.from(chunksOf(input.body), { objectMode: false }), hash.stream, sink);
  return { sha256: hash.digestHex(), size: hash.bytes() };
}

/** Αντιγραφή στο τελικό κλειδί **μόνο αν είναι κενό** — και απόδειξη ότι εκεί βρίσκονται τα ίδια bytes. */
async function promote(bucket: Bucket, staged: File, destination: string): Promise<{ kind: 'created' | 'exists'; file: File }> {
  let failure: unknown = null;
  try {
    await pinnedToGeneration(staged).copy(bucket.file(destination), { preconditionOpts: { ifGenerationMatch: 0 } });
  } catch (error) {
    failure = error;
  }
  const [stored] = await statObjects(bucket, [destination]);
  if (stored === undefined) {
    if (failure !== null) throw failure;
    throw new Error(`Object missing right after promotion: ${destination}`);
  }
  if (failure !== null && !isCreateOnceRefusal(failure)) throw failure;
  if (!sameObject(staged, stored)) throw new Error(`Content-addressed key holds other bytes: ${destination}`);
  return { kind: failure === null ? 'created' : 'exists', file: stored };
}

async function discardStaging(staging: File): Promise<void> {
  try {
    await staging.delete({ ignoreNotFound: true });
  } catch (error) {
    logger.warn('Staging object was not removed', { path: staging.name, error: String(error) });
  }
}

/**
 * **Η ροή γίνεται αντικείμενο με κλειδί από το περιεχόμενο, μία φορά.** Σφάλμα της ροής (όριο · λήξη χρόνου · πηγή) πετά
 * **χωρίς** να αφήσει τίποτα: το simple upload δεν υπάρχει πριν κλείσει επιτυχώς.
 */
export async function streamObjectOnce(input: StreamObjectOnceInput): Promise<StreamObjectOutcome> {
  const staging = input.bucket.file(input.stagingPath);
  const measured = await streamToStaging(staging, input);
  try {
    const destination = input.destinationOf(measured);
    if (destination === null) return { kind: 'declined', measured };
    const [staged] = await statObjects(input.bucket, [input.stagingPath]);
    if (staged === undefined) throw new Error(`Staged object missing: ${input.stagingPath}`);
    return { ...(await promote(input.bucket, staged, destination)), measured };
  } finally {
    await discardStaging(staging);
  }
}
