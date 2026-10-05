/**
 * =============================================================================
 * ΤΙ **ΒΛΕΠΕΙ** Ο ΑΝΑΓΝΩΣΤΗΣ ΕΝΟΣ EMAIL — το όργανο των αγκυρών (ADR-849 · ADR-777 §8.54)
 * =============================================================================
 *
 * 🔴 **Γιατί υπάρχει.** Οι άγκυρες Η1/Η3 μετρούσαν πόσες φορές υπάρχει ένας τίτλος σε
 * **όλο** το HTML. Από το ADR-849 Β4 ο τίτλος ζει **και** στον κρυφό πρόλογο (σωστά: είναι
 * η προεπισκόπηση των εισερχομένων) ⇒ το HTML τον έχει δύο φορές, ο άνθρωπος τον βλέπει
 * μία. Η ερώτηση «πόσες φορές είναι **γραμμένο**» δεν ήταν ποτέ η ερώτηση του περιστατικού·
 * η ερώτηση ήταν «πόσες φορές το **διαβάζει**».
 *
 * 🔑 **Και η απάντηση εξαρτάται από το πρόγραμμα.** Το Outlook υπολογιστή αποδίδει με τη
 * μηχανή του Word: το `display:none` **δεν** κρύβει αξιόπιστα, κρύβει το `mso-hide:all`
 * (Litmus · Email on Acid · learn.better.email «MSO attributes»). Γι' αυτό η όψη παίρνει
 * **πελάτη**: η ίδια άγκυρα, μετρημένη στις δύο μηχανές, πιάνει **και** το «το σώμα γράφτηκε
 * δύο φορές» **και** το «ο πρόλογος φάνηκε στο Outlook» — το δεύτερο ήταν πραγματικό
 * ελάττωμα ως 2026-10-05 και **καμία** άγκυρα δεν το έβλεπε.
 *
 * ⚠️ **DOM, όχι regex.** Η προηγούμενη `preheaderOf` έψαχνε `<div style="display:none;…`
 * και ανάγκαζε το προϊόν να κρατά το `display:none` **πρώτο** στη δήλωση — το test όριζε τη
 * σειρά των κανόνων. Εδώ κρίνεται η **δήλωση**, όποια κι αν είναι η σειρά ή το στοιχείο.
 *
 * ⚠️ **Τι ΔΕΝ είναι**: δεν είναι μηχανή απόδοσης. Διαβάζει **μόνο inline styles** (τα
 * προγράμματα email πετούν τα `<style>` — και το προϊόν δεν γράφει κανένα) και μοντελοποιεί
 * **μόνο** την ορατότητα. Δεν αντικαθιστά τον ζωντανό έλεγχο σε πραγματικό πρόγραμμα.
 */

/**
 * Ο αναλυτής HTML του περιβάλλοντος `jsdom` του jest.
 *
 * ⚠️ **Όχι `import 'jsdom'`** (μετρημένο 2026-10-05): το `jsdom@27` του έργου σέρνει το
 * `parse5@8`, που είναι ESM ⇒ το jest δεν το φορτώνει («Cannot use import statement»). Το
 * `jest-environment-jsdom` φέρνει τη **δική του** έκδοση και την εκθέτει ως καθολικό `DOMParser`.
 * Σουίτα με `@jest-environment node` που ζητά όψη παίρνει **ρητό** σφάλμα, όχι άδειο κείμενο
 * (ένα «0 εμφανίσεις» από όργανο που δεν διάβασε τίποτα θα ήταν πράσινο χωρίς λόγο).
 */
function parseBody(html: string): HTMLElement {
  if (typeof DOMParser === 'undefined') {
    throw new Error('email-html-view: χρειάζεται περιβάλλον jest `jsdom` (η σουίτα δηλώνει `@jest-environment node`;)');
  }
  return new DOMParser().parseFromString(html, 'text/html').body;
}

/**
 * Οι δύο οικογένειες μηχανών που διαφωνούν για το «κρυφό».
 * - `standards`: Gmail · Apple Mail · webmail — σέβονται το CSS.
 * - `outlook-word`: Outlook υπολογιστή (Word) — σέβεται το `mso-hide` και τα σχόλια `mso`.
 */
export type EmailClient = 'standards' | 'outlook-word';

/** Κάθε άγκυρα ορατότητας τρέχει σε **όλους** — νέος πελάτης ⇒ καλύπτεται χωρίς να το θυμηθεί κανείς. */
export const EMAIL_CLIENTS: readonly EmailClient[] = ['standards', 'outlook-word'];

const NOT_MSO_BLOCK = /<!--\[if !mso\]><!--\s*-->[\s\S]*?<!--<!\[endif\]-->/g;
const MSO_BLOCK = /<!--\[if [^\]]*mso[^\]]*\]>([\s\S]*?)<!\[endif\]-->/g;

/**
 * Τα υπό όρους σχόλια, όπως τα διαβάζει ο κάθε πελάτης.
 * Το Word **εκτελεί** το `[if mso]` και **πετά** το `[if !mso]`· οι υπόλοιποι βλέπουν το πρώτο
 * ως σχόλιο (το DOM το αγνοεί μόνο του) και το δεύτερο ως κανονική σήμανση.
 */
function sourceAsSeenBy(html: string, client: EmailClient): string {
  if (client === 'standards') return html;
  return html.replace(NOT_MSO_BLOCK, '').replace(MSO_BLOCK, '$1');
}

/** Οι δηλώσεις ενός inline `style`, κανονικοποιημένες (πεζά, χωρίς κενά, χωρίς `!important`). */
function declarationsOf(element: Element): ReadonlyMap<string, string> {
  const declarations = new Map<string, string>();
  for (const part of (element.getAttribute('style') ?? '').split(';')) {
    const colon = part.indexOf(':');
    if (colon < 0) continue;
    const value = part.slice(colon + 1).replace(/!important/i, '').trim().toLowerCase();
    declarations.set(part.slice(0, colon).trim().toLowerCase(), value);
  }
  return declarations;
}

/** **Ο ένας κριτής**: κρύβει αυτό το στοιχείο το περιεχόμενό του, σε αυτόν τον πελάτη; */
function hidesContent(element: Element, client: EmailClient): boolean {
  const style = declarationsOf(element);
  if (client === 'outlook-word') return style.get('mso-hide') === 'all';
  return style.get('display') === 'none' || style.get('visibility') === 'hidden';
}

function bodyOf(html: string, client: EmailClient): HTMLElement {
  return parseBody(sourceAsSeenBy(html, client));
}

function collectVisibleText(node: Node, client: EmailClient, into: string[]): void {
  // 3 = TEXT_NODE, 1 = ELEMENT_NODE.
  if (node.nodeType === 3) {
    const text = (node.textContent ?? '').trim();
    if (text.length > 0) into.push(text);
    return;
  }
  if (node.nodeType !== 1 || hidesContent(node as Element, client)) return;
  node.childNodes.forEach((child) => collectVisibleText(child, client, into));
}

/**
 * **Το κείμενο που διαβάζει ο άνθρωπος** όταν ανοίγει το μήνυμα σε αυτόν τον πελάτη.
 * Ένα κομμάτι κειμένου ανά γραμμή — ώστε δύο γειτονικά στοιχεία να μην «κολλήσουν» σε
 * συμβολοσειρά που δεν υπάρχει πουθενά στην οθόνη.
 */
export function visibleTextOf(html: string, client: EmailClient): string {
  const parts: string[] = [];
  collectVisibleText(bodyOf(html, client), client, parts);
  return parts.join('\n');
}

/** Το στοιχείο του προλόγου: το **πρώτο** παιδί του σώματος που οι μηχανές CSS κρύβουν. */
function preheaderElementOf(html: string): Element | null {
  const children = Array.from(bodyOf(html, 'standards').children);
  return children.find((child) => hidesContent(child, 'standards')) ?? null;
}

/**
 * Ο κρυφός πρόλογος, **όπως είναι γραμμένος** (σήμανση, όχι αποκωδικοποιημένο κείμενο) —
 * ώστε ένα `<script>` που δεν πέρασε από escape να φαίνεται ως `<script>`, όχι ως κείμενο.
 */
export function preheaderOf(html: string): string {
  return preheaderElementOf(html)?.innerHTML ?? '';
}

/** Κρύβεται ο πρόλογος σε αυτόν τον πελάτη; `false` και όταν πρόλογος δεν υπάρχει καθόλου. */
export function preheaderIsHiddenIn(html: string, client: EmailClient): boolean {
  const element = preheaderElementOf(html);
  return element !== null && hidesContent(element, client);
}

/** Πόσες φορές εμφανίζεται — ποτέ `includes`, που δεν ξεχωρίζει «μία» από «δύο». */
export function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}
