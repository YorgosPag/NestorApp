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

/**
 * Το αντικείμενο **στη γενιά που μετρήθηκε** — αλλιώς το rewrite θα αντέγραφε (ή η ανάγνωση θα διάβαζε) την τρέχουσα,
 * όποια κι αν είναι. Ο ΕΝΑΣ τρόπος· τον μοιράζονται η αντιγραφή και ο κατακερματισμός (`object-sha256.server`).
 */
export function pinnedToGeneration(file: File): File {
  const generation = file.metadata.generation;
  return generation === undefined ? file : file.bucket.file(file.name, { generation: Number(generation) });
}

/**
 * Ένα αντικείμενο προς αντιγραφή **με νέο όνομα** (ADR-916 Φ-Γ1 — η παράδοση στον φάκελο του αγοραστή): η πηγή ζει στο
 * κλειδί της εταιρείας, το αντίγραφο στο `people/{uid}/…`. Η αντιγραφή ίδιου ονόματος είναι η ειδική περίπτωση.
 */
export interface CopyPair {
  readonly source: File;
  readonly destinationName: string;
}

/** Όσα ζεύγη **δεν** έχουν ήδη πανομοιότυπο αντίγραφο στον προορισμό — ακριβή ονόματα, ποτέ πρόθεμα. */
export async function missingPairsIn(target: Bucket, pairs: readonly CopyPair[]): Promise<CopyPair[]> {
  const present = new Map((await statObjects(target, pairs.map((pair) => pair.destinationName))).map((file) => [file.name, file] as const));
  return pairs.filter((pair) => {
    const copy = present.get(pair.destinationName);
    return copy === undefined || !sameObject(pair.source, copy);
  });
}

/** GCS rewrite σε δέσμες προς **δηλωμένο** όνομα — ιδεμπότητο όταν ο καλών δίνει μόνο ό,τι λείπει ({@link missingPairsIn}). */
export async function copyPairs(pairs: readonly CopyPair[], target: Bucket): Promise<void> {
  for (let i = 0; i < pairs.length; i += COPY_CONCURRENCY) {
    await Promise.all(pairs.slice(i, i + COPY_CONCURRENCY).map(({ source, destinationName }) =>
      pinnedToGeneration(source).copy(target.file(destinationName), copyOptionsFor(source))));
  }
}

/**
 * **Αντιγραφή + απόδειξη** για ζεύγη προς δηλωμένα ονόματα — αντιγράφει ό,τι λείπει και επιστρέφει τα ονόματα προορισμού
 * που **αποδείχτηκαν** πανομοιότυπα ({@link sameObject}). Ο ΕΝΑΣ δρόμος «bytes → απόδειξη» της παράδοσης (ADR-916): τον
 * μοιράζονται η αντιγραφή των αρχείων (Φ-Γ1) και το αντίτυπο του Πρωτοκόλλου στον αγοραστή (Φ-Γ2 Σ4).
 */
export async function copyProvenPairs(pairs: readonly CopyPair[], target: Bucket): Promise<ReadonlySet<string>> {
  await copyPairs(await missingPairsIn(target, pairs), target);
  const present = new Map((await statObjects(target, pairs.map((pair) => pair.destinationName))).map((file) => [file.name, file] as const));
  return new Set(pairs.filter((pair) => {
    const destination = present.get(pair.destinationName);
    return destination !== undefined && sameObject(pair.source, destination);
  }).map((pair) => pair.destinationName));
}

/** GCS rewrite σε δέσμες, ίδιο όνομα στον προορισμό — ιδεμπότητο όταν ο καλών δίνει μόνο ό,τι λείπει ({@link missingIn}). */
export async function copyObjects(files: readonly File[], target: Bucket): Promise<void> {
  await copyPairs(files.map((source) => ({ source, destinationName: source.name })), target);
}
