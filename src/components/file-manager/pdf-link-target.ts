/**
 * @fileoverview ADR-923 §5.15.2 (Θ.2α-2) — **Τι είναι ένας σύνδεσμος του PDF και πού πάει**: καθαρός πυρήνας της
 * στρώσης συνδέσμων (`PdfLinkLayer`), χωρίς React και χωρίς DOM.
 * @module components/file-manager/pdf-link-target
 *
 * 🔒 Ένα δημοσιευμένο έντυπο είναι **ξένο περιεχόμενο** μέσα στην εφαρμογή: εξωτερικός σύνδεσμος γίνεται ενεργός ΜΟΝΟ
 *    για `http:` · `https:` · `mailto:` — ποτέ `javascript:`, `data:`, `file:` κ.λπ. Το pdf.js απολυμαίνει ήδη το `url`
 *    (`createValidAbsoluteUrl`)· εδώ ξαναελέγχεται, γιατί η στρώση **δεν** περνά από το AnnotationLayer του pdf.js.
 * 🔑 Ορθογώνιο σε **κλάσματα της στραμμένης σελίδας** (0..1, αρχή πάνω-αριστερά) — η τεχνική του `PdfHighlights`:
 *    ακολουθεί ζουμ και ανάλυση χωρίς inline style, και (σε αντίθεση με τις επισημάνσεις) και τη στροφή.
 */

import type { PdfAnnotationData, PdfDocProxy, PdfExplicitDest, PdfHighlightRegion, PdfPageProxy } from './pdf-canvas-config';

export type PdfLinkTarget =
  | { readonly kind: 'external'; readonly href: string; /** host, ή η διεύθυνση του `mailto:` */ readonly label: string }
  | { readonly kind: 'internal'; readonly dest: string | PdfExplicitDest };

const SAFE_EXTERNAL_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:', 'mailto:']);

function externalTargetOf(raw: string): PdfLinkTarget | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (!SAFE_EXTERNAL_PROTOCOLS.has(parsed.protocol)) return null;
  const label = parsed.protocol === 'mailto:' ? safelyDecoded(parsed.pathname) : parsed.host;
  return { kind: 'external', href: parsed.href, label };
}

/** Κακοσχηματισμένο `%` σε ξένο έντυπο δεν ρίχνει τη στρώση — μένει η κωδικοποιημένη μορφή. */
function safelyDecoded(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Σημείωση του `getAnnotations()` → σύνδεσμος, ή `null` αν δεν είναι σύνδεσμος ή δεν επιτρέπεται. */
export function pdfLinkTargetOf(annotation: PdfAnnotationData): PdfLinkTarget | null {
  if (annotation.subtype !== 'Link') return null;
  if (typeof annotation.url === 'string' && annotation.url !== '') return externalTargetOf(annotation.url);
  const { dest } = annotation;
  if (typeof dest === 'string' && dest !== '') return { kind: 'internal', dest };
  if (Array.isArray(dest) && dest.length > 0) return { kind: 'internal', dest };
  return null;
}

function isRefProxy(value: unknown): value is { num: number; gen: number } {
  return typeof value === 'object' && value !== null
    && typeof (value as { num?: unknown }).num === 'number'
    && typeof (value as { gen?: unknown }).gen === 'number';
}

/** Προορισμός (όνομα ή ρητός) → αριθμός σελίδας 1..N, ή `null` αν δεν λύνεται μέσα σε αυτό το έγγραφο. */
export async function resolvePdfDestinationPage(doc: PdfDocProxy, dest: string | PdfExplicitDest): Promise<number | null> {
  const explicit = typeof dest === 'string' ? await doc.getDestination(dest) : dest;
  if (!explicit || explicit.length === 0) return null;
  const head = explicit[0];
  let index: number;
  if (isRefProxy(head)) index = await doc.getPageIndex(head);
  else if (typeof head === 'number' && Number.isInteger(head)) index = head;
  else return null;
  const pageNumber = index + 1;
  return pageNumber >= 1 && pageNumber <= doc.numPages ? pageNumber : null;
}

/** Ορθογώνιο PDF → κλάσματα της σελίδας **όπως φαίνεται** (με τη στροφή). Εκφυλισμένο ⇒ `null`. */
export function pdfLinkRegionOf(page: PdfPageProxy, rect: readonly number[] | undefined, rotation: number): PdfHighlightRegion | null {
  if (!rect || rect.length !== 4 || !rect.every(Number.isFinite)) return null;
  const viewport = page.getViewport({ scale: 1, rotation });
  const corners: readonly number[] = viewport.convertToViewportRectangle([...rect]);
  const [ax, ay, bx, by] = corners;
  const width = Math.abs(bx - ax) / viewport.width;
  const height = Math.abs(by - ay) / viewport.height;
  if (!(width > 0 && height > 0)) return null;
  return { x: Math.min(ax, bx) / viewport.width, y: Math.min(ay, by) / viewport.height, width, height };
}
