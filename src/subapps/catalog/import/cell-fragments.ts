/**
 * **Κάθε στόχος παίρνει το δικό του κομμάτι** σύνθετου κελιού (ADR-923 βήμα 3Α). Καθαρό.
 *
 * Αφορμή (μετρημένη, σελ. 85 ARIES): η γραμμή «ΗΛΕΚΤΡΙΚΗ ΠΑΡΟΧΗ» είναι **ένα** ενωμένο κελί `230V-50Hz-1Ph`. Με το Γ13 (μία γραμμή → πολλές
 * ιδιότητες) κάθε στόχος έπαιρνε **ολόκληρο** το κείμενο, που δεν το διαβάζει κανένας: ούτε η τάση ούτε η συχνότητα.
 *
 * 🔑 **Ο στόχος διαλέγει με τον ΔΙΚΟ του κωδικοποιητή** (Rossum: κάθε πεδίο-έξοδος βγάζει το δικό του κομμάτι από την ίδια πηγή): το κομμάτι
 *    που διαβάζει το `parseImportCell` της ιδιότητας — η τάση το «230V», η συχνότητα το «50Hz». **Ακριβώς ένα** ⇒ αυτό· κανένα ή περισσότερα
 *    ⇒ ολόκληρο το κείμενο, και το εύρημα της ανάγνωσης μένει ορατό. Ποτέ μαντεψιά.
 * 🔑 **Φρένο εύρους**: γυμνός αριθμός ανάμεσα στα κομμάτια (`220-240V`, `50-60Hz`) σημαίνει εύρος, όχι λίστα ⇒ κανένα σπάσιμο. Αλλιώς το
 *    `220-240V` θα έδινε σιωπηλά 240 V.
 * 🔑 Μόνο όταν το **ολόκληρο** κείμενο δεν διαβάζεται: ό,τι διαβάζεται σήμερα μένει ίδιο. Κείμενο (`text`) δεν σπάει ποτέ — τα δέχεται όλα.
 * ⚠️ Το πλαίσιο στο PDF μένει **όλο το κελί**: η στρώση κειμένου δίνει λέξεις (`page-tokens.ts`), όχι γεωμετρία μέσα στη λέξη.
 * @module subapps/catalog/import/cell-fragments
 */

import type { CatalogAttributeDefinition } from '../types/attribute';
import type { ValueTextContext } from '../values/value-text-codec';
import { readsImportCell } from './proposal-values';

const SEPARATORS = /[\s\-/,·]+/u;
const BARE_NUMBER = /^\d+(?:[.,]\d+)?$/u;

const reads = (attribute: CatalogAttributeDefinition, text: string, unitCode: string | null, context: ValueTextContext): boolean =>
  readsImportCell(attribute, { text, unitCode }, context);

/** Τα κομμάτια του κειμένου, ή `null` όταν δεν σπάει: λιγότερα από δύο, ή εύρος (φρένο εύρους). */
function partsOf(text: string): string[] | null {
  const parts = text.split(SEPARATORS).filter((part) => part !== '');
  return parts.length < 2 || parts.some((part) => BARE_NUMBER.test(part)) ? null : parts;
}

/** Το κείμενο που αντιστοιχεί στον στόχο: το μοναδικό κομμάτι που διαβάζει η ιδιότητα, αλλιώς ολόκληρο. */
export function fragmentFor(attribute: CatalogAttributeDefinition, text: string, unitCode: string | null, context: ValueTextContext): string {
  if (attribute.type === 'text' || reads(attribute, text, unitCode, context)) return text;
  const parts = partsOf(text);
  if (parts === null) return text;
  const hits = parts.filter((part) => reads(attribute, part, unitCode, context));
  return hits.length === 1 ? hits[0] : text;
}

/** Ένας στόχος της γραμμής: η ιδιότητα και η μονάδα που τυπώνει η ετικέτα **γι' αυτήν**. */
export interface FragmentTarget {
  readonly attribute: CatalogAttributeDefinition;
  readonly unitCode: string | null;
}

/** Ό,τι μένει από τα κομμάτια όταν βγουν όσα πήραν οι άλλοι στόχοι (πολυσύνολο: το ίδιο κομμάτι δύο φορές μετρά δύο). */
function leftoverParts(parts: readonly string[], claimed: readonly string[]): string[] {
  const left = [...parts];
  for (const fragment of claimed) {
    const at = left.indexOf(fragment);
    if (at < 0) return [];
    left.splice(at, 1);
  }
  return left;
}

/**
 * **Κομμάτι κατ' αποκλεισμό** (ADR-923 βήμα 3Β): το κείμενο κάθε στόχου της γραμμής, με τη σειρά των στόχων. Πρώτα ο καθένας με τον δικό
 * του κωδικοποιητή (`fragmentFor`). Αν **όλοι οι άλλοι** πήραν από ένα κομμάτι και μένουν **ακριβώς ένα** κομμάτι και **ακριβώς ένας**
 * στόχος, ο στόχος παίρνει ως πηγή αυτό το κομμάτι — **χωρίς τιμή**: αν δεν το διαβάζει, το εύρημα μένει, αλλά για «1Ph» και όχι για όλο το
 * «230V-50Hz-1Ph». Αυτό στενεύει την πηγή, δεν μαντεύει τιμή· και δίνει στη μνήμη τιμών του προμηθευτή κλειδί που ξαναβρίσκεται.
 * ⚠️ Στόχος κειμένου ή στόχος που διαβάζει ολόκληρο το κείμενο ⇒ καμία ανάθεση κατ' αποκλεισμό: το κείμενο δεν μοιράζεται.
 */
export function lineFragments(targets: readonly FragmentTarget[], text: string, context: ValueTextContext): string[] {
  const own = targets.map(({ attribute, unitCode }) => fragmentFor(attribute, text, unitCode, context));
  const open = targets.flatMap((target, index) => (own[index] === text ? [index] : []));
  if (open.length !== 1 || targets.length < 2) return own;
  const [last] = open;
  const { attribute, unitCode } = targets[last];
  const parts = partsOf(text);
  if (parts === null || attribute.type === 'text' || reads(attribute, text, unitCode, context)) return own;
  const left = leftoverParts(parts, own.filter((_, index) => index !== last));
  return left.length === 1 ? own.map((fragment, index) => (index === last ? left[0] : fragment)) : own;
}
