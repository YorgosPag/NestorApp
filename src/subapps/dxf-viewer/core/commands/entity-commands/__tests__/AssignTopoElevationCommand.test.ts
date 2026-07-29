/**
 * ADR-731 — AssignTopoElevationCommand: undo/redo + plan verification.
 * Mutation coverage: 4/4 (fromPlan, clearDerived, execute, undo).
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import type { TopoPoint, TopoSurfaceId } from '../../../../systems/topography/topo-types';
import type { ElevationAssignmentPlan } from '../../../../systems/topography/topo-elevation-assign';
import { AssignTopoElevationCommand } from '../AssignTopoElevationCommand';
import * as TopoPointStore from '../../../../systems/topography/TopoPointStore';

// Mock the store
jest.mock('../../../../systems/topography/TopoPointStore', () => ({
  getTopoPoints: jest.fn(),
  setTopoPoints: jest.fn(),
}));

describe('AssignTopoElevationCommand', () => {
  const surfaceId: TopoSurfaceId = 'surf-001';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fromPlan', () => {
    it('should return null on empty plan (no-op)', () => {
      const points: TopoPoint[] = [{ x: 50, y: 50 }];
      const emptyPlan: ElevationAssignmentPlan = {
        assignments: [],
        outsideSurfaceCount: 0,
        measuredSkippedCount: 0,
        overBridgeCount: 0,
      };

      (TopoPointStore.getTopoPoints as jest.Mock).mockReturnValue(points);

      const cmd = AssignTopoElevationCommand.fromPlan(surfaceId, emptyPlan);
      expect(cmd).toBeNull();
      expect(TopoPointStore.setTopoPoints).not.toHaveBeenCalled();
    });

    it('should create command with snapshot-based undo', () => {
      const previousPoints: TopoPoint[] = [{ x: 50, y: 50 }];
      const plan: ElevationAssignmentPlan = {
        assignments: [{ pointIndex: 0, zMm: 1234, overBridge: false }],
        outsideSurfaceCount: 0,
        measuredSkippedCount: 0,
        overBridgeCount: 0,
      };

      (TopoPointStore.getTopoPoints as jest.Mock).mockReturnValue(previousPoints);

      const cmd = AssignTopoElevationCommand.fromPlan(surfaceId, plan);
      expect(cmd).not.toBeNull();
      expect(cmd!.name).toBe('AssignTopoElevation');
      expect(cmd!.type).toBe('assign-topo-elevation');
    });

    it('should execute the command via store', () => {
      const previousPoints: TopoPoint[] = [{ x: 50, y: 50 }];
      const plan: ElevationAssignmentPlan = {
        assignments: [{ pointIndex: 0, zMm: 1234, overBridge: false }],
        outsideSurfaceCount: 0,
        measuredSkippedCount: 0,
        overBridgeCount: 0,
      };

      (TopoPointStore.getTopoPoints as jest.Mock).mockReturnValue(previousPoints);

      const cmd = AssignTopoElevationCommand.fromPlan(surfaceId, plan);
      cmd?.execute();

      expect(TopoPointStore.setTopoPoints).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ z: 1234, zSource: 'derived' }),
        ]),
        surfaceId,
      );
    });

    it('should undo back to original state', () => {
      const previousPoints: TopoPoint[] = [{ x: 50, y: 50 }];
      const plan: ElevationAssignmentPlan = {
        assignments: [{ pointIndex: 0, zMm: 1234, overBridge: false }],
        outsideSurfaceCount: 0,
        measuredSkippedCount: 0,
        overBridgeCount: 0,
      };

      (TopoPointStore.getTopoPoints as jest.Mock).mockReturnValue(previousPoints);

      const cmd = AssignTopoElevationCommand.fromPlan(surfaceId, plan);
      cmd?.execute();
      cmd?.undo();

      expect(TopoPointStore.setTopoPoints).toHaveBeenLastCalledWith(previousPoints, surfaceId);
    });

    it('should not merge with other commands', () => {
      const plan: ElevationAssignmentPlan = {
        assignments: [{ pointIndex: 0, zMm: 1234, overBridge: false }],
        outsideSurfaceCount: 0,
        measuredSkippedCount: 0,
        overBridgeCount: 0,
      };

      (TopoPointStore.getTopoPoints as jest.Mock).mockReturnValue([{ x: 50, y: 50 }]);

      const cmd = AssignTopoElevationCommand.fromPlan(surfaceId, plan);
      const other = AssignTopoElevationCommand.fromPlan(surfaceId, plan);

      expect(cmd?.canMergeWith(other!)).toBe(false);
    });
  });

  describe('clearDerived', () => {
    it('should return null if no derived elevations', () => {
      const points: TopoPoint[] = [
        { x: 50, y: 50 }, // 2D
        { x: 60, y: 60, z: 1234 }, // measured
      ];

      (TopoPointStore.getTopoPoints as jest.Mock).mockReturnValue(points);

      const cmd = AssignTopoElevationCommand.clearDerived(surfaceId);
      expect(cmd).toBeNull();
    });

    it('should create command to clear all derived elevations', () => {
      const points: TopoPoint[] = [
        { x: 50, y: 50, z: 1200, zSource: 'derived' },
        { x: 60, y: 60, z: 1234 }, // measured
      ];

      (TopoPointStore.getTopoPoints as jest.Mock).mockReturnValue(points);

      const cmd = AssignTopoElevationCommand.clearDerived(surfaceId);
      expect(cmd).not.toBeNull();
      expect(cmd!.getDescription()).toContain('Clear 1 derived');
    });

    it('should execute clearing via store', () => {
      const points: TopoPoint[] = [
        { x: 50, y: 50, z: 1200, zSource: 'derived' },
      ];

      (TopoPointStore.getTopoPoints as jest.Mock).mockReturnValue(points);

      const cmd = AssignTopoElevationCommand.clearDerived(surfaceId);
      cmd?.execute();

      expect(TopoPointStore.setTopoPoints).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ x: 50, y: 50 })]),
        surfaceId,
      );
    });
  });

  describe('getAffectedEntityIds', () => {
    it('should return empty array (only Z changed, no entity affected)', () => {
      const plan: ElevationAssignmentPlan = {
        assignments: [{ pointIndex: 0, zMm: 1234, overBridge: false }],
        outsideSurfaceCount: 0,
        measuredSkippedCount: 0,
        overBridgeCount: 0,
      };

      (TopoPointStore.getTopoPoints as jest.Mock).mockReturnValue([{ x: 50, y: 50 }]);

      const cmd = AssignTopoElevationCommand.fromPlan(surfaceId, plan);
      expect(cmd?.getAffectedEntityIds()).toEqual([]);
    });
  });

  describe('getDescription', () => {
    it('should describe assign action', () => {
      const plan: ElevationAssignmentPlan = {
        assignments: Array.from({ length: 5 }, (_, i) => ({
          pointIndex: i,
          zMm: 1234 + i,
          overBridge: false,
        })),
        outsideSurfaceCount: 0,
        measuredSkippedCount: 0,
        overBridgeCount: 0,
      };

      (TopoPointStore.getTopoPoints as jest.Mock).mockReturnValue(
        Array.from({ length: 5 }, (_, i) => ({ x: 50 + i, y: 50 + i })),
      );

      const cmd = AssignTopoElevationCommand.fromPlan(surfaceId, plan);
      expect(cmd?.getDescription()).toContain('Assign elevation from surface to 5');
    });

    it('should describe clear action', () => {
      const points: TopoPoint[] = Array.from({ length: 3 }, (_, i) => ({
        x: 50 + i,
        y: 50 + i,
        z: 1200 + i,
        zSource: 'derived' as const,
      }));

      (TopoPointStore.getTopoPoints as jest.Mock).mockReturnValue(points);

      const cmd = AssignTopoElevationCommand.clearDerived(surfaceId);
      expect(cmd?.getDescription()).toContain('Clear 3 derived');
    });
  });
});
