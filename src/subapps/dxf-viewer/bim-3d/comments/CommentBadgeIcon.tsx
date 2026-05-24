'use client';

/**
 * ADR-366 Phase 9 / C.2 — SVG badge icon for BIM comment types.
 * Pure presentational — no state, no hooks. Used by CommentListPanel,
 * BimCommentDetailsPanel, and as a reference for canvas texture colors.
 */

import type { CommentStatus, CommentType } from './bim-comment-types';

export const COMMENT_TYPE_COLORS: Record<CommentType, string> = {
  issue:      '#ef4444',
  question:   '#3b82f6',
  suggestion: '#f59e0b',
  approval:   '#22c55e',
  info:       '#6366f1',
};

export const COMMENT_TYPE_LABELS: Record<CommentType, string> = {
  issue:      '!',
  question:   '?',
  suggestion: '★',
  approval:   '✓',
  info:       'i',
};

export const COMMENT_STATUS_OPACITY: Record<CommentStatus, number> = {
  open:      1.0,
  in_review: 0.8,
  resolved:  0.6,
  archived:  0.3,
};

interface CommentBadgeIconProps {
  readonly type: CommentType;
  readonly status?: CommentStatus;
  readonly size?: number;
  readonly className?: string;
}

export function CommentBadgeIcon({
  type,
  status = 'open',
  size = 20,
  className,
}: CommentBadgeIconProps) {
  const color = COMMENT_TYPE_COLORS[type];
  const label = COMMENT_TYPE_LABELS[type];
  const opacity = COMMENT_STATUS_OPACITY[status];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={className}
      style={{ opacity }}
    >
      <circle cx="10" cy="10" r="9" fill={color} />
      <text
        x="10"
        y="14"
        textAnchor="middle"
        fontSize="11"
        fontWeight="bold"
        fill="white"
        fontFamily="sans-serif"
      >
        {label}
      </text>
    </svg>
  );
}
