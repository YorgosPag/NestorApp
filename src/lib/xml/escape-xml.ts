/**
 * XML text escaping — ΕΝΑ SSoT για όλη την εφαρμογή (ADR-512 centralization).
 *
 * Πριν: ίδια συνάρτηση copy-pasted (`svg-from-dxf-scene.ts`, TEK writer, …). Τώρα
 * ένα foundational util (`src/lib`) που εισάγουν και τα subapps και τα services.
 */

/** Escape των 5 XML predefined entities (`& < > " '`) για ασφαλές text/attribute content. */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
