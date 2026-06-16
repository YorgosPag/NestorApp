/**
 * Footing design engine — orchestrator (ADR-464, Slice 1).
 *
 * ΕΝΑ σημείο εισόδου που συνθέτει το πλήρες `FootingDesignResult` από το
 * `FootingDesignInput` (γεωμετρία + φορτία + έδαφος + υλικά). Slice 1 = `bearing`
 * (EC7)· `flexure` (Slice 2) + `punching` (Slice 3) προστίθενται additive.
 *
 * Pure, DERIVED — οι consumers (diagnostics, UI readouts) καλούν ΑΥΤΟ, ποτέ τους
 * επιμέρους υπολογισμούς απευθείας (SSoT).
 *
 * @see ./footing-bearing.ts
 * @see ./footing-design-types.ts
 */

import { computeFootingBearing } from './footing-bearing';
import type { FootingDesignInput, FootingDesignResult } from './footing-design-types';

/** Συνθέτει το αποτέλεσμα σχεδιασμού πεδίλου από την είσοδο (DERIVED). */
export function computeFootingDesign(input: FootingDesignInput): FootingDesignResult {
  return {
    bearing: computeFootingBearing(input),
  };
}
