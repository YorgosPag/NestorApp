import 'server-only';

/**
 * @fileoverview **ΑΝΤΙΓΡΑΦΗ ΑΝΤΙΚΕΙΜΕΝΩΝ ΑΝΑΜΕΣΑ ΣΕ ΚΑΔΟΥΣ, ΜΕ ΑΠΟΔΕΙΞΗ** — ο ΕΝΑΣ μηχανισμός της κατοικίας δεδομένων
 * (ADR-895 Α9 · §7.5). Γενικεύτηκε από τον πυρήνα ζ5 (`tour-media-migration`, ADR-884 §4.15) — **δεν** αντιγράφηκε.
 * @related `server/spatial-tour/tour-media-migration.ts` (πλακίδια) · `server/spatial-tour/tour-original-migration.ts` (πρωτότυπα)
 * @module server/storage/placement-copy
 *
 * 🏆 **GCS rewrite μέσα στο Google**: κανένα byte δεν περνά από εμάς. Μεταξύ περιοχών το rewrite θέλει πολλές κλήσεις
 * (`rewriteToken`) — το SDK τις συνεχίζει μόνο του (`file.js`: `if (resp.rewriteToken) this.copy(…)`).
 * 🔑 **Καρφωμένη γενιά πηγής** (`sourceGeneration`): αντιγράφεται **ακριβώς** η έκδοση που μετρήθηκε· αν αλλάξει στο μεταξύ,
 *   το rewrite αποτυγχάνει αντί να μεταφέρει κάτι που κανείς δεν επαλήθευσε.
 * 🔑 **Απόδειξη = crc32c + μέγεθος**, όπως τα υπολογίζει το GCS στον προορισμό — ποτέ «το αντίγραφο πέτυχε άρα υπάρχει».
 * 🔴 **Ποτέ αντιγραφή download token** (ADR-895 §3.4): με κενό σώμα το rewrite αντιγράφει **όλα** τα editable metadata,
 *   μαζί και το custom `firebaseStorageDownloadTokens` — ένα διαρκές μυστικό πρόσβασης στον νέο κάδο. Τα holds/retention
 *   **δεν** αντιγράφονται ποτέ (τεκμηρίωση `objects/rewrite`) ⇒ ο καλών αρνείται αρχεία σε δέσμευση.
 */

import type { Bucket, CopyOptions, File } from '@google-cloud/storage';

/** Ταυτόχρονες αντιγραφές (rewrite) — ίδιος ρυθμός με το ανέβασμα του ψήστη. */
const COPY_CONCURRENCY = 8;

/** Το custom metadata-κλειδί του Firebase για download tokens — δεν ταξιδεύει ποτέ σε νέο κάδο. */
const FIREBASE_DOWNLOAD_TOKENS_KEY = 'firebaseStorageDownloadTokens';

/**
 * Το σώμα του rewrite. Το SDK στέλνει τις επιλογές **αυτολεξεί** ως σώμα (`json: options`), άρα και το `contentLanguage`
 * που ο τύπος `CopyOptions` παραλείπει — χωρίς αυτό, αντικείμενο με γλώσσα θα την έχανε στον νέο κάδο.
 */
type RewriteBody = CopyOptions & { contentLanguage?: string };

/** Κάθε αντικείμενο κάτω από τα προθέματα. Για **ακριβή** ονόματα βλ. {@link statObjects}. */
export async function listObjects(bucket: Bucket, prefixes: readonly string[]): Promise<File[]> {
  const pages = await Promise.all(prefixes.map((prefix) => bucket.getFiles({ prefix })));
  return pages.flatMap(([files]) => files);
}

/** Τα αντικείμενα με **ακριβώς** αυτά τα ονόματα (με metadata) — όσα λείπουν απλώς δεν επιστρέφονται. */
export async function statObjects(bucket: Bucket, paths: readonly string[]): Promise<File[]> {
  const wanted = new Set(paths);
  return (await listObjects(bucket, paths)).filter((file) => wanted.has(file.name));
}

/** Ίδιο αντικείμενο = ίδιο crc32c **και** ίδιο μέγεθος. Χωρίς crc32c ⇒ **όχι** ίδιο (καμία απόδειξη). */
export const sameObject = (a: File, b: File): boolean =>
  a.metadata.crc32c !== undefined && a.metadata.crc32c === b.metadata.crc32c && String(a.metadata.size) === String(b.metadata.size);

/**
 * Όσα αντικείμενα της πηγής **δεν** υπάρχουν πανομοιότυπα στον προορισμό. `prefixes` = πώς λιστάρεται ο προορισμός
 * (μία λίστα ανά πρόθεμα, όχι ανά αντικείμενο)· για ακριβή ονόματα δώσε τα ίδια τα ονόματα.
 */
export async function missingIn(target: Bucket, prefixes: readonly string[], source: readonly File[]): Promise<File[]> {
  const present = new Map((await listObjects(target, prefixes)).map((file) => [file.name, file] as const));
  return source.filter((file) => {
    const copy = present.get(file.name);
    return copy === undefined || !sameObject(file, copy);
  });
}

/**
 * Τα metadata του προορισμού **χωρίς** download token — ή `{}` όταν η πηγή δεν έχει token (τότε το rewrite κρατά
 * αυτολεξεί ό,τι είχε η πηγή). Με σώμα, το rewrite **αντικαθιστά** τα editable metadata ⇒ μεταφέρονται ρητά όλα τα άλλα.
 */
export function copyOptionsFor(file: File): RewriteBody {
  const { metadata } = file;
  const custom = metadata.metadata ?? {};
  if (!(FIREBASE_DOWNLOAD_TOKENS_KEY in custom)) return {};
  const body: RewriteBody = {
    metadata: Object.fromEntries(Object.entries(custom).filter(([key]) => key !== FIREBASE_DOWNLOAD_TOKENS_KEY)),
  };
  if (metadata.contentType !== undefined) body.contentType = metadata.contentType;
  if (metadata.cacheControl !== undefined) body.cacheControl = metadata.cacheControl;
  if (metadata.contentDisposition !== undefined) body.contentDisposition = metadata.contentDisposition;
  if (metadata.contentEncoding !== undefined) body.contentEncoding = metadata.contentEncoding;
  if (metadata.contentLanguage !== undefined) body.contentLanguage = metadata.contentLanguage;
  return body;
}

/** Η πηγή **στη γενιά που μετρήθηκε** — αλλιώς το rewrite θα αντέγραφε την τρέχουσα, όποια κι αν είναι. */
function pinnedSource(file: File): File {
  const generation = file.metadata.generation;
  return generation === undefined ? file : file.bucket.file(file.name, { generation: Number(generation) });
}

/** GCS rewrite σε δέσμες, ίδιο όνομα στον προορισμό — ιδεμπότητο όταν ο καλών δίνει μόνο ό,τι λείπει ({@link missingIn}). */
export async function copyObjects(files: readonly File[], target: Bucket): Promise<void> {
  for (let i = 0; i < files.length; i += COPY_CONCURRENCY) {
    await Promise.all(files.slice(i, i + COPY_CONCURRENCY).map((file) => pinnedSource(file).copy(target.file(file.name), copyOptionsFor(file))));
  }
}
