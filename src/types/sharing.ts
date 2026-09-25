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
//   file / contact / property_showcase / project_showcase / building_showcase / storage_showcase
// ============================================================================

export type ShareEntityType =
  | 'file'
  | 'contact'
  | 'property_showcase'
  | 'project_showcase'
  | 'building_showcase'
  | 'storage_showcase'
  | 'parking_showcase'
  | 'vendor_rfq_invite';

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

/**
 * A share as the **owning tenant** sees it (list / revoke UI).
 *
 * ⚠️ ADR-884 Φ0.12: carries **neither** the token **nor** any hash. The raw token
 * exists only in the link (returned once by `POST /api/shares`); the database holds
 * only `tokenHash`, and `passwordHash` never leaves the server.
 */
export interface ShareRecord {
  id: string;
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
  maxAccesses: number;
  accessCount: number;
  lastAccessedAt?: Timestamp | string | null;

  note?: string | null;

  showcaseMeta?: ShowcaseShareMeta | null;
  contactMeta?: ContactShareMeta | null;
  fileMeta?: FileShareMeta | null;
}

/**
 * What the browser sends to `POST /api/shares`. The tenant and the author are
 * **not** part of it: the server takes both from the verified session — a client
 * that could name them could create shares in another company's name.
 */
export type CreateShareRequest = Omit<CreateShareInput, 'companyId' | 'createdBy'>;

/** Full create input — assembled **on the server** from the request + session. */
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

/** The share facts a resolver may read when projecting — never the tenant, never a hash. */
export type ShareProjectionSource = Pick<
  ShareRecord,
  'id' | 'entityType' | 'entityId' | 'note' | 'showcaseMeta' | 'contactMeta' | 'fileMeta'
>;

/** Input of `ShareEntityDefinition.project` — assembled by the server resolver. */
export interface ShareProjectionInput {
  share: ShareProjectionSource;
  /** The shared entity, read by the server (Admin SDK); `null` when it no longer exists. */
  entity: Record<string, unknown> | null;
  /** The raw token the visitor presented — the page needs it to build follow-up URLs. */
  token: string;
}

/**
 * Per-entity share policy (ADR-315 / ADR-699).
 *
 * ADR-884 Φ0.12: `resolve()` (a browser read of the entity) became `project()` — a
 * **pure** function over a document the **server** reads. The browser could never
 * read it anyway: `contacts` / `files` rules deny the anonymous visitor, so contact
 * and file links did not open for recipients without an account. Likewise
 * `canShare` moved to the server (`server/sharing/share-entity-access.ts`), driven
 * by `entityCollection`.
 */
export interface ShareEntityDefinition<T = unknown> {
  /** Firestore collection holding the shared entity. */
  entityCollection: string;
  project(input: ShareProjectionInput): T;
  safePublicProjection(share: ShareRecord): PublicShareData;
  renderPublic(data: T): ReactNode;
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
