/**
 * ADR-336 — Το πεδία ενός υπογράφοντα, ΜΙΑ φορά.
 *
 * Κεντρικοποιήθηκε (N.0.2, CHECK 3.28): `signatory/types.ts` (client-safe) και
 * `commit-signatory-service.ts` (`server-only`) δήλωναν τα ίδια δέκα πεδία
 * ξεχωριστά, με το ίδιο σχόλιο *«mirrors»* να το ομολογεί. Αυτό το module δεν
 * εισάγει `server-only` — καθαρός τύπος, ασφαλής και για τους δύο.
 */

/** Τα πεδία ενός υπογράφοντα, πριν/κατά το commit. */
export interface SignatoryFieldSet {
  firstName: string;
  lastName: string;
  role: string | null;
  profession: string | null;
  /** ESCO occupation URI (set when picked from autocomplete, ADR-132) */
  escoUri: string | null;
  /** Cached ESCO label */
  escoLabel: string | null;
  /** ISCO-08 4-digit code */
  iscoCode: string | null;
  mobile: string | null;
  email: string | null;
  vatNumber: string | null;
}
