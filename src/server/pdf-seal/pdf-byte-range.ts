/**
 * @module server/pdf-seal/pdf-byte-range
 * @description **Τι ακριβώς υπογράφηκε** σε ένα PDF (PAdES/ISO 32000-1 §12.8) — καθαρό, χωρίς κρυπτογραφία.
 *
 * Μια ψηφιακή υπογραφή PDF υπογράφει **όλο το αρχείο εκτός** από το κενό όπου ζει η ίδια:
 *
 *   `/ByteRange [0 b c d]` → υπογράφονται τα bytes `[0, b)` και `[c, c+d)`· στο `[b, c)` κάθεται το
 *   `/Contents <…hex…>` με το CMS `SignedData`.
 *
 * 🔴 **Οι τρεις έλεγχοι που ξεχνούν οι αφελείς υλοποιήσεις** (και που εκμεταλλεύονται οι επιθέσεις
 * «Shadow»/«Incremental Saving» της Ruhr-Universität Bochum, 2019–2021):
 * 1. η πρώτη περιοχή ξεκινά στο **0**·
 * 2. το κενό είναι **ακριβώς** το `<…>` του `/Contents` — όχι οτιδήποτε άλλο που δεν υπογράφηκε·
 * 3. η δεύτερη περιοχή φτάνει ως το **τέλος** του αρχείου — αλλιώς κάποιος **πρόσθεσε** περιεχόμενο μετά
 *    την υπογραφή (incremental update) και το «έγκυρο» αφορά άλλο έγγραφο από αυτό που βλέπει ο άνθρωπος.
 *
 * ⚠️ Το (3) απορρίπτει και τις νόμιμες προσθήκες PAdES-LTV (DSS μετά την υπογραφή). Αν το πραγματικό ΠΚΑ
 * τις έχει, η ανάλυση της ουράς θα το δείξει (`byte-range-incomplete`) και ο έλεγχος **διευρύνεται με
 * απόδειξη** (μόνο DSS/VRI στην προσθήκη) — ποτέ με χαλάρωση στα τυφλά (ADR-900 §8).
 */

import type { PdfSealFailure } from './pdf-seal.types';

export type SignedRanges =
  | {
      readonly kind: 'found';
      /** Τα υπογεγραμμένα bytes, ενωμένα. */
      readonly signedBytes: Uint8Array;
      /** Το DER του CMS `SignedData` (το hex του `/Contents`, χωρίς τα μηδενικά συμπλήρωσης). */
      readonly cms: Uint8Array;
    }
  | { readonly kind: 'failed'; readonly reason: PdfSealFailure };

const LATIN1 = new TextDecoder('latin1');

function hexToBytes(hex: string): Uint8Array | null {
  const clean = hex.replace(/\s+/g, '');
  if (clean.length % 2 !== 0 || /[^0-9a-fA-F]/.test(clean)) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Το DER έχει δικό του μήκος· τα μηδενικά συμπλήρωσης του `/Contents` κόβονται από εκεί, όχι με μαντεψιά. */
function derLength(bytes: Uint8Array): number | null {
  if (bytes.length < 2 || bytes[0] !== 0x30) return null;
  const first = bytes[1];
  if (first < 0x80) return 2 + first;
  const count = first & 0x7f;
  if (count === 0 || count > 4 || bytes.length < 2 + count) return null;
  let length = 0;
  for (let i = 0; i < count; i += 1) length = length * 256 + bytes[2 + i];
  return 2 + count + length;
}

/**
 * Βρίσκει την **τελευταία** υπογραφή (αυτή που καλύπτει τις περισσότερες αναθεωρήσεις) και ελέγχει τα όρια.
 */
export function signedRangesOf(pdf: Uint8Array): SignedRanges {
  const text = LATIN1.decode(pdf);
  const matches = [...text.matchAll(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g)];
  if (matches.length === 0) return { kind: 'failed', reason: 'no-signature' };

  const [a, b, c, d] = matches[matches.length - 1].slice(1, 5).map(Number);
  if (a !== 0 || b <= 0 || c <= b || c + d > pdf.length) return { kind: 'failed', reason: 'byte-range-malformed' };
  if (text[b] !== '<' || text[c - 1] !== '>') return { kind: 'failed', reason: 'byte-range-malformed' };
  if (c + d !== pdf.length) return { kind: 'failed', reason: 'byte-range-incomplete' };

  const padded = hexToBytes(text.slice(b + 1, c - 1));
  const length = padded === null ? null : derLength(padded);
  if (padded === null || length === null || length > padded.length) return { kind: 'failed', reason: 'malformed-cms' };

  const signedBytes = new Uint8Array(b + d);
  signedBytes.set(pdf.subarray(0, b), 0);
  signedBytes.set(pdf.subarray(c, c + d), b);
  return { kind: 'found', signedBytes, cms: padded.subarray(0, length) };
}
