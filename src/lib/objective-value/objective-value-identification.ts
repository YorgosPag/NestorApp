/**
 * @fileoverview **Η ταυτοποίηση του ακινήτου στο PDF πληροφοριακού υπολογισμού** — περιγραφή + ΚΑΕΚ, καθαρές
 *               συναρτήσεις χωρίς React (ADR-947 §11 Δ-Φ2β.2).
 * @module lib/objective-value/objective-value-identification
 * @related lib/geo/kaek.ts (ο ΕΝΑΣ κανόνας του ΚΑΕΚ) · utils/greek-text.ts (η ΜΙΑ μεταγραφή) ·
 *   components/objective-value/ObjectiveValuePdfIdentification.tsx (τα πεδία) ·
 *   services/pdf/renderers/objective-value/objective-value-pdf-view.ts (η ενότητα «Ακίνητο»)
 *
 * 🏆 **Πρότυπο RICS + Idealista/Casafari**: η έκθεση αποτίμησης ταυτοποιεί το ακίνητο με **περιγραφή + διεύθυνση +
 *    επίσημο κωδικό κτηματολογίου**. Ο ελληνικός κωδικός είναι ο **ΚΑΕΚ** — επικυρώνεται και κανονικοποιείται **μόνο** από
 *    το `lib/geo/kaek`, ποτέ δεύτερο regex εδώ.
 * 🔑 **Μόνο στη συσκευή**: τα πεδία ζουν σε κατάσταση React και τυπώνονται στο PDF· δεν αποθηκεύονται, δεν φεύγουν.
 * 🔑 **Πέρα από τους μεγάλους**: η περιγραφή γίνεται και **όνομα αρχείου** (δέκα PDF στις Λήψεις ξεχωρίζουν) και
 *    **μεταδεδομένα** (η αναζήτηση του λειτουργικού βρίσκει το αρχείο γράφοντας τη διεύθυνση).
 * ⚠️ **ΟΧΙ ΑΤΑΚ**: η μορφή του δεν επιβεβαιώθηκε από επίσημη πηγή και ο κώδικας τον αποκλείει ρητά για ελαχιστοποίηση
 *    (`lib/document-validity/e9-text.ts`). Μπαίνει μόνο με επιβεβαιωμένη μορφή.
 */

import { canonicalKaek } from '@/lib/geo/kaek';
import { transliterateGreekToLatin } from '@/utils/greek-text';

/** Ό,τι πληκτρολόγησε ο άνθρωπος — **ωμό**, όπως στο πεδίο. */
export interface ObjectiveValueIdentificationDraft {
  readonly description: string;
  readonly kaek: string;
}

/** Ό,τι **τυπώνεται** — καθαρισμένο· `null` = δεν δόθηκε (ή, για τον ΚΑΕΚ, δεν είναι έγκυρος). */
export interface ObjectiveValueIdentification {
  readonly description: string | null;
  /** Κανονική μορφή με καθέτους (`050681726003/0/1`). */
  readonly kaek: string | null;
}

export const EMPTY_IDENTIFICATION_DRAFT: ObjectiveValueIdentificationDraft = { description: '', kaek: '' };

/** Μήκος περιγραφής — μία γραμμή στο PDF, όχι παράγραφος. */
export const IDENTIFICATION_DESCRIPTION_MAX_LENGTH = 120;

/** Μέγιστο μήκος του τμήματος περιγραφής στο όνομα αρχείου. */
const FILE_SLUG_MAX_LENGTH = 60;

/** Η κατάσταση του πεδίου ΚΑΕΚ — `invalid` μόνο όταν γράφτηκε κάτι που **δεν** είναι ΚΑΕΚ. */
export type KaekFieldState =
  | { readonly kind: 'empty' }
  | { readonly kind: 'valid'; readonly canonical: string }
  | { readonly kind: 'invalid' };

export function kaekFieldState(raw: string): KaekFieldState {
  if (raw.trim() === '') return { kind: 'empty' };
  const canonical = canonicalKaek(raw);
  return canonical === null ? { kind: 'invalid' } : { kind: 'valid', canonical };
}

/** **Πρόχειρο → ό,τι τυπώνεται.** Άκυρος ΚΑΕΚ δεν τυπώνεται ποτέ — το πεδίο το λέει στον άνθρωπο. */
export function resolveIdentification(draft: ObjectiveValueIdentificationDraft): ObjectiveValueIdentification {
  const description = draft.description.trim().replace(/\s+/g, ' ');
  const kaek = kaekFieldState(draft.kaek);
  return {
    description: description === '' ? null : description.slice(0, IDENTIFICATION_DESCRIPTION_MAX_LENGTH),
    kaek: kaek.kind === 'valid' ? kaek.canonical : null,
  };
}

/** Η περιγραφή ως τμήμα ονόματος αρχείου — λατινικά, πεζά, παύλες (`diamerisma-a2-egnatias-147`)· `null` ⇒ τίποτα. */
export function identificationFileSlug(identification: ObjectiveValueIdentification): string | null {
  if (identification.description === null) return null;
  const slug = transliterateGreekToLatin(identification.description)
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, FILE_SLUG_MAX_LENGTH)
    .replace(/^-+|-+$/g, '');
  return slug === '' ? null : slug;
}
