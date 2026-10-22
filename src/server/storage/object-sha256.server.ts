import 'server-only';

/**
 * @fileoverview **SHA-256 ΕΝΟΣ ΑΠΟΘΗΚΕΥΜΕΝΟΥ ΑΝΤΙΚΕΙΜΕΝΟΥ, ΣΤΗ ΓΕΝΙΑ ΠΟΥ ΜΕΤΡΗΘΗΚΕ** — σε ροή, ποτέ ολόκληρο στη μνήμη
 * (ADR-916 Φ-Γ2 Σ2).
 * @related lib/storage/sha256-pass-through.ts (ο ΕΝΑΣ μετρητής ροής) · server/storage/placement-copy.ts (η ΜΙΑ καρφωμένη
 *          γενιά — `pinnedToGeneration`) · server/property-handover-delivery/handover-delivery-hash.server.ts (καταναλωτής)
 * @module server/storage/object-sha256.server
 *
 * 🔑 **Γιατί διαβάζουμε τα bytes**: το GCS κρατά μόνο crc32c (και md5 όχι πάντα — λείπει στα σύνθετα αντικείμενα)· sha256
 *    **δεν** υπολογίζει ποτέ, ούτε στο rewrite. Το crc32c πιάνει τυχαία αλλοίωση, όχι σκόπιμη — η απόδειξη προς τρίτους
 *    (δικαστήριο, συμβολαιογράφος) θέλει κρυπτογραφικό αποτύπωμα, και αυτό μόνο εμείς μπορούμε να το μετρήσουμε.
 * 🔑 **Απλό sha256 όλου του αρχείου** (όχι δέντρο μπλοκ, όπως το content hash του Dropbox): ο τρίτος το ξαναϋπολογίζει με
 *    `sha256sum` / `Get-FileHash` χωρίς κανένα δικό μας εργαλείο.
 * 🔴 **Καρφωμένη γενιά**: διαβάζονται **ακριβώς** τα bytes της γενιάς που περιγράφει το `file.metadata` (από `statObjects`).
 *    Αν το όνομα ξαναγραφτεί ή σβηστεί στο μεταξύ, η ανάγνωση δίνει 404 ⇒ `absent` — ποτέ αποτύπωμα νέων bytes κάτω από
 *    παλιά μεταδεδομένα. Το SDK επαληθεύει επιπλέον από άκρη σε άκρη το crc32c της λήψης έναντι της ίδιας γενιάς.
 */

import type { File } from '@google-cloud/storage';
import { pipeline } from 'stream/promises';

import { sha256PassThrough } from '@/lib/storage/sha256-pass-through';

import { pinnedToGeneration } from './placement-copy';

export type StoredObjectSha256 =
  | {
      readonly kind: 'hashed';
      /** 64 χαρακτήρες lowercase hex. */
      readonly sha256: string;
      readonly size: number;
      /** Η γενιά που διαβάστηκε — **αυτή** περιγράφει το αποτύπωμα. */
      readonly generation: string;
    }
  /** Η γενιά δεν υπάρχει πια (ξαναγράφτηκε ή σβήστηκε μετά τη μέτρηση). */
  | { readonly kind: 'absent' };

const isNotFound = (error: unknown): boolean => (error as { code?: number }).code === 404;

/** Καταναλωτής που απλώς αδειάζει τη ροή — τα bytes περνούν από τον μετρητή και πετιούνται. */
async function discard(source: AsyncIterable<unknown>): Promise<void> {
  for await (const chunk of source) void chunk;
}

/**
 * **Το sha256 του αντικειμένου, στη γενιά του `file.metadata`.** Πετά σε βλάβη και όταν διαβάστηκαν άλλα bytes από όσα
 * δηλώνει το μέγεθος (κομμένη ροή) — ποτέ αποτύπωμα μισού αρχείου.
 */
export async function sha256OfStoredObject(file: File): Promise<StoredObjectSha256> {
  const { generation, size } = file.metadata;
  if (generation === undefined) throw new Error(`Object ${file.name} has no measured generation`);
  const hash = sha256PassThrough();
  try {
    await pipeline(pinnedToGeneration(file).createReadStream(), hash.stream, discard);
  } catch (error) {
    if (isNotFound(error)) return { kind: 'absent' };
    throw error;
  }
  if (hash.bytes() !== Number(size)) throw new Error(`Object ${file.name}: read ${hash.bytes()} bytes, expected ${String(size)}`);
  return { kind: 'hashed', sha256: hash.digestHex(), size: hash.bytes(), generation: String(generation) };
}
