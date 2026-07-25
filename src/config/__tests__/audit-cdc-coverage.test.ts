/**
 * ADR-195 Phase 3 — guard για τη σίγαση του service-side audit writer.
 *
 * Δύο αντίθετοι κίνδυνοι, και οι δύο σοβαροί:
 *   1. ΔΕΝ σιγάσει όπου πρέπει → διπλότυπες εγγραφές `soft_deleted`/`restored`
 *      για τις επαφές (το bug που διορθώθηκε).
 *   2. Σιγάσει όπου ΔΕΝ πρέπει → **σιωπηλή απώλεια ιστορικού**: είτε για οντότητες
 *      χωρίς CDC trigger (buildings, properties, projects, …), είτε — χειρότερα —
 *      για το `deleted`, όπου η service εγγραφή είναι ο ΜΟΝΑΔΙΚΟΣ φορέας των
 *      `_snapshot` / `_cascade_deletions` / `_storage_cleanup`.
 *
 * Αυτό το test κλειδώνει και τις δύο κατευθύνσεις.
 */

import {
  CDC_COVERED_ENTITY_TYPES,
  CDC_EQUIVALENT_ACTIONS,
  isCdcAuditDuplicate,
} from '../audit-cdc-coverage';

/**
 * Οντότητες που περνούν από τον κοινό `soft-delete-engine` αλλά **δεν** έχουν
 * Firestore audit trigger. Για αυτές ο service writer είναι ο μόνος καταγραφέας.
 */
const ENTITIES_WITHOUT_CDC = [
  'building', 'property', 'project', 'parking', 'storage',
] as const;

describe('CDC audit coverage — SSoT', () => {
  it('μόνο οι επαφές έχουν CDC trigger σήμερα', () => {
    expect(CDC_COVERED_ENTITY_TYPES.has('contact')).toBe(true);
    expect(CDC_COVERED_ENTITY_TYPES.size).toBe(1);
  });

  it('σιγάζει το soft_deleted/restored των επαφών (το διπλότυπο)', () => {
    expect(isCdcAuditDuplicate('contact', 'soft_deleted')).toBe(true);
    expect(isCdcAuditDuplicate('contact', 'restored')).toBe(true);
  });

  it('ΠΟΤΕ δεν σιγάζει το hard delete — εκεί ζει το forensic snapshot', () => {
    expect(CDC_EQUIVALENT_ACTIONS.has('deleted')).toBe(false);
    expect(isCdcAuditDuplicate('contact', 'deleted')).toBe(false);
  });

  it('δεν σιγάζει οντότητες χωρίς CDC trigger (αλλιώς χάνεται το ιστορικό τους)', () => {
    for (const entityType of ENTITIES_WITHOUT_CDC) {
      expect(isCdcAuditDuplicate(entityType, 'soft_deleted')).toBe(false);
      expect(isCdcAuditDuplicate(entityType, 'restored')).toBe(false);
      expect(isCdcAuditDuplicate(entityType, 'deleted')).toBe(false);
    }
  });

  it('άγνωστος entityType δεν σιγάζεται ποτέ (fail-safe προς την καταγραφή)', () => {
    expect(isCdcAuditDuplicate('totally-unknown-entity', 'soft_deleted')).toBe(false);
  });
});
