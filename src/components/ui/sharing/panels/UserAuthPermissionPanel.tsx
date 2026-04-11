/**
 * =============================================================================
 * 🏢 ENTERPRISE: UserAuthPermissionPanel — Contact/Content Share Adapter
 * =============================================================================
 *
 * PermissionPanel adapter for the user-auth permission model (ADR-147).
 * Owns the sub-view state machine (platform grid ↔ email form ↔ channel picker
 * ↔ channel form ↔ photo picker) and delegates platform-share logic to
 * `usePlatformShareController`. The presentational chrome is provided by the
 * hosting `ShareSurfaceShell`.
 *
 * @module components/ui/sharing/panels/UserAuthPermissionPanel
 * @see ADR-147 Unified Share Surface (Phase B)
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { designSystem } from '@/lib/design-system';
import { createModuleLogger } from '@/lib/telemetry';
import { SharePlatformGrid } from '@/components/ui/social-sharing/SharePlatformGrid';
import { EmailShareForm } from '@/components/ui/email-sharing/EmailShareForm';
import { CopyActionsSection } from '@/components/ui/social-sharing/CopyActionsSection';
import { ContactChannelPicker } from '@/components/ui/channel-sharing/ContactChannelPicker';
import { ChannelShareForm } from '@/components/ui/channel-sharing/ChannelShareForm';
import type {
  AvailableChannel,
  ChannelShareRequest,
} from '@/components/ui/channel-sharing/types';
import type {
  EmailShareData,
  ShareData,
} from '@/components/ui/email-sharing/EmailShareForm';
import { usePlatformShareController } from './user-auth/PlatformShareController';
import { PhotoPickerStep } from './user-auth/PhotoPickerStep';

const logger = createModuleLogger('UserAuthPermissionPanel');

export interface UserAuthPermissionPanelProps {
  shareData: ShareData & { isPhoto?: boolean };
  isOpen: boolean;
  onClose: () => void;
  onCopySuccess?: () => void;
  onShareSuccess?: (platform: string) => void;
  onShareError?: (platform: string, error: string) => void;
  onLoadingChange?: (loading: boolean) => void;
}

export function UserAuthPermissionPanel({
  shareData,
  isOpen,
  onClose,
  onCopySuccess,
  onShareSuccess,
  onShareError,
  onLoadingChange,
}: UserAuthPermissionPanelProps): React.ReactElement {
  const { t } = useTranslation('common');
  const notifications = useNotifications();

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [loading, setLoadingState] = useState(false);
  const [photoPickerPlatform, setPhotoPickerPlatform] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [showChannelPicker, setShowChannelPicker] = useState(false);
  const [channelContact, setChannelContact] = useState<{ id: string; name: string } | null>(null);
  const [channelSelected, setChannelSelected] = useState<AvailableChannel | null>(null);

  const setLoading = useCallback(
    (value: boolean): void => {
      setLoadingState(value);
      onLoadingChange?.(value);
    },
    [onLoadingChange],
  );

  useEffect(() => {
    if (!isOpen) return;
    setShowEmailForm(false);
    setLoadingState(false);
    setPhotoPickerPlatform(null);
    setSelectedPhoto(null);
    setShowChannelPicker(false);
    setChannelContact(null);
    setChannelSelected(null);
  }, [isOpen]);

  const effectivePhotoUrl = shareData.isPhoto && shareData.photoUrl ? shareData.photoUrl : null;

  const notifyPhotoCopied = useCallback(
    (platformName: string): void => {
      notifications.info(t('share.photoCopiedToClipboard', { platform: platformName }));
    },
    [notifications, t],
  );

  const { handlePlatformShare, handlePhotoPickerConfirm } = usePlatformShareController({
    shareData,
    effectivePhotoUrl,
    onEmailRequest: () => setShowEmailForm(true),
    onPhotoPickerRequest: (platformId, initialPhoto) => {
      setSelectedPhoto(initialPhoto);
      setPhotoPickerPlatform(platformId);
    },
    onClose,
    onShareSuccess,
    onShareError,
    setLoading,
    notifyPhotoCopied,
  });

  const handleEmailShare = useCallback(
    async (emailData: EmailShareData): Promise<void> => {
      setLoading(true);
      try {
        interface PropertyShareEmailResponse {
          success: boolean;
          error?: string;
        }
        await apiClient.post<PropertyShareEmailResponse>(
          API_ROUTES.COMMUNICATIONS.EMAIL_PROPERTY_SHARE,
          emailData,
        );
        notifications.success(t('emailShare.sendSuccess'));
        onShareSuccess?.(
          `email (${emailData.recipients.length} recipients, ${emailData.templateType} template)`,
        );
        setShowEmailForm(false);
        onClose();
      } catch (error) {
        // Surface the real backend error to the user instead of swallowing it
        // behind a generic toast. Follows Google Gmail error UX: show the actual
        // reason (validation message, rate limit, auth) so the user can react.
        const message = error instanceof Error ? error.message : t('emailShare.sendError');
        logger.error('Email share failed', { error: message });
        notifications.error(message);
        onShareError?.('email', message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, notifications, t, onShareSuccess, onShareError, onClose],
  );

  const handleCopySuccess = useCallback((): void => {
    onCopySuccess?.();
  }, [onCopySuccess]);

  const handleCopyError = useCallback((type: 'url' | 'text', error: string): void => {
    logger.error(`Failed to copy ${type}`, { error });
  }, []);

  const handleChannelSelect = useCallback(
    (contact: { id: string; name: string }, channel: AvailableChannel): void => {
      setChannelContact(contact);
      setChannelSelected(channel);
    },
    [],
  );

  const handleChannelBack = useCallback((): void => {
    if (channelSelected) {
      setChannelSelected(null);
    } else {
      setShowChannelPicker(false);
      setChannelContact(null);
    }
  }, [channelSelected]);

  const handleChannelShare = useCallback(
    async (data: ChannelShareRequest): Promise<void> => {
      setLoading(true);
      try {
        await apiClient.post(API_ROUTES.COMMUNICATIONS.SHARE_TO_CHANNEL, data);
        notifications.success(t('channelShare.sendSuccess', { channel: data.channel }));
        onShareSuccess?.(`${data.channel} (contact: ${data.contactName})`);
        setShowChannelPicker(false);
        setChannelContact(null);
        setChannelSelected(null);
        onClose();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        notifications.error(t('channelShare.sendError', { channel: data.channel, error: message }));
        onShareError?.(data.channel, message);
      } finally {
        setLoading(false);
      }
    },
    [setLoading, notifications, t, onShareSuccess, onShareError, onClose],
  );

  const confirmPhotoPicker = useCallback(async (): Promise<void> => {
    if (!photoPickerPlatform || !selectedPhoto) return;
    const caption = shareData.text || shareData.title;
    await handlePhotoPickerConfirm(photoPickerPlatform, selectedPhoto, caption);
    setPhotoPickerPlatform(null);
    setSelectedPhoto(null);
    onClose();
  }, [photoPickerPlatform, selectedPhoto, shareData, handlePhotoPickerConfirm, onClose]);

  if (showChannelPicker && channelContact && channelSelected) {
    return (
      <ChannelShareForm
        shareData={shareData}
        channel={channelSelected}
        contact={channelContact}
        onSend={handleChannelShare}
        onBack={handleChannelBack}
        loading={loading}
      />
    );
  }

  if (showChannelPicker) {
    return (
      <ContactChannelPicker
        onChannelSelect={handleChannelSelect}
        onBack={handleChannelBack}
      />
    );
  }

  if (photoPickerPlatform) {
    return (
      <PhotoPickerStep
        galleryPhotos={shareData.galleryPhotos ?? []}
        selectedPhoto={selectedPhoto}
        onSelectionChange={setSelectedPhoto}
        onCancel={() => {
          setPhotoPickerPlatform(null);
          setSelectedPhoto(null);
        }}
        onConfirm={confirmPhotoPicker}
      />
    );
  }

  if (showEmailForm) {
    return (
      <EmailShareForm
        shareData={shareData}
        onEmailShare={handleEmailShare}
        onBack={() => setShowEmailForm(false)}
        loading={loading}
      />
    );
  }

  return (
    <>
      <SharePlatformGrid
        onPlatformSelect={handlePlatformShare}
        loading={loading}
        gridConfig={{
          columns: 5,
          buttonVariant: 'default',
          iconSize: 'md',
          showLabels: true,
          spacing: 'normal',
        }}
      />

      <CopyActionsSection
        copyData={shareData}
        onCopySuccess={handleCopySuccess}
        onCopyError={handleCopyError}
        loading={loading}
      />

      <button
        type="button"
        onClick={() => setShowChannelPicker(true)}
        disabled={loading}
        className={designSystem.cn(
          'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg',
          'border-2 border-dashed border-primary/30 hover:border-primary/60',
          'text-sm font-medium text-primary hover:bg-primary/5',
          'transition-all disabled:opacity-50',
        )}
      >
        <Users className="w-4 h-4" />
        {t('channelShare.sendToContact')}
      </button>
    </>
  );
}
