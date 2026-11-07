/**
 * ADR-923 §5.15.2 (Θ.2α-1) — **Κομμάτια PDF με ανανεώσιμη άδεια**: ο προβολέας διαβάζει ένα έντυπο 835 σελίδων χωρίς να
 * το κατεβάσει, και χωρίς να «πέσει» όταν λήξει η άδεια των 15′.
 *
 * 🏆 **Adobe PDF Embed**: σελίδα-σελίδα μόνο με byte-range **και** γραμμικοποιημένο αρχείο. Εδώ: byte-range σε **κάθε** PDF
 *    (το pdf.js ζητά ό,τι χρειάζεται η σελίδα από τον πίνακα xref), και η άδεια **ανανεώνεται μόνη της**.
 * 🔑 **Γιατί δικό μας transport και όχι `getDocument({ url })`** (μετρημένο 2026-11-07):
 *    1. η άδεια ζει 15′ (`signCatalogEditionFile`) ⇒ με σταθερό URL κάθε κομμάτι μετά τα 15′ = 403 στη μέση της ανάγνωσης·
 *    2. το εγγενές range του pdf.js απαιτεί να **διαβάζει** την `Accept-Ranges`, που ο κάδος δεν εκθέτει (`cors.json`) ⇒
 *       θα κατέβαζε όλο το αρχείο. Το μήκος εδώ έρχεται από την `Content-Range`, που **ήδη** εκτίθεται.
 * 🔑 **Ο εκδότης της άδειας είναι ο καλών** ({@link IssuePdfLicense}): ξαναρωτά τη ΔΙΚΗ του πόρτα κρίσης (ανώνυμος ή
 *    αγοραστής) ⇒ αποσυρμένη έκδοση ⇒ η επόμενη ανανέωση αποτυγχάνει ⇒ η ανάγνωση σταματά. Η ανάκληση ισχύει και εν πτήσει.
 * ⚠️ **Το pdf.js ΔΕΝ έχει δρόμο σφάλματος για κομμάτι**: ένα αίτημα που αποτυγχάνει μένει για πάντα σε αναμονή. Γι' αυτό η
 *    αποτυχία βγαίνει ρητά από το `onFailure` — ο θεατής δείχνει σφάλμα αντί για αιώνιο «Φόρτωση».
 * ⛔ Το URL **είναι** η άδεια: ποτέ σε ημερολόγιο ή μήνυμα σφάλματος.
 *
 * @module components/file-manager/pdf-range-transport
 */

import type { PDFDataRangeTransport } from 'pdfjs-dist';

/** Μια βραχύβια άδεια ανάγνωσης — το σχήμα που ήδη απαντούν οι πόρτες `/file` (ADR-923 §5.15.1). */
export interface PdfReadLicense {
  readonly url: string;
  /** Epoch ms. */
  readonly expiresAt: number;
}

/** Ζητά **νέα** άδεια από την πόρτα κρίσης του καλούντα. Απόρριψη ⇒ η ανάγνωση σταματά. */
export type IssuePdfLicense = (signal: AbortSignal) => Promise<PdfReadLicense>;

/** Πόσο πριν από τη λήξη ανανεώνεται η άδεια — ένα κομμάτι σε πτήση δεν πρέπει να φτάσει με ληγμένη. */
export const LICENSE_RENEW_MARGIN_MS = 60_000;
/** Το πρώτο κομμάτι: αρκεί για την κεφαλίδα και, συνήθως, για την πρώτη σελίδα. */
export const PDF_INITIAL_CHUNK_BYTES = 256 * 1024;

const CONTENT_RANGE = /^bytes (\d+)-(\d+)\/(\d+)$/;

export type PdfRangeFailure = 'license' | 'http' | 'not-partial' | 'content-range';

/** Ένα κομμάτι δεν ήρθε — ο λόγος, ποτέ το URL. */
export class PdfRangeError extends Error {
  constructor(readonly reason: PdfRangeFailure, readonly status?: number) {
    super(`PDF range: ${reason}${status === undefined ? '' : ` (HTTP ${status})`}`);
    this.name = 'PdfRangeError';
  }
}

interface Clock {
  readonly now: () => number;
}

/**
 * Η άδεια σε χρήση — **μία** ανανέωση σε πτήση για όσα κομμάτια τη χρειαστούν μαζί (single-flight), ώστε δέκα παράλληλα
 * κομμάτια στη λήξη να μη γεννήσουν δέκα αιτήματα στον διακομιστή.
 */
export class PdfLicenseLease {
  private license: PdfReadLicense | null = null;
  private pending: Promise<PdfReadLicense> | null = null;

  constructor(private readonly issue: IssuePdfLicense, private readonly signal: AbortSignal, private readonly clock: Clock = Date) {}

  current(): Promise<PdfReadLicense> {
    const held = this.license;
    if (held && this.clock.now() < held.expiresAt - LICENSE_RENEW_MARGIN_MS) return Promise.resolve(held);
    if (!this.pending) {
      const renewal = this.issue(this.signal).then(
        (fresh) => { this.license = fresh; return fresh; },
        () => { throw new PdfRangeError('license'); },
      );
      this.pending = renewal;
      const clear = () => { if (this.pending === renewal) this.pending = null; };
      renewal.then(clear, clear);
    }
    return this.pending;
  }

  /** Ο κάδος αρνήθηκε αυτή την άδεια ⇒ η επόμενη `current()` ζητά νέα (μόνο αν δεν την άλλαξε ήδη άλλο κομμάτι). */
  reject(license: PdfReadLicense): void {
    if (this.license === license) this.license = null;
  }
}

export interface PdfRange {
  readonly bytes: Uint8Array;
  /** Το συνολικό μήκος του αρχείου, όπως το λέει η `Content-Range`. */
  readonly total: number;
}

/** `[begin, end)` — με 206 υποχρεωτικά· 403 ⇒ μία ανανέωση και μία επανάληψη. */
export async function fetchPdfRange(lease: PdfLicenseLease, begin: number, end: number, signal: AbortSignal): Promise<PdfRange> {
  for (let attempt = 0; ; attempt += 1) {
    const license = await lease.current();
    const response = await fetch(license.url, { headers: { Range: `bytes=${begin}-${end - 1}` }, credentials: 'omit', signal });
    if (response.status === 403 && attempt === 0) {
      lease.reject(license);
      continue;
    }
    if (response.status === 200) throw new PdfRangeError('not-partial', 200); // ολόκληρο το αρχείο: ποτέ σιωπηλά
    if (response.status !== 206) throw new PdfRangeError('http', response.status);
    const match = CONTENT_RANGE.exec(response.headers.get('Content-Range') ?? '');
    if (!match || Number(match[1]) !== begin) throw new PdfRangeError('content-range', 206);
    return { bytes: new Uint8Array(await response.arrayBuffer()), total: Number(match[3]) };
  }
}

type RangeTransportClass = typeof PDFDataRangeTransport;

export interface LicensedPdfTransport {
  readonly transport: PDFDataRangeTransport;
  /** Ακυρώνει κάθε κομμάτι και ανανέωση σε πτήση. */
  readonly dispose: () => void;
}

/**
 * Ανοίγει την ανάγνωση: πρώτο κομμάτι (μήκος + κεφαλίδα) και transport για τα υπόλοιπα.
 * `RangeTransport` = η κλάση της **ίδιας** βιβλιοθήκης που θα κάνει `getDocument` (το pdf.js ελέγχει `instanceof`).
 */
export async function openLicensedPdfTransport(
  RangeTransport: RangeTransportClass,
  issue: IssuePdfLicense,
  onFailure: (error: PdfRangeError) => void,
): Promise<LicensedPdfTransport> {
  const controller = new AbortController();
  const { signal } = controller;
  const lease = new PdfLicenseLease(issue, signal);
  const first = await fetchPdfRange(lease, 0, PDF_INITIAL_CHUNK_BYTES, signal);

  class LicensedRangeTransport extends RangeTransport {
    override requestDataRange(begin: number, end: number): void {
      fetchPdfRange(lease, begin, end, signal).then(
        ({ bytes }) => { if (!signal.aborted) this.onDataRange(begin, bytes); },
        (error: unknown) => {
          if (signal.aborted) return;
          onFailure(error instanceof PdfRangeError ? error : new PdfRangeError('http'));
        },
      );
    }

    override abort(): void {
      controller.abort();
    }
  }

  return { transport: new LicensedRangeTransport(first.total, first.bytes), dispose: () => controller.abort() };
}
