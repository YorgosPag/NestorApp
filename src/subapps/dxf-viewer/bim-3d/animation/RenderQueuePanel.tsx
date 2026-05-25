'use client';

/**
 * ADR-366 Phase 9 / C.1.c — RenderQueuePanel.
 *
 * Floating3DPanel 8th tab. Visible only when RenderQueueStore.jobs.length > 0
 * (the parent panel gates rendering via selectAnyJobs). Each job row
 * presents:
 *  - Animation name
 *  - Status badge (semantic CSS vars per ADR-365)
 *  - Progress bar (semantic <progress> element)
 *  - Frame counter + ETA
 *  - Actions: cancel / retry / download / remove
 *
 * All side effects (cancel, retry, remove, download) go through
 * RenderQueueStore actions — this component owns presentation only.
 */

import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  selectAllJobs,
  useRenderQueueStore,
  type JobRecord,
} from './RenderQueueStore';
import type { RenderJobStatus } from './animation-types';

export function RenderQueuePanel(): JSX.Element {
  const { t } = useTranslation('bim3d');
  const jobs = useSyncExternalStore(
    useRenderQueueStore.subscribe,
    () => selectAllJobs(useRenderQueueStore.getState()),
    () => selectAllJobs(useRenderQueueStore.getState()),
  );
  const clearCompleted = useRenderQueueStore((s) => s.clearCompleted);

  const hasCompleted = jobs.some(
    (j) => j.status === 'done' || j.status === 'failed' || j.status === 'cancelled',
  );

  return (
    <section
      className="flex flex-col gap-2 p-2 text-xs text-white/85"
      aria-label={t('floatingPanel.tabs.renders')}
    >
      <header className="flex items-center justify-between">
        <h3 className="m-0 text-xs font-semibold text-white/90">
          {t('animation.queue.title', { count: jobs.length })}
        </h3>
        {hasCompleted && (
          <button
            type="button"
            onClick={() => clearCompleted()}
            className="rounded px-1.5 py-0.5 text-[10px] text-white/60 transition-colors hover:bg-white/10 hover:text-white/90"
          >
            {t('animation.queue.clearCompleted')}
          </button>
        )}
      </header>

      {jobs.length === 0 ? (
        <p className="m-0 px-1 py-2 text-white/50">{t('animation.queue.empty')}</p>
      ) : (
        <ul className="flex list-none flex-col gap-2 p-0">
          {jobs.map((job) => (
            <RenderJobRow key={job.jobId} job={job} />
          ))}
        </ul>
      )}
    </section>
  );
}

function RenderJobRow({ job }: { job: JobRecord }): JSX.Element {
  const { t } = useTranslation('bim3d');
  const cancel = useRenderQueueStore((s) => s.cancel);
  const retry = useRenderQueueStore((s) => s.retry);
  const remove = useRenderQueueStore((s) => s.removeJob);

  return (
    <li className="flex flex-col gap-1 rounded border border-white/10 bg-white/[0.03] px-2 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="min-w-0 flex-1 truncate font-medium text-white/90">
              {job.animationName}
            </span>
          </TooltipTrigger>
          <TooltipContent>{job.animationName}</TooltipContent>
        </Tooltip>
        <StatusBadge status={job.status} />
      </div>

      {job.status === 'rendering' && (
        <>
          <progress
            value={job.progress}
            max={100}
            className="h-1.5 w-full overflow-hidden rounded bg-white/10 [&::-webkit-progress-bar]:rounded [&::-webkit-progress-bar]:bg-white/10 [&::-webkit-progress-value]:rounded [&::-webkit-progress-value]:bg-primary"
            aria-label={t('animation.queue.frame', { current: job.currentFrame, total: job.totalFrames })}
          >
            {Math.round(job.progress)}%
          </progress>
          <div className="flex items-center justify-between text-[10px] text-white/55">
            <span>
              {t('animation.queue.frame', { current: job.currentFrame, total: job.totalFrames })}
            </span>
            <span>{computeEtaLabel(job, t)}</span>
          </div>
        </>
      )}

      {job.status === 'failed' && job.errorMessage && (
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="m-0 truncate text-[10px] text-[hsl(var(--text-error))]">
              {job.errorMessage}
            </p>
          </TooltipTrigger>
          <TooltipContent>{job.errorMessage}</TooltipContent>
        </Tooltip>
      )}

      <div className="flex items-center gap-1.5">
        {job.status === 'rendering' && (
          <ActionButton onClick={() => cancel(job.jobId)} label={t('animation.queue.cancel')} />
        )}
        {(job.status === 'failed' || job.status === 'cancelled-resumable') && (
          <ActionButton onClick={() => retry(job.jobId)} label={t('animation.queue.retry')} variant="primary" />
        )}
        {job.status === 'done' && job.blobUrl && (
          <a
            href={job.blobUrl}
            download={`${job.animationName}.mp4`}
            className="rounded bg-primary/80 px-2 py-0.5 text-[10px] font-medium text-white transition-colors hover:bg-primary"
          >
            {t('animation.queue.download')}
          </a>
        )}
        {(job.status === 'done' || job.status === 'failed' || job.status === 'cancelled') && (
          <ActionButton onClick={() => remove(job.jobId)} label={t('animation.queue.remove')} variant="muted" />
        )}
      </div>
    </li>
  );
}

function ActionButton(props: {
  onClick: () => void;
  label: string;
  variant?: 'default' | 'primary' | 'muted';
}): JSX.Element {
  const cls =
    props.variant === 'primary'
      ? 'bg-primary/80 text-white hover:bg-primary'
      : props.variant === 'muted'
      ? 'text-white/50 hover:bg-white/5 hover:text-white/80'
      : 'text-white/75 hover:bg-white/10 hover:text-white';
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${cls}`}
    >
      {props.label}
    </button>
  );
}

function StatusBadge({ status }: { status: RenderJobStatus }): JSX.Element {
  const { t } = useTranslation('bim3d');
  const palette = STATUS_PALETTE[status];
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${palette}`}
      role="status"
    >
      {t(`animation.queue.status.${statusKey(status)}`)}
    </span>
  );
}

function statusKey(status: RenderJobStatus): string {
  if (status === 'cancelled-resumable') return 'cancelledResumable';
  return status;
}

const STATUS_PALETTE: Record<RenderJobStatus, string> = {
  queued: 'bg-white/10 text-white/70',
  rendering: 'bg-[hsl(var(--bg-info))]/30 text-[hsl(var(--text-info))]',
  done: 'bg-[hsl(var(--bg-success))]/30 text-[hsl(var(--text-success))]',
  failed: 'bg-[hsl(var(--bg-error))]/30 text-[hsl(var(--text-error))]',
  cancelled: 'bg-white/10 text-white/55',
  'cancelled-resumable': 'bg-[hsl(var(--bg-warning))]/30 text-[hsl(var(--text-warning))]',
};

function computeEtaLabel(job: JobRecord, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (!job.startedAt || job.currentFrame === 0 || job.totalFrames === 0) return '';
  const elapsedSec = (Date.now() - job.startedAt) / 1000;
  const framesPerSec = job.currentFrame / Math.max(0.001, elapsedSec);
  if (framesPerSec <= 0) return '';
  const remainingFrames = job.totalFrames - job.currentFrame;
  const etaSec = Math.max(0, Math.round(remainingFrames / framesPerSec));
  return t('animation.queue.eta', { seconds: etaSec });
}
