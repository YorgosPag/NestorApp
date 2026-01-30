'use client';

/**
 * =============================================================================
 * ATTACHMENT RENDERER - ADR-055 (Enterprise Attachment System)
 * =============================================================================
 *
 * Renders message attachments in ThreadView message bubbles.
 * Supports image previews, document downloads, audio/video players.
 *
 * @module components/crm/inbox/AttachmentRenderer
 * @enterprise ADR-055 - Enterprise Attachment System Consolidation
 */

import React, { useState, useCallback } from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { TRANSITION_PRESETS } from '@/components/ui/effects';
import {
  Image as ImageIcon,
  FileText,
  Music,
  Video,
  Download,
  ExternalLink,
  X,
  MapPin,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MessageAttachment, AttachmentType } from '@/types/conversations';
import { ATTACHMENT_TYPES } from '@/types/conversations';

// ============================================================================
// TYPES
// ============================================================================

interface AttachmentRendererProps {
  /** Array of attachments to render */
  attachments: MessageAttachment[];
  /** Whether this is an outbound message (for styling) */
  isOutbound?: boolean;
  /** Max width for attachment container */
  maxWidth?: string;
}

interface SingleAttachmentProps {
  attachment: MessageAttachment;
  isOutbound?: boolean;
  onImageClick?: (url: string) => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format file size for display
 */
function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get file extension from filename or mime type
 */
function getFileExtension(filename?: string, mimeType?: string): string {
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext) return ext.toUpperCase();
  }
  if (mimeType) {
    const parts = mimeType.split('/');
    if (parts.length > 1) return parts[1].toUpperCase();
  }
  return 'FILE';
}

/**
 * Get icon for attachment type
 */
function getAttachmentIcon(
  type: AttachmentType,
  iconSizes: ReturnType<typeof useIconSizes>
): React.ReactNode {
  switch (type) {
    case ATTACHMENT_TYPES.IMAGE:
      return <ImageIcon className={iconSizes.md} />;
    case ATTACHMENT_TYPES.AUDIO:
      return <Music className={iconSizes.md} />;
    case ATTACHMENT_TYPES.VIDEO:
      return <Video className={iconSizes.md} />;
    case ATTACHMENT_TYPES.LOCATION:
      return <MapPin className={iconSizes.md} />;
    case ATTACHMENT_TYPES.CONTACT:
      return <User className={iconSizes.md} />;
    case ATTACHMENT_TYPES.DOCUMENT:
    default:
      return <FileText className={iconSizes.md} />;
  }
}

// ============================================================================
// IMAGE ATTACHMENT COMPONENT
// ============================================================================

function ImageAttachment({
  attachment,
  isOutbound,
  onImageClick,
}: SingleAttachmentProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation('crm');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const handleClick = useCallback(() => {
    if (attachment.url && onImageClick) {
      onImageClick(attachment.url);
    }
  }, [attachment.url, onImageClick]);

  if (!attachment.url) {
    return null;
  }

  if (hasError) {
    return (
      <div
        className={`
          flex items-center gap-2 p-3 rounded-lg
          ${isOutbound ? 'bg-primary/10' : 'bg-muted'}
        `}
      >
        <ImageIcon className={`${iconSizes.md} ${colors.text.muted}`} />
        <span className={`text-sm ${colors.text.muted}`}>
          {t('inbox.attachments.downloadFailed')}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        relative block rounded-lg overflow-hidden cursor-pointer
        ${TRANSITION_PRESETS.STANDARD_COLORS}
        hover:opacity-90
      `}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted animate-pulse">
          <ImageIcon className={`${iconSizes.lg} ${colors.text.muted}`} />
        </div>
      )}
      <img
        src={attachment.thumbnailUrl || attachment.url}
        alt={attachment.filename || t('inbox.attachments.image')}
        className="max-w-full max-h-64 rounded-lg object-contain"
        onLoad={handleLoad}
        onError={handleError}
      />
      {attachment.filename && (
        <div
          className={`
            absolute bottom-0 left-0 right-0 px-2 py-1
            bg-black/50 text-white text-xs truncate
          `}
        >
          {attachment.filename}
        </div>
      )}
    </button>
  );
}

// ============================================================================
// DOCUMENT ATTACHMENT COMPONENT
// ============================================================================

function DocumentAttachment({
  attachment,
  isOutbound,
}: SingleAttachmentProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation('crm');

  const extension = getFileExtension(attachment.filename, attachment.mimeType);
  const sizeText = formatFileSize(attachment.size);

  return (
    <div
      className={`
        flex items-center gap-3 p-3 rounded-lg
        ${isOutbound ? 'bg-primary/10' : 'bg-muted'}
        ${TRANSITION_PRESETS.STANDARD_COLORS}
      `}
    >
      {/* Icon with extension badge */}
      <div className="relative flex-shrink-0">
        <div
          className={`
            w-10 h-10 flex items-center justify-center rounded-lg
            ${isOutbound ? 'bg-primary/20' : 'bg-background'}
          `}
        >
          <FileText className={`${iconSizes.md} ${isOutbound ? 'text-primary' : colors.text.muted}`} />
        </div>
        <span
          className={`
            absolute -bottom-1 -right-1 px-1 text-[10px] font-bold
            bg-muted-foreground text-background rounded
          `}
        >
          {extension}
        </span>
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${colors.text.primary}`}>
          {attachment.filename || t('inbox.attachments.document')}
        </p>
        {sizeText && (
          <p className={`text-xs ${colors.text.muted}`}>{sizeText}</p>
        )}
      </div>

      {/* Download button */}
      {attachment.url && (
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          download={attachment.filename}
          className={`
            flex-shrink-0 p-2 rounded-lg
            ${isOutbound ? 'hover:bg-primary/20' : 'hover:bg-background'}
            ${TRANSITION_PRESETS.STANDARD_COLORS}
          `}
          aria-label={t('inbox.attachments.download')}
        >
          <Download className={iconSizes.sm} />
        </a>
      )}
    </div>
  );
}

// ============================================================================
// AUDIO ATTACHMENT COMPONENT
// ============================================================================

function AudioAttachment({
  attachment,
  isOutbound,
}: SingleAttachmentProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('crm');

  if (!attachment.url) {
    return null;
  }

  return (
    <div
      className={`
        p-3 rounded-lg
        ${isOutbound ? 'bg-primary/10' : 'bg-muted'}
      `}
    >
      {attachment.filename && (
        <p className={`text-xs font-medium mb-2 truncate ${colors.text.primary}`}>
          {attachment.filename}
        </p>
      )}
      <audio
        controls
        className="w-full max-w-[300px]"
        preload="metadata"
      >
        <source src={attachment.url} type={attachment.mimeType || 'audio/mpeg'} />
        {t('inbox.attachments.unsupportedType')}
      </audio>
    </div>
  );
}

// ============================================================================
// VIDEO ATTACHMENT COMPONENT
// ============================================================================

function VideoAttachment({
  attachment,
  isOutbound,
}: SingleAttachmentProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('crm');

  if (!attachment.url) {
    return null;
  }

  return (
    <div
      className={`
        rounded-lg overflow-hidden
        ${isOutbound ? 'bg-primary/10' : 'bg-muted'}
      `}
    >
      <video
        controls
        className="max-w-full max-h-64"
        preload="metadata"
        poster={attachment.thumbnailUrl}
      >
        <source src={attachment.url} type={attachment.mimeType || 'video/mp4'} />
        {t('inbox.attachments.unsupportedType')}
      </video>
      {attachment.filename && (
        <p className={`text-xs px-3 py-2 truncate ${colors.text.muted}`}>
          {attachment.filename}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// LOCATION ATTACHMENT COMPONENT
// ============================================================================

function LocationAttachment({
  attachment,
  isOutbound,
}: SingleAttachmentProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation('crm');

  // Extract coordinates from metadata if available
  const lat = attachment.metadata?.latitude as number | undefined;
  const lng = attachment.metadata?.longitude as number | undefined;

  const mapsUrl = lat && lng
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : attachment.url;

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`
        flex items-center gap-3 p-3 rounded-lg
        ${isOutbound ? 'bg-primary/10' : 'bg-muted'}
        ${TRANSITION_PRESETS.STANDARD_COLORS}
        hover:opacity-90
      `}
    >
      <div
        className={`
          w-10 h-10 flex items-center justify-center rounded-lg
          ${isOutbound ? 'bg-primary/20' : 'bg-background'}
        `}
      >
        <MapPin className={`${iconSizes.md} text-red-500`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${colors.text.primary}`}>
          📍 Location
        </p>
        {lat && lng && (
          <p className={`text-xs ${colors.text.muted}`}>
            {lat.toFixed(6)}, {lng.toFixed(6)}
          </p>
        )}
      </div>
      <ExternalLink className={iconSizes.sm} />
    </a>
  );
}

// ============================================================================
// CONTACT ATTACHMENT COMPONENT
// ============================================================================

function ContactAttachment({
  attachment,
  isOutbound,
}: SingleAttachmentProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  // Extract contact info from metadata
  const name = attachment.metadata?.name as string | undefined;
  const phone = attachment.metadata?.phone as string | undefined;

  return (
    <div
      className={`
        flex items-center gap-3 p-3 rounded-lg
        ${isOutbound ? 'bg-primary/10' : 'bg-muted'}
      `}
    >
      <div
        className={`
          w-10 h-10 flex items-center justify-center rounded-full
          ${isOutbound ? 'bg-primary/20' : 'bg-background'}
        `}
      >
        <User className={`${iconSizes.md} ${colors.text.muted}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${colors.text.primary}`}>
          {name || 'Contact'}
        </p>
        {phone && (
          <p className={`text-xs ${colors.text.muted}`}>{phone}</p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// LIGHTBOX COMPONENT
// ============================================================================

interface LightboxProps {
  imageUrl: string;
  onClose: () => void;
}

function Lightbox({ imageUrl, onClose }: LightboxProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('crm');

  // Close on escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
        aria-label="Close"
      >
        <X className={iconSizes.md} />
      </button>
      <img
        src={imageUrl}
        alt={t('inbox.attachments.preview')}
        className="max-w-[90vw] max-h-[90vh] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <a
        href={imageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink className={iconSizes.sm} />
        {t('inbox.attachments.openInNewTab')}
      </a>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * AttachmentRenderer - Renders message attachments
 *
 * @enterprise ADR-055 - Enterprise Attachment System
 *
 * @example
 * ```tsx
 * <AttachmentRenderer
 *   attachments={message.content.attachments}
 *   isOutbound={message.direction === 'outbound'}
 * />
 * ```
 */
export function AttachmentRenderer({
  attachments,
  isOutbound = false,
  maxWidth = '100%',
}: AttachmentRendererProps) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const handleImageClick = useCallback((url: string) => {
    setLightboxUrl(url);
  }, []);

  const handleCloseLightbox = useCallback(() => {
    setLightboxUrl(null);
  }, []);

  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <>
      <div
        className="grid gap-2 mt-2"
        style={{ maxWidth }}
      >
        {attachments.map((attachment, index) => {
          const key = `${attachment.type}-${attachment.url || index}`;

          switch (attachment.type) {
            case ATTACHMENT_TYPES.IMAGE:
              return (
                <ImageAttachment
                  key={key}
                  attachment={attachment}
                  isOutbound={isOutbound}
                  onImageClick={handleImageClick}
                />
              );
            case ATTACHMENT_TYPES.AUDIO:
              return (
                <AudioAttachment
                  key={key}
                  attachment={attachment}
                  isOutbound={isOutbound}
                />
              );
            case ATTACHMENT_TYPES.VIDEO:
              return (
                <VideoAttachment
                  key={key}
                  attachment={attachment}
                  isOutbound={isOutbound}
                />
              );
            case ATTACHMENT_TYPES.LOCATION:
              return (
                <LocationAttachment
                  key={key}
                  attachment={attachment}
                  isOutbound={isOutbound}
                />
              );
            case ATTACHMENT_TYPES.CONTACT:
              return (
                <ContactAttachment
                  key={key}
                  attachment={attachment}
                  isOutbound={isOutbound}
                />
              );
            case ATTACHMENT_TYPES.DOCUMENT:
            default:
              return (
                <DocumentAttachment
                  key={key}
                  attachment={attachment}
                  isOutbound={isOutbound}
                />
              );
          }
        })}
      </div>

      {/* Lightbox for image preview */}
      {lightboxUrl && (
        <Lightbox imageUrl={lightboxUrl} onClose={handleCloseLightbox} />
      )}
    </>
  );
}

export default AttachmentRenderer;
