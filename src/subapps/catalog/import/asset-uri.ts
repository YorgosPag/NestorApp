/**
 * Το **κανονικό URI** ενός μέσου προς εισαγωγή (ADR-934 §5.2 Μ5): το πρώτο από τα δύο κλειδιά ταυτότητας
 * (χώρος, κανονικό URI) — το δεύτερο είναι το sha256 του περιεχομένου, στο Μ-β.
 *
 * 🔑 **Ταυτότητα, όχι ασφάλεια.** Εδώ κρίνεται μόνο «είναι η ίδια διεύθυνση;». Αν επιτρέπεται να τη ζητήσει ο server
 * (https · δημόσια διεύθυνση · χωρίς credentials) το κρίνει ο **ένας** φρουρός SSRF του έργου, το `outbound-url-guard`,
 * τη στιγμή της λήψης. Δύο κριτές για το ίδιο ερώτημα θα απέκλιναν.
 *
 * Κανόνες (WHATWG URL, ίδιοι σε browser και Node):
 * - scheme και host σε πεζά, χωρίς την προεπιλεγμένη θύρα, IDN σε punycode — τα κάνει ο ίδιος ο αναλυτής·
 * - **χωρίς** fragment: δεν φεύγει ποτέ προς τον server, άρα δεν αλλάζει το αρχείο·
 * - path και query **αυτούσια**: σε υπογεγραμμένα URL (S3, CDN) το query **είναι** το αρχείο. Γι' αυτό δεν
 *   χρησιμοποιείται το `canonicalizeResourceUri` του OAuth, που το πετά.
 * - μόνο `http(s)`. Το ETIM επιτρέπει και «file source path» (αρχείο μέσα σε πακέτο): χωρίς πακέτο δεν υπάρχει
 *   τίποτα να κατέβει ⇒ `null`, και ο καλών το δηλώνει.
 *
 * @module subapps/catalog/import/asset-uri
 */

const FETCHABLE_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

export function canonicalAssetUri(raw: string): string | null {
  const text = raw.trim();
  if (text === '') return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (!FETCHABLE_PROTOCOLS.has(url.protocol) || url.hostname === '') return null;
  url.hash = '';
  return url.href;
}
