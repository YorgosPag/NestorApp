'use client';

/**
 * =============================================================================
 * CONTACT CHANNEL PICKER — Search Contact + Select Channel
 * =============================================================================
 *
 * Two-step component:
 * 1. Search and select a CRM contact (reuses search-for-share API)
 * 2. Display available channels for the selected contact
 *
 * @module components/ui/channel-sharing/ContactChannelPicker
 * @enterprise Phase 2 — Multi-Channel Sharing
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, ArrowLeft, User, Building2, Wrench, Mail, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { designSystem } from '@/lib/design-system';
import { createModuleLogger } from '@/lib/telemetry';
import {
  WhatsAppIcon,
  TelegramIcon,
  MessengerIcon,
  InstagramIcon,
} from '@/lib/social-sharing/SocialSharingPlatforms';
import type { AvailableChannel, ChannelProvider, ContactChannelsResponse } from './types';

const logger = createModuleLogger('ContactChannelPicker');

// ============================================================================
// TYPES
// ============================================================================

interface ShareableContact {
  id: string;
  name: string;
  type: 'individual' | 'company' | 'service';
}

interface ContactSearchResponse {
  contacts: ShareableContact[];
  count: number;
}

export interface ContactChannelPickerProps {
  onChannelSelect: (contact: { id: string; name: string }, channel: AvailableChannel) => void;
  onBack: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEBOUNCE_MS = 300;

const CONTACT_TYPE_ICONS = {
  individual: User,
  company: Building2,
  service: Wrench,
} as const;

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

// ============================================================================
// COMPONENT
// ============================================================================

export function ContactChannelPicker({ onChannelSelect, onBack }: ContactChannelPickerProps) {
  const { t } = useTranslation('common');

  // Contact search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ShareableContact[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selected contact + channels
  const [selectedContact, setSelectedContact] = useState<ShareableContact | null>(null);
  const [channels, setChannels] = useState<AvailableChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [channelError, setChannelError] = useState<string | null>(null);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ── Contact search ──

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await apiClient.get<ContactSearchResponse>(
          `${API_ROUTES.CONTACTS.SEARCH_FOR_SHARE}?q=${encodeURIComponent(query.trim())}`
        );
        setSearchResults(data.contacts);
      } catch (err) {
        logger.warn('Contact search failed', { error: err });
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  // ── Contact selection → fetch channels ──

  const handleContactSelect = useCallback(async (contact: ShareableContact) => {
    setSelectedContact(contact);
    setSearchQuery('');
    setSearchResults([]);
    setLoadingChannels(true);
    setChannelError(null);

    try {
      const data = await apiClient.get<ContactChannelsResponse>(
        API_ROUTES.CONTACTS.CHANNELS(contact.id)
      );
      setChannels(data.channels);
    } catch (err) {
      logger.error('Failed to load channels', { contactId: contact.id, error: err });
      setChannelError(t('channelShare.errorLoadingChannels'));
      setChannels([]);
    } finally {
      setLoadingChannels(false);
    }
  }, [t]);

  // ── Channel selection ──

  const handleChannelClick = useCallback((channel: AvailableChannel) => {
    if (!selectedContact) return;
    onChannelSelect(
      { id: selectedContact.id, name: selectedContact.name },
      channel
    );
  }, [selectedContact, onChannelSelect]);

  // ── Back to search ──

  const handleBackToSearch = useCallback(() => {
    setSelectedContact(null);
    setChannels([]);
    setChannelError(null);
  }, []);

  // ============================================================================
  // RENDER — Contact Search Step
  // ============================================================================

  if (!selectedContact) {
    return (
      <section className="space-y-4" aria-label={t('channelShare.sendToContact')}>
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t('channelShare.searchContact')}
            className="pl-10"
            autoFocus
          />
        </div>

        {/* Search results */}
        {isSearching && (
          <div className="flex items-center gap-2 py-3 justify-center">
            <Spinner className="w-4 h-4" />
            <span className={designSystem.presets.text.muted}>
              {t('channelShare.searchingContacts')}
            </span>
          </div>
        )}

        {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
          <p className={cn(designSystem.presets.text.muted, 'text-center py-3')}>
            {t('channelShare.noResults')}
          </p>
        )}

        {searchResults.length > 0 && (
          <ul className="space-y-1 max-h-48 overflow-y-auto" role="listbox">
            {searchResults.map((contact) => {
              const TypeIcon = CONTACT_TYPE_ICONS[contact.type] ?? User;
              return (
                <li key={contact.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => handleContactSelect(contact)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left',
                      'hover:bg-accent transition-colors cursor-pointer'
                    )}
                  >
                    <TypeIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">{contact.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Back button */}
        <nav>
          <Button variant="outline" onClick={onBack} className="w-full gap-2">
            <ArrowLeft className="w-4 h-4" />
            {t('channelShare.back')}
          </Button>
        </nav>
      </section>
    );
  }

  // ============================================================================
  // RENDER — Channel Selection Step
  // ============================================================================

  return (
    <section className="space-y-4" aria-label={t('channelShare.selectChannel')}>
      {/* Selected contact badge */}
      <header className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg',
        'bg-primary/10 dark:bg-primary/20'
      )}>
        <User className="w-4 h-4 text-primary shrink-0" />
        <span className="text-sm font-medium truncate">
          {t('channelShare.contactName', { name: selectedContact.name })}
        </span>
        <button
          type="button"
          onClick={handleBackToSearch}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t('channelShare.back')}
        >
          ✕
        </button>
      </header>

      {/* Channel list */}
      {loadingChannels && (
        <div className="flex items-center gap-2 py-6 justify-center">
          <Spinner className="w-4 h-4" />
          <span className={designSystem.presets.text.muted}>
            {t('channelShare.loadingChannels')}
          </span>
        </div>
      )}

      {channelError && (
        <p className="text-sm text-destructive text-center py-3">{channelError}</p>
      )}

      {!loadingChannels && !channelError && channels.length === 0 && (
        <p className={cn(designSystem.presets.text.muted, 'text-center py-6')}>
          {t('channelShare.noChannels')}
        </p>
      )}

      {!loadingChannels && channels.length > 0 && (
        <ul className="space-y-2" role="listbox" aria-label={t('channelShare.selectChannel')}>
          {channels.map((channel, idx) => {
            const ChannelIcon = CHANNEL_ICONS[channel.provider];
            const colorClass = CHANNEL_COLORS[channel.provider];
            const capabilityKey = channel.capabilities.photoMethod === 'native'
              ? 'photo'
              : channel.capabilities.photoMethod === 'attachment'
                ? 'attachment'
                : 'linkFallback';

            return (
              <li key={`${channel.provider}-${idx}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => handleChannelClick(channel)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg border',
                    'hover:bg-accent hover:border-primary/30 transition-all cursor-pointer',
                    'border-border'
                  )}
                >
                  <ChannelIcon className={cn('w-5 h-5 shrink-0', colorClass)} />

                  <div className="flex-1 min-w-0 text-left">
                    <span className="text-sm font-medium block">
                      {t(`channelShare.channels.${channel.provider}`)}
                    </span>
                    {channel.displayName && (
                      <span className="text-xs text-muted-foreground truncate block">
                        {channel.displayName}
                      </span>
                    )}
                  </div>

                  {/* Capability badge */}
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full shrink-0',
                    channel.capabilities.supportsNativePhoto
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  )}>
                    {t(`channelShare.capability.${capabilityKey}`)}
                  </span>

                  {/* Verified badge */}
                  {channel.verified && (
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0" aria-label={t('channelShare.verified')} />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Back button */}
      <nav>
        <Button variant="outline" onClick={onBack} className="w-full gap-2">
          <ArrowLeft className="w-4 h-4" />
          {t('channelShare.back')}
        </Button>
      </nav>
    </section>
  );
}
