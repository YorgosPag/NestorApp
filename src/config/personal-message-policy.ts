/**
 * @fileoverview **Το όριο του προσωπικού σημειώματος — ΕΝΑΣ αριθμός, για browser ΚΑΙ server.**
 * @module config/personal-message-policy
 *
 * Ζούσε μόνο μέσα στο `components/sharing/fields/PersonalMessageField.tsx` (`'use client'`). Ένας
 * server module δεν μπορεί να διαβάσει τιμή από `'use client'` αρχείο (γίνεται client reference, όχι
 * αριθμός), άρα κάθε zod θα έγραφε ξανά το `500` με το χέρι. Εδώ: καθαρή σταθερά, χωρίς εξαρτήσεις.
 */

/** Μέγιστο μήκος (χαρακτήρες) του προσωπικού σημειώματος σε email — πεδίο UI και zod του server. */
export const MAX_PERSONAL_MESSAGE_LENGTH = 500;
