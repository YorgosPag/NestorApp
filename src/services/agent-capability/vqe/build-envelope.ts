/**
 * buildEnvelope() — η μοναδική πόρτα κατασκευής Verifiable Quantity Envelope
 *
 * **Pure function.** Μηδέν side effects, μηδέν I/O, μηδέν πρόσβαση σε δίκτυο ή
 * βάση. Η μόνη μη ντετερμινιστική είσοδος — το ρολόι — είναι **ενέσιμη**
 * (`computedAt`)· χωρίς αυτήν διαβάζεται το SSoT `nowISO()`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΔΗΛΩΝΕΙ Ο ΚΑΛΩΝ ΚΑΙ ΤΙ ΠΑΡΑΓΕΤΑΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο καλών δηλώνει **μόνο** ό,τι δεν προκύπτει από τα δεδομένα: την τιμή, τα
 * items που τη γέννησαν, τη δραστηριότητα, τις λοιπές εισόδους. Η βάση
 * μέτρησης, η διακυβέρνηση, η απόκλιση baseline και η ακεραιότητα **παράγονται**
 * από τα items. Είναι σκόπιμο: ό,τι δηλώνεται μπορεί να δηλωθεί λάθος.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΟΙ ΤΡΕΙΣ ΜΗ ΔΙΑΠΡΑΓΜΑΤΕΥΣΙΜΟΙ ΚΑΝΟΝΕΣ (ADR-734 §6.3)
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. `effectiveStatus` = η **χαμηλότερη** κατάσταση του συνόλου → `governance.ts`
 * 2. `inputsHash` από κανονικοποιημένες **εισόδους**, όχι από το αποτέλεσμα →
 *    `integrity.ts`
 * 3. Το `value` περνά **αυτούσιο**. Ο φάκελος τυλίγει, δεν μετασχηματίζει: εδώ
 *    δεν υπάρχει ούτε ένα σημείο που να αγγίζει το `input.value`.
 *
 * @module services/agent-capability/vqe/build-envelope
 * @see ADR-734 §6
 */

import type { BOQItem } from '@/types/boq';
import type {
  EnvelopeWarning,
  ProvenanceActivity,
  VerifiableQuantityEnvelope,
} from '@/types/vqe';
import { VQE_SCHEMA_VERSION } from '@/types/vqe';
import { nowISO } from '@/lib/date-local';
import { summarizeBaselineDrift } from './baseline-drift-summary';
import { resolveEngineVersion } from './engine-version';
import { buildGovernanceRecord } from './governance';
import { buildIntegrityRecord } from './integrity';
import { deriveMeasurementBasis } from './measurement-basis';
import { buildProvenanceRecord, scanSourceItems } from './provenance';

/** Είσοδοι κατασκευής φακέλου. */
export interface BuildEnvelopeInput<T> {
  /** Ό,τι επέστρεψε το service — περνά αυτούσιο στο `envelope.value`. */
  readonly value: T;
  /** Τα BOQ items που συνεισέφεραν. Κενός πίνακας επιτρέπεται (επισημαίνεται). */
  readonly sourceItems: readonly BOQItem[];
  /** Ποια συνάρτηση παρήγαγε την τιμή (PROV-O `prov:Activity`). */
  readonly computedBy: ProvenanceActivity;
  /**
   * Κάθε **άλλη** είσοδος του υπολογισμού πέρα από τα items — π.χ. ο `Map`
   * ονομάτων κατηγοριών, τα ακίνητα-στόχοι του επιμερισμού, τα φίλτρα
   * αναζήτησης. Μπαίνει στο preimage: παράλειψή της αποδυναμώνει το αποτύπωμα.
   */
  readonly params?: unknown;
  /** ICMS 3 κωδικός, όταν είναι γνωστός (Φάση 3). */
  readonly icmsCode?: string | null;
  /** Ένεση ρολογιού. Παράλειψη ⇒ `nowISO()`. */
  readonly computedAt?: string;
  /** Παράκαμψη έκδοσης μηχανής. Παράλειψη ⇒ `resolveEngineVersion()`. */
  readonly engineVersion?: string;
  /**
   * Προειδοποιήσεις που παρήγαγε ο ίδιος ο υπολογισμός — τυπικά οι
   * `AllocationWarning` του `allocateCost()`, τυλιγμένες με `allocationIssues()`.
   */
  readonly warnings?: readonly EnvelopeWarning[];
}

/**
 * Τυλίγει ένα ποσοτικό αποτέλεσμα σε Verifiable Quantity Envelope.
 *
 * @throws {TypeError} όταν το `params` δεν κανονικοποιείται (κύκλος, function,
 *   symbol). Προτιμάται η δυνατή αποτυχία από φάκελο με ψευδή απόδειξη.
 */
export function buildEnvelope<T>(input: BuildEnvelopeInput<T>): VerifiableQuantityEnvelope<T> {
  const items = input.sourceItems;
  const basis = deriveMeasurementBasis(items, input.icmsCode ?? null);
  const drift = summarizeBaselineDrift(items, basis.result.unit !== null);
  const governance = buildGovernanceRecord(items, drift.result);

  return {
    schemaVersion: VQE_SCHEMA_VERSION,
    value: input.value,
    basis: basis.result,
    provenance: buildProvenanceRecord({
      items,
      computedBy: input.computedBy,
      computedAt: input.computedAt ?? nowISO(),
      warnings: [
        ...scanSourceItems(items),
        ...basis.warnings,
        ...drift.warnings,
        ...governance.warnings,
        ...(input.warnings ?? []),
      ],
    }),
    governance: governance.result,
    integrity: buildIntegrityRecord({
      engineVersion: input.engineVersion ?? resolveEngineVersion(),
      computedBy: input.computedBy,
      sourceItems: items,
      params: input.params,
    }),
  };
}
