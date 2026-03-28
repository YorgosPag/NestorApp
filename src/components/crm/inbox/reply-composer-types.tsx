/**
 * =============================================================================
 * REPLY COMPOSER - Types & Constants
 * =============================================================================
 *
 * Shared types and constants for the ReplyComposer module.
 *
 * @module components/crm/inbox/reply-composer-types
 * @enterprise ADR-030 - Zero Hardcoded Values
 * @enterprise ADR-055 - Enterprise Attachment System Consolidation
 */

import '@/lib/design-system';
import React from 'react';
import {
  Image,
  Music,
  Video,
  FileText,
} from 'lucide-react';
import type { useIconSizes } from '@/hooks/useIconSizes';
import type {
  MessageAttachment,
  AttachmentType,
} from '@/types/conversations';
import { ATTACHMENT_TYPES } from '@/types/conversations';
import type { QuotedMessage, ReplyMode } from '@/hooks/inbox/useMessageReply';
import type { EditingMessage } from '@/hooks/inbox/useMessageEdit';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum attachment size in bytes (10MB) */
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

/** Maximum number of attachments per message */
export const MAX_ATTACHMENTS = 5;

/** Accepted file types for attachments */
export const ACCEPTED_FILE_TYPES = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,audio/*,video/*';

/** Composer textarea sizing — ADR-030 Zero Hardcoded Values */
export const TEXTAREA_SIZE = {
  minHeight: 44,
  maxHeight: 150,
} as const;

// ============================================================================
// TYPES
// ============================================================================

/** Pending attachment in composer (not yet sent) */
export interface PendingAttachment {
  /** Unique ID for React key */
  id: string;
  /** The file being uploaded */
  file: File;
  /** Detected attachment type */
  type: AttachmentType;
  /** Preview URL (for images) */
  previewUrl?: string;
  /** Upload progress (0-100) */
  progress: number;
  /** Upload status */
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  /** Error message if failed */
  error?: string;
  /** Uploaded URL (when completed) */
  uploadedUrl?: string;
}

export interface ReplyComposerProps {
  /** Whether a conversation is selected */
  disabled?: boolean;
  /** Sending state */
  sending: boolean;
  /** Error message */
  error: string | null;
  /** Send callback - now accepts optional attachments */
  onSend: (text: string, attachments?: MessageAttachment[]) => Promise<boolean>;
  /** Clear error callback */
  onClearError: () => void;
  /** Reply mode (none, reply, forward) */
  replyMode?: ReplyMode;
  /** Quoted message for reply/forward */
  quotedMessage?: QuotedMessage | null;
  /** Cancel reply/forward callback */
  onCancelReply?: () => void;
  /** Message being edited (for edit mode) */
  editingMessage?: EditingMessage | null;
  /** Update edit text callback */
  onUpdateEditText?: (text: string) => void;
  /** Cancel edit callback */
  onCancelEdit?: () => void;
  /** Save edit callback (accepts optional text override) */
  onSaveEdit?: (textOverride?: string) => Promise<{ success: boolean; error?: string }>;
  /** Edit saving state */
  isSavingEdit?: boolean;
  /** 🏢 ENTERPRISE: Upload attachment callback (ADR-055) */
  onUploadAttachment?: (
    file: File,
    onProgress: (progress: number) => void
  ) => Promise<{ url: string; thumbnailUrl?: string } | null>;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get icon component for attachment type
 */
export function getAttachmentIcon(
  type: AttachmentType,
  iconSizes: ReturnType<typeof useIconSizes>
): React.ReactNode {
  switch (type) {
    case ATTACHMENT_TYPES.IMAGE:
      return <Image className={iconSizes.sm} />;
    case ATTACHMENT_TYPES.AUDIO:
      return <Music className={iconSizes.sm} />;
    case ATTACHMENT_TYPES.VIDEO:
      return <Video className={iconSizes.sm} />;
    case ATTACHMENT_TYPES.DOCUMENT:
    default:
      return <FileText className={iconSizes.sm} />;
  }
}
