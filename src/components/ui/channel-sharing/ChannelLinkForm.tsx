'use client';

/**
 * =============================================================================
 * CHANNEL LINK FORM — Manual Provider Linking for a Selected Contact
 * =============================================================================
 *
 * Extracted from `ContactChannelPicker` (ADR-312 Phase 9.13) to keep the picker
 * under Google's 500-LoC component limit and to give the manual linking flow
 * its own single-responsibility surface. The form consumes `linkingHints[]`
 * emitted by `/api/contacts/[id]/channels` so the user edits the pre-filled
 * Telegram chat_id and display name instead of retyping them from scratch.
 *
 * @module components/ui/channel-sharing/ChannelLinkForm
 */

import React, { useCallback, useState } from 'react';
import { Link2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/providers/NotificationProvider';
import { isValidTelegramChatId } from '@/lib/telegram/chat-id-validator';
import {
  WhatsAppIcon,
  TelegramIcon,
  MessengerIcon,
  InstagramIcon,
} from '@/lib/social-sharing/SocialSharingPlatforms';
import type { ChannelProvider, LinkingHint } from './types';

const CHANNEL_ICONS: Record<ChannelProvider, React.FC<{ className?: string }>> = {
  email: ({ className }) => <Mail className={className} />,
  telegram: TelegramIcon,
  whatsapp: WhatsAppIcon,
  messenger: MessengerIcon,
  instagram: InstagramIcon,
};

const CHANNEL_COLORS: Record<ChannelProvider, string> = {
  email: 'text-gray-600 dark:text-gray-400',
  telegram: 'text-sky-500',
  whatsapp: 'text-green-500',
  messenger: 'text-blue-500',
  instagram: 'text-pink-500',
};

export interface ChannelLinkFormProps {
  contactId: string;
  contactName: string;
  linkingHints: LinkingHint[];
  onLinked: () => void;
  onCancel: () => void;
}

export function ChannelLinkForm({
  contactId,
  contactName,
  linkingHints,
  onLinked,
  onCancel,
}: ChannelLinkFormProps): React.ReactElement {
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const notifications = useNotifications();

  const [provider, setProvider] = useState<ChannelProvider | ''>('');
  const [externalId, setExternalId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  // When the user picks a provider, reuse any signal the contact profile
  // already carries so they don't retype known information. Today Telegram is
  // the only provider that emits hints (ADR-312 Phase 9.13): a non-numeric
  // `@username` handle ends up here so the user can replace it with a numeric
  // chat_id. Display name falls back to the contact's own name.
  const applyProviderDefaults = useCallback(
    (next: ChannelProvider): void => {
      const hint = linkingHints.find((h) => h.provider === next);
      setExternalId(hint?.suggestedExternalId ?? '');
      setDisplayName(hint?.suggestedDisplayName ?? contactName);
    },
    [linkingHints, contactName],
  );

  const handleProviderChange = useCallback(
    (next: ChannelProvider): void => {
      setProvider(next);
      applyProviderDefaults(next);
    },
    [applyProviderDefaults],
  );

  const isTelegramInvalid =
    provider === 'telegram' &&
    externalId.trim().length > 0 &&
    !isValidTelegramChatId(externalId);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!provider || !externalId.trim()) return;
    setIsLinking(true);
    try {
      await apiClient.post(API_ROUTES.CONTACTS.LINK_CHANNEL(contactId), {
        provider,
        externalUserId: externalId.trim(),
        displayName: displayName.trim() || undefined,
      });
      notifications.success(t('channelShare.linkSuccess'));
      onLinked();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      notifications.error(t('channelShare.linkError', { error: msg }));
    } finally {
      setIsLinking(false);
    }
  }, [provider, externalId, displayName, contactId, notifications, t, onLinked]);

  return (
    <fieldset className="space-y-3 p-3 rounded-lg border border-border">
      <legend className="text-xs font-medium flex items-center gap-1.5 px-1">
        <Link2 className="w-3.5 h-3.5" />
        {t('channelShare.linkChannelDesc')}
      </legend>

      <Select value={provider} onValueChange={(v) => handleProviderChange(v as ChannelProvider)}>
        <SelectTrigger className="text-sm">
          <SelectValue placeholder={t('channelShare.selectProvider')} />
        </SelectTrigger>
        <SelectContent>
          {(['telegram', 'whatsapp', 'messenger', 'instagram'] as const).map((p) => {
            const PIcon = CHANNEL_ICONS[p];
            return (
              <SelectItem key={p} value={p}>
                <span className="flex items-center gap-2">
                  <PIcon className={cn('w-4 h-4', CHANNEL_COLORS[p])} />
                  {t(`channelShare.channels.${p}`)}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {provider && (
        <>
          <Input
            value={externalId}
            onChange={(e) => setExternalId(e.target.value)}
            placeholder={t(`channelShare.externalIdPlaceholder.${provider}`)}
            className="text-sm"
            aria-invalid={isTelegramInvalid}
          />
          {isTelegramInvalid && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t('channelShare.errors.telegramChatIdNonNumeric')}
            </p>
          )}
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t('channelShare.displayNameLabel')}
            className="text-sm"
          />
        </>
      )}

      <nav className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} className="flex-1">
          {t('channelShare.back')}
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isLinking || !provider || !externalId.trim() || isTelegramInvalid}
          className="flex-1"
        >
          {isLinking ? t('channelShare.linking') : t('channelShare.linkChannel')}
        </Button>
      </nav>
    </fieldset>
  );
}
