/**
 * =============================================================================
 * 🏢 ENTERPRISE: Unified Share Surface — Types SSoT
 * =============================================================================
 *
 * Canonical type definitions for the unified sharing infrastructure.
 * Used by ShareSurfaceShell, useShareFlow, and all PermissionPanel adapters.
 *
 * @module types/sharing
 * @see ADR-147 Unified Share Surface
 */

import type { ReactNode } from 'react';

export type ShareFlowStatus =
  | 'idle'
  | 'configuring'
  | 'submitting'
  | 'success'
  | 'error';

export type SharePermissionModel = 'user-auth' | 'link-token';

export interface ShareableEntity<TKind extends string = string> {
  kind: TKind;
  id: string;
  title: string;
  subtitle?: string;
  companyId?: string;
}

export interface ShareFlowState<TResult> {
  status: ShareFlowStatus;
  error: string | null;
  result: TResult | null;
}

export interface ShareFlowOptions<TDraft, TResult> {
  initialDraft: TDraft;
  submit: (draft: TDraft) => Promise<TResult>;
  onSuccess?: (result: TResult) => void;
  onError?: (error: unknown) => void;
}

export type ShareDraftUpdater<TDraft> = (
  next: TDraft | ((prev: TDraft) => TDraft),
) => void;

export interface ShareFlowHandle<TDraft, TResult> {
  state: ShareFlowState<TResult>;
  draft: TDraft;
  setDraft: ShareDraftUpdater<TDraft>;
  submit: () => Promise<void>;
  reset: () => void;
}

export interface PermissionPanelProps<TDraft, TResult> {
  entity: ShareableEntity;
  draft: TDraft;
  onDraftChange: ShareDraftUpdater<TDraft>;
  onSubmit: () => void;
  onCancel: () => void;
  state: ShareFlowState<TResult>;
}

export interface ShareSurfaceLabels {
  title: string;
  subtitle?: string;
  closeLabel: string;
  errorPrefix: string;
}

export interface ShareSurfaceShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: ShareableEntity;
  labels: ShareSurfaceLabels;
  status: ShareFlowStatus;
  error: string | null;
  children: ReactNode;
  headerIcon?: ReactNode;
  footer?: ReactNode;
}
