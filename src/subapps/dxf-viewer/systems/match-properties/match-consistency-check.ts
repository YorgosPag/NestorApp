/**
 * ADR-581 — Consistency check (ντετερμινιστικός, ΜΗ-blocking).
 *
 * Πριν το apply, τρέχει ελαφριές σημασιολογικές επικυρώσεις πάνω στο υποψήφιο
 * params patch και επιστρέφει προειδοποιήσεις (ΟΧΙ σφάλματα — το Apply μένει ενεργό).
 * Η βαθιά επικύρωση κανονισμού (dry-run validators ανά τύπο) προστίθεται σε επόμενη
 * φάση· εδώ οι κανόνες που δεν χρειάζονται τους per-type validators.
 */

import type { EntityType } from '../../types/entities';
import type { SceneEntity } from '../../core/commands/interfaces';

export interface MatchWarning {
  /** Σταθερός κωδικός για programmatic handling/tests. */
  readonly code: string;
  /** i18n key για εμφάνιση στο dialog. */
  readonly messageKey: string;
  readonly targetId: string;
}

/** Τύποι όπου το «ξύλο» ως δομικό υλικό είναι σημασιολογικά ασύμβατο (RC/χάλυβας). */
const STRUCTURAL_RC_TYPES: ReadonlySet<EntityType> = new Set<EntityType>([
  'column', 'beam', 'foundation', 'slab',
]);

/**
 * Ελέγχει ένα υποψήφιο params patch για έναν target. Επιστρέφει προειδοποιήσεις.
 */
export function checkConsistency(
  source: SceneEntity,
  target: SceneEntity,
  paramsPatch: Readonly<Record<string, unknown>>,
): readonly MatchWarning[] {
  const warnings: MatchWarning[] = [];
  const targetType = target.type as EntityType;

  // Ασύμβατο δομικό υλικό: ξύλο σε RC δομικό μέλος.
  if (paramsPatch.material === 'wood' && STRUCTURAL_RC_TYPES.has(targetType)) {
    warnings.push({
      code: 'material-incompatible-structural',
      messageKey: 'matchProperties.warnings.materialIncompatibleStructural',
      targetId: target.id,
    });
  }

  // Cross-type μεταφορά δομικού υλικού ανάμεσα σε διαφορετικές κατηγορίες → ενημέρωση.
  if (
    source.type !== target.type &&
    'material' in paramsPatch &&
    STRUCTURAL_RC_TYPES.has(source.type as EntityType) !== STRUCTURAL_RC_TYPES.has(targetType)
  ) {
    warnings.push({
      code: 'material-cross-category',
      messageKey: 'matchProperties.warnings.materialCrossCategory',
      targetId: target.id,
    });
  }

  return warnings;
}
