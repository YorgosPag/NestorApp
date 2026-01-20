/**
 * =============================================================================
 * 🏢 ENTERPRISE: VideoPlayer Component
 * =============================================================================
 *
 * Custom video player with enterprise-grade controls and accessibility.
 * Integrates with centralized design system.
 *
 * @module components/shared/files/media/VideoPlayer
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * Features:
 * - Native HTML5 video with custom controls
 * - Play/Pause, Volume, Progress
 * - Fullscreen support
 * - Keyboard navigation (ARIA)
 * - Responsive design
 */

'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { FileRecord } from '@/types/file-record';

// ============================================================================
// TYPES
// ============================================================================

export interface VideoPlayerProps {
  /** File record containing video URL */
  file: FileRecord;
  /** Auto-play on mount */
  autoPlay?: boolean;
  /** Show controls */
  showControls?: boolean;
  /** Callback when video ends */
  onEnded?: () => void;
  /** Callback for errors */
  onError?: (error: string) => void;
  /** Custom className */
  className?: string;
}

interface VideoState {
  isPlaying: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  isLoading: boolean;
  hasError: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  buffered: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SKIP_SECONDS = 10;
const VOLUME_STEP = 0.1;

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Format time in MM:SS or HH:MM:SS
 */
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * 🏢 ENTERPRISE: Video Player Component
 *
 * Full-featured video player with:
 * - Custom controls overlay
 * - Progress bar with buffering
 * - Volume control
 * - Fullscreen toggle
 * - Keyboard shortcuts
 */
export function VideoPlayer({
  file,
  autoPlay = false,
  showControls = true,
  onEnded,
  onError,
  className,
}: VideoPlayerProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation('files');

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<VideoState>({
    isPlaying: false,
    isMuted: false,
    isFullscreen: false,
    isLoading: true,
    hasError: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    buffered: 0,
  });

  const [showControlsOverlay, setShowControlsOverlay] = useState(true);
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // =========================================================================
  // CONTROL VISIBILITY
  // =========================================================================

  const resetHideControlsTimer = useCallback(() => {
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }
    setShowControlsOverlay(true);

    if (state.isPlaying) {
      hideControlsTimeoutRef.current = setTimeout(() => {
        setShowControlsOverlay(false);
      }, 3000);
    }
  }, [state.isPlaying]);

  useEffect(() => {
    return () => {
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
    };
  }, []);

  // =========================================================================
  // VIDEO EVENT HANDLERS
  // =========================================================================

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setState(prev => ({
        ...prev,
        duration: video.duration,
        isLoading: false,
      }));
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setState(prev => ({
        ...prev,
        currentTime: video.currentTime,
      }));
    }
  }, []);

  const handleProgress = useCallback(() => {
    const video = videoRef.current;
    if (video && video.buffered.length > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      const bufferedPercent = (bufferedEnd / video.duration) * 100;
      setState(prev => ({
        ...prev,
        buffered: bufferedPercent,
      }));
    }
  }, []);

  const handleEnded = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: false }));
    onEnded?.();
  }, [onEnded]);

  const handleError = useCallback(() => {
    setState(prev => ({ ...prev, hasError: true, isLoading: false }));
    onError?.(t('media.videoError'));
  }, [onError, t]);

  const handleWaiting = useCallback(() => {
    setState(prev => ({ ...prev, isLoading: true }));
  }, []);

  const handleCanPlay = useCallback(() => {
    setState(prev => ({ ...prev, isLoading: false }));
  }, []);

  // =========================================================================
  // CONTROL HANDLERS
  // =========================================================================

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (state.isPlaying) {
      video.pause();
      setState(prev => ({ ...prev, isPlaying: false }));
    } else {
      video.play().catch(() => {
        // Auto-play may be blocked
      });
      setState(prev => ({ ...prev, isPlaying: true }));
    }
    resetHideControlsTimer();
  }, [state.isPlaying, resetHideControlsTimer]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setState(prev => ({ ...prev, isMuted: video.muted }));
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    video.muted = newVolume === 0;
    setState(prev => ({
      ...prev,
      volume: newVolume,
      isMuted: newVolume === 0,
    }));
  }, []);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    const progress = progressRef.current;
    if (!video || !progress) return;

    const rect = progress.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * video.duration;
    video.currentTime = newTime;
    setState(prev => ({ ...prev, currentTime: newTime }));
  }, []);

  const skip = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
    video.currentTime = newTime;
    setState(prev => ({ ...prev, currentTime: newTime }));
    resetHideControlsTimer();
  }, [resetHideControlsTimer]);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setState(prev => ({ ...prev, isFullscreen: false }));
      } else {
        await container.requestFullscreen();
        setState(prev => ({ ...prev, isFullscreen: true }));
      }
    } catch {
      // Fullscreen may not be supported
    }
  }, []);

  // =========================================================================
  // KEYBOARD NAVIGATION
  // =========================================================================

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        skip(-SKIP_SECONDS);
        break;
      case 'ArrowRight':
        e.preventDefault();
        skip(SKIP_SECONDS);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (videoRef.current) {
          const newVolume = Math.min(1, state.volume + VOLUME_STEP);
          videoRef.current.volume = newVolume;
          setState(prev => ({ ...prev, volume: newVolume, isMuted: false }));
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (videoRef.current) {
          const newVolume = Math.max(0, state.volume - VOLUME_STEP);
          videoRef.current.volume = newVolume;
          setState(prev => ({ ...prev, volume: newVolume, isMuted: newVolume === 0 }));
        }
        break;
      case 'm':
        e.preventDefault();
        toggleMute();
        break;
      case 'f':
        e.preventDefault();
        toggleFullscreen();
        break;
    }
  }, [togglePlay, skip, toggleMute, toggleFullscreen, state.volume]);

  // =========================================================================
  // RENDER
  // =========================================================================

  const progressPercent = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  if (state.hasError) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center bg-muted rounded-lg p-8',
          className
        )}
      >
        <p className={cn('text-sm', colors.text.muted)}>{t('media.videoError')}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={t('media.videoPlayer')}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseMove={resetHideControlsTimer}
      onMouseLeave={() => state.isPlaying && setShowControlsOverlay(false)}
      className={cn(
        'relative bg-black rounded-lg overflow-hidden',
        'focus:outline-none focus:ring-2 focus:ring-ring',
        className
      )}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={file.downloadUrl ?? undefined}
        autoPlay={autoPlay}
        playsInline
        onClick={togglePlay}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onProgress={handleProgress}
        onEnded={handleEnded}
        onError={handleError}
        onWaiting={handleWaiting}
        onCanPlay={handleCanPlay}
        className="w-full h-full object-contain"
      />

      {/* Loading Overlay */}
      {state.isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className={cn(iconSizes.xl, 'animate-spin text-white')} />
        </div>
      )}

      {/* Play Button Overlay (center) */}
      {!state.isPlaying && !state.isLoading && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label={t('media.play')}
          className={cn(
            'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
            'w-16 h-16 rounded-full bg-white/90 flex items-center justify-center',
            'transition-transform duration-200 hover:scale-110',
            'focus:outline-none focus:ring-2 focus:ring-ring'
          )}
        >
          <Play className="w-8 h-8 text-primary ml-1" fill="currentColor" />
        </button>
      )}

      {/* Controls Overlay */}
      {showControls && (
        <div
          className={cn(
            'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent',
            'p-4 transition-opacity duration-300',
            showControlsOverlay ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          {/* Progress Bar */}
          <div
            ref={progressRef}
            role="slider"
            aria-label={t('media.progress')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progressPercent)}
            onClick={handleSeek}
            className="relative h-1 bg-white/30 rounded-full cursor-pointer mb-3 group"
          >
            {/* Buffered */}
            <div
              className="absolute inset-y-0 left-0 bg-white/50 rounded-full"
              style={{ width: `${state.buffered}%` }}
            />
            {/* Progress */}
            <div
              className="absolute inset-y-0 left-0 bg-primary rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
            {/* Thumb */}
            <div
              className={cn(
                'absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full',
                'opacity-0 group-hover:opacity-100 transition-opacity'
              )}
              style={{ left: `calc(${progressPercent}% - 6px)` }}
            />
          </div>

          {/* Controls Row */}
          <div className="flex items-center gap-2">
            {/* Skip Back */}
            <button
              type="button"
              onClick={() => skip(-SKIP_SECONDS)}
              aria-label={t('media.skipBack')}
              className="p-1.5 text-white/80 hover:text-white transition-colors"
            >
              <SkipBack className={iconSizes.sm} />
            </button>

            {/* Play/Pause */}
            <button
              type="button"
              onClick={togglePlay}
              aria-label={state.isPlaying ? t('media.pause') : t('media.play')}
              className="p-1.5 text-white hover:text-white transition-colors"
            >
              {state.isPlaying ? (
                <Pause className={iconSizes.md} />
              ) : (
                <Play className={iconSizes.md} />
              )}
            </button>

            {/* Skip Forward */}
            <button
              type="button"
              onClick={() => skip(SKIP_SECONDS)}
              aria-label={t('media.skipForward')}
              className="p-1.5 text-white/80 hover:text-white transition-colors"
            >
              <SkipForward className={iconSizes.sm} />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1 ml-2">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={state.isMuted ? t('media.unmute') : t('media.mute')}
                className="p-1.5 text-white/80 hover:text-white transition-colors"
              >
                {state.isMuted || state.volume === 0 ? (
                  <VolumeX className={iconSizes.sm} />
                ) : (
                  <Volume2 className={iconSizes.sm} />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={state.isMuted ? 0 : state.volume}
                onChange={handleVolumeChange}
                aria-label={t('media.volume')}
                className="w-16 h-1 accent-primary cursor-pointer"
              />
            </div>

            {/* Time Display */}
            <span className="text-white text-xs ml-2">
              {formatTime(state.currentTime)} / {formatTime(state.duration)}
            </span>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Fullscreen */}
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={state.isFullscreen ? t('media.exitFullscreen') : t('media.fullscreen')}
              className="p-1.5 text-white/80 hover:text-white transition-colors"
            >
              {state.isFullscreen ? (
                <Minimize className={iconSizes.sm} />
              ) : (
                <Maximize className={iconSizes.sm} />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
