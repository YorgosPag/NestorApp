'use client';

/**
 * Canonical SSoT for domain status helpers (color/label/icon).
 *
 * Resolves the multi-SSoT conflict identified in ADR-314 Phase B between
 * `lib/obligations-utils.ts`, `lib/project-utils.ts`, and per-component
 * local `getStatusColor` / `getStatusLabel` redefinitions.
 *
 * `lib/design-system.ts → getStatusColor(token, variant)` is a SEPARATE
 * concern (semantic-token API for success/error/info/muted) and remains
 * the canonical SSoT for that namespace; it is not duplicated here.
 *
 * @module status-helpers
 * @see docs/centralized-systems/reference/adrs/ADR-314-ssot-discovery-findings-roadmap.md
 */

import type { UseSemanticColorsReturn } from '@/ui-adapters/react/useSemanticColors';
import { brandClasses } from '@/styles/design-tokens';
import {
  getEnhancedStatusColor,
  getEnhancedStatusLabel,
  type EnhancedPropertyStatus,
} from '@/constants/domains/property-status-core';

type SemanticColors = UseSemanticColorsReturn;
type TFn = (key: string) => string;

// ============================================================================
// Domain status types
// ============================================================================

export type StorageStatusValue =
  | 'available' | 'occupied' | 'maintenance' | 'reserved'
  | 'sold' | 'unavailable' | 'deleted';

export type ObligationStatusValue =
  | 'draft' | 'completed' | 'approved' | 'in_progress' | 'pending';

export type LeadStageValue =
  | 'initial_contact' | 'qualification' | 'viewing' | 'proposal'
  | 'negotiation' | 'contract' | 'closed_won' | 'closed_lost';

export type CommunicationStatusValue =
  | 'sent' | 'delivered' | 'completed' | 'failed' | 'pending';

export type BuildingTimelineStatusValue =
  | 'completed' | 'in-progress' | 'pending' | 'delayed';

export type BuildingProjectStatusValue =
  | 'active' | 'construction' | 'planned' | 'completed';

export type ProjectStatusValue =
  | 'planning' | 'in_progress' | 'completed'
  | 'on_hold' | 'cancelled' | 'default';

export type StatusByDomain = {
  storage: StorageStatusValue;
  obligation: ObligationStatusValue;
  lead: LeadStageValue;
  communication: CommunicationStatusValue;
  buildingTimeline: BuildingTimelineStatusValue;
  buildingProject: BuildingProjectStatusValue;
  project: ProjectStatusValue;
  property: EnhancedPropertyStatus;
};

export type StatusDomain = keyof StatusByDomain;

export interface StatusOptions {
  readonly colors?: SemanticColors;
  readonly t?: TFn;
}

// ============================================================================
// Per-domain color helpers
// ============================================================================

function colorStorage(status: string, colors?: SemanticColors): string {
  if (!colors) {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'sold': return 'bg-blue-500';
      case 'reserved': return 'bg-yellow-500';
      case 'maintenance': return 'bg-red-500';
      default: return 'bg-slate-500';
    }
  }
  switch (status) {
    case 'available': return colors.bg.success;
    case 'sold': return colors.bg.info;
    case 'reserved': return colors.bg.warning;
    case 'maintenance': return colors.bg.error;
    default: return colors.bg.muted;
  }
}

function colorObligation(status: string, colors?: SemanticColors): string {
  if (!colors) {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'pending': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }
  switch (status) {
    case 'completed': return `${colors.bg.successSubtle} ${colors.text.success}`;
    case 'approved': return `${colors.bg.infoSubtle} ${colors.text.info}`;
    case 'in_progress':
    case 'pending': return `${colors.bg.warningSubtle} ${colors.text.warning}`;
    case 'draft':
    default: return `${colors.bg.muted} ${colors.text.muted}`;
  }
}

function colorLead(stage: string, colors?: SemanticColors): string {
  if (!colors) {
    switch (stage) {
      case 'initial_contact': return 'bg-blue-100 text-blue-800';
      case 'qualification': return 'bg-yellow-100 text-yellow-800';
      case 'viewing': return 'bg-purple-100 text-purple-800';
      case 'proposal': return 'bg-orange-100 text-orange-800';
      case 'negotiation': return 'bg-teal-100 text-teal-800';
      case 'contract': return 'bg-indigo-100 text-indigo-800';
      case 'closed_won': return 'bg-green-100 text-green-800';
      case 'closed_lost': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  }
  switch (stage) {
    case 'initial_contact': return `${colors.bg.infoSubtle} ${colors.text.info}`;
    case 'qualification':
    case 'proposal': return `${colors.bg.warningSubtle} ${colors.text.warning}`;
    case 'viewing':
    case 'negotiation':
    case 'contract': return `${colors.bg.accentSubtle} ${colors.text.accent}`;
    case 'closed_won': return `${colors.bg.successSubtle} ${colors.text.success}`;
    case 'closed_lost': return `${colors.bg.errorSubtle} ${colors.text.error}`;
    default: return `${colors.bg.muted} ${colors.text.muted}`;
  }
}

function colorCommunication(status: string): string {
  switch (status) {
    case 'sent':
    case 'delivered':
    case 'completed': return 'text-green-600';
    case 'failed': return 'text-red-600';
    case 'pending': return 'text-yellow-600';
    default: return 'text-gray-600';
  }
}

function colorBuildingTimeline(status: string, colors?: SemanticColors): string {
  if (!colors) {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in-progress': return 'bg-blue-500';
      case 'delayed': return 'bg-red-500';
      case 'pending':
      default: return 'bg-slate-300';
    }
  }
  switch (status) {
    case 'completed': return `${colors.bg.success} ${colors.border.success}`;
    case 'in-progress': return `${colors.bg.info} ${colors.border.info}`;
    case 'delayed': return `${colors.bg.error} ${colors.border.error}`;
    case 'pending':
    default: return `${colors.bg.muted} ${colors.border.muted}`;
  }
}

function colorBuildingProject(status: string, colors?: SemanticColors): string {
  if (!colors) {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'construction': return brandClasses.primary.bgDark;
      case 'planned': return 'bg-yellow-500';
      case 'completed': return 'bg-slate-600';
      default: return 'bg-slate-500';
    }
  }
  switch (status) {
    case 'active': return colors.bg.success;
    case 'construction': return brandClasses.primary.bgDark;
    case 'planned': return colors.bg.warning;
    case 'completed': return colors.bg.muted;
    default: return colors.bg.mutedLight;
  }
}

function colorProject(status: string, colors?: SemanticColors): string {
  if (!colors) {
    switch (status) {
      case 'planning': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return brandClasses.primary.badge;
      case 'completed': return 'bg-green-100 text-green-800';
      case 'on_hold': return 'bg-slate-100 text-slate-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  }
  switch (status) {
    case 'planning': return `${colors.bg.warningSubtle} ${colors.text.warning}`;
    case 'in_progress': return brandClasses.primary.badge;
    case 'completed': return `${colors.bg.successSubtle} ${colors.text.success}`;
    case 'cancelled': return `${colors.bg.errorSubtle} ${colors.text.error}`;
    case 'on_hold':
    default: return `${colors.bg.muted} ${colors.text.muted}`;
  }
}

// ============================================================================
// Per-domain label keys (i18n SSoT — SOS N.11)
// ============================================================================

function labelKey(domain: StatusDomain, status: string): string {
  switch (domain) {
    case 'storage': return `pages.storage.statusLabels.${status}`;
    case 'obligation': return `obligations.status.${status}`;
    case 'lead': return `leads.stage.${status}`;
    case 'communication': return `communications.status.${status}`;
    case 'buildingTimeline': {
      const seg = status === 'in-progress' ? 'inProgress' : status;
      return `tabs.timeline.status.${seg}`;
    }
    case 'buildingProject': return `building.project.status.${status}`;
    case 'project': return `projects:status.${status}`;
    case 'property': return `properties.status.${status}`;
  }
}

// ============================================================================
// Per-domain icon helpers (lucide-react names as strings)
// ============================================================================

function iconObligation(status: string): string {
  switch (status) {
    case 'draft': return 'FileEdit';
    case 'completed': return 'CheckCircle';
    case 'approved': return 'ShieldCheck';
    case 'in_progress': return 'Clock';
    case 'pending': return 'AlertCircle';
    default: return 'File';
  }
}

function iconCommunication(status: string): string {
  switch (status) {
    case 'sent':
    case 'delivered':
    case 'completed': return 'CheckCircle';
    case 'failed': return 'XCircle';
    case 'pending': return 'Clock';
    default: return 'AlertCircle';
  }
}

// ============================================================================
// Public API — discriminated dispatchers
// ============================================================================

export function getStatusColor<D extends StatusDomain>(
  domain: D,
  status: StatusByDomain[D] | string | null | undefined,
  opts?: StatusOptions,
): string {
  const s = String(status ?? '');
  switch (domain) {
    case 'storage': return colorStorage(s, opts?.colors);
    case 'obligation': return colorObligation(s, opts?.colors);
    case 'lead': return colorLead(s, opts?.colors);
    case 'communication': return colorCommunication(s);
    case 'buildingTimeline': return colorBuildingTimeline(s, opts?.colors);
    case 'buildingProject': return colorBuildingProject(s, opts?.colors);
    case 'project': return colorProject(s, opts?.colors);
    case 'property': return getEnhancedStatusColor(s as EnhancedPropertyStatus);
    default: {
      const _exhaustive: never = domain;
      return _exhaustive;
    }
  }
}

export function getStatusLabel<D extends StatusDomain>(
  domain: D,
  status: StatusByDomain[D] | string | null | undefined,
  opts?: StatusOptions,
): string {
  const s = String(status ?? '');
  if (domain === 'property') {
    return getEnhancedStatusLabel(s as EnhancedPropertyStatus);
  }
  const key = labelKey(domain, s);
  return opts?.t ? opts.t(key) : key;
}

export function getStatusIcon<D extends StatusDomain>(
  domain: D,
  status: StatusByDomain[D] | string | null | undefined,
): string {
  const s = String(status ?? '');
  switch (domain) {
    case 'obligation': return iconObligation(s);
    case 'communication': return iconCommunication(s);
    default: return 'Circle';
  }
}
