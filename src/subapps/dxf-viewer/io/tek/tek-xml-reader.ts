/**
 * ADR-526 (Tekton .TEK IMPORT) — low-level XML reader helpers (pure).
 *
 * Ο Τέκτων εξάγει καθαρό UTF-8 XML (`<tekton>` root, χωρίς attributes/CDATA, οι ειδικοί
 * χαρακτήρες ως entities `&gt;`). Χρησιμοποιούμε τον native `DOMParser` (browser + jsdom
 * στο jest) — **καμία νέα εξάρτηση** (N.5). Εδώ ζουν ΜΟΝΟ γενικοί DOM helpers· η ερμηνεία
 * των entities ζει στους extractors.
 */

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
  const doc = new DOMParser().parseFromString(content, 'application/xml');
  // Ο DOMParser δεν ρίχνει· σηματοδοτεί σφάλμα με <parsererror> στο αποτέλεσμα.
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new TekParseError(`Μη έγκυρο XML: ${parserError.textContent?.trim() ?? 'άγνωστο σφάλμα'}`);
  }
  const root = doc.documentElement;
  if (!root || root.tagName !== 'tekton') {
    throw new TekParseError('Το αρχείο δεν είναι Tekton (.tek) — λείπει το <tekton> root.');
  }
  return root;
}

/** Άμεσα παιδιά-elements ενός κόμβου με δοσμένο tag (μη-αναδρομικό). */
export function directChildren(parent: Element, tag: string): Element[] {
  const out: Element[] = [];
  for (const child of Array.from(parent.children)) {
    if (child.tagName === tag) out.push(child);
  }
  return out;
}

/** Πρώτο άμεσο παιδί-element με δοσμένο tag, ή `null`. */
export function firstChild(parent: Element, tag: string): Element | null {
  for (const child of Array.from(parent.children)) {
    if (child.tagName === tag) return child;
  }
  return null;
}

/** Κείμενο του πρώτου άμεσου παιδιού `tag` (trimmed), ή `null` αν λείπει. */
export function childText(parent: Element, tag: string): string | null {
  const el = firstChild(parent, tag);
  if (!el) return null;
  const text = el.textContent;
  return text === null ? null : text.trim();
}

/**
 * Αριθμητικό κείμενο του παιδιού `tag` → `number`, ή `fallback` αν λείπει/άκυρο.
 * Ο Τέκτων αφήνει trailing space στις τιμές (π.χ. `"0.80 "`) — το `trim` το καλύπτει.
 */
export function childNumber(parent: Element, tag: string, fallback: number): number {
  const text = childText(parent, tag);
  if (text === null || text === '') return fallback;
  const n = Number.parseFloat(text);
  return Number.isFinite(n) ? n : fallback;
}
