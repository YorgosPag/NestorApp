/**
 * @jest-environment node
 *
 * @fileoverview ADR-916 §7 Γ14 — **sha256 αποθηκευμένου αντικειμένου σε ροή, στη γενιά που μετρήθηκε**: ίσο με το
 *   sha256 γνωστών bytes ακόμη κι όταν φτάνουν σε πολλά κομμάτια · γενιά που έφυγε ⇒ `absent` (ποτέ αποτύπωμα νέων
 *   bytes) · κομμένη ροή ⇒ σφάλμα (ποτέ αποτύπωμα μισού αρχείου). Ψεύτικος κάδος, συνθετικά bytes.
 */

import { createHash } from 'crypto';
import type { File } from '@google-cloud/storage';

import { sha256OfStoredObject } from '@/server/storage/object-sha256.server';
import { fakeGcsBucket, type FakeGcsStore } from '@/test-utils/fake-gcs/fake-gcs-bucket';

jest.mock('server-only', () => ({}));

const store: FakeGcsStore = new Map();
const reads: Array<{ path: string; generation: number | undefined }> = [];
let beforeRead: () => void = () => undefined;
const bucket = fakeGcsBucket(store, 'b', { onRead: (call) => { reads.push(call); beforeRead(); } });
/** Το αντικείμενο **όπως το είδε η μέτρηση** — αντίγραφο των μεταδεδομένων εκείνης της στιγμής, όπως το `statObjects`. */
const measured = (path: string): File => ({ ...bucket.file(path), metadata: { ...bucket.file(path).metadata } }) as unknown as File;

const BYTES = Buffer.from(Array.from({ length: 1000 }, (_, i) => (i * 31) % 251));
const SHA = createHash('sha256').update(BYTES).digest('hex');

beforeEach(() => {
  store.clear();
  reads.length = 0;
  beforeRead = () => undefined;
  store.set('a.pdf', { crc32c: 'c', size: BYTES.length, generation: 7, bytes: BYTES });
});

describe('Γ14 — sha256 αντικειμένου σε ροή', () => {
  it('ίσο με το sha256 των γνωστών bytes — σε ΠΟΛΛΑ κομμάτια, από την ΚΑΡΦΩΜΕΝΗ γενιά', async () => {
    expect(await sha256OfStoredObject(measured('a.pdf'))).toEqual({ kind: 'hashed', sha256: SHA, size: 1000, generation: '7' });
    expect(reads).toEqual([{ path: 'a.pdf', generation: 7 }]);
  });

  it('🔴 η γενιά ξαναγράφτηκε ανάμεσα σε μέτρηση και ανάγνωση ⇒ `absent`, ΠΟΤΕ το αποτύπωμα των νέων bytes', async () => {
    const file = measured('a.pdf');
    beforeRead = () => store.set('a.pdf', { crc32c: 'c', size: 1000, generation: 8, bytes: Buffer.alloc(1000, 1) });
    expect(await sha256OfStoredObject(file)).toEqual({ kind: 'absent' });
  });

  it('κομμένη ροή (λιγότερα bytes από το μέγεθος της γενιάς) ⇒ σφάλμα, κανένα αποτύπωμα', async () => {
    store.set('a.pdf', { crc32c: 'c', size: 2000, generation: 7, bytes: BYTES });
    await expect(sha256OfStoredObject(measured('a.pdf'))).rejects.toThrow(/read 1000 bytes, expected 2000/);
  });

  it('χωρίς μετρημένη γενιά ⇒ σφάλμα (δεν διαβάζεται «η τρέχουσα, όποια κι αν είναι»)', async () => {
    store.set('a.pdf', { crc32c: 'c', size: 1000, bytes: BYTES });
    await expect(sha256OfStoredObject(measured('a.pdf'))).rejects.toThrow(/no measured generation/);
    expect(reads).toHaveLength(0);
  });
});
