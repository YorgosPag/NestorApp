/**
 * =============================================================================
 * ΤΑ ΟΝΟΜΑΤΑ ΤΟΥ ΔΡΩΝΤΑ — ο παρονομαστής κάθε «0» (ADR-822 §2.6)
 * =============================================================================
 *
 * Όταν ρωτάς *«τι έγραψε αυτή η ταυτότητα;»*, ρωτάς **ένα πεδίο**. Αν το πεδίο
 * λέγεται αλλιώς, η απάντηση είναι **`0`** — και μοιάζει ακριβώς με το `0` που
 * σημαίνει *«δεν έγραψε τίποτα»*.
 *
 * 🔴 **ΚΑΙ ΣΥΝΕΒΗ**: το handoff της 27/08 ρώτησε
 * `entity_audit_trail where userId == 'dev-admin'` → **0**. Το πεδίο λέγεται
 * **`performedBy`** (`src/types/audit-trail.ts:196`). Το `0` σήμαινε *«ρώτησα
 * λάθος»* — τέταρτη εμφάνιση του σχήματος N.11 / N.12 / N.18 / CHECK 3.18.
 *
 * ⚠️ **Η ΛΙΣΤΑ ΕΙΝΑΙ ΔΗΛΩΜΕΝΗ, ΑΛΛΑ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΠΑΛΙΩΣΕΙ ΣΙΩΠΗΛΑ.**
 * Την φυλάει άγκυρα που **ξανασαρώνει τους τύπους** και απαιτεί η λίστα να
 * είναι **υπερσύνολο** όσων υπάρχουν σήμερα
 * (`scripts/lib/identity-provenance/__tests__/actor-fields.test.ts`). Νέο όνομα
 * πεδίου δρώντα στο δέντρο ⇒ **κόκκινη** άγκυρα, όχι σιωπηλό `0`.
 *
 * @module scripts/lib/identity-provenance/actor-fields
 * @see ADR-822 §2.6 · §4.3
 */

/**
 * Κάθε όνομα πεδίου που **μπορεί** να κρατά uid δρώντα στο δέντρο — **49**,
 * μετρημένα 2026-08-27 σε `src/types` + `src/services` + `src/lib`.
 *
 * 🔴 **ΥΠΕΡ-ΣΥΜΠΕΡΙΛΗΠΤΙΚΗ, ΕΠΙΤΗΔΕΣ — ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ, ΟΧΙ ΑΠΡΟΣΕΞΙΑ.**
 * Μέσα εδώ υπάρχουν ονόματα που **δεν** είναι δρώντες: `betterBy`, `worseBy`
 * *(«κατά πόσο», όχι «από ποιον»)*, `sortBy`, `filterBy`. Μένουν, γιατί η
 * **ασυμμετρία του κόστους** ορίζει την κατεύθυνση του σφάλματος:
 *
 * | σφάλμα | κόστος |
 * |---|---|
 * | όνομα **παραπάνω** | **μηδέν** — το `fieldsPresentIn()` το κλαδεύει στον χρόνο εκτέλεσης· ένα πεδίο που δεν υπάρχει στα δείγματα **δεν ρωτιέται ποτέ** |
 * | όνομα που **λείπει** | 🔴 μια συλλογή που δεν ρωτήθηκε ⇒ **σιωπηλό «0»** ⇒ «καθαρό» που σημαίνει «δεν κοίταξα» |
 *
 * 📏 **Οι πυκνότεροι** *(δηλώσεις στους τύπους)*: `createdBy` 227 · `userId` 225 ·
 * `uid` 143 · `updatedBy` 102 · `performedBy` 65 · `approvedBy` 37 ·
 * `assignedTo` 30 · `deletedBy` 16 · `actorId` 15 · `changedBy` 13.
 *
 * ⚠️ **Αλφαβητικά, χωρίς διπλότυπα** — το φυλάει η άγκυρα, ώστε δύο άνθρωποι να
 * μη μπορούν να προσθέσουν το ίδιο όνομα σε δύο θέσεις.
 */
export const ACTOR_FIELD_NAMES: readonly string[] = [
  '_createdBy',
  '_lastModifiedBy',
  'actorId',
  'addedBy',
  'approvedBy',
  'archivedBy',
  'assignedBy',
  'assignedTo',
  'authorId',
  'betterBy',
  'byUser',
  'calibratedBy',
  'changedBy',
  'classifiedBy',
  'closedBy',
  'completedBy',
  'constructedBy',
  'createdBy',
  'decidedBy',
  'deletedBy',
  'dismissedBy',
  'drawnBy',
  'filterBy',
  'handledBy',
  'holdPlacedBy',
  'initiatedBy',
  'issuedBy',
  'lastModifiedBy',
  'overriddenBy',
  'performedBy',
  'poweredBy',
  'referredBy',
  'registeredBy',
  'replacedBy',
  'requestedBy',
  'resolvedBy',
  'restoredBy',
  'revokedBy',
  'senderId',
  'skippedBy',
  'sortBy',
  'trashedBy',
  'triggeredBy',
  'uid',
  'updatedBy',
  'uploadedBy',
  'userId',
  'verifiedBy',
  'worseBy',
] as const;
