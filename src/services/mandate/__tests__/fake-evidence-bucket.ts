/**
 * @fileoverview Ψεύτικο bucket στη μνήμη για τις άγκυρες του παγωμένου αποδεικτικού (ADR-864 §19 · Α31-Α33).
 *
 * 🔑 Μιμείται **τη συμπεριφορά που κρίνεται**, όχι το SDK: ροή ανάγνωσης/εγγραφής bytes · `temporaryHold` που
 * **αρνείται** διαγραφή (όπως το GCS: 403 σε αντικείμενο με hold) · εισαγωγή αποτυχίας εγγραφής.
 *
 * 🔑 ADR-864 §20 — **Object Retention Lock σε Locked**, όπως τεκμηριώνεται: η ημερομηνία **μόνο αυξάνει**
 * (μείωση ⇒ σφάλμα) · διαγραφή πριν την ημερομηνία ⇒ σφάλμα · retention **συνυπάρχει** με temporary hold ·
 * bucket χωρίς object retention ⇒ σφάλμα στο `retention` (για το fail-closed).
 */

import { Readable, Writable } from 'stream';

import type { EvidenceBucket, EvidenceObject } from '../attestation-evidence';

interface StoredObject {
  bytes: Buffer;
  contentType: string;
  hold: boolean;
  retainUntil: string | null;
}

export class FakeEvidenceBucket implements EvidenceBucket {
  readonly objects = new Map<string, StoredObject>();
  /** Διαδρομές όπου η **εγγραφή** αποτυγχάνει — για την άγκυρα «αποτυχία πάγωσης ⇒ καμία βεβαίωση». */
  readonly failWritesTo = new Set<string>();
  failAllWrites = false;
  /** Το bucket έχει ενεργό Object Retention Lock; (Cloud Console, μη αναστρέψιμο) */
  objectRetentionEnabled = true;
  /** Το «τώρα» της πλατφόρμας για την άρνηση διαγραφής πριν την ημερομηνία. */
  nowISO = '2026-09-17T12:00:00.000Z';

  put(path: string, content: string, contentType = 'application/pdf'): void {
    this.objects.set(path, { bytes: Buffer.from(content), contentType, hold: false, retainUntil: null });
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
            bucket.objects.set(path, { bytes: Buffer.concat(chunks), contentType: options.contentType, hold: false, retainUntil: null });
            callback();
          },
        });
      },
      async setMetadata(metadata) {
        const stored = bucket.objects.get(path);
        if (stored === undefined) throw new Error(`No such object: ${path}`);
        if (metadata.retention !== undefined) {
          if (!bucket.objectRetentionEnabled) throw new Error('Object retention is not enabled for this bucket');
          const next = metadata.retention.retainUntilTime;
          if (stored.retainUntil !== null && Date.parse(next) < Date.parse(stored.retainUntil)) {
            throw new Error(`Locked retention of ${path} cannot be reduced`);
          }
          stored.retainUntil = next;
        }
        if (metadata.temporaryHold !== undefined) stored.hold = metadata.temporaryHold;
      },
      async delete() {
        const stored = bucket.objects.get(path);
        if (stored?.hold === true) throw new Error(`Object ${path} is under active Temporary hold and cannot be deleted`);
        if (stored?.retainUntil != null && Date.parse(stored.retainUntil) > Date.parse(bucket.nowISO)) {
          throw new Error(`Object ${path} is subject to object retention until ${stored.retainUntil}`);
        }
        bucket.objects.delete(path);
      },
    };
  }

  async getFiles(query: { readonly prefix: string }): Promise<[{ name: string }[]]> {
    return [[...this.objects.keys()].filter((key) => key.startsWith(query.prefix)).map((name) => ({ name }))];
  }

  /** Τα αντικείμενα κάτω από τη ρίζα των αποδεικτικών. */
  evidencePaths(): string[] {
    return [...this.objects.keys()].filter((key) => key.startsWith('mandate-evidence/'));
  }
}
