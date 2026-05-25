'use client';

/**
 * ADR-366 Phase 9 / C.1.a — BIM Animations client-side Firestore CRUD.
 *
 * Mirror of BimCommentsService + BimDimensions3DService pattern:
 *  - Direct setDoc/updateDoc/deleteDoc via Firebase client SDK.
 *  - Audit trail written by CDC trigger on document change (ADR-195) —
 *    entityType 'bim_animation' added to AuditEntityType union.
 *  - subscribeByProject uses firestoreQueryService (companyId auto-applied).
 *  - subscribeRenderJobs uses firestoreQueryService.subscribeSubcollection (SSoT).
 *
 * Render job CRUD is foundation for C.1.c — C.1.a καλύπτει μόνο
 * persistence shape. Actual render queue management arrives σε C.1.c.
 */

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  orderBy,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import {
  generateBimAnimationId,
  generateBimRenderJobId,
} from '@/services/enterprise-id.service';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import type {
  AnimationCodec,
  AnimationConfig,
  BimAnimationDoc,
  RenderConfig,
  RenderJobDoc,
  RenderJobStatus,
} from '../animation/animation-types';

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface CreateAnimationInput {
  readonly projectId: string;
  readonly companyId: string;
  readonly createdBy: string;
  readonly name: string;
  readonly config: AnimationConfig;
  readonly codec?: AnimationCodec;
  readonly renderConfig?: RenderConfig;
}

export interface UpdateAnimationInput {
  readonly name?: string;
  readonly config?: Partial<AnimationConfig>;
  readonly codec?: AnimationCodec;
  readonly renderConfig?: RenderConfig;
  readonly updatedBy: string;
}

export interface CreateRenderJobInput {
  readonly animationId: string;
  readonly companyId: string;
  readonly status?: RenderJobStatus;
}

export interface UpdateRenderJobInput {
  readonly status?: RenderJobStatus;
  readonly progress?: number;
  readonly lastSampleCount?: number;
  readonly lastWaypointIndex?: number;
  readonly outputAssetId?: string;
  readonly errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CODEC: AnimationCodec = 'h264';
const DEFAULT_RENDER_CONFIG: RenderConfig = {
  width: 1920,
  height: 1080,
  qualityPreset: 'standard',
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const BimAnimationsService = {
  async createAnimation(input: CreateAnimationInput): Promise<string> {
    const id = generateBimAnimationId();
    const payload = {
      id,
      projectId: input.projectId,
      companyId: input.companyId,
      name: input.name,
      durationSec: input.config.durationSec,
      fps: input.config.fps,
      axis: input.config.axis,
      direction: input.config.direction,
      waypoints: input.config.waypoints,
      splitTracks: input.config.splitTracks,
      codec: input.codec ?? DEFAULT_CODEC,
      renderConfig: input.renderConfig ?? DEFAULT_RENDER_CONFIG,
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const ref = doc(db, COLLECTIONS.BIM_ANIMATIONS, id);
    await setDoc(ref, payload);
    return id;
  },

  async updateAnimation(
    animationId: string,
    patch: UpdateAnimationInput,
  ): Promise<void> {
    const ref = doc(db, COLLECTIONS.BIM_ANIMATIONS, animationId);
    const updates: Record<string, unknown> = {
      updatedBy: patch.updatedBy,
      updatedAt: serverTimestamp(),
    };
    if (patch.name !== undefined) updates['name'] = patch.name;
    if (patch.codec !== undefined) updates['codec'] = patch.codec;
    if (patch.renderConfig !== undefined) updates['renderConfig'] = patch.renderConfig;
    if (patch.config) {
      const cfg = patch.config;
      if (cfg.durationSec !== undefined) updates['durationSec'] = cfg.durationSec;
      if (cfg.fps !== undefined) updates['fps'] = cfg.fps;
      if (cfg.axis !== undefined) updates['axis'] = cfg.axis;
      if (cfg.direction !== undefined) updates['direction'] = cfg.direction;
      if (cfg.splitTracks !== undefined) updates['splitTracks'] = cfg.splitTracks;
      if (cfg.waypoints !== undefined) updates['waypoints'] = cfg.waypoints;
    }
    await updateDoc(ref, updates);
  },

  async deleteAnimation(animationId: string): Promise<void> {
    const ref = doc(db, COLLECTIONS.BIM_ANIMATIONS, animationId);
    await deleteDoc(ref);
  },

  async getAnimation(animationId: string): Promise<BimAnimationDoc | null> {
    const ref = doc(db, COLLECTIONS.BIM_ANIMATIONS, animationId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as BimAnimationDoc;
  },

  subscribeByProject(
    projectId: string,
    onChange: (animations: readonly BimAnimationDoc[]) => void,
    onError?: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribe<BimAnimationDoc>(
      'BIM_ANIMATIONS',
      (result) => onChange(result.documents),
      (err) => onError?.(err),
      { constraints: [where('projectId', '==', projectId)] },
    );
  },

  // ---------------------------------------------------------------------------
  // Render Jobs (foundation για C.1.c)
  // ---------------------------------------------------------------------------

  async createRenderJob(input: CreateRenderJobInput): Promise<string> {
    const id = generateBimRenderJobId();
    const animationRef = doc(db, COLLECTIONS.BIM_ANIMATIONS, input.animationId);
    const jobRef = doc(
      collection(animationRef, SUBCOLLECTIONS.BIM_RENDER_JOBS),
      id,
    );
    await setDoc(jobRef, {
      id,
      animationId: input.animationId,
      companyId: input.companyId,
      status: input.status ?? 'queued',
      progress: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  },

  async updateRenderJob(
    animationId: string,
    jobId: string,
    patch: UpdateRenderJobInput,
  ): Promise<void> {
    const animationRef = doc(db, COLLECTIONS.BIM_ANIMATIONS, animationId);
    const jobRef = doc(
      collection(animationRef, SUBCOLLECTIONS.BIM_RENDER_JOBS),
      jobId,
    );
    const updates: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (patch.status !== undefined) updates['status'] = patch.status;
    if (patch.progress !== undefined) updates['progress'] = patch.progress;
    if (patch.lastSampleCount !== undefined) updates['lastSampleCount'] = patch.lastSampleCount;
    if (patch.lastWaypointIndex !== undefined) updates['lastWaypointIndex'] = patch.lastWaypointIndex;
    if (patch.outputAssetId !== undefined) updates['outputAssetId'] = patch.outputAssetId;
    if (patch.errorMessage !== undefined) updates['errorMessage'] = patch.errorMessage;
    await updateDoc(jobRef, updates);
  },

  async deleteRenderJob(animationId: string, jobId: string): Promise<void> {
    const animationRef = doc(db, COLLECTIONS.BIM_ANIMATIONS, animationId);
    const jobRef = doc(
      collection(animationRef, SUBCOLLECTIONS.BIM_RENDER_JOBS),
      jobId,
    );
    await deleteDoc(jobRef);
  },

  subscribeRenderJobs(
    animationId: string,
    onChange: (jobs: readonly RenderJobDoc[]) => void,
    onError?: (err: Error) => void,
  ): Unsubscribe {
    return firestoreQueryService.subscribeSubcollection<RenderJobDoc>(
      'BIM_ANIMATIONS',
      animationId,
      SUBCOLLECTIONS.BIM_RENDER_JOBS,
      (result) => onChange(result.documents),
      (err) => onError?.(err),
      { constraints: [orderBy('createdAt', 'asc')], skipEqualityGuard: false },
    );
  },
} as const;
