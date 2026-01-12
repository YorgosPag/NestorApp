'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { CommonBadge } from '@/core/badges';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { formatDateTime } from '@/lib/intl-utils';
import { truncateText } from '@/lib/obligations-utils'; // ✅ Using centralized function
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { HOVER_BACKGROUND_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { createDynamicHeightConfig } from '@/components/ui/enterprise-portal/migration-utilities';
import { 
  MessageSquare, 
  Mail, 
  Phone, 
  Send, 
  Search, 
  RefreshCw,
  User,
  Clock,
  CheckCircle,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import communicationsService from '../../lib/communications';
import { MESSAGE_TYPES, MESSAGE_STATUSES, MESSAGE_DIRECTIONS } from '../../lib/config/communications.config.js';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// --- Constants defined outside the component for performance ---

// Note: CHANNEL_ICONS will use iconSizes within component context

const getChannelColors = (colors: ReturnType<typeof useSemanticColors>) => ({
  [MESSAGE_TYPES.EMAIL]: `${colors.bg.infoSubtle} ${colors.text.info}`,
  [MESSAGE_TYPES.TELEGRAM]: `${colors.bg.accentSubtle} ${colors.text.accent}`,
  [MESSAGE_TYPES.WHATSAPP]: `${colors.bg.successSubtle} ${colors.text.success}`,
  [MESSAGE_TYPES.MESSENGER]: `${colors.bg.accentSubtle} ${colors.text.accent}`,
  [MESSAGE_TYPES.SMS]: `${colors.bg.warningSubtle} ${colors.text.warning}`,
  [MESSAGE_TYPES.CALL]: `${colors.bg.muted} ${colors.text.muted}`,
  default: `${colors.bg.muted} ${colors.text.muted}`,
});

// Note: STATUS_ICONS will use iconSizes within component context

const safeToLowerCase = (value) => (value || '').toLowerCase();

const UnifiedInbox = ({ leadId = null, showFilters = true, height = "600px" }) => {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('crm');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const channelColors = getChannelColors(colors);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState({
    searchTerm: '',
    selectedChannel: 'all',
    selectedStatus: 'all',
    selectedDirection: 'all',
  });

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      const data = leadId
        ? await communicationsService.getLeadCommunications(leadId, { limit: 100 })
        : await communicationsService.getUnifiedInbox({ limit: 100 });
      setMessages(data);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    loadMessages();
  }, []); // 🔧 FIX: Removed loadMessages to prevent infinite loop - load once on mount

  const filteredMessages = useMemo(() => {
    let filtered = [...messages];
    const searchTermLower = safeToLowerCase(filters.searchTerm);

    if (filters.searchTerm) {
      filtered = filtered.filter(msg =>
        safeToLowerCase(msg.content).includes(searchTermLower) ||
        safeToLowerCase(msg.subject).includes(searchTermLower) ||
        safeToLowerCase(msg.from).includes(searchTermLower) ||
        safeToLowerCase(msg.to).includes(searchTermLower)
      );
    }
    if (filters.selectedChannel !== 'all') {
      filtered = filtered.filter(msg => msg.channel === filters.selectedChannel);
    }
    if (filters.selectedStatus !== 'all') {
      filtered = filtered.filter(msg => msg.status === filters.selectedStatus);
    }
    if (filters.selectedDirection !== 'all') {
      filtered = filtered.filter(msg => msg.direction === filters.selectedDirection);
    }

    return filtered;
  }, [messages, filters]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMessages();
    setRefreshing(false);
  };
  
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Dynamic icon creation functions
  const getChannelIcon = (type) => {
    switch(type) {
      case MESSAGE_TYPES.EMAIL: return <Mail className={iconSizes.sm} />;
      case MESSAGE_TYPES.TELEGRAM: return <MessageSquare className={iconSizes.sm} />;
      case MESSAGE_TYPES.WHATSAPP: return <MessageSquare className={iconSizes.sm} />;
      case MESSAGE_TYPES.MESSENGER: return <MessageSquare className={iconSizes.sm} />;
      case MESSAGE_TYPES.SMS: return <MessageSquare className={iconSizes.sm} />;
      case MESSAGE_TYPES.CALL: return <Phone className={iconSizes.sm} />;
      default: return <MessageSquare className={iconSizes.sm} />;
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case MESSAGE_STATUSES.SENT: return <CheckCircle className={`${iconSizes.sm} ${colors.text.success}`} />;
      case MESSAGE_STATUSES.DELIVERED: return <CheckCircle className={`${iconSizes.sm} ${colors.text.success}`} />;
      case MESSAGE_STATUSES.COMPLETED: return <CheckCircle className={`${iconSizes.sm} ${colors.text.success}`} />;
      case MESSAGE_STATUSES.FAILED: return <AlertCircle className={`${iconSizes.sm} ${colors.text.error}`} />;
      case MESSAGE_STATUSES.PENDING: return <Clock className={`${iconSizes.sm} ${colors.text.warning}`} />;
      default: return <Clock className={`${iconSizes.sm} ${colors.text.muted}`} />;
    }
  };

  // ✅ ENTERPRISE MIGRATION: Using centralized formatDateTime for consistent formatting
  const formatDate = (timestamp) => {
    if (!timestamp) return { relative: '', full: '' };

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffHours = (now - date) / (1000 * 60 * 60);

    let relative = formatDateTime(date);
    if (diffHours < 1) relative = t('inbox.time.now');
    else if (diffHours < 24) relative = t('inbox.time.hoursAgo', { hours: Math.floor(diffHours) });
    else if (diffHours < 48) relative = t('inbox.time.yesterday');

    return {
      relative,
      full: formatDateTime(date) // ✅ Using centralized function
    };
  };


  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className={`${iconSizes.lg} animate-spin mr-2`} />
            {t('inbox.loading')}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className={iconSizes.md} />
            {leadId ? t('inbox.historyTitle') : t('inbox.title')}
          </CardTitle>
          <div className="flex items-center gap-2">
            <CommonBadge
              status="company"
              customLabel={t('inbox.messagesCount', { count: filteredMessages.length })}
              variant="secondary"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`${iconSizes.sm} ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 mt-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${iconSizes.sm} ${colors.text.muted}`} />
                <Input
                  placeholder={t('inbox.search')}
                  value={filters.searchTerm}
                  onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <Select value={filters.selectedChannel} onValueChange={(val) => handleFilterChange('selectedChannel', val)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t('inbox.filters.channel')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('inbox.filters.all')}</SelectItem>
                {Object.keys(MESSAGE_TYPES).map(channel => (
                  <SelectItem key={channel} value={channel}>{channel.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.selectedDirection} onValueChange={(val) => handleFilterChange('selectedDirection', val)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t('inbox.filters.direction')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('inbox.filters.all')}</SelectItem>
                <SelectItem value={MESSAGE_DIRECTIONS.INBOUND}>{t('inbox.direction.inbound')}</SelectItem>
                <SelectItem value={MESSAGE_DIRECTIONS.OUTBOUND}>{t('inbox.direction.outbound')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.selectedStatus} onValueChange={(val) => handleFilterChange('selectedStatus', val)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t('inbox.filters.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('inbox.filters.all')}</SelectItem>
                {Object.keys(MESSAGE_STATUSES).filter(key => key !== 'default').map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className={`space-y-2 overflow-y-auto`} style={createDynamicHeightConfig(height).containerStyle}>
          {filteredMessages.length === 0 ? (
            <div className={`text-center py-8 ${colors.text.muted}`}>
              <MessageSquare className={`${iconSizes.xl} mx-auto mb-2 opacity-30`} />
              <p>{t('inbox.noMessages')}</p>
            </div>
          ) : (
            filteredMessages.map((message) => {
              const { relative: relativeTime, full: fullTime } = formatDate(message.createdAt);
              return (
              <Card key={message.id} className={`${HOVER_BACKGROUND_EFFECTS.LIGHT} ${TRANSITION_PRESETS.STANDARD_COLORS}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${channelColors[message.channel] || channelColors.default}`}>
                      {getChannelIcon(message.channel)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <CommonBadge
                            status="company"
                            customLabel={message.channel?.toUpperCase()}
                            variant="outline"
                            className="text-xs"
                          />
                          <CommonBadge
                            status="company"
                            customLabel={message.direction === MESSAGE_DIRECTIONS.INBOUND ? t('inbox.direction.inbound') : t('inbox.direction.outbound')}
                            variant={message.direction === MESSAGE_DIRECTIONS.INBOUND ? "default" : "secondary"}
                            className="text-xs"
                          />
                        </div>
                        <div className={`flex items-center gap-2 text-sm ${colors.text.muted}`} title={fullTime}>
                          {getStatusIcon(message.status)}
                          <span>{relativeTime}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-2 text-sm">
                        <User className={iconSizes.xs} />
                        <span className="font-medium">
                          {message.direction === MESSAGE_DIRECTIONS.INBOUND
                            ? `${t('inbox.message.from')}: ${message.from}`
                            : `${t('inbox.message.to')}: ${message.to}`
                          }
                        </span>
                      </div>

                      {message.subject && (
                        <div className="font-medium mb-1">
                          {truncateText(message.subject, 80)}
                        </div>
                      )}

                      <div className={colors.text.primary}>
                        {truncateText(message.content, 120)}
                      </div>

                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-2">
                          <CommonBadge
                            status="company"
                            customLabel={`📎 ${t('inbox.message.attachments', { count: message.attachments.length })}`}
                            variant="outline"
                            className="text-xs"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      {message.externalId && (
                        <Button asChild variant="ghost" size="sm" className={`${iconSizes.md} p-0`}>
                           <a href="#" target="_blank" rel="noopener noreferrer" aria-label="Open original message">
                              <ExternalLink className={iconSizes.xs} />
                           </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default UnifiedInbox;
