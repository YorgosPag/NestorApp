'use client';
/* eslint-disable custom/no-hardcoded-strings */

/**
 * Sub-components for AttachmentRenderer (ADR-055)
 * Extracted for file-size compliance (<500 lines per file)
 */

import React, { useState, useCallback } from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { TRANSITION_PRESETS } from '@/components/ui/effects';
import { formatFileSize } from '@/utils/file-validation';
import {
  Image as ImageIcon,
  FileText,
  Download,
  ExternalLink,
  X,
  MapPin,
  User,
} from 'lucide-react';
import type { MessageAttachment } from '@/types/conversations';
import '@/lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

export interface SingleAttachmentProps {
  attachment: MessageAttachment;
  isOutbound?: boolean;
  onImageClick?: (url: string) => void;
}

// ============================================================================
// HELPERS
// ============================================================================

export function getFileExtension(filename?: string, mimeType?: string): string {
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

// ============================================================================
// IMAGE ATTACHMENT
// ============================================================================

export function ImageAttachment({
  attachment,
  isOutbound,
  onImageClick,
}: SingleAttachmentProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation('crm');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => setIsLoading(false), []);
  const handleError = useCallback(() => { setIsLoading(false); setHasError(true); }, []);
  const handleClick = useCallback(() => {
    if (attachment.url && onImageClick) onImageClick(attachment.url);
  }, [attachment.url, onImageClick]);

  if (!attachment.url) return null;

  if (hasError) {
    return (
      <div className={`flex items-center gap-2 p-3 rounded-lg ${isOutbound ? 'bg-primary/10' : 'bg-muted'}`}>
        <ImageIcon className={`${iconSizes.md} ${colors.text.muted}`} />
        <span className={`text-sm ${colors.text.muted}`}>{t('inbox.attachments.downloadFailed')}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`relative block rounded-lg overflow-hidden cursor-pointer ${TRANSITION_PRESETS.STANDARD_COLORS} hover:opacity-90`}
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
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/50 text-white text-xs truncate">
          {attachment.filename}
        </div>
      )}
    </button>
  );
}

// ============================================================================
// DOCUMENT ATTACHMENT
// ============================================================================

export function DocumentAttachment({ attachment, isOutbound }: SingleAttachmentProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation('crm');
  const extension = getFileExtension(attachment.filename, attachment.mimeType);
  const sizeText = attachment.size ? formatFileSize(attachment.size) : '';

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${isOutbound ? 'bg-primary/10' : 'bg-muted'} ${TRANSITION_PRESETS.STANDARD_COLORS}`}>
      <div className="relative flex-shrink-0">
        <div className={`w-10 h-10 flex items-center justify-center rounded-lg ${isOutbound ? 'bg-primary/20' : 'bg-background'}`}>
          <FileText className={`${iconSizes.md} ${isOutbound ? 'text-primary' : colors.text.muted}`} />
        </div>
        <span className="absolute -bottom-1 -right-1 px-1 text-[10px] font-bold bg-muted-foreground text-background rounded">
          {extension}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${colors.text.primary}`}>
          {attachment.filename || t('inbox.attachments.document')}
        </p>
        {sizeText && <p className={`text-xs ${colors.text.muted}`}>{sizeText}</p>}
      </div>
      {attachment.url && (
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          download={attachment.filename}
          className={`flex-shrink-0 p-2 rounded-lg ${isOutbound ? 'hover:bg-primary/20' : 'hover:bg-background'} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
          aria-label={t('inbox.attachments.download')}
        >
          <Download className={iconSizes.sm} />
        </a>
      )}
    </div>
  );
}

// ============================================================================
// AUDIO ATTACHMENT
// ============================================================================

export function AudioAttachment({ attachment, isOutbound }: SingleAttachmentProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('crm');
  if (!attachment.url) return null;

  return (
    <div className={`p-3 rounded-lg ${isOutbound ? 'bg-primary/10' : 'bg-muted'}`}>
      {attachment.filename && (
        <p className={`text-xs font-medium mb-2 truncate ${colors.text.primary}`}>{attachment.filename}</p>
      )}
      <audio controls className="w-full max-w-[300px]" preload="metadata">
        <source src={attachment.url} type={attachment.mimeType || 'audio/mpeg'} />
        {t('inbox.attachments.unsupportedType')}
      </audio>
    </div>
  );
}

// ============================================================================
// VIDEO ATTACHMENT
// ============================================================================

export function VideoAttachment({ attachment, isOutbound }: SingleAttachmentProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('crm');
  if (!attachment.url) return null;

  return (
    <div className={`rounded-lg overflow-hidden ${isOutbound ? 'bg-primary/10' : 'bg-muted'}`}>
      <video controls className="max-w-full max-h-64" preload="metadata" poster={attachment.thumbnailUrl}>
        <source src={attachment.url} type={attachment.mimeType || 'video/mp4'} />
        {t('inbox.attachments.unsupportedType')}
      </video>
      {attachment.filename && (
        <p className={`text-xs px-3 py-2 truncate ${colors.text.muted}`}>{attachment.filename}</p>
      )}
    </div>
  );
}

// ============================================================================
// LOCATION ATTACHMENT
// ============================================================================

export function LocationAttachment({ attachment, isOutbound }: SingleAttachmentProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const lat = attachment.metadata?.latitude as number | undefined;
  const lng = attachment.metadata?.longitude as number | undefined;
  const mapsUrl = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : attachment.url;

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 p-3 rounded-lg ${isOutbound ? 'bg-primary/10' : 'bg-muted'} ${TRANSITION_PRESETS.STANDARD_COLORS} hover:opacity-90`}
    >
      <div className={`w-10 h-10 flex items-center justify-center rounded-lg ${isOutbound ? 'bg-primary/20' : 'bg-background'}`}>
        <MapPin className={`${iconSizes.md} text-red-500`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${colors.text.primary}`}>📍 Location</p>
        {lat && lng && <p className={`text-xs ${colors.text.muted}`}>{lat.toFixed(6)}, {lng.toFixed(6)}</p>}
      </div>
      <ExternalLink className={iconSizes.sm} />
    </a>
  );
}

// ============================================================================
// CONTACT ATTACHMENT
// ============================================================================

export function ContactAttachment({ attachment, isOutbound }: SingleAttachmentProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const name = attachment.metadata?.name as string | undefined;
  const phone = attachment.metadata?.phone as string | undefined;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${isOutbound ? 'bg-primary/10' : 'bg-muted'}`}>
      <div className={`w-10 h-10 flex items-center justify-center rounded-full ${isOutbound ? 'bg-primary/20' : 'bg-background'}`}>
        <User className={`${iconSizes.md} ${colors.text.muted}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${colors.text.primary}`}>{name || 'Contact'}</p>
        {phone && <p className={`text-xs ${colors.text.muted}`}>{phone}</p>}
      </div>
    </div>
  );
}

// ============================================================================
// LIGHTBOX
// ============================================================================

export interface LightboxProps {
  imageUrl: string;
  onClose: () => void;
}

export function Lightbox({ imageUrl, onClose }: LightboxProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('crm');
  useEscapeKey(onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={onClose}>
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
