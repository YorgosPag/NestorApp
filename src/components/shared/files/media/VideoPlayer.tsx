/**
 * =============================================================================
 * 🏢 ENTERPRISE: VideoPlayer Component
 * =============================================================================
 *
 * Custom video player with enterprise-grade controls and accessibility.
 *
 * @module components/shared/files/media/VideoPlayer
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipBack, SkipForward } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { FileRecord } from '@/types/file-record';
import { videoPlayerProgressStyles } from './VideoPlayer.styles';
import '@/lib/design-system';

// 🏢 ENTERPRISE: Extracted state hook
import { useVideoPlayerState, formatTime } from './useVideoPlayerState';

// Re-exports
export { formatTime } from './useVideoPlayerState';
export type { VideoState } from './useVideoPlayerState';

export interface VideoPlayerProps {
  file: FileRecord;
  autoPlay?: boolean;
  showControls?: boolean;
  onEnded?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

const SKIP_SECONDS = 10;

export function VideoPlayer({ file, autoPlay = false, showControls = true, onEnded, onError, className }: VideoPlayerProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation('files');

  const {
    videoRef, containerRef, progressRef,
    state, showControlsOverlay, setShowControlsOverlay,
    progressPercent, resetHideControlsTimer,
    handleLoadedMetadata, handleTimeUpdate, handleProgress,
    handleEnded, handleError, handleWaiting, handleCanPlay,
    togglePlay, toggleMute, handleVolumeChange, handleSeek,
    skip, toggleFullscreen, handleKeyDown,
  } = useVideoPlayerState({ onEnded, onError });

  if (state.hasError) {
    return (
      <div className={cn('flex flex-col items-center justify-center bg-muted rounded-lg p-2', className)}>
        <p className={cn('text-sm', colors.text.muted)}>{t('media.videoError')}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef} role="application" aria-label={t('media.videoPlayer')} tabIndex={0}
      onKeyDown={handleKeyDown} onMouseMove={resetHideControlsTimer}
      onMouseLeave={() => state.isPlaying && setShowControlsOverlay(false)}
      className={cn('relative bg-black rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-ring', className)}
    >
      <video
        ref={videoRef} src={file.downloadUrl ?? undefined} autoPlay={autoPlay} playsInline
        onClick={togglePlay} onLoadedMetadata={handleLoadedMetadata} onTimeUpdate={handleTimeUpdate}
        onProgress={handleProgress} onEnded={handleEnded} onError={handleError}
        onWaiting={handleWaiting} onCanPlay={handleCanPlay} className="w-full h-full object-contain"
      />

      {state.isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Spinner size="large" color="inherit" className="text-white" />
        </div>
      )}

      {!state.isPlaying && !state.isLoading && (
        <button type="button" onClick={togglePlay} aria-label={t('media.play')}
          className={cn('absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2', 'w-16 h-16 rounded-full bg-white/90 flex items-center justify-center', 'transition-transform duration-200 hover:scale-110', 'focus:outline-none focus:ring-2 focus:ring-ring')}>
          <Play className="w-8 h-8 text-primary ml-1" fill="currentColor" />
        </button>
      )}

      {showControls && (
        <div className={cn('absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 transition-opacity duration-300', showControlsOverlay ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
          {/* Progress Bar */}
          <div ref={progressRef} role="slider" aria-label={t('media.progress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressPercent)} onClick={handleSeek} className="relative h-1 bg-white/30 rounded-full cursor-pointer mb-2 group">
            <div className="absolute inset-y-0 left-0 bg-white/50 rounded-full" style={videoPlayerProgressStyles.buffered(state.buffered)} />
            <div className="absolute inset-y-0 left-0 bg-primary rounded-full" style={videoPlayerProgressStyles.played(progressPercent)} />
            <div className={cn('absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full', 'opacity-0 group-hover:opacity-100 transition-opacity')} style={videoPlayerProgressStyles.thumb(progressPercent)} />
          </div>

          {/* Controls Row */}
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => skip(-SKIP_SECONDS)} aria-label={t('media.skipBack')} className="p-1.5 text-white/80 hover:text-white transition-colors">
              <SkipBack className={iconSizes.sm} />
            </button>
            <button type="button" onClick={togglePlay} aria-label={state.isPlaying ? t('media.pause') : t('media.play')} className="p-1.5 text-white hover:text-white transition-colors">
              {state.isPlaying ? <Pause className={iconSizes.md} /> : <Play className={iconSizes.md} />}
            </button>
            <button type="button" onClick={() => skip(SKIP_SECONDS)} aria-label={t('media.skipForward')} className="p-1.5 text-white/80 hover:text-white transition-colors">
              <SkipForward className={iconSizes.sm} />
            </button>

            <div className="flex items-center gap-1 ml-2">
              <button type="button" onClick={toggleMute} aria-label={state.isMuted ? t('media.unmute') : t('media.mute')} className="p-1.5 text-white/80 hover:text-white transition-colors">
                {state.isMuted || state.volume === 0 ? <VolumeX className={iconSizes.sm} /> : <Volume2 className={iconSizes.sm} />}
              </button>
              <input type="range" min="0" max="1" step="0.1" value={state.isMuted ? 0 : state.volume} onChange={handleVolumeChange} aria-label={t('media.volume')} className="w-16 h-1 accent-primary cursor-pointer" />
            </div>

            <span className="text-white text-xs ml-2">{formatTime(state.currentTime)} / {formatTime(state.duration)}</span>
            <div className="flex-1" />

            <button type="button" onClick={toggleFullscreen} aria-label={state.isFullscreen ? t('media.exitFullscreen') : t('media.fullscreen')} className="p-1.5 text-white/80 hover:text-white transition-colors">
              {state.isFullscreen ? <Minimize className={iconSizes.sm} /> : <Maximize className={iconSizes.sm} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
