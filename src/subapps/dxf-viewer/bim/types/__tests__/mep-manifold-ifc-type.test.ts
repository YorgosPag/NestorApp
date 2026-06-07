/**
 * ADR-408 Φ14 — manifold IFC class is kind-dependent. Pins the SSoT resolver,
 * the factory wiring (resolver, not a hardcoded literal), and the persistence
 * schema accepting BOTH classes (a drainage collector must round-trip).
 */

import { resolveManifoldIfcType } from '../mep-manifold-types';
import { MepManifoldEntitySchema } from '../mep-manifold.schemas';
import {
  buildDefaultMepManifoldParams,
  buildMepManifoldEntity,
} from '../../../hooks/drawing/mep-manifold-completion';
import type { MepManifoldKind } from '../mep-manifold-types';

function entityOfKind(kind: MepManifoldKind) {
  const params = buildDefaultMepManifoldParams({ x: 0, y: 0 }, { kind });
  const res = buildMepManifoldEntity(params, '0');
  if (!res.ok) throw new Error('manifold fixture invalid');
  return res.entity;
}

describe('manifold IFC class by kind (ADR-408 Φ14)', () => {
  describe('resolveManifoldIfcType SSoT', () => {
    it('water floor-manifold → IfcPipeFitting', () => {
      expect(resolveManifoldIfcType('floor-manifold')).toBe('IfcPipeFitting');
    });

    it('drainage collector (φρεάτιο) → IfcFlowStorageDevice', () => {
      expect(resolveManifoldIfcType('drainage-collector')).toBe('IfcFlowStorageDevice');
    });
  });

  describe('factory wires the resolver (not a hardcoded literal)', () => {
    it('water manifold entity carries IfcPipeFitting', () => {
      expect(entityOfKind('floor-manifold').ifcType).toBe('IfcPipeFitting');
    });

    it('drainage collector entity carries IfcFlowStorageDevice', () => {
      expect(entityOfKind('drainage-collector').ifcType).toBe('IfcFlowStorageDevice');
    });
  });

  describe('persistence schema accepts both classes', () => {
    it('a drainage collector round-trips through the entity schema', () => {
      const parsed = MepManifoldEntitySchema.safeParse(entityOfKind('drainage-collector'));
      expect(parsed.success).toBe(true);
    });

    it('a water manifold round-trips through the entity schema', () => {
      const parsed = MepManifoldEntitySchema.safeParse(entityOfKind('floor-manifold'));
      expect(parsed.success).toBe(true);
    });

    it('rejects an unrelated ifcType literal', () => {
      const bad = { ...entityOfKind('drainage-collector'), ifcType: 'IfcLightFixture' };
      expect(MepManifoldEntitySchema.safeParse(bad).success).toBe(false);
    });
  });
});
