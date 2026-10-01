/**
 * @fileoverview **Οι ενότητες κειμένου της σελίδας υπολογιστή** που εμφανίζονται **και** στην οθόνη **και** στο JSON-LD
 * (ADR-898 Φ2) — μία λίστα, ώστε το `FAQPage` να μην υπόσχεται ποτέ ερώτηση που η σελίδα δεν δείχνει.
 * @related `services/objective-value/objective-value-seo.ts` (JSON-LD) · `components/objective-value/ObjectiveValueFaq.tsx`
 * @module lib/objective-value/objective-value-page-sections
 *
 * 🔑 **Κανόνας της Google για τα δομημένα δεδομένα**: το περιεχόμενο του `FAQPage` πρέπει να είναι **ορατό** στη σελίδα.
 * Δύο λίστες (μία για την οθόνη, μία για το JSON-LD) θα απέκλιναν στην πρώτη προσθήκη ερώτησης.
 */

/** Κλειδιά κάτω από `objective-value:faq.<id>.{q,a}`, με τη σειρά εμφάνισης. */
export const OBJECTIVE_VALUE_FAQ = ['whatIs', 'zonePrice', 'commerciality', 'age', 'binding'] as const;

/** Κλειδιά κάτω από `objective-value:howTo.<id>` — τα βήματα του `HowTo`, ίδια σειρά με τις ενότητες της οθόνης. */
export const OBJECTIVE_VALUE_STEPS = ['location', 'property', 'questions', 'result'] as const;

/** Η σελίδα του myPROPERTY της ΑΑΔΕ, όπου οριστικοποιείται η φορολογητέα αξία (ADR-898 §6). */
export const AADE_MYPROPERTY_URL = 'https://www.aade.gr/myproperty';
