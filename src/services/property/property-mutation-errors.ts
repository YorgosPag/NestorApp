/**
 * Σφάλματα πολιτικής μετάλλαξης ακινήτου — **leaf module**.
 *
 * Βγήκαν από το `property-mutation-gateway.ts` (ADR-777 Α20) για **δύο** λόγους,
 * και ο δεύτερος είναι ο δεσμευτικός:
 *   1. N.7.1 — το gateway πέρασε τις 500 γραμμές·
 *   2. 🔴 **κύκλος**: το `property-offer-write-projection` χρειάζεται τη βασική
 *      κλάση, και το gateway χρειάζεται την προβολή. Ένα leaf module με **μόνο**
 *      τις κλάσεις σπάει τον κύκλο — ίδια κίνηση με το cycle-break του
 *      `enterprise-id.service` (2026-05-06), που είχε γεννήσει TDZ στο runtime.
 *
 * Καμία εξάρτηση από services/components. Το `property-mutation-gateway` τις
 * επανεξάγει, ώστε **κανένας υπάρχων καταναλωτής να μην αλλάξει import**.
 *
 * @module services/property/property-mutation-errors
 */

export class PropertyMutationPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PropertyMutationPolicyError';
  }
}

export class InvalidPropertyTypeError extends PropertyMutationPolicyError {
  constructor(rawValue: unknown) {
    super(`Invalid property type: ${String(rawValue)}. Must match a canonical PropertyType (see src/constants/property-types.ts).`);
    this.name = 'InvalidPropertyTypeError';
  }
}

export class InvalidCommercialStatusError extends PropertyMutationPolicyError {
  constructor(rawValue: unknown) {
    super(`Invalid commercial status: ${String(rawValue)}. Must match a canonical CommercialStatus (see src/constants/commercial-statuses.ts).`);
    this.name = 'InvalidCommercialStatusError';
  }
}
