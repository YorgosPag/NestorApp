/**
 * ADR-453 — Print/Export engine · pure filename builder.
 *
 * @module subapps/dxf-viewer/print/print-filename
 */

import type { PaperSize } from './config/paper-types';

/** Slugify a project/drawing name into a filesystem-safe token. */
function slugify(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned.length > 0 ? cleaned : 'drawing';
}

/**
 * Compose a print filename: `<project>_<A3>_<2026-06-14>.pdf`.
 * `dateStr` is injected (caller passes nowISO().slice(0,10)) so this stays pure.
 */
export function buildPrintFilename(
  projectName: string,
  paperSize: PaperSize,
  dateStr: string,
): string {
  return `${slugify(projectName)}_${paperSize}_${dateStr}.pdf`;
}
