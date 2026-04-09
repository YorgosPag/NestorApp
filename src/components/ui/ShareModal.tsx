/**
 * SHARE MODAL — Centralized sharing with platforms, email, and multi-channel CRM contact delivery.
 * @module components/ui/ShareModal
 */

'use client';

import { safeJsonParse } from '@/lib/json-utils';
import React from 'react';
import { Share2, ArrowLeft, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { designSystem } from '@/lib/design-system';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getSocialShareUrls, getPhotoSocialShareUrls, trackShareEvent, copyImageToClipboard } from '@/lib/share-utils';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { SharePlatformGrid } from '@/components/ui/social-sharing/SharePlatformGrid';
import { PhotoPickerGrid } from '@/components/ui/social-sharing/PhotoPickerGrid';
import { EmailShareForm } from '@/components/ui/email-sharing/EmailShareForm';
import { CopyActionsSection } from '@/components/ui/social-sharing/CopyActionsSection';
import type { ShareData, EmailShareData } from '@/components/ui/email-sharing/EmailShareForm';
import { createModuleLogger } from '@/lib/telemetry';
import { useNotifications } from '@/providers/NotificationProvider';
import { ContactChannelPicker } from '@/components/ui/channel-sharing/ContactChannelPicker';
import { ChannelShareForm } from '@/components/ui/channel-sharing/ChannelShareForm';
import type { AvailableChannel, ChannelShareRequest } from '@/components/ui/channel-sharing/types';

const logger = createModuleLogger('ShareModal');

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareData: ShareData & {
    isPhoto?: boolean;
  };
  /** Custom modal title — defaults to i18n common:share.share */
  modalTitle?: string;
  onCopySuccess?: () => void;
  onShareSuccess?: (platform: string) => void;
  onShareError?: (platform: string, error: string) => void;
}

// ============================================================================
// ENTERPRISE SHARE MODAL COMPONENT
// ============================================================================

export function ShareModal({
  isOpen,
  onClose,
  shareData,
  modalTitle,
  onCopySuccess,
  onShareSuccess,
  onShareError
}: ShareModalProps) {
const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation('common');
  const notifications = useNotifications();
  const [showEmailForm, setShowEmailForm] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  // Photo picker for Telegram/WhatsApp: which platform triggered it
  const [photoPickerPlatform, setPhotoPickerPlatform] = React.useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = React.useState<string | null>(null);
  // Channel sharing flow state
  const [showChannelPicker, setShowChannelPicker] = React.useState(false);
  const [channelContact, setChannelContact] = React.useState<{ id: string; name: string } | null>(null);
  const [channelSelected, setChannelSelected] = React.useState<AvailableChannel | null>(null);

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setShowEmailForm(false);
      setLoading(false);
      setPhotoPickerPlatform(null);
      setSelectedPhoto(null);
      setShowChannelPicker(false);
      setChannelContact(null);
      setChannelSelected(null);
    }
  }, [isOpen]);

  // Photo URL resolution: prefer Firebase direct URL for inline previews
  const effectivePhotoUrl = shareData.isPhoto && shareData.photoUrl
    ? shareData.photoUrl
    : null;
  const isDirectPhotoUrl = shareData.url.includes('firebasestorage.googleapis.com') ||
                           shareData.url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);

  const socialUrls = effectivePhotoUrl
    ? getPhotoSocialShareUrls(effectivePhotoUrl, shareData.text || shareData.title, shareData.url)
    : isDirectPhotoUrl
      ? getPhotoSocialShareUrls(shareData.url, shareData.text || shareData.title)
      : getSocialShareUrls(shareData.url, shareData.text || shareData.title);

  /** Handle platform share — route to email form, photo picker, or social app */
  const handlePlatformShare = async (platformId: string) => {
    if (platformId === 'email') {
      setShowEmailForm(true);
      return;
    }

    // Photo shares with gallery: show photo picker before sharing
    if (shareData.isPhoto && shareData.galleryPhotos && shareData.galleryPhotos.length > 1
        && (platformId === 'telegram' || platformId === 'whatsapp' || platformId === 'instagram' || platformId === 'messenger')) {
      setSelectedPhoto(shareData.photoUrl ?? shareData.galleryPhotos[0]);
      setPhotoPickerPlatform(platformId);
      return;
    }

    setLoading(true);
    onClose();

    try {
      // Messenger, Telegram, Instagram & WhatsApp: copy photo to clipboard + open app + notification
      if (platformId === 'messenger' || platformId === 'telegram' || platformId === 'instagram' || platformId === 'whatsapp') {
        const photoUrl = effectivePhotoUrl ?? shareData.photoUrl;
        const platformNames: Record<string, string> = { messenger: 'Messenger', telegram: 'Telegram', instagram: 'Instagram', whatsapp: 'WhatsApp' };
        const platformName = platformNames[platformId];

        // Copy image to clipboard (falls back to text if image copy fails)
        if (photoUrl) {
          const imageCopied = await copyImageToClipboard(photoUrl);
          if (!imageCopied) {
            await navigator.clipboard.writeText(shareData.text || shareData.title);
          }
        } else {
          await navigator.clipboard.writeText(shareData.text || shareData.title);
        }

        notifications.info(t('share.photoCopiedToClipboard', { platform: platformName }));

        // Open the app
        const appUrls: Record<string, string> = {
          telegram: `tg://msg_url?url=${encodeURIComponent(photoUrl ?? shareData.url)}&text=${encodeURIComponent(shareData.text || shareData.title)}`,
          whatsapp: 'https://web.whatsapp.com/',
          instagram: 'https://www.instagram.com/direct/new/',
          messenger: 'https://www.messenger.com/new',
        };
        const appUrl = appUrls[platformId];
        if (platformId === 'telegram') {
          window.location.href = appUrl;
        } else if (appUrl) {
          window.open(appUrl, '_blank', 'width=600,height=500,scrollbars=yes,resizable=yes,noopener=yes,noreferrer=yes');
        }

        trackShareEvent(platformId, 'photo', photoUrl ?? shareData.url);
        onShareSuccess?.(platformId);
        return;
      }

      let url = socialUrls[platformId as keyof typeof socialUrls];

      // Special Facebook handling για photos
      if (platformId === 'facebook' && shareData.url.includes('/share/photo/')) {
        const urlObj = new URL(shareData.url);
        const dataParam = urlObj.searchParams.get('data');

        if (dataParam) {
          try {
            const singleDecoded = decodeURIComponent(dataParam);
            const doubleDecoded = decodeURIComponent(singleDecoded);
            const data = safeJsonParse<{ url: string }>(doubleDecoded, null as unknown as { url: string });
            if (data !== null) {
              const directUrl = data.url.replace(/\?alt=media&token=.*$/, '?alt=media');
              url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(directUrl)}&quote=${encodeURIComponent(shareData.title + '\n' + shareData.text)}`;
            } else {
              logger.error('Error parsing data for Facebook');
              url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}`;
            }
          } catch (e) {
            logger.error('Error decoding data for Facebook', { error: e });
            url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}`;
          }
        } else {
          url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}`;
        }
      }

      if (url) {
        // Always use platform-specific URLs (never navigator.share which opens OS dialog)
        const shareWindow = window.open(url, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes,noopener=yes,noreferrer=yes');
        if (!shareWindow) {
          await navigator.clipboard.writeText(shareData.text || shareData.url);
        }

        trackShareEvent(platformId, 'contact', shareData.url);
        setTimeout(() => {
          onShareSuccess?.(platformId);
        }, 1500);
      }
    } catch (error) {
      onShareError?.(platformId, error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  /** Handle email share via centralized EmailShareForm */
  const handleEmailShare = async (emailData: EmailShareData) => {
    setLoading(true);

    try {
      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      interface PropertyShareEmailResponse {
        success: boolean;
        error?: string;
      }

      await apiClient.post<PropertyShareEmailResponse>(API_ROUTES.COMMUNICATIONS.EMAIL_PROPERTY_SHARE, emailData);

      notifications.success(t('emailShare.sendSuccess'));
      onShareSuccess?.(`email (${emailData.recipients.length} recipients, ${emailData.templateType} template)`);
      setShowEmailForm(false);
      onClose();

    } catch (error) {
      throw error; // Let EmailShareForm handle the error
    } finally {
      setLoading(false);
    }
  };

  const handleCopySuccess = (type: 'url' | 'text') => {
    onCopySuccess?.();
  };

  const handleCopyError = (type: 'url' | 'text', error: string) => {
    logger.error(`Failed to copy ${type}`, { error });
  };

  const handlePhotoPickerConfirm = async () => {
    if (!photoPickerPlatform || !selectedPhoto) return;

    const caption = shareData.text || shareData.title;
    const platformNames: Record<string, string> = { telegram: 'Telegram', messenger: 'Messenger', instagram: 'Instagram', whatsapp: 'WhatsApp' };
    const platformName = platformNames[photoPickerPlatform] ?? photoPickerPlatform;

    // Copy image to clipboard + show notification
    const imageCopied = await copyImageToClipboard(selectedPhoto);
    if (!imageCopied) {
      await navigator.clipboard.writeText(caption);
    }
    notifications.info(t('share.photoCopiedToClipboard', { platform: platformName }));

    // Open the app
    const appUrls: Record<string, string> = {
      telegram: `tg://msg_url?url=${encodeURIComponent(selectedPhoto)}&text=${encodeURIComponent(caption)}`,
      whatsapp: 'https://web.whatsapp.com/',
      instagram: 'https://www.instagram.com/direct/new/',
      messenger: 'https://www.messenger.com/new',
    };
    const appUrl = appUrls[photoPickerPlatform];
    if (photoPickerPlatform === 'telegram') {
      window.location.href = appUrl;
    } else if (appUrl) {
      window.open(appUrl, '_blank', 'width=600,height=500,scrollbars=yes,resizable=yes,noopener=yes,noreferrer=yes');
    }

    trackShareEvent(photoPickerPlatform, 'photo', selectedPhoto);
    onShareSuccess?.(photoPickerPlatform);
    setPhotoPickerPlatform(null);
    setSelectedPhoto(null);
    onClose();
  };

  const handleChannelSelect = React.useCallback(
    (contact: { id: string; name: string }, channel: AvailableChannel) => {
      setChannelContact(contact);
      setChannelSelected(channel);
    },
    []
  );

  const handleChannelShare = React.useCallback(async (data: ChannelShareRequest) => {
    setLoading(true);
    try {
      await apiClient.post(API_ROUTES.COMMUNICATIONS.SHARE_TO_CHANNEL, data);
      const channelName = data.channel;
      notifications.success(t('channelShare.sendSuccess', { channel: channelName }));
      onShareSuccess?.(`${channelName} (contact: ${data.contactName})`);
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
  }, [t, notifications, onShareSuccess, onShareError, onClose]);

  const handleChannelBack = React.useCallback(() => {
    if (channelSelected) {
      setChannelSelected(null);
    } else {
      setShowChannelPicker(false);
      setChannelContact(null);
    }
  }, [channelSelected]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={designSystem.cn(
        "sm:max-w-lg backdrop-blur-xl border-0 shadow-2xl",
        designSystem.colorScheme.responsive.card
      )}>

        {/* HEADER με Design System */}
        <DialogHeader className="text-center space-y-3" role="banner">
          <figure className={designSystem.cn(
            `mx-auto ${iconSizes['2xl']} rounded-full flex items-center justify-center`,
            designSystem.getStatusColor('info', 'bg')
          )} role="img" aria-label="Share Icon">
            <Share2 className={`${iconSizes.lg} ${colors.text.inverse}`} />
          </figure>

          <DialogTitle className={designSystem.cn(
            designSystem.presets.text.title,
            "bg-gradient-to-r bg-clip-text text-transparent",
            "from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400"
          )}>
            {modalTitle || t('share.share')}
          </DialogTitle>

          <p className={designSystem.cn(
            designSystem.presets.text.muted,
            "leading-relaxed"
          )}>
            {shareData.title}
          </p>
        </DialogHeader>

        {/* CONTENT με Centralized Components */}
        <main className="space-y-6 py-4" role="main">
          {showChannelPicker && channelContact && channelSelected ? (
            /* 📨 Channel Share Form — send photos via selected channel */
            <ChannelShareForm
              shareData={shareData}
              channel={channelSelected}
              contact={channelContact}
              onSend={handleChannelShare}
              onBack={handleChannelBack}
              loading={loading}
            />
          ) : showChannelPicker ? (
            /* 📇 Contact Channel Picker — search contact + select channel */
            <ContactChannelPicker
              onChannelSelect={handleChannelSelect}
              onBack={handleChannelBack}
            />
          ) : photoPickerPlatform ? (
            /* 📸 Photo Picker for Telegram/WhatsApp — uses centralized PhotoPickerGrid */
            <section className="space-y-4">
              <PhotoPickerGrid
                photos={shareData.galleryPhotos ?? []}
                selected={selectedPhoto ? [selectedPhoto] : []}
                onSelectionChange={(sel) => setSelectedPhoto(sel[0] ?? null)}
                mode="single"
              />

              <nav className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setPhotoPickerPlatform(null); setSelectedPhoto(null); }}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t('emailShare.back')}
                </button>
                <button
                  type="button"
                  onClick={handlePhotoPickerConfirm}
                  disabled={!selectedPhoto}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {t('emailShare.send')}
                </button>
              </nav>
            </section>
          ) : !showEmailForm ? (
            <>
              {/* 🏢 ENTERPRISE: Centralized Platform Grid */}
              <SharePlatformGrid
                onPlatformSelect={handlePlatformShare}
                loading={loading}
                gridConfig={{
                  columns: 5,
                  buttonVariant: 'default',
                  iconSize: 'md',
                  showLabels: true,
                  spacing: 'normal'
                }}
              />

              {/* 🏢 ENTERPRISE: Centralized Copy Actions */}
              <CopyActionsSection
                copyData={shareData}
                onCopySuccess={handleCopySuccess}
                onCopyError={handleCopyError}
                loading={loading}
              />

              {/* 📇 Send to CRM Contact — Multi-Channel Sharing */}
              <button
                type="button"
                onClick={() => setShowChannelPicker(true)}
                disabled={loading}
                className={designSystem.cn(
                  'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg',
                  'border-2 border-dashed border-primary/30 hover:border-primary/60',
                  'text-sm font-medium text-primary hover:bg-primary/5',
                  'transition-all disabled:opacity-50'
                )}
              >
                <Users className="w-4 h-4" />
                {t('channelShare.sendToContact')}
              </button>
            </>
          ) : (
            /* 🏢 ENTERPRISE: Centralized Email Form */
            <EmailShareForm
              shareData={shareData}
              onEmailShare={handleEmailShare}
              onBack={() => setShowEmailForm(false)}
              loading={loading}
            />
          )}
        </main>
      </DialogContent>
    </Dialog>
  );
}

export function useShareModal() {
  const [isOpen, setIsOpen] = React.useState(false);

  const openModal = React.useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeModal = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    openModal,
    closeModal,
  };
}

export default ShareModal;