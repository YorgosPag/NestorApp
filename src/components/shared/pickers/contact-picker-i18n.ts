'use client';

// ⚠️ ΑΠΟ ΤΟ WRAPPER ΤΗΣ ΕΦΑΡΜΟΓΗΣ, ΟΧΙ ΑΠΟ ΤΟ ΩΜΟ `react-i18next`.
//
// 🔴 **ΑΥΤΟ ΔΕΝ ΘΕΡΑΠΕΥΕΙ ΤΑ ΩΜΑ ΚΛΕΙΔΙΑ — ΔΟΚΙΜΑΣΤΗΚΕ ΖΩΝΤΑΝΑ ΚΑΙ ΑΠΕΤΥΧΕ.**
// Κρατιέται επειδή είναι **αρχιτεκτονικά σωστότερο** (το wrapper καλεί
// `loadNamespace()` του ADR-752· το ωμό `react-i18next` δεν ξέρει τίποτα γι΄ αυτόν),
// αλλά η ΡΙΖΑ των `esco.badge`/`common.clear` στη σελίδα λογαριασμού παραμένει
// **ΑΓΝΩΣΤΗ**. Μην το διαβάσεις ως λυμένο.
//
// **Μετρημένο ζωντανά (2026-08-24, ADR-798)**: στη σελίδα `account/profile` το
// badge ταξινόμησης έβαφε **ωμό κλειδί** `esco.badge` και το κουμπί καθαρισμού
// `common.clear`. Τα κλειδιά **υπήρχαν** (`contacts.json:49`) και το namespace
// **δηλωνόταν** κανονικά εδώ — αυτό που έλειπε ήταν η **φόρτωση**: το ωμό
// `react-i18next` δεν ξέρει τίποτα για τον τεμπέλη φορτωτή του ADR-752, ενώ το
// `@/i18n/hooks/useTranslation` καλεί `loadNamespace()`. Στο CRM δούλευε επειδή
// η ίδια η σελίδα είχε **ήδη** φορτώσει τα `contacts*`· στη νέα θέση του picker
// (σελίδα λογαριασμού) **κανείς δεν τα φόρτωνε**.
//
// ⚠️ Καμία πύλη δεν μπορούσε να το πιάσει: τα CHECK 3.8/3.13/3.33/3.36 ρωτούν
// *«υπάρχει το κλειδί;»* — και **υπήρχε**. Το ερώτημα ήταν *«έφτασε;»*.
import { useTranslation } from '@/i18n/hooks/useTranslation';

/**
 * Shared i18n namespaces for contact-form pickers (ADR-601).
 * SSoT for the six-namespace `useTranslation([...])` call repeated by
 * EmployerPicker, EscoOccupationPicker and EscoSkillPicker.
 */
export const CONTACT_PICKER_NAMESPACES = [
  'contacts',
  'contacts-banking',
  'contacts-core',
  'contacts-form',
  'contacts-lifecycle',
  'contacts-relationships',
];

export function useContactPickerTranslation() {
  return useTranslation(CONTACT_PICKER_NAMESPACES);
}
