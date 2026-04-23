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

import type { Timestamp } from 'firebase/firestore';
import type { ReactNode } from 'react';

// ============================================================================
// ADR-315 — Polymorphic unified sharing
//   file / contact / property_showcase / project_showcase / building_showcase
// ============================================================================

export type ShareEntityType =
  | 'file'
  | 'contact'
  | 'property_showcase'
  | 'project_showcase'
  | 'building_showcase';

export type ShareDispatchChannel =
  | 'email'
  | 'telegram'
  | 'whatsapp'
  | 'messenger'
  | 'instagram';

export type ShareDispatchStatus = 'queued' | 'sent' | 'failed';

export interface ShowcaseShareMeta {
  pdfStoragePath: string;
  pdfRegeneratedAt: Timestamp | string | null;
}

export interface ContactShareMeta {
  includedFields: Array<'name' | 'emails' | 'phones' | 'address' | 'company'>;
}

export interface FileShareMeta {
  mimeType: string;
  sizeBytes: number;
}

export interface ShareRecord {
  id: string;
  token: string;
  entityType: ShareEntityType;
  entityId: string;
  companyId: string;
  createdBy: string;
  createdAt: Timestamp | string;

  expiresAt: string;
  isActive: boolean;
  revokedAt?: Timestamp | string | null;
  revokedBy?: string | null;

  requiresPassword: boolean;
  passwordHash?: string | null;
  maxAccesses: number;
  accessCount: number;
  lastAccessedAt?: Timestamp | string | null;

  note?: string | null;

  showcaseMeta?: ShowcaseShareMeta | null;
  contactMeta?: ContactShareMeta | null;
  fileMeta?: FileShareMeta | null;
}

export interface ShareDispatchLog {
  id: string;
  shareId?: string | null;
  token?: string | null;
  companyId: string;
  createdBy: string;
  createdAt: Timestamp | string;
  channel: ShareDispatchChannel;
  externalUserId: string;
  contactId?: string | null;
  payload: {
    subject?: string | null;
    body?: string | null;
    photoUrls?: string[] | null;
  };
  status: ShareDispatchStatus;
  errorCode?: string | null;
}

export interface CreateShareInput {
  entityType: ShareEntityType;
  entityId: string;
  companyId: string;
  createdBy: string;
  expiresInHours?: number;
  password?: string;
  maxAccesses?: number;
  note?: string;
  showcaseMeta?: ShowcaseShareMeta;
  contactMeta?: ContactShareMeta;
  fileMeta?: FileShareMeta;
}

export interface CreateShareResult {
  shareId: string;
  token: string;
  expiresAt: string;
}

export interface ShareValidation {
  valid: boolean;
  reason?: string;
  share?: ShareRecord;
}

export interface PublicShareData {
  entityType: ShareEntityType;
  entityId: string;
  requiresPassword: boolean;
  expiresAt: string;
  isActive: boolean;
  accessCount: number;
  maxAccesses: number;
  note?: string | null;
  showcaseMeta?: ShowcaseShareMeta | null;
  contactMeta?: ContactShareMeta | null;
  fileMeta?: FileShareMeta | null;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export interface AuthorizedUser {
  uid: string;
  companyId: string;
}

export interface ShareEntityDefinition<T = unknown> {
  resolve(share: ShareRecord): Promise<T>;
  safePublicProjection(share: ShareRecord): PublicShareData;
  renderPublic(data: T): ReactNode;
  canShare(user: AuthorizedUser, entityId: string): Promise<boolean>;
  validateCreateInput(input: CreateShareInput): ValidationResult;
}

// ============================================================================
// ADR-147 — Share Surface primitives (pre-existing)
// ============================================================================

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
