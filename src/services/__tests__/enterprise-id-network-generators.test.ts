/**
 * ADR-867 §4 — οι ταυτότητες του δικτύου συνεργατών.
 *
 * Τρία ερωτήματα, το καθένα με τη μετάλλαξη που το κοκκινίζει:
 * - **ιδεμποτησία** (ίδια είσοδος ⇒ ίδιο id) — μετάλλαξη: `generateId` αντί για `mintDeterministicV4Id`
 * - **συμμετρία** της σχέσης (Α↔Β = Β↔Α) — μετάλλαξη: αφαίρεση του `.sort()`
 * - **κατεύθυνση** της φραγής (Α φράσσει Β ≠ Β φράσσει Α) — μετάλλαξη: προσθήκη `.sort()`
 * - **χωρισμός θεμάτων** (πράξη ≠ σχέση) — μετάλλαξη: αφαίρεση του προθήματος `act:`
 */

import { EnterpriseIdService } from '../enterprise-id.service';
import { isValidEnterpriseId } from '../enterprise-id-parse';

describe('ADR-867 network id generators', () => {
  const service = new EnterpriseIdService({ enableLogging: false, enableCache: false, cacheSize: 0 });

  it('act thread id is deterministic, prefixed and valid', () => {
    const first = service.generateDeterministicNetworkActThreadId('mandate:ownp_1:comp_1');
    expect(first).toBe(service.generateDeterministicNetworkActThreadId('mandate:ownp_1:comp_1'));
    expect(first).toMatch(/^nthr_/);
    expect(isValidEnterpriseId(first)).toBe(true);
  });

  it('different acts never share a thread', () => {
    expect(service.generateDeterministicNetworkActThreadId('mandate:ownp_1:comp_1')).not.toBe(
      service.generateDeterministicNetworkActThreadId('mandate:ownp_1:comp_2'),
    );
  });

  it('relationship thread is symmetric — whoever calls, the same thread', () => {
    expect(service.generateDeterministicNetworkRelationshipThreadId('uidA', 'uidB')).toBe(
      service.generateDeterministicNetworkRelationshipThreadId('uidB', 'uidA'),
    );
  });

  it('act thread and relationship thread never collide for look-alike seeds', () => {
    // Ο σπόρος πράξης μιμείται ΑΚΡΙΒΩΣ τον σπόρο σχέσης — μόνο το πρόθημα θέματος τα χωρίζει.
    expect(service.generateDeterministicNetworkActThreadId('rel:uidA:uidB')).not.toBe(
      service.generateDeterministicNetworkRelationshipThreadId('uidA', 'uidB'),
    );
  });

  it('block is directional — A blocking B is not B blocking A', () => {
    expect(service.generateDeterministicNetworkBlockId('uidA', 'uidB')).not.toBe(
      service.generateDeterministicNetworkBlockId('uidB', 'uidA'),
    );
  });

  it('act team and away ids carry their own prefixes', () => {
    expect(service.generateDeterministicNetworkActTeamId('mandate:ownp_1:comp_1')).toMatch(/^nteam_/);
    expect(service.generateDeterministicNetworkAwayId('uidA')).toMatch(/^naway_/);
  });

  it('message ids are random — two identical texts are two messages', () => {
    const a = service.generateNetworkMessageId();
    expect(a).toMatch(/^nmsg_/);
    expect(a).not.toBe(service.generateNetworkMessageId());
  });

  it('revision ids are random and carry their own prefix — every edit is its own event (ADR-867 Β7)', () => {
    const a = service.generateNetworkMessageRevisionId();
    expect(a).toMatch(/^nmrv_/);
    expect(a).not.toBe(service.generateNetworkMessageRevisionId());
  });
});
