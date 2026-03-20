/**
 * @fileoverview Greek KAD (Activity Codes) -- NACE Rev.2
 * @description Auto-generated from forin.gr API. 10521 codes loaded from JSON.
 * @generated 2026-03-06
 * @see ADR-ACC-013 Searchable DOY + KAD Dropdowns
 */

import kadData from './greek-kad-codes.json';

export interface KadCode {
  /** KAD code (e.g. "41.20.20") */
  code: string;
  /** Greek description */
  description: string;
}

export const GREEK_KAD_CODES: KadCode[] = kadData;
