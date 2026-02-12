import { getStatusColor } from '@/lib/design-system';
import type { ObligationStatus } from '@/types/obligations';

export const OBLIGATION_WORKFLOW_SEQUENCE: ObligationStatus[] = [
  'draft',
  'in-review',
  'returned',
  'approved',
  'issued',
  'superseded',
  'archived',
  'completed',
];

export const OBLIGATION_WORKFLOW_LABEL_KEYS: Record<ObligationStatus, string> = {
  draft: 'common:documentStatus.draft',
  'in-review': 'common:documentStatus.inReview',
  returned: 'common:documentStatus.returned',
  approved: 'common:documentStatus.approved',
  issued: 'common:documentStatus.issued',
  superseded: 'common:documentStatus.superseded',
  archived: 'common:documentStatus.archived',
  completed: 'common:documentStatus.completed',
};

const WORKFLOW_TRANSITIONS: Record<ObligationStatus, ObligationStatus[]> = {
  draft: ['in-review', 'archived'],
  'in-review': ['returned', 'approved', 'archived'],
  returned: ['in-review', 'archived'],
  approved: ['issued', 'superseded', 'archived'],
  issued: ['completed', 'superseded', 'archived'],
  superseded: ['archived'],
  archived: ['draft'],
  completed: ['archived'],
};

const STATUS_COLOR_MAP: Record<ObligationStatus, string> = {
  draft: 'planned',
  'in-review': 'pending',
  returned: 'reserved',
  approved: 'active',
  issued: 'for-rent',
  superseded: 'cancelled',
  archived: 'unavailable',
  completed: 'completed',
};

export const getAvailableTransitions = (status: ObligationStatus): ObligationStatus[] => {
  return WORKFLOW_TRANSITIONS[status] || [];
};

export const getStatusToneClass = (status: ObligationStatus): string => {
  const semanticStatus = STATUS_COLOR_MAP[status] || 'pending';
  return [
    getStatusColor(semanticStatus, 'bg'),
    getStatusColor(semanticStatus, 'text'),
    getStatusColor(semanticStatus, 'border'),
  ].join(' ');
};
