/**
 * @fileoverview Ψεύτικο bucket στη μνήμη για τις άγκυρες του παγωμένου αποδεικτικού (ADR-864 §19 · Α31-Α33).
 *
 * 🔑 Μιμείται **τη συμπεριφορά που κρίνεται**, όχι το SDK: ροή ανάγνωσης/εγγραφής bytes · `temporaryHold` που
 * **αρνείται** διαγραφή (όπως το GCS: 403 σε αντικείμενο με hold) · εισαγωγή αποτυχίας εγγραφής.
 */

import { Readable, Writable } from 'stream';

import type { EvidenceBucket, EvidenceObject } from '../attestation-evidence';

interface StoredObject {
  bytes: Buffer;
  contentType: string;
  hold: boolean;
}

export class FakeEvidenceBucket implements EvidenceBucket {
  readonly objects = new Map<string, StoredObject>();
  /** Διαδρομές όπου η **εγγραφή** αποτυγχάνει — για την άγκυρα «αποτυχία πάγωσης ⇒ καμία βεβαίωση». */
  readonly failWritesTo = new Set<string>();
  failAllWrites = false;

  put(path: string, content: string, contentType = 'application/pdf'): void {
    this.objects.set(path, { bytes: Buffer.from(content), contentType, hold: false });
  }

  file(path: string): EvidenceObject {
    const bucket = this;
    return {
      createReadStream(): Readable {
        const stored = bucket.objects.get(path);
        if (stored === undefined) {
          const missing = new Readable({ read() { this.destroy(new Error(`No such object: ${path}`)); } });
          return missing;
        }
        return Readable.from([stored.bytes]);
      },
      createWriteStream(options): Writable {
        const chunks: Buffer[] = [];
        return new Writable({
          write(chunk: Buffer, _encoding, callback) {
            if (bucket.failAllWrites || bucket.failWritesTo.has(path)) {
              callback(new Error('write failed'));
              return;
            }
            chunks.push(chunk);
            callback();
          },
          final(callback) {
            bucket.objects.set(path, { bytes: Buffer.concat(chunks), contentType: options.contentType, hold: false });
            callback();
          },
        });
      },
      async setMetadata(metadata) {
        const stored = bucket.objects.get(path);
        if (stored === undefined) throw new Error(`No such object: ${path}`);
        stored.hold = metadata.temporaryHold;
      },
      async delete() {
        const stored = bucket.objects.get(path);
        if (stored?.hold === true) throw new Error(`Object ${path} is under active Temporary hold and cannot be deleted`);
        bucket.objects.delete(path);
      },
    };
  }

  /** Τα αντικείμενα κάτω από τη ρίζα των αποδεικτικών. */
  evidencePaths(): string[] {
    return [...this.objects.keys()].filter((key) => key.startsWith('mandate-evidence/'));
  }
}
