/**
 * @fileoverview **Το πρότυπο διαδρομής ενός αιτήματος** — το κλειδί του ορίου ρυθμού (ADR-855).
 * @module lib/middleware/route-template
 * @related lib/middleware/with-rate-limit.ts (ο καταναλωτής) · lib/routes/route-param.ts (η αποκωδικοποίηση)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΚΑΘΕ id ΕΙΧΕ ΤΟ ΔΙΚΟ ΤΟΥ ΟΡΙΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το κλειδί του μετρητή ήταν η **πραγματική** διαδρομή: `/api/contacts/A` και `/api/contacts/B`
 * μετρούσαν σε χωριστούς κουβάδες ⇒ η απαρίθμηση ids **δεν** περιοριζόταν ποτέ — κάθε id είχε τα δικά
 * του 60-600/λεπτό. Και η δήλωση του `ASSET` («a scripted scrape of a whole pack still throttles»)
 * δεν ίσχυε: κάθε πλακίδιο είχε δικό του όριο.
 *
 * 🏛️ Envoy · Cloudflare · NGINX κλειδώνουν στο **πρότυπο** (route template), όχι στο URL.
 *
 * 🔑 **ΤΟ ΠΡΟΤΥΠΟ ΤΟ ΔΙΝΕΙ Ο ΔΡΟΜΟΛΟΓΗΤΗΣ, ΟΧΙ ΜΑΝΤΕΙΑ**: τα `params` του Next είναι ακριβώς τα δυναμικά
 * τμήματα που ταίριαξε. Αντικαθιστούμε **αυτά** — όχι «ό,τι μοιάζει με id» (regex για Firestore id / UUID
 * θα άφηνε έξω κάθε slug και token, και κάθε εξαίρεση θα ήταν νέος κουβάς ανά τιμή).
 *
 * ⛔ **ΑΠΟΤΥΧΙΑ = ΧΟΝΤΡΟΤΕΡΟΣ ΚΟΥΒΑΣ, ΠΟΤΕ ΛΕΠΤΟΤΕΡΟΣ**: τιμή που δεν βρέθηκε στη διαδρομή (εξωτική
 * κωδικοποίηση) ⇒ ο κουβάς γίνεται η **περιοχή** (`/api/<περιοχή>/[unresolved]`). Η εναλλακτική — να
 * μείνει η ωμή διαδρομή — θα έδινε στον επιτιθέμενο ακριβώς το κλειδί που αυτό το αρχείο αφαιρεί:
 * «άλλαξε την κωδικοποίηση, πάρε νέο όριο».
 */

import { decodeRouteParam } from '@/lib/routes/route-param';

/** Τα `params` όπως τα δίνει ο δρομολογητής: `[id]` ⇒ string · `[...path]` ⇒ string[] · `[[...opt]]` ⇒ ίσως τίποτα. */
export type RouteParams = Readonly<Record<string, string | readonly string[] | undefined>>;

export interface RouteTemplate {
  /** Το κλειδί του κουβά: `/api/contacts/[id]` — ή η περιοχή, αν κάποια τιμή δεν εντοπίστηκε. */
  readonly template: string;
  /** `false` ⇒ κάποια τιμή δεν βρέθηκε στη διαδρομή και το κλειδί χοντρύνθηκε (ο καλών το καταγράφει). */
  readonly resolved: boolean;
}

/** Σημάδι που δεν μπορεί να είναι τμήμα URL χωρίς κωδικοποίηση (`[` `]`) ⇒ καμία σύγκρουση με πραγματικό τμήμα. */
const UNRESOLVED_SEGMENT = '[unresolved]';

/**
 * ⚠️ Τρεις μορφές ανά πλευρά, επειδή το «πόσες φορές αποκωδικοποιήθηκε» διαφέρει: το `pathname` του `URL`
 * είναι κωδικοποιημένο, τα `params` του Next συνήθως όχι — αλλά οι διαδρομές τα ξαναπερνούν από το
 * `decodeRouteParam`, άρα δεν το εγγυάται κανείς. Ισότητα σε **οποιαδήποτε** κοινή μορφή.
 */
function formsOf(value: string): ReadonlySet<string> {
  const once = decodeRouteParam(value);
  return new Set([value, once, decodeRouteParam(once)]);
}

function sameSegment(segmentForms: ReadonlySet<string>, value: string): boolean {
  for (const form of formsOf(value)) if (segmentForms.has(form)) return true;
  return false;
}

/** Η θέση της πρώτης ακολουθίας `values` στα τμήματα, από το `from` και μετά — ή -1. */
function locate(
  segments: ReadonlyArray<ReadonlySet<string>>,
  taken: ReadonlyArray<boolean>,
  values: readonly string[],
  from: number,
): number {
  for (let start = from; start + values.length <= segments.length; start++) {
    let match = true;
    for (let k = 0; k < values.length && match; k++) {
      match = !taken[start + k] && sameSegment(segments[start + k], values[k]);
    }
    if (match) return start;
  }
  return -1;
}

/**
 * **Το πρότυπο της διαδρομής** — κάθε δυναμική τιμή γίνεται `[όνομα]` (`[...όνομα]` για catch-all).
 *
 * 🔑 Τα `params` εξετάζονται με τη σειρά τους, με **δρομέα**: ο δρομολογητής τα δίνει με τη σειρά της
 * διαδρομής, άρα το `/projects/X/buildings/X` γίνεται `/projects/[projectId]/buildings/[buildingId]` και
 * όχι δύο φορές το πρώτο.
 *
 * @example
 * routeTemplateOf('/api/contacts/A', { id: 'A' }).template          // '/api/contacts/[id]'
 * routeTemplateOf('/api/t/x/media/a/b.jpg', { k: 'x', path: ['a', 'b.jpg'] }).template
 *                                                                    // '/api/t/[k]/media/[...path]'
 */
export function routeTemplateOf(pathname: string, params: RouteParams): RouteTemplate {
  const raw = pathname.split('?')[0].replace(/\/+$/, '').split('/');
  const segments = raw.map((segment) => formsOf(segment));
  // Ανά θέση: το ωμό τμήμα · η ετικέτα `[όνομα]` · ή `null` = απορροφήθηκε από catch-all (δεν τυπώνεται).
  const out: Array<string | null> = [...raw];
  const taken = raw.map(() => false);
  let cursor = 0;

  for (const [name, value] of Object.entries(params)) {
    if (value === undefined) continue;
    const values = typeof value === 'string' ? [value] : value;
    // `[[...opt]]` χωρίς τιμή: δεν υπάρχει τμήμα να αντικατασταθεί — και δεν είναι αποτυχία.
    if (values.length === 0) continue;

    const at = locate(segments, taken, values, cursor);
    if (at < 0) {
      return { template: `${raw.slice(0, 3).join('/')}/${UNRESOLVED_SEGMENT}`, resolved: false };
    }

    for (let k = at; k < at + values.length; k++) {
      taken[k] = true;
      out[k] = null;
    }
    out[at] = typeof value === 'string' ? `[${name}]` : `[...${name}]`;
    cursor = at + values.length;
  }

  return { template: out.filter((segment): segment is string => segment !== null).join('/'), resolved: true };
}

/**
 * Τα `params` από το δεύτερο όρισμα ενός route handler — `Promise` (Next 15+), αντικείμενο (παλιό) ή τίποτα.
 * ⚠️ **Ποτέ δεν πετά**: ένα όριο ρυθμού που ρίχνει το αίτημα επειδή δεν διάβασε το πλαίσιο θα ήταν βλάβη
 *    του API από τον φρουρό του. Χωρίς `params` ⇒ η διαδρομή είναι στατική ⇒ πρότυπο = διαδρομή.
 */
export async function routeParamsOf(context: unknown): Promise<RouteParams> {
  if (typeof context !== 'object' || context === null || !('params' in context)) return {};
  try {
    const params: unknown = await (context as { params: unknown }).params;
    return typeof params === 'object' && params !== null ? (params as RouteParams) : {};
  } catch {
    return {};
  }
}
