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
  /**
   * ADR-315 Α14 — **εσωτερική** ετικέτα «για ποιον» (πρότυπο DocSend). Τη βλέπει μόνο ο
   * μισθωτής στη λίστα συνδέσμων· **δεν** περνά ποτέ στην προβολή του παραλήπτη — γι' αυτό
   * **δεν** υπάρχει στο `ShareRecord`, που τροφοδοτεί τους resolvers.
   */
  label?: string;
  showcaseMeta?: ShowcaseShareMeta;
  contactMeta?: ContactShareMeta;
  fileMeta?: FileShareMeta;
}

export interface CreateShareResult {
  shareId: string;
  token: string;
  expiresAt: string;
}

// =============================================================================
// ΔΙΑΧΕΙΡΙΣΗ ΕΝΕΡΓΩΝ ΣΥΝΔΕΣΜΩΝ (ADR-315 §5 · Α11–Α14)
// =============================================================================

/**
 * Κατάσταση ενός **ενεργού** (μη ανακληθέντος, μη ληγμένου) συνδέσμου, όπως τη χρειάζεται ο κάτοχος:
 * `exhausted` = εξάντλησε το όριο ανοιγμάτων · `locked` = κλειδωμένος από λάθος κωδικούς (Α4).
 */
export type ShareLinkState = 'active' | 'exhausted' | 'locked';

/**
 * Ένας σύνδεσμος στη λίστα του κατόχου — η **μόνη** προβολή που φεύγει από τη διαδρομή λίστας.
 *
 * ⛔ Χτίζεται **μόνο** από το `toShareLinkSummary` (ρητή λίστα πεδίων). Κανένα hash, κανένα
 * διακριτικό, κανένας μετρητής αποτυχιών κωδικού — ο σύνδεσμος **δεν** ξαναδείχνεται μετά τη
 * δημιουργία (πρότυπο GitHub PAT).
 */
export interface ShareLinkSummary {
  readonly shareId: string;
  readonly label: string | null;
  readonly note: string | null;
  readonly createdAt: string | null;
  readonly createdBy: { readonly uid: string; readonly name: string | null };
  readonly expiresAt: string;
  readonly requiresPassword: boolean;
  readonly maxAccesses: number;
  readonly accessCount: number;
  readonly lastAccessedAt: string | null;
  readonly lockedUntil: string | null;
  readonly state: ShareLinkState;
}

export interface ShareLinksListResult {
  readonly links: readonly ShareLinkSummary[];
  /** Υπάρχουν περισσότεροι από όσους επιστράφηκαν (όριο σελίδας). */
  readonly hasMore: boolean;
}

/**
 * Αλλαγή ρυθμίσεων **χωρίς αλλαγή URL** (Α13, πρότυπο Dropbox/Box). Απόν πεδίο = αμετάβλητο.
 * `password: null` = αφαίρεση κωδικού · `label: null` = αφαίρεση ετικέτας.
 */
export interface UpdateShareRequest {
  readonly label?: string | null;
  readonly expiresInHours?: number;
  readonly password?: string | null;
  readonly maxAccesses?: number;
}

export interface RevokeAllSharesRequest {
  readonly entityType: ShareEntityType;
  readonly entityId: string;
  /** «Ανάκληση όλων **εκτός από αυτόν**». */
  readonly exceptShareId?: string;
}

export interface RevokeAllSharesResult {
  readonly revoked: number;
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
