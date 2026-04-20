/**
 * Unit tests for `resolveAction` — the CDC writer's action classifier.
 *
 * Locks in the status-string lifecycle semantics added on 2026-04-20 so the
 * CDC entry action matches the service-layer writer verbatim. Without that
 * parity the UI dedup (groups by `(entityId, action)` within a 30s window)
 * cannot fold the dual-write pair and Γιώργος sees two rows per action.
 *
 * @module functions/audit/__tests__/contact-audit-trigger
 * @enterprise ADR-195 — Entity Audit Trail (Phase 1 CDC PoC)
 */

import { resolveAction } from '../resolve-action';

describe('resolveAction', () => {
  describe('structural events', () => {
    it('returns "created" when before is null and after exists', () => {
      expect(resolveAction(null, { status: 'active' })).toBe('created');
    });

    it('returns "deleted" when before exists and after is null', () => {
      expect(resolveAction({ status: 'active' }, null)).toBe('deleted');
    });

    it('returns "updated" when either side is null in the fallback path', () => {
      // Unreachable in the production trigger (early return guards both null),
      // but the function defensively handles the edge.
      expect(resolveAction(null, null)).toBe('updated');
    });
  });

  describe('soft-delete lifecycle (ADR-281 status-string pattern)', () => {
    it('returns "soft_deleted" when status transitions active → deleted', () => {
      expect(
        resolveAction(
          { status: 'active', firstName: 'Giorgio' },
          { status: 'deleted', firstName: 'Giorgio' },
        ),
      ).toBe('soft_deleted');
    });

    it('returns "soft_deleted" when status transitions pending → deleted', () => {
      expect(
        resolveAction({ status: 'pending' }, { status: 'deleted' }),
      ).toBe('soft_deleted');
    });

    it('returns "restored" when status transitions deleted → active', () => {
      expect(
        resolveAction({ status: 'deleted' }, { status: 'active' }),
      ).toBe('restored');
    });

    it('returns "restored" when status transitions deleted → pending', () => {
      expect(
        resolveAction({ status: 'deleted' }, { status: 'pending' }),
      ).toBe('restored');
    });

    it('takes precedence over the generic status_changed fallback', () => {
      // Both a status string transition AND a trailing field change.
      // The soft-delete branch must win — service-layer writes `soft_deleted`.
      const before = { status: 'active', notes: 'a' };
      const after = { status: 'deleted', notes: 'b' };
      expect(resolveAction(before, after)).toBe('soft_deleted');
    });
  });

  describe('legacy isDeleted boolean lifecycle (non-contact entities)', () => {
    it('returns "trashed" when isDeleted transitions false → true', () => {
      expect(
        resolveAction({ isDeleted: false }, { isDeleted: true }),
      ).toBe('trashed');
    });

    it('returns "restored" when isDeleted transitions true → false', () => {
      expect(
        resolveAction({ isDeleted: true }, { isDeleted: false }),
      ).toBe('restored');
    });
  });

  describe('archive lifecycle', () => {
    it('returns "archived" when archivedAt is set', () => {
      expect(
        resolveAction(
          { archivedAt: null },
          { archivedAt: new Date('2026-04-20') },
        ),
      ).toBe('archived');
    });

    it('returns "unarchived" when archivedAt is cleared', () => {
      expect(
        resolveAction(
          { archivedAt: new Date('2026-04-20') },
          { archivedAt: null },
        ),
      ).toBe('unarchived');
    });
  });

  describe('generic status change fallback', () => {
    it('returns "status_changed" for non-delete status transitions', () => {
      expect(
        resolveAction({ status: 'active' }, { status: 'pending' }),
      ).toBe('status_changed');
    });

    it('returns "updated" when no classifier matches', () => {
      expect(
        resolveAction(
          { status: 'active', firstName: 'a' },
          { status: 'active', firstName: 'b' },
        ),
      ).toBe('updated');
    });
  });
});
