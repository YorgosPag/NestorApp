/**
 * @fileoverview **SHA-256 ΠΑΝΩ ΣΕ ΡΟΗ, ΧΩΡΙΣ ΝΑ ΚΡΑΤΗΘΟΥΝ ΤΑ BYTES** — ο ΕΝΑΣ μετρητής (Node).
 * @related ADR-864 §19 (παγωμένο αποδεικτικό) · services/backup/storage-backup.service.ts ·
 *   services/backup/storage-restore.service.ts · lib/hash/sha256.ts (ο ασύγχρονος, browser-side μισός)
 * @module lib/storage/sha256-pass-through
 *
 * 🔑 Το «`createHash` + `Transform` που ενημερώνει και προωθεί» ήταν γραμμένο **δύο** φορές στο backup
 * (λήψη αντιγράφου · επαναφορά) και θα γινόταν **τρίτο** στο πάγωμα αποδεικτικού. Εδώ μία φορά, με
 * μέτρηση bytes και **όριο** — ώστε ο καλών να σταματά τη ροή *πριν* γράψει κάτι μεγαλύτερο από όσο δέχεται.
 *
 * ⚠️ **ΔΕΝ** αντικαθιστά το `lib/hash/sha256.ts`: εκείνο είναι Web Crypto για bytes **στη μνήμη**· αυτό είναι
 * `node:crypto` για ροές που **δεν χωρούν** ή δεν πρέπει να μπουν στη μνήμη.
 */

import 'server-only';

import { createHash } from 'crypto';
import { Transform } from 'stream';

/** Σφάλμα που σπάει τη ροή όταν ξεπεραστεί το όριο — αναγνωρίσιμο από τον καλούντα. */
export const STREAM_TOO_LARGE_ERROR = 'STREAM_TOO_LARGE';

export interface Sha256PassThrough {
  /** Το στάδιο της `pipeline` — προωθεί κάθε κομμάτι αναλλοίωτο. */
  readonly stream: Transform;
  /** 64 χαρακτήρες lowercase hex — **μόνο** μετά το τέλος της ροής. */
  digestHex(): string;
  /** Bytes που πέρασαν ως τώρα. */
  bytes(): number;
}

/** @param maxBytes — προαιρετικό όριο· η υπέρβαση σπάει τη ροή με {@link STREAM_TOO_LARGE_ERROR}. */
export function sha256PassThrough(maxBytes?: number): Sha256PassThrough {
  const hash = createHash('sha256');
  let count = 0;
  const stream = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      count += chunk.length;
      if (maxBytes !== undefined && count > maxBytes) {
        callback(new Error(STREAM_TOO_LARGE_ERROR));
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  return { stream, digestHex: () => hash.digest('hex'), bytes: () => count };
}
