/**
 * @fileoverview **Οι κεφαλίδες κάθε πόρτας που δίνει κανάλι σε ανώνυμο** (ADR-841 §7 Α21.16 · Α21.17).
 * @related app/api/pro/[companyId]/locations/[locationId]/{channels,vcard}/route.ts
 * @module app/api/pro/private-response-headers
 *
 * 🔴 **Γραμμένες μία φορά, γιατί η απόκλιση εδώ είναι διαρροή**: αν η vCard ξεχνούσε το `no-store`, ένα cache
 * ενδιάμεσου θα σέρβιρε τους αριθμούς **χωρίς** να περάσει από το όριο — και η εμφάνιση θα έμενε
 * προστατευμένη μόνο στα χαρτιά. Το `noindex` κρατά τις απαντήσεις έξω από κάθε ευρετήριο.
 */

export const PRIVATE_CHANNEL_HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } as const;
