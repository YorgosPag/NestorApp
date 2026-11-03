/**
 * ADR-928 §5.1 — οι ταυτότητες του συμφωνητικού υπεργολαβίας.
 *
 * - **ιδεμποτησία** των ντετερμινιστικών (ίδια είσοδος ⇒ ίδιο id) — μετάλλαξη: `generateId` αντί `mintDeterministicV4Id`
 * - **διάκριση** (άλλος χώρος / άλλη έκδοση ⇒ άλλο id) — μετάλλαξη: σπόρος χωρίς ένα από τα μέρη του
 * - **τυχαιότητα** όπου δεν υπάρχει φυσικό κλειδί — μετάλλαξη: ντετερμινιστικό συμφωνητικό
 * Το χρυσό id διαχρονικά το φυλά το συμβόλαιο της κλάσης (`enterprise-id.service.test.ts`).
 */

import { EnterpriseIdService } from '../enterprise-id.service';
import { isValidEnterpriseId } from '../enterprise-id-parse';

describe('ADR-928 subcontract id generators', () => {
  const service = new EnterpriseIdService({ enableLogging: false, enableCache: false, cacheSize: 0 });

  it('agreement and assignment ids are random, prefixed and valid', () => {
    const agreement = service.generateSubcontractAgreementId();
    expect(agreement).toMatch(/^sca_/);
    expect(isValidEnterpriseId(agreement)).toBe(true);
    expect(service.generateSubcontractAgreementId()).not.toBe(agreement);

    const assignment = service.generateSubcontractAssignmentId();
    expect(assignment).toMatch(/^scas_/);
    expect(service.generateSubcontractAssignmentId()).not.toBe(assignment);
  });

  it('revision id is deterministic per (agreement, number) — two concurrent issues mint ONE revision', () => {
    const first = service.generateDeterministicSubcontractRevisionId('sca_1', 1);
    expect(first).toBe(service.generateDeterministicSubcontractRevisionId('sca_1', 1));
    expect(first).toMatch(/^scrv_/);
    expect(isValidEnterpriseId(first)).toBe(true);
    expect(service.generateDeterministicSubcontractRevisionId('sca_1', 2)).not.toBe(first);
    expect(service.generateDeterministicSubcontractRevisionId('sca_2', 1)).not.toBe(first);
  });

  it('clause id is deterministic per (company, clauseKey) and scoped to the company', () => {
    const first = service.generateDeterministicSubcontractClauseId('comp_1', 'payment.schedule');
    expect(first).toBe(service.generateDeterministicSubcontractClauseId('comp_1', 'payment.schedule'));
    expect(first).toMatch(/^sccl_/);
    expect(service.generateDeterministicSubcontractClauseId('comp_2', 'payment.schedule')).not.toBe(first);
    expect(service.generateDeterministicSubcontractClauseId('comp_1', 'retention.performance')).not.toBe(first);
  });

  it('clause version and trade template ids are deterministic and carry their own prefixes', () => {
    const version = service.generateDeterministicSubcontractClauseVersionId('sccl_1', 3);
    expect(version).toBe(service.generateDeterministicSubcontractClauseVersionId('sccl_1', 3));
    expect(version).toMatch(/^sccv_/);
    expect(service.generateDeterministicSubcontractClauseVersionId('sccl_1', 4)).not.toBe(version);

    const template = service.generateDeterministicSubcontractTradeTemplateId('comp_1', 'reinforcement');
    expect(template).toBe(service.generateDeterministicSubcontractTradeTemplateId('comp_1', 'reinforcement'));
    expect(template).toMatch(/^sctt_/);
  });
});
