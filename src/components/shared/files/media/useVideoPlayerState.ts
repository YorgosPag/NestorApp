/**
 * useVideoPlayerState — All video state + event/control handlers
 * Extracted from VideoPlayer for file-size compliance.
 *
 * @module components/shared/files/media/useVideoPlayerState
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ============================================================================
// TYPES
// ============================================================================

export interface VideoState {
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

export function formatTime(seconds: number): string {
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
// HOOK
// ============================================================================

interface UseVideoPlayerParams {
  onEnded?: () => void;
  onError?: (error: string) => void;
}

export function useVideoPlayerState({ onEnded, onError }: UseVideoPlayerParams) {
  const { t } = useTranslation(['files', 'files-media']);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<VideoState>({
    isPlaying: false, isMuted: false, isFullscreen: false,
    isLoading: true, hasError: false,
    currentTime: 0, duration: 0, volume: 1, buffered: 0,
  });

  const [showControlsOverlay, setShowControlsOverlay] = useState(true);
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Control visibility
  const resetHideControlsTimer = useCallback(() => {
    if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
    setShowControlsOverlay(true);
    if (state.isPlaying) {
      hideControlsTimeoutRef.current = setTimeout(() => setShowControlsOverlay(false), 3000);
    }
  }, [state.isPlaying]);

  useEffect(() => {
    return () => { if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current); };
  }, []);

  // Video event handlers
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video) setState(prev => ({ ...prev, duration: video.duration, isLoading: false }));
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video) setState(prev => ({ ...prev, currentTime: video.currentTime }));
  }, []);

  const handleProgress = useCallback(() => {
    const video = videoRef.current;
    if (video && video.buffered.length > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      setState(prev => ({ ...prev, buffered: (bufferedEnd / video.duration) * 100 }));
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

  const handleWaiting = useCallback(() => { setState(prev => ({ ...prev, isLoading: true })); }, []);
  const handleCanPlay = useCallback(() => { setState(prev => ({ ...prev, isLoading: false })); }, []);

  // Control handlers
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (state.isPlaying) {
      video.pause();
      setState(prev => ({ ...prev, isPlaying: false }));
    } else {
      video.play().catch(() => { /* Auto-play may be blocked */ });
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
    setState(prev => ({ ...prev, volume: newVolume, isMuted: newVolume === 0 }));
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
    } catch { /* Fullscreen may not be supported */ }
  }, []);

  // Keyboard
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case ' ': case 'k': e.preventDefault(); togglePlay(); break;
      case 'ArrowLeft': e.preventDefault(); skip(-SKIP_SECONDS); break;
      case 'ArrowRight': e.preventDefault(); skip(SKIP_SECONDS); break;
      case 'ArrowUp':
        e.preventDefault();
        if (videoRef.current) {
          const up = Math.min(1, state.volume + VOLUME_STEP);
          videoRef.current.volume = up;
          setState(prev => ({ ...prev, volume: up, isMuted: false }));
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (videoRef.current) {
          const down = Math.max(0, state.volume - VOLUME_STEP);
          videoRef.current.volume = down;
          setState(prev => ({ ...prev, volume: down, isMuted: down === 0 }));
        }
        break;
      case 'm': e.preventDefault(); toggleMute(); break;
      case 'f': e.preventDefault(); toggleFullscreen(); break;
    }
  }, [togglePlay, skip, toggleMute, toggleFullscreen, state.volume]);

  const progressPercent = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  return {
    videoRef, containerRef, progressRef,
    state, showControlsOverlay, setShowControlsOverlay,
    progressPercent,
    resetHideControlsTimer,
    handleLoadedMetadata, handleTimeUpdate, handleProgress,
    handleEnded, handleError, handleWaiting, handleCanPlay,
    togglePlay, toggleMute, handleVolumeChange, handleSeek,
    skip, toggleFullscreen, handleKeyDown,
  };
}
