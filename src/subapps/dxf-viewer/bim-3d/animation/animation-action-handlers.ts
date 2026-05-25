'use client';

/**
 * ADR-366 Phase 9 / C.1.c — Animation action handlers.
 *
 * Extracted from useDxfViewerCallbacks to keep that file under the 500-line
 * Google SRP limit (N.7.1). Each handler is a self-contained async function
 * that reads AnimationStore + RenderQueueStore SSoTs and writes through
 * BimAnimationsService.
 *
 * Auto-save policy (ADR-366 §C.1.c): export auto-creates a `bim_animation`
 * document when `loadedDocId === null`. Default name = `defaultName` i18n
 * key, parameterised with the current HH:mm timestamp.
 */

import type { TFunction } from 'i18next';
import { useAnimationStore, selectAnimationConfig } from './AnimationStore';
import { useRenderQueueStore } from './RenderQueueStore';
import { BimAnimationsService } from '../services/bim-animations.service';

export interface AnimationActionDeps {
  readonly userId: string;
  readonly companyId: string;
  readonly projectId: string;
  readonly notifications: {
    readonly success: (message: string) => void;
    readonly error: (message: string) => void;
  };
  readonly t: TFunction;
}

interface AnimationActionContext {
  readonly deps: AnimationActionDeps;
}

function buildDefaultName(t: TFunction): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return t('animation.defaultName', { time: `${hh}:${mm}` });
}

async function ensureAnimationSaved(
  ctx: AnimationActionContext,
): Promise<string | null> {
  const store = useAnimationStore.getState();
  const config = selectAnimationConfig(store);
  if (store.loadedDocId) {
    try {
      await BimAnimationsService.updateAnimation(store.loadedDocId, {
        config,
        updatedBy: ctx.deps.userId,
      });
      return store.loadedDocId;
    } catch (err) {
      ctx.deps.notifications.error(
        ctx.deps.t('animation.notification.saveError', {
          reason: err instanceof Error ? err.message : String(err),
        }),
      );
      return null;
    }
  }
  try {
    const name = buildDefaultName(ctx.deps.t);
    const animationId = await BimAnimationsService.createAnimation({
      projectId: ctx.deps.projectId,
      companyId: ctx.deps.companyId,
      createdBy: ctx.deps.userId,
      name,
      config,
    });
    // Reflect the persisted id locally so subsequent saves UPDATE.
    useAnimationStore.setState({ loadedDocId: animationId });
    return animationId;
  } catch (err) {
    ctx.deps.notifications.error(
      ctx.deps.t('animation.notification.saveError', {
        reason: err instanceof Error ? err.message : String(err),
      }),
    );
    return null;
  }
}

export async function handleAnimationSave(deps: AnimationActionDeps): Promise<void> {
  const animationId = await ensureAnimationSaved({ deps });
  if (!animationId) return;
  deps.notifications.success(
    deps.t('animation.notification.saveSuccess', {
      name: buildDefaultName(deps.t),
    }),
  );
}

export async function handleAnimationExport(deps: AnimationActionDeps): Promise<void> {
  const store = useAnimationStore.getState();
  const config = selectAnimationConfig(store);

  if (config.waypoints.length < 2) {
    deps.notifications.error(deps.t('animation.notification.exportNeedsTwoWaypoints'));
    return;
  }
  if (!deps.companyId || !deps.projectId) {
    deps.notifications.error(deps.t('animation.notification.exportContextMissing'));
    return;
  }

  const animationId = await ensureAnimationSaved({ deps });
  if (!animationId) return;

  const animationName = buildDefaultName(deps.t);
  const totalFrames = Math.max(2, Math.round(config.durationSec * config.fps));

  let jobId: string;
  try {
    jobId = await BimAnimationsService.createRenderJob({
      animationId,
      companyId: deps.companyId,
    });
  } catch (err) {
    deps.notifications.error(
      deps.t('animation.notification.renderFailed', {
        name: animationName,
        reason: err instanceof Error ? err.message : String(err),
      }),
    );
    return;
  }

  useRenderQueueStore.getState().enqueue({
    jobId,
    animationId,
    animationName,
    totalFrames,
  });
  deps.notifications.success(
    deps.t('animation.notification.renderStarted', { name: animationName }),
  );
}
