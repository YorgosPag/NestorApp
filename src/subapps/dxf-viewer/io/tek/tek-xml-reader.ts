/**
 * ADR-526 (Tekton .TEK IMPORT) — Tekton-specific XML wrapper.
 *
 * Ο Τέκτων εξάγει καθαρό UTF-8 XML (`<tekton>` root, χωρίς attributes/CDATA, οι ειδικοί
 * χαρακτήρες ως entities `&gt;`). Οι **γενικοί** DOM helpers (parse + traversal) ζουν πλέον στο
 * κοινό SSoT `@/lib/xml/xml-dom` (μοιράζονται με τον COLLADA import, ADR-678 Φ4 — μηδέν clone,
 * N.18)· εδώ μένει ΜΟΝΟ το Tekton-specific root check + το `TekParseError` συμβόλαιο.
 *
 * @see @/lib/xml/xml-dom — οι γενικοί helpers (parseXml, directChildren, firstChild, childText, …)
 */

import { parseXml, XmlParseError } from '@/lib/xml/xml-dom';

// Re-export των generic helpers ώστε οι υπάρχοντες Tekton extractors να μη χρειάζονται αλλαγή import.
export { directChildren, firstChild, childText, childNumber } from '@/lib/xml/xml-dom';

/** Σφάλμα parse με ανθρώπινο μήνυμα (όχι raw DOM exception). */
export class TekParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TekParseError';
  }
}

/**
 * Parse Tekton XML string → root `<tekton>` Element. Ρίχνει `TekParseError` αν το
 * περιεχόμενο δεν είναι έγκυρο XML ή δεν είναι Tekton αρχείο.
 */
export function parseTektonXml(content: string): Element {
  let root: Element;
  try {
    root = parseXml(content);
  } catch (e) {
    throw new TekParseError(e instanceof XmlParseError ? e.message : 'Μη έγκυρο XML.');
  }
  if (root.tagName !== 'tekton') {
    throw new TekParseError('Το αρχείο δεν είναι Tekton (.tek) — λείπει το <tekton> root.');
  }
  return root;
}
