import 'server-only';

/**
 * @fileoverview **ΤΟ GCS SOFT DELETE** — μέτρηση, επαναφορά και επαναδιαγραφή μιας **συγκεκριμένης** γενιάς (ADR-916 Φ-Δ.7β ·
 *               ADR-895 Ε3: 7 ημέρες στους κάδους αρχείων).
 * @related server/storage/placement-copy.ts (`statObjects` — η ζωντανή γενιά) · server/storage/create-object-once.server.ts
 *          (το ίδιο ιδίωμα 412/404) · server/property-handover-delivery/handover-delivery-recovery.server.ts (καταναλωτής)
 * @module server/storage/soft-deleted-object.server
 *
 * 🔴 **Ένα soft-deleted αντικείμενο ΔΕΝ διαβάζεται** («cannot be read, modified, or overwritten» — docs.cloud.google.com/
 *    storage/docs/soft-delete· το `objects.get` με `softDeleted=true` δίνει **μόνο** μεταδεδομένα, `alt=media` απαγορεύεται).
 *    Η μόνη οδός προς τα bytes είναι η **επαναφορά**: νέα ζωντανή γενιά στο ίδιο όνομα, με τα ίδια μεταδεδομένα.
 * 🔑 **Ποτέ πάνω σε ζωντανό**: επαναφορά με `ifGenerationMatch: 0` (412 ⇒ υπάρχει ζωντανό — δεν το αγγίζουμε). Η
 *    επαναδιαγραφή με `ifGenerationMatch` της γενιάς που **γεννήσαμε** ⇒ ποτέ διαγραφή ξένων bytes.
 * ⚠️ Το `File#restore()` του SDK (7.18) τυποποιείται `Promise<File>` αλλά επιστρέφει το **σώμα** της απάντησης
 *    (`const [file] = await this.request(...)` — object resource)· η νέα γενιά διαβάζεται από **εκεί**, αμυντικά, ως
 *    `unknown`. Γιατί όχι `statObjects` μετά: ανάμεσα σε επαναφορά και μέτρηση κάποιος μπορεί να γράψει το όνομα, και η
 *    **ξένη** γενιά θα καταγραφόταν ως «δική μας» (μετριόταν **και** σβηνόταν). Λείπει το πεδίο ⇒ `null`, και ο καλών αποφασίζει.
 * 🔑 Οι κάδοι μας **δεν** έχουν HNS (μετρημένο 2026-10-25) ⇒ όνομα + γενιά ταυτοποιούν μοναδικά· κανένα `restoreToken`.
 */

import type { Bucket, File } from '@google-cloud/storage';

const codeOf = (error: unknown): unknown => (typeof error === 'object' && error !== null ? (error as { readonly code?: unknown }).code : undefined);

/** Η γενιά ως αριθμός του SDK — οι γενιές GCS (μικροδευτερόλεπτα) χωρούν άνετα κάτω από το `Number.MAX_SAFE_INTEGER`. */
function generationNumber(generation: string): number {
  const value = Number(generation);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Invalid GCS generation ${generation}`);
  return value;
}

/** Τα μεταδεδομένα της **soft-deleted** γενιάς — `null` αν δεν υπάρχει (ποτέ δεν σβήστηκε · έληξε · άλλη γενιά). */
export async function statSoftDeleted(bucket: Bucket, path: string, generation: string): Promise<File | null> {
  const value = generationNumber(generation);
  try {
    const [file] = await bucket.file(path, { generation: value }).get({ softDeleted: true, generation: value });
    return file;
  } catch (error) {
    if (codeOf(error) === 404) return null;
    throw error;
  }
}

export type SoftDeleteRestoreOutcome =
  /** Νέα ζωντανή γενιά γεννήθηκε **από εμάς** — `generation` από την απάντηση του GCS (`null` αν δεν ήρθε). */
  | { readonly kind: 'restored'; readonly generation: string | null }
  /** Υπάρχει ήδη ζωντανό αντικείμενο στο όνομα — **τίποτα** δεν γράφτηκε. */
  | { readonly kind: 'live-exists' }
  /** Η soft-deleted γενιά δεν υπάρχει πια (έληξε ή επαναφέρθηκε ήδη). */
  | { readonly kind: 'absent' };

/** Η γενιά από το σώμα της απάντησης (object resource: `generation` ως string int64) — αμυντικά. */
function restoredGenerationOf(body: unknown): string | null {
  const value = typeof body === 'object' && body !== null ? (body as { readonly generation?: unknown }).generation : undefined;
  const text = typeof value === 'number' || typeof value === 'string' ? String(value) : '';
  return /^[1-9]\d*$/.test(text) ? text : null;
}

/** **Επαναφορά, μόνο σε κενό όνομα** — με τη γενιά που γεννήθηκε (βλ. ⚠️ πάνω). */
export async function restoreIntoVacantName(bucket: Bucket, path: string, generation: string): Promise<SoftDeleteRestoreOutcome> {
  try {
    const body: unknown = await bucket.file(path).restore({ generation: generationNumber(generation), ifGenerationMatch: 0 });
    return { kind: 'restored', generation: restoredGenerationOf(body) };
  } catch (error) {
    const code = codeOf(error);
    if (code === 412) return { kind: 'live-exists' };
    if (code === 404) return { kind: 'absent' };
    throw error;
  }
}

export type GenerationDeleteOutcome = 'deleted' | 'gone' | 'changed';

/** Σβήνει τη ζωντανή γενιά **μόνο** αν είναι ακόμη αυτή — `changed` ⇒ κάποιος την ξαναέγραψε, δεν αγγίζεται. */
export async function deleteLiveGeneration(bucket: Bucket, path: string, generation: string): Promise<GenerationDeleteOutcome> {
  try {
    await bucket.file(path).delete({ ifGenerationMatch: generationNumber(generation) });
    return 'deleted';
  } catch (error) {
    const code = codeOf(error);
    if (code === 404) return 'gone';
    if (code === 412) return 'changed';
    throw error;
  }
}
