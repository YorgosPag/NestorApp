'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { CommonBadge } from '@/core/badges';
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

// --- Constants defined outside the component for performance ---

const CHANNEL_ICONS = {
  [MESSAGE_TYPES.EMAIL]: <Mail className="h-4 w-4" />,
  [MESSAGE_TYPES.TELEGRAM]: <MessageSquare className="h-4 w-4" />,
  [MESSAGE_TYPES.WHATSAPP]: <MessageSquare className="h-4 w-4" />,
  [MESSAGE_TYPES.MESSENGER]: <MessageSquare className="h-4 w-4" />,
  [MESSAGE_TYPES.SMS]: <MessageSquare className="h-4 w-4" />,
  [MESSAGE_TYPES.CALL]: <Phone className="h-4 w-4" />,
  default: <MessageSquare className="h-4 w-4" />,
};

const CHANNEL_COLORS = {
  [MESSAGE_TYPES.EMAIL]: 'bg-blue-100 text-blue-800',
  [MESSAGE_TYPES.TELEGRAM]: 'bg-cyan-100 text-cyan-800',
  [MESSAGE_TYPES.WHATSAPP]: 'bg-green-100 text-green-800',
  [MESSAGE_TYPES.MESSENGER]: 'bg-purple-100 text-purple-800',
  [MESSAGE_TYPES.SMS]: 'bg-orange-100 text-orange-800',
  [MESSAGE_TYPES.CALL]: 'bg-gray-100 text-gray-800',
  default: 'bg-gray-100 text-gray-800',
};

const STATUS_ICONS = {
  [MESSAGE_STATUSES.SENT]: <CheckCircle className="h-4 w-4 text-green-600" />,
  [MESSAGE_STATUSES.DELIVERED]: <CheckCircle className="h-4 w-4 text-green-600" />,
  [MESSAGE_STATUSES.COMPLETED]: <CheckCircle className="h-4 w-4 text-green-600" />,
  [MESSAGE_STATUSES.FAILED]: <AlertCircle className="h-4 w-4 text-red-600" />,
  [MESSAGE_STATUSES.PENDING]: <Clock className="h-4 w-4 text-orange-600" />,
  default: <Clock className="h-4 w-4 text-gray-600" />,
};

const safeToLowerCase = (value) => (value || '').toLowerCase();

const UnifiedInbox = ({ leadId = null, showFilters = true, height = "600px" }) => {
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

  // ✅ ENTERPRISE MIGRATION: Using centralized formatDateTime for consistent formatting
  const formatDate = (timestamp) => {
    if (!timestamp) return { relative: '', full: '' };

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffHours = (now - date) / (1000 * 60 * 60);

    let relative = formatDateTime(date);
    if (diffHours < 1) relative = 'Τώρα';
    else if (diffHours < 24) relative = `${Math.floor(diffHours)}ω`;
    else if (diffHours < 48) relative = 'Χθες';

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
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Φόρτωση μηνυμάτων...
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
            <MessageSquare className="h-5 w-5" />
            {leadId ? 'Ιστορικό Επικοινωνιών' : 'Unified Inbox'}
          </CardTitle>
          <div className="flex items-center gap-2">
            <CommonBadge
              status="company"
              customLabel={`${filteredMessages.length} μηνύματα`}
              variant="secondary"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 mt-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Αναζήτηση μηνυμάτων..."
                  value={filters.searchTerm}
                  onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <Select value={filters.selectedChannel} onValueChange={(val) => handleFilterChange('selectedChannel', val)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Όλα</SelectItem>
                {Object.keys(CHANNEL_ICONS).filter(key => key !== 'default').map(channel => (
                  <SelectItem key={channel} value={channel}>{channel.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.selectedDirection} onValueChange={(val) => handleFilterChange('selectedDirection', val)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Κατεύθυνση" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Όλα</SelectItem>
                <SelectItem value={MESSAGE_DIRECTIONS.INBOUND}>Εισερχόμενα</SelectItem>
                <SelectItem value={MESSAGE_DIRECTIONS.OUTBOUND}>Εξερχόμενα</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.selectedStatus} onValueChange={(val) => handleFilterChange('selectedStatus', val)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Κατάσταση" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Όλα</SelectItem>
                {Object.keys(STATUS_ICONS).filter(key => key !== 'default').map(status => (
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
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>Δεν βρέθηκαν μηνύματα</p>
            </div>
          ) : (
            filteredMessages.map((message) => {
              const { relative: relativeTime, full: fullTime } = formatDate(message.createdAt);
              return (
              <Card key={message.id} className={`${HOVER_BACKGROUND_EFFECTS.LIGHT} ${TRANSITION_PRESETS.STANDARD_COLORS}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${CHANNEL_COLORS[message.channel] || CHANNEL_COLORS.default}`}>
                      {CHANNEL_ICONS[message.channel] || CHANNEL_ICONS.default}
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
                            customLabel={message.direction === MESSAGE_DIRECTIONS.INBOUND ? 'Εισερχόμενο' : 'Εξερχόμενο'}
                            variant={message.direction === MESSAGE_DIRECTIONS.INBOUND ? "default" : "secondary"}
                            className="text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500" title={fullTime}>
                          {STATUS_ICONS[message.status] || STATUS_ICONS.default}
                          <span>{relativeTime}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-2 text-sm">
                        <User className="h-3 w-3" />
                        <span className="font-medium">
                          {message.direction === MESSAGE_DIRECTIONS.INBOUND 
                            ? `Από: ${message.from}` 
                            : `Προς: ${message.to}`
                          }
                        </span>
                      </div>

                      {message.subject && (
                        <div className="font-medium mb-1">
                          {truncateText(message.subject, 80)}
                        </div>
                      )}

                      <div className="text-gray-700">
                        {truncateText(message.content, 120)}
                      </div>

                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-2">
                          <CommonBadge
                            status="company"
                            customLabel={`📎 ${message.attachments.length} συνημμένα`}
                            variant="outline"
                            className="text-xs"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      {message.externalId && (
                        <Button asChild variant="ghost" size="sm" className="h-6 w-6 p-0">
                           <a href="#" target="_blank" rel="noopener noreferrer" aria-label="Open original message">
                              <ExternalLink className="h-3 w-3" />
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
