/**
 * =============================================================================
 * Η ΓΡΑΜΜΑΤΙΚΗ ΤΟΥ `richText` — λίστα επιτρεπτών, ΑΠΟΡΡΙΨΗ, όχι καθάρισμα (ADR-923 §5.10.2)
 * =============================================================================
 *
 * Η περιγραφή ενός προϊόντος τυπώνεται στον κατάλογο και (Φ6) δείχνεται στο κοινό. Δύο δρόμοι:
 *
 *   ❌ **Καθάρισμα** (DOMPurify): αλλοιώνει **σιωπηλά** ό,τι έγραψε ο προμηθευτής — και στον διακομιστή, χωρίς
 *      DOM, το `dompurify` επιστρέφει το κείμενο **ακαθάριστο** (`isSupported === false`). Το repo έχει και έναν
 *      regex «καθαριστή» (`sanitizeHtmlForStorage`) που δηλώνει ο ίδιος ότι **δεν** είναι αρκετός.
 *   ✅ **Γραμματική** (εδώ): το κείμενο είναι **είτε** μέσα στη γλώσσα **είτε** απορρίπτεται με εύρημα — ίδια
 *      πολιτική με τα ποσά (`isCanonicalAmount`): ο διακομιστής δεν μαντεύει, ο πελάτης (επεξεργαστής 2δ) παράγει
 *      **μόνο** αυτό το υποσύνολο. Η απόφαση είναι καθαρή, άρα την τρέχει **και** η οθόνη πριν στείλει.
 *
 * Η γλώσσα: κείμενο χωρίς `<` + ετικέτες χωρίς χαρακτηριστικά από κλειστό σύνολο (παράγραφος, έμφαση, λίστες,
 * υπότιτλοι, δείκτες) + `<a href="…">` με **μόνο** `https:` · `http:` · `mailto:`. Ισορροπημένο φώλιασμα.
 * Ό,τι άλλο (script, style, `on*=`, `javascript:`, σχόλια, CDATA, `<` χωρίς ετικέτα) ⇒ εκτός γλώσσας.
 *
 * @module subapps/catalog/values/rich-text
 */

/** Οι ετικέτες της γλώσσας (Akeneo WYSIWYG: παράγραφοι, έμφαση, λίστες, σύνδεσμοι). */
export const RICH_TEXT_TAGS = ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li', 'h3', 'h4', 'sub', 'sup', 'a'] as const;
type RichTextTag = (typeof RICH_TEXT_TAGS)[number];

const VOID_TAGS: ReadonlySet<string> = new Set(['br']);
const ALLOWED: ReadonlySet<string> = new Set(RICH_TEXT_TAGS);
const SAFE_HREF = /^(?:https?:\/\/|mailto:)[^\s"'<>`]+$/i;
/** Μία ετικέτα: `<x>` · `</x>` · `<br/>` · `<a href="…">`. Τίποτε άλλο. */
const TAG = /^<(\/?)([a-z0-9]+)(?:\s+href="([^"]*)")?\s*(\/?)>/;

export type RichTextVerdict = { readonly ok: true } | { readonly ok: false; readonly offset: number };

const reject = (offset: number): RichTextVerdict => ({ ok: false, offset });

/** Είναι το κείμενο μέσα στη γλώσσα του `richText`; Αν όχι, πού χάλασε (θέση χαρακτήρα). */
export function checkRichText(html: string): RichTextVerdict {
  const open: RichTextTag[] = [];
  let index = html.indexOf('<');
  while (index !== -1) {
    const match = TAG.exec(html.slice(index));
    if (!match) return reject(index);
    const [whole, closing, name, href, selfClosing] = match;
    if (!ALLOWED.has(name)) return reject(index);
    const tag = name as RichTextTag;
    if (href !== undefined && (tag !== 'a' || closing || !SAFE_HREF.test(href))) return reject(index);
    if (tag === 'a' && !closing && href === undefined) return reject(index);
    if (closing) {
      if (open.pop() !== tag) return reject(index);
    } else if (!VOID_TAGS.has(tag)) {
      if (selfClosing) return reject(index);
      open.push(tag);
    }
    index = html.indexOf('<', index + whole.length);
  }
  return open.length === 0 ? { ok: true } : reject(html.length);
}
