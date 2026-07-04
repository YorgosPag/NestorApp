/**
 * structural-relevant-trigger — SSoT gate «αξίζει δομοστατικό recompute;».
 *
 * Κλειδώνει τη ρίζα του bug 2026-07-04: η μετακίνηση/δημιουργία μη-δομικού entity
 * (γραμμή/διάσταση/έπιπλο) ΔΕΝ πρέπει να πυροδοτεί full load-takedown/οπλισμό, ενώ
 * κάθε δομικό μέλος + τα type-scoped/batch/derived events περνούν κανονικά.
 */

import { eventTouchesStructuralMember } from '../structural-relevant-trigger';
import type { DrawingEventType } from '../../systems/events/EventBus';

describe('eventTouchesStructuralMember (structural-relevance gate)', () => {
  describe('bim:entities-moved (generic — φιλτράρεται με τύπο)', () => {
    it('γραμμή DXF → false (το κύριο bug: δεν τρέχει στατικός σε όλο το κτίριο)', () => {
      const payload = { movedEntities: [{ id: 'l1', type: 'line' }] };
      expect(eventTouchesStructuralMember('bim:entities-moved', payload)).toBe(false);
    });

    it('διάσταση / hatch / έπιπλο / mep → false', () => {
      for (const type of ['dimension', 'hatch', 'furniture', 'mep-segment', 'text', 'arc']) {
        const payload = { movedEntities: [{ id: 'x', type }] };
        expect(eventTouchesStructuralMember('bim:entities-moved', payload)).toBe(false);
      }
    });

    it('κάθε δομικό μέλος → true', () => {
      for (const type of ['column', 'beam', 'wall', 'slab', 'stair', 'foundation']) {
        const payload = { movedEntities: [{ id: 'x', type }] };
        expect(eventTouchesStructuralMember('bim:entities-moved', payload)).toBe(true);
      }
    });

    it('μεικτή επιλογή (γραμμή + κολόνα) → true (χρειάζεται recompute)', () => {
      const payload = { movedEntities: [{ id: 'l1', type: 'line' }, { id: 'c1', type: 'column' }] };
      expect(eventTouchesStructuralMember('bim:entities-moved', payload)).toBe(true);
    });

    it('άγνωστο/κακοσχηματισμένο payload → true (safe default, δεν κόβουμε)', () => {
      expect(eventTouchesStructuralMember('bim:entities-moved', undefined)).toBe(true);
      expect(eventTouchesStructuralMember('bim:entities-moved', {})).toBe(true);
      expect(eventTouchesStructuralMember('bim:entities-moved', { movedEntities: 'nope' })).toBe(true);
    });

    it('κενή λίστα movedEntities → false (κανένα δομικό)', () => {
      expect(eventTouchesStructuralMember('bim:entities-moved', { movedEntities: [] })).toBe(false);
    });
  });

  describe('drawing:entity-created (generic — φιλτράρεται με τύπο)', () => {
    it('δημιουργία γραμμής → false', () => {
      expect(eventTouchesStructuralMember('drawing:entity-created', { entity: { type: 'line' } })).toBe(false);
    });

    it('δημιουργία κολόνας → true', () => {
      expect(eventTouchesStructuralMember('drawing:entity-created', { entity: { type: 'column' } })).toBe(true);
    });

    it('χωρίς entity → false', () => {
      expect(eventTouchesStructuralMember('drawing:entity-created', {})).toBe(false);
    });
  });

  describe('type-scoped / batch / derived events → πάντα true (δεν φιλτράρονται)', () => {
    const passthrough: DrawingEventType[] = [
      'bim:column-params-updated',
      'bim:beam-params-updated',
      'bim:wall-params-updated',
      'bim:slab-params-updated',
      'bim:foundation-params-updated',
      'bim:column-delete-requested',
      'bim:beam-delete-requested',
      'bim:wall-delete-requested',
      'bim:columns-from-grid',
      'bim:beams-from-grid',
      'bim:walls-from-perimeter',
      'bim:structural-loads-computed',
    ];
    it('περνούν ανεξάρτητα από payload', () => {
      for (const ev of passthrough) {
        expect(eventTouchesStructuralMember(ev, undefined)).toBe(true);
        expect(eventTouchesStructuralMember(ev, { anything: true })).toBe(true);
      }
    });
  });
});
