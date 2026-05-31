/**
 * ADR-396 v2 Φάση 6a/6b — Re-export barrel για το per-element `envelopeFunction`
 * tri-state SSoT.
 *
 * Η **κανονική θέση** του ορισμού είναι πλέον `bim/types/thermal-envelope-types.ts`
 * (neutral types SSoT), ώστε τόσο τα 3 contextual ribbon tabs (Φ6a) όσο και το
 * per-region panel του `ThermalEnvelopeDialog` (Φ6b) να μοιράζονται ΕΝΑ ορισμό
 * χωρίς το dialog να εξαρτάται από ribbon-bridge κώδικα (λάθος κατεύθυνση εξάρτησης).
 *
 * Διατηρείται αυτό το barrel ώστε οι υπάρχοντες ribbon imports (Φ6a — bridges,
 * wall-param-helpers, contextual tabs) να μένουν αμετάβλητοι (N.0.2/N.12).
 *
 * @see ../../../../bim/types/thermal-envelope-types
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3.1.7 §3.1.8
 */

export {
  ENVELOPE_FUNCTION_AUTO,
  ENVELOPE_FUNCTION_OPTIONS,
  readEnvelopeFunctionValue,
  parseEnvelopeFunctionValue,
} from '../../../../bim/types/thermal-envelope-types';
export type { EnvelopeFunctionOption } from '../../../../bim/types/thermal-envelope-types';
