/**
 * @fileoverview **Τα bytes του λογοτύπου εταιρείας, αποδεδειγμένα** — η ΜΙΑ θύρα προς το PDF, ίδια σε browser και
 *   server (ADR-ACC-018 §17.3).
 * @module lib/company/brand-logo-image
 * @related lib/company/brand-logo-ref (η αναφορά) · server/company/brand-logo-image.server (ανάγνωση στον server) ·
 *   lib/hash/sha256 (ο ΕΝΑΣ SHA-256 του Web Crypto) · lib/files/file-display-url (το URL του proxy, ADR-899)
 *
 * 🔑 **Ένα PDF ζωγραφίζει μόνο bytes που αποδεικνύει**: ό,τι κι αν φέρει η μεταφορά (proxy · κάδος), συγκρίνεται με το
 *    `sha256` της αναφοράς. Διαφορά ⇒ `null` (κεφαλίδα χωρίς λογότυπο), ποτέ «κάτι που μοιάζει».
 * 🔑 **Λογότυπο που λείπει ≠ PDF που αποτυγχάνει**: κάθε αποτυχία ⇒ `null`, όπως στο λογότυπο της εφαρμογής
 *    (`services/pdf/pdf-app-logo`).
 * ⚠️ Καθαρό + `fetch` — κανένα React, κανένα Admin SDK· εισάγεται από browser και server.
 */

import { fileDisplayUrl } from '@/lib/files/file-display-url';
import { sha256Hex } from '@/lib/hash/sha256';
import type { BrandLogoRef } from '@/types/company-brand';

/** Το λογότυπο έτοιμο για `addImage`: τα bytes, η μορφή του jsPDF και οι διαστάσεις για σωστή αναλογία. */
export interface PdfBrandImage {
  readonly bytes: Uint8Array;
  readonly format: 'PNG' | 'JPEG';
  /** Pixel — μόνο η **αναλογία** μετρά στη σελίδα. */
  readonly width: number;
  readonly height: number;
  /** Η ταυτότητα των bytes — και το alias του jsPDF (δεύτερη χρήση στο ίδιο έγγραφο = ίδιο αντικείμενο). */
  readonly sha256: string;
}

/** Bytes που διαβάστηκαν ⇒ εικόνα, **μόνο** αν είναι ακριβώς αυτά που λέει η αναφορά. */
export async function pdfBrandImageOf(ref: BrandLogoRef, bytes: Uint8Array): Promise<PdfBrandImage | null> {
  if ((await sha256Hex(bytes)) !== ref.sha256) return null;
  return {
    bytes,
    format: ref.contentType === 'image/png' ? 'PNG' : 'JPEG',
    width: ref.width,
    height: ref.height,
    sha256: ref.sha256,
  };
}

/**
 * **Στη συσκευή**: τα bytes από τον proxy (`/api/storage/file/…`, same-origin cookie — ο proxy κρίνει «επιτρέπεται;»).
 * Το όνομα του αντικειμένου είναι αμετάβλητο (νέο `fileId` σε κάθε ανέβασμα)· ο έλεγχος sha256 κάνει την απόδειξη.
 */
export async function fetchPdfBrandImage(ref: BrandLogoRef | null): Promise<PdfBrandImage | null> {
  if (ref === null) return null;
  const url = fileDisplayUrl({ storagePath: ref.storagePath, contentType: ref.contentType });
  if (url === null) return null;
  try {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) return null;
    return await pdfBrandImageOf(ref, new Uint8Array(await response.arrayBuffer()));
  } catch {
    return null;
  }
}
