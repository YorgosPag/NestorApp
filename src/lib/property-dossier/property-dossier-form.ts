/**
 * @fileoverview **Η φόρμα του φακέλου** — γέννηση **και** μετονομασία, ένας κριτής με την πόρτα.
 * @related ADR-866 Φ1.2 · §2.9.1 Α5 · §2.9.8 Δ1 · lib/forms/draft-validation.ts · types/property-dossier.ts
 * @module lib/property-dossier/property-dossier-form
 *
 * 🔑 **Κανένας νέος μηχανισμός φόρμας**: η εικόνα υπολογίζεται από το **κοινό** `validateDraftForm` (ίδιο με
 * ζήτηση και αγγελία), και ο κριτής εγκυρότητας είναι η **ίδια** συνάρτηση που τρέχει η πόρτα
 * (`propertyDossierInvariantViolations`). Η φόρμα **δεν** έχει δικό της κανόνα για το όνομα — αν είχε, θα
 * απέκλινε από τον γραφέα στην πρώτη αλλαγή και ο άνθρωπος θα έβλεπε «αποθηκεύτηκε…» και μετά άρνηση.
 *
 * ⚠️ **Κανένα εμπόδιο (`blockers`)**: το είδος είναι **προαιρετικό** (`null` = «δεν το είπε ακόμη») — ο φάκελος
 * για «τα χαρτιά του σπιτιού της γιαγιάς» υπάρχει πριν ο άνθρωπος αποφασίσει αν είναι μονοκατοικία ή μεζονέτα.
 *
 * **Layering**: leaf — zod + καθαρές συναρτήσεις, καμία εξάρτηση από React.
 */

import { z } from 'zod';

import { isCanonicalPropertyType } from '@/constants/property-types';
import { validateDraftForm, type DraftFormValidation } from '@/lib/forms/draft-validation';
import {
  propertyDossierInvariantViolations,
  type PropertyDossier,
  type PropertyDossierDraft,
  type PropertyDossierInvariant,
} from '@/types/property-dossier';

/** Οι τιμές της φόρμας — `type: ''` ⇒ «κανένα είδος» (ό,τι δίνει ένα ανεπίλεκτο πεδίο επιλογής). */
export interface PropertyDossierFormValues {
  readonly label: string;
  readonly type: string;
}

/** Η φόρμα δεν έχει εμπόδια — ο τύπος υπάρχει για τη γενική μηχανή, ως **κενό** σύνολο. */
type NoBlocker = never;

export type PropertyDossierFormValidation = DraftFormValidation<
  PropertyDossierDraft,
  NoBlocker,
  PropertyDossierInvariant
>;

const propertyDossierFormSchema = z.object({ label: z.string(), type: z.string() });

/** Κενή φόρμα γέννησης. */
export const EMPTY_PROPERTY_DOSSIER_FORM: PropertyDossierFormValues = { label: '', type: '' };

/** Φόρμα μετονομασίας — ξεκινά από ό,τι **είναι** ο φάκελος. */
export function propertyDossierFormFrom(dossier: Pick<PropertyDossier, 'label' | 'type'>): PropertyDossierFormValues {
  return { label: dossier.label, type: dossier.type ?? '' };
}

/** Τιμές → προσχέδιο: άγνωστο/κενό είδος ⇒ `null`, **ποτέ** ωμή συμβολοσειρά προς την πόρτα. */
function draftOf(values: z.infer<typeof propertyDossierFormSchema>): PropertyDossierDraft {
  return { label: values.label, type: isCanonicalPropertyType(values.type) ? values.type : null };
}

/** **Τιμές φόρμας → μπορεί να σταλεί;** — η πλήρης εικόνα, συνεχώς (ADR-777 Α14 §17.2). */
export function validatePropertyDossierForm(values: PropertyDossierFormValues): PropertyDossierFormValidation {
  return validateDraftForm(values, {
    schema: propertyDossierFormSchema,
    blockersOf: (): readonly NoBlocker[] => [],
    draftOf,
    violationsOf: propertyDossierInvariantViolations,
  });
}
