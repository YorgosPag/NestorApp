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
import { parseImportCell } from './proposal-values';

const SEPARATORS = /[\s\-/,·]+/u;
const BARE_NUMBER = /^\d+(?:[.,]\d+)?$/u;

const reads = (attribute: CatalogAttributeDefinition, text: string, unitCode: string | null, context: ValueTextContext): boolean => {
  const parsed = parseImportCell(attribute, { text, unitCode }, context);
  return parsed.ok && parsed.value !== null;
};

/** Το κείμενο που αντιστοιχεί στον στόχο: το μοναδικό κομμάτι που διαβάζει η ιδιότητα, αλλιώς ολόκληρο. */
export function fragmentFor(attribute: CatalogAttributeDefinition, text: string, unitCode: string | null, context: ValueTextContext): string {
  if (attribute.type === 'text' || reads(attribute, text, unitCode, context)) return text;
  const parts = text.split(SEPARATORS).filter((part) => part !== '');
  if (parts.length < 2 || parts.some((part) => BARE_NUMBER.test(part))) return text;
  const hits = parts.filter((part) => reads(attribute, part, unitCode, context));
  return hits.length === 1 ? hits[0] : text;
}
