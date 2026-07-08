import {
  buildAllowImpactPreview,
  buildUnavailableImpactPreview,
  finalizeImpactPreview,
  resolveImpactPreview,
  type ImpactDependencyResult,
} from '@/lib/firestore/impact-preview-primitives';
import type { ProjectMutationDependency } from '@/types/project-mutation-impact';

describe('impact-preview-primitives', () => {
  describe('buildAllowImpactPreview', () => {
    it('returns the canonical allow preview', () => {
      expect(buildAllowImpactPreview()).toEqual({
        mode: 'allow',
        mutationKinds: [],
        changes: [],
        dependencies: [],
        companyLinkChange: 'none',
        messageKey: 'impactGuard.messages.allow',
        blockingCount: 0,
        warningCount: 0,
      });
    });
  });

  describe('buildUnavailableImpactPreview', () => {
    it('returns a fail-safe block preview', () => {
      const preview = buildUnavailableImpactPreview();
      expect(preview.mode).toBe('block');
      expect(preview.messageKey).toBe('impactGuard.messages.unavailable');
      expect(preview.dependencies).toEqual([]);
    });
  });

  describe('finalizeImpactPreview', () => {
    const warnDep: ProjectMutationDependency = {
      id: 'ownershipTables',
      count: 3,
      mode: 'warn',
    };
    const blockDep: ProjectMutationDependency = {
      id: 'ownershipTables',
      count: 1,
      mode: 'block',
    };

    it('derives warn mode when only warn deps exist', () => {
      const preview = finalizeImpactPreview([warnDep], 'impactGuard.landownersSave.withOwnershipTables');
      expect(preview.mode).toBe('warn');
      expect(preview.warningCount).toBe(1);
      expect(preview.blockingCount).toBe(0);
      expect(preview.messageKey).toBe('impactGuard.landownersSave.withOwnershipTables');
      expect(preview.dependencies).toEqual([warnDep]);
    });

    it('derives block mode when a block dep exists', () => {
      const preview = finalizeImpactPreview([warnDep, blockDep], null);
      expect(preview.mode).toBe('block');
      expect(preview.warningCount).toBe(1);
      expect(preview.blockingCount).toBe(1);
    });

    it('falls back to the generic warn key when messageKey is null', () => {
      const preview = finalizeImpactPreview([warnDep], null);
      expect(preview.messageKey).toBe('impactGuard.messages.warn');
    });
  });

  describe('resolveImpactPreview', () => {
    const dep: ProjectMutationDependency = { id: 'commissionRecords', count: 2, mode: 'warn' };

    it('returns allow when the rule engine yields no dependencies', async () => {
      const empty: ImpactDependencyResult = { deps: [], messageKey: null };
      const onError = jest.fn();
      const preview = await resolveImpactPreview(async () => empty, onError);
      expect(preview.mode).toBe('allow');
      expect(onError).not.toHaveBeenCalled();
    });

    it('finalizes when dependencies are present', async () => {
      const result: ImpactDependencyResult = {
        deps: [dep],
        messageKey: 'impactGuard.brokerTerminate.withPendingCommissions',
      };
      const preview = await resolveImpactPreview(async () => result, jest.fn());
      expect(preview.mode).toBe('warn');
      expect(preview.dependencies).toEqual([dep]);
      expect(preview.messageKey).toBe('impactGuard.brokerTerminate.withPendingCommissions');
    });

    it('returns unavailable and reports the error when compute throws', async () => {
      const boom = new Error('firestore down');
      const onError = jest.fn();
      const preview = await resolveImpactPreview(async () => {
        throw boom;
      }, onError);
      expect(preview.mode).toBe('block');
      expect(preview.messageKey).toBe('impactGuard.messages.unavailable');
      expect(onError).toHaveBeenCalledWith(boom);
    });
  });
});
