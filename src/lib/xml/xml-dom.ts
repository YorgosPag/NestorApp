/**
 * XML DOM parsing + traversal helpers — ΕΝΑ SSoT για όλη την εφαρμογή (ADR-526/678).
 *
 * Πριν: οι generic DOM helpers ζούσαν αποκλειστικά στον Tekton reader (`io/tek/tek-xml-reader.ts`).
 * Όταν προστέθηκε δεύτερος XML καταναλωτής (COLLADA `.dae` import, ADR-678 Φ4) ο πειρασμός ήταν να
 * αντιγραφούν — ακριβώς το structural clone που πιάνει το jscpd (N.18). Αντ' αυτού εξάγονται εδώ,
 * σε foundational util (`src/lib`), και τα εισάγουν όλοι οι XML readers (Tekton, COLLADA, …).
 *
 * Χρησιμοποιούμε τον native `DOMParser` (browser + jsdom στο jest) — **καμία νέα εξάρτηση** (N.5).
 * Εδώ ζουν ΜΟΝΟ γενικοί DOM helpers· η ερμηνεία του κάθε format ζει στους αντίστοιχους extractors.
 *
 * @see ./escape-xml — η αντίστροφη πλευρά (write-side escaping)
 * @see ../../subapps/dxf-viewer/io/tek/tek-xml-reader — Tekton wrapper (root check + TekParseError)
 */

/** Σφάλμα parse με ανθρώπινο μήνυμα (όχι raw DOM exception). */
export class XmlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XmlParseError';
  }
}

/**
 * Parse XML string → root `Element`. Ρίχνει `XmlParseError` αν το περιεχόμενο δεν είναι έγκυρο XML
 * ή (όταν δοθεί `expectedRoot`) αν το root tag δεν ταιριάζει. Ο `DOMParser` δεν ρίχνει· σηματοδοτεί
 * σφάλμα με `<parsererror>` στο αποτέλεσμα.
 */
export function parseXml(content: string, expectedRoot?: string): Element {
  const doc = new DOMParser().parseFromString(content, 'application/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new XmlParseError(`Invalid XML: ${parserError.textContent?.trim() ?? 'unknown error'}`);
  }
  const root = doc.documentElement;
  if (!root) throw new XmlParseError('Invalid XML: missing root element.');
  if (expectedRoot !== undefined && root.tagName !== expectedRoot) {
    throw new XmlParseError(`Root element is not <${expectedRoot}> (found <${root.tagName}>).`);
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
 * Αριθμητικό κείμενο του παιδιού `tag` → `number`, ή `fallback` αν λείπει/άκυρο. Καλύπτει trailing
 * space στις τιμές (π.χ. `"0.80 "`) μέσω `trim` (ο Τέκτων τα αφήνει).
 */
export function childNumber(parent: Element, tag: string, fallback: number): number {
  const text = childText(parent, tag);
  if (text === null || text === '') return fallback;
  const n = Number.parseFloat(text);
  return Number.isFinite(n) ? n : fallback;
}
