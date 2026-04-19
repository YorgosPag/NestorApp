'use client';

/**
 * =============================================================================
 * CHANNEL SHARE FORM — Photo Selection + Message + Send
 * =============================================================================
 *
 * Final step of the multi-channel sharing flow.
 * Reuses PhotoPickerGrid for photo selection.
 *
 * @module components/ui/channel-sharing/ChannelShareForm
 * @enterprise Phase 2 — Multi-Channel Sharing
 */

import React, { useState, useCallback } from 'react';
import { ArrowLeft, Send, Info, Link as LinkIcon, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { designSystem } from '@/lib/design-system';
import { PhotoPickerGrid } from '@/components/ui/social-sharing/PhotoPickerGrid';
import {
  WhatsAppIcon,
  TelegramIcon,
  MessengerIcon,
  InstagramIcon,
} from '@/lib/social-sharing/SocialSharingPlatforms';
import type { ShareData } from '@/components/ui/email-sharing/EmailShareForm';
import type { AvailableChannel, ChannelProvider, ChannelShareRequest } from './types';

// ============================================================================
// TYPES
// ============================================================================

export interface ChannelShareFormProps {
  shareData: ShareData;
  channel: AvailableChannel;
  contact: { id: string; name: string };
  onSend: (data: ChannelShareRequest) => Promise<void>;
  onBack: () => void;
  loading?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_MESSAGE_LENGTH = 500;

const CHANNEL_ICONS: Record<ChannelProvider, React.FC<{ className?: string }>> = {
  email: ({ className }) => <Mail className={className} />,
  telegram: TelegramIcon,
  whatsapp: WhatsAppIcon,
  messenger: MessengerIcon,
  instagram: InstagramIcon,
};

const CHANNEL_COLORS: Record<ChannelProvider, string> = {
  email: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  telegram: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  whatsapp: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  messenger: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  instagram: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ChannelShareForm({
  shareData,
  channel,
  contact,
  onSend,
  onBack,
  loading = false,
}: ChannelShareFormProps) {
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);

  // Photo selection — `shareData.url` is a share-token page URL (HTML), not
  // an image URL; falling back to it would turn `photoUrls` into a link to a
  // page and Telegram rejects it with `IMAGE_PROCESS_FAILED`. Only a real
  // photo URL is acceptable here (ADR-312 Phase 9.15).
  const galleryPhotos = shareData.galleryPhotos ?? [];
  const defaultPhoto = shareData.photoUrl;
  const isMultiPhoto = galleryPhotos.length > 1;
  const selectionMode = channel.provider === 'email' ? 'multi' : 'single';

  const [selectedPhotos, setSelectedPhotos] = useState<string[]>(
    isMultiPhoto ? [] : (defaultPhoto ? [defaultPhoto] : [])
  );
  const [message, setMessage] = useState('');

  // Dispatch mode (ADR-312 Phase 9.16) — when no real photo is available but
  // `shareData.url` is (always true for property_showcase), auto-switch to
  // link mode: send the token URL as a plain text message instead of blocking
  // the user on a photo upload that can never succeed.
  const hasSelectedPhotos = selectedPhotos.length > 0 || !!defaultPhoto;
  const shareUrl = shareData.url?.trim() ? shareData.url : undefined;
  const isLinkMode = !hasSelectedPhotos && !!shareUrl;
  const canSend = hasSelectedPhotos || isLinkMode;

  // ── Handlers ──

  const handleSend = useCallback(async () => {
    const photoUrls = selectedPhotos.length > 0
      ? selectedPhotos
      : (defaultPhoto ? [defaultPhoto] : []);

    const baseRequest = {
      contactId: contact.id,
      contactName: contact.name,
      channel: channel.provider,
      externalUserId: channel.externalUserId,
      caption: message.trim() || undefined,
    };

    let request: ChannelShareRequest;
    if (photoUrls.length > 0) {
      request = { ...baseRequest, photoUrls };
    } else if (shareUrl) {
      request = { ...baseRequest, shareUrl };
    } else {
      return;
    }

    await onSend(request);
  }, [selectedPhotos, defaultPhoto, shareUrl, contact, channel, message, onSend]);

  const handleMessageChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_MESSAGE_LENGTH) {
      setMessage(value);
    }
  }, []);

  // ── Derived ──

  const ChannelIcon = CHANNEL_ICONS[channel.provider];
  const channelColorClass = CHANNEL_COLORS[channel.provider];
  const channelName = t(`channelShare.channels.${channel.provider}`);
  const hasPhotos = hasSelectedPhotos;
  const isLinkFallback = channel.capabilities.photoMethod === 'link-fallback';
  const charsRemaining = MAX_MESSAGE_LENGTH - message.length;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <section className="space-y-4" aria-label={t('channelShare.sendVia', { channel: channelName })}>
      {/* Header: Contact + Channel badge */}
      <header className="flex items-center gap-2 flex-wrap">
        <span className={cn(
          'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
          'bg-primary/10 text-primary'
        )}>
          {contact.name}
        </span>
        <span className={cn(
          'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
          channelColorClass
        )}>
          <ChannelIcon className="w-3.5 h-3.5" />
          {channelName}
        </span>
      </header>

      {/* Empty-state when neither a photo nor a share URL is available —
          blocks Send entirely. The link-mode fallback (ADR-312 Phase 9.16)
          is only available when `shareData.url` is set. */}
      {!hasPhotos && !isLinkMode && (
        <aside
          className={cn(
            'flex items-start gap-2 p-3 rounded-lg text-xs',
            'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300',
          )}
          role="note"
        >
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{t('channelShare.errors.noPhotoAvailable')}</span>
        </aside>
      )}

      {/* Link-mode notice (ADR-312 Phase 9.16) — shown when auto-switched
          because no photo is available. Explains to the user that the
          token URL will be sent as a text message instead of an image. */}
      {isLinkMode && (
        <aside
          className={cn(
            'flex items-start gap-2 p-3 rounded-lg text-xs',
            'bg-sky-50 text-sky-800 dark:bg-sky-900/20 dark:text-sky-300',
          )}
          role="note"
        >
          <LinkIcon className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{t('channelShare.linkModeNotice')}</span>
        </aside>
      )}

      {/* Link fallback notice */}
      {isLinkFallback && (
        <aside className={cn(
          'flex items-start gap-2 p-3 rounded-lg text-xs',
          'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
        )} role="note">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{t('channelShare.linkFallbackNotice')}</span>
        </aside>
      )}

      {/* Photo picker (only if gallery has >1 photos) */}
      {isMultiPhoto && (
        <fieldset>
          <legend className="text-sm font-medium mb-2">
            {t('channelShare.selectPhotos')}
          </legend>
          <PhotoPickerGrid
            photos={galleryPhotos}
            selected={selectedPhotos}
            onSelectionChange={setSelectedPhotos}
            mode={selectionMode as 'single' | 'multi'}
          />
        </fieldset>
      )}

      {/* Message textarea */}
      <fieldset>
        <legend className="text-sm font-medium mb-2">
          {t('channelShare.messageLabel')}
        </legend>
        <Textarea
          value={message}
          onChange={handleMessageChange}
          placeholder={t('channelShare.messagePlaceholder')}
          rows={3}
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={loading}
        />
        <p className={cn(
          designSystem.presets.text.muted,
          'text-xs mt-1 text-right'
        )}>
          {t('emailShare.charsRemaining', { count: charsRemaining })}
        </p>
      </fieldset>

      {/* Actions */}
      <nav className="flex gap-2">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={loading}
          className="flex-1 gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('channelShare.back')}
        </Button>
        <Button
          onClick={handleSend}
          disabled={loading || !canSend}
          className="flex-1 gap-2"
        >
          {loading ? (
            t('channelShare.sending')
          ) : isLinkMode ? (
            <>
              <LinkIcon className="w-4 h-4" />
              {t('channelShare.sendLinkVia', { channel: channelName })}
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              {t('channelShare.sendVia', { channel: channelName })}
            </>
          )}
        </Button>
      </nav>
    </section>
  );
}
