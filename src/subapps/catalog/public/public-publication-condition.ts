/**
 * **Η ΜΙΑ ΣΥΝΘΗΚΗ ΔΗΜΟΣΙΕΥΣΗΣ** (ADR-923 §5.13 Δ3 · Δ6): τι επιτρέπεται να γίνει το δημόσιο έγγραφο ενός μοντέλου.
 *
 * 🔑 **Τρεις εκβάσεις, και η τρίτη είναι ο λόγος που υπάρχει το αρχείο.** Το `unverified` σημαίνει «ξέρουμε ότι δεν
 *    εγκρίθηκε» και οδηγεί σε **delete**. Το «δεν μπορέσαμε να ρωτήσουμε» δεν είναι ετυμηγορία: μια παροδική βλάβη ή ένα
 *    λείπον μυστικό θα άδειαζαν ολόκληρη τη βιτρίνα ενός χώρου. Άρα `unknown` ⇒ ούτε `set` ούτε `delete`.
 * 🔒 Ο αναγνώστης είναι **εξάρτηση**: η κρίση (`judgeSupplierStanding`) ζει στον αναγνώστη και δεν ξαναγράφεται εδώ.
 *
 * **Layering**: καθαρή — πελάτης και διακομιστής. @module subapps/catalog/public/public-publication-condition
 */

import type { SupplierStanding } from '../types/supplier-verification';

/** Τι έμαθε ο αναγνώστης: ετυμηγορία, ή ότι δεν μπόρεσε να ρωτήσει. */
export type SupplierStandingRead = { readonly kind: 'known'; readonly standing: SupplierStanding } | { readonly kind: 'unknown' };

export type SupplierStandingReader = (companyId: string) => Promise<SupplierStandingRead>;

export type PublicationCondition = 'open' | 'closed' | 'unknown';

/** Οι δύο εκβάσεις που είναι γνώση: μόνο αυτές μετράνε ως «τι είδε τελευταία φορά η σάρωση». */
export type KnownPublicationCondition = Exclude<PublicationCondition, 'unknown'>;

export function publicationConditionOf(read: SupplierStandingRead): PublicationCondition {
  if (read.kind === 'unknown') return 'unknown';
  return read.standing.kind === 'verified' ? 'open' : 'closed';
}

/** Κλειστή εξ ορισμού: αναγνώστης που πετά είναι «δεν μπόρεσα να ρωτήσω», όχι «δεν εγκρίθηκε». */
export async function readPublicationCondition(companyId: string, read: SupplierStandingReader): Promise<PublicationCondition> {
  try {
    return publicationConditionOf(await read(companyId));
  } catch {
    return 'unknown';
  }
}

export type PublicModelAction = 'set' | 'delete' | 'defer';

/**
 * Το **ένα** σημείο όπου αποφασίζεται η μοίρα του εγγράφου. `set` μόνο με ανοιχτή συνθήκη **και** ορατό μοντέλο· χωρίς
 * έγκριση ή χωρίς ορατό SKU `delete`· χωρίς γνώση τίποτα.
 */
export function publicModelActionOf(condition: PublicationCondition, hasVisibleModel: boolean): PublicModelAction {
  if (condition === 'unknown') return 'defer';
  return condition === 'open' && hasVisibleModel ? 'set' : 'delete';
}

export interface ConditionMemory {
  /** Τι θυμάται η σάρωση μετά από αυτή την κρίση. */
  readonly seen: KnownPublicationCondition | null;
  /** Άλλαξε η γνώση, άρα πρέπει να ξαναπεράσει όλος ο κατάλογος. */
  readonly changed: boolean;
}

/**
 * 🔒 Το `unknown` δεν γράφεται ποτέ στη μνήμη: `open → unknown → closed` πρέπει να φτάσει σε delete, και
 * `open → unknown → open` σε καμία αλλαγή. Αν η βλάβη έσβηνε τη μνήμη, η ανάνηψη θα ήταν ψεύτικη μετάβαση.
 */
export function rememberCondition(previous: KnownPublicationCondition | null, current: PublicationCondition): ConditionMemory {
  if (current === 'unknown' || current === previous) return { seen: previous, changed: false };
  return { seen: current, changed: true };
}
