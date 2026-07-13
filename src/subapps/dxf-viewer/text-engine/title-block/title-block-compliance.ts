/**
 * ADR-651 Φάση Ε (Απόφαση #4) — **έλεγχος πληρότητας πινακίδας** πριν την κατάθεση.
 *
 * Στην Ελλάδα μια πινακίδα χωρίς **Α.Μ. ΤΕΕ**, κλίμακα ή θέση έργου σημαίνει **απόρριψη από
 * την πολεοδομία**. Μέχρι τώρα το PDF έβγαινε σιωπηλά ελλιπές. Εδώ το σύστημα **λέει τι
 * λείπει** — και μόνο αυτό: **προειδοποίηση, ΠΟΤΕ μπλοκάρισμα** (ο μηχανικός αποφασίζει· ένα
 * πρόχειρο εκτυπώνεται ελεύθερα).
 *
 * **Rule-based, ΟΧΙ AI** (το AI compliance validation είναι §8 #5 — δεν το χρειάζεται αυτό).
 *
 * SSoT: η λίστα των υποχρεωτικών πεδίων **δεν γράφεται εδώ** — παράγεται από το
 * `PLACEHOLDER_REGISTRY` (`permitRequired`). Νέο πεδίο ⇒ μία απόφαση, ένα σημείο· καμία
 * χειρόγραφη λίστα που θα ξέφευγε. Οι **ετικέτες** των πεδίων είναι τα ήδη μεταφρασμένα
 * `labelI18nKey` του registry (μηδέν διπλά labels — N.11).
 *
 * Καθαρή συνάρτηση: κανένα I/O, καμία γνώση UI ⇒ την καλεί και ο διάλογος εκτύπωσης και,
 * αργότερα, ό,τι άλλο θέλει να ρωτήσει «είναι καταθέσιμο αυτό;».
 *
 * @see ../templates/resolver/variables.ts — το registry (SSoT των υποχρεωτικών πεδίων)
 * @see ../../ui/components/print/PrintOutputControls.tsx — ο καταναλωτής (προειδοποίηση)
 */

import { extractPlaceholders } from '../templates/extract-placeholders';
import { resolvePlaceholdersInString } from '../templates/resolver/resolver';
import type { PlaceholderScope } from '../templates/resolver/scope.types';
import {
  ALL_PLACEHOLDER_PATHS,
  PLACEHOLDER_REGISTRY,
  type PlaceholderPath,
} from '../templates/resolver/variables';
import type { TextTemplate } from '../templates/template.types';

/**
 * Τα de-facto υποχρεωτικά πεδία για κατάθεση (ΤΕΕ/πολεοδομία), **παραγόμενα από το registry**.
 */
export const PERMIT_REQUIRED_PATHS: readonly PlaceholderPath[] = Object.freeze(
  ALL_PLACEHOLDER_PATHS.filter((path) => PLACEHOLDER_REGISTRY[path].permitRequired),
);

/**
 * Τι ακριβώς λείπει — τα τρία σφάλματα είναι **διαφορετικά προβλήματα με διαφορετική λύση**:
 *  - `empty-value`: το πρότυπο έχει το πεδίο, αλλά η τιμή λείπει από τα δεδομένα
 *    (π.χ. δεν έχεις καταχωρήσει Α.Μ. ΤΕΕ στο προφίλ σου) ⇒ **συμπλήρωσε τα δεδομένα**.
 *  - `absent-field`: το ίδιο το πρότυπο δεν περιλαμβάνει καθόλου το πεδίο (π.χ. η «Απλή»
 *    πινακίδα δεν έχει Α.Μ. ΤΕΕ) ⇒ **άλλαξε πρότυπο** (π.χ. «Άδεια δόμησης»).
 *  - `no-stamp-image`: υπάρχει κελί σφραγίδας αλλά καμία ανεβασμένη εικόνα ⇒ θα τυπωθεί
 *    κενό για σφράγιση με το χέρι (Απόφαση #6γ — **νόμιμο**, γι' αυτό είναι απλή υπόδειξη).
 */
export type TitleBlockIssueKind = 'empty-value' | 'absent-field' | 'no-stamp-image';

export interface TitleBlockIssue {
  readonly kind: TitleBlockIssueKind;
  /** Το πεδίο που λείπει (απόν στο `no-stamp-image` — η σφραγίδα είναι εικόνα, όχι πεδίο). */
  readonly path?: PlaceholderPath;
  /** Η ήδη μεταφρασμένη ετικέτα του πεδίου (`textTemplates:placeholders.*`). */
  readonly labelI18nKey?: string;
}

export interface TitleBlockComplianceInput {
  /** Το ενεργό πρότυπο (ΑΛΥΤΟ — χρειαζόμαστε τα `{{tokens}}` για να δούμε τι περιλαμβάνει). */
  readonly template: TextTemplate;
  /** Το scope με το οποίο θα λυθεί (στην εκτύπωση: με την κλίμακα που ΟΝΤΩΣ τυπώνεται). */
  readonly scope: PlaceholderScope;
  /** Έχει το preset κελί σφραγίδας; (χωρίς κελί, δεν υπάρχει θέμα σφραγίδας.) */
  readonly withStampBox: boolean;
  /** Το URL της ανεβασμένης σφραγίδας — απόν/κενό ⇒ κενό κελί. */
  readonly stampImageUrl?: string;
}

/** Η λυμένη τιμή ενός placeholder· κενή συμβολοσειρά ⇒ «λείπει». */
function resolvedValue(path: PlaceholderPath, scope: PlaceholderScope): string {
  return resolvePlaceholdersInString(`{{${path}}}`, scope).trim();
}

/**
 * Τι λείπει από την πινακίδα για να είναι καταθέσιμη. Κενός πίνακας ⇒ πλήρης.
 *
 * Η σειρά είναι αυτή του registry (σταθερή, ντετερμινιστική) ώστε το UI να μη «χοροπηδά».
 */
export function validateTitleBlock(
  input: TitleBlockComplianceInput,
): readonly TitleBlockIssue[] {
  const declared = new Set(extractPlaceholders(input.template.content));
  const issues: TitleBlockIssue[] = [];

  for (const path of PERMIT_REQUIRED_PATHS) {
    const labelI18nKey = PLACEHOLDER_REGISTRY[path].labelI18nKey;
    if (!declared.has(path)) {
      issues.push({ kind: 'absent-field', path, labelI18nKey });
      continue;
    }
    if (!resolvedValue(path, input.scope)) {
      issues.push({ kind: 'empty-value', path, labelI18nKey });
    }
  }

  if (input.withStampBox && !input.stampImageUrl) {
    issues.push({ kind: 'no-stamp-image' });
  }

  return issues;
}

/** Τα i18n keys των πεδίων ενός είδους σφάλματος — ό,τι ακριβώς χρειάζεται το UI. */
export function issueLabelKeys(
  issues: readonly TitleBlockIssue[],
  kind: TitleBlockIssueKind,
): readonly string[] {
  return issues
    .filter((issue) => issue.kind === kind && issue.labelI18nKey)
    .map((issue) => issue.labelI18nKey as string);
}
