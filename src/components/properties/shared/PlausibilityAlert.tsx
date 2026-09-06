'use client';

/**
 * @fileoverview **Η ΟΨΗ ΜΙΑΣ ΠΡΟΕΙΔΟΠΟΙΗΣΗΣ ΕΥΛΟΓΟΦΑΝΕΙΑΣ** — γραμμένη μία φορά.
 * @module components/properties/shared/PlausibilityAlert
 * @related constants/condition-plausibility · constants/finishes-plausibility · ADR-842 §7.6.12
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ΤΟ N.18 ΜΕ ΕΠΙΑΣΕ, ΚΑΙ ΕΙΧΕ ΔΙΚΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `ConditionPlausibilityWarning` και το `FinishesPlausibilityWarning` ήταν **ήδη**
 * σχεδόν δίδυμα· η εργασία του **ADR-842 §7.6.12** τα έκανε **ταυτόσημα** στο σημείο
 * που μετράει: και τα δύο υπολόγιζαν την ετικέτα του είδους με τις **ίδιες** τέσσερις
 * γραμμές και τύπωναν την **ίδια** κάρτα.
 *
 * Το `npm run jscpd:diff` (CHECK 3.28) το ανέφερε ως **δύο** κλώνους — 13 και 17
 * γραμμές. ⛔ **Η εύκολη έξοδος ήταν το `SKIP_JSCPD_DIFF=1`**· απορρίφθηκε: ο κανόνας
 * υπάρχει ακριβώς για *«κεντρικοποιείς το Α και γράφεις το Β ως δίδυμο»*, και εδώ ο
 * δίδυμος γεννήθηκε **μέσα στην ίδια δέσμευση**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙ ΜΟΙΡΑΖΕΤΑΙ, ΚΑΙ ΤΙ ΔΕΝ ΜΟΙΡΑΖΕΤΑΙ ΕΠΙΤΗΔΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Μοιράζεται | Μένει στον καθένα |
 * |---|---|
 * | Η **όψη** της κάρτας (χρώματα, εικονίδιο, δομή) | Ποιος **κριτής** τρέχει |
 * | Η **ετικέτα του είδους** από τον έναν πίνακα | Ποια **κλειδιά** αιτιολογίας υπάρχουν |
 * | Το «δεν ξέρω το είδος ⇒ κενή ετικέτα» | Ποιες **παράμετροι** μπαίνουν στο κείμενο |
 *
 * ⚠️ **Οι παράμετροι ΔΕΝ ενοποιούνται.** Η μία προειδοποίηση μιλά για θέρμανση και
 * ενεργειακή κλάση, η άλλη για φινιρίσματα και κατάσταση. Ένα κοινό `Record<string,
 * string>` θα ήταν «ένα πράγμα που κάνει δύο δουλειές» — ο καθένας συνθέτει το δικό
 * του κείμενο και δίνει εδώ **έτοιμο**.
 */

import { AlertTriangle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PROPERTY_TYPE_I18N_KEYS, type PropertyTypeCanonical } from '@/constants/property-types';
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn } from '@/lib/utils';

/** Η μετάφραση, όπως τη δίνει το `useTranslation` — χωρίς εξάρτηση από τον τύπο του. */
type Translate = (key: string, params?: Record<string, unknown>) => string;

/**
 * **Η ετικέτα του είδους, ή κενό όταν δεν το ξέρουμε.**
 *
 * 🔑 **Ο πίνακας είναι ΟΛΙΚΟΣ πάνω στην κανονική τιμή** (ADR-842 §7.6.12): μετά το
 * στένεμα των τύπων, το `assessment.propertyType` είναι `PropertyTypeCanonical | null`,
 * οπότε αρκεί **ένας** έλεγχος. Ήταν τρεις — `!== null` **και**
 * `in PROPERTY_TYPE_I18N_KEYS` **και** `as PropertyTypeCanonical` — και οι δύο τελευταίοι
 * υπήρχαν μόνο επειδή ο τύπος έλεγε `string`.
 *
 * ⚠️ **Κενή συμβολοσειρά και όχι «άγνωστο»**: η ετικέτα μπαίνει **μέσα** σε πρόταση
 * (`«ένα {type} χωρίς θέρμανση…»`). Ένα «άγνωστο» εκεί θα διάβαζε *«ένα άγνωστο χωρίς
 * θέρμανση»* — χειρότερο από τη σιωπή. Το *«ποιο είδος;»* το ρωτά η οθόνη του κατόχου,
 * όχι μια προειδοποίηση ευλογοφάνειας.
 */
export function plausibilityTypeLabel(
  t: Translate,
  propertyType: PropertyTypeCanonical | null,
): string {
  return propertyType === null ? '' : t(PROPERTY_TYPE_I18N_KEYS[propertyType]);
}

export interface PlausibilityAlertProps {
  /** Το i18n κλειδί του τίτλου — ο καθένας ξέρει τη δική του οικογένεια κλειδιών. */
  readonly titleKey: string;
  /** Το **έτοιμο** κείμενο· η σύνθεσή του ανήκει στον καταναλωτή (δες την κεφαλίδα). */
  readonly reasonText: string;
  readonly t: Translate;
  readonly className?: string;
}

/**
 * **Η κάρτα** — μη μπλοκάρουσα, προειδοποιητικού χρωματισμού, ίδια για κάθε κριτή.
 *
 * ⚠️ **ΠΟΤΕ δεν εμποδίζει την αποθήκευση.** Είναι *sanity check*: λέει στον άνθρωπο ότι
 * κάτι μοιάζει αντιφατικό, δεν αποφασίζει αντ' αυτού.
 */
export function PlausibilityAlert({
  titleKey,
  reasonText,
  t,
  className,
}: PlausibilityAlertProps) {
  const iconSizes = useIconSizes();

  return (
    <Alert
      className={cn(
        'border-[hsl(var(--text-warning))] bg-[hsl(var(--bg-warning))]/40 text-[hsl(var(--text-warning))]',
        className,
      )}
    >
      <AlertTriangle className={iconSizes.sm} />
      <AlertTitle>{t(titleKey)}</AlertTitle>
      <AlertDescription>{reasonText}</AlertDescription>
    </Alert>
  );
}
