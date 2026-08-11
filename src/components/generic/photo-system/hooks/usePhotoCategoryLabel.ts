'use client';

/**
 * =============================================================================
 * PHOTO SYSTEM — Η ετικέτα κατηγορίας, **μία φορά** (ADR-784 §10.4 · CHECK 3.28)
 * =============================================================================
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ:** το `PhotosTabBase` έγραφε τον **ίδιο** μεταφραστή ετικέτας δύο φορές —
 * μία στο `PhotosTabStats` και μία στο `PhotosTabCategories` — μαζί με το ίδιο `useTranslation`
 * των έξι namespaces. Το ονόμασε το **CHECK 3.28** (jscpd, ADR-584) όταν το αρχείο ακουμπήθηκε
 * για τη μετανάστευση του ADR-784 §10.
 *
 * ⚠️ **Η ερώτηση που απαντά είναι ΜΙΑ:** «η `label` της κατηγορίας είναι **κλειδί μετάφρασης**
 * ή είναι **ήδη κείμενο**;». Η διάκριση γίνεται από την τελεία — έτσι ήταν γραμμένη και στις
 * δύο αντιγραφές, και **δεν αλλάζει** εδώ: αυτή η εξαγωγή είναι μετακίνηση, όχι επανασχεδιασμός.
 *
 * @module components/generic/photo-system/hooks/usePhotoCategoryLabel
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';

/** Τα namespaces που κουβαλούν τις ετικέτες κατηγοριών φωτογραφιών. */
const PHOTO_LABEL_NAMESPACES = [
  'building',
  'building-address',
  'building-filters',
  'building-storage',
  'building-tabs',
  'building-timeline',
] as const;

/**
 * Επιστρέφει τον μεταφραστή ετικέτας κατηγορίας.
 *
 * Μια `label` **με τελεία** αντιμετωπίζεται ως κλειδί i18n· αν ο επιλυτής επιστρέψει το ίδιο το
 * κλειδί (δηλαδή δεν βρέθηκε), επιστρέφεται η αρχική τιμή — **ποτέ ωμό κλειδί στην οθόνη**.
 */
export function usePhotoCategoryLabel(): (label: string) => string {
  const { t } = useTranslation([...PHOTO_LABEL_NAMESPACES]);

  return (label: string): string => {
    if (label.includes('.')) {
      const translated = t(label);
      return translated === label ? label : translated;
    }
    return label;
  };
}
