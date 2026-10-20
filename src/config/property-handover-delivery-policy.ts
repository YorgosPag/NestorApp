/**
 * @fileoverview **Η πολιτική της αντιγραφής αρχείων στον φάκελο του αγοραστή** — πόσα ανά εκτέλεση, πόσος χρόνος
 * (ADR-916 Φ-Γ1).
 * @related lib/property-handover/handover-delivery-plan.ts (ο προϋπολογισμός εφαρμόζεται εκεί) ·
 *          server/property-handover-delivery (ο εκτελεστής) · config/cron-schedule.ts (`property-handover-delivery`)
 * @module config/property-handover-delivery-policy
 *
 * 🔑 **Γιατί προϋπολογισμός και όχι «όλα μαζί»**: ο φάκελος ενός σπιτιού μπορεί να έχει εκατοντάδες αρχεία (σχέδια,
 * φωτογραφίες εργοταξίου, εγχειρίδια). Το ίδιο αίτημα που ολοκληρώνει μια πώληση ή μια αποδοχή **δεν** κρατιέται όσο
 * γίνονται εκατοντάδες GCS rewrite — παραδίδει ένα πρώτο κομμάτι και το cron συνεχίζει **από όπου σταμάτησε**
 * (ντετερμινιστικά αντίγραφα ⇒ καμία κατάσταση εργασίας να χαθεί). Πρότυπο: Google Takeout / Drive transfer —
 * εργασία στο παρασκήνιο, ορατή πρόοδος, ποτέ ένα αίτημα που κρέμεται.
 *
 * **Layering**: leaf — σταθερές.
 */

/** Αρχεία ανά εκτέλεση **μέσα** σε αίτημα (αποδοχή · ολοκλήρωση · δίχτυ) — αρκετά για τα βασικά, ποτέ αίτημα που κρέμεται. */
export const HANDOVER_DELIVERY_INLINE_FILE_BUDGET = 25;

/** Αρχεία ανά παράδοση σε **μία** εκτέλεση του cron — ώστε μία μεγάλη παράδοση να μη στερεί χρόνο από τις υπόλοιπες. */
export const HANDOVER_DELIVERY_CRON_FILE_BUDGET = 200;

/** Παραδόσεις ανά εκτέλεση του cron — όσες δεν χωρέσουν περιμένουν την επόμενη (15′). */
export const HANDOVER_DELIVERY_CRON_HANDOVER_LIMIT = 50;

/**
 * Η προθεσμία της εκτέλεσης του cron — **240s** από τα 300 του `maxDuration`: ο εκτελεστής δεν ξεκινά νέο αρχείο μετά
 * από αυτήν, ώστε η γραμμή προόδου να γράφεται **πάντα** πριν κοπεί η διαδρομή.
 */
export const HANDOVER_DELIVERY_CRON_DEADLINE_MS = 240_000;

/** Πόσα βήματα πίσω ακολουθείται η αλυσίδα αναθεωρήσεων μιας πηγής (A → B → C) για το `revisionOfFileId`. */
export const HANDOVER_DELIVERY_REVISION_CHAIN_LIMIT = 8;
