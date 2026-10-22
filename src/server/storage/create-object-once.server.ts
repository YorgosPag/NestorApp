import 'server-only';

/**
 * @fileoverview **ΑΝΤΙΚΕΙΜΕΝΟ ΠΟΥ ΓΡΑΦΕΤΑΙ ΜΙΑ ΦΟΡΑ** — ανέβασμα bytes από τον διακομιστή, **μόνο** αν το κλειδί είναι κενό
 *               (ADR-916 Φ-Γ2 Σ4).
 * @related lib/storage/resumable-upload-session.ts (το ίδιο `ifGenerationMatch: 0`, για ανέβασμα από τον browser) ·
 *          server/storage/placement-copy.ts (απόδειξη = crc32c + μέγεθος)
 * @module server/storage/create-object-once.server
 *
 * 🔑 **Γιατί «μόνο δημιουργία»**: τα κλειδιά των εγγράφων που εκδίδουμε είναι **ντετερμινιστικά** (ίδιο έγγραφο ⇒ ίδιο
 *    κλειδί). Δύο εκτελέσεις που συναντιούνται στο ίδιο κλειδί κρίνονται από το GCS (`412`), όχι από εμάς: η δεύτερη
 *    **ποτέ** δεν σκεπάζει bytes που ίσως έχει ήδη δει άνθρωπος ή καταγράψει εγγραφή. Μαθαίνει ότι υπάρχει και αποφασίζει ο
 *    καλών (π.χ. υιοθέτηση μετά από έλεγχο, ADR-916 Σ4).
 * 🔑 Το GCS υπολογίζει και ελέγχει **crc32c** στο ανέβασμα (`validation`): bytes που αλλοιώθηκαν στη διαδρομή απορρίπτονται.
 */

import type { Bucket, File } from '@google-cloud/storage';

import { pinnedToGeneration, statObjects } from './placement-copy';

export type CreateObjectOutcome =
  /** Γράφτηκε **τώρα**, από εμάς. */
  | { readonly kind: 'created'; readonly file: File }
  /** Υπήρχε ήδη — **δεν** γράφτηκε τίποτα. Ο καλών κρίνει τι είναι. */
  | { readonly kind: 'exists'; readonly file: File };

const isPreconditionFailed = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { readonly code?: unknown }).code === 412;

/** **Γράφει τα bytes μόνο αν το κλειδί είναι κενό** — και επιστρέφει το αντικείμενο με τα μεταδεδομένα του (crc32c · γενιά). */
export async function createObjectOnce(bucket: Bucket, path: string, bytes: Uint8Array, contentType: string): Promise<CreateObjectOutcome> {
  let created = true;
  try {
    await bucket.file(path).save(Buffer.from(bytes), {
      resumable: false,
      contentType,
      validation: 'crc32c',
      preconditionOpts: { ifGenerationMatch: 0 },
    });
  } catch (error) {
    if (!isPreconditionFailed(error)) throw error;
    created = false;
  }
  const [file] = await statObjects(bucket, [path]);
  if (file === undefined) throw new Error(`Object missing right after write: ${path}`);
  return { kind: created ? 'created' : 'exists', file };
}

/** **Τα bytes της γενιάς που μετρήθηκε** — ποτέ της τρέχουσας, όποια κι αν είναι (καρφωμένη γενιά). */
export async function readObjectBytes(file: File): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  for await (const chunk of pinnedToGeneration(file).createReadStream()) chunks.push(Buffer.from(chunk as Uint8Array));
  return new Uint8Array(Buffer.concat(chunks));
}
