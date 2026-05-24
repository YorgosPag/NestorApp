/**
 * ADR-366 Phase 9 / C.2 — Pure FSM for BIM comment status transitions.
 * No side effects, no Firebase, no React. Safe to call from server or client.
 *
 * FSM:
 *   open → in_review                  (any participant)
 *   in_review → open                  (author or admin — reopen)
 *   in_review → resolved              (author or admin)
 *   resolved → open                   (any participant — reopen)
 *   resolved → archived               (admin only — manual; also auto-archive after 30d)
 *   archived → terminal               (no further transitions)
 */

import type { CommentStatus } from './bim-comment-types';

interface TransitionRule {
  readonly from: CommentStatus;
  readonly to: CommentStatus;
  readonly authorOrAdminOnly: boolean;
}

const TRANSITION_RULES: readonly TransitionRule[] = [
  { from: 'open',      to: 'in_review', authorOrAdminOnly: false },
  { from: 'in_review', to: 'open',      authorOrAdminOnly: true  },
  { from: 'in_review', to: 'resolved',  authorOrAdminOnly: true  },
  { from: 'resolved',  to: 'open',      authorOrAdminOnly: false },
  { from: 'resolved',  to: 'archived',  authorOrAdminOnly: true  },
];

export function canTransition(
  from: CommentStatus,
  to: CommentStatus,
  isAuthorOrAdmin: boolean,
): boolean {
  const rule = TRANSITION_RULES.find((r) => r.from === from && r.to === to);
  if (!rule) return false;
  return !rule.authorOrAdminOnly || isAuthorOrAdmin;
}

export function getAvailableTransitions(
  current: CommentStatus,
  isAuthorOrAdmin: boolean,
): readonly CommentStatus[] {
  return TRANSITION_RULES
    .filter((r) => r.from === current && (!r.authorOrAdminOnly || isAuthorOrAdmin))
    .map((r) => r.to);
}

export function isTerminal(status: CommentStatus): boolean {
  return status === 'archived';
}
