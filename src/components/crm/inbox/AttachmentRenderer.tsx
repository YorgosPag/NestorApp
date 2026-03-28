'use client';
/* eslint-disable custom/no-hardcoded-strings */

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
import type { MessageAttachment } from '@/types/conversations';
import { ATTACHMENT_TYPES } from '@/types/conversations';
import '@/lib/design-system';

// 🏢 ENTERPRISE: Extracted sub-components
import {
  ImageAttachment,
  DocumentAttachment,
  AudioAttachment,
  VideoAttachment,
  LocationAttachment,
  ContactAttachment,
  Lightbox,
} from './attachment-parts';

// Re-exports for backward compatibility
export {
  ImageAttachment,
  DocumentAttachment,
  AudioAttachment,
  VideoAttachment,
  LocationAttachment,
  ContactAttachment,
  Lightbox,
} from './attachment-parts';
export type { SingleAttachmentProps, LightboxProps } from './attachment-parts';

// ============================================================================
// TYPES
// ============================================================================

interface AttachmentRendererProps {
  attachments: MessageAttachment[];
  isOutbound?: boolean;
  maxWidth?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * AttachmentRenderer - Renders message attachments
 *
 * @enterprise ADR-055 - Enterprise Attachment System
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
      <div className="grid gap-2 mt-2" style={{ maxWidth }}>
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
              return <AudioAttachment key={key} attachment={attachment} isOutbound={isOutbound} />;
            case ATTACHMENT_TYPES.VIDEO:
              return <VideoAttachment key={key} attachment={attachment} isOutbound={isOutbound} />;
            case ATTACHMENT_TYPES.LOCATION:
              return <LocationAttachment key={key} attachment={attachment} isOutbound={isOutbound} />;
            case ATTACHMENT_TYPES.CONTACT:
              return <ContactAttachment key={key} attachment={attachment} isOutbound={isOutbound} />;
            case ATTACHMENT_TYPES.DOCUMENT:
            default:
              return <DocumentAttachment key={key} attachment={attachment} isOutbound={isOutbound} />;
          }
        })}
      </div>

      {lightboxUrl && (
        <Lightbox imageUrl={lightboxUrl} onClose={handleCloseLightbox} />
      )}
    </>
  );
}

export default AttachmentRenderer;
