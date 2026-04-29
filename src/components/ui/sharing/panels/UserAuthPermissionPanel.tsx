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
import { AlertTriangle, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { ApiClientError } from '@/lib/api/api-client-types';
import { API_ROUTES } from '@/config/domain-constants';
import { Button } from '@/components/ui/button';
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
  /**
   * When provided, email shares are routed through the branded showcase email
   * endpoint (visual parity with the web/PDF surfaces) instead of the generic
   * `property-share` template. Discriminated by entity:
   *   - `{ type: 'property', propertyId }` → ADR-312 Phase 8 property route
   *   - `{ type: 'project',  projectId }`  → ADR-316 project route
   *   - `{ type: 'building', buildingId }` → ADR-320 building route
   */
  showcaseContext?:
    | { type: 'property'; propertyId: string }
    | { type: 'project'; projectId: string }
    | { type: 'building'; buildingId: string };
  /**
   * Pre-fills `EmailShareForm`'s personal message field with the note already
   * typed in the link-creation dialog (ADR-312 Phase 9.5). Unifies the field
   * across the two dialogs while still allowing a last-minute edit.
   */
  initialPersonalMessage?: string;
  /**
   * When true, the accordion draft policy differs from the live token's
   * applied policy. The channel surface is visually dimmed and pointer events
   * are blocked; a warning banner asks the user to re-apply the policy first.
   * Prevents shipping the old URL with stale settings (ADR-312 Phase 9.10).
   */
  dirtyPolicy?: boolean;
  /**
   * When provided, clicking the email platform button calls this directly
   * instead of opening `EmailShareForm`. Used for vendor_rfq_invite where the
   * email is dispatched via email-channel.ts (ADR-327 Phase H).
   */
  onDirectEmailShare?: () => Promise<void>;
  /**
   * When true, hides the "Αποστολή σε Επαφή" CRM channel picker button.
   * Used for vendor invites where the recipient is already known from step 1
   * and the generic contact picker would be redundant and confusing.
   */
  hideChannelPicker?: boolean;
}

export function UserAuthPermissionPanel({
  shareData,
  isOpen,
  onClose,
  onCopySuccess,
  onShareSuccess,
  onShareError,
  onLoadingChange,
  showcaseContext,
  initialPersonalMessage,
  dirtyPolicy = false,
  onDirectEmailShare,
  hideChannelPicker = false,
}: UserAuthPermissionPanelProps): React.ReactElement {
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
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
    onEmailRequest: onDirectEmailShare
      ? () => {
          setLoading(true);
          void onDirectEmailShare()
            .then(() => { onShareSuccess?.('email'); })
            .catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : 'Email send failed';
              notifications.error(msg);
              onShareError?.('email', msg);
            })
            .finally(() => setLoading(false));
        }
      : () => setShowEmailForm(true),
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
        if (showcaseContext) {
          interface ShowcaseEmailResponse {
            emailSent: boolean;
            messageId?: string;
            recipient: string;
          }
          const endpoint = showcaseContext.type === 'project'
            ? `/api/projects/${encodeURIComponent(showcaseContext.projectId)}/showcase/email`
            : showcaseContext.type === 'building'
              ? `/api/buildings/${encodeURIComponent(showcaseContext.buildingId)}/showcase/email`
              : `/api/properties/${encodeURIComponent(showcaseContext.propertyId)}/showcase/email`;
          await Promise.all(
            emailData.recipients.map((recipient) =>
              apiClient.post<ShowcaseEmailResponse>(endpoint, {
                recipient,
                shareUrl: emailData.propertyUrl,
                personalMessage: emailData.personalMessage,
              }),
            ),
          );
          notifications.success(t('emailShare.sendSuccess'));
          onShareSuccess?.(`showcase-email (${emailData.recipients.length} recipients)`);
          setShowEmailForm(false);
          onClose();
          return;
        }
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
    [setLoading, notifications, t, onShareSuccess, onShareError, onClose, showcaseContext],
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
        // Telegram Bot API rejects delivery to `@username` handles or recipients
        // who never sent `/start` — the server turns that into a 422 with
        // `TELEGRAM_CHAT_NOT_FOUND`. Surface an actionable hint instead of the
        // raw backend description (ADR-312 Phase 9.12).
        const errorCode =
          ApiClientError.isApiClientError(error) ? error.errorCode : undefined;
        const toastMessage =
          errorCode === 'TELEGRAM_CHAT_NOT_FOUND'
            ? t('channelShare.errors.telegramChatNotFound')
            : errorCode === 'TELEGRAM_NOT_AN_IMAGE'
              ? t('channelShare.errors.telegramNotAnImage')
              : t('channelShare.sendError', { channel: data.channel, error: message });
        notifications.error(toastMessage);
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
        initialPersonalMessage={initialPersonalMessage}
      />
    );
  }

  return (
    <>
      {dirtyPolicy && (
        <aside
          role="alert"
          className="flex items-start gap-2 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700"
        >
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-200">
            {t('common-shared:share.dirtyPolicyWarning')}
          </p>
        </aside>
      )}

      <div
        className={cn(
          'flex flex-col gap-4',
          dirtyPolicy && 'pointer-events-none opacity-50',
        )}
        aria-disabled={dirtyPolicy}
      >
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
        <p className="text-xs text-muted-foreground text-center -mt-1">
          {t('common-shared:share.captionOwnAccounts')}
        </p>

        <CopyActionsSection
          copyData={shareData}
          onCopySuccess={handleCopySuccess}
          onCopyError={handleCopyError}
          loading={loading}
        />

        {!hideChannelPicker && (
          <section className="space-y-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowChannelPicker(true)}
              disabled={loading || dirtyPolicy}
              className="w-full h-12"
            >
              <Users className="w-4 h-4 mr-2" />
              {t('channelShare.sendToContact')}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              {t('common-shared:share.captionCrmContact')}
            </p>
          </section>
        )}
      </div>
    </>
  );
}
