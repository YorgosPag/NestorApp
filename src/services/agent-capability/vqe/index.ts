/**
 * Verifiable Quantity Envelope — Barrel Exports (ADR-734 Φάση 1, στρώμα L1)
 *
 * Δημόσια επιφάνεια του στρώματος επαληθευσιμότητας. Το Capability Registry
 * (Φάση 2) και οι adapters (Φάση 3) καταναλώνουν **μόνο** από εδώ.
 *
 * @module services/agent-capability/vqe
 * @see ADR-734 §5.1 (τέσσερα στρώματα), §6 (VQE)
 */

// Κύρια πόρτα
export { buildEnvelope } from './build-envelope';
export type { BuildEnvelopeInput } from './build-envelope';

// Προσαρμογή προειδοποιήσεων υπολογισμού
export { allocationIssues, envelopeIssue } from './derived';
export type { Derived, IssueDetails } from './derived';

// Ακεραιότητα & έκδοση μηχανής
export { buildIntegrityRecord, computeInputsHash, VQE_PREIMAGE_VERSION } from './integrity';
export type { IntegrityInputs } from './integrity';
export { computeEngineFingerprint, resolveEngineVersion, VQE_ENGINE_SEMVER } from './engine-version';
export { sha256HexSync } from './hashing';
export { canonicalize } from './canonical-encoding';

// Επιμέρους παραγωγοί (χρήσιμοι σε στοχευμένα εργαλεία & σε tests)
export { deriveMeasurementBasis } from './measurement-basis';
export { buildGovernanceRecord } from './governance';
export { summarizeBaselineDrift } from './baseline-drift-summary';
export { buildProvenanceRecord, scanSourceItems } from './provenance';
export type { ProvenanceInputs } from './provenance';
export { compareCodeUnits, sortStringsCodeUnit, uniqueSortedStrings } from './ordering';
