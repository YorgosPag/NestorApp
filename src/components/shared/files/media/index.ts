/**
 * =============================================================================
 * 🏢 ENTERPRISE: Media Gallery Components - Barrel Export
 * =============================================================================
 *
 * Centralized media gallery system for photos and videos.
 *
 * @module components/shared/files/media
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * Usage:
 * ```tsx
 * import { MediaGallery, MediaCard, VideoPlayer } from '@/components/shared/files/media';
 *
 * <MediaGallery
 *   files={mediaFiles}
 *   onDelete={handleDelete}
 *   onDownload={handleDownload}
 * />
 * ```
 */

// Main Components
export { MediaGallery } from './MediaGallery';
export type { MediaGalleryProps } from './MediaGallery';

export { MediaCard } from './MediaCard';
export type { MediaCardProps } from './MediaCard';

export { VideoPlayer } from './VideoPlayer';
export type { VideoPlayerProps } from './VideoPlayer';

// Hooks
export { useMediaGallery } from './hooks/useMediaGallery';
export type {
  MediaViewMode,
  MediaSortField,
  MediaSortDirection,
  MediaTypeFilter,
  MediaGalleryState,
  UseMediaGalleryReturn,
} from './hooks/useMediaGallery';
