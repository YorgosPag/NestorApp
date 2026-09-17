/**
 * 📒 **ΣΕ ΠΟΙΟΥ ΤΟ ΒΙΒΛΙΟ ΓΡΑΦΕΤΑΙ ΜΙΑ ΕΓΓΡΑΦΗ ΙΣΤΟΡΙΚΟΥ** — ADR-195 §«Προσωπικό βιβλίο» · ADR-864 Φ1β
 *
 * Ως τις 2026-09-16 κάθε εγγραφή του `entity_audit_trail` έφερε **υποχρεωτικά** `companyId`, και
 * μόνο διαχειριστής εταιρείας τη διάβαζε. Ο ιδιώτης χωρίς εταιρεία (ADR-864 Ε-1) **δεν μπορούσε
 * να έχει ίχνος** — ούτε για την απόσυρση της αγγελίας του.
 *
 * 🔑 **Το «σε ποιον ανήκει» ΔΕΝ ζει πια εδώ** (ADR-866 §5.2, 2026-09-17): η ένωση
 * `{ companyId } | { userId }`, η μετάφραση από `WorkspaceRef`, το σύνορο ανάγνωσης και ο φρουρός
 * γραφής είναι **κοινά** με τα αρχεία, στο `lib/workspace/custody-scope.ts`. Εδώ μένει **μόνο**
 * ό,τι είναι του ιστορικού: **πού** ζει κάθε βιβλίο και **πώς** λέγεται η παράμετρος.
 *
 * ⚠️ Τα ονόματα `auditLedger*` μένουν ως **ψευδώνυμα**, όχι αντίγραφα — οι καλούντες του ιστορικού
 * διαβάζουν τη γλώσσα του τομέα τους, και **μία** υλοποίηση απαντά.
 *
 * **Layering**: leaf — κανένα `server-only`, καμία ανάγνωση. Το εισάγουν διακομιστής και πελάτης.
 *
 * @module lib/audit/audit-ledger
 */

import {
  CUSTODY_KINDS,
  custodyKindFromParam,
  custodyKindOf,
  custodyKindOfScope,
  custodyScopeFromData,
  custodyScopeOf,
  isWritableCustodyScope,
  type CustodyKind,
  type CustodyPartition,
  type CustodyScope,
} from '@/lib/workspace/custody-scope';

/**
 * Η εμβέλεια μιας εγγραφής ιστορικού — **ακριβώς μία**: βιβλίο **εταιρείας** `{ companyId }` ή
 * **προσωπικό** βιβλίο `{ userId }`, που το διαβάζει μόνο ο άνθρωπος.
 */
export type AuditLedgerScope = CustodyScope;

/** **Ποιο βιβλίο ζητά ο αναγνώστης** — ως **είδος**, χωρίς ταυτότητα (ποτέ `userId` στο σύρμα). */
export type AuditLedgerKind = CustodyKind;

/** Τα δύο βιβλία, με σταθερή σειρά (το incremental backup τα σαρώνει **και τα δύο**). */
export const AUDIT_LEDGER_KINDS = CUSTODY_KINDS;

/**
 * **Πού ζει κάθε βιβλίο** — η **μία** δήλωση διαμερίσματος. Γραφέας, διαδρομή ανάγνωσης, πελάτης
 * και backup ρωτούν **εδώ**· κανείς δεν γράφει όνομα συλλογής ιστορικού με το χέρι.
 */
export const AUDIT_LEDGER_COLLECTION = {
  company: 'ENTITY_AUDIT_TRAIL',
  personal: 'ENTITY_AUDIT_TRAIL_PERSONAL',
} as const satisfies CustodyPartition;

/** Το όνομα της παραμέτρου στο σύρμα — **ένα**, για πελάτη και διακομιστή. */
export const AUDIT_LEDGER_PARAM = 'ledger';

/** **Η ΜΙΑ μετάφραση** χώρου → βιβλίου. */
export const auditLedgerScopeOf = custodyScopeOf;

/** Το βιβλίο μιας εμβέλειας εγγραφής. */
export const auditLedgerKindOfScope = custodyKindOfScope;

/** Το είδος βιβλίου ενός χώρου — ο πελάτης το παράγει από τη θεματοφυλακή της οντότητας. */
export const auditLedgerKindOf = custodyKindOf;

/** Ερμηνεία της παραμέτρου — απουσία ⇒ `company`· άγνωστη τιμή ⇒ `null` (fail closed). */
export const auditLedgerKindFromParam = custodyKindFromParam;

/** **Το σύνορο ανάγνωσης** — `null` όταν η εγγραφή δεν έχει **ακριβώς μία** εμβέλεια. */
export const auditLedgerScopeFromData = custodyScopeFromData;

/** **Έγκυρη εμβέλεια για γραφή;** — ο φρουρός του γραφέα. */
export const isWritableAuditLedgerScope = isWritableCustodyScope;
